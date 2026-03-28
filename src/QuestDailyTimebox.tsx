/**
 * 퀘스트 보드 오른쪽 — 오늘 하루 Tracker 타임박스 (위클리 그리드와 동일 데이터·동작)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import {
  loadTrackerBundle,
  saveTrackerBundle,
  newTrackerId,
  planLogsForDate,
  actualLogsForDate,
  type TrackerBundle,
  type TrackerLog,
  type TrackerCategory,
} from './trackerData'
import { listPomodoroLogsInRange } from './pomodoroLogData'
import {
  START_HOUR,
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

type Props = {
  onOpenFullTracker?: () => void
}

export function QuestDailyTimebox({ onOpenFullTracker }: Props) {
  const [bundle, setBundle] = useState<TrackerBundle>(() => loadTrackerBundle())
  const [pomoTick, setPomoTick] = useState(0)
  const [timeboxOn, setTimeboxOn] = useState(false)

  const commit = useCallback((fn: (b: TrackerBundle) => TrackerBundle) => {
    setBundle(prev => {
      const next = fn(prev)
      saveTrackerBundle(next)
      return next
    })
  }, [])

  useEffect(() => {
    const sync = () => setBundle(loadTrackerBundle())
    const bumpPomo = () => setPomoTick(t => t + 1)
    window.addEventListener('tracker-bundle-changed', sync)
    window.addEventListener('pomodoro-log-changed', bumpPomo)
    return () => {
      window.removeEventListener('tracker-bundle-changed', sync)
      window.removeEventListener('pomodoro-log-changed', bumpPomo)
    }
  }, [])

  const todayYmd = toYMD(new Date())
  const wd = ['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()]
  const mdLabel = useMemo(() => {
    const [, m, d] = todayYmd.split('-').map(Number)
    return `${m}월 ${d}일`
  }, [todayYmd])

  const hours = useMemo(() => {
    const h: number[] = []
    for (let hh = START_HOUR; hh < 24; hh++) h.push(hh)
    return h
  }, [])

  const catMap = useMemo(() => {
    const m = new Map<string, TrackerCategory>()
    for (const c of bundle.categories) m.set(c.id, c)
    return m
  }, [bundle.categories])

  const pomodoroLogs = useMemo(
    () => listPomodoroLogsInRange(todayYmd, todayYmd),
    [todayYmd, pomoTick],
  )

  const plans = useMemo(() => planLogsForDate(bundle.logs, todayYmd), [bundle.logs, todayYmd])
  const actuals = useMemo(() => actualLogsForDate(bundle.logs, todayYmd), [bundle.logs, todayYmd])

  const [entryModalOpen, setEntryModalOpen] = useState(false)
  const [entryType, setEntryType] = useState<'plan' | 'actual'>('actual')
  const [entryDate, setEntryDate] = useState(todayYmd)
  const [entryStart, setEntryStart] = useState('09:00')
  const [entryDuration, setEntryDuration] = useState(30)
  const [entryCatId, setEntryCatId] = useState('')
  const [entryTag, setEntryTag] = useState('')
  const [entryMemo, setEntryMemo] = useState('')

  useEffect(() => {
    if (!entryCatId && bundle.categories[0]) {
      setEntryCatId(bundle.categories[0].id)
      setEntryTag(bundle.categories[0].tags[0] ?? '')
    }
  }, [bundle.categories, entryCatId])

  const selectedCat = useMemo(() => bundle.categories.find(c => c.id === entryCatId), [bundle.categories, entryCatId])

  const openEntry = (type: 'plan' | 'actual', opts?: { date?: string; startTime?: string; duration?: number }) => {
    setEntryType(type)
    setEntryDate(opts?.date ?? todayYmd)
    setEntryStart(opts?.startTime ?? '09:00')
    setEntryDuration(opts?.duration ?? 60)
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

  const [schedMenu, setSchedMenu] = useState<null | {
    x: number
    y: number
    startTime: string
    preset?: 'plan' | 'actual'
  }>(null)

  useEffect(() => {
    if (!schedMenu) return
    const close = () => setSchedMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [schedMenu])

  const handleGridContextMenu = (e: React.MouseEvent, preset?: 'plan' | 'actual') => {
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    const relY = e.clientY - rect.top
    const rawMin = START_MIN + (relY / COL_HEIGHT) * SPAN_MIN
    const rounded = Math.round(rawMin / 5) * 5
    const clamped = Math.max(START_MIN, Math.min(END_MIN - 15, rounded))
    const startTime = minutesToHm(clamped)
    setSchedMenu({ x: e.clientX, y: e.clientY, startTime, preset })
  }

  const gridMinW = timeboxOn ? 280 : 200

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#37352F' }}>
              ⏱️ 타임박스 — {mdLabel} ({wd})
            </h3>
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#9ca3af', fontWeight: 600, lineHeight: 1.45 }}>
              Tracker와 같은 기록입니다. 우클릭으로 슬롯에 계획·실제 추가.
            </p>
          </div>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              color: '#6366f1',
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid rgba(99,102,241,0.35)',
              background: timeboxOn ? 'rgba(99,102,241,0.12)' : '#fff',
              flexShrink: 0,
            }}
          >
            <input type="checkbox" checked={timeboxOn} onChange={() => setTimeboxOn(!timeboxOn)} style={{ accentColor: '#6366f1' }} />
            계획 비교 {timeboxOn ? 'ON' : 'OFF'}
          </label>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <button type="button" onClick={() => openEntry('plan')} style={{ ...btnP, background: '#f59e0b', fontSize: 11, padding: '6px 12px' }}>
            <Plus size={14} /> 계획
          </button>
          <button type="button" onClick={() => openEntry('actual')} style={{ ...btnP, fontSize: 11, padding: '6px 12px' }}>
            <Plus size={14} /> 실제
          </button>
          {onOpenFullTracker && (
            <button
              type="button"
              onClick={onOpenFullTracker}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid rgba(0,0,0,0.1)',
                background: '#f5f5f4',
                fontSize: 11,
                fontWeight: 700,
                color: '#57534e',
                cursor: 'pointer',
              }}
            >
              주간 캘린더 →
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '12px 12px 16px', overflowX: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `44px minmax(${gridMinW}px, 1fr)`,
            minWidth: 44 + gridMinW,
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.06)',
            background: '#FAFAF8',
          }}
        >
          <div style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', borderRight: '1px solid rgba(0,0,0,0.06)' }} />
          <div
            style={{
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              padding: '8px 6px',
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: '#4F46E5',
            }}
          >
            오늘
            {timeboxOn && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 0, fontSize: 9, color: '#9ca3af', marginTop: 2 }}>
                <span style={{ flex: 1, textAlign: 'center', borderRight: '1px solid rgba(0,0,0,0.08)' }}>Plan</span>
                <span style={{ flex: 1, textAlign: 'center' }}>Actual</span>
              </div>
            )}
          </div>

          <div style={{ borderRight: '1px solid rgba(0,0,0,0.06)', position: 'relative' }}>
            {hours.map(hh => (
              <div
                key={hh}
                style={{
                  height: PX_PER_HOUR,
                  borderBottom: '1px dashed rgba(0,0,0,0.05)',
                  fontSize: 9,
                  color: '#AEAAA4',
                  paddingLeft: 4,
                  boxSizing: 'border-box',
                }}
              >
                {String(hh).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          <div
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
                <div
                  style={{ position: 'relative', borderRight: '1px dashed rgba(245,158,11,0.3)' }}
                  onContextMenu={e => handleGridContextMenu(e, 'plan')}
                >
                  {renderHourLines(hours)}
                  {plans.map(log => (
                    <LogBlock
                      key={log.id}
                      log={log}
                      cat={catMap.get(log.categoryId)}
                      isPlan
                      onRemove={() => removeLog(log.id)}
                      onPatch={patch => patchLog(log.id, patch)}
                    />
                  ))}
                </div>
                <div style={{ position: 'relative' }} onContextMenu={e => handleGridContextMenu(e, 'actual')}>
                  {renderHourLines(hours)}
                  {actuals.map(log => (
                    <LogBlock
                      key={log.id}
                      log={log}
                      cat={catMap.get(log.categoryId)}
                      isPlan={false}
                      onRemove={() => removeLog(log.id)}
                      onPatch={patch => patchLog(log.id, patch)}
                    />
                  ))}
                  {pomodoroLogs.map(p => {
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
              <div style={{ position: 'relative', height: '100%' }} onContextMenu={e => handleGridContextMenu(e)}>
                {renderHourLines(hours)}
                {actuals.map(log => (
                  <LogBlock
                    key={log.id}
                    log={log}
                    cat={catMap.get(log.categoryId)}
                    isPlan={false}
                    onRemove={() => removeLog(log.id)}
                    onPatch={patch => patchLog(log.id, patch)}
                  />
                ))}
                {pomodoroLogs.map(p => {
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
        </div>
      </div>

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
                openEntry('plan', { date: todayYmd, startTime: schedMenu.startTime, duration: 60 })
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
                openEntry('actual', { date: todayYmd, startTime: schedMenu.startTime, duration: 60 })
                setSchedMenu(null)
              }}
            >
              실제(Actual) 추가
            </button>
          )}
        </div>
      )}
    </div>
  )
}
