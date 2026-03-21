/**
 * Network — 인적자원 명부
 * - v1: 로컬(localStorage) 단일 스토어
 * - Supabase 전용 테이블은 없음 → 연락처/본문은 KV·로컬, 히스토리 날짜는 calendar_events(event)로 동기화
 */

export const NETWORK_STORE_KEY = 'creative-os-network-contacts-v1'

/** 히스토리 한 줄 (만남·사건) — 통합 캘린더와 연동 시 syncedCalendarEventId 보관 */
export type NetworkHistoryEntry = {
  id: string
  date: string
  title: string
  summary: string
  /** Supabase calendar_events.id (event_type=event) */
  syncedCalendarEventId?: string
}

/** 내게 이롭게 작용할 수 있는 방식 (다중 선택) */
export type NetworkBenefitId =
  | 'intro'
  | 'advice'
  | 'collab'
  | 'info'
  | 'emotional'
  | 'resource'
  | 'reputation'

export const BENEFIT_OPTIONS: { id: NetworkBenefitId; label: string; short: string; emoji: string }[] = [
  { id: 'intro', label: '연결·소개', short: '소개', emoji: '🔗' },
  { id: 'advice', label: '조언·멘토', short: '조언', emoji: '💡' },
  { id: 'collab', label: '협업·프로젝트', short: '협업', emoji: '🤝' },
  { id: 'info', label: '정보·인사이트', short: '정보', emoji: '📰' },
  { id: 'emotional', label: '정서·응원', short: '응원', emoji: '💜' },
  { id: 'resource', label: '자원·실무', short: '자원', emoji: '🏗️' },
  { id: 'reputation', label: '신뢰·평판', short: '신뢰', emoji: '⭐' },
]

export type NetworkContact = {
  id: string
  name: string
  /** 직함·역할 */
  roleTitle: string
  /** 소속 */
  org: string
  /** 어떻게 아는 사람인지 */
  relationship: string
  /** 그 사람 주변 네트워크 */
  theirNetwork: string
  /** 나에게 어떤 식으로 이롭게 작용할 수 있는지 (레거시 요약) */
  valueToMe: string
  benefits: NetworkBenefitId[]
  /** 관계·접근 용이성 등 1~5 */
  strength: number
  /** 레거시 짧은 메모 — 본문 에디터 도입 전 데이터 */
  memo: string
  createdAt: string
  updatedAt: string

  // ── v2 상세 속성 (없으면 빈 문자열·빈 배열로 마이그레이션) ──
  phone: string
  email: string
  /** 블로그·SNS 등 링크 (한 줄 또는 여러 개 줄바꿈) */
  links: string
  /** 핵심 전문 분야 키워드 */
  expertise: string
  /** 가치관/철학 */
  valuesPhilosophy: string
  /** 상대의 욕망·니즈 */
  theirNeeds: string
  /** 내가 줄 수 있는 것 */
  myContribution: string
  /** 인적자원 활용 시너지 포인트 */
  synergyPoint: string
  /** 다음 액션 플랜 */
  nextActionPlan: string
  /** 첫 만남·특별한 추억 */
  firstMeetingMemory: string
  /** 갈등 기록 */
  conflictNotes: string
  /** 생일 YYYY-MM-DD */
  birthday: string
  /** 기념일 메모 */
  anniversaryNote: string
  /** 최근 연락일 YYYY-MM-DD */
  lastContactDate: string
  /** 최근 연락 요약 */
  lastContactSummary: string
  giveHelp: string
  receiveHelp: string
  /** 감동 포인트·TMI */
  tmi: string
  /** BlockNote 본문 JSON.stringify(PartialBlock[]) */
  bodyBlocksJson: string
  historyEntries: NetworkHistoryEntry[]
}

export type NetworkStore = { contacts: NetworkContact[] }

function nowIso() {
  return new Date().toISOString()
}

