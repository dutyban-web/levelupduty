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

export function deleteFragment(store: FragmentStore, id: string): FragmentStore {
  return { ...store, entries: store.entries.filter(e => e.id !== id) }
}
