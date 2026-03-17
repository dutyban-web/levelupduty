import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL      as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// ══════════════════════════════════════════════════════════════
//  user_stats 테이블 (id = 1 단일 행)
//  레벨 · 경험치 · 상단 스탯 카드 값
// ══════════════════════════════════════════════════════════════
export interface UserStatsRow {
  id:           number
  level:        number
  current_xp:   number
  required_xp:  number
  stats_json:   Record<string, { value: string; memo: string }>
}

export async function fetchUserStats(): Promise<UserStatsRow | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    if (error || !data) return null
    return data as UserStatsRow
  } catch { return null }
}

export async function upsertUserStats(
  row: Omit<UserStatsRow, 'id'>
): Promise<void> {
  if (!supabase) return
  try {
    await supabase
      .from('user_stats')
      .upsert(
        { id: 1, ...row, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )
  } catch (e) {
    console.warn('[Supabase] upsertUserStats error:', e)
  }
}

// ══════════════════════════════════════════════════════════════
//  quests 테이블
//  퀘스트 ID별 완료 여부
// ══════════════════════════════════════════════════════════════
export async function fetchCompletedQuestIds(): Promise<string[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('quests')
      .select('quest_id')
      .eq('completed', true)
    if (error || !data) return []
    return data.map((r: { quest_id: string }) => r.quest_id)
  } catch { return [] }
}

export async function upsertQuest(
  questId: string,
  completed: boolean
): Promise<void> {
  if (!supabase) return
  try {
    await supabase
      .from('quests')
      .upsert(
        { quest_id: questId, completed, updated_at: new Date().toISOString() },
        { onConflict: 'quest_id' }
      )
  } catch (e) {
    console.warn('[Supabase] upsertQuest error:', e)
  }
}

// ══════════════════════════════════════════════════════════════
//  journals 테이블
//  날짜(YYYY-MM-DD)별 일지 내용 + 성과 블록
// ══════════════════════════════════════════════════════════════
export interface JournalRow {
  date:    string
  content: string
  blocks:  unknown[]
}

export async function fetchAllJournals(): Promise<JournalRow[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('journals')
      .select('date, content, blocks')
      .order('date', { ascending: false })
    if (error || !data) return []
    return data as JournalRow[]
  } catch { return [] }
}

// ══════════════════════════════════════════════════════════════
//  quests 테이블 — 사용자 직접 생성 퀘스트
//  (is_user_created = true 인 행만 대상)
// ══════════════════════════════════════════════════════════════
export interface UserQuestRow {
  quest_id:        string
  title:           string
  category:        string   // 'writing' | 'business' | 'health'
  completed:       boolean
}

/** 사용자가 직접 만든 퀘스트 목록을 가져온다 */
export async function fetchUserCreatedQuests(): Promise<UserQuestRow[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('quests')
      .select('quest_id, title, category, completed')
      .eq('is_user_created', true)
      .order('updated_at', { ascending: true })
    if (error || !data) return []
    return data as UserQuestRow[]
  } catch { return [] }
}

/** 새 사용자 퀘스트를 quests 테이블에 insert */
export async function insertUserQuest(
  questId: string,
  title:   string,
  category: string
): Promise<void> {
  if (!supabase) return
  try {
    await supabase.from('quests').insert({
      quest_id:        questId,
      title,
      category,
      completed:       false,
      is_user_created: true,
      updated_at:      new Date().toISOString(),
    })
  } catch (e) {
    console.warn('[Supabase] insertUserQuest error:', e)
  }
}

/** 사용자 퀘스트를 quests 테이블에서 삭제 */
export async function deleteUserQuestRow(questId: string): Promise<void> {
  if (!supabase) return
  try {
    await supabase.from('quests').delete().eq('quest_id', questId)
  } catch (e) {
    console.warn('[Supabase] deleteUserQuestRow error:', e)
  }
}

/** 일지 전체 store를 Supabase에 일괄 upsert (fire-and-forget) */
export async function syncJournals(
  store: Record<string, { content?: string; blocks?: unknown[] }>
): Promise<void> {
  if (!supabase) return
  const rows = Object.entries(store).map(([date, e]) => ({
    date,
    content:    e.content  ?? '',
    blocks:     e.blocks   ?? [],
    updated_at: new Date().toISOString(),
  }))
  if (!rows.length) return
  try {
    await supabase.from('journals').upsert(rows, { onConflict: 'date' })
  } catch (e) {
    console.warn('[Supabase] syncJournals error:', e)
  }
}
