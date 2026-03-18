import { createClient, type Session } from '@supabase/supabase-js'

export type { Session }

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL      as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// ══════════════════════════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════════════════════════
export async function signIn(
  email: string,
  password: string,
): Promise<{ session: Session | null; error: string | null }> {
  if (!supabase) return { session: null, error: 'Supabase 클라이언트가 없습니다.' }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { session: null, error: error.message }
  return { session: data.session, error: null }
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  if (!supabase) return () => {}
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return () => subscription.unsubscribe()
}

// ══════════════════════════════════════════════════════════════════════════════
//  user_stats 테이블  (id=1 단일 행)
// ══════════════════════════════════════════════════════════════════════════════
export interface UserStatsRow {
  id: number; level: number; current_xp: number
  required_xp: number; stats_json: Record<string, { value: string; memo: string }>
}
export async function fetchUserStats(): Promise<UserStatsRow | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.from('user_stats').select('*').eq('id', 1).maybeSingle()
    if (error || !data) return null
    return data as UserStatsRow
  } catch { return null }
}
export async function upsertUserStats(row: Omit<UserStatsRow, 'id'>): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('user_stats')
    .upsert({ id: 1, ...row, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) console.error('[Supabase] upsertUserStats 실패:', error.message)
}

// ══════════════════════════════════════════════════════════════════════════════
//  journals 테이블
// ══════════════════════════════════════════════════════════════════════════════
export interface JournalRow { date: string; content: string; blocks: unknown[] }
export async function fetchAllJournals(): Promise<JournalRow[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase.from('journals').select('date, content, blocks').order('date', { ascending: false })
    if (error || !data) return []
    return data as JournalRow[]
  } catch { return [] }
}
export async function syncJournals(store: Record<string, { content?: string; blocks?: unknown[] }>): Promise<void> {
  if (!supabase) return
  const rows = Object.entries(store).map(([date, e]) => ({
    date, content: e.content ?? '', blocks: e.blocks ?? [],
    updated_at: new Date().toISOString(),
  }))
  if (!rows.length) return
  const { error } = await supabase.from('journals').upsert(rows, { onConflict: 'date' })
  if (error) console.error('[Supabase] syncJournals 실패:', error.message)
}

// ══════════════════════════════════════════════════════════════════════════════
//  areas 테이블  (Area → Project → Quest 최상위)
// ══════════════════════════════════════════════════════════════════════════════
export interface AreaRow {
  id: string
  name: string
  time_spent_sec?: number
  created_at?: string
}

export async function fetchAreas(): Promise<AreaRow[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('areas')
      .select('id, title, time_spent_sec, created_at')
      .order('created_at', { ascending: true })
    if (error || !data) { if (error) console.error('[Supabase] fetchAreas 실패:', error.message); return [] }
    // DB 컬럼명은 `title`, TS 인터페이스는 `name` 으로 매핑
    return data.map(r => ({ id: String(r.id), name: r.title as string, time_spent_sec: r.time_spent_sec as number | undefined, created_at: r.created_at as string | undefined }))
  } catch (e) { console.error('[Supabase] fetchAreas 예외:', e); return [] }
}

export async function insertArea(name: string): Promise<AreaRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('areas').insert({ title: name })
    .select('id, title, time_spent_sec, created_at').single()
  if (error) { console.error('[Supabase] insertArea 실패:', error.message); return null }
  const d = data as Record<string, unknown>
  return { id: String(d.id), name: d.title as string, time_spent_sec: d.time_spent_sec as number | undefined, created_at: d.created_at as string | undefined }
}

export async function updateArea(id: string, name: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('areas').update({ title: name }).eq('id', id)
  if (error) console.error('[Supabase] updateArea 실패:', error.message)
}

export async function deleteArea(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('areas').delete().eq('id', id)
  if (error) console.error('[Supabase] deleteArea 실패:', error.message)
}

export async function addAreaTimeSpent(id: string, additionalSec: number): Promise<void> {
  if (!supabase || additionalSec <= 0) return
  const { data } = await supabase.from('areas').select('time_spent_sec').eq('id', id).single()
  const current = (data?.time_spent_sec ?? 0) as number
  const { error } = await supabase.from('areas').update({ time_spent_sec: current + additionalSec }).eq('id', id)
  if (error) console.error('[Supabase] addAreaTimeSpent 실패:', error.message)
}

