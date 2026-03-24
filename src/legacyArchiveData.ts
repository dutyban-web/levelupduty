/**
 * 인과율의 기록 보관소 — 완료 프로젝트·퀘스트 유산 + 나비효과 메타
 * bl_legacy_archive_v1
 */
import { kvSet } from './lib/supabase'
import { loadPomodoroLog } from './pomodoroLogData'
import { applyXpGainToSimulationWallet } from './simulationWalletData'
import { addSkillBranchXp } from './skillTreeData'
import { PROJECT_WORKSPACE_KEY, type ProjectWorkspaceDetail } from './ProjectHubPage'
import type { ProjectRow } from './supabase'

export const LEGACY_ARCHIVE_KEY = 'bl_legacy_archive_v1'
export const BL_LEGACY_ARCHIVE_SYNC = 'bl-legacy-archive-sync'

const XP_EST_PER_QUEST = 20

export type LegacyCodexStyle = 'tome' | 'relic' | 'scroll'

export type LegacyArchiveEntry = {
  id: string
  kind: 'project' | 'quest' | 'seed'
  title: string
  subtitle?: string
  codexStyle: LegacyCodexStyle
  projectId?: string
  questId?: string
  completedAt: string
  stats: {
    pomodoroMinutesTotal: number
    totalExpEst: number
    subQuestsCleared: number
    sessionsCount: number
  }
  narrative: {
    tryLine?: string
    retrospective?: string
  }
  /** 나비효과 시각화용 0–100 */
  butterflyScore: number
}

export type LegacyArchiveStore = {
  version: 1
  entries: LegacyArchiveEntry[]
  /** 신규 등록 시 지급한 시뮬 크레딧 추적 (중복 방지) */
  creditedEntryIds: string[]
}

function emitSync(): void {
  try {
    window.dispatchEvent(new CustomEvent(BL_LEGACY_ARCHIVE_SYNC))
  } catch {
    /* ignore */
  }
}

function readWorkspace(projectId: string): ProjectWorkspaceDetail | null {
  try {
    const raw = localStorage.getItem(PROJECT_WORKSPACE_KEY)
    if (!raw) return null
    const all = JSON.parse(raw) as Record<string, ProjectWorkspaceDetail>
    return all[projectId] ?? null
  } catch {
    return null
  }
}

function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (Math.abs(h) % 1000) / 1000
}

/** 출판·창작 이력 시드 (독립출판·앤솔로지 등 — 이후 완료 프로젝트가 자동 합류) */
export const DEFAULT_LEGACY_SEEDS: Omit<LegacyArchiveEntry, 'id'>[] = [
  {
    kind: 'seed',
    title: '독립출판 장편 『잠긴 별의 서재』',
    subtitle: '종이책 1쇄 · 비매스터 핸드북',
    codexStyle: 'tome',
    completedAt: new Date(Date.now() - 86400000 * 400).toISOString(),
    stats: { pomodoroMinutesTotal: 2180, totalExpEst: 4200, subQuestsCleared: 24, sessionsCount: 156 },
    narrative: {
      tryLine: '완벽한 문장보다 끝까지 닿는 문장이었다.',
      retrospective: '표지가 무거울수록 마음은 가벼워진다.',
    },
    butterflyScore: 78,
  },
  {
    kind: 'seed',
    title: 'SF 앤솔로지 『심연 우편』 단편 참여',
    subtitle: '공모 선정 · 단편 수록',
    codexStyle: 'scroll',
    completedAt: new Date(Date.now() - 86400000 * 280).toISOString(),
    stats: { pomodoroMinutesTotal: 420, totalExpEst: 880, subQuestsCleared: 6, sessionsCount: 32 },
    narrative: {
      tryLine: '짧은 호흡으로 우주를 열었다.',
      retrospective: '편집자의 한 줄이 다음 원고의 나침반이 되었다.',
    },
    butterflyScore: 62,
  },
  {
    kind: 'seed',
    title: '웹 플랫폼 연재 — 단편 시리즈 완결',
    subtitle: '무료 연재 · 외전 포함',
    codexStyle: 'relic',
    completedAt: new Date(Date.now() - 86400000 * 120).toISOString(),
    stats: { pomodoroMinutesTotal: 3120, totalExpEst: 6100, subQuestsCleared: 41, sessionsCount: 210 },
    narrative: {
      tryLine: '댓글이 다음 화의 각본이 되었다.',
      retrospective: '연재는 마라톤이 아니라 릴레이다.',
    },
    butterflyScore: 91,
  },
]

