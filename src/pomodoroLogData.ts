/**
 * 포모도로 세션 로그 — app_kv + localStorage
 * 통합 캘린더 날짜(YYYY-MM-DD)와 정렬
 */

import { kvSet } from './lib/supabase'

export const POMODORO_LOG_KEY = 'creative-os-pomodoro-log-v1'

export type PomodoroLogSource = 'session' | 'manual'

export type PomodoroLogEntry = {
  id: string
  /** YYYY-MM-DD */
  date: string
  /** 로컬 시각 HH:mm (그리드 배치용) */
  startTimeLocal: string
  minutes: number
  seconds: number
  questId: string | null
  questTitle: string | null
  identityName?: string
  xpGain?: number
  source: PomodoroLogSource
  createdAt: string
  /** Supabase calendar_events.id (있으면 중복 방지·삭제 연동) */
  remoteId?: string
}

export type PomodoroLogStore = { entries: PomodoroLogEntry[] }

function nowIso() {
  return new Date().toISOString()
}

export function newPomodoroLogId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `pl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function loadPomodoroLog(): PomodoroLogStore {
  try {
    const raw = localStorage.getItem(POMODORO_LOG_KEY)
    if (!raw) return { entries: [] }
    const p = JSON.parse(raw) as PomodoroLogStore
    if (!p || !Array.isArray(p.entries)) return { entries: [] }
    return {
      entries: p.entries
        .filter(e => e && typeof e.id === 'string' && typeof e.date === 'string')
        .map(e => ({
          ...e,
          minutes: typeof e.minutes === 'number' ? e.minutes : Math.max(1, Math.floor((e.seconds ?? 0) / 60)),
          seconds: typeof e.seconds === 'number' ? e.seconds : (e.minutes ?? 1) * 60,
        })),
    }
  } catch {
    return { entries: [] }
  }
}

export function savePomodoroLog(store: PomodoroLogStore): void {
  try {
    localStorage.setItem(POMODORO_LOG_KEY, JSON.stringify(store))
    void kvSet(POMODORO_LOG_KEY, store)
  } catch {
    /* quota */
  }
}

export function appendPomodoroLog(part: Omit<PomodoroLogEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): PomodoroLogEntry {
  const row: PomodoroLogEntry = {
    id: part.id ?? newPomodoroLogId(),
    date: part.date,
    startTimeLocal: part.startTimeLocal,
    minutes: part.minutes,
    seconds: part.seconds,
    questId: part.questId ?? null,
    questTitle: part.questTitle ?? null,
    identityName: part.identityName,
    xpGain: part.xpGain,
    source: part.source,
    createdAt: part.createdAt ?? nowIso(),
    remoteId: part.remoteId,
  }
  const cur = loadPomodoroLog()
  savePomodoroLog({ entries: [row, ...cur.entries] })
  return row
}

export function upsertRemoteId(localId: string, remoteId: string): void {
  const cur = loadPomodoroLog()
  const next = cur.entries.map(e => (e.id === localId ? { ...e, remoteId } : e))
  savePomodoroLog({ entries: next })
}

export function removePomodoroLogEntry(id: string): void {
  const cur = loadPomodoroLog()
  savePomodoroLog({ entries: cur.entries.filter(e => e.id !== id) })
}

export function removePomodoroLogByRemoteId(remoteId: string): void {
  const cur = loadPomodoroLog()
  savePomodoroLog({ entries: cur.entries.filter(e => e.remoteId !== remoteId) })
}

export function listPomodoroLogsInRange(startDate: string, endDate: string): PomodoroLogEntry[] {
  return loadPomodoroLog().entries.filter(e => e.date >= startDate && e.date <= endDate)
}
