/**
 * 오늘의 존재 방식 — 아침 첫 접속 시 확인
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

export function shouldShowMorningPresenceModal(): boolean {
  return loadMorningPresenceAck() === null
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
