/**
 * Levelup RPG 대시보드 — 사용자 커스터마이징 프로필 (app_kv + localStorage)
 */
import { kvSet } from './lib/supabase'

export const LEVELUP_RPG_KEY = 'levelup_rpg_profile_v2'

export type RpgEquipmentSlot = { slot: string; name: string }
export type RpgBossRow = { id: string; name: string; cleared: boolean; memo: string; is_deleted?: boolean }
export type RpgMapRow = { id: string; name: string; stars: number; memo: string; is_deleted?: boolean }
export type RpgQuestRow = { id: string; title: string; done: boolean; memo: string; is_deleted?: boolean }
export type RpgSkillRow = {
  id: string
  name: string
  level: number
  /** 표시용 태그: attack / magic / passive 등 */
  tag: string
  /** hex 색 */
  accent: string
  is_deleted?: boolean
}
export type RpgStatLine = { id: string; label: string; value: string; is_deleted?: boolean }

export type LevelupRpgProfile = {
  heroName: string
  heroTitle: string
  className: string
  portraitEmoji: string
  /** [현재, 최대] */
  hp: [number, number]
  mp: [number, number]
  sp: [number, number]
  stamina: [number, number]
  focus: [number, number]
  gold: number
  /** 사용자 정의 스탯 표 (값만 입력) */
  statLines: RpgStatLine[]
  equipment: RpgEquipmentSlot[]
  bosses: RpgBossRow[]
  maps: RpgMapRow[]
  /** 메인 퀘스트 / 할 일 트래킹 */
  quests: RpgQuestRow[]
  skills: RpgSkillRow[]
}

export const DEFAULT_RPG_STAT_LINES: RpgStatLine[] = [
  { id: 'str', label: '힘 (STR)', value: '10' },
  { id: 'dex', label: '민첩 (DEX)', value: '10' },
  { id: 'vit', label: '체력 (VIT)', value: '10' },
  { id: 'int', label: '지능 (INT)', value: '10' },
  { id: 'spr', label: '정신 (SPR)', value: '10' },
  { id: 'lck', label: '운 (LUK)', value: '10' },
  { id: 'atk', label: '공격력', value: '—' },
  { id: 'def', label: '방어력', value: '—' },
  { id: 'matk', label: '마법공격', value: '—' },
  { id: 'mdef', label: '마법방어', value: '—' },
]

export function defaultRpgProfile(): LevelupRpgProfile {
  return {
    heroName: '플레이어',
    heroTitle: '무한 성장 중',
    className: '창작가',
    portraitEmoji: '🧙',
    hp: [100, 100],
    mp: [50, 50],
    sp: [30, 30],
    stamina: [100, 100],
    focus: [100, 100],
    gold: 0,
    statLines: DEFAULT_RPG_STAT_LINES.map(s => ({ ...s })),
    equipment: [
      { slot: '무기', name: '—' },
      { slot: '방어구', name: '—' },
      { slot: '악세', name: '—' },
    ],
    bosses: [
      { id: 'b1', name: '첫 번째 보스 (이름을 바꿔보세요)', cleared: false, memo: '' },
    ],
    maps: [
      { id: 'm1', name: '시작의 평원', stars: 0, memo: '' },
    ],
    quests: [
      { id: 'q1', title: '메인 퀘스트 (제목 수정)', done: false, memo: '' },
    ],
    skills: [
      { id: 's1', name: '집중 /', level: 1, tag: '패시브', accent: '#5eead4' },
      { id: 's2', name: '몰입 모드', level: 1, tag: '버프', accent: '#a78bfa' },
      { id: 's3', name: '아이디어 스톰', level: 1, tag: '마법', accent: '#f472b6' },
    ],
  }
}

