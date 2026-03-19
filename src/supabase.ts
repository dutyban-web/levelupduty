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
  required_xp: number; total_xp?: number | null
  stats_json: Record<string, { value: string; memo: string }>
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
  sort_order?: number
  created_at?: string
}

export async function fetchAreas(): Promise<AreaRow[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('areas')
      .select('id, title, time_spent_sec, sort_order, created_at')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
    if (error || !data) { if (error) console.error('[Supabase] fetchAreas 실패:', error.message); return [] }
    return data.map(r => ({ id: String(r.id), name: r.title as string, time_spent_sec: r.time_spent_sec as number | undefined, sort_order: (r as Record<string, unknown>).sort_order as number | undefined, created_at: r.created_at as string | undefined }))
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

/** Area sort_order 수정 */
export async function updateAreaSortOrder(id: string, sort_order: number): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('areas').update({ sort_order }).eq('id', id)
  if (error) console.error('[Supabase] updateAreaSortOrder 실패:', error.message)
}

/** Area time_spent_sec 직접 설정 (수동 편집 Override) */
export async function setAreaTimeSpent(id: string, sec: number): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('areas').update({ time_spent_sec: Math.max(0, Math.floor(sec)) }).eq('id', id)
  if (error) console.error('[Supabase] setAreaTimeSpent 실패:', error.message)
}

// ══════════════════════════════════════════════════════════════════════════════
//  identities 테이블 (정체성 — 우디르 태세)
// ══════════════════════════════════════════════════════════════════════════════
export interface IdentityRow {
  id: string
  name: string
  role_model?: string | null
  time_spent_sec: number
  xp: number
  sort_order?: number
  created_at?: string
}

export async function fetchIdentities(): Promise<IdentityRow[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('identities')
      .select('id, name, role_model, time_spent_sec, xp, sort_order, created_at')
      .order('sort_order', { ascending: true })
    if (error || !data) { if (error) console.error('[Supabase] fetchIdentities 실패:', error.message); return [] }
    return data.map(r => ({
      id: String(r.id),
      name: r.name as string,
      role_model: r.role_model as string | null | undefined,
      time_spent_sec: (r.time_spent_sec ?? 0) as number,
      xp: (r.xp ?? 0) as number,
      sort_order: r.sort_order as number | undefined,
      created_at: r.created_at as string | undefined,
    }))
  } catch (e) { console.error('[Supabase] fetchIdentities 예외:', e); return [] }
}

export async function insertIdentity(name: string, role_model?: string | null): Promise<IdentityRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('identities')
    .insert({ name, role_model: role_model ?? null })
    .select('id, name, role_model, time_spent_sec, xp, sort_order, created_at')
    .single()
  if (error) { console.error('[Supabase] insertIdentity 실패:', error.message); return null }
  const r = data as Record<string, unknown>
  return {
    id: String(r.id),
    name: r.name as string,
    role_model: r.role_model as string | null | undefined,
    time_spent_sec: (r.time_spent_sec ?? 0) as number,
    xp: (r.xp ?? 0) as number,
    sort_order: r.sort_order as number | undefined,
    created_at: r.created_at as string | undefined,
  }
}

export async function updateIdentity(id: string, name: string, role_model?: string | null): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('identities').update({ name, role_model: role_model ?? null }).eq('id', id)
  if (error) console.error('[Supabase] updateIdentity 실패:', error.message)
}

export async function deleteIdentity(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('identities').delete().eq('id', id)
  if (error) console.error('[Supabase] deleteIdentity 실패:', error.message)
}

export async function addIdentityTimeAndXp(id: string, additionalSec: number, additionalXp: number): Promise<void> {
  if (!supabase || (additionalSec <= 0 && additionalXp <= 0)) return
  const { data } = await supabase.from('identities').select('time_spent_sec, xp').eq('id', id).single()
  const curSec = (data?.time_spent_sec ?? 0) as number
  const curXp = (data?.xp ?? 0) as number
  const { error } = await supabase.from('identities')
    .update({ time_spent_sec: curSec + additionalSec, xp: curXp + additionalXp })
    .eq('id', id)
  if (error) console.error('[Supabase] addIdentityTimeAndXp 실패:', error.message)
}

// ══════════════════════════════════════════════════════════════════════════════
//  projects 테이블
// ══════════════════════════════════════════════════════════════════════════════
export interface ProjectRow {
  id: string
  name: string   // DB 컬럼명은 `name` 또는 `title` — fetchProjects 에서 alias 처리
  area_id?: string | null
  time_spent_sec?: number
  sort_order?: number
  created_at?: string
}

