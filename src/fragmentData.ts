/**
 * Fragment — 떠오른 메모·노트·영감 조각 (즉시 기록)
 */
import { kvSet } from './lib/supabase'

export const FRAGMENT_KEY = 'creative_os_fragment_v1'

export type FragmentKind = 'memo' | 'note' | 'spark'

export const FRAGMENT_KIND_META: Record<FragmentKind, { label: string; emoji: string; hint: string }> = {
  memo: { label: '메모', emoji: '📝', hint: '한 줄·짧게' },
  note: { label: '노트', emoji: '📄', hint: '정리·생각' },
  spark: { label: '영감', emoji: '✨', hint: '아이디어·씨앗' },
}

export type FragmentEntry = {
  id: string
  kind: FragmentKind
  /** 한 줄 제목 (선택) */
  title: string
  body: string
  pinned: boolean
  createdAt: string
  updatedAt: string
  /** true면 휴지통(메인 목록·하이드레이션 표시 제외) */
  is_deleted?: boolean
  /** 보관 처리 — 유통기한 면제 */
  preserved?: boolean
  /** 소속 노트북 id (없으면 일반 조각) */
  notebookId?: string
}

/** 노트북(자주 쓰는 테마별 모음) */
export type FragmentNotebook = {
  id: string
  title: string
  emoji: string
  createdAt: string
  updatedAt: string
}

export const EXPIRY_MS = 72 * 60 * 60 * 1000

export function fragmentAge(e: FragmentEntry): number {
  return Date.now() - new Date(e.createdAt).getTime()
}

/** 0 → 1 (0=신선, 1=소멸) */
export function decayRatio(e: FragmentEntry): number {
  if (e.preserved || e.pinned) return 0
  return Math.min(1, fragmentAge(e) / EXPIRY_MS)
}

export function isExpired(e: FragmentEntry): boolean {
  if (e.preserved || e.pinned) return false
  return fragmentAge(e) >= EXPIRY_MS
}

export type FragmentStore = {
  version: 1
  entries: FragmentEntry[]
  notebooks: FragmentNotebook[]
}

export function loadFragmentStore(): FragmentStore {
  try {
    const raw = localStorage.getItem(FRAGMENT_KEY)
    if (!raw) return { version: 1, entries: [], notebooks: [] }
    const p = JSON.parse(raw) as FragmentStore
    if (!p || !Array.isArray(p.entries)) return { version: 1, entries: [], notebooks: [] }
    return { version: 1, entries: p.entries, notebooks: Array.isArray(p.notebooks) ? p.notebooks : [] }
  } catch {
    return { version: 1, entries: [], notebooks: [] }
  }
}

/** 메인 목록·검색용 — 휴지통 항목 제외 */
export function getActiveFragmentEntries(store: FragmentStore): FragmentEntry[] {
  return store.entries.filter(e => e.is_deleted !== true)
}

/** 휴지통 탭용 */
export function getTrashedFragmentEntries(store: FragmentStore): FragmentEntry[] {
  return store.entries.filter(e => e.is_deleted === true)
}

/** id 기준으로 병합 — updatedAt이 더 최근인 쪽 우선 (로컬·서버 불일치 방지) */
export function mergeFragmentStores(a: FragmentStore, b: FragmentStore): FragmentStore {
  const map = new Map<string, FragmentEntry>()
  for (const e of a.entries) map.set(e.id, e)
  for (const e of b.entries) {
    const prev = map.get(e.id)
    if (!prev || e.updatedAt.localeCompare(prev.updatedAt) > 0) map.set(e.id, e)
  }
  const nbMap = new Map<string, FragmentNotebook>()
  for (const n of a.notebooks ?? []) nbMap.set(n.id, n)
  for (const n of b.notebooks ?? []) {
    const prev = nbMap.get(n.id)
    if (!prev || n.updatedAt.localeCompare(prev.updatedAt) > 0) nbMap.set(n.id, n)
  }
  return { version: 1, entries: [...map.values()], notebooks: [...nbMap.values()] }
}

export function saveFragmentStore(s: FragmentStore) {
  try {
    localStorage.setItem(FRAGMENT_KEY, JSON.stringify(s))
    kvSet(FRAGMENT_KEY, s)
  } catch { /* ignore */ }
}

