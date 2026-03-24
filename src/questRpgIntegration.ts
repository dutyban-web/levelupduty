/**
 * Quest 완료 · 마이크로 승리 시 LevelUp RPG 프로필과 동기화
 */
import { loadRpgProfile, saveRpgProfile, type LevelupRpgProfile } from './levelupRpgProfile'
import { kingdomHasGardenBuff } from './kingdomData'
import {
  resolveIdentityArchetype,
  inferArchetypeFromIdentityName,
  type IdentityArchetype,
} from './identityArchetypeData'
import {
  addArchetypeSkillXp,
  addSkillBranchXp,
  resolveSkillBranchFromQuest,
  type QuestSkillContext,
  type SkillBranchId,
} from './skillTreeData'

export const BL_RPG_SYNC = 'bl-rpg-sync'
export const BL_STAT_SPARK = 'bl-stat-spark'
export const BL_INNER_WORLD_SYNC = 'bl-inner-world-sync'

function bumpPair(cur: [number, number], delta: number): [number, number] {
  const max = cur[1]
  const next = Math.min(max, cur[0] + delta)
  return [next, max]
}

function bumpStatLine(
  lines: LevelupRpgProfile['statLines'],
  id: 'int' | 'spr',
  delta: number,
): { lines: LevelupRpgProfile['statLines']; up: boolean } {
  let up = false
  const next = lines.map(sl => {
    if (sl.id !== id) return sl
    const n = parseInt(String(sl.value).replace(/[^\d-]/g, ''), 10)
    const base = Number.isFinite(n) ? n : 10
    const nv = base + delta
    up = true
    return { ...sl, value: String(nv) }
  })
  return { lines: next, up }
}

export type QuestCompleteRpgResult = {
  intUp: boolean
  sprUp: boolean
  skillBranch?: SkillBranchId
  skillXpAdded?: number
  skillLevelUp?: boolean
  skillArchetype?: IdentityArchetype
  archetypeXpAdded?: number
  archetypeLevelUp?: boolean
}

/** 퀘스트 완료 시 HP/MP 소량 회복 + INT/SPR 확률 상승 + 스킬 분기 XP (맵 구역·태그 기반) */
export function applyQuestCompleteRpgRewards(ctx?: QuestSkillContext): QuestCompleteRpgResult {
  const p = loadRpgProfile()
  let intUp = false
  let sprUp = false
  let statLines = p.statLines

  const hp = bumpPair(p.hp, 4)
  const mp = bumpPair(p.mp, 3)
  const sp = bumpPair(p.sp, 1)

  if (Math.random() < 0.45) {
    const r = bumpStatLine(statLines, 'int', 1)
    statLines = r.lines
    intUp = r.up
  }
  if (Math.random() < 0.45) {
    const r = bumpStatLine(statLines, 'spr', 1)
    statLines = r.lines
    sprUp = r.up
  }

  const next: LevelupRpgProfile = {
    ...p,
    hp,
    mp,
    sp,
    statLines,
    gold: p.gold + Math.max(0, Math.round(3 + Math.random() * 5)),
  }
  saveRpgProfile(next)

  let skillBranch: SkillBranchId | undefined
  let skillXpAdded: number | undefined
  let skillLevelUp = false
  let skillArchetype: IdentityArchetype | undefined
  let archetypeXpAdded: number | undefined
  let archetypeLevelUp = false
  if (ctx && (ctx.areaName || ctx.projectName || (ctx.tags && ctx.tags.length))) {
    const branch = resolveSkillBranchFromQuest(ctx)
    const mult = kingdomHasGardenBuff() ? 1.08 : 1
    const raw = 14 + Math.floor(Math.random() * 16)
    const r = addSkillBranchXp(branch, Math.round(raw * mult))
    skillBranch = branch
    skillXpAdded = r.gained
    skillLevelUp = r.levelUp
  }

  if (ctx && (ctx.identityId || ctx.identityName)) {
    const arch = ctx.identityId
      ? resolveIdentityArchetype(ctx.identityId, ctx.identityName ?? '')
      : inferArchetypeFromIdentityName(ctx.identityName ?? '')
    const mult = kingdomHasGardenBuff() ? 1.08 : 1
    const raw = 12 + Math.floor(Math.random() * 14)
    const r = addArchetypeSkillXp(arch, Math.round(raw * mult))
    skillArchetype = arch
    archetypeXpAdded = r.gained
    archetypeLevelUp = r.levelUp
  }

  try {
    window.dispatchEvent(new CustomEvent(BL_RPG_SYNC))
    window.dispatchEvent(
      new CustomEvent(BL_STAT_SPARK, {
        detail: { intUp, sprUp, skillBranch, skillLevelUp, skillArchetype, archetypeLevelUp },
      }),
    )
  } catch {
    /* ignore */
  }
  return {
    intUp,
    sprUp,
    skillBranch,
    skillXpAdded,
    skillLevelUp,
    skillArchetype,
    archetypeXpAdded,
    archetypeLevelUp,
  }
}

