/**
 * 보스 레이드 — DQ5 스타일 리모델링
 * 거대 보스 + 스킬 메뉴형 서브태스크 + 원형 숙련 관통
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { PixelSegmentBar } from './PixelGauges'
import {
  BL_SKILL_TREE_SYNC,
  loadSkillTreeState,
  raidDamageMultiplierFromSkillTree,
  raidSkillEffectTier,
} from './skillTreeData'

const PIXEL_FONT = '"Press Start 2P", "Courier New", Courier, monospace'

type QuestLite = {
  id: string
  name: string
  priority?: number
  deadline?: string
}

export function BossRaidView({
  projectName,
  openQuests,
  onStrikeQuest,
}: {
  projectName: string
  openQuests: QuestLite[]
  onStrikeQuest: (questId: string) => void
}) {
  const initialTotal = useRef(Math.max(1, openQuests.length))
  const [shake, setShake] = useState(false)
  const [flash, setFlash] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const prevRem = useRef(openQuests.length)
  const [raidMult, setRaidMult] = useState(() => raidDamageMultiplierFromSkillTree())
  const [fxTier, setFxTier] = useState(() => raidSkillEffectTier())

  const remaining = openQuests.length
  const hpPctRaw = Math.max(0, Math.min(100, (remaining / initialTotal.current) * 100))
  const piercePct = Math.round((raidMult - 1) * 100)
  const hpPct = Math.max(0, hpPctRaw * (1 / raidMult))

  useEffect(() => {
    const sync = () => {
      const st = loadSkillTreeState()
      setRaidMult(raidDamageMultiplierFromSkillTree(st))
      setFxTier(raidSkillEffectTier(st))
    }
    sync()
    window.addEventListener(BL_SKILL_TREE_SYNC, sync)
    return () => window.removeEventListener(BL_SKILL_TREE_SYNC, sync)
  }, [])

  useEffect(() => {
    if (remaining < prevRem.current) {
      setShake(true)
      setFlash(true)
      const ms = 380 + fxTier * 48
      window.setTimeout(() => setShake(false), ms)
      window.setTimeout(() => setFlash(false), 160 + fxTier * 40)
    }
    prevRem.current = remaining
  }, [remaining, fxTier])

  const bossEmoji = useMemo(() => {
    const n = projectName.toLowerCase()
    if (/만화|웹툰|comic/.test(n)) return '👹'
    if (/소설|novel|글/.test(n)) return '🐉'
    if (/사업|biz|capital/.test(n)) return '💀'
    return '😈'
  }, [projectName])

  const shakeAnim = `boss-raid-shake-${Math.min(3, fxTier)}`

  return (
    <div
      style={{
        minHeight: '70vh',
        background: 'linear-gradient(180deg, #0d0d1a 0%, #08080e 50%, #0a0008 100%)',
        borderRadius: 4,
        border: '3px solid #4466cc',
        boxShadow:
          'inset 0 0 0 1px rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.9)',
        padding: '16px 14px 20px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: PIXEL_FONT,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

        @keyframes boss-raid-shake-0 {
          0%, 100% { transform: translate(0,0) rotate(0); }
          20% { transform: translate(-8px,2px) rotate(-1.2deg); }
          40% { transform: translate(9px,-3px) rotate(1.2deg); }
          60% { transform: translate(-5px,2px) rotate(-0.6deg); }
          80% { transform: translate(4px,-2px) rotate(0.4deg); }
        }
        @keyframes boss-raid-shake-1 {
          0%, 100% { transform: translate(0,0) rotate(0); }
          20% { transform: translate(-11px,3px) rotate(-1.6deg); }
          40% { transform: translate(12px,-4px) rotate(1.6deg); }
          60% { transform: translate(-7px,3px) rotate(-0.8deg); }
          80% { transform: translate(6px,-3px) rotate(0.6deg); }
        }
        @keyframes boss-raid-shake-2 {
          0%, 100% { transform: translate(0,0) rotate(0); }
          20% { transform: translate(-14px,4px) rotate(-2deg); }
          40% { transform: translate(15px,-5px) rotate(2deg); }
          60% { transform: translate(-9px,4px) rotate(-1deg); }
          80% { transform: translate(8px,-4px) rotate(0.8deg); }
        }
        @keyframes boss-raid-shake-3 {
          0%, 100% { transform: translate(0,0) rotate(0); }
          20% { transform: translate(-18px,6px) rotate(-2.5deg); }
          40% { transform: translate(18px,-7px) rotate(2.5deg); }
          60% { transform: translate(-12px,5px) rotate(-1.2deg); }
          80% { transform: translate(10px,-5px) rotate(1deg); }
        }
        @keyframes hit-flash-raid {
          0%   { opacity: 0.82; }
          100% { opacity: 0; }
        }
        @keyframes raid-spark-glow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50%       { opacity: 0.9; transform: scale(1.1); }
        }
        @keyframes raid-ember-float {
          0%   { transform: translateY(0) scale(1); opacity: 0.9; }
          100% { transform: translateY(-44px) scale(0.25); opacity: 0; }
        }
        @keyframes raid-enemy-idle {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-7px); }
        }
        @keyframes raid-hp-pulse {
          0%, 100% { filter: brightness(1); }
          50%       { filter: brightness(1.28); }
        }
        @keyframes raid-cursor-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes raid-scan {
          0%   { background-position: 0 0; }
          100% { background-position: 0 4px; }
        }
      `}</style>

      {/* Scanlines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
          zIndex: 1,
          animation: 'raid-scan 0.12s linear infinite',
        }}
      />

      {/* Hit flash */}
      {flash && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            pointerEvents: 'none',
            background:
              fxTier >= 2
                ? 'linear-gradient(135deg, #fff 0%, #fbbf24 45%, transparent 70%)'
                : 'rgba(255,255,255,0.75)',
            animation: 'hit-flash-raid 0.22s ease-out forwards',
          }}
        />
      )}

      {/* Spark glow (tier ≥ 2) */}
      {fxTier >= 2 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 5,
            pointerEvents: 'none',
            background:
              'radial-gradient(circle at 20% 80%, rgba(251,191,36,0.22), transparent 38%), radial-gradient(circle at 80% 72%, rgba(248,113,113,0.16), transparent 33%)',
            animation: 'raid-spark-glow 2.4s ease-in-out infinite',
          }}
        />
      )}

      {/* Ember particles (tier ≥ 3) */}
      {fxTier >= 3 &&
        ['18%', '42%', '65%', '52%'].map((left, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left,
              bottom: '14%',
              zIndex: 6,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #fde68a, #ea580c)',
              pointerEvents: 'none',
              animation: `raid-ember-float ${1.2 + i * 0.15}s ease-out infinite`,
              animationDelay: `${i * 0.22}s`,
              boxShadow: '0 0 12px rgba(251,191,36,0.9)',
            }}
          />
        ))}

      {/* BOSS RAID header */}
      <div style={{ textAlign: 'center', marginBottom: 10, position: 'relative', zIndex: 10 }}>
        <span
          style={{
            display: 'inline-block',
            padding: '5px 14px',
            background: 'linear-gradient(180deg, #7f1d1d, #450a0a)',
            border: '2px solid #fbbf24',
            color: '#fef3c7',
            fontSize: 8,
            fontFamily: PIXEL_FONT,
            letterSpacing: '0.14em',
            textShadow: '0 1px 0 rgba(0,0,0,0.8)',
          }}
        >
          BOSS RAID
        </span>
      </div>

      {/* Project name */}
      <h2
        style={{
          margin: '0 0 8px',
          textAlign: 'center',
          fontSize: 14,
          fontFamily: PIXEL_FONT,
          color: '#fecaca',
          textShadow: '0 0 20px rgba(248,113,113,0.55)',
          lineHeight: 1.5,
          position: 'relative',
          zIndex: 10,
        }}
      >
        {projectName}
      </h2>

      {/* Boss sprite — large, idle float + shake */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 16,
          position: 'relative',
          zIndex: 10,
          animation: shake
            ? `${shakeAnim} 0.42s ease`
            : 'raid-enemy-idle 3s ease-in-out infinite',
        }}
      >
        <div
          style={{
            fontSize: 'clamp(80px, 22vw, 148px)',
            lineHeight: 1,
            filter:
              fxTier >= 1
                ? 'drop-shadow(0 14px 28px rgba(0,0,0,0.9)) drop-shadow(0 0 32px rgba(251,191,36,0.5))'
                : 'drop-shadow(0 14px 28px rgba(0,0,0,0.9))',
            userSelect: 'none',
            transition: 'filter 0.4s ease',
          }}
        >
          {bossEmoji}
        </div>
      </div>

      {/* Boss HP bar */}
      <div style={{ maxWidth: 500, margin: '0 auto 16px', position: 'relative', zIndex: 10 }}>
        <PixelSegmentBar
          label="BOSS HP"
          current={Math.round(hpPct)}
          max={100}
          fill={fxTier >= 2 ? '#facc15' : '#22c55e'}
          back="rgba(0,0,0,0.6)"
          segments={26}
        />
        <div
          style={{
            fontSize: 7,
            fontFamily: PIXEL_FONT,
            color: '#94a3b8',
            textAlign: 'center',
            marginTop: 6,
            lineHeight: 1.8,
          }}
        >
          남은 서브태스크 {remaining}건 · 숙련 관통{' '}
          <strong style={{ color: '#fde68a' }}>+{piercePct}%</strong>
          {fxTier >= 1 && (
            <span style={{ display: 'block', marginTop: 3, color: '#a5b4fc' }}>
              스킬 이펙트 단계 {fxTier}/3
            </span>
          )}
        </div>
      </div>

      {/* Battle skills / subtask command window */}
      <div
        style={{
          maxWidth: 560,
          margin: '0 auto',
          padding: '12px',
          background: 'rgba(0, 0, 18, 0.96)',
          border: '3px solid #4466cc',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div
          style={{
            fontSize: 7,
            fontFamily: PIXEL_FONT,
            color: '#fde68a',
            marginBottom: 10,
            letterSpacing: '0.12em',
          }}
        >
          ⚔ BATTLE SKILLS (서브태스크)
        </div>

        {openQuests.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: '#4ade80',
              fontFamily: PIXEL_FONT,
              fontSize: 9,
              padding: '16px',
              lineHeight: 2,
              animation: 'raid-cursor-blink 1s step-end infinite',
            }}
          >
            보스 격파! 🎉
            <br />
            프로젝트가 완료되었습니다.
          </div>
        ) : (
          <ul
            style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            {openQuests.map((q, i) => {
              const isHovered = hoveredId === q.id
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => onStrikeQuest(q.id)}
                    onMouseEnter={() => setHoveredId(q.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '9px 12px',
                      border: isHovered ? '1px solid #fbbf24' : '1px solid rgba(68,102,204,0.5)',
                      background: isHovered
                        ? 'rgba(251,191,36,0.1)'
                        : i % 2 === 0
                          ? 'rgba(15,23,42,0.7)'
                          : 'rgba(8,10,24,0.7)',
                      color: '#e2e8f0',
                      cursor: 'pointer',
                      fontSize: 11,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      transition: 'background 0.1s, border-color 0.1s',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontFamily: PIXEL_FONT,
                          color: '#fef3c7',
                          minWidth: 14,
                          animation: isHovered ? 'raid-cursor-blink 0.75s step-end infinite' : 'none',
                        }}
                      >
                        {isHovered ? '▶' : '\u3000'}
                      </span>
                      <span style={{ fontWeight: 700 }}>{q.name}</span>
                    </span>
                    <span style={{ fontSize: 8, fontFamily: PIXEL_FONT, color: '#94a3b8', flexShrink: 0 }}>
                      {q.deadline ? `D-${q.deadline.slice(5)}` : 'STRIKE'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
