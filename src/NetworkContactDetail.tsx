import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/ariakit/style.css'
import { useCreateBlockNote, useEditorChange } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/ariakit'
import type { BlockNoteEditor, PartialBlock } from '@blocknote/core'
import { ArrowLeft, Calendar, Plus, Trash2 } from 'lucide-react'
import { supabase, uploadImageToMedia } from './supabase'
import { isSupabaseReady } from './lib/supabase'
import {
  type NetworkContact,
  type NetworkHistoryEntry,
  BENEFIT_OPTIONS,
  type NetworkBenefitId,
  newHistoryId,
} from './networkData'
import { parseToInitialBlocks, blockNoteToPlainPreview } from './manifestNoteUtils'
import { removeNetworkHistoryFromCalendar, syncNetworkHistoryToCalendar } from './networkCalendar'
import { NetworkHumanRelationsSection } from './NetworkHumanRelationsSection'

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
  } catch { /* */ }
  if (!refId && doc.length > 0) refId = doc[doc.length - 1].id
  if (!refId) {
    editor.replaceBlocks(doc, blocks)
    return
  }
  editor.insertBlocks(blocks, refId, 'after')
}

type Props = {
  contact: NetworkContact
  onBack: () => void
  onPersist: (c: NetworkContact) => void
  onDelete: (id: string) => void
}

