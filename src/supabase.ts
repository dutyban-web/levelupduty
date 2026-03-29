import { type Session, type PostgrestError } from '@supabase/supabase-js'
import { supabase, isSupabaseReady } from './lib/supabase'
import { SOLUTION_BOOK_TITLE } from './solutionBookPhrases'
import { clampUnifiedOverallRating } from './unifiedOverallRatingData'

export type { Session }
export { supabase, isSupabaseReady }

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

/** 이메일 OTP 발송 (기존 가입 이메일만 — shouldCreateUser: false) */
export async function sendEmailOtp(email: string): Promise<void> {
  if (!supabase) throw new Error('Supabase 클라이언트가 없습니다.')
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  })
  if (error) throw error
}

/** 이메일 OTP 검증 */
export async function verifyEmailOtp(email: string, token: string) {
  if (!supabase) throw new Error('Supabase 클라이언트가 없습니다.')
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })
  if (error) throw error
  return data
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  if (!supabase) return () => { }
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return () => subscription.unsubscribe()
}

// ══════════════════════════════════════════════════════════════════════════════
//  unified_people + person_entity_links — 통합 인물 DB (다른 모듈 삭제 시 링크 정리용 포함)
// ══════════════════════════════════════════════════════════════════════════════

export interface UnifiedPersonRow {
  id: string
  user_id: string
  display_name: string
  sort_order: number
  note: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface PersonEntityLinkRow {
  id: string
  user_id: string
  person_id: string
  entity_type: string
  entity_id: string
  role: string | null
  created_at: string
}

function parseUnifiedPerson(r: Record<string, unknown>): UnifiedPersonRow {
  const meta = r.metadata
  return {
    id: String(r.id ?? ''),
    user_id: String(r.user_id ?? ''),
    display_name: String(r.display_name ?? ''),
    sort_order: Number(r.sort_order ?? 0),
    note: r.note != null && String(r.note).trim() !== '' ? String(r.note) : null,
    metadata: typeof meta === 'object' && meta !== null && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {},
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  }
}

async function _peopleUserId(): Promise<string | null> {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user?.id) return session.user.id
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

/** 엔티티 삭제 시 연결된 인물 링크 제거 (외부에서도 사용 가능) */
export async function deletePersonEntityLinksForEntity(entityType: string, entityId: string): Promise<void> {
  if (!supabase) return
  const uid = await _peopleUserId()
  if (!uid) return
  try {
    const { error } = await supabase
      .from('person_entity_links')
      .delete()
      .eq('user_id', uid)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
    if (error) console.error('[Supabase] deletePersonEntityLinksForEntity:', error.message)
  } catch (e) {
    console.error('[Supabase] deletePersonEntityLinksForEntity 예외:', e)
  }
}

export async function fetchUnifiedPeople(): Promise<UnifiedPersonRow[]> {
  if (!supabase) return []
  const uid = await _peopleUserId()
  if (!uid) return []
  try {
    const { data, error } = await supabase
      .from('unified_people')
      .select('id, user_id, display_name, sort_order, note, metadata, created_at, updated_at')
      .eq('user_id', uid)
      .order('sort_order', { ascending: true })
      .order('updated_at', { ascending: false })
    if (error || !data) {
      if (error) console.error('[Supabase] fetchUnifiedPeople 실패:', error.message)
      return []
    }
    return data.map(r => parseUnifiedPerson(r as Record<string, unknown>))
  } catch (e) {
    console.error('[Supabase] fetchUnifiedPeople 예외:', e)
    return []
  }
}

export async function insertUnifiedPerson(displayName = '이름 없음'): Promise<UnifiedPersonRow | null> {
  if (!supabase) return null
  const uid = await _peopleUserId()
  if (!uid) return null
  const { count } = await supabase.from('unified_people').select('*', { count: 'exact', head: true }).eq('user_id', uid)
  const sortOrder = count ?? 0
  const { data, error } = await supabase
    .from('unified_people')
    .insert({
      user_id: uid,
      display_name: displayName.trim() || '이름 없음',
      sort_order: sortOrder,
      note: null,
      metadata: {},
    })
    .select('id, user_id, display_name, sort_order, note, metadata, created_at, updated_at')
    .single()
  if (error) {
    console.error('[Supabase] insertUnifiedPerson 실패:', error.message)
    return null
  }
  return parseUnifiedPerson(data as Record<string, unknown>)
}

export async function updateUnifiedPerson(
  id: string,
  patch: { display_name?: string; note?: string | null; sort_order?: number; metadata?: Record<string, unknown> },
): Promise<boolean> {
  if (!supabase) return false
  const uid = await _peopleUserId()
  if (!uid) return false
  const p: Record<string, unknown> = {}
  if (patch.display_name !== undefined) p.display_name = patch.display_name
  if (patch.note !== undefined) p.note = patch.note
  if (patch.sort_order !== undefined) p.sort_order = patch.sort_order
  if (patch.metadata !== undefined) p.metadata = patch.metadata
  if (Object.keys(p).length === 0) return true
  p.updated_at = new Date().toISOString()
  const { error } = await supabase.from('unified_people').update(p).eq('id', id).eq('user_id', uid)
  if (error) {
    console.error('[Supabase] updateUnifiedPerson 실패:', error.message)
    return false
  }
  return true
}

export async function deleteUnifiedPerson(id: string): Promise<boolean> {
  if (!supabase) return false
  const uid = await _peopleUserId()
  if (!uid) return false
  const { error } = await supabase.from('unified_people').delete().eq('id', id).eq('user_id', uid)
  if (error) {
    console.error('[Supabase] deleteUnifiedPerson 실패:', error.message)
    return false
  }
  return true
}

export async function fetchPersonIdsForEntity(entityType: string, entityId: string): Promise<string[]> {
  if (!supabase) return []
  const uid = await _peopleUserId()
  if (!uid) return []
  try {
    const { data, error } = await supabase
      .from('person_entity_links')
      .select('person_id')
      .eq('user_id', uid)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
    if (error || !data) {
      if (error) console.error('[Supabase] fetchPersonIdsForEntity 실패:', error.message)
      return []
    }
    return data.map(r => String((r as { person_id: string }).person_id))
  } catch (e) {
    console.error('[Supabase] fetchPersonIdsForEntity 예외:', e)
    return []
  }
}

export async function replacePersonLinksForEntity(
  entityType: string,
  entityId: string,
  personIds: string[],
): Promise<boolean> {
  if (!supabase) return false
  const uid = await _peopleUserId()
  if (!uid) return false
  const unique = Array.from(new Set(personIds.filter(Boolean)))
  try {
    const { error: delErr } = await supabase
      .from('person_entity_links')
      .delete()
      .eq('user_id', uid)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
    if (delErr) {
      console.error('[Supabase] replacePersonLinks 삭제 실패:', delErr.message)
      return false
    }
    if (unique.length === 0) return true
    const rows = unique.map(person_id => ({
      user_id: uid,
      person_id,
      entity_type: entityType,
      entity_id: entityId,
      role: null as string | null,
    }))
    const { error: insErr } = await supabase.from('person_entity_links').insert(rows)
    if (insErr) {
      console.error('[Supabase] replacePersonLinks 삽입 실패:', insErr.message)
      return false
    }
    return true
  } catch (e) {
    console.error('[Supabase] replacePersonLinksForEntity 예외:', e)
    return false
  }
}

export async function fetchPersonEntityLinksForPerson(personId: string): Promise<PersonEntityLinkRow[]> {
  if (!supabase) return []
  const uid = await _peopleUserId()
  if (!uid) return []
  try {
    const { data, error } = await supabase
      .from('person_entity_links')
      .select('id, user_id, person_id, entity_type, entity_id, role, created_at')
      .eq('user_id', uid)
      .eq('person_id', personId)
      .order('created_at', { ascending: false })
    if (error || !data) {
      if (error) console.error('[Supabase] fetchPersonEntityLinksForPerson 실패:', error.message)
      return []
    }
    return data.map(r => {
      const x = r as Record<string, unknown>
      return {
        id: String(x.id ?? ''),
        user_id: String(x.user_id ?? ''),
        person_id: String(x.person_id ?? ''),
        entity_type: String(x.entity_type ?? ''),
        entity_id: String(x.entity_id ?? ''),
        role: x.role != null ? String(x.role) : null,
        created_at: String(x.created_at ?? ''),
      }
    })
  } catch (e) {
    console.error('[Supabase] fetchPersonEntityLinksForPerson 예외:', e)
    return []
  }
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

export type InsertIdentityResult = { row: IdentityRow } | { error: string }

export async function insertIdentity(name: string, role_model?: string | null): Promise<InsertIdentityResult> {
  if (!supabase) return { error: 'Supabase가 연결되지 않았습니다. .env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 확인하세요.' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }
  const { data, error } = await supabase
    .from('identities')
    .insert({ user_id: user.id, name, role_model: role_model ?? null })
    .select('id, name, role_model, time_spent_sec, xp, sort_order, created_at')
    .single()
  if (error) {
    console.error('[Supabase] insertIdentity 실패:', error.message)
    return { error: error.message || '정체성 추가에 실패했습니다.' }
  }
  const r = data as Record<string, unknown>
  return {
    row: {
      id: String(r.id),
      name: r.name as string,
      role_model: r.role_model as string | null | undefined,
      time_spent_sec: (r.time_spent_sec ?? 0) as number,
      xp: (r.xp ?? 0) as number,
      sort_order: r.sort_order as number | undefined,
      created_at: r.created_at as string | undefined,
    },
  }
}

export async function updateIdentity(id: string, name: string, role_model?: string | null): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('identities').update({ name, role_model: role_model ?? null }).eq('id', id)
  if (error) {
    console.error('[Supabase] updateIdentity 실패:', error.message)
    return false
  }
  return true
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

/** 현재 활성화된 정체성 ID 조회 (user_settings.current_identity_id) */
export async function fetchActiveIdentity(): Promise<string | null> {
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('user_settings')
    .select('current_identity_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) { console.error('[Supabase] fetchActiveIdentity 실패:', error.message); return null }
  return data?.current_identity_id ? String(data.current_identity_id) : null
}

/** 활성 정체성 업데이트 (user_settings.current_identity_id) */
export async function updateActiveIdentity(identityId: string | null): Promise<boolean> {
  if (!supabase) return false
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { error } = await supabase.from('user_settings').upsert(
    { user_id: user.id, current_identity_id: identityId, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )
  if (error) { console.error('[Supabase] updateActiveIdentity 실패:', error.message); return false }
  return true
}

/** 집중 세션 완료: 활성 태세에 XP/시간 적립 + calendar_events에 focus_log 추가
 * XP = 분 × 10 (최소 1)
 * @returns { xpGain, identityName } 성공 시, null 실패 시 */
export type FocusSessionMeta = {
  /** 현재 포모도로에 연결된 퀘스트 (통합 캘린더·로그 추적용) */
  questId?: string | null
  questTitle?: string | null
}

export type AddFocusSessionResult =
  | { xpGain: number; identityName: string; focusLogId?: string }
  | { error: string }

/** 집중 완료 시 호출. focus_log.content 에 시작 시각(HH:mm)·퀘스트 메타를 넣어 위클리 타임그리드에 표시합니다. */
export async function addFocusSession(seconds: number, meta?: FocusSessionMeta): Promise<AddFocusSessionResult> {
  if (!supabase || seconds <= 0) return { error: '유효하지 않은 집중 시간입니다.' }
  const identityId = await fetchActiveIdentity()
  if (!identityId) return { error: '먼저 태세를 선택해주세요.' }
  const { data: identity } = await supabase.from('identities').select('id, name, time_spent_sec, xp').eq('id', identityId).single()
  if (!identity) return { error: '선택한 정체성을 찾을 수 없습니다.' }
  const curSec = (identity.time_spent_sec ?? 0) as number
  const curXp = (identity.xp ?? 0) as number
  const xpGain = Math.max(1, Math.floor(seconds / 60) * 10)
  const newSec = curSec + seconds
  const newXp = curXp + xpGain
  const { error: updErr } = await supabase.from('identities').update({ time_spent_sec: newSec, xp: newXp }).eq('id', identityId)
  if (updErr) { console.error('[Supabase] addFocusSession identities 업데이트 실패:', updErr.message); return { error: 'XP 적립에 실패했습니다.' } }
  const today = new Date().toISOString().split('T')[0]
  const minutes = Math.floor(seconds / 60)
  const now = new Date()
  const start_time_local = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const qid = meta?.questId ?? null
  const qtitle = meta?.questTitle ?? null
  const title =
    qtitle && String(qtitle).trim()
      ? `[집중] ${String(qtitle).slice(0, 40)}${String(qtitle).length > 40 ? '…' : ''} · ${minutes}분`
      : `[집중] ${identity.name} 태세로 ${minutes}분 몰입`
  const content: Record<string, unknown> = {
    identity_id: identityId,
    identity_name: identity.name,
    seconds,
    minutes,
    xp_gain: xpGain,
    start_time_local,
    quest_id: qid,
    quest_title: qtitle,
    source: 'pomodoro_complete',
  }
  const { data: insData, error: insErr } = await supabase
    .from('calendar_events')
    .insert({
      event_date: today,
      event_type: 'focus_log',
      title,
      content,
    })
    .select('id')
    .single()
  if (insErr) console.error('[Supabase] addFocusSession focus_log insert 실패:', insErr.message)
  const focusLogId = insData?.id != null ? String(insData.id) : undefined
  return { xpGain, identityName: identity.name as string, focusLogId }
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
  /** 휴지통(소프트 삭제) — DB에 컬럼 추가 후 사용 */
  is_deleted?: boolean
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
      .select('id, title, category, is_completed, project_id, identity_id, status, tags, sort_order, priority, deadline, started_at, ended_at, time_spent_sec, remaining_time_sec, pomodoro_count, is_deleted')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true })
    if (error || !data) {
      if (error) console.error('[Supabase] fetchUserCreatedQuests 실패:', error.message)
      return []
    }
    return (data
      .map(r => {
        let tags: string[] = []
        try {
          const t = (r as Record<string, unknown>).tags
          if (Array.isArray(t)) tags = t as string[]
          else if (typeof t === 'string') tags = JSON.parse(t || '[]') as string[]
        } catch { /* ignore */ }
        return {
          ...r,
          id: String(r.id),
          project_id: r.project_id != null ? String(r.project_id) : null,
          identity_id: r.identity_id != null ? String(r.identity_id) : null,
          tags,
        }
      }) as UserQuestRow[])
      .filter(r => r.is_deleted !== true)
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
  const payload: Record<string, unknown> = { title, category, is_completed: false, is_deleted: false }
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

/** 퀘스트 소프트 삭제(휴지통) */
export async function softDeleteUserQuestRow(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('quests').update({ is_deleted: true }).eq('id', id)
  if (error) {
    console.error('[Supabase] softDeleteUserQuestRow 실패:', error.message)
    return false
  }
  return true
}

export async function restoreUserQuestRow(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('quests').update({ is_deleted: false }).eq('id', id)
  if (error) {
    console.error('[Supabase] restoreUserQuestRow 실패:', error.message)
    return false
  }
  return true
}

/** 휴지통에서 영구 삭제 */
export async function permanentDeleteUserQuestRow(id: string): Promise<void> {
  if (!supabase) return
  await deletePersonEntityLinksForEntity('user_quest', id)
  const { error } = await supabase.from('quests').delete().eq('id', id)
  if (error) console.error('[Supabase] permanentDeleteUserQuestRow 실패:', error.message)
}

/** @deprecated permanentDeleteUserQuestRow 사용 */
export async function deleteUserQuestRow(id: string): Promise<void> {
  await permanentDeleteUserQuestRow(id)
}

/** 휴지통용 — 삭제된 사용자 퀘스트만 */
export async function fetchTrashedUserQuests(): Promise<UserQuestRow[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('quests')
      .select('id, title, category, is_completed, project_id, identity_id, status, tags, sort_order, priority, deadline, started_at, ended_at, time_spent_sec, remaining_time_sec, pomodoro_count, is_deleted')
      .eq('is_deleted', true)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: false })
    if (error || !data) {
      if (error) console.error('[Supabase] fetchTrashedUserQuests 실패:', error.message)
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
        id: String(r.id),
        project_id: r.project_id != null ? String(r.project_id) : null,
        identity_id: r.identity_id != null ? String(r.identity_id) : null,
        tags,
        is_deleted: true,
      }
    }) as UserQuestRow[]
  } catch (e) {
    console.error('[Supabase] fetchTrashedUserQuests 예외:', e)
    return []
  }
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
    if (params?.group_name) q = q.eq('group_name', params.group_name)
    if (params?.sub_name) q = q.eq('sub_name', params.sub_name)
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
export type CalendarEventType = 'fortune' | 'journal' | 'quest' | 'travel' | 'event' | 'focus_log'

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

