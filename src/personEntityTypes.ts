/** 통합 인물 DB에 연결되는 엔티티 식별자 (entity_type / entity_id) */

export const PERSON_ENTITY = {
  MANUAL_DOCUMENT: 'manual_document',
  READING_LOG: 'reading_log',
  GOALS_KV: 'goals_kv',
  JOURNAL_NOTE: 'journal_note',
  USER_QUEST: 'user_quest',
  NETWORK_CONTACT: 'network_contact',
  LEVELUP_RPG: 'levelup_rpg',
} as const

export type PersonEntityType = (typeof PERSON_ENTITY)[keyof typeof PERSON_ENTITY]

/** Goals 페이지는 KV 단일 스코프 — 고정 entity_id */
export const GOALS_KV_ENTITY_ID = 'main'

/** Level RPG 프로필 단일 스코프 */
export const LEVELUP_RPG_ENTITY_ID = 'profile'

const LABELS: Record<string, string> = {
  [PERSON_ENTITY.MANUAL_DOCUMENT]: 'Manual 문서',
  [PERSON_ENTITY.READING_LOG]: '점괘·운세 기록',
  [PERSON_ENTITY.GOALS_KV]: 'Goals',
  [PERSON_ENTITY.JOURNAL_NOTE]: '저널 노트',
  [PERSON_ENTITY.USER_QUEST]: '퀘스트',
  [PERSON_ENTITY.NETWORK_CONTACT]: 'Network 연락처',
  [PERSON_ENTITY.LEVELUP_RPG]: 'Level RPG',
}

export function personEntityTypeLabel(t: string): string {
  return LABELS[t] ?? t
}
