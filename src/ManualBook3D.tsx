/**
 * Manual 책장 — 입체 책 표지 (hue 0–360)
 */
export function ManualBook3D({ hue }: { hue: number }) {
  const cover = `hsl(${hue} 34% 44%)`
  const stackEdge = `hsl(${hue} 34% 34%)`
  return (
    <div
      className="relative mx-auto h-[104px] w-[84px] select-none"
      style={{ perspective: 960, perspectiveOrigin: '42% 88%' }}
    >
      <div
        className="relative flex h-full w-full items-end justify-start pl-0.5"
        style={{
          transform: 'rotateY(-17deg)',
          transformStyle: 'preserve-3d',
          filter: 'drop-shadow(10px 14px 12px rgba(0,0,0,0.38))',
        }}
      >
        <div
          className="absolute bottom-0 left-[3px] h-[98px] w-[6px] rounded-[2px]"
          style={{ backgroundColor: stackEdge, transform: 'translateZ(-2px)' }}
          aria-hidden
        />
        <div
          className="relative z-[1] h-[100px] w-[15px] shrink-0 rounded-l-[4px]"
          style={{
            backgroundColor: '#1c1816',
            boxShadow: 'inset -4px 0 8px rgba(0,0,0,0.45), 2px 0 0 rgba(255,255,255,0.04)',
          }}
        >
          <div className="absolute left-1 top-3 bottom-3 w-[2px] rounded-full bg-white/8" aria-hidden />
        </div>
        <div
          className="relative z-[2] h-[96px] w-[6px] shrink-0 self-end rounded-[1px] mb-[2px]"
          style={{
            backgroundColor: '#ece9e4',
            boxShadow: 'inset 2px 0 0 rgba(0,0,0,0.08), inset -1px 0 0 rgba(255,255,255,0.35)',
          }}
        />
        <div
          className="relative z-[3] h-[100px] w-[54px] shrink-0 overflow-hidden rounded-r-[5px] border border-black/12"
          style={{
            backgroundColor: cover,
            boxShadow: '6px 0 14px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.12)',
          }}
        >
          <div className="pointer-events-none absolute left-1.5 top-5 bottom-5 w-[2px] rounded-full bg-black/12" aria-hidden />
        </div>
      </div>
    </div>
  )
}
