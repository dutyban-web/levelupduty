/**
 * Network — 인적자원 명부 (로컬 저장, 추후 Supabase 연동 가능)
 */

export const NETWORK_STORE_KEY = 'creative-os-network-contacts-v1'

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
  /** 그 사람 주변 네트워크(누구와 연결될 수 있는지 등) */
  theirNetwork: string
  /** 나에게 어떤 식으로 이롭게 작용할 수 있는지 */
  valueToMe: string
  benefits: NetworkBenefitId[]
  /** 관계·접근 용이성 등 1~5 */
  strength: number
  memo: string
  createdAt: string
  updatedAt: string
}

export type NetworkStore = { contacts: NetworkContact[] }

function nowIso() {
  return new Date().toISOString()
}

export function newContactId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `nw-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function loadNetworkStore(): NetworkStore {
  try {
    const raw = localStorage.getItem(NETWORK_STORE_KEY)
    if (!raw) return { contacts: [] }
    const p = JSON.parse(raw) as NetworkStore
    if (!p || !Array.isArray(p.contacts)) return { contacts: [] }
    return { contacts: p.contacts.filter(c => c && typeof c.id === 'string' && typeof c.name === 'string') }
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
  row: Omit<NetworkContact, 'createdAt' | 'updatedAt'> & { id?: string },
): NetworkStore {
  const t = nowIso()
  const id = row.id ?? newContactId()
  const existing = store.contacts.find(c => c.id === id)
  const next: NetworkContact = {
    id,
    name: row.name.trim(),
    roleTitle: row.roleTitle?.trim() ?? '',
    org: row.org?.trim() ?? '',
    relationship: row.relationship?.trim() ?? '',
    theirNetwork: row.theirNetwork?.trim() ?? '',
    valueToMe: row.valueToMe?.trim() ?? '',
    benefits: Array.isArray(row.benefits) ? row.benefits : [],
    strength: typeof row.strength === 'number' && row.strength >= 1 && row.strength <= 5 ? row.strength : 3,
    memo: row.memo?.trim() ?? '',
    createdAt: existing?.createdAt ?? t,
    updatedAt: t,
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
