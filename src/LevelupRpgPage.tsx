import React, { useCallback, useEffect, useState } from 'react'
import {
  loadRpgProfile,
  saveRpgProfile,
  defaultRpgProfile,
  activeRpgRows,
  softDeleteRpgStatLine,
  softDeleteRpgBoss,
  softDeleteRpgMap,
  softDeleteRpgQuest,
  softDeleteRpgSkill,
  type LevelupRpgProfile,
  type RpgBossRow,
  type RpgMapRow,
  type RpgQuestRow,
  type RpgSkillRow,
} from './levelupRpgProfile'
import { PersonLinkPicker } from './PersonLinkPicker'
import { LEVELUP_RPG_ENTITY_ID, PERSON_ENTITY } from './personEntityTypes'

const C = {
  bg: '#F8F8F6',
  card: '#FFFFFF',
  text: '#37352F',
  muted: '#787774',
  hint: '#9B9A97',
  line: 'rgba(0,0,0,0.07)',
  purple: '#7C3AED',
  soft: 'rgba(124,58,237,0.08)',
  radius: 12,
  shadow: '0 1px 3px rgba(0,0,0,0.04)',
}

type AppStatSnapshot = {
  id: string
  label: string
  value: string
  unit: string
  emoji: string
  col: string
}

type Props = {
  appStats: AppStatSnapshot[]
  currentLevel: number
  levelTitle: string
  currentLevelXp: number
  maxCurrentLevelXp: number
  totalXp: number
  progressPct: number
  activeIdentityName?: string | null
}

function clampPair(cur: number, max: number): [number, number] {
  const m = Math.max(1, max)
  const c = Math.min(Math.max(0, cur), m)
  return [c, m]
}

const ghostBase: React.CSSProperties = {
  boxSizing: 'border-box',
  border: 'none',
  borderBottom: `1px solid ${C.line}`,
  background: 'transparent',
  color: C.text,
  fontSize: 13,
  outline: 'none',
  padding: '6px 4px',
  borderRadius: 0,
  minWidth: 0,
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: C.purple, marginBottom: 10 }}>
      {children}
    </div>
  )
}

/** 단색 게이지 — 과한 그라데이션 없음 */
function VitalBar({
  label,
  shortLabel,
  cur,
  max,
  fill,
  onCur,
  onMax,
}: {
  label: string
  shortLabel: string
  cur: number
  max: number
  fill: string
  onCur: (v: number) => void
  onMax: (v: number) => void
}) {
  const m = Math.max(1, max)
  const c = Math.min(Math.max(0, cur), m)
  const pct = (c / m) * 100
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr auto', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: C.muted }}>{shortLabel}</span>
        <div style={{ height: 11, borderRadius: 6, background: '#E8E8E6', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: fill, transition: 'width 0.2s ease' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
          <input
            type="number"
            aria-label={`${label} 현재`}
            value={Number.isFinite(cur) ? cur : 0}
            onChange={e => onCur(parseFloat(e.target.value) || 0)}
            style={{
              width: 44,
              ...ghostBase,
              borderBottomColor: `${fill}55`,
              color: fill,
              fontWeight: 800,
              textAlign: 'right',
            }}
          />
          <span style={{ color: C.muted, fontWeight: 600 }}>/</span>
          <input
            type="number"
            aria-label={`${label} 최대`}
            value={Number.isFinite(max) ? max : 1}
            min={1}
            onChange={e => onMax(parseFloat(e.target.value) || 1)}
            style={{ width: 44, ...ghostBase, textAlign: 'right', fontWeight: 700 }}
          />
        </div>
      </div>
    </div>
  )
}

const SKILL_KEYS = ['Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F'] as const

const btnMini: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: `1px solid rgba(124,58,237,0.35)`,
  background: C.soft,
  color: C.purple,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
}
const btnDanger: React.CSSProperties = {
  ...btnMini,
  border: '1px solid rgba(239,68,68,0.35)',
  color: '#dc2626',
  background: 'rgba(239,68,68,0.06)',
}

