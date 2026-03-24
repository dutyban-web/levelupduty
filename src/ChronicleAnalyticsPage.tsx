/**
 * 연대기 & 통합 통계 — Chronicle / Oracle / Gantt / 현실의 문(캘린더)
 */
import { useMemo, useState } from 'react'
import type { ProjectRow } from './supabase'
import { ChronicleView } from './ChronicleView'
import { OracleMirrorPanel } from './OracleMirrorPanel'
import { QuestGanttPanel } from './QuestGanttPanel'
import {
  loadExternalCalendarStore,
  saveExternalCalendarStore,
  newExternalEventId,
  seedSampleExternalEvents,
  getOccupiedHourSetForLocalDate,
  titlesForHour,
  type ExternalCalendarEvent,
} from './externalCalendarData'
import { hourCardSegments } from './hourCards'

type QuestCard = {
  id: string
  name: string
  projectId?: string | null
  status?: string
  deadline?: string
  startedAt?: string
}

type TabId = 'chronicle' | 'oracle' | 'gantt' | 'calendar'

const TABS: { id: TabId; label: string }[] = [
  { id: 'chronicle', label: '운명의 연대기' },
  { id: 'oracle', label: '예언자의 거울' },
  { id: 'gantt', label: '공정표' },
  { id: 'calendar', label: '현실의 문' },
]

export function ChronicleAnalyticsPage({
  userQuests,
  projects,
  completedQuestIds,
}: {
  userQuests: QuestCard[]
  projects: ProjectRow[]
  completedQuestIds: string[]
}) {
  const [tab, setTab] = useState<TabId>('chronicle')

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 18px 48px' }}>
      <header style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontSize: isMobileViewport() ? 20 : 24,
            fontWeight: 800,
            color: '#1c1917',
            margin: '0 0 8px',
            letterSpacing: '-0.02em',
          }}
        >
          Chronicle & Analytics
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: '#57534e', lineHeight: 1.55 }}>
          생애 100년 스케일의 연대기, 통합 차트, 퀘스트 공정표, 외부 캘린더(모의)까지 한 모듈에서 다룹니다. MapHub의 1시간 카드에는 외부 일정이 회색으로 겹쳐 집니다.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="연대기 하위 메뉴"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}
      >
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              border: tab === t.id ? '2px solid #6366f1' : '1px solid rgba(0,0,0,0.08)',
              background: tab === t.id ? 'rgba(99,102,241,0.12)' : '#FFFFFF',
              color: tab === t.id ? '#4338ca' : '#78716c',
              fontSize: 13,
              fontWeight: tab === t.id ? 800 : 600,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'chronicle' && <ChronicleView />}
      {tab === 'oracle' && <OracleMirrorPanel />}
      {tab === 'gantt' && (
        <QuestGanttPanel quests={userQuests} projects={projects} completedQuestIds={completedQuestIds} />
      )}
      {tab === 'calendar' && <RealityGateCalendarPanel />}
    </div>
  )
}

function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 640
}

