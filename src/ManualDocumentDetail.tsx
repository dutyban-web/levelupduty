/**
 * 단일 매뉴얼 문서 보기·편집 — 제목·본문 우선, 메타데이터는 좌측 슬라이드 패널
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Menu, Paperclip, Plus, Trash2, Upload, X } from 'lucide-react'
import { ManualDocEditor, parseAttachments } from './ManualEditor'
import {
  uploadImageToMedia,
  fetchManualDocumentById,
  updateManualDocument,
  deleteManualDocument,
  type ManualAttachment,
  type ManualDocumentRow,
} from './supabase'
import { PersonLinkPicker } from './PersonLinkPicker'
import { PERSON_ENTITY } from './personEntityTypes'

function fmtWhen(s: string | null | undefined): string {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return '—'
  }
}

export function ManualDocumentDetail({ docId, onBack }: { docId: string; onBack: () => void }) {
  const [doc, setDoc] = useState<ManualDocumentRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [infoOpen, setInfoOpen] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const titleDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tagsDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attachInputRef = useRef<HTMLInputElement>(null)

  /** URL의 docId가 바뀔 때마다 이전 문서 상태를 비우고 다시 불러옴 (SPA 전환 시 stale 화면 방지) */
  useEffect(() => {
    let cancelled = false
    setDoc(null)
    setLoading(true)
    setInfoOpen(false)
    setTagInput('')

    void (async () => {
      const row = await fetchManualDocumentById(docId)
      if (cancelled) return
      setDoc(row)
      setLoading(false)
      if (row) {
        const ts = new Date().toISOString()
        const ok = await updateManualDocument(docId, { last_viewed_at: ts })
        if (!cancelled && ok) {
          setDoc(d => (d ? { ...d, last_viewed_at: ts } : null))
        }
      }
    })()

    return () => {
      cancelled = true
      if (titleDebounce.current) clearTimeout(titleDebounce.current)
      if (tagsDebounce.current) clearTimeout(tagsDebounce.current)
    }
  }, [docId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInfoOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (infoOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [infoOpen])

  const attachments = useMemo(() => (doc ? parseAttachments(doc.attachments) : []), [doc])

  const scheduleTitle = (title: string) => {
    if (titleDebounce.current) clearTimeout(titleDebounce.current)
    titleDebounce.current = setTimeout(() => {
      titleDebounce.current = null
      const t = title.trim() || '제목 없음'
      void updateManualDocument(docId, { title: t })
    }, 400)
  }

  const persistTags = (next: string[]) => {
    void updateManualDocument(docId, { tags: next })
  }

  const scheduleTags = (next: string[]) => {
    if (tagsDebounce.current) clearTimeout(tagsDebounce.current)
    tagsDebounce.current = setTimeout(() => {
      tagsDebounce.current = null
      persistTags(next)
    }, 400)
  }

  const addTag = (raw: string) => {
    if (!doc) return
    const t = raw.trim()
    if (!t) return
    if (doc.tags.includes(t)) return
    const next = [...doc.tags, t]
    setDoc({ ...doc, tags: next })
    scheduleTags(next)
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    if (!doc) return
    const next = doc.tags.filter(x => x !== tag)
    setDoc({ ...doc, tags: next })
    scheduleTags(next)
  }

  const onPersistBlocks = useCallback(
    (json: string) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(json)
      } catch {
        return
      }
      setDoc(d => (d && d.id === docId ? { ...d, blocks: parsed } : d))
      void updateManualDocument(docId, { blocks: parsed })
    },
    [docId],
  )

  const addAttachments = async (files: FileList | null) => {
    if (!doc || !files?.length) return
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
      setDoc(d => (d ? { ...d, attachments: next } : null))
      await updateManualDocument(doc.id, { attachments: next })
    } catch (e) {
      console.error('[Manual 첨부]', e)
      window.alert('파일 업로드에 실패했습니다.')
    }
  }

  const removeAttachment = async (attId: string) => {
    if (!doc) return
    const next = attachments.filter(a => a.id !== attId)
    setDoc(d => (d ? { ...d, attachments: next } : null))
    await updateManualDocument(doc.id, { attachments: next })
  }

  const removeDoc = async () => {
    if (!confirm('이 문서를 삭제할까요? 본문과 첨부 링크가 함께 제거됩니다.')) return
    const ok = await deleteManualDocument(docId)
    if (!ok) {
      window.alert('삭제에 실패했습니다.')
      return
    }
    onBack()
  }

  if (loading) {
    return (
      <div className="relative min-h-screen w-full bg-white">
        <header className="sticky top-0 z-[68] flex w-full items-center gap-1 border-b border-slate-100/90 bg-white/95 px-2 py-2 backdrop-blur-md sm:px-4">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-md bg-slate-100" />
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-md bg-slate-100" />
          <div className="flex-1" />
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-md bg-slate-100" />
        </header>
        <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4 sm:px-6">
          <div className="mb-6 flex items-center gap-2 text-sm text-slate-400">
            <span
              className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-violet-500"
              aria-hidden
            />
            문서를 불러오는 중…
          </div>
          <div className="mb-4 h-10 max-w-xl animate-pulse rounded-lg bg-slate-100" />
          <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-11/12 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />
          </div>
        </main>
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="min-h-[50vh] w-full px-4 py-12">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="w-4 h-4" />
          목록으로
        </button>
        <p className="text-slate-600">문서를 찾을 수 없습니다.</p>
      </div>
    )
  }

  const metaPanel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="m-0 text-sm font-bold text-slate-800">문서 정보</h2>
        <button
          type="button"
          onClick={() => setInfoOpen(false)}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="패널 닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="grid gap-4">
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-500" htmlFor="manual-category">
              카테고리
            </label>
            <input
              id="manual-category"
              type="text"
              value={doc.category}
              onChange={e => {
                const v = e.target.value
                setDoc(d => (d ? { ...d, category: v } : null))
              }}
              onBlur={() => {
                const c = doc.category.trim()
                setDoc(d => (d ? { ...d, category: c } : null))
                void updateManualDocument(doc.id, { category: c })
              }}
              placeholder="예: 업무, 학습, 참고…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <p className="mt-1.5 m-0 text-[10px] text-slate-400">필요할 때마다 입력·저장하며 목록에서 필터할 수 있습니다.</p>
          </div>
          <div>
            <p className="m-0 mb-1 text-[11px] font-bold text-slate-500">수정일</p>
            <p className="m-0 text-sm text-slate-800">{fmtWhen(doc.updated_at)}</p>
          </div>
          <div>
            <p className="m-0 mb-1 text-[11px] font-bold text-slate-500">작성일</p>
            <p className="m-0 text-sm text-slate-800">{fmtWhen(doc.created_at)}</p>
          </div>
          <div>
            <p className="m-0 mb-1 text-[11px] font-bold text-slate-500">마지막으로 연 날짜</p>
            <p className="m-0 text-sm text-slate-800">{fmtWhen(doc.last_viewed_at)}</p>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-500" htmlFor="manual-importance">
              중요도 (0–100)
            </label>
            <input
              id="manual-importance"
              type="number"
              min={0}
              max={100}
              value={doc.importance_score}
              onChange={e => {
                const v = Math.max(0, Math.min(100, Number(e.target.value) || 0))
                setDoc(d => (d ? { ...d, importance_score: v } : null))
              }}
              onBlur={() => void updateManualDocument(doc.id, { importance_score: doc.importance_score })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-500" htmlFor="manual-completion">
              완성율 (0–100%)
            </label>
            <input
              id="manual-completion"
              type="number"
              min={0}
              max={100}
              step={1}
              value={Math.round(doc.completion_rate)}
              onChange={e => {
                const v = Math.max(0, Math.min(100, Number(e.target.value) || 0))
                setDoc(d => (d ? { ...d, completion_rate: v } : null))
              }}
              onBlur={() => void updateManualDocument(doc.id, { completion_rate: doc.completion_rate })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-4">
            <p className="m-0 mb-2 text-[11px] font-bold text-slate-500">통합 인물 DB</p>
            <PersonLinkPicker entityType={PERSON_ENTITY.MANUAL_DOCUMENT} entityId={doc.id} />
          </div>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-6">
          <p className="m-0 mb-2 text-[11px] font-bold text-slate-500">태그</p>
          <div className="mb-2 flex flex-wrap gap-2">
            {doc.tags.map(t => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800"
              >
                {t}
                <button
                  type="button"
                  onClick={() => removeTag(t)}
                  className="rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                  aria-label={`태그 ${t} 제거`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag(tagInput)
                }
              }}
              placeholder="태그 입력 후 Enter"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => addTag(tagInput)}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              추가
            </button>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="m-0 flex items-center gap-2 text-sm font-bold text-slate-800">
              <Paperclip className="h-4 w-4 text-slate-500" />
              첨부 파일
            </h3>
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <Upload className="h-3.5 w-3.5" />
              추가
            </button>
          </div>
          <p className="mb-3 text-[11px] text-slate-500">
            PDF·압축 등은 링크로 보관됩니다. 본문에 넣으려면 에디터로 드래그하세요.
          </p>
          {attachments.length === 0 ? (
            <p className="m-0 text-xs text-slate-400">첨부 없음</p>
          ) : (
            <ul className="m-0 list-none space-y-2 p-0">
              {attachments.map(a => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm"
                >
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 truncate font-medium text-violet-700 hover:underline"
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
        </div>

        <p className="mt-6 border-t border-slate-100 pt-4 text-[11px] leading-relaxed text-slate-400">
          단축: 에디터에서 <span className="font-semibold text-slate-500">/</span> 로 블록 변경 · 파일 드래그 앤 드롭
        </p>
      </div>
    </div>
  )

  return (
    <div className="relative min-h-screen w-full bg-white">
      {/* 어두운 오버레이 (패널 열림 시만 클릭 가능) */}
      <div
        role="presentation"
        onClick={() => setInfoOpen(false)}
        className={`fixed inset-0 z-[55] bg-slate-900/25 transition-opacity duration-300 ${
          infoOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!infoOpen}
      />

      {/* 좌측 슬라이드 패널 */}
      <aside
        id="manual-meta-panel"
        className={`fixed left-0 top-0 z-[70] flex h-full w-[min(100%,380px)] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-300 ease-out ${
          infoOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!infoOpen}
      >
        {metaPanel}
      </aside>

      {/* 상단 바: 미니멀 토글 + 뒤로 + 삭제 */}
      <header className="sticky top-0 z-[68] flex w-full items-center gap-1 border-b border-slate-100/90 bg-white/90 px-2 py-2 backdrop-blur-md sm:px-4">
        <button
          type="button"
          onClick={() => setInfoOpen(v => !v)}
          className="rounded-md p-2 text-slate-400 opacity-50 transition-colors hover:bg-slate-100 hover:text-slate-700 hover:opacity-100"
          aria-expanded={infoOpen}
          aria-controls="manual-meta-panel"
          title="문서 정보"
        >
          <Menu className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-md p-2 text-slate-400 opacity-70 transition-colors hover:bg-slate-100 hover:text-slate-800 hover:opacity-100"
          title="목록으로"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => void removeDoc()}
          className="rounded-md p-2 text-slate-400 opacity-50 transition-colors hover:bg-red-50 hover:text-red-600 hover:opacity-100"
          title="삭제"
        >
          <Trash2 className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
      </header>

      {/* 메인: 제목 → 본문 (단일 흐름) */}
      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-2 sm:px-6">
        <label className="sr-only" htmlFor="manual-detail-title">
          제목
        </label>
        <input
          id="manual-detail-title"
          value={doc.title}
          onChange={e => {
            const v = e.target.value
            setDoc(d => (d ? { ...d, title: v } : null))
            scheduleTitle(v)
          }}
          className="mb-1 w-full border-0 border-b border-transparent bg-transparent px-0 py-2 text-3xl font-bold tracking-tight text-slate-900 placeholder:text-slate-300 focus:border-slate-200 focus:outline-none focus:ring-0 sm:text-[2rem] sm:leading-tight"
          placeholder="제목 없음"
        />
        <div className="mt-3 sm:mt-4">
          <ManualDocEditor doc={doc} onPersistBlocks={onPersistBlocks} />
        </div>
      </main>
    </div>
  )
}