export function upsertFragment(
  store: FragmentStore,
  patch: Omit<FragmentEntry, 'createdAt' | 'updatedAt'> & { id?: string },
): FragmentStore {
  const id = patch.id ?? `fg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const now = new Date().toISOString()
  const existing = store.entries.find(e => e.id === id)
  const createdAt = existing?.createdAt ?? now
  const next: FragmentEntry = {
    ...patch,
    id,
    title: patch.title?.trim() ?? '',
    body: patch.body?.trim() ?? '',
    pinned: patch.pinned ?? false,
    createdAt,
    updatedAt: now,
  }
  const idx = store.entries.findIndex(e => e.id === id)
  const entries = idx >= 0 ? store.entries.map((e, i) => (i === idx ? next : e)) : [next, ...store.entries]
  return { ...store, entries }
}

/**
 * 조각을 휴지통으로 (DB row 삭제 없음 — JSON 내 is_deleted + kvSet upsert)
 */
export function softDeleteFragment(store: FragmentStore, id: string): FragmentStore {
  const now = new Date().toISOString()
  return {
    ...store,
    entries: store.entries.map(e =>
      e.id === id ? { ...e, is_deleted: true, updatedAt: now } : e,
    ),
  }
}

/** 휴지통에서 복구 */
export function restoreFragmentEntry(store: FragmentStore, id: string): FragmentStore {
  const now = new Date().toISOString()
  return {
    ...store,
    entries: store.entries.map(e =>
      e.id === id ? { ...e, is_deleted: false, updatedAt: now } : e,
    ),
  }
}

/** 휴지통에서 영구 삭제(배열에서 제거) */
export function purgeFragmentEntry(store: FragmentStore, id: string): FragmentStore {
  return { ...store, entries: store.entries.filter(e => e.id !== id) }
}

/** 보관 처리 — 유통기한 면제 */
export function preserveFragment(store: FragmentStore, id: string): FragmentStore {
  const now = new Date().toISOString()
  return {
    ...store,
    entries: store.entries.map(e =>
      e.id === id ? { ...e, preserved: true, updatedAt: now } : e,
    ),
  }
}

/** 만료된 조각을 일괄 휴지통 이동 */
export function autoTrashExpired(store: FragmentStore): FragmentStore {
  const now = new Date().toISOString()
  let changed = false
  const entries = store.entries.map(e => {
    if (e.is_deleted) return e
    if (isExpired(e)) {
      changed = true
      return { ...e, is_deleted: true, updatedAt: now }
    }
    return e
  })
  return changed ? { ...store, entries } : store
}

/** 노트북 CRUD */
export function upsertNotebook(
  store: FragmentStore,
  patch: Partial<FragmentNotebook> & { id?: string },
): FragmentStore {
  const id = patch.id ?? `nb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const now = new Date().toISOString()
  const existing = store.notebooks.find(n => n.id === id)
  const nb: FragmentNotebook = {
    id,
    title: patch.title?.trim() || existing?.title || '새 노트북',
    emoji: patch.emoji?.trim() || existing?.emoji || '📓',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  const idx = store.notebooks.findIndex(n => n.id === id)
  const notebooks = idx >= 0 ? store.notebooks.map((n, i) => (i === idx ? nb : n)) : [...store.notebooks, nb]
  return { ...store, notebooks }
}

export function removeNotebook(store: FragmentStore, id: string): FragmentStore {
  return {
    ...store,
    notebooks: store.notebooks.filter(n => n.id !== id),
    entries: store.entries.map(e => (e.notebookId === id ? { ...e, notebookId: undefined } : e)),
  }
}

export function assignToNotebook(store: FragmentStore, fragmentId: string, notebookId: string | undefined): FragmentStore {
  const now = new Date().toISOString()
  return {
    ...store,
    entries: store.entries.map(e =>
      e.id === fragmentId ? { ...e, notebookId, preserved: notebookId ? true : e.preserved, updatedAt: now } : e,
    ),
  }
}

/** 두 조각을 융합 — 새 조각 생성, 원본 소프트삭제 */
export function mergeFragments(store: FragmentStore, idA: string, idB: string): FragmentStore {
  const a = store.entries.find(e => e.id === idA)
  const b = store.entries.find(e => e.id === idB)
  if (!a || !b) return store
  const now = new Date().toISOString()
  const merged: FragmentEntry = {
    id: `fg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    kind: 'spark',
    title: [a.title, b.title].filter(Boolean).join(' + ') || '융합 조각',
    body: `${a.body}\n\n---\n\n${b.body}`,
    pinned: false,
    createdAt: now,
    updatedAt: now,
    preserved: true,
  }
  return {
    ...store,
    entries: [
      merged,
      ...store.entries.map(e =>
        e.id === idA || e.id === idB ? { ...e, is_deleted: true, updatedAt: now } : e,
      ),
    ],
  }
}
