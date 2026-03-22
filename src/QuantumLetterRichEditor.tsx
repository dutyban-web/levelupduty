/**
 * 시공편지 본문 — BlockNote (슬래시 메뉴·탐색기에서 이미지·동영상 등 드래그 앤 드롭)
 * 본문은 JSON 배열 문자열로 저장하며, 기존 순수 텍스트는 단락 블록으로 승격합니다.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/ariakit/style.css'
import { useCreateBlockNote, useEditorChange } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/ariakit'
import type { BlockNoteEditor, PartialBlock } from '@blocknote/core'
import { supabase, uploadImageToMedia } from './supabase'

const EMPTY: PartialBlock[] = [{ type: 'paragraph', content: '' }]

function parseBodyToBlocks(body: string): PartialBlock[] {
  if (!body?.trim()) return EMPTY
  const t = body.trim()
  if (t.startsWith('[')) {
    try {
      const parsed = JSON.parse(t) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as PartialBlock[]
    } catch {
      /* fall through */
    }
  }
  return [{ type: 'paragraph', content: t }]
}

function guessMediaKind(file: File): 'image' | 'video' | 'audio' | 'file' {
  const ty = (file.type || '').toLowerCase()
  if (ty.startsWith('image/')) return 'image'
  if (ty.startsWith('video/')) return 'video'
  if (ty.startsWith('audio/')) return 'audio'
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

/** light: 밝은 노트 톤 · dark: 시공편지 페이지 보라·남색 톤과 통일 */
export function QuantumLetterRichEditor({
  body,
  onChange,
  readOnly,
  editorKey,
  minEditorHeight = 320,
  variant = 'dark',
}: {
  body: string
  onChange: (serialized: string) => void
  readOnly?: boolean
  /** 편지 id + 모드 등 — 바뀌면 에디터 재생성 */
  editorKey: string
  minEditorHeight?: number
  variant?: 'light' | 'dark'
}) {
  const initialBlocks = useMemo(() => parseBodyToBlocks(body), [editorKey])

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    try {
      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (session) return await uploadImageToMedia(file)
      }
    } catch (e) {
      console.warn('[시공편지 업로드]', e)
    }
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => reject(new Error('파일 읽기 실패'))
      r.readAsDataURL(file)
    })
  }, [])

  const editor = useCreateBlockNote(
    { initialContent: initialBlocks, uploadFile: readOnly ? undefined : uploadFile },
    [editorKey],
  )

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runDebounced = useCallback((fn: () => void) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      fn()
    }, 450)
  }, [])

  useEditorChange(() => {
    if (!editor || readOnly) return
    runDebounced(() => onChange(JSON.stringify(editor.document)))
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
    async (e: DragEvent) => {
      if (!editor || readOnly) return
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
        console.error('[시공편지 드롭]', err)
      } finally {
        setDropUploading(false)
      }
    },
    [editor, readOnly, uploadFile],
  )

  const onDragOver = useCallback((e: DragEvent) => {
    if (readOnly) return
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [readOnly])

  const isDark = variant === 'dark'
  const shellClass = isDark
    ? 'quantum-letter-bn quantum-letter-bn--dark relative overflow-hidden rounded-xl border border-violet-500/25 bg-[#14121f]'
    : 'quantum-letter-bn quantum-letter-bn--light relative overflow-hidden rounded-xl border border-amber-200/80 bg-white'

  return (
    <div
      className={shellClass}
      data-color-scheme={isDark ? 'dark' : 'light'}
      onDragEnter={e => {
        if (readOnly) return
        if (e.dataTransfer?.types?.includes('Files')) {
          e.preventDefault()
          setDragOver(true)
        }
      }}
      onDragLeave={e => {
        const related = e.relatedTarget as Node | null
        if (!related || !e.currentTarget.contains(related)) setDragOver(false)
      }}
      onDragOver={onDragOver}
      onDrop={handleDrop}
      style={{
        outline: dropUploading
          ? undefined
          : dragOver
            ? isDark
              ? '2px dashed rgba(103, 232, 249, 0.45)'
              : '2px dashed rgba(180, 83, 9, 0.45)'
            : undefined,
        outlineOffset: 2,
        background: dragOver
          ? isDark
            ? 'rgba(56, 189, 248, 0.08)'
            : 'rgba(254, 243, 199, 0.35)'
          : undefined,
        minHeight: minEditorHeight,
      }}
    >
      {dropUploading && (
        <div
          className={
            isDark
              ? 'absolute right-3 top-3 z-20 flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-slate-950/90 px-3 py-1.5 text-xs font-bold text-cyan-100 pointer-events-none'
              : 'absolute right-3 top-3 z-20 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 pointer-events-none'
          }
        >
          <span
            className={
              isDark
                ? 'inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent'
                : 'inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-700 border-t-transparent'
            }
            style={{ animationDuration: '0.75s' }}
          />
          파일 넣는 중…
        </div>
      )}
      <div className="p-2 sm:p-3" style={{ minHeight: minEditorHeight }}>
        <BlockNoteView editor={editor} theme={isDark ? 'dark' : 'light'} editable={!readOnly} />
      </div>
      <style>{`
        .quantum-letter-bn--dark .bn-editor {
          min-height: ${minEditorHeight}px !important;
          font-size: 16px !important;
          line-height: 1.8 !important;
          color: #e2e8f0 !important;
          background: transparent !important;
        }
        .quantum-letter-bn--light .bn-editor {
          min-height: ${minEditorHeight}px !important;
          font-size: 16px !important;
          line-height: 1.8 !important;
          color: #292524 !important;
        }
        .quantum-letter-bn--dark {
          --bn-colors-editor-background: #14121f;
          --bn-colors-editor-text: #e2e8f0;
        }
        .quantum-letter-bn img { max-width: 100% !important; border-radius: 8px !important; }
        .quantum-letter-bn video { max-width: 100% !important; border-radius: 8px !important; }
        .quantum-letter-bn audio { width: 100%; max-width: 560px; }
      `}</style>
    </div>
  )
}
