/**
 * 통합 캘린더용 — 주간 타임박스 뷰 + 포모도로 로그 (focus_log + 로컬 백업)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchCalendarEventsInRange,
  insertCalendarEvent,
  deleteCalendarEvent,
  upsertDailyLog,
  type CalendarEventRow,
} from './supabase'
import { isSupabaseReady } from './lib/supabase'
import {
  appendPomodoroLog,
  listPomodoroLogsInRange,
  removePomodoroLogEntry,
  removePomodoroLogByRemoteId,
} from './pomodoroLogData'

type QuestOpt = { id: string; name: string }

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 월요일 시작 주간 범위 */
export function getWeekRangeMonday(anchor: Date): { start: string; end: string; days: Date[] } {
  const x = new Date(anchor)
  x.setHours(12, 0, 0, 0)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(x)
    d.setDate(x.getDate() + i)
    days.push(d)
  }
  return { start: toYMD(days[0]), end: toYMD(days[6]), days }
}

const START_HOUR = 5
const END_HOUR = 24
const PX_PER_HOUR = 44
const SPAN_MIN = (END_HOUR - START_HOUR) * 60
const COL_HEIGHT = (END_HOUR - START_HOUR) * PX_PER_HOUR

type GridItem = {
  key: string
  date: string
  startMin: number
  durationMin: number
  label: string
  sub?: string
  serverId?: string
  localId?: string
}

function parseFocusLogRow(r: CalendarEventRow): GridItem | null {
  const c = r.content ?? {}
  const minutes = Math.max(1, Number(c.minutes) || Math.floor(Number(c.seconds || 0) / 60) || 1)
  let startMin = START_HOUR * 60
  if (typeof c.start_time_local === 'string' && /^\d{1,2}:\d{2}$/.test(c.start_time_local.trim())) {
    const [h, m] = c.start_time_local.trim().split(':').map(Number)
    startMin = h * 60 + m
  } else if (r.created_at) {
    const d = new Date(r.created_at)
    startMin = d.getHours() * 60 + d.getMinutes()
  }
  return {
    key: `s-${r.id}`,
    date: r.event_date,
    startMin,
    durationMin: minutes,
    label: r.title || '집중',
    sub: typeof c.quest_title === 'string' ? c.quest_title : undefined,
    serverId: r.id,
  }
}

function parseLocalRow(e: PomodoroLogEntry): GridItem {
  const [h, m] = e.startTimeLocal.split(':').map(Number)
  return {
    key: `l-${e.id}`,
    date: e.date,
    startMin: h * 60 + m,
    durationMin: Math.max(1, e.minutes),
    label: e.questTitle ? `[로컬] ${e.questTitle}` : '[로컬] 포모도로',
    sub: e.identityName,
    localId: e.id,
  }
}

function itemStyle(it: GridItem): { top: number; height: number } {
  const dayStart = START_HOUR * 60
  const rel = it.startMin - dayStart
  const top = Math.max(0, (rel / SPAN_MIN) * COL_HEIGHT)
  const h = Math.max(18, (it.durationMin / SPAN_MIN) * COL_HEIGHT)
  return { top, height: h }
}

