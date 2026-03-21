/**
 * 휴지통 — Fragment 노트, app_kv JSON 스토어 항목 소프트 삭제, Supabase workflows/quests
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
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
import {
  loadValueActionStore,
  saveValueActionStore,
  restoreValueAction,
  purgeValueAction,
  VALUE_ACTION_STORE_KEY,
  type ValueAction,
} from './valueActionData'
import {
  loadNetworkStore,
  saveNetworkStore,
  restoreContact,
  purgeContact,
  NETWORK_STORE_KEY,
  type NetworkContact,
} from './networkData'
import {
  loadQuantumFlowStore,
  saveQuantumFlowStore,
  restoreLetter,
  purgeLetter,
  QUANTUM_FLOW_KEY,
  type QuantumLetter,
} from './quantumFlowData'
import {
  loadLedgerStore,
  saveLedgerStore,
  restoreLedgerEntry,
  purgeLedgerEntry,
  ACCOUNT_LEDGER_KEY,
  type LedgerEntry,
} from './accountLedgerData'
import {
  loadEvolutionStore,
  saveEvolutionStore,
  restoreEvolutionItem,
  purgeEvolutionItem,
  EVOLUTION_KEY,
  EVOLUTION_CATEGORY_LABEL,
  type EvolutionItem,
} from './evolutionData'
import {
  loadPlaybookStore,
  savePlaybookStore,
  restorePlaybookItem,
  purgePlaybookItem,
  PLAYBOOK_STORE_KEY,
  type PlaybookItem,
} from './humanRelationsPlaybookData'
import {
  loadRpgProfile,
  saveRpgProfile,
  restoreRpgStatLine,
  purgeRpgStatLine,
  restoreRpgBoss,
  purgeRpgBoss,
  restoreRpgMap,
  purgeRpgMap,
  restoreRpgQuest,
  purgeRpgQuest,
  restoreRpgSkill,
  purgeRpgSkill,
  LEVELUP_RPG_KEY,
  type LevelupRpgProfile,
} from './levelupRpgProfile'
import {
  fetchTrashedWorkflows,
  fetchTrashedUserQuests,
  restoreWorkflow,
  permanentDeleteWorkflow,
  restoreUserQuestRow,
  permanentDeleteUserQuestRow,
  type WorkflowRow,
  type UserQuestRow,
} from './supabase'
import { itemIsTrashed } from './kvItemTrash'

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

async function fetchFragmentVault(): Promise<FragmentStore> {
  const local = loadFragmentStore()
  if (!isSupabaseReady) return local
  const remote = await kvGet<FragmentStore>(FRAGMENT_KEY)
  if (!remote || !Array.isArray(remote.entries)) return local
  return mergeFragmentStores(local, remote)
}

function entryIsTrashed(e: FragmentEntry): boolean {
  if (e.is_deleted === true) return true
  const v = (e as unknown as Record<string, unknown>).is_deleted
  return v === 'true' || v === 1 || v === '1'
}

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

const cardStyle: CSSProperties = {
  border: '1px solid rgba(0,0,0,0.06)',
  borderRadius: '12px',
  padding: '14px 16px',
  backgroundColor: '#fff',
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  gap: '12px',
  justifyContent: 'space-between',
}

const btnRestore: CSSProperties = {
  padding: '8px 14px',
  borderRadius: '8px',
  border: '1px solid rgba(99,102,241,0.35)',
  backgroundColor: 'rgba(99,102,241,0.08)',
  color: '#4F46E5',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
}

const btnDanger: CSSProperties = {
  padding: '8px 14px',
  borderRadius: '8px',
  border: '1px solid rgba(239,68,68,0.4)',
  backgroundColor: 'rgba(239,68,68,0.06)',
  color: '#b91c1c',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
}

export function TrashPage() {
  const isMobile = useIsNarrow()
  const [rows, setRows] = useState<KvTrashRow[]>([])
  const [trashEntries, setTrashEntries] = useState<FragmentEntry[]>([])
  const [valueTrashed, setValueTrashed] = useState<ValueAction[]>([])
  const [networkTrashed, setNetworkTrashed] = useState<NetworkContact[]>([])
  const [quantumTrashed, setQuantumTrashed] = useState<QuantumLetter[]>([])
  const [ledgerTrashed, setLedgerTrashed] = useState<LedgerEntry[]>([])
  const [evolutionTrashed, setEvolutionTrashed] = useState<EvolutionItem[]>([])
  const [playbookTrashed, setPlaybookTrashed] = useState<PlaybookItem[]>([])
  const [rpgTrashed, setRpgTrashed] = useState<{
    statLines: LevelupRpgProfile['statLines']
    bosses: LevelupRpgProfile['bosses']
    maps: LevelupRpgProfile['maps']
    quests: LevelupRpgProfile['quests']
    skills: LevelupRpgProfile['skills']
  }>({ statLines: [], bosses: [], maps: [], quests: [], skills: [] })
  const [workflowTrashed, setWorkflowTrashed] = useState<WorkflowRow[]>([])
  const [questTrashed, setQuestTrashed] = useState<UserQuestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { local, remote } = await fetchLocalAndRemoteFragment()
      setTrashEntries(collectTrashedFragmentEntries(local, remote))

      const va = loadValueActionStore().items.filter(i => itemIsTrashed(i))
      setValueTrashed(va)

      const nw = loadNetworkStore().contacts.filter(c => itemIsTrashed(c))
      setNetworkTrashed(nw)

      const qf = loadQuantumFlowStore().letters.filter(l => itemIsTrashed(l))
      setQuantumTrashed(qf)

      const le = loadLedgerStore().entries.filter(e => itemIsTrashed(e))
      setLedgerTrashed(le)

      const ev = loadEvolutionStore().items.filter(i => itemIsTrashed(i))
      setEvolutionTrashed(ev)

      const pb = loadPlaybookStore().items.filter(i => itemIsTrashed(i))
      setPlaybookTrashed(pb)

      const rpg = loadRpgProfile()
      setRpgTrashed({
        statLines: rpg.statLines.filter(s => itemIsTrashed(s)),
        bosses: rpg.bosses.filter(b => itemIsTrashed(b)),
        maps: rpg.maps.filter(m => itemIsTrashed(m)),
        quests: rpg.quests.filter(q => itemIsTrashed(q)),
        skills: rpg.skills.filter(s => itemIsTrashed(s)),
      })

      let kvRows: KvTrashRow[] = []
      if (isSupabaseReady) {
        const raw = await kvGetTrash()
        kvRows = raw.filter(
          r =>
            r.key !== FRAGMENT_KEY &&
            r.key !== VALUE_ACTION_STORE_KEY &&
            r.key !== NETWORK_STORE_KEY &&
            r.key !== QUANTUM_FLOW_KEY &&
            r.key !== ACCOUNT_LEDGER_KEY &&
            r.key !== EVOLUTION_KEY &&
            r.key !== PLAYBOOK_STORE_KEY &&
            r.key !== LEVELUP_RPG_KEY,
        )
      }
      setRows(kvRows)

      if (isSupabaseReady) {
        setWorkflowTrashed(await fetchTrashedWorkflows())
        setQuestTrashed(await fetchTrashedUserQuests())
      } else {
        setWorkflowTrashed([])
        setQuestTrashed([])
      }
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

  const onRestoreValue = (id: string) => {
    setBusyKey(`va:${id}`)
    try {
      const s = loadValueActionStore()
      saveValueActionStore(restoreValueAction(s, id))
      void load()
    } finally {
      setBusyKey(null)
    }
  }

  const onPurgeValue = (id: string) => {
    if (!window.confirm('이 행동 자산을 영구 삭제할까요?')) return
    setBusyKey(`va:${id}`)
    try {
      const s = loadValueActionStore()
      saveValueActionStore(purgeValueAction(s, id))
      void load()
    } finally {
      setBusyKey(null)
    }
  }

  const onRestoreNetwork = (id: string) => {
    setBusyKey(`nw:${id}`)
    try {
      const s = loadNetworkStore()
      saveNetworkStore(restoreContact(s, id))
      void load()
    } finally {
      setBusyKey(null)
    }
  }

  const onPurgeNetwork = (id: string) => {
    if (!window.confirm('이 연락처를 영구 삭제할까요?')) return
    setBusyKey(`nw:${id}`)
    try {
      const s = loadNetworkStore()
      saveNetworkStore(purgeContact(s, id))
      void load()
    } finally {
      setBusyKey(null)
    }
  }

  const onRestoreQuantum = (id: string) => {
    setBusyKey(`qf:${id}`)
    try {
      const s = loadQuantumFlowStore()
      saveQuantumFlowStore(restoreLetter(s, id))
      void load()
    } finally {
      setBusyKey(null)
    }
  }

  const onPurgeQuantum = (id: string) => {
    if (!window.confirm('이 시공편지를 영구 삭제할까요?')) return
    setBusyKey(`qf:${id}`)
    try {
      const s = loadQuantumFlowStore()
      saveQuantumFlowStore(purgeLetter(s, id))
      void load()
    } finally {
      setBusyKey(null)
    }
  }

  const onRestoreLedger = (id: string) => {
    setBusyKey(`led:${id}`)
    try {
      const s = loadLedgerStore()
      saveLedgerStore(restoreLedgerEntry(s, id))
      void load()
    } finally {
      setBusyKey(null)
    }
  }

  const onPurgeLedger = (id: string) => {
    if (!window.confirm('이 가계부 항목을 영구 삭제할까요?')) return
    setBusyKey(`led:${id}`)
    try {
      const s = loadLedgerStore()
      saveLedgerStore(purgeLedgerEntry(s, id))
      void load()
    } finally {
      setBusyKey(null)
    }
  }

  const onRestoreEvolution = (id: string) => {
    setBusyKey(`evo:${id}`)
    try {
      const s = loadEvolutionStore()
      saveEvolutionStore(restoreEvolutionItem(s, id))
      void load()
    } finally {
      setBusyKey(null)
    }
  }

  const onPurgeEvolution = (id: string) => {
    if (!window.confirm('이 진화 항목을 영구 삭제할까요?')) return
    setBusyKey(`evo:${id}`)
    try {
      const s = loadEvolutionStore()
      saveEvolutionStore(purgeEvolutionItem(s, id))
      void load()
    } finally {
      setBusyKey(null)
    }
  }

  const onRestorePlaybook = (id: string) => {
    setBusyKey(`pb:${id}`)
    try {
      const s = loadPlaybookStore()
      savePlaybookStore(restorePlaybookItem(s, id))
      void load()
    } finally {
      setBusyKey(null)
    }
  }

  const onPurgePlaybook = (id: string) => {
    if (!window.confirm('이 매뉴얼을 영구 삭제할까요?')) return
    setBusyKey(`pb:${id}`)
    try {
      const s = loadPlaybookStore()
      savePlaybookStore(purgePlaybookItem(s, id))
      void load()
    } finally {
      setBusyKey(null)
    }
  }

  const onRestoreRpg = (kind: 'stat' | 'boss' | 'map' | 'quest' | 'skill', id: string) => {
    setBusyKey(`rpg:${kind}:${id}`)
    try {
      let p = loadRpgProfile()
      if (kind === 'stat') p = restoreRpgStatLine(p, id)
      else if (kind === 'boss') p = restoreRpgBoss(p, id)
      else if (kind === 'map') p = restoreRpgMap(p, id)
      else if (kind === 'quest') p = restoreRpgQuest(p, id)
      else p = restoreRpgSkill(p, id)
      saveRpgProfile(p)
      void load()
    } finally {
      setBusyKey(null)
    }
  }

  const onPurgeRpg = (kind: 'stat' | 'boss' | 'map' | 'quest' | 'skill', id: string) => {
    if (!window.confirm('이 RPG 항목을 영구 삭제할까요?')) return
    setBusyKey(`rpgp:${kind}:${id}`)
    try {
      let p = loadRpgProfile()
      if (kind === 'stat') p = purgeRpgStatLine(p, id)
      else if (kind === 'boss') p = purgeRpgBoss(p, id)
      else if (kind === 'map') p = purgeRpgMap(p, id)
      else if (kind === 'quest') p = purgeRpgQuest(p, id)
      else p = purgeRpgSkill(p, id)
      saveRpgProfile(p)
      void load()
    } finally {
      setBusyKey(null)
    }
  }

  const onRestoreWorkflow = async (id: string) => {
    setBusyKey(`wf:${id}`)
    try {
      const ok = await restoreWorkflow(id)
      if (!ok) window.alert('복구에 실패했습니다.')
      else await load()
    } finally {
      setBusyKey(null)
    }
  }

  const onPermanentWorkflow = async (id: string) => {
    if (!window.confirm('이 작업 순서도를 영구 삭제할까요?')) return
    setBusyKey(`wfp:${id}`)
    try {
      const ok = await permanentDeleteWorkflow(id)
      if (!ok) window.alert('영구 삭제에 실패했습니다.')
      else await load()
    } finally {
      setBusyKey(null)
    }
  }

  const onRestoreQuest = async (id: string) => {
    setBusyKey(`uq:${id}`)
    try {
      const ok = await restoreUserQuestRow(id)
      if (!ok) window.alert('복구에 실패했습니다.')
      else await load()
    } finally {
      setBusyKey(null)
    }
  }

  const onPermanentQuest = async (id: string) => {
    if (!window.confirm('이 퀘스트를 영구 삭제할까요?')) return
    setBusyKey(`uqp:${id}`)
    try {
      await permanentDeleteUserQuestRow(id)
      await load()
    } finally {
      setBusyKey(null)
    }
  }

  const hasAny =
    trashEntries.length > 0 ||
    valueTrashed.length > 0 ||
    networkTrashed.length > 0 ||
    quantumTrashed.length > 0 ||
    ledgerTrashed.length > 0 ||
    evolutionTrashed.length > 0 ||
    playbookTrashed.length > 0 ||
    rpgTrashed.statLines.length +
      rpgTrashed.bosses.length +
      rpgTrashed.maps.length +
      rpgTrashed.quests.length +
      rpgTrashed.skills.length >
      0 ||
    workflowTrashed.length > 0 ||
    questTrashed.length > 0 ||
    rows.length > 0

  const pad = isMobile ? '16px 12px' : '28px 24px'

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: pad }}>
      <h1 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 800, color: '#37352F' }}>🗑️ 휴지통</h1>
      <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#787774', lineHeight: 1.5 }}>
        삭제한 항목은 <strong style={{ color: '#37352F' }}>소프트 삭제</strong>되어 여기 모입니다. Value·Network·가계부 등은 JSON 안{' '}
        <code style={{ fontSize: '12px', background: '#f4f4f2', padding: '2px 6px', borderRadius: '4px' }}>is_deleted</code>, 퀘스트·작업 순서도는 DB의{' '}
        <code style={{ fontSize: '12px', background: '#f4f4f2', padding: '2px 6px', borderRadius: '4px' }}>is_deleted</code> 컬럼을 사용합니다(
        <code style={{ fontSize: '12px', background: '#f4f4f2', padding: '2px 6px', borderRadius: '4px' }}>supabase_migrations/016_soft_delete_quests_workflows.sql</code> 적용 필요).
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
                노트 조각 (Fragment)
              </h2>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {trashEntries.map(entry => {
                  const b = busyKey === `frag:${entry.id}`
                  const meta = FRAGMENT_KIND_META[entry.kind]
                  return (
                    <li key={entry.id} style={cardStyle}>
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
                        <button type="button" disabled={b} onClick={() => void onRestoreFragment(entry.id)} style={{ ...btnRestore, opacity: b ? 0.7 : 1, cursor: b ? 'wait' : 'pointer' }}>
                          복구
                        </button>
                        <button type="button" disabled={b} onClick={() => void onPermanentFragment(entry.id)} style={{ ...btnDanger, opacity: b ? 0.7 : 1, cursor: b ? 'wait' : 'pointer' }}>
                          영구 삭제
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {valueTrashed.length > 0 && (
            <section>
              <h2 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800, color: '#37352F' }}>Value · 행동 자산</h2>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {valueTrashed.map(v => {
                  const b = busyKey === `va:${v.id}`
                  return (
                    <li key={v.id} style={cardStyle}>
                      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{v.actionName}</div>
                        <div style={{ fontSize: '12px', color: '#787774' }}>{v.identity || '—'} · {v.economicValueKrw.toLocaleString('ko-KR')}원</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" disabled={b} onClick={() => onRestoreValue(v.id)} style={{ ...btnRestore, opacity: b ? 0.7 : 1 }}>복구</button>
                        <button type="button" disabled={b} onClick={() => onPurgeValue(v.id)} style={{ ...btnDanger, opacity: b ? 0.7 : 1 }}>영구 삭제</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {networkTrashed.length > 0 && (
            <section>
              <h2 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800, color: '#37352F' }}>Network · 인명부</h2>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {networkTrashed.map(c => {
                  const b = busyKey === `nw:${c.id}`
                  return (
                    <li key={c.id} style={cardStyle}>
                      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{c.name}</div>
                        <div style={{ fontSize: '12px', color: '#787774' }}>{[c.roleTitle, c.org].filter(Boolean).join(' · ') || '—'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" disabled={b} onClick={() => onRestoreNetwork(c.id)} style={{ ...btnRestore, opacity: b ? 0.7 : 1 }}>복구</button>
                        <button type="button" disabled={b} onClick={() => onPurgeNetwork(c.id)} style={{ ...btnDanger, opacity: b ? 0.7 : 1 }}>영구 삭제</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {quantumTrashed.length > 0 && (
            <section>
              <h2 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800, color: '#37352F' }}>Quantum · 시공편지</h2>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {quantumTrashed.map(l => {
                  const b = busyKey === `qf:${l.id}`
                  return (
                    <li key={l.id} style={cardStyle}>
                      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{l.title}</div>
                        <div style={{ fontSize: '12px', color: '#787774' }}>도착 {l.openDate}</div>
                        <pre style={{ margin: '8px 0 0', fontSize: '11px', color: '#787774', whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'auto' }}>{previewValue(l.body, 160)}</pre>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" disabled={b} onClick={() => onRestoreQuantum(l.id)} style={{ ...btnRestore, opacity: b ? 0.7 : 1 }}>복구</button>
                        <button type="button" disabled={b} onClick={() => onPurgeQuantum(l.id)} style={{ ...btnDanger, opacity: b ? 0.7 : 1 }}>영구 삭제</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {ledgerTrashed.length > 0 && (
            <section>
              <h2 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800, color: '#37352F' }}>Account · 가계부</h2>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {ledgerTrashed.map(e => {
                  const b = busyKey === `led:${e.id}`
                  return (
                    <li key={e.id} style={cardStyle}>
                      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{e.date} · {e.flow === 'expense' ? '지출' : '수입'} {e.amount.toLocaleString('ko-KR')}원</div>
                        <div style={{ fontSize: '12px', color: '#787774' }}>{e.memo || '—'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" disabled={b} onClick={() => onRestoreLedger(e.id)} style={{ ...btnRestore, opacity: b ? 0.7 : 1 }}>복구</button>
                        <button type="button" disabled={b} onClick={() => onPurgeLedger(e.id)} style={{ ...btnDanger, opacity: b ? 0.7 : 1 }}>영구 삭제</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {evolutionTrashed.length > 0 && (
            <section>
              <h2 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800, color: '#37352F' }}>Evolution</h2>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {evolutionTrashed.map(item => {
                  const b = busyKey === `evo:${item.id}`
                  const lab = EVOLUTION_CATEGORY_LABEL[item.category]
                  return (
                    <li key={item.id} style={cardStyle}>
                      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#059669' }}>{lab.emoji} {lab.label}</div>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{item.title}</div>
                        <div style={{ fontSize: '12px', color: '#787774' }}>{previewValue(item.body, 100)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" disabled={b} onClick={() => onRestoreEvolution(item.id)} style={{ ...btnRestore, opacity: b ? 0.7 : 1 }}>복구</button>
                        <button type="button" disabled={b} onClick={() => onPurgeEvolution(item.id)} style={{ ...btnDanger, opacity: b ? 0.7 : 1 }}>영구 삭제</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {playbookTrashed.length > 0 && (
            <section>
              <h2 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800, color: '#37352F' }}>Network · 인간관계론 매뉴얼</h2>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {playbookTrashed.map(item => {
                  const b = busyKey === `pb:${item.id}`
                  return (
                    <li key={item.id} style={cardStyle}>
                      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{item.title}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" disabled={b} onClick={() => onRestorePlaybook(item.id)} style={{ ...btnRestore, opacity: b ? 0.7 : 1 }}>복구</button>
                        <button type="button" disabled={b} onClick={() => onPurgePlaybook(item.id)} style={{ ...btnDanger, opacity: b ? 0.7 : 1 }}>영구 삭제</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {(rpgTrashed.statLines.length +
            rpgTrashed.bosses.length +
            rpgTrashed.maps.length +
            rpgTrashed.quests.length +
            rpgTrashed.skills.length) > 0 && (
            <section>
              <h2 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800, color: '#37352F' }}>Levelup RPG</h2>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {rpgTrashed.statLines.map(s => (
                  <li key={`st-${s.id}`} style={cardStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 800 }}>스탯 행</div>
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>{s.label} = {s.value}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" disabled={busyKey === `rpg:stat:${s.id}`} onClick={() => onRestoreRpg('stat', s.id)} style={btnRestore}>복구</button>
                      <button type="button" disabled={busyKey === `rpgp:stat:${s.id}`} onClick={() => onPurgeRpg('stat', s.id)} style={btnDanger}>영구 삭제</button>
                    </div>
                  </li>
                ))}
                {rpgTrashed.bosses.map(s => (
                  <li key={`b-${s.id}`} style={cardStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 800 }}>보스</div>
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>{s.name}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" disabled={busyKey === `rpg:boss:${s.id}`} onClick={() => onRestoreRpg('boss', s.id)} style={btnRestore}>복구</button>
                      <button type="button" disabled={busyKey === `rpgp:boss:${s.id}`} onClick={() => onPurgeRpg('boss', s.id)} style={btnDanger}>영구 삭제</button>
                    </div>
                  </li>
                ))}
                {rpgTrashed.maps.map(s => (
                  <li key={`m-${s.id}`} style={cardStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 800 }}>맵</div>
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>{s.name}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" disabled={busyKey === `rpg:map:${s.id}`} onClick={() => onRestoreRpg('map', s.id)} style={btnRestore}>복구</button>
                      <button type="button" disabled={busyKey === `rpgp:map:${s.id}`} onClick={() => onPurgeRpg('map', s.id)} style={btnDanger}>영구 삭제</button>
                    </div>
                  </li>
                ))}
                {rpgTrashed.quests.map(s => (
                  <li key={`q-${s.id}`} style={cardStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 800 }}>RPG 퀘스트</div>
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>{s.title}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" disabled={busyKey === `rpg:quest:${s.id}`} onClick={() => onRestoreRpg('quest', s.id)} style={btnRestore}>복구</button>
                      <button type="button" disabled={busyKey === `rpgp:quest:${s.id}`} onClick={() => onPurgeRpg('quest', s.id)} style={btnDanger}>영구 삭제</button>
                    </div>
                  </li>
                ))}
                {rpgTrashed.skills.map(s => (
                  <li key={`sk-${s.id}`} style={cardStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 800 }}>스킬</div>
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>{s.name}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" disabled={busyKey === `rpg:skill:${s.id}`} onClick={() => onRestoreRpg('skill', s.id)} style={btnRestore}>복구</button>
                      <button type="button" disabled={busyKey === `rpgp:skill:${s.id}`} onClick={() => onPurgeRpg('skill', s.id)} style={btnDanger}>영구 삭제</button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {workflowTrashed.length > 0 && (
            <section>
              <h2 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800, color: '#37352F' }}>Value · 작업 순서도 (Workflow)</h2>
              {!isSupabaseReady && <p style={{ fontSize: '12px', color: '#b45309' }}>Supabase 미연결</p>}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {workflowTrashed.map(w => {
                  const b = busyKey === `wf:${w.id}` || busyKey === `wfp:${w.id}`
                  return (
                    <li key={w.id} style={cardStyle}>
                      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{w.title}</div>
                        <div style={{ fontSize: '12px', color: '#787774' }}>{previewValue(w.description ?? '', 120)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" disabled={b} onClick={() => void onRestoreWorkflow(w.id)} style={{ ...btnRestore, opacity: b ? 0.7 : 1 }}>복구</button>
                        <button type="button" disabled={b} onClick={() => void onPermanentWorkflow(w.id)} style={{ ...btnDanger, opacity: b ? 0.7 : 1 }}>영구 삭제</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {questTrashed.length > 0 && (
            <section>
              <h2 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800, color: '#37352F' }}>Quest · 사용자 퀘스트</h2>
              {!isSupabaseReady && <p style={{ fontSize: '12px', color: '#b45309' }}>Supabase 미연결</p>}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {questTrashed.map(q => {
                  const b = busyKey === `uq:${q.id}` || busyKey === `uqp:${q.id}`
                  return (
                    <li key={q.id} style={cardStyle}>
                      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{q.title}</div>
                        <div style={{ fontSize: '12px', color: '#787774' }}>{q.category} · {q.is_completed ? '완료' : '진행'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" disabled={b} onClick={() => void onRestoreQuest(q.id)} style={{ ...btnRestore, opacity: b ? 0.7 : 1 }}>복구</button>
                        <button type="button" disabled={b} onClick={() => void onPermanentQuest(q.id)} style={{ ...btnDanger, opacity: b ? 0.7 : 1 }}>영구 삭제</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {rows.length > 0 && (
            <section>
              <h2 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 800, color: '#37352F' }}>기타 동기화 키 (app_kv 행 단위)</h2>
              {!isSupabaseReady && (
                <p style={{ fontSize: '12px', color: '#b45309', marginBottom: '12px' }}>
                  Supabase에 연결되지 않아 이 목록을 불러올 수 없습니다.
                </p>
              )}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {rows.map(row => {
                  const b = busyKey === row.key
                  return (
                    <li key={row.key} style={cardStyle}>
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
                        <button type="button" disabled={b} onClick={() => void onRestore(row.key)} style={{ ...btnRestore, opacity: b ? 0.7 : 1, cursor: b ? 'wait' : 'pointer' }}>
                          복구
                        </button>
                        <button type="button" disabled={b} onClick={() => void onPermanent(row.key)} style={{ ...btnDanger, opacity: b ? 0.7 : 1, cursor: b ? 'wait' : 'pointer' }}>
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
