/**
 * 공간 중심 RPG 월드 맵 — Kingdom · 시간 카드 · 인벤토리
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Swords, Laptop, Timer, Map as MapIcon, Sparkles, BookOpen, Leaf, Maximize2, Landmark } from 'lucide-react'
import type { AreaRow, ProjectRow, IdentityRow } from './supabase'
import {
  MAP_ZONES,
  detectMapZone,
  stableOffset,
  computeProjectProgress,
  type MapZoneId,
} from './mapHubZones'
import { loadInnerWorldStore, type MapMemoPin } from './lifeWorldData'
import { BL_INNER_WORLD_SYNC } from './questRpgIntegration'
import { loadRpgProfile } from './levelupRpgProfile'
import { fetchAllJournals } from './supabase'
import { hourCardSegments, remainingHourCards } from './hourCards'
import { BL_EXTERNAL_CALENDAR_SYNC, getOccupiedHourSetForLocalDate, titlesForHour } from './externalCalendarData'
import {
  loadKingdom,
  saveKingdom,
  tryBuild,
  hasBuilding,
  countBuildings,
  reconstructionFactor,
  kingdomHasObservatory,
  kingdomHasLibrary,
  kingdomHasGardenBuff,
  BUILDING_META,
  type BuildingId,
} from './kingdomData'

type QuestCard = {
  id: string
  name: string
  projectId?: string | null
  identityId?: string | null
  status?: string
  tags?: string[]
  timeSpentSec?: number
  pomodoroCount?: number
}

const KNOWLEDGE_KEY = 'bl_knowledge_recall_v1'

type CdIntent = { kind: 'focus' } | { kind: 'build'; zone: MapZoneId; building: BuildingId }

const BUILDING_DOT: Record<BuildingId, { emoji: string; dx: number; dy: number }> = {
  observatory: { emoji: '🔭', dx: 0.72, dy: 0.12 },
  garden: { emoji: '🌿', dx: 0.2, dy: 0.62 },
  library: { emoji: '📚', dx: 0.45, dy: 0.38 },
  achievement_hall: { emoji: '🏛️', dx: 0.52, dy: 0.72 },
}

function MapHubHourSeg({
  s,
  ymd,
  extHours,
}: {
  s: { hour: number; isPassed: boolean }
  ymd: string
  extHours: Set<number>
}) {
  const ext = extHours.has(s.hour)
  const extra = ext ? titlesForHour(ymd, s.hour).join(', ') : ''
  const baseBg = s.isPassed ? 'rgba(100,116,139,0.85)' : 'rgba(250,204,21,0.9)'
  const background = ext
    ? s.isPassed
      ? 'linear-gradient(180deg, rgba(71,85,105,0.95), rgba(51,65,85,0.92))'
      : 'linear-gradient(180deg, rgba(100,116,139,0.78), rgba(71,85,105,0.9))'
    : baseBg
  return (
    <span
      title={`${String(s.hour).padStart(2, '0')}:00 — ${s.isPassed ? '소모' : '잔여'}${ext ? ` · 외부: ${extra}` : ''}`}
      style={{
        width: 'calc(8.33% - 3px)',
        minWidth: 14,
        height: 18,
        borderRadius: 4,
        background,
        border: '1px solid rgba(0,0,0,0.2)',
        boxShadow: ext ? 'inset 0 0 0 2px rgba(148,163,184,0.95)' : s.isPassed ? undefined : '0 0 8px rgba(250,204,21,0.45)',
      }}
    />
  )
}

export type MapHubProps = {
  areas: AreaRow[]
  projects: ProjectRow[]
  quests: QuestCard[]
  completedQuestIds: string[]
  identities: IdentityRow[]
  activeIdentityId: string | null
  onOpenNote: (questId: string, title: string) => void
  onToggleQuestComplete: (id: string, done: boolean) => void
  onDeleteQuest: (id: string) => void
  onStartFocus: (questId: string) => void
  onTwoMinuteBoot: () => void
  /** 건설/국가 마이크로 액션 — 라벨 지정 Lv.0 */
  onMicroBoot?: (label: string) => void
  fireToast: (msg: string) => void
  /** 일과 종료 → 수호신의 신전 (회고·운명) */
  onSanctuary?: () => void
  /** 업적의 전당 건물 클릭 */
  onOpenAchievementHall?: () => void
}