export async function updateCalendarEvent(id: string, patch: { event_date?: string; title?: string; content?: Record<string, unknown>; created_at?: string }): Promise<CalendarEventRow | null> {
  if (!supabase) return null
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.event_date !== undefined) payload.event_date = patch.event_date
  if (patch.title !== undefined) payload.title = patch.title
  if (patch.content !== undefined) payload.content = patch.content
  if (patch.created_at !== undefined) payload.created_at = patch.created_at
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
  let fortuneType = (c?.fortune_type ?? c?.fortuneType) ? String(c?.fortune_type ?? c?.fortuneType).trim() || null : null
  let readingKind = (c?.reading_kind ?? c?.readingKind) ? String(c?.reading_kind ?? c?.readingKind).trim() || null : null
  if (source === 'solution_book') {
    fortuneType = null
    if (!readingKind) readingKind = SOLUTION_BOOK_TITLE
  } else if (fortuneType === SOLUTION_BOOK_TITLE) {
    readingKind = readingKind || SOLUTION_BOOK_TITLE
    fortuneType = null
  }
  if (!readingKind && typeof c?.deck_name === 'string' && c.deck_name.trim()) {
    readingKind = c.deck_name.trim()
  }
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
    fortune_type: fortuneType,
    reading_kind: readingKind,
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
export async function insertFortuneEvent(
  question: string,
  drawnCards: DrawnCardItem[],
  opts?: { eventDate?: string; deckId?: string; deckName?: string },
): Promise<ReadingLogRow | null> {
  const date = opts?.eventDate ?? new Date().toISOString().slice(0, 10)
  const payload = drawnCards.map(c => ({ emoji: c.emoji, name_ko: c.name_ko, name_en: c.name_en ?? null }))
  const content: Record<string, unknown> = {
    source: 'reading',
    question,
    drawn_cards: payload,
    notes: null,
  }
  if (opts?.deckId) content.deck_id = opts.deckId
  if (opts?.deckName) {
    content.deck_name = opts.deckName
    content.reading_kind = opts.deckName
  }
  const title = payload.length ? `[점괘] ${payload.map(c => c.name_ko).join(', ')}` : '[점괘]'
  const row = await insertCalendarEvent('fortune', date, title, content)
  if (!row) return null
  return calendarEventToFortuneRow(row)
}

