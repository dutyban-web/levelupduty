/**
 * 수호신의 신전 — 일일 KPT 회고 저장
 */
import { kvSet } from './lib/supabase'

export const SANCTUARY_KPT_KEY = 'bl_sanctuary_kpt_v1'

export type SanctuaryKptEntry = {
  date: string
  keep: string
  problem: string
  try: string
  failureAssetized: boolean
  createdAt: string
}

export type SanctuaryStore = {
  version: 1
  entries: SanctuaryKptEntry[]
}

export function loadSanctuaryStore(): SanctuaryStore {
  try {
    const raw = localStorage.getItem(SANCTUARY_KPT_KEY)
    if (!raw) return { version: 1, entries: [] }
    const p = JSON.parse(raw) as SanctuaryStore
    if (p.version !== 1 || !Array.isArray(p.entries)) return { version: 1, entries: [] }
    return p
  } catch {
    return { version: 1, entries: [] }
  }
}

export function saveSanctuaryStore(s: SanctuaryStore): void {
  try {
    localStorage.setItem(SANCTUARY_KPT_KEY, JSON.stringify(s))
    void kvSet(SANCTUARY_KPT_KEY, s)
  } catch {
    /* ignore */
  }
}

export function upsertTodayKpt(entry: Omit<SanctuaryKptEntry, 'createdAt'> & { createdAt?: string }): SanctuaryStore {
  const now = new Date().toISOString()
  const store = loadSanctuaryStore()
  const rest = { ...entry, createdAt: entry.createdAt ?? now }
  const idx = store.entries.findIndex(e => e.date === entry.date)
  const entries =
    idx >= 0
      ? store.entries.map((e, i) => (i === idx ? { ...rest } : e))
      : [{ ...rest }, ...store.entries]
  const next: SanctuaryStore = { ...store, entries }
  saveSanctuaryStore(next)
  return next
}

export function getTodayKpt(dateYmd: string): SanctuaryKptEntry | null {
  const store = loadSanctuaryStore()
  return store.entries.find(e => e.date === dateYmd) ?? null
}