export function MapHub({
  areas,
  projects,
  quests,
  completedQuestIds,
  identities,
  activeIdentityId,
  onOpenNote,
  onToggleQuestComplete,
  onDeleteQuest,
  onStartFocus,
  onTwoMinuteBoot,
  onMicroBoot,
  fireToast,
  onSanctuary,
  onOpenAchievementHall,
}: MapHubProps) {
  const micro = onMicroBoot ?? (() => onTwoMinuteBoot())

  const [gold, setGold] = useState(() => loadRpgProfile().gold)
  const [kingdom, setKingdom] = useState(loadKingdom)
  const [now, setNow] = useState(() => new Date())
  const [inventoryProjectId, setInventoryProjectId] = useState<string | null>(null)
  const [armedQuestId, setArmedQuestId] = useState<string | null>(null)
  const [cd, setCd] = useState<number | null>(null)
  const cdIntentRef = useRef<CdIntent | null>(null)

  const [buildZone, setBuildZone] = useState<MapZoneId | null>(null)
  const [pendingBuild, setPendingBuild] = useState<BuildingId | null>(null)
  const [blueprintReady, setBlueprintReady] = useState(false)

  const [panorama, setPanorama] = useState(false)
  const [gardenGuide, setGardenGuide] = useState(false)
  const [knowledge, setKnowledge] = useState<{ title: string; excerpt: string } | null>(null)
  const [zonePinModal, setZonePinModal] = useState<MapZoneId | null>(null)
  const [mapPins, setMapPins] = useState<MapMemoPin[]>(() => loadInnerWorldStore().mapPins)

  useEffect(() => {
    const h = () => setMapPins(loadInnerWorldStore().mapPins)
    window.addEventListener(BL_INNER_WORLD_SYNC, h)
    return () => window.removeEventListener(BL_INNER_WORLD_SYNC, h)
  }, [])

  useEffect(() => {
    const h = () => {
      setGold(loadRpgProfile().gold)
      setKingdom(loadKingdom())
    }
    window.addEventListener('bl-rpg-sync', h)
    return () => window.removeEventListener('bl-rpg-sync', h)
  }, [])

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  /** 도서관 — 아침 지식 인출 (간격 반복) */
  useEffect(() => {
    if (!kingdomHasLibrary(kingdom)) return
    const today = new Date().toISOString().slice(0, 10)
    try {
      const raw = localStorage.getItem(KNOWLEDGE_KEY)
      const parsed = raw ? (JSON.parse(raw) as { date?: string; idx?: number }) : {}
      if (parsed.date === today) return
    } catch {
      /* ignore */
    }
    void fetchAllJournals().then(rows => {
      if (!rows.length) return
      const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
      const doy = Math.floor(
        (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
      )
      const idx = doy % sorted.length
      const row = sorted[idx]
      const excerpt = (row.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 280)
      setKnowledge({ title: row.date, excerpt: excerpt || '(내용 없음)' })
      try {
        localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify({ date: today, idx }))
      } catch {
        /* ignore */
      }
    })
  }, [kingdom])

  const rebuild = reconstructionFactor(kingdom)
  const hourSegs = useMemo(() => hourCardSegments(now), [now])
  const remainCards = useMemo(() => remainingHourCards(now), [now])

  const [calTick, setCalTick] = useState(0)
  useEffect(() => {
    const h = () => setCalTick(t => t + 1)
    window.addEventListener(BL_EXTERNAL_CALENDAR_SYNC, h)
    return () => window.removeEventListener(BL_EXTERNAL_CALENDAR_SYNC, h)
  }, [])
  const todayYmd = useMemo(() => {
    const d = now
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }, [now])
  const extHours = useMemo(() => {
    void calTick
    return getOccupiedHourSetForLocalDate(todayYmd)
  }, [todayYmd, calTick])

  const areaById = useMemo(() => {
    const m = new Map<string, AreaRow>()
    for (const a of areas) m.set(String(a.id), a)
    return m
  }, [areas])

  const projectNodes = useMemo(() => {
    return projects.map(p => {
      const area = p.area_id ? areaById.get(String(p.area_id)) : undefined
      const zone = detectMapZone(area?.name ?? '', p.name)
      const z = MAP_ZONES.find(x => x.id === zone) ?? MAP_ZONES[MAP_ZONES.length - 1]
      const off = stableOffset(p.id, 7)
      const progress = computeProjectProgress(p, quests, completedQuestIds)
      return { project: p, area, zone, z, off, progress }
    })
  }, [projects, areaById, quests, completedQuestIds])

  const invQuests = useMemo(() => {
    if (!inventoryProjectId) return []
    return quests.filter(q => q.projectId && String(q.projectId) === inventoryProjectId)
  }, [quests, inventoryProjectId])

  const invProject = inventoryProjectId ? projects.find(p => p.id === inventoryProjectId) : null
  const invArea = invProject?.area_id ? areaById.get(String(invProject.area_id)) : null

  const pickFocusQuestId = useCallback(() => {
    return (
      armedQuestId ??
      invQuests.find(q => !completedQuestIds.includes(q.id))?.id ??
      quests.find(q => !completedQuestIds.includes(q.id))?.id ??
      null
    )
  }, [armedQuestId, invQuests, quests, completedQuestIds])

  const runFocusCountdown = useCallback(() => {
    if (!activeIdentityId) {
      fireToast('Act에서 태세(정체성)를 먼저 선택해 주세요.')
      return
    }
    if (!pickFocusQuestId()) {
      fireToast('집중할 퀘스트를 인벤토리에서 선택하거나, 미완료 퀘스트가 있어야 합니다.')
      return
    }
    cdIntentRef.current = { kind: 'focus' }
    setCd(5)
  }, [activeIdentityId, pickFocusQuestId, fireToast])

  const startBuildCountdown = useCallback(
    (zone: MapZoneId, building: BuildingId) => {
      if (!blueprintReady) {
        fireToast('먼저 마이크로 액션(설계도/씨앗/책갈피)을 완료해 주세요.')
        return
      }
      const meta = BUILDING_META[building]
      if (loadRpgProfile().gold < meta.cost) {
        fireToast(`골드가 부족합니다. (필요 ${meta.cost} G)`)
        return
      }
      const st = loadKingdom()
      if (hasBuilding(st, zone, building)) {
        fireToast('이미 이 구역에 건설되어 있습니다.')
        return
      }
      cdIntentRef.current = { kind: 'build', zone, building }
      setCd(5)
    },
    [blueprintReady, fireToast],
  )

  useEffect(() => {
    if (cd === null) return
    if (cd <= 0) {
      const intent = cdIntentRef.current
      cdIntentRef.current = null
      setCd(null)
      if (!intent) return
      if (intent.kind === 'focus') {
        const qid = pickFocusQuestId()
        if (qid) onStartFocus(qid)
      } else {
        if (tryBuild(intent.zone, intent.building)) {
          fireToast(`${BUILDING_META[intent.building].label} 건설 완료!`)
          setKingdom(loadKingdom())
        } else {
          fireToast('건설에 실패했습니다. 골드 또는 중복 상태를 확인해 주세요.')
        }
      }
      setBlueprintReady(false)
      setPendingBuild(null)
      return
    }
    const t = window.setTimeout(() => setCd(c => (c == null ? null : c - 1)), 1000)
    return () => clearTimeout(t)
  }, [cd, pickFocusQuestId, onStartFocus, fireToast])

  const openBuildZone = (z: MapZoneId) => {
    setBuildZone(z)
    setPendingBuild(null)
    setBlueprintReady(false)
  }

  const runMicroForBuild = (b: BuildingId) => {
    setPendingBuild(b)
    micro(BUILDING_META[b].microLabel)
    setBlueprintReady(true)
    fireToast('마이크로 액션 완료 — 이제 5초 착공을 누르세요.')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, width: '100%' }}>
      <style>{`
        @keyframes map-node-glow {
          0%, 100% { filter: drop-shadow(0 0 6px rgba(251,191,36,0.35)); }
          50% { filter: drop-shadow(0 0 14px rgba(251,191,36,0.85)); }
        }
        @keyframes map-water {
          0% { background-position: 0 0; }
          100% { background-position: 200px 80px; }
        }
        @keyframes breath-pulse {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.1); opacity: 1; }
        }
      `}</style>

      {/* ── 1시간 카드 + HUD ── */}
      <div
        title="시간은 가장 귀한 화폐다"
        style={{
          marginBottom: 10,
          padding: '10px 12px',
          borderRadius: 12,
          background: 'linear-gradient(180deg, #1e293b, #0f172a)',
          border: '1px solid rgba(251,191,36,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#fde68a', letterSpacing: '0.08em' }}>1시간 카드 · 오늘</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>남은 카드 {remainCards}장</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, color: '#64748b', width: 40, flexShrink: 0 }}>00–12</span>
            <div style={{ display: 'flex', gap: 3, flex: 1, flexWrap: 'wrap' }}>
              {hourSegs.slice(0, 12).map(s => (
                <MapHubHourSeg key={s.hour} s={s} ymd={todayYmd} extHours={extHours} />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, color: '#64748b', width: 40, flexShrink: 0 }}>12–24</span>
            <div style={{ display: 'flex', gap: 3, flex: 1, flexWrap: 'wrap' }}>
              {hourSegs.slice(12, 24).map(s => (
                <MapHubHourSeg key={s.hour} s={s} ymd={todayYmd} extHours={extHours} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapIcon size={20} color="#6366f1" />
          <span style={{ fontSize: 13, fontWeight: 800, color: '#37352F' }}>월드 맵</span>
          <span style={{ fontSize: 11, color: '#9B9A97' }}>
            {areas.length} Vision · {projects.length} 거점 · 건물 {countBuildings(kingdom)}개
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {kingdomHasObservatory(kingdom) && (
            <button
              type="button"
              onClick={() => setPanorama(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 10,
                border: '1px solid rgba(56,189,248,0.45)',
                background: 'rgba(14,165,233,0.15)',
                color: '#e0f2fe',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <Maximize2 size={14} /> 파노라마 시야
            </button>
          )}
          {kingdomHasGardenBuff(kingdom) && (
            <button
              type="button"
              onClick={() => setGardenGuide(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 10,
                border: '1px solid rgba(52,211,153,0.45)',
                background: 'rgba(16,185,129,0.12)',
                color: '#d1fae5',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <Leaf size={14} /> 생리적 한숨
            </button>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 12px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(15,23,42,0.92), rgba(30,27,46,0.95))',
              border: '1px solid rgba(251,191,36,0.25)',
            }}
          >
            <Sparkles size={14} color="#fbbf24" />
            <span style={{ fontSize: 12, fontWeight: 800, color: '#fef3c7' }}>{gold.toLocaleString()} G</span>
            {activeIdentityId && (
              <span style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700 }}>
                {identities.find(i => String(i.id) === String(activeIdentityId))?.name ?? '태세'}
              </span>
            )}
          </div>
          {onSanctuary && (
            <button
              type="button"
              onClick={onSanctuary}
              title="하루를 마감하고 신전에서 회고합니다"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 10,
                border: '1px solid rgba(251,191,36,0.45)',
                background: 'linear-gradient(135deg, rgba(30,58,138,0.85), rgba(15,23,42,0.95))',
                color: '#fef3c7',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <Landmark size={14} /> 턴 종료
            </button>
          )}
        </div>
      </div>

      {/* ── 맵 캔버스 ── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 'clamp(380px, 52vh, 620px)',
          borderRadius: 16,
          overflow: 'hidden',
          border: `${Math.max(1.5, 3 - rebuild * 1.5)}px solid rgba(59,130,246,${0.25 + rebuild * 0.45})`,
          boxShadow: `inset 0 0 ${80 - rebuild * 55}px rgba(0,0,0,${0.25 - rebuild * 0.18}), 0 12px 40px rgba(30,58,138,${0.2 + rebuild * 0.15})`,
          filter: `brightness(${0.88 + rebuild * 0.15}) saturate(${1 + rebuild * 0.12})`,
          background: `
            linear-gradient(180deg, rgba(56,189,248,${0.12 + rebuild * 0.08}) 0%, transparent 18%),
            repeating-linear-gradient(90deg, rgba(34,197,94,${0.08 + rebuild * 0.04}) 0px, rgba(34,197,94,0.08) 2px, transparent 2px, transparent 14px),
            repeating-linear-gradient(0deg, rgba(21,128,61,0.06) 0px, rgba(21,128,61,0.06) 2px, transparent 2px, transparent 14px),
            radial-gradient(ellipse 80% 60% at 50% 100%, rgba(22,101,52,${0.35 + rebuild * 0.15}) 0%, rgba(15,23,42,${0.2 - rebuild * 0.12}) 55%, #0f172a 100%)
          `,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '46%',
            top: 0,
            width: '8%',
            height: '100%',
            background: 'linear-gradient(90deg, rgba(8,47,73,0.5), rgba(56,189,248,0.35), rgba(8,47,73,0.5))',
            opacity: 0.85,
            animation: 'map-water 18s linear infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '44%',
            top: '42%',
            width: '12%',
            height: '8%',
            background: 'linear-gradient(180deg, #78716c, #57534e)',
            borderRadius: 4,
            border: '1px solid rgba(0,0,0,0.35)',
            boxShadow: '0 4px 0 rgba(0,0,0,0.35)',
          }}
        />

        {MAP_ZONES.map(zone => (
          <div
            key={zone.id}
            style={{
              position: 'absolute',
              left: `${zone.region.left}%`,
              top: `${zone.region.top}%`,
              width: `${zone.region.width}%`,
              height: `${zone.region.height}%`,
              borderRadius: 14,
              border: `1px dashed ${zone.accent}`,
              background: `radial-gradient(ellipse at 30% 20%, ${zone.accent}, transparent 65%)`,
              pointerEvents: 'none',
            }}
          />
        ))}

        {MAP_ZONES.map(zone => (
          <div
            key={`${zone.id}-label`}
            style={{
              position: 'absolute',
              left: `${zone.region.left + 1}%`,
              top: `${zone.region.top + 1}%`,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 8,
              background: 'rgba(15,23,42,0.55)',
              border: '1px solid rgba(255,255,255,0.08)',
              pointerEvents: 'none',
            }}
          >
            <span style={{ fontSize: 14 }}>{zone.emoji}</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.04em' }}>{zone.short}</span>
          </div>
        ))}

        {MAP_ZONES.map(zone => (
          <button
            key={`build-${zone.id}`}
            type="button"
            onClick={() => openBuildZone(zone.id)}
            style={{
              position: 'absolute',
              left: `${zone.region.left + zone.region.width * 0.72}%`,
              top: `${zone.region.top + zone.region.height * 0.78}%`,
              transform: 'translate(-50%, -50%)',
              padding: '4px 8px',
              borderRadius: 8,
              background: 'rgba(15,23,42,0.88)',
              border: '1px solid rgba(251,191,36,0.4)',
              color: '#fde68a',
              fontSize: 9,
              fontWeight: 800,
              cursor: 'pointer',
              zIndex: 5,
            }}
          >
            건설
          </button>
        ))}

        {MAP_ZONES.map(zone => {
          const row = kingdom.zones[zone.id]
          if (!row) return null
          return (Object.keys(row) as BuildingId[]).map(bid => {
            if (!row[bid]) return null
            const dot = BUILDING_DOT[bid]
            const left = zone.region.left + zone.region.width * dot.dx
            const top = zone.region.top + zone.region.height * dot.dy
            const label = BUILDING_META[bid].label
            if (bid === 'achievement_hall' && onOpenAchievementHall) {
              return (
                <button
                  key={`${zone.id}-${bid}`}
                  type="button"
                  title={`${label} — 업적 보기`}
                  onClick={() => onOpenAchievementHall()}
                  style={{
                    position: 'absolute',
                    left: `${left}%`,
                    top: `${top}%`,
                    transform: 'translate(-50%, -50%)',
                    fontSize: 22,
                    zIndex: 5,
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                    pointerEvents: 'auto',
                    background: 'rgba(15,23,42,0.55)',
                    border: '1px solid rgba(251,191,36,0.45)',
                    borderRadius: 10,
                    padding: '2px 6px',
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                >
                  {dot.emoji}
                </button>
              )
            }
            return (
              <div
                key={`${zone.id}-${bid}`}
                title={label}
                style={{
                  position: 'absolute',
                  left: `${left}%`,
                  top: `${top}%`,
                  transform: 'translate(-50%, -50%)',
                  fontSize: 20,
                  zIndex: 4,
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                  pointerEvents: 'none',
                }}
              >
                {dot.emoji}
              </div>
            )
          })
        })}

        {projectNodes.map(({ project, area, z, off, progress, zone }) => {
          const r = z.region
          const left = r.left + off.x * r.width * 0.85
          const top = r.top + off.y * r.height * 0.85
          const size = 36 + progress * 26
          const glow = progress > 0.65
          return (
            <button
              key={project.id}
              type="button"
              title={`${project.name}${area ? ` · ${area.name}` : ''}`}
              onClick={() => {
                setInventoryProjectId(project.id)
                setArmedQuestId(null)
              }}
              style={{
                position: 'absolute',
                left: `${left}%`,
                top: `${top}%`,
                width: size,
                height: size,
                transform: 'translate(-50%, -50%)',
                borderRadius: 10,
                border: '2px solid rgba(251,191,36,0.65)',
                background: 'linear-gradient(145deg, #334155, #1e293b)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: Math.min(22, 12 + progress * 12),
                boxShadow: glow
                  ? '0 0 22px rgba(251,191,36,0.75), inset 0 0 12px rgba(255,255,255,0.08)'
                  : '0 4px 12px rgba(0,0,0,0.45)',
                animation: glow ? 'map-node-glow 2.4s ease-in-out infinite' : undefined,
                transition: 'transform 0.15s',
                zIndex: 6,
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.08)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)' }}
            >
              {zoneEmoji(zone)}
            </button>
          )
        })}

        {MAP_ZONES.map(zone => {
          const n = mapPins.filter(p => p.mapZoneId === zone.id).length
          return (
            <button
              key={`iw-pin-${zone.id}`}
              type="button"
              onClick={e => {
                e.stopPropagation()
                setZonePinModal(zone.id)
              }}
              style={{
                position: 'absolute',
                left: `${zone.region.left}%`,
                top: `${zone.region.top}%`,
                width: `${zone.region.width}%`,
                height: `${zone.region.height}%`,
                borderRadius: 14,
                border: '1px solid rgba(251,191,36,0.14)',
                background: n > 0 ? 'rgba(251,191,36,0.08)' : 'rgba(15,23,42,0.03)',
                cursor: 'pointer',
                zIndex: 4,
              }}
              title={`${zone.label} — 지식 핀 ${n}개`}
            />
          )
        })}
      </div>

      {/* 퀵 슬롯 */}
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          borderRadius: 14,
          background: 'linear-gradient(180deg, #1e293b, #0f172a)',
          border: '2px solid rgba(51,65,85,0.9)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.15em', marginRight: 4 }}>QUICK</span>
        <button
          type="button"
          onClick={onTwoMinuteBoot}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderRadius: 10,
            border: '1px solid rgba(52,211,153,0.45)',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(5,150,105,0.35))',
            color: '#ecfdf5',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          <Laptop size={18} />
          2분 부팅
        </button>
        <button
          type="button"
          onClick={runFocusCountdown}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderRadius: 10,
            border: '1px solid rgba(167,139,250,0.5)',
            background: 'linear-gradient(135deg, rgba(124,58,237,0.35), rgba(79,70,229,0.4))',
            color: '#faf5ff',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          <Timer size={18} />
          5초 → 몰입
        </button>
        <span style={{ fontSize: 10, color: '#64748b', marginLeft: 4 }}>
          인벤토리 무장 · 건설도 동일 5초 규칙
        </span>
      </div>

      {/* 5초 전역 오버레이 */}
      {cd !== null && cd > 0 && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 900,
            background: 'rgba(2,6,23,0.82)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'all',
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              color: '#fef3c7',
              textShadow: '0 0 40px rgba(251,191,36,0.9)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {cd}
          </div>
        </div>
      )}

      {/* 건설 모달 */}
      {buildZone && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 850,
            background: 'rgba(2,6,23,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={e => { if (e.target === e.currentTarget) setBuildZone(null) }}
        >
          <div
            style={{
              maxWidth: 400,
              width: '100%',
              borderRadius: 16,
              border: '1px solid rgba(251,191,36,0.35)',
              background: '#0f172a',
              padding: 20,
            }}
            onClick={e => e.stopPropagation()}
          >
            <h4 style={{ margin: '0 0 12px', color: '#fef3c7', fontSize: 16 }}>
              {MAP_ZONES.find(z => z.id === buildZone)?.label ?? buildZone} — 인프라 건설
            </h4>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
              ① 마이크로 액션(2분 부팅 규칙) → ② 5초 착공. 골드가 소모됩니다.
            </p>
            {(['observatory', 'garden', 'library', 'achievement_hall'] as const).map(bid => {
              const meta = BUILDING_META[bid]
              const built = hasBuilding(kingdom, buildZone, bid)
              return (
                <div
                  key={bid}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '10px 0',
                    borderBottom: '1px solid rgba(51,65,85,0.5)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 22 }}>{meta.emoji}</span>
                    <div>
                      <p style={{ margin: 0, fontWeight: 800, color: '#e2e8f0', fontSize: 13 }}>{meta.label}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>{meta.cost} G</p>
                    </div>
                  </div>
                  {built ? (
                    <span style={{ fontSize: 11, color: '#64748b' }}>건설됨</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => runMicroForBuild(bid)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid rgba(52,211,153,0.4)',
                          background: pendingBuild === bid && blueprintReady ? 'rgba(16,185,129,0.25)' : 'rgba(15,23,42,0.8)',
                          color: '#a7f3d0',
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {meta.microLabel}
                      </button>
                      <button
                        type="button"
                        disabled={pendingBuild !== bid || !blueprintReady}
                        onClick={() => buildZone && startBuildCountdown(buildZone, bid)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid rgba(251,191,36,0.45)',
                          background: pendingBuild === bid && blueprintReady ? 'rgba(251,191,36,0.2)' : '#334155',
                          color: '#fef3c7',
                          fontSize: 10,
                          fontWeight: 800,
                          cursor: pendingBuild === bid && blueprintReady ? 'pointer' : 'not-allowed',
                        }}
                      >
                        5초 후 착공
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
            <button
              type="button"
              onClick={() => setBuildZone(null)}
              style={{ marginTop: 16, width: '100%', padding: 10, borderRadius: 10, border: 'none', background: '#334155', color: '#e2e8f0', cursor: 'pointer', fontWeight: 700 }}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 파노라마 */}
      {panorama && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 920,
            background: 'radial-gradient(ellipse at 50% 30%, rgba(56,189,248,0.15), #020617 70%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4vh 6vw',
          }}
          onClick={() => setPanorama(false)}
        >
          <p style={{ fontSize: 14, color: '#bae6fd', marginBottom: 20, textAlign: 'center', maxWidth: 480, lineHeight: 1.7 }}>
            시야를 넓히고, 숨을 길게 내쉬세요. 천문대는 먼 지평선처럼 오늘의 과제 전체를 한 번에 바라보게 합니다.
          </p>
          <div style={{ width: 'min(96vw, 1200px)', height: 'min(70vh, 640px)', borderRadius: 20, border: '2px solid rgba(56,189,248,0.35)', boxShadow: '0 0 80px rgba(14,165,233,0.2)' }} />
          <p style={{ marginTop: 16, fontSize: 12, color: '#64748b' }}>화면 아무 곳이나 눌러 닫기</p>
        </div>
      )}

      {/* 정원 — 호흡 */}
      {gardenGuide && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 920,
            background: 'rgba(2,6,23,0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setGardenGuide(false)}
        >
          <div style={{ textAlign: 'center', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <Leaf size={40} color="#4ade80" style={{ marginBottom: 12 }} />
            <h3 style={{ color: '#ecfdf5', margin: '0 0 8px' }}>생리적 한숨 · MP 회복 +10%</h3>
            <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
              4초 들이마시기 — 6초 천천히 내쉬기. 어깨를 바닥에 두고, 정원이 의지력을 돌려줍니다.
            </p>
            <div
              style={{
                width: 120,
                height: 120,
                margin: '0 auto',
                borderRadius: '50%',
                border: '3px solid rgba(52,211,153,0.5)',
                animation: 'breath-pulse 8s ease-in-out infinite',
              }}
            />
            <button
              type="button"
              onClick={() => setGardenGuide(false)}
              style={{ marginTop: 24, padding: '10px 24px', borderRadius: 12, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 지식 인출 */}
      {knowledge && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 880,
            background: 'rgba(2,6,23,0.82)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              maxWidth: 480,
              width: '100%',
              borderRadius: 16,
              border: '2px solid rgba(251,191,36,0.4)',
              background: 'linear-gradient(165deg,#1e1b2e,#0f172a)',
              padding: 22,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <BookOpen size={22} color="#fbbf24" />
              <span style={{ fontSize: 11, fontWeight: 800, color: '#fde68a', letterSpacing: '0.1em' }}>지식 인출 · 간격 반복</span>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#94a3b8' }}>노트 {knowledge.title}</p>
            <p style={{ margin: 0, fontSize: 14, color: '#e2e8f0', lineHeight: 1.65 }}>{knowledge.excerpt}</p>
            <button
              type="button"
              onClick={() => setKnowledge(null)}
              style={{ marginTop: 18, padding: '10px 20px', borderRadius: 12, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 내실 — 구역별 지식 핀 (LifeWorldHub와 동일 데이터) */}
      {zonePinModal != null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 900,
            background: 'rgba(2,6,23,0.82)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setZonePinModal(null)}
        >
          <div
            style={{
              maxWidth: 520,
              width: '100%',
              borderRadius: 16,
              border: '2px solid rgba(251,191,36,0.45)',
              background: 'linear-gradient(165deg,#1e1b2e,#0f172a)',
              padding: 22,
            }}
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const zm = zonePinModal
              const meta = MAP_ZONES.find(z => z.id === zm)
              const list = mapPins.filter(p => p.mapZoneId === zm)
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 22 }}>{meta?.emoji}</span>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#fde68a', letterSpacing: '0.1em' }}>SPATIAL PIN · 내실 Library</p>
                      <h3 style={{ margin: '4px 0 0', fontSize: 17, color: '#fef3c7' }}>{meta?.label ?? zm}</h3>
                    </div>
                  </div>
                  {list.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
                      이 구역에 꽂인 메모가 없습니다. Inner World → Library에서 핀을 추가하세요.
                    </p>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 18, maxHeight: '50vh', overflow: 'auto' }}>
                      {list.map(p => (
                        <li key={p.id} style={{ marginBottom: 14, fontSize: 13, color: '#e2e8f0', lineHeight: 1.55 }}>
                          <strong style={{ color: '#fff' }}>{p.title}</strong>
                          {(p.themeTags ?? []).length > 0 && (
                            <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {(p.themeTags ?? []).map(tag => (
                                <span
                                  key={tag}
                                  style={{
                                    fontSize: 10,
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    background: 'rgba(99,102,241,0.35)',
                                    color: '#e0e7ff',
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{p.body}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => setZonePinModal(null)}
                    style={{ marginTop: 18, padding: '10px 20px', borderRadius: 12, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
                  >
                    닫기
                  </button>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* 인벤토리 — 기존 */}
      {inventoryProjectId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 750,
            background: 'rgba(2,6,23,0.78)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={e => { if (e.target === e.currentTarget) setInventoryProjectId(null) }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 720,
              maxHeight: '90vh',
              overflow: 'auto',
              borderRadius: 16,
              border: '2px solid rgba(251,191,36,0.35)',
              background: 'linear-gradient(165deg, #0f172a 0%, #020617 100%)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.65)',
              padding: '20px 18px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#fbbf24', letterSpacing: '0.12em' }}>QUEST INVENTORY</p>
                <h3 style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 900, color: '#fef3c7' }}>{invProject?.name ?? '프로젝트'}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
                  {invArea?.name ? `${invArea.name} · ` : ''}
                  퀘스트 {invQuests.length}개
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInventoryProjectId(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 6 }}
                aria-label="닫기"
              >
                <X size={24} />
              </button>
            </div>

            {armedQuestId && (
              <p style={{ margin: '0 0 12px', fontSize: 11, color: '#a78bfa', fontWeight: 700 }}>
                무장: {quests.find(q => q.id === armedQuestId)?.name ?? '—'} → 5초 슬롯 준비됨
              </p>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                gap: 10,
              }}
            >
              {invQuests.length === 0 ? (
                <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#64748b', fontSize: 13, padding: 24 }}>이 프로젝트에 퀘스트가 없습니다.</p>
              ) : (
                invQuests.map(q => {
                  const done = completedQuestIds.includes(q.id)
                  const armed = armedQuestId === q.id
                  const iden = q.identityId ? identities.find(i => String(i.id) === String(q.identityId)) : null
                  return (
                    <div
                      key={q.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setArmedQuestId(prev => (prev === q.id ? null : q.id))}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setArmedQuestId(prev => (prev === q.id ? null : q.id)) }}
                      style={{
                        position: 'relative',
                        borderRadius: 12,
                        padding: '10px 8px',
                        border: armed ? '2px solid #a78bfa' : done ? '2px solid rgba(148,163,184,0.35)' : '2px solid rgba(251,191,36,0.55)',
                        background: done ? 'rgba(30,41,59,0.65)' : 'linear-gradient(145deg, rgba(30,27,46,0.95), rgba(15,23,42,0.98))',
                        filter: done ? 'grayscale(0.85) brightness(0.9)' : 'none',
                        cursor: 'pointer',
                        minHeight: 112,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        gap: 6,
                        boxShadow: armed ? '0 0 18px rgba(167,139,250,0.45)' : '0 6px 16px rgba(0,0,0,0.35)',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: 6,
                          left: 6,
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          background: 'rgba(124,58,237,0.85)',
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 900,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {q.pomodoroCount ?? 0}
                      </span>
                      <span style={{ fontSize: 20, marginTop: 8 }}>{done ? '✅' : '⚔️'}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#f1f5f9', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {q.name}
                      </span>
                      {iden && (
                        <span style={{ fontSize: 9, color: '#c4b5fd', fontWeight: 600 }}>{iden.name}</span>
                      )}
                      <div style={{ display: 'flex', gap: 4, marginTop: 'auto', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            onStartFocus(q.id)
                            setInventoryProjectId(null)
                          }}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 8,
                            border: 'none',
                            background: 'linear-gradient(135deg,#6366f1,#7c3aed)',
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Swords size={12} /> 몰입
                        </button>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            onOpenNote(q.id, q.name)
                          }}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 8,
                            border: '1px solid rgba(148,163,184,0.35)',
                            background: 'transparent',
                            color: '#cbd5e1',
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          노트
                        </button>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            onToggleQuestComplete(q.id, !done)
                          }}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 8,
                            border: '1px solid rgba(52,211,153,0.35)',
                            background: 'rgba(16,185,129,0.12)',
                            color: '#6ee7b7',
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {done ? '되돌림' : '완료'}
                        </button>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            if (window.confirm('이 퀘스트를 삭제할까요?')) onDeleteQuest(q.id)
                          }}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 8,
                            border: '1px solid rgba(248,113,113,0.35)',
                            background: 'transparent',
                            color: '#fca5a5',
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function zoneEmoji(z: MapZoneId): string {
  switch (z) {
    case 'creative_forest': return '🏯'
    case 'engineering_fort': return '🛠️'
    case 'commerce_plains': return '🏠'
    case 'human_realm': return '💠'
    case 'side_hill': return '🎪'
    default: return '🏛️'
  }
}
