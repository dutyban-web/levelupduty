/**
 * 통합 레이팅과 동일 UI — 별 5개, 왼쪽/오른쪽 반개 단위 (0.5~5, 0=미설정)
 */
import { clampUnifiedOverallRating } from './unifiedOverallRatingData'

function starFill(value: number, index: number): 'none' | 'half' | 'full' {
  if (value >= index + 1) return 'full'
  if (value >= index + 0.5) return 'half'
  return 'none'
}

export function UnifiedHalfStarRating({
  value,
  onChange,
  disabled,
  starSize = 30,
  ariaLabel = '별점',
}: {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
  starSize?: number
  ariaLabel?: string
}) {
  const sz = starSize
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}
    >
      {[0, 1, 2, 3, 4].map(i => {
        const fill = starFill(value, i)
        return (
          <div
            key={i}
            style={{
              position: 'relative',
              width: sz,
              height: sz,
              flexShrink: 0,
            }}
          >
            <span
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: sz - 2,
                lineHeight: 1,
                color: '#d1d5db',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            >
              ★
            </span>
            {fill !== 'none' && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  overflow: 'hidden',
                  width: fill === 'full' ? '100%' : '50%',
                  height: '100%',
                  pointerEvents: 'none',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: sz,
                    fontSize: sz - 2,
                    lineHeight: 1,
                    color: '#fbbf24',
                    userSelect: 'none',
                    textAlign: 'center',
                  }}
                >
                  ★
                </span>
              </span>
            )}
            <button
              type="button"
              disabled={disabled}
              aria-label={`${i + 1}번째 별 왼쪽 (${i + 0.5}점)`}
              onClick={() => onChange(clampUnifiedOverallRating(i + 0.5))}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '50%',
                height: '100%',
                border: 'none',
                padding: 0,
                margin: 0,
                background: 'transparent',
                cursor: disabled ? 'default' : 'pointer',
                zIndex: 2,
              }}
            />
            <button
              type="button"
              disabled={disabled}
              aria-label={`${i + 1}번째 별 오른쪽 (${i + 1}점)`}
              onClick={() => onChange(clampUnifiedOverallRating(i + 1))}
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                width: '50%',
                height: '100%',
                border: 'none',
                padding: 0,
                margin: 0,
                background: 'transparent',
                cursor: disabled ? 'default' : 'pointer',
                zIndex: 2,
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
