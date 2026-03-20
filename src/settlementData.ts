/**
 * 결산(일·주·월·분기·년·대운·주제) — 로컬 + app_kv 동기화
 * 통합 캘린더 점 표시용 anchorDate 포함
 */
import { kvSet } from './lib/supabase'

export const SETTLEMENT_KEY = 'creative_os_settlement_v1'

export type SettlementKind = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'daeun' | 'topic'

export type SettlementFieldDef = {
  id: string
  label: string
  placeholder?: string
  multiline?: boolean
}

export type SettlementEntry = {
  id: string
  kind: SettlementKind
  /** 종류별 기간 식별자 (예: 2026-03-19, 2026-W11, 2026-03, 2026-Q1, 2026, daeun-1, topic:이름) */
  periodKey: string
  /** 캘린더 점 찍을 대표일 YYYY-MM-DD */
  anchorDate: string
  topicLabel?: string | null
  updatedAt: string
  answers: Record<string, string>
}

export type SettlementStore = { entries: SettlementEntry[] }

export const SETTLEMENT_TEMPLATES: Record<SettlementKind, SettlementFieldDef[]> = {
  daily: [
    { id: 'win', label: '오늘 가장 잘한 한 가지', placeholder: '구체적으로 적어보세요', multiline: true },
    { id: 'regret', label: '아쉬웠던 점', placeholder: '스스로에게 솔직하게', multiline: true },
    { id: 'tomorrow', label: '내일 꼭 하나만 한다면', multiline: true },
    { id: 'mood', label: '감정 키워드 (한 단어)', placeholder: '예: 차분, 들뜸, 답답' },
    { id: 'energy', label: '오늘 에너지 (1~5)', placeholder: '숫자만' },
  ],
  weekly: [
    { id: 'highlight', label: '이번 주 가장 보람 있었던 일', multiline: true },
    { id: 'block', label: '막혔던 부분과 원인 추정', multiline: true },
    { id: 'next_week', label: '다음 주 최우선 1순위', multiline: true },
    { id: 'habit', label: '이번 주 루틴·습관의 변화', multiline: true },
  ],
  monthly: [
    { id: 'goal_review', label: '이번 달 목표 대비 달성률 (느낌·근거)', multiline: true },
    { id: 'numbers', label: '숫자로 본 나 (작업량·시간·건강 등)', multiline: true },
    { id: 'theme_next', label: '다음 달 테마 한 줄', multiline: true },
  ],
  quarterly: [
    { id: 'growth', label: '3개월 전의 나와 비교해 성장한 점', multiline: true },
    { id: 'risk', label: '리스크·에너지를 빼앗은 요인', multiline: true },
    { id: 'focus_q', label: '다음 분기에 집중할 한 가지', multiline: true },
  ],
  yearly: [
    { id: 'one_line', label: '한 해를 한 문장으로', multiline: true },
    { id: 'top3', label: '올해 성취 Top 3', multiline: true },
    { id: 'value', label: '내년에 지키고 싶은 가치 한 가지', multiline: true },
  ],
  daeun: [
    { id: 'span', label: '대운 구간·기간 (언제~언제)', placeholder: '예: 2024~2033', multiline: true },
    { id: 'symbol', label: '이 시기에 들어온 상징·키워드', multiline: true },
    { id: 'focus', label: '이 대운에서 갈고 닦을 것', multiline: true },
    { id: 'caution', label: '이 시기 주의점', multiline: true },
  ],
  topic: [
    { id: 'topic_name', label: '주제 이름', placeholder: '예: 창작, 건강, 관계' },
    { id: 'reflection', label: '이 주제에 대한 결산', multiline: true },
    { id: 'next_action', label: '다음 행동 한 가지', multiline: true },
  ],
}

export function loadSettlementStore(): SettlementStore {
  try {
    const raw = localStorage.getItem(SETTLEMENT_KEY)
    if (!raw) return { entries: [] }
    const p = JSON.parse(raw) as SettlementStore
    if (!p.entries || !Array.isArray(p.entries)) return { entries: [] }
    return p
  } catch {
    return { entries: [] }
  }
}