// ══════════════════════════════════════════════════════════════════════════════
//  projects 테이블
// ══════════════════════════════════════════════════════════════════════════════
export interface ProjectRow {
  id: string
  name: string   // DB 컬럼명은 `name` 또는 `title` — fetchProjects 에서 alias 처리
  area_id?: string | null
  time_spent_sec?: number
  created_at?: string
}

// projects 테이블의 이름 컬럼 — 'name' 이 없으면 'title' 을 시도
async function _selectProjects(): Promise<ProjectRow[]> {
  if (!supabase) return []
  const toStr = (v: unknown) => (v != null ? String(v) : null)
  const r1 = await supabase.from('projects').select('id, name, area_id, time_spent_sec, created_at').order('created_at', { ascending: true })
  if (!r1.error && r1.data) return r1.data.map(r => ({
    id: String(r.id), name: r.name as string,
    area_id: toStr(r.area_id),   // 숫자→문자열 강제 변환 (FK는 DB에서 bigint로 옴)
    time_spent_sec: r.time_spent_sec as number | undefined,
    created_at: r.created_at,
  }))
  const r2 = await supabase.from('projects').select('id, title, area_id, time_spent_sec, created_at').order('created_at', { ascending: true })
  if (!r2.error && r2.data) return r2.data.map((r: Record<string, unknown>) => ({
    id: String(r.id), name: r.title as string,
    area_id: toStr(r.area_id),
    time_spent_sec: r.time_spent_sec as number | undefined,
    created_at: r.created_at as string | undefined,
  }))
  if (r2.error) console.error('[Supabase] fetchProjects 실패:', r2.error.message)
  return []
}

// 사용할 컬럼명 캐시 ('name' | 'title')
let _projectNameCol: 'name' | 'title' | null = null
async function _getProjectNameCol(): Promise<'name' | 'title'> {
  if (_projectNameCol) return _projectNameCol
  if (!supabase) return 'name'
  const { error } = await supabase.from('projects').select('name').limit(1)
  _projectNameCol = error ? 'title' : 'name'
  return _projectNameCol
}

export async function fetchProjects(): Promise<ProjectRow[]> {
  if (!supabase) return []
  try {
    return await _selectProjects()
  } catch (e) {
    console.error('[Supabase] fetchProjects 예외:', e)
    return []
  }
}

export async function insertProject(name: string, area_id?: string | null): Promise<ProjectRow | null> {
  if (!supabase) return null
  const col = await _getProjectNameCol()
  const payload: Record<string, unknown> = { [col]: name }
  if (area_id) payload.area_id = area_id
  const { data, error } = await supabase
    .from('projects')
    .insert(payload)
    .select(`id, ${col}, area_id, time_spent_sec, created_at`)
    .single()
  if (error) {
    console.error('[Supabase] insertProject 실패:', error.message)
    return null
  }
  const d = data as Record<string, unknown>
  return {
    id: String(d.id),
    name: (d[col] ?? d['name'] ?? d['title']) as string,
    area_id: d.area_id != null ? String(d.area_id) : null,  // bigint → string 강제 변환
    time_spent_sec: d.time_spent_sec as number | undefined,
    created_at: d.created_at as string | undefined,
  } as ProjectRow
}

export async function addProjectTimeSpent(id: string, additionalSec: number): Promise<void> {
  if (!supabase || additionalSec <= 0) return
  const { data } = await supabase.from('projects').select('time_spent_sec').eq('id', id).single()
  const current = (data?.time_spent_sec ?? 0) as number
  const { error } = await supabase.from('projects').update({ time_spent_sec: current + additionalSec }).eq('id', id)
  if (error) console.error('[Supabase] addProjectTimeSpent 실패:', error.message)
}

export async function updateProject(id: string, name: string): Promise<void> {
  if (!supabase) return
  const col = await _getProjectNameCol()
  const { error } = await supabase.from('projects').update({ [col]: name }).eq('id', id)
  if (error) console.error('[Supabase] updateProject 실패:', error.message)
}

export async function deleteProject(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) console.error('[Supabase] deleteProject 실패:', error.message)
}

// ══════════════════════════════════════════════════════════════════════════════
//  quests 테이블
// ══════════════════════════════════════════════════════════════════════════════

/** 하드코딩 퀘스트 완료는 app_kv 전담 — stub */
export async function fetchCompletedQuestIds(): Promise<string[]> { return [] }
export async function upsertQuest(_id: string, _done: boolean): Promise<void> { }

