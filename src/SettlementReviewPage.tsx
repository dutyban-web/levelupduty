/**
 * Review — 결산 허브 (일·주·월·분기·년·대운·주제)
 * 통합 캘린더와 동일 데이터 키로 점 연동 (settlementData)
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import { Link } from 'react-router-dom'
import {
  type SettlementKind,
  loadSettlementStore,
  saveSettlementStore,
  SETTLEMENT_TEMPLATES,
  computePeriodKey,
  computeAnchorDate,
  findEntry,
  upsertEntry,
  toYMD,
} from './settlementData'
import { useIsMobile } from './hooks/useIsMobile'

const KIND_ORDER: { id: SettlementKind; label: string; hint: string }[] = [
  { id: 'daily', label: '일일', hint: '매일' },
  { id: 'weekly', label: '주간', hint: '월~일' },
  { id: 'monthly', label: '월간', hint: '달마다' },
  { id: 'quarterly', label: '분기', hint: '3개월' },
  { id: 'yearly', label: '년간', hint: '1년' },
  { id: 'daeun', label: '대운', hint: '사주·장기' },
  { id: 'topic', label: '주제별', hint: '자유 주제' },
]

const inp: import('react').CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid rgba(0,0,0,0.08)',
  background: '#F7F7F5',
  fontSize: 13,
  color: '#37352F',
  outline: 'none',
  fontFamily: 'inherit',
}

export function SettlementReviewPage({ onSaved }: { onSaved?: () => void }) {
  const isMobile = useIsMobile()
  const [kind, setKind] = useState<SettlementKind>('daily')
  const [refDate, setRefDate] = useState(() => new Date())
  const [topicLabel, setTopicLabel] = useState('')
  const [store, setStore] = useState(loadSettlementStore)
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const periodKey = useMemo(() => computePeriodKey(kind, refDate, topicLabel), [kind, refDate, topicLabel])
  const anchorDate = useMemo(() => computeAnchorDate(kind, refDate), [kind, refDate])

  const existing = useMemo(
    () => findEntry(store.entries, kind, periodKey),
    [store.entries, kind, periodKey],
  )

  useEffect(() => {
    if (existing) {
      setAnswers({ ...existing.answers })
    } else {
      const t = SETTLEMENT_TEMPLATES[kind]
      const blank: Record<string, string> = {}
      for (const f of t) blank[f.id] = ''
      setAnswers(blank)
    }
  }, [kind, periodKey, existing?.id])

  const settlementDates = useMemo(() => {
    const s = new Set<string>()
    for (const e of store.entries) {
      if (e.anchorDate) s.add(e.anchorDate)
    }
    return s
  }, [store.entries])

  const save = useCallback(() => {
    const next = upsertEntry(store, {
      id: existing?.id,
      kind,
      periodKey,
      anchorDate,
      topicLabel: kind === 'topic' ? topicLabel.trim() || null : null,
      answers: { ...answers },
    })
    setStore(next)
    saveSettlementStore(next)
    onSaved?.()
  }, [store, existing?.id, kind, periodKey, anchorDate, topicLabel, answers, onSaved])

  const template = SETTLEMENT_TEMPLATES[kind]

  const calTile = ({ date }: { date: Date }) => {
    const dk = toYMD(date)
    const has = settlementDates.has(dk)
    if (!has) return null
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 2 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} title="결산 기록" />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', padding: isMobile ? '14px 12px' : '28px 48px' }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#6366f1', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Review</p>
        <h2 style={{ margin: '6px 0 4px', fontSize: 22, fontWeight: 900, color: '#37352F' }}>결산 허브</h2>
        <p style={{ margin: 0, fontSize: 13, color: '#787774' }}>
          일·주·월·분기·년·대운·주제별로 기록합니다.{' '}
          <Link to="/master-board?warehouse=calendar" style={{ color: '#6366f1', fontWeight: 700 }}>통합 캘린더</Link>
          (Beautiful Life)에 결산 일자가 표시됩니다.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {KIND_ORDER.map(k => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              border: kind === k.id ? '1px solid #6366f1' : '1px solid rgba(0,0,0,0.08)',
              background: kind === k.id ? 'rgba(99,102,241,0.12)' : '#fff',
              color: kind === k.id ? '#4F46E5' : '#787774',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {k.label}
            <span style={{ fontWeight: 500, opacity: 0.75, marginLeft: 4 }}>({k.hint})</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(280px, 340px) 1fr', gap: 24, alignItems: 'start' }}>
        {/* 캘린더 — 기준 날짜 선택 + 결산 점 */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, color: '#37352F' }}>캘린더에서 기준일 선택</p>
          <p style={{ margin: '0 0 12px', fontSize: 11, color: '#9B9A97', lineHeight: 1.5 }}>
            결산을 쓴 날은 <span style={{ color: '#f59e0b', fontWeight: 700 }}>●</span> 주황 점으로 표시됩니다. 바쁘면 건너뛴 날도 그대로 두고, 다음에 이어 쓰면 됩니다.
          </p>
          <div className="settlement-cal-wrap">
            <Calendar
              value={refDate}
              onChange={v => v && setRefDate(v as Date)}
              locale="ko-KR"
              tileContent={calTile}
            />
          </div>
          <p style={{ margin: '12px 0 0', fontSize: 11, color: '#787774' }}>
            현재 기간 키: <code style={{ fontSize: 10, background: '#f4f4f2', padding: '2px 6px', borderRadius: 4 }}>{periodKey}</code>
          </p>
          {kind === 'weekly' && (
            <p style={{ margin: '8px 0 0', fontSize: 11, color: '#6366f1' }}>
              주간 결산은 이 날짜가 포함된 주의 <strong>월요일</strong>을 기준으로 묶입니다.
            </p>
          )}
        </div>

        {/* 폼 */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', padding: 22, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#37352F' }}>
                {KIND_ORDER.find(k => k.id === kind)?.label} 결산
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#787774' }}>대표일: {anchorDate}</p>
            </div>
            {existing && (
              <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>저장됨 · {new Date(existing.updatedAt).toLocaleString('ko-KR')}</span>
            )}
          </div>

          {kind === 'topic' && (
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#787774', display: 'block', marginBottom: 6 }}>주제 이름 (기간 키에 포함)</span>
              <input value={topicLabel} onChange={e => setTopicLabel(e.target.value)} placeholder="예: 웹툰 연재, 건강" style={inp} />
            </label>
          )}

          {kind === 'monthly' && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#37352F' }}>
                연도
                <input
                  type="number"
                  value={refDate.getFullYear()}
                  onChange={e => {
                    const y = parseInt(e.target.value, 10)
                    if (!Number.isNaN(y)) setRefDate(new Date(y, refDate.getMonth(), 1))
                  }}
                  style={{ ...inp, width: 100, marginLeft: 8 }}
                />
              </label>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#37352F' }}>
                월
                <select
                  value={refDate.getMonth()}
                  onChange={e => setRefDate(new Date(refDate.getFullYear(), parseInt(e.target.value, 10), 1))}
                  style={{ ...inp, width: 100, marginLeft: 8 }}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>{i + 1}월</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {kind === 'quarterly' && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>연도</label>
              <input
                type="number"
                value={refDate.getFullYear()}
                onChange={e => {
                  const y = parseInt(e.target.value, 10)
                  if (!Number.isNaN(y)) setRefDate(new Date(y, refDate.getMonth(), 1))
                }}
                style={{ ...inp, width: 100 }}
              />
              <label style={{ fontSize: 12, fontWeight: 600 }}>분기</label>
              <select
                value={Math.floor(refDate.getMonth() / 3)}
                onChange={e => {
                  const q = parseInt(e.target.value, 10)
                  setRefDate(new Date(refDate.getFullYear(), q * 3, 1))
                }}
                style={{ ...inp, width: 120 }}
              >
                <option value={0}>1분기</option>
                <option value={1}>2분기</option>
                <option value={2}>3분기</option>
                <option value={3}>4분기</option>
              </select>
            </div>
          )}

          {kind === 'yearly' && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#37352F' }}>연도</label>
              <input
                type="number"
                value={refDate.getFullYear()}
                onChange={e => {
                  const y = parseInt(e.target.value, 10)
                  if (!Number.isNaN(y)) setRefDate(new Date(y, 0, 1))
                }}
                style={{ ...inp, width: 120, marginLeft: 8 }}
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {template.map(field => (
              <label key={field.id} style={{ display: 'block' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#37352F', display: 'block', marginBottom: 6 }}>{field.label}</span>
                {field.multiline ? (
                  <textarea
                    value={answers[field.id] ?? ''}
                    onChange={e => setAnswers(a => ({ ...a, [field.id]: e.target.value }))}
                    placeholder={field.placeholder}
                    rows={4}
                    style={{ ...inp, minHeight: 88, resize: 'vertical' }}
                  />
                ) : (
                  <input
                    value={answers[field.id] ?? ''}
                    onChange={e => setAnswers(a => ({ ...a, [field.id]: e.target.value }))}
                    placeholder={field.placeholder}
                    style={inp}
                  />
                )}
              </label>
            ))}
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={save}
              style={{
                padding: '11px 22px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              저장
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .settlement-cal-wrap .react-calendar { width: 100%; border: none; font-family: inherit; }
        .settlement-cal-wrap .react-calendar__tile { font-size: 12px; }
      `}</style>
    </div>
  )
}
