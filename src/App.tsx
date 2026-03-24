import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  loadValueActionStore,
  activeValueActions,
  computeQuestRewardsFromValue,
  setQuestValueLink,
  getQuestValueLink,
  type ValueAction,
} from './valueActionData'
import {
  applyQuestCompleteRpgRewards,
  applyMicroVictoryRpg,
  applyFocusSessionMpRecovery,
  applyMpDrainForQuestComplete,
} from './questRpgIntegration'
import { SKILL_BRANCHES } from './skillTreeData'
import { RoutineStreet } from './RoutineStreet'
import { buildLootEncouragement, type FocusLootState } from './battleFocusNarrative'
import { QuestTacticalDrillModal } from './QuestTacticalDrillModal'
import { BattleFocusMode } from './BattleFocusMode'
import { MapHub } from './MapHub'
import { useIsMobile } from './hooks/useIsMobile'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { kvSet, kvSetAttempt, kvGet, kvGetAll, kvListTrashedKeys, isSupabaseReady, subscribeKv } from './lib/supabase'
import { TrashPage } from './TrashPage'
import { CALENDAR_KEY, loadCalendar, BeautifulLifeSection } from './CalendarLifeSection'
import { PossessionPage } from './PossessionPageInternal'
import { subscribeAppSyncStatus, emitAppSyncStatus, scheduleSyncIdle, SYNC_IDLE_MS } from './syncIndicatorBus'
import { hydrateLocalStorageFromKvRecord, migrateLocalToKvIfMissing } from './kvSyncedKeys'
import {
  supabase as _sbClient,
  fetchUserStats, upsertUserStats,
  fetchAllJournals,
  fetchUserCreatedQuests,
  updateQuestTitle, updateQuestDeadline, updateQuestIdentity, updateQuestStatus, updateQuestTags, updateQuestSortOrder,
  softDeleteUserQuestRow, addQuestTimeSpent, updateQuestRemainingTime, incrementQuestPomodoroCount,
  fetchDailyLog, upsertDailyLog, upsertDailyLogFortune, updateDailyLogPomodoros, updateQuestPomodoroCount, setDailyLogTime, updateDailyLogTimeScore,
  fetchLevelRewards, insertLevelReward, claimLevelReward,
  setAreaTimeSpent, setProjectTimeSpent, setQuestTimeSpent,
  signIn, signOut, getSession, onAuthStateChange,
  insertJournalNote, updateJournalNote, deleteJournalNote,
  fetchProjects, insertProject, updateProject, deleteProject, addProjectTimeSpent,
  fetchAreas, insertArea, updateArea, deleteArea, addAreaTimeSpent, updateAreaSortOrder, updateProjectSortOrder,
  fetchIdentities,
  fetchActiveIdentity, updateActiveIdentity, addFocusSession,
  type IdentityRow,
  insertEventEvent, updateEventEvent, deleteEventEvent, fetchCalendarEventsByType,
  fetchNoteContent, saveNoteContent,
  type Session,
  type ProjectRow, type AreaRow,
} from './supabase'
import { ManifestationPage } from './Manifestation'
import { TrackerPage } from './TrackerPage'
import { ReviewPage } from './ReviewPageInternal'
import { QuestAdventureJournal } from './QuestAdventureJournal'
import { SETTLEMENT_KEY } from './settlementData'
import { QuantumFlowPage } from './QuantumFlowPage'
import { AccountLedgerPage } from './AccountLedgerPage'
import { EvolutionPage } from './EvolutionPage'
import { GoalsPage } from './GoalsPage'
import { NetworkPage } from './NetworkPage'
import { ValuePage } from './ValuePage'
import { ValueReferencePanel, ValueReferenceMobileFab } from './ValueReferencePanel'
import { QUANTUM_FLOW_KEY } from './quantumFlowData'
import { ACCOUNT_LEDGER_KEY, TRAVEL_TRIP_DETAIL_KEY } from './accountLedgerData'
import { EVOLUTION_KEY } from './evolutionData'
import { HABIT_ROUTINE_CHAIN_KEY } from './habitRoutineData'
import { SanctuaryView } from './SanctuaryView'
import { SANCTUARY_KPT_KEY } from './sanctuaryData'
import { LifeWorldHub } from './LifeWorldHub'
import { ChronicleAnalyticsPage } from './ChronicleAnalyticsPage'
import { GrowthPage } from './GrowthPage'
import { BossRaidPage } from './BossRaidPage'
import { CharacterStatusView } from './CharacterStatusView'
import { shouldShowMorningPresenceModal } from './presenceData'
import { applyXpGainToSimulationWallet } from './simulationWalletData'
import { INNER_WORLD_KEY } from './lifeWorldData'
import { CHRONICLE_STORE_KEY } from './chronicleData'
import { EXTERNAL_CALENDAR_STORE_KEY } from './externalCalendarData'
import { SKILL_TREE_KEY } from './skillTreeData'
import { REWARD_HISTORY_KEY } from './rewardHistoryData'
import { ACHIEVEMENTS_KEY } from './achievementsData'
import { VISUALIZATION_ITEMS_KEY } from './rewardShopData'
import { SIMULATION_WALLET_KEY } from './simulationWalletData'
import { MORNING_PRESENCE_ACK_KEY } from './presenceData'
import { ARCHETYPE_LABEL, IDENTITY_ARCHETYPE_KEY } from './identityArchetypeData'
import { GARRISON_TACTICAL_ALLY_KEY } from './garrisonTacticalAllyData'
import { LEGACY_ARCHIVE_KEY, syncLegacyArchiveFromProjects } from './legacyArchiveData'
import { FragmentPage } from './FragmentPage'
import { MasterBoardPage } from './MasterBoardPage'
import { ManualPage } from './ManualPage'
import { PersonLinkPicker } from './PersonLinkPicker'
import { fetchSeoulWeatherNow, wmoCodeToEmoji } from './seoulWeather'
import { FRAGMENT_KEY } from './fragmentData'
import { LevelupRpgPage } from './LevelupRpgPage'
import { TravelPage } from './TravelPageInternal'
import { FortunePage } from './FortunePageInternal'
import { SajuBigeupSection, SAJU_KEY } from './SajuBigeupPage'
import { ProjectHubPage, PROJECT_WORKSPACE_KEY, PROJECT_HUB_PREFS_KEY } from './ProjectHubPage'
import { WorkspaceDataArchiveModal, WorkspaceArchiveTrigger, type WorkspaceArchiveKind } from './WorkspaceDataArchiveModal'
import { loadStatus, recordFocusSession } from './utils/storage'
import { appendPomodoroLog } from './pomodoroLogData'
import { RichEditor } from './RichEditor'
import { useUndoRedo } from './contexts/UndoRedoContext'
import {
  Trophy, BarChart3, Archive,
  CheckCircle2,
  Plus, X, ChevronRight, ChevronLeft, ChevronUp, ChevronDown,
  Utensils, Apple, Heart, Timer, Pencil, Lock, Gift, Trash2, Image, File, FileText, FileSpreadsheet, Presentation, CalendarRange, Move, Settings, GripVertical,
  GitBranch, Zap,
  type LucideIcon,
} from 'lucide-react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Solar } from 'lunar-javascript'

// ═══════════════════════════════════════ RESPONSIVE ═══════════════════════════
/** GNB + HashRouter 경로 (하이픈 포함) */
type PageId =
  | 'life'
  | 'tracker'
  | 'goals'
  | 'evolution'
  | 'fortune'
  | 'manifestation'
  | 'act'
  | 'master-board'
  | 'manual'
  | 'levelup'
  | 'growth'
  | 'raid'
  | 'project'
  | 'value'
  | 'quest'
  | 'network'
  | 'review'
  | 'quantum'
  | 'account'
  | 'travel'
  | 'fragment'
  | 'trash'
  | 'inner-world'
  | 'chronicle'

const PAGE_IDS: PageId[] = ['life', 'tracker', 'goals', 'evolution', 'fortune', 'manifestation', 'act', 'master-board', 'manual', 'levelup', 'growth', 'raid', 'project', 'value', 'quest', 'review', 'quantum', 'network', 'inner-world', 'chronicle', 'account', 'travel', 'fragment', 'trash']

/** 데스크톱 상단 GNB — 한 줄·한 묶음 (Board부터 Note까지 순서 고정, sep = 구분선) */
type GnbRowItem =
  | { kind: 'link'; id: PageId; label: string; emoji: string; to?: string }
  | { kind: 'sep' }

const GNB_ROW_ITEMS: GnbRowItem[] = [
  { kind: 'sep' },
  { kind: 'link', id: 'master-board', label: 'Board', emoji: '📋' },
  { kind: 'link', id: 'manual', label: 'Manu', emoji: '📖' },
  { kind: 'sep' },
  { kind: 'link', id: 'life', label: 'Life', emoji: '📅' },
  { kind: 'link', id: 'fortune', label: 'Fortu', emoji: '🔮' },
  { kind: 'link', id: 'goals', label: 'Goals', emoji: '🎯' },
  { kind: 'link', id: 'tracker', label: 'Track', emoji: '⏱️' },
  { kind: 'link', id: 'manifestation', label: 'Manif', emoji: '✨' },
  { kind: 'link', id: 'evolution', label: 'Evol', emoji: '🧬' },
  { kind: 'sep' },
  { kind: 'link', id: 'act', label: 'Act', emoji: '🎭' },
  { kind: 'sep' },
  { kind: 'link', id: 'value', label: 'Value', emoji: '💎' },
  { kind: 'link', id: 'levelup', label: 'Level', emoji: '⬆️' },
  { kind: 'link', id: 'growth', label: 'Grow', emoji: '🌳' },
  { kind: 'link', id: 'raid', label: 'Raid', emoji: '⚔️' },
  { kind: 'link', id: 'project', label: 'Project', emoji: '📁' },
  { kind: 'link', id: 'quest', label: 'Quest', emoji: '⚡', to: '/' },
  { kind: 'sep' },
  { kind: 'link', id: 'review', label: 'Review', emoji: '📓' },
  { kind: 'sep' },
  { kind: 'link', id: 'quantum', label: 'Quant', emoji: '✦' },
  { kind: 'sep' },
  { kind: 'link', id: 'network', label: 'Net', emoji: '🌐' },
  { kind: 'link', id: 'inner-world', label: 'Inner', emoji: '🏯' },
  { kind: 'link', id: 'chronicle', label: 'Time', emoji: '📜' },
  { kind: 'link', id: 'account', label: 'Acc', emoji: '💰' },
  { kind: 'link', id: 'travel', label: 'Trav', emoji: '✈️' },
  { kind: 'link', id: 'fragment', label: 'Note', emoji: '◇' },
  { kind: 'sep' },
  { kind: 'link', id: 'trash', label: 'Trash', emoji: '🗑️' },
  { kind: 'sep' },
]

/** 오늘 날짜의 만세력 월·일 기둥 (예: 辛卯월 癸巳일) — lunar-javascript EightChar */
function formatTodayGanzhiLine(d = new Date()): string {
  const solar = Solar.fromDate(d)
  const lunar = solar.getLunar()
  const ec = lunar.getEightChar()
  return `${ec.getMonth()}월 ${ec.getDay()}일`
}

/** ISO 8601 주차 (1–53), 로컬 달력 날짜 기준 */
function getISOWeekNumber(d: Date): number {
  const date = new Date(d.getTime())
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  const week1 = new Date(date.getFullYear(), 0, 4)
  return (
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
    )
  )
}

// ── 수동 편집(Override) UI ──
const EditIcon = ({ onClick, title = '수정' }: { onClick: () => void; title?: string }) => (
  <button
    type="button"
    onClick={e => { e.stopPropagation(); onClick() }}
    title={title}
    style={{
      padding: '2px', marginLeft: '4px', border: 'none', background: 'none', cursor: 'pointer',
      color: '#AEAAA4', transition: 'color 0.15s', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle',
    }}
    onMouseEnter={e => { e.currentTarget.style.color = '#6366f1' }}
    onMouseLeave={e => { e.currentTarget.style.color = '#AEAAA4' }}
  >
    <Pencil size={12} strokeWidth={2} />
  </button>
)

function EditableNumber({
  value, onSave, min = 0, displaySuffix = '', displayOverride, inputPlaceholder = '',
}: {
  value: number
  onSave: (v: number) => void
  min?: number
  displaySuffix?: string
  displayOverride?: string
  inputPlaceholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState(String(value))
  useEffect(() => { if (editing) setInput(String(value)) }, [editing, value])
  const commit = () => {
    const n = parseInt(input, 10)
    if (!Number.isNaN(n) && n >= min) onSave(n)
    setEditing(false)
  }
  if (editing) {
    return (
      <input
        type="number"
        value={input}
        onChange={e => setInput(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit() }}
        autoFocus
        min={min}
        placeholder={inputPlaceholder}
        style={{
          width: '72px', padding: '4px 8px', fontSize: '13px', border: '1px solid rgba(99,102,241,0.4)',
          borderRadius: '6px', outline: 'none', backgroundColor: '#FFFFFF',
        }}
      />
    )
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {displayOverride ?? `${value}${displaySuffix}`}
      <EditIcon onClick={() => setEditing(true)} />
    </span>
  )
}

function EditableTimeMinutes({
  totalSec, onSave, displayOverride,
}: {
  totalSec: number
  onSave: (sec: number) => void
  displayOverride?: string
}) {
  const [editing, setEditing] = useState(false)
  const minutes = Math.round(totalSec / 60)
  const [input, setInput] = useState(String(minutes))
  useEffect(() => { if (editing) setInput(String(minutes)) }, [editing, minutes])
  const commit = () => {
    const n = parseInt(input, 10)
    if (!Number.isNaN(n) && n >= 0) onSave(n * 60)
    setEditing(false)
  }
  if (editing) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <input
          type="number"
          value={input}
          onChange={e => setInput(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit() }}
          autoFocus
          min={0}
          placeholder="분"
          style={{
            width: '64px', padding: '4px 8px', fontSize: '13px', border: '1px solid rgba(99,102,241,0.4)',
            borderRadius: '6px', outline: 'none', backgroundColor: '#FFFFFF',
          }}
        />
        <span style={{ fontSize: '11px', color: '#9B9A97' }}>분</span>
      </span>
    )
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {displayOverride ?? `${minutes}분`}
      <EditIcon onClick={() => setEditing(true)} title="분 단위로 수정" />
    </span>
  )
}

// ── MobileBottomNav ───────────────────────────────────────────────────────────
function MobileBottomNav({ active }: { active: PageId }) {
  const ITEMS: { id: PageId; emoji: string; label: string }[] = [
    { id: 'master-board', emoji: '📋', label: 'Board' },
    { id: 'manual', emoji: '📖', label: 'Manu' },
    { id: 'life', emoji: '📅', label: 'Life' },
    { id: 'fortune', emoji: '🔮', label: 'Fortu' },
    { id: 'goals', emoji: '🎯', label: 'Goals' },
    { id: 'tracker', emoji: '⏱️', label: 'Track' },
    { id: 'manifestation', emoji: '✨', label: 'Manif' },
    { id: 'evolution', emoji: '🧬', label: 'Evol' },
    { id: 'act', emoji: '🎭', label: 'Act' },
    { id: 'value', emoji: '💎', label: 'Value' },
    { id: 'levelup', emoji: '⬆️', label: 'Level' },
    { id: 'growth', emoji: '🌳', label: 'Grow' },
    { id: 'raid', emoji: '⚔️', label: 'Raid' },
    { id: 'project', emoji: '📁', label: 'Proj' },
    { id: 'quest', emoji: '⚡', label: 'Quest' },
    { id: 'review', emoji: '📓', label: 'Review' },
    { id: 'quantum', emoji: '✦', label: 'Quant' },
    { id: 'network', emoji: '🌐', label: 'Net' },
    { id: 'inner-world', emoji: '🏯', label: 'Inner' },
    { id: 'chronicle', emoji: '📜', label: 'Time' },
    { id: 'account', emoji: '💰', label: 'Acc' },
    { id: 'travel', emoji: '✈️', label: 'Trav' },
    { id: 'fragment', emoji: '◇', label: 'Note' },
    { id: 'trash', emoji: '🗑️', label: 'Trash' },
  ]
  return (
    <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 500, display: 'flex', overflowX: 'auto', WebkitOverflowScrolling: 'touch', backgroundColor: 'rgba(255,255,255,0.95)', borderTop: '1px solid rgba(0,0,0,0.06)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {ITEMS.map(item => {
        const isActive = active === item.id
        return (
          <Link key={item.id} to={item.id === 'quest' ? '/' : `/${item.id}`}
            style={{ flex: '0 0 auto', minWidth: '52px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', padding: '10px 6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', minHeight: '56px', position: 'relative', WebkitTapHighlightColor: 'transparent', textDecoration: 'none', color: 'inherit' }}
          >
            {isActive && <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '28px', height: '2.5px', borderRadius: '999px', backgroundColor: '#6366f1', boxShadow: '0 0 8px rgba(99,102,241,0.7)' }} />}
            <span style={{ fontSize: '18px', lineHeight: 1 }}>{item.emoji}</span>
            <span style={{ fontSize: '9px', fontWeight: isActive ? 800 : 500, color: isActive ? '#4F46E5' : '#787774', letterSpacing: '0.02em', marginTop: '1px' }}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

// ═══════════════════════════════════════ ICONS ═══════════════════════════════
const IcoPen = () => (
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
)
const IcoFocus = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
    <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
  </svg>
)
const IcoCheck = () => (
  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
)
const IcoChevron = () => (
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M9 18l6-6-6-6" />
  </svg>
)
const IcoClose = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)
const IcoPlay = () => (
  <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
    <path d="M5 3l14 9-14 9V3z" />
  </svg>
)
const IcoPause = () => (
  <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
    <rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
)
const IcoStop = () => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
)
const IcoReset = () => (
  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M3 12a9 9 0 109-9 9 9 0 00-6.16 2.4L3 8" /><path d="M3 3v5h5" />
  </svg>
)

// ═══════════════════════════════════════ TYPES ═══════════════════════════════
type Card = {
  id: string; name: string; sub: string; emoji?: string
  projectId?: string | null
  identityId?: string | null
  status?: string
  tags?: string[]
  sortOrder?: number
  priority?: number; deadline?: string
  timeSpentSec?: number; remainingTimeSec?: number | null
  pomodoroCount?: number
  startedAt?: string; endedAt?: string
}

// ── 스탯 타입 ──
type StatDef = {
  id: string; label: string
  value: string        // 편집 가능한 주요 값
  unit: string         // 표시 시 뒤에 붙는 단위 (빈 문자열 가능)
  memo: string         // 부가 메모 (내 운세 등에서 사용)
  col: string; emoji: string
  isText: boolean      // true = 자유 텍스트, false = 숫자 위주
  hasMemo: boolean     // 별도 메모 필드 표시 여부
}
const STATS_KEY = 'creative_os_stats_v1'
const COMPLETED_KEY = 'creative_os_completed_quests'
const XP_KEY = 'creative_os_xp_v1'
const XP_PER_QUEST = 20

/** 단일 진실 공급원: total_xp만 저장 */
type XpState = { totalXp: number }

/** RPG 레벨업: 구간별 필요 XP (Lv.1~500) */
function getRequiredXp(level: number): number {
  if (level <= 100) return 1_000
  if (level <= 300) return 3_000
  if (level <= 450) return 4_500
  return 7_500
}

/** 레벨 L에 도달하는 데 필요한 누적 XP */
function cumulativeXpToReachLevel(level: number): number {
  if (level <= 1) return 0
  if (level <= 100) return (level - 1) * 1_000
  if (level <= 300) return 100_000 + (level - 101) * 3_000
  if (level <= 450) return 700_000 + (level - 301) * 4_500
  return 1_375_000 + (level - 451) * 7_500
}

const MAX_LEVEL = 500

/** total_xp → RPG 레벨·진행도 (구간별 1k/3k/4.5k/7.5k XP) */
function calculateLevel(totalXp: number): {
  currentLevel: number
  currentLevelXp: number
  maxCurrentLevelXp: number
  baseXpForCurrentLevel: number
  totalXp: number
  progressPct: number
  progressPercentage: number
} {
  const clamped = Math.max(0, totalXp)
  let level = 1
  let acc = 0
  for (; ;) {
    const req = getRequiredXp(level)
    if (acc + req > clamped || level >= MAX_LEVEL) break
    acc += req
    level++
  }
  const baseXpForCurrentLevel = acc
  const currentLevelXp = clamped - acc
  const maxCurrentLevelXp = getRequiredXp(level)
  const progressPct = maxCurrentLevelXp > 0 ? Math.min((currentLevelXp / maxCurrentLevelXp) * 100, 100) : 0
  return {
    currentLevel: level,
    currentLevelXp,
    maxCurrentLevelXp,
    baseXpForCurrentLevel,
    totalXp: clamped,
    progressPct,
    progressPercentage: progressPct,
  }
}

/** 일일 작업 시간(분) → 초과근무 가중치 시간 점수(XP) */
function calculateTimeScore(minutes: number): number {
  const m = Math.max(0, Math.floor(minutes))
  if (m <= 480) return Math.floor(m / 10)
  if (m <= 600) return 48 + Math.floor((m - 480) / 10) * 2
  if (m <= 720) return 72 + Math.floor((m - 600) / 10) * 3
  return 108 + Math.floor((m - 720) / 10) * 4
}

const LEVEL_TITLES: Record<number, string> = {
  1: '백지의 작가', 2: '초고 작가', 3: '연재 지망생',
  4: '신인 작가', 5: '중견 작가', 6: '베테랑 작가',
  7: '거장', 8: '전설의 작가', 9: '창작의 신',
}
function getLevelTitle(level: number): string {
  return LEVEL_TITLES[level] ?? `무한 창작자 (Lv.${level})`
}

function loadXp(): XpState {
  try {
    const raw = localStorage.getItem(XP_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed.totalXp === 'number') return { totalXp: parsed.totalXp }
      if (typeof parsed.level === 'number' && typeof parsed.currentXp === 'number') {
        return { totalXp: cumulativeXpToReachLevel(parsed.level) + parsed.currentXp }
      }
    }
  } catch { /* ignore */ }
  return { totalXp: 0 }
}
function saveXp(s: XpState) {
  localStorage.setItem(XP_KEY, JSON.stringify(s))
  kvSet(XP_KEY, s)
  const { currentLevel, maxCurrentLevelXp } = calculateLevel(s.totalXp)
  const rawStats = localStorage.getItem(STATS_KEY)
  const stats_json = rawStats ? JSON.parse(rawStats) : {}
  upsertUserStats({ level: currentLevel, current_xp: 0, required_xp: maxCurrentLevelXp, total_xp: s.totalXp, stats_json })
}

// ── Journal (localStorage key — sync effect & ReviewPageInternal) ────────────
const JOURNAL_KEY = 'creative_os_journal_v1'

// 퀘스트 추가 UI에서 사용하는 카테고리 옵션
const CAT_OPTS = [
  { id: 'writing', label: '집필', col: '#818cf8', emoji: '📋' },
  { id: 'business', label: '비즈니스/공부', col: '#fbbf24', emoji: '💼' },
  { id: 'health', label: '자기관리', col: '#34d399', emoji: '🏃' },
] as const
type CatId = 'writing' | 'business' | 'health'

// USER_QUESTS_KEY reserved for potential future use

// ── QuestTable (Notion 스타일 퀘스트 시트) ──────────────────────────────────
type ColDef = { key: string; label: string; hidden?: boolean; custom?: boolean; type?: 'text' | 'number' | 'date' }
const DEFAULT_COLS: ColDef[] = [
  { key: 'sort', label: '순서' },
  { key: 'area', label: 'Vision Area' },
  { key: 'project', label: 'Real Projects' },
  { key: 'status', label: '상태' },
  { key: 'name', label: '퀘스트명' },
  { key: 'tags', label: '태그' },
  { key: 'category', label: '카테고리' },
  { key: 'priority', label: '중요도' },
  { key: 'timespent', label: '누적 집중' },
  { key: 'pomodoro_count', label: '몰입 횟수' },
  { key: 'pomodoro', label: '타이머 선택' },
  { key: 'delete', label: '관리' },
  { key: 'deadline', label: '마감일' },
]
const QT_COLS_KEY = 'qt_cols_v4'  // v4: 컬럼 순서 재배치 (Area→Project→Status→Name→...→Due Date)

function TagInput({ tags, onChange, placeholder = '태그 입력 후 Enter' }: { tags: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState('')
  const addTag = () => {
    const t = input.trim()
    if (t && !tags.includes(t)) onChange([...tags, t])
    setInput('')
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '9px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#F1F1EF', minWidth: '140px' }}>
      {tags.map(t => (
        <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: 'rgba(99,102,241,0.15)', color: '#6366f1', padding: '3px 8px', borderRadius: '999px' }}>
          {t}
          <button type="button" onClick={() => onChange(tags.filter(x => x !== t))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6366f1', fontSize: '12px', lineHeight: 1 }}>×</button>
        </span>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} placeholder={placeholder}
        style={{ flex: 1, minWidth: '60px', border: 'none', backgroundColor: 'transparent', fontSize: '12px', color: '#37352F', outline: 'none' }} />
    </div>
  )
}
const QUEST_FILTER_TABS = ['전체', '진행중', '완료'] as const
type QFilter = typeof QUEST_FILTER_TABS[number]