// projects 테이블의 이름 컬럼 — 'name' 이 없으면 'title' 을 시도
async function _selectProjects(): Promise<ProjectRow[]> {
  if (!supabase) return []
  const toStr = (v: unknown) => (v != null ? String(v) : null)
  const r1 = await supabase.from('projects').select('id, name, area_id, time_spent_sec, sort_order, created_at').order('sort_order', { ascending: true }).order('created_at', { ascending: true })
  if (!r1.error && r1.data) return r1.data.map(r => ({
    id: String(r.id), name: r.name as string,
    area_id: toStr(r.area_id),
    time_spent_sec: r.time_spent_sec as number | undefined,
    sort_order: (r as Record<string, unknown>).sort_order as number | undefined,
    created_at: r.created_at,
  }))
  const r2 = await supabase.from('projects').select('id, title, area_id, time_spent_sec, sort_order, created_at').order('sort_order', { ascending: true }).order('created_at', { ascending: true })
  if (!r2.error && r2.data) return r2.data.map((r: Record<string, unknown>) => ({
    id: String(r.id), name: r.title as string,
    area_id: toStr(r.area_id),
    time_spent_sec: r.time_spent_sec as number | undefined,
    sort_order: r.sort_order as number | undefined,
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

/** Project time_spent_sec 직접 설정 (수동 편집 Override) */
export async function setProjectTimeSpent(id: string, sec: number): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('projects').update({ time_spent_sec: Math.max(0, Math.floor(sec)) }).eq('id', id)
  if (error) console.error('[Supabase] setProjectTimeSpent 실패:', error.message)
}

export async function updateProject(id: string, name: string): Promise<void> {
  if (!supabase) return
  const col = await _getProjectNameCol()
  const { error } = await supabase.from('projects').update({ [col]: name }).eq('id', id)
  if (error) console.error('[Supabase] updateProject 실패:', error.message)
}

/** Project sort_order 수정 */
export async function updateProjectSortOrder(id: string, sort_order: number): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('projects').update({ sort_order }).eq('id', id)
  if (error) console.error('[Supabase] updateProjectSortOrder 실패:', error.message)
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
  identity_id?: string | null
  status?: string
  tags?: string[]
  sort_order?: number
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
      .select('id, title, category, is_completed, project_id, identity_id, status, tags, sort_order, priority, deadline, started_at, ended_at, time_spent_sec, remaining_time_sec, pomodoro_count')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true })
    if (error || !data) {
      if (error) console.error('[Supabase] fetchUserCreatedQuests 실패:', error.message)
      return []
    }
    return data.map(r => {
      let tags: string[] = []
      try {
        const t = (r as Record<string, unknown>).tags
        if (Array.isArray(t)) tags = t as string[]
        else if (typeof t === 'string') tags = JSON.parse(t || '[]') as string[]
      } catch { /* ignore */ }
      return {
        ...r,
        id:         String(r.id),
        project_id: r.project_id != null ? String(r.project_id) : null,
        identity_id: r.identity_id != null ? String(r.identity_id) : null,
        tags,
      }
    }) as UserQuestRow[]
  } catch (e) {
    console.error('[Supabase] fetchUserCreatedQuests 예외:', e)
    return []
  }
}

