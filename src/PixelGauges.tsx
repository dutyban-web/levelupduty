/**
 * 픽셀 세그먼트 HP/MP 바 — FE GBA 느낌
 */
export function PixelSegmentBar({
  label,
  current,
  max,
  fill,
  back,
  segments = 24,
}: {
  label: string
  current: number
  max: number
  fill: string
  back: string
  segments?: number
}) {
  const m = Math.max(1, max)
  const c = Math.max(0, Math.min(m, current))
  const filled = Math.round((c / m) * segments)
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#e7e5e4', letterSpacing: '0.06em' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 900, color: '#fef3c7', fontFamily: 'ui-monospace, monospace' }}>
          {Math.round(c)}/{m}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: 4,
          borderRadius: 4,
          background: back,
          border: '2px solid rgba(0,0,0,0.45)',
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.06)',
        }}
      >
        {Array.from({ length: segments }, (_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              minWidth: 4,
              height: 14,
              borderRadius: 1,
              background: i < filled ? fill : 'rgba(0,0,0,0.35)',
              boxShadow: i < filled ? `inset 0 -2px 0 rgba(0,0,0,0.35)` : undefined,
            }}
          />
        ))}
      </div>
    </div>
  )
}
