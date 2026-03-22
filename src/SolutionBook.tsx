/**
 * Fortune — 해결의 책 (커버 클릭 → 랜덤 한 줄 답)
 */
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { insertSolutionBookEvent } from './supabase'
import { SOLUTION_BOOK_PHRASES } from './solutionBookPhrases'

const MODAL_Z = 50080

/** 모달·접근성 등 한 줄로 쓸 때 */
const COVER_INSTRUCTION =
  '답을 얻고 싶은 질문을 충분히 생각한 후 여세요'

/** 좁은 카드에서 줄바꿈을 고정해 읽기 쉽게 */
const COVER_INSTRUCTION_LINES = [
  '답을 얻고 싶은 질문을',
  '충분히 생각한 후 여세요',
] as const

function pickRandomPhrase(): string {
  const list = SOLUTION_BOOK_PHRASES
  if (list.length === 0) return '—'
  return list[Math.floor(Math.random() * list.length)]!
}

export function SolutionBookDeckCard({
  onOpen,
  isMobile,
}: {
  onOpen: () => void
  isMobile: boolean
}) {
  const w = isMobile ? '140px' : '160px'
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex shrink-0 cursor-pointer flex-col overflow-hidden rounded-xl border text-left transition-all"
      style={{
        width: w,
        borderColor: 'rgba(212, 175, 55, 0.35)',
        background:
          'linear-gradient(165deg, #4a0c0c 0%, #320808 42%, #1f0505 100%)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.07)',
      }}
      aria-label="해결의 책 열기"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E")`,
        }}
      />
      <div
        className="relative flex min-h-[132px] flex-col items-center justify-center gap-3 px-3 pb-3 pt-3"
      >
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 bg-black/30"
          style={{
            borderColor: 'rgba(253, 230, 138, 0.65)',
            boxShadow: 'inset 0 0 22px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.35)',
          }}
        >
          <BookOpen className="h-7 w-7" strokeWidth={1.75} style={{ color: '#FFEFD5' }} />
        </div>
        <div
          className="w-full rounded-md px-2 py-2 text-center"
          style={{
            background: 'rgba(0,0,0,0.42)',
            border: '1px solid rgba(212, 175, 55, 0.2)',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.35)',
          }}
        >
          <p
            className="m-0 text-[10px] font-semibold leading-[1.4]"
            style={{
              color: '#F5EFE6',
              textShadow: '0 1px 2px rgba(0,0,0,0.75)',
              fontFamily: 'system-ui, -apple-system, "Malgun Gothic", sans-serif',
              letterSpacing: '-0.02em',
            }}
          >
            {COVER_INSTRUCTION_LINES.map((line, i) => (
              <span key={i} className={i === 0 ? 'block' : 'mt-0.5 block'}>
                {line}
              </span>
            ))}
          </p>
        </div>
      </div>
      <div
        className="relative border-t px-2 py-2.5 text-center text-[11px] font-extrabold"
        style={{
          borderColor: 'rgba(255,255,255,0.12)',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.5) 100%)',
          color: '#FFFEF5',
          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
        }}
      >
        열기 →
      </div>
    </button>
  )
}

