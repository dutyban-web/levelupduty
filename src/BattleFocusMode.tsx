/**
 * 몰입형 전투 UI — DQ5 스타일 완전 리모델링
 * 브리핑 → 보스 레이드 타이머 → 승리 연출
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { X, Swords, Zap, Coins, Trophy, Radio } from 'lucide-react'
import { startAmbient, stopAmbient, resumeAudioIfNeeded, type AmbientKind } from './ambientNoise'
import type { ProjectRow, AreaRow } from './supabase'
import type { ValueAction } from './valueActionData'
import { detectNarrativeTheme, buildTragicBriefingLine, type FocusLootState } from './battleFocusNarrative'
import { BL_RPG_SYNC } from './questRpgIntegration'
import { loadRpgProfile } from './levelupRpgProfile'
import { DialogueBox } from './DialogueBox'
import { loadInnerWorldStore, COMPANION_TRAITS } from './lifeWorldData'
import { loadGarrisonTacticalAlly } from './garrisonTacticalAllyData'
import {
  pickTacticalMessage,
  createCooldownState,
  markTacticFired,
  resolveCompanionVoice,
  buildDestinyBriefingLine,
  type TacticalCooldownState,
} from './NpcTacticalSystem'
import {
  resolveIdentityArchetype,
  identitiesForArchetype,
  ARCHETYPE_LABEL,
  type IdentityArchetype,
} from './identityArchetypeData'

// ── Constants ──────────────────────────────────────────────────────────────
const STORAGE_AMBIENT = 'battle_focus_ambient_v1'
const STORAGE_BUTTERFLY = 'battle_focus_butterfly_v1'
const STORAGE_BOSS_AVATAR = 'battle_focus_boss_avatar_url_v1'

const PIXEL_FONT = '"Press Start 2P", "Courier New", Courier, monospace'

const DEFAULT_BOSS_PIXEL_URL =
  'https://cdn.pixabay.com/photo/2017/01/31/23/42/monster-2027818_640.png'
const BOSS_FALLBACK_URL =
  'https://opengameart.org/sites/default/files/styles/thumbnail/public/monster_1.png'

const ARCHETYPE_COLORS: Record<IdentityArchetype, string> = {
  analyst: '#3b82f6',
  creator: '#a855f7',
  capitalist: '#f59e0b',
  adventurer: '#22c55e',
}

// ── Retro SFX ──────────────────────────────────────────────────────────────
function playRetroSfx(freq = 660, oscType: OscillatorType = 'square', dur = 0.08) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = oscType
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + dur)
  } catch { /* ignore */ }
}

// ── Types ──────────────────────────────────────────────────────────────────
type Card = { id: string; name: string; projectId?: string | null; tags?: string[] }
type Phase = 'pick' | 'briefing' | 'raid' | 'victory'
type ButterflyGauge = { label: string; value: number }

function hashQuest(name: string): number {
  let h = 2166136261
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619)
  return Math.abs(h)
}

function loadAmbientPref(): AmbientKind {
  try {
    const r = localStorage.getItem(STORAGE_AMBIENT)
    if (r === 'brown' || r === 'rain' || r === 'off') return r
  } catch { /* ignore */ }
  return 'rain'
}

function saveAmbientPref(k: AmbientKind) {
  try { localStorage.setItem(STORAGE_AMBIENT, k) } catch { /* ignore */ }
}

function loadBossAvatarUrl(): string {
  try {
    const u = localStorage.getItem(STORAGE_BOSS_AVATAR)?.trim()
    if (u && /^https?:\/\//i.test(u)) return u
  } catch { /* ignore */ }
  return DEFAULT_BOSS_PIXEL_URL
}

function loadButterfly(): ButterflyGauge[] {
  try {
    const raw = localStorage.getItem(STORAGE_BUTTERFLY)
    if (raw) {
      const p = JSON.parse(raw) as { gauges?: ButterflyGauge[] }
      if (p.gauges?.length) return p.gauges.slice(0, 4)
    }
  } catch { /* ignore */ }
  return [
    { label: '아내와의 운명선', value: 72 },
    { label: '세계 정복 확률', value: 3 },
  ]
}

const overlayBase: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 600,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

// ── Sub-components ─────────────────────────────────────────────────────────
function BossAvatarImg({
  size,
  style,
  reloadKey,
}: {
  size: number
  style?: CSSProperties
  reloadKey?: number
}) {
  const [src, setSrc] = useState(() => loadBossAvatarUrl())
  const [stage, setStage] = useState(0)
  useEffect(() => {
    setSrc(loadBossAvatarUrl())
    setStage(0)
  }, [reloadKey])
  if (stage >= 3) {
    return (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.55,
          ...style,
        }}
      >
        👾
      </div>
    )
  }
  return (
    <img
      src={src}
      alt="보스"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'contain', imageRendering: 'pixelated', ...style }}
      onError={() => {
        if (stage === 0) { setSrc(BOSS_FALLBACK_URL); setStage(1) }
        else if (stage === 1) { setSrc(DEFAULT_BOSS_PIXEL_URL); setStage(2) }
        else { setStage(3) }
      }}
    />
  )
}