export function saveSettlementStore(s: SettlementStore) {
  try {
    localStorage.setItem(SETTLEMENT_KEY, JSON.stringify(s))
    kvSet(SETTLEMENT_KEY, s)
  } catch { /* ignore */ }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 해당 주의 월요일 날짜로 주간 키 고정 (예: week:2026-03-17) */
export function getWeekPeriodKey(d: Date): string {
  const m = mondayOfWeekContaining(d)
  return `week:${toYMD(m)}`
}

export function mondayOfWeekContaining(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  return x
}

export function getMonthPeriodKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function getQuarterPeriodKey(d: Date): string {
  const q = Math.floor(d.getMonth() / 3) + 1
  return `${d.getFullYear()}-Q${q}`
}

export function getYearPeriodKey(d: Date): string {
  return `${d.getFullYear()}`
}

/** kind + 기준일 + (topic만) 라벨로 periodKey 산출 */
export function computePeriodKey(kind: SettlementKind, ref: Date, topicLabel?: string): string {
  switch (kind) {
    case 'daily':
      return toYMD(ref)
    case 'weekly':
      return getWeekPeriodKey(ref)
    case 'monthly':
      return getMonthPeriodKey(ref)
    case 'quarterly':
      return getQuarterPeriodKey(ref)
    case 'yearly':
      return getYearPeriodKey(ref)
    case 'daeun': {
      const y = ref.getFullYear()
      return `daeun-${y}-${pad(ref.getMonth() + 1)}`
    }
    case 'topic': {
      const slug = (topicLabel ?? '주제').trim().slice(0, 32) || '주제'
      return `topic:${slug}:${toYMD(ref)}`
    }
    default:
      return toYMD(ref)
  }
}

export function computeAnchorDate(kind: SettlementKind, ref: Date): string {
  switch (kind) {
    case 'daily':
      return toYMD(ref)
    case 'weekly':
      return toYMD(mondayOfWeekContaining(ref))
    case 'monthly':
      return `${ref.getFullYear()}-${pad(ref.getMonth() + 1)}-01`
    case 'quarterly': {
      const q = Math.floor(ref.getMonth() / 3) * 3
      return `${ref.getFullYear()}-${pad(q + 1)}-01`
    }
    case 'yearly':
      return `${ref.getFullYear()}-01-01`
    case 'daeun':
    case 'topic':
      return toYMD(ref)
    default:
      return toYMD(ref)
  }
}

export function findEntry(entries: SettlementEntry[], kind: SettlementKind, periodKey: string): SettlementEntry | undefined {
  return entries.find(e => e.kind === kind && e.periodKey === periodKey)
}

export function upsertEntry(
  store: SettlementStore,
  patch: Omit<SettlementEntry, 'updatedAt'> & { id?: string },
): SettlementStore {
  const id = patch.id ?? `st_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const updatedAt = new Date().toISOString()
  const next: SettlementEntry = {
    ...patch,
    id,
    updatedAt,
  }
  const idx = store.entries.findIndex(e => e.kind === patch.kind && e.periodKey === patch.periodKey)
  const entries = idx >= 0
    ? store.entries.map((e, i) => (i === idx ? next : e))
    : [...store.entries, next]
  return { entries }
}

/** 통합 캘린더용: 각 결산의 anchor 날짜 */
export function settlementCalendarMarkers(entries: SettlementEntry[]): { date: string; label: string; id: string }[] {
  const kindLabel: Record<SettlementKind, string> = {
    daily: '일일',
    weekly: '주간',
    monthly: '월간',
    quarterly: '분기',
    yearly: '년간',
    daeun: '대운',
    topic: '주제',
  }
  return entries.map(e => ({
    date: e.anchorDate,
    id: e.id,
    label: `[결산] ${kindLabel[e.kind]}`,
  }))
}
