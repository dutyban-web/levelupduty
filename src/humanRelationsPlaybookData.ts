/**
 * 인간관계론 — 전역 매뉴얼 (특정 연락처와 무관)
 * app_kv + localStorage
 */

import { kvSet } from './lib/supabase'

export const PLAYBOOK_STORE_KEY = 'creative-os-human-relations-playbook-v1'

export type PlaybookItem = {
  id: string
  title: string
  /** lucide 아이콘 키 (PLAYBOOK_ICON_OPTIONS) */
  iconKey: string
  /** BlockNote JSON */
  descriptionBlocksJson: string
  createdAt: string
  updatedAt: string
}

export type PlaybookStore = { items: PlaybookItem[] }

function nowIso() {
  return new Date().toISOString()
}

export function newPlaybookId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `hr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function loadPlaybookStore(): PlaybookStore {
  try {
    const raw = localStorage.getItem(PLAYBOOK_STORE_KEY)
    if (!raw) return { items: [] }
    const p = JSON.parse(raw) as PlaybookStore
    if (!p || !Array.isArray(p.items)) return { items: [] }
    return {
      items: p.items
        .filter(x => x && typeof x.id === 'string' && typeof x.title === 'string')
        .map(x => ({
          id: x.id,
          title: x.title,
          iconKey: typeof x.iconKey === 'string' ? x.iconKey : 'book-open',
          descriptionBlocksJson: typeof x.descriptionBlocksJson === 'string' ? x.descriptionBlocksJson : '',
          createdAt: typeof x.createdAt === 'string' ? x.createdAt : nowIso(),
          updatedAt: typeof x.updatedAt === 'string' ? x.updatedAt : nowIso(),
        })),
    }
  } catch {
    return { items: [] }
  }
}

export function savePlaybookStore(s: PlaybookStore): void {
  try {
    localStorage.setItem(PLAYBOOK_STORE_KEY, JSON.stringify(s))
    void kvSet(PLAYBOOK_STORE_KEY, s)
  } catch {
    /* quota */
  }
}

export function upsertPlaybookItem(store: PlaybookStore, row: Partial<PlaybookItem> & { id: string; title: string }): PlaybookStore {
  const t = nowIso()
  const existing = store.items.find(i => i.id === row.id)
  const next: PlaybookItem = {
    id: row.id,
    title: row.title.trim() || '제목 없음',
    iconKey: row.iconKey ?? existing?.iconKey ?? 'book-open',
    descriptionBlocksJson: row.descriptionBlocksJson !== undefined ? row.descriptionBlocksJson : (existing?.descriptionBlocksJson ?? ''),
    createdAt: existing?.createdAt ?? t,
    updatedAt: t,
  }
  const others = store.items.filter(i => i.id !== row.id)
  return { items: [next, ...others] }
}

/** 순서만 변경 (orderedIds 순서대로 재배열) */
export function reorderPlaybookItems(store: PlaybookStore, orderedIds: string[]): PlaybookStore {
  const map = new Map(store.items.map(i => [i.id, i]))
  const next: PlaybookItem[] = []
  for (const id of orderedIds) {
    const x = map.get(id)
    if (x) next.push(x)
  }
  return { items: next }
}

export function deletePlaybookItem(store: PlaybookStore, id: string): PlaybookStore {
  return { items: store.items.filter(i => i.id !== id) }
}
