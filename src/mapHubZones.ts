/**
 * 월드 맵 — Vision Area / 프로젝트명 기반 구역 배치 (비선형 RPG 맵)
 */
import type { AreaRow, ProjectRow } from './supabase'

export type MapZoneId =
  | 'creative_forest'
  | 'engineering_fort'
  | 'commerce_plains'
  | 'human_realm'
  | 'side_hill'
  | 'neutral_meadow'

export const MAP_ZONES: {
  id: MapZoneId
  label: string
  short: string
  emoji: string
  /** 맵 패널 내 대략적 영역 (%) */
  region: { left: number; top: number; width: number; height: number }
  accent: string
}[] = [
  {
    id: 'creative_forest',
    label: '창작의 숲',
    short: '창작',
    emoji: '🌲',
    region: { left: 4, top: 8, width: 38, height: 44 },
    accent: 'rgba(34,197,94,0.55)',
  },
  {
    id: 'engineering_fort',
    label: '공학의 요새',
    short: '공학',
    emoji: '🏰',
    region: { left: 58, top: 6, width: 38, height: 40 },
    accent: 'rgba(59,130,246,0.5)',
  },
  {
    id: 'commerce_plains',
    label: '생계의 평원',
    short: '생계',
    emoji: '🏘️',
    region: { left: 6, top: 58, width: 36, height: 36 },
    accent: 'rgba(234,179,8,0.45)',
  },
  {
    id: 'human_realm',
    label: '인연의 외곽',
    short: '인연',
    emoji: '💬',
    region: { left: 44, top: 52, width: 30, height: 34 },
    accent: 'rgba(244,114,182,0.45)',
  },
  {
    id: 'side_hill',
    label: '사이드 언덕',
    short: '사이드',
    emoji: '⛰️',
    region: { left: 78, top: 52, width: 18, height: 32 },
    accent: 'rgba(168,85,247,0.45)',
  },
  {
    id: 'neutral_meadow',
    label: '중립 초원',
    short: '기타',
    emoji: '🌾',
    region: { left: 40, top: 28, width: 22, height: 26 },
    accent: 'rgba(148,163,184,0.4)',
  },
]

const CREATIVE = /웹툰|소설|웹소설|성인웹툰|창작|글|원고|만화|시나리오|문학|집필|출판/i
const ENGINE = /시스템|개발|코드|API|프로그램|엔지니|소프트웨어|앱|DB|서버|DevOps/i
const COMMERCE = /사업|직장|근무|업무|회사|매출|운영|경제/i
const HUMAN = /인적|사람|네트워크|관계|가족|개인/i
const SIDE = /사이드|부업|취미프로젝트/i

export function detectMapZone(areaName: string, projectName: string): MapZoneId {
  const blob = `${areaName} ${projectName}`
  if (CREATIVE.test(blob)) return 'creative_forest'
  if (ENGINE.test(blob)) return 'engineering_fort'
  if (COMMERCE.test(blob)) return 'commerce_plains'
  if (HUMAN.test(blob)) return 'human_realm'
  if (SIDE.test(blob)) return 'side_hill'
  return 'neutral_meadow'
}

export function stableOffset(id: string, salt: number): { x: number; y: number } {
  let h = 2166136261
  const s = `${id}:${salt}`
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  const u = Math.abs(h)
  return { x: (u % 78) / 100, y: ((u >> 8) % 72) / 100 }
}

export function computeProjectProgress(
  project: ProjectRow,
  quests: { id: string; projectId?: string | null }[],
  completedIds: string[],
): number {
  const pq = quests.filter(q => q.projectId && String(q.projectId) === String(project.id))
  if (pq.length === 0) {
    const sec = project.time_spent_sec ?? 0
    return Math.min(1, sec / (2 * 3600))
  }
  let done = 0
  for (const q of pq) {
    if (completedIds.includes(q.id)) done++
  }
  const ratio = done / pq.length
  const timePart = Math.min(1, (project.time_spent_sec ?? 0) / (4 * 3600))
  return Math.min(1, ratio * 0.55 + timePart * 0.45)
}
