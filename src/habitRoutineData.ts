/**
 * 루틴 거리 — Evolution 루틴/습관 + 앵커 행동 순서 (localStorage + KV)
 */
import { kvSet } from './lib/supabase'
import type { EvolutionStore, EvolutionItem } from './evolutionData'
import { activeEvolutionItems } from './evolutionData'

export const HABIT_ROUTINE_CHAIN_KEY = 'bl_routine_street_chain_v1'

export type StreetSegment =
  | { kind: 'evo'; evolutionItemId: string }
  | { kind: 'anchor'; id: string; label: string }

export function newAnchorId(): string {
  return `anchor_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function loadStreetChain(): StreetSegment[] | null {
  try {
    const raw = localStorage.getItem(HABIT_ROUTINE_CHAIN_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as { segments?: StreetSegment[] }
    if (!p?.segments || !Array.isArray(p.segments)) return null
    return p.segments.filter(s => {
      if (s.kind === 'evo') return typeof (s as { evolutionItemId?: string }).evolutionItemId === 'string'
      if (s.kind === 'anchor') return typeof (s as { id?: string; label?: string }).label === 'string'
      return false
    }) as StreetSegment[]
  } catch {
    return null
  }
}

export function saveStreetChain(segments: StreetSegment[]): void {
  try {
    localStorage.setItem(HABIT_ROUTINE_CHAIN_KEY, JSON.stringify({ segments }))
    void kvSet(HABIT_ROUTINE_CHAIN_KEY, { segments })
  } catch {
    /* ignore */
  }
}

function isRoutineHabit(i: EvolutionItem): boolean {
  return (i.category === 'routine' || i.category === 'habit') && i.is_deleted !== true
}

/** 오늘 거리에 올 미완료 루틴/습관 → 기본 순서 */
export function buildDefaultChainFromEvolution(store: EvolutionStore): StreetSegment[] {
  const items = activeEvolutionItems(store.items)
    .filter(i => isRoutineHabit(i) && !i.completed)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
  return items.map(i => ({ kind: 'evo' as const, evolutionItemId: i.id }))
}

/** 저장된 체인을 현재 Evolution과 동기화 — 없는 id·이미 완료된 루틴 제거 */
export function reconcileChain(segments: StreetSegment[], store: EvolutionStore): StreetSegment[] {
  const items = activeEvolutionItems(store.items)
  const byId = new Map(items.map(i => [i.id, i]))
  return segments.filter(s => {
    if (s.kind === 'anchor') return s.label.trim().length > 0
    const it = byId.get(s.evolutionItemId)
    return !!it && !it.completed
  })
}
