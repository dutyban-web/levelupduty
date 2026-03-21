/**
 * Network 히스토리 ↔ 통합 캘린더(calendar_events, event_type=event)
 * DB에 network 전용 테이블은 없고, content JSONB에 메타를 넣어 Life 캘린더와 공존합니다.
 */
import { insertCalendarEvent, deleteCalendarEvent } from './supabase'
import { isSupabaseReady } from './lib/supabase'
import type { NetworkHistoryEntry } from './networkData'

export async function syncNetworkHistoryToCalendar(
  contactId: string,
  contactName: string,
  entry: NetworkHistoryEntry,
): Promise<string | null> {
  if (!isSupabaseReady) return null
  try {
    const title = `🌐 ${contactName}: ${entry.title.trim() || 'Network 기록'}`
    const row = await insertCalendarEvent('event', entry.date, title, {
      endDate: entry.date,
      color: '#6366f1',
      note: entry.summary ?? '',
      networkContactId: contactId,
      networkHistoryId: entry.id,
      source: 'network_history',
    })
    return row?.id ?? null
  } catch (e) {
    console.warn('[Network] 캘린더 동기화 실패', e)
    return null
  }
}

export async function removeNetworkHistoryFromCalendar(calendarEventId: string | undefined): Promise<void> {
  if (!isSupabaseReady || !calendarEventId) return
  try {
    await deleteCalendarEvent(calendarEventId)
  } catch {
    /* ignore */
  }
}
