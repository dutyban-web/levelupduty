/**
 * Quest — 모험일지 (BlockNote 본문, Manual과 동일 드래그·슬래시)
 * app_kv + localStorage
 */
import { kvSet } from './lib/supabase'

export const ADVENTURE_JOURNAL_KEY = 'creative-os-quest-adventure-journal-v1'

export type AdventureJournalStore = {
  blocks: unknown
}

const EMPTY: AdventureJournalStore = { blocks: [] }

function normalize(raw: unknown): AdventureJournalStore {
  if (typeof raw !== 'object' || raw === null) return { ...EMPTY }
  const o = raw as Record<string, unknown>
  if (!Array.isArray(o.blocks)) return { ...EMPTY }
  return { blocks: o.blocks }
}

export function loadAdventureJournal(): AdventureJournalStore {
  try {
    const raw = localStorage.getItem(ADVENTURE_JOURNAL_KEY)
    if (!raw) return { ...EMPTY }
    try {
      return normalize(JSON.parse(raw))
    } catch {
      return { ...EMPTY }
    }
  } catch {
    return { ...EMPTY }
  }
}

export function saveAdventureJournal(next: AdventureJournalStore): void {
  const payload: AdventureJournalStore = {
    blocks: Array.isArray(next.blocks) ? next.blocks : [],
  }
  try {
    localStorage.setItem(ADVENTURE_JOURNAL_KEY, JSON.stringify(payload))
    void kvSet(ADVENTURE_JOURNAL_KEY, payload)
  } catch {
    /* quota */
  }
}