function migrateEntry(raw: unknown): LegacyArchiveEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Record<string, unknown>
  if (typeof e.id !== 'string' || typeof e.title !== 'string') return null
  const st = e.stats as Record<string, unknown> | undefined
  const stats = {
    pomodoroMinutesTotal: typeof st?.pomodoroMinutesTotal === 'number' ? st.pomodoroMinutesTotal : 0,
    totalExpEst: typeof st?.totalExpEst === 'number' ? st.totalExpEst : 0,
    subQuestsCleared: typeof st?.subQuestsCleared === 'number' ? st.subQuestsCleared : 0,
    sessionsCount: typeof st?.sessionsCount === 'number' ? st.sessionsCount : 0,
  }
  const nar = e.narrative as Record<string, unknown> | undefined
  return {
    id: e.id,
    kind: e.kind === 'project' || e.kind === 'quest' || e.kind === 'seed' ? e.kind : 'seed',
    title: e.title,
    subtitle: typeof e.subtitle === 'string' ? e.subtitle : undefined,
    codexStyle:
      e.codexStyle === 'relic' || e.codexStyle === 'scroll' || e.codexStyle === 'tome' ? e.codexStyle : 'tome',
    projectId: typeof e.projectId === 'string' ? e.projectId : undefined,
    questId: typeof e.questId === 'string' ? e.questId : undefined,
    completedAt: typeof e.completedAt === 'string' ? e.completedAt : new Date().toISOString(),
    stats,
    narrative: {
      tryLine: typeof nar?.tryLine === 'string' ? nar.tryLine : undefined,
      retrospective: typeof nar?.retrospective === 'string' ? nar.retrospective : undefined,
    },
    butterflyScore: typeof e.butterflyScore === 'number' ? Math.min(100, Math.max(0, e.butterflyScore)) : 50,
  }
}

export function loadLegacyArchive(): LegacyArchiveStore {
  try {
    const raw = localStorage.getItem(LEGACY_ARCHIVE_KEY)
    if (!raw) {
      return seedInitialStore()
    }
    const p = JSON.parse(raw) as Partial<LegacyArchiveStore>
    if (p.version !== 1 || !Array.isArray(p.entries)) return seedInitialStore()
    const entries = p.entries.map(migrateEntry).filter((x): x is LegacyArchiveEntry => x != null)
    const creditedEntryIds = Array.isArray(p.creditedEntryIds)
      ? p.creditedEntryIds.filter((x): x is string => typeof x === 'string')
      : []
    return { version: 1, entries, creditedEntryIds }
  } catch {
    return seedInitialStore()
  }
}

function seedInitialStore(): LegacyArchiveStore {
  const entries: LegacyArchiveEntry[] = DEFAULT_LEGACY_SEEDS.map((s, i) => ({
    ...s,
    id: `seed_legacy_${i + 1}`,
  }))
  return { version: 1, entries, creditedEntryIds: [] }
}

export function saveLegacyArchive(next: LegacyArchiveStore): void {
  try {
    localStorage.setItem(LEGACY_ARCHIVE_KEY, JSON.stringify(next))
    void kvSet(LEGACY_ARCHIVE_KEY, next)
    emitSync()
  } catch {
    /* quota */
  }
}

function extractNarrative(ws: ProjectWorkspaceDetail): { tryLine?: string; retrospective?: string } {
  const tryLine =
    ws.deepNotes?.trim().split(/\n/)[0]?.slice(0, 280) ||
    ws.weeklyFocus?.trim().split(/\n/)[0]?.slice(0, 280) ||
    ws.northStar?.trim().split(/\n/)[0]?.slice(0, 280)
  const retrospective = ws.mission?.trim().split(/\n/)[0]?.slice(0, 280)
  return { tryLine, retrospective }
}

type QuestLite = { id: string; projectId?: string | null; name: string }

