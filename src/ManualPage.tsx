/**
 * Manual — 통합 매뉴얼·체크리스트·문서 (BlockNote + 탐색기 드래그앤드롭 + 첨부 파일)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/ariakit/style.css'
import { useCreateBlockNote, useEditorChange } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/ariakit'
import type { BlockNoteEditor, PartialBlock } from '@blocknote/core'
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
  BookOpen,
  FileText,
  GripVertical,
  Paperclip,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  supabase,
  uploadImageToMedia,
  fetchManualDocuments,
  insertManualDocument,
  updateManualDocument,
  deleteManualDocument,
  type ManualDocumentRow,
  type ManualAttachment,
} from './supabase'
const EMPTY_DOC: PartialBlock[] = [{ type: 'paragraph', content: '' }]

function guessMediaKind(file: File): 'image' | 'video' | 'audio' | 'file' {
  const t = (file.type || '').toLowerCase()
  if (t.startsWith('image/')) return 'image'
  if (t.startsWith('video/')) return 'video'
  if (t.startsWith('audio/')) return 'audio'
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext)) return 'image'
  if (['mp4', 'webm', 'ogg', 'ogv', 'mov', 'm4v', 'mkv', 'avi'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'aac', 'm4a', 'flac', 'oga'].includes(ext)) return 'audio'
  return 'file'
}

function fileToMediaBlock(file: File, url: string): PartialBlock {
  const name = file.name || '파일'
  const kind = guessMediaKind(file)
  if (kind === 'image') return { type: 'image', props: { url, name } }
  if (kind === 'video') return { type: 'video', props: { url, name, showPreview: true } }
  if (kind === 'audio') return { type: 'audio', props: { url, name, showPreview: true } }
  return { type: 'file', props: { url, name } }
}

function insertMediaBlocks(editor: BlockNoteEditor, blocks: PartialBlock[]) {
  if (blocks.length === 0) return
  const doc = editor.document
  let refId: string | undefined
  try {
    const pos = editor.getTextCursorPosition()
    if (pos?.block?.id) refId = pos.block.id
  } catch {
    /* no cursor */
  }
  if (!refId && doc.length > 0) refId = doc[doc.length - 1].id
  if (!refId) {
    editor.replaceBlocks(doc, blocks)
    return
  }
  editor.insertBlocks(blocks, refId, 'after')
}

function parseAttachments(raw: unknown): ManualAttachment[] {
  if (!Array.isArray(raw)) return []
  const out: ManualAttachment[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : ''
    const name = typeof o.name === 'string' ? o.name : '파일'
    const url = typeof o.url === 'string' ? o.url : ''
    if (!id || !url) continue
    out.push({
      id,
      name,
      url,
      size: typeof o.size === 'number' ? o.size : undefined,
      mime: typeof o.mime === 'string' ? o.mime : undefined,
    })
  }
  return out
}

function blocksFromDoc(doc: ManualDocumentRow): PartialBlock[] | undefined {
  const b = doc.blocks
  if (Array.isArray(b) && b.length > 0) return b as PartialBlock[]
  return EMPTY_DOC
}

