/**
 * Manual — 사이트·북마크 목록 (SNS, 유튜브, 즐겨찾기 URL)
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ExternalLink, GripVertical, Link2, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  supabase,
  fetchManualSites,
  insertManualSite,
  updateManualSite,
  deleteManualSite,
  type ManualSiteRow,
} from './supabase'

function hrefFromUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return '#'
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

function SortableSiteCard({
  site,
  onSaved,
  onDeleted,
}: {
  site: ManualSiteRow
  onSaved: (next: ManualSiteRow) => void
  onDeleted: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: site.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.88 : 1,
    zIndex: isDragging ? 20 : undefined,
    touchAction: 'none',
  } as CSSProperties

  const [title, setTitle] = useState(site.title)
  const [url, setUrl] = useState(site.url)
  const [note, setNote] = useState(site.note ?? '')
  const [category, setCategory] = useState(site.category)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTitle(site.title)
    setUrl(site.url)
    setNote(site.note ?? '')
    setCategory(site.category)
  }, [site.id, site.title, site.url, site.note, site.category])

  const save = async () => {
    if (!supabase) {
      window.alert('Supabase가 연결되지 않았습니다.')
      return
    }
    setSaving(true)
    const noteTrim = note.trim()
    const ok = await updateManualSite(site.id, {
      title: title.trim() || '제목 없음',
      url: url.trim() || 'https://',
      note: noteTrim ? noteTrim : null,
      category: category.trim(),
    })
    setSaving(false)
    if (!ok) {
      window.alert('저장에 실패했습니다.')
      return
    }
    onSaved({
      ...site,
      title: title.trim() || '제목 없음',
      url: url.trim() || 'https://',
      note: noteTrim ? noteTrim : null,
      category: category.trim(),
      updated_at: new Date().toISOString(),
    })
  }

  const remove = async () => {
    if (!confirm('이 링크를 삭제할까요?')) return
    const ok = await deleteManualSite(site.id)
    if (!ok) {
      window.alert('삭제에 실패했습니다.')
      return
    }
    onDeleted(site.id)
  }

  const openLink = () => {
    const h = hrefFromUrl(url)
    if (h === '#') return
    window.open(h, '_blank', 'noopener,noreferrer')
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="list-none rounded-2xl border border-teal-200/90 bg-white/95 p-3 shadow-sm sm:p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div
          {...listeners}
          className="flex h-10 w-10 shrink-0 cursor-grab touch-manipulation items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 active:cursor-grabbing"
          title="드래그하여 순서 변경"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">표시 이름</span>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={() => void save()}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                placeholder="예: 지인 인스타"
              />
            </label>
            <label className="block min-w-0 sm:col-span-1">
              <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">URL</span>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onBlur={() => void save()}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                placeholder="https://..."
                spellCheck={false}
              />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">구분 (선택)</span>
              <input
                value={category}
                onChange={e => setCategory(e.target.value)}
                onBlur={() => void save()}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                placeholder="예: SNS, 유튜브, 업무"
              />
            </label>
            <label className="block min-w-0 sm:col-span-1">
              <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">메모</span>
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                onBlur={() => void save()}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                placeholder="참고용 짧은 메모"
              />
            </label>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:flex-col sm:items-stretch">
          <button
            type="button"
            onClick={openLink}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-900 hover:bg-teal-100"
            title="새 탭에서 열기"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            열기
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-900 hover:bg-violet-100 disabled:opacity-60"
          >
            <Pencil className="h-3.5 w-3.5" />
            {saving ? '저장…' : '저장'}
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-900 hover:bg-red-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            삭제
          </button>
        </div>
      </div>
    </li>
  )
}

/** 필터 적용 시 드래그 비활성 — 동일 카드 UI, sortable 없음 */
function SiteCardStatic({
  site,
  onSaved,
  onDeleted,
}: {
  site: ManualSiteRow
  onSaved: (next: ManualSiteRow) => void
  onDeleted: (id: string) => void
}) {
  const [title, setTitle] = useState(site.title)
  const [url, setUrl] = useState(site.url)
  const [note, setNote] = useState(site.note ?? '')
  const [category, setCategory] = useState(site.category)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTitle(site.title)
    setUrl(site.url)
    setNote(site.note ?? '')
    setCategory(site.category)
  }, [site.id, site.title, site.url, site.note, site.category])

  const save = async () => {
    if (!supabase) {
      window.alert('Supabase가 연결되지 않았습니다.')
      return
    }
    setSaving(true)
    const noteTrim = note.trim()
    const ok = await updateManualSite(site.id, {
      title: title.trim() || '제목 없음',
      url: url.trim() || 'https://',
      note: noteTrim ? noteTrim : null,
      category: category.trim(),
    })
    setSaving(false)
    if (!ok) {
      window.alert('저장에 실패했습니다.')
      return
    }
    onSaved({
      ...site,
      title: title.trim() || '제목 없음',
      url: url.trim() || 'https://',
      note: noteTrim ? noteTrim : null,
      category: category.trim(),
      updated_at: new Date().toISOString(),
    })
  }

  const remove = async () => {
    if (!confirm('이 링크를 삭제할까요?')) return
    const ok = await deleteManualSite(site.id)
    if (!ok) {
      window.alert('삭제에 실패했습니다.')
      return
    }
    onDeleted(site.id)
  }

  const openLink = () => {
    const h = hrefFromUrl(url)
    if (h === '#') return
    window.open(h, '_blank', 'noopener,noreferrer')
  }

  return (
    <li className="list-none rounded-2xl border border-teal-200/90 bg-white/95 p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-400"
          title="필터 중에는 순서 변경 불가"
        >
          <Link2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">표시 이름</span>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={() => void save()}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                placeholder="예: 지인 인스타"
              />
            </label>
            <label className="block min-w-0 sm:col-span-1">
              <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">URL</span>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onBlur={() => void save()}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                placeholder="https://..."
                spellCheck={false}
              />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">구분 (선택)</span>
              <input
                value={category}
                onChange={e => setCategory(e.target.value)}
                onBlur={() => void save()}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                placeholder="예: SNS, 유튜브, 업무"
              />
            </label>
            <label className="block min-w-0 sm:col-span-1">
              <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">메모</span>
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                onBlur={() => void save()}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                placeholder="참고용 짧은 메모"
              />
            </label>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:flex-col sm:items-stretch">
          <button
            type="button"
            onClick={openLink}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-900 hover:bg-teal-100"
            title="새 탭에서 열기"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            열기
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-900 hover:bg-violet-100 disabled:opacity-60"
          >
            <Pencil className="h-3.5 w-3.5" />
            {saving ? '저장…' : '저장'}
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-900 hover:bg-red-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            삭제
          </button>
        </div>
      </div>
    </li>
  )
}

