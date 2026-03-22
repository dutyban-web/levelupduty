/**
 * 통합 인물 DB ↔ 엔티티 다중 연결 (저장 시 person_entity_links 동기화)
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  supabase,
  fetchUnifiedPeople,
  fetchPersonIdsForEntity,
  replacePersonLinksForEntity,
  type UnifiedPersonRow,
} from './supabase'

type Props = {
  entityType: string
  entityId: string
  /** 한 줄 요약 스타일 */
  compact?: boolean
}

export function PersonLinkPicker({ entityType, entityId, compact }: Props) {
  const [people, setPeople] = useState<UnifiedPersonRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const [list, ids] = await Promise.all([
      fetchUnifiedPeople(),
      fetchPersonIdsForEntity(entityType, entityId),
    ])
    setPeople(list)
    setSelected(new Set(ids))
    setLoading(false)
  }, [entityType, entityId])

  useEffect(() => {
    void reload()
  }, [reload])

  const flushSave = useCallback(
    async (ids: Set<string>) => {
      if (!supabase) return
      const ok = await replacePersonLinksForEntity(entityType, entityId, Array.from(ids))
      if (!ok) window.alert('인물 연결 저장에 실패했습니다.')
    },
    [entityType, entityId],
  )

  const scheduleSave = useCallback(
    (next: Set<string>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null
        void flushSave(next)
      }, 450)
    },
    [flushSave],
  )

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  const toggle = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      scheduleSave(n)
      return n
    })
  }

  if (!supabase) {
    return (
      <p className="m-0 text-[11px] leading-relaxed text-slate-500">
        로그인하면 통합 인물 DB에 연결할 수 있습니다.
      </p>
    )
  }

  if (loading) {
    return <p className="m-0 text-[11px] text-slate-400">통합 인물 연결 불러오는 중…</p>
  }

  if (people.length === 0) {
    return (
      <div className={compact ? '' : 'rounded-lg border border-dashed border-violet-200 bg-violet-50/50 px-3 py-2'}>
        <p className="m-0 text-[11px] leading-relaxed text-slate-600">
          등록된 인물이 없습니다.{' '}
          <Link to="/master-board?warehouse=people" className="font-bold text-violet-700 underline underline-offset-2">
            Life → 통합 인물 DB
          </Link>
          에서 추가하세요.
        </p>
      </div>
    )
  }

  const body = (
    <ul className={`m-0 flex list-none flex-col gap-1.5 p-0 ${compact ? '' : 'max-h-[200px] overflow-y-auto'}`}>
      {people.map(p => {
        const on = selected.has(p.id)
        const name = p.display_name.trim() || '이름 없음'
        return (
          <li key={p.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 hover:bg-white/80">
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(p.id)}
                className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-xs font-medium text-slate-800">{name}</span>
            </label>
          </li>
        )
      })}
    </ul>
  )

  if (compact) {
    return (
      <div className="min-w-0">
        {body}
        <p className="mt-1.5 m-0 text-[10px] text-slate-400">
          <Link to="/master-board?warehouse=people" className="text-violet-600 underline">
            인물 관리
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-violet-200/80 bg-violet-50/40 px-3 py-3">
      <p className="m-0 mb-2 text-[11px] font-bold text-violet-900">통합 인물 DB 연결</p>
      {body}
      <p className="mt-2 m-0 text-[10px] leading-relaxed text-slate-500">
        체크하면 이 항목과 인물이 연결됩니다.{' '}
        <Link to="/master-board?warehouse=people" className="font-semibold text-violet-700 underline">
          인물 추가·편집
        </Link>
      </p>
    </div>
  )
}
