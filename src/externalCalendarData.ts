/**
 * 현실의 문 — 외부 캘린더(모의·Google) 일정 → 1시간 카드 오버레이용
 *
 * 실제 Google Calendar 연동 시: OAuth 후 events.list 결과를
 * { dateYmd, startHour, endHour, title, source:'google' } 형태로 정규화해 동일 스토어에 넣으면 됩니다.
 */
import { kvSet } from './lib/supabase'

export const EXTERNAL_CALENDAR_STORE_KEY = 'bl_external_calendar_v1'

export type ExternalCalendarEvent = {
  id: string
  title: string
  /** 로컬 기준 YYYY-MM-DD */
  dateYmd: string
  /** 0–23 */
  startHour: number
  /** 배타적 상한 (9시~10시면 startHour 9, endHour 10) */
  endHour: number
  source: 'mock' | 'google'
  createdAt: string
}

export type ExternalCalendarStore = {
  version: 1
  events: ExternalCalendarEvent[]
}

const EMPTY: ExternalCalendarStore = { version: 1, events: [] }

function todayYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function nowIso() {
  return new Date().toISOString()
}

export function newExternalEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `xcal_${crypto.randomUUID()}`
  return `xcal_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function loadExternalCalendarStore(): ExternalCalendarStore {
  try {
    const raw = localStorage.getItem(EXTERNAL_CALENDAR_STORE_KEY)
    if (!raw) return { ...EMPTY }
    const p = JSON.parse(raw) as Partial<ExternalCalendarStore>
    if (p.version !== 1 || !Array.isArray(p.events)) return { ...EMPTY }
    const events = p.events
      .filter(
        (e): e is ExternalCalendarEvent =>
          e != null &&
          typeof e === 'object' &&
          typeof (e as ExternalCalendarEvent).id === 'string' &&
          typeof (e as ExternalCalendarEvent).dateYmd === 'string' &&
          typeof (e as ExternalCalendarEvent).title === 'string' &&
          typeof (e as ExternalCalendarEvent).startHour === 'number',
      )
      .map(e => ({
        ...e,
        endHour: typeof e.endHour === 'number' ? e.endHour : e.startHour + 1,
        source: e.source === 'google' ? 'google' : 'mock',
        createdAt: typeof e.createdAt === 'string' ? e.createdAt : nowIso(),
      }))
    return { version: 1, events }
  } catch {
    return { ...EMPTY }
  }
}

/** UI에서 호출 — 오늘 날짜에 데모 일정 2개 */
export function seedSampleExternalEvents(): ExternalCalendarStore {
  const d = todayYmd()
  const seeded: ExternalCalendarEvent[] = [
    {
      id: newExternalEventId(),
      title: '[모의] 집중 블록 (예시)',
      dateYmd: d,
      startHour: 10,
      endHour: 11,
      source: 'mock',
      createdAt: nowIso(),
    },
    {
      id: newExternalEventId(),
      title: '[모의] 외부 약속 (예시)',
      dateYmd: d,
      startHour: 15,
      endHour: 17,
      source: 'mock',
      createdAt: nowIso(),
    },
  ]
  const next = { version: 1 as const, events: seeded }
  saveExternalCalendarStore(next)
  return next
}

export const BL_EXTERNAL_CALENDAR_SYNC = 'bl-external-calendar-sync'

export function saveExternalCalendarStore(next: ExternalCalendarStore): void {
  try {
    localStorage.setItem(EXTERNAL_CALENDAR_STORE_KEY, JSON.stringify(next))
    void kvSet(EXTERNAL_CALENDAR_STORE_KEY, next)
    try {
      window.dispatchEvent(new CustomEvent(BL_EXTERNAL_CALENDAR_SYNC))
    } catch {
      /* ignore */
    }
  } catch {
    /* quota */
  }
}

/** 해당 로컬 날짜에 겹치는 시각(시) 집합 */
export function getOccupiedHourSetForLocalDate(dateYmd: string): Set<number> {
  const store = loadExternalCalendarStore()
  const set = new Set<number>()
  for (const e of store.events) {
    if (e.dateYmd !== dateYmd) continue
    const lo = Math.max(0, Math.min(23, Math.floor(e.startHour)))
    const hi = Math.max(lo + 1, Math.min(24, Math.ceil(e.endHour)))
    for (let h = lo; h < hi; h++) set.add(h)
  }
  return set
}

export function titlesForHour(dateYmd: string, hour: number): string[] {
  const store = loadExternalCalendarStore()
  const out: string[] = []
  for (const e of store.events) {
    if (e.dateYmd !== dateYmd) continue
    const lo = Math.max(0, Math.min(23, Math.floor(e.startHour)))
    const hi = Math.max(lo + 1, Math.min(24, Math.ceil(e.endHour)))
    if (hour >= lo && hour < hi) out.push(e.title)
  }
  return out
}