export interface UserQuestRow {
  id: string
  title: string
  category: string
  is_completed: boolean
  project_id?: string | null
  priority?: number
  deadline?: string
  started_at?: string
  ended_at?: string
  time_spent_sec?: number
  remaining_time_sec?: number | null
  pomodoro_count?: number
}

export async function fetchUserCreatedQuests(): Promise<UserQuestRow[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('quests')
      .select('id, title, category, is_completed, project_id, priority, deadline, started_at, ended_at, time_spent_sec, remaining_time_sec, pomodoro_count')
      .order('id', { ascending: true })
    if (error || !data) {
      if (error) console.error('[Supabase] fetchUserCreatedQuests 실패:', error.message)
      return []
    }
    return data.map(r => ({
      ...r,
      id:         String(r.id),
      project_id: r.project_id != null ? String(r.project_id) : null,  // bigint→string
    })) as UserQuestRow[]
  } catch (e) {
    console.error('[Supabase] fetchUserCreatedQuests 예외:', e)
    return []
  }
}

/** title, category, project_id, is_completed insert — id는 DB 자동 생성 */
export async function insertUserQuest(
  title: string,
  category: string,
  project_id?: string | null,
): Promise<{ id: string | null; error: string | null }> {
  if (!supabase) {
    const msg = 'Supabase 클라이언트 null — .env.local 키를 확인하고 dev 서버를 재시작하세요.'
    console.error('[Supabase] insertUserQuest:', msg)
    return { id: null, error: msg }
  }
  const payload: Record<string, unknown> = { title, category, is_completed: false }
  if (project_id) payload.project_id = project_id
  const { data, error } = await supabase
    .from('quests')
    .insert(payload)
    .select('id')
    .single()
  if (error) {
    console.error('[Supabase] insertUserQuest 실패  code:', error.code, ' msg:', error.message)
    return { id: null, error: error.message }
  }
  return { id: String(data.id), error: null }
}

/** 퀘스트 제목 수정 */
export async function updateQuestTitle(id: string, title: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('quests').update({ title }).eq('id', id)
  if (error) console.error('[Supabase] updateQuestTitle 실패:', error.message)
}

/** 포모도로 자연 완료 시 횟수 +1 (미리 끝내기는 호출하지 않음) */
export async function incrementQuestPomodoroCount(questId: string): Promise<void> {
  if (!supabase) return
  const { data } = await supabase.from('quests').select('pomodoro_count').eq('id', questId).single()
  const current = (data?.pomodoro_count ?? 0) as number
  const { error } = await supabase.from('quests').update({ pomodoro_count: current + 1 }).eq('id', questId)
  if (error) console.error('[Supabase] incrementQuestPomodoroCount 실패:', error.message)
}

/** 포모도로 Resume: 남은 시간 저장/초기화 */
export async function updateQuestRemainingTime(questId: string, sec: number | null): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('quests').update({ remaining_time_sec: sec }).eq('id', questId)
  if (error) console.error('[Supabase] updateQuestRemainingTime 실패:', error.message)
}

/** 퀘스트 완료 상태 업데이트 */
export async function updateUserQuestCompletion(id: string, isCompleted: boolean): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('quests').update({ is_completed: isCompleted }).eq('id', id)
  if (error) console.error('[Supabase] updateUserQuestCompletion 실패:', error.message)
}

/** 퀘스트 삭제 */
export async function deleteUserQuestRow(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('quests').delete().eq('id', id)
  if (error) console.error('[Supabase] deleteUserQuestRow 실패:', error.message)
}

/**
 * 포모도로 종료 시 time_spent_sec 에 경과 시간(초)을 누적 합산합니다.
 * SELECT → 현재 값 + additionalSec → UPDATE 방식으로 정확하게 더합니다.
 */
export async function addQuestTimeSpent(id: string, additionalSec: number): Promise<void> {
  if (!supabase || additionalSec <= 0) return
  const { data } = await supabase
    .from('quests')
    .select('time_spent_sec')
    .eq('id', id)
    .single()
  const current = (data?.time_spent_sec ?? 0) as number
  const { error } = await supabase
    .from('quests')
    .update({ time_spent_sec: current + additionalSec })
    .eq('id', id)
  if (error) console.error('[Supabase] addQuestTimeSpent 실패:', error.message)
}

