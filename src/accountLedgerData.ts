/**
 * 통합 가계부 — 로컬 + app_kv
 * 나중에 Supabase 테이블(ledger_entries 등)로 이전하기 쉽게 필드명·구조를 유지합니다.
 *
 * Travel 연동: TRAVEL_TRIP_DETAIL_KEY 의 expenses를 `source.kind === 'travel'` 로 편입 (중복 스킵)
 */
import { kvSet } from './lib/supabase'

export const ACCOUNT_LEDGER_KEY = 'creative_os_account_ledger_v1'

/** Travel 상세와 동일 키 — 읽기 전용 동기화용 (App.tsx 와 문자열 일치 필수) */
export const TRAVEL_TRIP_DETAIL_KEY = 'creative_os_travel_trip_detail_v1'

export type LedgerFlow = 'expense' | 'income'

export type LedgerSource =
  | { kind: 'manual' }
  | { kind: 'travel'; tripId: string; tripLabel?: string; travelExpenseId: string }

export type LedgerCategory = {
  id: string
  label: string
  emoji: string
  sortOrder: number
  /** 없으면 both */
  scope?: 'expense' | 'income' | 'both'
}

export type LedgerEntry = {
  id: string
  /** 휴지통(소프트 삭제) */
  is_deleted?: boolean
  date: string
  /** 항상 양수 */
  amount: number
  flow: LedgerFlow
  categoryId: string
  memo: string
  /** 예: travel, 프로젝트명 — 필터·통계용 */
  tags: string[]
  source: LedgerSource
  createdAt: string
  updatedAt: string
}

export type LedgerStore = {
  version: 1
  categories: LedgerCategory[]
  entries: LedgerEntry[]
}

export function defaultLedgerCategories(): LedgerCategory[] {
  return [
    { id: 'food', label: '식비', emoji: '🍽️', sortOrder: 0, scope: 'expense' },
    { id: 'transport', label: '교통', emoji: '🚆', sortOrder: 1, scope: 'expense' },
    { id: 'shopping', label: '쇼핑', emoji: '🛍️', sortOrder: 2, scope: 'expense' },
    { id: 'housing', label: '주거·공과', emoji: '🏠', sortOrder: 3, scope: 'expense' },
    { id: 'subscription', label: '구독', emoji: '📱', sortOrder: 4, scope: 'expense' },
    { id: 'health', label: '의료·건강', emoji: '💊', sortOrder: 5, scope: 'expense' },
    { id: 'entertainment', label: '문화·여가', emoji: '🎬', sortOrder: 6, scope: 'expense' },
    { id: 'travel_general', label: '여행·외출', emoji: '✈️', sortOrder: 7, scope: 'expense' },
    { id: 'other_exp', label: '기타 지출', emoji: '📌', sortOrder: 8, scope: 'expense' },
    { id: 'salary', label: '급여·수입', emoji: '💰', sortOrder: 10, scope: 'income' },
    { id: 'extra_income', label: '부수입', emoji: '✨', sortOrder: 11, scope: 'income' },
    { id: 'other_inc', label: '기타 수입', emoji: '📥', sortOrder: 12, scope: 'income' },
  ]
}

/** Travel 가계부 category 문자열 → 통합 카테고리 id */
const TRAVEL_CAT_MAP: Record<string, string> = {
  food: 'food',
  transport: 'transport',
  shopping: 'shopping',
  accommodation: 'housing',
  other: 'travel_general',
}

export function loadLedgerStore(): LedgerStore {
  try {
    const raw = localStorage.getItem(ACCOUNT_LEDGER_KEY)
    if (!raw) {
      return { version: 1, categories: defaultLedgerCategories(), entries: [] }
    }
    const p = JSON.parse(raw) as LedgerStore
    if (p.version !== 1 || !Array.isArray(p.categories) || !Array.isArray(p.entries)) {
      return { version: 1, categories: defaultLedgerCategories(), entries: [] }
    }
    if (p.categories.length === 0) p.categories = defaultLedgerCategories()
    return p
  } catch {
    return { version: 1, categories: defaultLedgerCategories(), entries: [] }
  }
}

export function saveLedgerStore(s: LedgerStore) {
  try {
    localStorage.setItem(ACCOUNT_LEDGER_KEY, JSON.stringify(s))
    kvSet(ACCOUNT_LEDGER_KEY, s)
  } catch { /* ignore */ }
}