/** 포모도로/몰입 세션 완료 시 MP(의지력) 소량 회복 — 집중 시간에 비례 */
export function applyFocusSessionMpRecovery(elapsedSec: number): void {
  if (!Number.isFinite(elapsedSec) || elapsedSec <= 0) return
  const p = loadRpgProfile()
  const minutes = elapsedSec / 60
  const gardenMult = kingdomHasGardenBuff() ? 1.1 : 1
  const delta = Math.round(Math.min(12, Math.max(1, Math.round(minutes * 1.2 + 1))) * gardenMult)
  const mp = bumpPair(p.mp, delta)
  const next: LevelupRpgProfile = { ...p, mp }
  saveRpgProfile(next)
  try {
    window.dispatchEvent(new CustomEvent(BL_RPG_SYNC))
  } catch {
    /* ignore */
  }
}

/** 골드 획득 (루틴 거리 콤보·피버 등) */
export function addRpgGold(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) return
  const p = loadRpgProfile()
  const next: LevelupRpgProfile = { ...p, gold: p.gold + Math.round(amount) }
  saveRpgProfile(next)
  try {
    window.dispatchEvent(new CustomEvent(BL_RPG_SYNC))
  } catch {
    /* ignore */
  }
}

/** 신전 제례 — 실패를 Try로 자산화할 때 추가 보상 (골드만; EXP는 App adjustXp) */
export function applySanctuaryFailureAssetBonus(): number {
  const bonus = 18 + Math.round(Math.random() * 14)
  addRpgGold(bonus)
  const p = loadRpgProfile()
  const mp = bumpPair(p.mp, 2)
  const next: LevelupRpgProfile = { ...p, mp }
  saveRpgProfile(next)
  try {
    window.dispatchEvent(new CustomEvent(BL_RPG_SYNC))
  } catch {
    /* ignore */
  }
  return bonus
}

/** 일일 제례 마무리 — 소량 회복 + 동기화 이벤트 */
export function applySanctuaryRiteCompleteBonus(): void {
  const p = loadRpgProfile()
  const hp = bumpPair(p.hp, 3)
  const sp = bumpPair(p.sp, 2)
  const next: LevelupRpgProfile = { ...p, hp, sp }
  saveRpgProfile(next)
  try {
    window.dispatchEvent(new CustomEvent(BL_RPG_SYNC))
  } catch {
    /* ignore */
  }
}

/** 내실 — 동료 가치 활동 기록 시 소량 골드 */
export function applyInnerWorldCompanionActivity(): number {
  const g = 4 + Math.round(Math.random() * 5)
  addRpgGold(g)
  try {
    window.dispatchEvent(new CustomEvent(BL_RPG_SYNC))
  } catch {
    /* ignore */
  }
  return g
}

export function applyMicroVictoryRpg(): void {
  const p = loadRpgProfile()
  const sp = bumpPair(p.sp, 2)
  const next: LevelupRpgProfile = {
    ...p,
    sp,
    gold: p.gold + 4,
  }
  saveRpgProfile(next)
  try {
    window.dispatchEvent(new CustomEvent(BL_RPG_SYNC))
  } catch {
    /* ignore */
  }
}

/**
 * Lv.2+ 에서 고난도/보스성 퀘스트 완료 시 MP(의지력) 차감
 * — 우선순위 2+ 또는 boss/보스/레이드 태그·제목
 */
export function applyMpDrainForQuestComplete(
  q: { priority?: number; tags?: string[]; name?: string },
  userLevel: number,
): number {
  if (userLevel < 2) return 0
  const tags = (q.tags ?? []).join(' ').toLowerCase()
  const name = (q.name ?? '').toLowerCase()
  const bossish = /boss|보스|레이드|raid|ultimate/.test(tags) || /boss|보스|레이드|raid/.test(name)
  const pri = q.priority ?? 0
  let cost = 0
  if (bossish) cost = 8
  else if (pri >= 2) cost = 5
  if (cost <= 0) return 0
  const p = loadRpgProfile()
  const nextCur = Math.max(0, p.mp[0] - cost)
  const next: LevelupRpgProfile = { ...p, mp: [nextCur, p.mp[1]] }
  saveRpgProfile(next)
  try {
    window.dispatchEvent(new CustomEvent(BL_RPG_SYNC))
  } catch {
    /* ignore */
  }
  return cost
}