// ══════════════════════════════════════════════════════════════════════════════
//  journal_categories 테이블
//  스키마: id (PK auto), group_name text, sub_name text, display_order int
// ══════════════════════════════════════════════════════════════════════════════
export interface JournalCategoryRow {
  id: number
  group_name: string
  sub_name: string
  display_order?: number
}

export async function fetchJournalCategories(): Promise<JournalCategoryRow[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('journal_categories')
      .select('id, group_name, sub_name, display_order')
      .order('display_order', { ascending: true })
    if (error || !data) { if (error) console.error('[Supabase] fetchJournalCategories 실패:', error.message); return [] }
    return data as JournalCategoryRow[]
  } catch (e) { console.error('[Supabase] fetchJournalCategories 예외:', e); return [] }
}

export async function insertJournalCategory(
  group_name: string, sub_name: string,
): Promise<JournalCategoryRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('journal_categories')
    .insert({ group_name, sub_name })
    .select()
    .single()
  if (error) { console.error('[Supabase] insertJournalCategory 실패:', error.message); return null }
  return data as JournalCategoryRow
}

export async function updateJournalCategory(
  id: number, group_name: string, sub_name: string,
): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('journal_categories').update({ group_name, sub_name }).eq('id', id)
  if (error) console.error('[Supabase] updateJournalCategory 실패:', error.message)
}

export async function deleteJournalCategory(id: number): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('journal_categories').delete().eq('id', id)
  if (error) console.error('[Supabase] deleteJournalCategory 실패:', error.message)
}

// ══════════════════════════════════════════════════════════════════════════════
//  journals (new) 테이블  — 기존 journals 테이블과 독립적
//  스키마: id (PK auto), record_date date, title text, content text,
//          group_name text, sub_name text, created_at timestamptz
// ══════════════════════════════════════════════════════════════════════════════
export interface JournalNoteRow {
  id: number
  record_date: string   // YYYY-MM-DD
  title: string
  content: string
  group_name: string
  sub_name: string
  created_at?: string
}

export async function fetchJournalNotes(params?: {
  record_date?: string
  group_name?: string
  sub_name?: string
}): Promise<JournalNoteRow[]> {
  if (!supabase) return []
  try {
    let q = supabase
      .from('journals')
      .select('id, record_date, title, content, group_name, sub_name, created_at')
      .order('record_date', { ascending: false })
    if (params?.record_date) q = q.eq('record_date', params.record_date)
    if (params?.group_name)  q = q.eq('group_name', params.group_name)
    if (params?.sub_name)    q = q.eq('sub_name', params.sub_name)
    const { data, error } = await q
    if (error || !data) { if (error) console.error('[Supabase] fetchJournalNotes 실패:', error.message); return [] }
    return data as JournalNoteRow[]
  } catch (e) { console.error('[Supabase] fetchJournalNotes 예외:', e); return [] }
}

export async function fetchJournalDates(): Promise<string[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('journals')
      .select('record_date')
    if (error || !data) return []
    return [...new Set(data.map((r: { record_date: string }) => r.record_date))]
  } catch { return [] }
}

export async function insertJournalNote(
  note: Omit<JournalNoteRow, 'id' | 'created_at'>,
): Promise<JournalNoteRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('journals')
    .insert(note)
    .select()
    .single()
  if (error) { console.error('[Supabase] insertJournalNote 실패:', error.message); return null }
  return data as JournalNoteRow
}

export async function updateJournalNote(
  id: number,
  fields: Partial<Pick<JournalNoteRow, 'title' | 'content' | 'record_date' | 'group_name' | 'sub_name'>>,
): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('journals').update(fields).eq('id', id)
  if (error) console.error('[Supabase] updateJournalNote 실패:', error.message)
}

export async function deleteJournalNote(id: number): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('journals').delete().eq('id', id)
  if (error) console.error('[Supabase] deleteJournalNote 실패:', error.message)
}

// ══════════════════════════════════════════════════════════════════════════════
//  노트 상세 content CRUD (areas / projects / quests 공통)
//  테이블별 content 컬럼이 있어야 함 (TEXT, nullable)
// ══════════════════════════════════════════════════════════════════════════════
type NoteTable = 'areas' | 'projects' | 'quests' | 'journals'

