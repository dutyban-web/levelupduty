/**
 * Manual — 책장 목록 (문서 클릭 시 /manual/:id 상세)
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FileText, GripVertical, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { ManualDocumentDetail } from './ManualDocumentDetail'
import {
  supabase,
  fetchManualDocuments,
  insertManualDocument,
  updateManualDocument,
  deleteManualDocument,
  type ManualDocumentRow,
} from './supabase'

type SortKey = 'sort_order' | 'updated_at' | 'created_at' | 'importance_score' | 'completion_rate' | 'last_viewed_at'
type SortDir = 'asc' | 'desc'

function coverHueFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 360
  return h
}

const BOOK_GAP_PX = 6

/** 단색 입체 책 — 책등·페이지 두께·표지, perspective + rotateY (그라데이션 없음) */
function ManualBook3D({ hue }: { hue: number }) {
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
        {/* 뒤쪽 묶음(얇은 꼬리) — 문서 더미 느낌 */}
        <div
          className="absolute bottom-0 left-[3px] h-[98px] w-[6px] rounded-[2px]"
          style={{ backgroundColor: stackEdge, transform: 'translateZ(-2px)' }}
          aria-hidden
        />
        {/* 책등 spine */}
        <div
          className="relative z-[1] h-[100px] w-[15px] shrink-0 rounded-l-[4px]"
          style={{
            backgroundColor: '#1c1816',
            boxShadow: 'inset -4px 0 8px rgba(0,0,0,0.45), 2px 0 0 rgba(255,255,255,0.04)',
          }}
        >
          <div className="absolute left-1 top-3 bottom-3 w-[2px] rounded-full bg-white/8" aria-hidden />
        </div>
        {/* 페이지 두께 */}
        <div
          className="relative z-[2] h-[96px] w-[6px] shrink-0 self-end rounded-[1px] mb-[2px]"
          style={{
            backgroundColor: '#ece9e4',
            boxShadow: 'inset 2px 0 0 rgba(0,0,0,0.08), inset -1px 0 0 rgba(255,255,255,0.35)',
          }}
        />
        {/* 표지 */}
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

function StaticManualBook({
  doc,
  onOpen,
  onDelete,
}: {
  doc: ManualDocumentRow
  onOpen: () => void
  onDelete: () => void
}) {
  const hue = coverHueFromId(doc.id)
  const title = doc.title?.trim() || '제목 없음'
  return (
    <li className="group relative flex min-w-0 list-none flex-col items-stretch rounded-md px-0.5 py-0.5 hover:bg-black/5">
      <div className="flex items-start justify-end gap-0.5">
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onDelete()
          }}
          className="shrink-0 flex h-7 w-6 items-center justify-center rounded-md text-amber-100/50 opacity-0 hover:bg-red-900/40 hover:text-red-200 group-hover:opacity-100"
          title="삭제"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <button type="button" onClick={onOpen} className="flex w-full min-w-0 flex-col items-center gap-1 pb-1.5 pt-0 text-left">
        <div className="transition-transform duration-200 group-hover:scale-[1.02]">
          <ManualBook3D hue={hue} />
        </div>
        <div
          className="mx-auto w-full max-w-[88px] truncate rounded px-0.5 py-0.5 text-center text-[10px] font-bold leading-tight text-white"
          style={{ backgroundColor: '#4A828E' }}
          title={title}
        >
          {title}
        </div>
      </button>
    </li>
  )
}