export function SolutionBookModal({
  open,
  onClose,
  onArchived,
}: {
  open: boolean
  onClose: () => void
  /** 점괘 아카이브에 저장된 뒤 목록 새로고침 */
  onArchived?: () => void
}) {
  const [phase, setPhase] = useState<'cover' | 'answer'>('cover')
  const [phrase, setPhrase] = useState('')

  useEffect(() => {
    if (!open) return
    setPhase('cover')
    setPhrase('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const openBook = useCallback(async () => {
    const p = pickRandomPhrase()
    setPhrase(p)
    setPhase('answer')
    const row = await insertSolutionBookEvent(p)
    if (row) onArchived?.()
  }, [onArchived])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="solution-book-title"
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{
        zIndex: MODAL_Z,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(6px)',
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {phase === 'cover' ? (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            void openBook()
          }}
          className="relative max-h-[min(92vh,640px)] w-full max-w-md overflow-hidden rounded-2xl border-2 border-amber-600/40 text-left shadow-2xl transition-transform hover:scale-[1.01] active:scale-[0.99]"
          style={{
            background: 'linear-gradient(165deg, #5c1010 0%, #3d0a0a 50%, #1f0505 100%)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E")`,
            }}
          />
          <div
            className="pointer-events-none absolute bottom-0 left-0 top-0 w-[18px] border-r border-amber-900/30"
            style={{
              background: 'linear-gradient(90deg, rgba(212,175,55,0.12), transparent)',
            }}
          />
          <div
            className="pointer-events-none absolute bottom-0 right-0 top-0 w-[18px] border-l border-amber-900/30"
            style={{
              background: 'linear-gradient(270deg, rgba(212,175,55,0.12), transparent)',
            }}
          />
          <div className="relative flex flex-col items-center px-8 pb-10 pt-12">
            <h2
              id="solution-book-title"
              className="m-0 text-center text-2xl font-black tracking-tight"
              style={{
                color: '#FFF8E7',
                fontFamily: "'Noto Serif KR', 'Nanum Myeongjo', Georgia, serif",
                textShadow: '0 2px 10px rgba(0,0,0,0.75), 0 0 1px rgba(0,0,0,0.9)',
              }}
            >
              해결의 책
            </h2>
            <div className="mt-2 h-px w-24 bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
            <div
              className="mt-8 flex h-28 w-28 items-center justify-center rounded-full border-2 border-amber-500/45 bg-black/25"
              style={{ boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5)' }}
            >
              <BookOpen className="h-14 w-14 text-amber-200/95" strokeWidth={1.5} />
            </div>
            <div
              className="mt-10 max-w-sm rounded-xl px-4 py-3 text-center"
              style={{
                background: 'rgba(0,0,0,0.38)',
                border: '1px solid rgba(212, 175, 55, 0.25)',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
              }}
            >
              <p
                className="m-0 text-sm font-semibold leading-relaxed"
                style={{
                  color: '#F5EFE6',
                  textShadow: '0 1px 3px rgba(0,0,0,0.65)',
                  fontFamily: 'system-ui, -apple-system, "Malgun Gothic", sans-serif',
                }}
              >
                {COVER_INSTRUCTION}
              </p>
            </div>
            <p
              className="mt-8 text-xs font-bold"
              style={{ color: '#FDE68A', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}
            >
              클릭하여 펼치기
            </p>
          </div>
        </button>
      ) : (
        <div
          className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-amber-900/25 shadow-2xl"
          style={{
            background:
              'linear-gradient(145deg, #f7efd8 0%, #efe4cc 35%, #e8dcc0 70%, #dccfb0 100%)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.35), inset 0 0 80px rgba(139,90,43,0.06)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div
            className="pointer-events-none absolute inset-3 rounded-lg border-2 border-[#5c4030]/35"
            style={{
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25)',
            }}
          />
          <div
            className="pointer-events-none absolute inset-5 rounded-md border border-[#5c4030]/20"
            style={{
              background:
                'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(92,64,48,0.03) 2px, rgba(92,64,48,0.03) 3px)',
            }}
          />
          <div className="relative px-8 py-12 sm:px-12 sm:py-14">
            <p
              className="m-0 mb-6 text-center text-xs font-bold uppercase tracking-[0.2em] text-[#5c4030]/75"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              내 고민의 답은?
            </p>
            <p
              className="m-0 text-center text-lg font-semibold leading-relaxed text-[#2d2118] sm:text-xl"
              style={{
                fontFamily: "'Noto Serif KR', 'Nanum Myeongjo', Georgia, serif",
                textShadow: '0 1px 0 rgba(255,255,255,0.4)',
              }}
            >
              {phrase}
            </p>
          </div>
          <div className="relative flex items-center justify-center gap-6 border-t border-[#5c4030]/15 bg-black/[0.03] px-4 py-4">
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  const p = pickRandomPhrase()
                  setPhrase(p)
                  const row = await insertSolutionBookEvent(p)
                  if (row) onArchived?.()
                })()
              }}
              className="rounded-lg border border-[#5c4030]/25 bg-white/40 px-3 py-2 text-xs font-bold text-[#5c4030] hover:bg-white/70"
            >
              다시 뽑기
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#5c4030]/30 bg-[#5c4030]/90 px-5 py-2 text-xs font-bold text-amber-50 hover:bg-[#4a3328]"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
