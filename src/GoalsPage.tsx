import { useState, useEffect, useCallback, useRef } from 'react'
import { kvSet } from './lib/supabase'
import { GOALS_KV_KEY } from './kvSyncedKeys'
import { PersonLinkPicker } from './PersonLinkPicker'
import { GOALS_KV_ENTITY_ID, PERSON_ENTITY } from './personEntityTypes'
import {
  loadEmotionalLens,
  saveEmotionalLens,
  type EmotionalLensPayload,
} from './boardEmotionalLensData'

/** v2: 현실자각 + 인생 목표 분리 | v1: { text } 단일 호환 */
type GoalsPayloadV2 = { reality: string; goals: string }
type GoalsPayloadLegacy = { text: string }

function readGoalsFromStorage(): GoalsPayloadV2 {
  try {
    const raw = localStorage.getItem(GOALS_KV_KEY)
    if (!raw) return { reality: '', goals: '' }
    try {
      const p = JSON.parse(raw) as unknown
      if (typeof p !== 'object' || p === null) return { reality: '', goals: '' }
      const o = p as Record<string, unknown>
      if (typeof o.reality === 'string' || typeof o.goals === 'string') {
        return {
          reality: typeof o.reality === 'string' ? o.reality : '',
          goals: typeof o.goals === 'string' ? o.goals : '',
        }
      }
      if ('text' in o && typeof o.text === 'string') {
        return { reality: '', goals: (o as GoalsPayloadLegacy).text }
      }
    } catch {
      return { reality: '', goals: raw }
    }
  } catch {
    /* ignore */
  }
  return { reality: '', goals: '' }
}

/** 인생 목표 — app_kv + localStorage (현실자각 / 인생 목표 분리 저장) */
const EMOTIONAL_LENS_CELLS = [
  {
    key: 'past_pain' as const,
    title: '과거의 불행',
    hint: '이미 지나간 시기의 아픔·상실·후회',
    cardClass:
      'border border-slate-200/80 border-l-[3px] border-l-rose-500/45 bg-rose-50/50',
  },
  {
    key: 'past_joy' as const,
    title: '과거의 행복',
    hint: '그때 기억하는 기쁨·성취·따뜻했던 순간',
    cardClass:
      'border border-slate-200/80 border-l-[3px] border-l-amber-500/50 bg-amber-50/50',
  },
  {
    key: 'present_pain' as const,
    title: '현재의 불행',
    hint: '지금 겪는 부담·불안·막막함',
    cardClass:
      'border border-slate-200/80 border-l-[3px] border-l-slate-500/45 bg-slate-50/80',
  },
  {
    key: 'present_joy' as const,
    title: '현재의 행복',
    hint: '지금 느끼는 소소한 만족·감사·생기',
    cardClass:
      'border border-slate-200/80 border-l-[3px] border-l-emerald-500/45 bg-emerald-50/50',
  },
] as const

