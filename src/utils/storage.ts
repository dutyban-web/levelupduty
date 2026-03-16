/**
 * storage.ts
 * 선택된 프로젝트·퀘스트 상태를 localStorage에 저장/불러오는 핸들러.
 * 구조는 src/data/vault/current_status.json 스키마를 따릅니다.
 */

const STORAGE_KEY = 'creative_os_status'

export interface VaultStatus {
  last_updated: string
  stats: {
    words_today: number
    streak_days: number
    calories_today: number
    steps_today: number
    fortune: string
  }
  selected_projects: string[]
  selected_quests: string[]
  focus_sessions_today: number
  total_focus_minutes_today: number
}

const defaultStatus: VaultStatus = {
  last_updated: '',
  stats: {
    words_today: 0,
    streak_days: 0,
    calories_today: 0,
    steps_today: 0,
    fortune: '갑술(甲戌)',
  },
  selected_projects: [],
  selected_quests: [],
  focus_sessions_today: 0,
  total_focus_minutes_today: 0,
}

/** localStorage에서 상태를 불러옵니다 */
export function loadStatus(): VaultStatus {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaultStatus }
    return JSON.parse(raw) as VaultStatus
  } catch {
    return { ...defaultStatus }
  }
}

/** 상태 전체를 localStorage에 저장합니다 */
export function saveStatus(status: VaultStatus): void {
  const updated: VaultStatus = {
    ...status,
    last_updated: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated, null, 2))
}

/** 선택된 프로젝트 목록을 업데이트합니다 */
export function saveSelectedProjects(projects: string[]): void {
  const current = loadStatus()
  saveStatus({ ...current, selected_projects: projects })
}

/** 선택된 퀘스트 목록을 업데이트합니다 */
export function saveSelectedQuests(quests: string[]): void {
  const current = loadStatus()
  saveStatus({ ...current, selected_quests: quests })
}

/** 포커스 세션 완료 시 통계를 기록합니다 */
export function recordFocusSession(minutesElapsed: number): void {
  const current = loadStatus()
  saveStatus({
    ...current,
    focus_sessions_today: current.focus_sessions_today + 1,
    total_focus_minutes_today: current.total_focus_minutes_today + minutesElapsed,
  })
}

/** 오늘 날짜가 바뀌었으면 daily 카운터를 리셋합니다 */
export function resetIfNewDay(): VaultStatus {
  const current = loadStatus()
  if (!current.last_updated) return current

  const lastDate = new Date(current.last_updated).toDateString()
  const today = new Date().toDateString()
  if (lastDate !== today) {
    const reset: VaultStatus = {
      ...defaultStatus,
      stats: { ...defaultStatus.stats, fortune: current.stats.fortune },
    }
    saveStatus(reset)
    return reset
  }
  return current
}
