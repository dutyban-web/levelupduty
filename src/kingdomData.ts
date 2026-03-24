/**
 * Kingdom Management — 건물·인프라 (localStorage + KV)
 */
import { kvSet } from './lib/supabase'
import { loadRpgProfile, saveRpgProfile } from './levelupRpgProfile'
import type { MapZoneId } from './mapHubZones'

export const KINGDOM_KEY = 'bl_kingdom_v1'

export type BuildingId = 'observatory' | 'garden' | 'library' | 'achievement_hall'

export type KingdomState = {
  /** 구역별 건물 (타입당 1개) */
  zones: Partial<Record<MapZoneId, Partial<Record<BuildingId, true>>>>
}

export const BUILDING_META: Record<
  BuildingId,
  { label: string; emoji: string; cost: number; microLabel: string }
> = {
  observatory: { label: '천문대', emoji: '🔭', cost: 120, microLabel: '지금 바로 설계도만 펼치기' },
  garden: { label: '정원', emoji: '🌿', cost: 90, microLabel: '지금 바로 씨앗 봉투만 열기' },
  library: { label: '도서관', emoji: '📚', cost: 150, microLabel: '지금 바로 책갈피만 꽂기' },
  achievement_hall: {
    label: '업적의 전당',
    emoji: '🏛️',
    cost: 220,
    microLabel: '지금 바로 명패만 닦기',
  },
}

function zoneIds(): MapZoneId[] {
  return [
    'creative_forest',
    'engineering_fort',
    'commerce_plains',
    'human_realm',
    'side_hill',
    'neutral_meadow',
  ]
}

export function defaultKingdom(): KingdomState {
  return { zones: {} }
}

export function loadKingdom(): KingdomState {
  try {
    const raw = localStorage.getItem(KINGDOM_KEY)
    if (!raw) return defaultKingdom()
    const p = JSON.parse(raw) as Partial<KingdomState>
    if (!p || typeof p !== 'object' || !p.zones || typeof p.zones !== 'object') return defaultKingdom()
    return { zones: p.zones as KingdomState['zones'] }
  } catch {
    return defaultKingdom()
  }
}

export function saveKingdom(s: KingdomState): void {
  try {
    localStorage.setItem(KINGDOM_KEY, JSON.stringify(s))
    void kvSet(KINGDOM_KEY, s)
  } catch {
    /* ignore */
  }
}

export function countBuildings(s: KingdomState): number {
  let n = 0
  for (const z of zoneIds()) {
    const row = s.zones[z]
    if (!row) continue
    for (const b of Object.keys(row)) {
      if (row[b as BuildingId]) n++
    }
  }
  return n
}

/** 재건 연출 0~1 (맵 밝기) */
export function reconstructionFactor(s: KingdomState): number {
  const c = countBuildings(s)
  const max = 18
  return Math.min(1, c / max)
}

export function hasBuilding(state: KingdomState, zone: MapZoneId, b: BuildingId): boolean {
  return state.zones[zone]?.[b] === true
}

export function kingdomHasGardenBuff(state: KingdomState = loadKingdom()): boolean {
  for (const z of zoneIds()) {
    if (state.zones[z]?.garden) return true
  }
  return false
}

export function kingdomHasObservatory(state: KingdomState = loadKingdom()): boolean {
  for (const z of zoneIds()) {
    if (state.zones[z]?.observatory) return true
  }
  return false
}

export function kingdomHasLibrary(state: KingdomState = loadKingdom()): boolean {
  for (const z of zoneIds()) {
    if (state.zones[z]?.library) return true
  }
  return false
}

export function trySpendGold(amount: number): boolean {
  if (amount <= 0) return true
  const p = loadRpgProfile()
  if (p.gold < amount) return false
  saveRpgProfile({ ...p, gold: p.gold - amount })
  try {
    window.dispatchEvent(new CustomEvent('bl-rpg-sync'))
  } catch {
    /* ignore */
  }
  return true
}

/** 골드 차감 + 건물 등록 (한 트랜잭션) */
export function tryBuild(zone: MapZoneId, building: BuildingId): boolean {
  const meta = BUILDING_META[building]
  const state = loadKingdom()
  if (hasBuilding(state, zone, building)) return false
  if (!trySpendGold(meta.cost)) return false
  const next: KingdomState = {
    zones: {
      ...state.zones,
      [zone]: { ...state.zones[zone], [building]: true },
    },
  }
  saveKingdom(next)
  return true
}
