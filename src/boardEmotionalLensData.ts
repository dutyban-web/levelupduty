/**
 * Board — 과거/현재의 불행·행복 (app_kv + localStorage)
 */
import { kvSet } from './lib/supabase'

export const BOARD_EMOTIONAL_LENS_KEY = 'creative-os-board-emotional-lens-v1'

export type EmotionalLensPayload = {
  past_pain: string
  past_joy: string
  present_pain: string
  present_joy: string
}

const EMPTY: EmotionalLensPayload = {
  past_pain: '',
  past_joy: '',
  present_pain: '',
  present_joy: '',
}

function normalize(raw: unknown): EmotionalLensPayload {
  if (typeof raw !== 'object' || raw === null) return { ...EMPTY }
  const o = raw as Record<string, unknown>
  return {
    past_pain: typeof o.past_pain === 'string' ? o.past_pain : '',
    past_joy: typeof o.past_joy === 'string' ? o.past_joy : '',
    present_pain: typeof o.present_pain === 'string' ? o.present_pain : '',
    present_joy: typeof o.present_joy === 'string' ? o.present_joy : '',
  }
}

export function loadEmotionalLens(): EmotionalLensPayload {
  try {
    const raw = localStorage.getItem(BOARD_EMOTIONAL_LENS_KEY)
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

export function saveEmotionalLens(next: EmotionalLensPayload): void {
  const payload: EmotionalLensPayload = {
    past_pain: next.past_pain ?? '',
    past_joy: next.past_joy ?? '',
    present_pain: next.present_pain ?? '',
    present_joy: next.present_joy ?? '',
  }
  try {
    localStorage.setItem(BOARD_EMOTIONAL_LENS_KEY, JSON.stringify(payload))
    void kvSet(BOARD_EMOTIONAL_LENS_KEY, payload)
  } catch {
    /* quota */
  }
}