/** 점괘용: 해결의 책 한 줄 답 저장 (calendar_events fortune, 아카이브·캘린더와 동일 파이프라인) */
export async function insertSolutionBookEvent(phrase: string, eventDate?: string): Promise<ReadingLogRow | null> {
  const date = eventDate ?? new Date().toISOString().slice(0, 10)
  const content: Record<string, unknown> = {
    source: 'solution_book',
    question: SOLUTION_BOOK_TITLE,
    solution_phrase: phrase,
    drawn_cards: [{ emoji: '📖', name_ko: phrase }],
    notes: null,
    reading_kind: SOLUTION_BOOK_TITLE,
  }
  const row = await insertCalendarEvent('fortune', date, SOLUTION_BOOK_TITLE, content)
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
export async function updateFortuneEvent(id: string, patch: { question?: string; notes?: string; created_at?: string; fortune_type?: string | null; reading_kind?: string | null; fortune_score?: number | null; fortune_outcome?: 'good' | 'bad' | null; accuracy_score?: number | null; related_people?: string | null }): Promise<ReadingLogRow | null> {
  const existing = (await fetchCalendarEventsByType('fortune')).find(r => r.id === id)
  if (existing) {
    const c = { ...(existing.content as Record<string, unknown>) }
    if (patch.question !== undefined) c.question = patch.question
    if (patch.notes !== undefined) c.notes = patch.notes?.trim() || null
    if (patch.fortune_type !== undefined) c.fortune_type = patch.fortune_type
    if (patch.reading_kind !== undefined) c.reading_kind = patch.reading_kind
    if (patch.fortune_score !== undefined) c.fortune_score = patch.fortune_score
    if (patch.fortune_outcome !== undefined) c.fortune_outcome = patch.fortune_outcome
    if (patch.accuracy_score !== undefined) c.accuracy_score = patch.accuracy_score
    if (patch.related_people !== undefined) c.related_people = patch.related_people?.trim() || null
    const eventDate = patch.created_at ? patch.created_at.slice(0, 10) : existing.event_date
    const drawnList = ((c.drawn_cards as unknown[]) ?? []) as { name_ko: string }[]
    let title: string
    if (c.source === 'solution_book') {
      const phrase = drawnList[0]?.name_ko ?? String(c.solution_phrase ?? c.question ?? SOLUTION_BOOK_TITLE)
      title = phrase.length > 80 ? `${SOLUTION_BOOK_TITLE} — ${phrase.slice(0, 77)}…` : `${SOLUTION_BOOK_TITLE} — ${phrase}`
    } else if (drawnList.length > 0) {
      title = `[점괘] ${drawnList.map(x => x.name_ko).join(', ')}`
    } else {
      title = String(c.question || '[점괘]')
    }
    const updated = await updateCalendarEvent(id, {
      event_date: eventDate,
      title,
      content: c,
      ...(patch.created_at !== undefined ? { created_at: patch.created_at } : {}),
    })
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
  await deletePersonEntityLinksForEntity('reading_log', id)
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
//  calendar_events (travel) — 여행 프로젝트
//  event_type='travel', content: { endDate, note, color, countryFlag?, spots? }
//  note: "오사카성 · 도톤보리" 등 상세 내용
// ══════════════════════════════════════════════════════════════════════════════
export type TravelTripRow = {
  id: string
  title: string
  startDate: string
  endDate: string
  color: string
  note: string
  countryFlag?: string
  isDomestic?: boolean
}

/** calendar_events (travel) → TravelTripRow 변환 (content.note 등 파싱) */
function calendarEventToTravelTrip(ce: CalendarEventRow): TravelTripRow {
  const c = (ce.content ?? {}) as Record<string, unknown>
  const note = String(c?.note ?? '').trim()
  const spots = (c?.spots as unknown[]) ?? []
  const spotNames = spots.map((s: unknown) => {
    const o = s as Record<string, unknown>
    return String(o?.name ?? o?.name_ko ?? o?.title ?? '')
  }).filter(Boolean)
  const noteDisplay = note || (spotNames.length ? spotNames.join(' · ') : '')
  return {
    id: String(ce.id),
    title: ce.title || '여행',
    startDate: ce.event_date ?? '',
    endDate: String(c?.endDate ?? ce.event_date ?? ''),
    color: String(c?.color ?? '#f97316'),
    note: noteDisplay,
    countryFlag: c?.countryFlag != null ? String(c.countryFlag) : undefined,
    isDomestic: c?.isDomestic != null ? Boolean(c.isDomestic) : undefined,
  }
}

/** 여행용: calendar_events에서 travel 타입 전체 조회 */
export async function fetchTravelEvents(): Promise<TravelTripRow[]> {
  const rows = await fetchCalendarEventsByType('travel')
  return rows.map(calendarEventToTravelTrip)
}

/** 여행용: calendar_events에 여행 저장 */
export async function insertTravelEvent(trip: Omit<TravelTripRow, 'id'>): Promise<TravelTripRow | null> {
  const content: Record<string, unknown> = {
    endDate: trip.endDate,
    note: trip.note,
    color: trip.color,
  }
  if (trip.countryFlag != null) content.countryFlag = trip.countryFlag
  if (trip.isDomestic != null) content.isDomestic = trip.isDomestic
  const row = await insertCalendarEvent('travel', trip.startDate, trip.title, content)
  return row ? calendarEventToTravelTrip(row) : null
}

/** 여행용: calendar_events 여행 수정 */
export async function updateTravelEvent(id: string, patch: Partial<Omit<TravelTripRow, 'id'>>): Promise<TravelTripRow | null> {
  const existing = (await fetchCalendarEventsByType('travel')).find(r => String(r.id) === id)
  if (!existing) return null
  const c = { ...(existing.content as Record<string, unknown>) }
  if (patch.endDate !== undefined) c.endDate = patch.endDate
  if (patch.note !== undefined) c.note = patch.note
  if (patch.color !== undefined) c.color = patch.color
  if (patch.countryFlag !== undefined) c.countryFlag = patch.countryFlag
  if (patch.isDomestic !== undefined) c.isDomestic = patch.isDomestic
  const row = await updateCalendarEvent(id, {
    event_date: patch.startDate ?? existing.event_date,
    title: patch.title ?? existing.title,
    content: c,
  })
  return row ? calendarEventToTravelTrip(row) : null
}

/** 여행용: calendar_events 여행 삭제 */
export async function deleteTravelEvent(id: string): Promise<boolean> {
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
  /** 질문 종류 (직장운, 애정운 등) — 해결의 책 전용 라벨은 사용하지 않음 */
  fortune_type?: string | null
  /** 점괘 종류: 해결의 책, 오라클 덱 이름, 사주·점성술 등 */
  reading_kind?: string | null
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
  }).select('id, question, drawn_cards, notes, created_at').single()
  if (error) { console.error('[Supabase] insertReadingLog 실패:', error.message); return null }
  return data ? readingLogRowFromLegacy(data) : null
}

/** reading_logs → ReadingLogRow 변환 (기본 컬럼만 조회, 확장 필드는 null) */
function readingLogRowFromLegacy(r: { id: unknown; question?: unknown; drawn_cards?: unknown; notes?: unknown; created_at?: unknown }): ReadingLogRow {
  return {
    id: String(r.id),
    question: String(r.question ?? ''),
    drawn_cards: normalizeDrawnCards(r.drawn_cards),
    notes: (r.notes as string)?.trim() || null,
    created_at: String(r.created_at ?? new Date().toISOString()),
    event_date: (r.created_at as string)?.slice(0, 10) ?? undefined,
    fortune_type: null,
    reading_kind: null,
    fortune_score: null,
    fortune_outcome: null,
    accuracy_score: null,
    related_people: null,
  }
}

export async function fetchReadingLogs(): Promise<ReadingLogRow[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('reading_logs')
      .select('id, question, drawn_cards, notes, created_at')
      .order('created_at', { ascending: false })
    if (error || !data) { if (error) console.error('[Supabase] fetchReadingLogs 실패:', error.message); return [] }
    return data.map(r => readingLogRowFromLegacy(r))
  } catch (e) { console.error('[Supabase] fetchReadingLogs 예외:', e); return [] }
}