export function loadRpgProfile(): LevelupRpgProfile {
  try {
    const raw = localStorage.getItem(LEVELUP_RPG_KEY)
    if (!raw) return defaultRpgProfile()
    const parsed = JSON.parse(raw) as Partial<LevelupRpgProfile>
    const base = defaultRpgProfile()
    return {
      ...base,
      ...parsed,
      statLines: Array.isArray(parsed.statLines) && parsed.statLines.length > 0
        ? parsed.statLines as RpgStatLine[]
        : base.statLines,
      equipment: Array.isArray(parsed.equipment) ? parsed.equipment as RpgEquipmentSlot[] : base.equipment,
      bosses: Array.isArray(parsed.bosses) ? parsed.bosses as RpgBossRow[] : base.bosses,
      maps: Array.isArray(parsed.maps) ? parsed.maps as RpgMapRow[] : base.maps,
      quests: Array.isArray(parsed.quests) ? parsed.quests as RpgQuestRow[] : base.quests,
      skills: Array.isArray(parsed.skills) ? parsed.skills as RpgSkillRow[] : base.skills,
      hp: parsed.hp?.length === 2 ? parsed.hp as [number, number] : base.hp,
      mp: parsed.mp?.length === 2 ? parsed.mp as [number, number] : base.mp,
      sp: parsed.sp?.length === 2 ? parsed.sp as [number, number] : base.sp,
      stamina: parsed.stamina?.length === 2 ? parsed.stamina as [number, number] : base.stamina,
      focus: parsed.focus?.length === 2 ? parsed.focus as [number, number] : base.focus,
    }
  } catch {
    return defaultRpgProfile()
  }
}

export function saveRpgProfile(p: LevelupRpgProfile): void {
  try {
    localStorage.setItem(LEVELUP_RPG_KEY, JSON.stringify(p))
    void kvSet(LEVELUP_RPG_KEY, p)
  } catch { /* quota */ }
}

function markDeleted<T extends { id: string; is_deleted?: boolean }>(rows: T[], id: string): T[] {
  return rows.map(r => (r.id === id ? { ...r, is_deleted: true } : r))
}

function restoreRow<T extends { id: string; is_deleted?: boolean }>(rows: T[], id: string): T[] {
  return rows.map(r => {
    if (r.id !== id) return r
    const { is_deleted: _d, ...rest } = r
    return rest as T
  })
}

function purgeRow<T extends { id: string }>(rows: T[], id: string): T[] {
  return rows.filter(r => r.id !== id)
}

export function softDeleteRpgStatLine(p: LevelupRpgProfile, id: string): LevelupRpgProfile {
  return { ...p, statLines: markDeleted(p.statLines, id) }
}
export function restoreRpgStatLine(p: LevelupRpgProfile, id: string): LevelupRpgProfile {
  return { ...p, statLines: restoreRow(p.statLines, id) }
}
export function purgeRpgStatLine(p: LevelupRpgProfile, id: string): LevelupRpgProfile {
  return { ...p, statLines: purgeRow(p.statLines, id) }
}

export function softDeleteRpgBoss(p: LevelupRpgProfile, id: string): LevelupRpgProfile {
  return { ...p, bosses: markDeleted(p.bosses, id) }
}
export function restoreRpgBoss(p: LevelupRpgProfile, id: string): LevelupRpgProfile {
  return { ...p, bosses: restoreRow(p.bosses, id) }
}
export function purgeRpgBoss(p: LevelupRpgProfile, id: string): LevelupRpgProfile {
  return { ...p, bosses: purgeRow(p.bosses, id) }
}

export function softDeleteRpgMap(p: LevelupRpgProfile, id: string): LevelupRpgProfile {
  return { ...p, maps: markDeleted(p.maps, id) }
}
export function restoreRpgMap(p: LevelupRpgProfile, id: string): LevelupRpgProfile {
  return { ...p, maps: restoreRow(p.maps, id) }
}
export function purgeRpgMap(p: LevelupRpgProfile, id: string): LevelupRpgProfile {
  return { ...p, maps: purgeRow(p.maps, id) }
}

export function softDeleteRpgQuest(p: LevelupRpgProfile, id: string): LevelupRpgProfile {
  return { ...p, quests: markDeleted(p.quests, id) }
}
export function restoreRpgQuest(p: LevelupRpgProfile, id: string): LevelupRpgProfile {
  return { ...p, quests: restoreRow(p.quests, id) }
}
export function purgeRpgQuest(p: LevelupRpgProfile, id: string): LevelupRpgProfile {
  return { ...p, quests: purgeRow(p.quests, id) }
}

export function softDeleteRpgSkill(p: LevelupRpgProfile, id: string): LevelupRpgProfile {
  return { ...p, skills: markDeleted(p.skills, id) }
}
export function restoreRpgSkill(p: LevelupRpgProfile, id: string): LevelupRpgProfile {
  return { ...p, skills: restoreRow(p.skills, id) }
}
export function purgeRpgSkill(p: LevelupRpgProfile, id: string): LevelupRpgProfile {
  return { ...p, skills: purgeRow(p.skills, id) }
}

/** RPG 서브목록 UI — 휴지통 제외 */
export function activeRpgRows<T extends { is_deleted?: boolean }>(rows: T[]): T[] {
  return rows.filter(r => r.is_deleted !== true)
}