function aggregatePomodoroForQuestIds(questIds: Set<string>): {
  minutes: number
  sessions: number
  xp: number
} {
  const log = loadPomodoroLog()
  let minutes = 0
  let sessions = 0
  let xp = 0
  for (const e of log.entries) {
    if (e.questId && questIds.has(e.questId)) {
      minutes += e.minutes || Math.floor((e.seconds ?? 0) / 60)
      sessions += 1
      xp += typeof e.xpGain === 'number' ? e.xpGain : 0
    }
  }
  return { minutes, sessions, xp }
}

/**
 * 완료된 프로젝트(워크스페이스 statusTag done/archive)를 유산으로 등록·갱신
 */
export function syncLegacyArchiveFromProjects(
  projects: ProjectRow[],
  quests: QuestLite[],
  completedQuestIds: string[],
): LegacyArchiveStore {
  let store = loadLegacyArchive()
  const completedSet = new Set(completedQuestIds)

  for (const proj of projects) {
    const ws = readWorkspace(String(proj.id))
    const tag = ws?.statusTag
    if (tag !== 'done' && tag !== 'archive') continue

    const pq = quests.filter(q => q.projectId && String(q.projectId) === String(proj.id))
    const subCleared = pq.filter(q => completedSet.has(q.id)).length
    const qids = new Set(pq.map(q => q.id))
    const pom = aggregatePomodoroForQuestIds(qids)
    const expFromQuests = subCleared * XP_EST_PER_QUEST
    const totalExpEst = Math.round(pom.xp + expFromQuests + (proj.time_spent_sec ?? 0) / 360)

    const narrative = ws ? extractNarrative(ws) : {}
    const butterflyScore = Math.round(
      Math.min(100, 28 + subCleared * 3 + Math.min(40, pom.minutes / 60) + hash01(String(proj.id)) * 12),
    )

    const entryId = `legacy_proj_${proj.id}`
    const existing = store.entries.find(e => e.id === entryId)
    const row: LegacyArchiveEntry = {
      id: entryId,
      kind: 'project',
      title: proj.name,
      subtitle: tag === 'archive' ? '보관됨 · 인과의 서고' : '완료된 보스 전장',
      codexStyle: subCleared >= 12 ? 'tome' : subCleared >= 5 ? 'relic' : 'scroll',
      projectId: String(proj.id),
      completedAt: existing?.completedAt ?? new Date().toISOString(),
      stats: {
        pomodoroMinutesTotal: Math.max(pom.minutes, Math.floor((proj.time_spent_sec ?? 0) / 60)),
        totalExpEst: Math.max(existing?.stats.totalExpEst ?? 0, totalExpEst),
        subQuestsCleared: subCleared,
        sessionsCount: Math.max(pom.sessions, existing?.stats.sessionsCount ?? 0),
      },
      narrative: {
        tryLine: narrative.tryLine || existing?.narrative.tryLine,
        retrospective: narrative.retrospective || existing?.narrative.retrospective,
      },
      butterflyScore: Math.max(existing?.butterflyScore ?? 0, butterflyScore),
    }

    if (!existing) {
      store = {
        ...store,
        entries: [row, ...store.entries],
        creditedEntryIds: store.creditedEntryIds,
      }
      if (!store.creditedEntryIds.includes(entryId)) {
        applyXpGainToSimulationWallet(25)
        addSkillBranchXp('spirit', 8)
        store = {
          ...store,
          creditedEntryIds: [...store.creditedEntryIds, entryId],
        }
      }
    } else {
      store = {
        ...store,
        entries: store.entries.map(e => (e.id === entryId ? row : e)),
      }
    }
  }

  saveLegacyArchive(store)
  return store
}

export function getLegacyEntryCount(): number {
  return loadLegacyArchive().entries.length
}

/** 영광의 회상 — try/회고가 있는 항목 중 무작위 */
export function randomLegacyRecall(): { title: string; text: string; entryId: string } | null {
  const { entries } = loadLegacyArchive()
  const pool = entries.filter(
    e => (e.narrative.tryLine && e.narrative.tryLine.length > 2) || (e.narrative.retrospective && e.narrative.retrospective.length > 2),
  )
  if (pool.length === 0) return null
  const e = pool[Math.floor(Math.random() * pool.length)]
  const useTry = e.narrative.tryLine && (!e.narrative.retrospective || Math.random() < 0.5)
  const text = (useTry ? e.narrative.tryLine : e.narrative.retrospective) ?? ''
  return { title: e.title, text, entryId: e.id }
}
