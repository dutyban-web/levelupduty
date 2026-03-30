/**
 * Quest 화면용 — 행동 자산(Value) 참조 패널 + 퀘스트 연결
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type SyntheticEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
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
import {
  loadValueActionStore,
  loadQuestValueLinks,
  setQuestValueLink,
  computeHourlyRateKrw,
  uniqueIdentities,
  type ValueActionStore,
} from './valueActionData'
import {
  Calendar,
  CheckCircle2,
  Gem,
  ChevronRight,
  GripVertical,
  Link2,
  ListTodo,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'

export type QuestRef = { id: string; name: string }

const QUEST_CHECKLIST_KEY = 'quest_sidebar_checklist_v1'

type ChecklistFilter = 'all' | 'pending' | 'done'

type QuickCheckItem = { id: string; text: string; done: boolean; entry_date: string }

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

function newChecklistId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `qcl-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function normalizeOrder(items: QuickCheckItem[]): QuickCheckItem[] {
  const pending = items.filter(i => !i.done)
  const done = items.filter(i => i.done)
  return [...pending, ...done]
}

function loadQuickChecklist(): QuickCheckItem[] {
  try {
    const raw = localStorage.getItem(QUEST_CHECKLIST_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const t = todayYmd()
    const mapped = parsed
      .filter((x): x is Record<string, unknown> => x != null && typeof x === 'object')
      .map((x, i) => {
        const ed = x.entry_date
        const entryDate =
          typeof ed === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ed) ? ed : t
        return {
          id: typeof x.id === 'string' && x.id ? x.id : `legacy-${i}-${newChecklistId()}`,
          text: String(x.text ?? ''),
          done: Boolean(x.done),
          entry_date: entryDate,
        }
      })
    return normalizeOrder(mapped)
  } catch {
    return []
  }
}

function saveQuickChecklist(items: QuickCheckItem[]) {
  try {
    localStorage.setItem(QUEST_CHECKLIST_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}

function stopDnD(e: SyntheticEvent) {
  e.stopPropagation()
}

function SortableCheckRow({
  row,
  showDates,
  onToggle,
  onRemove,
  onText,
  onDate,
}: {
  row: QuickCheckItem
  showDates: boolean
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  onText: (id: string, text: string) => void
  onDate: (id: string, date: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.88 : 1,
    zIndex: isDragging ? 10 : undefined,
  } as CSSProperties

  const dateInp =
    'shrink-0 rounded-md border px-1 py-0.5 text-[10px] leading-tight min-w-[6.5rem] max-w-[7.5rem] ' +
    (row.done
      ? 'border-slate-500 bg-slate-600 text-slate-200 [color-scheme:dark]'
      : 'border-violet-200 bg-white text-slate-800')

  const shortDate = (() => {
    const [, m, d] = row.entry_date.slice(0, 10).split('-')
    if (!m || !d) return row.entry_date
    return `${Number(m)}/${Number(d)}`
  })()

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-1.5 rounded-xl px-1.5 py-1.5 transition-colors ${
        row.done
          ? 'border border-slate-600/90 bg-slate-700 shadow-inner'
          : 'border border-violet-100 bg-white shadow-sm ring-1 ring-violet-100/80'
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className={`touch-none mt-0.5 flex h-7 w-6 shrink-0 cursor-grab touch-manipulation items-center justify-center rounded-md active:cursor-grabbing ${
          row.done ? 'text-slate-400 hover:bg-slate-600' : 'text-slate-400 hover:bg-violet-50'
        }`}
        title="끌어서 순서 변경"
        aria-label="순서 변경"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      {showDates ? (
        <input
          type="date"
          value={row.entry_date.slice(0, 10)}
          onChange={e => onDate(row.id, e.target.value)}
          onPointerDown={stopDnD}
          onClick={stopDnD}
          className={dateInp}
          title="날짜"
          aria-label="날짜"
        />
      ) : (
        <span
          className={`mt-1 shrink-0 min-w-[2.25rem] text-center text-[9px] font-bold tabular-nums ${
            row.done ? 'text-slate-500' : 'text-violet-600/90'
          }`}
          title={`날짜 ${row.entry_date.slice(0, 10)} — 상단에서 날짜 입력을 펼치면 수정`}
        >
          {shortDate}
        </span>
      )}
      <input
        type="checkbox"
        checked={row.done}
        onChange={() => onToggle(row.id)}
        onPointerDown={stopDnD}
        onClick={stopDnD}
        className={`mt-1 h-4 w-4 shrink-0 cursor-pointer rounded focus:ring-2 focus:ring-offset-0 ${
          row.done
            ? 'border-slate-500 accent-emerald-400 focus:ring-emerald-400/40'
            : 'border-violet-300 accent-violet-600 focus:ring-violet-300'
        }`}
        aria-label="완료"
      />
      <input
        type="text"
        value={row.text}
        onChange={e => onText(row.id, e.target.value)}
        onPointerDown={stopDnD}
        onClick={stopDnD}
        placeholder="할 일"
        className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-[11px] outline-none focus:ring-0 ${
          row.done
            ? 'text-slate-400 line-through decoration-2 decoration-slate-500 placeholder:text-slate-500'
            : 'font-semibold text-slate-900 placeholder:text-slate-400'
        }`}
      />
      {!row.done ? (
        <button
          type="button"
          onClick={() => onToggle(row.id)}
          onPointerDown={stopDnD}
          className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-800 hover:bg-emerald-100"
          title="완료 처리"
        >
          <CheckCircle2 className="h-3 w-3" />
          완료
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onToggle(row.id)}
          onPointerDown={stopDnD}
          className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 rounded-md border border-slate-500 bg-slate-600 px-1.5 py-0.5 text-[9px] font-bold text-slate-200 hover:bg-slate-500"
          title="진행 중으로 되돌리기"
        >
          <RotateCcw className="h-3 w-3" />
          취소
        </button>
      )}
      <button
        type="button"
        onClick={() => onRemove(row.id)}
        onPointerDown={stopDnD}
        className={`mt-0.5 shrink-0 rounded p-0.5 ${
          row.done
            ? 'text-slate-500 hover:bg-slate-600 hover:text-red-300'
            : 'text-slate-400 hover:bg-red-50 hover:text-red-600'
        }`}
        title="삭제"
        aria-label="삭제"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </li>
  )
}

function ChecklistBlock({
  title,
  list,
  showDates,
  onDragEnd,
  onToggle,
  onRemove,
  onText,
  onDate,
}: {
  title?: string
  list: QuickCheckItem[]
  showDates: boolean
  onDragEnd: (e: DragEndEvent) => void
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  onText: (id: string, text: string) => void
  onDate: (id: string, date: string) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  if (list.length === 0) return null
  return (
    <div className="space-y-1">
      {title && (
        <p className="m-0 px-1 text-[9px] font-extrabold uppercase tracking-wider text-slate-400">{title}</p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={list.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <ul className="m-0 list-none space-y-1.5 p-0">
            {list.map(row => (
              <SortableCheckRow
                key={row.id}
                row={row}
                showDates={showDates}
                onToggle={onToggle}
                onRemove={onRemove}
                onText={onText}
                onDate={onDate}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  )
}

/** Quest 우측 패널 상단 — 체크리스트 (로컬 저장, 드래그 정렬, 날짜, 완료 하단·필터) */
function QuestQuickChecklist() {
  const [items, setItems] = useState<QuickCheckItem[]>(loadQuickChecklist)
  const [filterMode, setFilterMode] = useState<ChecklistFilter>('all')
  /** false면 날짜는 M/D 짧게만 표시, true면 date 입력 필드 */
  const [showDates, setShowDates] = useState(false)

  useEffect(() => {
    saveQuickChecklist(items)
  }, [items])

  const pending = useMemo(() => items.filter(i => !i.done), [items])
  const done = useMemo(() => items.filter(i => i.done), [items])

  const add = () => {
    const row: QuickCheckItem = { id: newChecklistId(), text: '', done: false, entry_date: todayYmd() }
    setItems(prev => normalizeOrder([...prev.filter(i => !i.done), row, ...prev.filter(i => i.done)]))
  }

  const remove = (id: string) => {
    setItems(prev => prev.filter(x => x.id !== id))
  }

  const toggle = (id: string) => {
    setItems(prev => {
      const i = prev.findIndex(x => x.id === id)
      if (i < 0) return prev
      const copy = [...prev]
      const [it] = copy.splice(i, 1)
      it.done = !it.done
      if (it.done) copy.push(it)
      else {
        const fd = copy.findIndex(x => x.done)
        if (fd === -1) copy.push(it)
        else copy.splice(fd, 0, it)
      }
      return copy
    })
  }

  const setText = (id: string, text: string) => {
    setItems(prev => prev.map(x => (x.id === id ? { ...x, text } : x)))
  }

  const setDate = (id: string, entry_date: string) => {
    const d = entry_date.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return
    setItems(prev => prev.map(x => (x.id === id ? { ...x, entry_date: d } : x)))
  }

  const reorderPending = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const np = [...pending]
    const oi = np.findIndex(x => x.id === String(active.id))
    const ni = np.findIndex(x => x.id === String(over.id))
    if (oi < 0 || ni < 0) return
    const moved = arrayMove(np, oi, ni)
    setItems([...moved, ...done])
  }

  const reorderDone = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const nd = [...done]
    const oi = nd.findIndex(x => x.id === String(active.id))
    const ni = nd.findIndex(x => x.id === String(over.id))
    if (oi < 0 || ni < 0) return
    const moved = arrayMove(nd, oi, ni)
    setItems([...pending, ...moved])
  }

  const emptyMessage =
    filterMode === 'done'
      ? '완료된 항목이 없습니다.'
      : filterMode === 'pending'
        ? '진행 중인 항목이 없습니다.'
        : '항목을 추가해 두고 퀘스트 전에 가볍게 체크해 보세요.'

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/90 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-black text-slate-700">체크리스트</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowDates(v => !v)}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-slate-600 transition-colors ${
              showDates
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
            title={showDates ? '날짜 입력 접기' : '날짜 입력 펼치기'}
            aria-label={showDates ? '날짜 입력 접기' : '날짜 입력 펼치기'}
            aria-pressed={showDates}
          >
            <Calendar className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setFilterMode(m => (m === 'pending' ? 'all' : 'pending'))}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-slate-600 transition-colors ${
              filterMode === 'pending'
                ? 'border-violet-300 bg-violet-100 text-violet-800'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
            title="진행 중만 보기"
            aria-label="진행 중만 보기"
            aria-pressed={filterMode === 'pending'}
          >
            <ListTodo className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setFilterMode(m => (m === 'done' ? 'all' : 'done'))}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-slate-600 transition-colors ${
              filterMode === 'done'
                ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
            title="완료만 보기"
            aria-label="완료만 보기"
            aria-pressed={filterMode === 'done'}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50"
          >
            <Plus className="w-3 h-3" />
            추가
          </button>
        </div>
      </div>
      <div className="p-2 space-y-3">
        {items.length === 0 ? (
          <p className="m-0 text-[10px] text-slate-400 text-center py-3 px-2">{emptyMessage}</p>
        ) : filterMode === 'all' ? (
          <>
            {pending.length > 0 && (
              <ChecklistBlock
                list={pending}
                showDates={showDates}
                onDragEnd={reorderPending}
                onToggle={toggle}
                onRemove={remove}
                onText={setText}
                onDate={setDate}
              />
            )}
            {pending.length > 0 && done.length > 0 && (
              <div className="border-t border-slate-100 pt-2" role="separator" aria-hidden />
            )}
            {done.length > 0 && (
              <ChecklistBlock
                title="완료"
                list={done}
                showDates={showDates}
                onDragEnd={reorderDone}
                onToggle={toggle}
                onRemove={remove}
                onText={setText}
                onDate={setDate}
              />
            )}
          </>
        ) : filterMode === 'pending' ? (
          pending.length === 0 ? (
            <p className="m-0 text-[10px] text-slate-400 text-center py-3 px-2">{emptyMessage}</p>
          ) : (
            <ChecklistBlock
              list={pending}
              showDates={showDates}
              onDragEnd={reorderPending}
              onToggle={toggle}
              onRemove={remove}
              onText={setText}
              onDate={setDate}
            />
          )
        ) : done.length === 0 ? (
          <p className="m-0 text-[10px] text-slate-400 text-center py-3 px-2">{emptyMessage}</p>
        ) : (
          <ChecklistBlock
            list={done}
            showDates={showDates}
            onDragEnd={reorderDone}
            onToggle={toggle}
            onRemove={remove}
            onText={setText}
            onDate={setDate}
          />
        )}
      </div>
    </div>
  )
}

