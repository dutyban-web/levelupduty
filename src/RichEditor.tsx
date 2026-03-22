import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { DragEvent } from 'react'
import '@blocknote/core/fonts/inter.css'
import { useCreateBlockNote, useEditorChange } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/ariakit'
import '@blocknote/ariakit/style.css'
import type { BlockNoteEditor, PartialBlock } from '@blocknote/core'
import { supabase as _sbClient, uploadImageToMedia } from './supabase'

export function blockNoteToPlainPreview(value: string, maxLen = 80): string {
  if (!value?.trim()) return ''
  const t = value.trim()
  if (!t.startsWith('[')) return t.replace(/\n/g, ' ').slice(0, maxLen)
  try {
    const blocks = JSON.parse(t) as Array<{ content?: unknown; children?: unknown[] }>
    const texts: string[] = []
    const extract = (c: unknown) => {
      if (typeof c === 'string') texts.push(c)
      else if (c && typeof c === 'object' && 'text' in c && typeof (c as { text: string }).text === 'string') texts.push((c as { text: string }).text)
      else if (Array.isArray(c)) c.forEach(extract)
      else if (c && typeof c === 'object' && 'content' in c) extract((c as { content: unknown }).content)
    }
    blocks.forEach(b => { extract(b.content); (b.children || []).forEach(extract) })
    return texts.join(' ').replace(/\n/g, ' ').slice(0, maxLen) || ''
  } catch { return t.slice(0, maxLen) }
}

export function parseToInitialBlocks(value: string): PartialBlock[] | undefined {
  if (!value || !value.trim()) return undefined
  const trimmed = value.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as PartialBlock[]
    } catch { /* fall through */ }
  }
  return [{ type: 'paragraph', content: trimmed }]
}