function ManualDocEditor({
  doc,
  onPersistBlocks,
}: {
  doc: ManualDocumentRow
  onPersistBlocks: (blocksJson: string) => void
}) {
  const uploadFile = useCallback(async (file: File): Promise<string> => {
    try {
      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (session) return await uploadImageToMedia(file)
      }
    } catch (e) {
      console.warn('[Manual 업로드]', e)
    }
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => reject(new Error('파일 읽기 실패'))
      r.readAsDataURL(file)
    })
  }, [])

  const initialBlocks = useMemo(() => blocksFromDoc(doc), [doc.id])

  const editor = useCreateBlockNote({ initialContent: initialBlocks, uploadFile }, [doc.id])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runDebounced = useCallback((fn: () => void) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      fn()
    }, 450)
  }, [])

  useEditorChange(() => {
    if (!editor) return
    runDebounced(() => onPersistBlocks(JSON.stringify(editor.document)))
  }, editor)

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    [],
  )

  const [dropUploading, setDropUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      if (!editor) return
      setDragOver(false)
      const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.size > 0)
      if (files.length === 0) return
      e.preventDefault()
      e.stopPropagation()
      setDropUploading(true)
      try {
        const blocks: PartialBlock[] = []
        for (const file of files) {
          const url = await uploadFile(file)
          blocks.push(fileToMediaBlock(file, url))
        }
        insertMediaBlocks(editor, blocks)
      } catch (err) {
        console.error('[Manual 드롭]', err)
      } finally {
        setDropUploading(false)
      }
    },
    [editor, uploadFile],
  )

  return (
    <div
      className="bn-manual-editor relative rounded-xl border border-slate-200 bg-white overflow-hidden"
      data-color-scheme="light"
      onDragEnter={e => {
        if (e.dataTransfer?.types?.includes('Files')) {
          e.preventDefault()
          setDragOver(true)
        }
      }}
      onDragLeave={e => {
        const related = e.relatedTarget as Node | null
        if (!related || !e.currentTarget.contains(related)) setDragOver(false)
      }}
      onDragOver={e => {
        if (e.dataTransfer?.types?.includes('Files')) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }
      }}
      onDrop={handleDrop}
      style={{
        outline: dragOver ? '2px dashed rgba(99,102,241,0.55)' : undefined,
        outlineOffset: 2,
        background: dragOver ? 'rgba(99,102,241,0.04)' : undefined,
      }}
    >
      {dropUploading && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 pointer-events-none">
          <span
            className="inline-block w-3.5 h-3.5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin"
            style={{ animationDuration: '0.75s' }}
          />
          파일 넣는 중…
        </div>
      )}
      <div className="p-2 sm:p-3 [&_.bn-editor]:min-h-[320px]">
        <BlockNoteView editor={editor} theme="light" editable />
      </div>
      <style>{`
        .bn-manual-editor .bn-editor { font-size: 16px !important; line-height: 1.75 !important; }
        .bn-manual-editor img { max-width: 100% !important; border-radius: 8px !important; }
        .bn-manual-editor video { max-width: 100% !important; border-radius: 8px !important; }
        .bn-manual-editor audio { width: 100%; max-width: 560px; }
      `}</style>
    </div>
  )
}

