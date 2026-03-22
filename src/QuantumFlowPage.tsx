/**
 * QuantumFlow — 시공편지 (미래/과거의 나에게)
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import {
  loadQuantumFlowStore,
  saveQuantumFlowStore,
  upsertLetter,
  deleteLetter,
  activeLetters,
  canReadLetter,
  toYMD,
  type QuantumLetter,
  type SpacetimeDirection,
} from './quantumFlowData'
import { useIsMobile } from './hooks/useIsMobile'

const dirLabel: Record<SpacetimeDirection, string> = {
  to_future: '미래의 나에게',
  to_past: '과거의 나에게',
}

export function QuantumFlowPage({ onSaved }: { onSaved?: () => void }) {
  const isMobile = useIsMobile()
  const todayYmd = toYMD(new Date())
  const [store, setStore] = useState(loadQuantumFlowStore)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [openDate, setOpenDate] = useState(todayYmd)
  const [direction, setDirection] = useState<SpacetimeDirection>('to_future')
  const [lockUntilOpen, setLockUntilOpen] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [calDate, setCalDate] = useState(() => new Date())

  const lettersSorted = useMemo(
    () =>
      [...activeLetters(store.letters)].sort(
        (a, b) => b.openDate.localeCompare(a.openDate) || b.updatedAt.localeCompare(a.updatedAt),
      ),
    [store.letters],
  )

  const openDates = useMemo(() => {
    const s = new Set<string>()
    for (const l of activeLetters(store.letters)) s.add(l.openDate)
    return s
  }, [store.letters])

  const saveNew = useCallback(() => {
    const t = title.trim()
    if (!t) return
    const next = upsertLetter(store, {
      id: editingId ?? undefined,
      title: t,
      body: body.trim(),
      openDate,
      direction,
      lockUntilOpen,
    })
    setStore(next)
    saveQuantumFlowStore(next)
    setTitle('')
    setBody('')
    setOpenDate(todayYmd)
    setDirection('to_future')
    setLockUntilOpen(true)
    setEditingId(null)
    onSaved?.()
  }, [store, title, body, openDate, direction, lockUntilOpen, editingId, todayYmd, onSaved])

  const startEdit = (l: QuantumLetter) => {
    setEditingId(l.id)
    setTitle(l.title)
    setBody(l.body)
    setOpenDate(l.openDate)
    setDirection(l.direction)
    setLockUntilOpen(l.lockUntilOpen)
    setExpandedId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setTitle('')
    setBody('')
    setOpenDate(todayYmd)
    setDirection('to_future')
    setLockUntilOpen(true)
  }

  const remove = (id: string) => {
    if (!window.confirm('이 시공편지를 삭제할까요?')) return
    const next = deleteLetter(store, id)
    setStore(next)
    saveQuantumFlowStore(next)
    if (expandedId === id) setExpandedId(null)
    if (editingId === id) cancelEdit()
    onSaved?.()
  }

  const calTile = ({ date }: { date: Date }) => {
    const dk = toYMD(date)
    if (!openDates.has(dk)) return null
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 2 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,#22d3ee,#a855f7)',
            boxShadow: '0 0 6px rgba(168,85,247,0.8)',
          }}
          title="시공편지 도착일"
        />
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 52px)',
        background: 'radial-gradient(ellipse 120% 80% at 50% -20%, rgba(56,189,248,0.15) 0%, transparent 50%), radial-gradient(ellipse 80% 60% at 100% 50%, rgba(168,85,247,0.12) 0%, transparent 45%), linear-gradient(180deg,#0c0a14 0%,#12101c 40%,#0f0d18 100%)',
        color: '#e8e6f0',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '20px 14px 32px' : '36px 40px 48px' }}>
        {/* 헤더 */}
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.35em', color: '#67e8f9', textTransform: 'uppercase' }}>
            Quantum Flow
          </p>
          <h1 style={{ margin: '10px 0 8px', fontSize: isMobile ? 26 : 34, fontWeight: 900, background: 'linear-gradient(135deg,#e0f2fe,#c4b5fd,#f0abfc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            시공편지
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(226,232,240,0.65)', lineHeight: 1.6, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
            시간선을 넘어 <strong style={{ color: '#a5f3fc' }}>미래의 나</strong> 또는 <strong style={{ color: '#d8b4fe' }}>과거의 나</strong>에게 편지를 보냅니다.
            도착일에는 통합 캘린더에 표시되며, 잠금을 켜면 그날이 오기 전엔 편지를 열 수 없습니다.
          </p>
          <Link
            to="/master-board?warehouse=calendar"
            style={{
              display: 'inline-block',
              marginTop: 14,
              fontSize: 12,
              fontWeight: 700,
              color: '#67e8f9',
              textDecoration: 'none',
              borderBottom: '1px solid rgba(103,232,249,0.4)',
            }}
          >
            통합 캘린더에서 도착일 확인 →
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: 24, alignItems: 'start' }}>
          {/* 작성 카드 */}
          <div
            style={{
              borderRadius: 20,
              border: '1px solid rgba(103,232,249,0.25)',
              background: 'linear-gradient(145deg, rgba(30,27,46,0.95) 0%, rgba(18,16,28,0.98) 100%)',
              boxShadow: '0 0 0 1px rgba(168,85,247,0.08), 0 24px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
              padding: 24,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: -40,
                right: -40,
                width: 160,
                height: 160,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(168,85,247,0.25) 0%, transparent 70%)',
                pointerEvents: 'none',
              }}
            />
            <h2 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 800, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>✦</span> {editingId ? '편지 수정' : '새 편지 발송'}
            </h2>

            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 6 }}>제목</span>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="예: 일주일 뒤의 나에게"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(148,163,184,0.2)',
                  background: 'rgba(15,23,42,0.6)',
                  color: '#f8fafc',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </label>

            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 6 }}>본문</span>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="지금의 마음을 적어 두세요. 잠금이 켜져 있으면 도착일 전까지는 다시 읽을 수 없습니다."
                rows={8}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(148,163,184,0.2)',
                  background: 'rgba(15,23,42,0.6)',
                  color: '#f8fafc',
                  fontSize: 14,
                  outline: 'none',
                  resize: 'vertical',
                  minHeight: 140,
                  lineHeight: 1.6,
                }}
              />
            </label>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 14, alignItems: 'flex-end' }}>
              <label style={{ flex: '1 1 140px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 6 }}>도착일 (열어볼 날)</span>
                <input
                  type="date"
                  value={openDate}
                  onChange={e => setOpenDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid rgba(148,163,184,0.2)',
                    background: 'rgba(15,23,42,0.6)',
                    color: '#f8fafc',
                    fontSize: 13,
                  }}
                />
              </label>
              <div style={{ flex: '1 1 200px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 6 }}>방향</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['to_future', 'to_past'] as const).map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDirection(d)}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: direction === d ? '1px solid #67e8f9' : '1px solid rgba(148,163,184,0.2)',
                        background: direction === d ? 'rgba(103,232,249,0.12)' : 'rgba(15,23,42,0.4)',
                        color: direction === d ? '#a5f3fc' : '#94a3b8',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {dirLabel[d]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={lockUntilOpen}
                onChange={e => setLockUntilOpen(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#a855f7' }}
              />
              <span style={{ fontSize: 13, color: '#cbd5e1' }}>
                <strong style={{ color: '#e9d5ff' }}>도착일 전까지 잠금</strong>
                <span style={{ display: 'block', fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  켜면 해당 날짜가 오기 전에는 편지함에서 내용을 열어볼 수 없습니다.
                </span>
              </span>
            </label>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={saveNew}
                disabled={!title.trim()}
                style={{
                  padding: '12px 24px',
                  borderRadius: 14,
                  border: 'none',
                  background: title.trim()
                    ? 'linear-gradient(135deg,#0891b2,#7c3aed)'
                    : 'rgba(71,85,105,0.5)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: title.trim() ? 'pointer' : 'not-allowed',
                  boxShadow: title.trim() ? '0 8px 32px rgba(124,58,237,0.35)' : 'none',
                }}
              >
                {editingId ? '변경 저장' : '시공으로 전송'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  style={{
                    padding: '12px 20px',
                    borderRadius: 14,
                    border: '1px solid rgba(148,163,184,0.35)',
                    background: 'transparent',
                    color: '#94a3b8',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  취소
                </button>
              )}
            </div>
          </div>

          {/* 미니 캘린더 */}
          <div
            style={{
              borderRadius: 20,
              border: '1px solid rgba(168,85,247,0.2)',
              background: 'rgba(18,16,28,0.85)',
              padding: 18,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, color: '#c4b5fd' }}>도착일이 있는 날</p>
            <div className="quantum-cal-wrap">
              <Calendar value={calDate} onChange={v => v && setCalDate(v as Date)} locale="ko-KR" tileContent={calTile} />
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
              도착일에 맞춰 청록·보라 점이 찍힙니다. <Link to="/master-board?warehouse=calendar" style={{ color: '#67e8f9' }}>통합 캘린더</Link>에서도 같은 날짜를 확인할 수 있어요.
            </p>
          </div>
        </div>

        {/* 편지함 */}
        <div style={{ marginTop: 36 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ opacity: 0.9 }}>◇</span> 편지함
          </h2>
          {lettersSorted.length === 0 ? (
            <p style={{ margin: 0, padding: 28, textAlign: 'center', borderRadius: 16, border: '1px dashed rgba(148,163,184,0.25)', color: '#64748b', fontSize: 14 }}>
              아직 시공으로 보낸 편지가 없습니다.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {lettersSorted.map(l => {
                const readable = canReadLetter(l, todayYmd)
                const open = expandedId === l.id
                return (
                  <div
                    key={l.id}
                    style={{
                      borderRadius: 16,
                      border: '1px solid rgba(103,232,249,0.15)',
                      background: 'linear-gradient(90deg, rgba(30,27,46,0.9) 0%, rgba(20,18,32,0.95) 100%)',
                      padding: 18,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#a5f3fc', letterSpacing: '0.06em' }}>{dirLabel[l.direction]}</span>
                          <span style={{ fontSize: 11, color: '#64748b' }}>도착 {l.openDate}</span>
                          {l.lockUntilOpen && !readable && (
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24', padding: '2px 8px', borderRadius: 999, background: 'rgba(251,191,36,0.12)' }}>잠김</span>
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{l.title}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!readable && l.lockUntilOpen) return
                            setExpandedId(open ? null : l.id)
                          }}
                          disabled={!readable && l.lockUntilOpen}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 10,
                            border: '1px solid rgba(103,232,249,0.35)',
                            background: readable || !l.lockUntilOpen ? 'rgba(103,232,249,0.1)' : 'rgba(51,65,85,0.4)',
                            color: readable || !l.lockUntilOpen ? '#a5f3fc' : '#475569',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: readable || !l.lockUntilOpen ? 'pointer' : 'not-allowed',
                          }}
                        >
                          {!readable && l.lockUntilOpen ? '도착 전' : open ? '접기' : '열기'}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(l)}
                          disabled={!readable && l.lockUntilOpen}
                          title={!readable && l.lockUntilOpen ? '도착일 전에는 편집할 수 없습니다' : undefined}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 10,
                            border: '1px solid rgba(148,163,184,0.3)',
                            background: 'transparent',
                            color: !readable && l.lockUntilOpen ? '#475569' : '#94a3b8',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: !readable && l.lockUntilOpen ? 'not-allowed' : 'pointer',
                          }}
                        >
                          편집
                        </button>
                        <button type="button" onClick={() => remove(l.id)} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(248,113,113,0.35)', background: 'transparent', color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          삭제
                        </button>
                      </div>
                    </div>
                    {open && readable && (
                      <p style={{ margin: '14px 0 0', paddingTop: 14, borderTop: '1px solid rgba(148,163,184,0.12)', fontSize: 14, color: '#cbd5e1', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                        {l.body || '(내용 없음)'}
                      </p>
                    )}
                    {!readable && l.lockUntilOpen && (
                      <p style={{ margin: '12px 0 0', fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>
                        도착일({l.openDate})이 되면 잠금이 풀립니다. 지금은 시공의 막에 가려져 있습니다.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .quantum-cal-wrap .react-calendar { width: 100%; border: none; background: transparent; font-family: inherit; color: #e2e8f0; }
        .quantum-cal-wrap .react-calendar__navigation button { color: #c4b5fd; }
        .quantum-cal-wrap .react-calendar__tile { font-size: 12px; color: #cbd5e1; }
        .quantum-cal-wrap .react-calendar__tile--active { background: rgba(103,232,249,0.25) !important; color: #fff !important; }
        .quantum-cal-wrap .react-calendar__month-view__weekdays { color: #64748b; }
      `}</style>
    </div>
  )
}
