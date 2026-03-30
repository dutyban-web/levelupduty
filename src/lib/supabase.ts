/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 *  창작 OS — Supabase 연결 설정
 * ├─────────────────────────────────────────────────────────────────────┤
 *  app_kv 행: value(JSONB), is_deleted(BOOLEAN DEFAULT false)
 *  · 활성 데이터: is_deleted IS DISTINCT FROM true (false 또는 null)
 *  · 휴지통: is_deleted = true (복구 시 false, 영구 삭제 시 DELETE)
 * └─────────────────────────────────────────────────────────────────────┘
 *
 *  createClient는 반드시 이 파일 최상단에서 초기화한다. ../supabase.ts 가
 *  unifiedOverallRatingData 등을 통해 이 모듈을 먼저 로드할 수 있으므로,
 *  여기서 ../supabase 를 import 하면 순환 참조로 supabase TDZ 오류가 난다.
 */

import { createClient, type RealtimeChannel } from '@supabase/supabase-js'
import { appSyncErrorFromUnknown, emitAppSyncStatus, scheduleSyncIdle, SYNC_IDLE_MS } from '../syncIndicatorBus'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** 느린 응답·모바일 네트워크에서 조기 실패 줄이기 (브라우저/프록시 한도는 별도) */
const SUPABASE_FETCH_TIMEOUT_MS = 90_000

function createTimeoutFetch(timeoutMs: number) {
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    const upstream = init?.signal
    const onUpstreamAbort = () => {
      clearTimeout(timer)
      ctrl.abort()
    }
    if (upstream) {
      if (upstream.aborted) {
        clearTimeout(timer)
        return Promise.reject(new DOMException('Aborted', 'AbortError'))
      }
      upstream.addEventListener('abort', onUpstreamAbort, { once: true })
    }
    return fetch(input, { ...init, signal: ctrl.signal }).finally(() => {
      clearTimeout(timer)
      upstream?.removeEventListener('abort', onUpstreamAbort)
    })
  }
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch: createTimeoutFetch(SUPABASE_FETCH_TIMEOUT_MS) },
    })
  : null

export const isSupabaseReady = Boolean(supabase)

export type KvSyncMeta = {
  /** DB에서 행이 DELETE 됨 (영구 삭제) */
  permanentlyRemoved?: boolean
  /** is_deleted 가 true 로 마킹됨 (소프트 삭제) */
  softDeleted?: boolean
}

// ── Key-Value 유틸 ─────────────────────────────────────────────────────────────

/** Supabase에서 키 하나의 값을 읽어온다. 휴지통 행은 null. */
export async function kvGet<T>(key: string): Promise<T | null> {
  if (!supabase) return null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return null
    const { data, error } = await supabase
      .from('app_kv')
      .select('value, is_deleted')
      .eq('user_id', user.id)
      .eq('key', key)
      .maybeSingle()
    if (error || !data) return null
    if (data.is_deleted === true) return null
    return data.value as T
  } catch { return null }
}

/** 실제 upsert — 항상 is_deleted: false (활성 데이터) */
async function upsertAppKvRow<T>(key: string, value: T): Promise<void> {
  if (!supabase) throw new Error('Supabase client not configured')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not signed in (cannot sync app_kv)')
  emitAppSyncStatus('syncing')
  const { error } = await supabase
    .from('app_kv')
    .upsert({
      user_id: user.id,
      key,
      value,
      synced_at: new Date().toISOString(),
      is_deleted: false,
    })
  if (error) throw error
  emitAppSyncStatus('synced')
  scheduleSyncIdle(SYNC_IDLE_MS)
}

/** Supabase에 키-값을 upsert한다. localStorage와 병행 사용 (PK: user_id, key) */
export async function kvSet<T>(key: string, value: T): Promise<void> {
  if (!supabase) return
  try {
    await upsertAppKvRow(key, value)
  } catch (error) {
    console.warn('[Supabase] kvSet error:', error, { key })
    emitAppSyncStatus('error', appSyncErrorFromUnknown(error, 'KV_SET'))
  }
}

/**
 * upsert 결과를 반환한다 (에러를 삼키지 않음). 일괄 복구 등에서 성공/실패 집계용.
 */
export async function kvSetAttempt<T>(
  key: string,
  value: T,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  try {
    await upsertAppKvRow(key, value)
    return { ok: true }
  } catch (error) {
    return { ok: false, error }
  }
}

/** 활성 KV만 (휴지통 제외) */
export async function kvGetAll(): Promise<Record<string, unknown>> {
  if (!supabase) return {}
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return {}
    const { data, error } = await supabase
      .from('app_kv')
      .select('key, value, is_deleted')
      .eq('user_id', user.id)
    if (error || !data) return {}
    const active = data.filter(r => r.is_deleted !== true)
    return Object.fromEntries(active.map(row => [row.key, row.value]))
  } catch { return {} }
}

/** 휴지통에 있는 키 목록 (마이그레이션 시 로컬 덮어쓰기 방지용) */
export async function kvListTrashedKeys(): Promise<string[]> {
  if (!supabase) return []
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return []
    const { data, error } = await supabase
      .from('app_kv')
      .select('key')
      .eq('user_id', user.id)
      .eq('is_deleted', true)
    if (error || !data) return []
    return data.map(r => r.key)
  } catch { return [] }
}