/** title, category, project_id, identity_id, is_completed insert — id는 DB 자동 생성 */
export async function insertUserQuest(
  title: string,
  category: string,
  project_id?: string | null,
  identity_id?: string | null,
): Promise<{ id: string | null; error: string | null }> {
  if (!supabase) {
    const msg = 'Supabase 클라이언트 null — .env.local 키를 확인하고 dev 서버를 재시작하세요.'
    console.error('[Supabase] insertUserQuest:', msg)
    return { id: null, error: msg }
  }
  const payload: Record<string, unknown> = { title, category, is_completed: false }
  if (project_id) payload.project_id = project_id
  if (identity_id) payload.identity_id = identity_id
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

/** 퀘스트 마감일 수정 (deadline: YYYY-MM-DD 또는 null) */
export async function updateQuestDeadline(id: string, deadline: string | null): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase not ready' }
  const { error } = await supabase.from('quests').update({ deadline }).eq('id', id)
  if (error) {
    console.error('[Supabase] updateQuestDeadline 실패:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

/** 퀘스트 제목 수정 (성공/실패 반환, 롤백용) */
export async function updateQuestTitle(id: string, title: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase not ready' }
  const { error } = await supabase.from('quests').update({ title }).eq('id', id)
  if (error) {
    console.error('[Supabase] updateQuestTitle 실패:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

/** 퀘스트 Identity 수정 */
export async function updateQuestIdentity(id: string, identity_id: string | null): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase not ready' }
  const { error } = await supabase.from('quests').update({ identity_id }).eq('id', id)
  if (error) {
    console.error('[Supabase] updateQuestIdentity 실패:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

/** 퀘스트 상태 수정 (someday | not_started | in_progress | done) */
export async function updateQuestStatus(id: string, status: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase not ready' }
  const { error } = await supabase.from('quests').update({ status }).eq('id', id)
  if (error) {
    console.error('[Supabase] updateQuestStatus 실패:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

/** 퀘스트 태그 수정 */
export async function updateQuestTags(id: string, tags: string[]): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase not ready' }
  const { error } = await supabase.from('quests').update({ tags }).eq('id', id)
  if (error) {
    console.error('[Supabase] updateQuestTags 실패:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

/** 퀘스트 sort_order 수정 */
export async function updateQuestSortOrder(id: string, sort_order: number): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase not ready' }
  const { error } = await supabase.from('quests').update({ sort_order }).eq('id', id)
  if (error) {
    console.error('[Supabase] updateQuestSortOrder 실패:', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
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

/** Quest time_spent_sec 직접 설정 (수동 편집 Override) */
export async function setQuestTimeSpent(id: string, sec: number): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('quests').update({ time_spent_sec: Math.max(0, Math.floor(sec)) }).eq('id', id)
  if (error) console.error('[Supabase] setQuestTimeSpent 실패:', error.message)
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
type NoteTable = 'areas' | 'projects' | 'quests' | 'journals' | 'calendar_journal'

export async function fetchNoteContent(table: NoteTable, id: string): Promise<string> {
  if (!supabase) return ''
  try {
    if (table === 'calendar_journal') {
      const { data, error } = await supabase.from('calendar_events').select('content').eq('id', id).eq('event_type', 'journal').single()
      if (error || !data) return ''
      const c = (data as { content?: Record<string, unknown> }).content
      return String(c?.content ?? '')
    }
    const { data, error } = await supabase.from(table).select('content').eq('id', id).single()
    if (error || !data) return ''
    return (data as Record<string, unknown>).content as string ?? ''
  } catch { return '' }
}

export async function saveNoteContent(table: NoteTable, id: string, content: string): Promise<void> {
  if (!supabase) return
  if (table === 'calendar_journal') {
    const { data } = await supabase.from('calendar_events').select('content').eq('id', id).single()
    const prev = (data as { content?: Record<string, unknown> })?.content ?? {}
    await supabase.from('calendar_events').update({ content: { ...prev, content }, updated_at: new Date().toISOString() }).eq('id', id)
    return
  }
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
  time_score_applied?: number
  fortune_feedback?: string | null
}

export async function fetchDailyLog(recordDate: string): Promise<DailyLogRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('daily_logs')
    .select('log_date, total_pomodoros, total_time_sec, time_score_applied, fortune_feedback')
    .eq('log_date', recordDate)
    .maybeSingle()
  if (error || !data) return null
  return data as DailyLogRow
}

/** daily_logs fortune_feedback 업데이트 (운세 피드백 노트) */
export async function upsertDailyLogFortune(recordDate: string, fortuneFeedback: string): Promise<void> {
  if (!supabase) return
  const { data: existing } = await supabase
    .from('daily_logs')
    .select('log_date')
    .eq('log_date', recordDate)
    .maybeSingle()
  if (existing) {
    const { error } = await supabase
      .from('daily_logs')
      .update({ fortune_feedback: fortuneFeedback })
      .eq('log_date', recordDate)
    if (error) console.error('[Supabase] upsertDailyLogFortune update 실패:', error.message)
  } else {
    const { error } = await supabase
      .from('daily_logs')
      .insert({ log_date: recordDate, total_pomodoros: 0, total_time_sec: 0, fortune_feedback: fortuneFeedback })
    if (error) console.error('[Supabase] upsertDailyLogFortune insert 실패:', error.message)
  }
}

/** daily_logs time_score_applied 업데이트 (시간 점수→XP 동기화용) */
export async function updateDailyLogTimeScore(recordDate: string, timeScoreApplied: number): Promise<void> {
  if (!supabase) return
  const { data: row } = await supabase.from('daily_logs').select('log_date').eq('log_date', recordDate).maybeSingle()
  if (row) {
    await supabase.from('daily_logs').update({ time_score_applied: timeScoreApplied }).eq('log_date', recordDate)
  } else {
    await supabase.from('daily_logs').insert({ log_date: recordDate, total_pomodoros: 0, total_time_sec: 0, time_score_applied: timeScoreApplied })
  }
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

/** daily_logs total_time_sec 직접 설정 (수동 편집 Override) */
export async function setDailyLogTime(recordDate: string, totalTimeSec: number): Promise<{ total_pomodoros: number; total_time_sec: number } | null> {
  if (!supabase) return null
  const sec = Math.max(0, Math.floor(totalTimeSec))
  const { data: row } = await supabase.from('daily_logs').select('total_pomodoros, total_time_sec').eq('log_date', recordDate).maybeSingle()
  const pom = ((row as Record<string, unknown>)?.total_pomodoros as number) ?? 0
  if (row) {
    const { error } = await supabase.from('daily_logs').update({ total_time_sec: sec }).eq('log_date', recordDate)
    if (error) { console.error('[Supabase] setDailyLogTime 실패:', error.message); return null }
  } else {
    const { error } = await supabase.from('daily_logs').insert({ log_date: recordDate, total_pomodoros: 0, total_time_sec: sec })
    if (error) { console.error('[Supabase] setDailyLogTime insert 실패:', error.message); return null }
  }
  return { total_pomodoros: pom, total_time_sec: sec }
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
//  level_rewards 테이블 (레벨별 보상함)
// ══════════════════════════════════════════════════════════════════════════════
export interface LevelRewardRow {
  id: string
  target_level: number
  reward_text: string
  is_claimed: boolean
  created_at?: string
}

export async function fetchLevelRewards(): Promise<LevelRewardRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('level_rewards').select('*').order('target_level', { ascending: true })
  if (error) { console.error('[Supabase] fetchLevelRewards 실패:', error.message); return [] }
  return (data ?? []).map(r => ({ ...r, id: String(r.id) })) as LevelRewardRow[]
}

export async function insertLevelReward(targetLevel: number, rewardText: string): Promise<LevelRewardRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('level_rewards').insert({ target_level: targetLevel, reward_text: rewardText }).select().single()
  if (error) { console.error('[Supabase] insertLevelReward 실패:', error.message); return null }
  return { ...data, id: String(data.id) } as LevelRewardRow
}

export async function claimLevelReward(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('level_rewards').update({ is_claimed: true }).eq('id', id)
  if (error) console.error('[Supabase] claimLevelReward 실패:', error.message)
}

export async function deleteLevelReward(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('level_rewards').delete().eq('id', id)
  if (error) console.error('[Supabase] deleteLevelReward 실패:', error.message)
}

// ══════════════════════════════════════════════════════════════════════════════
//  fortune_decks & fortune_cards (타로 덱/카드)
// ══════════════════════════════════════════════════════════════════════════════
export interface FortuneDeckRow {
  id: string
  name: string
  description?: string | null
  cover_image_url?: string | null
  sort_order?: number
  created_at?: string
}

export interface FortuneCardRow {
  id: string
  deck_id: string
  name_ko: string
  name_en?: string | null
  emoji?: string | null
  meaning?: string | null
  sort_order?: number
}

export async function fetchFortuneDecks(): Promise<FortuneDeckRow[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('fortune_decks')
      .select('id, name, description, cover_image_url, sort_order, created_at')
      .order('sort_order', { ascending: true })
    if (error || !data) { if (error) console.error('[Supabase] fetchFortuneDecks 실패:', error.message); return [] }
    return data.map(r => ({ ...r, id: String(r.id) })) as FortuneDeckRow[]
  } catch (e) { console.error('[Supabase] fetchFortuneDecks 예외:', e); return [] }
}

export async function fetchFortuneCards(deckId: string): Promise<FortuneCardRow[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('fortune_cards')
      .select('id, deck_id, name_ko, name_en, emoji, meaning, sort_order')
      .eq('deck_id', deckId)
      .order('sort_order', { ascending: true })
    if (error || !data) { if (error) console.error('[Supabase] fetchFortuneCards 실패:', error.message); return [] }
    return data.map(r => ({ ...r, id: String(r.id), deck_id: String(r.deck_id) })) as FortuneCardRow[]
  } catch (e) { console.error('[Supabase] fetchFortuneCards 예외:', e); return [] }
}

export async function insertFortuneDeck(name: string, description?: string, coverImageUrl?: string): Promise<FortuneDeckRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('fortune_decks').insert({
    name,
    description: description?.trim() || null,
    cover_image_url: coverImageUrl?.trim() || null,
  }).select().single()
  if (error) { console.error('[Supabase] insertFortuneDeck 실패:', error.message); return null }
  return { ...data, id: String(data.id) } as FortuneDeckRow
}

export async function updateFortuneDeck(id: string, fields: { name?: string; description?: string; cover_image_url?: string }): Promise<FortuneDeckRow | null> {
  if (!supabase) return null
  const payload: Record<string, unknown> = {}
  if (fields.name !== undefined) payload.name = fields.name
  if (fields.description !== undefined) payload.description = fields.description?.trim() || null
  if (fields.cover_image_url !== undefined) payload.cover_image_url = fields.cover_image_url?.trim() || null
  if (Object.keys(payload).length === 0) return null
  const { data, error } = await supabase.from('fortune_decks').update(payload).eq('id', id).select().single()
  if (error) { console.error('[Supabase] updateFortuneDeck 실패:', error.message); return null }
  return { ...data, id: String(data.id) } as FortuneDeckRow
}

export async function deleteFortuneDeck(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('fortune_decks').delete().eq('id', id)
  if (error) { console.error('[Supabase] deleteFortuneDeck 실패:', error.message); return false }
  return true
}

export async function insertFortuneCard(deckId: string, nameKo: string, nameEn?: string, emoji?: string, meaning?: string): Promise<FortuneCardRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('fortune_cards').insert({ deck_id: deckId, name_ko: nameKo, name_en: nameEn ?? null, emoji: emoji ?? null, meaning: meaning ?? null }).select().single()
  if (error) { console.error('[Supabase] insertFortuneCard 실패:', error.message); return null }
  return { ...data, id: String(data.id), deck_id: String(data.deck_id) } as FortuneCardRow
}

// ══════════════════════════════════════════════════════════════════════════════
//  calendar_events (중앙 캘린더/이벤트 테이블)
//  모든 날짜 기반 데이터: 점괘(fortune), 저널(journal), 여행(travel), 퀘스트(quest), 이벤트(event)
//  event_type으로 엄격히 구분, 공통 CRUD: insertCalendarEvent, updateCalendarEvent, deleteCalendarEvent
//  각 도메인별 fetch* 함수가 event_type 필터로 해당 데이터만 조회
// ══════════════════════════════════════════════════════════════════════════════
export type CalendarEventType = 'fortune' | 'journal' | 'quest' | 'travel' | 'event'

export interface CalendarEventRow {
  id: string
  event_date: string
  event_type: CalendarEventType
  title: string
  content: Record<string, unknown>
  created_at: string
  updated_at?: string
}

export async function fetchCalendarEventsByType(eventType: CalendarEventType): Promise<CalendarEventRow[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('id, event_date, event_type, title, content, created_at, updated_at')
      .eq('event_type', eventType)
      .order('created_at', { ascending: false })
    if (error || !data) { if (error) console.error('[Supabase] fetchCalendarEventsByType 실패:', error.message); return [] }
    return data.map(r => ({ ...r, id: String(r.id), content: (r.content as Record<string, unknown>) ?? {} })) as CalendarEventRow[]
  } catch (e) { console.error('[Supabase] fetchCalendarEventsByType 예외:', e); return [] }
}

export async function fetchCalendarEventsInRange(eventType: CalendarEventType, startDate: string, endDate: string): Promise<CalendarEventRow[]> {
  if (!supabase) return []
  try {
    let q = supabase
      .from('calendar_events')
      .select('id, event_date, event_type, title, content, created_at, updated_at')
      .eq('event_type', eventType)
    if (eventType === 'event') {
      q = q.lte('event_date', endDate)
    } else {
      q = q.gte('event_date', startDate).lte('event_date', endDate)
    }
    const { data, error } = await q.order('created_at', { ascending: false })
    if (error || !data) { if (error) console.error('[Supabase] fetchCalendarEventsInRange 실패:', error.message); return [] }
    let rows = data.map(r => ({ ...r, id: String(r.id), content: (r.content as Record<string, unknown>) ?? {} })) as CalendarEventRow[]
    if (eventType === 'event') {
      rows = rows.filter(r => {
        const end = (r.content?.endDate as string) ?? r.event_date
        return end >= startDate
      })
    }
    return rows
  } catch (e) { console.error('[Supabase] fetchCalendarEventsInRange 예외:', e); return [] }
}

export async function insertCalendarEvent(eventType: CalendarEventType, eventDate: string, title: string, content: Record<string, unknown>): Promise<CalendarEventRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('calendar_events').insert({
    event_date: eventDate,
    event_type: eventType,
    title,
    content: content ?? {},
  }).select().single()
  if (error) { console.error('[Supabase] insertCalendarEvent 실패:', error.message); return null }
  return { ...data, id: String(data.id), content: (data.content as Record<string, unknown>) ?? {} } as CalendarEventRow
}

export async function updateCalendarEvent(id: string, patch: { event_date?: string; title?: string; content?: Record<string, unknown> }): Promise<CalendarEventRow | null> {
  if (!supabase) return null
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.event_date !== undefined) payload.event_date = patch.event_date
  if (patch.title !== undefined) payload.title = patch.title
  if (patch.content !== undefined) payload.content = patch.content
  const { data, error } = await supabase.from('calendar_events').update(payload).eq('id', id).select().single()
  if (error) { console.error('[Supabase] updateCalendarEvent 실패:', error.message); return null }
  return { ...data, id: String(data.id), content: (data.content as Record<string, unknown>) ?? {} } as CalendarEventRow
}

export async function deleteCalendarEvent(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('calendar_events').delete().eq('id', id)
  if (error) { console.error('[Supabase] deleteCalendarEvent 실패:', error.message); return false }
  return true
}

/** calendar_events (fortune) → ReadingLogRow 형식 변환 (Fortune UI 호환)
 * content JSONB: question, drawn_cards, notes, fortune_type, fortune_score, fortune_outcome, accuracy_score, related_people
 * 마이그레이션 데이터 호환: 다양한 키명 시도 */
function calendarEventToFortuneRow(ce: CalendarEventRow): ReadingLogRow {
  const c = (ce.content ?? {}) as Record<string, unknown>
  const source = c?.source as string
  const drawn = (c?.drawn_cards as unknown[]) ?? []
  const question = source === 'feedback'
    ? String(c?.fortune_feedback ?? c?.question ?? ce.title ?? '')
    : String(c?.question ?? ce.title ?? '')
  const eventDate = ce.event_date ?? ce.created_at?.slice(0, 10)
  const num = (v: unknown): number | null => (v == null || v === '') ? null : (typeof v === 'number' ? v : parseInt(String(v), 10) || null)
  return {
    id: ce.id,
    question,
    drawn_cards: drawn.map((x: unknown) => {
      const o = x as Record<string, unknown>
      return { emoji: String(o?.emoji ?? '🃏'), name_ko: String(o?.name_ko ?? o?.nameKo ?? ''), name_en: o?.name_en != null ? String(o.name_en) : (o?.nameEn != null ? String(o.nameEn) : undefined) }
    }),
    notes: (c?.notes as string) ?? null,
    created_at: ce.created_at,
    event_date: eventDate,
    fortune_type: (c?.fortune_type ?? c?.fortuneType) ? String(c?.fortune_type ?? c?.fortuneType).trim() || null : null,
    fortune_score: num(c?.fortune_score ?? c?.fortuneScore),
    fortune_outcome: ((c?.fortune_outcome ?? c?.fortuneOutcome) as string) === 'good' || ((c?.fortune_outcome ?? c?.fortuneOutcome) as string) === 'bad' ? (c?.fortune_outcome ?? c?.fortuneOutcome) as 'good' | 'bad' : null,
    accuracy_score: num(c?.accuracy_score ?? c?.accuracyScore),
    related_people: (c?.related_people ?? c?.relatedPeople) ? String(c?.related_people ?? c?.relatedPeople).trim() || null : null,
  }
}

/** reading_logs 행에 event_date 추가 (캘린더 표시용) */
function withEventDate(r: ReadingLogRow): ReadingLogRow {
  if (r.event_date) return r
  const ed = r.created_at?.slice(0, 10)
  return ed ? { ...r, event_date: ed } : r
}

/** 점괘용: calendar_events + reading_logs 병합 조회 (ReadingLogRow[] 반환)
 * calendar_events 우선, 없으면 reading_logs 폴백. 마이그레이션 전/실패 시에도 기존 데이터 표시 */
export async function fetchFortuneEvents(): Promise<ReadingLogRow[]> {
  const [fromCal, fromLegacy] = await Promise.all([
    fetchCalendarEventsByType('fortune'),
    fetchReadingLogs(),
  ])
  const calRows = fromCal.map(calendarEventToFortuneRow)
  const calIds = new Set(calRows.map(r => r.id))
  const legacyRows = fromLegacy.map(withEventDate).filter(r => !calIds.has(r.id))
  return [...calRows, ...legacyRows].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
}

/** 점괘용: 기간별 fortune 조회 (calendar_events + reading_logs 병합) */
export async function fetchFortuneEventsInRange(startDate: string, endDate: string): Promise<ReadingLogRow[]> {
  const [fromCal, fromLegacy] = await Promise.all([
    fetchCalendarEventsInRange('fortune', startDate, endDate),
    fetchReadingLogsInRange(startDate, endDate),
  ])
  const calRows = fromCal.map(calendarEventToFortuneRow)
  const calIds = new Set(calRows.map(r => r.id))
  const legacyRows = fromLegacy.map(withEventDate).filter(r => !calIds.has(r.id))
  return [...calRows, ...legacyRows].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
}

/** 점괘용: 새 점괘 기록 저장 (calendar_events에 저장) */
export async function insertFortuneEvent(question: string, drawnCards: DrawnCardItem[], eventDate?: string): Promise<ReadingLogRow | null> {
  const date = eventDate ?? new Date().toISOString().slice(0, 10)
  const payload = drawnCards.map(c => ({ emoji: c.emoji, name_ko: c.name_ko, name_en: c.name_en ?? null }))
  const content = { source: 'reading', question, drawn_cards: payload, notes: null }
  const title = payload.length ? `[점괘] ${payload.map(c => c.name_ko).join(', ')}` : '[점괘]'
  const row = await insertCalendarEvent('fortune', date, title, content)
  if (!row) return null
  return calendarEventToFortuneRow(row)
}

/** 점괘용: 운세 피드백 저장 (calendar_events에 저장, daily_logs에도 동기화) */
export async function insertFortuneFeedback(fortuneFeedback: string, recordDate: string): Promise<CalendarEventRow | null> {
  const content = { source: 'feedback', fortune_feedback: fortuneFeedback }
  const row = await insertCalendarEvent('fortune', recordDate, '운세 피드백', content)
  if (row) await upsertDailyLogFortune(recordDate, fortuneFeedback)
  return row
}

/** 점괘용: 점괘 기록 수정 (calendar_events 우선, 없으면 reading_logs 업데이트) */
export async function updateFortuneEvent(id: string, patch: { question?: string; notes?: string; created_at?: string; fortune_type?: string | null; fortune_score?: number | null; fortune_outcome?: 'good' | 'bad' | null; accuracy_score?: number | null; related_people?: string | null }): Promise<ReadingLogRow | null> {
  const existing = (await fetchCalendarEventsByType('fortune')).find(r => r.id === id)
  if (existing) {
    const c = { ...(existing.content as Record<string, unknown>) }
    if (patch.question !== undefined) c.question = patch.question
    if (patch.notes !== undefined) c.notes = patch.notes?.trim() || null
    if (patch.fortune_type !== undefined) c.fortune_type = patch.fortune_type
    if (patch.fortune_score !== undefined) c.fortune_score = patch.fortune_score
    if (patch.fortune_outcome !== undefined) c.fortune_outcome = patch.fortune_outcome
    if (patch.accuracy_score !== undefined) c.accuracy_score = patch.accuracy_score
    if (patch.related_people !== undefined) c.related_people = patch.related_people?.trim() || null
    const eventDate = patch.created_at ? patch.created_at.slice(0, 10) : existing.event_date
    const title = (c.drawn_cards as unknown[])?.length ? `[점괘] ${(c.drawn_cards as { name_ko: string }[]).map(x => x.name_ko).join(', ')}` : String(c.question || '[점괘]')
    const updated = await updateCalendarEvent(id, { event_date: eventDate, title, content: c })
    return updated ? calendarEventToFortuneRow(updated) : null
  }
  const legacyUpdated = await updateReadingLog(id, {
    question: patch.question,
    notes: patch.notes,
    created_at: patch.created_at,
    fortune_type: patch.fortune_type,
    fortune_score: patch.fortune_score,
    fortune_outcome: patch.fortune_outcome,
    accuracy_score: patch.accuracy_score,
    related_people: patch.related_people,
  })
  return legacyUpdated ? withEventDate(legacyUpdated) : null
}

/** 점괘용: 점괘 기록 삭제 (calendar_events + reading_logs 둘 다 시도, 마이그레이션 전 데이터 처리) */
export async function deleteFortuneEvent(id: string): Promise<boolean> {
  const fromCal = await deleteCalendarEvent(id)
  const fromLegacy = await deleteReadingLog(id)
  return fromCal || fromLegacy
}

/** calendar_events (journal) → JournalNoteRow 형식 변환 */
function calendarEventToJournalRow(ce: CalendarEventRow): JournalNoteRow {
  const c = ce.content as Record<string, unknown>
  return {
    id: parseInt(ce.id.slice(0, 8), 16) || 0,
    record_date: ce.event_date,
    title: ce.title,
    content: String(c?.content ?? ''),
    group_name: String(c?.group_name ?? ''),
    sub_name: String(c?.sub_name ?? ''),
    created_at: ce.created_at,
  }
}

/** 저널용: calendar_events에서 journal 타입 조회 (id는 string, UnifiedCalendar용) */
export async function fetchJournalEventsInRange(startDate: string, endDate: string): Promise<Array<Omit<JournalNoteRow, 'id'> & { id: string }>> {
  const rows = await fetchCalendarEventsInRange('journal', startDate, endDate)
  return rows.map(ce => ({
    ...calendarEventToJournalRow(ce),
    id: ce.id,
  }))
}

/** 저널용: calendar_events에서 journal 타입 전체 조회 (Journal 메뉴용) */
export async function fetchJournalEvents(): Promise<Array<Omit<JournalNoteRow, 'id'> & { id: string }>> {
  const rows = await fetchCalendarEventsByType('journal')
  return rows.map(ce => ({
    ...calendarEventToJournalRow(ce),
    id: ce.id,
  }))
}

/** 저널용: journal이 있는 날짜 목록 (calendar_events 기반) */
export async function fetchJournalEventDates(): Promise<string[]> {
  const rows = await fetchCalendarEventsByType('journal')
  return [...new Set(rows.map(r => r.event_date))]
}

/** 저널용: calendar_events에 저장 */
export async function insertJournalEvent(note: Omit<JournalNoteRow, 'id' | 'created_at'>): Promise<(Omit<JournalNoteRow, 'id'> & { id: string }) | null> {
  const content = { content: note.content, group_name: note.group_name, sub_name: note.sub_name }
  const row = await insertCalendarEvent('journal', note.record_date, note.title, content)
  if (!row) return null
  return { ...note, id: row.id, created_at: row.created_at }
}

/** 저널용: calendar_events 수정 */
export async function updateJournalEvent(id: string, fields: Partial<Pick<JournalNoteRow, 'title' | 'content' | 'record_date' | 'group_name' | 'sub_name'>>): Promise<void> {
  const existing = (await fetchCalendarEventsByType('journal')).find(r => r.id === id)
  if (!existing) return
  const c = { ...(existing.content as Record<string, unknown>) }
  if (fields.title !== undefined) await updateCalendarEvent(id, { title: fields.title })
  if (fields.record_date !== undefined) await updateCalendarEvent(id, { event_date: fields.record_date })
  if (fields.content !== undefined || fields.group_name !== undefined || fields.sub_name !== undefined) {
    if (fields.content !== undefined) c.content = fields.content
    if (fields.group_name !== undefined) c.group_name = fields.group_name
    if (fields.sub_name !== undefined) c.sub_name = fields.sub_name
    await updateCalendarEvent(id, { content: c })
  }
}

/** 저널용: calendar_events 삭제 */
export async function deleteJournalEvent(id: string): Promise<boolean> {
  return deleteCalendarEvent(id)
}

/** 캘린더 이벤트용: CalEvent 형식 (startDate, endDate, color, note) */
export type CalEventPayload = { startDate: string; endDate: string; color: string; note: string }

/** calendar_events (event) → CalEvent 형식 변환 */
function calendarEventToCalEvent(ce: CalendarEventRow): CalEventPayload & { id: string } {
  const c = ce.content as Record<string, unknown>
  return {
    id: ce.id,
    startDate: ce.event_date,
    endDate: String(c?.endDate ?? ce.event_date),
    color: String(c?.color ?? '#6366f1'),
    note: String(c?.note ?? ''),
  }
}

/** 캘린더 이벤트용: calendar_events에서 event 타입 조회 */
export async function fetchEventEventsInRange(startDate: string, endDate: string): Promise<(CalEventPayload & { id: string })[]> {
  const rows = await fetchCalendarEventsInRange('event', startDate, endDate)
  return rows.map(calendarEventToCalEvent)
}

/** 캘린더 이벤트용: calendar_events에 저장 */
export async function insertEventEvent(ev: CalEventPayload & { title: string }): Promise<CalendarEventRow | null> {
  const content = { endDate: ev.endDate, color: ev.color, note: ev.note }
  return insertCalendarEvent('event', ev.startDate, ev.title, content)
}

/** 캘린더 이벤트용: calendar_events 수정 */
export async function updateEventEvent(id: string, ev: Partial<CalEventPayload & { title: string }>): Promise<CalendarEventRow | null> {
  const existing = (await fetchCalendarEventsByType('event')).find(r => r.id === id)
  if (!existing) return null
  const c = { ...(existing.content as Record<string, unknown>) }
  if (ev.endDate !== undefined) c.endDate = ev.endDate
  if (ev.color !== undefined) c.color = ev.color
  if (ev.note !== undefined) c.note = ev.note
  return updateCalendarEvent(id, {
    event_date: ev.startDate ?? existing.event_date,
    title: ev.title ?? existing.title,
    content: c,
  })
}

/** 캘린더 이벤트용: calendar_events 삭제 */
export async function deleteEventEvent(id: string): Promise<boolean> {
  return deleteCalendarEvent(id)
}

// ══════════════════════════════════════════════════════════════════════════════
//  reading_logs (점괘 기록) — 레거시, calendar_events로 통합됨
//  하위 호환을 위해 ReadingLogRow 타입 유지, calendar_events ↔ ReadingLogRow 변환
// ══════════════════════════════════════════════════════════════════════════════
export type DrawnCardItem = { emoji: string; name_ko: string; name_en?: string }

export interface ReadingLogRow {
  id: string
  question: string
  drawn_cards: DrawnCardItem[]
  notes?: string | null
  created_at: string
  /** calendar_events.event_date (YYYY-MM-DD) — 캘린더 표시용, 없으면 created_at 기반 */
  event_date?: string
  fortune_type?: string | null
  fortune_score?: number | null
  fortune_outcome?: 'good' | 'bad' | null
  accuracy_score?: number | null
  related_people?: string | null
}

function normalizeDrawnCards(raw: unknown): DrawnCardItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x: unknown) => {
    const o = x as Record<string, unknown>
    return {
      emoji: String(o?.emoji ?? '🃏'),
      name_ko: String(o?.name_ko ?? ''),
      name_en: o?.name_en != null ? String(o.name_en) : undefined,
    }
  })
}

export async function insertReadingLog(question: string, drawnCards: DrawnCardItem[]): Promise<ReadingLogRow | null> {
  if (!supabase) return null
  const payload = drawnCards.map(c => ({ emoji: c.emoji, name_ko: c.name_ko, name_en: c.name_en ?? null }))
  const { data, error } = await supabase.from('reading_logs').insert({
    question,
    drawn_cards: payload,
    notes: null,
  }).select().single()
  if (error) { console.error('[Supabase] insertReadingLog 실패:', error.message); return null }
  return { ...data, id: String(data.id), drawn_cards: normalizeDrawnCards(data.drawn_cards), notes: (data as { notes?: string }).notes ?? null } as ReadingLogRow
}

export async function fetchReadingLogs(): Promise<ReadingLogRow[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('reading_logs')
      .select('id, question, drawn_cards, notes, created_at, fortune_type, fortune_score, fortune_outcome, accuracy_score, related_people')
      .order('created_at', { ascending: false })
    if (error || !data) { if (error) console.error('[Supabase] fetchReadingLogs 실패:', error.message); return [] }
    return data.map(r => ({
      ...r,
      id: String(r.id),
      drawn_cards: normalizeDrawnCards((r as { drawn_cards?: unknown }).drawn_cards),
      notes: (r as { notes?: string }).notes ?? null,
      fortune_type: (r as { fortune_type?: string }).fortune_type ?? null,
      fortune_score: (r as { fortune_score?: number }).fortune_score ?? null,
      fortune_outcome: (r as { fortune_outcome?: 'good' | 'bad' }).fortune_outcome ?? null,
      accuracy_score: (r as { accuracy_score?: number }).accuracy_score ?? null,
      related_people: (r as { related_people?: string }).related_people ?? null,
    })) as ReadingLogRow[]
  } catch (e) { console.error('[Supabase] fetchReadingLogs 예외:', e); return [] }
}

export async function fetchReadingLogsInRange(startDate: string, endDate: string): Promise<ReadingLogRow[]> {
  if (!supabase) return []
  try {
    const startTs = `${startDate}T00:00:00.000Z`
    const endTs = `${endDate}T23:59:59.999Z`
    const { data, error } = await supabase
      .from('reading_logs')
      .select('id, question, drawn_cards, notes, created_at, fortune_type, fortune_score, fortune_outcome, accuracy_score, related_people')
      .gte('created_at', startTs)
      .lte('created_at', endTs)
      .order('created_at', { ascending: false })
    if (error || !data) { if (error) console.error('[Supabase] fetchReadingLogsInRange 실패:', error.message); return [] }
    return data.map(r => ({
      ...r,
      id: String(r.id),
      drawn_cards: normalizeDrawnCards((r as { drawn_cards?: unknown }).drawn_cards),
      notes: (r as { notes?: string }).notes ?? null,
      fortune_type: (r as { fortune_type?: string }).fortune_type ?? null,
      fortune_score: (r as { fortune_score?: number }).fortune_score ?? null,
      fortune_outcome: (r as { fortune_outcome?: 'good' | 'bad' }).fortune_outcome ?? null,
      accuracy_score: (r as { accuracy_score?: number }).accuracy_score ?? null,
      related_people: (r as { related_people?: string }).related_people ?? null,
    })) as ReadingLogRow[]
  } catch (e) { console.error('[Supabase] fetchReadingLogsInRange 예외:', e); return [] }
}

export async function deleteReadingLog(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('reading_logs').delete().eq('id', id)
  if (error) { console.error('[Supabase] deleteReadingLog 실패:', error.message); return false }
  return true
}

export async function updateReadingLogNotes(id: string, notes: string): Promise<ReadingLogRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('reading_logs').update({ notes: notes.trim() || null }).eq('id', id).select().single()
  if (error) { console.error('[Supabase] updateReadingLogNotes 실패:', error.message); return null }
  return { ...data, id: String(data.id), drawn_cards: normalizeDrawnCards((data as { drawn_cards?: unknown }).drawn_cards), notes: (data as { notes?: string }).notes ?? null } as ReadingLogRow
}

export type ReadingLogPatch = {
  question?: string
  notes?: string
  created_at?: string
  fortune_type?: string | null
  fortune_score?: number | null
  fortune_outcome?: 'good' | 'bad' | null
  accuracy_score?: number | null
  related_people?: string | null
}
export async function updateReadingLog(id: string, patch: ReadingLogPatch): Promise<ReadingLogRow | null> {
  if (!supabase) return null
  const payload: Record<string, unknown> = {}
  if (patch.question !== undefined) payload.question = patch.question
  if (patch.notes !== undefined) payload.notes = patch.notes.trim() || null
  if (patch.created_at !== undefined) payload.created_at = patch.created_at
  if (patch.fortune_type !== undefined) payload.fortune_type = patch.fortune_type ?? null
  if (patch.fortune_score !== undefined) payload.fortune_score = patch.fortune_score ?? null
  if (patch.fortune_outcome !== undefined) payload.fortune_outcome = patch.fortune_outcome ?? null
  if (patch.accuracy_score !== undefined) payload.accuracy_score = patch.accuracy_score ?? null
  if (patch.related_people !== undefined) payload.related_people = patch.related_people?.trim() || null
  if (Object.keys(payload).length === 0) return null
  const { data, error } = await supabase.from('reading_logs').update(payload).eq('id', id).select().single()
  if (error) { console.error('[Supabase] updateReadingLog 실패:', error.message); return null }
  return { ...data, id: String(data.id), drawn_cards: normalizeDrawnCards((data as { drawn_cards?: unknown }).drawn_cards), notes: (data as { notes?: string }).notes ?? null } as ReadingLogRow
}

// ══════════════════════════════════════════════════════════════════════════════
//  daily_logs 캘린더용 (날짜별 fortune_feedback 등)
// ══════════════════════════════════════════════════════════════════════════════
export interface DailyLogCalendarRow {
  log_date: string
  fortune_feedback?: string | null
  total_pomodoros?: number
}

export async function fetchDailyLogsInRange(startDate: string, endDate: string): Promise<DailyLogCalendarRow[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('daily_logs')
      .select('log_date, fortune_feedback, total_pomodoros')
      .gte('log_date', startDate)
      .lte('log_date', endDate)
    if (error || !data) return []
    return data as DailyLogCalendarRow[]
  } catch { return [] }
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
