/**
 * Evolution — Action / React / Routine / Habit
 * 카드·노트 생성 시 부여한 점수는 완료·성취 시 누적 XP로 반영 (레벨 게이지)
 */
import { kvSet } from './lib/supabase'

export const EVOLUTION_KEY = 'creative_os_evolution_v1'

export type EvolutionCategory = 'action' | 'react' | 'routine' | 'habit'

export const EVOLUTION_CATEGORY_LABEL: Record<EvolutionCategory, { label: string; emoji: string; hint: string }> = {
  action: { label: 'Action', emoji: '⚡', hint: '실행·도전' },
  react: { label: 'React', emoji: '🔁', hint: '반응·대응·회복' },
  routine: { label: 'Routine', emoji: '📅', hint: '루틴·패턴' },
  habit: { label: 'Habit', emoji: '🌱', hint: '습관·누적' },
}

export type EvolutionItem = {
  id: string
  /** 휴지통(소프트 삭제) */
  is_deleted?: boolean
  category: EvolutionCategory
  title: string
  body: string
  /** 완료 시 가산되는 진화 XP (생성 시 지정) */
  evolutionPoints: number
  completed: boolean
  completedAt?: string
  createdAt: string
  updatedAt: string
}

export type EvolutionStore = {
  version: 1
  /** 완료로 누적된 총 진화 XP */
  totalEvolutionXp: number
  items: EvolutionItem[]
}

/** 레벨 L에서 다음 레벨까지 필요한 XP (조정 가능) */
export function xpForNextLevel(level: number): number {
  if (level < 1) return 100
  return Math.max(40, 60 + (level - 1) * 35)
}

/** 총 XP → 현재 레벨, 레벨 내 XP, 다음 레벨까지 필요 XP */
export function evolutionProgress(totalXp: number): {
  level: number
  xpIntoLevel: number
  xpForNext: number
  totalXp: number
} {
  let level = 1
  let remain = Math.max(0, totalXp)
  while (true) {
    const need = xpForNextLevel(level)
    if (remain < need) {
      return { level, xpIntoLevel: remain, xpForNext: need, totalXp }
    }
    remain -= need
    level++
    if (level > 9999) break
  }
  return { level: 1, xpIntoLevel: 0, xpForNext: xpForNextLevel(1), totalXp }
}

export function loadEvolutionStore(): EvolutionStore {
  try {
    const raw = localStorage.getItem(EVOLUTION_KEY)
    if (!raw) return { version: 1, totalEvolutionXp: 0, items: [] }
    const p = JSON.parse(raw) as EvolutionStore
    if (p.version !== 1 || !Array.isArray(p.items)) return { version: 1, totalEvolutionXp: 0, items: [] }
    return {
      version: 1,
      totalEvolutionXp: typeof p.totalEvolutionXp === 'number' ? Math.max(0, p.totalEvolutionXp) : 0,
      items: p.items,
    }
  } catch {
    return { version: 1, totalEvolutionXp: 0, items: [] }
  }
}

export function saveEvolutionStore(s: EvolutionStore) {
  try {
    localStorage.setItem(EVOLUTION_KEY, JSON.stringify(s))
    kvSet(EVOLUTION_KEY, s)
  } catch { /* ignore */ }
}

export function activeEvolutionItems(items: EvolutionItem[]): EvolutionItem[] {
  return items.filter(i => i.is_deleted !== true)
}

export function upsertEvolutionItem(
  store: EvolutionStore,
  patch: Omit<EvolutionItem, 'createdAt' | 'updatedAt'> & { id?: string },
): EvolutionStore {
  const id = patch.id ?? `evo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const now = new Date().toISOString()
  const existing = store.items.find(i => i.id === id)
  const createdAt = existing?.createdAt ?? now
  let totalEvolutionXp = store.totalEvolutionXp

  const nextItem: EvolutionItem = {
    ...patch,
    id,
    evolutionPoints: Math.max(0, Math.round(patch.evolutionPoints)),
    createdAt,
    updatedAt: now,
  }

  const was = existing?.completed ?? false
  const will = nextItem.completed
  const oldPts = existing?.evolutionPoints ?? 0
  const newPts = nextItem.evolutionPoints

  if (!existing) {
    if (will) totalEvolutionXp += newPts
  } else if (was && will) {
    totalEvolutionXp = totalEvolutionXp - oldPts + newPts
  } else if (was && !will) {
    totalEvolutionXp = Math.max(0, totalEvolutionXp - oldPts)
  } else if (!was && will) {
    totalEvolutionXp += newPts
  }

  const idx = store.items.findIndex(i => i.id === id)
  const items = idx >= 0 ? store.items.map((it, i) => (i === idx ? nextItem : it)) : [nextItem, ...store.items]
  return { ...store, totalEvolutionXp, items }
}

/** 휴지통으로 — 완료 항목은 XP에서 차감(기존 삭제와 동일) */
export function deleteEvolutionItem(store: EvolutionStore, id: string): EvolutionStore {
  const item = store.items.find(i => i.id === id)
  if (!item || item.is_deleted === true) return store
  let totalEvolutionXp = store.totalEvolutionXp
  if (item.completed) totalEvolutionXp = Math.max(0, totalEvolutionXp - item.evolutionPoints)
  const now = new Date().toISOString()
  return {
    ...store,
    totalEvolutionXp,
    items: store.items.map(i => (i.id === id ? { ...i, is_deleted: true, updatedAt: now } : i)),
  }
}

export function restoreEvolutionItem(store: EvolutionStore, id: string): EvolutionStore {
  const item = store.items.find(i => i.id === id)
  if (!item || item.is_deleted !== true) return store
  let totalEvolutionXp = store.totalEvolutionXp
  if (item.completed) totalEvolutionXp += item.evolutionPoints
  const now = new Date().toISOString()
  return {
    ...store,
    totalEvolutionXp,
    items: store.items.map(i => {
      if (i.id !== id) return i
      const { is_deleted: _d, ...rest } = i
      return { ...rest, updatedAt: now } as EvolutionItem
    }),
  }
}

/** 휴지통에서 영구 삭제 — 이미 XP 차감된 휴지통 항목은 배열만 제거 */
export function purgeEvolutionItem(store: EvolutionStore, id: string): EvolutionStore {
  const item = store.items.find(i => i.id === id)
  if (!item) return store
  if (item.is_deleted !== true) {
    let totalEvolutionXp = store.totalEvolutionXp
    if (item.completed) totalEvolutionXp = Math.max(0, totalEvolutionXp - item.evolutionPoints)
    return { ...store, totalEvolutionXp, items: store.items.filter(i => i.id !== id) }
  }
  return { ...store, items: store.items.filter(i => i.id !== id) }
}
