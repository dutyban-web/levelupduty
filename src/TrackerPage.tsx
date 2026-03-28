/**
 * TrackerPage — Plan vs Actual 인생 관제탑
 * 위클리 캘린더 · 카테고리 버튼 · 통계 · 시간 십계명
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import {
  loadTrackerBundle,
  saveTrackerBundle,
  newTrackerId,
  logsForDateRange,
  logsForDate,
  planLogsForDate,
  actualLogsForDate,
  totalMinutesByCategory,
  weekKeyFromDate,
  type TrackerBundle,
  type TrackerLog,
  type TrackerCategory,
  type TimeCommandment,
  type WeekFeedback,
} from './trackerData'
import { CircularDayTracker } from './CircularDayTracker'
import { getWeekRangeMonday } from './PomodoroWeeklyCalendar'
import { listPomodoroLogsInRange } from './pomodoroLogData'
import { Clock, Target, BarChart3, BookOpen, Plus, Trash2, Settings, ChevronDown } from 'lucide-react'
import {
  START_HOUR,
  END_HOUR,
  PX_PER_HOUR,
  SPAN_MIN,
  COL_HEIGHT,
  START_MIN,
  END_MIN,
  minutesToHm,
  renderHourLines,
  LogBlock,
} from './trackerTimeGrid'

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  border: '1px solid rgba(0,0,0,0.06)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  marginBottom: 20,
  overflow: 'hidden',
}
const headPad: React.CSSProperties = { padding: '16px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)' }
const bodyPad: React.CSSProperties = { padding: '14px 18px 18px' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#787774', marginBottom: 6 }
const inp: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid rgba(0,0,0,0.1)',
  fontSize: 14,
  boxSizing: 'border-box' as const,
  fontFamily: 'inherit',
}
const btnP: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  borderRadius: 10,
  border: 'none',
  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
  color: '#fff',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
}

export function TrackerPage() {
  const [bundle, setBundle] = useState<TrackerBundle>(() => loadTrackerBundle())
  const commit = useCallback(
    (fn: (b: TrackerBundle) => TrackerBundle) => {
      setBundle(prev => {
        const next = fn(prev)
        saveTrackerBundle(next)
        return next
      })
    },
    [],
  )

  const [weekAnchor, setWeekAnchor] = useState(() => new Date())
  const { start, end, days } = useMemo(() => getWeekRangeMonday(weekAnchor), [weekAnchor])
  const [timeboxOn, setTimeboxOn] = useState(false)
  const [tab, setTab] = useState<'calendar' | 'stats' | 'settings'>('calendar')

  const [entryModalOpen, setEntryModalOpen] = useState(false)
  const [entryType, setEntryType] = useState<'plan' | 'actual'>('actual')
  const [entryDate, setEntryDate] = useState(toYMD(new Date()))
  const [entryStart, setEntryStart] = useState('09:00')
  const [entryDuration, setEntryDuration] = useState(30)
  const [entryCatId, setEntryCatId] = useState('')
  const [entryTag, setEntryTag] = useState('')
  const [entryMemo, setEntryMemo] = useState('')

  const weekLogs = useMemo(() => logsForDateRange(bundle.logs, start, end), [bundle.logs, start, end])
  const wk = useMemo(() => weekKeyFromDate(start), [start])

  const currentFeedback = useMemo(
    () => bundle.feedbacks.find(f => f.weekKey === wk) ?? { weekKey: wk, regret: '', improve: '', updatedAt: '' },
    [bundle.feedbacks, wk],
  )

  const pomodoroLogs = useMemo(() => listPomodoroLogsInRange(start, end), [start, end])

  const openEntry = (type: 'plan' | 'actual', opts?: { date?: string; startTime?: string; duration?: number }) => {
    setEntryType(type)
    setEntryDate(opts?.date ?? toYMD(new Date()))
    setEntryStart(opts?.startTime ?? '09:00')
    setEntryDuration(opts?.duration ?? 30)
    setEntryCatId(bundle.categories[0]?.id ?? '')
    setEntryTag(bundle.categories[0]?.tags[0] ?? '')
    setEntryMemo('')
    setEntryModalOpen(true)
  }

  const saveEntry = () => {
    if (!entryCatId) return
    const log: TrackerLog = {
      id: newTrackerId(),
      type: entryType,
      date: entryDate,
      startTime: entryStart.trim(),
      duration: Math.max(1, entryDuration),
      categoryId: entryCatId,
      tag: entryTag,
      memo: entryMemo.trim() || undefined,
      createdAt: new Date().toISOString(),
    }
    commit(b => ({ ...b, logs: [...b.logs, log] }))
    setEntryModalOpen(false)
  }

  const removeLog = (id: string) => {
    if (!window.confirm('이 기록을 삭제할까요?')) return
    commit(b => ({ ...b, logs: b.logs.filter(l => l.id !== id) }))
  }

  const patchLog = useCallback(
    (id: string, patch: Partial<Pick<TrackerLog, 'startTime' | 'duration'>>) => {
      commit(b => ({
        ...b,
        logs: b.logs.map(l => (l.id === id ? { ...l, ...patch } : l)),
      }))
    },
    [commit],
  )

  const selectedCat = useMemo(() => bundle.categories.find(c => c.id === entryCatId), [bundle.categories, entryCatId])

  const shiftWeek = (delta: number) => {
    const d = new Date(weekAnchor)
    d.setDate(d.getDate() + delta * 7)
    setWeekAnchor(d)
  }

  const saveFeedback = (field: 'regret' | 'improve', val: string) => {
    commit(b => {
      const exists = b.feedbacks.find(f => f.weekKey === wk)
      const updated: WeekFeedback = {
        weekKey: wk,
        regret: field === 'regret' ? val : (exists?.regret ?? ''),
        improve: field === 'improve' ? val : (exists?.improve ?? ''),
        updatedAt: new Date().toISOString(),
      }
      return {
        ...b,
        feedbacks: exists
          ? b.feedbacks.map(f => (f.weekKey === wk ? updated : f))
          : [...b.feedbacks, updated],
      }
    })
  }

  const promoteToCommandment = (text: string, source: 'regret' | 'improve') => {
    if (!text.trim()) return
    commit(b => ({
      ...b,
      commandments: [
        ...b.commandments,
        { id: newTrackerId(), text: text.trim(), source, createdAt: new Date().toISOString() },
      ],
    }))
  }

  const removeCommandment = (id: string) => {
    commit(b => ({ ...b, commandments: b.commandments.filter(c => c.id !== id) }))
  }

  const hours = useMemo(() => {
    const h: number[] = []
    for (let hh = START_HOUR; hh < END_HOUR; hh++) h.push(hh)
    return h
  }, [])

  const catMap = useMemo(() => {
    const m = new Map<string, TrackerCategory>()
    for (const c of bundle.categories) m.set(c.id, c)
    return m
  }, [bundle.categories])

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px' }}>
      {/* 시간 십계명 */}
      {bundle.commandments.length > 0 && (
        <section style={{ ...card, marginBottom: 28, borderColor: 'rgba(99,102,241,0.25)' }}>
          <div style={{ ...headPad, background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.05))', display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen size={18} color="#6366f1" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#37352F' }}>시간 관리 십계명</h3>
            <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>({bundle.commandments.length})</span>
          </div>
          <div style={bodyPad}>
            <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bundle.commandments.map((c, i) => (
                <li key={c.id} style={{ fontSize: 14, color: '#37352F', lineHeight: 1.6, fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ flex: 1 }}>{c.text}</span>
                    <span style={{ fontSize: 10, color: c.source === 'regret' ? '#b91c1c' : '#059669', background: c.source === 'regret' ? '#fef2f2' : '#ecfdf5', padding: '2px 8px', borderRadius: 999, fontWeight: 700, flexShrink: 0 }}>
                      {c.source === 'regret' ? '아쉬움' : '개선'}
                    </span>
                    <button type="button" onClick={() => removeCommandment(c.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}>
                      <Trash2 size={14} color="#9ca3af" />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Clock size={22} color="#6366f1" />
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#37352F' }}>Tracker</h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#787774', lineHeight: 1.6, maxWidth: 600 }}>
            <strong>Plan(계획)</strong>과 <strong>Actual(실제)</strong>를 대조해 시간 누수를 잡으세요. 기록은 카테고리·태그 단위로 통계됩니다.
          </p>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([['calendar', '캘린더', <Target size={14} key="c" />], ['stats', '통계', <BarChart3 size={14} key="s" />], ['settings', '설정', <Settings size={14} key="g" />]] as const).map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 10,
              border: tab === id ? '1px solid #6366f1' : '1px solid rgba(0,0,0,0.08)',
              background: tab === id ? 'rgba(99,102,241,0.1)' : '#fff',
              color: tab === id ? '#4f46e5' : '#57534e',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {tab === 'calendar' && (
        <CalendarTab
          bundle={bundle}
          weekAnchor={weekAnchor}
          start={start}
          end={end}
          days={days}
          weekLogs={weekLogs}
          pomodoroLogs={pomodoroLogs}
          timeboxOn={timeboxOn}
          setTimeboxOn={setTimeboxOn}
          catMap={catMap}
          hours={hours}
          onShiftWeek={shiftWeek}
          onSetWeekAnchor={setWeekAnchor}
          onOpenEntry={openEntry}
          onRemoveLog={removeLog}
          onPatchLog={patchLog}
          currentFeedback={currentFeedback}
          onSaveFeedback={saveFeedback}
          onPromote={promoteToCommandment}
        />
      )}

      {tab === 'stats' && (
        <StatsTab bundle={bundle} weekLogs={weekLogs} start={start} end={end} catMap={catMap} />
      )}

      {tab === 'settings' && (
        <SettingsTab bundle={bundle} commit={commit} />
      )}

      {/* Entry modal */}
      {entryModalOpen && (
        <div
          role="dialog"
          style={{ position: 'fixed', inset: 0, zIndex: 50000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setEntryModalOpen(false) }}
        >
          <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 16, padding: 22, boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 900, color: '#37352F' }}>
              {entryType === 'plan' ? '계획 (Plan) 추가' : '실제 (Actual) 기록'}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lbl}>날짜</label>
                <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>시작 시각</label>
                <input value={entryStart} onChange={e => setEntryStart(e.target.value)} style={inp} placeholder="09:00" />
              </div>
            </div>

            <label style={lbl}>소요 시간 (분)</label>
            <input type="number" min={1} value={entryDuration} onChange={e => setEntryDuration(Number(e.target.value))} style={{ ...inp, marginBottom: 12 }} />

            <label style={lbl}>카테고리</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {bundle.categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setEntryCatId(cat.id)
                    setEntryTag(cat.tags[0] ?? '')
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: entryCatId === cat.id ? `2px solid ${cat.color}` : '1px solid rgba(0,0,0,0.1)',
                    background: entryCatId === cat.id ? `${cat.color}18` : '#fff',
                    color: entryCatId === cat.id ? cat.color : '#57534e',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {selectedCat && selectedCat.tags.length > 0 && (
              <>
                <label style={lbl}>태그</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {selectedCat.tags.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEntryTag(t)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 999,
                        border: entryTag === t ? `2px solid ${selectedCat.color}` : '1px solid rgba(0,0,0,0.08)',
                        background: entryTag === t ? `${selectedCat.color}14` : '#f5f5f4',
                        color: entryTag === t ? selectedCat.color : '#78716c',
                        fontWeight: entryTag === t ? 700 : 500,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}

            <label style={lbl}>메모 (선택)</label>
            <textarea value={entryMemo} onChange={e => setEntryMemo(e.target.value)} style={{ ...inp, minHeight: 60, resize: 'vertical', marginBottom: 16 }} placeholder="자유 메모" />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEntryModalOpen(false)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                취소
              </button>
              <button type="button" onClick={saveEntry} style={btnP}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Calendar Tab ─────────────────────────────────────────────────────────── */

function CalendarTab({
  bundle, weekAnchor, start, end, days, weekLogs, pomodoroLogs, timeboxOn, setTimeboxOn,
  catMap, hours, onShiftWeek, onSetWeekAnchor, onOpenEntry, onRemoveLog, onPatchLog,
  currentFeedback, onSaveFeedback, onPromote,
}: {
  bundle: TrackerBundle
  weekAnchor: Date
  start: string
  end: string
  days: Date[]
  weekLogs: TrackerLog[]
  pomodoroLogs: ReturnType<typeof listPomodoroLogsInRange>
  timeboxOn: boolean
  setTimeboxOn: (v: boolean) => void
  catMap: Map<string, TrackerCategory>
  hours: number[]
  onShiftWeek: (d: number) => void
  onSetWeekAnchor: (d: Date) => void
  onOpenEntry: (t: 'plan' | 'actual', opts?: { date?: string; startTime?: string; duration?: number }) => void
  onRemoveLog: (id: string) => void
  onPatchLog: (id: string, patch: Partial<Pick<TrackerLog, 'startTime' | 'duration'>>) => void
  currentFeedback: WeekFeedback
  onSaveFeedback: (field: 'regret' | 'improve', val: string) => void
  onPromote: (text: string, source: 'regret' | 'improve') => void
}) {
  const [ringDate, setRingDate] = useState(() => toYMD(new Date()))
  const ringDayLogs = useMemo(() => logsForDate(bundle.logs, ringDate), [bundle.logs, ringDate])

  /** 우클릭으로 일정 추가 (위클리 그리드) */
  const [schedMenu, setSchedMenu] = useState<null | {
    x: number
    y: number
    date: string
    startTime: string
    preset?: 'plan' | 'actual'
  }>(null)

  useEffect(() => {
    if (!schedMenu) return
    const close = () => setSchedMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [schedMenu])

  const handleGridContextMenu = (e: React.MouseEvent, dk: string, preset?: 'plan' | 'actual') => {
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    const relY = e.clientY - rect.top
    const rawMin = START_MIN + (relY / COL_HEIGHT) * SPAN_MIN
    const rounded = Math.round(rawMin / 5) * 5
    const clamped = Math.max(START_MIN, Math.min(END_MIN - 15, rounded))
    const startTime = minutesToHm(clamped)
    setSchedMenu({ x: e.clientX, y: e.clientY, date: dk, startTime, preset })
  }

  return (
    <>
      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => onShiftWeek(-1)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', background: '#fff', cursor: 'pointer', fontSize: 12 }}>
            ← 이전 주
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#37352F' }}>{start} ~ {end}</span>
          <button type="button" onClick={() => onShiftWeek(1)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', background: '#fff', cursor: 'pointer', fontSize: 12 }}>
            다음 주 →
          </button>
          <button type="button" onClick={() => onSetWeekAnchor(new Date())} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #6366f1', background: 'rgba(99,102,241,0.08)', cursor: 'pointer', fontSize: 12, color: '#4f46e5', fontWeight: 600 }}>
            오늘
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#6366f1', cursor: 'pointer', padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.35)', background: timeboxOn ? 'rgba(99,102,241,0.12)' : '#fff' }}>
            <input type="checkbox" checked={timeboxOn} onChange={() => setTimeboxOn(!timeboxOn)} style={{ accentColor: '#6366f1' }} />
            Timebox ON
          </label>
          <button type="button" onClick={() => onOpenEntry('plan')} style={{ ...btnP, background: '#f59e0b', fontSize: 12 }}>
            <Plus size={14} /> 계획
          </button>
          <button type="button" onClick={() => onOpenEntry('actual')} style={{ ...btnP, fontSize: 12 }}>
            <Plus size={14} /> 실제
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#787774' }}>원형 뷰 날짜 (주간 그리드와 동일 데이터)</span>
        {days.map(d => {
          const dk = toYMD(d)
          const sel = dk === ringDate
          return (
            <button
              key={`ring-${dk}`}
              type="button"
              onClick={() => setRingDate(dk)}
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                border: sel ? '1px solid #6366f1' : '1px solid rgba(0,0,0,0.1)',
                background: sel ? 'rgba(99,102,241,0.12)' : '#fff',
                fontSize: 11,
                fontWeight: 700,
                color: sel ? '#4f46e5' : '#37352F',
                cursor: 'pointer',
              }}
            >
              {d.getMonth() + 1}/{d.getDate()}
            </button>
          )
        })}
      </div>

      <CircularDayTracker
        dateYmd={ringDate}
        onDateYmdChange={setRingDate}
        dayLogs={ringDayLogs}
        catMap={catMap}
        onAddSchedule={(type, opts) => onOpenEntry(type, { date: ringDate, startTime: opts.startTime, duration: opts.duration ?? 60 })}
      />

      {/* Weekly Grid */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', background: '#FAFAF8', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `52px repeat(7, minmax(${timeboxOn ? '160px' : '96px'}, 1fr))`, minWidth: timeboxOn ? 1280 : 800 }}>
          <div style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', borderRight: '1px solid rgba(0,0,0,0.06)', padding: 8, fontSize: 10, color: '#9B9A97' }} />
          {days.map(d => {
            const dk = toYMD(d)
            const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
            const isToday = d.toDateString() === new Date().toDateString()
            return (
              <div
                key={dk}
                style={{
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                  borderRight: '1px solid rgba(0,0,0,0.06)',
                  padding: '8px 6px',
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: isToday ? '#4F46E5' : '#37352F',
                }}
              >
                {wd} {d.getMonth() + 1}/{d.getDate()}
                {timeboxOn && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 0, fontSize: 9, color: '#9ca3af', marginTop: 2 }}>
                    <span style={{ flex: 1, textAlign: 'center', borderRight: '1px solid rgba(0,0,0,0.08)' }}>Plan</span>
                    <span style={{ flex: 1, textAlign: 'center' }}>Actual</span>
                  </div>
                )}
              </div>
            )
          })}

          {/* Hour labels */}
          <div style={{ borderRight: '1px solid rgba(0,0,0,0.06)', position: 'relative' }}>
            {hours.map(hh => (
              <div
                key={hh}
                style={{
                  height: PX_PER_HOUR,
                  borderBottom: '1px dashed rgba(0,0,0,0.05)',
                  fontSize: 10,
                  color: '#AEAAA4',
                  paddingLeft: 4,
                  boxSizing: 'border-box',
                }}
              >
                {String(hh).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map(d => {
            const dk = toYMD(d)
            const plans = planLogsForDate(weekLogs, dk)
            const actuals = actualLogsForDate(weekLogs, dk)
            const pomos = pomodoroLogs.filter(p => p.date === dk)

            return (
              <div
                key={`col-${dk}`}
                style={{
                  borderRight: '1px solid rgba(0,0,0,0.06)',
                  position: 'relative',
                  height: COL_HEIGHT,
                  display: timeboxOn ? 'grid' : 'block',
                  gridTemplateColumns: timeboxOn ? '1fr 1fr' : undefined,
                }}
              >
                {timeboxOn ? (
                  <>
                    {/* Plan half */}
                    <div
                      style={{ position: 'relative', borderRight: '1px dashed rgba(245,158,11,0.3)' }}
                      onContextMenu={e => handleGridContextMenu(e, dk, 'plan')}
                    >
                      {renderHourLines(hours)}
                      {plans.map(log => (
                        <LogBlock
                          key={log.id}
                          log={log}
                          cat={catMap.get(log.categoryId)}
                          isPlan
                          onRemove={() => onRemoveLog(log.id)}
                          onPatch={patch => onPatchLog(log.id, patch)}
                        />
                      ))}
                    </div>
                    {/* Actual half */}
                    <div style={{ position: 'relative' }} onContextMenu={e => handleGridContextMenu(e, dk, 'actual')}>
                      {renderHourLines(hours)}
                      {actuals.map(log => (
                        <LogBlock
                          key={log.id}
                          log={log}
                          cat={catMap.get(log.categoryId)}
                          isPlan={false}
                          onRemove={() => onRemoveLog(log.id)}
                          onPatch={patch => onPatchLog(log.id, patch)}
                        />
                      ))}
                      {pomos.map(p => {
                        const [h, m] = p.startTimeLocal.split(':').map(Number)
                        const startMin = h * 60 + m
                        const rel = startMin - START_HOUR * 60
                        const top = Math.max(0, (rel / SPAN_MIN) * COL_HEIGHT)
                        const height = Math.max(14, (p.minutes / SPAN_MIN) * COL_HEIGHT)
                        return (
                          <div
                            key={p.id}
                            title={`[포모도로] ${p.questTitle ?? ''} ${p.minutes}분`}
                            style={{
                              position: 'absolute',
                              left: 2,
                              right: 2,
                              top,
                              height,
                              borderRadius: 6,
                              background: 'linear-gradient(180deg, rgba(16,185,129,0.85), rgba(5,150,105,0.8))',
                              color: '#fff',
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '2px 4px',
                              overflow: 'hidden',
                              boxShadow: '0 1px 4px rgba(16,185,129,0.3)',
                            }}
                          >
                            {p.questTitle ?? '집중'} {p.minutes}분
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  /* No timebox — single column */
                  <div style={{ position: 'relative', height: '100%' }} onContextMenu={e => handleGridContextMenu(e, dk)}>
                    {renderHourLines(hours)}
                    {actuals.map(log => (
                      <LogBlock
                        key={log.id}
                        log={log}
                        cat={catMap.get(log.categoryId)}
                        isPlan={false}
                        onRemove={() => onRemoveLog(log.id)}
                        onPatch={patch => onPatchLog(log.id, patch)}
                      />
                    ))}
                    {pomos.map(p => {
                      const [h, m] = p.startTimeLocal.split(':').map(Number)
                      const startMin = h * 60 + m
                      const rel = startMin - START_HOUR * 60
                      const top = Math.max(0, (rel / SPAN_MIN) * COL_HEIGHT)
                      const height = Math.max(14, (p.minutes / SPAN_MIN) * COL_HEIGHT)
                      return (
                        <div
                          key={p.id}
                          title={`[포모도로] ${p.questTitle ?? ''} ${p.minutes}분`}
                          style={{
                            position: 'absolute',
                            left: 3,
                            right: 3,
                            top,
                            height,
                            borderRadius: 6,
                            background: 'linear-gradient(180deg, rgba(16,185,129,0.85), rgba(5,150,105,0.8))',
                            color: '#fff',
                            fontSize: 9,
                            fontWeight: 700,
                            padding: '2px 4px',
                            overflow: 'hidden',
                            boxShadow: '0 1px 4px rgba(16,185,129,0.3)',
                          }}
                        >
                          {p.questTitle ?? '집중'} {p.minutes}분
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Feedback */}
      <section style={card}>
        <div style={headPad}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#37352F' }}>주간 피드백 ({start} 주)</h3>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#787774' }}>아쉬운 점·개선 방향을 적고, 「십계명에 추가」로 상단 고정할 수 있습니다.</p>
        </div>
        <div style={{ ...bodyPad, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div>
            <label style={{ ...lbl, color: '#b91c1c' }}>아쉬운 점</label>
            <textarea
              value={currentFeedback.regret}
              onChange={e => onSaveFeedback('regret', e.target.value)}
              style={{ ...inp, minHeight: 80, resize: 'vertical' }}
              placeholder="어디서 시간이 새었나…"
            />
            <button
              type="button"
              onClick={() => promoteLines(currentFeedback.regret, 'regret', onPromote)}
              style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 8, background: '#fef2f2', padding: '6px 10px', cursor: 'pointer' }}
            >
              십계명에 추가
            </button>
          </div>
          <div>
            <label style={{ ...lbl, color: '#059669' }}>개선 방향</label>
            <textarea
              value={currentFeedback.improve}
              onChange={e => onSaveFeedback('improve', e.target.value)}
              style={{ ...inp, minHeight: 80, resize: 'vertical' }}
              placeholder="다음 주엔 이렇게…"
            />
            <button
              type="button"
              onClick={() => promoteLines(currentFeedback.improve, 'improve', onPromote)}
              style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: '#059669', border: '1px solid #6ee7b7', borderRadius: 8, background: '#ecfdf5', padding: '6px 10px', cursor: 'pointer' }}
            >
              십계명에 추가
            </button>
          </div>
        </div>
      </section>

      {schedMenu && (
        <div
          role="menu"
          style={{
            position: 'fixed',
            left: Math.min(schedMenu.x, typeof window !== 'undefined' ? window.innerWidth - 200 : schedMenu.x),
            top: Math.min(schedMenu.y, typeof window !== 'undefined' ? window.innerHeight - 120 : schedMenu.y),
            zIndex: 10050,
            minWidth: 168,
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.1)',
            background: '#fff',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: 6,
          }}
          onClick={ev => ev.stopPropagation()}
          onMouseDown={ev => ev.stopPropagation()}
        >
          <p style={{ margin: '0 0 6px', padding: '4px 8px', fontSize: 10, fontWeight: 800, color: '#787774' }}>
            {schedMenu.startTime} 시작
          </p>
          {(schedMenu.preset === undefined || schedMenu.preset === 'plan') && (
            <button
              type="button"
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                border: 'none',
                borderRadius: 8,
                background: 'rgba(245,158,11,0.12)',
                color: '#b45309',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                marginBottom: 4,
              }}
              onClick={() => {
                onOpenEntry('plan', { date: schedMenu.date, startTime: schedMenu.startTime, duration: 60 })
                setSchedMenu(null)
              }}
            >
              계획(Plan) 추가
            </button>
          )}
          {(schedMenu.preset === undefined || schedMenu.preset === 'actual') && (
            <button
              type="button"
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                border: 'none',
                borderRadius: 8,
                background: 'rgba(99,102,241,0.12)',
                color: '#4338ca',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
              }}
              onClick={() => {
                onOpenEntry('actual', { date: schedMenu.date, startTime: schedMenu.startTime, duration: 60 })
                setSchedMenu(null)
              }}
            >
              실제(Actual) 추가
            </button>
          )}
        </div>
      )}
    </>
  )
}

function promoteLines(text: string, source: 'regret' | 'improve', fn: (t: string, s: 'regret' | 'improve') => void) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return
  for (const l of lines) fn(l, source)
}

/* ─── Stats Tab ────────────────────────────────────────────────────────────── */

function StatsTab({
  bundle, weekLogs, start, end, catMap,
}: {
  bundle: TrackerBundle
  weekLogs: TrackerLog[]
  start: string
  end: string
  catMap: Map<string, TrackerCategory>
}) {
  const actuals = useMemo(() => weekLogs.filter(l => l.type === 'actual'), [weekLogs])
  const plans = useMemo(() => weekLogs.filter(l => l.type === 'plan'), [weekLogs])
  const catMinActual = useMemo(() => totalMinutesByCategory(actuals), [actuals])
  const catMinPlan = useMemo(() => totalMinutesByCategory(plans), [plans])

  const pieData = useMemo(() => {
    const arr: { name: string; value: number; fill: string }[] = []
    for (const [catId, min] of catMinActual) {
      const cat = catMap.get(catId)
      arr.push({ name: cat?.label ?? catId, value: min, fill: cat?.color ?? '#6b7280' })
    }
    return arr.sort((a, b) => b.value - a.value)
  }, [catMinActual, catMap])

  const barData = useMemo(() => {
    const allCatIds = new Set([...catMinPlan.keys(), ...catMinActual.keys()])
    const arr: { name: string; plan: number; actual: number; fill: string }[] = []
    for (const catId of allCatIds) {
      const cat = catMap.get(catId)
      arr.push({
        name: cat?.label ?? catId,
        plan: catMinPlan.get(catId) ?? 0,
        actual: catMinActual.get(catId) ?? 0,
        fill: cat?.color ?? '#6b7280',
      })
    }
    return arr.sort((a, b) => b.actual - a.actual)
  }, [catMinPlan, catMinActual, catMap])

  const totalPlanMin = useMemo(() => plans.reduce((s, l) => s + l.duration, 0), [plans])
  const totalActualMin = useMemo(() => actuals.reduce((s, l) => s + l.duration, 0), [actuals])
  const achieveRate = totalPlanMin > 0 ? Math.round((totalActualMin / totalPlanMin) * 100) : 0

  const leakData = useMemo(() => {
    return barData
      .filter(d => d.plan > 0 && d.actual < d.plan)
      .map(d => ({ name: d.name, leak: d.plan - d.actual }))
      .sort((a, b) => b.leak - a.leak)
  }, [barData])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 20 }}>
      {/* Summary */}
      <section style={card}>
        <div style={headPad}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#37352F' }}>주간 요약 ({start})</h3>
        </div>
        <div style={{ ...bodyPad, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <StatNumber label="계획 시간" value={`${Math.floor(totalPlanMin / 60)}h ${totalPlanMin % 60}m`} color="#f59e0b" />
          <StatNumber label="실제 시간" value={`${Math.floor(totalActualMin / 60)}h ${totalActualMin % 60}m`} color="#6366f1" />
          <StatNumber label="달성률" value={totalPlanMin > 0 ? `${achieveRate}%` : '—'} color={achieveRate >= 80 ? '#059669' : achieveRate >= 50 ? '#d97706' : '#b91c1c'} />
        </div>
      </section>

      {/* Leak */}
      {leakData.length > 0 && (
        <section style={{ ...card, borderColor: 'rgba(185,28,28,0.2)' }}>
          <div style={{ ...headPad, background: '#fef2f2' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#991b1b' }}>시간 누수 포인트</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#b91c1c' }}>계획보다 적게 투자된 카테고리</p>
          </div>
          <div style={bodyPad}>
            {leakData.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#37352F', minWidth: 60 }}>{d.name}</span>
                <div style={{ flex: 1, background: '#fecaca', borderRadius: 999, height: 10, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#ef4444', borderRadius: 999, width: `${Math.min(100, (d.leak / (totalPlanMin || 1)) * 100 * 3)}%` }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c' }}>-{d.leak}분</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pie */}
      {pieData.length > 0 && (
        <section style={card}>
          <div style={headPad}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#37352F' }}>카테고리별 실제 시간 (Pie)</h3>
          </div>
          <div style={{ ...bodyPad, display: 'flex', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={100} paddingAngle={2} label={({ name, value }) => `${name} ${value}분`}>
                  {pieData.map(d => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${v}분`} />
                <Legend verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Bar */}
      {barData.length > 0 && (
        <section style={card}>
          <div style={headPad}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#37352F' }}>Plan vs Actual (Bar)</h3>
          </div>
          <div style={{ ...bodyPad, display: 'flex', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} unit="분" />
                <Tooltip formatter={(v: number) => `${v}분`} />
                <Legend />
                <Bar dataKey="plan" name="계획" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="실제" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {pieData.length === 0 && barData.length === 0 && (
        <section style={card}>
          <div style={{ ...bodyPad, textAlign: 'center', color: '#AEAAA4', padding: '48px 20px' }}>
            이번 주 기록이 없습니다. 캘린더 탭에서 기록을 추가해 보세요.
          </div>
        </section>
      )}
    </div>
  )
}

function StatNumber({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 80 }}>
      <div style={{ fontSize: 24, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#787774', marginTop: 4 }}>{label}</div>
    </div>
  )
}

/* ─── Settings Tab ─────────────────────────────────────────────────────────── */

function SettingsTab({ bundle, commit }: { bundle: TrackerBundle; commit: (fn: (b: TrackerBundle) => TrackerBundle) => void }) {
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState('#6366f1')
  const [newTags, setNewTags] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTagsInput, setEditTagsInput] = useState('')

  const addCategory = () => {
    if (!newLabel.trim()) return
    const cat: TrackerCategory = {
      id: newTrackerId(),
      label: newLabel.trim(),
      color: newColor,
      tags: newTags.split(',').map(s => s.trim()).filter(Boolean),
    }
    commit(b => ({ ...b, categories: [...b.categories, cat] }))
    setNewLabel('')
    setNewTags('')
  }

  const removeCategory = (id: string) => {
    if (!window.confirm('이 카테고리를 삭제할까요? (기존 로그는 유지됩니다)')) return
    commit(b => ({ ...b, categories: b.categories.filter(c => c.id !== id) }))
  }

  return (
    <section style={card}>
      <div style={headPad}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#37352F' }}>카테고리 · 태그 관리</h3>
      </div>
      <div style={bodyPad}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20, alignItems: 'flex-end' }}>
          <div>
            <label style={lbl}>카테고리명</label>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} style={{ ...inp, width: 140 }} placeholder="예: 원고" />
          </div>
          <div>
            <label style={lbl}>색상</label>
            <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={{ width: 44, height: 38, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, cursor: 'pointer' }} />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label style={lbl}>태그 (쉼표로 구분)</label>
            <input value={newTags} onChange={e => setNewTags(e.target.value)} style={inp} placeholder="데생, 콘티, 채색" />
          </div>
          <button type="button" onClick={addCategory} style={btnP}>
            <Plus size={14} /> 추가
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {bundle.categories.map(cat => (
            <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)', background: '#fafafa', flexWrap: 'wrap' }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: cat.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: '#37352F', minWidth: 60 }}>{cat.label}</span>
              <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {editingId === cat.id ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
                    <input
                      value={editTagsInput}
                      onChange={e => setEditTagsInput(e.target.value)}
                      style={{ ...inp, flex: 1 }}
                      placeholder="쉼표로 구분"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        commit(b => ({
                          ...b,
                          categories: b.categories.map(c =>
                            c.id === cat.id
                              ? { ...c, tags: editTagsInput.split(',').map(s => s.trim()).filter(Boolean) }
                              : c,
                          ),
                        }))
                        setEditingId(null)
                      }}
                      style={{ ...btnP, fontSize: 11, padding: '6px 10px' }}
                    >
                      저장
                    </button>
                  </div>
                ) : (
                  cat.tags.map(t => (
                    <span key={t} style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: `${cat.color}18`, color: cat.color }}>
                      {t}
                    </span>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={() => { setEditingId(editingId === cat.id ? null : cat.id); setEditTagsInput(cat.tags.join(', ')) }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, fontSize: 11, color: '#6366f1', fontWeight: 700 }}
              >
                {editingId === cat.id ? '취소' : '태그 편집'}
              </button>
              <button type="button" onClick={() => removeCategory(cat.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4 }}>
                <Trash2 size={14} color="#9ca3af" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
