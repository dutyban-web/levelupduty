/**
 * app_kv 동기화 대상 키 목록 — 초기 하이드레이션·로컬→KV 이사용
 */
import { kvSet, isSupabaseReady, kvListTrashedKeys } from './lib/supabase'
import { VALUE_ACTION_STORE_KEY, QUEST_VALUE_LINK_KEY } from './valueActionData'
import { NETWORK_STORE_KEY } from './networkData'
import { PLAYBOOK_STORE_KEY } from './humanRelationsPlaybookData'
import { LEVELUP_RPG_KEY } from './levelupRpgProfile'
import { KINGDOM_KEY } from './kingdomData'
import { POMODORO_LOG_KEY } from './pomodoroLogData'
import { MANIFEST_NOTE_BUNDLE_KEY } from './manifestNoteUtils'
import { MANIFEST_STUDIO_BUNDLE_KEY } from './manifestationStudioData'
import { TRACKER_BUNDLE_KEY } from './trackerData'
import { BOARD_EMOTIONAL_LENS_KEY } from './boardEmotionalLensData'
import { ADVENTURE_JOURNAL_KEY } from './adventureJournalData'
import { HABIT_ROUTINE_CHAIN_KEY } from './habitRoutineData'
import { SANCTUARY_KPT_KEY } from './sanctuaryData'
import { INNER_WORLD_KEY } from './lifeWorldData'
import { CHRONICLE_STORE_KEY } from './chronicleData'
import { EXTERNAL_CALENDAR_STORE_KEY } from './externalCalendarData'
import { SKILL_TREE_KEY } from './skillTreeData'
import { REWARD_HISTORY_KEY } from './rewardHistoryData'
import { ACHIEVEMENTS_KEY } from './achievementsData'
import { VISUALIZATION_ITEMS_KEY } from './rewardShopData'
import { SIMULATION_WALLET_KEY } from './simulationWalletData'
import { MORNING_PRESENCE_ACK_KEY } from './presenceData'
import { IDENTITY_ARCHETYPE_KEY } from './identityArchetypeData'
import { GARRISON_TACTICAL_ALLY_KEY } from './garrisonTacticalAllyData'
import { LEGACY_ARCHIVE_KEY } from './legacyArchiveData'

export const GOALS_KV_KEY = 'creative-os-life-goals-v1'
export const MANIFEST_LOCAL_KEY = 'manifestation_local_v1'
export const MANIFEST_ACHIEVED_KEY = 'manifestation_achieved_v1'
export const ACT_ROLE_REF_KEY = 'act-role-reference-v1'
export const ACT_MASTER_KEY = 'act-master-area-v1'
/** Act — 상위 존재 방식(4원형) 선택값 */
export const ACT_WAY_OF_BEING_KEY = 'act-way-of-being-v1'

export const ALL_KV_SYNC_KEYS: string[] = [
  GOALS_KV_KEY,
  MANIFEST_LOCAL_KEY,
  MANIFEST_ACHIEVED_KEY,
  MANIFEST_STUDIO_BUNDLE_KEY,
  MANIFEST_NOTE_BUNDLE_KEY,
  ACT_ROLE_REF_KEY,
  ACT_MASTER_KEY,
  ACT_WAY_OF_BEING_KEY,
  VALUE_ACTION_STORE_KEY,
  QUEST_VALUE_LINK_KEY,
  NETWORK_STORE_KEY,
  PLAYBOOK_STORE_KEY,
  LEVELUP_RPG_KEY,
  KINGDOM_KEY,
  POMODORO_LOG_KEY,
  TRACKER_BUNDLE_KEY,
  BOARD_EMOTIONAL_LENS_KEY,
  ADVENTURE_JOURNAL_KEY,
  HABIT_ROUTINE_CHAIN_KEY,
  SANCTUARY_KPT_KEY,
  INNER_WORLD_KEY,
  CHRONICLE_STORE_KEY,
  EXTERNAL_CALENDAR_STORE_KEY,
  SKILL_TREE_KEY,
  REWARD_HISTORY_KEY,
  ACHIEVEMENTS_KEY,
  VISUALIZATION_ITEMS_KEY,
  SIMULATION_WALLET_KEY,
  MORNING_PRESENCE_ACK_KEY,
  IDENTITY_ARCHETYPE_KEY,
  GARRISON_TACTICAL_ALLY_KEY,
  LEGACY_ARCHIVE_KEY,
]

function parseStoredValueForMigration(key: string, raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    if (key === GOALS_KV_KEY) return { text: raw }
    if (key === ACT_ROLE_REF_KEY || key === ACT_MASTER_KEY) return { text: raw }
    if (key === ACT_WAY_OF_BEING_KEY) return { archetype: null }
    if (key === BOARD_EMOTIONAL_LENS_KEY) {
      return { past_pain: '', past_joy: '', present_pain: '', present_joy: '' }
    }
    if (key === ADVENTURE_JOURNAL_KEY) {
      return { blocks: [] }
    }
    return raw
  }
}

/** 서버에서 받은 레코드로 localStorage 캐시 갱신 (기존 passThrough와 동일 규칙) */
export function hydrateLocalStorageFromKvRecord(all: Record<string, unknown>): void {
  for (const key of ALL_KV_SYNC_KEYS) {
    if (all[key] !== undefined && all[key] !== null) {
      try {
        localStorage.setItem(key, JSON.stringify(all[key]))
      } catch {
        /* quota */
      }
    }
  }
}

/**
 * 로컬에만 있고 app_kv에 없으면 upsert (데이터 유실 방지)
 */
export async function migrateLocalToKvIfMissing(all: Record<string, unknown>): Promise<void> {
  if (!isSupabaseReady) return
  const trashed = new Set(await kvListTrashedKeys())
  for (const key of ALL_KV_SYNC_KEYS) {
    if (trashed.has(key)) continue
    if (all[key] != null && all[key] !== undefined) continue
    let raw: string | null
    try {
      raw = localStorage.getItem(key)
    } catch {
      continue
    }
    if (raw == null || raw === '') continue
    const value = parseStoredValueForMigration(key, raw)
    await kvSet(key, value as never)
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* quota */
    }
  }
}
