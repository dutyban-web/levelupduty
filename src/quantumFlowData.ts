/**
 * QuantumFlow · 시공편지 — 미래/과거의 나에게 보내는 편지 (도착일 기준)
 * 로컬 + app_kv 동기화, 통합 캘린더 점 표시용 openDate
 */
import { kvSet } from './lib/supabase'

export const QUANTUM_FLOW_KEY = 'creative_os_quantum_flow_v1'

/** 미래의 나 / 과거의 나 (감성·분류용) */
export type SpacetimeDirection = 'to_future' | 'to_past'

export type QuantumLetter = {
  id: string
  title: string
  body: string
  /** 도착일 — 이 날짜에 통합 캘린더에 표시 */
  openDate: string
  direction: SpacetimeDirection
  /** true: openDate 당일 0시 이전(당일 미포함이면 전일까지)에는 내용 열람 불가 */
  lockUntilOpen: boolean
  createdAt: string
  updatedAt: string
}

export type QuantumFlowStore = { letters: QuantumLetter[] }

export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 오늘 날짜 문자열과 비교 — openDate <= today 이면 '도착' */
export function isOpenDayReached(openDate: string, todayYmd: string): boolean {
  return openDate <= todayYmd
}

/** 잠금 시 열람 가능 여부 */
export function canReadLetter(letter: QuantumLetter, todayYmd: string): boolean {
  if (!letter.lockUntilOpen) return true
  return isOpenDayReached(letter.openDate, todayYmd)
}

export function loadQuantumFlowStore(): QuantumFlowStore {
  try {
    const raw = localStorage.getItem(QUANTUM_FLOW_KEY)
    if (!raw) return { letters: [] }
    const p = JSON.parse(raw) as QuantumFlowStore
    if (!p.letters || !Array.isArray(p.letters)) return { letters: [] }
    return p
  } catch {
    return { letters: [] }
  }
}

export function saveQuantumFlowStore(s: QuantumFlowStore) {
  try {
    localStorage.setItem(QUANTUM_FLOW_KEY, JSON.stringify(s))
    kvSet(QUANTUM_FLOW_KEY, s)
  } catch { /* ignore */ }
}

export function upsertLetter(store: QuantumFlowStore, letter: Omit<QuantumLetter, 'createdAt' | 'updatedAt'> & { id?: string }): QuantumFlowStore {
  const id = letter.id ?? `qf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const now = new Date().toISOString()
  const existing = store.letters.find(l => l.id === id)
  const createdAt = existing?.createdAt ?? now
  const next: QuantumLetter = {
    ...letter,
    id,
    createdAt,
    updatedAt: now,
  }
  const idx = store.letters.findIndex(l => l.id === id)
  const letters = idx >= 0 ? store.letters.map((l, i) => (i === idx ? next : l)) : [...store.letters, next]
  return { letters }
}

export function deleteLetter(store: QuantumFlowStore, id: string): QuantumFlowStore {
  return { letters: store.letters.filter(l => l.id !== id) }
}
