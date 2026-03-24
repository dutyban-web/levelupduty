/**
 * 공정표 — 프로젝트·퀘스트 기간을 르와브르 보드 느낌으로
 */
import { useMemo } from 'react'
import type { ProjectRow } from './supabase'

type QuestCard = {
  id: string
  name: string
  projectId?: string | null
  status?: string
  deadline?: string
  startedAt?: string
}

function parseYmd(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return null
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

function addDays(base: Date, days: number): Date {
  const x = new Date(base.getTime())
  x.setDate(x.getDate() + days)
  return x
}

const WEEK_MS = 7 * 86400000

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return x
}

export function QuestGanttPanel({
  quests,
  projects,
  completedQuestIds,
}: {
  quests: QuestCard[]
  projects: ProjectRow[]
  completedQuestIds: string[]
}) {
  const { weeks, rows, rangeStart } = useMemo(() => {
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    const rangeStart = startOfWeekMonday(addDays(today, -7))
    const WEEKS = 14
    const weeks: { key: string; label: string }[] = []
    for (let w = 0; w < WEEKS; w++) {
      const ws = addDays(rangeStart, w * 7)
      const m = ws.getMonth() + 1
      const day = ws.getDate()
      weeks.push({ key: `w${w}`, label: `${m}/${day}` })
    }
    const rangeEnd = addDays(rangeStart, WEEKS * 7)
    const projectName = (id: string | null | undefined) => projects.find(p => p.id === id)?.name ?? '미분류'

    const active = quests.filter(q => !completedQuestIds.includes(q.id))
    const rows = active.map(q => {
      const dl = parseYmd(q.deadline)
      const st = parseYmd(q.startedAt) ?? today
      let barStart = st < rangeStart ? rangeStart : st
      let barEnd = dl ?? addDays(st, 7)
      if (barEnd < barStart) barEnd = addDays(barStart, 1)
      if (barStart > rangeEnd) barStart = addDays(rangeEnd, -2)
      if (barEnd < rangeStart) {
        barEnd = addDays(rangeStart, 3)
        barStart = rangeStart
      }
      barStart = barStart < rangeStart ? rangeStart : barStart
      barEnd = barEnd > rangeEnd ? rangeEnd : barEnd

      const startOff = Math.max(0, barStart.getTime() - rangeStart.getTime())
      const endOff = Math.max(startOff + WEEK_MS, barEnd.getTime() - rangeStart.getTime())
      const leftPct = (startOff / (rangeEnd.getTime() - rangeStart.getTime())) * 100
      const widthPct = ((endOff - startOff) / (rangeEnd.getTime() - rangeStart.getTime())) * 100

      return {
        quest: q,
        projectLabel: projectName(q.projectId),
        leftPct,
        widthPct: Math.max(widthPct, 1.2),
      }
    })
    return { weeks, rows, rangeStart }
  }, [quests, projects, completedQuestIds])

  return (
    <div
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        border: '2px solid #1e3a5f',
        background: 'linear-gradient(180deg, #152a45 0%, #0c1829 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          background: 'linear-gradient(90deg, #1e3a5f, #0f172a)',
          borderBottom: '1px solid rgba(251,191,36,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: '#fde68a', letterSpacing: '0.06em' }}>항구 공정 · 퀘스트 타일</div>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>
          기준 주 시작 {rangeStart.toISOString().slice(0, 10)} · 미완료 퀘스트만
        </div>
      </div>

      <div style={{ overflowX: 'auto', padding: '10px 8px 14px' }}>
        <div style={{ minWidth: 720 }}>
          <div style={{ display: 'flex', marginLeft: 160, marginBottom: 6, gap: 0 }}>
            {weeks.map(w => (
              <div
                key={w.key}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontSize: 9,
                  color: '#64748b',
                  fontWeight: 700,
                  borderLeft: '1px solid rgba(148,163,184,0.15)',
                  padding: '2px 0',
                }}
              >
                {w.label}
              </div>
            ))}
          </div>
          {rows.map(r => (
            <div
              key={r.quest.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                minHeight: 40,
                borderTop: '1px solid rgba(30,58,95,0.6)',
              }}
            >
              <div
                style={{
                  width: 160,
                  flexShrink: 0,
                  padding: '6px 8px',
                  fontSize: 11,
                  color: '#e2e8f0',
                  lineHeight: 1.35,
                }}
              >
                <div style={{ fontWeight: 800, color: '#bae6fd' }}>{r.projectLabel}</div>
                <div style={{ color: '#cbd5e1', fontSize: 10 }}>{r.quest.name}</div>
              </div>
              <div style={{ flex: 1, position: 'relative', height: 32, background: 'rgba(15,23,42,0.65)', borderRadius: 6 }}>
                <div
                  style={{
                    position: 'absolute',
                    top: 6,
                    left: `${r.leftPct}%`,
                    width: `${r.widthPct}%`,
                    height: 20,
                    borderRadius: 4,
                    background: 'linear-gradient(180deg, #fbbf24, #d97706)',
                    border: '1px solid rgba(0,0,0,0.35)',
                    boxShadow: '0 2px 0 rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.25)',
                  }}
                  title={`${r.quest.deadline ? `마감 ${r.quest.deadline}` : '마감 미정'}`}
                />
              </div>
            </div>
          ))}
          {rows.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: '#64748b' }}>표시할 미완료 퀘스트가 없습니다.</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
