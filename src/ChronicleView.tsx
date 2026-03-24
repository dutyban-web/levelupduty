/**
 * 운명의 연대기 — 100년 / 10년(대운) 스크롤 타임라인
 */
import { useMemo, useState } from 'react'
import {
  type ChronicleStore,
  type GoalMilestone,
  type LifeRecord,
  type LifeRecordCategory,
  chronicleYearRange,
  decadeIndexForYear,
  loadChronicleStore,
  newChronicleId,
  saveChronicleStore,
} from './chronicleData'

const CAT_LABEL: Record<LifeRecordCategory, string> = {
  world: '세계',
  sports: '스포츠',
  news: '뉴스',
  personal: '개인',
}

function todayYear(): number {
  return new Date().getFullYear()
}

function daysUntilYmd(ymd: string): number {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  const [y, m, d] = ymd.split('-').map(Number)
  const target = new Date(y, (m ?? 1) - 1, d ?? 1)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - t.getTime()) / 86400000)
}

export function ChronicleView() {
  const [store, setStore] = useState<ChronicleStore>(() => loadChronicleStore())
  const birth = store.birthYear
  const { startYear, endYear } = useMemo(() => chronicleYearRange(birth), [birth])
  const decades = useMemo(() => {
    const rows: { label: string; from: number; to: number; idx: number }[] = []
    for (let y = startYear; y <= endYear; y += 10) {
      const idx = decadeIndexForYear(birth, y)
      rows.push({
        idx,
        from: y,
        to: Math.min(y + 9, endYear),
        label: `제${idx + 1}대운`,
      })
    }
    return rows
  }, [birth, startYear, endYear])

  const nowY = todayYear()
  const nowFrac = (nowY - startYear) / (endYear - startYear + 1)

  const persist = (next: ChronicleStore) => {
    saveChronicleStore(next)
    setStore(next)
  }

  const [draft, setDraft] = useState({
    dateYmd: new Date().toISOString().slice(0, 10),
    title: '',
    category: 'world' as LifeRecordCategory,
    body: '',
  })
  const [goalDraft, setGoalDraft] = useState({ dateYmd: new Date().toISOString().slice(0, 10), label: '' })
  const [editingId, setEditingId] = useState<string | null>(null)

  const addLifeRecord = () => {
    const t = draft.title.trim()
    if (!t) return
    const id = newChronicleId('lr')
    const ts = new Date().toISOString()
    const rec: LifeRecord = {
      id,
      dateYmd: draft.dateYmd,
      title: t,
      category: draft.category,
      body: draft.body.trim(),
      createdAt: ts,
      updatedAt: ts,
    }
    persist({ ...store, lifeRecords: [rec, ...store.lifeRecords] })
    setDraft(d => ({ ...d, title: '', body: '' }))
  }

  const saveEditLife = (r: LifeRecord) => {
    persist({
      ...store,
      lifeRecords: store.lifeRecords.map(x =>
        x.id === r.id ? { ...r, updatedAt: new Date().toISOString() } : x,
      ),
    })
    setEditingId(null)
  }

  const deleteLife = (id: string) => {
    if (!window.confirm('이 Life 기록을 정말 삭제할까요?')) return
    persist({ ...store, lifeRecords: store.lifeRecords.filter(x => x.id !== id) })
    if (editingId === id) setEditingId(null)
  }

  const addGoal = () => {
    const label = goalDraft.label.trim()
    if (!label) return
    const g: GoalMilestone = {
      id: newChronicleId('gm'),
      dateYmd: goalDraft.dateYmd,
      label,
      createdAt: new Date().toISOString(),
    }
    persist({ ...store, goalMilestones: [...store.goalMilestones, g].sort((a, b) => a.dateYmd.localeCompare(b.dateYmd)) })
    setGoalDraft(g => ({ ...g, label: '' }))
  }

  const deleteGoal = (id: string) => {
    if (!window.confirm('이 목표 D-day를 삭제할까요?')) return
    persist({ ...store, goalMilestones: store.goalMilestones.filter(g => g.id !== id) })
  }

  const setBirthYear = (y: number) => {
    if (!Number.isFinite(y) || y < 1900 || y > 2090) return
    persist({ ...store, birthYear: Math.floor(y) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          padding: '14px 16px',
          borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(254,243,199,0.95), rgba(253,230,138,0.5))',
          border: '1px solid rgba(180,83,9,0.25)',
          color: '#422006',
          fontSize: 13,
          lineHeight: 1.55,
        }}
      >
        <strong style={{ letterSpacing: '0.04em' }}>타임슬립했다고 생각하면, 지금이 가장 감사한 순간.</strong>
        <div style={{ marginTop: 6, opacity: 0.92 }}>
          100년 스케일에서 오늘의 위치를 확인하고, 세계·스포츠·뉴스·개인의 기록을 한 줄에 남깁니다.
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: '#57534e', fontWeight: 700 }}>
          기준 생년
          <input
            type="number"
            value={birth}
            onChange={e => setBirthYear(parseInt(e.target.value, 10))}
            style={{ marginLeft: 8, width: 88, padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)' }}
          />
        </label>
        <span style={{ fontSize: 12, color: '#78716c' }}>
          범위 {startYear}–{endYear} (100년) · 올해 {nowY}
        </span>
      </div>

      <div
        style={{
          overflowX: 'auto',
          borderRadius: 12,
          border: '1px solid rgba(71,85,105,0.35)',
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          padding: '12px 10px 16px',
        }}
      >
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, fontWeight: 800, letterSpacing: '0.06em' }}>
          대운(10년) × 타임라인
        </div>
        <div style={{ minWidth: Math.max(640, decades.length * 52), position: 'relative' }}>
          {/* 현재 연도 마커 */}
          <div
            title={`현재 약 ${nowY}년`}
            style={{
              position: 'absolute',
              left: `${Math.min(99.5, Math.max(0, nowFrac * 100))}%`,
              top: -4,
              bottom: -4,
              width: 2,
              background: 'linear-gradient(180deg, #38bdf8, #22d3ee)',
              boxShadow: '0 0 12px rgba(56,189,248,0.8)',
              zIndex: 4,
              pointerEvents: 'none',
            }}
          />
          {decades.map(row => (
            <div
              key={row.from}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                marginBottom: 6,
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 72,
                  flexShrink: 0,
                  fontSize: 10,
                  color: '#cbd5e1',
                  fontWeight: 700,
                  lineHeight: 1.3,
                  paddingTop: 4,
                }}
              >
                {row.label}
                <div style={{ fontWeight: 500, color: '#64748b', fontSize: 9 }}>
                  {row.from}–{row.to}
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: 8,
                  background: 'linear-gradient(90deg, rgba(51,65,85,0.9), rgba(30,41,59,0.95))',
                  border: '1px solid rgba(148,163,184,0.2)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* 연도 눈금 */}
                {Array.from({ length: 10 }, (_, i) => {
                  const y = row.from + i
                  if (y > endYear) return null
                  const left = ((y - row.from) / 10) * 100
                  return (
                    <span
                      key={y}
                      title={`${y}년`}
                      style={{
                        position: 'absolute',
                        left: `${left}%`,
                        top: 0,
                        bottom: 0,
                        width: 1,
                        background: 'rgba(148,163,184,0.15)',
                      }}
                    />
                  )
                })}
                {/* Life 기록 점 */}
                {store.lifeRecords.map(r => {
                  const y = parseInt(r.dateYmd.slice(0, 4), 10)
                  if (y < row.from || y > row.to) return null
                  const left = ((y - row.from) / 10) * 100 + 4
                  return (
                    <span
                      key={r.id}
                      title={`${r.dateYmd} ${r.title}`}
                      style={{
                        position: 'absolute',
                        left: `${left}%`,
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: '#fbbf24',
                        border: '1px solid rgba(0,0,0,0.35)',
                        boxShadow: '0 0 8px rgba(251,191,36,0.6)',
                      }}
                    />
                  )
                })}
                {/* 목표 D-day */}
                {store.goalMilestones.map(g => {
                  const y = parseInt(g.dateYmd.slice(0, 4), 10)
                  if (y < row.from || y > row.to) return null
                  const left = ((y - row.from) / 10) * 100 + 2
                  return (
                    <span
                      key={g.id}
                      title={`${g.dateYmd} ${g.label}`}
                      style={{
                        position: 'absolute',
                        left: `${left}%`,
                        top: 4,
                        width: 0,
                        height: 0,
                        borderLeft: '5px solid transparent',
                        borderRight: '5px solid transparent',
                        borderBottom: '9px solid #a78bfa',
                        transform: 'translateX(-50%)',
                        filter: 'drop-shadow(0 0 6px rgba(167,139,250,0.8))',
                      }}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 10, color: '#64748b', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: '#fbbf24', marginRight: 6, verticalAlign: 'middle' }} />
            Life 기록
          </span>
          <span>
            <span style={{ display: 'inline-block', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '9px solid #a78bfa', marginRight: 6, verticalAlign: 'middle' }} />
            목표 D-day
          </span>
          <span style={{ color: '#38bdf8' }}>│ 청색 세로선 = 올해(대략)</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: '#fffef8',
            border: '1px solid rgba(120,113,108,0.25)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: '#44403c', marginBottom: 10 }}>Life 기록 추가</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
            <input
              type="date"
              value={draft.dateYmd}
              onChange={e => setDraft(d => ({ ...d, dateYmd: e.target.value }))}
              style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)' }}
            />
            <input
              placeholder="제목"
              value={draft.title}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)' }}
            />
            <select
              value={draft.category}
              onChange={e => setDraft(d => ({ ...d, category: e.target.value as LifeRecordCategory }))}
              style={{ padding: 8, borderRadius: 8 }}
            >
              {(Object.keys(CAT_LABEL) as LifeRecordCategory[]).map(k => (
                <option key={k} value={k}>
                  {CAT_LABEL[k]}
                </option>
              ))}
            </select>
            <textarea
              placeholder="메모 (선택)"
              value={draft.body}
              onChange={e => setDraft(d => ({ ...d, body: e.target.value }))}
              rows={3}
              style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)', resize: 'vertical' }}
            />
            <button
              type="button"
              onClick={addLifeRecord}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #57534e, #44403c)',
                color: '#fff',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              기록 저장
            </button>
          </div>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: '#f8fafc',
            border: '1px solid rgba(71,85,105,0.2)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>목표 D-day</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
            <input
              type="date"
              value={goalDraft.dateYmd}
              onChange={e => setGoalDraft(g => ({ ...g, dateYmd: e.target.value }))}
              style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)' }}
            />
            <input
              placeholder="라벨 (예: 원고 마감)"
              value={goalDraft.label}
              onChange={e => setGoalDraft(g => ({ ...g, label: e.target.value }))}
              style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)' }}
            />
            <button
              type="button"
              onClick={addGoal}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: '#fff',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              타임라인에 고정
            </button>
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#1c1917', marginBottom: 8 }}>저장된 Life 기록</div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {store.lifeRecords.map(r => (
            <li
              key={r.id}
              style={{
                padding: 12,
                borderRadius: 10,
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.06)',
                fontSize: 12,
              }}
            >
              {editingId === r.id ? (
                <EditLifeForm
                  r={r}
                  onSave={saveEditLife}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <>
                  <div style={{ fontWeight: 800, color: '#292524' }}>
                    {r.dateYmd} · [{CAT_LABEL[r.category]}] {r.title}
                  </div>
                  {r.body ? <div style={{ marginTop: 6, color: '#57534e', whiteSpace: 'pre-wrap' }}>{r.body}</div> : null}
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => setEditingId(r.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid #6366f1', background: '#fff', color: '#4f46e5', cursor: 'pointer' }}>
                      수정
                    </button>
                    <button type="button" onClick={() => deleteLife(r.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid #e11d48', background: '#fff', color: '#be123c', cursor: 'pointer' }}>
                      삭제
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
          {store.lifeRecords.length === 0 ? (
            <li style={{ fontSize: 12, color: '#78716c' }}>아직 기록이 없습니다. 위에서 추가해 보세요.</li>
          ) : null}
        </ul>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#1c1917', marginBottom: 8 }}>목표 D-day 목록</div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {store.goalMilestones.map(g => {
            const dd = daysUntilYmd(g.dateYmd)
            const ddLabel = dd === 0 ? 'D-Day' : dd > 0 ? `D-${dd}` : `D+${Math.abs(dd)}`
            return (
              <li
                key={g.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'linear-gradient(90deg, rgba(99,102,241,0.08), transparent)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  fontSize: 12,
                }}
              >
                <span>
                  <strong>{g.label}</strong>
                  <span style={{ color: '#64748b', marginLeft: 8 }}>
                    {g.dateYmd} ({ddLabel})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => deleteGoal(g.id)}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                >
                  삭제
                </button>
              </li>
            )
          })}
          {store.goalMilestones.length === 0 ? (
            <li style={{ fontSize: 12, color: '#78716c' }}>목표 날짜를 추가하면 상단 타임라인에 보라색 마름모로 표시됩니다.</li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}

function EditLifeForm({
  r,
  onSave,
  onCancel,
}: {
  r: LifeRecord
  onSave: (r: LifeRecord) => void
  onCancel: () => void
}) {
  const [local, setLocal] = useState(r)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        type="date"
        value={local.dateYmd}
        onChange={e => setLocal(x => ({ ...x, dateYmd: e.target.value }))}
        style={{ padding: 6, borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)' }}
      />
      <input
        value={local.title}
        onChange={e => setLocal(x => ({ ...x, title: e.target.value }))}
        style={{ padding: 6, borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)' }}
      />
      <select
        value={local.category}
        onChange={e => setLocal(x => ({ ...x, category: e.target.value as LifeRecordCategory }))}
        style={{ padding: 6 }}
      >
        {(Object.keys(CAT_LABEL) as LifeRecordCategory[]).map(k => (
          <option key={k} value={k}>
            {CAT_LABEL[k]}
          </option>
        ))}
      </select>
      <textarea
        value={local.body}
        onChange={e => setLocal(x => ({ ...x, body: e.target.value }))}
        rows={3}
        style={{ padding: 6, borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)' }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => onSave(local)}
          style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer' }}
        >
          저장
        </button>
        <button type="button" onClick={onCancel} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
          취소
        </button>
      </div>
    </div>
  )
}