export function NetworkContactDetail({ contact, onBack, onPersist, onDelete }: Props) {
  const [draft, setDraft] = useState<NetworkContact>(contact)
  const [histDate, setHistDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [histTitle, setHistTitle] = useState('')
  const [histSummary, setHistSummary] = useState('')
  const [dropUploading, setDropUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const schedulePersist = useCallback(
    (next: NetworkContact) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null
        onPersist(next)
      }, 500)
    },
    [onPersist],
  )

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
  }, [])

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    try {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) return await uploadImageToMedia(file)
      }
    } catch (e) {
      console.warn('[Network 업로드]', e)
    }
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => reject(new Error('파일 읽기 실패'))
      r.readAsDataURL(file)
    })
  }, [])

  const initialBlocks = useMemo((): PartialBlock[] | undefined => {
    const raw = contact.bodyBlocksJson?.trim()
    if (raw) {
      try {
        const p = JSON.parse(raw) as unknown
        if (Array.isArray(p) && p.length > 0) return p as PartialBlock[]
      } catch { /* */ }
    }
    return parseToInitialBlocks(contact.memo)
  }, [contact.id, contact.bodyBlocksJson, contact.memo])

  const editor = useCreateBlockNote({ initialContent: initialBlocks, uploadFile }, [contact.id])

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
    runDebounced(() => {
      const json = JSON.stringify(editor.document)
      setDraft(d => {
        const next = { ...d, bodyBlocksJson: json }
        schedulePersist(next)
        return next
      })
    })
  }, editor)

  const patch = useCallback((partial: Partial<NetworkContact>) => {
    setDraft(d => {
      const next = { ...d, ...partial }
      schedulePersist(next)
      return next
    })
  }, [schedulePersist])

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
        console.error('[Network 드롭]', err)
      } finally {
        setDropUploading(false)
      }
    },
    [editor, uploadFile],
  )

  const toggleBenefit = (id: NetworkBenefitId) => {
    const benefits = draft.benefits.includes(id) ? draft.benefits.filter(x => x !== id) : [...draft.benefits, id]
    patch({ benefits })
  }

  const addHistory = async () => {
    if (!histDate.trim()) return
    const entry: NetworkHistoryEntry = {
      id: newHistoryId(),
      date: histDate,
      title: histTitle.trim() || '기록',
      summary: histSummary.trim(),
    }
    let syncedId: string | undefined
    if (isSupabaseReady) {
      const calId = await syncNetworkHistoryToCalendar(draft.id, draft.name, entry)
      if (calId) syncedId = calId
    }
    const withSync: NetworkHistoryEntry = syncedId ? { ...entry, syncedCalendarEventId: syncedId } : entry
    const nextEntries = [withSync, ...draft.historyEntries]
    setHistTitle('')
    setHistSummary('')
    patch({ historyEntries: nextEntries })
  }

  const removeHistory = async (hid: string) => {
    const h = draft.historyEntries.find(x => x.id === hid)
    if (h?.syncedCalendarEventId) await removeNetworkHistoryFromCalendar(h.syncedCalendarEventId)
    patch({ historyEntries: draft.historyEntries.filter(x => x.id !== hid) })
  }

  const previewLine = useMemo(() => {
    const raw = draft.bodyBlocksJson || draft.memo
    return blockNoteToPlainPreview(raw, 160)
  }, [draft.bodyBlocksJson, draft.memo])

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Sticky: 누구 카드인지 항상 표시 */}
      <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            목록
          </button>
          <div className="flex-1 min-w-[160px]">
            <input
              value={draft.name}
              onChange={e => patch({ name: e.target.value })}
              className="w-full text-lg sm:text-xl font-black text-slate-900 border-none bg-transparent outline-none focus:ring-2 focus:ring-indigo-200 rounded-lg px-0.5"
              placeholder="이름"
            />
            <p className="text-xs text-slate-600 font-medium truncate mt-0.5">
              {[draft.roleTitle, draft.org].filter(Boolean).join(' · ') || '직함 · 소속'}
            </p>
            <p className="text-[10px] text-slate-400 truncate">{previewLine || '본문 미리보기'}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!confirm('명부에서 삭제할까요?')) return
              onDelete(draft.id)
              onBack()
            }}
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-100 shrink-0"
          >
            삭제
          </button>
        </div>
      </header>

      {/* 상단: 인적 정보 관리 */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10">
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-4 sm:p-6 mb-2">
          <p className="text-[11px] font-black text-indigo-600 uppercase tracking-wider mb-1">Contact management</p>
          <h2 className="text-base font-bold text-slate-900 m-0">인적 정보</h2>
          <p className="text-xs text-slate-500 mt-1 m-0">연락처, 전략 필드, 노트 본문, 관계 히스토리를 한 그룹으로 관리합니다.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-8 items-start">
        {/* 속성 패널 — 데스크톱에서 왼쪽 */}
        <aside className="lg:sticky lg:top-[88px] space-y-4 max-h-[calc(100vh-120px)] overflow-y-auto lg:order-1 order-2 pl-0 lg:pr-1">
          <PropCard title="기본 · 연락처">
            <Field label="직함 · 역할" value={draft.roleTitle} onChange={v => patch({ roleTitle: v })} />
            <Field label="소속" value={draft.org} onChange={v => patch({ org: v })} />
            <Field label="전화" value={draft.phone} onChange={v => patch({ phone: v })} />
            <Field label="이메일" value={draft.email} onChange={v => patch({ email: v })} />
            <Field label="홈페이지 · SNS" value={draft.links} onChange={v => patch({ links: v })} rows={2} />
          </PropCard>

          <PropCard title="관계 · 전문성">
            <Field label="어떻게 아는 사람인지" value={draft.relationship} onChange={v => patch({ relationship: v })} rows={2} />
            <Field label="핵심 전문 분야" value={draft.expertise} onChange={v => patch({ expertise: v })} rows={2} />
            <Field label="가치관 · 철학" value={draft.valuesPhilosophy} onChange={v => patch({ valuesPhilosophy: v })} rows={3} />
            <Field label="그 사람의 네트워크" value={draft.theirNetwork} onChange={v => patch({ theirNetwork: v })} rows={2} />
          </PropCard>

          <PropCard title="전략적 관계 자산">
            <Field label="욕망 · 니즈" value={draft.theirNeeds} onChange={v => patch({ theirNeeds: v })} rows={2} />
            <Field label="내가 줄 수 있는 것" value={draft.myContribution} onChange={v => patch({ myContribution: v })} rows={2} />
            <Field label="인적자원 활용 핵심 (시너지)" value={draft.synergyPoint} onChange={v => patch({ synergyPoint: v })} rows={2} />
            <Field label="다음 액션 플랜" value={draft.nextActionPlan} onChange={v => patch({ nextActionPlan: v })} rows={2} />
            <Field label="나에게 이로운 점 (요약)" value={draft.valueToMe} onChange={v => patch({ valueToMe: v })} rows={2} />
          </PropCard>

          <PropCard title="혜택 태그 · 강도">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {BENEFIT_OPTIONS.map(o => {
                const on = draft.benefits.includes(o.id)
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggleBenefit(o.id)}
                    className={`text-[11px] font-bold px-2 py-1 rounded-full border ${on ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-600'}`}
                  >
                    {o.emoji} {o.short}
                  </button>
                )
              })}
            </div>
            <label className="text-xs font-bold text-slate-500 uppercase">관계 강도 {draft.strength}</label>
            <input
              type="range"
              min={1}
              max={5}
              value={draft.strength}
              onChange={e => patch({ strength: Number(e.target.value) })}
              className="w-full mt-1"
            />
          </PropCard>

          <PropCard title="히스토리 · 데이터">
            <Field label="첫 만남 · 특별한 추억" value={draft.firstMeetingMemory} onChange={v => patch({ firstMeetingMemory: v })} rows={3} />
            <Field label="갈등 기록" value={draft.conflictNotes} onChange={v => patch({ conflictNotes: v })} rows={3} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">생일</label>
                <input
                  type="date"
                  value={draft.birthday}
                  onChange={e => patch({ birthday: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">최근 연락일</label>
                <input
                  type="date"
                  value={draft.lastContactDate}
                  onChange={e => patch({ lastContactDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                />
              </div>
            </div>
            <Field label="기념일 메모" value={draft.anniversaryNote} onChange={v => patch({ anniversaryNote: v })} rows={2} />
            <Field label="최근 연락 내용" value={draft.lastContactSummary} onChange={v => patch({ lastContactSummary: v })} rows={2} />
            <Field label="도움을 준" value={draft.giveHelp} onChange={v => patch({ giveHelp: v })} rows={2} />
            <Field label="도움을 받은" value={draft.receiveHelp} onChange={v => patch({ receiveHelp: v })} rows={2} />
            <Field label="감동 포인트 · TMI" value={draft.tmi} onChange={v => patch({ tmi: v })} rows={3} />
          </PropCard>

          <PropCard title="레거시 메모">
            <Field label="짧은 메모 (이전 필드)" value={draft.memo} onChange={v => patch({ memo: v })} rows={2} />
          </PropCard>
        </aside>

        {/* 본문 + 히스토리 — 데스크톱에서 오른쪽 */}
        <div className="space-y-8 min-w-0 lg:order-2 order-1">
          <section className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80">
              <h2 className="text-sm font-bold text-slate-800 tracking-tight">노트 본문</h2>
              <p className="text-xs text-slate-500 mt-0.5">슬래시(/)로 블록 추가 · 파일을 끌어다 놓으면 업로드 후 삽입됩니다.</p>
            </div>
            <div
              className={`relative min-h-[320px] ${dragOver ? 'ring-2 ring-indigo-400 ring-inset bg-indigo-50/30' : ''}`}
              onDragOver={e => {
                if (e.dataTransfer?.types?.includes('Files')) {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'copy'
                }
              }}
              onDragEnter={e => {
                if (e.dataTransfer?.types?.includes('Files')) {
                  e.preventDefault()
                  setDragOver(true)
                }
              }}
              onDragLeave={e => {
                const rel = e.relatedTarget as Node | null
                if (!rel || !e.currentTarget.contains(rel)) setDragOver(false)
              }}
              onDrop={handleDrop}
            >
              {dropUploading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-sm font-semibold text-indigo-600">
                  업로드 중…
                </div>
              )}
              <div className="p-2 sm:p-4 [&_.bn-editor]:min-h-[280px]">
                <BlockNoteView editor={editor} theme="light" editable />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/90 bg-white shadow-sm p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-900">히스토리 타임라인</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              날짜 기준으로 관계 사건을 쌓습니다. Supabase 연결 시 <strong className="text-indigo-600">통합 캘린더</strong>(event)에도 같은 날짜로 표시됩니다.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 mb-4">
              <input type="date" value={histDate} onChange={e => setHistDate(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-sm" />
              <input
                value={histTitle}
                onChange={e => setHistTitle(e.target.value)}
                placeholder="제목 (예: 전시 오프닝)"
                className="flex-1 min-w-[140px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void addHistory()}
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm font-bold hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4" />
                추가
              </button>
            </div>
            <textarea
              value={histSummary}
              onChange={e => setHistSummary(e.target.value)}
              placeholder="요약 / 어디서 무엇을 나눴는지"
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-4"
            />
            <ul className="space-y-3">
              {draft.historyEntries.length === 0 ? (
                <li className="text-sm text-slate-400 py-6 text-center border border-dashed border-slate-200 rounded-xl">아직 기록이 없습니다.</li>
              ) : (
                draft.historyEntries.map(h => (
                  <li key={h.id} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                    <div className="text-xs font-mono text-slate-500 w-[88px] shrink-0">{h.date}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm">{h.title}</p>
                      {h.summary && <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{h.summary}</p>}
                      {h.syncedCalendarEventId && (
                        <p className="text-[10px] text-emerald-600 font-semibold mt-1">캘린더 동기화됨</p>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label="삭제"
                      onClick={() => void removeHistory(h.id)}
                      className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </div>
      </div>

      {/* 하단: 인간관계론 (전역 매뉴얼) — 목록과 동일한 분리 카드 UI */}
      <NetworkHumanRelationsSection wrapperClassName="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 pt-4" />
    </div>
  )
}

function PropCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm p-4">
      <h3 className="text-[11px] font-black text-indigo-600 uppercase tracking-wider mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  rows = 1,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
      {rows > 1 ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={rows}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 outline-none resize-y min-h-[60px]"
        />
      ) : (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 outline-none"
        />
      )}
    </div>
  )
}