function fmtSec(sec?: number) {
  if (!sec) return '-'
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** D-day 계산: 오늘 기준 남은/지난 일수 → { label, type } */
function getDDay(deadline: string): { label: string; type: 'future' | 'today' | 'past' } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(deadline)
  due.setHours(0, 0, 0, 0)
  const diffMs = due.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))
  if (diffDays === 0) return { label: 'Today', type: 'today' }
  if (diffDays > 0) return { label: `D-${diffDays}`, type: 'future' }
  return { label: `D+${Math.abs(diffDays)}`, type: 'past' }
}
// 포모도로 횟수 → ⏱️ 아이콘 시각화 (5개 초과 시 "⏱️ x N" 축약)
function renderPomodoroIcons(count?: number, small = false): React.ReactNode {
  const n = count ?? 0
  if (n <= 0) return <span style={{ color: '#AEAAA4', fontSize: '12px' }}>—</span>
  const size = small ? '12px' : '14px'
  if (n <= 5) {
    return (
      <span style={{ display: 'inline-flex', gap: '2px', alignItems: 'center', fontSize: size }}>
        {Array.from({ length: n }, (_, i) => (
          <span key={i} style={{ lineHeight: 1 }} title="완료한 몰입 세션">⏱️</span>
        ))}
      </span>
    )
  }
  return (
    <span style={{ fontSize: size, color: '#7C3AED', fontWeight: 600 }} title={`${n}회 완료`}>
      ⏱️ × {n}
    </span>
  )
}

