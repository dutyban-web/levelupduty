/**
 * 인간관계론 — 전역 매뉴얼 (아코디언 · CRUD · 드래그 정렬 · BlockNote 본문)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/ariakit/style.css'
import { useCreateBlockNote, useEditorChange } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/ariakit'
import type { PartialBlock } from '@blocknote/core'
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
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  Briefcase,
  ChevronDown,
  Gift,
  GripVertical,
  Handshake,
  Heart,
  MessageCircle,
  Pencil,
  Plus,
  Scale,
  Shield,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react'
import { supabase, uploadImageToMedia } from './supabase'
import {
  type PlaybookItem,
  type PlaybookStore,
  loadPlaybookStore,
  savePlaybookStore,
  upsertPlaybookItem,
  deletePlaybookItem,
  reorderPlaybookItems,
  newPlaybookId,
} from './humanRelationsPlaybookData'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'book-open': BookOpen,
  heart: Heart,
  handshake: Handshake,
  scale: Scale,
  users: Users,
  sparkles: Sparkles,
  shield: Shield,
  message: MessageCircle,
  gift: Gift,
  briefcase: Briefcase,
}

export const PLAYBOOK_ICON_OPTIONS: { key: string; label: string }[] = [
  { key: 'book-open', label: '책' },
  { key: 'heart', label: '마음' },
  { key: 'handshake', label: '악수' },
  { key: 'scale', label: '균형' },
  { key: 'users', label: '사람들' },
  { key: 'sparkles', label: '반짝' },
  { key: 'shield', label: '수호' },
  { key: 'message', label: '대화' },
  { key: 'gift', label: '선물' },
  { key: 'briefcase', label: '업무' },
]

function PlaybookIcon({ name, className }: { name: string; className?: string }) {
  const C = ICON_MAP[name] ?? BookOpen
  return <C className={className} />
}

const EMPTY_DOC: PartialBlock[] = [{ type: 'paragraph', content: '' }]

function PlaybookDescriptionEditor({
  itemId,
  blocksJson,
  onPersist,
}: {
  itemId: string
  blocksJson: string
  onPersist: (json: string) => void
}) {
  const uploadFile = useCallback(async (file: File): Promise<string> => {
    try {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) return await uploadImageToMedia(file)
      }
    } catch (e) {
      console.warn('[Playbook 업로드]', e)
    }
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => reject(new Error('read fail'))
      r.readAsDataURL(file)
    })
  }, [])

  const initialBlocks = useMemo((): PartialBlock[] | undefined => {
    const raw = blocksJson?.trim()
    if (raw) {
      try {
        const p = JSON.parse(raw) as unknown
        if (Array.isArray(p) && p.length > 0) return p as PartialBlock[]
      } catch { /* */ }
    }
    return EMPTY_DOC
  }, [itemId, blocksJson])

  const editor = useCreateBlockNote({ initialContent: initialBlocks, uploadFile }, [itemId])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runDebounced = useCallback((fn: () => void) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      fn()
    }, 400)
  }, [])

  useEditorChange(() => {
    if (!editor) return
    runDebounced(() => onPersist(JSON.stringify(editor.document)))
  }, editor)

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  return (
    <div className="p-2 sm:p-3 [&_.bn-editor]:min-h-[180px] border-t border-slate-100 bg-white">
      <BlockNoteView editor={editor} theme="light" editable />
    </div>
  )
}