function SortableManualRow({
  doc,
  selected,
  onSelect,
  onDelete,
}: {
  doc: ManualDocumentRow
  selected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: doc.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.88 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-stretch gap-0 rounded-xl border overflow-hidden transition-colors ${
        selected ? 'border-violet-400 bg-violet-50/80 shadow-sm' : 'border-slate-200 bg-white hover:border-violet-200'
      }`}
    >
      <button
        type="button"
        className="shrink-0 w-9 flex items-center justify-center text-slate-400 hover:bg-slate-50 cursor-grab active:cursor-grabbing border-r border-slate-100"
        aria-label="순서 변경"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 min-w-0 text-left px-3 py-2.5 flex items-center gap-2"
      >
        <BookOpen className="w-4 h-4 text-violet-600 shrink-0" />
        <span className="text-sm font-bold text-slate-900 truncate">{doc.title || '제목 없음'}</span>
      </button>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          onDelete()
        }}
        className="shrink-0 px-2 text-slate-400 hover:text-red-600 hover:bg-red-50"
        title="삭제"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

export function ManualPage() {
  const [docs, setDocs] = useState<ManualDocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const titleDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attachInputRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(() => docs.find(d => d.id === selectedId) ?? null, [docs, selectedId])

  const reload = useCallback(async () => {
    setLoading(true)
    const list = await fetchManualDocuments()
    setDocs(list)
    setLoading(false)
    return list
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(
    () => () => {
      if (titleDebounce.current) clearTimeout(titleDebounce.current)
    },
    [],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = docs.findIndex(d => d.id === active.id)
    const newIdx = docs.findIndex(d => d.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const nextOrder = arrayMove(docs, oldIdx, newIdx)
    setDocs(nextOrder)
    await Promise.all(
      nextOrder.map((d, i) => updateManualDocument(d.id, { sort_order: i })),
    )
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
    setSelectedId(row.id)
  }

  const removeDoc = async (id: string) => {
    if (!confirm('이 문서를 삭제할까요? 본문과 첨부 링크가 함께 제거됩니다.')) return
    const ok = await deleteManualDocument(id)
    if (!ok) {
      window.alert('삭제에 실패했습니다.')
      return
    }
    setDocs(prev => prev.filter(d => d.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const persistTitle = (id: string, title: string) => {
    const t = title.trim() || '제목 없음'
    setDocs(prev => prev.map(d => (d.id === id ? { ...d, title: t } : d)))
    void updateManualDocument(id, { title: t })
  }

  const scheduleTitle = (id: string, title: string) => {
    if (titleDebounce.current) clearTimeout(titleDebounce.current)
    titleDebounce.current = setTimeout(() => {
      titleDebounce.current = null
      persistTitle(id, title)
    }, 400)
  }

  const onPersistBlocks = useCallback((id: string, blocksJson: string) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(blocksJson)
    } catch {
      return
    }
    setDocs(prev => prev.map(d => (d.id === id ? { ...d, blocks: parsed } : d)))
    void updateManualDocument(id, { blocks: parsed })
  }, [])

  const attachments = selected ? parseAttachments(selected.attachments) : []

  const addAttachments = async (files: FileList | null) => {
    if (!selected || !files?.length) return
    const list = Array.from(files).filter(f => f.size > 0)
    if (list.length === 0) return
    const next: ManualAttachment[] = [...attachments]
    try {
      for (const file of list) {
        const url = await uploadImageToMedia(file)
        next.push({
          id: crypto.randomUUID(),
          name: file.name || '파일',
          url,
          size: file.size,
          mime: file.type || undefined,
        })
      }
      setDocs(prev =>
        prev.map(d => (d.id === selected.id ? { ...d, attachments: next } : d)),
      )
      await updateManualDocument(selected.id, { attachments: next })
    } catch (e) {
      console.error('[Manual 첨부]', e)
      window.alert('파일 업로드에 실패했습니다.')
    }
  }

  const removeAttachment = async (attId: string) => {
    if (!selected) return
    const next = attachments.filter(a => a.id !== attId)
    setDocs(prev => prev.map(d => (d.id === selected.id ? { ...d, attachments: next } : d)))
    await updateManualDocument(selected.id, { attachments: next })
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-8 pb-20">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-[10px] font-extrabold text-violet-600 tracking-[0.2em]">MANUAL</span>
          <h1 className="mt-2 text-3xl font-black text-slate-900 flex items-center gap-2">
            <FileText className="w-8 h-8 text-violet-500 shrink-0" />
            Manual
          </h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-2xl">
            매뉴얼·체크리스트·업무 문서를 한곳에서 관리합니다. 본문은 노션처럼 편집하고, 탐색기에서{' '}
            <strong className="text-violet-700">사진·동영상·파일을 드래그</strong>해 넣거나 아래에서 문서를 첨부할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={addDoc}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 text-white px-4 py-2.5 text-sm font-bold shadow-lg shadow-violet-500/25 hover:bg-violet-700"
        >
          <Plus className="w-4 h-4" />
          새 문서
        </button>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 min-h-[520px]">
        <aside className="w-full lg:w-[280px] shrink-0 flex flex-col gap-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide m-0">문서 목록</p>
          {loading ? (
            <p className="text-sm text-slate-500">불러오는 중…</p>
          ) : docs.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 py-10 text-center text-sm text-slate-600">
              문서가 없습니다. &quot;새 문서&quot;로 추가해 보세요.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={docs.map(d => d.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-2 list-none p-0 m-0 max-h-[60vh] overflow-y-auto">
                  {docs.map(doc => (
                    <li key={doc.id}>
                      <SortableManualRow
                        doc={doc}
                        selected={selectedId === doc.id}
                        onSelect={() => setSelectedId(doc.id)}
                        onDelete={() => removeDoc(doc.id)}
                      />
                    </li>
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </aside>

        <main className="flex-1 min-w-0 flex flex-col gap-4">
          {!selected ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-24 text-center text-slate-500">
              왼쪽에서 문서를 선택하거나 &quot;새 문서&quot;를 만드세요.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <label className="sr-only" htmlFor="manual-title">
                  제목
                </label>
                <input
                  id="manual-title"
                  value={selected.title}
                  onChange={e => {
                    const v = e.target.value
                    setDocs(prev => prev.map(d => (d.id === selected.id ? { ...d, title: v } : d)))
                    scheduleTitle(selected.id, v)
                  }}
                  className="flex-1 min-w-[200px] text-xl font-black text-slate-900 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  placeholder="문서 제목"
                />
              </div>

              <ManualDocEditor doc={selected} onPersistBlocks={json => onPersistBlocks(selected.id, json)} />

              <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h2 className="text-sm font-bold text-slate-800 m-0 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-violet-600" />
                    첨부 파일
                  </h2>
                  <div className="flex items-center gap-2">
                    <input
                      ref={attachInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={e => {
                        void addAttachments(e.target.files)
                        e.target.value = ''
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => attachInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      파일 추가
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 m-0 mb-3">
                  PDF·압축·기타 문서는 여기에 올리면 다운로드 링크로 보관됩니다. 본문에 바로 넣으려면 에디터 안으로 드래그하세요.
                </p>
                {attachments.length === 0 ? (
                  <p className="text-xs text-slate-400 m-0">첨부된 파일이 없습니다.</p>
                ) : (
                  <ul className="space-y-2 list-none p-0 m-0">
                    {attachments.map(a => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-violet-700 hover:underline truncate min-w-0"
                        >
                          {a.name}
                        </a>
                        <button
                          type="button"
                          onClick={() => void removeAttachment(a.id)}
                          className="shrink-0 text-xs font-bold text-red-500 hover:text-red-700"
                        >
                          제거
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
