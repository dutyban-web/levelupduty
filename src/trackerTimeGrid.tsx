/**
 * Tracker 위클리 그리드와 공유 — 시간축·블록 렌더
 */
import React, { useState } from 'react'
import type { TrackerCategory, TrackerLog } from './trackerData'

export const START_HOUR = 5
export const END_HOUR = 24
export const PX_PER_HOUR = 44
export const SPAN_MIN = (END_HOUR - START_HOUR) * 60
export const COL_HEIGHT = (END_HOUR - START_HOUR) * PX_PER_HOUR
export const START_MIN = START_HOUR * 60
export const END_MIN = END_HOUR * 60

export function parseHmToMinutes(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function minutesToHm(total: number): string {
  const h = Math.floor(total / 60) % 24
  const m = Math.round(total % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function clampBlockRange(startMin: number, durationMin: number): { start: number; dur: number } {
  let d = Math.max(5, Math.round(durationMin))
  let s = Math.round(startMin)
  s = Math.max(START_MIN, Math.min(s, END_MIN - d))
  d = Math.min(d, END_MIN - s)
  d = Math.max(5, d)
  return { start: s, dur: d }
}

export function renderHourLines(hours: number[]) {
  return hours.map(hh => (
    <div
      key={`hl-${hh}`}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: (hh - START_HOUR) * PX_PER_HOUR,
        height: PX_PER_HOUR,
        borderBottom: '1px solid rgba(0,0,0,0.04)',
        pointerEvents: 'none',
      }}
    />
  ))
}

export function LogBlock({
  log,
  cat,
  isPlan,
  onRemove,
  onPatch,
}: {
  log: TrackerLog
  cat?: TrackerCategory
  isPlan: boolean
  onRemove: () => void
  onPatch: (patch: Partial<Pick<TrackerLog, 'startTime' | 'duration'>>) => void
}) {
  const [hover, setHover] = useState(false)
  const [resizing, setResizing] = useState(false)

  const startMin = parseHmToMinutes(log.startTime)
  const rel = startMin - START_HOUR * 60
  const top = Math.max(0, (rel / SPAN_MIN) * COL_HEIGHT)
  const height = Math.max(16, (log.duration / SPAN_MIN) * COL_HEIGHT)
  const color = cat?.color ?? '#6366f1'
  const showHandles = hover || resizing

  const beginResize = (edge: 'top' | 'bottom') => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setResizing(true)
    const startY = e.clientY
    const origStart = parseHmToMinutes(log.startTime)
    const origDur = log.duration

    const onMove = (ev: PointerEvent) => {
      const dy = ev.clientY - startY
      const deltaMin = (dy / COL_HEIGHT) * SPAN_MIN
      if (edge === 'bottom') {
        let nd = Math.round(origDur + deltaMin)
        nd = Math.max(5, nd)
        if (origStart + nd > END_MIN) nd = END_MIN - origStart
        nd = Math.max(5, nd)
        onPatch({ duration: nd })
      } else {
        const c = clampBlockRange(origStart + deltaMin, origDur - deltaMin)
        onPatch({ startTime: minutesToHm(c.start), duration: c.dur })
      }
    }

    const onUp = () => {
      setResizing(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handleBar: React.CSSProperties = {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 7,
    borderRadius: 4,
    background: 'rgba(255,255,255,0.96)',
    boxShadow: '0 0 0 1px rgba(0,0,0,0.18)',
    zIndex: 4,
    cursor: 'ns-resize',
    touchAction: 'none',
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={`${isPlan ? '[Plan]' : '[Actual]'} ${cat?.label ?? ''} · ${log.tag} · ${log.duration}분 — 위·아래 핸들로 길이 조절${log.memo ? `\n${log.memo}` : ''}`}
      style={{
        position: 'absolute',
        left: 2,
        right: 2,
        top,
        height,
        borderRadius: 6,
        background: isPlan
          ? `repeating-linear-gradient(135deg, ${color}22, ${color}22 4px, ${color}11 4px, ${color}11 8px)`
          : `linear-gradient(180deg, ${color}dd, ${color}bb)`,
        border: isPlan ? `1.5px dashed ${color}88` : 'none',
        color: isPlan ? color : '#fff',
        fontSize: 13,
        fontWeight: 800,
        padding: '8px 6px 8px',
        overflow: 'visible',
        boxShadow: isPlan ? 'none' : `0 1px 4px ${color}40`,
        cursor: 'default',
        zIndex: 2,
      }}
    >
      {showHandles && (
        <div
          role="separator"
          aria-label="시작 시각 조절"
          style={{ ...handleBar, top: -4 }}
          onPointerDown={beginResize('top')}
        />
      )}
      <div
        style={{
          textAlign: 'right',
          paddingRight: 22,
          lineHeight: 1.25,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <span>{log.tag || cat?.label}</span>
        <span style={{ fontSize: 11, opacity: 0.9, fontWeight: 700 }}> {log.duration}분</span>
      </div>
      <button
        type="button"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => {
          e.stopPropagation()
          onRemove()
        }}
        style={{
          position: 'absolute',
          top: 5,
          right: 2,
          width: 14,
          height: 14,
          border: 'none',
          borderRadius: 3,
          background: 'rgba(0,0,0,0.2)',
          color: '#fff',
          fontSize: 10,
          cursor: 'pointer',
          lineHeight: 1,
          padding: 0,
          zIndex: 5,
        }}
      >
        ×
      </button>
      {showHandles && (
        <div
          role="separator"
          aria-label="소요 시간(종료) 조절"
          style={{ ...handleBar, bottom: -4 }}
          onPointerDown={beginResize('bottom')}
        />
      )}
    </div>
  )
}
