/**
 * 존재 방식(원형·태세 ack) — 로컬/kv 보관용.
 * 기동 시 전체 화면 모달은 사용하지 않음(태세는 Act에서 전환, 원형은 그 상위 개념으로만 활용).
 */
import { kvSet } from './lib/supabase'
import type { IdentityArchetype } from './identityArchetypeData'

export const MORNING_PRESENCE_ACK_KEY = 'bl_morning_presence_ack_v1'

export type MorningPresenceAck = {
  dateYmd: string
  archetype: IdentityArchetype
  identityId: string | null
}

function localYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function loadMorningPresenceAck(): MorningPresenceAck | null {
  try {
    const raw = localStorage.getItem(MORNING_PRESENCE_ACK_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<MorningPresenceAck>
    if (!p || typeof p.dateYmd !== 'string') return null
    if (p.dateYmd !== localYmd()) return null
    const a = p.archetype
    if (a !== 'analyst' && a !== 'creator' && a !== 'capitalist' && a !== 'adventurer') return null
    return {
      dateYmd: p.dateYmd,
      archetype: a,
      identityId: typeof p.identityId === 'string' ? p.identityId : null,
    }
  } catch {
    return null
  }
}

/** @deprecated 앱 첫 화면 모달 비활성화 — 항상 false */
export function shouldShowMorningPresenceModal(): boolean {
  return false
}

export function acknowledgeMorningPresence(state: Omit<MorningPresenceAck, 'dateYmd'>): void {
  const payload: MorningPresenceAck = {
    dateYmd: localYmd(),
    archetype: state.archetype,
    identityId: state.identityId,
  }
  try {
    localStorage.setItem(MORNING_PRESENCE_ACK_KEY, JSON.stringify(payload))
    void kvSet(MORNING_PRESENCE_ACK_KEY, payload)
  } catch {
    /* quota */
  }
}
