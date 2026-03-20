/**
 * Manifestation 카드 더블클릭 — 노션형 편집 노트 (BlockNote: / 슬래시 메뉴, 이미지·동영상·표 등)
 * 본문·태그는 localStorage, 카드 미리보기용 title/description/icon 은 onPersistMeta 로 동기화
 * - DB `title` = 상위분류(헤더 큰 입력)
 * - DB `description` = 세부 제목·노트 본문에서 뽑은 미리보기 텍스트(카드 작은 글자)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import '@blocknote/core/fonts/inter.css'
import { useCreateBlockNote, useEditorChange } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/ariakit'
import '@blocknote/ariakit/style.css'
import type { BlockNoteEditor, PartialBlock } from '@blocknote/core'
import { List, Plus, Tag, X } from 'lucide-react'
import { supabase, uploadImageToMedia } from './supabase'
import {
  blockNoteToPlainPreview,
  loadManifestNotionNote,
  manifestNoteStorageKey,
  parseToInitialBlocks,
  saveManifestNotionNote,
  type ManifestNoteKind,
} from './manifestNoteUtils'

export type { ManifestNoteKind }

const NOTE_PANEL_Z = 50020

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
  if (kind === 'image') {
    return { type: 'image', props: { url, name } }
  }
  if (kind === 'video') {
    return { type: 'video', props: { url, name, showPreview: true } }
  }
  if (kind === 'audio') {
    return { type: 'audio', props: { url, name, showPreview: true } }
  }
  return { type: 'file', props: { url, name } }
}

/** 커서 위치 뒤에 삽입, 없으면 문서 끝 — 빈 문서면 전체 교체 */
function insertMediaBlocks(editor: BlockNoteEditor, blocks: PartialBlock[]) {
  if (blocks.length === 0) return
  const doc = editor.document
  let refId: string | undefined
  try {
    const pos = editor.getTextCursorPosition()
    if (pos?.block?.id) refId = pos.block.id
  } catch {
    /* 커서 없음 등 */
  }
  if (!refId && doc.length > 0) refId = doc[doc.length - 1].id
  if (!refId) {
    editor.replaceBlocks(doc, blocks)
    return
  }
  editor.insertBlocks(blocks, refId, 'after')
}

type Props = {
  open: boolean
  onClose: () => void
  kind: ManifestNoteKind
  entityId: string
  /** 상위분류 — 카드 상단 굵은 글자 */
  initialTitle: string
  /** 세부 제목·노트 본문 미리보기 — 카드 하단 작은 글자 */
  initialDescription: string
  initialIcon: string
  kindLabel: string
  accent: string
  onPersistMeta: (fields: { title: string; description: string; icon: string }) => void
}

