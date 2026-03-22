/**
 * 하루 24시간 원형 뷰 — 위클리 그리드와 동일한 TrackerLog 데이터 사용
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { TrackerLog, TrackerCategory } from './trackerData'

function parseHmToMinutes(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** 0:00 = 정12시 방향(위), 시계 방향 */
function minutesToAngleRad(min: number): number {
  const m = ((min % 1440) + 1440) % 1440
  return (m / 1440) * 2 * Math.PI
}

function polar(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.sin(angleRad),
    y: cy - r * Math.cos(angleRad),
  }
}

/** SVG 좌표 → 하루 기준 분 (0–1440) */
function pointToMinutes(cx: number, cy: number, x: number, y: number): number {
  const dx = x - cx
  const dy = y - cy
  let theta = Math.atan2(dx, -dy)
  if (theta < 0) theta += 2 * Math.PI
  return (theta / (2 * Math.PI)) * 1440
}

function minutesToHm(total: number): string {
  const m = ((Math.round(total) % 1440) + 1440) % 1440
  const h = Math.floor(m / 60) % 24
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** 자정 넘어가는 블록 분할 */
function splitDaySegments(startMin: number, durationMin: number): { start: number; end: number }[] {
  if (durationMin <= 0) return []
  const out: { start: number; end: number }[] = []
  let remaining = durationMin
  let s = ((startMin % 1440) + 1440) % 1440
  let guard = 0
  while (remaining > 0 && guard < 4) {
    guard++
    const room = 1440 - s
    const len = Math.min(remaining, room)
    out.push({ start: s, end: s + len })
    remaining -= len
    s = 0
  }
  return out
}

function donutWedgePath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  minStart: number,
  minEnd: number,
): string {
  const a0 = minutesToAngleRad(minStart)
  const a1 = minutesToAngleRad(minEnd)
  const delta = a1 - a0
  const large = Math.abs(delta) > Math.PI ? 1 : 0
  const sweepOuter = delta >= 0 ? 1 : 0
  const sweepInner = delta >= 0 ? 0 : 1
  const p0o = polar(cx, cy, rOuter, a0)
  const p1o = polar(cx, cy, rOuter, a1)
  const p1i = polar(cx, cy, rInner, a1)
  const p0i = polar(cx, cy, rInner, a0)
  return [
    `M ${p0i.x} ${p0i.y}`,
    `L ${p0o.x} ${p0o.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} ${sweepOuter} ${p1o.x} ${p1o.y}`,
    `L ${p1i.x} ${p1i.y}`,
    `A ${rInner} ${rInner} 0 ${large} ${sweepInner} ${p0i.x} ${p0i.y}`,
    'Z',
  ].join(' ')
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type SliceLabel = {
  key: string
  x: number
  y: number
  text: string
  fill: string
  stroke?: string
  small: boolean
}

type Props = {
  /** YYYY-MM-DD */
  dateYmd: string
  onDateYmdChange: (next: string) => void
  /** 해당 날짜의 로그(부모에서 bundle.logs 필터) */
  dayLogs: TrackerLog[]
  catMap: Map<string, TrackerCategory>
  /** 우클릭 메뉴에서 선택 시 모달 열기 */
  onAddSchedule?: (type: 'plan' | 'actual', opts: { startTime: string; duration?: number }) => void
}

export function CircularDayTracker({ dateYmd, onDateYmdChange, dayLogs, catMap, onAddSchedule }: Props) {
  const [tick, setTick] = useState(0)
  const [ringMenu, setRingMenu] = useState<null | { x: number; y: number; startTime: string }>(null)

  useEffect(() => {
    const t = window.setInterval(() => setTick(x => x + 1), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!ringMenu) return
    const close = () => setRingMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [ringMenu])

  const isToday = dateYmd === toYMD(new Date())

  const nowMinutes = useMemo(() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes() + n.getSeconds() / 60
  }, [tick, dateYmd])

  const plans = useMemo(() => dayLogs.filter(l => l.type === 'plan'), [dayLogs])
  const actuals = useMemo(() => dayLogs.filter(l => l.type === 'actual'), [dayLogs])

  const planMin = useMemo(() => plans.reduce((s, l) => s + l.duration, 0), [plans])
  const actualMin = useMemo(() => actuals.reduce((s, l) => s + l.duration, 0), [actuals])

  const size = 340
  const cx = size / 2
  const cy = size / 2
  const rOuter = 148
  const rInner = 78
  const rTicks = 138
  const rLbl = 168

  const planSlices = useMemo(() => {
    const items: { path: string; color: string; key: string }[] = []
    for (const log of plans) {
      const start = parseHmToMinutes(log.startTime)
      const segs = splitDaySegments(start, log.duration)
      const cat = catMap.get(log.categoryId)
      const color = cat?.color ?? '#94a3b8'
      segs.forEach((seg, i) => {
        items.push({
          key: `${log.id}-p-${i}`,
          color,
          path: donutWedgePath(cx, cy, rInner - 6, rOuter - 2, seg.start, seg.end),
        })
      })
    }
    return items
  }, [plans, catMap, cx, cy, rInner, rOuter])

  const planLabels = useMemo((): SliceLabel[] => {
    const out: SliceLabel[] = []
    const rMid = (rInner - 6 + rOuter - 2) / 2
    for (const log of plans) {
      const start = parseHmToMinutes(log.startTime)
      const segs = splitDaySegments(start, log.duration)
      const cat = catMap.get(log.categoryId)
      const color = cat?.color ?? '#94a3b8'
      const raw = (log.tag || cat?.label || 'Plan').trim() || 'Plan'
      const text = raw.length > 14 ? `${raw.slice(0, 13)}…` : raw
      segs.forEach((seg, i) => {
        const span = seg.end - seg.start
        if (span < 18) return
        const mid = (seg.start + seg.end) / 2
        const ang = minutesToAngleRad(mid)
        const p = polar(cx, cy, rMid, ang)
        out.push({
          key: `${log.id}-pl-${i}`,
          x: p.x,
          y: p.y,
          text,
          fill: color,
          stroke: 'rgba(255,255,255,0.85)',
          small: span < 45,
        })
      })
    }
    return out
  }, [plans, catMap, cx, cy, rInner, rOuter])

  const actualSlices = useMemo(() => {
    const items: { path: string; color: string; key: string; label: string }[] = []
    for (const log of actuals) {
      const start = parseHmToMinutes(log.startTime)
      const segs = splitDaySegments(start, log.duration)
      const cat = catMap.get(log.categoryId)
      const color = cat?.color ?? '#6366f1'
      const label = (log.tag || cat?.label || '').slice(0, 8)
      segs.forEach((seg, i) => {
        items.push({
          key: `${log.id}-a-${i}`,
          color,
          label,
          path: donutWedgePath(cx, cy, rInner, rOuter, seg.start, seg.end),
        })
      })
    }
    return items
  }, [actuals, catMap, cx, cy, rInner, rOuter])

  const actualLabels = useMemo((): SliceLabel[] => {
    const out: SliceLabel[] = []
    const rMid = (rInner + rOuter) / 2
    for (const log of actuals) {
      const start = parseHmToMinutes(log.startTime)
      const segs = splitDaySegments(start, log.duration)
      const cat = catMap.get(log.categoryId)
      const raw = (log.tag || cat?.label || 'Actual').trim() || 'Actual'
      const text = raw.length > 14 ? `${raw.slice(0, 13)}…` : raw
      segs.forEach((seg, i) => {
        const span = seg.end - seg.start
        if (span < 18) return
        const mid = (seg.start + seg.end) / 2
        const ang = minutesToAngleRad(mid)
        const p = polar(cx, cy, rMid, ang)
        out.push({
          key: `${log.id}-al-${i}`,
          x: p.x,
          y: p.y,
          text,
          fill: '#fff',
          stroke: 'rgba(0,0,0,0.35)',
          small: span < 45,
        })
      })
    }
    return out
  }, [actuals, catMap, cx, cy, rInner, rOuter])

  const needle = useMemo(() => {
    if (!isToday) return null
    const a = minutesToAngleRad(nowMinutes)
    const p0 = polar(cx, cy, rInner - 10, a)
    const p1 = polar(cx, cy, rOuter + 4, a)
    return { x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y }
  }, [isToday, nowMinutes, cx, cy, rInner, rOuter])

  const hourLabels = useMemo(() => {
    const arr: { x: number; y: number; t: string; m: number }[] = []
    for (let H = 1; H <= 24; H++) {
      const m = H === 24 ? 0 : H * 60
      const ang = minutesToAngleRad(m)
      const p = polar(cx, cy, rLbl, ang)
      arr.push({ x: p.x, y: p.y, t: String(H === 24 ? 24 : H), m: H })
    }
    return arr
  }, [cx, cy, rLbl])

  const handleSvgContextMenu = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!onAddSchedule) return
      e.preventDefault()
      const svg = e.currentTarget
      const pt = svg.createSVGPoint()
      pt.x = e.clientX
      pt.y = e.clientY
      const ctm = svg.getScreenCTM()
      if (!ctm) return
      const p = pt.matrixTransform(ctm.inverse())
      let m = pointToMinutes(cx, cy, p.x, p.y)
      m = Math.round(m / 5) * 5
      m = ((m % 1440) + 1440) % 1440
      const startTime = minutesToHm(m)
      setRingMenu({ x: e.clientX, y: e.clientY, startTime })
    },
    [onAddSchedule, cx, cy],
  )

  const renderSliceLabels = (labels: SliceLabel[]) =>
    labels.map(l => (
      <text
        key={l.key}
        x={l.x}
        y={l.y}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={l.fill}
        stroke={l.stroke}
        strokeWidth={l.stroke ? 0.35 : 0}
        paintOrder="stroke fill"
        fontSize={l.small ? 8.5 : 10}
        fontWeight={800}
        pointerEvents="none"
        style={{ userSelect: 'none' }}
      >
        {l.text}
      </text>
    ))

  return (
    <section
      style={{
        borderRadius: 16,
        border: '1px solid rgba(0,0,0,0.08)',
        background: 'linear-gradient(180deg, #fafaf9 0%, #fff 100%)',
        padding: '16px 18px 20px',
        marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#37352F' }}>24시간 원형 시간표</h3>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#787774', maxWidth: 520 }}>
            위 주간 그리드와 <strong>같은 기록</strong>을 원형으로 표시합니다. Plan은 연한 링, Actual은 채워진 링입니다.{' '}
            <strong>우클릭</strong>으로 해당 시각에 일정을 추가할 수 있습니다.
          </p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#4b5563' }}>
          날짜
          <input
            type="date"
            value={dateYmd}
            onChange={e => onDateYmdChange(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.12)',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          />
        </label>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ maxWidth: '100%', height: 'auto' }}
          onContextMenu={handleSvgContextMenu}
        >
          <defs>
            <filter id="cdt-soft" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.12" />
            </filter>
          </defs>

          {/* 눈금 */}
          {Array.from({ length: 24 }, (_, h) => {
            const m = h * 60
            const a0 = minutesToAngleRad(m)
            const p0 = polar(cx, cy, rTicks, a0)
            const p1 = polar(cx, cy, rOuter - 1, a0)
            return (
              <line
                key={`tk-${h}`}
                x1={p0.x}
                y1={p0.y}
                x2={p1.x}
                y2={p1.y}
                stroke="rgba(0,0,0,0.1)"
                strokeWidth={h % 6 === 0 ? 1.5 : 0.8}
              />
            )
          })}

          {/* Plan (아래층) */}
          {planSlices.map(s => (
            <path key={s.key} d={s.path} fill={s.color} fillOpacity={0.28} stroke={s.color} strokeOpacity={0.45} strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
          ))}

          {/* Actual */}
          {actualSlices.map(s => (
            <path key={s.key} d={s.path} fill={s.color} fillOpacity={0.88} filter="url(#cdt-soft)" />
          ))}

          {renderSliceLabels(planLabels)}
          {renderSliceLabels(actualLabels)}

          {/* 바깥 원 테두리 */}
          <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={1.5} />
          <circle cx={cx} cy={cy} r={rInner} fill="#fafaf9" stroke="rgba(0,0,0,0.06)" strokeWidth={1} />

          {/* 현재 시각 바늘 */}
          {needle && (
            <line
              x1={needle.x1}
              y1={needle.y1}
              x2={needle.x2}
              y2={needle.y2}
              stroke="#f97316"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          )}
          {needle && <circle cx={cx} cy={cy} r={5} fill="#f97316" />}

          {/* 1–24 시 라벨 */}
          {hourLabels.map(h => (
            <text
              key={h.m}
              x={h.x}
              y={h.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#9ca3af"
              fontSize={9}
              fontWeight={700}
              style={{ userSelect: 'none' }}
              pointerEvents="none"
            >
              {h.t}
            </text>
          ))}

          {/* 중앙 텍스트 */}
          <text x={cx} y={cy - 8} textAnchor="middle" fill="#37352F" fontSize={12} fontWeight={800} pointerEvents="none">
            {dateYmd}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill="#6366f1" fontSize={11} fontWeight={700} pointerEvents="none">
            Actual {actualMin}분 · Plan {planMin}분
          </text>
        </svg>
      </div>

      {ringMenu && onAddSchedule && (
        <div
          role="menu"
          style={{
            position: 'fixed',
            left: Math.min(ringMenu.x, typeof window !== 'undefined' ? window.innerWidth - 200 : ringMenu.x),
            top: Math.min(ringMenu.y, typeof window !== 'undefined' ? window.innerHeight - 120 : ringMenu.y),
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
            {ringMenu.startTime} 시작
          </p>
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
              onAddSchedule('plan', { startTime: ringMenu.startTime, duration: 60 })
              setRingMenu(null)
            }}
          >
            계획(Plan) 추가
          </button>
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
              onAddSchedule('actual', { startTime: ringMenu.startTime, duration: 60 })
              setRingMenu(null)
            }}
          >
            실제(Actual) 추가
          </button>
        </div>
      )}

      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: '8px 16px', fontSize: 10, color: '#787774', justifyContent: 'center' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#f59e0b', opacity: 0.5, verticalAlign: 'middle', marginRight: 4 }} /> Plan</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#6366f1', opacity: 0.85, verticalAlign: 'middle', marginRight: 4 }} /> Actual</span>
        {isToday && <span style={{ color: '#ea580c', fontWeight: 700 }}>● 주황 바늘 = 지금</span>}
      </div>
    </section>
  )
}