function SortablePlaybookRow({
  item,
  expanded,
  onToggle,
  onDelete,
  onUpdateTitle,
  onUpdateIcon,
  onPersistDescription,
  editingTitle,
  setEditingTitle,
}: {
  item: PlaybookItem
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
  onUpdateTitle: (t: string) => void
  onUpdateIcon: (k: string) => void
  onPersistDescription: (json: string) => void
  editingTitle: boolean
  setEditingTitle: (v: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden"
    >
      <div className="flex items-stretch gap-0">
        <button
          type="button"
          className="shrink-0 w-10 flex items-center justify-center text-slate-400 hover:bg-slate-50 cursor-grab active:cursor-grabbing border-r border-slate-100"
          aria-label="순서 변경"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 px-3 py-3">
            <PlaybookIcon name={item.iconKey} className="w-5 h-5 text-indigo-600 shrink-0" />
            <select
              value={item.iconKey}
              onChange={e => onUpdateIcon(e.target.value)}
              onClick={e => e.stopPropagation()}
              className="text-[11px] border border-slate-200 rounded-lg px-1 py-0.5 bg-slate-50 max-w-[100px]"
              title="아이콘"
            >
              {PLAYBOOK_ICON_OPTIONS.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
            {editingTitle ? (
              <input
                autoFocus
                value={item.title}
                onChange={e => onUpdateTitle(e.target.value)}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={e => {
                  if (e.key === 'Enter') setEditingTitle(false)
                }}
                className="flex-1 min-w-0 text-sm font-bold border border-indigo-200 rounded-lg px-2 py-1"
              />
            ) : (
              <button
                type="button"
                onClick={onToggle}
                className="flex-1 min-w-0 text-left flex items-center gap-2"
              >
                <span className="text-sm font-bold text-slate-900 truncate">{item.title}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                setEditingTitle(true)
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
              title="제목 수정"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                onDelete()
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
              title="삭제"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <PlaybookDescriptionEditor
                  itemId={item.id}
                  blocksJson={item.descriptionBlocksJson}
                  onPersist={onPersistDescription}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

type PlaybookVariant = 'full' | 'embedded'
/** embedded: 상위 카드에 제목이 있을 때 본문·추가 버튼만 표시 */
export function HumanRelationsPlaybook({ variant = 'full' }: { variant?: PlaybookVariant }) {
  const embedded = variant === 'embedded'
  const [store, setStore] = useState<PlaybookStore>(() => {
    try {
      return loadPlaybookStore()
    } catch (e) {
      console.warn('[HumanRelationsPlaybook] loadPlaybookStore failed', e)
      return { items: [] }
    }
  })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)

  const persist = useCallback((updater: (prev: PlaybookStore) => PlaybookStore) => {
    setStore(prev => {
      const next = updater(prev)
      savePlaybookStore(next)
      return next
    })
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    persist(prev => {
      const oldIdx = prev.items.findIndex(i => i.id === active.id)
      const newIdx = prev.items.findIndex(i => i.id === over.id)
      if (oldIdx < 0 || newIdx < 0) return prev
      const ordered = arrayMove(prev.items.map(i => i.id), oldIdx, newIdx)
      return reorderPlaybookItems(prev, ordered)
    })
  }

  const addItem = () => {
    const id = newPlaybookId()
    const t = new Date().toISOString()
    const defaultJson = JSON.stringify(EMPTY_DOC)
    const row: PlaybookItem = {
      id,
      title: '새 매뉴얼',
      iconKey: 'book-open',
      descriptionBlocksJson: defaultJson,
      createdAt: t,
      updatedAt: t,
    }
    persist(prev => ({ items: [row, ...prev.items] }))
    setExpandedId(id)
    setEditingTitleId(id)
  }

  const updateItem = (id: string, patch: Partial<PlaybookItem>) => {
    persist(prev => {
      const cur = prev.items.find(i => i.id === id)
      if (!cur) return prev
      return upsertPlaybookItem(prev, { ...cur, ...patch, id, title: patch.title ?? cur.title })
    })
  }

  const removeItem = (id: string) => {
    if (!confirm('이 매뉴얼을 삭제할까요?')) return
    persist(prev => deletePlaybookItem(prev, id))
    if (expandedId === id) setExpandedId(null)
    if (editingTitleId === id) setEditingTitleId(null)
  }

  return (
    <div className="space-y-4">
      <div className={`flex flex-wrap items-start justify-between gap-3 ${embedded ? 'justify-end' : ''}`}>
        {!embedded && (
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight m-0">인간관계론</h3>
            <p className="text-xs text-slate-500 mt-1 m-0 max-w-xl leading-relaxed">
              경조사·선물·메시지 등 <strong className="text-indigo-700">나만의 대인관계 원칙</strong>을 누적합니다. 모든 연락처에 공통으로 적용되는 매뉴얼입니다.
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 text-white px-4 py-2.5 text-sm font-bold shadow-md shadow-indigo-500/25 hover:bg-indigo-700 shrink-0"
        >
          <Plus className="w-4 h-4" />
          매뉴얼 추가
        </button>
      </div>

      {store.items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 py-14 text-center text-sm text-slate-500">
          아직 매뉴얼이 없습니다. 상단 버튼으로 첫 원칙을 추가해 보세요.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={store.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-3 list-none p-0 m-0">
              {store.items.map(item => (
                <li key={item.id}>
                  <SortablePlaybookRow
                    item={item}
                    expanded={expandedId === item.id}
                    onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    onDelete={() => removeItem(item.id)}
                    onUpdateTitle={title => updateItem(item.id, { title })}
                    onUpdateIcon={iconKey => updateItem(item.id, { iconKey })}
                    onPersistDescription={json => updateItem(item.id, { descriptionBlocksJson: json })}
                    editingTitle={editingTitleId === item.id}
                    setEditingTitle={v => setEditingTitleId(v ? item.id : null)}
                  />
                </li>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