function SortableManualBook({
  doc,
  onOpen,
  onDelete,
}: {
  doc: ManualDocumentRow
  onOpen: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: doc.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.92 : 1,
    zIndex: isDragging ? 20 : undefined,
    touchAction: 'none',
  } as CSSProperties

  const hue = coverHueFromId(doc.id)
  const title = doc.title?.trim() || '제목 없음'

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="group relative flex min-w-0 list-none flex-col items-stretch rounded-md px-0.5 py-0.5 hover:bg-black/5"
    >
      <div
        {...listeners}
        className="flex w-full min-w-0 cursor-grab touch-manipulation flex-col gap-0.5 active:cursor-grabbing"
        title="드래그하여 순서 변경 (그립 또는 책 영역)"
      >
        <div className="flex items-start justify-between gap-0.5">
          <div
            className="flex h-8 min-w-[36px] shrink-0 items-center justify-center rounded-md text-amber-100/85 hover:bg-black/25"
            aria-hidden
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <button
            type="button"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => {
              e.stopPropagation()
              onDelete()
            }}
            className="z-[1] flex h-8 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-amber-100/50 opacity-0 hover:bg-red-900/40 hover:text-red-200 group-hover:opacity-100"
            title="삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <button type="button" onClick={onOpen} className="flex w-full min-w-0 flex-col items-center gap-1 pb-1.5 pt-0 text-left">
          <div className="transition-transform duration-200 group-hover:scale-[1.02]">
            <ManualBook3D hue={hue} />
          </div>
          <div
            className="mx-auto w-full max-w-[88px] truncate rounded px-0.5 py-0.5 text-center text-[10px] font-bold leading-tight text-white"
            style={{ backgroundColor: '#4A828E' }}
            title={title}
          >
            {title}
          </div>
        </button>
      </div>
    </li>
  )
}

function sortDocs(list: ManualDocumentRow[], key: SortKey, dir: SortDir): ManualDocumentRow[] {
  const next = [...list]
  const t = (s: string | null | undefined) => (s ? new Date(s).getTime() : 0)
  const inv = dir === 'desc' ? -1 : 1
  next.sort((a, b) => {
    let cmp = 0
    switch (key) {
      case 'sort_order':
        cmp = a.sort_order - b.sort_order
        break
      case 'updated_at':
        cmp = t(a.updated_at) - t(b.updated_at)
        break
      case 'created_at':
        cmp = t(a.created_at) - t(b.created_at)
        break
      case 'importance_score':
        cmp = a.importance_score - b.importance_score
        break
      case 'completion_rate':
        cmp = a.completion_rate - b.completion_rate
        break
      case 'last_viewed_at': {
        const va = a.last_viewed_at ? new Date(a.last_viewed_at).getTime() : Number.NEGATIVE_INFINITY
        const vb = b.last_viewed_at ? new Date(b.last_viewed_at).getTime() : Number.NEGATIVE_INFINITY
        cmp = va - vb
        break
      }
      default:
        cmp = 0
    }
    return cmp * inv
  })
  return next
}

