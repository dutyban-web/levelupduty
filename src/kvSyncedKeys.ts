/**
 * app_kv 동기화 대상 키 목록 — 초기 하이드레이션·로컬→KV 이사용
 */
import { kvSet, isSupabaseReady, kvListTrashedKeys } from './lib/supabase'
import { VALUE_ACTION_STORE_KEY, QUEST_VALUE_LINK_KEY } from './valueActionData'
import { NETWORK_STORE_KEY } from './networkData'
import { PLAYBOOK_STORE_KEY } from './humanRelationsPlaybookData'
import { LEVELUP_RPG_KEY } from './levelupRpgProfile'
import { POMODORO_LOG_KEY } from './pomodoroLogData'
import { MANIFEST_NOTE_BUNDLE_KEY } from './manifestNoteUtils'
import { MANIFEST_STUDIO_BUNDLE_KEY } from './manifestationStudioData'
import { TRACKER_BUNDLE_KEY } from './trackerData'
import { BOARD_EMOTIONAL_LENS_KEY } from './boardEmotionalLensData'
import { ADVENTURE_JOURNAL_KEY } from './adventureJournalData'

export const GOALS_KV_KEY = 'creative-os-life-goals-v1'
export const MANIFEST_LOCAL_KEY = 'manifestation_local_v1'
export const MANIFEST_ACHIEVED_KEY = 'manifestation_achieved_v1'
export const ACT_ROLE_REF_KEY = 'act-role-reference-v1'
export const ACT_MASTER_KEY = 'act-master-area-v1'

export const ALL_KV_SYNC_KEYS: string[] = [
  GOALS_KV_KEY,
  MANIFEST_LOCAL_KEY,
  MANIFEST_ACHIEVED_KEY,
  MANIFEST_STUDIO_BUNDLE_KEY,
  MANIFEST_NOTE_BUNDLE_KEY,
  ACT_ROLE_REF_KEY,
  ACT_MASTER_KEY,
  VALUE_ACTION_STORE_KEY,
  QUEST_VALUE_LINK_KEY,
  NETWORK_STORE_KEY,
  PLAYBOOK_STORE_KEY,
  LEVELUP_RPG_KEY,
  POMODORO_LOG_KEY,
  TRACKER_BUNDLE_KEY,
  BOARD_EMOTIONAL_LENS_KEY,
  ADVENTURE_JOURNAL_KEY,
]

function parseStoredValueForMigration(key: string, raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    if (key === GOALS_KV_KEY) return { text: raw }
    if (key === ACT_ROLE_REF_KEY || key === ACT_MASTER_KEY) return { text: raw }
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
