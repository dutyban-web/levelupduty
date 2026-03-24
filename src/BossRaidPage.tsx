/**
 * 보스 레이드 페이지 — 긴급 프로젝트 자동 선택
 */
import { useMemo } from 'react'
import type { ProjectRow } from './supabase'
import { BossRaidView } from './BossRaidView'
import { openQuestsForProject, pickBossProject } from './bossRaidLogic'

type Card = {
  id: string
  name: string
  projectId?: string | null
  priority?: number
  deadline?: string
}

export function BossRaidPage({
  projects,
  quests,
  completedQuestIds,
  onStrikeQuest,
}: {
  projects: ProjectRow[]
  quests: Card[]
  completedQuestIds: string[]
  onStrikeQuest: (questId: string) => void
}) {
  const boss = useMemo(
    () => pickBossProject(projects, quests, completedQuestIds),
    [projects, quests, completedQuestIds],
  )

  const openForBoss = useMemo(() => {
    if (!boss) return []
    return openQuestsForProject(quests, boss.id, completedQuestIds)
  }, [boss, quests, completedQuestIds])

  if (!boss) {
    return (
      <div style={{ padding: 24, color: '#94a3b8', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 14 }}>표시할 프로젝트가 없습니다. 퀘스트를 먼저 만들어 주세요.</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 18px 48px' }}>
      <BossRaidView
        key={boss.id}
        projectName={boss.name}
        openQuests={openForBoss}
        onStrikeQuest={onStrikeQuest}
      />
    </div>
  )
}
