/**
 * 업적 — 전설 등급 프리셋 + 해금 상태
 * bl_achievements_v1
 */
import { kvSet } from './lib/supabase'

export const ACHIEVEMENTS_KEY = 'bl_achievements_v1'

export type AchievementTier = 'common' | 'rare' | 'epic' | 'legendary'

export type AchievementDef = {
  id: string
  title: string
  description: string
  tier: AchievementTier
  emoji: string
}

/** 작가 경력 기반 전설 프리셋 (수동 해금·추후 자동 조건 연결 가능) */
export const ACHIEVEMENT_DEFINITIONS: AchievementDef[] = [
  {
    id: 'leg_first_serial',
    title: '첫 연재의 문',
    description: '연재 작품을 처음으로 공개한 날. 모든 장편은 여기서 시작된다.',
    tier: 'legendary',
    emoji: '📖',
  },
  {
    id: 'leg_first_volume',
    title: '단행본, 첫 장정',
    description: '첫 단행본이 서가에 꽂힌 순간. 종이의 무게가 경력이 된다.',
    tier: 'legendary',
    emoji: '📕',
  },
  {
    id: 'leg_million_views',
    title: '백만 눈의 숨소리',
    description: '누적 조회·독자 반응이 백만 단위를 넘어선 순간(플랫폼 무관).',
    tier: 'legendary',
    emoji: '👁️',
  },
  {
    id: 'leg_prize',
    title: '심사위원의 낙인',
    description: '공모·공식 입상 또는 동일 급의 외부 인정을 받은 기록.',
    tier: 'legendary',
    emoji: '🏆',
  },
  {
    id: 'leg_media',
    title: '스크린의 초대',
    description: '영상·매체·인터뷰 등 2차 창작 또는 공개 미디어 출연.',
    tier: 'legendary',
    emoji: '🎬',
  },
  {
    id: 'leg_ip',
    title: 'IP의 씨앗',
    description: '원작 IP 계약·라이선스·콜라보 등 확장이 시작된 기록.',
    tier: 'legendary',
    emoji: '🔗',
  },
]

export type AchievementsState = {
  version: 1
  /** 해금된 업적 id */
  unlockedIds: string[]
}

export function loadAchievementsState(): AchievementsState {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY)
    if (!raw) return { version: 1, unlockedIds: [] }
    const p = JSON.parse(raw) as Partial<AchievementsState>
    if (p.version !== 1 || !Array.isArray(p.unlockedIds)) return { version: 1, unlockedIds: [] }
    return { version: 1, unlockedIds: p.unlockedIds.filter((x): x is string => typeof x === 'string') }
  } catch {
    return { version: 1, unlockedIds: [] }
  }
}

export function saveAchievementsState(next: AchievementsState): void {
  try {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(next))
    void kvSet(ACHIEVEMENTS_KEY, next)
  } catch {
    /* quota */
  }
}

export function unlockAchievement(id: string): AchievementsState {
  const s = loadAchievementsState()
  if (s.unlockedIds.includes(id)) return s
  const next = { ...s, unlockedIds: [...s.unlockedIds, id] }
  saveAchievementsState(next)
  return next
}

export function lockAchievement(id: string): AchievementsState {
  const s = loadAchievementsState()
  const next = { ...s, unlockedIds: s.unlockedIds.filter(x => x !== id) }
  saveAchievementsState(next)
  return next
}

export function tierLabel(t: AchievementTier): string {
  switch (t) {
    case 'legendary':
      return '전설'
    case 'epic':
      return '영웅'
    case 'rare':
      return '희귀'
    default:
      return '일반'
  }
}
