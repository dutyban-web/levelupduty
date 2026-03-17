/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 *  창작 OS — Supabase 연결 설정
 * ├─────────────────────────────────────────────────────────────────────┤
 *  📋 초기 설정 방법:
 *
 *  1. https://app.supabase.com 에서 새 프로젝트 생성
 *  2. 프로젝트 > Settings > API 에서 복사:
 *       - Project URL  → VITE_SUPABASE_URL
 *       - anon public  → VITE_SUPABASE_ANON_KEY
 *  3. 프로젝트 루트의 .env.local 파일에 위 값 입력 (이미 파일 생성됨)
 *
 *  4. Supabase Dashboard > SQL Editor 에서 아래 SQL 실행:
 * ─────────────────────────────────────────────────────────────────────
 *  CREATE TABLE IF NOT EXISTS app_kv (
 *    key       TEXT        PRIMARY KEY,
 *    value     JSONB       NOT NULL,
 *    synced_at TIMESTAMPTZ DEFAULT NOW()
 *  );
 *
 *  -- 인증 없이 바로 사용 (개인 앱이므로)
 *  ALTER TABLE app_kv DISABLE ROW LEVEL SECURITY;
 *
 *  -- 실시간 동기화 활성화
 *  ALTER PUBLICATION supabase_realtime ADD TABLE app_kv;
 * ─────────────────────────────────────────────────────────────────────
 *  5. npm run dev 재시작 후 앱 새로고침
 * └─────────────────────────────────────────────────────────────────────┘
 */

import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../supabase'

export { supabase }
export const isSupabaseReady = Boolean(supabase)

// ── Key-Value 유틸 ─────────────────────────────────────────────────────────────

/** Supabase에서 키 하나의 값을 읽어온다. 연결 없으면 null 반환 */
export async function kvGet<T>(key: string): Promise<T | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('app_kv')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    if (error || !data) return null
    return data.value as T
  } catch { return null }
}

/** Supabase에 키-값을 upsert한다. localStorage와 병행 사용 */
export async function kvSet<T>(key: string, value: T): Promise<void> {
  if (!supabase) return
  try {
    await supabase
      .from('app_kv')
      .upsert(
        { key, value, synced_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
  } catch (e) {
    console.warn('[Supabase] kvSet error:', e)
  }
}

/** 모든 KV 데이터를 한 번에 가져온다 (초기 마운트 sync용) */
export async function kvGetAll(): Promise<Record<string, unknown>> {
  if (!supabase) return {}
  try {
    const { data, error } = await supabase
      .from('app_kv')
      .select('key, value')
    if (error || !data) return {}
    return Object.fromEntries(data.map(row => [row.key, row.value]))
  } catch { return {} }
}

/** 실시간 변경 구독 (다른 기기에서 업데이트 시 자동 반영) */
export function subscribeKv(
  onUpdate: (key: string, value: unknown) => void
): RealtimeChannel | null {
  if (!supabase) return null
  const channel = supabase
    .channel('app_kv_realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_kv' },
      (payload) => {
        const row = payload.new as { key: string; value: unknown }
        if (row?.key) onUpdate(row.key, row.value)
      }
    )
    .subscribe()
  return channel
}
