/**
 * 스킬 트리 — bl_skill_tree_v1
 * v1: 맵 구역 6분기(branchXp)
 * v2: + 4대 원형(archetypeXp) · 방사형 시각화 · 보스 레이드 보정
 */
import { kvSet } from './lib/supabase'
import { detectMapZone, type MapZoneId } from './mapHubZones'
import type { IdentityArchetype } from './identityArchetypeData'

export const SKILL_TREE_KEY = 'bl_skill_tree_v1'
export const BL_SKILL_TREE_SYNC = 'bl-skill-tree-sync'

export type SkillBranchId = 'creation' | 'engineering' | 'commerce' | 'bonds' | 'body' | 'spirit'

export type SkillTreeStateV1 = {
  version: 1
  branchXp: Record<SkillBranchId, number>
}

export type SkillTreeState = {
  version: 2
  branchXp: Record<SkillBranchId, number>
  archetypeXp: Record<IdentityArchetype, number>
}

export const ARCHETYPE_ORDER: IdentityArchetype[] = ['analyst', 'creator', 'capitalist', 'adventurer']

export const ARCHETYPE_SKILL_BRANCH: {
  id: IdentityArchetype
  label: string
  emoji: string
  accent: string
}[] = [
  { id: 'analyst', label: '분석가', emoji: '🔍', accent: '#38bdf8' },
  { id: 'creator', label: '창작자', emoji: '✒️', accent: '#4ade80' },
  { id: 'capitalist', label: '자본가', emoji: '💹', accent: '#fbbf24' },
  { id: 'adventurer', label: '모험가', emoji: '🗡️', accent: '#f472b6' },
]

export const ARCHETYPE_NODES: Record<IdentityArchetype, { tier: number; title: string; flavor: string }[]> = {
  analyst: [
    { tier: 1, title: '관찰', flavor: '패턴을 읽는다' },
    { tier: 2, title: '분해', flavor: '구조가 보인다' },
    { tier: 3, title: '모델', flavor: '가설이 선다' },
    { tier: 4, title: '검증', flavor: '데이터가 말한다' },
    { tier: 5, title: '통찰', flavor: '한 줄로 요약된다' },
  ],
  creator: [
    { tier: 1, title: '씨앗', flavor: '문장이 싹튼다' },
    { tier: 2, title: '장면', flavor: '갈등이 숨 쉰다' },
    { tier: 3, title: '호흡', flavor: '리듬이 이어진다' },
    { tier: 4, title: '세계', flavor: '독자가 머문다' },
    { tier: 5, title: '완성', flavor: '작품이 닫힌다' },
  ],
  capitalist: [
    { tier: 1, title: '감각', flavor: '흐름을 읽는다' },
    { tier: 2, title: '장부', flavor: '숫자가 쌓인다' },
    { tier: 3, title: '거래', flavor: '가치가 오간다' },
    { tier: 4, title: '브랜드', flavor: '신뢰가 굳는다' },
    { tier: 5, title: '반석', flavor: '생계가 버틴다' },
  ],
  adventurer: [
    { tier: 1, title: '첫발', flavor: '문지방을 넘는다' },
    { tier: 2, title: '길', flavor: '지도가 생긴다' },
    { tier: 3, title: '시련', flavor: '넘어져도 일어선다' },
    { tier: 4, title: '전리품', flavor: '경험이 남는다' },
    { tier: 5, title: '전설', flavor: '이야기가 된다' },
  ],
}

export const SKILL_BRANCHES: {
  id: SkillBranchId
  label: string
  emoji: string
  accent: string
  blurb: string
}[] = [
  { id: 'creation', label: '창작', emoji: '✒️', accent: '#4ade80', blurb: '글·그림·서사' },
  { id: 'engineering', label: '공학', emoji: '⚙️', accent: '#60a5fa', blurb: '코드·시스템·도구' },
  { id: 'commerce', label: '생계', emoji: '💹', accent: '#fbbf24', blurb: '수익·운영·전략' },
  { id: 'bonds', label: '관계', emoji: '💬', accent: '#f472b6', blurb: '사람·약속·신뢰' },
  { id: 'body', label: '신체', emoji: '💪', accent: '#fb923c', blurb: '운동·수면·에너지' },
  { id: 'spirit', label: '마음', emoji: '✨', accent: '#a78bfa', blurb: '균형·성찰·메타' },
]

export const BRANCH_NODES: Record<
  SkillBranchId,
  { tier: number; title: string; flavor: string }[]
