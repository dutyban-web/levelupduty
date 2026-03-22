/**
 * 단일 매뉴얼 문서 보기·편집 — 제목·본문 우선, 메타데이터는 좌측 슬라이드 패널
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, Menu, Paperclip, Plus, StickyNote, Trash2, Upload, X } from 'lucide-react'
import { ManualBook3D } from './ManualBook3D'
import { effectiveManualCoverHue, hueFromCategory } from './manualCoverHue'
import { ManualDocEditor, parseAttachments } from './ManualEditor'
import {
  uploadImageToMedia,
  fetchManualDocumentById,
  fetchManualDocuments,
  updateManualDocument,
  deleteManualDocument,
  type ManualAttachment,
  type ManualDocumentRow,
} from './supabase'
import { PersonLinkPicker } from './PersonLinkPicker'
import { PERSON_ENTITY } from './personEntityTypes'
import { UnifiedHalfStarRating } from './UnifiedHalfStarRating'
import { UnifiedFavoriteToggle } from './UnifiedFavoriteToggle'

function fmtWhen(s: string | null | undefined): string {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return '—'
  }
}

/** 문서 하단 책장 — 목록 화면과 유사한 질감 */
const MANUAL_SHELF_BG: CSSProperties = {
  backgroundColor: '#5c4a3f',
  backgroundImage:
    'repeating-linear-gradient(to bottom, #5c4a3f 0px, #5c4a3f 168px, #3d322b 168px, #3d322b 172px, #5c4a3f 172px)',
}

