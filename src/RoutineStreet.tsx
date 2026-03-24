/**
 * 벨트스크롤 감성 루틴 트래커 — Evolution 루틴/습관 + 앵커 행동
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  loadEvolutionStore,
  saveEvolutionStore,
  upsertEvolutionItem,
  evolutionProgress,
  EVOLUTION_CATEGORY_LABEL,
  EVOLUTION_KEY,
  type EvolutionStore,
  type EvolutionItem,
} from './evolutionData'
import {
  loadStreetChain,
  saveStreetChain,
  buildDefaultChainFromEvolution,
  reconcileChain,
  newAnchorId,
  type StreetSegment,
} from './habitRoutineData'
import { addRpgGold, applyQuestCompleteRpgRewards, BL_RPG_SYNC } from './questRpgIntegration'
import { loadRpgProfile, type LevelupRpgProfile } from './levelupRpgProfile'

const COMBO_MS = 60_000
const FEVER_AT = 5
const FEVER_GOLD_MULT = 1.5
const GO_ARROW_MS = 2600
const SLOT_W = 168
const ANCHOR_W = 72
const GAP = 14

function offsetForSegmentIndex(segments: StreetSegment[], idx: number): number {
  let o = 0
  for (let i = 0; i < idx && i < segments.length; i++) {
    o += (segments[i].kind === 'anchor' ? ANCHOR_W : SLOT_W) + GAP
  }
  return o
}

type AnimState =
  | { kind: 'idle' }
  | { kind: 'busy'; segIdx: number; phase: 'dash' | 'strike' | 'fly' }

function findFirstIncompleteEvoIndex(segments: StreetSegment[], store: EvolutionStore): number {
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]
    if (s.kind !== 'evo') continue
    const it = store.items.find(x => x.id === s.evolutionItemId)
    if (it && !it.completed && it.is_deleted !== true) return i
  }
  return -1
}

export function RoutineStreet({ fireToast }: { fireToast: (msg: string) => void }) {
  const [store, setStore] = useState<EvolutionStore>(() => loadEvolutionStore())
  const [segments, setSegments] = useState<StreetSegment[]>(() => {
    const saved = loadStreetChain()
    const s0 = loadEvolutionStore()
    if (!saved?.length) return buildDefaultChainFromEvolution(s0)
    return reconcileChain(saved, s0)
  })
  const [rpg, setRpg] = useState<LevelupRpgProfile>(() => loadRpgProfile())
  const [anim, setAnim] = useState<AnimState>({ kind: 'idle' })
  const [combo, setCombo] = useState(0)
  const comboRef = useRef(0)
  const lastBeatRef = useRef(0)
  const [showGo, setShowGo] = useState(false)
  const [barFlash, setBarFlash] = useState(false)
  const [comboPopup, setComboPopup] = useState<number | null>(null)
  const [anchorLabel, setAnchorLabel] = useState('')
  /** 0 = 맨 앞, k = k번째 앞에 삽입 (splice 인덱스) */
  const [insertAt, setInsertAt] = useState(0)

  const refresh = useCallback(() => {
    setStore(loadEvolutionStore())
    setRpg(loadRpgProfile())
  }, [])

  useEffect(() => {
    const onSync = () => {
      setRpg(loadRpgProfile())
    }
    window.addEventListener(BL_RPG_SYNC, onSync)
    const onStorage = (e: StorageEvent) => {
      if (e.key === EVOLUTION_KEY) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(BL_RPG_SYNC, onSync)
      window.removeEventListener('storage', onStorage)
    }
  }, [refresh])

  useEffect(() => {
    setSegments(prev => {
      const next = reconcileChain(prev, store)
      if (next.length === 0 && buildDefaultChainFromEvolution(store).length > 0) {
        const seed = buildDefaultChainFromEvolution(store)
        saveStreetChain(seed)
        return seed
      }
      saveStreetChain(next)
      return next
    })
  }, [store])

  useEffect(() => {
    setInsertAt(i => Math.min(i, segments.length))
  }, [segments.length])

  const firstIdx = useMemo(() => findFirstIncompleteEvoIndex(segments, store), [segments, store])
  const fever = combo >= FEVER_AT

  const evoById = useMemo(() => {
    const m = new Map<string, EvolutionItem>()
    for (const it of store.items) m.set(it.id, it)
    return m
  }, [store.items])

  const [clock, setClock] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setClock(c => c + 1), 10_000)
    return () => clearInterval(t)
  }, [])
  void clock
  const timeStr = (() => {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
  })()

  const evoProg = evolutionProgress(store.totalEvolutionXp)
  const hpPct = rpg.hp[1] > 0 ? (100 * rpg.hp[0]) / rpg.hp[1] : 0
  const xpPct = evoProg.xpForNext > 0 ? (100 * evoProg.xpIntoLevel) / evoProg.xpForNext : 0

  const runComplete = useCallback(
    (segIdx: number) => {
      const seg = segments[segIdx]
      if (!seg || seg.kind !== 'evo') return
      const item = evoById.get(seg.evolutionItemId)
      if (!item || item.completed) return
      if (segIdx !== firstIdx) {
        fireToast('앞쪽 루틴부터 처리하세요.')
        return
      }

      setAnim({ kind: 'busy', segIdx, phase: 'dash' })
      window.setTimeout(() => setAnim(a => (a.kind === 'busy' ? { ...a, phase: 'strike' } : a)), 320)
      window.setTimeout(() => setAnim(a => (a.kind === 'busy' ? { ...a, phase: 'fly' } : a)), 520)

      window.setTimeout(() => {
        const now = Date.now()
        const prevT = lastBeatRef.current
        const within = prevT > 0 && now - prevT <= COMBO_MS
        lastBeatRef.current = now
        const nextCombo = within ? comboRef.current + 1 : 1
        comboRef.current = nextCombo
        setCombo(nextCombo)
        setComboPopup(nextCombo)

        const nowIso = new Date().toISOString()
        let st = loadEvolutionStore()
        st = upsertEvolutionItem(st, {
          ...item,
          completed: true,
          completedAt: nowIso,
        })
        saveEvolutionStore(st)
        setStore(st)

        const useFever = nextCombo >= FEVER_AT
        const baseGold = 5 + Math.round(item.evolutionPoints * 0.25)
        const goldAmt = Math.round(baseGold * (useFever ? FEVER_GOLD_MULT : 1))
        addRpgGold(goldAmt)
        applyQuestCompleteRpgRewards({ tags: ['routine', 'spirit'], projectName: '루틴 거리', areaName: 'BeautifulLife' })

        setSegments(prev => {
          const cut = prev.filter((s, i) => !(s.kind === 'evo' && s.evolutionItemId === item.id && i === segIdx))
          saveStreetChain(cut)
          return cut
        })

        setBarFlash(true)
        window.setTimeout(() => setBarFlash(false), 500)
        setShowGo(true)
        window.setTimeout(() => setShowGo(false), GO_ARROW_MS)
        window.setTimeout(() => setComboPopup(null), 900)

        fireToast(`루틴 격파 · +${goldAmt} G${useFever ? ' (피버×1.5)' : ''}`)
        setAnim({ kind: 'idle' })
      }, 1000)
    },
    [segments, evoById, firstIdx, fireToast],
  )

  const addAnchor = () => {
    const label = anchorLabel.trim()
    if (!label) {
      fireToast('앵커 이름을 입력하세요.')
      return
    }
    const id = newAnchorId()
    const pos = Math.min(segments.length, Math.max(0, insertAt))
    const next = [...segments.slice(0, pos), { kind: 'anchor' as const, id, label }, ...segments.slice(pos)]
    setSegments(next)
    saveStreetChain(next)
    setAnchorLabel('')
    fireToast('앵커가 삽입되었습니다.')
  }

  const removeAnchor = (id: string) => {
    if (!window.confirm('이 앵커를 제거할까요?')) return
    const next = segments.filter(s => !(s.kind === 'anchor' && s.id === id))
    setSegments(next)
    saveStreetChain(next)
  }

  const resetChainFromEvolution = () => {
    if (!window.confirm('거리 순서를 오늘의 미완료 루틴·습관 기준으로 다시 잡을까요?')) return
    const st = loadEvolutionStore()
    const next = buildDefaultChainFromEvolution(st)
    setSegments(next)
    saveStreetChain(next)
    fireToast('거리 순서를 새로 구성했습니다.')
  }

  const activeSegIdx = anim.kind === 'busy' ? anim.segIdx : -1
  const strikeOff =
    anim.kind === 'busy' ? offsetForSegmentIndex(segments, anim.segIdx) : 0

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 14,
        overflow: 'hidden',
        border: fever ? '3px solid transparent' : '1px solid rgba(0,0,0,0.12)',
        background: 'linear-gradient(180deg,#1a1528 0%,#2d1f3d 45%,#1e1a24 100%)',
        boxShadow: fever
          ? '0 0 0 3px #f97316, 0 0 24px rgba(249,115,22,0.65), inset 0 0 40px rgba(249,115,22,0.15)'
          : '0 8px 28px rgba(0,0,0,0.35)',
        animation: fever ? 'rs-fever-pulse 1.2s ease-in-out infinite' : undefined,
      }}
    >
      <style>{`
        @keyframes rs-fever-pulse {
          0%, 100% { box-shadow: 0 0 0 3px #f97316, 0 0 20px rgba(249,115,22,0.5), inset 0 0 36px rgba(249,115,22,0.12); }
          50% { box-shadow: 0 0 0 4px #fbbf24, 0 0 32px rgba(251,191,36,0.7), inset 0 0 48px rgba(249,115,22,0.22); }
        }
        @keyframes rs-blink-go {
          0%, 100% { opacity: 1; transform: translateY(-50%) scale(1); }
          50% { opacity: 0.35; transform: translateY(-50%) scale(1.08); }
        }
        @keyframes rs-punch {
          0% { transform: rotate(0deg) scale(1); }
          40% { transform: rotate(-8deg) scale(1.12); }
          100% { transform: rotate(4deg) scale(1); }
        }
        @keyframes rs-fly-off {
          to { transform: translate(120vw, -40px) rotate(18deg); opacity: 0; }
        }
        @keyframes rs-dash {
          from { transform: translateX(0); }
          to { transform: translateX(var(--rs-dash-x)); }
        }
        @keyframes rs-pop {
          0% { transform: scale(0.4); opacity: 0; }
          40% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes rs-bar-flash {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.45) saturate(1.2); }
        }
        .rs-font { font-family: ui-monospace, "Cascadia Code", monospace; letter-spacing: 0.06em; }
      `}</style>

      {/* HUD */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'start',
          gap: 8,
          padding: '10px 12px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.5), transparent)',
          borderBottom: '2px solid rgba(250,204,21,0.35)',
        }}
      >
        <div>
          <div className="rs-font" style={{ fontSize: 10, color: '#fde047', textShadow: '2px 2px 0 #000' }}>
            PLAYER
          </div>
          <div
            style={{
              height: 10,
              background: '#111',
              border: '1px solid #333',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div style={{ width: `${Math.min(100, hpPct)}%`, height: '100%', background: 'linear-gradient(90deg,#facc15,#eab308)' }} />
          </div>
          <div className="rs-font" style={{ fontSize: 9, color: '#a3a3a3', marginTop: 2 }}>
            HP {rpg.hp[0]}/{rpg.hp[1]}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div className="rs-font" style={{ fontSize: 10, color: '#22d3ee', textShadow: '2px 2px 0 #000' }}>
            TIME
          </div>
          <div
            className="rs-font"
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: '#fff',
              textShadow: '3px 3px 0 #000, -1px -1px 0 #ec4899',
              lineHeight: 1,
            }}
          >
            {timeStr}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div className="rs-font" style={{ fontSize: 10, color: '#f472b6', textShadow: '2px 2px 0 #000' }}>
            COMBO
          </div>
          <div
            className="rs-font"
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: fever ? '#fbbf24' : '#fff',
              textShadow: '2px 2px 0 #000',
            }}
          >
            {combo}x{fever ? ' 🔥' : ''}
          </div>
        </div>
      </div>

      {/* 스크롤 거리 */}
      <div style={{ position: 'relative', minHeight: 260, overflowX: 'auto', overflowY: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(90deg, rgba(0,0,0,0.2) 0%, transparent 30%),
              repeating-linear-gradient(90deg, transparent 0, transparent 80px, rgba(0,0,0,0.15) 80px, rgba(0,0,0,0.15) 82px),
              linear-gradient(180deg, #4c1d95 0%, #1e1b4b 18%, #312e81 18%, #1e293b 70%, #0f172a 100%)
            `,
            backgroundSize: '100% 100%, 100% 100%, 100% 100%',
            pointerEvents: 'none',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, padding: '24px 100px 56px 72px', minWidth: 'min-content', position: 'relative', zIndex: 1 }}>
          {segments.length === 0 && (
            <div className="rs-font" style={{ color: '#94a3b8', fontSize: 13, maxWidth: 360 }}>
              미완료 루틴·습관이 없습니다. Evolution에서 항목을 추가한 뒤 새로고침하거나, 아래에서 거리 순서를
              재구성해 보세요.
            </div>
          )}

          {segments.map((seg, idx) => {
            if (seg.kind === 'anchor') {
              return (
                <div
                  key={`anchor-${seg.id}`}
                  style={{
                    width: 72,
                    flexShrink: 0,
                    alignSelf: 'flex-end',
                    marginBottom: 68,
                    textAlign: 'center',
                  }}
                >
                  <div
                    className="rs-font"
                    style={{
                      fontSize: 9,
                      color: '#38bdf8',
                      textShadow: '1px 1px 0 #000',
                      marginBottom: 4,
                    }}
                  >
                    ANCHOR
                  </div>
                  <div
                    style={{
                      background: 'rgba(56,189,248,0.15)',
                      border: '2px dashed rgba(56,189,248,0.6)',
                      borderRadius: 8,
                      padding: '8px 6px',
                      fontSize: 11,
                      color: '#e0f2fe',
                      minHeight: 48,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {seg.label}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAnchor(seg.id)}
                    style={{
                      marginTop: 6,
                      fontSize: 9,
                      border: 'none',
                      background: 'transparent',
                      color: '#f87171',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    삭제
                  </button>
                </div>
              )
            }

            const it = evoById.get(seg.evolutionItemId)
            const isFirstIncomplete = idx === firstIdx
            const isBusy = activeSegIdx === idx
            const isFlying = isBusy && anim.kind === 'busy' && anim.phase === 'fly'
            const cat = it ? EVOLUTION_CATEGORY_LABEL[it.category] : null

            return (
              <div
                key={`evo-${seg.evolutionItemId}`}
                style={{
                  width: SLOT_W,
                  flexShrink: 0,
                  position: 'relative',
                  opacity: isFirstIncomplete || it?.completed ? 1 : 0.45,
                  transition: 'opacity 0.2s',
                }}
              >
                <div
                  style={{
                    transform: isFlying ? undefined : 'none',
                    animation: isFlying ? 'rs-fly-off 0.55s ease-in forwards' : undefined,
                  }}
                >
                  <div
                    className="rs-font"
                    style={{
                      fontSize: 9,
                      color: '#fca5a5',
                      textShadow: '1px 1px 0 #000',
                      marginBottom: 4,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {cat?.emoji} ENEMY
                  </div>
                  <div
                    style={{
                      background: 'linear-gradient(180deg,#7f1d1d,#451a03)',
                      border: '3px solid #f97316',
                      borderRadius: 6,
                      padding: '10px 8px',
                      minHeight: 112,
                      boxShadow: '4px 4px 0 rgba(0,0,0,0.4)',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#fef3c7', textShadow: '2px 2px 0 #000', lineHeight: 1.25 }}>
                      {it?.title ?? '—'}
                    </div>
                    {cat && (
                      <div style={{ marginTop: 8, fontSize: 9, color: '#fcd34d' }}>
                        {cat.label} · +{it?.evolutionPoints ?? 0} XP
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={!isFirstIncomplete || !it || it.completed || anim.kind !== 'idle'}
                      onClick={() => runComplete(idx)}
                      style={{
                        marginTop: 10,
                        width: '100%',
                        padding: '8px 0',
                        border: 'none',
                        borderRadius: 4,
                        cursor: !isFirstIncomplete || anim.kind !== 'idle' ? 'not-allowed' : 'pointer',
                        background: isFirstIncomplete ? 'linear-gradient(180deg,#fbbf24,#d97706)' : '#444',
                        color: '#1a0505',
                        fontWeight: 900,
                        fontSize: 11,
                        fontFamily: 'inherit',
                        boxShadow: isFirstIncomplete ? '0 3px 0 #78350f' : 'none',
                      }}
                    >
                      KO!
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 6,
                    height: 4,
                    background: '#111',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${it && !it.completed ? 100 : 0}%`,
                      height: '100%',
                      background: isFirstIncomplete ? '#ef4444' : '#64748b',
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
              </div>
            )
          })}

          {/* 플레이어 & 대시 */}
          <div
            style={{
              position: 'absolute',
              left: 56,
              bottom: 12,
              width: 48,
              height: 64,
              zIndex: 5,
              pointerEvents: 'none',
              ['--rs-dash-x' as string]: `${strikeOff}px`,
              transform:
                anim.kind === 'busy' && anim.phase !== 'dash'
                  ? `translateX(${strikeOff}px)`
                  : anim.kind === 'idle'
                    ? 'translateX(0)'
                    : undefined,
              animation:
                anim.kind === 'busy' && anim.phase === 'dash'
                  ? 'rs-dash 0.32s ease-out forwards'
                  : anim.kind === 'busy' && anim.phase === 'strike'
                    ? 'rs-punch 0.2s ease-out'
                    : undefined,
            }}
          >
            <div
              style={{
                width: 44,
                height: 56,
                margin: '0 auto',
                background: 'linear-gradient(180deg,#38bdf8,#1d4ed8)',
                border: '3px solid #fef08a',
                borderRadius: 6,
                boxShadow: '3px 5px 0 rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}
            >
              🥊
            </div>
            <div
              style={{
                marginTop: 4,
                height: 8,
                width: 40,
                marginLeft: 'auto',
                marginRight: 'auto',
                background: 'rgba(0,0,0,0.35)',
                borderRadius: '50%',
                transform: 'scaleX(1.2)',
              }}
            />
          </div>
        </div>

        {showGo && (
          <div
            className="rs-font"
            style={{
              position: 'absolute',
              right: 12,
              top: '42%',
              transform: 'translateY(-50%)',
              fontSize: 26,
              fontWeight: 900,
              color: '#fb923c',
              textShadow: '3px 3px 0 #000, 0 0 12px rgba(251,146,60,0.9)',
              zIndex: 8,
              animation: 'rs-blink-go 0.55s ease-in-out infinite',
              pointerEvents: 'none',
            }}
          >
            GO! ▶
          </div>
        )}

        {comboPopup != null && (
          <div
            className="rs-font"
            style={{
              position: 'absolute',
              left: '50%',
              top: '28%',
              transform: 'translateX(-50%)',
              fontSize: 22,
              fontWeight: 900,
              color: '#4ade80',
              textShadow: '3px 3px 0 #000',
              zIndex: 12,
              animation: 'rs-pop 0.45s ease-out',
              pointerEvents: 'none',
            }}
          >
            COMBO +1 → {comboPopup}
          </div>
        )}
      </div>

      {/* 하단 EXP / 도구 */}
      <div
        style={{
          padding: '10px 12px 14px',
          background: 'rgba(0,0,0,0.45)',
          borderTop: '2px solid rgba(52,211,153,0.35)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span className="rs-font" style={{ fontSize: 10, color: '#6ee7b7' }}>
            EVOLUTION Lv.{evoProg.level}
          </span>
          <span className="rs-font" style={{ fontSize: 10, color: '#a7f3d0' }}>
            EXP {Math.round(evoProg.xpIntoLevel)}/{evoProg.xpForNext}
          </span>
        </div>
        <div
          style={{
            height: 12,
            borderRadius: 4,
            overflow: 'hidden',
            background: '#0f172a',
            border: '1px solid #14532d',
            animation: barFlash ? 'rs-bar-flash 0.5s ease' : undefined,
          }}
        >
          <div
            style={{
              width: `${xpPct}%`,
              height: '100%',
              background: 'linear-gradient(90deg,#34d399,#10b981)',
              boxShadow: barFlash ? '0 0 12px rgba(52,211,153,0.85)' : undefined,
              transition: 'width 0.35s ease',
            }}
          />
        </div>

        <div
          style={{
            marginTop: 12,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <span className="rs-font" style={{ fontSize: 10, color: '#94a3b8' }}>
            앵커 삽입 위치
          </span>
          <select
            value={Math.min(insertAt, segments.length)}
            onChange={e => setInsertAt(Number(e.target.value))}
            style={{
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid #334155',
              background: '#0f172a',
              color: '#e2e8f0',
            }}
          >
            {Array.from({ length: segments.length + 1 }, (_, i) => (
              <option key={i} value={i}>
                {i === 0 ? '맨 앞' : i >= segments.length ? '맨 끝' : `${i}번 항목 뒤`}
              </option>
            ))}
          </select>
          <input
            value={anchorLabel}
            onChange={e => setAnchorLabel(e.target.value)}
            placeholder="예: 양치 → 스쿼트 전환"
            style={{
              flex: 1,
              minWidth: 160,
              fontSize: 11,
              padding: '5px 8px',
              borderRadius: 6,
              border: '1px solid #334155',
              background: '#1e293b',
              color: '#f8fafc',
            }}
          />
          <button
            type="button"
            onClick={addAnchor}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(180deg,#6366f1,#4f46e5)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            앵커 추가
          </button>
          <button
            type="button"
            onClick={resetChainFromEvolution}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #475569',
              background: 'transparent',
              color: '#cbd5e1',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            순서 초기화
          </button>
        </div>
      </div>
    </div>
  )
}