export async function fetchNoteContent(table: NoteTable, id: string): Promise<string> {
  if (!supabase) return ''
  try {
    const { data, error } = await supabase.from(table).select('content').eq('id', id).single()
    if (error || !data) return ''
    return (data as Record<string, unknown>).content as string ?? ''
  } catch { return '' }
}

export async function saveNoteContent(table: NoteTable, id: string, content: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from(table).update({ content }).eq('id', id)
  if (error) console.error(`[Supabase] saveNoteContent(${table}) 실패:`, error.message)
}

// ══════════════════════════════════════════════════════════════════════════════
//  daily_logs 테이블 (일별 몰입 통계)
//  log_date (YYYY-MM-DD), total_pomodoros, total_time_sec
// ══════════════════════════════════════════════════════════════════════════════
export interface DailyLogRow {
  log_date: string
  total_pomodoros: number
  total_time_sec: number
}

export async function fetchDailyLog(recordDate: string): Promise<DailyLogRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('daily_logs')
    .select('log_date, total_pomodoros, total_time_sec')
    .eq('log_date', recordDate)
    .single()
  if (error || !data) return null
  return data as DailyLogRow
}

export async function upsertDailyLog(
  recordDate: string,
  addPomodoros: number,
  addTimeSec: number,
): Promise<void> {
  if (!supabase || (addPomodoros === 0 && addTimeSec === 0)) return
  const { data: existing } = await supabase
    .from('daily_logs')
    .select('total_pomodoros, total_time_sec')
    .eq('log_date', recordDate)
    .maybeSingle()
  const pom = Number((existing as Record<string, unknown>)?.total_pomodoros) || 0
  const sec = Number((existing as Record<string, unknown>)?.total_time_sec) || 0
  const newPom = pom + addPomodoros
  const newSec = sec + addTimeSec
  if (existing != null) {
    const { error } = await supabase
      .from('daily_logs')
      .update({ total_pomodoros: newPom, total_time_sec: newSec })
      .eq('log_date', recordDate)
    if (error) console.error('[Supabase] upsertDailyLog update 실패:', error.message)
  } else {
    const { error } = await supabase
      .from('daily_logs')
      .insert({ log_date: recordDate, total_pomodoros: newPom, total_time_sec: newSec })
    if (error) console.error('[Supabase] upsertDailyLog insert 실패:', error.message)
  }
}

/** daily_logs 포모도로 수동 증감 (대시보드 +/- 버튼용) */
export async function updateDailyLogPomodoros(recordDate: string, delta: number): Promise<{ total_pomodoros: number; total_time_sec: number } | null> {
  if (!supabase) return null
  const { data: row } = await supabase.from('daily_logs').select('total_pomodoros, total_time_sec').eq('log_date', recordDate).maybeSingle()
  const pom = ((row as Record<string, unknown>)?.total_pomodoros as number) ?? 0
  const sec = ((row as Record<string, unknown>)?.total_time_sec as number) ?? 0
  const newPom = Math.max(0, pom + delta)
  if (row) {
    const { error } = await supabase.from('daily_logs').update({ total_pomodoros: newPom }).eq('log_date', recordDate)
    if (error) { console.error('[Supabase] updateDailyLogPomodoros 실패:', error.message); return null }
  } else {
    const { error } = await supabase.from('daily_logs').insert({ log_date: recordDate, total_pomodoros: newPom, total_time_sec: 0 })
    if (error) { console.error('[Supabase] updateDailyLogPomodoros insert 실패:', error.message); return null }
  }
  return { total_pomodoros: newPom, total_time_sec: sec }
}

/** 퀘스트 pomodoro_count 직접 설정 (수동 편집용) */
export async function updateQuestPomodoroCount(questId: string, count: number): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('quests').update({ pomodoro_count: Math.max(0, count) }).eq('id', questId)
  if (error) console.error('[Supabase] updateQuestPomodoroCount 실패:', error.message)
}

// ══════════════════════════════════════════════════════════════════════════════
//  Storage: media 버킷 이미지 업로드
// ══════════════════════════════════════════════════════════════════════════════
const MEDIA_BUCKET = 'media'
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export async function uploadImageToMedia(file: File): Promise<string> {
  if (!supabase) throw new Error('Supabase 클라이언트가 없습니다.')
  const ext = file.name.split('.').pop() || 'jpg'
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}.${ext}`
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).upload(uniqueName, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  const { data: urlData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(data.path)
  return urlData.publicUrl
}
