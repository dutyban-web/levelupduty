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
  /** 휴지통(소프트 삭제) */
  is_deleted?: boolean
  title: string
  body: string
  /** 도착일 — 이 날짜에 통합 캘린더에 표시 */
  openDate: string
  /** 도착 시각 (로컬) HH:mm — 기본 00:00 */
  openTime?: string
  direction: SpacetimeDirection
  /** true: 도착일·시각 전에는 내용 열람 불가 */
  lockUntilOpen: boolean
  createdAt: string
  updatedAt: string
}

/** 타임캡슐 — 설정한 시각이 되기 전까지 본문 열람 불가 */
export type QuantumTimebox = {
  id: string
  title: string
  body: string
  /** 이 ISO 시각 이후에 열람 가능 */
  unlockAt: string
  createdAt: string
  updatedAt: string
}

export type QuantumFlowStore = {
  letters: QuantumLetter[]
  /** 보관함 비밀번호(SHA-256 hex) — 미설정이면 먼저 설정 필요 */
  vaultPwHashToFuture?: string | null
  vaultPwHashToPast?: string | null
  /** 타임캡슐 영역 비밀번호(SHA-256 hex) */
  vaultPwHashTimebox?: string | null
  timeboxes: QuantumTimebox[]
}

export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 오늘 날짜 문자열과 비교 — openDate <= today 이면 '날짜상 도착일 도달' (시간 미반영, 레거시·표시용) */
export function isOpenDayReached(openDate: string, todayYmd: string): boolean {
  return openDate <= todayYmd
}

export function normalizeOpenTime(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '00:00'
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return '00:00'
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)))
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)))
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** 도착일+도착시각(로컬) 기준 열림 여부 */
export function hasLetterArrived(letter: QuantumLetter, now: Date = new Date()): boolean {
  const t = normalizeOpenTime(letter.openTime)
  const [hh, mm] = t.split(':').map(Number)
  const [y, mo, d] = letter.openDate.split('-').map(Number)
  if (!y || !mo || !d) return false
  const target = new Date(y, mo - 1, d, hh, mm, 0, 0)
  return now.getTime() >= target.getTime()
}