export async function fetchReadingLogsInRange(startDate: string, endDate: string): Promise<ReadingLogRow[]> {
  if (!supabase) return []
  try {
    const startTs = `${startDate}T00:00:00.000Z`
    const endTs = `${endDate}T23:59:59.999Z`
    const { data, error } = await supabase
      .from('reading_logs')
      .select('id, question, drawn_cards, notes, created_at')
      .gte('created_at', startTs)
      .lte('created_at', endTs)
      .order('created_at', { ascending: false })
    if (error || !data) { if (error) console.error('[Supabase] fetchReadingLogsInRange 실패:', error.message); return [] }
    return data.map(r => readingLogRowFromLegacy(r))
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
  const { data, error } = await supabase.from('reading_logs').update({ notes: notes.trim() || null }).eq('id', id).select('id, question, drawn_cards, notes, created_at').single()
  if (error) { console.error('[Supabase] updateReadingLogNotes 실패:', error.message); return null }
  return data ? readingLogRowFromLegacy(data) : null
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
/** reading_logs 업데이트: 기본 컬럼(question, notes, created_at)만 사용 (확장 컬럼 없음) */
export async function updateReadingLog(id: string, patch: ReadingLogPatch): Promise<ReadingLogRow | null> {
  if (!supabase) return null
  const payload: Record<string, unknown> = {}
  if (patch.question !== undefined) payload.question = patch.question
  if (patch.notes !== undefined) payload.notes = patch.notes?.trim() || null
  if (patch.created_at !== undefined) payload.created_at = patch.created_at
  if (Object.keys(payload).length === 0) return null
  const { data, error } = await supabase.from('reading_logs').update(payload).eq('id', id).select('id, question, drawn_cards, notes, created_at').single()
  if (error) { console.error('[Supabase] updateReadingLog 실패:', error.message); return null }
  return data ? readingLogRowFromLegacy(data) : null
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

// ══════════════════════════════════════════════════════════════════════════════
//  Manifestation — causes / effects / cause_effect_links (인과 보드)
//  SQL: 프로젝트 루트 supabase-manifestation.sql 참고
// ══════════════════════════════════════════════════════════════════════════════

export interface ManifestCauseRow {
  id: string
  title: string
  description: string
  icon: string
  sort_order: number
  created_at?: string
}

export interface ManifestEffectRow {
  id: string
  title: string
  description: string
  icon: string
  sort_order: number
  created_at?: string
}

export type ManifestLinkPair = { cause_id: string; effect_id: string }

/** Postgrest/Supabase 에러를 F12 콘솔에서 그대로 추적할 수 있게 출력 */
function logManifestPostgrestError(context: string, error: PostgrestError | null): void {
  if (!error) return
  const payload = {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  }
  console.error(`[Supabase] ${context}`, payload)
  // 전체 객체(숨은 필드 포함) — 디버깅용
  console.error(`[Supabase] ${context} (raw error object)`, error)
}

/**
 * Manifestation insert/fetch용 로그인 유저 UUID.
 * getSession()을 먼저 사용 — 클라이언트에서 세션이 있어도 getUser()만으로는 user가
 * 잠깐 null이 되는 경우가 있어 FK(user_id → auth.users) 삽입 실패로 이어질 수 있음.
 */
async function _manifestUserId(): Promise<string | null> {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  const fromSession = session?.user?.id
  if (fromSession) return fromSession
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    console.warn('[Supabase] _manifestUserId getUser():', error.message)
  }
  return user?.id ?? null
}

export async function fetchManifestationCauses(): Promise<ManifestCauseRow[]> {
  if (!supabase) return []
  const uid = await _manifestUserId()
  if (!uid) return []
  try {
    const { data, error } = await supabase
      .from('causes')
      .select('id, title, description, icon, sort_order, created_at')
      .eq('user_id', uid)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error || !data) {
      if (error) console.error('[Supabase] fetchManifestationCauses 실패:', error.message)
      return []
    }
    return data.map(r => ({
      id: String(r.id),
      title: String(r.title ?? ''),
      description: String(r.description ?? ''),
      icon: String(r.icon ?? '✨'),
      sort_order: Number(r.sort_order ?? 0),
      created_at: r.created_at as string | undefined,
    }))
  } catch (e) {
    console.error('[Supabase] fetchManifestationCauses 예외:', e)
    return []
  }
}

export async function fetchManifestationEffects(): Promise<ManifestEffectRow[]> {
  if (!supabase) return []
  const uid = await _manifestUserId()
  if (!uid) return []
  try {
    const { data, error } = await supabase
      .from('effects')
      .select('id, title, description, icon, sort_order, created_at')
      .eq('user_id', uid)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error || !data) {
      if (error) console.error('[Supabase] fetchManifestationEffects 실패:', error.message)
      return []
    }
    return data.map(r => ({
      id: String(r.id),
      title: String(r.title ?? ''),
      description: String(r.description ?? ''),
      icon: String(r.icon ?? '✨'),
      sort_order: Number(r.sort_order ?? 0),
      created_at: r.created_at as string | undefined,
    }))
  } catch (e) {
    console.error('[Supabase] fetchManifestationEffects 예외:', e)
    return []
  }
}