export function ManifestNotionNotePanel({
  open,
  onClose,
  kind,
  entityId,
  initialTitle,
  initialDescription,
  initialIcon,
  kindLabel,
  accent,
  onPersistMeta,
}: Props) {
  const storageKey = manifestNoteStorageKey(kind, entityId)

  const [title, setTitle] = useState(() => loadManifestNotionNote(storageKey)?.title ?? initialTitle)
  const [icon, setIcon] = useState(() => loadManifestNotionNote(storageKey)?.icon ?? initialIcon)
  const [tags, setTags] = useState(() => loadManifestNotionNote(storageKey)?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)

  const titleRef = useRef(title)
  const iconRef = useRef(icon)
  const tagsRef = useRef(tags)

  useEffect(() => {
    titleRef.current = title
    iconRef.current = icon
    tagsRef.current = tags
  }, [title, icon, tags])

  const initialBlocks = useMemo((): PartialBlock[] | undefined => {
    const s = loadManifestNotionNote(storageKey)
    if (s?.blocksJson) {
      try {
        const parsed = JSON.parse(s.blocksJson) as unknown
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as PartialBlock[]
      } catch {
        /* fall through */
      }
    }
    return parseToInitialBlocks(initialDescription)
  }, [storageKey, initialDescription])

  const editorKey = open ? `${kind}-${entityId}` : 'closed'

  /** 슬래시 메뉴·붙여넣기·드래그앤드롭 공통 — 로그인 시 media 버킷, 아니면 data URL */
  const uploadFile = useCallback(async (file: File): Promise<string> => {
    try {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) return await uploadImageToMedia(file)
      }
    } catch (e) {
      console.warn('[Manifest 노트 파일 업로드]', e)
    }
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => reject(new Error('파일 읽기 실패'))
      r.readAsDataURL(file)
    })
  }, [])

  const editor = useCreateBlockNote({ initialContent: initialBlocks, uploadFile }, [editorKey])

  const [dropUploading, setDropUploading] = useState(false)
  const [dragOverEditor, setDragOverEditor] = useState(false)

  const handleEditorDragOver = useCallback((e: React.DragEvent) => {
    if (!editor) return
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [editor])

  const handleEditorDragEnter = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault()
      setDragOverEditor(true)
    }
  }, [])

  const handleEditorDragLeave = useCallback((e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null
    if (!related || !e.currentTarget.contains(related)) setDragOverEditor(false)
  }, [])

  const handleEditorDrop = useCallback(
    async (e: React.DragEvent) => {
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
          blocks.push(fileToMediaBlock(file, url))
        }
        insertMediaBlocks(editor, blocks)
      } catch (err) {
        console.error('[Manifest 노트 드롭 삽입]', err)
      } finally {
        setDropUploading(false)
      }
    },
    [editor, uploadFile],
  )

  const persistAll = useCallback(
    (editorDocJson: string) => {
      const t = titleRef.current.trim() || initialTitle
      const ic = iconRef.current.trim() || '✨'
      const tg = tagsRef.current
      const plain = blockNoteToPlainPreview(editorDocJson, 500)
      saveManifestNotionNote(storageKey, {
        title: t,
        icon: ic,
        tags: tg,
        blocksJson: editorDocJson,
      })
      onPersistMeta({ title: t, description: plain, icon: ic })
    },
    [storageKey, initialTitle, onPersistMeta],
  )

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runDebounced = useCallback(
    (fn: () => void) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null
        fn()
      }, 450)
    },
    [],
  )

  useEditorChange(() => {
    if (!editor || !open) return
    runDebounced(() => persistAll(JSON.stringify(editor.document)))
  }, editor)

  useEffect(() => {
    if (!open || !editor) return
    runDebounced(() => persistAll(JSON.stringify(editor.document)))
  }, [title, icon, tags, open, editor, runDebounced, persistAll])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const addTag = () => {
    const v = tagInput.trim()
    if (!v) return
    if (tags.includes(v)) {
      setTagInput('')
      return
    }
    setTags(prev => [...prev, v])
    setTagInput('')
    setShowTagInput(false)
  }

  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t))

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manifest-notion-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: NOTE_PANEL_Z,
        background: 'rgba(15, 23, 42, 0.42)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: 'min(820px, 100%)',
          maxHeight: 'min(92vh, 960px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.03)',
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            padding: 8,
            borderRadius: 8,
            border: 'none',
            background: 'rgba(0,0,0,0.04)',
            cursor: 'pointer',
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} color="#64748b" strokeWidth={2} />
        </button>

        <div
          style={{
            overflowY: 'auto',
            flex: 1,
            padding: '28px 36px 32px',
            minHeight: 0,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.12em',
              color: accent,
            }}
          >
            {kindLabel}
          </p>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 10 }}>
            <input
              type="text"
              aria-label="페이지 아이콘(이모지)"
              value={icon}
              onChange={e => setIcon(e.target.value)}
              placeholder="✨"
              maxLength={8}
              title="아이콘"
              style={{
                width: 56,
                flexShrink: 0,
                padding: '4px 2px',
                fontSize: 40,
                lineHeight: 1,
                textAlign: 'center',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontFamily: 'inherit',
              }}
            />
            <input
              id="manifest-notion-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              aria-label="상위분류"
              placeholder="상위분류"
              style={{
                flex: 1,
                margin: 0,
                padding: '4px 36px 4px 0',
                fontSize: 'clamp(24px, 4.2vw, 34px)',
                fontWeight: 800,
                color: '#111827',
                lineHeight: 1.25,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* 속성 / 태그 */}
          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <List size={16} color="#9ca3af" strokeWidth={2} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#787774' }}>[태그]</span>
              {tags.map(t => (
                <span
                  key={t}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'rgba(99,102,241,0.1)',
                    color: '#4f46e5',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      padding: 0,
                      lineHeight: 1,
                      color: '#6366f1',
                      fontSize: 14,
                    }}
                    aria-label={`${t} 제거`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {!showTagInput ? (
                <button
                  type="button"
                  onClick={() => setShowTagInput(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 8,
                    border: '1px dashed rgba(0,0,0,0.12)',
                    background: '#fff',
                    color: '#9ca3af',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={14} /> 속성 추가
                </button>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Tag size={14} color="#9ca3af" />
                  <input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTag()
                      }
                      if (e.key === 'Escape') {
                        setTagInput('')
                        setShowTagInput(false)
                      }
                    }}
                    placeholder="태그 입력 후 Enter"
                    autoFocus
                    style={{
                      padding: '6px 10px',
                      fontSize: 13,
                      borderRadius: 8,
                      border: '1px solid rgba(99,102,241,0.35)',
                      minWidth: 160,
                    }}
                  />
                </span>
              )}
            </div>
          </div>

          {/* BlockNote: / 슬래시 메뉴 · 탐색기에서 파일 드래그 앤 드롭 */}
          <div
            className="bn-manifest-notion-editor"
            style={{
              marginTop: 24,
              minHeight: 360,
              position: 'relative',
              borderRadius: 10,
              outline: dragOverEditor ? '2px dashed rgba(99,102,241,0.55)' : 'none',
              outlineOffset: 4,
              background: dragOverEditor ? 'rgba(99,102,241,0.04)' : 'transparent',
              transition: 'outline 0.12s ease, background 0.12s ease',
            }}
            data-color-scheme="light"
            onDragEnter={handleEditorDragEnter}
            onDragLeave={handleEditorDragLeave}
            onDragOver={handleEditorDragOver}
            onDrop={handleEditorDrop}
          >
            {(dropUploading) && (
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
                    animation: 'manifest-note-spin 0.75s linear infinite',
                  }}
                />
                파일 넣는 중…
              </div>
            )}
            {!editor ? (
              <p style={{ color: '#9ca3af', fontSize: 14 }}>편집기 준비 중…</p>
            ) : (
              <BlockNoteView editor={editor} theme="light" editable />
            )}
            <style>{`
              .bn-manifest-notion-editor .bn-editor {
                font-size: 16px !important;
                line-height: 1.7 !important;
                background: transparent !important;
                border: none !important;
                padding: 0 !important;
              }
              .bn-manifest-notion-editor {
                --bn-colors-editor-background: #ffffff;
                --bn-colors-editor-text: #37352f;
              }
              .bn-manifest-notion-editor img { max-width: 100% !important; border-radius: 8px !important; }
              .bn-manifest-notion-editor video { max-width: 100% !important; border-radius: 8px !important; }
              .bn-manifest-notion-editor audio { width: 100%; max-width: 560px; }
              @keyframes manifest-note-spin { to { transform: rotate(360deg); } }
            `}</style>
          </div>

          <p style={{ margin: '16px 0 0', fontSize: 11, color: '#9ca3af' }}>
            본문에서 <strong>/</strong> 로 블록을 넣거나, <strong>탐색기에서 이미지·영상·파일을 끌어다 놓으면</strong> 삽입됩니다. (로그인 시 클라우드 업로드)
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
