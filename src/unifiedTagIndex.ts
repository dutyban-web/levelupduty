/**
 * OS 전역 태그 인덱스 — 퀘스트·Manual·트래커·가계부·프로젝트·매니페 등에서 태그를 모아 연결합니다.
 */
import { loadLedgerStore } from './accountLedgerData'
import { loadManifestStudio } from './manifestationStudioData'
import { MANIFEST_NOTE_BUNDLE_KEY, type StoredManifestNotionNote } from './manifestNoteUtils'
import { fetchManualDocuments, fetchProjects, fetchUserCreatedQuests } from './supabase'
import { loadTrackerBundle } from './trackerData'

/** ProjectHubPage와 동일 키 */
const PROJECT_WORKSPACE_LS_KEY = 'creative_os_project_workspace_v1'

export type UnifiedTagSourceKind =
  | 'quest'
  | 'manual'
  | 'tracker_cat'
  | 'tracker_log'
  | 'ledger'
  | 'project'
  | 'manifest_others'
  | 'manifest_notion'

export type UnifiedTagHit = {
  kind: UnifiedTagSourceKind
  /** 정규화된 태그 문자열 (trim) */
  tag: string
  title: string
  subtitle?: string
  /** HashRouter 기준 경로 (선행 /) */
  href: string
}

const KIND_ORDER: UnifiedTagSourceKind[] = [
  'quest',
  'manual',
  'tracker_cat',
  'tracker_log',
  'ledger',
  'project',
  'manifest_others',
  'manifest_notion',
]

export function kindLabel(k: UnifiedTagSourceKind): string {
  const m: Record<UnifiedTagSourceKind, string> = {
    quest: '퀘스트',
    manual: 'Manual',
    tracker_cat: '트래커 카테고리',
    tracker_log: '트래커 기록',
    ledger: '가계부',
    project: '프로젝트 허브',
    manifest_others: '매니페 · 타인의 삶',
    manifest_notion: '매니페 노트',
  }
  return m[k] ?? k
}

function normTag(t: string): string | null {
  const s = t.trim()
  return s || null
}

