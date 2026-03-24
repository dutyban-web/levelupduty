/**
 * 운명의 연대기 — 생애 타임라인 + Life 기록 + 목표 D-day
 * app_kv + localStorage (kvSyncedKeys)
 */
import { kvSet } from './lib/supabase'

export const CHRONICLE_STORE_KEY = 'bl_chronicle_v1'

export type LifeRecordCategory = 'world' | 'sports' | 'news' | 'personal'

export type LifeRecord = {
  id: string
  /** YYYY-MM-DD (대략적 기록일) */
  dateYmd: string
  title: string
  category: LifeRecordCategory
  body: string
  createdAt: string
  updatedAt: string
}

export type GoalMilestone = {
  id: string
  /** YYYY-MM-DD */
  dateYmd: string
  label: string
  createdAt: string
}

export type ChronicleStore = {
  version: 1
  /** 기준 생년 (1986 등) */
  birthYear: number
  lifeRecords: LifeRecord[]
  goalMilestones: GoalMilestone[]
}

const EMPTY: ChronicleStore = {
  version: 1,
  birthYear: 1986,
  lifeRecords: [],
  goalMilestones: [],
}

function nowIso() {
  return new Date().toISOString()
}

export function newChronicleId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}_${crypto.randomUUID()}`
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function loadChronicleStore(): ChronicleStore {
  try {
    const raw = localStorage.getItem(CHRONICLE_STORE_KEY)
    if (!raw) return { ...EMPTY }
    const p = JSON.parse(raw) as Partial<ChronicleStore>
    if (p.version !== 1) return { ...EMPTY }
    const birthYear = typeof p.birthYear === 'number' && p.birthYear > 1800 && p.birthYear < 2100 ? p.birthYear : 1986
    const lifeRecords = Array.isArray(p.lifeRecords)
      ? p.lifeRecords
          .filter(
            (r): r is LifeRecord =>
              r != null &&
              typeof r === 'object' &&
              typeof (r as LifeRecord).id === 'string' &&
              typeof (r as LifeRecord).dateYmd === 'string' &&
              typeof (r as LifeRecord).title === 'string',
          )
          .map(r => ({
            ...r,
            category: (['world', 'sports', 'news', 'personal'] as const).includes(r.category as LifeRecordCategory)
              ? r.category
              : ('personal' as LifeRecordCategory),
            body: typeof r.body === 'string' ? r.body : '',
            createdAt: typeof r.createdAt === 'string' ? r.createdAt : nowIso(),
            updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : nowIso(),
          }))
      : []
    const goalMilestones = Array.isArray(p.goalMilestones)
      ? p.goalMilestones
          .filter(
            (g): g is GoalMilestone =>
              g != null &&
              typeof g === 'object' &&
              typeof (g as GoalMilestone).id === 'string' &&
              typeof (g as GoalMilestone).dateYmd === 'string' &&
              typeof (g as GoalMilestone).label === 'string',
          )
          .map(g => ({
            ...g,
            createdAt: typeof g.createdAt === 'string' ? g.createdAt : nowIso(),
          }))
      : []
    return { version: 1, birthYear, lifeRecords, goalMilestones }
  } catch {
    return { ...EMPTY }
  }
}

export function saveChronicleStore(next: ChronicleStore): void {
  try {
    localStorage.setItem(CHRONICLE_STORE_KEY, JSON.stringify(next))
    void kvSet(CHRONICLE_STORE_KEY, next)
  } catch {
    /* quota */
  }
}

/** 100년 창: birthYear ~ birthYear + 99 */
export function chronicleYearRange(birthYear: number): { startYear: number; endYear: number } {
  return { startYear: birthYear, endYear: birthYear + 99 }
}

/** 10년 대운 인덱스 0..9 */
export function decadeIndexForYear(birthYear: number, year: number): number {
  return Math.floor((year - birthYear) / 10)
}
