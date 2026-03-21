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
}

export type FragmentStore = { version: 1; entries: FragmentEntry[] }

export function loadFragmentStore(): FragmentStore {
  try {
    const raw = localStorage.getItem(FRAGMENT_KEY)
    if (!raw) return { version: 1, entries: [] }
    const p = JSON.parse(raw) as FragmentStore
    if (p.version !== 1 || !Array.isArray(p.entries)) return { version: 1, entries: [] }
    return p
  } catch {
    return { version: 1, entries: [] }
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
  return { version: 1, entries: [...map.values()] }
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