// total_time_sec → "OO시간 OO분" 또는 "OO분 OO초" (대시보드용)
function fmtDailyTime(sec?: number): string {
  if (!sec || sec < 0) return '0분'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}시간 ${m}분`
  if (m > 0) return `${m}분 ${s}초`
  return `${s}초`
}

// total_time_sec → "HH:MM" 형식 (기존 호환)
function fmtHHMM(sec?: number): string {
  if (!sec || sec < 0) return '0:00'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `0:${String(m).padStart(2, '0')}`
}

// "누적 N시간 M분" 형식 (시간 없으면 분만)
function fmtHM(sec?: number): string | null {
  if (!sec || sec < 60) return null
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `누적 ${h}시간 ${m}분`
  return `누적 ${m}분`
}

// ═══════════════════════════════════════ NOTE MODAL ═══════════════════════════
type NoteMeta = {
  areaName?: string
  projectName?: string
  timeSpentSec?: number
  pomodoroCount?: number
  isCompleted?: boolean
}
type NoteTarget = {
  table: 'areas' | 'projects' | 'quests' | 'journals' | 'calendar_journal'
  id: string
  title: string
  meta?: NoteMeta
}

function NoteModal({
  target, onClose, onUpdateQuestPomodoroCount, onUpdateTimeSpent, onUpdateQuestTitle,
}: {
  target: NoteTarget
  onClose: () => void
  onUpdateQuestPomodoroCount?: (questId: string, newCount: number) => void
  onUpdateTimeSpent?: (id: string, table: 'areas' | 'projects' | 'quests', sec: number) => void
  onUpdateQuestTitle?: (id: string, newTitle: string) => void
}) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(target.title)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setTitleDraft(target.title) }, [target.title])

  useEffect(() => {
    setLoading(true)
    setSaveStatus('idle')
    fetchNoteContent(target.table as 'areas' | 'projects' | 'quests' | 'journals' | 'calendar_journal', target.id).then(c => {
      setContent(c)
      setLoading(false)
    })
  }, [target.id, target.table])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  function handleChange(val: string) {
    setContent(val)
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await saveNoteContent(target.table as 'areas' | 'projects' | 'quests' | 'journals' | 'calendar_journal', target.id, val)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 800)
  }

  const tableLabel: Record<string, string> = {
    areas: '🌐 Vision Area', projects: '📁 Real Projects', quests: '✅ Quest', journals: '📓 Journal', calendar_journal: '📓 Journal',
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '20px',
        width: 'min(780px, 92vw)',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(0,0,0,0.22)',
        animation: 'notePopIn 0.2s cubic-bezier(0.34,1.2,0.64,1)',
        overflow: 'hidden',
      }}>

        {/* 상단 바 */}
        <div style={{
          padding: '22px 32px 16px',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: '11px', fontWeight: 700, color: '#6366f1',
            letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            {tableLabel[target.table] ?? target.table}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {saveStatus === 'saving' && (
              <span style={{ fontSize: '12px', color: '#AEAAA4' }}>저장 중…</span>
            )}
            {saveStatus === 'saved' && (
              <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 700 }}>✓ 저장됨</span>
            )}
            <button
              onClick={onClose}
              style={{
                width: '30px', height: '30px',
                borderRadius: '8px', border: 'none', background: 'none',
                cursor: 'pointer', fontSize: '18px', lineHeight: '30px', textAlign: 'center',
                color: '#9B9A97', transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F1F1EF'; e.currentTarget.style.color = '#37352F' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9B9A97' }}
            >✕</button>
          </div>
        </div>

        {/* 본문 — 제목 + Properties + 에디터 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 40px 36px' }}>
          {/* 큰 제목 (퀘스트는 클릭 시 편집) */}
          {target.table === 'quests' && onUpdateQuestTitle ? (
            editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={async () => {
                  setEditingTitle(false)
                  const t = titleDraft.trim()
                  if (t && t !== target.title) {
                    await onUpdateQuestTitle!(target.id, t)
                  } else setTitleDraft(target.title)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                      ; (e.target as HTMLInputElement).blur()
                  }
                  if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(target.title) }
                }}
                style={{
                  margin: '0 0 20px', padding: '4px 10px',
                  fontSize: '30px', fontWeight: 800,
                  color: '#37352F', lineHeight: 1.25,
                  width: '100%', border: '1px solid #6366f1', borderRadius: '8px',
                  backgroundColor: '#F1F1EF', outline: 'none',
                }}
              />
            ) : (
              <h1
                onClick={() => setEditingTitle(true)}
                style={{
                  margin: '0 0 20px', padding: 0,
                  fontSize: '30px', fontWeight: 800,
                  color: '#37352F', lineHeight: 1.25,
                  wordBreak: 'break-word',
                  cursor: 'pointer',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#4F46E5' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#37352F' }}
                title="클릭하여 제목 수정"
              >
                {target.title}
              </h1>
            )
          ) : (
            <h1 style={{
              margin: '0 0 20px', padding: 0,
              fontSize: '30px', fontWeight: 800,
              color: '#37352F', lineHeight: 1.25,
              wordBreak: 'break-word',
            }}>
              {target.title}
            </h1>
          )}

          {target.table === 'quests' && (
            <div style={{ marginBottom: 18 }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: '#6366f1', letterSpacing: '0.06em' }}>통합 인물 DB</p>
              <PersonLinkPicker entityType="user_quest" entityId={target.id} compact />
            </div>
          )}

          {/* ── Properties 패널 (Notion 스타일) ── */}
          {(target.meta || target.table !== 'journals') && (() => {
            const m = target.meta ?? {}
            const rows: { icon: string; label: string; value: string; isTimeRow?: boolean; timeSec?: number }[] = []
            if (target.table === 'quests' || target.table === 'projects' || target.table === 'areas') {
              if (target.table === 'quests') {
                rows.push({ icon: '📁', label: 'Real Projects', value: m.projectName ?? '—' })
                rows.push({ icon: '🌐', label: 'Vision Area', value: m.areaName ?? '—' })
                rows.push({ icon: '✅', label: '상태', value: m.isCompleted ? '완료' : '진행 중' })
              }
              if (target.table === 'projects') {
                rows.push({ icon: '🌐', label: 'Vision Area', value: m.areaName ?? '—' })
              }
              if (target.table === 'quests' || target.table === 'projects' || target.table === 'areas') {
                const sec = m.timeSpentSec ?? 0
                const h = Math.floor(sec / 3600)
                const min = Math.floor((sec % 3600) / 60)
                const timeStr = h > 0
                  ? `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')} (${h}시간 ${min}분)`
                  : `${String(min).padStart(2, '0')}분`
                rows.push({ icon: '⏱', label: '누적 집중', value: timeStr, isTimeRow: true, timeSec: sec })
              }
              if (target.table === 'quests') {
                rows.push({ icon: '🍅', label: '몰입 횟수', value: `__POMODORO_${m.pomodoroCount ?? 0}` })
              }
            }
            if (rows.length === 0) return null
            return (
              <div style={{
                backgroundColor: '#F7F7F5',
                borderRadius: '10px',
                padding: '14px 18px',
                marginBottom: '22px',
                display: 'flex', flexDirection: 'column', gap: '8px',
              }}>
                {rows.map(r => {
                  const isPomodoro = r.value.startsWith('__POMODORO_')
                  const pomodoroN = isPomodoro ? parseInt(r.value.replace('__POMODORO_', ''), 10) : 0
                  const canEditPomodoro = isPomodoro && target.table === 'quests' && onUpdateQuestPomodoroCount
                  const isTimeRow = r.isTimeRow && r.timeSec !== undefined && onUpdateTimeSpent && (target.table === 'areas' || target.table === 'projects' || target.table === 'quests')
                  return (
                    <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                      <span style={{
                        width: '120px', flexShrink: 0,
                        fontSize: '12px', color: '#9B9A97', fontWeight: 500,
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}>
                        <span>{r.icon}</span> {r.label}
                      </span>
                      <span style={{
                        fontSize: '13px',
                        color: r.value === '—' ? '#AEAAA4' : (r.value === '완료' ? '#22c55e' : '#37352F'),
                        fontWeight: r.value !== '—' && r.value !== '진행 중' ? 600 : 400,
                        display: 'flex', alignItems: 'center', gap: '8px',
                      }}>
                        {isTimeRow ? (
                          <EditableTimeMinutes
                            totalSec={r.timeSec ?? 0}
                            displayOverride={r.value}
                            onSave={sec => onUpdateTimeSpent!(target.id, target.table as 'areas' | 'projects' | 'quests', sec)}
                          />
                        ) : isPomodoro ? renderPomodoroIcons(pomodoroN) : r.value}
                        {canEditPomodoro && (
                          <span style={{ display: 'flex', gap: '4px', marginLeft: '4px' }}>
                            <button
                              onClick={() => { const n = Math.max(0, pomodoroN - 1); onUpdateQuestPomodoroCount!(target.id, n) }}
                              disabled={pomodoroN <= 0}
                              style={{
                                width: '24px', height: '24px', padding: 0, borderRadius: '6px',
                                border: '1px solid rgba(0,0,0,0.1)', backgroundColor: pomodoroN <= 0 ? '#F1F1EF' : '#FFFFFF',
                                color: pomodoroN <= 0 ? '#AEAAA4' : '#6366f1', fontSize: '14px', fontWeight: 700,
                                cursor: pomodoroN <= 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >−</button>
                            <button
                              onClick={() => onUpdateQuestPomodoroCount!(target.id, pomodoroN + 1)}
                              style={{
                                width: '24px', height: '24px', padding: 0, borderRadius: '6px',
                                border: '1px solid rgba(0,0,0,0.1)', backgroundColor: '#FFFFFF',
                                color: '#6366f1', fontSize: '14px', fontWeight: 700,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >+</button>
                          </span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* 구분선 */}
          <div style={{ height: '1px', backgroundColor: 'rgba(0,0,0,0.05)', marginBottom: '22px' }} />

          {loading ? (
            <div style={{ textAlign: 'center', color: '#AEAAA4', fontSize: '13px', paddingTop: '60px' }}>
              불러오는 중…
            </div>
          ) : (
            <RichEditor
              value={content}
              onChange={handleChange}
              contentKey={target.id}
              placeholder={`${target.title}에 대한 생각, 계획, 메모를 자유롭게 적으세요.\n\n이 공간은 오직 당신만을 위한 것입니다.`}
              minHeight={400}
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes notePopIn {
          from { transform: scale(0.94); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function QuestTable({
  quests, completed, activePomodoroId,
  projects, areas, identities,
  newTitle, onNewTitle, newCat, onNewCat,
  newQuestAreaId, onNewQuestAreaId,
  newProjectId, onNewProjectId,
  newQuestIdentityId, onNewQuestIdentityId,
  newQuestTags, onNewQuestTags,
  valueActions, selectedValueActionId, onSelectValueAction, rewardPreview,
  adding, onAdd, onToggleComplete, onDelete, onSelectPomodoro, onOpenNote, onQuestNameUpdate, onQuestDeadlineUpdate,
  onQuestStatusUpdate, onQuestTagsUpdate, onMoveQuestUp, onMoveQuestDown,
  onPushQuestNameUndo, onPushQuestDeadlineUndo,
  onAiSplitQuest,
  fireToast: fireToastProp,
}: {
  quests: Card[]
  completed: string[]
  activePomodoroId: string | null
  projects: ProjectRow[]
  areas: AreaRow[]
  identities: IdentityRow[]
  newTitle: string; onNewTitle: (v: string) => void
  newCat: string; onNewCat: (v: string) => void
  newQuestAreaId: string; onNewQuestAreaId: (v: string) => void
  newProjectId: string; onNewProjectId: (v: string) => void
  newQuestIdentityId: string; onNewQuestIdentityId: (v: string) => void
  newQuestTags: string[]; onNewQuestTags: (v: string[]) => void
  valueActions: ValueAction[]
  selectedValueActionId: string
  onSelectValueAction: (id: string) => void
  rewardPreview: { exp: number; coins: number } | null
  adding: boolean; onAdd: () => void
  onToggleComplete: (id: string, done: boolean) => void
  onDelete: (id: string) => void
  onSelectPomodoro: (id: string) => void
  onOpenNote: (id: string, title: string, meta?: NoteMeta) => void
  onQuestNameUpdate: (id: string, newName: string) => void
  onQuestDeadlineUpdate: (id: string, deadline: string | null) => void
  onQuestStatusUpdate?: (id: string, status: string) => void
  onQuestTagsUpdate?: (id: string, tags: string[]) => void
  onMoveQuestUp?: (id: string) => void
  onMoveQuestDown?: (id: string) => void
  onPushQuestNameUndo?: (id: string, oldName: string, newName: string) => void
  onPushQuestDeadlineUndo?: (id: string, oldVal: string | null, newVal: string | null) => void
  onAiSplitQuest?: (q: Card) => void
  fireToast?: (msg: string) => void
}) {
  const fireToast = fireToastProp ?? (() => {})
  type ViewMode = 'table' | 'kanban' | 'group_area' | 'group_project' | 'street'
  type SortBy = 'due_date' | 'custom' | 'priority'
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [sortBy, setSortBy] = useState<SortBy>('custom')
  const [tagFilter, setTagFilter] = useState<string>('')
  const [filter, setFilter] = useState<QFilter>('전체')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const [editingDeadlineId, setEditingDeadlineId] = useState<string | null>(null)
  const [cols, setCols] = useState<ColDef[]>(() => {
    try { return JSON.parse(localStorage.getItem(QT_COLS_KEY) ?? '') } catch { return DEFAULT_COLS }
  })
  const [showColMenu, setShowColMenu] = useState(false)
  const [newColLabel, setNewColLabel] = useState('')
  const [newColType, setNewColType] = useState<'text' | 'number' | 'date'>('text')

  const allTags = useMemo(() => {
    const set = new Set<string>()
    quests.forEach(q => { (q.tags ?? []).forEach(t => set.add(t)) })
    return Array.from(set).sort()
  }, [quests])

  const filtered = useMemo(() => {
    let list = quests
    if (filter === '진행중') list = list.filter(q => !completed.includes(q.id))
    else if (filter === '완료') list = list.filter(q => completed.includes(q.id))
    if (tagFilter) list = list.filter(q => (q.tags ?? []).includes(tagFilter))
    if (sortBy === 'due_date') {
      list = [...list].sort((a, b) => {
        const da = a.deadline ? new Date(a.deadline).getTime() : Infinity
        const db = b.deadline ? new Date(b.deadline).getTime() : Infinity
        return da - db
      })
    } else if (sortBy === 'priority') {
      list = [...list].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    }
    return list
  }, [quests, completed, filter, tagFilter, sortBy])

  function saveCols(next: ColDef[]) { setCols(next); localStorage.setItem(QT_COLS_KEY, JSON.stringify(next)) }
  function toggleColVisibility(key: string) {
    saveCols(cols.map(c => c.key === key ? { ...c, hidden: !c.hidden } : c))
  }
  function renameCol(key: string, label: string) {
    saveCols(cols.map(c => c.key === key ? { ...c, label } : c))
  }
  function addCustomCol() {
    if (!newColLabel.trim()) return
    const c: ColDef = { key: `custom_${Date.now()}`, label: newColLabel.trim(), custom: true, type: newColType }
    saveCols([...cols, c]); setNewColLabel(''); setShowColMenu(false)
  }

  function startEdit(q: Card) { setEditingId(q.id); setEditVal(q.name) }
  async function commitEdit(q: Card) {
    const trimmed = editVal.trim()
    setEditingId(null)
    if (!trimmed || trimmed === q.name) return
    const prevName = q.name
    onQuestNameUpdate(q.id, trimmed)
    const { success } = await updateQuestTitle(q.id, trimmed)
    if (!success) onQuestNameUpdate(q.id, prevName)
    else onPushQuestNameUndo?.(q.id, prevName, trimmed)
  }

  async function commitDeadline(q: Card, value: string) {
    setEditingDeadlineId(null)
    const next = value.trim() || null
    const prev = q.deadline ?? null
    if (next === prev) return
    onQuestDeadlineUpdate(q.id, next)
    const { success } = await updateQuestDeadline(q.id, next)
    if (!success) onQuestDeadlineUpdate(q.id, prev)
    else onPushQuestDeadlineUndo?.(q.id, prev, next)
  }

  const visibleCols = cols.filter(c => !c.hidden)
  const doneCount = quests.filter(q => completed.includes(q.id)).length

  const catColor: Record<string, string> = { writing: '#EEF2FF', business: '#FFFBEB', health: '#ECFDF5' }
  const catTextColor: Record<string, string> = { writing: '#4F46E5', business: '#B45309', health: '#065F46' }
  const catLabel: Record<string, string> = { writing: '집필', business: '비즈니스', health: '자기관리' }
  const priStar = (p?: number) => '★'.repeat(p ?? 2) + '☆'.repeat(3 - (p ?? 2))

  const thStyle: React.CSSProperties = { padding: '9px 12px', fontSize: '11px', fontWeight: 600, color: '#9B9A97', textAlign: 'left', backgroundColor: '#F4F4F2', borderBottom: '1px solid rgba(0,0,0,0.06)', whiteSpace: 'nowrap', userSelect: 'none', position: 'relative' }
  const tdStyle: React.CSSProperties = { padding: '10px 12px', fontSize: '13px', color: '#37352F', verticalAlign: 'middle', borderBottom: '1px solid rgba(0,0,0,0.04)' }

  return (
    <div>
      {/* 진행 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{ flex: 1, height: '4px', borderRadius: '999px', backgroundColor: '#EBEBEA', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${quests.length ? (doneCount / quests.length) * 100 : 0}%`, backgroundColor: '#6366f1', transition: 'width 0.4s', borderRadius: '999px' }} />
        </div>
        <span style={{ fontSize: '11px', color: '#787774', flexShrink: 0 }}>{doneCount}/{quests.length} 완료</span>
      </div>

      {/* 보기 모드 + 정렬 + 태그 필터 */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['table', 'kanban', 'group_area', 'group_project', 'street'] as ViewMode[]).map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={{ padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', backgroundColor: viewMode === m ? '#6366f1' : '#FFFFFF', color: viewMode === m ? '#fff' : '#9B9A97', border: '1px solid rgba(0,0,0,0.06)' }}>
              {m === 'table' ? '표' : m === 'kanban' ? '칸반' : m === 'group_area' ? 'Area별' : m === 'group_project' ? 'Project별' : '루틴 거리'}
            </button>
          ))}
        </div>
        {viewMode !== 'street' && (
        <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)} style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', fontSize: '11px', color: '#37352F', backgroundColor: '#FFFFFF' }}>
          <option value="custom">커스텀 순</option>
          <option value="due_date">마감일 순</option>
          <option value="priority">중요도 순</option>
        </select>
        )}
        {viewMode !== 'street' && allTags.length > 0 && (
          <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', fontSize: '11px', color: '#37352F', backgroundColor: '#FFFFFF' }}>
            <option value="">태그 필터</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {/* 필터 탭 + 컬럼 설정 */}
      {viewMode !== 'street' && (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {QUEST_FILTER_TABS.map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{ padding: '5px 14px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', backgroundColor: filter === t ? '#6366f1' : '#FFFFFF', color: filter === t ? '#fff' : '#9B9A97', transition: 'all 0.15s' }}>{t}</button>
          ))}
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowColMenu(v => !v)} style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: 'transparent', color: '#9B9A97', fontSize: '11px', cursor: 'pointer' }}>⚙ 속성</button>
          {showColMenu && (
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '12px', padding: '14px', zIndex: 50, minWidth: '220px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
              <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#6366f1' }}>컬럼 설정</p>
              {cols.map(c => (
                <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <input type="checkbox" checked={!c.hidden} onChange={() => toggleColVisibility(c.key)} style={{ accentColor: '#6366f1', cursor: 'pointer' }} />
                  <input value={c.label} onChange={e => renameCol(c.key, e.target.value)} style={{ flex: 1, backgroundColor: '#F1F1EF', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '6px', padding: '3px 8px', fontSize: '12px', color: '#37352F', outline: 'none' }} />
                </div>
              ))}
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: '10px', paddingTop: '10px' }}>
                <p style={{ margin: '0 0 6px', fontSize: '10px', color: '#787774' }}>새 컬럼 추가</p>
                <input value={newColLabel} onChange={e => setNewColLabel(e.target.value)} placeholder="컬럼 이름" style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#F1F1EF', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', color: '#37352F', outline: 'none', marginBottom: '6px' }} />
                <select value={newColType} onChange={e => setNewColType(e.target.value as 'text' | 'number' | 'date')} style={{ width: '100%', backgroundColor: '#F1F1EF', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', color: '#37352F', outline: 'none', marginBottom: '8px' }}>
                  <option value="text">텍스트</option>
                  <option value="number">숫자</option>
                  <option value="date">날짜</option>
                </select>
                <button onClick={addCustomCol} style={{ width: '100%', padding: '6px', borderRadius: '8px', border: 'none', backgroundColor: '#6366f1', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>추가</button>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {viewMode === 'street' && (
        <div style={{ marginBottom: '20px' }}>
          <RoutineStreet fireToast={fireToast} />
        </div>
      )}

      {/* 칸반 뷰 */}
      {viewMode === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
          {[
            { key: 'someday', label: '언젠가', color: '#9B9A97' },
            { key: 'not_started', label: '시작전', color: '#787774' },
            { key: 'in_progress', label: '진행중', color: '#6366f1' },
            { key: 'done', label: '완료', color: '#34d399' },
          ].map(col => (
            <div key={col.key} style={{ backgroundColor: '#F8F8F6', borderRadius: '12px', border: `1px solid ${col.color}40`, padding: '12px', minHeight: '120px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: col.color }}>{col.label}</p>
              {filtered.filter(q => (q.status ?? 'someday') === col.key).map(q => {
                const isDone = completed.includes(q.id)
                const isActive = activePomodoroId === q.id
                return (
                  <div key={q.id} style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#37352F', textDecoration: isDone ? 'line-through' : 'none', cursor: 'pointer' }} onClick={() => onOpenNote(q.id, q.name, {})}>{q.name}</p>
                    {(q.tags ?? []).length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                        {(q.tags ?? []).map(t => <span key={t} style={{ fontSize: '10px', backgroundColor: 'rgba(99,102,241,0.1)', color: '#6366f1', padding: '2px 8px', borderRadius: '999px' }}>{t}</span>)}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                      <select value={q.status ?? 'someday'} onChange={e => { const v = e.target.value; onQuestStatusUpdate?.(q.id, v); if (v === 'done') onToggleComplete(q.id, true); else if (isDone) onToggleComplete(q.id, false) }} onClick={e => e.stopPropagation()} style={{ padding: '2px 6px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.08)', fontSize: '10px', cursor: 'pointer' }}>
                        <option value="someday">언젠가</option>
                        <option value="not_started">시작전</option>
                        <option value="in_progress">진행중</option>
                        <option value="done">완료</option>
                      </select>
                      <button onClick={e => { e.stopPropagation(); onSelectPomodoro(q.id) }} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #6366f1', backgroundColor: isActive ? 'rgba(99,102,241,0.15)' : 'transparent', fontSize: '10px', color: '#6366f1', cursor: 'pointer' }}>{isActive ? '진행중' : '▶'}</button>
                      <button onClick={e => { e.stopPropagation(); onDelete(q.id) }} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #f87171', color: '#f87171', fontSize: '10px', cursor: 'pointer' }}>삭제</button>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* 그룹별 뷰 */}
      {(viewMode === 'group_area' || viewMode === 'group_project') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {(viewMode === 'group_area' ? areas : projects).map(item => {
            const groupQuests = viewMode === 'group_area'
              ? filtered.filter(q => { const p = projects.find(x => String(x.id) === String(q.projectId)); return p && String(p.area_id) === String(item.id) })
              : filtered.filter(q => String(q.projectId) === String(item.id))
            if (groupQuests.length === 0) return null
            const parentName = viewMode === 'group_project' && (item as ProjectRow).area_id ? areas.find(a => String(a.id) === String((item as ProjectRow).area_id))?.name : null
            return (
              <div key={item.id} style={{ backgroundColor: '#F8F8F6', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', backgroundColor: '#F1F1EF', borderBottom: '1px solid rgba(0,0,0,0.06)', fontWeight: 700, fontSize: '13px', color: '#37352F' }}>
                  {viewMode === 'group_project' && parentName ? `${parentName} › ` : ''}{item.name}
                </div>
                <div style={{ padding: '12px' }}>
                  {groupQuests.map(q => {
                    const isDone = completed.includes(q.id)
                    return (
                      <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}
                        onClick={() => onOpenNote(q.id, q.name, {})}>
                        <input type="checkbox" checked={isDone} onChange={e => onToggleComplete(q.id, e.target.checked)} style={{ accentColor: '#6366f1', cursor: 'pointer' }} />
                        <span style={{ flex: 1, fontSize: '13px', color: isDone ? '#787774' : '#37352F', textDecoration: isDone ? 'line-through' : 'none' }}>{q.name}</span>
                        {(q.tags ?? []).map(t => <span key={t} style={{ fontSize: '10px', backgroundColor: 'rgba(99,102,241,0.1)', color: '#6366f1', padding: '2px 8px', borderRadius: '999px' }}>{t}</span>)}
                        <button onClick={e => { e.stopPropagation(); onSelectPomodoro(q.id) }} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #6366f1', fontSize: '10px', color: '#6366f1', cursor: 'pointer' }}>▶</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {filtered.filter(q => !q.projectId).length > 0 && (
            <div style={{ backgroundColor: '#F8F8F6', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', backgroundColor: '#F1F1EF', borderBottom: '1px solid rgba(0,0,0,0.06)', fontWeight: 700, fontSize: '13px', color: '#9B9A97' }}>미분류</div>
              <div style={{ padding: '12px' }}>
                {filtered.filter(q => !q.projectId).map(q => (
                  <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }} onClick={() => onOpenNote(q.id, q.name, {})}>
                    <input type="checkbox" checked={completed.includes(q.id)} onChange={e => onToggleComplete(q.id, e.target.checked)} style={{ accentColor: '#6366f1', cursor: 'pointer' }} />
                    <span style={{ flex: 1, fontSize: '13px' }}>{q.name}</span>
                    <button onClick={e => { e.stopPropagation(); onSelectPomodoro(q.id) }} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #6366f1', fontSize: '10px', color: '#6366f1', cursor: 'pointer' }}>▶</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 테이블 */}
      {viewMode === 'table' && (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F1F1EF' }}>
                {visibleCols.map(c => <th key={c.key} style={thStyle}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={visibleCols.length} style={{ ...tdStyle, textAlign: 'center', color: '#AEAAA4', padding: '32px' }}>
                    퀘스트가 없습니다. 아래에서 새 퀘스트를 추가하세요.
                  </td>
                </tr>
              ) : filtered.map(q => {
                const isDone = completed.includes(q.id)
                const isActive = activePomodoroId === q.id
                return (
                  <tr key={q.id} style={{ backgroundColor: isActive ? 'rgba(99,102,241,0.08)' : isDone ? 'rgba(52,211,153,0.04)' : 'transparent', transition: 'background 0.15s' }}
                    onMouseEnter={e => { if (!isActive && !isDone) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = isActive ? 'rgba(99,102,241,0.08)' : isDone ? 'rgba(52,211,153,0.04)' : 'transparent' }}
                  >
                    {visibleCols.map(col => {
                      if (col.key === 'sort') return (
                        <td key="sort" style={tdStyle}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            <button onClick={() => onMoveQuestUp?.(q.id)} disabled={filtered.indexOf(q) === 0} style={{ padding: '1px 2px', border: 'none', background: 'none', color: '#9B9A97', cursor: filtered.indexOf(q) === 0 ? 'default' : 'pointer', opacity: filtered.indexOf(q) === 0 ? 0.4 : 1 }}><ChevronUp size={12} /></button>
                            <button onClick={() => onMoveQuestDown?.(q.id)} disabled={filtered.indexOf(q) === filtered.length - 1} style={{ padding: '1px 2px', border: 'none', background: 'none', color: '#9B9A97', cursor: filtered.indexOf(q) === filtered.length - 1 ? 'default' : 'pointer', opacity: filtered.indexOf(q) === filtered.length - 1 ? 0.4 : 1 }}><ChevronDown size={12} /></button>
                          </div>
                        </td>
                      )
                      if (col.key === 'status') return (
                        <td key="status" style={tdStyle}>
                          <select value={q.status ?? 'someday'} onChange={e => {
                            const v = e.target.value as string
                            onQuestStatusUpdate?.(q.id, v)
                            if (v === 'done') onToggleComplete(q.id, true)
                            else if (isDone) onToggleComplete(q.id, false)
                          }} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.08)', fontSize: '11px', backgroundColor: '#FFFFFF', cursor: 'pointer' }}>
                            <option value="someday">언젠가</option>
                            <option value="not_started">시작전</option>
                            <option value="in_progress">진행중</option>
                            <option value="done">완료</option>
                          </select>
                        </td>
                      )
                      if (col.key === 'name') return (
                        <td key="name" style={{ ...tdStyle, maxWidth: '220px' }}>
                          {editingId === q.id ? (
                            <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                              onBlur={() => commitEdit(q)}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitEdit(q) } if (e.key === 'Escape') { setEditingId(null) } }}
                              style={{ width: '100%', backgroundColor: '#F1F1EF', border: '1px solid #6366f1', borderRadius: '6px', padding: '4px 8px', fontSize: '13px', color: '#37352F', outline: 'none' }} />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              {onAiSplitQuest && (
                                <button
                                  type="button"
                                  title="AI 쪼개기 · 5-Whys 후 하위 퀘스트"
                                  onClick={e => {
                                    e.stopPropagation()
                                    onAiSplitQuest(q)
                                  }}
                                  style={{
                                    flexShrink: 0,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 26,
                                    height: 26,
                                    borderRadius: 8,
                                    border: '1px solid rgba(99,102,241,0.35)',
                                    background: 'rgba(99,102,241,0.06)',
                                    color: '#6366f1',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <GitBranch size={14} strokeWidth={2.25} />
                                </button>
                              )}
                              <span
                                onClick={() => {
                                  const proj = projects.find(p => String(p.id) === String(q.projectId))
                                  const area = proj ? areas.find(a => String(a.id) === String(proj.area_id)) : undefined
                                  onOpenNote(q.id, q.name, {
                                    projectName: proj?.name,
                                    areaName: area?.name,
                                    timeSpentSec: q.timeSpentSec,
                                    pomodoroCount: q.pomodoroCount ?? 0,
                                    isCompleted: completed.includes(q.id),
                                  })
                                }}
                                onDoubleClick={e => { e.stopPropagation(); startEdit(q) }}
                                style={{
                                  cursor: 'pointer',
                                  color: isDone ? '#787774' : '#37352F',
                                  textDecoration: isDone ? 'line-through' : 'none',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  flex: 1,
                                  transition: 'color 0.15s, text-decoration 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.textDecoration = isDone ? 'line-through' : 'underline'; e.currentTarget.style.color = '#4F46E5' }}
                                onMouseLeave={e => { e.currentTarget.style.textDecoration = isDone ? 'line-through' : 'none'; e.currentTarget.style.color = isDone ? '#787774' : '#37352F' }}
                                title="클릭: 상세 노트 열기 · 더블클릭: 이름 수정"
                              >{q.name}</span>
                            </div>
                          )}
                          {isActive && <span style={{ fontSize: '9px', backgroundColor: 'rgba(99,102,241,0.2)', color: '#4F46E5', padding: '1px 6px', borderRadius: '999px', marginTop: '2px', display: 'inline-block' }}>집중 중</span>}
                        </td>
                      )
                      if (col.key === 'tags') return (
                        <td key="tags" style={tdStyle}>
                          <TagInput tags={q.tags ?? []} onChange={v => onQuestTagsUpdate?.(q.id, v)} placeholder="+" />
                        </td>
                      )
                      if (col.key === 'area') {
                        const proj = q.projectId ? projects.find(p => String(p.id) === String(q.projectId)) : null
                        const area = proj?.area_id ? areas.find(a => String(a.id) === String(proj.area_id)) : null
                        return (
                          <td key="area" style={tdStyle}>
                            {area ? (
                              <span style={{ fontSize: '11px', fontWeight: 600, color: '#0369A1', backgroundColor: '#E0F2FE', padding: '2px 9px', borderRadius: '999px', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {area.name}
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', fontWeight: 500, color: '#9B9A97', backgroundColor: '#F1F1EF', padding: '2px 9px', borderRadius: '999px' }}>미분류</span>
                            )}
                          </td>
                        )
                      }
                      if (col.key === 'project') return (
                        <td key="project" style={tdStyle}>
                          {q.projectId ? (
                            (() => {
                              const proj = projects.find(p => String(p.id) === String(q.projectId))
                              if (!proj) return <span style={{ fontSize: '11px', fontWeight: 500, color: '#9B9A97', backgroundColor: '#F1F1EF', padding: '2px 9px', borderRadius: '999px' }}>미분류</span>
                              return (
                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#6D28D9', backgroundColor: '#EDE9FE', padding: '2px 9px', borderRadius: '999px', whiteSpace: 'nowrap', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>
                                  {proj.name}
                                </span>
                              )
                            })()
                          ) : (
                            <span style={{ fontSize: '11px', fontWeight: 500, color: '#9B9A97', backgroundColor: '#F1F1EF', padding: '2px 9px', borderRadius: '999px' }}>미분류</span>
                          )}
                        </td>
                      )
                      if (col.key === 'category') return (
                        <td key="category" style={tdStyle}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: catTextColor[q.sub] ?? '#6B6B6B', backgroundColor: catColor[q.sub] ?? '#F1F1EF', padding: '2px 9px', borderRadius: '999px' }}>
                            {catLabel[q.sub] ?? q.sub}
                          </span>
                        </td>
                      )
                      if (col.key === 'priority') return (
                        <td key="priority" style={{ ...tdStyle, color: '#fbbf24', fontSize: '14px', letterSpacing: '-1px' }}>{priStar(q.priority)}</td>
                      )
                      if (col.key === 'deadline') return (
                        <td key="deadline" style={{ ...tdStyle, minWidth: '140px' }}>
                          {editingDeadlineId === q.id ? (
                            <input
                              type="date"
                              autoFocus
                              defaultValue={q.deadline ?? ''}
                              onBlur={e => commitDeadline(q, e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') { e.preventDefault(); commitDeadline(q, (e.target as HTMLInputElement).value) }
                                if (e.key === 'Escape') setEditingDeadlineId(null)
                              }}
                              style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #6366f1', outline: 'none', backgroundColor: '#F1F1EF' }}
                            />
                          ) : (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <div
                                onClick={() => setEditingDeadlineId(q.id)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '2px 0' }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = '0.8' }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                                title="클릭하여 마감일 설정/수정"
                              >
                                {q.deadline ? (
                                  <>
                                    <span style={{ fontSize: '12px', color: '#37352F' }}>{q.deadline}</span>
                                    {(() => {
                                      const d = getDDay(q.deadline)
                                      const dStyle: React.CSSProperties = {
                                        fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                                        ...(d.type === 'future' ? { backgroundColor: '#DBEAFE', color: '#1D4ED8' } : {}),
                                        ...(d.type === 'today' ? { backgroundColor: '#FED7AA', color: '#C2410C', fontWeight: 800 } : {}),
                                        ...(d.type === 'past' ? { backgroundColor: '#FEE2E2', color: '#DC2626' } : {}),
                                      }
                                      return <span style={dStyle}>{d.label}</span>
                                    })()}
                                  </>
                                ) : (
                                  <span style={{ color: '#AEAAA4', fontSize: '12px' }}>날짜 선택</span>
                                )}
                              </div>
                              {q.deadline && (
                                <button
                                  onClick={e => { e.stopPropagation(); commitDeadline(q, '') }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: '11px', color: '#9B9A97' }}
                                  onMouseEnter={e => { e.currentTarget.style.color = '#DC2626' }}
                                  onMouseLeave={e => { e.currentTarget.style.color = '#9B9A97' }}
                                  title="마감일 지우기"
                                >×</button>
                              )}
                            </div>
                          )}
                        </td>
                      )
                      if (col.key === 'timespent') return (
                        <td key="timespent" style={tdStyle}>
                          <span style={{ fontSize: '12px', color: q.timeSpentSec ? '#7C3AED' : '#AEAAA4' }}>{fmtSec(q.timeSpentSec)}</span>
                        </td>
                      )
                      if (col.key === 'pomodoro_count') return (
                        <td key="pomodoro_count" style={tdStyle}>
                          {renderPomodoroIcons(q.pomodoroCount, true)}
                        </td>
                      )
                      if (col.key === 'pomodoro') return (
                        <td key="pomodoro" style={tdStyle}>
                          <button onClick={() => onSelectPomodoro(q.id)}
                            style={{ padding: '3px 10px', borderRadius: '6px', border: `1px solid ${isActive ? '#6366f1' : '#EBEBEA'}`, backgroundColor: isActive ? 'rgba(99,102,241,0.15)' : 'transparent', color: isActive ? '#4F46E5' : '#9B9A97', fontSize: '11px', cursor: 'pointer' }}>
                            {isActive ? '▶ 진행 중' : '▶ 선택'}
                          </button>
                        </td>
                      )
                      if (col.key === 'delete') return (
                        <td key="delete" style={tdStyle}>
                          <button onClick={() => onDelete(q.id)}
                            style={{ padding: '3px 10px', borderRadius: '6px', border: '1px solid rgba(248,113,113,0.2)', backgroundColor: 'transparent', color: '#f87171', fontSize: '11px', cursor: 'pointer', transition: 'background 0.1s' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.1)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                            삭제
                          </button>
                        </td>
                      )
                      if (col.custom) return <td key={col.key} style={{ ...tdStyle, color: '#787774', fontSize: '12px' }}>-</td>
                      return null
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 새 퀘스트 추가 폼 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={newTitle}
            onChange={e => onNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onAdd() }}
            placeholder="새 퀘스트 이름 입력 후 Enter"
            style={{ flex: '1', minWidth: '160px', padding: '9px 14px', borderRadius: '9px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#F1F1EF', color: '#37352F', fontSize: '13px', outline: 'none' }}
            onFocus={e => (e.target.style.borderColor = '#6366f1')}
            onBlur={e => (e.target.style.borderColor = '#EBEBEA')}
          />
          <select
            value={newQuestAreaId}
            onChange={e => { onNewQuestAreaId(e.target.value); onNewProjectId('') }}
            style={{ padding: '9px 12px', borderRadius: '9px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#F1F1EF', color: newQuestAreaId ? '#37352F' : '#9B9A97', fontSize: '13px', outline: 'none' }}
          >
            <option value="">{areas.length === 0 ? 'Vision Area를 먼저 생성해주세요' : 'Vision Area 선택 (필수)'}</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select
            value={newProjectId}
            onChange={e => onNewProjectId(e.target.value)}
            disabled={!newQuestAreaId}
            style={{ padding: '9px 12px', borderRadius: '9px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: newQuestAreaId ? '#F1F1EF' : '#EBEBEA', color: newProjectId ? '#37352F' : '#9B9A97', fontSize: '13px', outline: 'none' }}
          >
            <option value="">{!newQuestAreaId ? 'Vision Area를 먼저 선택하세요' : 'Real Projects 선택 (필수)'}</option>
            {projects.filter(p => p.area_id != null && String(p.area_id) === String(newQuestAreaId)).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={newCat}
            onChange={e => onNewCat(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: '9px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#F1F1EF', color: '#37352F', fontSize: '13px', outline: 'none' }}
          >
            <option value="writing">집필</option>
            <option value="business">비즈니스/공부</option>
            <option value="health">자기관리</option>
          </select>
          <select
            value={newQuestIdentityId}
            onChange={e => onNewQuestIdentityId(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: '9px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#F1F1EF', color: newQuestIdentityId ? '#37352F' : '#9B9A97', fontSize: '13px', outline: 'none' }}
          >
            <option value="">Identity (선택)</option>
            {identities.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <select
            value={selectedValueActionId}
            onChange={e => {
              const id = e.target.value
              onSelectValueAction(id)
              const va = valueActions.find(v => v.id === id)
              if (va) onNewTitle(va.actionName)
            }}
            style={{ padding: '9px 12px', borderRadius: '9px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#F1F1EF', color: selectedValueActionId ? '#37352F' : '#9B9A97', fontSize: '12px', outline: 'none', maxWidth: 200 }}
          >
            <option value="">행동 자산 (선택)</option>
            {valueActions.map(va => (
              <option key={va.id} value={va.id}>{va.actionName}</option>
            ))}
          </select>
          <TagInput tags={newQuestTags} onChange={onNewQuestTags} placeholder="태그 (엔터)" />
          <button
            onClick={onAdd}
            disabled={adding || !newTitle.trim() || !newQuestAreaId || !newProjectId}
            style={{ padding: '9px 18px', borderRadius: '9px', border: 'none', backgroundColor: (adding || !newTitle.trim() || !newQuestAreaId || !newProjectId) ? '#EBEBEA' : '#6366f1', color: (adding || !newTitle.trim() || !newQuestAreaId || !newProjectId) ? '#787774' : '#fff', fontSize: '13px', fontWeight: 700, cursor: (adding || !newTitle.trim() || !newQuestAreaId || !newProjectId) ? 'default' : 'pointer', transition: 'background 0.15s' }}
          >
            {adding ? '추가 중…' : '+ 추가'}
          </button>
        </div>
        {rewardPreview && (
          <p style={{ margin: 0, fontSize: 11, color: '#6366f1', fontWeight: 600 }}>
            행동 자산 기준 예상: EXP {rewardPreview.exp} · 보상 코인 {rewardPreview.coins} (완료 시 가이드)
          </p>
        )}
      </div>
    </div>
  )
}

const DEFAULT_STATS: StatDef[] = [
  { id: 'words', label: '오늘 작성', value: '0', unit: '자', memo: '', col: '#818cf8', emoji: '✍️', isText: false, hasMemo: false },
  { id: 'streak', label: '연속 집필', value: '0', unit: '일', memo: '', col: '#34d399', emoji: '🔥', isText: false, hasMemo: false },
  { id: 'health', label: '오늘 건강', value: '0', unit: '보 걸음', memo: '', col: '#f472b6', emoji: '💪', isText: false, hasMemo: false },
  { id: 'fortune', label: '내 운세', value: '갑술(甲戌)', unit: '', memo: '', col: '#fbbf24', emoji: '🔯', isText: true, hasMemo: true },
]

function loadStats(): StatDef[] {
  try {
    const raw = localStorage.getItem(STATS_KEY)
    if (!raw) return DEFAULT_STATS
    const saved: Record<string, { value: string; memo: string }> = JSON.parse(raw)
    return DEFAULT_STATS.map(s => ({ ...s, ...(saved[s.id] ?? {}) }))
  } catch { return DEFAULT_STATS }
}
function persistStats(stats: StatDef[]) {
  const payload: Record<string, { value: string; memo: string }> = {}
  stats.forEach(s => { payload[s.id] = { value: s.value, memo: s.memo } })
  localStorage.setItem(STATS_KEY, JSON.stringify(payload))
  kvSet(STATS_KEY, payload)
  const xp = loadXp()
  const { currentLevel, maxCurrentLevelXp } = calculateLevel(xp.totalXp)
  upsertUserStats({ level: currentLevel, current_xp: 0, required_xp: maxCurrentLevelXp, total_xp: xp.totalXp, stats_json: payload })
}

// ── LoginView — 시네마틱 / 미니멀 (설명·브랜딩 문구 없음) ─────────────────────
const LOGIN_BG_URL = '/login-bg-surf.png'

function LoginView({ onLogin }: { onLogin: (s: Session) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const result = await signIn(email, password)
    if (result.error) { setError(result.error); setLoading(false) }
    else if (result.session) onLogin(result.session)
    else { setError('로그인 실패'); setLoading(false) }
  }

  const fontSans = "'Noto Sans KR', system-ui, sans-serif"

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '14px 16px',
    borderRadius: '2px',
    border: '1px solid rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    color: '#f1f5f9',
    fontSize: '14px', fontFamily: fontSans, outline: 'none', marginBottom: '14px',
  }

  return (
    <>
      <style>{`
        @keyframes authPanelGlow {
          0%, 100% { box-shadow: 0 0 0 1px rgba(212, 175, 120, 0.22), 0 24px 80px rgba(0,0,0,0.5); }
          50% { box-shadow: 0 0 0 1px rgba(212, 175, 120, 0.35), 0 28px 90px rgba(0,0,0,0.55); }
        }
        .login-minimal input::placeholder { color: rgba(241,245,249,0.28); }
      `}</style>
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        fontFamily: fontSans,
        backgroundColor: '#0a0e14',
        backgroundImage: `linear-gradient(180deg, rgba(6, 10, 18, 0.45) 0%, rgba(6, 8, 16, 0.72) 55%, rgba(4, 6, 12, 0.82) 100%), url(${LOGIN_BG_URL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}>
        <div style={{
          width: '100%', maxWidth: '400px',
          padding: '44px 40px',
          background: 'rgba(0,0,0,0.52)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(212, 175, 120, 0.28)',
          borderRadius: '2px',
          animation: 'authPanelGlow 5s ease-in-out infinite',
        }}>
          <form className="login-minimal" onSubmit={handleSubmit} autoComplete="on">
            <input
              type="email"
              name="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="username"
              aria-label="Email"
              style={inp}
              onFocus={e => { e.target.style.borderColor = 'rgba(226, 214, 180, 0.45)'; e.target.style.backgroundColor = 'rgba(0,0,0,0.5)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.18)'; e.target.style.backgroundColor = 'rgba(0,0,0,0.35)' }}
            />
            <input
              type="password"
              name="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              aria-label="Password"
              style={inp}
              onFocus={e => { e.target.style.borderColor = 'rgba(226, 214, 180, 0.45)'; e.target.style.backgroundColor = 'rgba(0,0,0,0.5)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.18)'; e.target.style.backgroundColor = 'rgba(0,0,0,0.35)' }}
            />
            {error && (
              <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#fca5a5', textAlign: 'center', fontWeight: 500, lineHeight: 1.5 }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px 16px', marginTop: '6px',
                borderRadius: '2px',
                border: '1px solid rgba(255,255,255,0.12)',
                cursor: loading ? 'default' : 'pointer',
                fontFamily: fontSans,
                fontSize: '14px', fontWeight: 600,
                letterSpacing: '0.06em',
                color: '#e8e4dc',
                background: loading ? 'rgba(35,38,48,0.95)' : 'rgba(28,32,42,0.95)',
                transition: 'background 0.2s, border-color 0.2s',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'rgba(38,42,54,0.98)'; e.currentTarget.style.borderColor = 'rgba(212, 175, 120, 0.35)' } }}
              onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = 'rgba(28,32,42,0.95)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' } }}
            >
              {loading ? '…' : '입장'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

// ── StatCard 컴포넌트 ──
function StatCard({ stat, onUpdate }: {
  stat: StatDef
  onUpdate: (id: string, value: string, memo: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(stat.value)
  const [memoDraft, setMemoDraft] = useState(stat.memo)
  const [flash, setFlash] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const memoRef = useRef<HTMLTextAreaElement>(null)

  // 외부 변경 시 동기화
  useEffect(() => { setDraft(stat.value); setMemoDraft(stat.memo) }, [stat.value, stat.memo])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function commit() {
    const v = draft.trim() || stat.value
    const m = memoDraft.trim()
    setDraft(v); setMemoDraft(m)
    setEditing(false)
    onUpdate(stat.id, v, m)
    setFlash(true)
    setTimeout(() => setFlash(false), 750)
  }
  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() }
    if (e.key === 'Escape') { setDraft(stat.value); setMemoDraft(stat.memo); setEditing(false) }
  }

  const displayVal = stat.isText ? stat.value : (stat.value + (stat.unit ? ' ' + stat.unit : ''))

  return (
    <div
      onClick={() => { if (!editing) setEditing(true) }}
      style={{
        backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '18px 22px',
        cursor: editing ? 'default' : 'pointer',
        border: editing ? '1.5px solid rgba(99,102,241,0.45)' : '1.5px solid transparent',
        boxShadow: editing ? '0 0 0 3px rgba(99,102,241,0.1)' : '0 1px 2px rgba(0,0,0,0.04)',
        transition: 'border 0.15s, box-shadow 0.15s',
        userSelect: editing ? 'text' : 'none',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* 반짝임 오버레이 */}
      {flash && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '12px',
          background: `radial-gradient(ellipse at center, ${stat.col}22 0%, transparent 70%)`,
          animation: 'statFlash 0.75s ease-out forwards',
          pointerEvents: 'none',
        }} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <p style={{ margin: 0, fontSize: '11px', color: '#9B9A97', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          {stat.label}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {!editing && <span style={{ fontSize: '10px', color: '#AEAAA4' }}>✎</span>}
          <span style={{ fontSize: '18px' }}>{stat.emoji}</span>
        </div>
      </div>

      {/* 주요 값 */}
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          type={stat.isText ? 'text' : 'number'}
          min={stat.isText ? undefined : 0}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { if (!stat.hasMemo) commit(); else setTimeout(commit, 150) }}
          onKeyDown={handleKey}
          onClick={e => e.stopPropagation()}
          placeholder={stat.isText ? '일주를 입력하세요' : '0'}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: '22px', fontWeight: 900, color: stat.col,
            width: '100%', padding: 0, marginBottom: '2px',
            fontFamily: 'inherit',
          }}
        />
      ) : (
        <p style={{
          margin: 0, fontSize: '22px', fontWeight: 900, lineHeight: 1,
          color: flash ? '#fff'
            : (stat.id === 'health' && parseInt(stat.value) >= 10000) ? '#f59e0b'
              : stat.col,
          textShadow: (stat.id === 'health' && parseInt(stat.value) >= 10000)
            ? '0 0 16px rgba(245,158,11,0.7), 0 0 40px rgba(251,191,36,0.35)'
            : 'none',
          transition: 'color 0.3s, text-shadow 0.3s',
        }}>
          {displayVal}
          {stat.id === 'health' && parseInt(stat.value) >= 10000 && (
            <span style={{ fontSize: '13px', marginLeft: '6px' }}>🏆</span>
          )}
        </p>
      )}

      {/* 메모 필드 (내 운세 카드) */}
      {stat.hasMemo && (
        editing ? (
          <textarea
            ref={memoRef}
            value={memoDraft}
            onChange={e => setMemoDraft(e.target.value)}
            onKeyDown={handleKey}
            onClick={e => e.stopPropagation()}
            placeholder="오늘의 기운을 메모하세요..."
            rows={2}
            style={{
              display: 'block', width: '100%', marginTop: '8px',
              background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: '8px', padding: '6px 8px', outline: 'none',
              fontSize: '11px', color: '#4F46E5', fontFamily: 'inherit',
              resize: 'none', lineHeight: 1.6,
            }}
          />
        ) : stat.memo ? (
          <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#787774', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
            {stat.memo}
          </p>
        ) : null
      )}

      {/* 하단 힌트 */}
      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {!stat.hasMemo && (
          <p style={{ margin: 0, fontSize: '11px', color: '#AEAAA4' }}>
            {stat.isText ? stat.value : (stat.unit || '')}
          </p>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: editing ? '#6366f1' : '#AEAAA4' }}>
          {editing ? '↵ 저장 · Esc 취소' : '클릭하여 편집'}
        </span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════ TOAST ═══════════════════════════════
function Toast({ msg, visible }: { msg: string; visible: boolean }) {
  return (
    <div style={{
      position: 'fixed', top: '72px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 9998, pointerEvents: 'none',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s ease',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        backgroundColor: '#EEF2FF', border: '1px solid rgba(99,102,241,0.45)',
        borderRadius: '999px', padding: '10px 22px',
        boxShadow: '0 8px 32px rgba(99,102,241,0.3)',
        color: '#4F46E5', fontSize: '13px', fontWeight: 800, letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}>
        <span style={{ fontSize: '16px' }}>✨</span>
        {msg}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════ LEVEL-UP SCREEN ══════════════════════
type ParticleCfg = { left: number; dur: number; delay: number; size: number; col: string }
const PARTICLE_COLS = ['#6366f1', '#818cf8', '#7C3AED', '#7C3AED', '#7c3aed', '#4f46e5', '#ddd6fe']
function genParticles(n: number): ParticleCfg[] {
  return Array.from({ length: n }, () => ({
    left: Math.random() * 100,
    dur: 1.5 + Math.random() * 2,
    delay: Math.random() * 1.2,
    size: 4 + Math.random() * 9,
    col: PARTICLE_COLS[Math.floor(Math.random() * PARTICLE_COLS.length)],
  }))
}
function LevelUpScreen({ level, onDone }: { level: number; onDone: () => void }) {
  const [particles] = useState<ParticleCfg[]>(() => genParticles(35))
  useEffect(() => {
    const t = setTimeout(onDone, 3200)
    return () => clearTimeout(t)
  }, [])
  return (
    <div onClick={onDone} style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      backgroundColor: 'rgba(0,0,0,0.90)', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    }}>
      {particles.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', bottom: '-10px', left: `${p.left}%`,
          width: `${p.size}px`, height: `${p.size}px`, borderRadius: '50%',
          backgroundColor: p.col, boxShadow: `0 0 ${p.size * 2}px ${p.col}`,
          animation: `lvParticle ${p.dur}s ${p.delay}s ease-out both`,
        }} />
      ))}
      <div style={{ textAlign: 'center', animation: 'lvBounce 0.55s ease-out' }}>
        <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 800, color: '#818cf8', letterSpacing: '0.35em', textTransform: 'uppercase' }}>
          ✦  Level  Up  ✦
        </p>
        <p style={{
          margin: '0 0 6px', fontSize: '88px', fontWeight: 900, color: '#37352F', lineHeight: 1, letterSpacing: '-4px',
          textShadow: '0 0 60px rgba(99,102,241,0.9), 0 0 130px rgba(139,92,246,0.5)',
        }}>
          Lv.{level}
        </p>
        <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: '#7C3AED', letterSpacing: '0.05em' }}>
          {getLevelTitle(level)}
        </p>
        <p style={{ margin: '0 0 28px', fontSize: '20px', fontWeight: 700, color: '#e0e7ff' }}>
          창작의 경지가 상승했습니다
        </p>
        <p style={{ margin: 0, fontSize: '11px', color: '#374151' }}>클릭하면 닫힙니다</p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════ XP BAR (투 트랙: 현재 레벨 XP / 총 누적 XP) ════════════════════════════════
function XpBar({
  currentLevelXp, maxCurrentLevelXp, totalXp, doneCount, totalCount,
  onEditCurrentLevelXp, onEditTotalXp,
}: {
  currentLevelXp: number; maxCurrentLevelXp: number; totalXp: number
  doneCount: number; totalCount: number
  onEditCurrentLevelXp?: (v: number) => void
  onEditTotalXp?: (v: number) => void
}) {
  const level = calculateLevel(totalXp).currentLevel
  const pct = maxCurrentLevelXp > 0 ? Math.min((currentLevelXp / maxCurrentLevelXp) * 100, 100) : 0
  const totalFormatted = totalXp.toLocaleString()
  return (
    <div style={{
      backgroundColor: '#F1F1EF', border: '1px solid rgba(99,102,241,0.18)',
      borderRadius: '16px', padding: '14px 22px', marginBottom: '20px',
      display: 'flex', alignItems: 'center', gap: '18px',
    }}>
      {/* 레벨 배지 */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px',
          background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 18px rgba(99,102,241,0.45)', flexShrink: 0,
        }}>
          <span style={{ fontSize: '9px', fontWeight: 900, color: 'rgba(255,255,255,0.7)', lineHeight: 1 }}>Lv.</span>
          <span style={{ fontSize: '14px', fontWeight: 900, color: '#37352F', lineHeight: 1 }}>{level}</span>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#37352F', lineHeight: 1.2 }}>{getLevelTitle(level)}</p>
          <p style={{ margin: 0, fontSize: '10px', color: '#6366f1' }}>창작자 등급</p>
        </div>
      </div>

      {/* XP 게이지 — 상단: 현재 레벨 진행도 / 하단: 총 누적 XP */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', color: '#787774' }}>현재 레벨 진행도</span>
          {onEditCurrentLevelXp ? (
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#4F46E5', display: 'inline-flex', alignItems: 'center' }}>
              <EditableNumber
                value={currentLevelXp}
                onSave={onEditCurrentLevelXp}
                displayOverride={`${currentLevelXp} / ${maxCurrentLevelXp} XP`}
                inputPlaceholder="현재 레벨 XP"
              />
            </span>
          ) : (
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#4F46E5' }}>{currentLevelXp} / {maxCurrentLevelXp} XP</span>
          )}
        </div>
        <div style={{ height: '7px', backgroundColor: '#EBEBEA', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: 'linear-gradient(90deg,#6366f1,#a78bfa)',
            borderRadius: '999px', transition: 'width 0.6s ease-out',
            boxShadow: '0 0 10px rgba(99,102,241,0.55)',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          {onEditTotalXp ? (
            <span style={{ fontSize: '10px', color: '#9B9A97', display: 'inline-flex', alignItems: 'center' }}>
              총 누적 경험치 Total{' '}
              <EditableNumber
                value={totalXp}
                onSave={onEditTotalXp}
                displayOverride={`${totalFormatted} XP`}
                inputPlaceholder="Total XP"
              />
            </span>
          ) : (
            <span style={{ fontSize: '10px', color: '#9B9A97' }}>총 누적 경험치 Total {totalFormatted} XP</span>
          )}
        </div>
      </div>

      {/* 오늘 완료 */}
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <p style={{ margin: 0, fontSize: '10px', color: '#787774' }}>오늘 퀘스트</p>
        <p style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: doneCount === totalCount && totalCount > 0 ? '#34d399' : '#818cf8', lineHeight: 1.1 }}>
          {doneCount}<span style={{ fontSize: '12px', color: '#787774', fontWeight: 400 }}> / {totalCount}</span>
        </p>
      </div>
    </div>
  )
}

const ghostBtn = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)',
  cursor: 'pointer', color: '#9B9A97', transition: 'all 0.15s',
  ...extra,
})

// ═══════════════════════════════════════ ADJUST TIME ROW ═════════════════════
// +/- 분·초 조절 UI — 준비됨 상태에서만 표시 (delta는 초 단위)
function AdjustRow({ totalSec, onAdjust }: { totalSec: number; onAdjust: (deltaSec: number) => void }) {
  const btnStyle = {
    ...ghostBtn({ borderRadius: '8px', padding: '3px 8px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' }),
  }
  const hover = (e: React.MouseEvent<HTMLButtonElement>, enter: boolean) => {
    if (enter) { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; e.currentTarget.style.color = '#4F46E5' }
    else { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = '#9B9A97' }
  }
  const adjustBtn = (deltaSec: number, label: string) => (
    <button onClick={() => onAdjust(deltaSec)} style={btnStyle} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>
      {label}
    </button>
  )
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  const display = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
      {adjustBtn(-10, '−10초')}
      {adjustBtn(-60, '−1분')}
      {adjustBtn(-300, '−5분')}
      <span style={{ fontSize: '11px', fontWeight: 700, color: '#6366f1', minWidth: '44px', textAlign: 'center' }}>
        {display}
      </span>
      {adjustBtn(10, '+10초')}
      {adjustBtn(60, '+1분')}
      {adjustBtn(300, '+5분')}
    </div>
  )
}

// ═══════════════════════════════════════ ZEN MODE ════════════════════════════
function ZenView({
  seconds, totalSec, running, finished,
  isOvertime, overtimeSec,
  focusQuestName,
  onPlayPause, onStop, onComplete, onExtend,
}: {
  seconds: number; totalSec: number; running: boolean; finished: boolean
  isOvertime: boolean; overtimeSec: number
  focusQuestName: string | null
  onPlayPause: () => void; onStop: () => void
  onComplete: () => void; onExtend: () => void
}) {
  const isMobile = useIsMobile()
  const displaySec = isOvertime ? overtimeSec : seconds
  const mm = String(Math.floor(displaySec / 60)).padStart(2, '0')
  const ss = String(displaySec % 60).padStart(2, '0')
  const r = isMobile ? 140 : 120
  const circ = 2 * Math.PI * r
  const dashOffset = isOvertime ? 0 : (totalSec > 0 ? circ * (1 - seconds / totalSec) : circ)
  const svgSize = isMobile ? 330 : 290
  const cx = svgSize / 2

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: '#000',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* 가장자리 보라 글로우 */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: [
          'radial-gradient(ellipse 70% 50% at 0% 0%,   rgba(99,102,241,0.09) 0%, transparent 55%)',
          'radial-gradient(ellipse 70% 50% at 100% 0%,  rgba(139,92,246,0.07) 0%, transparent 55%)',
          'radial-gradient(ellipse 70% 50% at 0% 100%,  rgba(139,92,246,0.07) 0%, transparent 55%)',
          'radial-gradient(ellipse 70% 50% at 100% 100%,rgba(99,102,241,0.09) 0%, transparent 55%)',
        ].join(','),
      }} />

      {/* X 버튼 */}
      <button
        onClick={onStop}
        style={{ ...ghostBtn({ position: 'absolute', top: '24px', right: '24px', borderRadius: '50%', width: '40px', height: '40px' }) }}
        onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.45)' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#9B9A97'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)' }}
      >
        <IcoClose />
      </button>

      <p style={{ margin: 0, marginBottom: '16px', fontSize: '11px', color: '#4338ca', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em' }}>
        Zen · Focus Mode
      </p>

      {/* 링 타이머 */}
      <div style={{ position: 'relative', width: `${svgSize}px`, height: `${svgSize}px`, marginBottom: '32px' }}>
        <svg width={svgSize} height={svgSize} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(99,102,241,0.08)" strokeWidth="5" />
          <circle cx={cx} cy={cx} r={r} fill="none"
            stroke={finished ? '#34d399' : isOvertime ? '#ef4444' : '#6366f1'}
            strokeWidth="5" strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={dashOffset}
            style={{
              transition: 'stroke-dashoffset 0.95s linear, stroke 0.4s',
              filter: `drop-shadow(0 0 10px ${finished ? 'rgba(52,211,153,0.6)' : isOvertime ? 'rgba(239,68,68,0.55)' : 'rgba(99,102,241,0.55)'})`,
            }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{
            fontSize: isMobile ? '96px' : '82px', fontWeight: 900, letterSpacing: '-5px',
            fontVariantNumeric: 'tabular-nums', lineHeight: 1,
            color: finished ? '#34d399' : isOvertime ? '#f87171' : '#fff',
            textShadow: finished
              ? '0 0 60px rgba(52,211,153,0.5)'
              : isOvertime ? '0 0 60px rgba(239,68,68,0.4)'
                : '0 0 60px rgba(99,102,241,0.35), 0 0 120px rgba(99,102,241,0.15)',
          }}>
            {isOvertime ? `+ ${mm}:${ss}` : `${mm}:${ss}`}
          </span>
          <span style={{ fontSize: '12px', color: '#374151', marginTop: '8px', letterSpacing: '0.08em' }}>
            {finished ? '세션 완료 🎉' : isOvertime ? '초과 몰입 중...' : running ? '집중 중...' : '일시정지'}
          </span>
        </div>
      </div>

      {/* 집중 퀘스트 표시 */}
      <div style={{ marginBottom: '44px', textAlign: 'center' }}>
        {focusQuestName ? (
          <span style={{
            fontSize: '14px', color: '#a78bfa',
            backgroundColor: 'rgba(167,139,250,0.1)',
            border: '1px solid rgba(167,139,250,0.25)',
            padding: '7px 22px', borderRadius: '999px',
            letterSpacing: '0.03em',
          }}>
            🎯 {focusQuestName}
          </span>
        ) : (
          <span style={{ fontSize: '12px', color: '#4B5563' }}>퀘스트 미선택</span>
        )}
      </div>

      {/* 컨트롤 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        {/* 정지 → 대시보드 복귀 */}
        <button onClick={onStop}
          style={{ ...ghostBtn({ borderRadius: '50%', width: '54px', height: '54px' }) }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.45)'; e.currentTarget.style.color = '#f87171' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = '#9B9A97' }}
          title="정지 · 대시보드로 복귀"
        >
          <IcoStop />
        </button>

        {/* 재생 / 일시정지 */}
        <button onClick={onPlayPause} disabled={finished}
          style={{
            width: '80px', height: '80px', borderRadius: '50%', border: 'none',
            background: finished ? '#E8F5E9' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
            color: '#37352F', cursor: finished ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: finished ? 'none' : '0 0 48px rgba(99,102,241,0.55)',
            transition: 'all 0.2s',
          }}
        >
          {running ? <IcoPause /> : <IcoPlay />}
        </button>

        {/* 리셋 → 대시보드 복귀 */}
        <button onClick={onStop}
          style={{ ...ghostBtn({ borderRadius: '50%', width: '54px', height: '54px' }) }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.45)'; e.currentTarget.style.color = '#4F46E5' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = '#9B9A97' }}
          title="리셋 · 복귀"
        >
          <IcoReset />
        </button>
      </div>

      {/* 완료 / 연장 버튼 (젠 모드용) */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        {(running || isOvertime || (!finished && seconds < totalSec)) && (
          <button
            onClick={onComplete}
            style={{ padding: '7px 20px', borderRadius: '8px', border: '1px solid rgba(234,179,8,0.4)', backgroundColor: 'rgba(254,249,195,0.12)', color: '#FDE047', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(234,179,8,0.18)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(254,249,195,0.12)' }}
          >완료 (Complete)</button>
        )}
        {finished && (
          <button
            onClick={onExtend}
            style={{ padding: '7px 20px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.45)', backgroundColor: 'rgba(99,102,241,0.12)', color: '#a78bfa', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.22)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.12)' }}
          >⏱ +5분 연장</button>
        )}
      </div>

      <p style={{ margin: '28px 0 0', fontSize: '11px', color: '#9B9A97', letterSpacing: '0.05em' }}>
        ESC 또는 ⏹ 버튼으로 대시보드로 복귀
      </p>
    </div>
  )
}

// ═══════════════════════════════════════ POMODORO MODAL ══════════════════════
function PomodoroModal({
  seconds, totalSec, running, finished,
  isOvertime, overtimeSec,
  quests, areas, projects,
  focusQuestId, onSelectQuest,
  onPlayPause, onReset, onAdjust, onSetDefault, onClose, onEnterZen,
  onComplete, onExtend,
}: {
  seconds: number; totalSec: number; running: boolean; finished: boolean
  isOvertime: boolean; overtimeSec: number
  quests: Card[]; areas: AreaRow[]; projects: ProjectRow[]
  focusQuestId: string | null
  onSelectQuest: (id: string) => void
  onPlayPause: () => void; onReset: () => void
  onAdjust: (deltaSec: number) => void; onSetDefault: () => void
  onClose: () => void; onEnterZen: () => void
  onComplete: () => void; onExtend: () => void
}) {
  const displaySec = isOvertime ? overtimeSec : seconds
  const mm = String(Math.floor(displaySec / 60)).padStart(2, '0')
  const ss = String(displaySec % 60).padStart(2, '0')
  const r = 80
  const circ = 2 * Math.PI * r
  const dashOffset = isOvertime ? 0 : (totalSec > 0 ? circ * (1 - seconds / totalSec) : circ)
  const isReady = !running && !finished && !isOvertime && seconds === totalSec

  // Quest 옵션 라벨: [Area > Project] 퀘스트명 또는 [미분류] 퀘스트명
  function getQuestLabel(q: { id: string; name: string; projectId?: string | null }) {
    const proj = projects.find(p => String(p.id) === String(q.projectId))
    const area = proj ? areas.find(a => String(a.id) === String(proj.area_id)) : undefined
    if (!area || !proj) return `[미분류] ${q.name}`
    return `[${area.name} > ${proj.name}] ${q.name}`
  }

  const selStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: '8px',
    border: '1px solid rgba(0,0,0,0.10)', backgroundColor: '#FAFAF8',
    color: '#37352F', fontSize: '13px', outline: 'none',
    cursor: 'pointer', appearance: 'auto', fontFamily: 'inherit',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '16px', padding: '32px 36px', width: '480px', maxWidth: '96vw', position: 'relative' }}>

        <button onClick={onClose}
          style={{ position: 'absolute', top: '14px', right: '14px', background: 'none', border: 'none', cursor: 'pointer', color: '#787774', padding: '6px' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#37352F')}
          onMouseLeave={e => (e.currentTarget.style.color = '#787774')}
        >
          <IcoClose />
        </button>

        <p style={{ margin: 0, fontSize: '10px', color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: '4px' }}>
          Focus Mode
        </p>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#37352F', marginBottom: '18px' }}>
          몰입 타이머
        </h2>

        {/* ── Quest 단일 선택 ── */}
        <div style={{ backgroundColor: '#F8F8F6', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#9B9A97', marginBottom: '8px' }}>
            ✅ 집중할 퀘스트 선택
          </label>
          <select
            value={focusQuestId ?? ''}
            onChange={e => onSelectQuest(e.target.value)}
            style={{ ...selStyle, fontWeight: focusQuestId ? 600 : 400 }}
          >
            <option value="">— Quest 선택 —</option>
            {quests.map(q => (
              <option key={q.id} value={q.id}>{getQuestLabel(q)}</option>
            ))}
          </select>
          {focusQuestId && (
            <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#6366f1', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>▶</span>
              <span>{quests.find(q => q.id === focusQuestId)?.name ?? ''}</span>
              <span style={{ fontSize: '10px', color: '#9B9A97', fontWeight: 400 }}>에 집중 중</span>
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>

          {/* 링 타이머 */}
          <div style={{ position: 'relative', width: '210px', height: '210px' }}>
            <svg width="210" height="210" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="105" cy="105" r={r} fill="none" stroke="rgba(99,102,241,0.09)" strokeWidth="7" />
              <circle cx="105" cy="105" r={r} fill="none"
                stroke={finished ? '#34d399' : isOvertime ? '#ef4444' : '#6366f1'}
                strokeWidth="7" strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={dashOffset}
                style={{
                  transition: 'stroke-dashoffset 0.95s linear, stroke 0.3s',
                  filter: `drop-shadow(0 0 7px ${finished ? '#34d399' : isOvertime ? 'rgba(239,68,68,0.6)' : '#6366f1'})`,
                }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <span style={{
                fontSize: '48px', fontWeight: 900, letterSpacing: '-2.5px',
                fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                color: finished ? '#22c55e' : isOvertime ? '#dc2626' : '#37352F',
              }}>
                {isOvertime ? `+ ${mm}:${ss}` : `${mm}:${ss}`}
              </span>
              <span style={{ fontSize: '11px', color: '#787774', letterSpacing: '0.05em' }}>
                {finished ? '완료! 🎉' : isOvertime ? '초과 몰입 중...' : running ? '집중 중...' : isReady ? '준비됨' : '일시정지'}
              </span>
            </div>
          </div>

          {/* ── 분 조절 (준비됨 상태에서만) ── */}
          {isReady && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={onSetDefault}
                style={{
                  padding: '4px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)',
                  background: 'rgba(0,0,0,0.02)', color: '#9B9A97', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.color = '#6366f1' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = '#9B9A97' }}
              >
                25분으로 복구
              </button>
              <p style={{ margin: 0, fontSize: '10px', color: '#787774', letterSpacing: '0.08em' }}>
                ▲ 시간 조절 (분·초 단위)
              </p>
              <AdjustRow totalSec={totalSec} onAdjust={onAdjust} />
            </div>
          )}

          {/* 컨트롤 버튼 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button onClick={onReset}
              style={{ ...ghostBtn({ borderRadius: '50%', width: '46px', height: '46px', border: '1px solid rgba(0,0,0,0.06)' }) }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#6366f1')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#EBEBEA')}
            >
              <IcoReset />
            </button>

            {/* ▶ 재생 → 젠 모드 자동 진입 */}
            <button
              onClick={() => { if (!running) { onPlayPause(); onEnterZen() } else { onPlayPause() } }}
              disabled={finished}
              style={{
                width: '72px', height: '72px', borderRadius: '50%', border: 'none',
                background: finished ? '#E8F5E9' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                color: finished ? '#22c55e' : '#fff', cursor: finished ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: finished ? 'none' : '0 8px 32px rgba(99,102,241,0.48)',
                transition: 'all 0.15s',
              }}
            >
              {running ? <IcoPause /> : <IcoPlay />}
            </button>

            <div style={{ width: '46px' }} />
          </div>

          {/* ── 완료 / 연장하기 ── */}
          {(running || isOvertime || (!isReady && !finished)) && (
            <button
              onClick={onComplete}
              style={{
                padding: '8px 24px', borderRadius: '9px', border: '1px solid rgba(234,179,8,0.35)',
                backgroundColor: 'rgba(254,249,195,0.7)', color: '#92400E',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(253,224,71,0.35)' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(254,249,195,0.7)' }}
            >
              완료 (Complete)
            </button>
          )}

          {finished && (
            <button
              onClick={onExtend}
              style={{
                padding: '8px 24px', borderRadius: '9px', border: '1px solid rgba(99,102,241,0.3)',
                backgroundColor: 'rgba(238,242,255,0.9)', color: '#4F46E5',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(199,210,254,0.5)' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(238,242,255,0.9)' }}
            >
              ⏱ +5분 연장하기
            </button>
          )}

          <p style={{ margin: 0, fontSize: '11px', color: '#37352F', textAlign: 'center' }}>
            ▶ 재생 시 자동으로 젠 모드로 전환됩니다
          </p>
        </div>
      </div>
    </div>
  )
}

/** 구 Worlds 로컬 데이터 키 — KV 동기화 pass-through용으로만 유지 */
const WORLDS_KEY = 'creative_os_worlds_v1'
/** Travel / Gourmet — 문자열은 TravelPageInternal.tsx 와 동일해야 함 */
const TRAVEL_KEY = 'creative_os_travel_v1'
const TRAVEL_TRIP_ORDER_KEY = 'creative_os_travel_trip_order_v1'
const TRAVEL_EXPENSE_CATEGORIES_KEY = 'creative_os_travel_expense_categories_v1'
const TRAVEL_RETROSPECTIVE_TEMPLATES_KEY = 'creative_os_travel_retrospective_templates_v1'
const GOURMET_KEY = 'creative_os_gourmet_v1'

const FORCE_RECOVER_HIDE_KEY = 'creative_os_force_recover_ui_hidden_v1'

// ═══════════════════════════════════════ APP ═════════════════════════════════
export default function App() {
  // ── Auth ──
  const [session, setSession] = useState<Session | null | 'loading'>('loading')

  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [selectedQuests, setSelectedQuests] = useState<string[]>([])
  const [focusOpen, setFocusOpen] = useState(false)
  const [sanctuaryOpen, setSanctuaryOpen] = useState(false)
  /** `battle_focus_ui_v1`: '0'이면 클래식 PomodoroModal, 그 외 전투 UI */
  const [battleFocusUi, setBattleFocusUi] = useState(() => {
    try {
      return localStorage.getItem('battle_focus_ui_v1') !== '0'
    } catch {
      return true
    }
  })
  const [focusLoot, setFocusLoot] = useState<FocusLootState>({ status: 'idle' })
  const [workspaceArchiveKind, setWorkspaceArchiveKind] = useState<WorkspaceArchiveKind | null>(null)
  const [isZenMode, setIsZenMode] = useState(false)
  const [noteTarget, setNoteTarget] = useState<NoteTarget | null>(null)

  // ── 페이지 라우팅 (React Router + HashRouter) ──
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const questViewParam = searchParams.get('questView')
  const questView = questViewParam === 'journal' ? 'journal' : questViewParam === 'map' ? 'map' : 'board'
  const pathSeg = location.pathname.replace(/^\//, '').split('/')[0] || ''
  const pathPage = pathSeg === '' ? 'quest' : pathSeg
  const activePage = (PAGE_IDS.includes(pathPage as PageId) ? pathPage : 'quest') as PageId
  const setActivePage = (p: PageId) => navigate(p === 'quest' ? '/' : `/${p}`)

  useEffect(() => {
    const seg = location.pathname.replace(/^\//, '').split('/')[0]
    if (seg === 'beautiful-life') {
      navigate(`/life${location.search}`, { replace: true })
      return
    }
    if (seg === 'possession') {
      navigate(`/act${location.search}`, { replace: true })
      return
    }
    if (seg === 'quantum-flow') {
      navigate(`/quantum${location.search}`, { replace: true })
      return
    }
    const legacy: Record<string, string> = {
      identity: '/act',
      journal: '/life?tab=journal',
      calendar: '/master-board?warehouse=calendar',
      tags: '/master-board?warehouse=sources',
      sources: '/master-board?warehouse=sources',
      rating: '/master-board?warehouse=rating',
      favorites: '/master-board?warehouse=favorites',
      dashboard: '/',
      library: '/quest',
      worlds: '/quest',
    }
    if (legacy[seg]) navigate(legacy[seg], { replace: true })
  }, [location.pathname, location.search, navigate])
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0)
  const isMobile = useIsMobile()

  // ── 스탯 상태 ──
  const [stats, setStats] = useState<StatDef[]>(DEFAULT_STATS)

  // ── 퀘스트 완료 상태 ──
  const [completedQuests, setCompletedQuests] = useState<string[]>([])

  // ── Areas (빈 배열로 시작 — Supabase에서 로드) ──
  const [areas, setAreas] = useState<AreaRow[]>([])
  const [newAreaName, setNewAreaName] = useState('')
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null)
  const [editingAreaName, setEditingAreaName] = useState('')

  // ── 프로젝트 (빈 배열로 시작 — Supabase에서 로드) ──
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectAreaId, setNewProjectAreaId] = useState<string>('')
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingProjectName, setEditingProjectName] = useState('')

  // ── Identity (정체성) ──
  const [identities, setIdentities] = useState<IdentityRow[]>([])
  const [activeIdentityId, setActiveIdentityId] = useState<string | null>(null)

  // ── 사용자 정의 퀘스트 (빈 배열로 시작 — Supabase에서 로드) ──
  const [userQuests, setUserQuests] = useState<Card[]>([])
  const [newQuestTitle, setNewQuestTitle] = useState('')
  const [newQuestCat, setNewQuestCat] = useState<CatId>('writing')
  const [newQuestAreaId, setNewQuestAreaId] = useState<string>('')
  const [newQuestProjectId, setNewQuestProjectId] = useState<string>('')
  const [newQuestIdentityId, setNewQuestIdentityId] = useState<string>('')
  const [newQuestTags, setNewQuestTags] = useState<string[]>([])
  const [newQuestValueActionId, setNewQuestValueActionId] = useState<string>('')
  const [drillQuest, setDrillQuest] = useState<Card | null>(null)
  const [microVictoryLabel, setMicroVictoryLabel] = useState('')
  const [microVictoryFx, setMicroVictoryFx] = useState(false)
  const [addingQuest, setAddingQuest] = useState(false)

  const valueActionList = useMemo(() => activeValueActions(loadValueActionStore().items), [activePage, calendarRefreshKey])
  const questValueRewardPreview = useMemo(() => {
    if (!newQuestValueActionId) return null
    const va = valueActionList.find(v => v.id === newQuestValueActionId)
    return va ? computeQuestRewardsFromValue(va) : null
  }, [newQuestValueActionId, valueActionList])

  const pomodoroStartRef = useRef<number | null>(null)
  const pomodoroSessionProcessedRef = useRef(false) // 동일 세션 daily_logs 중복 누적 방지
  const focusQuestProjectIdRef = useRef<string | null>(null)
  const focusQuestAreaIdRef = useRef<string | null>(null)
  const [focusQuestId, setFocusQuestId] = useState<string | null>(null)

  const focusLinkedValueAction = useMemo((): ValueAction | null => {
    if (!focusQuestId) return null
    const vid = getQuestValueLink(focusQuestId)
    if (!vid) return null
    return valueActionList.find(v => v.id === vid) ?? null
  }, [focusQuestId, valueActionList])

  // ── XP / 레벨 ──
  const [xpState, setXpState] = useState<XpState>(() => loadXp())
  const [levelUpAnim, setLevelUpAnim] = useState(false)
  const [levelUpNewLv, setLevelUpNewLv] = useState(1)
  const [morningPresenceOpen, setMorningPresenceOpen] = useState(() => shouldShowMorningPresenceModal())

  // ── Toast ──
  const [toastVisible, setToastVisible] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [kvRecovering, setKvRecovering] = useState(false)
  const kvRecoveringRef = useRef(false)
  const [forceRecoverHidden, setForceRecoverHidden] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem(FORCE_RECOVER_HIDE_KEY) === '1'
    } catch {
      return false
    }
  })

  // ── Undo/Redo ──
  const { pushUndo } = useUndoRedo()

  // ── Supabase 동기화: 평소 UI 없음, 실패 시에만 코너에 1회성 고정 알림 ──
  const [syncError, setSyncError] = useState<string | null>(null)

  useEffect(() => subscribeAppSyncStatus(s => {
    if (s === 'synced') setSyncError(null)
    if (s === 'error') {
      setSyncError(prev => prev ?? '동기화에 실패했습니다. 네트워크와 로그인 상태를 확인해 주세요.')
    }
  }), [])

  // 타이머 상태 (App 레벨 — 모달↔젠모드 전환 중에도 계속 실행됨)
  const [timerTotal, setTimerTotal] = useState(25 * 60)
  const [timerSec, setTimerSec] = useState(25 * 60)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerDone, setTimerDone] = useState(false)
  const [isOvertime, setIsOvertime] = useState(false)
  const [overtimeSec, setOvertimeSec] = useState(0)
  const [dailyLog, setDailyLog] = useState<{ total_pomodoros: number; total_time_sec: number; time_score_applied?: number } | null>(null)
  const [levelRewards, setLevelRewards] = useState<{ id: string; target_level: number; reward_text: string; is_claimed: boolean }[]>([])
  const [newRewardLevel, setNewRewardLevel] = useState('')
  const [newRewardText, setNewRewardText] = useState('')
  /** Quest 탭: Area·프로젝트 관리 패널 접기 (기본 접힘 → 퀘스트가 첫 화면 중심) */
  const [questAreaProjectExpanded, setQuestAreaProjectExpanded] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerSecRef = useRef(timerSec)
  const isOvertimeRef = useRef(false)

  // ── 초기 로드 (localStorage) ──
  // ── Auth 세션 초기화 ──
  useEffect(() => {
    let cancelled = false
    void getSession().then(s => {
      if (!cancelled) setSession(s)
    })
    const unsub = onAuthStateChange(s => {
      if (!cancelled) setSession(s)
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  useEffect(() => {
    const saved = loadStatus()
    if (saved.selected_projects.length) setSelectedProjects(saved.selected_projects)
    if (saved.selected_quests.length) setSelectedQuests(saved.selected_quests)
    setStats(loadStats())
    try {
      const raw = localStorage.getItem(COMPLETED_KEY)
      if (raw) setCompletedQuests(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  // ── Supabase 초기 동기화 ─────────────────────────────────────────────────
  //    user_stats / quests / journals → 전용 테이블
  //    worlds / saju / calendar / travel / gourmet → app_kv (KV 스토어)
  useEffect(() => {
    if (!isSupabaseReady) return
    emitAppSyncStatus('syncing')

    Promise.all([
      // ① user_stats 테이블에서 레벨·경험치·스탯 가져오기
      fetchUserStats().then(row => {
        if (!row) return
        const totalXp = (row as { total_xp?: number }).total_xp != null
          ? (row as { total_xp: number }).total_xp
          : cumulativeXpToReachLevel(row.level) + row.current_xp
        const xp: XpState = { totalXp }
        localStorage.setItem(XP_KEY, JSON.stringify(xp))
        setXpState(xp)
        if (row.stats_json && Object.keys(row.stats_json).length) {
          localStorage.setItem(STATS_KEY, JSON.stringify(row.stats_json))
          setStats(loadStats())
        }
      }),

      // ② 완료된 퀘스트 ID는 localStorage 에서 로드 (별도 Supabase 테이블 없음)
      Promise.resolve().then(() => {
        try {
          const raw = localStorage.getItem(COMPLETED_KEY)
          if (raw) setCompletedQuests(JSON.parse(raw))
        } catch { /* ignore */ }
      }),

      // ③ journals 테이블에서 일지 전체 가져오기
      fetchAllJournals().then(rows => {
        if (!rows.length) return
        type JEntry = { date: string; content: string; blocks: unknown[] }
        const store: Record<string, JEntry> = {}
        rows.forEach(r => { store[r.date] = { date: r.date, content: r.content, blocks: r.blocks } })
        localStorage.setItem(JOURNAL_KEY, JSON.stringify(store))
      }),

      // ④ 사용자 직접 생성 퀘스트 (더미 없이 빈 배열 시작)
      fetchUserCreatedQuests().then(rows => {
        const cards: Card[] = rows.map(r => ({
          id: String(r.id),
          name: r.title,
          sub: r.category,
          emoji: CAT_OPTS.find(c => c.id === r.category)?.emoji ?? '✅',
          projectId: r.project_id != null ? String(r.project_id) : null,
          identityId: r.identity_id ?? null,
          status: r.status ?? 'someday',
          tags: r.tags ?? [],
          sortOrder: r.sort_order ?? 0,
          priority: r.priority,
          deadline: r.deadline,
          timeSpentSec: r.time_spent_sec,
          remainingTimeSec: r.remaining_time_sec ?? null,
          pomodoroCount: r.pomodoro_count ?? 0,
          startedAt: r.started_at,
          endedAt: r.ended_at,
        }))
        setUserQuests(cards)
      }),

      // ⑤-a Area 목록 로드
      fetchAreas().then(rows => setAreas(rows)),

      // ⑤-b 프로젝트 목록 로드
      fetchProjects().then(rows => setProjects(rows)),

      // ⑤-b2 Identity 목록 + 활성 태세 로드
      fetchIdentities().then(rows => setIdentities(rows)),
      fetchActiveIdentity().then(id => setActiveIdentityId(id)),

      // ⑤-c 오늘 daily_logs 로드
      fetchDailyLog(new Date().toISOString().split('T')[0]).then(row => {
        if (row) setDailyLog({ total_pomodoros: row.total_pomodoros, total_time_sec: row.total_time_sec, time_score_applied: row.time_score_applied })
        else setDailyLog({ total_pomodoros: 0, total_time_sec: 0 })
      }).catch(() => setDailyLog({ total_pomodoros: 0, total_time_sec: 0 })),

      // ⑤-d 레벨 보상함 로드
      fetchLevelRewards().then(rows => setLevelRewards(rows)),

      // ⑤ 나머지 데이터(worlds · saju · calendar · travel · gourmet · Goals·Manifest·Value·…) → app_kv
      kvGetAll().then(async all => {
        const trashed = await kvListTrashedKeys()
        for (const k of trashed) {
          try { localStorage.removeItem(k) } catch { /* ignore */ }
        }
        const passThrough = [WORLDS_KEY, SAJU_KEY, CALENDAR_KEY, TRAVEL_KEY, TRAVEL_TRIP_ORDER_KEY, TRAVEL_TRIP_DETAIL_KEY, GOURMET_KEY, TRAVEL_EXPENSE_CATEGORIES_KEY, TRAVEL_RETROSPECTIVE_TEMPLATES_KEY, PROJECT_WORKSPACE_KEY, PROJECT_HUB_PREFS_KEY, SETTLEMENT_KEY, QUANTUM_FLOW_KEY, ACCOUNT_LEDGER_KEY, EVOLUTION_KEY, HABIT_ROUTINE_CHAIN_KEY, SANCTUARY_KPT_KEY, INNER_WORLD_KEY, CHRONICLE_STORE_KEY, EXTERNAL_CALENDAR_STORE_KEY, SKILL_TREE_KEY, REWARD_HISTORY_KEY, ACHIEVEMENTS_KEY, VISUALIZATION_ITEMS_KEY, SIMULATION_WALLET_KEY, MORNING_PRESENCE_ACK_KEY, IDENTITY_ARCHETYPE_KEY, FRAGMENT_KEY, GARRISON_TACTICAL_ALLY_KEY, LEGACY_ARCHIVE_KEY]
        passThrough.forEach(k => { if (all[k] !== undefined && all[k] !== null) localStorage.setItem(k, JSON.stringify(all[k])) })
        hydrateLocalStorageFromKvRecord(all)
        await migrateLocalToKvIfMissing(all)
      }),

      // ⑥ CalStore → calendar_events 1회 마이그레이션
      (async () => {
        if (localStorage.getItem('cal_store_migrated_v1')) return
        const events = (await fetchCalendarEventsByType('event')).length
        if (events > 0) { localStorage.setItem('cal_store_migrated_v1', '1'); return }
        const cal = loadCalendar()
        for (const ev of cal.events) {
          if (ev.startDate && ev.title) {
            await insertEventEvent({ startDate: ev.startDate, endDate: ev.endDate ?? ev.startDate, color: ev.color ?? '#6366f1', note: ev.note ?? '', title: ev.title })
          }
        }
        localStorage.setItem('cal_store_migrated_v1', '1')
      })(),
    ])
      .then(() => { emitAppSyncStatus('synced'); scheduleSyncIdle(SYNC_IDLE_MS) })
      .catch(() => { emitAppSyncStatus('error') })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Supabase 실시간 구독 (다른 기기 변경 → 자동 반영) ──
  useEffect(() => {
    const channel = subscribeKv((key, value, meta) => {
      if (meta?.permanentlyRemoved || meta?.softDeleted) {
        try { localStorage.removeItem(key) } catch { /* ignore */ }
        if (key === STATS_KEY) setStats(loadStats())
        else if (key === COMPLETED_KEY) setCompletedQuests([])
        else if (key === XP_KEY) setXpState(loadXp())
        emitAppSyncStatus('synced')
        scheduleSyncIdle(SYNC_IDLE_MS)
        return
      }
      emitAppSyncStatus('synced')
      scheduleSyncIdle(SYNC_IDLE_MS)
      if (value === undefined || value === null) return
      if (key === STATS_KEY) {
        localStorage.setItem(key, JSON.stringify(value))
        setStats(loadStats())
      } else if (key === COMPLETED_KEY) {
        const c = value as string[]
        localStorage.setItem(key, JSON.stringify(c))
        setCompletedQuests(c)
      } else if (key === XP_KEY) {
        const x = value as Record<string, unknown>
        let totalXp = 0
        if (typeof x.totalXp === 'number') totalXp = x.totalXp
        else if (typeof x.level === 'number' && typeof x.currentXp === 'number') totalXp = cumulativeXpToReachLevel(x.level) + x.currentXp
        const xp: XpState = { totalXp }
        localStorage.setItem(key, JSON.stringify(xp))
        setXpState(xp)
      } else {
        // Journal, Worlds, Saju, Calendar, Travel, Gourmet
        localStorage.setItem(key, JSON.stringify(value))
      }
    })
    return () => { channel?.unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      syncLegacyArchiveFromProjects(
        projects,
        userQuests.map(q => ({ id: q.id, name: q.name, projectId: q.projectId })),
        completedQuests,
      )
    } catch {
      /* ignore */
    }
  }, [projects, userQuests, completedQuests])

  timerSecRef.current = timerSec
  const prevFocusQuestIdRef = useRef<string | null>(null)
  // ── focusQuestId 변경 시 parent refs + 타이머 로드 (Resume) ──
  useEffect(() => {
    const prevId = prevFocusQuestIdRef.current
    prevFocusQuestIdRef.current = focusQuestId

    // 이전 퀘스트로 전환 시, 현재 남은 시간 저장
    const sec = timerSecRef.current
    if (prevId && prevId !== focusQuestId && !timerDone) {
      const toSave = isOvertimeRef.current ? 0 : sec
      updateQuestRemainingTime(prevId, toSave)
      setUserQuests(prev => prev.map(q => q.id === prevId ? { ...q, remainingTimeSec: toSave } : q))
    }

    if (!focusQuestId) {
      focusQuestProjectIdRef.current = null
      focusQuestAreaIdRef.current = null
      return
    }
    const quest = userQuests.find(q => q.id === focusQuestId)
    const projectId = quest?.projectId ?? null
    focusQuestProjectIdRef.current = projectId
    if (projectId) {
      const project = projects.find(p => p.id === projectId)
      focusQuestAreaIdRef.current = project?.area_id ?? null
    } else {
      focusQuestAreaIdRef.current = null
    }
    // remaining_time_sec 로드 → 타이머 세팅 (Resume)
    const rem = quest?.remainingTimeSec
    const loadSec = (rem != null && rem > 0) ? rem : 25 * 60
    setTimerTotal(loadSec)
    setTimerSec(loadSec)
    setTimerDone(false)
    setIsOvertime(false)
    setOvertimeSec(0)
    isOvertimeRef.current = false
  }, [focusQuestId, userQuests, projects])

  // ── Toast 트리거 ──
  function fireToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToastMsg(msg); setToastVisible(true)
    toastTimer.current = setTimeout(() => setToastVisible(false), 2200)
  }

  /** 임시: localStorage의 creative_os_* · creative-os-* 전부 app_kv로 일괄 업로드 */
  const handleForceRecoverLocalToKv = useCallback(async () => {
    if (!isSupabaseReady) {
      alert('Supabase에 연결되지 않았습니다.')
      return
    }
    if (kvRecoveringRef.current) return
    kvRecoveringRef.current = true
    setKvRecovering(true)
    const parseValueForKv = (raw: string): unknown => {
      try {
        return JSON.parse(raw)
      } catch {
        return { text: raw }
      }
    }
    try {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && (k.startsWith('creative_os_') || k.startsWith('creative-os-'))) keys.push(k)
      }
      keys.sort()
      if (keys.length === 0) {
        alert('localStorage에 creative_os_* · creative-os-* 키가 없습니다.')
        return
      }

      type Row = { key: string; raw: string }
      const toUpload: Row[] = []
      for (const key of keys) {
        if (key === FORCE_RECOVER_HIDE_KEY) continue
        const raw = localStorage.getItem(key)
        if (raw != null && raw !== '') toUpload.push({ key, raw })
      }
      if (toUpload.length === 0) {
        alert('업로드할 값이 있는 키가 없습니다. (값이 비어 있습니다)')
        return
      }

      const results = await Promise.all(
        toUpload.map(async ({ key, raw }) => {
          const value = parseValueForKv(raw)
          const r = await kvSetAttempt(key, value)
          return { key, r }
        }),
      )

      let ok = 0
      let fail = 0
      for (const { key, r } of results) {
        if (r.ok) ok += 1
        else {
          fail += 1
          console.error('[forceRecover] kv upload failed', key, r.error)
        }
      }

      const total = toUpload.length
      const summary = `총 ${total}개 중 ${ok}개 성공, ${fail}개 실패`

      if (fail > 0) {
        emitAppSyncStatus('error')
        alert(`${summary}\n\n실패한 항목은 개발자 도구 콘솔에 상세 로그가 있습니다.`)
        return
      }

      try {
        localStorage.setItem(FORCE_RECOVER_HIDE_KEY, '1')
      } catch {
        /* ignore */
      }
      setForceRecoverHidden(true)
      alert(`${summary}\n\n확인을 누르면 새로고침되어 DB 데이터를 불러옵니다.`)
      window.location.reload()
    } catch (e) {
      console.error('[forceRecover] unexpected', e)
      emitAppSyncStatus('error')
      alert('업로드 처리 중 예외가 발생했습니다. 콘솔을 확인하세요.')
    } finally {
      kvRecoveringRef.current = false
      setKvRecovering(false)
    }
  }, [isSupabaseReady])

  // ── 시간 점수 → total_xp 동기화 (Delta만 가산) ──
  async function syncTimeScoreToXp(recordDate: string) {
    const row = await fetchDailyLog(recordDate)
    if (!row) return
    const newScore = calculateTimeScore(Math.floor(row.total_time_sec / 60))
    const oldScore = row.time_score_applied ?? 0
    const delta = newScore - oldScore
    if (delta === 0) return
    if (delta > 0) applyXpGainToSimulationWallet(delta)
    setXpState(prev => {
      const next = { totalXp: Math.max(0, prev.totalXp + delta) }
      saveXp(next)
      return next
    })
    await updateDailyLogTimeScore(recordDate, newScore)
  }

  // ── XP 가감 (토글: 체크 시 +, 해제 시 -) — totalXp 기반 절대 계산 ──
  function adjustXp(delta: number) {
    if (delta === 0) return
    if (delta > 0) applyXpGainToSimulationWallet(delta)
    setXpState(prev => {
      const newTotalXp = Math.max(0, prev.totalXp + delta)
      const { currentLevel } = calculateLevel(newTotalXp)
      const prevLevel = calculateLevel(prev.totalXp).currentLevel
      const didLevelUp = currentLevel > prevLevel
      const next: XpState = { totalXp: newTotalXp }
      saveXp(next)
      if (didLevelUp) {
        setTimeout(() => { setLevelUpNewLv(currentLevel); setLevelUpAnim(true) }, 0)
      }
      return next
    })
  }

  // ── XP 수동 편집 (Override): 총 누적 XP 직접 수정 ──
  function handleEditTotalXp(newTotalXp: number) {
    const old = xpState.totalXp
    const next: XpState = { totalXp: Math.max(0, newTotalXp) }
    if (next.totalXp > old) applyXpGainToSimulationWallet(next.totalXp - old)
    setXpState(next)
    saveXp(next)
  }

  // ── XP 수동 편집 (Override): 현재 레벨 경험치 수정 → baseXpForCurrentLevel + 입력값으로 total_xp 역산 ──
  function handleEditCurrentLevelXp(newCurrentLevelXp: number) {
    const calc = calculateLevel(xpState.totalXp)
    const newTotalXp = Math.max(0, calc.baseXpForCurrentLevel + newCurrentLevelXp)
    const old = xpState.totalXp
    if (newTotalXp > old) applyXpGainToSimulationWallet(newTotalXp - old)
    const next: XpState = { totalXp: newTotalXp }
    setXpState(next)
    saveXp(next)
  }

  // ── Undo 스택에 퀘스트 변경 액션 푸시 ──
  const pushQuestNameUndo = useCallback((id: string, oldName: string, newName: string) => {
    pushUndo({
      actionType: 'UPDATE', id, table: 'quests', field: 'title', oldValue: oldName, newValue: newName,
      executeReverse: async () => {
        await updateQuestTitle(id, oldName)
        setUserQuests(prev => prev.map(q => q.id === id ? { ...q, name: oldName } : q))
        setNoteTarget(prev => prev?.id === id && prev?.table === 'quests' ? { ...prev, title: oldName } : prev ?? null)
      },
      executeForward: async () => {
        await updateQuestTitle(id, newName)
        setUserQuests(prev => prev.map(q => q.id === id ? { ...q, name: newName } : q))
        setNoteTarget(prev => prev?.id === id && prev?.table === 'quests' ? { ...prev, title: newName } : prev ?? null)
      },
    })
  }, [pushUndo])

  const pushQuestDeadlineUndo = useCallback((id: string, oldVal: string | null, newVal: string | null) => {
    pushUndo({
      actionType: 'UPDATE', id, table: 'quests', field: 'deadline', oldValue: oldVal, newValue: newVal,
      executeReverse: async () => {
        await updateQuestDeadline(id, oldVal)
        setUserQuests(prev => prev.map(q => q.id === id ? { ...q, deadline: oldVal ?? undefined } : q))
      },
      executeForward: async () => {
        await updateQuestDeadline(id, newVal)
        setUserQuests(prev => prev.map(q => q.id === id ? { ...q, deadline: newVal ?? undefined } : q))
      },
    })
  }, [pushUndo])

  // ── 퀘스트 완료 토글 (체크 ON: +XP, 체크 OFF: -XP) ──
  function toggleComplete(id: string) {
    setCompletedQuests(prev => {
      const isDone = prev.includes(id)
      const next = isDone ? prev.filter(x => x !== id) : [...prev, id]
      localStorage.setItem(COMPLETED_KEY, JSON.stringify(next))
      kvSet(COMPLETED_KEY, next)
      if (isDone) {
        let sub = XP_PER_QUEST
        const uLink = getQuestValueLink(id)
        if (uLink) {
          const va = loadValueActionStore().items.find(x => x.id === uLink && x.is_deleted !== true)
          if (va) {
            const { exp: est } = computeQuestRewardsFromValue(va)
            sub += Math.min(40, Math.max(0, Math.round(est / 25)))
          }
        }
        fireToast(`체크 해제 — -${sub} XP`)
        adjustXp(-sub)
      } else {
        const link = getQuestValueLink(id)
        let xpGain = XP_PER_QUEST
        if (link) {
          const va = loadValueActionStore().items.find(x => x.id === link && x.is_deleted !== true)
          if (va) {
            const { exp: est } = computeQuestRewardsFromValue(va)
            const bonus = Math.min(40, Math.max(0, Math.round(est / 25)))
            xpGain += bonus
          }
        }
        fireToast(`Quest Clear! ✓  +${xpGain} XP`)
        adjustXp(xpGain)
        {
          const q = userQuests.find(x => x.id === id)
          const userLevel = calculateLevel(xpState.totalXp).currentLevel
          if (q) {
            const mpCost = applyMpDrainForQuestComplete(q, userLevel)
            if (mpCost > 0) fireToast(`MP −${mpCost} (고난도·보스 부담)`)
          }
          const proj = q?.projectId ? projects.find(p => p.id === q.projectId) : null
          const area = proj ? areas.find(a => a.id === proj.area_id) : null
          const activeIdent = activeIdentityId ? identities.find(i => i.id === activeIdentityId) : null
          const r = applyQuestCompleteRpgRewards({
            areaName: area?.name,
            projectName: proj?.name,
            tags: q?.tags,
            identityId: activeIdentityId,
            identityName: activeIdent?.name,
          })
          if (r.skillBranch && r.skillXpAdded != null) {
            const br = SKILL_BRANCHES.find(b => b.id === r.skillBranch)
            fireToast(
              `스킬 XP +${r.skillXpAdded} (${br?.label ?? r.skillBranch})${r.skillLevelUp ? ' · 티어 상승!' : ''}`,
            )
          }
          if (r.skillArchetype != null && r.archetypeXpAdded != null) {
            const al = ARCHETYPE_LABEL[r.skillArchetype]
            fireToast(
              `원형 XP +${r.archetypeXpAdded} (${al.emoji} ${al.label})${r.archetypeLevelUp ? ' · 티어 상승!' : ''}`,
            )
          }
        }
      }
      return next
    })
  }

  // ── Area CRUD ──
  async function addArea() {
    const name = newAreaName.trim()
    if (!name) return
    const row = await insertArea(name)
    if (row) { setAreas(prev => [...prev, row]); setNewAreaName('') }
    else fireToast('Area 생성 실패')
  }

  async function commitEditArea(id: string) {
    const name = editingAreaName.trim()
    if (!name) { setEditingAreaId(null); return }
    await updateArea(id, name)
    setAreas(prev => prev.map(a => a.id === id ? { ...a, name } : a))
    setEditingAreaId(null)
  }

  function moveAreaUp(id: string) {
    const idx = areas.findIndex(a => a.id === id)
    if (idx <= 0) return
    const prev = areas[idx - 1]
    const curr = areas[idx]
    updateAreaSortOrder(prev.id, idx)
    updateAreaSortOrder(curr.id, idx - 1)
    setAreas(prevAreas => {
      const next = [...prevAreas]
      next[idx - 1] = curr
      next[idx] = prev
      return next
    })
  }
  function moveAreaDown(id: string) {
    const idx = areas.findIndex(a => a.id === id)
    if (idx < 0 || idx >= areas.length - 1) return
    const curr = areas[idx]
    const nextItem = areas[idx + 1]
    updateAreaSortOrder(curr.id, idx + 1)
    updateAreaSortOrder(nextItem.id, idx)
    setAreas(prevAreas => {
      const next = [...prevAreas]
      next[idx] = nextItem
      next[idx + 1] = curr
      return next
    })
  }
  async function removeArea(id: string) {
    await deleteArea(id)
    setAreas(prev => prev.filter(a => a.id !== id))
    setProjects(prev => prev.map(p => p.area_id === id ? { ...p, area_id: null } : p))
    if (newProjectAreaId === id) setNewProjectAreaId('')
    if (newQuestAreaId === id) { setNewQuestAreaId(''); setNewQuestProjectId('') }
  }

  // ── 프로젝트 CRUD ──
  async function addProject() {
    const name = newProjectName.trim()
    if (!name) return
    if (!newProjectAreaId) { fireToast('Vision Area를 먼저 선택해주세요!'); return }
    const areaId = newProjectAreaId  // 반드시 string — DB는 string→bigint 자동 변환
    const row = await insertProject(name, areaId)
    if (row) {
      setProjects(prev => [...prev, row])
      setNewProjectName('')
      setNewProjectAreaId('')
    } else {
      fireToast('프로젝트 생성 실패')
    }
  }

  /** Project 허브 모달용 — 이름을 인자로 바로 추가 */
  async function addAreaByName(name: string) {
    const n = name.trim()
    if (!n) return
    const row = await insertArea(n)
    if (row) { setAreas(prev => [...prev, row]); fireToast('Vision Area가 추가되었습니다') }
    else fireToast('Area 생성 실패')
  }
  async function addProjectByName(name: string, areaId: string) {
    const n = name.trim()
    if (!n) { fireToast('프로젝트 이름을 입력해주세요'); return null }
    if (!areaId) { fireToast('Vision Area를 선택해주세요'); return null }
    const row = await insertProject(n, areaId)
    if (row) {
      setProjects(prev => [...prev, row])
      fireToast('프로젝트가 추가되었습니다')
      return row
    }
    fireToast('프로젝트 생성 실패')
    return null
  }

  async function commitEditProject(id: string) {
    const name = editingProjectName.trim()
    if (!name) { setEditingProjectId(null); return }
    await updateProject(id, name)
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p))
    setEditingProjectId(null)
  }

  function moveProjectUp(id: string) {
    const idx = projects.findIndex(p => p.id === id)
    if (idx <= 0) return
    const prev = projects[idx - 1]
    const curr = projects[idx]
    updateProjectSortOrder(prev.id, idx)
    updateProjectSortOrder(curr.id, idx - 1)
    setProjects(prevProj => {
      const next = [...prevProj]
      next[idx - 1] = curr
      next[idx] = prev
      return next
    })
  }
  function moveProjectDown(id: string) {
    const idx = projects.findIndex(p => p.id === id)
    if (idx < 0 || idx >= projects.length - 1) return
    const curr = projects[idx]
    const nextItem = projects[idx + 1]
    updateProjectSortOrder(curr.id, idx + 1)
    updateProjectSortOrder(nextItem.id, idx)
    setProjects(prevProj => {
      const next = [...prevProj]
      next[idx] = nextItem
      next[idx + 1] = curr
      return next
    })
  }
  async function removeProject(id: string) {
    await deleteProject(id)
    setProjects(prev => prev.filter(p => p.id !== id))
    setUserQuests(prev => prev.map(q => q.projectId === id ? { ...q, projectId: null } : q))
    if (newQuestProjectId === id) { setNewQuestProjectId(''); setNewQuestAreaId('') }
  }

  // ── 사용자 퀘스트 추가 ──
  function handleSelectFocusQuest(id: string) {
    setFocusQuestId(prev => prev === id ? null : id)
  }

  // ── 포모도로 시간 누적 저장 (Quest → Project → Area 3단 캐스케이드) ──
  // 반환: 경과 초 (daily_logs 업데이트용), 0이면 flush 미실행
  async function _flushPomodoroTime(overrideElapsed?: number): Promise<number> {
    if (pomodoroStartRef.current === null || !focusQuestId) return 0
    const elapsed = overrideElapsed ?? Math.floor((Date.now() - pomodoroStartRef.current) / 1000)
    pomodoroStartRef.current = null
    if (elapsed < 5) return 0

    const questId = focusQuestId
    const projectId = focusQuestProjectIdRef.current
    const areaId = focusQuestAreaIdRef.current

    // 1) Quest time 업데이트
    setUserQuests(prev => prev.map(q =>
      q.id === questId ? { ...q, timeSpentSec: (q.timeSpentSec ?? 0) + elapsed } : q
    ))
    await addQuestTimeSpent(questId, elapsed)

    // 2) 부모 Project time 업데이트
    if (projectId) {
      setProjects(prev => prev.map(p =>
        p.id === projectId ? { ...p, time_spent_sec: (p.time_spent_sec ?? 0) + elapsed } : p
      ))
      await addProjectTimeSpent(projectId, elapsed)
    }

    // 3) 조부모 Area time 업데이트
    if (areaId) {
      setAreas(prev => prev.map(a =>
        a.id === areaId ? { ...a, time_spent_sec: (a.time_spent_sec ?? 0) + elapsed } : a
      ))
      await addAreaTimeSpent(areaId, elapsed)
    }
    return elapsed
  }

  async function insertQuestRow(
    title: string,
    projectId: string,
    opts?: {
      category?: CatId
      identityId?: string | null
      tags?: string[]
      linkValueId?: string | null
    },
  ): Promise<string | null> {
    const t = title.trim()
    if (!t || !_sbClient) return null
    const cat = opts?.category ?? newQuestCat
    const payload: Record<string, unknown> = { title: t, category: cat, is_completed: false }
    if (projectId) payload.project_id = projectId
    const iden = opts?.identityId !== undefined ? opts.identityId : newQuestIdentityId
    if (iden) payload.identity_id = iden
    const tags = opts?.tags ?? []
    if (tags.length) payload.tags = tags
    const { data, error } = await _sbClient
      .from('quests')
      .insert(payload)
      .select()
      .single()
    if (error) {
      fireToast(`퀘스트 추가 실패: ${error.message}`)
      return null
    }
    if (!data) return null
    const qid = String(data.id)
    const catOpt = CAT_OPTS.find(c => c.id === cat) ?? CAT_OPTS[0]
    const newCard: Card = {
      id: qid,
      name: t,
      sub: cat,
      emoji: catOpt.emoji,
      projectId: String(projectId),
      identityId: iden || null,
      tags: [...tags],
      pomodoroCount: 0,
    }
    setUserQuests(prev => [...prev, newCard])
    const vLink = opts?.linkValueId
    if (vLink) {
      setQuestValueLink(qid, vLink)
      const va = loadValueActionStore().items.find(x => x.id === vLink && x.is_deleted !== true) as ValueAction | undefined
      if (va) {
        const { exp, coins } = computeQuestRewardsFromValue(va)
        fireToast(`행동 자산 연결됨 · 예상 EXP ${exp} · 보상 코인 ${coins}`)
      }
    }
    return qid
  }

  async function addUserQuest() {
    const title = newQuestTitle.trim()
    if (!title || !_sbClient) return
    if (!newQuestAreaId) { fireToast('Vision Area를 먼저 선택해주세요!'); return }
    if (!newQuestProjectId) { fireToast('Real Projects를 먼저 선택해주세요!'); return }
    setAddingQuest(true)
    const linkId = newQuestValueActionId || null
    const qid = await insertQuestRow(title, newQuestProjectId, {
      tags: [...newQuestTags],
      identityId: newQuestIdentityId || null,
      linkValueId: linkId,
    })
    setAddingQuest(false)
    if (qid) {
      setNewQuestTitle('')
      setNewQuestProjectId('')
      setNewQuestIdentityId('')
      setNewQuestTags([])
      setNewQuestValueActionId('')
    }
  }

  const MICRO_VICTORY_XP = 6

  function completeMicroVictory(overrideLabel?: string) {
    const label = (overrideLabel ?? microVictoryLabel).trim()
    if (!label) {
      fireToast('2분 미만 행동을 한 줄로 적어 주세요.')
      return
    }
    adjustXp(MICRO_VICTORY_XP)
    applyMicroVictoryRpg()
    setMicroVictoryFx(true)
    window.setTimeout(() => setMicroVictoryFx(false), 1600)
    fireToast(`Lv.0 빅토리 ✓ "${label}" · SP↑ · +${MICRO_VICTORY_XP} XP`)
    if (!overrideLabel) setMicroVictoryLabel('')
  }

  /** 월드 맵 퀵슬롯 → 몰입 모달 */
  function openBattleFocusFromMap(questId: string) {
    setFocusLoot({ status: 'idle' })
    setFocusQuestId(questId)
    setFocusOpen(true)
    window.setTimeout(() => handleReset(), 0)
  }

  function runMapTwoMinuteBoot() {
    completeMicroVictory('노트북 열기')
  }

  async function commitTacticalDrill(titles: string[]) {
    const parent = drillQuest
    if (!parent?.projectId) {
      fireToast('부모 퀘스트에 프로젝트가 연결되어 있어야 합니다.')
      return
    }
    const pid = String(parent.projectId)
    const tagBase = parent.name.slice(0, 28)
    for (const t of titles) {
      await insertQuestRow(t, pid, {
        tags: ['WBS', tagBase],
        identityId: parent.identityId ?? null,
      })
    }
    fireToast('AI 쪼개기: 하위 퀘스트 5개를 추가했습니다.')
    setDrillQuest(null)
  }

  // ── 사용자 퀘스트 삭제 ──
  async function removeUserQuest(questId: string) {
    setUserQuests(prev => prev.filter(q => q.id !== questId))
    setCompletedQuests(prev => {
      const next = prev.filter(id => id !== questId)
      localStorage.setItem(COMPLETED_KEY, JSON.stringify(next))
      return next
    })
    try {
      await softDeleteUserQuestRow(questId)
    } catch {
      fireToast('삭제 실패 — 목록을 새로고침합니다')
      fetchUserCreatedQuests().then(rows => {
        setUserQuests(rows.map(r => ({
          id: String(r.id), name: r.title, sub: r.category, emoji: CAT_OPTS.find(c => c.id === r.category)?.emoji ?? '✅',
          projectId: r.project_id ?? null, identityId: r.identity_id ?? null,
          status: r.status ?? 'someday', tags: r.tags ?? [],
          priority: r.priority, deadline: r.deadline, timeSpentSec: r.time_spent_sec,
        })))
      })
    }
  }

  // ── 스탯 업데이트 ──
  function updateStat(id: string, value: string, memo: string) {
    setStats(prev => {
      const next = prev.map(s => s.id === id ? { ...s, value, memo } : s)
      persistStats(next)
      return next
    })
  }

  // ESC → 젠모드 탈출
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && isZenMode) exitZen() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isZenMode])

  // 타이머 엔진: 0초 도달 시 overtime 모드로 전환(자동 완료 X), overtime 시 카운트업
  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => {
        if (isOvertimeRef.current) {
          setOvertimeSec(prev => prev + 1)
        } else {
          setTimerSec(s => {
            if (s <= 1) {
              isOvertimeRef.current = true
              setIsOvertime(true)
              setOvertimeSec(0)
              return 0
            }
            return s - 1
          })
        }
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [timerRunning])

  // ── 타이머 시간 조절 (분/초 단위, 준비됨 상태에서만) ─────────────────────
  function adjustTime(deltaSec: number) {
    const newTotal = Math.max(0, Math.min(90 * 60, timerTotal + deltaSec))
    setTimerTotal(newTotal)
    setTimerSec(newTotal)
  }
  function setTo25Min() {
    const sec = 25 * 60
    setTimerTotal(sec)
    setTimerSec(sec)
  }

  function handlePlayPause() {
    if (timerDone) return
    if (!timerRunning) {
      if (!activeIdentityId) {
        fireToast('먼저 태세를 선택해주세요. Identity 메뉴에서 정체성을 선택하세요.')
        return
      }
      pomodoroSessionProcessedRef.current = false
      pomodoroStartRef.current = Date.now()
    } else {
      // 일시정지: 남은 시간 저장 (Resume용), 도장 X
      if (focusQuestId && !timerDone) {
        const toSave = isOvertime ? 0 : timerSec
        updateQuestRemainingTime(focusQuestId, toSave)
        setUserQuests(prev => prev.map(q => q.id === focusQuestId ? { ...q, remainingTimeSec: toSave } : q))
      }
    }
    setTimerRunning(r => !r)
  }

  function handleReset() {
    setTimerRunning(false)
    setTimerSec(timerTotal)
    setTimerDone(false)
    setIsOvertime(false)
    setOvertimeSec(0)
    isOvertimeRef.current = false
    pomodoroSessionProcessedRef.current = false
  }

  /** 모달 닫기: 남은 시간 저장 후 닫기 (도장 X, time_spent 누적 X) */
  function handleCloseModal() {
    if (focusQuestId && !timerDone) {
      const toSave = isOvertime ? 0 : timerSec
      updateQuestRemainingTime(focusQuestId, toSave)
      setUserQuests(prev => prev.map(q => q.id === focusQuestId ? { ...q, remainingTimeSec: toSave } : q))
    }
    setFocusLoot({ status: 'idle' })
    setFocusOpen(false)
    handleReset()
  }

  /** 완료 버튼 클릭 시에만 실행: 시간 누적 + 도장 +1 + 태세 XP 적립 */
  async function handleComplete() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setTimerRunning(false)
    setTimerDone(true)
    if (pomodoroSessionProcessedRef.current) return
    pomodoroSessionProcessedRef.current = true
    if (battleFocusUi) setFocusLoot({ status: 'loading' })
    const elapsed = isOvertime ? timerTotal + overtimeSec : timerTotal - timerSec
    const elapsedClamped = Math.max(0, elapsed)
    const today = new Date().toISOString().split('T')[0]
    const flushed = await _flushPomodoroTime(elapsedClamped)
    const timeToLog = flushed > 0 ? flushed : elapsedClamped
    if (timeToLog > 0) {
      await upsertDailyLog(today, 1, timeToLog)
      const row = await fetchDailyLog(today)
      if (row) {
        setDailyLog({ total_pomodoros: row.total_pomodoros, total_time_sec: row.total_time_sec, time_score_applied: row.time_score_applied })
        await syncTimeScoreToXp(today)
      }
    }
    if (focusQuestId) {
      await updateQuestRemainingTime(focusQuestId, 0)
      incrementQuestPomodoroCount(focusQuestId)
      setUserQuests(prev => prev.map(q => q.id === focusQuestId ? { ...q, remainingTimeSec: 0, pomodoroCount: (q.pomodoroCount ?? 0) + 1 } : q))
    }

    let identityLabel =
      identities.find(i => String(i.id) === String(activeIdentityId))?.name?.trim() ?? '선택한 태세'

    const pushFocusLootReady = (p: {
      xpGain: number
      coins: number
      identityName: string
      error?: string
    }) => {
      if (!battleFocusUi) return
      setFocusLoot({
        status: 'ready',
        xpGain: p.xpGain,
        coins: p.coins,
        identityName: p.identityName,
        message: buildLootEncouragement(p.identityName, p.xpGain),
        error: p.error,
      })
    }

    if (elapsedClamped > 0) {
      applyFocusSessionMpRecovery(elapsedClamped)
      const qMeta = focusQuestId ? userQuests.find(q => q.id === focusQuestId) : null
      const nowComplete = new Date()
      const startTimeLocal = `${String(nowComplete.getHours()).padStart(2, '0')}:${String(nowComplete.getMinutes()).padStart(2, '0')}`

      const linkId = focusQuestId ? getQuestValueLink(focusQuestId) : undefined
      let coins = Math.max(1, Math.round(elapsedClamped / 90))
      if (linkId) {
        const va = valueActionList.find(v => v.id === linkId)
        if (va) coins = computeQuestRewardsFromValue(va).coins
      }

      const result = await addFocusSession(elapsedClamped, {
        questId: focusQuestId ?? undefined,
        questTitle: qMeta?.name,
      })
      if ('xpGain' in result) {
        identityLabel = result.identityName?.trim() || identityLabel
        if (battleFocusUi) {
          pushFocusLootReady({ xpGain: result.xpGain, coins, identityName: identityLabel })
        } else {
          fireToast(`축하합니다! ${result.xpGain} XP를 획득했습니다. (${result.identityName} 태세)`)
        }
        fetchIdentities().then(rows => setIdentities(rows))
        appendPomodoroLog({
          date: today,
          startTimeLocal,
          minutes: Math.max(1, Math.floor(elapsedClamped / 60)),
          seconds: elapsedClamped,
          questId: focusQuestId ?? null,
          questTitle: qMeta?.name ?? null,
          identityName: result.identityName,
          xpGain: result.xpGain,
          source: 'session',
          remoteId: result.focusLogId,
        })
      } else {
        if (battleFocusUi) {
          pushFocusLootReady({ xpGain: 0, coins, identityName: identityLabel, error: result.error || 'XP 적립에 실패했습니다.' })
        } else {
          fireToast(result.error || 'XP 적립에 실패했습니다.')
        }
        appendPomodoroLog({
          date: today,
          startTimeLocal,
          minutes: Math.max(1, Math.floor(elapsedClamped / 60)),
          seconds: elapsedClamped,
          questId: focusQuestId ?? null,
          questTitle: qMeta?.name ?? null,
          source: 'session',
        })
      }
    } else if (battleFocusUi) {
      pushFocusLootReady({ xpGain: 0, coins: 0, identityName: identityLabel })
    }

    recordFocusSession(Math.round(timerTotal / 60))
    setIsOvertime(false)
    setOvertimeSec(0)
    isOvertimeRef.current = false
    setCalendarRefreshKey(k => k + 1)
  }

  function handleExtend() {
    const extendSec = 300
    pomodoroSessionProcessedRef.current = false
    pomodoroStartRef.current = Date.now()
    setFocusLoot({ status: 'idle' })
    setTimerDone(false)
    setIsOvertime(false)
    setOvertimeSec(0)
    isOvertimeRef.current = false
    setTimerTotal(extendSec)
    setTimerSec(extendSec)
    setTimerRunning(true)
  }

  function enterZen() {
    if (focusQuestId && !timerDone) {
      const toSave = isOvertime ? 0 : timerSec
      updateQuestRemainingTime(focusQuestId, toSave)
      setUserQuests(prev => prev.map(q => q.id === focusQuestId ? { ...q, remainingTimeSec: toSave } : q))
    }
    setIsZenMode(true)
    setFocusOpen(false)
  }

  function exitZen() {
    if (focusQuestId && !timerDone) {
      const toSave = isOvertime ? 0 : timerSec
      updateQuestRemainingTime(focusQuestId, toSave)
      setUserQuests(prev => prev.map(q => q.id === focusQuestId ? { ...q, remainingTimeSec: toSave } : q))
    }
    setIsZenMode(false)
    setTimerRunning(false)
  }

  function toggleProject(id: string) {
    setSelectedProjects(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const projectLabels = selectedProjects.map(id => userQuests.find(q => q.id === id)?.name ?? id)
  const questLabels = selectedQuests.map(id => userQuests.find(q => q.id === id)?.name ?? id)
  const navNow = new Date()
  const today = navNow.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  const todayISOWeek = getISOWeekNumber(navNow)

  const [seoulWx, setSeoulWx] = useState<{ temp: number; emoji: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    const tick = () => {
      fetchSeoulWeatherNow()
        .then(w => {
          if (cancelled || !w) return
          setSeoulWx({ temp: w.tempC, emoji: wmoCodeToEmoji(w.code) })
        })
        .catch(() => {
          if (!cancelled) setSeoulWx(null)
        })
    }
    tick()
    const id = window.setInterval(tick, 15 * 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  // ── Auth 게이트 ──
  if (session === 'loading') {
    return (
      <>
        <style>{`
          @keyframes authLoadBar {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(350%); }
          }
        `}</style>
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
          backgroundColor: '#0a0e14',
          backgroundImage: `linear-gradient(180deg, rgba(6, 10, 18, 0.45) 0%, rgba(6, 8, 16, 0.72) 55%, rgba(4, 6, 12, 0.82) 100%), url(${LOGIN_BG_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}>
          <div style={{
            width: 'min(220px, 70vw)', height: '2px',
            background: 'rgba(0,0,0,0.45)',
            border: '1px solid rgba(212, 175, 120, 0.2)',
            borderRadius: '1px',
            overflow: 'hidden',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, width: '40%', height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(226, 214, 180, 0.75), transparent)',
              animation: 'authLoadBar 1.1s ease-in-out infinite',
            }} />
          </div>
        </div>
      </>
    )
  }
  if (!session) {
    return <LoginView onLogin={s => setSession(s)} />
  }

  return (
    <>
      <style>{`
      @keyframes statFlash {
        0%   { opacity: 1; transform: scale(1); }
        20%  { opacity: 0.7; transform: scale(1.03); }
        50%  { opacity: 1; transform: scale(1.015); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes lvParticle {
        0%   { transform: translateY(0) scale(1); opacity: 1; }
        100% { transform: translateY(-105vh) scale(0.2); opacity: 0; }
      }
      @keyframes lvBounce {
        0%   { transform: scale(0.6); opacity: 0; }
        60%  { transform: scale(1.08); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes slideInRight {
        0%   { transform: translateX(100%); opacity: 0; }
        100% { transform: translateX(0);    opacity: 1; }
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
      @keyframes fadeIn {
        0%   { opacity: 0; }
        100% { opacity: 1; }
      }
    `}</style>
      <div style={{ backgroundColor: '#F4F4F2', minHeight: '100vh', color: '#37352F', fontFamily: 'system-ui,-apple-system,sans-serif' }}>

        {/* ── Toast ── */}
        <Toast msg={toastMsg} visible={toastVisible} />

        {morningPresenceOpen && (
          <CharacterStatusView
            identities={identities}
            activeIdentityId={activeIdentityId}
            onSelectIdentity={async id => {
              const ok = await updateActiveIdentity(id)
              if (ok) setActiveIdentityId(id)
            }}
            onClose={() => setMorningPresenceOpen(false)}
          />
        )}

        {workspaceArchiveKind != null && (
          <WorkspaceDataArchiveModal
            open
            onClose={() => setWorkspaceArchiveKind(null)}
            kind={workspaceArchiveKind}
            areas={areas}
            projects={projects}
            quests={userQuests}
            identities={identities}
            completedQuestIds={completedQuests}
          />
        )}

        {/* ── 레벨업 연출 ── */}
        {levelUpAnim && (
          <LevelUpScreen level={levelUpNewLv} onDone={() => setLevelUpAnim(false)} />
        )}

        {/* ── 젠 모드 전체화면 ── */}
        {/* ── 노트 상세 패널 ── */}
        {noteTarget && (
          <NoteModal
            target={noteTarget}
            onClose={() => {
              const wasJournal = noteTarget?.table === 'journals' || noteTarget?.table === 'calendar_journal'
              setNoteTarget(null)
              if (wasJournal && location.pathname === '/review') {
                navigate('/review', { replace: true })
              }
              if (wasJournal && location.pathname === '/life') {
                navigate('/life?tab=journal', { replace: true })
              }
            }}
            onUpdateQuestPomodoroCount={async (questId, newCount) => {
              await updateQuestPomodoroCount(questId, newCount)
              setUserQuests(prev => prev.map(q => q.id === questId ? { ...q, pomodoroCount: newCount } : q))
              if (noteTarget?.table === 'quests' && noteTarget.id === questId) {
                setNoteTarget(prev => prev ? { ...prev, meta: { ...prev.meta, pomodoroCount: newCount } } : null)
              }
            }}
            onUpdateTimeSpent={async (id, table, sec) => {
              if (table === 'areas') {
                await setAreaTimeSpent(id, sec)
                setAreas(prev => prev.map(a => a.id === id ? { ...a, time_spent_sec: sec } : a))
              } else if (table === 'projects') {
                await setProjectTimeSpent(id, sec)
                setProjects(prev => prev.map(p => p.id === id ? { ...p, time_spent_sec: sec } : p))
              } else if (table === 'quests') {
                await setQuestTimeSpent(id, sec)
                setUserQuests(prev => prev.map(q => q.id === id ? { ...q, timeSpentSec: sec } : q))
              }
              if (noteTarget?.table === table && noteTarget.id === id) {
                setNoteTarget(prev => prev ? { ...prev, meta: { ...prev.meta, timeSpentSec: sec } } : null)
              }
            }}
            onUpdateQuestTitle={noteTarget?.table === 'quests' ? async (id, newTitle) => {
              const oldTitle = userQuests.find(q => q.id === id)?.name ?? noteTarget?.title ?? ''
              const { success } = await updateQuestTitle(id, newTitle)
              if (success) {
                setUserQuests(prev => prev.map(q => q.id === id ? { ...q, name: newTitle } : q))
                setNoteTarget(prev => prev ? { ...prev, title: newTitle } : null)
                pushQuestNameUndo(id, oldTitle, newTitle)
              }
            } : undefined}
          />
        )}

        {isZenMode && (
          <ZenView
            seconds={timerSec} totalSec={timerTotal}
            running={timerRunning} finished={timerDone}
            isOvertime={isOvertime} overtimeSec={overtimeSec}
            focusQuestName={userQuests.find(q => q.id === focusQuestId)?.name ?? null}
            onPlayPause={handlePlayPause} onStop={exitZen}
            onComplete={handleComplete}
            onExtend={handleExtend}
          />
        )}

        {/* ── 포모도로 모달 (전투 UI 또는 클래식) ── */}
        {focusOpen && !isZenMode && (
          battleFocusUi ? (
            <BattleFocusMode
              open={focusOpen}
              quests={userQuests}
              areas={areas}
              projects={projects}
              focusQuestId={focusQuestId}
              onSelectQuest={handleSelectFocusQuest}
              seconds={timerSec}
              totalSec={timerTotal}
              running={timerRunning}
              finished={timerDone}
              isOvertime={isOvertime}
              overtimeSec={overtimeSec}
              onPlayPause={handlePlayPause}
              onReset={handleReset}
              onAdjust={adjustTime}
              onSetDefault={setTo25Min}
              onComplete={handleComplete}
              onExtend={handleExtend}
              onClose={handleCloseModal}
              onEnterZen={enterZen}
              activeIdentityId={activeIdentityId}
              linkedValueAction={focusLinkedValueAction}
              focusLoot={focusLoot}
              onTabBlurWarning={() => fireToast('다른 탭으로 전환했습니다. 집중이 흐트러질 수 있습니다.')}
              identities={identities}
              fireToast={fireToast}
              onSelectIdentity={async (id) => {
                const ok = await updateActiveIdentity(id)
                if (ok) setActiveIdentityId(id)
              }}
            />
          ) : (
            <PomodoroModal
              seconds={timerSec} totalSec={timerTotal}
              running={timerRunning} finished={timerDone}
              isOvertime={isOvertime} overtimeSec={overtimeSec}
              quests={userQuests}
              areas={areas}
              projects={projects}
              focusQuestId={focusQuestId}
              onSelectQuest={handleSelectFocusQuest}
              onPlayPause={handlePlayPause}
              onReset={handleReset}
              onAdjust={adjustTime}
              onSetDefault={setTo25Min}
              onClose={handleCloseModal}
              onEnterZen={enterZen}
              onComplete={handleComplete}
              onExtend={handleExtend}
            />
          )
        )}

        {sanctuaryOpen && (
          <SanctuaryView
            onClose={() => setSanctuaryOpen(false)}
            quests={userQuests.map(q => ({ id: q.id, name: q.name, identityId: q.identityId ?? null }))}
            completedQuestIds={completedQuests}
            activeIdentityId={activeIdentityId}
            identities={identities}
            projects={projects}
            adjustXp={adjustXp}
            fireToast={fireToast}
          />
        )}

        {/* ════════════════ NAV ════════════════ */}
        <nav style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid rgba(0,0,0,0.06)', position: 'sticky', top: 0, zIndex: 100, display: isMobile ? 'none' : undefined }}>
          <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 12px 0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '52px', gap: '8px' }}>

            {/* 좌측: 브랜딩+메일만 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, minWidth: 0 }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IcoPen />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: '12px', color: '#37352F', lineHeight: 1.2 }}>창작 OS</p>
                <p style={{ margin: '3px 0 0', fontSize: '9px', color: '#9B9A97', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={session?.user?.email ?? ''}>
                  {session?.user?.email ?? ''}
                </p>
              </div>
            </div>

            {/* 중앙: GNB — Board~Note 단일 행(스크롤 없음, 링크는 가용 폭에 맞춰 균등 분배) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flex: 1,
                minWidth: 0,
                flexWrap: 'nowrap',
                gap: 0,
                overflow: 'hidden',
              }}
            >
              {GNB_ROW_ITEMS.map((item, idx) => {
                if (item.kind === 'sep') {
                  return (
                    <span
                      key={`gnb-sep-${idx}`}
                      aria-hidden
                      style={{
                        width: '1px',
                        height: '18px',
                        backgroundColor: 'rgba(0,0,0,0.08)',
                        flexShrink: 0,
                        margin: '0 2px',
                      }}
                    />
                  )
                }
                const to = item.to ?? `/${item.id}`
                return (
                  <Link
                    key={item.id}
                    to={to}
                    title={item.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '3px',
                      padding: '6px 3px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: 'none',
                      fontSize: '10.5px',
                      fontWeight: activePage === item.id ? 700 : 500,
                      color: activePage === item.id ? '#4F46E5' : '#787774',
                      backgroundColor: activePage === item.id ? 'rgba(99,102,241,0.1)' : 'transparent',
                      transition: 'all 0.15s',
                      textDecoration: 'none',
                      flex: '1 1 0',
                      minWidth: 0,
                      maxWidth: '100%',
                    }}
                  >
                    <span style={{ fontSize: '12px', lineHeight: 1, flexShrink: 0 }}>{item.emoji}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                  </Link>
                )
              })}
            </div>

            {/* 우측: 젠모드 · 날짜·날씨·만세력 · 동기화(로그아웃 옆) · 로그아웃 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {timerRunning && (
                <button type="button" onClick={() => setIsZenMode(true)} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700,
                  color: '#4F46E5', backgroundColor: 'rgba(99,102,241,0.1)',
                  border: '1px solid rgba(99,102,241,0.28)', padding: '5px 14px', borderRadius: '999px', cursor: 'pointer',
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6366f1', display: 'inline-block' }} />
                  집중 중 · 젠모드 복귀
                </button>
              )}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: '2px',
                  minWidth: 0,
                  maxWidth: '320px',
                  marginLeft: '12px',
                }}
              >
                <p style={{ margin: 0, fontSize: '11px', color: '#37352F', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>{today}</p>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    width: '100%',
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '10px',
                      color: '#787774',
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                    title={seoulWx ? `실시간 기온 · 서울 (Open-Meteo)` : '날씨 불러오는 중'}
                  >
                    {seoulWx ? (
                      <>
                        <span aria-hidden style={{ fontSize: '9px', lineHeight: 1 }}>{seoulWx.emoji}</span>
                        <span style={{ fontWeight: 700, color: '#5c6b8a' }}>{seoulWx.temp}°</span>
                      </>
                    ) : (
                      <span style={{ opacity: 0.45 }}>날씨 …</span>
                    )}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      color: '#787774',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      textAlign: 'right',
                      minWidth: 0,
                    }}
                    title="ISO 주차 · 만세력(월·일 기둥)"
                  >
                    {todayISOWeek}주차 {formatTodayGanzhiLine(navNow)}
                  </span>
                </div>
              </div>
              <span
                aria-hidden
                style={{
                  width: '1px',
                  height: '32px',
                  alignSelf: 'center',
                  backgroundColor: 'rgba(0,0,0,0.06)',
                  flexShrink: 0,
                  marginLeft: '8px',
                  marginRight: '0',
                }}
              />
              {isSupabaseReady && !forceRecoverHidden && (
                <button
                  type="button"
                  onClick={() => void handleForceRecoverLocalToKv()}
                  disabled={kvRecovering}
                  title="localStorage의 creative_os_* · creative-os-* 키를 Supabase app_kv로 일괄 업로드 (임시)"
                  style={{
                    padding: '5px 10px',
                    borderRadius: '8px',
                    border: '1px solid #b91c1c',
                    backgroundColor: '#dc2626',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 800,
                    cursor: kvRecovering ? 'wait' : 'pointer',
                    flexShrink: 0,
                    opacity: kvRecovering ? 0.88 : 1,
                  }}
                >
                  {kvRecovering ? '업로드 중…' : '데이터 강제 복구'}
                </button>
              )}
              <button
                type="button"
                onClick={async () => { await signOut(); setSession(null) }}
                title="로그아웃"
                style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: 'transparent', color: '#9B9A97', fontSize: '11px', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#f87171'; e.currentTarget.style.color = '#f87171' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#EBEBEA'; e.currentTarget.style.color = '#9B9A97' }}
              >로그아웃</button>
            </div>
          </div>
        </nav>

        {isSupabaseReady && syncError != null && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              position: 'fixed',
              bottom: isMobile ? 84 : 20,
              right: 16,
              zIndex: 9999,
              maxWidth: Math.min(360, typeof window !== 'undefined' ? window.innerWidth - 32 : 360),
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: 10,
              backgroundColor: '#fff',
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              border: '1px solid rgba(239,68,68,0.35)',
            }}
          >
            <span
              aria-hidden
              style={{
                width: '8px',
                height: '8px',
                marginTop: '4px',
                flexShrink: 0,
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                boxShadow: '0 0 0 2px rgba(239,68,68,0.25)',
              }}
            />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#991b1b', lineHeight: 1.45 }}>
              {syncError}
            </span>
            <button
              type="button"
              aria-label="동기화 오류 알림 닫기"
              onClick={() => setSyncError(null)}
              style={{
                flexShrink: 0,
                margin: '-4px -4px -4px 0',
                padding: '4px 8px',
                border: 'none',
                borderRadius: 6,
                background: 'transparent',
                color: '#9B9A97',
                fontSize: '16px',
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* ════════════════ MOBILE BOTTOM NAV ════════════════ */}
        {isMobile && isSupabaseReady && !forceRecoverHidden && (
          <button
            type="button"
            onClick={() => void handleForceRecoverLocalToKv()}
            disabled={kvRecovering}
            title="creative_os_* · creative-os-* → app_kv 일괄 업로드 (임시)"
            style={{
              position: 'fixed',
              top: 10,
              right: 10,
              zIndex: 120,
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid #b91c1c',
              backgroundColor: '#dc2626',
              color: '#fff',
              fontSize: 11,
              fontWeight: 800,
              cursor: kvRecovering ? 'wait' : 'pointer',
              boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
              opacity: kvRecovering ? 0.88 : 1,
            }}
          >
            {kvRecovering ? '업로드 중…' : '데이터 강제 복구'}
          </button>
        )}

        {isMobile && <MobileBottomNav active={activePage} />}

        {/* ════════════════ BODY ════════════════ */}
        <div style={{ paddingBottom: isMobile ? '70px' : 0 }}>
          {activePage === 'life' && (
            <BeautifulLifeSection
              onOpenNote={(id, title, meta) => setNoteTarget({ table: meta?.source === 'calendar' ? 'calendar_journal' : 'journals', id, title })}
              onJournalChange={() => setCalendarRefreshKey(k => k + 1)}
            />
          )}
          {activePage === 'tracker' && <TrackerPage />}
          {activePage === 'goals' && <GoalsPage />}
          {activePage === 'evolution' && <EvolutionPage />}
          {activePage === 'fortune' && (
            <>
              <FortunePage onReadingSaved={() => setCalendarRefreshKey(k => k + 1)} />
              <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 44px 48px' }}>
                <SajuBigeupSection />
              </div>
            </>
          )}
          {activePage === 'manifestation' && <ManifestationPage />}
          {activePage === 'act' && (
            <PossessionPage
              identities={identities}
              activeIdentityId={activeIdentityId}
              onRefresh={() => fetchIdentities().then(rows => setIdentities(rows))}
              onRefreshActive={() => fetchActiveIdentity().then(id => setActiveIdentityId(id))}
              onToast={fireToast}
              onOptimisticIdentityPatch={(id, name, role_model) => {
                setIdentities(prev => prev.map(r => r.id === id ? { ...r, name, role_model } : r))
              }}
            />
          )}
          {activePage === 'master-board' && (() => {
            const lv = calculateLevel(xpState.totalXp)
            return (
              <MasterBoardPage
                xpTotal={xpState.totalXp}
                currentLevel={lv.currentLevel}
                levelTitle={getLevelTitle(lv.currentLevel)}
                currentLevelXp={lv.currentLevelXp}
                maxCurrentLevelXp={lv.maxCurrentLevelXp}
                levelProgressPct={lv.progressPct}
                dailyPomodoros={dailyLog?.total_pomodoros ?? 0}
                dailyFocusSec={dailyLog?.total_time_sec ?? 0}
                dailyTimeScore={dailyLog?.time_score_applied}
                identities={identities}
                activeIdentityId={activeIdentityId}
                openQuestCount={userQuests.filter(q => q.status !== 'done').length}
                userQuests={userQuests}
                calendarRefreshKey={calendarRefreshKey}
              />
            )
          })()}
          {activePage === 'manual' && <ManualPage />}
          {activePage === 'levelup' && (() => {
            const lv = calculateLevel(xpState.totalXp)
            return (
              <LevelupRpgPage
                appStats={stats.map(s => ({ id: s.id, label: s.label, value: s.value, unit: s.unit, emoji: s.emoji, col: s.col }))}
                currentLevel={lv.currentLevel}
                levelTitle={getLevelTitle(lv.currentLevel)}
                currentLevelXp={lv.currentLevelXp}
                maxCurrentLevelXp={lv.maxCurrentLevelXp}
                totalXp={xpState.totalXp}
                progressPct={lv.progressPct}
                activeIdentityName={activeIdentityId ? (identities.find(i => i.id === activeIdentityId)?.name ?? null) : null}
              />
            )
          })()}
          {activePage === 'growth' && <GrowthPage />}
          {activePage === 'raid' && (
            <BossRaidPage
              projects={projects}
              quests={userQuests}
              completedQuestIds={completedQuests}
              onStrikeQuest={id => toggleComplete(id)}
            />
          )}
          {activePage === 'account' && <AccountLedgerPage />}
          {activePage === 'fragment' && <FragmentPage />}
          {activePage === 'trash' && <TrashPage />}
          {activePage === 'travel' && <TravelPage onToast={fireToast} />}
          {activePage === 'project' && (
            <ProjectHubPage
              areas={areas}
              projects={projects}
              userQuests={userQuests}
              isMobile={isMobile}
              newAreaName={newAreaName}
              setNewAreaName={setNewAreaName}
              addArea={addArea}
              editingAreaId={editingAreaId}
              setEditingAreaId={setEditingAreaId}
              editingAreaName={editingAreaName}
              setEditingAreaName={setEditingAreaName}
              commitEditArea={commitEditArea}
              removeArea={removeArea}
              moveAreaUp={moveAreaUp}
              moveAreaDown={moveAreaDown}
              newProjectName={newProjectName}
              setNewProjectName={setNewProjectName}
              newProjectAreaId={newProjectAreaId}
              setNewProjectAreaId={setNewProjectAreaId}
              addProject={addProject}
              editingProjectId={editingProjectId}
              setEditingProjectId={setEditingProjectId}
              editingProjectName={editingProjectName}
              setEditingProjectName={setEditingProjectName}
              commitEditProject={commitEditProject}
              removeProject={removeProject}
              renameProject={async (id, name) => {
                const t = name.trim()
                if (!t) return
                await updateProject(id, t)
                setProjects(prev => prev.map(p => p.id === id ? { ...p, name: t } : p))
              }}
              moveProjectUp={moveProjectUp}
              moveProjectDown={moveProjectDown}
              setNoteTarget={setNoteTarget}
              onToast={fireToast}
              addAreaByName={addAreaByName}
              addProjectByName={addProjectByName}
              identities={identities}
              completedQuestIds={completedQuests}
            />
          )}
          {activePage === 'review' && (
            <ReviewPage
              completedQuests={completedQuests}
              xpState={xpState}
              userQuests={userQuests}
              onJournalChange={() => setCalendarRefreshKey(k => k + 1)}
            />
          )}
          {activePage === 'quantum' && (
            <QuantumFlowPage onSaved={() => setCalendarRefreshKey(k => k + 1)} />
          )}
          {activePage === 'value' && <ValuePage />}
          {activePage === 'network' && <NetworkPage />}
          {activePage === 'inner-world' && (
            <LifeWorldHub adjustXp={adjustXp} fireToast={fireToast} />
          )}
          {activePage === 'chronicle' && (
            <ChronicleAnalyticsPage
              userQuests={userQuests}
              projects={projects}
              completedQuestIds={completedQuests}
            />
          )}
          {activePage === 'quest' && (
            <div style={{ maxWidth: '1800px', margin: '0 auto', padding: isMobile ? '16px 14px 24px' : '36px 48px' }}>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  marginBottom: 18,
                }}
                role="tablist"
                aria-label="Quest 하위 메뉴"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={questView === 'board'}
                  onClick={() => {
                    setSearchParams(prev => {
                      const n = new URLSearchParams(prev)
                      n.set('questView', 'board')
                      return n
                    }, { replace: true })
                  }}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 12,
                    border: questView === 'board' ? '2px solid #6366f1' : '1px solid rgba(0,0,0,0.08)',
                    background: questView === 'board' ? 'rgba(99,102,241,0.1)' : '#FFFFFF',
                    color: questView === 'board' ? '#4F46E5' : '#787774',
                    fontSize: 13,
                    fontWeight: questView === 'board' ? 800 : 600,
                    cursor: 'pointer',
                  }}
                >
                  퀘스트 보드
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={questView === 'map'}
                  onClick={() => {
                    setSearchParams(prev => {
                      const n = new URLSearchParams(prev)
                      n.set('questView', 'map')
                      return n
                    }, { replace: true })
                  }}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 12,
                    border: questView === 'map' ? '2px solid #0ea5e9' : '1px solid rgba(0,0,0,0.08)',
                    background: questView === 'map' ? 'rgba(14,165,233,0.12)' : '#FFFFFF',
                    color: questView === 'map' ? '#0369a1' : '#787774',
                    fontSize: 13,
                    fontWeight: questView === 'map' ? 800 : 600,
                    cursor: 'pointer',
                  }}
                >
                  월드 맵
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={questView === 'journal'}
                  onClick={() => {
                    setSearchParams(prev => {
                      const n = new URLSearchParams(prev)
                      n.set('questView', 'journal')
                      return n
                    }, { replace: true })
                  }}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 12,
                    border: questView === 'journal' ? '2px solid #7C3AED' : '1px solid rgba(0,0,0,0.08)',
                    background: questView === 'journal' ? 'rgba(124,58,237,0.1)' : '#FFFFFF',
                    color: questView === 'journal' ? '#6d28d9' : '#787774',
                    fontSize: 13,
                    fontWeight: questView === 'journal' ? 800 : 600,
                    cursor: 'pointer',
                  }}
                >
                  모험일지
                </button>
              </div>
              <div style={{ display: 'flex', gap: isMobile ? 0 : 20, alignItems: 'flex-start', width: '100%' }}>
                <div style={{ flex: 1, minWidth: 0 }}>

            {questView === 'journal' ? (
              <QuestAdventureJournal />
            ) : (
            <>
            {/* ── 현재 태세 (우디르) — Quest 상단 */}
            <div style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid rgba(0,0,0,0.06)',
              borderRadius: '16px',
              padding: '16px 20px',
              marginBottom: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: '24px' }}>🎭</span>
              <div>
                {activeIdentityId ? (
                  (() => {
                    const active = identities.find(i => i.id === activeIdentityId)
                    return active ? (
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#37352F' }}>
                        현재 <strong style={{ color: '#7C3AED' }}>[우디르]</strong> 작가님은 <strong style={{ color: '#6366f1' }}>'{active.name}'</strong> 태세입니다.
                      </p>
                    ) : (
                      <p style={{ margin: 0, fontSize: '14px', color: '#9B9A97' }}>태세를 선택해주세요</p>
                    )
                  })()
                ) : (
                  <p style={{ margin: 0, fontSize: '14px', color: '#9B9A97' }}>태세를 선택해주세요 — Act 메뉴에서 정체성을 선택하세요</p>
                )}
              </div>
              {activeIdentityId && identities.find(i => i.id === activeIdentityId) ? (
                <button onClick={async () => { const ok = await updateActiveIdentity(null); if (ok) setActiveIdentityId(null) }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.06)', color: '#ef4444', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>태세 종료</button>
              ) : (
                <button onClick={() => setActivePage('act')} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #7C3AED', backgroundColor: 'rgba(124,58,237,0.08)', color: '#7C3AED', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>태세 선택하기</button>
              )}
            </div>

            {/* Area · Real Projects — 접기 (기본 접힘, 퀘스트가 첫 화면 중심) */}
            <div style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid rgba(0,0,0,0.06)',
              borderRadius: '16px',
              marginBottom: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}>
              <button
                type="button"
                onClick={() => setQuestAreaProjectExpanded(v => !v)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '14px 18px',
                  border: 'none',
                  background: questAreaProjectExpanded ? 'rgba(99,102,241,0.05)' : '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#37352F', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>🌐</span> Area · <span>📁</span> Real Projects
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#9B9A97' }}>
                    ({areas.length}개 영역 · {projects.length}개 프로젝트)
                  </span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6366f1', fontWeight: 700, flexShrink: 0 }}>
                  {questAreaProjectExpanded ? '접기' : '펼치기'}
                  {questAreaProjectExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </span>
              </button>
              {questAreaProjectExpanded && (
                <div style={{ padding: '0 18px 18px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 2fr)',
                    gap: '16px',
                    paddingTop: '16px',
                    alignItems: 'start',
                  }}>
                    <div style={{ backgroundColor: '#F9F9F8', borderRadius: '12px', padding: '16px', minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#37352F' }}>
                          <span style={{ marginRight: '6px' }}>🌐</span>Area
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <WorkspaceArchiveTrigger title="Vision Area 데이터 보관함 — 전체 목록" onClick={() => setWorkspaceArchiveKind('area')} />
                          <span style={{ fontSize: '10px', color: '#9B9A97' }}>{areas.length}개</span>
                        </div>
                      </div>
                      {areas.length === 0 ? (
                        <p style={{ fontSize: '12px', color: '#AEAAA4', margin: '0 0 14px', textAlign: 'center', padding: '12px 0' }}>아직 Vision Area 없음</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '14px' }}>
                          {areas.map(a => (
                            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', borderRadius: '8px', backgroundColor: '#F4F4F2', border: '1px solid rgba(0,0,0,0.04)' }}>
                              {editingAreaId === a.id ? (
                                <>
                                  <input autoFocus value={editingAreaName}
                                    onChange={e => setEditingAreaName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') commitEditArea(a.id); if (e.key === 'Escape') setEditingAreaId(null) }}
                                    onBlur={() => commitEditArea(a.id)}
                                    style={{ flex: 1, backgroundColor: '#FFFFFF', border: '1px solid #6366f1', borderRadius: '6px', padding: '3px 6px', fontSize: '12px', color: '#37352F', outline: 'none' }}
                                  />
                                  <button onClick={() => setEditingAreaId(null)} style={{ padding: '2px 6px', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.08)', backgroundColor: 'transparent', color: '#9B9A97', fontSize: '10px', cursor: 'pointer' }}>취소</button>
                                </>
                              ) : (
                                <>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <span
                                      onClick={() => setNoteTarget({ table: 'areas', id: a.id, title: a.name, meta: { timeSpentSec: a.time_spent_sec } })}
                                      style={{ fontSize: '12px', color: '#37352F', fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(0,0,0,0.15)' }}
                                      title="클릭하여 노트 열기"
                                    >{a.name}</span>
                                    {fmtHM(a.time_spent_sec) && (
                                      <span style={{ fontSize: '10px', color: '#0369A1', fontWeight: 600 }}>⏱ {fmtHM(a.time_spent_sec)}</span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                    <button onClick={() => moveAreaUp(a.id)} disabled={areas.indexOf(a) === 0} style={{ padding: '2px 4px', border: 'none', backgroundColor: 'transparent', color: '#9B9A97', cursor: areas.indexOf(a) === 0 ? 'default' : 'pointer', opacity: areas.indexOf(a) === 0 ? 0.4 : 1 }} title="위로"><ChevronUp size={14} /></button>
                                    <button onClick={() => moveAreaDown(a.id)} disabled={areas.indexOf(a) === areas.length - 1} style={{ padding: '2px 4px', border: 'none', backgroundColor: 'transparent', color: '#9B9A97', cursor: areas.indexOf(a) === areas.length - 1 ? 'default' : 'pointer', opacity: areas.indexOf(a) === areas.length - 1 ? 0.4 : 1 }} title="아래로"><ChevronDown size={14} /></button>
                                  </div>
                                  <button onClick={() => { setEditingAreaId(a.id); setEditingAreaName(a.name) }}
                                    style={{ padding: '2px 6px', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: 'transparent', color: '#787774', fontSize: '10px', cursor: 'pointer' }} title="수정">✏️</button>
                                  <button onClick={() => removeArea(a.id)}
                                    style={{ padding: '2px 6px', borderRadius: '5px', border: '1px solid rgba(248,113,113,0.2)', backgroundColor: 'transparent', color: '#f87171', fontSize: '10px', cursor: 'pointer' }}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.1)')}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                    title="삭제">삭제</button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input value={newAreaName} onChange={e => setNewAreaName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addArea() }}
                          placeholder="새 Vision Area 이름"
                          style={{ flex: 1, padding: '7px 10px', borderRadius: '7px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#F1F1EF', color: '#37352F', fontSize: '12px', outline: 'none' }}
                          onFocus={e => (e.target.style.borderColor = '#0369A1')}
                          onBlur={e => (e.target.style.borderColor = 'rgba(0,0,0,0.06)')}
                        />
                        <button onClick={addArea} disabled={!newAreaName.trim()}
                          style={{ padding: '7px 12px', borderRadius: '7px', border: 'none', backgroundColor: newAreaName.trim() ? '#0369A1' : '#EBEBEA', color: newAreaName.trim() ? '#fff' : '#787774', fontSize: '12px', fontWeight: 700, cursor: newAreaName.trim() ? 'pointer' : 'default', transition: 'background 0.15s' }}
                        >+</button>
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#F9F9F8', borderRadius: '12px', padding: '16px', minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#37352F' }}>
                          <span style={{ marginRight: '6px' }}>📁</span>Real Projects
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <WorkspaceArchiveTrigger title="프로젝트 데이터 보관함 — 전체 목록" onClick={() => setWorkspaceArchiveKind('project')} />
                          <span style={{ fontSize: '10px', color: '#9B9A97' }}>{projects.length}개</span>
                        </div>
                      </div>
                      {projects.length === 0 ? (
                        <p style={{ fontSize: '12px', color: '#AEAAA4', margin: '0 0 14px', textAlign: 'center', padding: '12px 0' }}>아직 프로젝트 없음</p>
                      ) : (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(232px, 1fr))',
                            gap: '8px',
                            marginBottom: '14px',
                            alignContent: 'start',
                          }}
                        >
                          {projects.map(p => {
                            const parentArea = p.area_id ? areas.find(a => a.id === p.area_id) : null
                            return (
                              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', borderRadius: '8px', backgroundColor: '#F4F4F2', border: '1px solid rgba(0,0,0,0.04)', minWidth: 0 }}>
                                {editingProjectId === p.id ? (
                                  <>
                                    <input autoFocus value={editingProjectName}
                                      onChange={e => setEditingProjectName(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter') commitEditProject(p.id); if (e.key === 'Escape') setEditingProjectId(null) }}
                                      onBlur={() => commitEditProject(p.id)}
                                      style={{ flex: 1, backgroundColor: '#FFFFFF', border: '1px solid #6366f1', borderRadius: '6px', padding: '3px 6px', fontSize: '12px', color: '#37352F', outline: 'none' }}
                                    />
                                    <button onClick={() => setEditingProjectId(null)} style={{ padding: '2px 6px', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.08)', backgroundColor: 'transparent', color: '#9B9A97', fontSize: '10px', cursor: 'pointer' }}>취소</button>
                                  </>
                                ) : (
                                  <>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <span
                                        onClick={() => setNoteTarget({ table: 'projects', id: p.id, title: p.name, meta: { timeSpentSec: p.time_spent_sec, areaName: areas.find(a => String(a.id) === String(p.area_id))?.name } })}
                                        style={{ fontSize: '12px', color: '#37352F', fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(0,0,0,0.15)' }}
                                        title="클릭하여 노트 열기"
                                      >{p.name}</span>
                                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '1px' }}>
                                        {parentArea && <span style={{ fontSize: '9px', color: '#0369A1', backgroundColor: '#E0F2FE', padding: '1px 5px', borderRadius: '999px' }}>{parentArea.name}</span>}
                                        {fmtHM(p.time_spent_sec) && <span style={{ fontSize: '9px', color: '#6366f1', fontWeight: 600 }}>⏱ {fmtHM(p.time_spent_sec)}</span>}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                      <button onClick={() => moveProjectUp(p.id)} disabled={projects.indexOf(p) === 0} style={{ padding: '2px 4px', border: 'none', backgroundColor: 'transparent', color: '#9B9A97', cursor: projects.indexOf(p) === 0 ? 'default' : 'pointer', opacity: projects.indexOf(p) === 0 ? 0.4 : 1 }} title="위로"><ChevronUp size={14} /></button>
                                      <button onClick={() => moveProjectDown(p.id)} disabled={projects.indexOf(p) === projects.length - 1} style={{ padding: '2px 4px', border: 'none', backgroundColor: 'transparent', color: '#9B9A97', cursor: projects.indexOf(p) === projects.length - 1 ? 'default' : 'pointer', opacity: projects.indexOf(p) === projects.length - 1 ? 0.4 : 1 }} title="아래로"><ChevronDown size={14} /></button>
                                    </div>
                                    <button onClick={() => { setEditingProjectId(p.id); setEditingProjectName(p.name) }}
                                      style={{ padding: '2px 6px', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: 'transparent', color: '#787774', fontSize: '10px', cursor: 'pointer' }} title="수정">✏️</button>
                                    <button onClick={() => removeProject(p.id)}
                                      style={{ padding: '2px 6px', borderRadius: '5px', border: '1px solid rgba(248,113,113,0.2)', backgroundColor: 'transparent', color: '#f87171', fontSize: '10px', cursor: 'pointer' }}
                                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.1)')}
                                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                      title="삭제">삭제</button>
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <select value={newProjectAreaId} onChange={e => setNewProjectAreaId(e.target.value)}
                          style={{ padding: '7px 10px', borderRadius: '7px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#F1F1EF', color: newProjectAreaId ? '#37352F' : '#9B9A97', fontSize: '12px', outline: 'none' }}>
                          <option value="">{areas.length === 0 ? 'Vision Area를 먼저 생성해주세요' : 'Vision Area 선택 (필수)'}</option>
                          {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') addProject() }}
                            placeholder="새 프로젝트 이름"
                            style={{ flex: 1, padding: '7px 10px', borderRadius: '7px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#F1F1EF', color: '#37352F', fontSize: '12px', outline: 'none' }}
                            onFocus={e => (e.target.style.borderColor = '#6366f1')}
                            onBlur={e => (e.target.style.borderColor = 'rgba(0,0,0,0.06)')}
                          />
                          <button onClick={addProject} disabled={!newProjectName.trim() || !newProjectAreaId}
                            style={{ padding: '7px 12px', borderRadius: '7px', border: 'none', backgroundColor: (newProjectName.trim() && newProjectAreaId) ? '#6366f1' : '#EBEBEA', color: (newProjectName.trim() && newProjectAreaId) ? '#fff' : '#787774', fontSize: '12px', fontWeight: 700, cursor: (newProjectName.trim() && newProjectAreaId) ? 'pointer' : 'default', transition: 'background 0.15s' }}
                          >+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── 오늘의 핵심 퀘스트 (메인) ── */}
            <div style={{
              backgroundColor: '#FFFFFF',
              border: '2px solid rgba(99,102,241,0.38)',
              borderRadius: '18px',
              padding: isMobile ? '18px 14px' : '28px 32px',
              marginBottom: '24px',
              boxShadow: '0 8px 36px rgba(99,102,241,0.14), 0 1px 3px rgba(0,0,0,0.06)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: '#6366f1', letterSpacing: '0.12em', textTransform: 'uppercase' }}>오늘의 핵심</p>
                  <h2 style={{ margin: 0, fontSize: isMobile ? '22px' : '26px', fontWeight: 800, color: '#37352F', lineHeight: 1.15 }}>
                    {questView === 'map' ? '월드 맵' : '퀘스트'}
                  </h2>
                  <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#787774', maxWidth: '520px' }}>
                    {questView === 'map'
                      ? 'Vision·프로젝트가 거점으로 배치됩니다. 거점을 눌러 퀘스트 인벤토리를 열고 몰입을 무장하세요.'
                      : '이 화면의 중심입니다. 목록을 채우고 하나씩 완료해 나가세요.'}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <WorkspaceArchiveTrigger title="퀘스트 데이터 보관함 — 전체 목록" onClick={() => setWorkspaceArchiveKind('quest')} />
                  {selectedQuests.length > 0 && (
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#7C3AED', backgroundColor: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', padding: '4px 12px', borderRadius: '999px' }}>
                      {selectedQuests.length}개 선택
                    </span>
                  )}
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', backgroundColor: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', padding: '4px 12px', borderRadius: '999px' }}>
                    {completedQuests.filter(id => userQuests.some(q => q.id === id)).length} / {userQuests.length} 완료
                  </span>
                </div>
              </div>
              {questView === 'board' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  marginBottom: 12,
                  padding: '8px 12px',
                  borderRadius: 12,
                  border: '1px dashed rgba(99,102,241,0.35)',
                  background: 'rgba(99,102,241,0.04)',
                }}
              >
                <Zap size={14} style={{ color: '#7c3aed', flexShrink: 0 }} aria-hidden />
                <span style={{ fontSize: 11, fontWeight: 800, color: '#5b21b6' }}>Lv.0 · 2분 실험</span>
                <input
                  value={microVictoryLabel}
                  onChange={e => setMicroVictoryLabel(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') completeMicroVictory()
                  }}
                  placeholder="예: 운동복 입기, 커서 켜기"
                  style={{
                    flex: 1,
                    minWidth: 140,
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.08)',
                    fontSize: 12,
                    background: '#fff',
                  }}
                />
                <button
                  type="button"
                  onClick={() => completeMicroVictory()}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'linear-gradient(135deg,#a78bfa,#6366f1)',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  완료
                </button>
                {microVictoryFx && (
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#34d399', animation: 'pulse 0.6s ease' }}>+SP · +EXP</span>
                )}
              </div>
              )}

              {questView === 'map' ? (
                <MapHub
                  areas={areas}
                  projects={projects}
                  quests={userQuests}
                  completedQuestIds={completedQuests}
                  identities={identities}
                  activeIdentityId={activeIdentityId}
                  onOpenNote={(id, title) => setNoteTarget({ table: 'quests', id, title, meta: undefined })}
                  onToggleQuestComplete={(id, done) => {
                    const isDone = completedQuests.includes(id)
                    if (done !== isDone) toggleComplete(id)
                  }}
                  onDeleteQuest={removeUserQuest}
                  onStartFocus={openBattleFocusFromMap}
                  onTwoMinuteBoot={runMapTwoMinuteBoot}
                  onMicroBoot={label => completeMicroVictory(label)}
                  fireToast={fireToast}
                  onSanctuary={() => setSanctuaryOpen(true)}
                  onOpenAchievementHall={() => navigate('/growth?tab=achievements')}
                />
              ) : (
              <QuestTable
                quests={userQuests}
                completed={completedQuests}
                activePomodoroId={focusQuestId}
                projects={projects}
                areas={areas}
                identities={identities}
                newTitle={newQuestTitle}
                onNewTitle={setNewQuestTitle}
                newCat={newQuestCat}
                onNewCat={v => setNewQuestCat(v as CatId)}
                newQuestAreaId={newQuestAreaId}
                onNewQuestAreaId={setNewQuestAreaId}
                newProjectId={newQuestProjectId}
                onNewProjectId={setNewQuestProjectId}
                newQuestIdentityId={newQuestIdentityId}
                onNewQuestIdentityId={setNewQuestIdentityId}
                newQuestTags={newQuestTags}
                onNewQuestTags={setNewQuestTags}
                valueActions={valueActionList}
                selectedValueActionId={newQuestValueActionId}
                onSelectValueAction={setNewQuestValueActionId}
                rewardPreview={questValueRewardPreview}
                adding={addingQuest}
                onAdd={addUserQuest}
                onToggleComplete={toggleComplete}
                onDelete={removeUserQuest}
                onSelectPomodoro={handleSelectFocusQuest}
                onOpenNote={(id, title, meta) => setNoteTarget({ table: 'quests', id, title, meta })}
                onQuestNameUpdate={(id, newName) => setUserQuests(prev => prev.map(q => q.id === id ? { ...q, name: newName } : q))}
                onQuestDeadlineUpdate={(id, deadline) => setUserQuests(prev => prev.map(q => q.id === id ? { ...q, deadline: deadline ?? undefined } : q))}
                onQuestStatusUpdate={(id, status) => { updateQuestStatus(id, status); setUserQuests(prev => prev.map(q => q.id === id ? { ...q, status } : q)) }}
                onQuestTagsUpdate={(id, tags) => { updateQuestTags(id, tags); setUserQuests(prev => prev.map(q => q.id === id ? { ...q, tags } : q)) }}
                onAiSplitQuest={q => setDrillQuest(q)}
                onMoveQuestUp={(id) => {
                  const idx = userQuests.findIndex(q => q.id === id)
                  if (idx <= 0) return
                  const prev = userQuests[idx - 1]
                  const curr = userQuests[idx]
                  updateQuestSortOrder(prev.id, idx)
                  updateQuestSortOrder(curr.id, idx - 1)
                  setUserQuests(prevQ => { const n = [...prevQ]; n[idx - 1] = curr; n[idx] = prev; return n })
                }}
                onMoveQuestDown={(id) => {
                  const idx = userQuests.findIndex(q => q.id === id)
                  if (idx < 0 || idx >= userQuests.length - 1) return
                  const curr = userQuests[idx]
                  const nextItem = userQuests[idx + 1]
                  updateQuestSortOrder(curr.id, idx + 1)
                  updateQuestSortOrder(nextItem.id, idx)
                  setUserQuests(prevQ => { const n = [...prevQ]; n[idx] = nextItem; n[idx + 1] = curr; return n })
                }}
                onPushQuestNameUndo={pushQuestNameUndo}
                onPushQuestDeadlineUndo={pushQuestDeadlineUndo}
                fireToast={fireToast}
              />
              )}
            </div>

            {/* Focus CTA — 퀘스트 바로 아래 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
              {selectedProjects.length === 0 && selectedQuests.length === 0 && (
                <p style={{ margin: 0, fontSize: '12px', color: '#AEAAA4' }}>
                  퀘스트를 선택하면 집중 세션이 활성화됩니다
                </p>
              )}
              <button
                onClick={() => { setFocusLoot({ status: 'idle' }); setFocusOpen(true); handleReset() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '17px 52px', borderRadius: '16px', border: 'none',
                  background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                  color: '#fff', fontSize: '15px', fontWeight: 700, letterSpacing: '0.03em', cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(99,102,241,0.2)',
                  transition: 'transform 0.15s,box-shadow 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 14px 60px rgba(99,102,241,0.54)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 48px rgba(99,102,241,0.38)' }}
              >
                <IcoFocus />
                몰입 시작 (Focus Mode)
              </button>
              <p style={{ margin: 0, fontSize: '11px', color: '#AEAAA4' }}>
                ▶ 재생 버튼 누르면 자동으로 젠 모드 진입 · ESC로 복귀
              </p>
              <button
                type="button"
                onClick={() => {
                  const next = !battleFocusUi
                  setBattleFocusUi(next)
                  try {
                    localStorage.setItem('battle_focus_ui_v1', next ? '1' : '0')
                  } catch {
                    /* ignore */
                  }
                }}
                style={{
                  margin: 0,
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  fontSize: '11px',
                  color: '#9B9A97',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                {battleFocusUi ? '클래식 타이머 UI로 전환' : '전투(보스) UI로 전환'}
              </button>
            </div>

            {/* ── 스스로에게 줄 보상함 (Level Rewards) ── */}
            <div style={{
              backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)',
              borderRadius: '16px', padding: '20px 24px', marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Gift size={20} color="#7C3AED" />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#37352F' }}>스스로에게 줄 보상함</h3>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <input
                  type="number"
                  placeholder="목표 레벨"
                  value={newRewardLevel}
                  onChange={e => setNewRewardLevel(e.target.value)}
                  min={1}
                  max={MAX_LEVEL}
                  style={{ width: '100px', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '13px' }}
                />
                <input
                  type="text"
                  placeholder="보상 내용"
                  value={newRewardText}
                  onChange={e => setNewRewardText(e.target.value)}
                  style={{ flex: 1, minWidth: '140px', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '13px' }}
                />
                <button
                  onClick={async () => {
                    const lv = parseInt(newRewardLevel, 10)
                    if (!newRewardText.trim() || Number.isNaN(lv) || lv < 1 || lv > MAX_LEVEL) return
                    const row = await insertLevelReward(lv, newRewardText.trim())
                    if (row) {
                      setLevelRewards(prev => [...prev, row])
                      setNewRewardLevel('')
                      setNewRewardText('')
                    }
                  }}
                  style={{
                    padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#7C3AED', color: '#fff',
                    fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  }}
                >추가</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {levelRewards.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '12px', color: '#AEAAA4', fontStyle: 'italic' }}>아직 보상이 없습니다. 목표 레벨과 보상을 추가해 보세요!</p>
                ) : (
                  levelRewards.map(r => {
                    const currentLevel = calculateLevel(xpState.totalXp).currentLevel
                    const canClaim = currentLevel >= r.target_level && !r.is_claimed
                    return (
                      <div
                        key={r.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
                          borderRadius: '10px', backgroundColor: r.is_claimed ? 'rgba(52,211,153,0.08)' : canClaim ? 'rgba(124,58,237,0.06)' : '#F4F4F2',
                          border: `1px solid ${r.is_claimed ? 'rgba(52,211,153,0.3)' : canClaim ? 'rgba(124,58,237,0.2)' : 'rgba(0,0,0,0.04)'}`,
                        }}
                      >
                        {canClaim ? (
                          <button
                            onClick={async () => {
                              await claimLevelReward(r.id)
                              setLevelRewards(prev => prev.map(x => x.id === r.id ? { ...x, is_claimed: true } : x))
                            }}
                            style={{
                              width: '24px', height: '24px', padding: 0, borderRadius: '6px', border: '1px solid rgba(99,102,241,0.4)',
                              backgroundColor: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            title="Claim"
                          >
                            <CheckCircle2 size={16} color="#6366f1" />
                          </button>
                        ) : currentLevel < r.target_level ? (
                          <span style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#AEAAA4' }} title={`Lv.${r.target_level} 도달 시`}>
                            <Lock size={16} />
                          </span>
                        ) : (
                          <span style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
                            <CheckCircle2 size={18} strokeWidth={2.5} />
                          </span>
                        )}
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#6366f1', minWidth: '52px' }}>Lv.{r.target_level}</span>
                        <span style={{ flex: 1, fontSize: '13px', color: r.is_claimed ? '#787774' : '#37352F', textDecoration: r.is_claimed ? 'line-through' : 'none' }}>{r.reward_text}</span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* 오늘 누적 포모도로 · 누적 작업 시간 */}
            <div style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid rgba(0,0,0,0.06)',
              borderRadius: '16px',
              padding: '20px 24px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 700, color: '#6366f1', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                오늘 누적 포모도로 · 누적 작업 시간
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{
                    height: '12px',
                    borderRadius: '999px',
                    backgroundColor: '#EBEBEA',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, ((dailyLog?.total_pomodoros ?? 0) / 10) * 100)}%`,
                      borderRadius: '999px',
                      background: 'linear-gradient(90deg, #818cf8 0%, #6366f1 50%, #4f46e5 100%)',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#9B9A97' }}>
                    목표 10회 중 {(dailyLog?.total_pomodoros ?? 0)}회 (포모도로)
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '20px', flexShrink: 0, alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '10px', color: '#9B9A97', marginBottom: '6px' }}>오늘 누적 포모도로</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {(dailyLog?.total_pomodoros ?? 0) > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                          {Array.from({ length: dailyLog!.total_pomodoros }, (_, i) => (
                            <span key={i} style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }} title="완료한 몰입 세션">
                              <Timer size={18} strokeWidth={2.5} />
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: '12px', color: '#AEAAA4', fontStyle: 'italic' }}>오늘의 첫 몰입 도장을 찍어보세요!</p>
                      )}
                      <span style={{ display: 'flex', gap: '2px', marginLeft: '4px' }}>
                        <button
                          onClick={async () => {
                            const today = new Date().toISOString().split('T')[0]
                            const cur = dailyLog?.total_pomodoros ?? 0
                            if (cur <= 0) return
                            setDailyLog(prev => prev ? { ...prev, total_pomodoros: Math.max(0, cur - 1) } : { total_pomodoros: 0, total_time_sec: 0 })
                            const res = await updateDailyLogPomodoros(today, -1)
                            if (res) setDailyLog(prev => prev ? { ...prev, total_pomodoros: res.total_pomodoros, total_time_sec: res.total_time_sec } : null)
                          }}
                          style={{
                            width: '24px', height: '24px', padding: 0, borderRadius: '6px',
                            border: '1px solid rgba(0,0,0,0.1)', background: '#FFFFFF',
                            color: (dailyLog?.total_pomodoros ?? 0) <= 0 ? '#AEAAA4' : '#6366f1',
                            fontSize: '12px', fontWeight: 700, cursor: (dailyLog?.total_pomodoros ?? 0) <= 0 ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                          disabled={(dailyLog?.total_pomodoros ?? 0) <= 0}
                        >−</button>
                        <button
                          onClick={async () => {
                            const today = new Date().toISOString().split('T')[0]
                            const cur = dailyLog?.total_pomodoros ?? 0
                            setDailyLog(prev => prev ? { ...prev, total_pomodoros: cur + 1 } : { total_pomodoros: 1, total_time_sec: 0 })
                            const res = await updateDailyLogPomodoros(today, 1)
                            if (res) setDailyLog(prev => prev ? { ...prev, total_pomodoros: res.total_pomodoros, total_time_sec: res.total_time_sec } : null)
                          }}
                          style={{
                            width: '24px', height: '24px', padding: 0, borderRadius: '6px',
                            border: '1px solid rgba(0,0,0,0.1)', background: '#FFFFFF',
                            color: '#6366f1', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >+</button>
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '10px', color: '#9B9A97', marginBottom: '6px' }}>누적 작업 시간</p>
                    <p style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <EditableTimeMinutes
                        totalSec={dailyLog?.total_time_sec ?? 0}
                        displayOverride={dailyLog ? fmtDailyTime(dailyLog.total_time_sec) : '0분'}
                        onSave={async sec => {
                          const today = new Date().toISOString().split('T')[0]
                          const res = await setDailyLogTime(today, sec)
                          const pom = res?.total_pomodoros ?? dailyLog?.total_pomodoros ?? 0
                          setDailyLog(prev => prev ? { ...prev, total_time_sec: sec } : { total_pomodoros: pom, total_time_sec: sec })
                          syncTimeScoreToXp(today)
                        }}
                      />
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#9B9A97' }}>분 단위로 수정 (집중·작업 누적)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* XP 게이지 바 */}
            <XpBar
              currentLevelXp={calculateLevel(xpState.totalXp).currentLevelXp}
              maxCurrentLevelXp={calculateLevel(xpState.totalXp).maxCurrentLevelXp}
              totalXp={xpState.totalXp}
              doneCount={completedQuests.filter(id => userQuests.some(q => q.id === id)).length}
              totalCount={userQuests.length}
              onEditCurrentLevelXp={handleEditCurrentLevelXp}
              onEditTotalXp={handleEditTotalXp}
            />
            </>
            )}

                </div>
                {!isMobile && (
                  <aside
                    style={{
                      width: 300,
                      flexShrink: 0,
                      position: 'sticky',
                      top: 56,
                      alignSelf: 'flex-start',
                      maxHeight: 'calc(100vh - 72px)',
                      overflowY: 'auto',
                      paddingBottom: 24,
                    }}
                  >
                    <ValueReferencePanel quests={userQuests.map(q => ({ id: q.id, name: q.name }))} />
                  </aside>
                )}
              </div>
              <ValueReferenceMobileFab quests={userQuests.map(q => ({ id: q.id, name: q.name }))} />
              <QuestTacticalDrillModal
                open={!!drillQuest}
                quest={drillQuest ? { id: drillQuest.id, name: drillQuest.name } : null}
                onClose={() => setDrillQuest(null)}
                onCommit={titles => void commitTacticalDrill(titles)}
              />
            </div>
          )}
        </div>{/* end body wrapper */}
      </div>
    </>
  )
}