> = {
  creation: [
    { tier: 1, title: '문장의 씨앗', flavor: '첫 문장을 믿는다' },
    { tier: 2, title: '장면의 뿌리', flavor: '갈등이 숨 쉰다' },
    { tier: 3, title: '서사의 줄기', flavor: '호흡이 이어진다' },
    { tier: 4, title: '세계의 가지', flavor: '독자가 머문다' },
    { tier: 5, title: '완성의 열매', flavor: '작품이 끝을 맺는다' },
  ],
  engineering: [
    { tier: 1, title: '회로의 불꽃', flavor: '빌드가 통과한다' },
    { tier: 2, title: '모듈의 장벽', flavor: '경계가 선명한다' },
    { tier: 3, title: '시스템의 심장', flavor: '데이터가 흐른다' },
    { tier: 4, title: '확장의 탑', flavor: '부하를 견딘다' },
    { tier: 5, title: '완성의 요새', flavor: '도구가 사람을 돕는다' },
  ],
  commerce: [
    { tier: 1, title: '시장의 기척', flavor: '수요를 읽는다' },
    { tier: 2, title: '흐름의 장부', flavor: '숫자가 말한다' },
    { tier: 3, title: '거래의 날개', flavor: '가치가 오간다' },
    { tier: 4, title: '브랜드의 방패', flavor: '신뢰가 쌓인다' },
    { tier: 5, title: '왕성의 반석', flavor: '생계가 버틴다' },
  ],
  bonds: [
    { tier: 1, title: '눈맞춤', flavor: '말보다 먼저' },
    { tier: 2, title: '약속의 다리', flavor: '시간을 존중한다' },
    { tier: 3, title: '공감의 거울', flavor: '감정이 반사된다' },
    { tier: 4, title: '연대의 띠', flavor: '함께 걷는다' },
    { tier: 5, title: '신뢰의 왕관', flavor: '관계가 자산이 된다' },
  ],
  body: [
    { tier: 1, title: '호흡', flavor: '리셋' },
    { tier: 2, title: '걸음', flavor: '리듬' },
    { tier: 3, title: '근력', flavor: '기초' },
    { tier: 4, title: '지구력', flavor: '지속' },
    { tier: 5, title: '완전', flavor: '몸이 따라온다' },
  ],
  spirit: [
    { tier: 1, title: '고요', flavor: '한 모금의 물' },
    { tier: 2, title: '성찰', flavor: '거울을 본다' },
    { tier: 3, title: '의도', flavor: '방향을 고른다' },
    { tier: 4, title: '확신', flavor: '흔들림이 줄어든다' },
    { tier: 5, title: '통합', flavor: '삶이 한 줄로' },
  ],
}

const XP_PER_TIER = 130

function defaultBranchXp(): Record<SkillBranchId, number> {
  return {
    creation: 0,
    engineering: 0,
    commerce: 0,
    bonds: 0,
    body: 0,
    spirit: 0,
  }
}

function defaultArchetypeXp(): Record<IdentityArchetype, number> {
  return { analyst: 0, creator: 0, capitalist: 0, adventurer: 0 }
}

function migrateV1ToV2(v1: SkillTreeStateV1): SkillTreeState {
  const bx = v1.branchXp
  const arch = defaultArchetypeXp()
  arch.creator += Math.round((bx.creation ?? 0) * 0.45)
  arch.analyst += Math.round((bx.engineering ?? 0) * 0.45)
  arch.capitalist += Math.round((bx.commerce ?? 0) * 0.45)
  arch.adventurer += Math.round(((bx.bonds ?? 0) + (bx.body ?? 0) + (bx.spirit ?? 0)) / 3)
  return { version: 2, branchXp: { ...defaultBranchXp(), ...bx }, archetypeXp: arch }
}

export function loadSkillTreeState(): SkillTreeState {
  try {
    const raw = localStorage.getItem(SKILL_TREE_KEY)
    if (!raw) {
      return { version: 2, branchXp: defaultBranchXp(), archetypeXp: defaultArchetypeXp() }
    }
    const p = JSON.parse(raw) as Partial<SkillTreeState> & Partial<SkillTreeStateV1>
    if (p.version === 2 && p.branchXp && p.archetypeXp) {
      const bx = defaultBranchXp()
      for (const k of Object.keys(bx) as SkillBranchId[]) {
        const v = (p.branchXp as Record<string, number>)[k]
        bx[k] = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0
      }
      const ax = defaultArchetypeXp()
      for (const k of ARCHETYPE_ORDER) {
        const v = (p.archetypeXp as Record<string, number>)[k]
        ax[k] = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0
      }
      return { version: 2, branchXp: bx, archetypeXp: ax }
    }
    if (p.version === 1 && p.branchXp && typeof p.branchXp === 'object') {
      const bx = defaultBranchXp()
      for (const k of Object.keys(bx) as SkillBranchId[]) {
        const v = (p.branchXp as Record<string, number>)[k]
        bx[k] = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0
      }
      return migrateV1ToV2({ version: 1, branchXp: bx })
    }
    return { version: 2, branchXp: defaultBranchXp(), archetypeXp: defaultArchetypeXp() }
  } catch {
    return { version: 2, branchXp: defaultBranchXp(), archetypeXp: defaultArchetypeXp() }
  }
}

export function saveSkillTreeState(next: SkillTreeState): void {
  try {
    localStorage.setItem(SKILL_TREE_KEY, JSON.stringify(next))
    void kvSet(SKILL_TREE_KEY, next)
    try {
      window.dispatchEvent(new CustomEvent(BL_SKILL_TREE_SYNC, { detail: { branch: null } }))
    } catch {
      /* ignore */
    }
  } catch {
    /* quota */
  }
}

