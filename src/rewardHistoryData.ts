/**
 * 보상 상점 구매 내역 — bl_reward_history_v1
 */
import { kvSet } from './lib/supabase'

export const REWARD_HISTORY_KEY = 'bl_reward_history_v1'

export type RewardHistoryKind =
  | 'shop_item'
  | 'visualization'
  | 'custom'
  | 'consumable'
  | 'equipment'
  | 'relic'

export type RewardHistoryEntry = {
  id: string
  kind: RewardHistoryKind
  /** 상점 카탈로그 id 또는 심상화 id */
  refId: string
  title: string
  /** 골드 결제분 (없으면 0) */
  costGold: number
  /** 시뮬레이션 크레딧 결제분 */
  costCredits?: number
  purchasedAt: string
}

export type RewardHistoryStore = {
  version: 1
  entries: RewardHistoryEntry[]
}

export function newRewardHistoryId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `rh_${crypto.randomUUID()}`
  return `rh_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function loadRewardHistory(): RewardHistoryStore {
  try {
    const raw = localStorage.getItem(REWARD_HISTORY_KEY)
    if (!raw) return { version: 1, entries: [] }
    const p = JSON.parse(raw) as Partial<RewardHistoryStore>
    if (p.version !== 1 || !Array.isArray(p.entries)) return { version: 1, entries: [] }
    return {
      version: 1,
      entries: p.entries.filter(
        (e): e is RewardHistoryEntry =>
          e != null &&
          typeof e === 'object' &&
          typeof (e as RewardHistoryEntry).id === 'string' &&
          typeof (e as RewardHistoryEntry).title === 'string',
      ),
    }
  } catch {
    return { version: 1, entries: [] }
  }
}

export function saveRewardHistory(next: RewardHistoryStore): void {
  try {
    localStorage.setItem(REWARD_HISTORY_KEY, JSON.stringify(next))
    void kvSet(REWARD_HISTORY_KEY, next)
  } catch {
    /* quota */
  }
}

export function appendRewardHistory(
  entry: Omit<RewardHistoryEntry, 'id' | 'purchasedAt'> & { id?: string },
): RewardHistoryStore {
  const store = loadRewardHistory()
  const id = entry.id ?? newRewardHistoryId()
  const row: RewardHistoryEntry = {
    ...entry,
    costGold: typeof entry.costGold === 'number' ? entry.costGold : 0,
    id,
    purchasedAt: new Date().toISOString(),
  }
  const next = { ...store, entries: [row, ...store.entries] }
  saveRewardHistory(next)
  return next
}
