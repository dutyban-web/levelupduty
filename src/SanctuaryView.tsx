/**
 * 수호신의 신전 — 일일 KPT 회고, 운명 월드컵, 타로 계시
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react'
import { X, ChevronLeft, Sparkles, Swords, Scale } from 'lucide-react'
import type { IdentityRow, ProjectRow } from './supabase'
import { DialogueBox } from './DialogueBox'
import { getTodayKpt, upsertTodayKpt } from './sanctuaryData'
import {
  applySanctuaryFailureAssetBonus,
  applySanctuaryRiteCompleteBonus,
} from './questRpgIntegration'

const BG_URL = '/sanctuary-throne-bg.png'

export type SanctuaryQuest = { id: string; name: string; identityId?: string | null }

export type SanctuaryViewProps = {
  onClose: () => void
  quests: SanctuaryQuest[]
  completedQuestIds: string[]
  activeIdentityId: string | null
  identities: IdentityRow[]
  projects: ProjectRow[]
  adjustXp: (delta: number) => void
  fireToast: (msg: string) => void
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildAlignmentPct(
  quests: SanctuaryQuest[],
  completedQuestIds: string[],
  activeIdentityId: string | null,
): number {
  if (!activeIdentityId) return 68
  const done = completedQuestIds.filter(id => {
    const q = quests.find(x => x.id === id)
    return q && String(q.identityId ?? '') === String(activeIdentityId)
  }).length
  const total = completedQuestIds.length
  if (total === 0) return 74
  return Math.min(99, Math.max(41, Math.round((100 * done) / total)))
}

function pickFortressName(projects: ProjectRow[]): string {
  const hit = projects.find(p => /공학|요새|연구|개발|코드/i.test(p.name))
  return hit?.name ?? '공학의 요새'
}

type CupState = { q: string[]; nr: string[]; cur: [string, string] | null; champ: string | null }

function tryAdvanceCup(s: CupState): CupState {
  if (s.cur || s.champ) return s
  let { q, nr } = s
  if (q.length === 0) {
    if (nr.length === 0) return s
    if (nr.length === 1) return { q: [], nr: [], cur: null, champ: nr[0] }
    q = shuffle([...nr])
    nr = []
  }
  if (q.length === 1) {
    return tryAdvanceCup({ q: [], nr: [...nr, q[0]], cur: null, champ: null })
  }
  return { q: q.slice(2), nr, cur: [q[0], q[1]], champ: null }
}

function cupReducer(s: CupState, a: { type: 'reset' } | { type: 'start'; names: string[] } | { type: 'pick'; left: boolean }): CupState {
  if (a.type === 'reset') return { q: [], nr: [], cur: null, champ: null }
  if (a.type === 'start') {
    if (a.names.length < 2) return s
    return tryAdvanceCup({ q: shuffle([...a.names]), nr: [], cur: null, champ: null })
  }
  if (!s.cur) return s
  const w = a.left ? s.cur[0] : s.cur[1]
  return tryAdvanceCup({ ...s, cur: null, nr: [...s.nr, w] })
}

export function SanctuaryView({
  onClose,
  quests,
  completedQuestIds,
  activeIdentityId,
  identities,
  projects,
  adjustXp,
  fireToast,
}: SanctuaryViewProps) {
  const [sub, setSub] = useState<'main' | 'rite' | 'cup' | 'tarot'>('main')
  const [keep, setKeep] = useState('')
  const [problem, setProblem] = useState('')
  const [tryText, setTryText] = useState('')
  const [failureAssetized, setFailureAssetized] = useState(false)
  const [assetFx, setAssetFx] = useState(false)
  const [lightBeam, setLightBeam] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportBody, setReportBody] = useState('')

  const identityName =
    activeIdentityId != null
      ? identities.find(i => String(i.id) === String(activeIdentityId))?.name ?? null
      : null

  const incomplete = useMemo(
    () => quests.filter(q => !completedQuestIds.includes(q.id)),
    [quests, completedQuestIds],
  )

  const [cupSelected, setCupSelected] = useState<string[]>([])
  const [cup, dispatchCup] = useReducer(cupReducer, { q: [], nr: [], cur: null, champ: null } as CupState)

  const [tarotCard, setTarotCard] = useState<'judgement' | 'justice' | null>(null)
  const [tarotFlipping, setTarotFlipping] = useState(false)

  const resetCup = useCallback(() => {
    setCupSelected([])
    dispatchCup({ type: 'reset' })
  }, [])

  const startCup = useCallback(() => {
    if (cupSelected.length < 2) {
      fireToast('미완료 퀘스트를 2개 이상 선택하세요.')
      return
    }
    dispatchCup({ type: 'start', names: cupSelected })
  }, [cupSelected, fireToast])

  const pickCup = useCallback(
    (side: 'left' | 'right') => {
      dispatchCup({ type: 'pick', left: side === 'left' })
    },
    [],
  )

  const cupLeft = cup.cur?.[0] ?? null
  const cupRight = cup.cur?.[1] ?? null
  const cupChampion = cup.champ

  const lastChampRef = useRef<string | null>(null)
  useEffect(() => {
    if (!cup.champ) {
      lastChampRef.current = null
      return
    }
    if (cup.champ !== lastChampRef.current) {
      lastChampRef.current = cup.champ
      fireToast(`우선순위 1위: ${cup.champ}`)
    }
  }, [cup.champ, fireToast])

  const openTarot = useCallback(() => {
    setTarotFlipping(true)
    setTarotCard(null)
    window.setTimeout(() => {
      const card = Math.random() < 0.5 ? 'judgement' : 'justice'
      setTarotCard(card)
      setTarotFlipping(false)
      fireToast(card === 'judgement' ? '심판 — 끝을 향한 부름이 들립니다.' : '정의 — 저울이 한쪽으로 기울어집니다.')
    }, 700)
  }, [fireToast])

  const runAssetize = () => {
    const p = problem.trim()
    if (!p) {
      fireToast('Problem에 적힌 실패가 있어야 제련할 수 있습니다.')
      return
    }
    setTryText(prev => (prev.trim() ? `${prev}\n\n— 제련: ${p}` : `다음에 시도: ${p}`))
    setFailureAssetized(true)
    setAssetFx(true)
    const g = applySanctuaryFailureAssetBonus()
    adjustXp(14)
    fireToast(`실패가 자산으로 제련되었습니다 · +${g} G · +14 EXP`)
    window.setTimeout(() => setAssetFx(false), 1400)
  }

  const completeRite = () => {
    if (!keep.trim() && !problem.trim() && !tryText.trim()) {
      fireToast('Keep / Problem / Try 중 하나 이상을 적어 주세요.')
      return
    }
    upsertTodayKpt({
      date: todayYmd(),
      keep: keep.trim(),
      problem: problem.trim(),
      try: tryText.trim(),
      failureAssetized,
    })
    applySanctuaryRiteCompleteBonus()
    adjustXp(10)

    const align = buildAlignmentPct(quests, completedQuestIds, activeIdentityId)
    const fort = pickFortressName(projects)
    const idLine = identityName
      ? `태세 「${identityName}」와 오늘의 궤적이 ${align}%의 공명을 이루었습니다.`
      : `오늘의 정체성 일치율은 ${align}%입니다.`
    const body = `${idLine}\n\n내일은 「${fort}」에서 더 큰 전투가 기다립니다. 잠들기 전 한 줄만 — 오늘의 나는 선택의 무게를 견뎠습니다.`
    setReportBody(body)
    setLightBeam(true)
    fireToast('제례가 마무리되었습니다 · +10 EXP')
    window.setTimeout(() => {
      setReportOpen(true)
      setLightBeam(false)
    }, 1600)
  }

  const loadToday = () => {
    const ex = getTodayKpt(todayYmd())
    if (ex) {
      setKeep(ex.keep)
      setProblem(ex.problem)
      setTryText(ex.try)
      setFailureAssetized(ex.failureAssetized)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 550,
        overflow: 'auto',
        background: '#0a1628',
      }}
    >
      <style>{`
        @keyframes san-light {
          0% { opacity: 0; transform: translateY(-12%) scale(0.96); }
          40% { opacity: 1; }
          100% { opacity: 0.85; transform: translateY(8%) scale(1.02); }
        }
        @keyframes san-asset {
          0% { filter: brightness(1); box-shadow: 0 0 0 rgba(251,191,36,0); }
          40% { filter: brightness(1.35); box-shadow: 0 0 32px rgba(251,191,36,0.65); }
          100% { filter: brightness(1); box-shadow: 0 0 0 rgba(251,191,36,0); }
        }
        @keyframes san-flip {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(180deg); }
        }
      `}</style>

      {lightBeam && (
        <div
          style={{
            position: 'fixed',
            left: '20%',
            right: '20%',
            top: 0,
            height: '65vh',
            pointerEvents: 'none',
            zIndex: 560,
            background:
              'linear-gradient(180deg, rgba(254,243,199,0.55) 0%, rgba(251,191,36,0.15) 35%, transparent 85%)',
            animation: 'san-light 1.5s ease-out forwards',
            mixBlendMode: 'screen',
          }}
        />
      )}

      <div
        style={{
          minHeight: '100%',
          backgroundImage: `linear-gradient(180deg, rgba(8,20,45,0.82) 0%, rgba(15,35,75,0.88) 40%, rgba(10,22,48,0.92) 100%), url(${BG_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          padding: '16px 16px 32px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => (sub === 'main' ? onClose() : setSub('main'))}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid rgba(251,191,36,0.35)',
              background: 'rgba(15,23,42,0.65)',
              color: '#fde68a',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {sub === 'main' ? <X size={16} /> : <ChevronLeft size={16} />}
            {sub === 'main' ? '닫기' : '신전으로'}
          </button>
          <span style={{ fontSize: 13, fontWeight: 900, color: '#fef3c7', letterSpacing: '0.15em', textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>
            THE SANCTUARY
          </span>
          <span style={{ width: 72 }} />
        </div>

        {sub === 'main' && (
          <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#bae6fd', fontWeight: 700 }}>운명의 전당</p>
            <h1 style={{ margin: '0 0 20px', fontSize: 22, color: '#fef3c7', textShadow: '0 0 24px rgba(251,191,36,0.35)' }}>
              수호신의 신전
            </h1>

            <div style={{ position: 'relative', marginBottom: 24, minHeight: 200 }}>
              <div
                style={{
                  fontSize: 72,
                  lineHeight: 1,
                  filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.5))',
                  marginBottom: 8,
                }}
              >
                🗿
              </div>
              <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>작가의 수호신 석상</p>

              <div
                style={{
                  marginTop: 20,
                  padding: '18px 16px',
                  borderRadius: 16,
                  border: '2px solid rgba(251,191,36,0.45)',
                  background: 'linear-gradient(180deg, rgba(15,23,42,0.92), rgba(30,58,138,0.5))',
                  boxShadow: '0 0 40px rgba(30,58,138,0.35), inset 0 0 60px rgba(251,191,36,0.06)',
                }}
              >
                <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, color: '#fde68a' }}>운명의 제단</p>
                <p style={{ margin: '0 0 14px', fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>
                  하루를 마감하는 제례와, 선택을 비교하는 운명의 도구가 이곳에 놓여 있습니다.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      loadToday()
                      setSub('rite')
                    }}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 12,
                      border: 'none',
                      background: 'linear-gradient(180deg, rgba(251,191,36,0.95), rgba(180,83,9,0.9))',
                      color: '#1a0505',
                      fontSize: 14,
                      fontWeight: 900,
                      cursor: 'pointer',
                      boxShadow: '0 4px 0 rgba(120,53,15,0.9)',
                    }}
                  >
                    제례 시작 (KPT)
                  </button>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        resetCup()
                        setSub('cup')
                      }}
                      style={btnSecondary}
                    >
                      <Swords size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                      이상형 월드컵
                    </button>
                    <button type="button" onClick={() => setSub('tarot')} style={btnSecondary}>
                      <Scale size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                      수호신의 계시
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {sub === 'rite' && (
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <h2 style={{ fontSize: 16, color: '#fef3c7', marginBottom: 12 }}>일일 제례 (KPT)</h2>
            <label style={lab}>Keep — 유지할 것</label>
            <textarea value={keep} onChange={e => setKeep(e.target.value)} style={ta} rows={3} placeholder="오늘 지켜낸 리듬, 좋았던 선택" />
            <label style={lab}>Problem — 문제</label>
            <textarea value={problem} onChange={e => setProblem(e.target.value)} style={ta} rows={3} placeholder="막혔던 지점, 아쉬움" />
            <label style={lab}>Try — 다음 시도</label>
            <textarea
              value={tryText}
              onChange={e => setTryText(e.target.value)}
              style={{ ...ta, animation: assetFx ? 'san-asset 1.2s ease' : undefined }}
              rows={4}
              placeholder="내일의 실험, 한 줄 행동"
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
              <button type="button" onClick={runAssetize} style={btnGoldOutline}>
                <Sparkles size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                실패 자산화 (Problem → Try)
              </button>
              <button type="button" onClick={completeRite} style={btnPrimary}>
                제례 완료
              </button>
            </div>
            {failureAssetized && (
              <p style={{ marginTop: 10, fontSize: 11, color: '#86efac' }}>실패가 원석으로 제련되었습니다. Try에 새겨졌습니다.</p>
            )}
          </div>
        )}

        {sub === 'cup' && (
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <h2 style={{ fontSize: 16, color: '#fef3c7', marginBottom: 8 }}>이상형 월드컵</h2>
            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
              미완료 퀘스트 중 고민되는 항목을 고르고, 1:1로 붙여 최종 우선순위를 정합니다.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, maxHeight: 200, overflowY: 'auto' }}>
              {incomplete.map(q => {
                const on = cupSelected.includes(q.name)
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() =>
                      setCupSelected(prev =>
                        on ? prev.filter(n => n !== q.name) : [...prev, q.name],
                      )
                    }
                    style={{
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: on ? '2px solid rgba(251,191,36,0.7)' : '1px solid rgba(148,163,184,0.35)',
                      background: on ? 'rgba(251,191,36,0.12)' : 'rgba(15,23,42,0.55)',
                      color: '#e2e8f0',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {on ? '✓ ' : ''}
                    {q.name}
                  </button>
                )
              })}
            </div>
            <button type="button" onClick={startCup} style={{ ...btnPrimary, marginBottom: 16 }}>
              대진표 생성
            </button>

            {cupLeft && cupRight && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <button type="button" onClick={() => pickCup('left')} style={cupCard}>
                  {cupLeft}
                </button>
                <button type="button" onClick={() => pickCup('right')} style={cupCard}>
                  {cupRight}
                </button>
              </div>
            )}
            {cupChampion && (
              <p style={{ fontSize: 14, fontWeight: 800, color: '#fde68a' }}>🏆 최종 선택: {cupChampion}</p>
            )}
          </div>
        )}

        {sub === 'tarot' && (
          <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ fontSize: 16, color: '#fef3c7', marginBottom: 8 }}>수호신의 계시</h2>
            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
              결정 장애일 때, 카드가 한쪽을 밝힙니다. Judgement 또는 Justice가 무작위로 나옵니다.
            </p>
            <div
              style={{
                perspective: 800,
                margin: '0 auto 16px',
                width: 200,
                height: 300,
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 12,
                  border: '2px solid rgba(251,191,36,0.5)',
                  background: tarotCard
                ? tarotCard === 'judgement'
                  ? 'linear-gradient(160deg, #1e3a5f, #0f172a)'
                  : 'linear-gradient(160deg, #312e81, #0f172a)'
                : 'linear-gradient(160deg, #334155, #0f172a)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fef3c7',
                  fontWeight: 800,
                  animation: tarotFlipping ? 'san-flip 0.7s ease-in-out' : undefined,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
                }}
              >
                {!tarotCard && !tarotFlipping && <span style={{ fontSize: 13 }}>카드를 뽑으세요</span>}
                {tarotCard === 'judgement' && (
                  <>
                    <span style={{ fontSize: 42, marginBottom: 8 }}>🎺</span>
                    <span style={{ fontSize: 15 }}>XX — Judgement</span>
                    <p style={{ fontSize: 11, marginTop: 12, padding: '0 12px', color: '#cbd5e1', fontWeight: 500 }}>
                      과거를 넘어 부름이 울립니다. 망설임보다 선언을 택하십시오.
                    </p>
                  </>
                )}
                {tarotCard === 'justice' && (
                  <>
                    <span style={{ fontSize: 42, marginBottom: 8 }}>⚖️</span>
                    <span style={{ fontSize: 15 }}>XI — Justice</span>
                    <p style={{ fontSize: 11, marginTop: 12, padding: '0 12px', color: '#cbd5e1', fontWeight: 500 }}>
                      저울은 한쪽으로 기울어집니다. 공정함이 아니라 선택이 필요합니다.
                    </p>
                  </>
                )}
              </div>
            </div>
            <button type="button" onClick={openTarot} style={btnPrimary} disabled={tarotFlipping}>
              계시 받기
            </button>
          </div>
        )}
      </div>

      {reportOpen && (
        <DialogueBox
          speaker="수호신"
          title="오늘의 총평"
          portrait="🛡️"
          onClose={() => {
            setReportOpen(false)
            setSub('main')
          }}
        >
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{reportBody}</p>
        </DialogueBox>
      )}
    </div>
  )
}

const lab: CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#fde68a',
  marginBottom: 6,
}

const ta: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: 10,
  borderRadius: 10,
  border: '1px solid rgba(100,116,139,0.45)',
  background: 'rgba(15,23,42,0.75)',
  color: '#f1f5f9',
  fontSize: 13,
  marginBottom: 12,
  resize: 'vertical' as const,
}

const btnPrimary: CSSProperties = {
  padding: '10px 18px',
  borderRadius: 10,
  border: 'none',
  background: 'linear-gradient(180deg, #6366f1, #4338ca)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
}

const btnSecondary: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid rgba(56,189,248,0.45)',
  background: 'rgba(14,165,233,0.12)',
  color: '#e0f2fe',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  flex: '1 1 140px',
}

const btnGoldOutline: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid rgba(251,191,36,0.55)',
  background: 'rgba(251,191,36,0.08)',
  color: '#fef3c7',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}

const cupCard: CSSProperties = {
  padding: '14px 10px',
  minHeight: 72,
  borderRadius: 12,
  border: '1px solid rgba(251,191,36,0.35)',
  background: 'rgba(15,23,42,0.75)',
  color: '#fef3c7',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}