type Props = {
  quests: QuestRef[]
  /** 모달 모드일 때 닫기 */
  onClose?: () => void
}

export function ValueReferencePanel({ quests, onClose }: Props) {
  const [store, setStore] = useState<ValueActionStore>(() => loadValueActionStore())
  const [links, setLinks] = useState(() => loadQuestValueLinks())
  const [identityFilter, setIdentityFilter] = useState('')
  const [linkQuestId, setLinkQuestId] = useState('')
  const [linkValueId, setLinkValueId] = useState('')

  const refresh = useCallback(() => {
    setStore(loadValueActionStore())
    setLinks(loadQuestValueLinks())
  }, [])

  const identities = useMemo(() => uniqueIdentities(store.items), [store.items])

  const filtered = useMemo(() => {
    let list = store.items
    if (identityFilter.trim()) list = list.filter(i => i.identity.trim() === identityFilter.trim())
    return [...list].sort((a, b) => a.actionName.localeCompare(b.actionName, 'ko'))
  }, [store.items, identityFilter])

  const saveLink = () => {
    if (!linkQuestId || !linkValueId) return
    setQuestValueLink(linkQuestId, linkValueId)
    refresh()
    setLinkQuestId('')
    setLinkValueId('')
  }

  const clearLink = (questId: string) => {
    setQuestValueLink(questId, null)
    refresh()
  }

  return (
    <div className="space-y-3">
      <QuestQuickChecklist />
      <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-b from-white to-violet-50/40 shadow-md overflow-hidden">
      <div className="px-3 py-2.5 border-b border-violet-100 flex items-center justify-between gap-2 bg-violet-50/80">
        <div className="flex items-center gap-2 min-w-0">
          <Gem className="w-4 h-4 text-violet-600 shrink-0" />
          <span className="text-[11px] font-black text-violet-900 truncate">행동 자산 표준</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link
            to="/value"
            className="text-[10px] font-bold text-violet-600 hover:underline flex items-center gap-0.5"
          >
            편집
            <ChevronRight className="w-3 h-3" />
          </Link>
          {onClose && (
            <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-violet-100 text-slate-500 md:hidden" aria-label="닫기">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-3 space-y-3 max-h-[min(70vh,560px)] overflow-y-auto">
        <p className="text-[10px] text-slate-500 leading-snug m-0">
          퀘스트 설계 시 표준 시간·단가·전략 가치를 바로 확인하세요. 완료 시 누적 합산을 위해 아래에서 퀘스트와 연결할 수 있습니다.
        </p>

        <div>
          <label className="text-[9px] font-bold text-slate-400 uppercase">정체성</label>
          <select
            value={identityFilter}
            onChange={e => setIdentityFilter(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-800"
          >
            <option value="">전체</option>
            {identities.map(id => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>

        <ul className="space-y-2 list-none m-0 p-0">
          {filtered.length === 0 ? (
            <li className="text-[11px] text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-xl">
              등록된 행동이 없습니다.{' '}
              <Link to="/value" className="text-violet-600 font-bold underline">
                Value
              </Link>
              에서 추가하세요.
            </li>
          ) : (
            filtered.map(row => {
              const hr = computeHourlyRateKrw(row.standardTimeMinutes, row.economicValueKrw)
              return (
                <li key={row.id} className="rounded-xl border border-slate-100 bg-white/90 px-2.5 py-2 text-[11px] shadow-sm">
                  <p className="font-bold text-slate-900 m-0 leading-tight">{row.actionName}</p>
                  {row.identity && <p className="text-slate-500 m-0 mt-0.5 truncate">{row.identity}</p>}
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 text-[10px] text-slate-600">
                    <span>{Math.round(row.standardTimeMinutes / 60 * 10) / 10}h 기준</span>
                    <span className="text-violet-700 font-bold">{hr != null ? `${hr.toLocaleString()}원/h` : '—'}</span>
                    <span className="text-slate-400">인지L{row.cognitiveDensity}</span>
                    <span className="text-slate-400">
                      전략{row.strategicValue === 'high' ? '상' : row.strategicValue === 'mid' ? '중' : '하'}
                    </span>
                  </div>
                </li>
              )
            })
          )}
        </ul>

        <div className="border-t border-violet-100 pt-3 space-y-2">
          <div className="flex items-center gap-1 text-[10px] font-black text-violet-800 uppercase tracking-wide">
            <Link2 className="w-3.5 h-3.5" />
            퀘스트 ↔ 행동 연결
          </div>
          <select
            value={linkQuestId}
            onChange={e => setLinkQuestId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px]"
          >
            <option value="">퀘스트 선택</option>
            {quests.map(q => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
          <select
            value={linkValueId}
            onChange={e => setLinkValueId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px]"
          >
            <option value="">행동 자산 선택</option>
            {store.items.map(v => (
              <option key={v.id} value={v.id}>
                {v.actionName}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={saveLink}
            disabled={!linkQuestId || !linkValueId}
            className="w-full py-2 rounded-lg bg-violet-600 text-white text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            연결 저장
          </button>

          {Object.keys(links).length > 0 && (
            <ul className="list-none m-0 p-0 space-y-1">
              {Object.entries(links).map(([qid, vid]) => {
                const qn = quests.find(q => q.id === qid)?.name ?? qid
                const va = store.items.find(v => v.id === vid)
                return (
                  <li key={qid} className="flex items-start justify-between gap-1 text-[10px] text-slate-600 bg-slate-50 rounded-lg px-2 py-1">
                    <span className="min-w-0">
                      <span className="font-bold text-slate-800">{qn}</span>
                      <span className="text-slate-400"> → </span>
                      {va?.actionName ?? vid}
                    </span>
                    <button type="button" onClick={() => clearLink(qid)} className="text-red-500 font-bold shrink-0">
                      해제
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}

/** 모바일: 우하단 FAB + 전체화면 시트 */
export function ValueReferenceMobileFab({ quests }: { quests: QuestRef[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[76px] right-4 z-[400] w-12 h-12 rounded-full bg-violet-600 text-white shadow-lg shadow-violet-500/40 flex items-center justify-center md:hidden border border-white/20"
        title="행동 자산 참조"
        aria-label="행동 자산 참조 열기"
      >
        <Gem className="w-5 h-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[450] md:hidden flex flex-col bg-black/50" role="dialog">
          <div className="mt-auto max-h-[85vh] overflow-hidden rounded-t-2xl bg-white shadow-2xl flex flex-col">
            <ValueReferencePanel quests={quests} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