/** DQ5 스타일 창 컴포넌트 */
function DqWindow({
  children,
  style,
  color = '#4466cc',
}: {
  children: ReactNode
  style?: CSSProperties
  color?: string
}) {
  return (
    <div
      style={{
        background: 'rgba(0, 0, 18, 0.95)',
        border: `3px solid ${color}`,
        boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.06), 0 6px 24px rgba(0,0,0,0.85)`,
        borderRadius: 2,
        padding: '10px 12px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** HP/MP 픽셀 게이지 */
function PixelBar({
  value,
  max,
  color,
  borderColor,
  height = 8,
}: {
  value: number
  max: number
  color: string
  borderColor: string
  height?: number
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  return (
    <div
      style={{
        height,
        background: 'rgba(0,0,0,0.7)',
        border: `1px solid ${borderColor}`,
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          background: color,
          transition: 'width 0.5s ease',
          animation: 'dq-hp-pulse 2s ease-in-out infinite',
        }}
      />
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export function BattleFocusMode({
  open,
  quests,
  areas,
  projects,
  focusQuestId,
  onSelectQuest,
  seconds,
  totalSec,
  running,
  finished,
  isOvertime,
  overtimeSec,
  onPlayPause,
  onReset: _onReset,
  onAdjust: _onAdjust,
  onSetDefault,
  onComplete,
  onExtend,
  onClose,
  onEnterZen,
  activeIdentityId,
  linkedValueAction,
  focusLoot,
  onTabBlurWarning,
  identities = [],
  fireToast,
  onSelectIdentity,
}: {
  open: boolean
  quests: Card[]
  areas: AreaRow[]
  projects: ProjectRow[]
  focusQuestId: string | null
  onSelectQuest: (id: string) => void
  seconds: number
  totalSec: number
  running: boolean
  finished: boolean
  isOvertime: boolean
  overtimeSec: number
  onPlayPause: () => void
  onReset: () => void
  onAdjust: (d: number) => void
  onSetDefault: () => void
  onComplete: () => void
  onExtend: () => void
  onClose: () => void
  onEnterZen: () => void
  activeIdentityId: string | null
  linkedValueAction: ValueAction | null
  focusLoot: FocusLootState
  onTabBlurWarning?: () => void
  identities?: { id: string; name: string }[]
  fireToast?: (msg: string) => void
  onSelectIdentity?: (id: string) => void
}) {
  // ── State ──────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('pick')
  const [ambientKind, setAmbientKind] = useState<AmbientKind>(() => loadAmbientPref())
  const [butterfly] = useState<ButterflyGauge[]>(() => loadButterfly())
  const [tick, setTick] = useState(0)
  const [victoryShown, setVictoryShown] = useState(false)
  const [rpgMp, setRpgMp] = useState<[number, number]>(() => loadRpgProfile().mp)
  const [rpgHp, setRpgHp] = useState<[number, number]>(() => loadRpgProfile().hp)
  const [mpPulse, setMpPulse] = useState(0)

  // DQ5 UI state
  const [bossShake, setBossShake] = useState(false)
  const [bossFlash, setBossFlash] = useState(false)
  const [selectedCmd, setSelectedCmd] = useState(0)
  const [archetypeFilter, setArchetypeFilter] = useState<IdentityArchetype | null>(null)

  // ── Computed ────────────────────────────────────────────────────────────
  const quest = useMemo(() => quests.find(q => q.id === focusQuestId), [quests, focusQuestId])
  const questName = quest?.name ?? '이름 없는 과제'
  const areaProj = useMemo(() => {
    const proj = quest?.projectId
      ? projects.find(p => String(p.id) === String(quest.projectId))
      : undefined
    const area = proj?.area_id ? areas.find(a => String(a.id) === String(proj.area_id)) : undefined
    return { proj, area }
  }, [quest, areas, projects])

  const narrativeTheme = useMemo(
    () =>
      detectNarrativeTheme({
        questName,
        tags: quest?.tags,
        areaName: areaProj.area?.name ?? null,
        projectName: areaProj.proj?.name ?? null,
        valueAction: linkedValueAction ?? undefined,
      }),
    [questName, quest?.tags, areaProj.area?.name, areaProj.proj?.name, linkedValueAction],
  )

  const valueLabel = useMemo(() => {
    const id = linkedValueAction?.identity?.trim()
    const an = linkedValueAction?.actionName?.trim()
    if (id && an) return `${id} · ${an}`
    if (id) return id
    if (an) return an
    return butterfly[0]?.label ?? '당신의 약속'
  }, [linkedValueAction, butterfly])

  const tragicLine = useMemo(
    () => buildTragicBriefingLine(narrativeTheme, questName, valueLabel),
    [narrativeTheme, questName, valueLabel],
  )

  const victoryTitle = useMemo(
    () => (hashQuest((focusQuestId ?? '') + questName) % 2 === 0 ? '보스 처치!' : '운명 수호 성공!'),
    [questName, focusQuestId],
  )

  const identityMismatch = useMemo(() => {
    const activeName = activeIdentityId
      ? identities.find(i => String(i.id) === String(activeIdentityId))?.name?.trim() ?? ''
      : ''
    const linked = linkedValueAction?.identity?.trim() ?? ''
    return Boolean(activeName && linked && linked !== activeName)
  }, [activeIdentityId, linkedValueAction?.identity, identities])

  // Active archetype + color (카테고리별 테두리 색상)
  const activeArchetype = useMemo(() => {
    if (!activeIdentityId) return null
    const ident = identities.find(i => String(i.id) === String(activeIdentityId))
    if (!ident) return null
    return resolveIdentityArchetype(String(activeIdentityId), ident.name)
  }, [activeIdentityId, identities])

  const archetypeColor = activeArchetype ? ARCHETYPE_COLORS[activeArchetype] : '#4466cc'
  const activeIdentityName = activeIdentityId
    ? (identities.find(i => String(i.id) === String(activeIdentityId))?.name ?? null)
    : null

  // ── Tactical Ally ───────────────────────────────────────────────────────
  const [innerAllyTick, setInnerAllyTick] = useState(0)
  useEffect(() => {
    const h = () => setInnerAllyTick(t => t + 1)
    window.addEventListener('bl-inner-world-sync', h)
    window.addEventListener('bl-garrison-tactical-ally-sync', h)
    return () => {
      window.removeEventListener('bl-inner-world-sync', h)
      window.removeEventListener('bl-garrison-tactical-ally-sync', h)
    }
  }, [])

  const tacticalAlly = useMemo(() => {
    void innerAllyTick
    const gid = loadGarrisonTacticalAlly().companionId
    const inner = loadInnerWorldStore()
    const c = gid ? inner.companions.find(x => x.id === gid) : null
    const voice = c ? resolveCompanionVoice(c.traits) : resolveCompanionVoice([])
    const name = c?.name ?? 'TAC·지휘 AI'
    const trait0 = c?.traits[0]
    const emoji = trait0 ? (COMPANION_TRAITS.find(t => t.id === trait0)?.emoji ?? '📻') : '📻'
    return { companion: c, voice, name, emoji }
  }, [innerAllyTick])

  // ── Session timer ───────────────────────────────────────────────────────
  const [sessionElapsed, setSessionElapsed] = useState(0)
  useEffect(() => {
    if (phase !== 'raid') { setSessionElapsed(0); return }
    if (!running || finished) return
    const id = window.setInterval(() => setSessionElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [phase, running, finished])

  // ── Tactical dialogue ───────────────────────────────────────────────────
  const tacticalCdRef = useRef<TacticalCooldownState>(createCooldownState())
  const [tacticalDialogue, setTacticalDialogue] = useState<{ open: boolean; text: string; title: string }>({
    open: false,
    text: '',
    title: '',
  })
  const [typedLen, setTypedLen] = useState(0)
  const [radioSnippet, setRadioSnippet] = useState('')
  const [destinyLine, setDestinyLine] = useState<string | null>(null)
  const lastDestinyBlockRef = useRef(0)

  useEffect(() => {
    if (phase === 'raid') {
      tacticalCdRef.current = createCooldownState()
      lastDestinyBlockRef.current = 0
    }
  }, [phase])

  const tacCtxRef = useRef({
    mpRatio: 0,
    sessionElapsedSec: 0,
    isOvertime: false,
    identityMismatch: false,
    bossHpPct: 100,
  })

  // ── RPG profile sync ────────────────────────────────────────────────────
  useEffect(() => {
    const h = () => {
      const p = loadRpgProfile()
      setRpgMp(p.mp)
      setRpgHp(p.hp)
    }
    h()
    window.addEventListener(BL_RPG_SYNC, h)
    return () => window.removeEventListener(BL_RPG_SYNC, h)
  }, [open, phase])

  useEffect(() => {
    if (!open || phase !== 'raid') return
    if (!running || finished) return
    const id = window.setInterval(() => setMpPulse(p => Math.min(1, p + 0.03)), 1000)
    return () => clearInterval(id)
  }, [open, phase, running, finished])

  // ── Phase transitions ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setPhase('pick')
      setVictoryShown(false)
      setMpPulse(0)
      stopAmbient()
      return
    }
    setPhase(focusQuestId ? 'briefing' : 'pick')
    setVictoryShown(false)
  }, [open, focusQuestId])

  useEffect(() => {
    if (!open || phase !== 'raid') return
    let raf: number
    const loop = () => { setTick(t => t + 1); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [open, phase])

  useEffect(() => {
    if (!open || phase !== 'raid') { stopAmbient(); return }
    if (!running || finished) { stopAmbient(); return }
    void resumeAudioIfNeeded().then(() => {
      startAmbient(ambientKind, ambientKind === 'rain' ? 0.1 : 0.08)
    })
    return () => stopAmbient()
  }, [open, phase, running, finished, ambientKind])

  useEffect(() => {
    if (!open || phase !== 'raid') return
    const vis = () => { if (document.hidden && running && !finished) onTabBlurWarning?.() }
    document.addEventListener('visibilitychange', vis)
    return () => document.removeEventListener('visibilitychange', vis)
  }, [open, phase, running, finished, onTabBlurWarning])

  useEffect(() => {
    if (finished && open && phase === 'raid' && !victoryShown) {
      setVictoryShown(true)
      setPhase('victory')
      stopAmbient()
    }
  }, [finished, open, phase, victoryShown])

  const requestClose = useCallback(() => {
    if (window.confirm('정말 운명을 포기하시겠습니까?\n\n집중 세션이 중단되고, 남은 시간은 저장됩니다.'))
      onClose()
  }, [onClose])

  // Escape key
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); requestClose() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, requestClose])

  // Arrow key navigation for command menu
  const selectedCmdRef = useRef(0)
  selectedCmdRef.current = selectedCmd

  useEffect(() => {
    if (!open || phase !== 'raid') return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        playRetroSfx(440, 'square', 0.04)
        setSelectedCmd(c => (c - 1 + 4) % 4)
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        playRetroSfx(440, 'square', 0.04)
        setSelectedCmd(c => (c + 1) % 4)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, phase])

  // ── Display values ──────────────────────────────────────────────────────
  const displaySec = isOvertime ? overtimeSec : seconds
  const mm = String(Math.floor(displaySec / 60)).padStart(2, '0')
  const ss = String(displaySec % 60).padStart(2, '0')

  const bossHpPct = useMemo(() => {
    if (totalSec <= 0) return 100
    if (isOvertime) return 0
    return Math.max(0, Math.min(100, (seconds / totalSec) * 100))
  }, [seconds, totalSec, isOvertime])

  const isReady = !running && !finished && !isOvertime && seconds === totalSec
  const mpRatio = rpgMp[1] > 0 ? rpgMp[0] / rpgMp[1] : 0
  const mpLow = mpRatio < 0.25
  const mpVisual = Math.min(1, mpRatio + (running && !finished ? mpPulse * 0.06 : 0))
  const hpRatio = rpgHp[1] > 0 ? rpgHp[0] / rpgHp[1] : 1

  tacCtxRef.current = {
    mpRatio,
    sessionElapsedSec: sessionElapsed,
    isOvertime,
    identityMismatch,
    bossHpPct,
  }

  useEffect(() => {
    if (!tacticalDialogue.open) { setTypedLen(0); return }
    const t = tacticalDialogue.text
    setTypedLen(0)
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setTypedLen(Math.min(t.length, i))
      if (i >= t.length) window.clearInterval(id)
    }, 18)
    return () => window.clearInterval(id)
  }, [tacticalDialogue.open, tacticalDialogue.text])

  useEffect(() => {
    if (phase !== 'raid' || !running || finished) return
    const id = window.setInterval(() => {
      const now = Date.now()
      const ctx = tacCtxRef.current
      const picked = pickTacticalMessage(ctx, tacticalAlly.voice, tacticalCdRef.current, now)
      if (picked) {
        tacticalCdRef.current = markTacticFired(tacticalCdRef.current, picked.id, now)
        setRadioSnippet(
          `${picked.title} · ${picked.text.slice(0, 140)}${picked.text.length > 140 ? '…' : ''}`,
        )
        setTacticalDialogue({ open: true, text: picked.text, title: picked.title })
      }
    }, 2600)
    return () => window.clearInterval(id)
  }, [phase, running, finished, tacticalAlly.voice])

  useEffect(() => {
    if (phase !== 'raid' || !running || finished) return
    const block = Math.floor(sessionElapsed / 600)
    if (block < 1) return
    if (block <= lastDestinyBlockRef.current) return
    lastDestinyBlockRef.current = block
    const msg = buildDestinyBriefingLine({
      destinyLabel: butterfly[0]?.label ?? '운명선',
      questName,
      projectName: areaProj.proj?.name ?? null,
      areaName: areaProj.area?.name ?? null,
      valueLabel,
      blockIndex: block,
    })
    fireToast?.(msg)
    setDestinyLine(msg)
    window.setTimeout(() => setDestinyLine(null), 14000)
  }, [
    phase,
    running,
    finished,
    sessionElapsed,
    questName,
    areaProj.proj?.name,
    areaProj.area?.name,
    valueLabel,
    butterfly,
    fireToast,
  ])

  // ── Boss FX on complete ─────────────────────────────────────────────────
  const handleCompleteWithFX = useCallback(() => {
    setBossShake(true)
    setBossFlash(true)
    playRetroSfx(880, 'square', 0.2)
    window.setTimeout(() => setBossShake(false), 500)
    window.setTimeout(() => setBossFlash(false), 280)
    onComplete()
  }, [onComplete])

  // ── Helper ──────────────────────────────────────────────────────────────
  function getQuestLabel(q: Card) {
    const proj = projects.find(p => String(p.id) === String(q.projectId))
    const area = proj ? areas.find(a => String(a.id) === String(proj.area_id)) : undefined
    if (!area || !proj) return `[미분류] ${q.name}`
    return `[${area.name} > ${proj.name}] ${q.name}`
  }

  if (!open) return null

  // ── Command items ───────────────────────────────────────────────────────
  const CMD_ITEMS = [
    {
      label: '집필 아레나',
      icon: '⚔',
      desc: running ? '일시 정지' : finished ? '종료됨' : '전투 재개',
      action: () => {
        playRetroSfx(880, 'square', 0.12)
        if (!finished) onPlayPause()
      },
    },
    {
      label: 'WBS 스킬',
      icon: '✦',
      desc: '젠 집중 화면',
      action: () => {
        playRetroSfx(660, 'square', 0.1)
        onEnterZen()
      },
    },
    {
      label: '아이템',
      icon: '🎒',
      desc: '보상 상점',
      action: () => {
        playRetroSfx(440, 'square', 0.08)
        fireToast?.('보상 상점은 세션 완료 후 이용 가능합니다.')
      },
    },
    {
      label: '도망가기',
      icon: '💨',
      desc: '전투 포기',
      action: () => {
        playRetroSfx(200, 'sawtooth', 0.22)
        requestClose()
      },
    },
  ]

  // slight float for idle boss animation
  void tick

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

        @keyframes dq-boss-shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          10%  { transform: translateX(-16px) rotate(-2deg); }
          20%  { transform: translateX(14px) rotate(2deg); }
          30%  { transform: translateX(-11px) rotate(-1.5deg); }
          40%  { transform: translateX(9px) rotate(1.5deg); }
          55%  { transform: translateX(-6px) rotate(-0.8deg); }
          70%  { transform: translateX(4px) rotate(0.5deg); }
          85%  { transform: translateX(-2px); }
        }
        @keyframes dq-boss-flash {
          0%   { opacity: 0.75; }
          18%  { opacity: 0; }
          36%  { opacity: 0.65; }
          100% { opacity: 0; }
        }
        @keyframes dq-cursor-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes dq-hp-pulse {
          0%, 100% { filter: brightness(1); }
          50%       { filter: brightness(1.25); }
        }
        @keyframes dq-enemy-idle {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes dq-float-up {
          0%   { transform: translateY(0) scale(0.85); opacity: 0; }
          20%  { opacity: 1; }
          100% { transform: translateY(-90px) scale(1.1); opacity: 0; }
        }
        @keyframes dq-victory-in {
          0%   { transform: scale(0.82); opacity: 0; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes dq-window-glow {
          0%, 100% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06), 0 6px 24px rgba(0,0,0,0.85), 0 0 12px rgba(68,102,204,0.15); }
          50%       { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.09), 0 6px 24px rgba(0,0,0,0.85), 0 0 28px rgba(68,102,204,0.35); }
        }
        @keyframes dq-scanline-move {
          0%   { background-position: 0 0; }
          100% { background-position: 0 4px; }
        }
      `}</style>

      {/* ════════════════════════════════════════════════════════
          BRIEFING / PICK PHASE
      ════════════════════════════════════════════════════════ */}
      {(phase === 'pick' || phase === 'briefing') && (
        <div
          style={{
            ...overlayBase,
            background: 'linear-gradient(180deg, #070712 0%, #0a0a1e 60%, #08000f 100%)',
            flexDirection: 'column',
            padding: 20,
          }}
        >
          {/* Scanlines */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background:
                'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.14) 2px, rgba(0,0,0,0.14) 4px)',
              zIndex: 2,
              animation: 'dq-scanline-move 0.12s linear infinite',
            }}
          />

          <DqWindow
            color={archetypeColor}
            style={{
              maxWidth: 520,
              width: '100%',
              padding: '22px 20px',
              color: '#e2e8f0',
              position: 'relative',
              zIndex: 10,
              animation: 'dq-window-glow 4s ease-in-out infinite',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 7,
                    fontFamily: PIXEL_FONT,
                    letterSpacing: '0.18em',
                    color: archetypeColor,
                  }}
                >
                  DESTINY BRIEFING
                </p>
                <h2
                  style={{
                    margin: '8px 0 0',
                    fontSize: 13,
                    fontFamily: PIXEL_FONT,
                    color: '#f8fafc',
                    lineHeight: 1.6,
                  }}
                >
                  운명의 브리핑
                </h2>
              </div>
              <button
                type="button"
                onClick={requestClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 6,
                }}
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>

            {/* ── 정체성 2단계 선택 시스템 ── */}
            {!activeIdentityId && onSelectIdentity && (
              <div
                style={{
                  marginBottom: 14,
                  padding: '12px',
                  border: `2px solid ${archetypeColor}40`,
                  background: 'rgba(0,0,0,0.4)',
                  borderRadius: 2,
                }}
              >
                <p
                  style={{
                    margin: '0 0 10px',
                    fontSize: 7,
                    fontFamily: PIXEL_FONT,
                    color: archetypeColor,
                    letterSpacing: '0.12em',
                    animation: 'dq-cursor-blink 1s step-end infinite',
                  }}
                >
                  {archetypeFilter === null
                    ? '▶ STEP 1: 태세 카테고리 선택'
                    : `▶ STEP 2: ${ARCHETYPE_LABEL[archetypeFilter].label} 세부 태세`}
                </p>

                {archetypeFilter === null ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {(Object.keys(ARCHETYPE_LABEL) as IdentityArchetype[]).map(arch => (
                      <button
                        key={arch}
                        type="button"
                        onClick={() => {
                          playRetroSfx(660)
                          setArchetypeFilter(arch)
                        }}
                        style={{
                          padding: '10px 6px',
                          border: `2px solid ${ARCHETYPE_COLORS[arch]}`,
                          background: `${ARCHETYPE_COLORS[arch]}12`,
                          color: '#fff',
                          cursor: 'pointer',
                          borderRadius: 2,
                          fontFamily: PIXEL_FONT,
                          fontSize: 7,
                          lineHeight: 1.8,
                          textAlign: 'center',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => {
                          ;(e.currentTarget as HTMLButtonElement).style.background =
                            `${ARCHETYPE_COLORS[arch]}30`
                          playRetroSfx(440, 'square', 0.04)
                        }}
                        onMouseLeave={e => {
                          ;(e.currentTarget as HTMLButtonElement).style.background =
                            `${ARCHETYPE_COLORS[arch]}12`
                        }}
                      >
                        {ARCHETYPE_LABEL[arch].emoji}
                        <br />
                        {ARCHETYPE_LABEL[arch].label}
                        <br />
                        <span style={{ fontSize: 6, color: '#94a3b8' }}>
                          {ARCHETYPE_LABEL[arch].blurb}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        playRetroSfx(330)
                        setArchetypeFilter(null)
                      }}
                      style={{
                        marginBottom: 8,
                        padding: '4px 10px',
                        border: '1px solid #555',
                        background: 'transparent',
                        color: '#aaa',
                        cursor: 'pointer',
                        fontFamily: PIXEL_FONT,
                        fontSize: 7,
                        borderRadius: 2,
                      }}
                    >
                      ← 뒤로
                    </button>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 5,
                        maxHeight: 160,
                        overflowY: 'auto',
                      }}
                    >
                      {identitiesForArchetype(identities, archetypeFilter).length === 0 ? (
                        <p
                          style={{
                            margin: 0,
                            fontSize: 8,
                            fontFamily: PIXEL_FONT,
                            color: '#64748b',
                            lineHeight: 1.7,
                          }}
                        >
                          해당 카테고리에 정체성이 없습니다.
                          <br />
                          Act 메뉴에서 추가해 주세요.
                        </p>
                      ) : (
                        identitiesForArchetype(identities, archetypeFilter).map(ident => (
                          <button
                            key={ident.id}
                            type="button"
                            onClick={() => {
                              playRetroSfx(880, 'square', 0.14)
                              onSelectIdentity(String(ident.id))
                              setArchetypeFilter(null)
                            }}
                            onMouseEnter={() => playRetroSfx(440, 'square', 0.04)}
                            style={{
                              padding: '8px 12px',
                              border: `1px solid ${ARCHETYPE_COLORS[archetypeFilter]}55`,
                              background: `${ARCHETYPE_COLORS[archetypeFilter]}0d`,
                              color: '#e2e8f0',
                              cursor: 'pointer',
                              borderRadius: 2,
                              fontFamily: PIXEL_FONT,
                              fontSize: 8,
                              textAlign: 'left',
                              transition: 'background 0.1s',
                            }}
                          >
                            ▶ {ident.name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Active identity badge */}
            {activeIdentityId && (
              <div
                style={{
                  marginBottom: 12,
                  padding: '6px 10px',
                  border: `1px solid ${archetypeColor}55`,
                  background: `${archetypeColor}10`,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 16 }}>
                  {activeArchetype ? ARCHETYPE_LABEL[activeArchetype].emoji : '🎭'}
                </span>
                <div>
                  <span
                    style={{ fontSize: 6, fontFamily: PIXEL_FONT, color: archetypeColor, display: 'block' }}
                  >
                    {activeArchetype ? ARCHETYPE_LABEL[activeArchetype].label : 'IDENTITY'}
                  </span>
                  <span style={{ fontSize: 8, fontFamily: PIXEL_FONT, color: '#f8fafc' }}>
                    {activeIdentityName}
                  </span>
                </div>
              </div>
            )}

            {/* Pick phase */}
            {phase === 'pick' && (
              <div style={{ marginTop: 4 }}>
                <label
                  style={{
                    fontSize: 7,
                    fontFamily: PIXEL_FONT,
                    color: '#94a3b8',
                    display: 'block',
                    marginBottom: 8,
                  }}
                >
                  집중할 퀘스트
                </label>
                <select
                  value={focusQuestId ?? ''}
                  onChange={e => onSelectQuest(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `2px solid ${archetypeColor}50`,
                    background: 'rgba(0,0,20,0.9)',
                    color: '#f1f5f9',
                    fontSize: 12,
                    borderRadius: 2,
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                >
                  <option value="">— 퀘스트 선택 —</option>
                  {quests.map(q => (
                    <option key={q.id} value={q.id}>
                      {getQuestLabel(q)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!focusQuestId}
                  onClick={() => {
                    playRetroSfx(660)
                    setPhase('briefing')
                  }}
                  style={{
                    marginTop: 14,
                    width: '100%',
                    padding: '12px',
                    border: `2px solid ${focusQuestId ? archetypeColor : '#334155'}`,
                    background: focusQuestId ? `${archetypeColor}20` : 'rgba(0,0,0,0.3)',
                    color: focusQuestId ? '#fff' : '#64748b',
                    fontFamily: PIXEL_FONT,
                    fontSize: 8,
                    cursor: focusQuestId ? 'pointer' : 'not-allowed',
                    borderRadius: 2,
                    letterSpacing: '0.06em',
                  }}
                >
                  {focusQuestId ? '▶ 브리핑 받기' : '— 퀘스트를 선택하세요 —'}
                </button>
              </div>
            )}

            {/* Briefing phase */}
            {phase === 'briefing' && (
              <div style={{ marginTop: 4 }}>
                <div
                  style={{
                    display: 'flex',
                    gap: 14,
                    alignItems: 'flex-start',
                    marginBottom: 14,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      flex: 1,
                      fontSize: 11,
                      lineHeight: 1.85,
                      color: '#cbd5e1',
                      fontWeight: 600,
                    }}
                  >
                    {tragicLine}
                  </p>
                  <div style={{ flexShrink: 0, textAlign: 'center' }}>
                    <p
                      style={{
                        margin: '0 0 4px',
                        fontSize: 7,
                        fontFamily: PIXEL_FONT,
                        color: '#fde68a',
                      }}
                    >
                      BOSS
                    </p>
                    <BossAvatarImg size={72} reloadKey={hashQuest(focusQuestId ?? '')} />
                  </div>
                </div>

                <div
                  style={{
                    marginBottom: 14,
                    padding: '8px 12px',
                    border: '1px solid rgba(248,113,113,0.3)',
                    background: 'rgba(239,68,68,0.05)',
                    borderRadius: 2,
                  }}
                >
                  <p style={{ margin: 0, fontSize: 10, color: '#fca5a5', fontWeight: 700 }}>
                    연결 가치: {valueLabel}
                  </p>
                </div>

                {/* Ambient selector */}
                <p
                  style={{
                    margin: '0 0 6px',
                    fontSize: 7,
                    fontFamily: PIXEL_FONT,
                    color: '#94a3b8',
                  }}
                >
                  배경음
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  {(['rain', 'brown', 'off'] as const).map(k => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setAmbientKind(k)
                        saveAmbientPref(k)
                        playRetroSfx(330, 'square', 0.06)
                      }}
                      style={{
                        padding: '6px 10px',
                        border: `2px solid ${ambientKind === k ? archetypeColor : '#334155'}`,
                        background: ambientKind === k ? `${archetypeColor}20` : 'transparent',
                        color: '#e2e8f0',
                        fontSize: 8,
                        fontFamily: PIXEL_FONT,
                        cursor: 'pointer',
                        borderRadius: 2,
                      }}
                    >
                      {k === 'rain' ? '빗소리' : k === 'brown' ? '브라운' : '없음'}
                    </button>
                  ))}
                </div>

                {/* Battle start */}
                <button
                  type="button"
                  disabled={!focusQuestId || !activeIdentityId}
                  onClick={async () => {
                    if (!focusQuestId || !activeIdentityId) return
                    playRetroSfx(880, 'square', 0.22)
                    await resumeAudioIfNeeded()
                    setPhase('raid')
                    if (!running && !finished) onPlayPause()
                  }}
                  style={{
                    width: '100%',
                    padding: '14px',
                    border: `3px solid ${!focusQuestId || !activeIdentityId ? '#475569' : archetypeColor}`,
                    background:
                      !focusQuestId || !activeIdentityId
                        ? 'rgba(0,0,0,0.3)'
                        : `${archetypeColor}22`,
                    color: !focusQuestId || !activeIdentityId ? '#64748b' : '#fff',
                    fontSize: 10,
                    fontFamily: PIXEL_FONT,
                    cursor: !focusQuestId || !activeIdentityId ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    borderRadius: 2,
                    letterSpacing: '0.05em',
                  }}
                >
                  <Swords size={16} />
                  전투 개시
                </button>
                {!activeIdentityId && (
                  <p
                    style={{
                      margin: '10px 0 0',
                      fontSize: 7,
                      fontFamily: PIXEL_FONT,
                      color: '#f87171',
                      textAlign: 'center',
                      lineHeight: 1.8,
                    }}
                  >
                    ↑ 위에서 태세(정체성)를 선택해 주세요.
                  </p>
                )}
              </div>
            )}
          </DqWindow>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          RAID PHASE — DQ5 LAYOUT
      ════════════════════════════════════════════════════════ */}
      {phase === 'raid' && (
        <div
          style={{
            ...overlayBase,
            flexDirection: 'column',
            background:
              'linear-gradient(180deg, #0d0d1a 0%, #08080e 45%, #0a0008 100%)',
            justifyContent: 'space-between',
            overflow: 'hidden',
          }}
        >
          {/* Scanlines overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background:
                'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.11) 2px, rgba(0,0,0,0.11) 4px)',
              zIndex: 1,
              animation: 'dq-scanline-move 0.12s linear infinite',
            }}
          />

          {/* Boss flash overlay */}
          {bossFlash && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 30,
                pointerEvents: 'none',
                background: 'rgba(255,255,255,0.72)',
                animation: 'dq-boss-flash 0.3s ease-out forwards',
              }}
            />
          )}

          {/* Destiny line toast */}
          {destinyLine && (
            <div
              style={{
                position: 'absolute',
                bottom: 240,
                left: 12,
                right: 12,
                maxWidth: 520,
                margin: '0 auto',
                padding: '8px 12px',
                border: '2px solid rgba(251,191,36,0.55)',
                background: 'rgba(0,0,18,0.96)',
                zIndex: 20,
                borderRadius: 2,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 7,
                  fontFamily: PIXEL_FONT,
                  color: '#fde68a',
                  letterSpacing: '0.14em',
                }}
              >
                DESTINY LINE
              </p>
              <p
                style={{ margin: '4px 0 0', fontSize: 10, color: '#e2e8f0', lineHeight: 1.55 }}
              >
                {destinyLine}
              </p>
            </div>
          )}

          {/* ── 상단: 보스 전장 ── */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
              width: '100%',
              paddingTop: 8,
              paddingBottom: 6,
              position: 'relative',
              zIndex: 5,
            }}
          >
            {/* Boss name + HP bar */}
            <div style={{ width: '100%', maxWidth: 560, padding: '0 14px', marginBottom: 10 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 4,
                }}
              >
                <span
                  style={{ fontSize: 7, fontFamily: PIXEL_FONT, color: '#fca5a5', letterSpacing: '0.1em' }}
                >
                  {areaProj.proj?.name ? `BOSS · ${areaProj.proj.name}` : 'BOSS'}
                </span>
                <span style={{ fontSize: 7, fontFamily: PIXEL_FONT, color: '#fca5a5' }}>
                  {isOvertime ? '격노 페이즈!!' : `HP ${Math.round(bossHpPct)}%`}
                </span>
              </div>
              <div
                style={{
                  height: 16,
                  background: 'rgba(0,0,0,0.8)',
                  border: '2px solid #8b0000',
                  borderRadius: 1,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: `${bossHpPct}%`,
                    height: '100%',
                    background: isOvertime
                      ? 'linear-gradient(90deg,#dc2626,#f97316,#dc2626)'
                      : 'linear-gradient(90deg,#16a34a,#22c55e,#4ade80)',
                    transition: 'width 0.95s linear',
                    animation: 'dq-hp-pulse 1.8s ease-in-out infinite',
                    backgroundSize: '200% 100%',
                  }}
                />
              </div>
              <p
                style={{
                  margin: '5px 0 0',
                  fontSize: 9,
                  fontFamily: PIXEL_FONT,
                  color: '#fef3c7',
                  textAlign: 'center',
                  lineHeight: 1.5,
                  textShadow: `0 0 16px ${archetypeColor}`,
                }}
              >
                {questName}
              </p>
            </div>

            {/* Boss Avatar — large center, idle float + shake on complete */}
            <div
              style={{
                animation: bossShake
                  ? 'dq-boss-shake 0.5s ease'
                  : 'dq-enemy-idle 3.2s ease-in-out infinite',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <BossAvatarImg
                size={155}
                reloadKey={hashQuest((focusQuestId ?? '') + 'raid')}
                style={{
                  filter: bossFlash
                    ? 'brightness(12) invert(1) saturate(0)'
                    : 'drop-shadow(0 0 28px rgba(220,38,38,0.6)) drop-shadow(0 14px 36px rgba(0,0,0,0.95))',
                  transition: bossFlash ? 'none' : 'filter 0.35s ease',
                }}
              />
            </div>
          </div>

          {/* ── 하단 UI 영역 ── */}
          <div
            style={{
              width: '100%',
              padding: '6px 10px 8px',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {/* 파티 스탯창 — DQ5 상단 고정형 파티 HUD */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {/* Identity box */}
              <DqWindow
                color={archetypeColor}
                style={{
                  flex: '1 1 110px',
                  padding: '7px 9px',
                  minWidth: 0,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 7,
                    fontFamily: PIXEL_FONT,
                    color: archetypeColor,
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {activeIdentityName ?? 'HERO'}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 6, fontFamily: PIXEL_FONT, color: '#94a3b8' }}>
                  {activeArchetype ? ARCHETYPE_LABEL[activeArchetype].emoji : '🎭'}{' '}
                  {activeArchetype ? ARCHETYPE_LABEL[activeArchetype].label : '—'}
                </p>
              </DqWindow>

              {/* HP / MP box */}
              <DqWindow
                color="#8b0000"
                style={{ flex: '2 1 160px', padding: '7px 9px', minWidth: 0 }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 3,
                  }}
                >
                  <span style={{ fontSize: 6, fontFamily: PIXEL_FONT, color: '#ff6666' }}>HP</span>
                  <span style={{ fontSize: 7, fontFamily: PIXEL_FONT, color: '#fecaca' }}>
                    {rpgHp[0]}/{rpgHp[1]}
                  </span>
                </div>
                <PixelBar
                  value={rpgHp[0]}
                  max={rpgHp[1]}
                  color={
                    hpRatio > 0.5
                      ? 'linear-gradient(90deg,#16a34a,#4ade80)'
                      : hpRatio > 0.25
                        ? 'linear-gradient(90deg,#ca8a04,#facc15)'
                        : 'linear-gradient(90deg,#dc2626,#ef4444)'
                  }
                  borderColor="#8b0000"
                  height={7}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 4,
                    marginBottom: 3,
                  }}
                >
                  <span style={{ fontSize: 6, fontFamily: PIXEL_FONT, color: '#38bdf8' }}>MP</span>
                  <span style={{ fontSize: 7, fontFamily: PIXEL_FONT, color: '#bae6fd' }}>
                    {rpgMp[0]}/{rpgMp[1]}
                  </span>
                </div>
                <PixelBar
                  value={mpVisual * rpgMp[1]}
                  max={rpgMp[1]}
                  color="linear-gradient(90deg,#0ea5e9,#38bdf8,#a5f3fc)"
                  borderColor="#0369a1"
                  height={7}
                />
                {mpLow && (
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: 6,
                      fontFamily: PIXEL_FONT,
                      color: '#fca5a5',
                      lineHeight: 1.6,
                      animation: 'dq-cursor-blink 0.8s step-end infinite',
                    }}
                  >
                    ⚠ MP 부족!
                  </p>
                )}
              </DqWindow>

              {/* Timer box */}
              <DqWindow
                color="#806600"
                style={{ flex: '1 1 90px', padding: '7px 9px', minWidth: 0, textAlign: 'center' }}
              >
                <p
                  style={{ margin: 0, fontSize: 6, fontFamily: PIXEL_FONT, color: '#fde68a', lineHeight: 1 }}
                >
                  TIME
                </p>
                <p
                  style={{
                    margin: '3px 0 2px',
                    fontSize: 13,
                    fontFamily: PIXEL_FONT,
                    color: isOvertime ? '#ef4444' : '#fef3c7',
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                    textShadow: isOvertime ? '0 0 12px rgba(239,68,68,0.8)' : `0 0 10px ${archetypeColor}`,
                  }}
                >
                  {isOvertime ? `+${mm}:${ss}` : `${mm}:${ss}`}
                </p>
                <p style={{ margin: 0, fontSize: 6, fontFamily: PIXEL_FONT, color: '#94a3b8' }}>
                  {finished ? '종료' : isOvertime ? '초과!!' : running ? '전투중' : '대기'}
                </p>
              </DqWindow>
            </div>

            {/* 두 번째 행: TAC-NET 메시지창 + 커맨드 메뉴 */}
            <div style={{ display: 'flex', gap: 6 }}>
              {/* TAC-NET 메시지창 */}
              <DqWindow
                color="#223366"
                style={{ flex: '2 1 180px', padding: '7px 9px', minWidth: 0 }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    marginBottom: 5,
                  }}
                >
                  <Radio size={11} color="#38bdf8" />
                  <span
                    style={{
                      fontSize: 6,
                      fontFamily: PIXEL_FONT,
                      color: '#7dd3fc',
                      letterSpacing: '0.14em',
                    }}
                  >
                    TAC-NET
                  </span>
                  <span style={{ fontSize: 6, fontFamily: PIXEL_FONT, color: '#334466' }}>
                    CH7
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 9,
                    color: '#cbd5e1',
                    lineHeight: 1.55,
                    maxHeight: 52,
                    overflow: 'hidden',
                  }}
                >
                  {radioSnippet || '무전 대기 중… 집중 상태를 모니터링합니다.'}
                </p>
              </DqWindow>

              {/* ── 커맨드 메뉴 (DQ5 스타일 4선택지) ── */}
              <DqWindow
                color={archetypeColor}
                style={{ flex: '1 1 140px', padding: '7px 9px', minWidth: 130 }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {CMD_ITEMS.map((cmd, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setSelectedCmd(i)
                        cmd.action()
                      }}
                      onMouseEnter={() => {
                        playRetroSfx(440, 'square', 0.04)
                        setSelectedCmd(i)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '5px 7px',
                        background: selectedCmd === i ? `${archetypeColor}22` : 'transparent',
                        border:
                          selectedCmd === i
                            ? `1px solid ${archetypeColor}`
                            : '1px solid transparent',
                        borderRadius: 1,
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        transition: 'background 0.1s',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 8,
                          fontFamily: PIXEL_FONT,
                          color: '#fef3c7',
                          minWidth: 10,
                          animation:
                            selectedCmd === i
                              ? 'dq-cursor-blink 0.75s step-end infinite'
                              : 'none',
                        }}
                      >
                        {selectedCmd === i ? '▶' : '\u3000'}
                      </span>
                      <span
                        style={{
                          fontSize: 7,
                          fontFamily: PIXEL_FONT,
                          color: selectedCmd === i ? '#fff' : '#94a3b8',
                          lineHeight: 1.3,
                        }}
                      >
                        {cmd.label}
                      </span>
                    </button>
                  ))}
                </div>
              </DqWindow>
            </div>

            {/* 세션 완료 / 보스 격파 선언 */}
            {(running || isOvertime || (!isReady && !finished)) && !finished && (
              <button
                type="button"
                onClick={handleCompleteWithFX}
                style={{
                  width: '100%',
                  padding: '9px',
                  border: `2px solid ${archetypeColor}`,
                  background: `${archetypeColor}18`,
                  color: '#fef3c7',
                  fontSize: 8,
                  fontFamily: PIXEL_FONT,
                  cursor: 'pointer',
                  borderRadius: 2,
                  letterSpacing: '0.05em',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLButtonElement).style.background = `${archetypeColor}30`
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLButtonElement).style.background = `${archetypeColor}18`
                }}
              >
                ⚔ 세션 완료 · 보스 격파 선언
              </button>
            )}

            {finished && (
              <button
                type="button"
                onClick={onExtend}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '2px solid #6366f1',
                  background: 'rgba(99,102,241,0.12)',
                  color: '#c4b5fd',
                  fontSize: 7,
                  fontFamily: PIXEL_FONT,
                  cursor: 'pointer',
                  borderRadius: 2,
                }}
              >
                +5분 연장
              </button>
            )}

            {isReady && (
              <button
                type="button"
                onClick={onSetDefault}
                style={{
                  width: '100%',
                  fontSize: 6,
                  fontFamily: PIXEL_FONT,
                  color: '#64748b',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '3px',
                }}
              >
                25분으로 설정
              </button>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          VICTORY PHASE
      ════════════════════════════════════════════════════════ */}
      {phase === 'victory' && finished && (
        <div
          style={{
            ...overlayBase,
            background: 'rgba(0,0,10,0.93)',
            backdropFilter: 'blur(8px)',
            flexDirection: 'column',
            zIndex: 700,
            padding: 20,
          }}
        >
          {/* Scanlines */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background:
                'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)',
              zIndex: 1,
            }}
          />

          <DqWindow
            color={archetypeColor}
            style={{
              animation: 'dq-victory-in 0.4s ease forwards',
              width: '100%',
              maxWidth: 420,
              padding: '22px 18px',
              color: '#e2e8f0',
              position: 'relative',
              zIndex: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Trophy size={22} color="#fbbf24" />
              <h2
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontFamily: PIXEL_FONT,
                  color: '#fef3c7',
                  lineHeight: 1.5,
                  textShadow: '0 0 16px rgba(251,191,36,0.6)',
                }}
              >
                승리!
              </h2>
            </div>
            <p
              style={{
                margin: '0 0 16px',
                fontSize: 7,
                fontFamily: PIXEL_FONT,
                color: '#fca5a5',
                lineHeight: 1.8,
              }}
            >
              {victoryTitle}
            </p>

            {focusLoot.status === 'loading' && (
              <p
                style={{
                  margin: '18px 0',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: 8,
                  fontFamily: PIXEL_FONT,
                  lineHeight: 2,
                  animation: 'dq-cursor-blink 1s step-end infinite',
                }}
              >
                전리품 계산 중…
              </p>
            )}

            {focusLoot.status === 'ready' && (
              <>
                <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                  <div
                    style={{
                      flex: '1 1 110px',
                      padding: '10px',
                      border: `2px solid ${archetypeColor}55`,
                      background: `${archetypeColor}0d`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <Zap size={20} color="#fbbf24" />
                    <div>
                      <p
                        style={{ margin: 0, fontSize: 6, fontFamily: PIXEL_FONT, color: '#fde68a' }}
                      >
                        EXP
                      </p>
                      <p
                        style={{
                          margin: '3px 0 0',
                          fontSize: 16,
                          fontFamily: PIXEL_FONT,
                          color: '#fef3c7',
                        }}
                      >
                        +{focusLoot.xpGain}
                      </p>
                    </div>
                  </div>
                  <div
                    style={{
                      flex: '1 1 110px',
                      padding: '10px',
                      border: '2px solid rgba(34,211,238,0.4)',
                      background: 'rgba(34,211,238,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <Coins size={20} color="#67e8f9" />
                    <div>
                      <p
                        style={{ margin: 0, fontSize: 6, fontFamily: PIXEL_FONT, color: '#a5f3fc' }}
                      >
                        COIN
                      </p>
                      <p
                        style={{
                          margin: '3px 0 0',
                          fontSize: 16,
                          fontFamily: PIXEL_FONT,
                          color: '#ecfeff',
                        }}
                      >
                        +{focusLoot.coins}
                      </p>
                    </div>
                  </div>
                </div>
                <p
                  style={{ margin: '0 0 6px', fontSize: 11, lineHeight: 1.7, color: '#cbd5e1', fontWeight: 600 }}
                >
                  {focusLoot.message}
                </p>
                {focusLoot.error && (
                  <p
                    style={{
                      margin: '0 0 10px',
                      fontSize: 8,
                      fontFamily: PIXEL_FONT,
                      color: '#f87171',
                      lineHeight: 1.7,
                    }}
                  >
                    {focusLoot.error}
                  </p>
                )}
              </>
            )}

            {focusLoot.status === 'idle' && (
              <p
                style={{
                  margin: '18px 0',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: 9,
                  fontFamily: PIXEL_FONT,
                  lineHeight: 2,
                }}
              >
                세션 마무리 중…
              </p>
            )}

            {/* Victory particles */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: 70,
                overflow: 'hidden',
                marginBottom: 6,
              }}
            >
              {Array.from({ length: 10 }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${8 + (i * 17) % 80}%`,
                    bottom: 4,
                    fontSize: 8,
                    fontFamily: PIXEL_FONT,
                    color: i % 2 === 0 ? '#fbbf24' : '#67e8f9',
                    animation: `dq-float-up ${1.0 + (i % 4) * 0.1}s ease-out forwards`,
                    animationDelay: `${i * 0.06}s`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {i % 2 === 0 ? `+${20 + (i * 8) % 80}EXP` : `G+${10 + (i * 4) % 40}`}
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                padding: '11px',
                border: `3px solid ${archetypeColor}`,
                background: `${archetypeColor}20`,
                color: '#fff',
                fontSize: 9,
                fontFamily: PIXEL_FONT,
                cursor: 'pointer',
                borderRadius: 2,
                letterSpacing: '0.05em',
              }}
            >
              ▶ 전장을 떠나기
            </button>
          </DqWindow>
        </div>
      )}

      <DialogueBox
        open={tacticalDialogue.open}
        speaker={`【${tacticalAlly.name} · TAC-NET】${tacticalDialogue.title ? ` — ${tacticalDialogue.title}` : ''}`}
        onDismiss={() => setTacticalDialogue(d => ({ ...d, open: false }))}
      >
        {tacticalDialogue.text.slice(0, typedLen)}
      </DialogueBox>
    </>
  )
}