export function ManualPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const pathParts = useMemo(() => location.pathname.replace(/^\//, '').split('/').filter(Boolean), [location.pathname])
  const routeDocId = pathParts[0] === 'manual' && pathParts[1] ? pathParts[1] : null

  const [docs, setDocs] = useState<ManualDocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('sort_order')
  const [sortDirection, setSortDirection] = useState<SortDir>('asc')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedTag, setSelectedTag] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    const list = await fetchManualDocuments()
    setDocs(list)
    setLoading(false)
    return list
  }, [])

  /** 목록 URL일 때만 목록 로드 (상세 ↔ 목록 전환 시에도 훅 순서 유지) */
  useEffect(() => {
    if (routeDocId) return
    void reload()
  }, [routeDocId, reload])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const allCategories = useMemo(() => {
    const s = new Set<string>()
    for (const d of docs) {
      const c = d.category?.trim()
      if (c) s.add(c)
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [docs])

  const allTags = useMemo(() => {
    const s = new Set<string>()
    for (const d of docs) {
      for (const t of d.tags) {
        if (t.trim()) s.add(t.trim())
      }
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [docs])

  const filtered = useMemo(() => {
    let list = docs
    if (selectedCategory) {
      list = list.filter(d => (d.category ?? '').trim() === selectedCategory)
    }
    if (selectedTag) {
      list = list.filter(d => d.tags.includes(selectedTag))
    }
    return list
  }, [docs, selectedCategory, selectedTag])

  const displayDocs = useMemo(
    () => sortDocs(filtered, sortKey, sortDirection),
    [filtered, sortKey, sortDirection],
  )

  const dragEnabled = sortKey === 'sort_order' && !selectedTag && !selectedCategory

  const resetFilters = () => {
    setSortKey('sort_order')
    setSortDirection('asc')
    setSelectedCategory('')
    setSelectedTag('')
  }

  const handleDragEnd = (e: DragEndEvent) => {
    if (!dragEnabled) return
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = displayDocs.findIndex(d => d.id === active.id)
    const newIdx = displayDocs.findIndex(d => d.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const nextOrder = arrayMove(displayDocs, oldIdx, newIdx)
    /** sort_order를 인덱스와 맞춰야 다음 렌더에서 sortDocs가 다시 예전 순으로 정렬하지 않음 */
    const withSortOrder = nextOrder.map((d, i) => ({ ...d, sort_order: i }))
    const previousDocs = docs
    setDocs(withSortOrder)

    void (async () => {
      try {
        const results = await Promise.all(
          withSortOrder.map((d, i) => updateManualDocument(d.id, { sort_order: i })),
        )
        if (results.some(ok => !ok)) {
          throw new Error('sort_order 저장 실패')
        }
      } catch (err) {
        console.error('[Manual] 책장 순서 저장', err)
        setDocs(previousDocs)
        window.alert('순서 저장에 실패했습니다. 이전 순서로 되돌렸습니다. 다시 시도해 주세요.')
      }
    })()
  }

  const addDoc = async () => {
    if (!supabase) {
      window.alert('Supabase가 연결되지 않았습니다. .env 설정을 확인하세요.')
      return
    }
    const row = await insertManualDocument('새 문서')
    if (!row) {
      window.alert('문서를 만들 수 없습니다. 로그인 상태와 DB(manual_documents)를 확인하세요.')
      return
    }
    setDocs(prev => [...prev, row])
    navigate(`/manual/${row.id}`)
  }

  const removeDoc = async (id: string) => {
    if (!confirm('이 문서를 삭제할까요? 본문과 첨부 링크가 함께 제거됩니다.')) return
    const ok = await deleteManualDocument(id)
    if (!ok) {
      window.alert('삭제에 실패했습니다.')
      return
    }
    setDocs(prev => prev.filter(d => d.id !== id))
  }

  const openDoc = (id: string) => {
    navigate(`/manual/${id}`)
  }

  const shelfBg = {
    backgroundColor: '#5c4a3f',
    backgroundImage:
      'repeating-linear-gradient(to bottom, #5c4a3f 0px, #5c4a3f 168px, #3d322b 168px, #3d322b 172px, #5c4a3f 172px)',
  } as const

  const gridStyle = {
    gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))',
    gap: BOOK_GAP_PX,
  } as const

  if (routeDocId) {
    return (
      <ManualDocumentDetail
        key={routeDocId}
        docId={routeDocId}
        onBack={() => navigate('/manual')}
      />
    )
  }

  return (
    <div className="w-full min-w-0 px-3 sm:px-5 lg:px-8 py-8 pb-20">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-extrabold text-violet-600 tracking-[0.2em]">MANUAL</span>
          <h1 className="mt-2 text-3xl font-black text-slate-900 flex items-center gap-2">
            <FileText className="w-8 h-8 text-violet-600 shrink-0" />
            Manual
          </h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-2xl">
            매뉴얼·체크리스트·업무 문서를 한곳에서 관리합니다. 책을 열면 본문을 노션처럼 편집하고, 탐색기에서{' '}
            <strong className="text-violet-700">사진·동영상·파일을 드래그</strong>해 넣을 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={addDoc}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-violet-600 text-white px-4 py-2.5 text-sm font-bold hover:bg-violet-700"
        >
          <Plus className="w-4 h-4" />
          새 문서
        </button>
      </header>

      <div className="mb-4 rounded-2xl border border-violet-200/80 bg-violet-50/95 px-3 py-3 shadow-sm sm:px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3 sm:gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <span className="shrink-0 text-xs font-bold text-violet-900/75">카테고리</span>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="min-h-[38px] min-w-[9rem] max-w-[min(100%,200px)] shrink-0 rounded-xl border border-violet-200/90 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
              aria-label="카테고리로 필터"
            >
              <option value="">전체</option>
              {allCategories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <span className="shrink-0 text-xs font-bold text-violet-900/75">정렬</span>
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              className="min-h-[38px] min-w-[10rem] shrink-0 rounded-xl border border-violet-200/90 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
              aria-label="정렬 기준"
            >
              <option value="sort_order">책장 순서 (드래그 가능)</option>
              <option value="updated_at">수정일</option>
              <option value="created_at">작성일</option>
              <option value="importance_score">중요도</option>
              <option value="completion_rate">완성율</option>
              <option value="last_viewed_at">마지막으로 연 날짜</option>
            </select>
            <select
              value={sortDirection}
              onChange={e => setSortDirection(e.target.value as SortDir)}
              className="min-h-[38px] min-w-[7.5rem] shrink-0 rounded-xl border border-violet-200/90 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
              aria-label="정렬 방향"
            >
              <option value="asc">오름차순</option>
              <option value="desc">내림차순</option>
            </select>
            <span className="shrink-0 text-xs font-bold text-violet-900/75">태그</span>
            <select
              value={selectedTag}
              onChange={e => setSelectedTag(e.target.value)}
              className="min-h-[38px] min-w-[9rem] max-w-[min(100%,220px)] flex-1 rounded-xl border border-violet-200/90 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
              aria-label="태그로 필터"
            >
              <option value="">전체</option>
              {allTags.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {(selectedTag !== '' || selectedCategory !== '') && (
              <span className="shrink-0 rounded-lg bg-amber-100/90 px-2 py-1 text-[11px] font-semibold text-amber-900">
                태그·카테고리 필터 시 드래그 정렬 끔
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex min-h-[38px] w-full shrink-0 items-center justify-center gap-1.5 rounded-xl border border-violet-300 bg-white px-4 py-2 text-sm font-bold text-violet-800 shadow-sm hover:bg-violet-100/80 sm:w-auto sm:justify-start"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            필터 초기화
          </button>
        </div>
      </div>

      {loading ? (
        <div
          className="rounded-xl border border-amber-900/35 px-4 py-10 text-center text-sm text-amber-50"
          style={{ backgroundColor: '#4d3d34' }}
        >
          불러오는 중…
        </div>
      ) : docs.length === 0 ? (
        <div
          className="rounded-xl border-2 border-dashed border-amber-800/50 py-10 text-center text-sm text-amber-50"
          style={{ backgroundColor: '#4d3d34' }}
        >
          문서가 없습니다. &quot;새 문서&quot;로 추가해 보세요.
        </div>
      ) : displayDocs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-600">
          태그 필터에 맞는 문서가 없습니다.
        </div>
      ) : (
        <div
          className="manual-bookshelf w-full rounded-xl border border-[#2c221c] max-h-[min(78vh,860px)] min-h-[200px] overflow-y-auto overflow-x-hidden px-2 py-3 sm:px-3"
          style={shelfBg}
        >
          {dragEnabled ? (
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
              <SortableContext items={displayDocs.map(d => d.id)} strategy={rectSortingStrategy}>
                <ul className="m-0 grid w-full list-none p-0" style={gridStyle}>
                  {displayDocs.map(doc => (
                    <SortableManualBook
                      key={doc.id}
                      doc={doc}
                      onOpen={() => openDoc(doc.id)}
                      onDelete={() => void removeDoc(doc.id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          ) : (
            <ul className="m-0 grid w-full list-none p-0" style={gridStyle}>
              {displayDocs.map(doc => (
                <StaticManualBook
                  key={doc.id}
                  doc={doc}
                  onOpen={() => openDoc(doc.id)}
                  onDelete={() => void removeDoc(doc.id)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