export async function fetchManifestationLinks(): Promise<ManifestLinkPair[]> {
  if (!supabase) return []
  const uid = await _manifestUserId()
  if (!uid) return []
  try {
    const { data, error } = await supabase
      .from('cause_effect_links')
      .select('cause_id, effect_id')
      .eq('user_id', uid)
    if (error || !data) {
      if (error) console.error('[Supabase] fetchManifestationLinks 실패:', error.message)
      return []
    }
    return data.map(r => ({ cause_id: String(r.cause_id), effect_id: String(r.effect_id) }))
  } catch (e) {
    console.error('[Supabase] fetchManifestationLinks 예외:', e)
    return []
  }
}

/** insert 실패 시 UI/콘솔에서 원인 추적용 */
export type ManifestInsertResult<T> =
  | { ok: true; row: T }
  | { ok: false; reason: 'no_supabase' | 'no_user'; message: string }
  | { ok: false; reason: 'postgrest'; error: PostgrestError }

export async function insertManifestCause(
  title: string,
  description = '',
  icon = '✨',
): Promise<ManifestInsertResult<ManifestCauseRow>> {
  if (!supabase) {
    console.error('[Supabase] insertManifestCause: supabase client null')
    return { ok: false, reason: 'no_supabase', message: 'Supabase 클라이언트가 없습니다.' }
  }
  const uid = await _manifestUserId()
  if (!uid) {
    console.error('[Supabase] insertManifestCause: no user_id — getSession()/getUser() 모두 유저 없음. 로그인 상태를 확인하세요.')
    return { ok: false, reason: 'no_user', message: '로그인된 사용자가 없습니다. 다시 로그인해 주세요.' }
  }
  const payload = {
    user_id: uid,
    title: title.trim(),
    description: description.trim(),
    icon,
    sort_order: 0 as number,
  }
  const { data: maxRow } = await supabase.from('causes').select('sort_order').eq('user_id', uid).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  payload.sort_order = ((maxRow?.sort_order as number) ?? -1) + 1

  console.info('[Supabase] insertManifestCause payload', {
    user_id: uid,
    title: payload.title,
    descriptionLength: payload.description.length,
    icon: payload.icon,
    sort_order: payload.sort_order,
  })

  const { data, error } = await supabase
    .from('causes')
    .insert(payload)
    .select('id, title, description, icon, sort_order, created_at')
    .single()
  if (error) {
    logManifestPostgrestError('insertManifestCause', error)
    return { ok: false, reason: 'postgrest', error }
  }
  return {
    ok: true,
    row: {
      id: String(data.id),
      title: String(data.title),
      description: String(data.description ?? ''),
      icon: String(data.icon ?? '✨'),
      sort_order: Number(data.sort_order ?? 0),
      created_at: data.created_at as string | undefined,
    },
  }
}

export async function updateManifestCause(
  id: string,
  fields: Partial<Pick<ManifestCauseRow, 'title' | 'description' | 'icon' | 'sort_order'>>,
): Promise<boolean> {
  if (!supabase) return false
  const payload: Record<string, unknown> = {}
  if (fields.title !== undefined) payload.title = fields.title.trim()
  if (fields.description !== undefined) payload.description = fields.description
  if (fields.icon !== undefined) payload.icon = fields.icon
  if (fields.sort_order !== undefined) payload.sort_order = fields.sort_order
  if (Object.keys(payload).length === 0) return true
  const { error } = await supabase.from('causes').update(payload).eq('id', id)
  if (error) {
    console.error('[Supabase] updateManifestCause 실패:', error.message)
    return false
  }
  return true
}

export async function deleteManifestCause(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('causes').delete().eq('id', id)
  if (error) {
    console.error('[Supabase] deleteManifestCause 실패:', error.message)
    return false
  }
  return true
}

export async function insertManifestEffect(
  title: string,
  description = '',
  icon = '✨',
): Promise<ManifestInsertResult<ManifestEffectRow>> {
  if (!supabase) {
    console.error('[Supabase] insertManifestEffect: supabase client null')
    return { ok: false, reason: 'no_supabase', message: 'Supabase 클라이언트가 없습니다.' }
  }
  const uid = await _manifestUserId()
  if (!uid) {
    console.error('[Supabase] insertManifestEffect: no user_id — getSession()/getUser() 모두 유저 없음.')
    return { ok: false, reason: 'no_user', message: '로그인된 사용자가 없습니다. 다시 로그인해 주세요.' }
  }
  const payload = {
    user_id: uid,
    title: title.trim(),
    description: description.trim(),
    icon,
    sort_order: 0 as number,
  }
  const { data: maxRow } = await supabase.from('effects').select('sort_order').eq('user_id', uid).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  payload.sort_order = ((maxRow?.sort_order as number) ?? -1) + 1

  console.info('[Supabase] insertManifestEffect payload', {
    user_id: uid,
    title: payload.title,
    descriptionLength: payload.description.length,
    icon: payload.icon,
    sort_order: payload.sort_order,
  })

  const { data, error } = await supabase
    .from('effects')
    .insert(payload)
    .select('id, title, description, icon, sort_order, created_at')
    .single()
  if (error) {
    logManifestPostgrestError('insertManifestEffect', error)
    return { ok: false, reason: 'postgrest', error }
  }
  return {
    ok: true,
    row: {
      id: String(data.id),
      title: String(data.title),
      description: String(data.description ?? ''),
      icon: String(data.icon ?? '✨'),
      sort_order: Number(data.sort_order ?? 0),
      created_at: data.created_at as string | undefined,
    },
  }
}

