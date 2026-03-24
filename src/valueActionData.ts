/**
 * Value — 행동 자산 명세 (표준 원가·전략 가치)
 * app_kv + localStorage 동기화
 */

import { kvSet } from './lib/supabase'

export const VALUE_ACTION_STORE_KEY = 'creative-os-value-actions-v1'
/** 퀘스트 UUID → 행동 자산 UUID (로컬만, 완료 시 가치 누적 로직에 사용) */
export const QUEST_VALUE_LINK_KEY = 'creative-os-quest-value-link-v1'

export type StrategicValueLevel = 'high' | 'mid' | 'low'

/** 인지적 밀도 · 보상 특성: 1(낮음) ~ 5(높음) */
export type DensityLevel = 1 | 2 | 3 | 4 | 5

export type ValueAction = {
  id: string
  /** 휴지통(소프트 삭제) */
  is_deleted?: boolean
  /** 행동명 */
  actionName: string
  /** 정체성 (주체) */
  identity: string
  /** 표준 소요 시간(분) */
  standardTimeMinutes: number
  /** 경제적 가치(원) */
  economicValueKrw: number
  /** 인지적 밀도 (기계적 ↔ 창의·집중) */
  cognitiveDensity: DensityLevel
  /** 전략적 가치 */
  strategicValue: StrategicValueLevel
  /** 보상 특성 (도파민/성취감 강도) */
  rewardIntensity: DensityLevel
  createdAt: string
  updatedAt: string
}

export type ValueActionStore = { items: ValueAction[] }

export type QuestValueLinkMap = Record<string, string>

function nowIso() {
  return new Date().toISOString()
}