export function GoalsPage() {
  const [reality, setReality] = useState('')
  const [goals, setGoals] = useState('')
  const [saved, setSaved] = useState(false)

  const [emotionalLens, setEmotionalLens] = useState<EmotionalLensPayload>(() => loadEmotionalLens())
  const lensSaveSkipFirst = useRef(true)
  const lensFlashHideRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [lensSavedFlash, setLensSavedFlash] = useState(false)

  useEffect(() => {
    if (lensSaveSkipFirst.current) {
      lensSaveSkipFirst.current = false
      return
    }
    const t = window.setTimeout(() => {
      saveEmotionalLens(emotionalLens)
      setLensSavedFlash(true)
      if (lensFlashHideRef.current) clearTimeout(lensFlashHideRef.current)
      lensFlashHideRef.current = window.setTimeout(() => {
        setLensSavedFlash(false)
        lensFlashHideRef.current = null
      }, 1200)
    }, 550)
    return () => {
      window.clearTimeout(t)
      if (lensFlashHideRef.current) {
        clearTimeout(lensFlashHideRef.current)
        lensFlashHideRef.current = null
      }
    }
  }, [emotionalLens])

  useEffect(() => {
    const { reality: r, goals: g } = readGoalsFromStorage()
    setReality(r)
    setGoals(g)
  }, [])

  const persist = useCallback((nextReality: string, nextGoals: string) => {
    const payload: GoalsPayloadV2 = { reality: nextReality, goals: nextGoals }
    try {
      localStorage.setItem(GOALS_KV_KEY, JSON.stringify(payload))
      void kvSet(GOALS_KV_KEY, payload)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1500)
    } catch {
      /* ignore */
    }
  }, [])

  const saveAll = useCallback(() => {
    persist(reality, goals)
  }, [persist, reality, goals])

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 pb-20 sm:px-6 lg:px-10">
      <header className="mb-10 max-w-2xl">
        <h1 className="m-0 text-2xl font-extrabold tracking-tight text-slate-900">Goals</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          지금의 나를 바로 보는 <strong className="text-slate-800">현실자각</strong>과, 당길 방향의{' '}
          <strong className="text-violet-800">인생의 목표</strong>를 나란히 두었습니다. 두 영역 사이에
          의도적으로 간격을 두어, 각각에 집중할 수 있게 했습니다.
        </p>
        <div className="mt-6 max-w-xl">
          <PersonLinkPicker entityType={PERSON_ENTITY.GOALS_KV} entityId={GOALS_KV_ENTITY_ID} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16 xl:gap-24">
        {/* 현실자각 */}
        <section
          className="flex min-h-[min(420px,60vh)] flex-col rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50 to-slate-100/50 p-6 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset] sm:p-8"
          aria-labelledby="goals-reality-heading"
        >
          <div className="mb-4 border-b border-slate-200/80 pb-4">
            <h2 id="goals-reality-heading" className="m-0 text-lg font-bold text-slate-800">
              현실자각
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              지금 서 있는 위치, 자원, 제약, 감정을 솔직히 적습니다. 피하지 않고 볼수록, 다음 목표가
              현실적으로 달라집니다.
            </p>
          </div>
          <textarea
            value={reality}
            onChange={e => setReality(e.target.value)}
            onBlur={() => void persist(reality, goals)}
            placeholder="예: 지금의 건강·시간·돈·관계·환경·반복되는 패턴…"
            className="min-h-[240px] w-full flex-1 resize-y rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-[15px] leading-relaxed text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void saveAll()}
              className="rounded-full bg-slate-800 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-900"
            >
              저장
            </button>
            {saved && <span className="text-sm font-semibold text-emerald-600">저장됨</span>}
          </div>
        </section>

        {/* 인생의 목표 */}
        <section
          className="flex min-h-[min(420px,60vh)] flex-col rounded-2xl border border-violet-200/80 bg-gradient-to-b from-violet-50/90 to-indigo-50/40 p-6 shadow-[0_1px_0_rgba(255,255,255,0.85)_inset] sm:p-8"
          aria-labelledby="goals-life-heading"
        >
          <div className="mb-4 border-b border-violet-200/70 pb-4">
            <h2 id="goals-life-heading" className="m-0 text-lg font-bold text-violet-950">
              인생의 목표
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-violet-900/70">
              당기고 싶은 미래를 구체적으로 적습니다. 현실자각과 대비해 두면, 갭을 메우려는 힘이
              생깁니다.
            </p>
          </div>
          <textarea
            value={goals}
            onChange={e => setGoals(e.target.value)}
            onBlur={() => void persist(reality, goals)}
            placeholder="예: 5년 안에 · 건강 · 관계 · 일 · 재정 · 배움 · 삶의 방향…"
            className="min-h-[240px] w-full flex-1 resize-y rounded-xl border border-violet-200/90 bg-white/95 px-4 py-3 text-[15px] leading-relaxed text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void saveAll()}
              className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700"
            >
              저장
            </button>
            {saved && <span className="text-sm font-semibold text-emerald-600">저장됨</span>}
          </div>
        </section>
      </div>

      <section
        className="mt-16 border-t border-slate-200/90 pt-12"
        aria-labelledby="goals-emotional-lens-heading"
      >
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <div className="max-w-2xl">
            <h2
              id="goals-emotional-lens-heading"
              className="m-0 text-lg font-bold tracking-tight text-slate-900"
            >
              감정 렌즈
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              과거와 현재의 불행·행복을 나란히 두고 보면서 맥락을 잃지 않도록 적어 둡니다. 수정하면 잠시 후 자동
              저장됩니다.
            </p>
          </div>
          {lensSavedFlash && (
            <span className="text-sm font-semibold text-emerald-600">저장됨</span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          {EMOTIONAL_LENS_CELLS.map(cell => (
            <div
              key={cell.key}
              className={`flex min-h-0 flex-col rounded-xl p-3 shadow-sm sm:p-4 ${cell.cardClass}`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="m-0 text-sm font-bold text-slate-900">{cell.title}</p>
                  <p className="mt-1 text-[11px] leading-snug text-slate-500">{cell.hint}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!emotionalLens[cell.key].trim()) return
                    if (!confirm('이 칸 내용을 지울까요?')) return
                    setEmotionalLens(prev => ({ ...prev, [cell.key]: '' }))
                  }}
                  className="shrink-0 rounded-lg border border-slate-200/90 bg-white/80 px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-50"
                >
                  비우기
                </button>
              </div>
              <textarea
                value={emotionalLens[cell.key]}
                onChange={e => setEmotionalLens(prev => ({ ...prev, [cell.key]: e.target.value }))}
                placeholder="짧게 적어도 됩니다."
                rows={4}
                className="min-h-[5.5rem] w-full flex-1 resize-y rounded-lg border border-slate-200/90 bg-white/90 px-3 py-2.5 text-sm leading-relaxed text-slate-800 shadow-inner placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
