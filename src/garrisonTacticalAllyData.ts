/**
 * 병영(Garrison) — 현재 전술 조력자(동료 카드 id)
 */
import { kvSet } from './lib/supabase'

export const GARRISON_TACTICAL_ALLY_KEY = 'bl_garrison_tactical_ally_v1'

export type GarrisonTacticalAllyStore = {
  version: 1
  /** CompanionCard.id 또는 null (시스템 기본 조언자) */
  companionId: string | null
}

export function loadGarrisonTacticalAlly(): GarrisonTacticalAllyStore {
  try {
    const raw = localStorage.getItem(GARRISON_TACTICAL_ALLY_KEY)
    if (!raw) return { version: 1, companionId: null }
    const p = JSON.parse(raw) as Partial<GarrisonTacticalAllyStore>
    if (p.version !== 1) return { version: 1, companionId: null }
    return {
      version: 1,
      companionId: typeof p.companionId === 'string' ? p.companionId : null,
    }
  } catch {
    return { version: 1, companionId: null }
  }
}

export function saveGarrisonTacticalAlly(next: GarrisonTacticalAllyStore): void {
  try {
    localStorage.setItem(GARRISON_TACTICAL_ALLY_KEY, JSON.stringify(next))
    void kvSet(GARRISON_TACTICAL_ALLY_KEY, next)
    try {
      window.dispatchEvent(new CustomEvent('bl-garrison-tactical-ally-sync'))
    } catch {
      /* ignore */
    }
  } catch {
    /* quota */
  }
}

export function setTacticalAllyCompanionId(id: string | null): void {
  saveGarrisonTacticalAlly({ version: 1, companionId: id })
}