export type KvTrashRow = { key: string; value: unknown; synced_at: string | null }

/** 휴지통 행 목록 */
export async function kvGetTrash(): Promise<KvTrashRow[]> {
  if (!supabase) return []
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return []
    const { data, error } = await supabase
      .from('app_kv')
      .select('key, value, synced_at')
      .eq('user_id', user.id)
      .eq('is_deleted', true)
      .order('synced_at', { ascending: false })
    if (error || !data) return []
    return data.map(r => ({
      key: r.key,
      value: r.value,
      synced_at: r.synced_at ?? null,
    }))
  } catch { return [] }
}

/**
 * 키를 휴지통으로 보냄 (DELETE 금지). DB·로컬 캐시에서 메인 목록에 안 보이게 함.
 */
export async function kvSoftDelete(key: string): Promise<boolean> {
  if (!supabase) return false
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return false

    const { data: alreadyTrashed } = await supabase
      .from('app_kv')
      .select('key')
      .eq('user_id', user.id)
      .eq('key', key)
      .eq('is_deleted', true)
      .maybeSingle()
    if (alreadyTrashed) return true

    const { data: row } = await supabase
      .from('app_kv')
      .select('value, is_deleted')
      .eq('user_id', user.id)
      .eq('key', key)
      .maybeSingle()

    let value: unknown
    if (row && row.is_deleted !== true && row.value !== undefined && row.value !== null) {
      value = row.value
    } else {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
      if (raw == null || raw === '') return false
      try {
        value = JSON.parse(raw)
      } catch {
        value = { text: raw }
      }
    }

    emitAppSyncStatus('syncing')
    const { error } = await supabase
      .from('app_kv')
      .upsert({
        user_id: user.id,
        key,
        value,
        synced_at: new Date().toISOString(),
        is_deleted: true,
      })
    if (error) throw error
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key)
    } catch { /* ignore */ }
    emitAppSyncStatus('synced')
    scheduleSyncIdle(SYNC_IDLE_MS)
    return true
  } catch (e) {
    console.warn('[Supabase] kvSoftDelete error:', e, { key })
    emitAppSyncStatus('error', appSyncErrorFromUnknown(e, 'KV_SOFT_DELETE'))
    return false
  }
}

/** 휴지통에서 복구 (is_deleted → false) */
export async function kvRestore(key: string): Promise<boolean> {
  if (!supabase) return false
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return false
    const { data: row, error: selErr } = await supabase
      .from('app_kv')
      .select('value')
      .eq('user_id', user.id)
      .eq('key', key)
      .eq('is_deleted', true)
      .maybeSingle()
    if (selErr || !row) return false

    emitAppSyncStatus('syncing')
    const { error } = await supabase
      .from('app_kv')
      .upsert({
        user_id: user.id,
        key,
        value: row.value,
        synced_at: new Date().toISOString(),
        is_deleted: false,
      })
    if (error) throw error
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(row.value))
      }
    } catch { /* ignore */ }
    emitAppSyncStatus('synced')
    scheduleSyncIdle(SYNC_IDLE_MS)
    return true
  } catch (e) {
    console.warn('[Supabase] kvRestore error:', e, { key })
    emitAppSyncStatus('error', appSyncErrorFromUnknown(e, 'KV_RESTORE'))
    return false
  }
}

/** 휴지통에서 영구 삭제 (유일하게 DELETE 허용) */
export async function kvPermanentDelete(key: string): Promise<boolean> {
  if (!supabase) return false
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return false
    emitAppSyncStatus('syncing')
    const { data: delRows, error } = await supabase
      .from('app_kv')
      .delete()
      .eq('user_id', user.id)
      .eq('key', key)
      .eq('is_deleted', true)
      .select('key')
    if (error) throw error
    if (!delRows?.length) {
      emitAppSyncStatus('synced')
      scheduleSyncIdle(SYNC_IDLE_MS)
      return false
    }
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key)
    } catch { /* ignore */ }
    emitAppSyncStatus('synced')
    scheduleSyncIdle(SYNC_IDLE_MS)
    return true
  } catch (e) {
    console.warn('[Supabase] kvPermanentDelete error:', e, { key })
    emitAppSyncStatus('error', appSyncErrorFromUnknown(e, 'KV_PERMANENT_DELETE'))
    return false
  }
}

/** 실시간 변경 구독 */
export function subscribeKv(
  onUpdate: (key: string, value: unknown | null, meta?: KvSyncMeta) => void,
): RealtimeChannel | null {
  if (!supabase) return null
  const channel = supabase
    .channel('app_kv_realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_kv' },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          const oldRow = payload.old as { key?: string }
          if (oldRow?.key) onUpdate(oldRow.key, null, { permanentlyRemoved: true })
          return
        }
        const row = payload.new as { key: string; value: unknown; is_deleted?: boolean | null }
        if (!row?.key) return
        if (row.is_deleted === true) {
          onUpdate(row.key, row.value, { softDeleted: true })
          return
        }
        onUpdate(row.key, row.value)
      },
    )
    .subscribe()
  return channel
}