export function upsertLedgerEntry(
  store: LedgerStore,
  patch: Omit<LedgerEntry, 'createdAt' | 'updatedAt'> & { id?: string },
): LedgerStore {
  const id = patch.id ?? `le_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const now = new Date().toISOString()
  const existing = store.entries.find(e => e.id === id)
  const createdAt = existing?.createdAt ?? now
  const next: LedgerEntry = {
    ...patch,
    id,
    createdAt,
    updatedAt: now,
  }
  const idx = store.entries.findIndex(e => e.id === id)
  const entries = idx >= 0 ? store.entries.map((e, i) => (i === idx ? next : e)) : [next, ...store.entries]
  return { ...store, entries }
}

export function activeLedgerEntries(entries: LedgerEntry[]): LedgerEntry[] {
  return entries.filter(e => e.is_deleted !== true)
}

export function deleteLedgerEntry(store: LedgerStore, id: string): LedgerStore {
  const now = new Date().toISOString()
  return {
    ...store,
    entries: store.entries.map(e =>
      e.id === id ? { ...e, is_deleted: true, updatedAt: now } : e,
    ),
  }
}

export function restoreLedgerEntry(store: LedgerStore, id: string): LedgerStore {
  const now = new Date().toISOString()
  return {
    ...store,
    entries: store.entries.map(e => {
      if (e.id !== id) return e
      const { is_deleted: _d, ...rest } = e
      return { ...rest, updatedAt: now } as LedgerEntry
    }),
  }
}

export function purgeLedgerEntry(store: LedgerStore, id: string): LedgerStore {
  return { ...store, entries: store.entries.filter(e => e.id !== id) }
}

export function updateLedgerCategories(store: LedgerStore, categories: LedgerCategory[]): LedgerStore {
  return { ...store, categories: [...categories].sort((a, b) => a.sortOrder - b.sortOrder) }
}

/** 로컬 Travel 상세 전체 (expenses만 사용) */
export function loadAllTripDetailsRaw(): Record<string, { expenses?: Array<{ id: string; date: string; category: string; usage: string; amount: number }> }> {
  try {
    const raw = localStorage.getItem(TRAVEL_TRIP_DETAIL_KEY)
    if (!raw) return {}
    const all = JSON.parse(raw) as Record<string, { expenses?: unknown[] }>
    const out: Record<string, { expenses?: Array<{ id: string; date: string; category: string; usage: string; amount: number }> }> = {}
    for (const tripId of Object.keys(all)) {
      const ex = all[tripId]?.expenses
      if (!Array.isArray(ex)) continue
      out[tripId] = {
        expenses: ex.map(e => {
          const x = e as Record<string, unknown>
          return {
            id: String(x.id ?? ''),
            date: String(x.date ?? '').slice(0, 10),
            category: typeof x.category === 'string' ? x.category : String(x.category ?? 'other'),
            usage: String(x.usage ?? ''),
            amount: typeof x.amount === 'number' ? x.amount : Number(x.amount) || 0,
          }
        }),
      }
    }
    return out
  } catch {
    return {}
  }
}

function travelDedupKey(tripId: string, expenseId: string) {
  return `travel:${tripId}:${expenseId}`
}

export function hasTravelImport(store: LedgerStore, tripId: string, travelExpenseId: string): boolean {
  const key = travelDedupKey(tripId, travelExpenseId)
  return store.entries.some(e => {
    if (e.source.kind !== 'travel') return false
    return e.source.tripId === tripId && e.source.travelExpenseId === travelExpenseId
  })
}

/**
 * 한 여행의 지출을 통합 가계부로 가져오기 (이미 있으면 스킵)
 */
export function importTravelTripExpenses(
  store: LedgerStore,
  tripId: string,
  tripLabel: string,
  expenses: Array<{ id: string; date: string; category: string; usage: string; amount: number }>,
): { next: LedgerStore; added: number; skipped: number } {
  let added = 0
  let skipped = 0
  let next = store
  for (const ex of expenses) {
    if (!ex.id) {
      skipped++
      continue
    }
    if (hasTravelImport(next, tripId, ex.id)) {
      skipped++
      continue
    }
    const catId = TRAVEL_CAT_MAP[ex.category] ?? 'travel_general'
    const memo = `[Travel] ${tripLabel}${ex.usage ? ` · ${ex.usage}` : ''}`.trim()
    next = upsertLedgerEntry(next, {
      date: ex.date.slice(0, 10),
      amount: Math.abs(ex.amount),
      flow: 'expense',
      categoryId: catId,
      memo,
      tags: ['travel', tripId],
      source: { kind: 'travel', tripId, tripLabel, travelExpenseId: ex.id },
    })
    added++
  }
  saveLedgerStore(next)
  return { next, added, skipped }
}

/**
 * 로컬에 저장된 모든 여행 상세에서 일괄 가져오기
 */
export function importAllTravelExpensesFromLocal(
  store: LedgerStore,
  tripLabels: Record<string, string>,
): { next: LedgerStore; added: number; skipped: number } {
  const all = loadAllTripDetailsRaw()
  let next = store
  let added = 0
  let skipped = 0
  for (const tripId of Object.keys(all)) {
    const expenses = all[tripId]?.expenses ?? []
    const label = tripLabels[tripId] ?? tripId
    const r = importTravelTripExpenses(next, tripId, label, expenses)
    next = r.next
    added += r.added
    skipped += r.skipped
  }
  return { next, added, skipped }
}

export function categoryLabel(store: LedgerStore, id: string): string {
  return store.categories.find(c => c.id === id)?.label ?? id
}

export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7)
}

/** 특정 일자 지출 합계 (가계부 대시보드용) */
export function ledgerDayExpenseTotal(store: LedgerStore, ymd: string): number {
  let sum = 0
  for (const e of store.entries) {
    if (e.date !== ymd.slice(0, 10)) continue
    if (e.flow === 'expense') sum += e.amount
  }
  return sum
}

export function summarizeMonth(entries: LedgerEntry[], yyyymm: string): { expense: number; income: number } {
  let expense = 0
  let income = 0
  for (const e of entries) {
    if (!e.date.startsWith(yyyymm)) continue
    if (e.flow === 'expense') expense += e.amount
    else income += e.amount
  }
  return { expense, income }
}