export const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export function RichEditor({ value, onChange, placeholder, minHeight = 400, readOnly, contentKey }: {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  minHeight?: number
  readOnly?: boolean
  contentKey?: string
}) {
  const [uploading, setUploading] = useState(false)
  const key = contentKey ?? value
  const initialBlocks = useMemo(() => parseToInitialBlocks(value), [key])

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    if (!IMAGE_MIMES.includes(file.type)) throw new Error('지원 형식: jpg, png, gif, webp')
    setUploading(true)
    try {
      const url = await uploadImageToMedia(file)
      return url
    } finally {
      setUploading(false)
    }
  }, [])

  const editor = useCreateBlockNote(
    { initialContent: initialBlocks, uploadFile: readOnly ? undefined : uploadFile },
    [key]
  )
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEditorChange(() => {
    if (!editor || readOnly) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      onChange(JSON.stringify(editor.document))
    }, 600)
  }, editor)

  useEffect(() => {
    if (!editor || readOnly || !value?.trim()) return
    if (value.trim().startsWith('[')) return
    const loadMarkdown = async () => {
      try {
        const parsed = await editor.tryParseMarkdownToBlocks(value)
        if (parsed.length > 0) editor.replaceBlocks(editor.document, parsed)
      } catch { /* keep paragraph fallback */ }
    }
    loadMarkdown()
  }, [key])

  const insertImageAtEnd = useCallback((url: string) => {
    if (!editor) return
    const blocks = editor.document
    const refBlock = blocks.length > 0 ? blocks[blocks.length - 1] : null
    if (refBlock) {
      editor.insertBlocks([{ type: 'image' as const, props: { url } }], refBlock.id, 'after')
    } else {
      editor.replaceBlocks(editor.document, [{ type: 'image' as const, props: { url } }])
    }
  }, [editor])

  const handleDrop = useCallback(async (e: DragEvent) => {
    if (readOnly || !editor) return
    const file = e.dataTransfer?.files?.[0]
    if (!file || !IMAGE_MIMES.includes(file.type)) return
    e.preventDefault()
    e.stopPropagation()
    setUploading(true)
    try {
      const url = await uploadImageToMedia(file)
      insertImageAtEnd(url)
    } catch (err) {
      console.error('[이미지 업로드 실패]', err)
    } finally {
      setUploading(false)
    }
  }, [editor, readOnly, insertImageAtEnd])

  const handleDragOver = useCallback((e: DragEvent) => {
    if (readOnly) return
    if (e.dataTransfer?.types?.includes('Files')) e.preventDefault()
  }, [readOnly])

  if (!editor) return <div style={{ minHeight, color: '#9B9A97', fontSize: '14px' }}>불러오는 중…</div>

  return (
    <div
      className="bn-notion-editor"
      style={{ minHeight, position: 'relative' }}
      data-color-scheme="light"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {uploading && (
        <div style={{
          position: 'absolute', top: 8, right: 12, zIndex: 50,
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: '11px', color: '#6366f1', fontWeight: 600,
          padding: '4px 10px', borderRadius: 8, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
        }}>
          <span style={{ width: 12, height: 12, border: '2px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          업로드 중…
        </div>
      )}
      <BlockNoteView editor={editor} theme="light" editable={!readOnly} />
      <style>{`
        .bn-notion-editor .bn-editor { font-size: 18px !important; line-height: 1.75 !important; background: transparent !important; border: none !important; }
        .bn-notion-editor .bn-block-content, .bn-notion-editor [data-node-type="blockContainer"] { font-size: 18px !important; line-height: 1.75 !important; }
        .bn-notion-editor { --bn-colors-editor-background: transparent; --bn-colors-editor-text: #37352F; }
        .bn-notion-editor img { max-width: 100% !important; border-radius: 8px !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

/** Manifest 노트와 동일: 이미지·영상·오디오·파일 드롭 + / 슬래시 메뉴, notes에는 BlockNote JSON 저장 */
export function guessFortuneMediaKind(file: File): 'image' | 'video' | 'audio' | 'file' {
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

export function fortuneFileToMediaBlock(file: File, url: string): PartialBlock {
  const name = file.name || '파일'
  const kind = guessFortuneMediaKind(file)
  if (kind === 'image') return { type: 'image', props: { url, name } }
  if (kind === 'video') return { type: 'video', props: { url, name, showPreview: true } }
  if (kind === 'audio') return { type: 'audio', props: { url, name, showPreview: true } }
  return { type: 'file', props: { url, name } }
}

export function insertFortuneMediaBlocks(editor: BlockNoteEditor, blocks: PartialBlock[]) {
  if (blocks.length === 0) return
  const doc = editor.document
  let refId: string | undefined
  try {
    const pos = editor.getTextCursorPosition()
    if (pos?.block?.id) refId = pos.block.id
  } catch { /* no cursor */ }
  if (!refId && doc.length > 0) refId = doc[doc.length - 1].id
  if (!refId) {
    editor.replaceBlocks(doc, blocks)
    return
  }
  editor.insertBlocks(blocks, refId, 'after')
}

export function FortuneReadingBlockNoteSection({
  bootstrapKey,
  initialNotes,
  onSerializedChange,
}: {
  bootstrapKey: string | number
  initialNotes: string
  onSerializedChange: (json: string) => void
}) {
  const initialBlocks = useMemo(() => parseToInitialBlocks(initialNotes), [bootstrapKey, initialNotes])

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    try {
      if (_sbClient) {
        const { data: { session } } = await _sbClient.auth.getSession()
        if (session) return await uploadImageToMedia(file)
      }
    } catch (e) {
      console.warn('[운세 기록 본문 업로드]', e)
    }
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => reject(new Error('파일 읽기 실패'))
      r.readAsDataURL(file)
    })
  }, [])

  const editor = useCreateBlockNote({ initialContent: initialBlocks, uploadFile }, [bootstrapKey])

  useEditorChange(() => {
    if (!editor) return
    onSerializedChange(JSON.stringify(editor.document))
  }, editor)

  const [dropUploading, setDropUploading] = useState(false)
  const [dragOverEditor, setDragOverEditor] = useState(false)

  const handleEditorDragOver = useCallback((e: DragEvent) => {
    if (!editor) return
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [editor])

  const handleEditorDragEnter = useCallback((e: DragEvent) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault()
      setDragOverEditor(true)
    }
  }, [])

  const handleEditorDragLeave = useCallback((e: DragEvent) => {
    const related = e.relatedTarget as Node | null
    if (!related || !e.currentTarget.contains(related)) setDragOverEditor(false)
  }, [])

  const handleEditorDrop = useCallback(
    async (e: DragEvent) => {
      if (!editor) return
      setDragOverEditor(false)
      const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.size > 0)
      if (files.length === 0) return
      e.preventDefault()
      e.stopPropagation()
      setDropUploading(true)
      try {
        const blocks: PartialBlock[] = []
        for (const file of files) {
          const url = await uploadFile(file)
          blocks.push(fortuneFileToMediaBlock(file, url))
        }
        insertFortuneMediaBlocks(editor, blocks)
      } catch (err) {
        console.error('[운세 기록 드롭 삽입]', err)
      } finally {
        setDropUploading(false)
      }
    },
    [editor, uploadFile],
  )

  return (
    <div
      className="bn-fortune-reading-editor"
      style={{
        marginTop: 4,
        minHeight: 320,
        position: 'relative',
        borderRadius: 10,
        border: '1px solid rgba(0,0,0,0.08)',
        outline: dragOverEditor ? '2px dashed rgba(99,102,241,0.55)' : 'none',
        outlineOffset: 2,
        background: dragOverEditor ? 'rgba(99,102,241,0.04)' : '#fff',
        transition: 'outline 0.12s ease, background 0.12s ease',
        padding: '8px 4px 12px',
      }}
      data-color-scheme="light"
      onDragEnter={handleEditorDragEnter}
      onDragLeave={handleEditorDragLeave}
      onDragOver={handleEditorDragOver}
      onDrop={handleEditorDrop}
    >
      {dropUploading && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            fontWeight: 700,
            color: '#4f46e5',
            padding: '6px 12px',
            borderRadius: 8,
            background: 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.25)',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              border: '2px solid #6366f1',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'fortune-note-spin 0.75s linear infinite',
            }}
          />
          파일 넣는 중…
        </div>
      )}
      {!editor ? (
        <p style={{ color: '#9ca3af', fontSize: 14, padding: '8px 8px' }}>편집기 준비 중…</p>
      ) : (
        <BlockNoteView editor={editor} theme="light" editable />
      )}
      <style>{`
        .bn-fortune-reading-editor .bn-editor {
          font-size: 16px !important;
          line-height: 1.7 !important;
          background: transparent !important;
          border: none !important;
          padding: 4px 8px !important;
        }
        .bn-fortune-reading-editor {
          --bn-colors-editor-background: #ffffff;
          --bn-colors-editor-text: #37352f;
        }
        .bn-fortune-reading-editor img { max-width: 100% !important; border-radius: 8px !important; }
        .bn-fortune-reading-editor video { max-width: 100% !important; border-radius: 8px !important; }
        .bn-fortune-reading-editor audio { width: 100%; max-width: 560px; }
        @keyframes fortune-note-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