export async function updateManifestEffect(
  id: string,
  fields: Partial<Pick<ManifestEffectRow, 'title' | 'description' | 'icon' | 'sort_order'>>,
): Promise<boolean> {
  if (!supabase) return false
  const payload: Record<string, unknown> = {}
  if (fields.title !== undefined) payload.title = fields.title.trim()
  if (fields.description !== undefined) payload.description = fields.description
  if (fields.icon !== undefined) payload.icon = fields.icon
  if (fields.sort_order !== undefined) payload.sort_order = fields.sort_order
  if (Object.keys(payload).length === 0) return true
  const { error } = await supabase.from('effects').update(payload).eq('id', id)
  if (error) {
    console.error('[Supabase] updateManifestEffect 실패:', error.message)
    return false
  }
  return true
}

export async function deleteManifestEffect(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('effects').delete().eq('id', id)
  if (error) {
    console.error('[Supabase] deleteManifestEffect 실패:', error.message)
    return false
  }
  return true
}

/** 원인 카드에 연결된 결과 ID 목록으로 교체 (고정 인과) */
export async function replaceManifestLinksForCause(causeId: string, effectIds: string[]): Promise<boolean> {
  if (!supabase) return false
  const uid = await _manifestUserId()
  if (!uid) return false
  const { error: delErr } = await supabase.from('cause_effect_links').delete().eq('cause_id', causeId).eq('user_id', uid)
  if (delErr) {
    console.error('[Supabase] replaceManifestLinksForCause delete 실패:', delErr.message)
    return false
  }
  const uniq = [...new Set(effectIds.filter(Boolean))]
  if (uniq.length === 0) return true
  const rows = uniq.map(effect_id => ({ user_id: uid, cause_id: causeId, effect_id }))
  const { error: insErr } = await supabase.from('cause_effect_links').insert(rows)
  if (insErr) {
    console.error('[Supabase] replaceManifestLinksForCause insert 실패:', insErr.message)
    return false
  }
  return true
}

/** 결과 카드에 연결된 원인 ID 목록으로 교체 */
export async function replaceManifestLinksForEffect(effectId: string, causeIds: string[]): Promise<boolean> {
  if (!supabase) return false
  const uid = await _manifestUserId()
  if (!uid) return false
  const { error: delErr } = await supabase.from('cause_effect_links').delete().eq('effect_id', effectId).eq('user_id', uid)
  if (delErr) {
    console.error('[Supabase] replaceManifestLinksForEffect delete 실패:', delErr.message)
    return false
  }
  const uniq = [...new Set(causeIds.filter(Boolean))]
  if (uniq.length === 0) return true
  const rows = uniq.map(cause_id => ({ user_id: uid, cause_id, effect_id: effectId }))
  const { error: insErr } = await supabase.from('cause_effect_links').insert(rows)
  if (insErr) {
    console.error('[Supabase] replaceManifestLinksForEffect insert 실패:', insErr.message)
    return false
  }
  return true
}

// ══════════════════════════════════════════════════════════════════════════════
//  workflows — Value 작업 순서도 (nodes / edges JSONB, RLS: 본인만)
// ══════════════════════════════════════════════════════════════════════════════

export interface WorkflowRow {
  id: string
  user_id: string
  title: string
  description: string | null
  nodes: unknown
  edges: unknown
  created_at: string
  updated_at: string
  /** 휴지통(소프트 삭제) */
  is_deleted?: boolean
}

async function _workflowUserId(): Promise<string | null> {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user?.id) return session.user.id
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function fetchWorkflows(): Promise<WorkflowRow[]> {
  if (!supabase) return []
  const uid = await _workflowUserId()
  if (!uid) return []
  try {
    const { data, error } = await supabase
      .from('workflows')
      .select('id, user_id, title, description, nodes, edges, created_at, updated_at, is_deleted')
      .eq('user_id', uid)
      .order('updated_at', { ascending: false })
    if (error || !data) {
      if (error) console.error('[Supabase] fetchWorkflows 실패:', error.message)
      return []
    }
    return data
      .filter(r => (r as Record<string, unknown>).is_deleted !== true)
      .map(r => ({
        id: String(r.id),
        user_id: String(r.user_id),
        title: String(r.title ?? ''),
        description: r.description != null ? String(r.description) : null,
        nodes: r.nodes,
        edges: r.edges,
        created_at: String(r.created_at ?? ''),
        updated_at: String(r.updated_at ?? ''),
        is_deleted: (r as Record<string, unknown>).is_deleted === true,
      }))
  } catch (e) {
    console.error('[Supabase] fetchWorkflows 예외:', e)
    return []
  }
}

export async function fetchWorkflowById(id: string): Promise<WorkflowRow | null> {
  if (!supabase) return null
  const uid = await _workflowUserId()
  if (!uid) return null
  try {
    const { data, error } = await supabase
      .from('workflows')
      .select('id, user_id, title, description, nodes, edges, created_at, updated_at, is_deleted')
      .eq('id', id)
      .eq('user_id', uid)
      .maybeSingle()
    if (error || !data) {
      if (error) console.error('[Supabase] fetchWorkflowById 실패:', error.message)
      return null
    }
    const r = data as Record<string, unknown>
    if (r.is_deleted === true) return null
    return {
      id: String(r.id),
      user_id: String(r.user_id),
      title: String(r.title ?? ''),
      description: r.description != null ? String(r.description) : null,
      nodes: r.nodes,
      edges: r.edges,
      created_at: String(r.created_at ?? ''),
      updated_at: String(r.updated_at ?? ''),
    }
  } catch (e) {
    console.error('[Supabase] fetchWorkflowById 예외:', e)
    return null
  }
}

export async function insertWorkflow(
  title: string,
  description = '',
  nodes: unknown = [],
  edges: unknown = [],
): Promise<WorkflowRow | null> {
  if (!supabase) return null
  const uid = await _workflowUserId()
  if (!uid) {
    console.error('[Supabase] insertWorkflow: 로그인 필요')
    return null
  }
  const { data, error } = await supabase
    .from('workflows')
    .insert({
      user_id: uid,
      title: title.trim() || '제목 없음',
      description: description.trim(),
      nodes,
      edges,
      is_deleted: false,
    })
    .select('id, user_id, title, description, nodes, edges, created_at, updated_at')
    .single()
  if (error) {
    console.error('[Supabase] insertWorkflow 실패:', error.message)
    return null
  }
  const r = data as Record<string, unknown>
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    title: String(r.title ?? ''),
    description: r.description != null ? String(r.description) : null,
    nodes: r.nodes,
    edges: r.edges,
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  }
}

