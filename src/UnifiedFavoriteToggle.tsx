/**
 * 통합 즐겨찾기 토글 — Manual·순서도·인물 등에서 별표로 추가/제거
 */
import { useCallback, useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import {
  addUnifiedFavorite,
  isUnifiedFavorite,
  removeUnifiedFavorite,
  type UnifiedFavoriteKind,
} from './unifiedFavorites'

type Props = {
  kind: UnifiedFavoriteKind
  refId: string
  title: string
  subtitle?: string
  href: string
  className?: string
  /** 목록이 같은 화면에서 갱신될 때 외부와 동기화 */
  syncVersion?: number
}

export function UnifiedFavoriteToggle({
  kind,
  refId,
  title,
  subtitle,
  href,
  className = '',
  syncVersion = 0,
}: Props) {
  const [on, setOn] = useState(() => isUnifiedFavorite(kind, refId))

  useEffect(() => {
    setOn(isUnifiedFavorite(kind, refId))
  }, [kind, refId, syncVersion])

  const toggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      if (on) {
        removeUnifiedFavorite(kind, refId)
        setOn(false)
      } else {
        addUnifiedFavorite({ kind, refId, title, subtitle: subtitle ?? '', href })
        setOn(true)
      }
    },
    [kind, refId, title, subtitle, href, on],
  )

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent p-1.5 transition-colors hover:bg-amber-50 ${className}`}
      title={on ? '통합 즐겨찾기에서 제거' : '통합 즐겨찾기에 추가 (Board → 데이터 창고)'}
      aria-pressed={on}
    >
      <Star
        className={`h-4 w-4 ${on ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`}
        strokeWidth={on ? 0 : 1.75}
      />
    </button>
  )
}
