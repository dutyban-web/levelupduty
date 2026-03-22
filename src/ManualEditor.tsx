/**
 * BlockNote 기반 Manual 본문 에디터 (슬래시 메뉴·탐색기 파일 드래그 앤 드롭)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/ariakit/style.css'
import { useCreateBlockNote, useEditorChange } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/ariakit'
import type { BlockNoteEditor, PartialBlock } from '@blocknote/core'
import { supabase, uploadImageToMedia, type ManualAttachment, type ManualDocumentRow } from './supabase'

export const EMPTY_DOC: PartialBlock[] = [{ type: 'paragraph', content: '' }]

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

export function parseAttachments(raw: unknown): ManualAttachment[] {
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

export function blocksFromDoc(doc: ManualDocumentRow): PartialBlock[] | undefined {
  const b = doc.blocks
  if (Array.isArray(b) && b.length > 0) return b as PartialBlock[]
  return EMPTY_DOC
}

export function ManualDocEditor({
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
