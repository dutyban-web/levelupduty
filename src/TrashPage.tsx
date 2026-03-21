/**
 * 휴지통
 * · 노트(Fragment): 정상 보관함 키 `creative_os_fragment_v1`를 불러온 뒤 entries 중 is_deleted === true 만 표시
 * · 기타: app_kv 행 단위로 is_deleted 컬럼이 true인 키 (Fragment 키는 제외 — 위에서 처리)
 */
import { useCallback, useEffect, useState } from 'react'
import {
  kvGetTrash,
  kvRestore,
  kvPermanentDelete,
  kvGet,
  isSupabaseReady,
  type KvTrashRow,
} from './lib/supabase'
import {
  FRAGMENT_KEY,
  loadFragmentStore,
  saveFragmentStore,
  restoreFragmentEntry,
  purgeFragmentEntry,
  mergeFragmentStores,
  FRAGMENT_KIND_META,
  type FragmentStore,
  type FragmentEntry,
} from './fragmentData'

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  )
  useEffect(() => {
    const fn = () => setNarrow(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return narrow
}

function previewValue(value: unknown, max = 120): string {
  try {
    const s = typeof value === 'string' ? value : JSON.stringify(value)
    return s.length <= max ? s : `${s.slice(0, max)}…`
  } catch {
    return '(값 미리보기 불가)'
  }
}

/**
 * 정상 활성 행(보관함)의 Fragment 스토어를 불러옴 (복구·영구삭제 시 전체 스토어 기준).
 * DB `kvGet(FRAGMENT_KEY)` + 로컬 병합 — 행의 is_deleted 컬럼이 아니라 JSON 안 entries를 쓴다.
 */
async function fetchFragmentVault(): Promise<FragmentStore> {
  const local = loadFragmentStore()
  if (!isSupabaseReady) return local
  const remote = await kvGet<FragmentStore>(FRAGMENT_KEY)
  if (!remote || !Array.isArray(remote.entries)) return local
  return mergeFragmentStores(local, remote)
}

/** JSON/직렬화 이슈 대비 */
function entryIsTrashed(e: FragmentEntry): boolean {
  if (e.is_deleted === true) return true
  const v = (e as unknown as Record<string, unknown>).is_deleted
  return v === 'true' || v === 1 || v === '1'
}

/** 로컬·원격 각각에서 is_deleted 인 항목을 합침 (한쪽만 최신이어도 휴지통에 표시) */
function collectTrashedFragmentEntries(
  local: FragmentStore,
  remote: FragmentStore | null,
): FragmentEntry[] {
  const localT = local.entries.filter(entryIsTrashed)
  const remoteT = (remote?.entries ?? []).filter(entryIsTrashed)
  const byId = new Map<string, FragmentEntry>()
  for (const e of [...localT, ...remoteT]) {
    const prev = byId.get(e.id)
    if (!prev || e.updatedAt.localeCompare(prev.updatedAt) > 0) byId.set(e.id, e)
  }
  return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

async function fetchLocalAndRemoteFragment(): Promise<{ local: FragmentStore; remote: FragmentStore | null }> {
  const local = loadFragmentStore()
  if (!isSupabaseReady) return { local, remote: null }
  const remote = await kvGet<FragmentStore>(FRAGMENT_KEY)
  if (!remote || !Array.isArray(remote.entries)) return { local, remote: null }
  return { local, remote }
}

export function TrashPage() {
  const isMobile = useIsNarrow()
  const [rows, setRows] = useState<KvTrashRow[]>([])
  /** 휴지통에 둘 Fragment 노트 (로컬·원격 합집합으로 계산) */
  const [trashEntries, setTrashEntries] = useState<FragmentEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // 1) 보관함 키: 로컬 + 서버 각각 로드 (병합만으로는 휴지통 플래그가 덮일 수 있음)
      const { local, remote } = await fetchLocalAndRemoteFragment()
      const trashed = collectTrashedFragmentEntries(local, remote)
      setTrashEntries(trashed)

      if (import.meta.env.DEV) {
        console.log('휴지통 데이터:', trashed)
        console.log('[TrashPage] 휴지통 디버그', {
          localEntryCount: local.entries.length,
          remoteEntryCount: remote?.entries?.length ?? 0,
          localTrashedCount: local.entries.filter(entryIsTrashed).length,
          remoteTrashedCount: (remote?.entries ?? []).filter(entryIsTrashed).length,
        })
      }

      // 2) 행 단위 휴지통(기타 키) — Fragment 보관함 키는 제외
      let kvRows: KvTrashRow[] = []
      if (isSupabaseReady) {
        const raw = await kvGetTrash()
        kvRows = raw.filter(r => r.key !== FRAGMENT_KEY)
      }
      setRows(kvRows)
    } catch (e) {
      console.error('[TrashPage] load 실패:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onRestore = async (key: string) => {
    setBusyKey(key)
    try {
      const ok = await kvRestore(key)
      if (!ok) window.alert('복구에 실패했습니다. 로그인과 네트워크를 확인해 주세요.')
      else await load()
    } finally {
      setBusyKey(null)
    }
  }

  const onPermanent = async (key: string) => {
    if (!window.confirm(`「${key}」를 영구 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`)) return
    setBusyKey(key)
    try {
      const ok = await kvPermanentDelete(key)
      if (!ok) window.alert('영구 삭제에 실패했습니다.')
      else await load()
    } finally {
      setBusyKey(null)
    }
  }

  /** 복구: 해당 entry의 is_deleted → false, 보관함 전체를 saveFragmentStore → kvSet */
  const onRestoreFragment = async (id: string) => {
    setBusyKey(`frag:${id}`)
    try {
      const vault = await fetchFragmentVault()
      const next = restoreFragmentEntry(vault, id)
      saveFragmentStore(next)
      await load()
    } catch (e) {
      console.error(e)
      window.alert('복구에 실패했습니다.')
    } finally {
      setBusyKey(null)
    }
  }

  /** 영구 삭제: 배열에서 항목 제거 후 보관함 전체 kvSet */
  const onPermanentFragment = async (id: string) => {
    if (!window.confirm('이 노트 조각을 영구 삭제할까요?\n이 작업은 되돌릴 수 없습니다.')) return
    setBusyKey(`frag:${id}`)
    try {
      const vault = await fetchFragmentVault()
      const next = purgeFragmentEntry(vault, id)
      saveFragmentStore(next)
      await load()
    } catch (e) {
      console.error(e)
      window.alert('영구 삭제에 실패했습니다.')
    } finally {
      setBusyKey(null)
    }
  }

  const hasAny = rows.length > 0 || trashEntries.length > 0

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '16px 12px' : '28px 24px' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 800, color: '#37352F' }}>🗑️ 휴지통</h1>
      <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#787774', lineHeight: 1.5 }}>
        <strong style={{ color: '#37352F' }}>노트(Fragment)</strong>는 보관함 키{' '}
        <code style={{ fontSize: '12px', background: '#f4f4f2', padding: '2px 6px', borderRadius: '4px' }}>{FRAGMENT_KEY}</code>
        를 불러온 뒤, 그 안의 <code style={{ fontSize: '12px', background: '#f4f4f2', padding: '2px 6px', borderRadius: '4px' }}>entries</code> 중{' '}
        <code style={{ fontSize: '12px', background: '#f4f4f2', padding: '2px 6px', borderRadius: '4px' }}>is_deleted === true</code>
        인 항목만 보여 줍니다. 복구 시 해당 항목만 <code style={{ fontSize: '12px', background: '#f4f4f2', padding: '2px 6px', borderRadius: '4px' }}>is_deleted: false</code>로 되돌린 전체 보관함을 <code style={{ fontSize: '12px', background: '#f4f4f2', padding: '2px 6px', borderRadius: '4px' }}>kvSet</code>합니다.
        {' '}<strong style={{ color: '#37352F' }}>다른 동기화 키</strong>는{' '}
        <code style={{ fontSize: '12px', background: '#f4f4f2', padding: '2px 6px', borderRadius: '4px' }}>app_kv</code> 행의 <code style={{ fontSize: '12px', background: '#f4f4f2', padding: '2px 6px', borderRadius: '4px' }}>is_deleted</code> 컬럼이 true인 경우입니다(Fragment 키 제외).
      </p>

      {loading ? (
        <p style={{ color: '#787774', fontSize: '14px' }}>불러오는 중…</p>
      ) : !hasAny ? (
        <div
          style={{
            padding: '32px 20px',
            borderRadius: '12px',
            border: '1px dashed rgba(0,0,0,0.06)',
            backgroundColor: '#fafafa',
            textAlign: 'center',
            color: '#9B9A97',
            fontSize: '14px',
          }}
        >
          휴지통이 비어 있습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {trashEntries.length > 0 && (
            <section>
              <h2 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800, color: '#37352F' }}>
                노트 조각 (Fragment 보관함)
              </h2>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {trashEntries.map(entry => {
                  const b = busyKey === `frag:${entry.id}`
                  const meta = FRAGMENT_KIND_META[entry.kind]
                  return (
                    <li
                      key={entry.id}
                      style={{
                        border: '1px solid rgba(0,0,0,0.06)',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        backgroundColor: '#fff',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'flex-start',
                        gap: '12px',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#6366f1' }}>
                          {meta.emoji} {meta.label} · {entry.id}
                        </div>
                        <div style={{ marginTop: '6px', fontSize: '14px', fontWeight: 700, color: '#37352F', wordBreak: 'break-word' }}>
                          {entry.title || '(제목 없음)'}
                        </div>
                        <pre
                          style={{
                            margin: '8px 0 0',
                            fontSize: '11px',
                            color: '#787774',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            maxHeight: '100px',
                            overflow: 'auto',
                            background: '#f7f7f5',
                            padding: '8px 10px',
                            borderRadius: '8px',
                          }}
                        >
                          {previewValue(entry.body, 200)}
                        </pre>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', flexShrink: 0 }}>
                        <button
                          type="button"
                          disabled={b}
                          onClick={() => void onRestoreFragment(entry.id)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '8px',
                            border: '1px solid rgba(99,102,241,0.35)',
                            backgroundColor: 'rgba(99,102,241,0.08)',
                            color: '#4F46E5',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: b ? 'wait' : 'pointer',
                            opacity: b ? 0.7 : 1,
                          }}
                        >
                          복구
                        </button>
                        <button
                          type="button"
                          disabled={b}
                          onClick={() => void onPermanentFragment(entry.id)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '8px',
                            border: '1px solid rgba(239,68,68,0.4)',
                            backgroundColor: 'rgba(239,68,68,0.06)',
                            color: '#b91c1c',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: b ? 'wait' : 'pointer',
                            opacity: b ? 0.7 : 1,
                          }}
                        >
                          영구 삭제
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {rows.length > 0 && (
            <section>
              <h2 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800, color: '#37352F' }}>
                기타 동기화 키 (app_kv 행 단위)
              </h2>
              {!isSupabaseReady && (
                <p style={{ fontSize: '12px', color: '#b45309', marginBottom: '12px' }}>
                  Supabase에 연결되지 않아 이 목록을 불러올 수 없습니다.
                </p>
              )}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {rows.map(row => {
                  const b = busyKey === row.key
                  return (
                    <li
                      key={row.key}
                      style={{
                        border: '1px solid rgba(0,0,0,0.06)',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        backgroundColor: '#fff',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'flex-start',
                        gap: '12px',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#37352F', wordBreak: 'break-all' }}>{row.key}</div>
                        <pre
                          style={{
                            margin: '8px 0 0',
                            fontSize: '11px',
                            color: '#787774',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            maxHeight: '120px',
                            overflow: 'auto',
                            background: '#f7f7f5',
                            padding: '8px 10px',
                            borderRadius: '8px',
                          }}
                        >
                          {previewValue(row.value)}
                        </pre>
                        {row.synced_at && (
                          <div style={{ marginTop: '6px', fontSize: '10px', color: '#AEAAA4' }}>
                            동기화: {new Date(row.synced_at).toLocaleString('ko-KR')}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', flexShrink: 0 }}>
                        <button
                          type="button"
                          disabled={b}
                          onClick={() => void onRestore(row.key)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '8px',
                            border: '1px solid rgba(99,102,241,0.35)',
                            backgroundColor: 'rgba(99,102,241,0.08)',
                            color: '#4F46E5',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: b ? 'wait' : 'pointer',
                            opacity: b ? 0.7 : 1,
                          }}
                        >
                          복구
                        </button>
                        <button
                          type="button"
                          disabled={b}
                          onClick={() => void onPermanent(row.key)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '8px',
                            border: '1px solid rgba(239,68,68,0.4)',
                            backgroundColor: 'rgba(239,68,68,0.06)',
                            color: '#b91c1c',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: b ? 'wait' : 'pointer',
                            opacity: b ? 0.7 : 1,
                          }}
                        >
                          영구 삭제
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
