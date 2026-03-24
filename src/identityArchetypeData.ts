/**
 * 4대 원형(분석가·창작자·자본가·모험가) — Identity 이름 기반 분류 + 로컬 오버라이드
 */
import { kvSet } from './lib/supabase'

export const IDENTITY_ARCHETYPE_KEY = 'bl_identity_archetype_v1'

export type IdentityArchetype = 'analyst' | 'creator' | 'capitalist' | 'adventurer'

export const ARCHETYPE_LABEL: Record<IdentityArchetype, { label: string; emoji: string; blurb: string }> = {
  analyst: { label: '분석가', emoji: '🔍', blurb: '데이터·구조·기획' },
  creator: { label: '창작자', emoji: '✒️', blurb: '글·그림·서사' },
  capitalist: { label: '자본가', emoji: '💹', blurb: '수익·운영·전략' },
  adventurer: { label: '모험가', emoji: '🗡️', blurb: '도전·탐험·새 영역' },
}

const ANALYST_RE = /분석|기획|리서치|데이터|연구|전략|기획자|analyst|editor/i
const CREATOR_RE = /작가|만화|소설|웹툰|창작|글|그림|시나리오|원고|creator|illust/i
const CAPITALIST_RE = /사업|자본|투자|운영|매출|경영|ceo|사장|capital|biz/i
const ADVENTURER_RE = /모험|모험가|여행|도전|탐험|새로|외부|advent|scout/i

export function inferArchetypeFromIdentityName(name: string): IdentityArchetype {
  const s = name.trim()
  if (!s) return 'creator'
  if (ANALYST_RE.test(s)) return 'analyst'
  if (CAPITALIST_RE.test(s)) return 'capitalist'
  if (ADVENTURER_RE.test(s)) return 'adventurer'
  if (CREATOR_RE.test(s)) return 'creator'
  return 'creator'
}

export function loadArchetypeOverrides(): Partial<Record<string, IdentityArchetype>> {
  try {
    const raw = localStorage.getItem(IDENTITY_ARCHETYPE_KEY)
    if (!raw) return {}
    const p = JSON.parse(raw) as Record<string, string>
    if (!p || typeof p !== 'object') return {}
    const out: Partial<Record<string, IdentityArchetype>> = {}
    for (const [k, v] of Object.entries(p)) {
      if (v === 'analyst' || v === 'creator' || v === 'capitalist' || v === 'adventurer') out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

export function saveArchetypeOverride(identityId: string, arch: IdentityArchetype): void {
  const cur = loadArchetypeOverrides()
  cur[identityId] = arch
  try {
    localStorage.setItem(IDENTITY_ARCHETYPE_KEY, JSON.stringify(cur))
    void kvSet(IDENTITY_ARCHETYPE_KEY, cur)
  } catch {
    /* quota */
  }
}

export function resolveIdentityArchetype(identityId: string, name: string): IdentityArchetype {
  const o = loadArchetypeOverrides()[identityId]
  if (o) return o
  return inferArchetypeFromIdentityName(name)
}

export function identitiesForArchetype<T extends { id: string; name: string }>(
  list: T[],
  arch: IdentityArchetype,
): T[] {
  return list.filter(i => resolveIdentityArchetype(i.id, i.name) === arch)
}
