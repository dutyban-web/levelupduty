import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { useIsMobile } from './hooks/useIsMobile'
import { kvSet } from './lib/supabase'
import {
  fetchFortuneEventsInRange,
  deleteFortuneEvent,
  fetchJournalEventsInRange,
  fetchEventEventsInRange,
  fetchDailyLogsInRange,
  fetchJournalNotes,
  fetchJournalCategories,
  insertJournalCategory,
  updateJournalCategory,
  deleteJournalCategory,
  fetchJournalEvents,
  fetchJournalEventDates,
  insertJournalEvent,
  updateJournalEvent,
  deleteJournalEvent,
  type ReadingLogRow,
  type DrawnCardItem,
  type JournalCategoryRow,
  type JournalNoteRow,
} from './supabase'
import { blockNoteToPlainPreview, RichEditor } from './RichEditor'
import { loadSettlementStore, type SettlementEntry } from './settlementData'
import {
  loadQuantumFlowStore,
  canReadLetter,
  hasLetterArrived,
  normalizeOpenTime,
  type QuantumLetter,
} from './quantumFlowData'
import { UnifiedPeoplePage } from './UnifiedPeoplePage'
import UnifiedOverallRatingPage from './UnifiedOverallRatingPage'
import UnifiedFavoritesPage from './UnifiedFavoritesPage'
import { UnifiedTagSourcesPage } from './UnifiedTagSourcesPage'
import { PomodoroWeeklyCalendar } from './PomodoroWeeklyCalendar'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import { emitAppSyncStatus, scheduleSyncIdle, SYNC_IDLE_MS, appSyncErrorFromUnknown } from './syncIndicatorBus'
import { X, Trash2, CalendarDays, Plus, ChevronLeft, ChevronRight } from 'lucide-react'

/** Quest card fields used by Life calendar (matches App `Card` for these props) */
export type CalendarUserQuest = { id: string; name: string; deadline?: string }

/** Same localStorage key & shape as App.tsx `loadJournal` (activity dots on CalendarPage) */
const JOURNAL_KEY = 'creative_os_journal_v1'
type AchievementBlock = {
  questId: string
  questName: string
  emoji: string
  categoryLabel: string
  categoryColor: string
  xp: number
}
type JournalEntry = {
  date: string
  content: string
  questsDone: string[]
  xpSnapshot: number
  savedAt: string
  blocks?: AchievementBlock[]
}
type JournalStore = Record<string, JournalEntry>

function loadJournalForCalendarPage(): JournalStore {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return {}
}

function formatDateKoCalendarModal(key: string, opts?: { full?: boolean }) {
  const d = new Date(key + 'T00:00:00')
  if (opts?.full) {
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  }
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

// ═══════════════════════════════════════ CALENDAR ════════════════════════════
export const CALENDAR_KEY = 'creative_os_calendar_v1'
const EVENT_PALETTE = ['#6366f1', '#f97316', '#34d399', '#f472b6', '#fbbf24', '#60a5fa', '#7C3AED']

type CalEvent = {
  id: string; title: string
  startDate: string; endDate: string
  color: string; note: string
}
type CalStore = { events: CalEvent[] }

const SAMPLE_EVENTS: CalEvent[] = [
  { id: 'osaka-2026', title: '🗾 오사카 여행', startDate: '2026-04-27', endDate: '2026-04-30', color: '#f97316', note: '오사카성 · 만화박물관 · 도톤보리 거리 탐방' },
]

export function loadCalendar(): CalStore {
  try {
    const raw = localStorage.getItem(CALENDAR_KEY)
    if (!raw) return { events: SAMPLE_EVENTS }
    const saved: CalStore = JSON.parse(raw)
    const existing = new Set(saved.events.map(e => e.id))
    return { events: [...SAMPLE_EVENTS.filter(e => !existing.has(e.id)), ...saved.events] }
  } catch { return { events: SAMPLE_EVENTS } }
}
function saveCalendar(d: CalStore) { localStorage.setItem(CALENDAR_KEY, JSON.stringify(d)); kvSet(CALENDAR_KEY, d) }

function buildCalGrid(year: number, month: number): string[][] {
  const firstDow = new Date(year, month, 1).getDay()
  return Array.from({ length: 6 }, (_, wi) =>
    Array.from({ length: 7 }, (_, di) => {
      const d = new Date(year, month, 1 - firstDow + wi * 7 + di)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })
  )
}

type WeekEvent = CalEvent & { sc: number; ec: number; level: number }
function getWeekEvents(week: string[], events: CalEvent[]): WeekEvent[] {
  const ws = week[0], we = week[6]
  const inWeek = events
    .filter(e => e.endDate >= ws && e.startDate <= we)
    .map(e => ({
      ...e,
      sc: e.startDate < ws ? 0 : week.indexOf(e.startDate),
      ec: e.endDate > we ? 6 : week.indexOf(e.endDate),
    }))
    .sort((a, b) => a.sc - b.sc || b.ec - a.ec)
  const slots: number[] = []
  return inWeek.map(ev => {
    let lv = 0
    while (slots[lv] !== undefined && slots[lv] >= ev.sc) lv++
    slots[lv] = ev.ec
    return { ...ev, level: lv }
  })
}

// ══════════════════════════════════════════════════════════════════════════════
//  UNIFIED CALENDAR — 퀘스트 마감일 + 데일리 저널 + 운세/기운 기록 통합
// ══════════════════════════════════════════════════════════════════════════════
type UnifiedEventType = 'quest' | 'journal' | 'fortune' | 'event' | 'settlement' | 'quantum'
type UnifiedEvent = { id: string; date: string; type: UnifiedEventType; title: string; meta?: unknown }

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function renderDrawnCards(cards: DrawnCardItem[]) {
  if (!cards || cards.length === 0) return null
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
      {cards.map((c, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#37352F' }}>
          {i > 0 && <span style={{ color: '#9B9A97', marginRight: '4px' }}>|</span>}
          <span>{c.emoji}</span>
          <span>{c.name_ko}{c.name_en ? ` (${c.name_en})` : ''}</span>
        </span>
      ))}
    </span>
  )
}

const SETTLEMENT_KIND_LABEL: Record<string, string> = {
  daily: '일일',
  weekly: '주간',
  monthly: '월간',
  quarterly: '분기',
  yearly: '년간',
  daeun: '대운',
  topic: '주제별',
}