export function tierForBranchXp(xp: number): number {
  const t = 1 + Math.floor(Math.max(0, xp) / XP_PER_TIER)
  return Math.min(5, Math.max(1, t))
}

export function tierForArchetypeXp(xp: number): number {
  return tierForBranchXp(xp)
}

export function xpProgressInTier(xp: number): { tier: number; pct: number; nextAt: number } {
  const tier = tierForBranchXp(xp)
  const base = (tier - 1) * XP_PER_TIER
  const nextAt = tier === 5 ? base + XP_PER_TIER : tier * XP_PER_TIER
  const span = XP_PER_TIER
  const pct = tier === 5 ? 1 : Math.min(1, (xp - base) / span)
  return { tier, pct, nextAt }
}

/** 방사형 차트용 0~100 정규화 (티어 중심) */
export function archetypeRadarValue(xp: number): number {
  const tier = tierForArchetypeXp(xp)
  const { pct } = xpProgressInTier(xp)
  return Math.min(100, (tier - 1) * 20 + pct * 20)
}

const MAP_ZONE_TO_SKILL: Record<MapZoneId, SkillBranchId> = {
  creative_forest: 'creation',
  engineering_fort: 'engineering',
  commerce_plains: 'commerce',
  human_realm: 'bonds',
  side_hill: 'spirit',
  neutral_meadow: 'spirit',
}

export type QuestSkillContext = {
  areaName?: string
  projectName?: string
  tags?: string[]
  /** 활성 태세 — 원형 스킬 XP */
  identityId?: string | null
  identityName?: string
}

export function resolveSkillBranchFromQuest(ctx?: QuestSkillContext): SkillBranchId {
  if (!ctx) return 'spirit'
  const tags = (ctx.tags ?? []).join(' ').toLowerCase()
  if (/운동|헬스|건강|신체|body|러닝|수면|명상\s*신체/i.test(tags)) return 'body'
  const zone = detectMapZone(ctx.areaName ?? '', ctx.projectName ?? '')
  return MAP_ZONE_TO_SKILL[zone] ?? 'spirit'
}

export function addSkillBranchXp(branch: SkillBranchId, amount: number): {
  state: SkillTreeState
  levelUp: boolean
  prevTier: number
  newTier: number
  gained: number
} {
  const state = loadSkillTreeState()
  const cur = state.branchXp[branch] ?? 0
  const prevTier = tierForBranchXp(cur)
  const nextXp = cur + Math.max(0, Math.round(amount))
  const next: SkillTreeState = {
    ...state,
    branchXp: { ...state.branchXp, [branch]: nextXp },
  }
  const newTier = tierForBranchXp(nextXp)
  saveSkillTreeState(next)
  try {
    window.dispatchEvent(new CustomEvent(BL_SKILL_TREE_SYNC, { detail: { kind: 'branch', branch, prevTier, newTier } }))
  } catch {
    /* ignore */
  }
  return {
    state: next,
    levelUp: newTier > prevTier,
    prevTier,
    newTier,
    gained: amount,
  }
}

export function addArchetypeSkillXp(archetype: IdentityArchetype, amount: number): {
  state: SkillTreeState
  levelUp: boolean
  prevTier: number
  newTier: number
  gained: number
} {
  const state = loadSkillTreeState()
  const cur = state.archetypeXp[archetype] ?? 0
  const prevTier = tierForArchetypeXp(cur)
  const nextXp = cur + Math.max(0, Math.round(amount))
  const next: SkillTreeState = {
    ...state,
    archetypeXp: { ...state.archetypeXp, [archetype]: nextXp },
  }
  const newTier = tierForArchetypeXp(nextXp)
  saveSkillTreeState(next)
  try {
    window.dispatchEvent(
      new CustomEvent(BL_SKILL_TREE_SYNC, { detail: { kind: 'archetype', arch: archetype, prevTier, newTier } }),
    )
  } catch {
    /* ignore */
  }
  return {
    state: next,
    levelUp: newTier > prevTier,
    prevTier,
    newTier,
    gained: amount,
  }
}

/** 보스 레이드 — 원형 숙련도 평균에 따른 격파 보정 (최대 +15%) */
export function raidDamageMultiplierFromSkillTree(state = loadSkillTreeState()): number {
  let sumT = 0
  for (const a of ARCHETYPE_ORDER) {
    sumT += tierForArchetypeXp(state.archetypeXp[a] ?? 0)
  }
  const avg = sumT / ARCHETYPE_ORDER.length
  return 1 + Math.min(0.15, avg * 0.03)
}

/** 시각 이펙트 단계 0~3 */
export function raidSkillEffectTier(state = loadSkillTreeState()): number {
  const m = raidDamageMultiplierFromSkillTree(state)
  const bonus = m - 1
  if (bonus >= 0.12) return 3
  if (bonus >= 0.08) return 2
  if (bonus >= 0.04) return 1
  return 0
}