export function LevelupRpgPage({
  appStats,
  currentLevel,
  levelTitle,
  currentLevelXp,
  maxCurrentLevelXp,
  totalXp,
  progressPct,
  activeIdentityName,
}: Props) {
  const [profile, setProfile] = useState<LevelupRpgProfile>(() => loadRpgProfile())

  useEffect(() => {
    saveRpgProfile(profile)
  }, [profile])

  const syncFromAppIdentity = useCallback(() => {
    if (activeIdentityName?.trim()) {
      setProfile(p => ({ ...p, heroName: activeIdentityName.trim() }))
    }
  }, [activeIdentityName])

  const resetProfile = useCallback(() => {
    if (window.confirm('RPG 프로필을 초기화할까요?')) {
      setProfile(defaultRpgProfile())
    }
  }, [])

  const setVital = (key: 'hp' | 'mp' | 'sp' | 'stamina' | 'focus', idx: 0 | 1, v: number) => {
    setProfile(p => {
      const pair = [...p[key]] as [number, number]
      pair[idx] = Math.max(0, v)
      if (idx === 1 && pair[0] > pair[1]) pair[0] = pair[1]
      if (idx === 0 && pair[0] > pair[1]) pair[1] = pair[0]
      return { ...p, [key]: clampPair(pair[0], pair[1]) }
    })
  }

  const updateStatLine = (id: string, field: 'label' | 'value', v: string) => {
    setProfile(p => ({
      ...p,
      statLines: p.statLines.map(s => (s.id === id ? { ...s, [field]: v } : s)),
    }))
  }

  const addStatLine = () => {
    const id = `custom_${Date.now()}`
    setProfile(p => ({
      ...p,
      statLines: [...p.statLines, { id, label: '스탯', value: '0' }],
    }))
  }

  const removeStatLine = (id: string) => {
    setProfile(p => softDeleteRpgStatLine(p, id))
  }

  const patchEquipment = (i: number, patch: Partial<{ slot: string; name: string }>) => {
    setProfile(p => {
      const equipment = [...p.equipment]
      if (equipment[i]) equipment[i] = { ...equipment[i], ...patch }
      return { ...p, equipment }
    })
  }

  const addBoss = () => {
    const id = `b_${Date.now()}`
    setProfile(p => ({
      ...p,
      bosses: [...p.bosses, { id, name: '보스', cleared: false, memo: '' }],
    }))
  }

  const patchBoss = (id: string, patch: Partial<RpgBossRow>) => {
    setProfile(p => ({ ...p, bosses: p.bosses.map(b => (b.id === id ? { ...b, ...patch } : b)) }))
  }

  const removeBoss = (id: string) => setProfile(p => softDeleteRpgBoss(p, id))

  const addMap = () => {
    const id = `map_${Date.now()}`
    setProfile(p => ({
      ...p,
      maps: [...p.maps, { id, name: '맵', stars: 0, memo: '' }],
    }))
  }

  const patchMap = (id: string, patch: Partial<RpgMapRow>) => {
    setProfile(p => ({ ...p, maps: p.maps.map(m => (m.id === id ? { ...m, ...patch } : m)) }))
  }

  const removeMap = (id: string) => setProfile(p => softDeleteRpgMap(p, id))

  const addQuest = () => {
    const id = `q_${Date.now()}`
    setProfile(p => ({
      ...p,
      quests: [...p.quests, { id, title: '퀘스트', done: false, memo: '' }],
    }))
  }

  const patchQuest = (id: string, patch: Partial<RpgQuestRow>) => {
    setProfile(p => ({ ...p, quests: p.quests.map(q => (q.id === id ? { ...q, ...patch } : q)) }))
  }

  const removeQuest = (id: string) => setProfile(p => softDeleteRpgQuest(p, id))

  const addSkill = () => {
    const id = `sk_${Date.now()}`
    setProfile(p => ({
      ...p,
      skills: [...p.skills, { id, name: '스킬', level: 1, tag: '', accent: '#6366f1' }],
    }))
  }

  const patchSkill = (id: string, patch: Partial<RpgSkillRow>) => {
    setProfile(p => ({ ...p, skills: p.skills.map(s => (s.id === id ? { ...s, ...patch } : s)) }))
  }

  const removeSkill = (id: string) => setProfile(p => softDeleteRpgSkill(p, id))

  const gameDate = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  const F = {
    hp: '#16a34a',
    mp: '#0284c7',
    sp: '#d97706',
    st: '#db2777',
    fo: '#7c3aed',
  }

  return (
    <div style={{ minHeight: '100vh', padding: '20px 16px 40px', fontFamily: "'Noto Sans KR', system-ui, sans-serif", background: C.bg, color: C.text }}>
      <style>{`
        .lvl-main-grid > * { min-width: 0; }
        .lvl-ghost:focus { border-bottom-color: ${C.purple} !important; }
        .lvl-ghost-area:focus { border-color: ${C.purple}33 !important; }
      `}</style>

      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        {/* 상단 */}
        <div
          style={{
            marginBottom: 16,
            padding: '14px 18px',
            borderRadius: C.radius,
            background: C.card,
            border: `1px solid ${C.line}`,
            boxShadow: C.shadow,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.purple, letterSpacing: '0.1em' }}>LEVELUP</div>
            <h1 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800 }}>상태 보드</h1>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>{gameDate}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={syncFromAppIdentity} style={btnMini}>태세 이름 반영</button>
            <button type="button" onClick={resetProfile} style={btnDanger}>초기화</button>
          </div>
        </div>

        <div
          className="lvl-main-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 260px) minmax(340px, 1fr) minmax(0, 300px)',
            gap: 14,
            alignItems: 'start',
            width: '100%',
            maxWidth: '100%',
          }}
        >
          {/* ── 왼쪽: 미니 프로필 + 파라미터 + 앱지표 (minWidth:0으로 그리드 오버플로 방지) ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, maxWidth: '100%' }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: C.radius,
                background: C.card,
                border: `1px solid ${C.line}`,
                boxShadow: C.shadow,
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    background: '#F1F1EF',
                    border: `1px solid ${C.line}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 26,
                    flexShrink: 0,
                  }}
                >
                  {profile.portraitEmoji || '◇'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    className="lvl-ghost"
                    value={profile.portraitEmoji}
                    onChange={e => setProfile(p => ({ ...p, portraitEmoji: e.target.value.slice(0, 8) }))}
                    placeholder="이모지"
                    style={{ ...ghostBase, fontSize: 12, width: '100%', marginBottom: 6 }}
                  />
                  <input
                    className="lvl-ghost"
                    value={profile.heroName}
                    onChange={e => setProfile(p => ({ ...p, heroName: e.target.value }))}
                    placeholder="이름"
                    style={{ ...ghostBase, fontWeight: 800, fontSize: 15, width: '100%' }}
                  />
                  <input
                    className="lvl-ghost"
                    value={profile.className}
                    onChange={e => setProfile(p => ({ ...p, className: e.target.value }))}
                    placeholder="클래스"
                    style={{ ...ghostBase, fontSize: 12, color: C.muted, width: '100%', marginTop: 4 }}
                  />
                  <input
                    className="lvl-ghost"
                    value={profile.heroTitle}
                    onChange={e => setProfile(p => ({ ...p, heroTitle: e.target.value }))}
                    placeholder="칭호"
                    style={{ ...ghostBase, fontSize: 11, color: C.hint, width: '100%', marginTop: 4 }}
                  />
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 900, color: C.purple }}>Lv.{currentLevel}</span>
                    <span style={{ fontSize: 11, color: C.muted, lineHeight: 1.3 }}>{levelTitle}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    <span style={{ fontSize: 12 }}>🪙</span>
                    <input
                      className="lvl-ghost"
                      type="number"
                      value={profile.gold}
                      onChange={e => setProfile(p => ({ ...p, gold: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                      style={{ ...ghostBase, flex: 1, fontWeight: 800 }}
                    />
                    <span style={{ fontSize: 11, color: C.muted }}>G</span>
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: C.radius,
                background: C.card,
                border: `1px solid ${C.line}`,
                boxShadow: C.shadow,
                minWidth: 0,
                maxWidth: '100%',
                overflow: 'hidden',
                boxSizing: 'border-box',
              }}
            >
              <SectionLabel>파라미터</SectionLabel>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button type="button" onClick={addStatLine} style={btnMini}>+ 행</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', minWidth: 0 }}>
                {activeRpgRows(profile.statLines).map(row => (
                  <div
                    key={row.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) 48px 26px',
                      gap: 6,
                      alignItems: 'center',
                      width: '100%',
                      minWidth: 0,
                      boxSizing: 'border-box',
                    }}
                  >
                    <input
                      className="lvl-ghost"
                      value={row.label}
                      onChange={e => updateStatLine(row.id, 'label', e.target.value)}
                      style={{ ...ghostBase, fontSize: 12, fontWeight: 700, width: '100%' }}
                    />
                    <input
                      className="lvl-ghost"
                      value={row.value}
                      onChange={e => updateStatLine(row.id, 'value', e.target.value)}
                      style={{ ...ghostBase, fontSize: 12, textAlign: 'right', width: '100%', paddingLeft: 0, paddingRight: 2 }}
                    />
                    <button type="button" onClick={() => removeStatLine(row.id)} style={{ ...btnDanger, padding: '2px 6px', fontSize: 12, flexShrink: 0 }}>×</button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: C.radius, background: C.card, border: `1px solid ${C.line}`, boxShadow: C.shadow }}>
              <SectionLabel>앱 연동</SectionLabel>
              <p style={{ margin: '0 0 8px', fontSize: 11, color: C.hint }}>Quest 스탯 (읽기 전용)</p>
              {appStats.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: `1px solid ${C.line}` }}>
                  <span>
                    {s.emoji} {s.label}
                  </span>
                  <span style={{ fontWeight: 700, color: s.col }}>
                    {s.value}
                    {s.unit ? <span style={{ color: C.muted, fontWeight: 500 }}> {s.unit}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 중앙: 경험치 + HP… + 스킬 슬롯 + 장비 ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '14px 16px', borderRadius: C.radius, background: C.card, border: `1px solid ${C.line}`, boxShadow: C.shadow }}>
              <SectionLabel>상태</SectionLabel>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>경험치 (앱 XP)</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.purple }}>{Math.floor(totalXp).toLocaleString('ko-KR')} pt</span>
                </div>
                <p style={{ margin: '0 0 8px', fontSize: 11, color: C.hint }}>
                  {Math.floor(currentLevelXp).toLocaleString('ko-KR')} / {Math.floor(maxCurrentLevelXp).toLocaleString('ko-KR')} (이번 레벨 구간)
                </p>
                <div style={{ height: 10, borderRadius: 6, background: '#E8E8E6', overflow: 'hidden' }}>
                  <div style={{ width: `${progressPct}%`, height: '100%', background: C.purple }} />
                </div>
              </div>

              <VitalBar label="HP" shortLabel="HP" cur={profile.hp[0]} max={profile.hp[1]} fill={F.hp} onCur={v => setVital('hp', 0, v)} onMax={v => setVital('hp', 1, v)} />
              <VitalBar label="MP" shortLabel="MP" cur={profile.mp[0]} max={profile.mp[1]} fill={F.mp} onCur={v => setVital('mp', 0, v)} onMax={v => setVital('mp', 1, v)} />
              <VitalBar label="SP" shortLabel="SP" cur={profile.sp[0]} max={profile.sp[1]} fill={F.sp} onCur={v => setVital('sp', 0, v)} onMax={v => setVital('sp', 1, v)} />
              <VitalBar label="체력 STA" shortLabel="ST" cur={profile.stamina[0]} max={profile.stamina[1]} fill={F.st} onCur={v => setVital('stamina', 0, v)} onMax={v => setVital('stamina', 1, v)} />
              <VitalBar label="집중 FOC" shortLabel="FC" cur={profile.focus[0]} max={profile.focus[1]} fill={F.fo} onCur={v => setVital('focus', 0, v)} onMax={v => setVital('focus', 1, v)} />
            </div>

            <div style={{ padding: '14px 16px', borderRadius: C.radius, background: C.card, border: `1px solid ${C.line}`, boxShadow: C.shadow }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: C.purple }}>스킬 슬롯 (QWER)</span>
                <button type="button" onClick={addSkill} style={btnMini}>+ 추가</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {activeRpgRows(profile.skills).map((sk, i) => (
                  <div
                    key={sk.id}
                    style={{
                      position: 'relative',
                      minHeight: 88,
                      padding: '8px 8px 6px',
                      borderRadius: 10,
                      background: '#F4F4F2',
                      border: `1px solid ${C.line}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 900, color: C.muted, fontFamily: 'ui-monospace' }}>{SKILL_KEYS[i] ?? '·'}</span>
                      <button type="button" onClick={() => removeSkill(sk.id)} style={{ border: 'none', background: 'none', color: C.hint, cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                    </div>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: sk.accent, marginBottom: 2 }} />
                    <input
                      className="lvl-ghost"
                      value={sk.name}
                      onChange={e => patchSkill(sk.id, { name: e.target.value })}
                      placeholder="스킬명"
                      style={{ ...ghostBase, fontSize: 11, fontWeight: 800, width: '100%', padding: '4px 2px' }}
                    />
                    <div style={{ display: 'flex', gap: 4, marginTop: 'auto' }}>
                      <input
                        type="number"
                        className="lvl-ghost"
                        value={sk.level}
                        onChange={e => patchSkill(sk.id, { level: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        style={{ ...ghostBase, width: 36, fontSize: 10, textAlign: 'center', padding: '2px' }}
                      />
                      <input
                        className="lvl-ghost"
                        value={sk.accent}
                        onChange={e => patchSkill(sk.id, { accent: e.target.value })}
                        placeholder="#색"
                        style={{ ...ghostBase, flex: 1, fontSize: 10, padding: '2px' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: C.radius, background: C.card, border: `1px solid ${C.line}`, boxShadow: C.shadow }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SectionLabel>장비</SectionLabel>
                <button type="button" onClick={() => setProfile(p => ({ ...p, equipment: [...p.equipment, { slot: '슬롯', name: '' }] }))} style={btnMini}>+ 슬롯</button>
              </div>
              {profile.equipment.map((eq, i) => (
                <div key={`${eq.slot}-${i}`} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${C.line}` }}>
                  <input
                    className="lvl-ghost"
                    value={eq.slot}
                    onChange={e => patchEquipment(i, { slot: e.target.value })}
                    placeholder="부위"
                    style={{ ...ghostBase, fontSize: 11, fontWeight: 800, color: C.purple }}
                  />
                  <input
                    className="lvl-ghost"
                    value={eq.name}
                    onChange={e => patchEquipment(i, { name: e.target.value })}
                    placeholder="아이템"
                    style={{ ...ghostBase, fontSize: 12 }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── 오른쪽: 맵 · 퀘스트 · 보스 ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '12px 14px', borderRadius: C.radius, background: C.card, border: `1px solid ${C.line}`, boxShadow: C.shadow }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SectionLabel>탐험 · 맵</SectionLabel>
                <button type="button" onClick={addMap} style={btnMini}>+</button>
              </div>
              {activeRpgRows(profile.maps).map(m => (
                <div key={m.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.line}` }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input className="lvl-ghost" value={m.name} onChange={e => patchMap(m.id, { name: e.target.value })} style={{ ...ghostBase, flex: 1, fontSize: 12, fontWeight: 700 }} />
                    <input
                      type="number"
                      min={0}
                      max={3}
                      className="lvl-ghost"
                      value={m.stars}
                      onChange={e => patchMap(m.id, { stars: Math.min(3, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
                      style={{ ...ghostBase, width: 32, textAlign: 'center', fontSize: 11 }}
                    />
                    <span style={{ fontSize: 10, color: C.hint }}>★</span>
                    <button type="button" onClick={() => removeMap(m.id)} style={{ ...btnDanger, padding: '4px 8px' }}>×</button>
                  </div>
                  <textarea
                    className="lvl-ghost-area"
                    value={m.memo}
                    onChange={e => patchMap(m.id, { memo: e.target.value })}
                    placeholder="메모"
                    style={{
                      width: '100%',
                      marginTop: 6,
                      border: `1px solid ${C.line}`,
                      borderRadius: 8,
                      background: 'rgba(0,0,0,0.02)',
                      fontSize: 11,
                      padding: 6,
                      minHeight: 40,
                      resize: 'vertical',
                      color: C.text,
                      outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ padding: '12px 14px', borderRadius: C.radius, background: C.card, border: `1px solid ${C.line}`, boxShadow: C.shadow }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SectionLabel>퀘스트</SectionLabel>
                <button type="button" onClick={addQuest} style={btnMini}>+</button>
              </div>
              {activeRpgRows(profile.quests).map(q => (
                <div key={q.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.line}` }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" checked={q.done} onChange={e => patchQuest(q.id, { done: e.target.checked })} style={{ cursor: 'pointer' }} />
                    <input className="lvl-ghost" value={q.title} onChange={e => patchQuest(q.id, { title: e.target.value })} style={{ ...ghostBase, flex: 1, fontSize: 12 }} />
                    <button type="button" onClick={() => removeQuest(q.id)} style={{ ...btnDanger, padding: '4px 8px' }}>×</button>
                  </div>
                  <textarea
                    className="lvl-ghost-area"
                    value={q.memo}
                    onChange={e => patchQuest(q.id, { memo: e.target.value })}
                    placeholder="보상·메모"
                    style={{
                      width: '100%',
                      marginTop: 6,
                      border: `1px solid ${C.line}`,
                      borderRadius: 8,
                      background: 'rgba(0,0,0,0.02)',
                      fontSize: 11,
                      padding: 6,
                      minHeight: 36,
                      resize: 'vertical',
                      color: C.text,
                      outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ padding: '12px 14px', borderRadius: C.radius, background: C.card, border: `1px solid ${C.line}`, boxShadow: C.shadow }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SectionLabel>보스</SectionLabel>
                <button type="button" onClick={addBoss} style={btnMini}>+</button>
              </div>
              {activeRpgRows(profile.bosses).map(b => (
                <div key={b.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.line}` }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="checkbox" checked={b.cleared} onChange={e => patchBoss(b.id, { cleared: e.target.checked })} style={{ cursor: 'pointer' }} />
                    <input className="lvl-ghost" value={b.name} onChange={e => patchBoss(b.id, { name: e.target.value })} style={{ ...ghostBase, flex: 1, minWidth: 120, fontSize: 12, fontWeight: 700 }} />
                    <button type="button" onClick={() => removeBoss(b.id)} style={{ ...btnDanger, padding: '4px 8px' }}>×</button>
                  </div>
                  <textarea
                    className="lvl-ghost-area"
                    value={b.memo}
                    onChange={e => patchBoss(b.id, { memo: e.target.value })}
                    placeholder="패턴·약점"
                    style={{
                      width: '100%',
                      marginTop: 6,
                      border: `1px solid ${C.line}`,
                      borderRadius: 8,
                      background: 'rgba(0,0,0,0.02)',
                      fontSize: 11,
                      padding: 6,
                      minHeight: 44,
                      resize: 'vertical',
                      color: C.text,
                      outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            padding: '12px 14px',
            borderRadius: C.radius,
            background: C.card,
            border: `1px solid ${C.line}`,
            boxShadow: C.shadow,
            maxWidth: 420,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: C.purple, marginBottom: 8 }}>통합 인물 DB</div>
          <PersonLinkPicker entityType={PERSON_ENTITY.LEVELUP_RPG} entityId={LEVELUP_RPG_ENTITY_ID} compact />
        </div>

        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: C.hint, lineHeight: 1.6 }}>
          프로필은 <strong style={{ color: C.purple }}>Supabase(app_kv)</strong>에 동기화됩니다. 레벨·경험치는 퀘스트 XP와 연동됩니다.
        </p>
      </div>

      <style>{`
        @media (max-width: 1020px) {
          .lvl-main-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
