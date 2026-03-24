/**
 * 보스 레이드 — 긴급 프로젝트 후보 선정
 */
import type { ProjectRow } from './supabase'

type QuestLite = {
  id: string
  projectId?: string | null
  deadline?: string
  priority?: number
}

function parseYmd(s: string | undefined): number | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return null
  return new Date(s.slice(0, 10) + 'T12:00:00').getTime()
}

/** 마감 임박·우선순위·미완료 수 기준으로 보스 프로젝트 선택 */
export function pickBossProject(
  projects: ProjectRow[],
  quests: QuestLite[],
  completedIds: string[],
): ProjectRow | null {
  const open = quests.filter(q => !completedIds.includes(q.id))
  if (!open.length || !projects.length) return null

  const score = (pid: string): number => {
    const qs = open.filter(q => q.projectId && String(q.projectId) === String(pid))
    if (!qs.length) return -1e9
    let s = qs.length * 12
    const now = Date.now()
    for (const q of qs) {
      const t = parseYmd(q.deadline)
      if (t != null) {
        const days = (t - now) / 86400000
        if (days <= 0) s += 80
        else if (days <= 3) s += 60 + (4 - days) * 5
        else if (days <= 7) s += 30
      }
      s += Math.min(30, (q.priority ?? 0) * 6)
    }
    const name = projects.find(p => String(p.id) === String(pid))?.name ?? ''
    if (/보스|boss|레이드|raid|final/i.test(name)) s += 40
    return s
  }

  let best: ProjectRow | null = null
  let bestScore = -1e10
  for (const p of projects) {
    const sc = score(String(p.id))
    if (sc > bestScore) {
      bestScore = sc
      best = p
    }
  }
  return bestScore > -1e8 ? best : projects[0] ?? null
}

export function openQuestsForProject(
  quests: QuestLite[],
  projectId: string,
  completedIds: string[],
): QuestLite[] {
  return quests.filter(
    q => q.projectId && String(q.projectId) === String(projectId) && !completedIds.includes(q.id),
  )
}
