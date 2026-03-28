/**
 * Tracker — Plan vs Actual 시간 관리 시스템
 * localStorage + app_kv 동기화
 */
import { kvSet } from './lib/supabase'

export const TRACKER_BUNDLE_KEY = 'creative-os-tracker-v1'

export function newTrackerId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `tr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export type TrackerLogType = 'plan' | 'actual'

export type TrackerCategory = {
  id: string
  label: string
  color: string
  tags: string[]
}

export type TrackerLog = {
  id: string
  type: TrackerLogType
  /** YYYY-MM-DD */
  date: string
  /** HH:mm */
  startTime: string
  /** minutes */
  duration: number
  categoryId: string
  tag: string
  memo?: string
  createdAt: string
}

export type TimeCommandment = {
  id: string
  text: string
  source: 'regret' | 'improve' | 'manual'
  createdAt: string
}

export type WeekFeedback = {
  weekKey: string
  regret: string
  improve: string
  updatedAt: string
}

export type TrackerBundle = {
  version: 1
  categories: TrackerCategory[]
  logs: TrackerLog[]
  commandments: TimeCommandment[]
  feedbacks: WeekFeedback[]
}

const DEFAULT_CATEGORIES: TrackerCategory[] = [
  { id: 'cat-work', label: '원고', color: '#6366f1', tags: ['데생', '콘티', '채색', '스토리', '편집'] },
  { id: 'cat-study', label: '공부', color: '#0891b2', tags: ['독서', '인강', '실습', '필기'] },
  { id: 'cat-health', label: '건강', color: '#059669', tags: ['운동', '산책', '명상', '수면'] },
  { id: 'cat-admin', label: '업무', color: '#d97706', tags: ['회의', '이메일', '서류', '정리'] },
  { id: 'cat-rest', label: '휴식', color: '#9ca3af', tags: ['유튜브', 'SNS', '게임', '낮잠'] },
  { id: 'cat-side', label: '사이드', color: '#8b5cf6', tags: ['코딩', '블로그', '영상', '기획'] },
]

export function defaultTrackerBundle(): TrackerBundle {
  return {
    version: 1,
    categories: DEFAULT_CATEGORIES,
    logs: [],
    commandments: [],
    feedbacks: [],
  }
}

function migrate(raw: unknown): TrackerBundle {
  const d = defaultTrackerBundle()
  if (!raw || typeof raw !== 'object') return d
  const o = raw as Record<string, unknown>
  return {
    version: 1,
    categories: Array.isArray(o.categories) ? (o.categories as TrackerCategory[]) : d.categories,
    logs: Array.isArray(o.logs) ? (o.logs as TrackerLog[]) : d.logs,
    commandments: Array.isArray(o.commandments) ? (o.commandments as TimeCommandment[]) : d.commandments,
    feedbacks: Array.isArray(o.feedbacks) ? (o.feedbacks as WeekFeedback[]) : d.feedbacks,
  }
}

export function loadTrackerBundle(): TrackerBundle {
  try {
    const raw = localStorage.getItem(TRACKER_BUNDLE_KEY)
    if (raw) return migrate(JSON.parse(raw))
  } catch { /* ignore */ }
  return defaultTrackerBundle()
}

export function saveTrackerBundle(b: TrackerBundle): void {
  const payload: TrackerBundle = { ...b, version: 1 }
  try {
    localStorage.setItem(TRACKER_BUNDLE_KEY, JSON.stringify(payload))
    void kvSet(TRACKER_BUNDLE_KEY, payload)
  } catch { /* quota */ }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tracker-bundle-changed'))
  }
}

export function logsForDateRange(logs: TrackerLog[], start: string, end: string): TrackerLog[] {
  return logs.filter(l => l.date >= start && l.date <= end)
}

export function logsForDate(logs: TrackerLog[], date: string): TrackerLog[] {
  return logs.filter(l => l.date === date)
}

export function planLogsForDate(logs: TrackerLog[], date: string): TrackerLog[] {
  return logs.filter(l => l.date === date && l.type === 'plan')
}

export function actualLogsForDate(logs: TrackerLog[], date: string): TrackerLog[] {
  return logs.filter(l => l.date === date && l.type === 'actual')
}

export function totalMinutesByCategory(logs: TrackerLog[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const l of logs) {
    m.set(l.categoryId, (m.get(l.categoryId) ?? 0) + l.duration)
  }
  return m
}

export function totalMinutesByTag(logs: TrackerLog[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const l of logs) {
    const k = `${l.categoryId}::${l.tag}`
    m.set(k, (m.get(k) ?? 0) + l.duration)
  }
  return m
}

export function weekKeyFromDate(date: string): string {
  const d = new Date(date + 'T12:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