export function newValueActionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `va-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** 시간당 단가(원/시간). 시간이 0이면 null */
export function computeHourlyRateKrw(standardTimeMinutes: number, economicValueKrw: number): number | null {
  if (!Number.isFinite(standardTimeMinutes) || standardTimeMinutes <= 0) return null
  if (!Number.isFinite(economicValueKrw) || economicValueKrw < 0) return null
  const hours = standardTimeMinutes / 60
  return Math.round(economicValueKrw / hours)
}

export function loadValueActionStore(): ValueActionStore {
  try {
    const raw = localStorage.getItem(VALUE_ACTION_STORE_KEY)
    if (!raw) return { items: [] }
    const p = JSON.parse(raw) as ValueActionStore
    if (!p || !Array.isArray(p.items)) return { items: [] }
    return {
      items: p.items
        .filter(x => x && typeof x.id === 'string' && typeof x.actionName === 'string')
        .map(migrateRow),
    }
  } catch {
    return { items: [] }
  }
}

function migrateRow(x: Partial<ValueAction> & { id: string; actionName: string }): ValueAction {
  const t = nowIso()
  const std = typeof x.standardTimeMinutes === 'number' && x.standardTimeMinutes > 0 ? x.standardTimeMinutes : 60
  const ev = typeof x.economicValueKrw === 'number' && x.economicValueKrw >= 0 ? x.economicValueKrw : 0
  const cd = clampDensity(x.cognitiveDensity)
  const ri = clampDensity(x.rewardIntensity)
  const sv = normalizeStrategic(x.strategicValue)
  return {
    id: x.id,
    ...(x.is_deleted === true ? { is_deleted: true as const } : {}),
    actionName: x.actionName.trim() || '제목 없음',
    identity: typeof x.identity === 'string' ? x.identity.trim() : '',
    standardTimeMinutes: std,
    economicValueKrw: ev,
    cognitiveDensity: cd,
    strategicValue: sv,
    rewardIntensity: ri,
    createdAt: typeof x.createdAt === 'string' ? x.createdAt : t,
    updatedAt: typeof x.updatedAt === 'string' ? x.updatedAt : t,
  }
}

function clampDensity(n: unknown): DensityLevel {
  const v = typeof n === 'number' ? Math.round(n) : 3
  if (v < 1) return 1
  if (v > 5) return 5
  return v as DensityLevel
}

function normalizeStrategic(s: unknown): StrategicValueLevel {
  if (s === 'high' || s === 'mid' || s === 'low') return s
  return 'mid'
}

export function saveValueActionStore(s: ValueActionStore): void {
  try {
    localStorage.setItem(VALUE_ACTION_STORE_KEY, JSON.stringify(s))
    void kvSet(VALUE_ACTION_STORE_KEY, s)
  } catch {
    /* quota */
  }
}

export function upsertValueAction(store: ValueActionStore, row: ValueAction): ValueActionStore {
  const others = store.items.filter(i => i.id !== row.id)
  return { items: [row, ...others] }
}

/** 목록 UI용 — 휴지통 제외 */
export function activeValueActions(items: ValueAction[]): ValueAction[] {
  return items.filter(i => i.is_deleted !== true)
}

/** 소프트 삭제(휴지통) */
export function deleteValueAction(store: ValueActionStore, id: string): ValueActionStore {
  const u = nowIso()
  return {
    items: store.items.map(i =>
      i.id === id ? { ...i, is_deleted: true, updatedAt: u } : i,
    ),
  }
}

export function restoreValueAction(store: ValueActionStore, id: string): ValueActionStore {
  const u = nowIso()
  return {
    items: store.items.map(i => {
      if (i.id !== id) return i
      const { is_deleted: _d, ...rest } = i
      return { ...rest, updatedAt: u } as ValueAction
    }),
  }
}

/** 휴지통에서 영구 삭제 — 배열에서 제거 */
export function purgeValueAction(store: ValueActionStore, id: string): ValueActionStore {
  return { items: store.items.filter(i => i.id !== id) }
}

export function uniqueIdentities(items: ValueAction[]): string[] {
  const set = new Set<string>()
  for (const it of activeValueActions(items)) {
    const k = it.identity.trim()
    if (k) set.add(k)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ko'))
}

// ── Quest ↔ Value 링크 (로컬) ─────────────────────────────────────────────

export function loadQuestValueLinks(): QuestValueLinkMap {
  try {
    const raw = localStorage.getItem(QUEST_VALUE_LINK_KEY)
    if (!raw) return {}
    const p = JSON.parse(raw) as QuestValueLinkMap
    if (!p || typeof p !== 'object') return {}
    const out: QuestValueLinkMap = {}
    for (const [k, v] of Object.entries(p)) {
      if (typeof k === 'string' && typeof v === 'string') out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

export function saveQuestValueLinks(map: QuestValueLinkMap): void {
  try {
    localStorage.setItem(QUEST_VALUE_LINK_KEY, JSON.stringify(map))
    void kvSet(QUEST_VALUE_LINK_KEY, map)
  } catch {
    /* ignore */
  }
}

export function setQuestValueLink(questId: string, valueActionId: string | null): void {
  const cur = loadQuestValueLinks()
  if (valueActionId === null || valueActionId === '') {
    delete cur[questId]
  } else {
    cur[questId] = valueActionId
  }
  saveQuestValueLinks(cur)
}

export function getQuestValueLink(questId: string): string | undefined {
  return loadQuestValueLinks()[questId]
}

/** 행동 자산 표준시간·경제가치 → 퀘스트 예상 EXP·보상 코인 (표시·가이드용) */
export function computeQuestRewardsFromValue(va: ValueAction): { exp: number; coins: number } {
  const minutes = Math.max(1, va.standardTimeMinutes)
  const ev = Math.max(0, va.economicValueKrw)
  const exp = Math.round(12 + minutes * 0.35 + Math.sqrt(ev + 1) * 0.25 + (va.cognitiveDensity ?? 3) * 2)
  const coins = Math.max(1, Math.round(ev / 2500 + minutes / 4 + (va.rewardIntensity ?? 3)))
  return { exp: Math.min(800, exp), coins: Math.min(99999, coins) }
}