export async function updateWorkflow(
  id: string,
  patch: {
    title?: string
    description?: string | null
    nodes?: unknown
    edges?: unknown
  },
): Promise<boolean> {
  if (!supabase) return false
  const uid = await _workflowUserId()
  if (!uid) return false
  const payload: Record<string, unknown> = {}
  if (patch.title !== undefined) payload.title = patch.title
  if (patch.description !== undefined) payload.description = patch.description
  if (patch.nodes !== undefined) payload.nodes = patch.nodes
  if (patch.edges !== undefined) payload.edges = patch.edges
  if (Object.keys(payload).length === 0) return true
  payload.updated_at = new Date().toISOString()
  const { error } = await supabase.from('workflows').update(payload).eq('id', id).eq('user_id', uid)
  if (error) {
    console.error('[Supabase] updateWorkflow 실패:', error.message)
    return false
  }
  return true
}

export async function softDeleteWorkflow(id: string): Promise<boolean> {
  if (!supabase) return false
  const uid = await _workflowUserId()
  if (!uid) return false
  const { error } = await supabase
    .from('workflows')
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', uid)
  if (error) {
    console.error('[Supabase] softDeleteWorkflow 실패:', error.message)
    return false
  }
  return true
}

export async function restoreWorkflow(id: string): Promise<boolean> {
  if (!supabase) return false
  const uid = await _workflowUserId()
  if (!uid) return false
  const { error } = await supabase
    .from('workflows')
    .update({ is_deleted: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', uid)
  if (error) {
    console.error('[Supabase] restoreWorkflow 실패:', error.message)
    return false
  }
  return true
}

export async function permanentDeleteWorkflow(id: string): Promise<boolean> {
  if (!supabase) return false
  const uid = await _workflowUserId()
  if (!uid) return false
  const { error } = await supabase.from('workflows').delete().eq('id', id).eq('user_id', uid)
  if (error) {
    console.error('[Supabase] permanentDeleteWorkflow 실패:', error.message)
    return false
  }
  return true
}

/** @deprecated softDeleteWorkflow 사용 */
export async function deleteWorkflow(id: string): Promise<boolean> {
  return softDeleteWorkflow(id)
}

export async function fetchTrashedWorkflows(): Promise<WorkflowRow[]> {
  if (!supabase) return []
  const uid = await _workflowUserId()
  if (!uid) return []
  try {
    const { data, error } = await supabase
      .from('workflows')
      .select('id, user_id, title, description, nodes, edges, created_at, updated_at, is_deleted')
      .eq('user_id', uid)
      .eq('is_deleted', true)
      .order('updated_at', { ascending: false })
    if (error || !data) {
      if (error) console.error('[Supabase] fetchTrashedWorkflows 실패:', error.message)
      return []
    }
    return data.map(r => ({
      id: String(r.id),
      user_id: String(r.user_id),
      title: String(r.title ?? ''),
      description: r.description != null ? String(r.description) : null,
      nodes: r.nodes,
      edges: r.edges,
      created_at: String(r.created_at ?? ''),
      updated_at: String(r.updated_at ?? ''),
      is_deleted: true,
    }))
  } catch (e) {
    console.error('[Supabase] fetchTrashedWorkflows 예외:', e)
    return []
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  manual_documents — 통합 Manual (BlockNote blocks + 첨부 JSONB, RLS: 본인만)
// ══════════════════════════════════════════════════════════════════════════════

export interface ManualDocumentRow {
  id: string
  user_id: string
  title: string
  sort_order: number
  blocks: unknown
  attachments: unknown
  category: string
  tags: string[]
  importance_score: number
  completion_rate: number
  last_viewed_at: string | null
  /** null이면 책장에서 문서 id 기반 자동 색 */
  cover_hue: number | null
  /** 우측 패널 메모·요약 */
  notes: string
  /** 통합 레이팅과 동일 스케일 (0=미설정, 0.5~5) */
  rating: number
  created_at: string
  updated_at: string
}

function parseManualRow(r: Record<string, unknown>): ManualDocumentRow {
  const tagsRaw = r.tags
  const tags: string[] = Array.isArray(tagsRaw) ? tagsRaw.map(t => String(t)) : []
  const cr = r.completion_rate
  const completion_rate =
    typeof cr === 'number' ? cr : typeof cr === 'string' ? parseFloat(cr) || 0 : Number(cr ?? 0)
  const chRaw = r.cover_hue
  let cover_hue: number | null = null
  if (chRaw != null && chRaw !== '') {
    const n = Number(chRaw)
    if (Number.isFinite(n)) cover_hue = Math.max(0, Math.min(360, Math.round(n)))
  }
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    title: String(r.title ?? ''),
    sort_order: Number(r.sort_order ?? 0),
    blocks: r.blocks,
    attachments: r.attachments,
    category: typeof r.category === 'string' ? r.category : String(r.category ?? ''),
    tags,
    importance_score: Math.max(0, Math.min(100, Number(r.importance_score ?? 0))),
    completion_rate: Math.max(0, Math.min(100, completion_rate)),
    last_viewed_at: r.last_viewed_at != null ? String(r.last_viewed_at) : null,
    cover_hue,
    notes: typeof r.notes === 'string' ? r.notes : String(r.notes ?? ''),
    rating: (() => {
      const raw =
        typeof r.rating === 'number'
          ? r.rating
          : typeof r.rating === 'string'
            ? parseFloat(r.rating)
            : Number(r.rating ?? 0)
      const n = Number.isFinite(raw) ? raw : 0
      return clampUnifiedOverallRating(n)
    })(),
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  }
}

export type ManualAttachment = {
  id: string
  name: string
  url: string
  size?: number
  mime?: string
}

async function _manualUserId(): Promise<string | null> {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user?.id) return session.user.id
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function fetchManualDocuments(): Promise<ManualDocumentRow[]> {
  if (!supabase) return []
  const uid = await _manualUserId()
  if (!uid) return []
  try {
    const { data, error } = await supabase
      .from('manual_documents')
      .select(
        'id, user_id, title, sort_order, blocks, attachments, category, tags, importance_score, completion_rate, last_viewed_at, cover_hue, notes, rating, created_at, updated_at',
      )
      .eq('user_id', uid)
      .order('sort_order', { ascending: true })
      .order('updated_at', { ascending: false })
    if (error || !data) {
      if (error) console.error('[Supabase] fetchManualDocuments 실패:', error.message)
      return []
    }
    return data.map(r => parseManualRow(r as Record<string, unknown>))
  } catch (e) {
    console.error('[Supabase] fetchManualDocuments 예외:', e)
    return []
  }
}

export async function fetchManualDocumentById(id: string): Promise<ManualDocumentRow | null> {
  if (!supabase) return null
  const uid = await _manualUserId()
  if (!uid) return null
  try {
    const { data, error } = await supabase
      .from('manual_documents')
      .select(
        'id, user_id, title, sort_order, blocks, attachments, category, tags, importance_score, completion_rate, last_viewed_at, cover_hue, notes, rating, created_at, updated_at',
      )
      .eq('id', id)
      .eq('user_id', uid)
      .maybeSingle()
    if (error || !data) {
      if (error) console.error('[Supabase] fetchManualDocumentById 실패:', error.message)
      return null
    }
    return parseManualRow(data as Record<string, unknown>)
  } catch (e) {
    console.error('[Supabase] fetchManualDocumentById 예외:', e)
    return null
  }
}

export async function insertManualDocument(title = '새 문서'): Promise<ManualDocumentRow | null> {
  if (!supabase) return null
  const uid = await _manualUserId()
  if (!uid) {
    console.error('[Supabase] insertManualDocument: 로그인 필요')
    return null
  }
  const { count } = await supabase
    .from('manual_documents')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', uid)
  const sortOrder = count ?? 0
  const { data, error } = await supabase
    .from('manual_documents')
    .insert({
      user_id: uid,
      title: title.trim() || '제목 없음',
      sort_order: sortOrder,
      blocks: [],
      attachments: [],
      category: '',
      tags: [],
      importance_score: 0,
      completion_rate: 0,
      last_viewed_at: null,
      cover_hue: null,
      notes: '',
      rating: 0,
    })
    .select(
      'id, user_id, title, sort_order, blocks, attachments, category, tags, importance_score, completion_rate, last_viewed_at, cover_hue, notes, rating, created_at, updated_at',
    )
    .single()
  if (error) {
    console.error('[Supabase] insertManualDocument 실패:', error.message)
    return null
  }
  return parseManualRow(data as Record<string, unknown>)
}

export async function updateManualDocument(
  id: string,
  patch: {
    title?: string
    blocks?: unknown
    attachments?: unknown
    sort_order?: number
    category?: string
    tags?: string[]
    importance_score?: number
    completion_rate?: number
    last_viewed_at?: string | null
    cover_hue?: number | null
    notes?: string
    rating?: number
  },
): Promise<boolean> {
  if (!supabase) return false
  const uid = await _manualUserId()
  if (!uid) return false
  const payload: Record<string, unknown> = {}
  if (patch.title !== undefined) payload.title = patch.title
  if (patch.blocks !== undefined) payload.blocks = patch.blocks
  if (patch.attachments !== undefined) payload.attachments = patch.attachments
  if (patch.sort_order !== undefined) payload.sort_order = patch.sort_order
  if (patch.category !== undefined) payload.category = patch.category
  if (patch.tags !== undefined) payload.tags = patch.tags
  if (patch.importance_score !== undefined) payload.importance_score = patch.importance_score
  if (patch.completion_rate !== undefined) payload.completion_rate = patch.completion_rate
  if (patch.last_viewed_at !== undefined) payload.last_viewed_at = patch.last_viewed_at
  if (patch.cover_hue !== undefined) payload.cover_hue = patch.cover_hue
  if (patch.notes !== undefined) payload.notes = patch.notes
  if (patch.rating !== undefined) payload.rating = clampUnifiedOverallRating(patch.rating)
  if (Object.keys(payload).length === 0) return true
  const bumpsUpdated =
    patch.title !== undefined ||
    patch.blocks !== undefined ||
    patch.attachments !== undefined ||
    patch.sort_order !== undefined ||
    patch.category !== undefined ||
    patch.tags !== undefined ||
    patch.importance_score !== undefined ||
    patch.completion_rate !== undefined ||
    patch.cover_hue !== undefined ||
    patch.notes !== undefined ||
    patch.rating !== undefined
  if (bumpsUpdated) payload.updated_at = new Date().toISOString()
  const { error } = await supabase.from('manual_documents').update(payload).eq('id', id).eq('user_id', uid)
  if (error) {
    console.error('[Supabase] updateManualDocument 실패:', error.message)
    return false
  }
  return true
}

export async function deleteManualDocument(id: string): Promise<boolean> {
  if (!supabase) return false
  const uid = await _manualUserId()
  if (!uid) return false
  await deletePersonEntityLinksForEntity('manual_document', id)
  const { error } = await supabase.from('manual_documents').delete().eq('id', id).eq('user_id', uid)
  if (error) {
    console.error('[Supabase] deleteManualDocument 실패:', error.message)
    return false
  }
  return true
}

// ══════════════════════════════════════════════════════════════════════════════
//  manual_sites — Manual 링크·북마크 (RLS: 본인만)
// ══════════════════════════════════════════════════════════════════════════════

export interface ManualSiteRow {
  id: string
  user_id: string
  title: string
  url: string
  note: string | null
  category: string
  sort_order: number
  created_at: string
  updated_at: string
}

function parseManualSiteRow(r: Record<string, unknown>): ManualSiteRow {
  return {
    id: String(r.id ?? ''),
    user_id: String(r.user_id ?? ''),
    title: String(r.title ?? ''),
    url: String(r.url ?? ''),
    note: r.note != null && r.note !== '' ? String(r.note) : null,
    category: String(r.category ?? ''),
    sort_order: Number(r.sort_order ?? 0),
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  }
}

export async function fetchManualSites(): Promise<ManualSiteRow[]> {
  if (!supabase) return []
  const uid = await _manualUserId()
  if (!uid) return []
  try {
    const { data, error } = await supabase
      .from('manual_sites')
      .select('id, user_id, title, url, note, category, sort_order, created_at, updated_at')
      .eq('user_id', uid)
      .order('sort_order', { ascending: true })
      .order('updated_at', { ascending: false })
    if (error || !data) {
      if (error) console.error('[Supabase] fetchManualSites 실패:', error.message)
      return []
    }
    return data.map(r => parseManualSiteRow(r as Record<string, unknown>))
  } catch (e) {
    console.error('[Supabase] fetchManualSites 예외:', e)
    return []
  }
}

export async function insertManualSite(
  payload: { title?: string; url?: string; note?: string | null; category?: string } = {},
): Promise<ManualSiteRow | null> {
  if (!supabase) return null
  const uid = await _manualUserId()
  if (!uid) {
    console.error('[Supabase] insertManualSite: 로그인 필요')
    return null
  }
  const { count } = await supabase
    .from('manual_sites')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', uid)
  const sortOrder = count ?? 0
  const { data, error } = await supabase
    .from('manual_sites')
    .insert({
      user_id: uid,
      title: (payload.title ?? '새 링크').trim() || '새 링크',
      url: (payload.url ?? 'https://').trim() || 'https://',
      note: payload.note != null && String(payload.note).trim() !== '' ? String(payload.note).trim() : null,
      category: (payload.category ?? '').trim(),
      sort_order: sortOrder,
    })
    .select('id, user_id, title, url, note, category, sort_order, created_at, updated_at')
    .single()
  if (error) {
    console.error('[Supabase] insertManualSite 실패:', error.message)
    return null
  }
  return parseManualSiteRow(data as Record<string, unknown>)
}

export async function updateManualSite(
  id: string,
  patch: {
    title?: string
    url?: string
    note?: string | null
    category?: string
    sort_order?: number
  },
): Promise<boolean> {
  if (!supabase) return false
  const uid = await _manualUserId()
  if (!uid) return false
  const p: Record<string, unknown> = {}
  if (patch.title !== undefined) p.title = patch.title
  if (patch.url !== undefined) p.url = patch.url
  if (patch.note !== undefined) p.note = patch.note
  if (patch.category !== undefined) p.category = patch.category
  if (patch.sort_order !== undefined) p.sort_order = patch.sort_order
  if (Object.keys(p).length === 0) return true
  p.updated_at = new Date().toISOString()
  const { error } = await supabase.from('manual_sites').update(p).eq('id', id).eq('user_id', uid)
  if (error) {
    console.error('[Supabase] updateManualSite 실패:', error.message)
    return false
  }
  return true
}

export async function deleteManualSite(id: string): Promise<boolean> {
  if (!supabase) return false
  const uid = await _manualUserId()
  if (!uid) return false
  const { error } = await supabase.from('manual_sites').delete().eq('id', id).eq('user_id', uid)
  if (error) {
    console.error('[Supabase] deleteManualSite 실패:', error.message)
    return false
  }
  return true
}