function RealityGateCalendarPanel() {
  const [store, setStore] = useState(() => loadExternalCalendarStore())
  const [now] = useState(() => new Date())
  const ymd = useMemo(() => now.toISOString().slice(0, 10), [now])
  const hourSegs = useMemo(() => hourCardSegments(now), [now])
  const extHours = useMemo(() => getOccupiedHourSetForLocalDate(ymd), [store, ymd])

  const persist = (next: typeof store) => {
    saveExternalCalendarStore(next)
    setStore(next)
  }

  const [draft, setDraft] = useState({ title: '', startHour: 9, endHour: 10, dateYmd: ymd })

  const addEvent = () => {
    const title = draft.title.trim()
    if (!title) return
    const lo = Math.max(0, Math.min(23, draft.startHour))
    const hi = Math.max(lo + 1, Math.min(24, draft.endHour))
    const ev: ExternalCalendarEvent = {
      id: newExternalEventId(),
      title,
      dateYmd: draft.dateYmd,
      startHour: lo,
      endHour: hi,
      source: 'mock',
      createdAt: new Date().toISOString(),
    }
    persist({ ...store, events: [...store.events, ev] })
    setDraft(d => ({ ...d, title: '' }))
  }

  const deleteEvent = (id: string) => {
    if (!window.confirm('이 일정을 삭제할까요?')) return
    persist({ ...store, events: store.events.filter(e => e.id !== id) })
  }

  const loadSamples = () => {
    persist(seedSampleExternalEvents())
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          padding: 14,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
          border: '1px solid #cbd5e1',
          fontSize: 12,
          color: '#334155',
          lineHeight: 1.55,
        }}
      >
        <strong>Google Calendar API</strong>는 OAuth·서버 프록시 설정 후 같은 데이터 구조로 채울 수 있습니다. 현재는 로컬 모의 일정이며, MapHub와 아래 미리보기에서 <strong>회색 블록</strong>으로 표시됩니다.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div style={{ padding: 14, borderRadius: 12, background: '#fff', border: '1px solid rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>일정 추가 (모의)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
            <input
              type="date"
              value={draft.dateYmd}
              onChange={e => setDraft(d => ({ ...d, dateYmd: e.target.value }))}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <input
              placeholder="제목"
              value={draft.title}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ flex: 1 }}>
                시작 시
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={draft.startHour}
                  onChange={e => setDraft(d => ({ ...d, startHour: parseInt(e.target.value, 10) || 0 }))}
                  style={{ width: '100%', marginTop: 4, padding: 6, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </label>
              <label style={{ flex: 1 }}>
                종료 시(배타)
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={draft.endHour}
                  onChange={e => setDraft(d => ({ ...d, endHour: parseInt(e.target.value, 10) || 1 }))}
                  style={{ width: '100%', marginTop: 4, padding: 6, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={addEvent}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: 'none',
                background: '#475569',
                color: '#fff',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              저장
            </button>
            <button
              type="button"
              onClick={loadSamples}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              오늘 날짜에 예시 일정 넣기
            </button>
          </div>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: 'linear-gradient(180deg, #1e293b, #0f172a)',
            border: '1px solid rgba(251,191,36,0.25)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: '#fde68a', marginBottom: 8 }}>1시간 카드 · 오늘 (미리보기)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 9, color: '#64748b', width: 40, flexShrink: 0 }}>00–12</span>
              <div style={{ display: 'flex', gap: 3, flex: 1, flexWrap: 'wrap' }}>
                {hourSegs.slice(0, 12).map(s => (
                  <HourCell key={s.hour} s={s} ymd={ymd} extHours={extHours} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 9, color: '#64748b', width: 40, flexShrink: 0 }}>12–24</span>
              <div style={{ display: 'flex', gap: 3, flex: 1, flexWrap: 'wrap' }}>
                {hourSegs.slice(12, 24).map(s => (
                  <HourCell key={s.hour} s={s} ymd={ymd} extHours={extHours} />
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 10, color: '#94a3b8' }}>
            노란/회색 = 잔여·소모, <span style={{ color: '#94a3b8' }}>테두리 강조 = 외부 일정</span>
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: '#0f172a' }}>저장된 외부 일정</div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {store.events.map(e => (
            <li
              key={e.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                fontSize: 12,
              }}
            >
              <span>
                <strong>{e.title}</strong>
                <span style={{ color: '#64748b', marginLeft: 8 }}>
                  {e.dateYmd} {e.startHour}:00–{e.endHour}:00 ({e.source})
                </span>
              </span>
              <button
                type="button"
                onClick={() => deleteEvent(e.id)}
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid #fecdd3', background: '#fff1f2', color: '#be123c', cursor: 'pointer' }}
              >
                삭제
              </button>
            </li>
          ))}
          {store.events.length === 0 ? <li style={{ fontSize: 12, color: '#78716c' }}>일정이 없습니다. 위에서 추가하거나 예시를 넣으세요.</li> : null}
        </ul>
      </div>
    </div>
  )
}

function HourCell({
  s,
  ymd,
  extHours,
}: {
  s: { hour: number; isPassed: boolean }
  ymd: string
  extHours: Set<number>
}) {
  const ext = extHours.has(s.hour)
  const titles = titlesForHour(ymd, s.hour)
  const baseBg = s.isPassed ? 'rgba(100,116,139,0.85)' : 'rgba(250,204,21,0.9)'
  const background = ext
    ? s.isPassed
      ? 'linear-gradient(180deg, rgba(71,85,105,0.95), rgba(51,65,85,0.92))'
      : 'linear-gradient(180deg, rgba(100,116,139,0.78), rgba(71,85,105,0.9))'
    : baseBg
  return (
    <span
      title={`${String(s.hour).padStart(2, '0')}:00 — ${s.isPassed ? '소모' : '잔여'}${ext ? ` · 외부: ${titles.join(', ')}` : ''}`}
      style={{
        width: 'calc(8.33% - 3px)',
        minWidth: 14,
        height: 18,
        borderRadius: 4,
        background,
        border: '1px solid rgba(0,0,0,0.2)',
        boxShadow: ext ? 'inset 0 0 0 2px rgba(148,163,184,0.95)' : s.isPassed ? undefined : '0 0 8px rgba(250,204,21,0.45)',
      }}
    />
  )
}