export function UnifiedCalendar({ userQuests, refreshTrigger = 0 }: { userQuests: CalendarUserQuest[]; refreshTrigger?: number }) {
  const isMobile = useIsMobile()
  const todayStr = toYMD(new Date())
  const [calendarUIMode, setCalendarUIMode] = useState<'month' | 'week'>('month')
  const [viewDate, setViewDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr)
  const [filterQuest, setFilterQuest] = useState(true)
  const [filterJournal, setFilterJournal] = useState(true)
  const [filterFortune, setFilterFortune] = useState(true)
  const [filterEvent, setFilterEvent] = useState(true)
  const [filterSettlement, setFilterSettlement] = useState(true)
  const [filterQuantum, setFilterQuantum] = useState(true)
  const settlementStore = useMemo(() => loadSettlementStore(), [refreshTrigger])
  const quantumStore = useMemo(() => loadQuantumFlowStore(), [refreshTrigger])
  const [dailyLogs, setDailyLogs] = useState<{ log_date: string; fortune_feedback?: string | null }[]>([])
  const [journalNotes, setJournalNotes] = useState<JournalNoteRow[]>([])
  const [journalEvents, setJournalEvents] = useState<Array<Omit<JournalNoteRow, 'id'> & { id: string }>>([])
  const [calEvents, setCalEvents] = useState<Array<{ id: string; startDate: string; endDate: string; title: string; color: string; note: string }>>([])
  const [readingLogs, setReadingLogs] = useState<ReadingLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReading, setSelectedReading] = useState<ReadingLogRow | null>(null)

  const startStr = toYMD(new Date(viewDate.getFullYear(), viewDate.getMonth(), 1))
  const endDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0)
  const endStr = toYMD(endDate)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const [logs, notes, jEvents, evts, fortuneEvents] = await Promise.all([
        fetchDailyLogsInRange(startStr, endStr),
        fetchJournalNotes(),
        fetchJournalEventsInRange(startStr, endStr),
        fetchEventEventsInRange(startStr, endStr),
        fetchFortuneEventsInRange(startStr, endStr),
      ])
      setDailyLogs(logs)
      setJournalNotes(notes)
      setJournalEvents(jEvents)
      setCalEvents(evts)
      setReadingLogs(fortuneEvents)
      setLoading(false)
    })()
  }, [startStr, endStr, refreshTrigger])

  const mergedEvents = useMemo((): UnifiedEvent[] => {
    const out: UnifiedEvent[] = []
    if (filterQuest) {
      for (const q of userQuests) {
        if (q.deadline) out.push({ id: `q-${q.id}`, date: q.deadline, type: 'quest', title: q.name, meta: q })
      }
    }
    if (filterJournal) {
      const seenJournal = new Set<string>()
      for (const n of journalEvents) {
        const key = `${n.record_date}:${n.title}`
        if (seenJournal.has(key)) continue
        seenJournal.add(key)
        out.push({ id: `jc-${n.id}`, date: n.record_date, type: 'journal', title: n.title, meta: { ...n, fromCalendar: true } })
      }
      for (const n of journalNotes) {
        const key = `${n.record_date}:${n.title}`
        if (seenJournal.has(key)) continue
        seenJournal.add(key)
        out.push({ id: `j-${n.id}`, date: n.record_date, type: 'journal', title: n.title, meta: n })
      }
    }
    if (filterEvent) {
      for (const e of calEvents) {
        const start = new Date(e.startDate + 'T00:00:00')
        const end = new Date(e.endDate + 'T23:59:59')
        for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
          const dateKey = toYMD(new Date(t))
          out.push({ id: `e-${e.id}-${dateKey}`, date: dateKey, type: 'event', title: e.title, meta: e })
        }
      }
    }
    if (filterFortune) {
      for (const r of readingLogs) {
        const dateKey = r.event_date ?? toYMD(new Date(r.created_at))
        const cardsStr = (r.drawn_cards ?? []).map(c => `${c.emoji} ${c.name_ko}${c.name_en ? ` (${c.name_en})` : ''}`).join(' | ')
        const title = cardsStr ? `[🔮 운세] ${cardsStr}` : r.question ? `[🔮 운세] ${r.question.slice(0, 30)}${r.question.length > 30 ? '…' : ''}` : '[🔮 운세]'
        out.push({ id: `f-${r.id}`, date: dateKey, type: 'fortune', title, meta: r })
      }
    }
    if (filterSettlement) {
      for (const e of settlementStore.entries) {
        const kl = SETTLEMENT_KIND_LABEL[e.kind] ?? e.kind
        out.push({
          id: `st-${e.id}`,
          date: e.anchorDate,
          type: 'settlement',
          title: `[결산] ${kl}`,
          meta: e,
        })
      }
    }
    if (filterQuantum) {
      for (const q of quantumStore.letters) {
        out.push({
          id: `qf-${q.id}`,
          date: q.openDate,
          type: 'quantum',
          title: `[시공] ${q.title} · ${normalizeOpenTime(q.openTime)}`,
          meta: q,
        })
      }
    }
    return out
  }, [userQuests, journalNotes, journalEvents, calEvents, readingLogs, settlementStore.entries, quantumStore.letters, filterQuest, filterJournal, filterEvent, filterFortune, filterSettlement, filterQuantum])

  const eventsByDate = useMemo(() => {
    const m: Record<string, UnifiedEvent[]> = {}
    for (const e of mergedEvents) {
      if (!m[e.date]) m[e.date] = []
      m[e.date].push(e)
    }
    return m
  }, [mergedEvents])

  const dayDots = useCallback((date: Date) => {
    const dk = toYMD(date)
    const evs = eventsByDate[dk] ?? []
    const hasQuest = evs.some(e => e.type === 'quest')
    const hasJournal = evs.some(e => e.type === 'journal')
    const hasEvent = evs.some(e => e.type === 'event')
    const hasFortune = evs.some(e => e.type === 'fortune')
    const hasSettlement = evs.some(e => e.type === 'settlement')
    const hasQuantum = evs.some(e => e.type === 'quantum')
    return (
      <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', marginTop: '2px' }}>
        {hasQuest && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'block' }} title="퀘스트 마감일" />}
        {hasJournal && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'block' }} title="데일리 저널" />}
        {hasEvent && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#34d399', display: 'block' }} title="캘린더 이벤트" />}
        {hasFortune && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#7C3AED', display: 'block' }} title="운세/기운 기록" />}
        {hasSettlement && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'block' }} title="결산 기록" />}
        {hasQuantum && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22d3ee', display: 'block', boxShadow: '0 0 6px rgba(34,211,238,0.9)' }} title="시공편지 도착일" />}
      </div>
    )
  }, [eventsByDate])

  const dayEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : []
  const dayQuests = dayEvents.filter(e => e.type === 'quest').map(e => e.meta as CalendarUserQuest)
  const dayJournals = dayEvents.filter(e => e.type === 'journal').map(e => e.meta as JournalNoteRow)
  const dayReadings = dayEvents.filter(e => e.type === 'fortune').map(e => e.meta as ReadingLogRow)
  const dayFortuneFeedback = dayReadings.filter(r => (r.drawn_cards ?? []).length === 0)
  const dayTarotReadings = dayReadings.filter(r => (r.drawn_cards ?? []).length > 0)
  const dayCalEvents = Array.from(new Map(dayEvents.filter(e => e.type === 'event').map(e => [(e.meta as { id: string }).id, e.meta as typeof calEvents[0]])).values())
  const daySettlements = dayEvents.filter(e => e.type === 'settlement').map(e => e.meta as SettlementEntry)
  const dayQuantum = dayEvents.filter(e => e.type === 'quantum').map(e => e.meta as QuantumLetter)

  function fmtDateKo(dk: string) {
    const d = new Date(dk + 'T00:00:00')
    return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
  }

  async function handleDeleteReadingFromCalendar(id: string) {
    if (!window.confirm('이 기록을 정말 삭제하시겠습니까?')) return
    const ok = await deleteFortuneEvent(id)
    if (ok) {
      setReadingLogs(prev => prev.filter(r => r.id !== id))
      setSelectedReading(null)
    }
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '14px 12px' : '28px 44px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: '#37352F' }}>📅 캘린더</h1>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#787774' }}>퀘스트 마감일, 저널, 운세, 결산, 시공편지 도착일을 한눈에 확인하세요</p>
        {(() => {
          const now = new Date()
          const today = toYMD(now)
          const arrivals = quantumStore.letters.filter(
            l => !l.is_deleted && l.lockUntilOpen && hasLetterArrived(l, now) && l.openDate === today,
          )
          if (arrivals.length === 0) return null
          return (
            <div
              style={{
                marginTop: 12,
                padding: '12px 14px',
                borderRadius: 12,
                background: 'rgba(34,211,238,0.08)',
                border: '1px solid rgba(34,211,238,0.35)',
              }}
            >
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: '#0e7490', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span aria-hidden>🔔</span> 오늘 도착한 시공편지
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#37352F', listStyle: 'disc' }}>
                {arrivals.map(a => (
                  <li key={a.id} style={{ marginBottom: 4 }}>
                    <Link to="/quantum" style={{ color: '#0891b2', fontWeight: 600, textDecoration: 'none' }}>
                      {a.title}
                    </Link>
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#787774' }}>{normalizeOpenTime(a.openTime)} 도착</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })()}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile || calendarUIMode === 'week' ? '1fr' : '1fr 280px', gap: '24px', alignItems: 'start' }}>
        {/* 캘린더 + 필터 */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.06)', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#9B9A97', letterSpacing: '0.08em' }}>보기</span>
            <button
              type="button"
              onClick={() => setCalendarUIMode('month')}
              style={{
                padding: '6px 12px', borderRadius: '8px', border: calendarUIMode === 'month' ? '1px solid #6366f1' : '1px solid rgba(0,0,0,0.08)',
                background: calendarUIMode === 'month' ? 'rgba(99,102,241,0.1)' : '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: calendarUIMode === 'month' ? 700 : 500, color: calendarUIMode === 'month' ? '#4F46E5' : '#787774',
              }}
            >
              월간 (통합)
            </button>
            <button
              type="button"
              onClick={() => setCalendarUIMode('week')}
              style={{
                padding: '6px 12px', borderRadius: '8px', border: calendarUIMode === 'week' ? '1px solid #6366f1' : '1px solid rgba(0,0,0,0.08)',
                background: calendarUIMode === 'week' ? 'rgba(99,102,241,0.1)' : '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: calendarUIMode === 'week' ? 700 : 500, color: calendarUIMode === 'week' ? '#4F46E5' : '#787774',
              }}
            >
              위클리 포모도로
            </button>
          </div>

          {calendarUIMode === 'week' ? (
            <PomodoroWeeklyCalendar userQuests={userQuests.map(q => ({ id: q.id, name: q.name }))} refreshTrigger={refreshTrigger} />
          ) : (
            <>
          {/* 필터 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#9B9A97', letterSpacing: '0.1em' }}>표시할 항목</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#37352F' }}>
              <input type="checkbox" checked={filterQuest} onChange={e => setFilterQuest(e.target.checked)} />
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} /> 퀘스트 마감일
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#37352F' }}>
              <input type="checkbox" checked={filterJournal} onChange={e => setFilterJournal(e.target.checked)} />
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }} /> 데일리 저널
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#37352F' }}>
              <input type="checkbox" checked={filterEvent} onChange={e => setFilterEvent(e.target.checked)} />
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34d399' }} /> 캘린더 이벤트
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#37352F' }}>
              <input type="checkbox" checked={filterFortune} onChange={e => setFilterFortune(e.target.checked)} />
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#7C3AED' }} /> 운세/기운 기록
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#37352F' }}>
              <input type="checkbox" checked={filterSettlement} onChange={e => setFilterSettlement(e.target.checked)} />
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} /> 결산 (Review)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#37352F' }}>
              <input type="checkbox" checked={filterQuantum} onChange={e => setFilterQuantum(e.target.checked)} />
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22d3ee', boxShadow: '0 0 4px rgba(34,211,238,0.8)' }} /> 시공편지
            </label>
          </div>

          {loading ? (
            <div style={{ height: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#787774', fontSize: '14px' }}>데이터 불러오는 중…</div>
          ) : (
            <div style={{ fontSize: '14px' }} className="unified-calendar-wrapper">
              <Calendar
                value={viewDate}
                onChange={(v) => { const d = v as Date; setSelectedDate(toYMD(d)) }}
                onActiveStartDateChange={({ activeStartDate }) => activeStartDate && setViewDate(activeStartDate)}
                tileContent={({ date }) => dayDots(date)}
                locale="ko-KR"
                formatShortWeekday={(_, d) => ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]}
              />
            </div>
          )}
            </>
          )}
        </div>

        {/* 날짜별 요약 패널 */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.06)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', position: isMobile ? 'relative' : 'sticky', top: isMobile ? 0 : 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 800, color: '#37352F' }}>
            {selectedDate ? fmtDateKo(selectedDate) : '날짜를 선택하세요'}
          </h3>
          {!selectedDate ? (
            <p style={{ margin: 0, fontSize: '13px', color: '#9B9A97' }}>캘린더에서 날짜를 클릭하면 해당 날짜의 퀘스트, 저널, 운세, 결산, 시공편지를 볼 수 있습니다.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {dayQuests.length > 0 && (
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: '#ef4444', letterSpacing: '0.05em' }}>퀘스트 마감일</p>
                  <ul style={{ margin: 0, paddingLeft: '18px' }}>
                    {dayQuests.map(q => (
                      <li key={q.id} style={{ marginBottom: '4px', fontSize: '13px', color: '#37352F' }}>{q.name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {dayJournals.length > 0 && (
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: '#3b82f6', letterSpacing: '0.05em' }}>데일리 저널</p>
                  <ul style={{ margin: 0, paddingLeft: '18px', listStyle: 'none' }}>
                    {dayJournals.map(n => (
                      <li key={n.id} style={{ marginBottom: '6px' }}>
                        <Link to={`/life?tab=journal&note=${n.id}${(n as { fromCalendar?: boolean }).fromCalendar ? '&source=calendar' : ''}`} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '13px', color: '#6366f1', fontWeight: 600, textAlign: 'left', textDecoration: 'none' }}>{n.title}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {dayFortuneFeedback.length > 0 && (
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: '#7C3AED', letterSpacing: '0.05em' }}>운세 피드백 (Fortune Journal)</p>
                  {dayFortuneFeedback.map(r => (
                    <p key={r.id} style={{ margin: '0 0 8px', fontSize: '13px', color: '#6B6B6B', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{r.question}</p>
                  ))}
                </div>
              )}
              {dayTarotReadings.length > 0 && (
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: '#7C3AED', letterSpacing: '0.05em' }}>타로 점괘 기록</p>
                  <ul style={{ margin: 0, paddingLeft: '18px', listStyle: 'none' }}>
                    {dayTarotReadings.map(r => {
                      const drawn = r.drawn_cards ?? []
                      return (
                        <li key={r.id} style={{ marginBottom: '8px' }}>
                          <button
                            onClick={() => setSelectedReading(r)}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '10px 14px',
                              borderRadius: '10px',
                              border: '1px solid rgba(124,58,237,0.2)',
                              backgroundColor: 'rgba(124,58,237,0.04)',
                              fontSize: '13px',
                              color: '#37352F',
                              lineHeight: 1.5,
                              cursor: 'pointer',
                              transition: 'background-color 0.2s, border-color 0.2s',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.backgroundColor = 'rgba(124,58,237,0.1)'
                              e.currentTarget.style.borderColor = 'rgba(124,58,237,0.35)'
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.backgroundColor = 'rgba(124,58,237,0.04)'
                              e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', rowGap: '4px' }}>
                              <span style={{ color: '#7C3AED', fontWeight: 600 }}>[🔮 운세]</span>
                              <span>{r.question}</span>
                              {drawn.length > 0 && (
                                <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {drawn.map((c, i) => (
                                    <span key={i} style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                                      padding: '2px 8px', borderRadius: '6px',
                                      backgroundColor: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)',
                                      fontSize: '11px', fontWeight: 600, color: '#7C3AED',
                                    }}>
                                      <span style={{ fontSize: '12px' }}>{c.emoji}</span>
                                      {c.name_ko}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
              {dayCalEvents.length > 0 && (
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: '#34d399', letterSpacing: '0.05em' }}>캘린더 이벤트</p>
                  <ul style={{ margin: 0, paddingLeft: '18px', listStyle: 'none' }}>
                    {dayCalEvents.map(ev => (
                      <li key={ev.id} style={{ marginBottom: '6px', fontSize: '13px', color: '#37352F' }}>
                        <span style={{ fontWeight: 600 }}>{ev.title}</span>
                        {ev.note && <span style={{ marginLeft: '6px', color: '#787774', fontSize: '12px' }}>— {ev.note}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {daySettlements.length > 0 && (
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: '#f59e0b', letterSpacing: '0.05em' }}>결산 (Review)</p>
                  <ul style={{ margin: 0, paddingLeft: '18px', listStyle: 'none' }}>
                    {daySettlements.map(s => (
                      <li key={s.id} style={{ marginBottom: '6px', fontSize: '13px', color: '#37352F' }}>
                        <Link to="/review" style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'none' }} title="Review → 결산 탭에서 편집">
                          {SETTLEMENT_KIND_LABEL[s.kind] ?? s.kind} · {s.periodKey}
                        </Link>
                        {s.topicLabel && <span style={{ marginLeft: '6px', color: '#787774', fontSize: '12px' }}>({s.topicLabel})</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {dayQuantum.length > 0 && (
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: '#0891b2', letterSpacing: '0.05em' }}>시공편지 (Quantum)</p>
                  <ul style={{ margin: 0, paddingLeft: '18px', listStyle: 'none' }}>
                    {dayQuantum.map(q => {
                      const readable = canReadLetter(q, new Date())
                      return (
                        <li key={q.id} style={{ marginBottom: '8px', fontSize: '13px', color: '#37352F' }}>
                          <Link to="/quantum" style={{ color: '#0891b2', fontWeight: 600, textDecoration: 'none' }} title="Quantum에서 열기">
                            {q.title} · {normalizeOpenTime(q.openTime)}
                          </Link>
                          {q.lockUntilOpen && !readable && (
                            <span style={{ marginLeft: '8px', fontSize: '11px', color: '#787774' }}>🔒 도착일 전 잠금</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
              {dayQuests.length === 0 && dayJournals.length === 0 && dayReadings.length === 0 && dayCalEvents.length === 0 && daySettlements.length === 0 && dayQuantum.length === 0 && (
                <p style={{ margin: 0, fontSize: '13px', color: '#9B9A97' }}>이 날짜에 기록된 내용이 없습니다.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 점괘 상세 모달 */}
      {selectedReading && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setSelectedReading(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '420px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#7C3AED' }}>🔮 타로 점괘 상세</h3>
              <button onClick={() => setSelectedReading(null)} style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#9B9A97' }}><X size={20} /></button>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, color: '#9B9A97' }}>질문</p>
            <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#37352F', lineHeight: 1.6 }}>{selectedReading.question}</p>
            <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, color: '#9B9A97' }}>뽑은 카드</p>
            <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              {(selectedReading.drawn_cards ?? []).length > 0
                ? renderDrawnCards(selectedReading.drawn_cards)
                : <span style={{ fontSize: '14px', color: '#9B9A97' }}>없음</span>}
            </div>
            <p style={{ margin: '0 0 20px', fontSize: '11px', color: '#9B9A97' }}>
              {new Date(selectedReading.created_at).toLocaleString('ko-KR')}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => handleDeleteReadingFromCalendar(selectedReading.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid rgba(239,68,68,0.4)',
                  backgroundColor: 'rgba(239,68,68,0.08)',
                  color: '#ef4444',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={16} /> 삭제
              </button>
              <button onClick={() => setSelectedReading(null)} style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Beautiful Life — 저널 캘린더만 (`?tab=journal` + `note` 딥링크). 통합 캘린더·인물 DB는 Master Board 하단 창고. */
export function BeautifulLifeSection({
  onOpenNote,
  onJournalChange,
}: {
  onOpenNote: (id: string, title: string, meta?: { source?: 'calendar' }) => void
  onJournalChange: () => void
}) {
  const isMobile = useIsMobile()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const tabParam = searchParams.get('tab')
  const tab = tabParam === 'journal' ? 'journal' : tabParam === 'people' ? 'people' : 'calendar'
  const noteFromUrl = searchParams.get('note')

  useEffect(() => {
    if (noteFromUrl && (tab === 'calendar' || tab === 'people')) {
      const next = new URLSearchParams(searchParams)
      next.set('tab', 'journal')
      setSearchParams(next, { replace: true })
      return
    }
    if (tabParam === 'calendar') {
      navigate('/master-board?warehouse=calendar', { replace: true })
      return
    }
    if (tabParam === 'people') {
      navigate('/master-board?warehouse=people', { replace: true })
    }
  }, [searchParams, navigate, setSearchParams, noteFromUrl, tab, tabParam])

  return (
    <>
      <div style={{
        maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '14px 12px 0' : '24px 48px 0',
        display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center',
        borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0,
      }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#9B9A97', marginRight: '8px', letterSpacing: '0.08em' }}>BEAUTIFUL LIFE</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#4F46E5' }}>저널 캘린더</span>
      </div>
      <JournalCalendarPage onOpenNote={onOpenNote} onJournalChange={onJournalChange} />
    </>
  )
}

/** Master Board 맨 아래 — 캘린더 · 인물 · 레이팅 · 태그 · 즐겨찾기. HashRouter: `?warehouse=` | `people` | `rating` | `sources` | `favorites` */
export function MasterBoardWarehouseSection({
  userQuests,
  calendarRefreshKey,
}: {
  userQuests: CalendarUserQuest[]
  calendarRefreshKey: number
}) {
  const isMobile = useIsMobile()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const tabParam = searchParams.get('warehouse')
  const tab: 'calendar' | 'people' | 'rating' | 'sources' | 'favorites' =
    tabParam === 'people'
      ? 'people'
      : tabParam === 'sources'
        ? 'sources'
        : tabParam === 'rating'
          ? 'rating'
          : tabParam === 'favorites'
            ? 'favorites'
            : 'calendar'

  useEffect(() => {
    const w = searchParams.get('warehouse')
    if (!w || (w !== 'people' && w !== 'sources' && w !== 'rating' && w !== 'favorites')) return
    requestAnimationFrame(() => {
      document.getElementById('data-warehouse')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [location.pathname, searchParams])

  function setTab(next: 'calendar' | 'people' | 'rating' | 'sources' | 'favorites') {
    const nextParams = new URLSearchParams(searchParams)
    if (next === 'calendar') nextParams.delete('warehouse')
    else if (next === 'people') nextParams.set('warehouse', 'people')
    else if (next === 'rating') nextParams.set('warehouse', 'rating')
    else if (next === 'favorites') nextParams.set('warehouse', 'favorites')
    else nextParams.set('warehouse', 'sources')
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <section
      id="data-warehouse"
      style={{
        marginTop: 40,
        paddingTop: 48,
        paddingBottom: 'min(56px, 8vw)',
        borderTop: '2px solid rgba(0,0,0,0.06)',
        background: 'linear-gradient(180deg, rgba(250,250,249,0.95) 0%, rgba(255,255,255,0.6) 48px)',
        maxWidth: '1600px',
        marginLeft: 'auto',
        marginRight: 'auto',
        paddingLeft: isMobile ? 12 : 32,
        paddingRight: isMobile ? 12 : 32,
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: '#9B9A97' }}>데이터 창고</p>
        <h2 style={{ margin: '6px 0 4px', fontSize: 18, fontWeight: 800, color: '#37352F' }}>캘린더,인물,레이팅,태그,즐겨찾기</h2>
        <p style={{ margin: 0, fontSize: 13, color: '#787774', lineHeight: 1.5 }}>
          퀘스트·저널·운세·결산·시공편지까지 한눈에. 인물은 DB에서 연결하고, 레이팅·태그·각 화면에서 별표로 넣은
          즐겨찾기를 한곳에서 카드로 모아 봅니다.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button type="button" onClick={() => setTab('calendar')} style={{
          padding: '8px 16px', borderRadius: '8px',
          border: tab === 'calendar' ? '1px solid #6366f1' : '1px solid rgba(0,0,0,0.08)',
          background: tab === 'calendar' ? 'rgba(99,102,241,0.1)' : 'transparent',
          cursor: 'pointer', fontSize: '13px', fontWeight: tab === 'calendar' ? 600 : 500,
          color: tab === 'calendar' ? '#4F46E5' : '#787774',
        }}>캘린더</button>
        <button type="button" onClick={() => setTab('people')} style={{
          padding: '8px 16px', borderRadius: '8px',
          border: tab === 'people' ? '1px solid #6366f1' : '1px solid rgba(0,0,0,0.08)',
          background: tab === 'people' ? 'rgba(99,102,241,0.1)' : 'transparent',
          cursor: 'pointer', fontSize: '13px', fontWeight: tab === 'people' ? 600 : 500,
          color: tab === 'people' ? '#4F46E5' : '#787774',
        }}>인물</button>
        <button type="button" onClick={() => setTab('rating')} style={{
          padding: '8px 16px', borderRadius: '8px',
          border: tab === 'rating' ? '1px solid #6366f1' : '1px solid rgba(0,0,0,0.08)',
          background: tab === 'rating' ? 'rgba(99,102,241,0.1)' : 'transparent',
          cursor: 'pointer', fontSize: '13px', fontWeight: tab === 'rating' ? 600 : 500,
          color: tab === 'rating' ? '#4F46E5' : '#787774',
        }}>레이팅</button>
        <button type="button" onClick={() => setTab('sources')} title="전역 태그 색인" style={{
          padding: '8px 16px', borderRadius: '8px',
          border: tab === 'sources' ? '1px solid #6366f1' : '1px solid rgba(0,0,0,0.08)',
          background: tab === 'sources' ? 'rgba(99,102,241,0.1)' : 'transparent',
          cursor: 'pointer', fontSize: '13px', fontWeight: tab === 'sources' ? 600 : 500,
          color: tab === 'sources' ? '#4F46E5' : '#787774',
        }}>태그</button>
        <button type="button" onClick={() => setTab('favorites')} title="별표로 모은 항목" style={{
          padding: '8px 16px', borderRadius: '8px',
          border: tab === 'favorites' ? '1px solid #6366f1' : '1px solid rgba(0,0,0,0.08)',
          background: tab === 'favorites' ? 'rgba(99,102,241,0.1)' : 'transparent',
          cursor: 'pointer', fontSize: '13px', fontWeight: tab === 'favorites' ? 600 : 500,
          color: tab === 'favorites' ? '#4F46E5' : '#787774',
        }}>즐겨찾기</button>
      </div>
      {tab === 'calendar' ? (
        <UnifiedCalendar userQuests={userQuests} refreshTrigger={calendarRefreshKey} />
      ) : tab === 'people' ? (
        <UnifiedPeoplePage />
      ) : tab === 'rating' ? (
        <UnifiedOverallRatingPage />
      ) : tab === 'favorites' ? (
        <UnifiedFavoritesPage refreshKey={calendarRefreshKey} />
      ) : (
        <UnifiedTagSourcesPage refreshKey={calendarRefreshKey} />
      )}
    </section>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  JOURNAL CALENDAR PAGE  — Supabase journal_categories + journals 전용
//  퀘스트 시스템과 완전히 독립적
// ══════════════════════════════════════════════════════════════════════════════
type JournalEventRow = Omit<JournalNoteRow, 'id'> & { id: string }
function JournalCalendarPage({ onOpenNote, onJournalChange }: { onOpenNote: (id: string, title: string, meta?: { source?: 'calendar' }) => void; onJournalChange?: () => void }) {
  const isMobile = useIsMobile()
  const [searchParams] = useSearchParams()
  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [selDate, setSelDate] = useState(todayStr)
  const [viewMode, setViewMode] = useState<'date' | 'category'>('date')
  const [selCat, setSelCat] = useState<{ group: string; sub: string } | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const [catEditOpen, setCatEditOpen] = useState(false)
  const [newGroup, setNewGroup] = useState('')
  const [newSub, setNewSub] = useState('')
  const [editingCatId, setEditingCatId] = useState<number | null>(null)
  const [editCatGroup, setEditCatGroup] = useState('')
  const [editCatSub, setEditCatSub] = useState('')
  const [catSaving, setCatSaving] = useState(false)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorNoteId, setEditorNoteId] = useState<string | null>(null)
  const [edDate, setEdDate] = useState(todayStr)
  const [edGroup, setEdGroup] = useState('')
  const [edSub, setEdSub] = useState('')
  const [edTitle, setEdTitle] = useState('')
  const [edContent, setEdContent] = useState('')
  const [edSaving, setEdSaving] = useState(false)

  const [categories, setCategories] = useState<JournalCategoryRow[]>([])
  const [notes, setNotes] = useState<JournalEventRow[]>([])
  const [journalDates, setJournalDates] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  function refreshJournal() {
    setLoading(true)
    Promise.all([fetchJournalCategories(), fetchJournalEvents(), fetchJournalEventDates()]).then(([cats, allNotes, dates]) => {
      setCategories(cats)
      setNotes(allNotes)
      setJournalDates(new Set(dates))
      if (cats.length > 0) setExpanded(prev => prev.size ? prev : new Set([cats[0].group_name]))
      setLoading(false)
      onJournalChange?.()
    })
  }

  useEffect(() => { refreshJournal() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const noteIdFromUrl = searchParams.get('note')
  const sourceFromUrl = searchParams.get('source')
  const openedFromUrlRef = useRef<string | null>(null)
  useEffect(() => {
    if (!noteIdFromUrl) { openedFromUrlRef.current = null; return }
  }, [noteIdFromUrl])
  useEffect(() => {
    if (!noteIdFromUrl || !onOpenNote) return
    if (openedFromUrlRef.current === noteIdFromUrl) return
    const note = notes.find(n => String(n.id) === noteIdFromUrl)
    if (note) {
      openedFromUrlRef.current = noteIdFromUrl
      onOpenNote(note.id, note.title, sourceFromUrl === 'calendar' ? { source: 'calendar' } : undefined)
    } else if (notes.length > 0) {
      openedFromUrlRef.current = noteIdFromUrl
      onOpenNote(noteIdFromUrl, '', sourceFromUrl === 'calendar' ? { source: 'calendar' } : undefined)
    }
  }, [noteIdFromUrl, notes, onOpenNote, sourceFromUrl])

  const groupedCats = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const c of categories) {
      if (!map[c.group_name]) map[c.group_name] = []
      if (!map[c.group_name].includes(c.sub_name)) map[c.group_name].push(c.sub_name)
    }
    return map
  }, [categories])

  const catCount = useMemo(() => {
    const map: Record<string, number> = {}
    for (const n of notes) {
      const k = `${n.group_name}||${n.sub_name}`
      map[k] = (map[k] ?? 0) + 1
    }
    return map
  }, [notes])

  const displayedNotes = useMemo(() => {
    if (viewMode === 'date') return notes.filter(n => n.record_date === selDate)
    if (selCat) return notes.filter(n => n.group_name === selCat.group && n.sub_name === selCat.sub)
    return []
  }, [viewMode, selDate, selCat, notes])

  function buildGrid(y: number, m: number): (string | null)[] {
    const firstDay = new Date(y, m, 1).getDay()
    const days = new Date(y, m + 1, 0).getDate()
    const cells: (string | null)[] = Array(firstDay).fill(null)
    for (let d = 1; d <= days; d++)
      cells.push(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }
  const calGrid = buildGrid(calYear, calMonth)
  const DOWS_JC = ['일', '월', '화', '수', '목', '금', '토']
  const MONTHS_JC = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

  function prevMonth() { calMonth === 0 ? (setCalYear(y => y - 1), setCalMonth(11)) : setCalMonth(m => m - 1) }
  function nextMonth() { calMonth === 11 ? (setCalYear(y => y + 1), setCalMonth(0)) : setCalMonth(m => m + 1) }
  function goToday() { setCalYear(new Date().getFullYear()); setCalMonth(new Date().getMonth()); setSelDate(todayStr); setViewMode('date') }

  function fmtDateKo(dk: string) {
    const d = new Date(dk + 'T00:00:00')
    return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
  }

  function openNew() {
    setEditorNoteId(null)
    setEdDate(viewMode === 'date' ? selDate : todayStr)
    const firstGroup = categories[0]?.group_name ?? ''
    const firstSub = categories.find(c => c.group_name === firstGroup)?.sub_name ?? ''
    setEdGroup(selCat?.group ?? firstGroup)
    setEdSub(selCat?.sub ?? firstSub)
    setEdTitle(''); setEdContent('')
    setEditorOpen(true)
  }
  function openEdit(note: JournalEventRow) {
    setEditorNoteId(note.id); setEdDate(note.record_date)
    setEdGroup(note.group_name); setEdSub(note.sub_name)
    setEdTitle(note.title); setEdContent(note.content)
    setEditorOpen(true)
  }

  async function saveNote() {
    if (!edTitle.trim() || !edDate || !edGroup || !edSub) return
    const fields = { record_date: edDate, title: edTitle.trim(), content: edContent, group_name: edGroup, sub_name: edSub }
    if (editorNoteId === null) {
      const tempId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      const optimistic: JournalEventRow = { ...fields, id: tempId, created_at: new Date().toISOString() }
      setNotes(prev => [optimistic, ...prev])
      setJournalDates(prev => new Set([...prev, edDate]))
      setEdSaving(false)
      setEditorOpen(false)
      emitAppSyncStatus('syncing')
      try {
        const created = await insertJournalEvent({ record_date: edDate, title: fields.title, content: fields.content, group_name: edGroup, sub_name: edSub })
        if (created) {
          setNotes(prev => prev.map(n => n.id === tempId ? created : n))
          refreshJournal()
          emitAppSyncStatus('synced')
          scheduleSyncIdle(SYNC_IDLE_MS)
        } else {
          setNotes(prev => prev.filter(n => n.id !== tempId))
          emitAppSyncStatus('error', { errorCode: 'JOURNAL_INSERT', errorDetail: '저널 추가 응답이 비어 있습니다.' })
        }
      } catch (e) {
        setNotes(prev => prev.filter(n => n.id !== tempId))
        emitAppSyncStatus('error', appSyncErrorFromUnknown(e, 'JOURNAL_INSERT'))
      }
    } else {
      const prevSnap = notes.find(n => n.id === editorNoteId)
      setNotes(prev => prev.map(n => n.id === editorNoteId ? { ...n, ...fields } : n))
      setEdSaving(false)
      setEditorOpen(false)
      emitAppSyncStatus('syncing')
      try {
        await updateJournalEvent(editorNoteId, fields)
        refreshJournal()
        emitAppSyncStatus('synced')
        scheduleSyncIdle(SYNC_IDLE_MS)
      } catch (e) {
        if (prevSnap) setNotes(prev => prev.map(n => n.id === editorNoteId ? prevSnap : n))
        emitAppSyncStatus('error', appSyncErrorFromUnknown(e, 'JOURNAL_UPDATE'))
      }
    }
  }

  async function handleDeleteNote(id: string) {
    if (!window.confirm('이 저널을 삭제할까요?')) return
    await deleteJournalEvent(id)
    const remaining = notes.filter(n => n.id !== id)
    setNotes(remaining)
    setJournalDates(new Set(remaining.map(n => n.record_date)))
    refreshJournal()
  }

  async function handleAddCat() {
    if (!newGroup.trim() || !newSub.trim()) return
    setCatSaving(true)
    const cat = await insertJournalCategory(newGroup.trim(), newSub.trim())
    if (cat) { setCategories(prev => [...prev, cat]); setNewGroup(''); setNewSub('') }
    setCatSaving(false)
  }
  async function handleDeleteCat(id: number) {
    if (!window.confirm('카테고리를 삭제할까요?')) return
    await deleteJournalCategory(id)
    setCategories(prev => prev.filter(c => c.id !== id))
  }
  async function handleUpdateCat() {
    if (!editingCatId || !editCatGroup.trim() || !editCatSub.trim()) return
    await updateJournalCategory(editingCatId, editCatGroup.trim(), editCatSub.trim())
    setCategories(prev => prev.map(c => c.id === editingCatId ? { ...c, group_name: editCatGroup.trim(), sub_name: editCatSub.trim() } : c))
    setEditingCatId(null)
  }

  const edSubs = useMemo(() => categories.filter(c => c.group_name === edGroup).map(c => c.sub_name), [categories, edGroup])
  const edGroups = useMemo(() => [...new Set(categories.map(c => c.group_name))], [categories])

  const cardStyle: CSSProperties = { backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.06)' }
  const inputStyle: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#F1F1EF', color: '#37352F', fontSize: '13px', outline: 'none' }
  const btnPrimary: CSSProperties = { padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#6366f1', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }
  const btnGhost: CSSProperties = { padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: 'transparent', color: '#9B9A97', fontSize: '12px', cursor: 'pointer' }

  const panelTitle = viewMode === 'date'
    ? `📅 ${fmtDateKo(selDate)}`
    : `📂 ${selCat?.group} / ${selCat?.sub}`

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '14px 12px' : '28px 44px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: '#37352F' }}>📓 저널 캘린더</h1>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#787774' }}>날짜별 · 카테고리별로 기록을 관리하세요</p>
        </div>
        <button onClick={openNew} style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px' }}>＋</span> 새 저널 작성
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#787774', fontSize: '14px' }}>
          <span style={{ marginRight: '10px' }}>⏳</span> 데이터 불러오는 중…
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr 240px', gap: '20px', alignItems: 'start' }}>

          {/* 좌: 캘린더 */}
          <div style={{ ...cardStyle, padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <button onClick={prevMonth} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#F1F1EF', color: '#9B9A97', cursor: 'pointer', fontSize: '13px' }}>‹</button>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#37352F' }}>{calYear}년 {MONTHS_JC[calMonth]}</p>
              <button onClick={nextMonth} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#F1F1EF', color: '#9B9A97', cursor: 'pointer', fontSize: '13px' }}>›</button>
            </div>
            <button onClick={goToday} style={{ ...btnGhost, width: '100%', marginBottom: '12px', textAlign: 'center' }}>오늘로 이동</button>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: '4px' }}>
              {DOWS_JC.map((d, i) => (
                <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, color: i === 0 ? '#f87171' : i === 6 ? '#60a5fa' : '#787774', padding: '4px 0' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' }}>
              {calGrid.map((dk, idx) => {
                if (!dk) return <div key={idx} />
                const isToday = dk === todayStr
                const isSel = dk === selDate && viewMode === 'date'
                const hasDot = journalDates.has(dk)
                const dow = idx % 7
                return (
                  <button key={dk} onClick={() => { setSelDate(dk); setViewMode('date') }} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '6px 2px', borderRadius: '8px', border: 'none', cursor: 'pointer', minHeight: '36px',
                    backgroundColor: isSel ? '#6366f1' : isToday ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: isSel ? '#fff' : dow === 0 ? '#f87171' : dow === 6 ? '#60a5fa' : '#37352F',
                    fontWeight: isToday ? 800 : 500, fontSize: '12px', transition: 'background 0.1s',
                  }}>
                    {parseInt(dk.slice(8))}
                    {hasDot && <span style={{ width: '4px', height: '4px', borderRadius: '50%', marginTop: '2px', backgroundColor: isSel ? 'rgba(255,255,255,0.8)' : '#7C3AED', display: 'block' }} />}
                  </button>
                )
              })}
            </div>
            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(0,0,0,0.06)', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '11px', color: '#787774' }}>
                이번 달 저널 {notes.filter(n => n.record_date.startsWith(`${calYear}-${String(calMonth + 1).padStart(2, '0')}`)).length}개
              </p>
            </div>
          </div>

          {/* 중: 저널 목록 */}
          <div style={{ ...cardStyle, padding: '24px', minHeight: '500px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#37352F' }}>{panelTitle}</h2>
              <button onClick={openNew} style={{ ...btnPrimary, padding: '6px 14px', fontSize: '12px' }}>＋ 작성</button>
            </div>

            {displayedNotes.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
                <p style={{ margin: 0, fontSize: '32px' }}>📝</p>
                <p style={{ margin: 0, color: '#AEAAA4', fontSize: '14px' }}>이 {viewMode === 'date' ? '날짜에' : '카테고리에'} 저널이 없습니다</p>
                <button onClick={openNew} style={btnPrimary}>첫 저널 작성하기</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {displayedNotes.map(note => (
                  <div key={note.id} style={{ padding: '18px 20px', borderRadius: '12px', backgroundColor: '#F1F1EF', border: '1px solid rgba(0,0,0,0.06)', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#EBEBEA')}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link
                          to={`/life?tab=journal&note=${note.id}&source=calendar`}
                          style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#37352F', cursor: 'pointer', display: 'inline-block', textDecoration: 'none' }}
                          title="클릭하여 노트 열기 (Ctrl+클릭: 새 탭)"
                          onMouseEnter={e => (e.currentTarget.style.color = '#6366f1')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#37352F')}
                        >{note.title}</Link>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#6366f1', backgroundColor: 'rgba(99,102,241,0.12)', padding: '2px 8px', borderRadius: '999px' }}>{note.group_name}</span>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#7C3AED', backgroundColor: 'rgba(167,139,250,0.1)', padding: '2px 8px', borderRadius: '999px' }}>{note.sub_name}</span>
                          <span style={{ fontSize: '10px', color: '#787774' }}>{fmtDateKo(note.record_date)}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button onClick={() => openEdit(note)} style={{ ...btnGhost, padding: '4px 10px', fontSize: '11px' }}>편집</button>
                        <button onClick={() => handleDeleteNote(note.id)} style={{ ...btnGhost, padding: '4px 10px', fontSize: '11px', color: '#f87171', borderColor: 'rgba(248,113,113,0.25)' }}>삭제</button>
                      </div>
                    </div>
                    {note.content && (
                      <p style={{ margin: 0, fontSize: '13px', color: '#6B6B6B', lineHeight: 1.7, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{blockNoteToPlainPreview(note.content, 120)}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 우: 카테고리 사이드바 */}
          <div style={{ ...cardStyle, padding: '18px' }}>
            <p style={{ margin: '0 0 14px', fontSize: '11px', fontWeight: 800, color: '#6366f1', letterSpacing: '0.1em', textTransform: 'uppercase' }}>카테고리</p>
            {Object.keys(groupedCats).length === 0 ? (
              <p style={{ margin: 0, fontSize: '12px', color: '#AEAAA4' }}>카테고리가 없습니다.</p>
            ) : (
              Object.entries(groupedCats).map(([group, subs]) => (
                <div key={group} style={{ marginBottom: '4px' }}>
                  <button
                    onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(group) ? n.delete(group) : n.add(group); return n })}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 8px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left', color: '#37352F', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <span style={{ fontSize: '9px', color: '#787774', display: 'inline-block', transform: expanded.has(group) ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, flex: 1 }}>{group}</span>
                    <span style={{ fontSize: '10px', color: '#787774' }}>{subs.reduce((a, s) => a + (catCount[`${group}||${s}`] ?? 0), 0)}</span>
                  </button>
                  {expanded.has(group) && subs.map(sub => {
                    const isActive = viewMode === 'category' && selCat?.group === group && selCat?.sub === sub
                    return (
                      <button key={sub} onClick={() => { setSelCat({ group, sub }); setViewMode('category') }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px 6px 22px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: isActive ? 'rgba(99,102,241,0.15)' : 'transparent', color: isActive ? '#4F46E5' : '#9B9A97', fontSize: '12px', textAlign: 'left', transition: 'background 0.1s' }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#F7F7F5' }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent' }}
                      >
                        <span>· {sub}</span>
                        <span style={{ fontSize: '10px', color: isActive ? '#6366f1' : '#AEAAA4', backgroundColor: isActive ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0.04)', padding: '1px 6px', borderRadius: '999px' }}>
                          {catCount[`${group}||${sub}`] ?? 0}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))
            )}
            <button onClick={() => setCatEditOpen(true)} style={{ ...btnGhost, width: '100%', marginTop: '12px', textAlign: 'center' }}>✏️ 메뉴 편집</button>
          </div>
        </div>
      )}

      {/* 저널 에디터 모달 */}
      {editorOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '560px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.2)', padding: '28px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#37352F' }}>{editorNoteId === null ? '새 저널 작성' : '저널 편집'}</h3>
              <button onClick={() => setEditorOpen(false)} style={{ background: 'none', border: 'none', color: '#787774', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#9B9A97', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>날짜</label>
                <input type="date" value={edDate} onChange={e => setEdDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'light' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#9B9A97', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>대분류</label>
                  <select value={edGroup} onChange={e => { setEdGroup(e.target.value); setEdSub('') }} style={{ ...inputStyle, appearance: 'none' }}>
                    <option value="">선택</option>
                    {edGroups.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#9B9A97', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>소분류</label>
                  <select value={edSub} onChange={e => setEdSub(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                    <option value="">선택</option>
                    {edSubs.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#9B9A97', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>제목</label>
                <input type="text" value={edTitle} onChange={e => setEdTitle(e.target.value)} placeholder="저널 제목을 입력하세요" style={inputStyle} onFocus={e => (e.target.style.borderColor = '#6366f1')} onBlur={e => (e.target.style.borderColor = '#EBEBEA')} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#9B9A97', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>내용</label>
                <RichEditor value={edContent} onChange={setEdContent} contentKey={String(editorNoteId)} placeholder="자유롭게 기록하세요…" minHeight={200} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setEditorOpen(false)} style={btnGhost}>취소</button>
                <button onClick={saveNote} disabled={edSaving || !edTitle.trim() || !edDate || !edGroup || !edSub} style={{ ...btnPrimary, opacity: edSaving || !edTitle.trim() || !edDate || !edGroup || !edSub ? 0.5 : 1, cursor: edSaving ? 'wait' : 'pointer' }}>
                  {edSaving ? '저장 중…' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 카테고리 편집 모달 */}
      {catEditOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '500px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.2)', padding: '28px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#37352F' }}>✏️ 카테고리 편집</h3>
              <button onClick={() => { setCatEditOpen(false); setEditingCatId(null) }} style={{ background: 'none', border: 'none', color: '#787774', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>
            <div style={{ marginBottom: '20px' }}>
              {categories.map(cat => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid #FFFFFF' }}>
                  {editingCatId === cat.id ? (
                    <>
                      <input value={editCatGroup} onChange={e => setEditCatGroup(e.target.value)} placeholder="대분류" style={{ ...inputStyle, flex: 1 }} />
                      <input value={editCatSub} onChange={e => setEditCatSub(e.target.value)} placeholder="소분류" style={{ ...inputStyle, flex: 1 }} />
                      <button onClick={handleUpdateCat} style={{ ...btnPrimary, padding: '6px 12px', fontSize: '11px' }}>저장</button>
                      <button onClick={() => setEditingCatId(null)} style={{ ...btnGhost, padding: '6px 10px', fontSize: '11px' }}>취소</button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: '12px', color: '#37352F' }}>{cat.group_name}</span>
                      <span style={{ fontSize: '10px', color: '#7C3AED', backgroundColor: 'rgba(167,139,250,0.1)', padding: '2px 8px', borderRadius: '999px' }}>{cat.sub_name}</span>
                      <button onClick={() => { setEditingCatId(cat.id); setEditCatGroup(cat.group_name); setEditCatSub(cat.sub_name) }} style={{ ...btnGhost, padding: '4px 10px', fontSize: '11px' }}>수정</button>
                      <button onClick={() => handleDeleteCat(cat.id)} style={{ ...btnGhost, padding: '4px 10px', fontSize: '11px', color: '#f87171', borderColor: 'rgba(248,113,113,0.2)' }}>삭제</button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 700, color: '#6366f1' }}>＋ 새 카테고리 추가</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input value={newGroup} onChange={e => setNewGroup(e.target.value)} placeholder="대분류 (예: 창작)" style={{ ...inputStyle, flex: 1, minWidth: '120px' }} />
              <input value={newSub} onChange={e => setNewSub(e.target.value)} placeholder="소분류 (예: 스토리 아이디어)" style={{ ...inputStyle, flex: 1, minWidth: '120px' }} onKeyDown={e => { if (e.key === 'Enter') handleAddCat() }} />
              <button onClick={handleAddCat} disabled={catSaving || !newGroup.trim() || !newSub.trim()} style={{ ...btnPrimary, opacity: !newGroup.trim() || !newSub.trim() ? 0.5 : 1 }}>추가</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── CalendarPage ─────────────────────────────────────────────────────────────
export function CalendarPage() {
  const isMobile = useIsMobile()
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [calStore, setCalStore] = useState<CalStore>(() => loadCalendar())
  const [modal, setModal] = useState<{ day: string } | null>(null)
  const [form, setForm] = useState<Partial<CalEvent> | null>(null)

  const journalData = loadJournalForCalendarPage()
  const grid = buildCalGrid(year, month)
  const curPfx = `${year}-${String(month + 1).padStart(2, '0')}`

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }
  function goToday() { setYear(today.getFullYear()); setMonth(today.getMonth()) }

  function getActivity(dk: string): 0 | 1 | 2 | 3 {
    const e = journalData[dk]
    if (!e) return 0
    const b = e.blocks?.length ?? 0
    const l = e.content?.length ?? 0
    if (b >= 3 || l > 400) return 3
    if (b >= 1 || l > 100) return 2
    if (l > 0) return 1
    return 0
  }
  function getDayEvents(dk: string) { return calStore.events.filter(e => e.startDate <= dk && e.endDate >= dk) }
  function saveEvent() {
    if (!form?.title?.trim()) return
    const next: CalStore = { events: [...calStore.events, { title: '', color: EVENT_PALETTE[0], note: '', ...form, id: `ev_${Date.now()}` } as CalEvent] }
    setCalStore(next); saveCalendar(next); setForm(null)
  }
  function removeEvent(id: string) {
    const next = { events: calStore.events.filter(e => e.id !== id) }
    setCalStore(next); saveCalendar(next)
  }

  const ACT = ['', 'rgba(99,102,241,0.3)', 'rgba(99,102,241,0.62)', '#6366f1'] as const
  const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
  const DOWS = ['일', '월', '화', '수', '목', '금', '토']

  const navBtn: CSSProperties = {
    width: '34px', height: '34px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.06)',
    backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.15s', color: '#9B9A97',
  }
  const inputStyle: CSSProperties = {
    width: '100%', backgroundColor: '#F4F4F2', border: '1px solid rgba(0,0,0,0.06)',
    borderRadius: '10px', padding: '9px 13px', color: '#37352F', fontSize: '13px',
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '14px 10px' : '36px 48px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <CalendarDays size={14} color="#6366f1" />
            <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#6366f1', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Calendar</p>
          </div>
          <p style={{ margin: 0, fontSize: isMobile ? '18px' : '26px', fontWeight: 900, color: '#37352F', letterSpacing: '-0.5px' }}>{year}년 {MONTHS[month]}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={goToday} style={{ padding: '8px 20px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.35)', backgroundColor: 'rgba(99,102,241,0.1)', color: '#4F46E5', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.1)' }}
          >Today</button>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={prevMonth} style={navBtn} onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1' }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#EBEBEA' }}><ChevronLeft size={15} /></button>
            <button onClick={nextMonth} style={navBtn} onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1' }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#EBEBEA' }}><ChevronRight size={15} /></button>
          </div>
        </div>
      </div>

      {/* Grid container */}
      <div style={{ backgroundColor: '#EEF2FF', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>

        {/* DOW header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          {DOWS.map((d, i) => (
            <div key={d} style={{ padding: '13px 0', textAlign: 'center', fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em', color: i === 0 ? '#f87171' : i === 6 ? '#818cf8' : '#787774' }}>{d}</div>
          ))}
        </div>

        {/* Week rows */}
        {grid.map((week, wi) => {
          const wEvs = getWeekEvents(week, calStore.events)
          const maxLv = wEvs.reduce((m, e) => Math.max(m, e.level), -1)
          const evH = maxLv >= 0 ? (maxLv + 1) * 26 + 10 : 10

          return (
            <div key={wi} style={{ borderBottom: wi < 5 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>

              {/* Day numbers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', height: '48px' }}>
                {week.map((dk, di) => {
                  const inMonth = dk.startsWith(curPfx)
                  const isToday = dk === todayKey
                  const act = getActivity(dk)
                  const dayNum = parseInt(dk.slice(8))
                  return (
                    <div key={di} onClick={() => setModal({ day: dk })}
                      style={{ display: 'flex', alignItems: 'center', padding: '0 10px', gap: '5px', borderRight: di < 6 ? '1px solid rgba(0,0,0,0.06)' : 'none', cursor: 'pointer', transition: 'background 0.12s' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.06)' }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '' }}
                    >
                      <span style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? '#6366f1' : '', boxShadow: isToday ? '0 0 14px rgba(99,102,241,0.55)' : '', fontSize: '13px', fontWeight: isToday ? 800 : 400, color: isToday ? '#fff' : !inMonth ? '#383848' : di === 0 ? '#f87171' : di === 6 ? '#818cf8' : '#37352F' }}>
                        {dayNum}
                      </span>
                      {act > 0 && (
                        <span style={{ width: `${4 + act}px`, height: `${4 + act}px`, borderRadius: '50%', flexShrink: 0, backgroundColor: ACT[act], boxShadow: act === 3 ? '0 0 7px rgba(99,102,241,0.7)' : '' }} />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Event bars */}
              <div style={{ position: 'relative', height: `${evH}px`, overflow: 'hidden' }}>
                {wEvs.map(ev => {
                  const prevW = ev.startDate < week[0]
                  const nextW = ev.endDate > week[6]
                  return (
                    <div key={`${ev.id}_${wi}`}
                      onClick={e => { e.stopPropagation(); setModal({ day: prevW ? week[0] : week[ev.sc] }) }}
                      style={{ position: 'absolute', top: `${ev.level * 26 + 4}px`, left: `calc(${ev.sc / 7 * 100}% + 2px)`, width: `calc(${(ev.ec - ev.sc + 1) / 7 * 100}% - 4px)`, height: '22px', backgroundColor: `${ev.color}1e`, border: `1px solid ${ev.color}44`, borderRadius: `${prevW ? 0 : 5}px ${nextW ? 0 : 5}px ${nextW ? 0 : 5}px ${prevW ? 0 : 5}px`, display: 'flex', alignItems: 'center', paddingLeft: prevW ? '6px' : '10px', cursor: 'pointer', overflow: 'hidden', transition: 'background 0.12s' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = `${ev.color}32` }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = `${ev.color}1e` }}
                    >
                      {!prevW && <span style={{ fontSize: '11px', fontWeight: 700, color: ev.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '16px', padding: '0 4px' }}>
        <span style={{ fontSize: '11px', color: '#787774' }}>활동 강도:</span>
        {[1, 2, 3].map(n => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: `${4 + n}px`, height: `${4 + n}px`, borderRadius: '50%', backgroundColor: ACT[n as 1 | 2 | 3], display: 'inline-block', boxShadow: n === 3 ? '0 0 6px rgba(99,102,241,0.6)' : '' }} />
            <span style={{ fontSize: '10px', color: '#AEAAA4' }}>Lv.{n}</span>
          </div>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#AEAAA4' }}>날짜 클릭 → 일정 추가</span>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 7000 }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.56)' }} onClick={() => { setModal(null); setForm(null) }} />
          <div style={{ position: 'absolute', top: isMobile ? 'auto' : '50%', bottom: isMobile ? 0 : 'auto', left: isMobile ? 0 : '50%', right: isMobile ? 0 : 'auto', transform: isMobile ? 'none' : 'translate(-50%,-50%)', width: isMobile ? '100%' : '400px', backgroundColor: '#EEF2FF', borderRadius: isMobile ? '20px 20px 0 0' : '20px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 24px 80px rgba(0,0,0,0.55)', overflow: 'hidden' }}>

            {/* Modal header */}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#37352F' }}>{formatDateKoCalendarModal(modal.day, { full: true })}</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {!form && (
                  <button onClick={() => setForm({ startDate: modal.day, endDate: modal.day, color: EVENT_PALETTE[0], title: '', note: '' })} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 13px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.3)', backgroundColor: 'rgba(99,102,241,0.09)', color: '#4F46E5', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                    <Plus size={11} />일정 추가
                  </button>
                )}
                <button onClick={() => { setModal(null); setForm(null) }} style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={12} color="#6b7280" />
                </button>
              </div>
            </div>

            {!form ? (
              <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '14px 16px' }}>
                {getDayEvents(modal.day).length === 0 ? (
                  <p style={{ margin: 0, padding: '24px 0', textAlign: 'center', fontSize: '13px', color: '#AEAAA4' }}>이 날의 일정이 없습니다</p>
                ) : (
                  getDayEvents(modal.day).map(ev => (
                    <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: '12px', backgroundColor: `${ev.color}10`, border: `1px solid ${ev.color}28`, marginBottom: '8px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: ev.color, flexShrink: 0, marginTop: '4px' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#37352F' }}>{ev.title}</p>
                        {ev.note && <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#787774' }}>{ev.note}</p>}
                        <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#AEAAA4' }}>{ev.startDate === ev.endDate ? ev.startDate : `${ev.startDate} — ${ev.endDate}`}</p>
                      </div>
                      <button onClick={() => removeEvent(ev.id)} style={{ width: '22px', height: '22px', borderRadius: '5px', border: '1px solid rgba(239,68,68,0.22)', backgroundColor: 'rgba(239,68,68,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                        <X size={10} color="#ef4444" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div style={{ padding: '18px 22px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>제목 *</label>
                  <input value={form.title ?? ''} onChange={e => setForm(f => ({ ...f!, title: e.target.value }))} placeholder="일정 제목" style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>시작일</label>
                    <input type="date" value={form.startDate ?? ''} onChange={e => setForm(f => ({ ...f!, startDate: e.target.value }))} style={{ ...inputStyle, colorScheme: 'light' } as CSSProperties} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>종료일</label>
                    <input type="date" value={form.endDate ?? ''} onChange={e => setForm(f => ({ ...f!, endDate: e.target.value }))} style={{ ...inputStyle, colorScheme: 'light' } as CSSProperties} />
                  </div>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>색상</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {EVENT_PALETTE.map(col => (
                      <button key={col} onClick={() => setForm(f => ({ ...f!, color: col }))} style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: col, border: `2.5px solid ${form.color === col ? '#fff' : 'transparent'}`, cursor: 'pointer', transition: 'transform 0.1s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.25)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }} />
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>메모</label>
                  <textarea value={form.note ?? ''} onChange={e => setForm(f => ({ ...f!, note: e.target.value }))} placeholder="메모 (선택사항)..." rows={2} style={{ ...inputStyle, resize: 'none', lineHeight: '1.6' } as CSSProperties} />
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setForm(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: 'transparent', color: '#9B9A97', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>취소</button>
                  <button onClick={saveEvent} style={{ padding: '8px 22px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}>저장</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
