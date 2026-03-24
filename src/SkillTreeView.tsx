/**
 * 스킬 트리 뷰 — 4대 원형(방사형) + 맵 구역 6분기 + 레벨업 이펙트
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { IdentityArchetype } from './identityArchetypeData'
import {
  BL_SKILL_TREE_SYNC,
  ARCHETYPE_NODES,
  ARCHETYPE_ORDER,
  ARCHETYPE_SKILL_BRANCH,
  BRANCH_NODES,
  SKILL_BRANCHES,
  archetypeRadarValue,
  loadSkillTreeState,
  tierForArchetypeXp,
  tierForBranchXp,
  xpProgressInTier,
  type SkillBranchId,
} from './skillTreeData'
import { loadRpgProfile } from './levelupRpgProfile'
import { BL_RPG_SYNC } from './questRpgIntegration'
import { BL_LEGACY_ARCHIVE_SYNC, getLegacyEntryCount } from './legacyArchiveData'

type Burst =
  | { kind: 'branch'; id: SkillBranchId }
  | { kind: 'archetype'; id: IdentityArchetype }

export function SkillTreeView() {
  const [tree, setTree] = useState(loadSkillTreeState)
  const [gold, setGold] = useState(() => loadRpgProfile().gold)
  const [staminaLine, setStaminaLine] = useState(() => {
    const st = loadRpgProfile().stamina
    return `${st[0]}/${st[1]}`
  })
  const [burst, setBurst] = useState<Burst | null>(null)
  const [legacyN, setLegacyN] = useState(() => getLegacyEntryCount())

  const radarRows = useMemo(
    () =>
      ARCHETYPE_ORDER.map(id => {
        const meta = ARCHETYPE_SKILL_BRANCH.find(a => a.id === id)!
        const xp = tree.archetypeXp[id] ?? 0
        return {
          subject: `${meta.emoji} ${meta.label}`,
          value: Math.round(archetypeRadarValue(xp)),
        }
      }),
    [tree.archetypeXp],
  )

  useEffect(() => {
    const syncRpg = () => {
      const p = loadRpgProfile()
      setGold(p.gold)
      setStaminaLine(`${p.stamina[0]}/${p.stamina[1]}`)
    }
    const onSkill = (e: Event) => {
      setTree(loadSkillTreeState())
      syncRpg()
      const d = (e as CustomEvent).detail as
        | {
            kind?: string
            branch?: SkillBranchId | null
            arch?: IdentityArchetype
            prevTier?: number
            newTier?: number
          }
        | undefined
      const prev = d?.prevTier
      const nextT = d?.newTier
      if (prev == null || nextT == null || nextT <= prev) return

      if (d?.kind === 'archetype' && d.arch) {
        setBurst({ kind: 'archetype', id: d.arch })
        window.setTimeout(() => setBurst(null), 1400)
        return
      }
      if (d?.kind === 'branch' && d.branch) {
        setBurst({ kind: 'branch', id: d.branch })
        window.setTimeout(() => setBurst(null), 1400)
        return
      }
      if (d?.branch) {
        setBurst({ kind: 'branch', id: d.branch })
        window.setTimeout(() => setBurst(null), 1400)
      }
    }
    const onLegacy = () => setLegacyN(getLegacyEntryCount())
    window.addEventListener(BL_SKILL_TREE_SYNC, onSkill)
    window.addEventListener(BL_RPG_SYNC, syncRpg)
    window.addEventListener(BL_LEGACY_ARCHIVE_SYNC, onLegacy)
    return () => {
      window.removeEventListener(BL_SKILL_TREE_SYNC, onSkill)
      window.removeEventListener(BL_RPG_SYNC, syncRpg)
      window.removeEventListener(BL_LEGACY_ARCHIVE_SYNC, onLegacy)
    }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{`
        @keyframes skill-node-pop {
          0% { transform: scale(0.85); filter: brightness(1); }
          40% { transform: scale(1.08); filter: brightness(1.4); box-shadow: 0 0 28px rgba(251,191,36,0.9); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        @keyframes skill-burst {
          0% { opacity: 0; transform: scale(0.5); }
          30% { opacity: 1; }
          100% { opacity: 0; transform: scale(2.2); }
        }
        @keyframes skill-trunk-glow {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.85; }
        }
      `}</style>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          borderRadius: 12,
          background: 'linear-gradient(180deg, #1c1410 0%, #0f0b09 100%)',
          border: '2px solid #5c4033',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.35)',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 800, color: '#fde68a', letterSpacing: '0.08em' }}>행동 자산 · 스킬</span>
        <span style={{ fontSize: 11, color: '#d6d3d1' }}>
          소지금 <strong style={{ color: '#fbbf24' }}>{gold} G</strong>
        </span>
        <span style={{ fontSize: 11, color: '#a8a29e' }}>행동력(스태미나) {staminaLine}</span>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: '#57534e', lineHeight: 1.55 }}>
        퀘스트 완료 시 <strong>활성 태세(Identity)</strong>에 맞는 <strong>4대 원형</strong> XP와, 맵 구역·태그 기반{' '}
        <strong>6분기</strong> XP가 함께 쌓입니다.
      </p>

      <div
        style={{
          padding: '14px 12px 18px',
          borderRadius: 16,
          background: 'linear-gradient(165deg, rgba(28,20,16,0.98), rgba(12,10,9,0.99))',
          border: '2px solid #44403c',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 900, color: '#fde68a', letterSpacing: '0.1em', marginBottom: 4 }}>
          원형 숙련도 · 방사형 지도
        </div>
        <div style={{ fontSize: 11, color: '#a8a29e', marginBottom: 10 }}>분석가 · 창작자 · 자본가 · 모험가 (0~100 근사)</div>
        <div style={{ width: '100%', height: 300, maxWidth: 420, margin: '0 auto' }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="52%" outerRadius="72%" data={radarRows}>
              <PolarGrid stroke="rgba(120,113,108,0.5)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#d6d3d1', fontSize: 10 }} />
              <PolarRadiusAxis angle={36} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar
                name="숙련"
                dataKey="value"
                stroke="#d97706"
                fill="#fbbf24"
                fillOpacity={0.38}
                strokeWidth={2}
              />
              <Tooltip
                contentStyle={{
                  background: '#1c1917',
                  border: '1px solid #57534e',
                  borderRadius: 8,
                  fontSize: 11,
                  color: '#fafaf9',
                }}
                formatter={(v: number) => [`${v}`, '지표']}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, color: '#44403c', letterSpacing: '0.06em' }}>4대 원형 — 핵심 줄기</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
          gap: 12,
          alignItems: 'start',
        }}
      >
        {ARCHETYPE_SKILL_BRANCH.map(b => {
          const xp = tree.archetypeXp[b.id] ?? 0
          const tier = tierForArchetypeXp(xp)
          const prog = xpProgressInTier(xp)
          const nodes = ARCHETYPE_NODES[b.id]
          const isBurst = burst?.kind === 'archetype' && burst.id === b.id
          return (
            <div
              key={b.id}
              style={{
                position: 'relative',
                padding: '12px 10px',
                borderRadius: 14,
                background: 'linear-gradient(165deg, rgba(28,20,16,0.98), rgba(15,11,9,0.99))',
                border: `2px solid ${b.accent}55`,
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.4), 0 0 20px rgba(0,0,0,0.25)',
                minHeight: 300,
              }}
            >
              {isBurst ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: -4,
                    borderRadius: 16,
                    pointerEvents: 'none',
                    animation: 'skill-burst 1.2s ease-out forwards',
                    boxShadow: `0 0 40px ${b.accent}`,
                  }}
                />
              ) : null}
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>{b.emoji}</span>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fafaf9', marginTop: 4 }}>{b.label}</div>
                <div style={{ marginTop: 6, fontSize: 10, color: '#d6d3d1' }}>
                  XP {xp} · 티어 {tier}/5
                </div>
                <div
                  style={{
                    marginTop: 6,
                    height: 6,
                    borderRadius: 4,
                    background: 'rgba(0,0,0,0.45)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${tier >= 5 ? 100 : prog.pct * 100}%`,
                      height: '100%',
                      background: `linear-gradient(90deg, ${b.accent}55, ${b.accent})`,
                      transition: 'width 0.35s ease',
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 72,
                  bottom: 24,
                  width: 3,
                  marginLeft: -1.5,
                  background: `linear-gradient(180deg, ${b.accent}33, ${b.accent})`,
                  borderRadius: 8,
                  animation: 'skill-trunk-glow 3.2s ease-in-out infinite',
                }}
              />

              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                {nodes.map(n => {
                  const unlocked = tier >= n.tier
                  return (
                    <div
                      key={n.tier}
                      title={n.flavor}
                      style={{
                        width: '92%',
                        padding: '8px 8px',
                        borderRadius: 10,
                        border: unlocked ? `2px solid ${b.accent}` : '2px solid rgba(87,83,78,0.8)',
                        background: unlocked
                          ? `linear-gradient(145deg, ${b.accent}22, rgba(0,0,0,0.2))`
                          : 'rgba(0,0,0,0.35)',
                        boxShadow: unlocked ? `0 0 12px ${b.accent}44` : 'none',
                        animation:
                          unlocked && isBurst && n.tier === tier ? 'skill-node-pop 0.6s ease-out' : undefined,
                        filter: unlocked ? 'none' : 'grayscale(0.35) brightness(0.75)',
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 800, color: unlocked ? '#fafaf9' : '#78716c' }}>
                        T{n.tier} {n.title}
                      </div>
                      <div style={{ fontSize: 9, color: unlocked ? '#d6d3d1' : '#57534e', marginTop: 2 }}>{n.flavor}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, color: '#44403c', letterSpacing: '0.06em' }}>맵 구역 전문 — 6분기</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 12,
          alignItems: 'start',
        }}
      >
        {SKILL_BRANCHES.map(b => {
          const xp = tree.branchXp[b.id] ?? 0
          const tier = tierForBranchXp(xp)
          const prog = xpProgressInTier(xp)
          const nodes = BRANCH_NODES[b.id]
          const isBurst = burst?.kind === 'branch' && burst.id === b.id
          return (
            <div
              key={b.id}
              style={{
                position: 'relative',
                padding: '12px 10px',
                borderRadius: 14,
                background: 'linear-gradient(165deg, rgba(28,20,16,0.98), rgba(15,11,9,0.99))',
                border: `2px solid ${b.accent}55`,
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.4), 0 0 20px rgba(0,0,0,0.25)',
                minHeight: 320,
              }}
            >
              {isBurst ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: -4,
                    borderRadius: 16,
                    pointerEvents: 'none',
                    animation: 'skill-burst 1.2s ease-out forwards',
                    boxShadow: `0 0 40px ${b.accent}`,
                  }}
                />
              ) : null}
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>{b.emoji}</span>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fafaf9', marginTop: 4 }}>{b.label}</div>
                <div style={{ fontSize: 10, color: '#a8a29e' }}>{b.blurb}</div>
                <div style={{ marginTop: 6, fontSize: 10, color: '#d6d3d1' }}>
                  XP {xp} · 티어 {tier}/5
                </div>
                <div
                  style={{
                    marginTop: 6,
                    height: 6,
                    borderRadius: 4,
                    background: 'rgba(0,0,0,0.45)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${tier >= 5 ? 100 : prog.pct * 100}%`,
                      height: '100%',
                      background: `linear-gradient(90deg, ${b.accent}55, ${b.accent})`,
                      transition: 'width 0.35s ease',
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 72,
                  bottom: 24,
                  width: 3,
                  marginLeft: -1.5,
                  background: `linear-gradient(180deg, ${b.accent}33, ${b.accent})`,
                  borderRadius: 8,
                  animation: 'skill-trunk-glow 3.2s ease-in-out infinite',
                }}
              />

              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                {nodes.map(n => {
                  const unlocked = tier >= n.tier
                  return (
                    <div
                      key={n.tier}
                      title={n.flavor}
                      style={{
                        width: '92%',
                        padding: '8px 8px',
                        borderRadius: 10,
                        border: unlocked ? `2px solid ${b.accent}` : '2px solid rgba(87,83,78,0.8)',
                        background: unlocked
                          ? `linear-gradient(145deg, ${b.accent}22, rgba(0,0,0,0.2))`
                          : 'rgba(0,0,0,0.35)',
                        boxShadow: unlocked ? `0 0 12px ${b.accent}44` : 'none',
                        animation:
                          unlocked && isBurst && n.tier === tier ? 'skill-node-pop 0.6s ease-out' : undefined,
                        filter: unlocked ? 'none' : 'grayscale(0.35) brightness(0.75)',
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 800, color: unlocked ? '#fafaf9' : '#78716c' }}>
                        T{n.tier} {n.title}
                      </div>
                      <div style={{ fontSize: 9, color: unlocked ? '#d6d3d1' : '#57534e', marginTop: 2 }}>{n.flavor}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div
        style={{
          marginTop: 8,
          padding: '12px 14px',
          borderRadius: 12,
          background: 'linear-gradient(165deg, rgba(28,20,16,0.85), rgba(15,11,9,0.92))',
          border: '1px solid #57534e',
        }}
      >
        <p style={{ margin: 0, fontSize: 11, color: '#a8a29e', lineHeight: 1.55 }}>
          <strong style={{ color: '#fde68a' }}>인과율 서고</strong>에 기록된 유산 <strong style={{ color: '#fafaf9' }}>{legacyN}</strong>건 · 시뮬레이션 크레딧은 유산
          등록 시 소량 연동됩니다.{' '}
          <Link to="/growth?tab=archive" style={{ color: '#fcd34d', fontWeight: 800 }}>
            서고 열기 →
          </Link>
        </p>
      </div>
    </div>
  )
}
