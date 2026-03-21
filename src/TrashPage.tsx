/**
 * 휴지통
 * · app_kv 행 단위: is_deleted === true
 * · Fragment 노트: 동일 키 JSON 안 entries[].is_deleted === true
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
  getTrashedFragmentEntries,
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

async function loadFragmentStoreMerged(): Promise<FragmentStore> {
  const local = loadFragmentStore()
  if (!isSupabaseReady) return local
  const remote = await kvGet<FragmentStore>(FRAGMENT_KEY)
  if (!remote || !Array.isArray(remote.entries)) return local
  return mergeFragmentStores(local, remote)
}

export function TrashPage() {
  const isMobile = useIsNarrow()
  const [rows, setRows] = useState<KvTrashRow[]>([])
  const [fragTrash, setFragTrash] = useState<FragmentEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let kvRows: KvTrashRow[] = []
      if (isSupabaseReady) {
        kvRows = await kvGetTrash()
      }
      setRows(kvRows)

      const store = await loadFragmentStoreMerged()
      setFragTrash(getTrashedFragmentEntries(store))
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

  const onRestoreFragment = async (id: string) => {
    setBusyKey(`frag:${id}`)
    try {
      const store = await loadFragmentStoreMerged()
      const next = restoreFragmentEntry(store, id)
      saveFragmentStore(next)
      await load()
    } catch (e) {
      console.error(e)
      window.alert('복구에 실패했습니다.')
    } finally {
      setBusyKey(null)
    }
  }

  const onPermanentFragment = async (id: string) => {
    if (!window.confirm('이 노트 조각을 영구 삭제할까요?\n이 작업은 되돌릴 수 없습니다.')) return
    setBusyKey(`frag:${id}`)
    try {
      const store = await loadFragmentStoreMerged()
      const next = purgeFragmentEntry(store, id)
      saveFragmentStore(next)
      await load()
    } catch (e) {
      console.error(e)
      window.alert('영구 삭제에 실패했습니다.')
    } finally {
      setBusyKey(null)
    }
  }

  const hasAny = rows.length > 0 || fragTrash.length > 0

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '16px 12px' : '28px 24px' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 800, color: '#37352F' }}>🗑️ 휴지통</h1>
      <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#787774', lineHeight: 1.5 }}>
        <strong style={{ color: '#37352F' }}>노트(Fragment)</strong>는 같은 키(
        <code style={{ fontSize: '12px', background: '#f4f4f2', padding: '2px 6px', borderRadius: '4px' }}>{FRAGMENT_KEY}</code>
        ) 안에서 항목만 휴지통 처리됩니다. <strong style={{ color: '#37352F' }}>동기화 키</strong>는{' '}
        <code style={{ fontSize: '12px', background: '#f4f4f2', padding: '2px 6px', borderRadius: '4px' }}>app_kv</code>{' '}
        행 전체가 휴지통에 있을 때 표시됩니다.
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
          {fragTrash.length > 0 && (
            <section>
              <h2 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800, color: '#37352F' }}>
                노트 조각 (Fragment)
              </h2>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {fragTrash.map(entry => {
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
                동기화 키 (app_kv 행)
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