export function newContactId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `nw-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function newHistoryId(): string {
  return `nh-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function migrateContact(raw: Record<string, unknown>): NetworkContact | null {
  if (!raw || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null
  const benefits = Array.isArray(raw.benefits) ? (raw.benefits as NetworkBenefitId[]).filter(b => BENEFIT_OPTIONS.some(o => o.id === b)) : []
  const strength = typeof raw.strength === 'number' && raw.strength >= 1 && raw.strength <= 5 ? raw.strength : 3
  const str = (k: string) => (typeof raw[k] === 'string' ? (raw[k] as string) : '')
  const historyRaw = raw.historyEntries
  let historyEntries: NetworkHistoryEntry[] = []
  if (Array.isArray(historyRaw)) {
    historyEntries = historyRaw
      .filter((h): h is NetworkHistoryEntry =>
        h != null && typeof h === 'object' && typeof (h as NetworkHistoryEntry).id === 'string' && typeof (h as NetworkHistoryEntry).date === 'string',
      )
      .map(h => ({
        id: h.id,
        date: h.date,
        title: typeof h.title === 'string' ? h.title : '',
        summary: typeof h.summary === 'string' ? h.summary : '',
        syncedCalendarEventId: typeof h.syncedCalendarEventId === 'string' ? h.syncedCalendarEventId : undefined,
      }))
  }
  return {
    id: raw.id as string,
    name: (raw.name as string).trim() || '이름 없음',
    roleTitle: str('roleTitle'),
    org: str('org'),
    relationship: str('relationship'),
    theirNetwork: str('theirNetwork'),
    valueToMe: str('valueToMe'),
    benefits,
    strength,
    memo: str('memo'),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : nowIso(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : nowIso(),
    phone: str('phone'),
    email: str('email'),
    links: str('links'),
    expertise: str('expertise'),
    valuesPhilosophy: str('valuesPhilosophy'),
    theirNeeds: str('theirNeeds'),
    myContribution: str('myContribution'),
    synergyPoint: str('synergyPoint'),
    nextActionPlan: str('nextActionPlan'),
    firstMeetingMemory: str('firstMeetingMemory'),
    conflictNotes: str('conflictNotes'),
    birthday: str('birthday'),
    anniversaryNote: str('anniversaryNote'),
    lastContactDate: str('lastContactDate'),
    lastContactSummary: str('lastContactSummary'),
    giveHelp: str('giveHelp'),
    receiveHelp: str('receiveHelp'),
    tmi: str('tmi'),
    bodyBlocksJson: str('bodyBlocksJson'),
    historyEntries,
  }
}

export function loadNetworkStore(): NetworkStore {
  try {
    const raw = localStorage.getItem(NETWORK_STORE_KEY)
    if (!raw) return { contacts: [] }
    const p = JSON.parse(raw) as NetworkStore
    if (!p || !Array.isArray(p.contacts)) return { contacts: [] }
    const contacts = p.contacts.map(c => migrateContact(c as Record<string, unknown>)).filter((x): x is NetworkContact => x != null)
    return { contacts }
  } catch {
    return { contacts: [] }
  }
}

export function saveNetworkStore(s: NetworkStore): void {
  try {
    localStorage.setItem(NETWORK_STORE_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

export function upsertContact(
  store: NetworkStore,
  row: Partial<Omit<NetworkContact, 'createdAt' | 'updatedAt'>> & { id?: string; name: string },
): NetworkStore {
  const t = nowIso()
  const id = row.id ?? newContactId()
  const existing = store.contacts.find(c => c.id === id)
  const next: NetworkContact = {
    id,
    name: row.name.trim(),
    roleTitle: row.roleTitle?.trim() ?? existing?.roleTitle ?? '',
    org: row.org?.trim() ?? existing?.org ?? '',
    relationship: row.relationship?.trim() ?? existing?.relationship ?? '',
    theirNetwork: row.theirNetwork?.trim() ?? existing?.theirNetwork ?? '',
    valueToMe: row.valueToMe?.trim() ?? existing?.valueToMe ?? '',
    benefits: Array.isArray(row.benefits) ? row.benefits : (existing?.benefits ?? []),
    strength: typeof row.strength === 'number' && row.strength >= 1 && row.strength <= 5 ? row.strength : (existing?.strength ?? 3),
    memo: row.memo?.trim() ?? existing?.memo ?? '',
    createdAt: existing?.createdAt ?? t,
    updatedAt: t,
    phone: row.phone?.trim() ?? existing?.phone ?? '',
    email: row.email?.trim() ?? existing?.email ?? '',
    links: row.links?.trim() ?? existing?.links ?? '',
    expertise: row.expertise?.trim() ?? existing?.expertise ?? '',
    valuesPhilosophy: row.valuesPhilosophy?.trim() ?? existing?.valuesPhilosophy ?? '',
    theirNeeds: row.theirNeeds?.trim() ?? existing?.theirNeeds ?? '',
    myContribution: row.myContribution?.trim() ?? existing?.myContribution ?? '',
    synergyPoint: row.synergyPoint?.trim() ?? existing?.synergyPoint ?? '',
    nextActionPlan: row.nextActionPlan?.trim() ?? existing?.nextActionPlan ?? '',
    firstMeetingMemory: row.firstMeetingMemory?.trim() ?? existing?.firstMeetingMemory ?? '',
    conflictNotes: row.conflictNotes?.trim() ?? existing?.conflictNotes ?? '',
    birthday: row.birthday?.trim() ?? existing?.birthday ?? '',
    anniversaryNote: row.anniversaryNote?.trim() ?? existing?.anniversaryNote ?? '',
    lastContactDate: row.lastContactDate?.trim() ?? existing?.lastContactDate ?? '',
    lastContactSummary: row.lastContactSummary?.trim() ?? existing?.lastContactSummary ?? '',
    giveHelp: row.giveHelp?.trim() ?? existing?.giveHelp ?? '',
    receiveHelp: row.receiveHelp?.trim() ?? existing?.receiveHelp ?? '',
    tmi: row.tmi?.trim() ?? existing?.tmi ?? '',
    bodyBlocksJson: row.bodyBlocksJson !== undefined ? row.bodyBlocksJson : (existing?.bodyBlocksJson ?? ''),
    historyEntries: Array.isArray(row.historyEntries) ? row.historyEntries : (existing?.historyEntries ?? []),
  }
  const others = store.contacts.filter(c => c.id !== id)
  return { contacts: [next, ...others] }
}

export function deleteContact(store: NetworkStore, id: string): NetworkStore {
  return { contacts: store.contacts.filter(c => c.id !== id) }
}

/** 혜택별 인원 수 (한눈에 패널용) */
export function countByBenefit(contacts: NetworkContact[]): Record<NetworkBenefitId, number> {
  const init = {} as Record<NetworkBenefitId, number>
  for (const o of BENEFIT_OPTIONS) init[o.id] = 0
  for (const c of contacts) {
    for (const b of c.benefits) {
      if (b in init) init[b]++
    }
  }
  return init
}