/** 잠금 시 열람 가능 여부 — ref 시각(기본: 지금)이 도착 시각 이후인지 */
export function canReadLetter(letter: QuantumLetter, ref: Date = new Date()): boolean {
  if (!letter.lockUntilOpen) return true
  return hasLetterArrived(letter, ref)
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function migrateLetter(l: QuantumLetter): QuantumLetter {
  return {
    ...l,
    openTime: normalizeOpenTime(l.openTime),
  }
}

export function loadQuantumFlowStore(): QuantumFlowStore {
  try {
    const raw = localStorage.getItem(QUANTUM_FLOW_KEY)
    if (!raw) return { letters: [], timeboxes: [] }
    const p = JSON.parse(raw) as QuantumFlowStore
    if (!p.letters || !Array.isArray(p.letters)) return { letters: [], timeboxes: [] }
    return {
      letters: p.letters.map(migrateLetter),
      vaultPwHashToFuture: p.vaultPwHashToFuture ?? null,
      vaultPwHashToPast: p.vaultPwHashToPast ?? null,
      vaultPwHashTimebox: p.vaultPwHashTimebox ?? null,
      timeboxes: Array.isArray(p.timeboxes) ? p.timeboxes : [],
    }
  } catch {
    return { letters: [], timeboxes: [] }
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
    openTime: normalizeOpenTime(letter.openTime),
    createdAt,
    updatedAt: now,
  }
  const idx = store.letters.findIndex(l => l.id === id)
  const letters = idx >= 0 ? store.letters.map((l, i) => (i === idx ? next : l)) : [...store.letters, next]
  return { ...store, letters }
}

export function activeLetters(letters: QuantumLetter[]): QuantumLetter[] {
  return letters.filter(l => l.is_deleted !== true)
}

export function deleteLetter(store: QuantumFlowStore, id: string): QuantumFlowStore {
  const now = new Date().toISOString()
  return {
    ...store,
    letters: store.letters.map(l =>
      l.id === id ? { ...l, is_deleted: true, updatedAt: now } : l,
    ),
  }
}

export function restoreLetter(store: QuantumFlowStore, id: string): QuantumFlowStore {
  const now = new Date().toISOString()
  return {
    ...store,
    letters: store.letters.map(l => {
      if (l.id !== id) return l
      const { is_deleted: _d, ...rest } = l
      return { ...rest, updatedAt: now } as QuantumLetter
    }),
  }
}

export function purgeLetter(store: QuantumFlowStore, id: string): QuantumFlowStore {
  return { ...store, letters: store.letters.filter(l => l.id !== id) }
}

export type VaultKind = 'to_future' | 'to_past' | 'timebox'

export function setVaultPasswordHash(
  store: QuantumFlowStore,
  which: VaultKind,
  hash: string | null,
): QuantumFlowStore {
  if (which === 'to_future') return { ...store, vaultPwHashToFuture: hash }
  if (which === 'to_past') return { ...store, vaultPwHashToPast: hash }
  return { ...store, vaultPwHashTimebox: hash }
}

export function isTimeboxUnlocked(tb: QuantumTimebox, now: Date = new Date()): boolean {
  const t = new Date(tb.unlockAt).getTime()
  if (Number.isNaN(t)) return true
  return now.getTime() >= t
}

export function upsertTimebox(
  store: QuantumFlowStore,
  item: Omit<QuantumTimebox, 'createdAt' | 'updatedAt'> & { id?: string },
): QuantumFlowStore {
  const id = item.id ?? `qt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const nowIso = new Date().toISOString()
  const existing = store.timeboxes.find(t => t.id === id)
  const createdAt = existing?.createdAt ?? nowIso
  const row: QuantumTimebox = { ...item, id, createdAt, updatedAt: nowIso }
  const idx = store.timeboxes.findIndex(t => t.id === id)
  const timeboxes = idx >= 0 ? store.timeboxes.map((t, i) => (i === idx ? row : t)) : [...store.timeboxes, row]
  return { ...store, timeboxes }
}

export function deleteTimebox(store: QuantumFlowStore, id: string): QuantumFlowStore {
  return { ...store, timeboxes: store.timeboxes.filter(t => t.id !== id) }
}

/** 편지함 카드에서 도착까지 간격에 곱해 표시하는 배율(×값). 필요 시 숫자만 바꾸면 됩니다. */
export const QUANTUM_LETTER_RELATIVE_SCALE = 1

function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return new Date(NaN)
  return new Date(y, m - 1, d)
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** 두 날짜(로컬 달력일) 사이의 일 수 */
export function calendarDaysBetweenUtc(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((ub - ua) / 86400000)
}

/** yy.m.d */
export function formatShortYmd(d: Date): string {
  if (Number.isNaN(d.getTime())) return '—'
  const y = String(d.getFullYear()).slice(-2)
  return `${y}.${d.getMonth() + 1}.${d.getDate()}`
}

/** yy.m.d HH:mm — 발송 시각 */
export function formatSentDateTime(d: Date): string {
  if (Number.isNaN(d.getTime())) return '—'
  const y = String(d.getFullYear()).slice(-2)
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${d.getMonth() + 1}.${d.getDate()} ${h}:${min}`
}

/** 지금 기준으로 얼마 전에 보냈는지 */
export function formatSentAgoFromNow(createdAtIso: string, now: Date = new Date()): string {
  const sent = new Date(createdAtIso)
  if (Number.isNaN(sent.getTime())) return '발송 시각 불명'
  const diffMs = now.getTime() - sent.getTime()
  if (diffMs < 0) return '방금 보냄'
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return '방금 보냄'
  if (mins < 60) return `${mins}분 전에 보냄`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전에 보냄`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전에 보냄`
  if (days < 30) return `${days}일 전에 보냄`
  const months = Math.floor(days / 30)
  if (days < 365) return `약 ${months}달 전에 보냄`
  const years = Math.floor(days / 365)
  return `약 ${years}년 전에 보냄`
}

/** 발송일~도착일 사이 간격을 한글로 (괄호 안 표시용) */
export function humanizeSendToOpenGapDays(totalDays: number): string {
  let d = Math.max(0, Math.floor(totalDays))
  if (d === 0) return '0일'
  if (d < 31) return `${d}일`
  const y = Math.floor(d / 365)
  let rem = d - y * 365
  const mo = Math.floor(rem / 30)
  rem = rem - mo * 30
  const parts: string[] = []
  if (y > 0) parts.push(`${y}년`)
  if (mo > 0) parts.push(`${mo}달`)
  if (rem > 0 || parts.length === 0) parts.push(`${rem}일`)
  return parts.join(' ')
}

/**
 * 미래의 나에게: `26.3.19 과거 (3일×1 전의) 내가 보낸 편지`
 * 과거의 나에게: `26.3.22 미래 (1년 2달 3일×1 후의) 내가 보낸 편지`
 */
export function formatSpacetimeMailboxNarrative(
  letter: QuantumLetter,
  scale: number = QUANTUM_LETTER_RELATIVE_SCALE,
): string {
  const sent = new Date(letter.createdAt)
  const sendShort = formatShortYmd(sent)
  const openDay = startOfLocalDay(parseYmdLocal(letter.openDate))
  const sendDay = startOfLocalDay(sent)
  let gapDays: number
  if (letter.direction === 'to_future') {
    gapDays = Math.abs(calendarDaysBetweenUtc(sendDay, openDay))
  } else {
    gapDays = Math.abs(calendarDaysBetweenUtc(openDay, sendDay))
  }
  const gapText = humanizeSendToOpenGapDays(gapDays)
  const scaled = `${gapText}×${scale}`
  if (letter.direction === 'to_future') {
    return `${sendShort} 과거 (${scaled} 전의) 내가 보낸 편지`
  }
  return `${sendShort} 미래 (${scaled} 후의) 내가 보낸 편지`
}