function loadProjectWorkspaces(): Record<string, { customTags?: string[] }> {
  try {
    const raw = localStorage.getItem(PROJECT_WORKSPACE_LS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, { customTags?: string[] }>
  } catch {
    return {}
  }
}

function loadManifestNotionBundle(): Record<string, StoredManifestNotionNote> {
  try {
    const raw = localStorage.getItem(MANIFEST_NOTE_BUNDLE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, StoredManifestNotionNote>
  } catch {
    return {}
  }
}

/**
 * 모든 로컬·Supabase 소스에서 태그 히트를 수집합니다 (읽기 전용).
 */
export async function collectUnifiedTagHits(): Promise<UnifiedTagHit[]> {
  const hits: UnifiedTagHit[] = []

  const [manualDocs, quests, projects] = await Promise.all([
    fetchManualDocuments(),
    fetchUserCreatedQuests(),
    fetchProjects(),
  ])

  const projectNameById = new Map(projects.map(p => [p.id, p.name]))

  const tracker = loadTrackerBundle()
  const ledger = loadLedgerStore()
  const studio = loadManifestStudio()
  const workspaces = loadProjectWorkspaces()
  const notionNotes = loadManifestNotionBundle()

  for (const q of quests) {
    for (const raw of q.tags ?? []) {
      const tag = normTag(raw)
      if (!tag) continue
      hits.push({
        kind: 'quest',
        tag,
        title: q.title || '(제목 없음)',
        subtitle: q.category,
        href: '/',
      })
    }
  }

  for (const doc of manualDocs) {
    for (const raw of doc.tags ?? []) {
      const tag = normTag(raw)
      if (!tag) continue
      hits.push({
        kind: 'manual',
        tag,
        title: doc.title?.trim() || '제목 없음',
        subtitle: doc.category?.trim() || undefined,
        href: `/manual/${doc.id}`,
      })
    }
  }

  for (const cat of tracker.categories) {
    for (const raw of cat.tags ?? []) {
      const tag = normTag(raw)
      if (!tag) continue
      hits.push({
        kind: 'tracker_cat',
        tag,
        title: cat.label,
        subtitle: '카테고리 프리셋',
        href: '/tracker',
      })
    }
  }

  for (const log of tracker.logs) {
    const tag = normTag(log.tag)
    if (!tag) continue
    const cat = tracker.categories.find(c => c.id === log.categoryId)
    hits.push({
      kind: 'tracker_log',
      tag,
      title: `${log.date} ${log.startTime}`,
      subtitle: cat ? `${cat.label} · ${log.type}` : log.type,
      href: '/tracker',
    })
  }

  for (const e of ledger.entries) {
    if (e.is_deleted) continue
    for (const raw of e.tags ?? []) {
      const tag = normTag(raw)
      if (!tag) continue
      hits.push({
        kind: 'ledger',
        tag,
        title: e.memo?.trim() || `${e.date} · ${e.amount.toLocaleString('ko-KR')}원`,
        subtitle: e.flow === 'income' ? '수입' : '지출',
        href: '/account',
      })
    }
  }

  for (const [pid, ws] of Object.entries(workspaces)) {
    const pname = projectNameById.get(pid) ?? `프로젝트 ${pid.slice(0, 8)}…`
    for (const raw of ws.customTags ?? []) {
      const tag = normTag(raw)
      if (!tag) continue
      hits.push({
        kind: 'project',
        tag,
        title: pname,
        subtitle: '프로젝트 커스텀 태그',
        href: `/project?project=${encodeURIComponent(pid)}`,
      })
    }
  }

  for (const row of studio.othersLives ?? []) {
    for (const raw of row.tags ?? []) {
      const tag = normTag(raw)
      if (!tag) continue
      hits.push({
        kind: 'manifest_others',
        tag,
        title: row.title?.trim() || '타인의 삶',
        href: '/manifestation',
      })
    }
  }

  for (const [key, note] of Object.entries(notionNotes)) {
    for (const raw of note.tags ?? []) {
      const tag = normTag(raw)
      if (!tag) continue
      const head = key.split(':')[0] ?? ''
      hits.push({
        kind: 'manifest_notion',
        tag,
        title: note.title?.trim() || key,
        subtitle: head ? `${head} 카드 노트` : undefined,
        href: '/manifestation',
      })
    }
  }

  hits.sort((a, b) => {
    const c = a.tag.localeCompare(b.tag, 'ko')
    if (c !== 0) return c
    const i = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
    if (i !== 0) return i
    return a.title.localeCompare(b.title, 'ko')
  })

  return hits
}

export function groupHitsByTag(hits: UnifiedTagHit[]): Map<string, UnifiedTagHit[]> {
  const m = new Map<string, UnifiedTagHit[]>()
  for (const h of hits) {
    const list = m.get(h.tag) ?? []
    list.push(h)
    m.set(h.tag, list)
  }
  return m
}

/** `인물/연예인/임수정` → ['인물','연예인','임수정'] */
export function tagPathSegments(tag: string): string[] {
  return tag
    .split('/')
    .map(s => s.trim())
    .filter(Boolean)
}

/** `/` 없는 단일 태그면 true (분류 없음 그룹) */
export function isFlatTag(tag: string): boolean {
  return !tag.includes('/')
}

/** 계층 태그의 최상위 그룹명 (첫 세그먼트). 플랫 태그는 null */
export function tagTopGroup(tag: string): string | null {
  const s = tagPathSegments(tag)
  return s.length >= 2 ? s[0]! : null
}

/** 그룹 접두어 아래 상대 경로 (표시용). 플랫이면 전체 그대로 */
export function tagRelativeToGroup(tag: string, group: string): string {
  const s = tagPathSegments(tag)
  if (s.length >= 2 && s[0] === group) return s.slice(1).join(' / ') || tag
  return tag
}

/** 마지막 세그먼트 (리프 이름) */
export function tagLeafName(tag: string): string {
  const s = tagPathSegments(tag)
  return s.length ? s[s.length - 1]! : tag
}

export type GroupStat = { name: string; tagCount: number }

/** 상위 그룹별 태그 개수 (같은 풀 태그 문자열 기준) */
export function buildGroupStats(tagKeys: Iterable<string>): { groups: GroupStat[]; uncatCount: number } {
  const groupMap = new Map<string, number>()
  let uncat = 0
  for (const tag of tagKeys) {
    const top = tagTopGroup(tag)
    if (top == null) {
      uncat += 1
    } else {
      groupMap.set(top, (groupMap.get(top) ?? 0) + 1)
    }
  }
  const groups = [...groupMap.entries()]
    .map(([name, tagCount]) => ({ name, tagCount }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  return { groups, uncatCount: uncat }
}

/**
 * 사용자 그룹에 넣은 태그는 경로 그룹·분류 없음 집계에서 제외합니다.
 */
export function buildPathGroupStatsExcludingCustom(
  tagKeys: Iterable<string>,
  customAssignedTags: Set<string>,
): { groups: GroupStat[]; uncatCount: number } {
  const groupMap = new Map<string, number>()
  let uncat = 0
  for (const tag of tagKeys) {
    if (customAssignedTags.has(tag)) continue
    const top = tagTopGroup(tag)
    if (top == null) {
      if (isFlatTag(tag)) uncat += 1
    } else {
      groupMap.set(top, (groupMap.get(top) ?? 0) + 1)
    }
  }
  const groups = [...groupMap.entries()]
    .map(([name, tagCount]) => ({ name, tagCount }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  return { groups, uncatCount: uncat }
}