export function ManualDocumentDetail({ docId, onBack }: { docId: string; onBack: () => void }) {
  const navigate = useNavigate()
  const [doc, setDoc] = useState<ManualDocumentRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [sameCategoryDocs, setSameCategoryDocs] = useState<ManualDocumentRow[]>([])
  const [infoOpen, setInfoOpen] = useState(false)
  const [memoOpen, setMemoOpen] = useState(false)
  /** 같은 카테고리 책장 — 본문 아래 문서 흐름(스크롤 끝에서 확인) */
  const [shelfDrawerOpen, setShelfDrawerOpen] = useState(true)
  const [tagInput, setTagInput] = useState('')
  const titleDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tagsDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notesDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attachInputRef = useRef<HTMLInputElement>(null)
  const categoryAtFocusRef = useRef<string | null>(null)

  /** URL의 docId가 바뀔 때마다 이전 문서 상태를 비우고 다시 불러옴 (SPA 전환 시 stale 화면 방지) */
  useEffect(() => {
    let cancelled = false
    setDoc(null)
    setLoading(true)
    setInfoOpen(false)
    setMemoOpen(false)
    setShelfDrawerOpen(true)
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
      if (notesDebounce.current) clearTimeout(notesDebounce.current)
    }
  }, [docId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (infoOpen) setInfoOpen(false)
      else if (memoOpen) setMemoOpen(false)
      else if (shelfDrawerOpen) setShelfDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [infoOpen, memoOpen, shelfDrawerOpen])

  /** 같은 카테고리 문서만 가로 책장 — 카테고리 비어 있으면 표시 안 함 */
  useEffect(() => {
    const cat = doc?.category?.trim()
    if (!cat) {
      setSameCategoryDocs([])
      return
    }
    let cancelled = false
    void (async () => {
      const all = await fetchManualDocuments()
      if (cancelled) return
      const same = all
        .filter(d => (d.category ?? '').trim() === cat)
        .sort((a, b) => a.sort_order - b.sort_order)
      setSameCategoryDocs(same)
    })()
    return () => {
      cancelled = true
    }
  }, [doc?.id, doc?.category])

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

  const scheduleNotes = (text: string) => {
    if (notesDebounce.current) clearTimeout(notesDebounce.current)
    notesDebounce.current = setTimeout(() => {
      notesDebounce.current = null
      void updateManualDocument(docId, { notes: text })
    }, 500)
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
        <main className="mx-auto w-full max-w-[57.6rem] px-4 pb-24 pt-4 sm:px-6">
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
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
              onFocus={() => {
                categoryAtFocusRef.current = doc.category
              }}
              onChange={e => {
                const v = e.target.value
                setDoc(d => (d ? { ...d, category: v } : null))
              }}
              onBlur={() => {
                const c = doc.category.trim()
                const prev = (categoryAtFocusRef.current ?? '').trim()
                if (c !== prev) {
                  const nextHue = c ? hueFromCategory(c) : null
                  setDoc(d => (d ? { ...d, category: c, cover_hue: nextHue } : null))
                  void updateManualDocument(doc.id, { category: c, cover_hue: nextHue })
                } else {
                  setDoc(d => (d ? { ...d, category: c } : null))
                  void updateManualDocument(doc.id, { category: c })
                }
              }}
              placeholder="예: 업무, 학습, 참고…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <p className="mt-1.5 m-0 text-[10px] text-slate-400">필요할 때마다 입력·저장하며 목록에서 필터할 수 있습니다.</p>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-500" htmlFor="manual-cover-hue">
              책 표지 색 (책장 아이콘)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="h-7 w-7 shrink-0 rounded-md border border-slate-200 shadow-inner"
                style={{
                  backgroundColor: `hsl(${effectiveManualCoverHue(doc)} 34% 44%)`,
                }}
                title="미리보기"
              />
              <input
                id="manual-cover-hue"
                type="range"
                min={0}
                max={360}
                value={effectiveManualCoverHue(doc)}
                onChange={e => {
                  const v = Math.round(Number(e.target.value))
                  setDoc(d => (d ? { ...d, cover_hue: v } : null))
                }}
                onPointerUp={e => {
                  const v = Math.round(Number((e.target as HTMLInputElement).value))
                  void updateManualDocument(docId, { cover_hue: v })
                }}
                className="min-w-0 flex-1 accent-violet-600"
              />
              <button
                type="button"
                onClick={() => {
                  setDoc(d => (d ? { ...d, cover_hue: null } : null))
                  void updateManualDocument(docId, { cover_hue: null })
                }}
                className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50"
              >
                자동
              </button>
            </div>
            <p className="mt-1.5 m-0 text-[10px] text-slate-400">
              카테고리가 있으면 같은 이름끼리 같은 기본색이며, 슬라이더로 덮어쓸 수 있습니다. 자동은 카테고리 기본(없으면 문서 id 기반)으로 돌아갑니다.
            </p>
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
          <div>
            <p className="m-0 mb-1 text-[11px] font-bold text-slate-500">레이팅 (통합 레이팅과 동일)</p>
            <p className="mt-0 mb-2 text-[10px] leading-relaxed text-slate-400">
              마스터 보드 → 데이터 창고 → <strong className="font-semibold text-slate-500">통합 레이팅</strong>과 같은
              척도입니다. 별 왼쪽·오른쪽으로 0.5점 단위, 최대 5점. 0은 미설정입니다.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <UnifiedHalfStarRating
                value={doc.rating}
                onChange={v => {
                  setDoc(d => (d ? { ...d, rating: v } : null))
                  void updateManualDocument(doc.id, { rating: v })
                }}
                starSize={26}
                ariaLabel="문서 레이팅"
              />
              <span
                className={`text-sm font-extrabold ${doc.rating > 0 ? 'text-amber-700' : 'text-slate-400'}`}
              >
                {doc.rating > 0 ? `${doc.rating} / 5` : '— / 5'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setDoc(d => (d ? { ...d, rating: 0 } : null))
                void updateManualDocument(doc.id, { rating: 0 })
              }}
              className="mt-2 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50"
            >
              레이팅 초기화
            </button>
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

  const memoPanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="m-0 text-sm font-bold text-slate-800">메모 · 요약</h2>
        <button
          type="button"
          onClick={() => setMemoOpen(false)}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="메모 패널 닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-2">
        <label className="sr-only" htmlFor="manual-detail-notes">
          본문 메모
        </label>
        <textarea
          id="manual-detail-notes"
          value={doc.notes}
          onChange={e => {
            const v = e.target.value
            setDoc(d => (d ? { ...d, notes: v } : null))
            scheduleNotes(v)
          }}
          placeholder="본문을 읽으며 중요한 부분만 요약·정리해 보세요."
          className="min-h-[200px] w-full flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-1 focus:ring-violet-200"
        />
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen w-full flex-col bg-white">
      <header className="sticky top-0 z-[68] flex w-full shrink-0 items-center gap-1 border-b border-slate-100/90 bg-white/95 px-2 py-2 backdrop-blur-md sm:px-4">
        <button
          type="button"
          onClick={() => setInfoOpen(v => !v)}
          className="rounded-md p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          aria-expanded={infoOpen}
          aria-controls="manual-meta-panel"
          title="문서 정보"
        >
          <Menu className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          title="목록으로"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
        <UnifiedFavoriteToggle
          kind="manual"
          refId={doc.id}
          title={doc.title?.trim() || '제목 없음'}
          subtitle={doc.category?.trim() ?? ''}
          href={`/manual/${doc.id}`}
        />
        <div className="min-w-0 flex-1" />
        <button
          type="button"
          onClick={() => setMemoOpen(v => !v)}
          className={`rounded-md p-2 transition-colors hover:bg-slate-100 ${
            memoOpen ? 'text-violet-700 bg-violet-50' : 'text-slate-600 hover:text-slate-900'
          }`}
          aria-expanded={memoOpen}
          aria-controls="manual-memo-panel"
          title="메모 · 요약"
        >
          <StickyNote className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => void removeDoc()}
          className="rounded-md p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
          title="삭제"
        >
          <Trash2 className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 w-full">
        <aside
          id="manual-meta-panel"
          className={`shrink-0 overflow-hidden border-r border-slate-200 bg-white shadow-sm transition-[width] duration-300 ease-out ${
            infoOpen ? 'w-[min(380px,100%)]' : 'w-0'
          }`}
          aria-hidden={!infoOpen}
        >
          <div className="flex h-full min-h-0 w-[min(380px,100vw)] flex-col overflow-hidden">{metaPanel}</div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          <div
            className={
              doc.category?.trim() && sameCategoryDocs.length > 0
                ? 'flex min-h-full min-w-0 flex-col'
                : 'contents'
            }
          >
            <main
              className={`mx-auto w-full max-w-[57.6rem] shrink-0 px-4 pt-2 sm:px-6 ${
                doc.category?.trim() && sameCategoryDocs.length > 0 ? 'pb-6' : 'pb-24'
              }`}
            >
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

            {doc.category?.trim() && sameCategoryDocs.length > 0 && (
              <div
                id="manual-same-category-shelf"
                className="mt-auto shrink-0 border-t border-slate-100/90 bg-white pb-3 pt-5 sm:pb-4 sm:pt-6"
              >
              {!shelfDrawerOpen && (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 border-t border-[#2c221c] px-3 py-1.5 text-left shadow-[0_4px_18px_rgba(0,0,0,0.12)] transition hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#4d3d34] sm:gap-2.5 sm:px-4"
                  style={MANUAL_SHELF_BG}
                  onClick={() => setShelfDrawerOpen(true)}
                  aria-expanded={false}
                  aria-controls="manual-same-category-shelf-panel"
                  title="같은 카테고리 책장 열기"
                >
                  <ChevronRight className="h-4 w-4 shrink-0 text-amber-100/90" strokeWidth={2.5} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-extrabold tracking-wide text-amber-100/95">
                    같은 카테고리 · {doc.category.trim()}
                  </span>
                </button>
              )}
              {shelfDrawerOpen && (
                <section
                  id="manual-same-category-shelf-panel"
                  className="flex max-h-[min(42vh,300px)] flex-col overflow-hidden rounded-xl border border-[#2c221c] shadow-[0_8px_28px_rgba(0,0,0,0.18)]"
                  style={MANUAL_SHELF_BG}
                  aria-hidden={false}
                  aria-label="같은 카테고리 문서"
                >
                  <div className="flex shrink-0 items-center gap-2 border-b border-black/25 px-3 py-1.5 sm:gap-2.5 sm:px-4">
                    <button
                      type="button"
                      onClick={() => setShelfDrawerOpen(false)}
                      className="shrink-0 rounded-md p-1.5 text-amber-100/90 hover:bg-black/20 hover:text-amber-50"
                      aria-label="책장 접기"
                      title="책장 접기"
                    >
                      <ChevronLeft className="h-4 w-4 text-amber-100/90" strokeWidth={2.5} aria-hidden />
                    </button>
                    <p className="m-0 min-w-0 flex-1 truncate pl-0.5 text-left text-[11px] font-extrabold tracking-wide text-amber-100/95">
                      같은 카테고리 · {doc.category.trim()}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShelfDrawerOpen(false)}
                      className="shrink-0 rounded-md p-1.5 text-amber-100/85 hover:bg-black/20 hover:text-amber-50"
                      aria-label="책장 닫기"
                    >
                      <X className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                  </div>
                  <div className="min-h-0 overflow-x-auto overflow-y-hidden overscroll-x-contain py-2 [-webkit-overflow-scrolling:touch]">
                    <ul className="m-0 flex w-max list-none flex-nowrap items-stretch gap-5 px-3 pb-1 sm:gap-6 sm:px-4">
                      {sameCategoryDocs.map(d => {
                        const hue = effectiveManualCoverHue(d)
                        const title = d.title?.trim() || '제목 없음'
                        const chipBg = `hsl(${hue} 34% 40%)`
                        const isCurrent = d.id === docId
                        return (
                          <li key={d.id} className="relative flex w-[104px] shrink-0 flex-col">
                            <button
                              type="button"
                              onClick={() => navigate(`/manual/${d.id}`)}
                              className="flex h-full min-h-0 w-full flex-col items-stretch gap-0 rounded-lg text-left transition-[transform,box-shadow] duration-200 ease-out hover:scale-[1.03] hover:shadow-[0_10px_24px_rgba(0,0,0,0.38)] focus-visible:scale-[1.03] focus-visible:shadow-[0_10px_24px_rgba(0,0,0,0.38)] focus-visible:outline-none"
                            >
                              <div className="flex h-[100px] w-full shrink-0 items-end justify-center pb-0.5">
                                <div
                                  className={`origin-top scale-[0.82] rounded-md ${isCurrent ? 'ring-2 ring-amber-300 ring-offset-0' : ''}`}
                                >
                                  <ManualBook3D hue={hue} />
                                </div>
                              </div>
                              <div
                                className="mx-auto mt-1.5 flex h-[2.5rem] w-full max-w-[100px] items-start justify-center overflow-hidden rounded px-0.5 py-0.5 text-center text-[10px] font-bold leading-snug text-white"
                                style={{ backgroundColor: chipBg }}
                                title={title}
                              >
                                <span className="line-clamp-2 w-full break-words">{title}</span>
                              </div>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                  <div className="h-px shrink-0 border-t border-black/30 bg-black/15" aria-hidden />
                </section>
              )}
              </div>
            )}
          </div>
        </div>

        <aside
          id="manual-memo-panel"
          className={`shrink-0 overflow-hidden border-l border-slate-200 bg-white shadow-sm transition-[width] duration-300 ease-out ${
            memoOpen ? 'w-[min(380px,100%)]' : 'w-0'
          }`}
          aria-hidden={!memoOpen}
        >
          <div className="flex h-full flex-col overflow-hidden" style={{ width: 'min(380px, 100vw)' }}>
            {memoPanel}
          </div>
        </aside>
      </div>
    </div>
  )
}