export function ManualSitesPanel() {
  const [sites, setSites] = useState<ManualSiteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    const list = await fetchManualSites()
    setSites(list)
    setLoading(false)
    return list
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const allCategories = useMemo(() => {
    const s = new Set<string>()
    for (const x of sites) {
      const c = x.category?.trim()
      if (c) s.add(c)
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [sites])

  const filtered = useMemo(() => {
    if (!selectedCategory) return sites
    return sites.filter(x => (x.category ?? '').trim() === selectedCategory)
  }, [sites, selectedCategory])

  const dragEnabled = !selectedCategory

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (e: DragEndEvent) => {
    if (!dragEnabled) return
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = filtered.findIndex(s => s.id === active.id)
    const newIdx = filtered.findIndex(s => s.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const nextOrder = arrayMove(filtered, oldIdx, newIdx)
    const withSortOrder = nextOrder.map((s, i) => ({ ...s, sort_order: i }))
    const previous = sites
    setSites(withSortOrder)
    void (async () => {
      try {
        const results = await Promise.all(withSortOrder.map((s, i) => updateManualSite(s.id, { sort_order: i })))
        if (results.some(ok => !ok)) throw new Error('sort_order 저장 실패')
      } catch (err) {
        console.error('[ManualSites] 순서 저장', err)
        setSites(previous)
        window.alert('순서 저장에 실패했습니다. 이전 순서로 되돌렸습니다.')
      }
    })()
  }

  const addSite = async () => {
    if (!supabase) {
      window.alert('Supabase가 연결되지 않았습니다.')
      return
    }
    const row = await insertManualSite({ title: '새 링크', url: 'https://', category: '' })
    if (!row) {
      window.alert('링크를 추가할 수 없습니다. 로그인과 DB(manual_sites)를 확인하세요.')
      return
    }
    setSites(prev => [...prev, row])
  }

  const onSaved = (next: ManualSiteRow) => {
    setSites(prev => prev.map(s => (s.id === next.id ? next : s)))
  }

  const onDeleted = (id: string) => {
    setSites(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-teal-900/80">구분 필터</span>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="min-h-[38px] min-w-[10rem] rounded-xl border border-teal-200/90 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200"
            aria-label="구분으로 필터"
          >
            <option value="">전체</option>
            {allCategories.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {selectedCategory !== '' && (
            <span className="rounded-lg bg-amber-100/90 px-2 py-1 text-[11px] font-semibold text-amber-900">
              필터 중에는 드래그 순서 변경 불가
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void addSite()}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          새 링크
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-teal-200/80 bg-teal-50/80 px-4 py-10 text-center text-sm text-teal-900">
          불러오는 중…
        </div>
      ) : sites.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-teal-300/80 bg-white/60 py-12 text-center text-sm text-slate-600">
          등록된 링크가 없습니다. &quot;새 링크&quot;로 북마크·SNS·유튜브 주소를 추가해 보세요.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-600">
          이 구분에 맞는 항목이 없습니다.
        </div>
      ) : dragEnabled ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {filtered.map(s => (
                <SortableSiteCard key={s.id} site={s} onSaved={onSaved} onDeleted={onDeleted} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {filtered.map(s => (
            <SiteCardStatic key={s.id} site={s} onSaved={onSaved} onDeleted={onDeleted} />
          ))}
        </ul>
      )}
    </div>
  )
}