export function PomodoroWeeklyCalendar({
  userQuests,
  refreshTrigger = 0,
}: {
  userQuests: QuestOpt[]
  refreshTrigger?: number
}) {
  const [weekAnchor, setWeekAnchor] = useState(() => new Date())
  const { start, end, days } = useMemo(() => getWeekRangeMonday(weekAnchor), [weekAnchor])
  const [items, setItems] = useState<GridItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalDate, setModalDate] = useState(toYMD(new Date()))
  const [modalStart, setModalStart] = useState('14:00')
  const [modalMin, setModalMin] = useState(25)
  const [modalQuestId, setModalQuestId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const local = listPomodoroLogsInRange(start, end)
    const serverIds = new Set<string>()
    const out: GridItem[] = []

    if (isSupabaseReady) {
      const rows = await fetchCalendarEventsInRange('focus_log', start, end)
      for (const r of rows) {
        const g = parseFocusLogRow(r)
        if (g) {
          out.push(g)
          serverIds.add(r.id)
        }
      }
    }
    for (const e of local) {
      if (e.remoteId && serverIds.has(e.remoteId)) continue
      out.push(parseLocalRow(e))
    }
    out.sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin)
    setItems(out)
    setLoading(false)
  }, [start, end])

  useEffect(() => {
    void load()
  }, [load, refreshTrigger])

  function shiftWeek(delta: number) {
    const d = new Date(weekAnchor)
    d.setDate(d.getDate() + delta * 7)
    setWeekAnchor(d)
  }

  async function saveManual() {
    const minutes = Math.max(1, Math.floor(modalMin))
    const sec = minutes * 60
    const q = userQuests.find(x => x.id === modalQuestId)
    const title = q ? `[집중·수동] ${q.name} · ${minutes}분` : `[집중·수동] ${minutes}분`
    const content: Record<string, unknown> = {
      minutes,
      seconds: sec,
      start_time_local: modalStart.trim(),
      quest_id: q?.id ?? null,
      quest_title: q?.name ?? null,
      source: 'manual_entry',
      identity_name: '수동 입력',
      xp_gain: 0,
    }
    if (!isSupabaseReady) {
      appendPomodoroLog({
        date: modalDate,
        startTimeLocal: modalStart.trim(),
        minutes,
        seconds: sec,
        questId: q?.id ?? null,
        questTitle: q?.name ?? null,
        source: 'manual',
      })
      await upsertDailyLog(modalDate, 1, sec)
      setModalOpen(false)
      await load()
      return
    }
    const row = await insertCalendarEvent('focus_log', modalDate, title, content)
    if (row) {
      appendPomodoroLog({
        date: modalDate,
        startTimeLocal: modalStart.trim(),
        minutes,
        seconds: sec,
        questId: q?.id ?? null,
        questTitle: q?.name ?? null,
        source: 'manual',
        remoteId: row.id,
      })
      await upsertDailyLog(modalDate, 1, sec)
    }
    setModalOpen(false)
    await load()
  }

  async function deleteItem(it: GridItem) {
    if (!window.confirm('이 포모도로 기록을 삭제할까요?')) return
    if (it.serverId && isSupabaseReady) {
      await deleteCalendarEvent(it.serverId)
      removePomodoroLogByRemoteId(it.serverId)
    }
    if (it.localId) {
      removePomodoroLogEntry(it.localId)
    }
    await load()
  }

  const itemsByDate = useMemo(() => {
    const m: Record<string, GridItem[]> = {}
    for (const it of items) {
      if (!m[it.date]) m[it.date] = []
      m[it.date].push(it)
    }
    return m
  }, [items])

  const hours = useMemo(() => {
    const h: number[] = []
    for (let hh = START_HOUR; hh < END_HOUR; hh++) h.push(hh)
    return h
  }, [])

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => shiftWeek(-1)}
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', background: '#fff', cursor: 'pointer', fontSize: '12px' }}
          >
            ← 이전 주
          </button>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#37352F' }}>
            {start} ~ {end}
          </span>
          <button
            type="button"
            onClick={() => shiftWeek(1)}
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', background: '#fff', cursor: 'pointer', fontSize: '12px' }}
          >
            다음 주 →
          </button>
          <button
            type="button"
            onClick={() => { setWeekAnchor(new Date()); void load() }}
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #6366f1', background: 'rgba(99,102,241,0.08)', cursor: 'pointer', fontSize: '12px', color: '#4F46E5', fontWeight: 600 }}
          >
            오늘
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            style={{ padding: '8px 14px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
          >
            + 포모도로 수동 입력
          </button>
          <button
            type="button"
            onClick={() => setSheetOpen(o => !o)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', background: '#fff', fontSize: '12px', cursor: 'pointer' }}
          >
            {sheetOpen ? '시트 접기' : '주간 로그 시트'}
          </button>
        </div>
      </div>

      <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#787774', lineHeight: 1.6 }}>
        <strong style={{ color: '#4F46E5' }}>퀘스트 누적 시간</strong>은 날짜와 관계없이 DB에 합산됩니다. 아래는{' '}
        <strong>통합 캘린더 focus_log</strong>와 <strong>로컬 백업 로그</strong>를 합친 <strong>일별 세션</strong>입니다. 완료 시각(
        <code>start_time_local</code>) 기준으로 막대를 배치합니다.
      </p>

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#9B9A97' }}>불러오는 중…</div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)', background: '#FAFAF8' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `52px repeat(7, minmax(96px, 1fr))`, minWidth: '800px' }}>
            <div style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', borderRight: '1px solid rgba(0,0,0,0.06)', padding: '8px', fontSize: '10px', color: '#9B9A97' }} />
            {days.map(d => {
              const dk = toYMD(d)
              const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
              return (
                <div
                  key={dk}
                  style={{
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    borderRight: '1px solid rgba(0,0,0,0.06)',
                    padding: '8px 6px',
                    textAlign: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: d.toDateString() === new Date().toDateString() ? '#4F46E5' : '#37352F',
                  }}
                >
                  {wd} {d.getMonth() + 1}/{d.getDate()}
                </div>
              )
            })}

            <div style={{ borderRight: '1px solid rgba(0,0,0,0.06)', position: 'relative' }}>
              {hours.map(hh => (
                <div
                  key={hh}
                  style={{
                    height: `${PX_PER_HOUR}px`,
                    borderBottom: '1px dashed rgba(0,0,0,0.05)',
                    fontSize: '10px',
                    color: '#AEAAA4',
                    paddingLeft: '4px',
                    boxSizing: 'border-box',
                  }}
                >
                  {String(hh).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {days.map(d => {
              const dk = toYMD(d)
              const dayItems = itemsByDate[dk] ?? []
              return (
                <div
                  key={`col-${dk}`}
                  style={{
                    borderRight: '1px solid rgba(0,0,0,0.06)',
                    position: 'relative',
                    height: `${COL_HEIGHT}px`,
                    background: 'linear-gradient(180deg, rgba(99,102,241,0.02) 0%, transparent 100%)',
                  }}
                >
                  {hours.map(hh => (
                    <div
                      key={`${dk}-h-${hh}`}
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: `${(hh - START_HOUR) * PX_PER_HOUR}px`,
                        height: `${PX_PER_HOUR}px`,
                        borderBottom: '1px solid rgba(0,0,0,0.04)',
                        pointerEvents: 'none',
                      }}
                    />
                  ))}
                  {dayItems.map(it => {
                    const { top, height } = itemStyle(it)
                    return (
                      <div
                        key={it.key}
                        title={`${it.label}\n${it.durationMin}분`}
                        style={{
                          position: 'absolute',
                          left: '4px',
                          right: '4px',
                          top: `${top}px`,
                          height: `${height}px`,
                          borderRadius: '8px',
                          background: it.serverId ? 'linear-gradient(180deg, rgba(99,102,241,0.92), rgba(79,70,229,0.88))' : 'linear-gradient(180deg, rgba(52,211,153,0.85), rgba(16,185,129,0.82))',
                          color: '#fff',
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '4px 6px',
                          overflow: 'hidden',
                          boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
                          cursor: 'default',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ lineHeight: 1.25 }}>{it.label}</span>
                        <span style={{ fontSize: '9px', opacity: 0.9 }}>{it.durationMin}분</span>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            void deleteItem(it)
                          }}
                          style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            width: '18px',
                            height: '18px',
                            border: 'none',
                            borderRadius: '4px',
                            background: 'rgba(0,0,0,0.2)',
                            color: '#fff',
                            fontSize: '11px',
                            cursor: 'pointer',
                            lineHeight: 1,
                            padding: 0,
                          }}
                          title="삭제"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {sheetOpen && (
        <div style={{ marginTop: '20px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)', background: '#fff', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: '12px', fontWeight: 800, color: '#6366f1' }}>
            주간 포모도로 로그 (이번 주 · focus_log + 로컬)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#F4F4F2', color: '#787774', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>날짜</th>
                  <th style={{ padding: '10px 12px' }}>시작</th>
                  <th style={{ padding: '10px 12px' }}>분</th>
                  <th style={{ padding: '10px 12px' }}>퀘스트</th>
                  <th style={{ padding: '10px 12px' }}>제목</th>
                  <th style={{ padding: '10px 12px' }}>출처</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#AEAAA4' }}>
                      이번 주 기록이 없습니다.
                    </td>
                  </tr>
                ) : (
                  items.map(it => {
                    const h = Math.floor(it.startMin / 60)
                    const mi = it.startMin % 60
                    const st = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
                    return (
                      <tr key={it.key} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{it.date}</td>
                        <td style={{ padding: '10px 12px' }}>{st}</td>
                        <td style={{ padding: '10px 12px' }}>{it.durationMin}</td>
                        <td style={{ padding: '10px 12px' }}>{it.sub ?? '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#37352F' }}>{it.label}</td>
                        <td style={{ padding: '10px 12px', color: it.serverId ? '#6366f1' : '#10b981' }}>{it.serverId ? 'Supabase' : '로컬'}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 600,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          role="dialog"
        >
          <div style={{ width: '100%', maxWidth: '400px', background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 800 }}>포모도로 수동 입력</h3>
            <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#787774' }}>날짜는 통합 캘린더와 동일한 YYYY-MM-DD로 저장됩니다.</p>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '11px', fontWeight: 600, color: '#787774' }}>
              날짜
              <input type="date" value={modalDate} onChange={e => setModalDate(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)' }} />
            </label>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '11px', fontWeight: 600, color: '#787774' }}>
              시작 시각 (로컬)
              <input value={modalStart} onChange={e => setModalStart(e.target.value)} placeholder="14:00" style={{ display: 'block', width: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)' }} />
            </label>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '11px', fontWeight: 600, color: '#787774' }}>
              몰입 분
              <input type="number" min={1} value={modalMin} onChange={e => setModalMin(Number(e.target.value))} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)' }} />
            </label>
            <label style={{ display: 'block', marginBottom: '16px', fontSize: '11px', fontWeight: 600, color: '#787774' }}>
              퀘스트 (선택)
              <select value={modalQuestId} onChange={e => setModalQuestId(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)' }}>
                <option value="">— 없음 —</option>
                {userQuests.map(q => (
                  <option key={q.id} value={q.id}>
                    {q.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setModalOpen(false)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', background: '#fff', cursor: 'pointer' }}>
                취소
              </button>
              <button type="button" onClick={() => void saveManual()} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#6366f1', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
