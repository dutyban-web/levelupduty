import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { kvSet, kvGet, kvGetAll, isSupabaseReady, subscribeKv } from './lib/supabase'
import {
  supabase as _sbClient,
  fetchUserStats, upsertUserStats,
  fetchAllJournals, syncJournals,
  fetchUserCreatedQuests,
  updateQuestTitle, updateQuestDeadline, updateQuestIdentity, updateQuestStatus, updateQuestTags, updateQuestSortOrder,
  deleteUserQuestRow, addQuestTimeSpent, updateQuestRemainingTime, incrementQuestPomodoroCount,
  fetchDailyLog, upsertDailyLog, upsertDailyLogFortune, updateDailyLogPomodoros, updateQuestPomodoroCount, setDailyLogTime, updateDailyLogTimeScore,
  fetchLevelRewards, insertLevelReward, claimLevelReward,
  setAreaTimeSpent, setProjectTimeSpent, setQuestTimeSpent,
  signIn, signOut, getSession, onAuthStateChange,
  fetchJournalCategories, insertJournalCategory,
  updateJournalCategory, deleteJournalCategory,
  fetchJournalNotes, fetchJournalDates,
  insertJournalNote, updateJournalNote, deleteJournalNote,
  fetchProjects, insertProject, updateProject, deleteProject, addProjectTimeSpent,
  fetchAreas, insertArea, updateArea, deleteArea, addAreaTimeSpent, updateAreaSortOrder, updateProjectSortOrder,
  fetchIdentities, insertIdentity, updateIdentity, deleteIdentity, addIdentityTimeAndXp,
  type IdentityRow,
  fetchFortuneDecks, fetchFortuneCards, insertFortuneDeck, updateFortuneDeck, deleteFortuneDeck,
  type FortuneDeckRow, type FortuneCardRow,
  insertReadingLog, fetchReadingLogs, fetchReadingLogsInRange, deleteReadingLog, updateReadingLog, type ReadingLogRow, type DrawnCardItem,
  fetchDailyLogsInRange,
  fetchNoteContent, saveNoteContent, uploadImageToMedia,
  type Session,
  type JournalCategoryRow, type JournalNoteRow, type ProjectRow, type AreaRow,
} from './supabase'
import { loadStatus, recordFocusSession } from './utils/storage'
import { useUndoRedo } from './contexts/UndoRedoContext'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import {
  Trophy, BarChart3, BookOpen, Archive, CalendarDays,
  CheckCircle2, PenLine,
  Scroll, Sparkles, Plus, X,   ChevronRight, ChevronLeft, ChevronUp, ChevronDown,
  Utensils, Apple, Heart, Timer, Pencil, Lock, Gift, Trash2, MoreVertical, Image, CalendarRange, Move, Settings,
} from 'lucide-react'
import { Solar } from 'lunar-javascript'

// ═══════════════════════════════════════ RESPONSIVE ═══════════════════════════
type PageId = 'identity' | 'dashboard' | 'worlds' | 'journal' | 'library' | 'calendar' | 'travel' | 'fortune'

function useIsMobile(): boolean {
  const [mob, setMob] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  useEffect(() => {
    const fn = () => setMob(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mob
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

// ═══════════════════════════════════════ RICH EDITOR (WYSIWYG, Notion-style) ═══════════
import '@blocknote/core/fonts/inter.css'
import { useCreateBlockNote, useEditorChange } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/ariakit'
import '@blocknote/ariakit/style.css'
import type { PartialBlock } from '@blocknote/core'

function blockNoteToPlainPreview(value: string, maxLen = 80): string {
  if (!value?.trim()) return ''
  const t = value.trim()
  if (!t.startsWith('[')) return t.replace(/\n/g, ' ').slice(0, maxLen)
  try {
    const blocks = JSON.parse(t) as Array<{ content?: unknown; children?: unknown[] }>
    const texts: string[] = []
    const extract = (c: unknown) => {
      if (typeof c === 'string') texts.push(c)
      else if (c && typeof c === 'object' && 'text' in c && typeof (c as { text: string }).text === 'string') texts.push((c as { text: string }).text)
      else if (Array.isArray(c)) c.forEach(extract)
      else if (c && typeof c === 'object' && 'content' in c) extract((c as { content: unknown }).content)
    }
    blocks.forEach(b => { extract(b.content); (b.children || []).forEach(extract) })
    return texts.join(' ').replace(/\n/g, ' ').slice(0, maxLen) || ''
  } catch { return t.slice(0, maxLen) }
}

function parseToInitialBlocks(value: string): PartialBlock[] | undefined {
  if (!value || !value.trim()) return undefined
  const trimmed = value.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as PartialBlock[]
    } catch { /* fall through */ }
  }
  return [{ type: 'paragraph', content: trimmed }]
}

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

function RichEditor({ value, onChange, placeholder, minHeight = 400, readOnly, contentKey }: {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  minHeight?: number
  readOnly?: boolean
  contentKey?: string
}) {
  const [uploading, setUploading] = useState(false)
  const key = contentKey ?? value
  const initialBlocks = useMemo(() => parseToInitialBlocks(value), [key])

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    if (!IMAGE_MIMES.includes(file.type)) throw new Error('지원 형식: jpg, png, gif, webp')
    setUploading(true)
    try {
      const url = await uploadImageToMedia(file)
      return url
    } finally {
      setUploading(false)
    }
  }, [])

  const editor = useCreateBlockNote(
    { initialContent: initialBlocks, uploadFile: readOnly ? undefined : uploadFile },
    [key]
  )
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEditorChange(() => {
    if (!editor || readOnly) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      onChange(JSON.stringify(editor.document))
    }, 600)
  }, editor)

  useEffect(() => {
    if (!editor || readOnly || !value?.trim()) return
    if (value.trim().startsWith('[')) return
    const loadMarkdown = async () => {
      try {
        const parsed = await editor.tryParseMarkdownToBlocks(value)
        if (parsed.length > 0) editor.replaceBlocks(editor.document, parsed)
      } catch { /* keep paragraph fallback */ }
    }
    loadMarkdown()
  }, [key])

  const insertImageAtEnd = useCallback((url: string) => {
    if (!editor) return
    const blocks = editor.document
    const refBlock = blocks.length > 0 ? blocks[blocks.length - 1] : null
    if (refBlock) {
      editor.insertBlocks([{ type: 'image' as const, props: { url } }], refBlock.id, 'after')
    } else {
      editor.replaceBlocks(editor.document, [{ type: 'image' as const, props: { url } }])
    }
  }, [editor])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    if (readOnly || !editor) return
    const file = e.dataTransfer?.files?.[0]
    if (!file || !IMAGE_MIMES.includes(file.type)) return
    e.preventDefault()
    e.stopPropagation()
    setUploading(true)
    try {
      const url = await uploadImageToMedia(file)
      insertImageAtEnd(url)
    } catch (err) {
      console.error('[이미지 업로드 실패]', err)
    } finally {
      setUploading(false)
    }
  }, [editor, readOnly, insertImageAtEnd])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (readOnly) return
    if (e.dataTransfer?.types?.includes('Files')) e.preventDefault()
  }, [readOnly])

  if (!editor) return <div style={{ minHeight, color: '#9B9A97', fontSize: '14px' }}>불러오는 중…</div>

  return (
    <div
      className="bn-notion-editor"
      style={{ minHeight, position: 'relative' }}
      data-color-scheme="light"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {uploading && (
        <div style={{
          position: 'absolute', top: 8, right: 12, zIndex: 50,
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: '11px', color: '#6366f1', fontWeight: 600,
          padding: '4px 10px', borderRadius: 8, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
        }}>
          <span style={{ width: 12, height: 12, border: '2px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          업로드 중…
        </div>
      )}
      <BlockNoteView editor={editor} theme="light" editable={!readOnly} />
      <style>{`
        .bn-notion-editor .bn-editor { font-size: 18px !important; line-height: 1.75 !important; background: transparent !important; border: none !important; }
        .bn-notion-editor .bn-block-content, .bn-notion-editor [data-node-type="blockContainer"] { font-size: 18px !important; line-height: 1.75 !important; }
        .bn-notion-editor { --bn-colors-editor-background: transparent; --bn-colors-editor-text: #37352F; }
        .bn-notion-editor img { max-width: 100% !important; border-radius: 8px !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ── MobileBottomNav ───────────────────────────────────────────────────────────
function MobileBottomNav({ active, onNav }: { active: PageId; onNav: (p: PageId) => void }) {
  const ITEMS: { id: PageId; emoji: string; label: string }[] = [
    { id: 'identity',  emoji: '🎭',  label: 'Identity' },
    { id: 'dashboard', emoji: '⚡',  label: 'Home'     },
    { id: 'worlds',    emoji: '🌐',  label: 'Worlds'   },
    { id: 'journal',   emoji: '📓',  label: 'Journal' },
    { id: 'library',   emoji: '📚',  label: 'Library' },
    { id: 'calendar',  emoji: '📅',  label: 'Cal'     },
    { id: 'travel',    emoji: '✈️',  label: 'Travel'  },
    { id: 'fortune',   emoji: '🔮',  label: 'Fortune' },
  ]
  return (
    <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 500, display: 'flex', backgroundColor: 'rgba(255,255,255,0.95)', borderTop: '1px solid rgba(0,0,0,0.06)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {ITEMS.map(item => {
        const isActive = active === item.id
        return (
          <button key={item.id} onClick={() => onNav(item.id)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', padding: '10px 2px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', minHeight: '56px', position: 'relative', WebkitTapHighlightColor: 'transparent' }}
          >
            {isActive && <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '28px', height: '2.5px', borderRadius: '999px', backgroundColor: '#6366f1', boxShadow: '0 0 8px rgba(99,102,241,0.7)' }} />}
            <span style={{ fontSize: '18px', lineHeight: 1 }}>{item.emoji}</span>
            <span style={{ fontSize: '9px', fontWeight: isActive ? 800 : 500, color: isActive ? '#4F46E5' : '#787774', letterSpacing: '0.02em', marginTop: '1px' }}>{item.label}</span>
          </button>
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
const STATS_KEY      = 'creative_os_stats_v1'
const COMPLETED_KEY  = 'creative_os_completed_quests'
const XP_KEY         = 'creative_os_xp_v1'
const XP_PER_QUEST   = 20

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
  for (;;) {
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
  4: '신인 작가',  5: '중견 작가', 6: '베테랑 작가',
  7: '거장',        8: '전설의 작가', 9: '창작의 신',
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

// ── Journal ────────────────────────────────────────────────────────────────────
const JOURNAL_KEY = 'creative_os_journal_v1'

type AchievementBlock = {
  questId: string; questName: string; emoji: string
  categoryLabel: string; categoryColor: string; xp: number
}
type JournalEntry = {
  date: string          // YYYY-MM-DD
  content: string
  questsDone: string[]  // quest IDs completed that day
  xpSnapshot: number    // total XP gained that day
  savedAt: string       // ISO timestamp
  blocks?: AchievementBlock[]
}
type JournalStore = Record<string, JournalEntry>

function getTodayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function loadJournal(): JournalStore {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return {}
}
function persistJournal(store: JournalStore) {
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(store))
  kvSet(JOURNAL_KEY, store)
  syncJournals(store)
}
function formatDateKo(key: string, opts?: { full?: boolean }) {
  const d = new Date(key + 'T00:00:00')
  if (opts?.full) return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

// 퀘스트 추가 UI에서 사용하는 카테고리 옵션
const CAT_OPTS = [
  { id: 'writing',  label: '집필',         col: '#818cf8', emoji: '📋' },
  { id: 'business', label: '비즈니스/공부', col: '#fbbf24', emoji: '💼' },
  { id: 'health',   label: '자기관리',      col: '#34d399', emoji: '🏃' },
] as const
type CatId = 'writing' | 'business' | 'health'

// USER_QUESTS_KEY reserved for potential future use

// ── QuestTable (Notion 스타일 퀘스트 시트) ──────────────────────────────────
type ColDef = { key: string; label: string; hidden?: boolean; custom?: boolean; type?: 'text'|'number'|'date' }
const DEFAULT_COLS: ColDef[] = [
  { key:'sort',      label:'순서' },
  { key:'area',      label:'Vision Area' },
  { key:'project',   label:'Real Projects' },
  { key:'status',    label:'상태' },
  { key:'name',      label:'퀘스트명' },
  { key:'tags',      label:'태그' },
  { key:'category',  label:'카테고리' },
  { key:'priority',  label:'중요도' },
  { key:'timespent', label:'누적 집중' },
  { key:'pomodoro_count', label:'몰입 횟수' },
  { key:'pomodoro',  label:'타이머 선택' },
  { key:'delete',    label:'관리' },
  { key:'deadline',  label:'마감일' },
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
    <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:'6px', padding:'6px 10px', borderRadius:'9px', border:'1px solid rgba(0,0,0,0.06)', backgroundColor:'#F1F1EF', minWidth:'140px' }}>
      {tags.map(t => (
        <span key={t} style={{ display:'inline-flex', alignItems:'center', gap:'4px', fontSize:'11px', fontWeight:600, backgroundColor:'rgba(99,102,241,0.15)', color:'#6366f1', padding:'3px 8px', borderRadius:'999px' }}>
          {t}
          <button type="button" onClick={() => onChange(tags.filter(x => x !== t))} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'#6366f1', fontSize:'12px', lineHeight:1 }}>×</button>
        </span>
      ))}
      <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if (e.key==='Enter') { e.preventDefault(); addTag() } }} placeholder={placeholder}
        style={{ flex:1, minWidth:'60px', border:'none', backgroundColor:'transparent', fontSize:'12px', color:'#37352F', outline:'none' }} />
    </div>
  )
}
const QUEST_FILTER_TABS = ['전체','진행중','완료'] as const
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
  table: 'areas' | 'projects' | 'quests' | 'journals'
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
    fetchNoteContent(target.table as 'areas' | 'projects' | 'quests' | 'journals', target.id).then(c => {
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
      await saveNoteContent(target.table as 'areas' | 'projects' | 'quests' | 'journals', target.id, val)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 800)
  }

  const tableLabel: Record<string, string> = {
    areas: '🌐 Vision Area', projects: '📁 Real Projects', quests: '✅ Quest', journals: '📓 Journal',
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
                    ;(e.target as HTMLInputElement).blur()
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

          {/* ── Properties 패널 (Notion 스타일) ── */}
          {(target.meta || target.table !== 'journals') && (() => {
            const m = target.meta ?? {}
            const rows: { icon: string; label: string; value: string; isTimeRow?: boolean; timeSec?: number }[] = []
            if (target.table === 'quests' || target.table === 'projects' || target.table === 'areas') {
              if (target.table === 'quests') {
                rows.push({ icon: '📁', label: 'Real Projects', value: m.projectName ?? '—' })
                rows.push({ icon: '🌐', label: 'Vision Area',    value: m.areaName    ?? '—' })
                rows.push({ icon: '✅', label: '상태',     value: m.isCompleted ? '완료' : '진행 중' })
              }
              if (target.table === 'projects') {
                rows.push({ icon: '🌐', label: 'Vision Area',    value: m.areaName    ?? '—' })
              }
              if (target.table === 'quests' || target.table === 'projects' || target.table === 'areas') {
                const sec = m.timeSpentSec ?? 0
                const h = Math.floor(sec / 3600)
                const min = Math.floor((sec % 3600) / 60)
                const timeStr = h > 0
                  ? `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')} (${h}시간 ${min}분)`
                  : `${String(min).padStart(2,'0')}분`
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
  adding, onAdd, onToggleComplete, onDelete, onSelectPomodoro, onOpenNote, onQuestNameUpdate, onQuestDeadlineUpdate, onPushQuestNameUndo, onPushQuestDeadlineUndo,
}: {
  quests: Card[]
  completed: string[]
  activePomodoroId: string | null
  projects: ProjectRow[]
  areas: AreaRow[]
  identities: IdentityRow[]
  newTitle: string; onNewTitle: (v: string) => void
  newCat: string;   onNewCat:  (v: string) => void
  newQuestAreaId: string; onNewQuestAreaId: (v: string) => void
  newProjectId: string; onNewProjectId: (v: string) => void
  newQuestIdentityId: string; onNewQuestIdentityId: (v: string) => void
  newQuestTags: string[]; onNewQuestTags: (v: string[]) => void
  adding: boolean;  onAdd: () => void
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
}) {
  type ViewMode = 'table' | 'kanban' | 'group_area' | 'group_project'
  type SortBy = 'due_date' | 'custom' | 'priority'
  const [viewMode, setViewMode]    = useState<ViewMode>('table')
  const [sortBy, setSortBy]         = useState<SortBy>('custom')
  const [tagFilter, setTagFilter]   = useState<string>('')
  const [filter, setFilter]         = useState<QFilter>('전체')
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editVal,   setEditVal]     = useState('')
  const [editingDeadlineId, setEditingDeadlineId] = useState<string | null>(null)
  const [cols, setCols]             = useState<ColDef[]>(() => {
    try { return JSON.parse(localStorage.getItem(QT_COLS_KEY) ?? '') } catch { return DEFAULT_COLS }
  })
  const [showColMenu, setShowColMenu] = useState(false)
  const [newColLabel, setNewColLabel] = useState('')
  const [newColType,  setNewColType]  = useState<'text'|'number'|'date'>('text')

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
  const doneCount   = quests.filter(q => completed.includes(q.id)).length

  const catColor: Record<string,string> = { writing:'#EEF2FF', business:'#FFFBEB', health:'#ECFDF5' }
  const catTextColor: Record<string,string> = { writing:'#4F46E5', business:'#B45309', health:'#065F46' }
  const catLabel: Record<string,string> = { writing:'집필', business:'비즈니스', health:'자기관리' }
  const priStar = (p?: number) => '★'.repeat(p ?? 2) + '☆'.repeat(3 - (p ?? 2))

  const thStyle: React.CSSProperties = { padding:'9px 12px', fontSize:'11px', fontWeight:600, color:'#9B9A97', textAlign:'left', backgroundColor:'#F4F4F2', borderBottom:'1px solid rgba(0,0,0,0.06)', whiteSpace:'nowrap', userSelect:'none', position:'relative' }
  const tdStyle: React.CSSProperties = { padding:'10px 12px', fontSize:'13px', color:'#37352F', verticalAlign:'middle', borderBottom:'1px solid rgba(0,0,0,0.04)' }

  return (
    <div>
      {/* 진행 바 */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
        <div style={{ flex:1, height:'4px', borderRadius:'999px', backgroundColor:'#EBEBEA', overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${quests.length ? (doneCount/quests.length)*100 : 0}%`, backgroundColor:'#6366f1', transition:'width 0.4s', borderRadius:'999px' }} />
        </div>
        <span style={{ fontSize:'11px', color:'#787774', flexShrink:0 }}>{doneCount}/{quests.length} 완료</span>
      </div>

      {/* 보기 모드 + 정렬 + 태그 필터 */}
      <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:'10px', marginBottom:'12px' }}>
        <div style={{ display:'flex', gap:'4px' }}>
          {(['table','kanban','group_area','group_project'] as ViewMode[]).map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={{ padding:'5px 10px', borderRadius:'8px', border:'none', fontSize:'11px', fontWeight:600, cursor:'pointer', backgroundColor: viewMode===m ? '#6366f1' : '#FFFFFF', color: viewMode===m ? '#fff' : '#9B9A97', border:'1px solid rgba(0,0,0,0.06)' }}>
              {m==='table'?'표':m==='kanban'?'칸반':m==='group_area'?'Area별':'Project별'}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value as SortBy)} style={{ padding:'5px 10px', borderRadius:'8px', border:'1px solid rgba(0,0,0,0.06)', fontSize:'11px', color:'#37352F', backgroundColor:'#FFFFFF' }}>
          <option value="custom">커스텀 순</option>
          <option value="due_date">마감일 순</option>
          <option value="priority">중요도 순</option>
        </select>
        {allTags.length > 0 && (
          <select value={tagFilter} onChange={e=>setTagFilter(e.target.value)} style={{ padding:'5px 10px', borderRadius:'8px', border:'1px solid rgba(0,0,0,0.06)', fontSize:'11px', color:'#37352F', backgroundColor:'#FFFFFF' }}>
            <option value="">태그 필터</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {/* 필터 탭 + 컬럼 설정 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px', flexWrap:'wrap', gap:'8px' }}>
        <div style={{ display:'flex', gap:'6px' }}>
          {QUEST_FILTER_TABS.map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{ padding:'5px 14px', borderRadius:'8px', border:'none', fontSize:'12px', fontWeight:600, cursor:'pointer', backgroundColor: filter===t ? '#6366f1' : '#FFFFFF', color: filter===t ? '#fff' : '#9B9A97', transition:'all 0.15s' }}>{t}</button>
          ))}
        </div>
        <div style={{ position:'relative' }}>
          <button onClick={() => setShowColMenu(v=>!v)} style={{ padding:'5px 12px', borderRadius:'8px', border:'1px solid rgba(0,0,0,0.06)', backgroundColor:'transparent', color:'#9B9A97', fontSize:'11px', cursor:'pointer' }}>⚙ 속성</button>
          {showColMenu && (
            <div style={{ position:'absolute', right:0, top:'calc(100% + 6px)', backgroundColor:'#FFFFFF', border:'1px solid rgba(0,0,0,0.06)', borderRadius:'12px', padding:'14px', zIndex:50, minWidth:'220px', boxShadow:'0 2px 12px rgba(0,0,0,0.07)' }}>
              <p style={{ margin:'0 0 10px', fontSize:'11px', fontWeight:700, color:'#6366f1' }}>컬럼 설정</p>
              {cols.map(c => (
                <div key={c.key} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px' }}>
                  <input type="checkbox" checked={!c.hidden} onChange={() => toggleColVisibility(c.key)} style={{ accentColor:'#6366f1', cursor:'pointer' }} />
                  <input value={c.label} onChange={e => renameCol(c.key, e.target.value)} style={{ flex:1, backgroundColor:'#F1F1EF', border:'1px solid rgba(0,0,0,0.06)', borderRadius:'6px', padding:'3px 8px', fontSize:'12px', color:'#37352F', outline:'none' }} />
                </div>
              ))}
              <div style={{ borderTop:'1px solid rgba(0,0,0,0.06)', marginTop:'10px', paddingTop:'10px' }}>
                <p style={{ margin:'0 0 6px', fontSize:'10px', color:'#787774' }}>새 컬럼 추가</p>
                <input value={newColLabel} onChange={e=>setNewColLabel(e.target.value)} placeholder="컬럼 이름" style={{ width:'100%', boxSizing:'border-box', backgroundColor:'#F1F1EF', border:'1px solid rgba(0,0,0,0.06)', borderRadius:'6px', padding:'5px 8px', fontSize:'12px', color:'#37352F', outline:'none', marginBottom:'6px' }} />
                <select value={newColType} onChange={e=>setNewColType(e.target.value as 'text'|'number'|'date')} style={{ width:'100%', backgroundColor:'#F1F1EF', border:'1px solid rgba(0,0,0,0.06)', borderRadius:'6px', padding:'5px 8px', fontSize:'12px', color:'#37352F', outline:'none', marginBottom:'8px' }}>
                  <option value="text">텍스트</option>
                  <option value="number">숫자</option>
                  <option value="date">날짜</option>
                </select>
                <button onClick={addCustomCol} style={{ width:'100%', padding:'6px', borderRadius:'8px', border:'none', backgroundColor:'#6366f1', color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer' }}>추가</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 칸반 뷰 */}
      {viewMode === 'kanban' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'16px', marginBottom:'20px' }}>
          {[
            { key: 'someday', label: '언젠가', color: '#9B9A97' },
            { key: 'not_started', label: '시작전', color: '#787774' },
            { key: 'in_progress', label: '진행중', color: '#6366f1' },
            { key: 'done', label: '완료', color: '#34d399' },
          ].map(col => (
            <div key={col.key} style={{ backgroundColor:'#F8F8F6', borderRadius:'12px', border:`1px solid ${col.color}40`, padding:'12px', minHeight:'120px' }}>
              <p style={{ margin:'0 0 10px', fontSize:'11px', fontWeight:700, color:col.color }}>{col.label}</p>
              {filtered.filter(q => (q.status ?? 'someday') === col.key).map(q => {
                const isDone = completed.includes(q.id)
                const isActive = activePomodoroId === q.id
                return (
                  <div key={q.id} style={{ backgroundColor:'#FFFFFF', borderRadius:'8px', padding:'10px 12px', marginBottom:'8px', border:'1px solid rgba(0,0,0,0.06)' }}>
                    <p style={{ margin:0, fontSize:'13px', fontWeight:600, color:'#37352F', textDecoration: isDone?'line-through':'none', cursor:'pointer' }} onClick={() => onOpenNote(q.id, q.name, {})}>{q.name}</p>
                    {(q.tags ?? []).length > 0 && (
                      <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', marginTop:'6px' }}>
                        {(q.tags ?? []).map(t => <span key={t} style={{ fontSize:'10px', backgroundColor:'rgba(99,102,241,0.1)', color:'#6366f1', padding:'2px 8px', borderRadius:'999px' }}>{t}</span>)}
                      </div>
                    )}
                    <div style={{ display:'flex', gap:'6px', marginTop:'8px', flexWrap:'wrap' }}>
                      <select value={q.status ?? 'someday'} onChange={e=>{ const v=e.target.value; onQuestStatusUpdate?.(q.id, v); if(v==='done') onToggleComplete(q.id, true); else if(isDone) onToggleComplete(q.id, false) }} onClick={e=>e.stopPropagation()} style={{ padding:'2px 6px', borderRadius:'6px', border:'1px solid rgba(0,0,0,0.08)', fontSize:'10px', cursor:'pointer' }}>
                        <option value="someday">언젠가</option>
                        <option value="not_started">시작전</option>
                        <option value="in_progress">진행중</option>
                        <option value="done">완료</option>
                      </select>
                      <button onClick={e=>{e.stopPropagation();onSelectPomodoro(q.id)}} style={{ padding:'3px 8px', borderRadius:'6px', border:'1px solid #6366f1', backgroundColor: isActive?'rgba(99,102,241,0.15)':'transparent', fontSize:'10px', color:'#6366f1', cursor:'pointer' }}>{isActive?'진행중':'▶'}</button>
                      <button onClick={e=>{e.stopPropagation();onDelete(q.id)}} style={{ padding:'3px 8px', borderRadius:'6px', border:'1px solid #f87171', color:'#f87171', fontSize:'10px', cursor:'pointer' }}>삭제</button>
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
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          {(viewMode === 'group_area' ? areas : projects).map(item => {
            const groupQuests = viewMode === 'group_area'
              ? filtered.filter(q => { const p = projects.find(x => String(x.id) === String(q.projectId)); return p && String(p.area_id) === String(item.id) })
              : filtered.filter(q => String(q.projectId) === String(item.id))
            if (groupQuests.length === 0) return null
            const parentName = viewMode === 'group_project' && (item as ProjectRow).area_id ? areas.find(a => String(a.id) === String((item as ProjectRow).area_id))?.name : null
            return (
              <div key={item.id} style={{ backgroundColor:'#F8F8F6', borderRadius:'12px', border:'1px solid rgba(0,0,0,0.06)', overflow:'hidden' }}>
                <div style={{ padding:'12px 16px', backgroundColor:'#F1F1EF', borderBottom:'1px solid rgba(0,0,0,0.06)', fontWeight:700, fontSize:'13px', color:'#37352F' }}>
                  {viewMode === 'group_project' && parentName ? `${parentName} › ` : ''}{item.name}
                </div>
                <div style={{ padding:'12px' }}>
                  {groupQuests.map(q => {
                    const isDone = completed.includes(q.id)
                    return (
                      <div key={q.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'8px 0', borderBottom:'1px solid rgba(0,0,0,0.04)' }}
                        onClick={() => onOpenNote(q.id, q.name, {})}>
                        <input type="checkbox" checked={isDone} onChange={e=>onToggleComplete(q.id, e.target.checked)} style={{ accentColor:'#6366f1', cursor:'pointer' }} />
                        <span style={{ flex:1, fontSize:'13px', color: isDone?'#787774':'#37352F', textDecoration: isDone?'line-through':'none' }}>{q.name}</span>
                        {(q.tags ?? []).map(t => <span key={t} style={{ fontSize:'10px', backgroundColor:'rgba(99,102,241,0.1)', color:'#6366f1', padding:'2px 8px', borderRadius:'999px' }}>{t}</span>)}
                        <button onClick={e=>{e.stopPropagation();onSelectPomodoro(q.id)}} style={{ padding:'3px 8px', borderRadius:'6px', border:'1px solid #6366f1', fontSize:'10px', color:'#6366f1', cursor:'pointer' }}>▶</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {filtered.filter(q => !q.projectId).length > 0 && (
            <div style={{ backgroundColor:'#F8F8F6', borderRadius:'12px', border:'1px solid rgba(0,0,0,0.06)', overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', backgroundColor:'#F1F1EF', borderBottom:'1px solid rgba(0,0,0,0.06)', fontWeight:700, fontSize:'13px', color:'#9B9A97' }}>미분류</div>
              <div style={{ padding:'12px' }}>
                {filtered.filter(q => !q.projectId).map(q => (
                  <div key={q.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'8px 0', borderBottom:'1px solid rgba(0,0,0,0.04)' }} onClick={() => onOpenNote(q.id, q.name, {})}>
                    <input type="checkbox" checked={completed.includes(q.id)} onChange={e=>onToggleComplete(q.id, e.target.checked)} style={{ accentColor:'#6366f1', cursor:'pointer' }} />
                    <span style={{ flex:1, fontSize:'13px' }}>{q.name}</span>
                    <button onClick={e=>{e.stopPropagation();onSelectPomodoro(q.id)}} style={{ padding:'3px 8px', borderRadius:'6px', border:'1px solid #6366f1', fontSize:'10px', color:'#6366f1', cursor:'pointer' }}>▶</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 테이블 */}
      {viewMode === 'table' && (
      <div style={{ overflowX:'auto', borderRadius:'12px', border:'1px solid rgba(0,0,0,0.06)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'600px' }}>
          <thead>
            <tr style={{ backgroundColor:'#F1F1EF' }}>
              {visibleCols.map(c => <th key={c.key} style={thStyle}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length} style={{ ...tdStyle, textAlign:'center', color:'#AEAAA4', padding:'32px' }}>
                  퀘스트가 없습니다. 아래에서 새 퀘스트를 추가하세요.
                </td>
              </tr>
            ) : filtered.map(q => {
              const isDone   = completed.includes(q.id)
              const isActive = activePomodoroId === q.id
              return (
                <tr key={q.id} style={{ backgroundColor: isActive ? 'rgba(99,102,241,0.08)' : isDone ? 'rgba(52,211,153,0.04)' : 'transparent', transition:'background 0.15s' }}
                  onMouseEnter={e=>{if(!isActive&&!isDone) e.currentTarget.style.backgroundColor='rgba(0,0,0,0.02)'}}
                  onMouseLeave={e=>{e.currentTarget.style.backgroundColor=isActive?'rgba(99,102,241,0.08)':isDone?'rgba(52,211,153,0.04)':'transparent'}}
                >
                  {visibleCols.map(col => {
                    if (col.key === 'sort') return (
                      <td key="sort" style={tdStyle}>
                        <div style={{ display:'flex', flexDirection:'column', gap:'1px' }}>
                          <button onClick={()=>onMoveQuestUp?.(q.id)} disabled={filtered.indexOf(q)===0} style={{ padding:'1px 2px', border:'none', background:'none', color:'#9B9A97', cursor:filtered.indexOf(q)===0?'default':'pointer', opacity:filtered.indexOf(q)===0?0.4:1 }}><ChevronUp size={12} /></button>
                          <button onClick={()=>onMoveQuestDown?.(q.id)} disabled={filtered.indexOf(q)===filtered.length-1} style={{ padding:'1px 2px', border:'none', background:'none', color:'#9B9A97', cursor:filtered.indexOf(q)===filtered.length-1?'default':'pointer', opacity:filtered.indexOf(q)===filtered.length-1?0.4:1 }}><ChevronDown size={12} /></button>
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
                        }} style={{ padding:'4px 8px', borderRadius:'6px', border:'1px solid rgba(0,0,0,0.08)', fontSize:'11px', backgroundColor:'#FFFFFF', cursor:'pointer' }}>
                          <option value="someday">언젠가</option>
                          <option value="not_started">시작전</option>
                          <option value="in_progress">진행중</option>
                          <option value="done">완료</option>
                        </select>
                      </td>
                    )
                    if (col.key === 'name') return (
                      <td key="name" style={{ ...tdStyle, maxWidth:'220px' }}>
                        {editingId === q.id ? (
                          <input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)}
                            onBlur={() => commitEdit(q)}
                            onKeyDown={e => { if (e.key==='Enter') { e.preventDefault(); commitEdit(q) } if (e.key==='Escape') { setEditingId(null) } }}
                            style={{ width:'100%', backgroundColor:'#F1F1EF', border:'1px solid #6366f1', borderRadius:'6px', padding:'4px 8px', fontSize:'13px', color:'#37352F', outline:'none' }} />
                        ) : (
                          <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
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
                        {isActive && <span style={{ fontSize:'9px', backgroundColor:'rgba(99,102,241,0.2)', color:'#4F46E5', padding:'1px 6px', borderRadius:'999px', marginTop:'2px', display:'inline-block' }}>집중 중</span>}
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
                            <span style={{ fontSize:'11px', fontWeight:600, color:'#0369A1', backgroundColor:'#E0F2FE', padding:'2px 9px', borderRadius:'999px', whiteSpace:'nowrap', display:'inline-block', maxWidth:'110px', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {area.name}
                            </span>
                          ) : (
                            <span style={{ fontSize:'11px', fontWeight:500, color:'#9B9A97', backgroundColor:'#F1F1EF', padding:'2px 9px', borderRadius:'999px' }}>미분류</span>
                          )}
                        </td>
                      )
                    }
                    if (col.key === 'project') return (
                      <td key="project" style={tdStyle}>
                        {q.projectId ? (
                          (() => {
                            const proj = projects.find(p => String(p.id) === String(q.projectId))
                            if (!proj) return <span style={{ fontSize:'11px', fontWeight:500, color:'#9B9A97', backgroundColor:'#F1F1EF', padding:'2px 9px', borderRadius:'999px' }}>미분류</span>
                            return (
                              <span style={{ fontSize:'11px', fontWeight:600, color:'#6D28D9', backgroundColor:'#EDE9FE', padding:'2px 9px', borderRadius:'999px', whiteSpace:'nowrap', maxWidth:'120px', overflow:'hidden', textOverflow:'ellipsis', display:'inline-block' }}>
                                {proj.name}
                              </span>
                            )
                          })()
                        ) : (
                          <span style={{ fontSize:'11px', fontWeight:500, color:'#9B9A97', backgroundColor:'#F1F1EF', padding:'2px 9px', borderRadius:'999px' }}>미분류</span>
                        )}
                      </td>
                    )
                    if (col.key === 'category') return (
                      <td key="category" style={tdStyle}>
                        <span style={{ fontSize:'11px', fontWeight:600, color: catTextColor[q.sub] ?? '#6B6B6B', backgroundColor: catColor[q.sub] ?? '#F1F1EF', padding:'2px 9px', borderRadius:'999px' }}>
                          {catLabel[q.sub] ?? q.sub}
                        </span>
                      </td>
                    )
                    if (col.key === 'priority') return (
                      <td key="priority" style={{ ...tdStyle, color:'#fbbf24', fontSize:'14px', letterSpacing:'-1px' }}>{priStar(q.priority)}</td>
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
                        <span style={{ fontSize:'12px', color: q.timeSpentSec ? '#7C3AED' : '#AEAAA4' }}>{fmtSec(q.timeSpentSec)}</span>
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
                          style={{ padding:'3px 10px', borderRadius:'6px', border:`1px solid ${isActive ? '#6366f1' : '#EBEBEA'}`, backgroundColor: isActive ? 'rgba(99,102,241,0.15)' : 'transparent', color: isActive ? '#4F46E5' : '#9B9A97', fontSize:'11px', cursor:'pointer' }}>
                          {isActive ? '▶ 진행 중' : '▶ 선택'}
                        </button>
                      </td>
                    )
                    if (col.key === 'delete') return (
                      <td key="delete" style={tdStyle}>
                        <button onClick={() => onDelete(q.id)}
                          style={{ padding:'3px 10px', borderRadius:'6px', border:'1px solid rgba(248,113,113,0.2)', backgroundColor:'transparent', color:'#f87171', fontSize:'11px', cursor:'pointer', transition:'background 0.1s' }}
                          onMouseEnter={e=>(e.currentTarget.style.backgroundColor='rgba(248,113,113,0.1)')}
                          onMouseLeave={e=>(e.currentTarget.style.backgroundColor='transparent')}>
                          삭제
                        </button>
                      </td>
                    )
                    if (col.custom) return <td key={col.key} style={{ ...tdStyle, color:'#787774', fontSize:'12px' }}>-</td>
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
      <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginTop:'14px' }}>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
          <input
            value={newTitle}
            onChange={e => onNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onAdd() }}
            placeholder="새 퀘스트 이름 입력 후 Enter"
            style={{ flex:'1', minWidth:'160px', padding:'9px 14px', borderRadius:'9px', border:'1px solid rgba(0,0,0,0.06)', backgroundColor:'#F1F1EF', color:'#37352F', fontSize:'13px', outline:'none' }}
            onFocus={e=>(e.target.style.borderColor='#6366f1')}
            onBlur={e=>(e.target.style.borderColor='#EBEBEA')}
          />
          <select
            value={newQuestAreaId}
            onChange={e => { onNewQuestAreaId(e.target.value); onNewProjectId('') }}
            style={{ padding:'9px 12px', borderRadius:'9px', border:'1px solid rgba(0,0,0,0.06)', backgroundColor:'#F1F1EF', color: newQuestAreaId ? '#37352F' : '#9B9A97', fontSize:'13px', outline:'none' }}
          >
            <option value="">{areas.length === 0 ? 'Vision Area를 먼저 생성해주세요' : 'Vision Area 선택 (필수)'}</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select
            value={newProjectId}
            onChange={e => onNewProjectId(e.target.value)}
            disabled={!newQuestAreaId}
            style={{ padding:'9px 12px', borderRadius:'9px', border:'1px solid rgba(0,0,0,0.06)', backgroundColor: newQuestAreaId ? '#F1F1EF' : '#EBEBEA', color: newProjectId ? '#37352F' : '#9B9A97', fontSize:'13px', outline:'none' }}
          >
            <option value="">{!newQuestAreaId ? 'Vision Area를 먼저 선택하세요' : 'Real Projects 선택 (필수)'}</option>
            {projects.filter(p => p.area_id != null && String(p.area_id) === String(newQuestAreaId)).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={newCat}
            onChange={e => onNewCat(e.target.value)}
            style={{ padding:'9px 12px', borderRadius:'9px', border:'1px solid rgba(0,0,0,0.06)', backgroundColor:'#F1F1EF', color:'#37352F', fontSize:'13px', outline:'none' }}
          >
            <option value="writing">집필</option>
            <option value="business">비즈니스/공부</option>
            <option value="health">자기관리</option>
          </select>
          <select
            value={newQuestIdentityId}
            onChange={e => onNewQuestIdentityId(e.target.value)}
            style={{ padding:'9px 12px', borderRadius:'9px', border:'1px solid rgba(0,0,0,0.06)', backgroundColor:'#F1F1EF', color: newQuestIdentityId ? '#37352F' : '#9B9A97', fontSize:'13px', outline:'none' }}
          >
            <option value="">Identity (선택)</option>
            {identities.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <TagInput tags={newQuestTags} onChange={onNewQuestTags} placeholder="태그 (엔터)" />
          <button
            onClick={onAdd}
            disabled={adding || !newTitle.trim() || !newQuestAreaId || !newProjectId}
            style={{ padding:'9px 18px', borderRadius:'9px', border:'none', backgroundColor: (adding||!newTitle.trim()||!newQuestAreaId||!newProjectId) ? '#EBEBEA' : '#6366f1', color: (adding||!newTitle.trim()||!newQuestAreaId||!newProjectId) ? '#787774' : '#fff', fontSize:'13px', fontWeight:700, cursor: (adding||!newTitle.trim()||!newQuestAreaId||!newProjectId) ? 'default' : 'pointer', transition:'background 0.15s' }}
          >
            {adding ? '추가 중…' : '+ 추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

const DEFAULT_STATS: StatDef[] = [
  { id: 'words',   label: '오늘 작성', value: '0',         unit: '자',       memo: '', col: '#818cf8', emoji: '✍️', isText: false, hasMemo: false },
  { id: 'streak',  label: '연속 집필', value: '0',         unit: '일',       memo: '', col: '#34d399', emoji: '🔥', isText: false, hasMemo: false },
  { id: 'health',  label: '오늘 건강', value: '0',         unit: '보 걸음',  memo: '', col: '#f472b6', emoji: '💪', isText: false, hasMemo: false },
  { id: 'fortune', label: '내 운세',   value: '갑술(甲戌)', unit: '',         memo: '', col: '#fbbf24', emoji: '🔯', isText: true,  hasMemo: true  },
]

// 갑술(甲戌) 일주 — 산 위의 나무 — 매일 랜덤 응원 메시지
const FORTUNE_MSGS = [
  '산 위의 나무는 깊은 뿌리로 버팁니다. 오늘은 콘티에만 집중하세요.',
  '갑술의 기운은 흔들리지 않는 줄기. 외부 소음 차단, 원고에 몰입하세요.',
  '높은 곳의 나무는 바람을 맞아도 자랍니다. 오늘의 난관이 내공이 됩니다.',
  '갑목(甲木)의 곧은 기운 — 타협하지 말고 작품의 방향을 지켜내세요.',
  '술토(戌土) 위에 뿌리내린 나무. 오늘은 세계관을 단단히 다지는 날입니다.',
  '가을 산의 나무는 열매를 맺습니다. 마감 전 완성도를 높이세요.',
  '갑술 일주는 고집과 뚝심이 재능. 오늘도 묵묵히 한 칸씩 채워가세요.',
  '산 정상의 나무는 혼자이지만 강합니다. 고독한 창작이 걸작을 만듭니다.',
  '갑술의 기운 — 오늘은 아이디어 스케치보다 완성에 에너지를 쏟으세요.',
  '뿌리가 깊은 나무는 폭풍도 이깁니다. 슬럼프는 성장의 전조입니다.',
]
// 날짜 기반으로 하루 동안 같은 메시지 유지
const DAILY_FORTUNE = FORTUNE_MSGS[new Date().getDate() % FORTUNE_MSGS.length]

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

// ── LoginView ──────────────────────────────────────────────────────────────
function LoginView({ onLogin }: { onLogin: (s: Session) => void }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const result = await signIn(email, password)
    if (result.error) { setError(result.error); setLoading(false) }
    else if (result.session) onLogin(result.session)
    else { setError('로그인 실패'); setLoading(false) }
  }

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '13px 16px',
    borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#F1F1EF',
    color: '#37352F', fontSize: '14px', outline: 'none', marginBottom: '12px',
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F2', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '400px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid rgba(99,102,241,0.2)', padding: '40px 36px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '28px' }}>⚡</p>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: '#37352F' }}>Creative OS</h1>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#787774' }}>웹툰 작가를 위한 성장형 창작 OS</p>
        </div>
        <form onSubmit={handleSubmit}>
          <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="이메일" style={inp} onFocus={e=>(e.target.style.borderColor='#6366f1')} onBlur={e=>(e.target.style.borderColor='#EBEBEA')} />
          <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="비밀번호" style={inp} onFocus={e=>(e.target.style.borderColor='#6366f1')} onBlur={e=>(e.target.style.borderColor='#EBEBEA')} />
          {error && <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#f87171', textAlign: 'center' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: loading ? '#EBEBEA' : '#6366f1', color: loading ? '#787774' : '#fff', fontSize: '15px', fontWeight: 800, cursor: loading ? 'default' : 'pointer', transition: 'background 0.2s', boxShadow: loading ? 'none' : '0 0 24px rgba(99,102,241,0.4)' }}>
            {loading ? '로그인 중…' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── StatCard 컴포넌트 ──
function StatCard({ stat, onUpdate }: {
  stat: StatDef
  onUpdate: (id: string, value: string, memo: string) => void
}) {
  const [editing,  setEditing]  = useState(false)
  const [draft,    setDraft]    = useState(stat.value)
  const [memoDraft, setMemoDraft] = useState(stat.memo)
  const [flash,    setFlash]    = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const memoRef  = useRef<HTMLTextAreaElement>(null)

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
const PARTICLE_COLS = ['#6366f1','#818cf8','#7C3AED','#7C3AED','#7c3aed','#4f46e5','#ddd6fe']
function genParticles(n: number): ParticleCfg[] {
  return Array.from({ length: n }, () => ({
    left:  Math.random() * 100,
    dur:   1.5 + Math.random() * 2,
    delay: Math.random() * 1.2,
    size:  4 + Math.random() * 9,
    col:   PARTICLE_COLS[Math.floor(Math.random() * PARTICLE_COLS.length)],
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
    <button onClick={() => onAdjust(deltaSec)} style={btnStyle} onMouseEnter={e=>hover(e,true)} onMouseLeave={e=>hover(e,false)}>
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
            style={{ padding:'7px 20px', borderRadius:'8px', border:'1px solid rgba(234,179,8,0.4)', backgroundColor:'rgba(254,249,195,0.12)', color:'#FDE047', fontSize:'12px', fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}
            onMouseEnter={e=>{e.currentTarget.style.backgroundColor='rgba(234,179,8,0.18)'}}
            onMouseLeave={e=>{e.currentTarget.style.backgroundColor='rgba(254,249,195,0.12)'}}
          >완료 (Complete)</button>
        )}
        {finished && (
          <button
            onClick={onExtend}
            style={{ padding:'7px 20px', borderRadius:'8px', border:'1px solid rgba(99,102,241,0.45)', backgroundColor:'rgba(99,102,241,0.12)', color:'#a78bfa', fontSize:'12px', fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}
            onMouseEnter={e=>{e.currentTarget.style.backgroundColor='rgba(99,102,241,0.22)'}}
            onMouseLeave={e=>{e.currentTarget.style.backgroundColor='rgba(99,102,241,0.12)'}}
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

// ═══════════════════════════════════════ WORLDS PAGE ══════════════════════════
const WORLDS_KEY = 'creative_os_worlds_v1'

type WorldSection = { id: string; title: string; placeholder: string }
type WorldDef = {
  id: string; name: string; tagline: string; emoji: string
  accent: string; border: string
  sections: WorldSection[]
}

const WORLDS: WorldDef[] = [
  {
    id: 'webtoon', name: '성인 웹툰 프로젝트', tagline: '주력 연재 · 스토리 바이블',
    emoji: '🎨', accent: '#818cf8', border: 'rgba(99,102,241,0.3)',
    sections: [
      { id: 'bible',  title: '스토리 바이블',  placeholder: '작품의 핵심 기획 의도, 테마, 세계관 요약을 자유롭게 작성하세요...' },
      { id: 'chars',  title: '캐릭터 시트',    placeholder: '주인공·조연·빌런의 외모, 성격, 관계도, 말투 특성...' },
      { id: 'world',  title: '세계관 설정',    placeholder: '마법 체계, 사회 구조, 역사 배경, 지리적 특성...' },
      { id: 'plot',   title: '플롯 구조',      placeholder: '막 구조, 주요 전환점, 클라이맥스, 엔딩 방향...' },
    ],
  },
  {
    id: 'funding', name: '사주 사이드 펀딩', tagline: '크라우드펀딩 · 비즈니스 전략',
    emoji: '🔯', accent: '#fbbf24', border: 'rgba(251,191,36,0.3)',
    sections: [
      { id: 'strategy', title: '비즈니스 전략', placeholder: '펀딩 목표 금액, 차별화 포인트, 단계별 실행 계획...' },
      { id: 'content',  title: '콘텐츠 기획',  placeholder: '리워드 구성, 커리큘럼, 무료/유료 경계선 설계...' },
      { id: 'market',   title: '타겟 분석',    placeholder: '주 고객층 페르소나, 경쟁사 분석, 포지셔닝 전략...' },
      { id: 'revenue',  title: '수익 모델',    placeholder: '가격 정책, 수익 구조, 장기 확장 비전...' },
    ],
  },
  {
    id: 'health', name: '개인 건강 관리', tagline: '건강 일지 · 루틴 설계',
    emoji: '💪', accent: '#34d399', border: 'rgba(52,211,153,0.28)',
    sections: [
      { id: 'journal',  title: '건강 일지',   placeholder: '오늘의 컨디션, 수면 질, 에너지 레벨 메모...' },
      { id: 'diet',     title: '식단 기록',   placeholder: '식사 내용, 칼로리 추정, 영양 밸런스 체크...' },
      { id: 'workout',  title: '운동 루틴',   placeholder: '운동 종류, 시간, 강도, 세트·반복 수...' },
      { id: 'goals',    title: '목표 설정',   placeholder: '단기·장기 건강 목표, 마일스톤, 측정 기준...' },
    ],
  },
]

function loadWorldData(): Record<string, Record<string, string>> {
  try { const r = localStorage.getItem(WORLDS_KEY); return r ? JSON.parse(r) : {} }
  catch { return {} }
}
function saveWorldSection(worldId: string, sectionId: string, content: string) {
  const data = loadWorldData()
  if (!data[worldId]) data[worldId] = {}
  data[worldId][sectionId] = content
  localStorage.setItem(WORLDS_KEY, JSON.stringify(data))
  kvSet(WORLDS_KEY, data)
}

function WorldsPage() {
  const [data,    setData]    = useState<Record<string, Record<string, string>>>({})
  const [worldId, setWorldId] = useState(WORLDS[0].id)
  const [secId,   setSecId]   = useState(WORLDS[0].sections[0].id)
  const [draft,   setDraft]   = useState('')
  const [saved,   setSaved]   = useState(true)
  const debounce  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setData(loadWorldData()) }, [])

  useEffect(() => {
    setDraft(data[worldId]?.[secId] ?? '')
    setSaved(true)
  }, [worldId, secId, data])

  function handleChange(val: string) {
    setDraft(val); setSaved(false)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      saveWorldSection(worldId, secId, val)
      setData(loadWorldData()); setSaved(true)
    }, 600)
  }

  function switchWorld(id: string) {
    setWorldId(id)
    setSecId(WORLDS.find(w => w.id === id)!.sections[0].id)
  }

  const world    = WORLDS.find(w => w.id === worldId)!
  const section  = world.sections.find(s => s.id === secId)!

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '28px 48px', display: 'flex', gap: '20px', height: 'calc(100vh - 57px)', boxSizing: 'border-box' }}>

      {/* ── 왼쪽 패널: 월드 목록 ── */}
      <div style={{ width: '270px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ margin: '0 0 6px', fontSize: '10px', color: '#787774', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          나의 작업 세계
        </p>

        {WORLDS.map(w => {
          const isActive = worldId === w.id
          const totalChars = Object.values(data[w.id] ?? {}).join('').length
          return (
            <button key={w.id} onClick={() => switchWorld(w.id)} style={{
              textAlign: 'left', padding: '16px 18px', borderRadius: '16px', cursor: 'pointer',
              border: `1.5px solid ${isActive ? w.border : 'transparent'}`,
              backgroundColor: isActive ? '#F1F1EF' : '#FFFFFF',
              boxShadow: isActive ? `0 0 0 1px ${w.border}, 0 4px 20px ${w.accent}18` : 'none',
              transition: 'all 0.18s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                <span style={{ fontSize: '18px' }}>{w.emoji}</span>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: isActive ? '#fff' : '#37352F' }}>
                  {w.name}
                </p>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: isActive ? w.accent : '#787774' }}>
                {w.tagline}
              </p>
              {isActive && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '10px' }}>
                  {w.sections.map(s => (
                    <span key={s.id} style={{
                      fontSize: '10px', fontWeight: 600, color: w.accent,
                      backgroundColor: `${w.accent}14`, border: `1px solid ${w.accent}28`,
                      padding: '2px 8px', borderRadius: '999px',
                    }}>
                      {s.title}
                    </span>
                  ))}
                </div>
              )}
              <p style={{ margin: '8px 0 0', fontSize: '10px', color: '#787774' }}>
                {totalChars > 0 ? `${totalChars.toLocaleString()}자 작성됨` : '아직 작성 내용 없음'}
              </p>
            </button>
          )
        })}

        {/* 전체 작성 현황 */}
        <div style={{ marginTop: 'auto', padding: '14px 16px', backgroundColor: '#F1F1EF', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)' }}>
          <p style={{ margin: '0 0 10px', fontSize: '10px', color: '#787774', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            작성 현황
          </p>
          {WORLDS.map(w => {
            const count = Object.values(data[w.id] ?? {}).join('').length
            const maxCount = 10000
            const pct = Math.min(count / maxCount * 100, 100)
            return (
              <div key={w.id} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#787774' }}>{w.emoji} {w.name.slice(0, 7)}…</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: w.accent }}>
                    {count > 999 ? `${(count/1000).toFixed(1)}k` : count}자
                  </span>
                </div>
                <div style={{ height: '3px', backgroundColor: '#EBEBEA', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, backgroundColor: w.accent, borderRadius: '999px', transition: 'width 0.4s' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 오른쪽 패널: 에디터 ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#111', borderRadius: '12px', border: `1px solid ${world.border}`, overflow: 'hidden' }}>

        {/* 에디터 헤더 */}
        <div style={{ padding: '18px 28px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '22px' }}>{world.emoji}</span>
            <div>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#37352F' }}>{world.name}</p>
              <p style={{ margin: 0, fontSize: '11px', color: world.accent, marginTop: '2px' }}>{world.tagline}</p>
            </div>
          </div>
          <span style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
            color: saved ? '#34d399' : '#f59e0b',
            transition: 'color 0.3s',
          }}>
            {saved ? '● 저장됨' : '● 저장 중...'}
          </span>
        </div>

        {/* 섹션 탭 */}
        <div style={{ display: 'flex', gap: '2px', padding: '10px 20px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0, overflowX: 'auto' }}>
          {world.sections.map(s => {
            const isActive = secId === s.id
            const count = (data[worldId]?.[s.id] ?? '').length
            return (
              <button key={s.id} onClick={() => setSecId(s.id)} style={{
                padding: '8px 16px', borderRadius: '8px 8px 0 0', cursor: 'pointer',
                border: 'none', fontSize: '12px', fontWeight: isActive ? 700 : 500,
                color: isActive ? '#fff' : '#787774',
                backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                borderBottom: `2px solid ${isActive ? world.accent : 'transparent'}`,
                transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px',
                flexShrink: 0, whiteSpace: 'nowrap',
              }}>
                {s.title}
                {count > 0 && (
                  <span style={{ fontSize: '9px', fontWeight: 700, color: world.accent, backgroundColor: `${world.accent}20`, padding: '1px 5px', borderRadius: '999px' }}>
                    {count > 999 ? `${(count/1000).toFixed(1)}k` : count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* 본문 에디터 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '32px 44px 24px' }}>
          {/* 섹션 제목 */}
          <h2 style={{ margin: '0 0 20px', fontSize: '22px', fontWeight: 800, color: world.accent, letterSpacing: '-0.5px' }}>
            {section.title}
          </h2>
          {/* 자 수 */}
          <p style={{ margin: '0 0 16px', fontSize: '11px', color: '#AEAAA4' }}>
            {draft.length > 0 ? `${draft.length.toLocaleString()}자 · ${draft.split('\n').length}줄` : '아직 작성된 내용이 없습니다.'}
          </p>
          {/* Rich Editor */}
          <RichEditor
            key={`${worldId}-${secId}`}
            value={draft}
            onChange={handleChange}
            placeholder={section.placeholder}
            minHeight={420}
          />
        </div>

        {/* 하단 툴바 */}
        <div style={{ padding: '12px 28px', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            {world.sections.map(s => {
              const count = (data[worldId]?.[s.id] ?? '').length
              return count > 0 ? (
                <span key={s.id} style={{ fontSize: '11px', color: '#787774' }}>
                  {s.title}: <span style={{ color: world.accent, fontWeight: 700 }}>{count.toLocaleString()}자</span>
                </span>
              ) : null
            })}
          </div>
          <button
            onClick={() => { if (draft && confirm('이 섹션의 내용을 초기화할까요?')) { handleChange('') } }}
            style={{ fontSize: '11px', color: '#374151', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#9B9A97')}
            onMouseLeave={e => (e.currentTarget.style.color = '#374151')}
          >
            초기화
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════ JOURNAL PAGE ════════════════════════
function JournalPage({ completedQuests, xpState, userQuests }: {
  completedQuests: string[]
  xpState: XpState
  userQuests: Card[]
}) {
  const isMobile = useIsMobile()
  const todayKey = getTodayKey()
  const [store,       setStore]       = useState<JournalStore>(() => loadJournal())
  const [activeKey,   setActiveKey]   = useState(todayKey)
  const [content,     setContent]     = useState(() => loadJournal()[todayKey]?.content ?? '')
  const [lastSaved,   setLastSaved]   = useState<Date | null>(null)
  const [blocksDone,  setBlocksDone]  = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeBlocks: AchievementBlock[] = store[activeKey]?.blocks ?? []

  function selectEntry(key: string) {
    setActiveKey(key)
    setContent(store[key]?.content ?? '')
  }

  function mergeEntry(key: string, patch: Partial<JournalEntry>, prev: JournalStore): JournalStore {
    const existing = prev[key] ?? {}
    const base: JournalEntry = {
      date:       key,
      content:    existing.content    ?? '',
      questsDone: existing.questsDone ?? [],
      xpSnapshot: existing.xpSnapshot ?? 0,
      savedAt:    new Date().toISOString(),
    }
    const merged: JournalEntry = { ...base, ...patch, date: key, savedAt: new Date().toISOString() }
    const next: JournalStore = { ...prev, [key]: merged }
    persistJournal(next)
    setLastSaved(new Date())
    return next
  }

  function handleContentChange(val: string) {
    setContent(val)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      setStore(prev => mergeEntry(activeKey, { content: val }, prev))
    }, 700)
  }

  // 성과 블록 생성 — Supabase userQuests 기반
  function generateBlocks() {
    const catColor: Record<string,string> = { writing:'#EEF2FF', business:'#FFFBEB', health:'#ECFDF5' }
  const catTextColor: Record<string,string> = { writing:'#4F46E5', business:'#B45309', health:'#065F46' }
    const catLabel: Record<string,string> = { writing:'집필', business:'비즈니스/공부', health:'자기관리' }
    const newBlocks: AchievementBlock[] = completedQuests.map(id => {
      const quest = userQuests.find(q => q.id === id)
      if (!quest) return null
      return {
        questId: id,
        questName: quest.name,
        emoji: quest.emoji ?? '✅',
        categoryLabel: catLabel[quest.sub] ?? quest.sub,
        categoryColor: catTextColor[quest.sub] ?? '#4F46E5',
        xp: XP_PER_QUEST,
      } as AchievementBlock
    }).filter(Boolean) as AchievementBlock[]

    setStore(prev => mergeEntry(activeKey, {
      blocks: newBlocks,
      questsDone: completedQuests,
      xpSnapshot: newBlocks.length * XP_PER_QUEST,
    }, prev))
    setBlocksDone(true)
    setTimeout(() => setBlocksDone(false), 2000)
  }

  const entryKeys = Object.keys(store).sort((a, b) => b.localeCompare(a))
  if (!entryKeys.includes(todayKey)) entryKeys.unshift(todayKey)
  const totalXp = activeBlocks.length * XP_PER_QUEST

  return (
    <div style={{
      maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '14px 12px' : '28px 48px',
      display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '0' : '24px',
      height: isMobile ? 'auto' : 'calc(100vh - 52px)', overflow: isMobile ? 'visible' : 'hidden',
    }}>

      {/* ── 좌측: 날짜 목록 ── */}
      <div style={{ width: isMobile ? '100%' : '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', overflowY: isMobile ? 'visible' : 'auto', borderBottom: isMobile ? '1px solid rgba(0,0,0,0.06)' : 'none', paddingBottom: isMobile ? '12px' : '0', marginBottom: isMobile ? '12px' : '0' }}>
        <div style={{ paddingBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.06)', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
            <PenLine size={14} color="#6366f1" />
            <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#6366f1', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Journal</p>
          </div>
          <p style={{ margin: '0 0 3px', fontSize: '20px', fontWeight: 900, color: '#37352F' }}>창작 일지</p>
          <p style={{ margin: 0, fontSize: '11px', color: '#787774' }}>{entryKeys.length}개의 기록</p>
        </div>

        {entryKeys.map(key => {
          const entry = store[key]
          const isToday  = key === todayKey
          const isActive = key === activeKey
          const hasBlocks = (entry?.blocks?.length ?? 0) > 0
          const preview  = entry?.content?.replace(/\n/g, ' ')?.slice(0, 42) ?? ''
          return (
            <button key={key} onClick={() => selectEntry(key)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '11px 14px', borderRadius: '12px', border: 'none', cursor: 'pointer',
              backgroundColor: isActive ? 'rgba(99,102,241,0.10)' : 'transparent',
              borderLeft: `3px solid ${isActive ? '#6366f1' : 'transparent'}`,
              marginBottom: '3px', transition: 'all 0.15s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: isActive ? '#4F46E5' : isToday ? '#fbbf24' : '#9B9A97' }}>
                  {isToday ? '📍 오늘' : formatDateKo(key)}
                </span>
                {hasBlocks && (
                  <span style={{ fontSize: '10px', color: '#818cf8', fontWeight: 700 }}>
                    ⚡{(entry!.blocks!.length) * XP_PER_QUEST}XP
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '10px', color: '#AEAAA4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {preview || (isToday ? '오늘의 기록을 시작하세요...' : '내용 없음')}
              </p>
            </button>
          )
        })}
      </div>

      {/* ── 우측: 에디터 ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        backgroundColor: '#F1F1EF', borderRadius: '12px',
        border: '1px solid #1e1e1e', overflow: 'hidden', minWidth: 0,
      }}>

        {/* 헤더 */}
        <div style={{
          padding: '20px 32px 16px', borderBottom: '1px solid #1e1e1e',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <p style={{ margin: 0, fontSize: '11px', color: '#787774', marginBottom: '4px' }}>
              {activeKey === todayKey ? '✍️ 오늘의 일지' : '📖 지난 기록 (읽기 전용)'}
            </p>
            <p style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#37352F' }}>{formatDateKo(activeKey, { full: true })}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {lastSaved && activeKey === todayKey && (
              <span style={{ fontSize: '10px', color: '#AEAAA4' }}>
                자동 저장 {lastSaved.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {activeKey === todayKey && (
              <button
                onClick={generateBlocks}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '8px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  background: blocksDone
                    ? 'linear-gradient(135deg,#065f46,#047857)'
                    : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                  color: '#37352F', fontSize: '12px', fontWeight: 700,
                  boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { if (!blocksDone) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(99,102,241,0.55)' } }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.35)' }}
              >
                {blocksDone ? '✅ 블록 생성 완료!' : activeBlocks.length > 0 ? '🔄 성과 블록 재생성' : '⚡ 오늘의 성과 불러오기'}
              </button>
            )}
          </div>
        </div>

        {/* ── 성과 블록 영역 ── */}
        {activeBlocks.length > 0 && (
          <div style={{
            padding: '20px 32px', borderBottom: '1px solid #1e1e1e',
            backgroundColor: 'rgba(99,102,241,0.03)', flexShrink: 0,
          }}>
            <p style={{ margin: '0 0 14px', fontSize: '11px', fontWeight: 800, color: '#6366f1', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={13} color="#6366f1" />
              오늘의 성과 블록
            </p>
            {/* 블록 카드 갤러리 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              {activeBlocks.map(block => (
                <div key={block.questId} style={{
                  backgroundColor: `${block.categoryColor}0d`,
                  border: `1px solid ${block.categoryColor}30`,
                  borderRadius: '16px', padding: '16px 18px',
                  minWidth: '150px', maxWidth: '200px',
                  transition: 'transform 0.18s, box-shadow 0.18s, border-color 0.18s',
                  cursor: 'default',
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'
                    e.currentTarget.style.boxShadow = `0 10px 32px ${block.categoryColor}28`
                    e.currentTarget.style.borderColor = `${block.categoryColor}60`
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)'
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.borderColor = `${block.categoryColor}30`
                  }}
                >
                  {/* 이모지 + 카테고리 배지 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '24px' }}>{block.emoji}</span>
                    <span style={{
                      fontSize: '9px', fontWeight: 800, color: block.categoryColor,
                      backgroundColor: `${block.categoryColor}18`,
                      border: `1px solid ${block.categoryColor}30`,
                      padding: '2px 8px', borderRadius: '999px', letterSpacing: '0.08em',
                    }}>
                      {block.categoryLabel}
                    </span>
                  </div>
                  {/* 퀘스트명 */}
                  <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: '#37352F', lineHeight: 1.3 }}>{block.questName}</p>
                  {/* XP 배지 */}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    backgroundColor: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
                    borderRadius: '999px', padding: '3px 10px',
                  }}>
                    <span style={{ fontSize: '10px' }}>⚡</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#818cf8' }}>+{block.xp} XP</span>
                  </div>
                </div>
              ))}
            </div>
            {/* 합계 라인 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '12px', color: '#787774' }}>
                총 <strong style={{ color: '#37352F' }}>{activeBlocks.length}개</strong> 퀘스트 완료
              </span>
              <span style={{ width: '1px', height: '12px', backgroundColor: '#EBEBEA' }} />
              <span style={{ fontSize: '12px', color: '#787774' }}>
                총 <strong style={{ color: '#818cf8' }}>{totalXp} XP</strong> 획득
              </span>
              <span style={{ width: '1px', height: '12px', backgroundColor: '#EBEBEA' }} />
              <span style={{ fontSize: '12px', color: '#787774' }}>
                현재 <strong style={{ color: '#7C3AED' }}>Lv.{calculateLevel(xpState.totalXp).currentLevel}</strong> ({calculateLevel(xpState.totalXp).currentLevelXp}/{calculateLevel(xpState.totalXp).maxCurrentLevelXp} XP)
              </span>
            </div>
          </div>
        )}

        {/* 텍스트 영역 */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <RichEditor
            value={content}
            onChange={handleContentChange}
            contentKey={activeKey}
            placeholder={
              activeKey === todayKey
                ? '오늘 하루를 자유롭게 기록해보세요.\n\n어떤 작업을 했나요? 뭔가 막혔던 부분은?\n힘들었던 점, 좋았던 점, 내일의 다짐...'
                : '이 날의 기록이 없습니다.'
            }
            minHeight={320}
            readOnly={activeKey !== todayKey}
          />
        </div>

        {/* 푸터 */}
        <div style={{
          padding: '10px 32px', borderTop: '1px solid #FFFFFF',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: '11px', color: '#AEAAA4' }}>
            {content.length > 0 ? `${content.length.toLocaleString()}자` : ''}
          </span>
          <span style={{ fontSize: '11px', color: '#AEAAA4' }}>
            {activeKey !== todayKey ? '📖 읽기 전용' : '700ms 자동 저장'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════ SAJU 명리 비급서 ════════════════════
const SAJU_KEY   = 'creative_os_saju_v1'
const GOLD       = '#d4a853'
const GOLD_GLOW  = 'rgba(212,168,83,0.18)'
const SAJU_NAVY  = '#F8F8F6'
const SAJU_CARD  = '#FFFFFF'
const SAJU_BDR   = 'rgba(212,168,83,0.22)'

type SajuCard = {
  id: string; title: string
  category: '오행' | '십성' | '신살' | '이론' | '기타'
  summary: string; detail: string; savedAt: string
}
type SajuRecord = {
  id: string; name: string; sajuStr: string
  birthdate: string; analysis: string; savedAt: string
}
type SajuStore = { cards: SajuCard[]; records: SajuRecord[] }
type SajuPanel = {
  mode: 'view-card' | 'view-record' | 'edit-card' | 'edit-record' | 'new-card' | 'new-record'
  item?: SajuCard | SajuRecord
}

const CAT_COL: Record<SajuCard['category'], string> = {
  '오행': '#34d399', '십성': '#818cf8', '신살': '#fbbf24', '이론': '#60a5fa', '기타': '#6B6B6B',
}

const GANGSUL_TRAITS = [
  { label: '핵심 이미지', value: '山上木 · 산 위의 나무' },
  { label: '天干 甲木',   value: '큰 나무 · 직진성 · 개척자 · 창조력' },
  { label: '地支 戌土',   value: '가을 산 · 영적 감수성 · 예술성 · 고독' },
  { label: '강점',        value: '독창적 아이디어 · 끈질긴 추진력 · 심리 통찰' },
  { label: '약점',        value: '고독 과다 · 현실 마찰 후 좌절 · 완벽주의 지연' },
  { label: '직업 적성',   value: '웹툰 작가 · 스토리텔러 · 명리학자 · 심리상담가' },
  { label: '신살',        value: '화개살(華蓋) 내포 — 예술 · 영성 · 철학 기질' },
]

const DEFAULT_SAJU_STORE: SajuStore = {
  records: [],
  cards: [
    { id: 's-mok', title: '甲木 (갑목)', category: '오행', summary: '양목, 큰 나무, 직진성, 성장, 봄의 기운', savedAt: '', detail: `[오행] 木  [음양] 양(陽)  [계절] 봄·인월(寅月)\n\n▸ 핵심 특성\n큰 나무처럼 위를 향해 곧게 뻗는 기운. 지도력, 선도성, 개척자 기질. 한번 결심하면 굽히지 않는 직진력.\n\n▸ 강점\n창의적 사고, 강한 추진력, 명확한 비전 제시\n\n▸ 약점\n고집, 타협 부족, 과다 시 현실 감각 부족\n\n▸ 생극제화\n목생화(木生火), 금극목(金剋木), 목극토(木剋土)` },
    { id: 's-hwa', title: '丙火 (병화)', category: '오행', summary: '양화, 태양, 밝음, 열정, 사교성', savedAt: '', detail: `[오행] 火  [음양] 양(陽)  [계절] 여름·오월(午月)\n\n▸ 핵심 특성\n태양처럼 모든 것을 비추는 밝고 뜨거운 기운. 공명심, 화술, 사교적 매력.\n\n▸ 강점\n카리스마, 낙천성, 표현력, 리더십\n\n▸ 약점\n과시, 성급함, 지속력 부족\n\n▸ 생극제화\n화생토(火生土), 수극화(水剋火)` },
    { id: 's-to',  title: '戊土 (무토)', category: '오행', summary: '양토, 큰 산, 중용, 안정, 포용력', savedAt: '', detail: `[오행] 土  [음양] 양(陽)  [계절] 환절기·진술축미(辰戌丑未)\n\n▸ 핵심 특성\n큰 산처럼 든든하고 변하지 않는 기운. 중재력, 포용력, 신뢰감.\n\n▸ 강점\n안정감, 신용, 끈기, 중립적 판단력\n\n▸ 약점\n변화 둔감, 고집, 답답함\n\n▸ 생극제화\n토생금(土生金), 목극토(木剋土)` },
    { id: 's-bk',  title: '比肩 (비견)', category: '십성', summary: '자아, 동류, 경쟁심, 독립심', savedAt: '', detail: `[십성] 比肩 비견\n[관계] 일간과 같은 오행·같은 음양\n\n▸ 의미\n자신과 같은 기운. 강한 자아, 독립심, 경쟁심.\n\n▸ 긍정적 발현\n자립심, 의지력, 추진력\n\n▸ 부정적 발현 (과다 시)\n아집, 타인 무시, 재물 손실\n\n▸ 역할\n재성(財星) 억제, 관성(官星)과 긴장 관계` },
    { id: 's-hg',  title: '華蓋 (화개살)', category: '신살', summary: '예술성, 영적 감수성, 고독, 종교 인연', savedAt: '', detail: `[신살] 華蓋 화개살\n[계산] 연지·일지 기준 — 술(戌)에 내포\n\n▸ 의미\n"화려한 덮개". 예술·종교·철학의 신살.\n\n▸ 특성\n예술적 재능, 철학적 사고, 영적 감수성. 고독·은둔 기질 동반.\n\n▸ 갑술과 연관\n戌土에 화개살 내포 → 창작자·명리학자 기질 강화. 혼자 깊이 파고드는 집중력.` },
  ],
}

function loadSaju(): SajuStore {
  try {
    const raw = localStorage.getItem(SAJU_KEY)
    if (!raw) return DEFAULT_SAJU_STORE
    const saved: SajuStore = JSON.parse(raw)
    const savedIds = new Set((saved.cards ?? []).map(c => c.id))
    const defaults = DEFAULT_SAJU_STORE.cards.filter(c => !savedIds.has(c.id))
    return { cards: [...defaults, ...(saved.cards ?? [])], records: saved.records ?? [] }
  } catch { return DEFAULT_SAJU_STORE }
}
function saveSaju(data: SajuStore) { localStorage.setItem(SAJU_KEY, JSON.stringify(data)); kvSet(SAJU_KEY, data) }

// ── SajuBigeupSection ────────────────────────────────────────────────────────
function SajuBigeupSection() {
  const [store,     setStore]     = useState<SajuStore>(() => loadSaju())
  const [subTab,    setSubTab]    = useState<'library' | 'records'>('library')
  const [panel,     setPanel]     = useState<SajuPanel | null>(null)
  const [cardDraft, setCardDraft] = useState<Partial<SajuCard>>({})
  const [recDraft,  setRecDraft]  = useState<Partial<SajuRecord>>({})

  function persist(next: SajuStore) { setStore(next); saveSaju(next) }

  function openCard(c: SajuCard)   { setPanel({ mode: 'view-card',   item: c }); setCardDraft({ ...c }) }
  function openRecord(r: SajuRecord){ setPanel({ mode: 'view-record', item: r }); setRecDraft({ ...r }) }
  function openNewCard()   { setPanel({ mode: 'new-card'   }); setCardDraft({ category: '오행', title: '', summary: '', detail: '' }) }
  function openNewRecord() { setPanel({ mode: 'new-record' }); setRecDraft({ name: '', sajuStr: '', birthdate: '', analysis: '' }) }

  function saveCard() {
    const card: SajuCard = {
      id: (panel?.item as SajuCard)?.id ?? `c_${Date.now()}`,
      title: cardDraft.title ?? '', category: cardDraft.category ?? '기타',
      summary: cardDraft.summary ?? '', detail: cardDraft.detail ?? '',
      savedAt: new Date().toISOString(),
    }
    persist({ ...store, cards: panel?.mode === 'new-card' ? [...store.cards, card] : store.cards.map(c => c.id === card.id ? card : c) })
    setPanel(null)
  }
  function saveRecord() {
    const rec: SajuRecord = {
      id: (panel?.item as SajuRecord)?.id ?? `r_${Date.now()}`,
      name: recDraft.name ?? '', sajuStr: recDraft.sajuStr ?? '',
      birthdate: recDraft.birthdate ?? '', analysis: recDraft.analysis ?? '',
      savedAt: new Date().toISOString(),
    }
    persist({ ...store, records: panel?.mode === 'new-record' ? [...store.records, rec] : store.records.map(r => r.id === rec.id ? rec : r) })
    setPanel(null)
  }
  function delCard(id: string)   { persist({ ...store, cards:   store.cards.filter(c => c.id !== id)   }); setPanel(null) }
  function delRecord(id: string) { persist({ ...store, records: store.records.filter(r => r.id !== id) }); setPanel(null) }

  const isCard    = panel?.mode?.includes('card')
  const isEditing = panel?.mode?.startsWith('edit') || panel?.mode?.startsWith('new')
  const inp = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    width: '100%', backgroundColor: '#F4F4F2', border: `1px solid rgba(212,168,83,0.28)`,
    borderRadius: '10px', padding: '10px 14px', color: '#e8d5a3', fontSize: '13px',
    outline: 'none', boxSizing: 'border-box', ...extra,
  })

  return (
    <div style={{ marginTop: '36px' }}>
      {/* 섹션 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
        <Scroll size={17} color={GOLD} />
        <span style={{ fontSize: '11px', fontWeight: 800, color: GOLD, letterSpacing: '0.22em', textTransform: 'uppercase' }}>
          Saju · 사주 명리 비급서
        </span>
        <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg,${GOLD_GLOW},transparent)` }} />
      </div>

      {/* 메인 컨테이너 — 다크 네이비 */}
      <div style={{ backgroundColor: SAJU_NAVY, borderRadius: '16px', border: `1px solid ${SAJU_BDR}`, overflow: 'hidden' }}>

        {/* ── 갑술 근본 카드 ── */}
        <div style={{ padding: '30px 36px', borderBottom: `1px solid ${SAJU_BDR}`, background: 'linear-gradient(140deg,#0e1228 0%,#0b0d1c 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
            <Sparkles size={15} color={GOLD} />
            <span style={{ fontSize: '10px', fontWeight: 800, color: GOLD, letterSpacing: '0.2em', textTransform: 'uppercase' }}>나의 근본 일주</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '22px' }}>
            <h2 style={{ margin: 0, fontSize: '34px', fontWeight: 900, color: '#37352F', fontFamily: 'serif', letterSpacing: '-1px' }}>甲戌 (갑술)</h2>
            <span style={{ fontSize: '14px', color: GOLD, fontWeight: 600 }}>산 위의 나무 · 山上木</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
            {GANGSUL_TRAITS.map(t => (
              <div key={t.label}
                style={{ backgroundColor: 'rgba(212,168,83,0.05)', border: `1px solid rgba(212,168,83,0.14)`, borderRadius: '12px', padding: '12px 14px', transition: 'all 0.18s', cursor: 'default' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(212,168,83,0.11)'; e.currentTarget.style.borderColor = 'rgba(212,168,83,0.32)' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(212,168,83,0.05)'; e.currentTarget.style.borderColor = 'rgba(212,168,83,0.14)' }}
              >
                <p style={{ margin: '0 0 5px', fontSize: '9px', fontWeight: 800, color: GOLD, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t.label}</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#ccc', lineHeight: 1.55 }}>{t.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 서브탭 바 ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', borderBottom: `1px solid ${SAJU_BDR}` }}>
          <div style={{ display: 'flex' }}>
            {([
              { id: 'library' as const, label: '📚 명리 지식 창고', count: store.cards.length },
              { id: 'records' as const, label: '☯ 임상 기록부',    count: store.records.length },
            ]).map(t => (
              <button key={t.id} onClick={() => setSubTab(t.id)} style={{
                padding: '14px 20px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent',
                borderBottom: `2px solid ${subTab === t.id ? GOLD : 'transparent'}`,
                color: subTab === t.id ? '#fff' : '#787774',
                fontSize: '13px', fontWeight: subTab === t.id ? 700 : 500, transition: 'all 0.15s',
              }}>
                {t.label}
                <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 700, color: subTab === t.id ? GOLD : '#AEAAA4' }}>{t.count}</span>
              </button>
            ))}
          </div>
          <button onClick={subTab === 'library' ? openNewCard : openNewRecord} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 16px', borderRadius: '8px', border: `1px solid ${SAJU_BDR}`,
            backgroundColor: 'rgba(212,168,83,0.07)', color: GOLD,
            fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(212,168,83,0.16)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(212,168,83,0.07)' }}
          >
            <Plus size={13} color={GOLD} />
            {subTab === 'library' ? '이론 카드 추가' : '기록 추가'}
          </button>
        </div>

        {/* ── 명리 지식 창고 ── */}
        {subTab === 'library' && (
          <div style={{ padding: '26px 32px' }}>
            {store.cards.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <Scroll size={30} color="#37352F" />
                <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#AEAAA4' }}>이론 카드가 없습니다</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px' }}>
                {store.cards.map(card => (
                  <div key={card.id} onClick={() => openCard(card)} style={{
                    backgroundColor: SAJU_CARD, border: `1px solid ${SAJU_BDR}`,
                    borderRadius: '16px', padding: '18px 20px', cursor: 'pointer', transition: 'all 0.18s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${CAT_COL[card.category]}55`; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 12px 36px rgba(0,0,0,0.5)` }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = SAJU_BDR; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', color: CAT_COL[card.category], backgroundColor: `${CAT_COL[card.category]}15`, border: `1px solid ${CAT_COL[card.category]}30`, padding: '2px 9px', borderRadius: '999px' }}>
                        {card.category}
                      </span>
                      <ChevronRight size={13} color="#3f3f46" />
                    </div>
                    <p style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 800, color: '#e8d5a3', fontFamily: 'serif' }}>{card.title}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#787774', lineHeight: 1.5 }}>{card.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 임상 기록부 ── */}
        {subTab === 'records' && (
          <div style={{ padding: '26px 32px' }}>
            {store.records.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <BookOpen size={30} color="#37352F" />
                <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#AEAAA4' }}>분석 기록이 없습니다</p>
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#37352F' }}>주변 인물 또는 작품 캐릭터의 사주를 기록해보세요</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {store.records.map(rec => (
                  <div key={rec.id} onClick={() => openRecord(rec)} style={{
                    display: 'flex', alignItems: 'center', gap: '16px',
                    backgroundColor: SAJU_CARD, border: `1px solid ${SAJU_BDR}`,
                    borderRadius: '12px', padding: '14px 18px', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = `rgba(212,168,83,0.42)`; e.currentTarget.style.transform = 'translateX(4px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = SAJU_BDR; e.currentTarget.style.transform = 'translateX(0)' }}
                  >
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0, background: 'linear-gradient(135deg,#1a1f35,#0b0d1c)', border: `1px solid rgba(212,168,83,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>☯</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '3px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#e8d5a3' }}>{rec.name}</span>
                        {rec.sajuStr && (
                          <span style={{ fontSize: '11px', color: GOLD, fontFamily: 'serif', fontWeight: 700, backgroundColor: 'rgba(212,168,83,0.08)', border: `1px solid rgba(212,168,83,0.22)`, padding: '1px 10px', borderRadius: '999px' }}>
                            {rec.sajuStr}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '11px', color: '#787774', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rec.analysis?.slice(0, 64) || '분석 내용 없음'}
                      </p>
                    </div>
                    <ChevronRight size={14} color="#3f3f46" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 사이드 패널 ── */}
      {panel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 6000 }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.68)' }} onClick={() => setPanel(null)} />
          <div style={{
            position: 'absolute', right: 0, top: 0, height: '100%', width: '520px',
            backgroundColor: SAJU_NAVY, borderLeft: `1px solid ${SAJU_BDR}`,
            display: 'flex', flexDirection: 'column',
            animation: 'slideInRight 0.22s ease-out',
          }}>
            {/* 패널 헤더 */}
            <div style={{ padding: '22px 28px', borderBottom: `1px solid ${SAJU_BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <Scroll size={15} color={GOLD} />
                <span style={{ fontSize: '11px', fontWeight: 800, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                  {isCard ? '이론 카드' : '임상 기록'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {(panel.mode === 'view-card' || panel.mode === 'view-record') && (
                  <button onClick={() => setPanel(p => p ? { ...p, mode: p.mode === 'view-card' ? 'edit-card' : 'edit-record' } : null)} style={{ padding: '6px 14px', borderRadius: '8px', border: `1px solid rgba(212,168,83,0.3)`, backgroundColor: 'rgba(212,168,83,0.08)', color: GOLD, fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(212,168,83,0.18)' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(212,168,83,0.08)' }}
                  >편집</button>
                )}
                <button onClick={() => setPanel(null)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#F4F4F2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#EBEBEA' }}
                >
                  <X size={14} color="#9ca3af" />
                </button>
              </div>
            </div>

            {/* 패널 콘텐츠 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 0' }}>
              {isCard && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* 카테고리 */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>카테고리</label>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {(['오행','십성','신살','이론','기타'] as SajuCard['category'][]).map(cat => (
                          <button key={cat} onClick={() => setCardDraft(d => ({ ...d, category: cat }))} style={{ padding: '5px 14px', borderRadius: '999px', border: `1px solid ${cardDraft.category === cat ? CAT_COL[cat] : 'transparent'}`, backgroundColor: cardDraft.category === cat ? `${CAT_COL[cat]}18` : 'rgba(0,0,0,0.03)', color: cardDraft.category === cat ? CAT_COL[cat] : '#787774', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.12s' }}>
                            {cat}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: '11px', fontWeight: 800, color: CAT_COL[cardDraft.category ?? '기타'], backgroundColor: `${CAT_COL[cardDraft.category ?? '기타']}15`, border: `1px solid ${CAT_COL[cardDraft.category ?? '기타']}30`, padding: '3px 12px', borderRadius: '999px' }}>
                        {cardDraft.category}
                      </span>
                    )}
                  </div>
                  {/* 제목 */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>제목</label>
                    {isEditing ? <input value={cardDraft.title ?? ''} onChange={e => setCardDraft(d => ({ ...d, title: e.target.value }))} placeholder="예: 甲木 (갑목)" style={inp({ fontSize: '15px', fontWeight: 700, fontFamily: 'serif', color: '#e8d5a3' })} />
                      : <p style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#e8d5a3', fontFamily: 'serif' }}>{cardDraft.title}</p>}
                  </div>
                  {/* 요약 */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>요약</label>
                    {isEditing ? <input value={cardDraft.summary ?? ''} onChange={e => setCardDraft(d => ({ ...d, summary: e.target.value }))} placeholder="한 줄 요약" style={inp()} />
                      : <p style={{ margin: 0, fontSize: '13px', color: '#9B9A97', lineHeight: 1.6 }}>{cardDraft.summary}</p>}
                  </div>
                  {/* 상세 */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>상세 내용</label>
                    {isEditing
                      ? <textarea value={cardDraft.detail ?? ''} onChange={e => setCardDraft(d => ({ ...d, detail: e.target.value }))} placeholder="특성, 생극제화, 활용법 등..." rows={12} style={inp({ lineHeight: '1.8', resize: 'vertical', fontFamily: 'serif' }) as React.CSSProperties} />
                      : <div style={{ backgroundColor: '#F4F4F2', border: `1px solid ${SAJU_BDR}`, borderRadius: '10px', padding: '18px 20px' }}>
                          <pre style={{ margin: 0, fontSize: '13px', color: '#37352F', lineHeight: '1.9', fontFamily: 'serif', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{cardDraft.detail}</pre>
                        </div>
                    }
                  </div>
                </div>
              )}

              {!isCard && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* 인물명 */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>인물 / 캐릭터명</label>
                    {isEditing ? <input value={recDraft.name ?? ''} onChange={e => setRecDraft(d => ({ ...d, name: e.target.value }))} placeholder="예: 김00, 웹툰 주인공A" style={inp({ fontSize: '15px', fontWeight: 700, color: '#e8d5a3' })} />
                      : <p style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#e8d5a3' }}>{recDraft.name}</p>}
                  </div>
                  {/* 사주 + 생년월일 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>사주 표기</label>
                      {isEditing ? <input value={recDraft.sajuStr ?? ''} onChange={e => setRecDraft(d => ({ ...d, sajuStr: e.target.value }))} placeholder="甲戌 壬子 庚辰 丙午" style={inp({ color: GOLD, fontFamily: 'serif' })} />
                        : <p style={{ margin: 0, fontSize: '14px', color: GOLD, fontFamily: 'serif', fontWeight: 700 }}>{recDraft.sajuStr || '—'}</p>}
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>생년월일</label>
                      {isEditing ? <input value={recDraft.birthdate ?? ''} onChange={e => setRecDraft(d => ({ ...d, birthdate: e.target.value }))} placeholder="1990-05-10" style={inp()} />
                        : <p style={{ margin: 0, fontSize: '13px', color: '#9B9A97' }}>{recDraft.birthdate || '—'}</p>}
                    </div>
                  </div>
                  {/* 분석 기록 */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>분석 기록</label>
                    {isEditing
                      ? <textarea value={recDraft.analysis ?? ''} onChange={e => setRecDraft(d => ({ ...d, analysis: e.target.value }))} placeholder="용신, 격국, 특성 분석, 운세 흐름..." rows={12} style={inp({ lineHeight: '1.8', resize: 'vertical', fontFamily: 'serif' }) as React.CSSProperties} />
                      : <div style={{ backgroundColor: '#F4F4F2', border: `1px solid ${SAJU_BDR}`, borderRadius: '10px', padding: '18px 20px' }}>
                          <pre style={{ margin: 0, fontSize: '13px', color: '#37352F', lineHeight: '1.9', fontFamily: 'serif', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{recDraft.analysis || '분석 내용이 없습니다'}</pre>
                        </div>
                    }
                  </div>
                </div>
              )}
            </div>

            {/* 패널 푸터 */}
            {isEditing && (
              <div style={{ padding: '20px 28px', borderTop: `1px solid ${SAJU_BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                  {(panel.mode === 'edit-card' || panel.mode === 'edit-record') && panel.item && (
                    <button onClick={() => isCard ? delCard((panel.item as SajuCard).id) : delRecord((panel.item as SajuRecord).id)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.07)', color: '#ef4444', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.16)' }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.07)' }}
                    >삭제</button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setPanel(null)} style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: 'transparent', color: '#9B9A97', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>취소</button>
                  <button onClick={isCard ? saveCard : saveRecord} style={{ padding: '8px 24px', borderRadius: '8px', border: `1px solid ${SAJU_BDR}`, background: 'linear-gradient(135deg,#1a1a2e,#0f1428)', color: GOLD, fontSize: '12px', fontWeight: 800, cursor: 'pointer', boxShadow: `0 4px 16px rgba(212,168,83,0.2)`, transition: 'box-shadow 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 8px 28px rgba(212,168,83,0.38)` }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 4px 16px rgba(212,168,83,0.2)` }}
                  >저장</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════ LIBRARY PAGE ════════════════════════
function LibraryPage({ xpState, completedQuestsCount, onNavigate }: {
  xpState: XpState
  completedQuestsCount: number
  onNavigate: (page: 'worlds' | 'journal') => void
}) {
  const isMobile = useIsMobile()
  const journalStore = loadJournal()
  const journalEntries = Object.values(journalStore).sort((a, b) => b.date.localeCompare(a.date))
  const [worldsData] = useState<Record<string, Record<string, string>>>(() => loadWorldData())

  const heroStats = [
    {
      label: '현재 레벨', value: `Lv.${calculateLevel(xpState.totalXp).currentLevel}`,
      sub: getLevelTitle(calculateLevel(xpState.totalXp).currentLevel), col: '#818cf8',
      icon: <Trophy size={20} color="#818cf8" />,
    },
    {
      label: '누적 경험치', value: `${xpState.totalXp.toLocaleString()} XP`,
      sub: `다음 레벨까지 ${calculateLevel(xpState.totalXp).maxCurrentLevelXp - calculateLevel(xpState.totalXp).currentLevelXp} XP`,
      col: '#fbbf24', icon: <BarChart3 size={20} color="#fbbf24" />,
    },
    {
      label: '완료 퀘스트', value: `${completedQuestsCount}개`,
      sub: '오늘 기준 완료', col: '#34d399',
      icon: <CheckCircle2 size={20} color="#34d399" />,
    },
    {
      label: '일지 기록', value: `${journalEntries.length}일`,
      sub: '창작 여정의 발자국', col: '#f472b6',
      icon: <CalendarDays size={20} color="#f472b6" />,
    },
  ]

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '14px 12px' : '28px 44px' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <BookOpen size={14} color="#6366f1" />
            <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#6366f1', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Library</p>
          </div>
          <p style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 800, color: '#37352F', letterSpacing: '-0.5px' }}>마스터 보드</p>
          <p style={{ margin: 0, fontSize: '13px', color: '#787774' }}>나의 모든 창작 데이터를 한눈에 관리하는 공간</p>
        </div>
      </div>

      {/* ── 성장 통계 히어로 카드 4개 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
        {heroStats.map(s => (
          <div key={s.label}
            style={{
              backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '20px 22px',
              border: '1px solid rgba(0,0,0,0.06)', transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.boxShadow = `0 16px 48px ${s.col}20`
              e.currentTarget.style.borderColor = `${s.col}40`
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.borderColor = '#EBEBEA'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#787774', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</span>
              {s.icon}
            </div>
            <p style={{
              margin: '0 0 5px', fontSize: '30px', fontWeight: 900, color: s.col, lineHeight: 1,
              textShadow: `0 0 24px ${s.col}44`,
            }}>{s.value}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#787774' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── 2열: 집필 실록 + 프로젝트 아카이브 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* 집필 실록 */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '28px', border: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <PenLine size={16} color="#818cf8" />
              <div>
                <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#6366f1', letterSpacing: '0.12em', textTransform: 'uppercase' }}>집필 실록</p>
                <p style={{ margin: '3px 0 0', fontSize: '15px', fontWeight: 800, color: '#37352F' }}>날짜별 일지 아카이브</p>
              </div>
            </div>
            <button onClick={() => onNavigate('journal')} style={{
              fontSize: '11px', color: '#6366f1', background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.25)', padding: '5px 14px',
              borderRadius: '999px', cursor: 'pointer', fontWeight: 700, transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.18)' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.08)' }}
            >
              Journal 열기 →
            </button>
          </div>

          {journalEntries.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <PenLine size={32} color="#F1F1EF" style={{ marginBottom: '12px' }} />
              <p style={{ margin: 0, fontSize: '13px', color: '#AEAAA4' }}>아직 일지가 없습니다</p>
              <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#37352F' }}>Journal 탭에서 첫 기록을 남겨보세요</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
              {journalEntries.map(entry => {
                const blockCount = entry.blocks?.length ?? 0
                return (
                  <div key={entry.date}
                    onClick={() => onNavigate('journal')}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '14px',
                      padding: '13px 16px', borderRadius: '12px', cursor: 'pointer',
                      backgroundColor: '#F4F4F2', border: '1px solid #202020',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.32)'
                      e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.05)'
                      e.currentTarget.style.transform = 'translateX(3px)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#EBEBEA'
                      e.currentTarget.style.backgroundColor = '#F7F7F5'
                      e.currentTarget.style.transform = 'translateX(0)'
                    }}
                  >
                    {/* 날짜 캘린더 아이콘 */}
                    <div style={{
                      flexShrink: 0, width: '44px', height: '44px', borderRadius: '12px',
                      backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', border: '1px solid #2a2a2a',
                    }}>
                      <span style={{ fontSize: '9px', color: '#787774', lineHeight: 1 }}>
                        {new Date(entry.date + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'short' })}
                      </span>
                      <span style={{ fontSize: '17px', fontWeight: 900, color: '#37352F', lineHeight: 1.1 }}>
                        {new Date(entry.date + 'T00:00:00').getDate()}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#37352F' }}>{formatDateKo(entry.date)}</span>
                        {blockCount > 0 && (
                          <span style={{
                            fontSize: '10px', color: '#818cf8', fontWeight: 700,
                            backgroundColor: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.22)',
                            padding: '1px 8px', borderRadius: '999px',
                          }}>
                            ⚡+{blockCount * XP_PER_QUEST} XP
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '11px', color: '#787774', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.content?.replace(/\n/g, ' ')?.slice(0, 64) || '내용 없음'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 프로젝트 아카이브 */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '28px', border: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Archive size={16} color="#fbbf24" />
              <div>
                <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#fbbf24', letterSpacing: '0.12em', textTransform: 'uppercase' }}>프로젝트 아카이브</p>
                <p style={{ margin: '3px 0 0', fontSize: '15px', fontWeight: 800, color: '#37352F' }}>Worlds 기획안 현황</p>
              </div>
            </div>
            <button onClick={() => onNavigate('worlds')} style={{
              fontSize: '11px', color: '#fbbf24', background: 'rgba(251,191,36,0.08)',
              border: '1px solid rgba(251,191,36,0.25)', padding: '5px 14px',
              borderRadius: '999px', cursor: 'pointer', fontWeight: 700, transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(251,191,36,0.16)' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(251,191,36,0.08)' }}
            >
              Worlds 열기 →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {WORLDS.map(world => {
              const secs = worldsData[world.id] ?? {}
              const totalChars = Object.values(secs).reduce((acc, v) => acc + (v?.length ?? 0), 0)
              return (
                <div key={world.id}
                  onClick={() => onNavigate('worlds')}
                  style={{
                    padding: '18px 20px', borderRadius: '16px', cursor: 'pointer',
                    backgroundColor: '#F4F4F2', border: '1px solid #202020',
                    transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = world.border
                    e.currentTarget.style.backgroundColor = `${world.accent}06`
                    e.currentTarget.style.transform = 'translateX(4px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#EBEBEA'
                    e.currentTarget.style.backgroundColor = '#F7F7F5'
                    e.currentTarget.style.transform = 'translateX(0)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '26px' }}>{world.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#37352F' }}>{world.name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#787774' }}>{world.tagline}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: totalChars > 0 ? world.accent : '#F1F1EF', lineHeight: 1 }}>
                        {totalChars.toLocaleString()}
                      </p>
                      <p style={{ margin: 0, fontSize: '9px', color: '#787774' }}>자 작성</p>
                    </div>
                  </div>
                  {/* 섹션 진행 바 */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {world.sections.map(sec => {
                      const has = (secs[sec.id]?.length ?? 0) > 0
                      return (
                        <div key={sec.id} title={sec.title} style={{
                          flex: 1, height: '4px', borderRadius: '999px',
                          backgroundColor: has ? world.accent : '#EBEBEA',
                          boxShadow: has ? `0 0 6px ${world.accent}55` : 'none',
                          transition: 'background 0.3s',
                        }} />
                      )
                    })}
                  </div>
                  <p style={{ margin: '7px 0 0', fontSize: '10px', color: '#787774' }}>
                    {world.sections.filter(s => (secs[s.id]?.length ?? 0) > 0).length} / {world.sections.length} 섹션 작성됨
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── 사주 명리 비급서 섹션 ── */}
      <SajuBigeupSection />
    </div>
  )
}

// ═══════════════════════════════════════ CALENDAR ════════════════════════════
const CALENDAR_KEY = 'creative_os_calendar_v1'
const EVENT_PALETTE = ['#6366f1','#f97316','#34d399','#f472b6','#fbbf24','#60a5fa','#7C3AED']

type CalEvent = {
  id: string; title: string
  startDate: string; endDate: string
  color: string; note: string
}
type CalStore = { events: CalEvent[] }

const SAMPLE_EVENTS: CalEvent[] = [
  { id: 'osaka-2026', title: '🗾 오사카 여행', startDate: '2026-04-27', endDate: '2026-04-30', color: '#f97316', note: '오사카성 · 만화박물관 · 도톤보리 거리 탐방' },
]

function loadCalendar(): CalStore {
  try {
    const raw = localStorage.getItem(CALENDAR_KEY)
    if (!raw) return { events: SAMPLE_EVENTS }
    const saved: CalStore = JSON.parse(raw)
    const existing = new Set(saved.events.map(e => e.id))
    return { events: [...SAMPLE_EVENTS.filter(e => !existing.has(e.id)), ...saved.events] }
  } catch { return { events: SAMPLE_EVENTS } }
}
function saveCalendar(d: CalStore) { localStorage.setItem(CALENDAR_KEY, JSON.stringify(d)); kvSet(CALENDAR_KEY, d) }

function buildCalGrid(year: number, month: number): string[][] {
  const firstDow = new Date(year, month, 1).getDay()
  return Array.from({ length: 6 }, (_, wi) =>
    Array.from({ length: 7 }, (_, di) => {
      const d = new Date(year, month, 1 - firstDow + wi * 7 + di)
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    })
  )
}

type WeekEvent = CalEvent & { sc: number; ec: number; level: number }
function getWeekEvents(week: string[], events: CalEvent[]): WeekEvent[] {
  const ws = week[0], we = week[6]
  const inWeek = events
    .filter(e => e.endDate >= ws && e.startDate <= we)
    .map(e => ({
      ...e,
      sc: e.startDate < ws ? 0 : week.indexOf(e.startDate),
      ec: e.endDate   > we ? 6 : week.indexOf(e.endDate),
    }))
    .sort((a, b) => a.sc - b.sc || b.ec - a.ec)
  const slots: number[] = []
  return inWeek.map(ev => {
    let lv = 0
    while (slots[lv] !== undefined && slots[lv] >= ev.sc) lv++
    slots[lv] = ev.ec
    return { ...ev, level: lv }
  })
}

// ══════════════════════════════════════════════════════════════════════════════
//  UNIFIED CALENDAR — 퀘스트 마감일 + 데일리 저널 + 운세/기운 기록 통합
// ══════════════════════════════════════════════════════════════════════════════
type UnifiedEventType = 'quest' | 'journal' | 'fortune'
type UnifiedEvent = { id: string; date: string; type: UnifiedEventType; title: string; meta?: unknown }

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function UnifiedCalendar({ onOpenNote, userQuests, refreshTrigger = 0 }: { onOpenNote: (id: string, title: string) => void; userQuests: Card[]; refreshTrigger?: number }) {
  const isMobile = useIsMobile()
  const todayStr = toYMD(new Date())
  const [viewDate, setViewDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr)
  const [filterQuest, setFilterQuest] = useState(true)
  const [filterJournal, setFilterJournal] = useState(true)
  const [filterFortune, setFilterFortune] = useState(true)
  const [dailyLogs, setDailyLogs] = useState<{ log_date: string; fortune_feedback?: string | null }[]>([])
  const [journalNotes, setJournalNotes] = useState<JournalNoteRow[]>([])
  const [readingLogs, setReadingLogs] = useState<ReadingLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReading, setSelectedReading] = useState<ReadingLogRow | null>(null)

  const startStr = toYMD(new Date(viewDate.getFullYear(), viewDate.getMonth(), 1))
  const endDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0)
  const endStr = toYMD(endDate)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const [logs, notes, readings] = await Promise.all([
        fetchDailyLogsInRange(startStr, endStr),
        fetchJournalNotes(),
        fetchReadingLogsInRange(startStr, endStr),
      ])
      setDailyLogs(logs)
      setJournalNotes(notes)
      setReadingLogs(readings)
      setLoading(false)
    })()
  }, [startStr, endStr, refreshTrigger])

  const mergedEvents = useMemo((): UnifiedEvent[] => {
    const out: UnifiedEvent[] = []
    if (filterQuest) {
      for (const q of userQuests) {
        if (q.deadline) out.push({ id: `q-${q.id}`, date: q.deadline, type: 'quest', title: q.name, meta: q })
      }
    }
    if (filterJournal) {
      for (const n of journalNotes) {
        out.push({ id: `j-${n.id}`, date: n.record_date, type: 'journal', title: n.title, meta: n })
      }
    }
    if (filterFortune) {
      for (const l of dailyLogs) {
        if (l.fortune_feedback && l.fortune_feedback.trim()) {
          out.push({ id: `f-dl-${l.log_date}`, date: l.log_date, type: 'fortune', title: '운세 기록', meta: l })
        }
      }
      for (const r of readingLogs) {
        const d = new Date(r.created_at)
        const dateKey = toYMD(d)
        const cardsStr = (r.drawn_cards ?? []).map(c => `${c.emoji} ${c.name_ko}${c.name_en ? ` (${c.name_en})` : ''}`).join(' | ')
        const title = cardsStr ? `[🔮 운세] ${cardsStr}` : '[🔮 운세]'
        out.push({ id: `r-${r.id}`, date: dateKey, type: 'fortune', title, meta: r })
      }
    }
    return out
  }, [userQuests, journalNotes, dailyLogs, readingLogs, filterQuest, filterJournal, filterFortune])

  const eventsByDate = useMemo(() => {
    const m: Record<string, UnifiedEvent[]> = {}
    for (const e of mergedEvents) {
      if (!m[e.date]) m[e.date] = []
      m[e.date].push(e)
    }
    return m
  }, [mergedEvents])

  const dayDots = useCallback((date: Date) => {
    const dk = toYMD(date)
    const evs = eventsByDate[dk] ?? []
    const hasQuest = evs.some(e => e.type === 'quest')
    const hasJournal = evs.some(e => e.type === 'journal')
    const hasFortune = evs.some(e => e.type === 'fortune')
    return (
      <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', marginTop: '2px' }}>
        {hasQuest && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'block' }} title="퀘스트 마감일" />}
        {hasJournal && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'block' }} title="데일리 저널" />}
        {hasFortune && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#7C3AED', display: 'block' }} title="운세/기운 기록" />}
      </div>
    )
  }, [eventsByDate])

  const dayEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : []
  const dayQuests = dayEvents.filter(e => e.type === 'quest').map(e => e.meta as Card)
  const dayJournals = dayEvents.filter(e => e.type === 'journal').map(e => e.meta as JournalNoteRow)
  const dayFortuneLog = dayEvents.find(e => e.type === 'fortune' && e.id.startsWith('f-dl-'))?.meta as { fortune_feedback?: string } | undefined
  const dayReadings = dayEvents.filter(e => e.type === 'fortune' && e.id.startsWith('r-')).map(e => e.meta as ReadingLogRow)

  function fmtDateKo(dk: string) {
    const d = new Date(dk + 'T00:00:00')
    return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
  }

  async function handleDeleteReadingFromCalendar(id: string) {
    if (!window.confirm('이 기록을 정말 삭제하시겠습니까?')) return
    const ok = await deleteReadingLog(id)
    if (ok) {
      setReadingLogs(prev => prev.filter(r => r.id !== id))
      setSelectedReading(null)
    }
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '14px 12px' : '28px 44px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: '#37352F' }}>📅 통합 캘린더</h1>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#787774' }}>퀘스트 마감일, 저널, 운세 기록을 한눈에 확인하세요</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 280px', gap: '24px', alignItems: 'start' }}>
        {/* 캘린더 + 필터 */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.06)', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {/* 필터 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#9B9A97', letterSpacing: '0.1em' }}>표시할 항목</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#37352F' }}>
              <input type="checkbox" checked={filterQuest} onChange={e => setFilterQuest(e.target.checked)} />
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} /> 퀘스트 마감일
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#37352F' }}>
              <input type="checkbox" checked={filterJournal} onChange={e => setFilterJournal(e.target.checked)} />
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }} /> 데일리 저널
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#37352F' }}>
              <input type="checkbox" checked={filterFortune} onChange={e => setFilterFortune(e.target.checked)} />
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#7C3AED' }} /> 운세/기운 기록
            </label>
          </div>

          {loading ? (
            <div style={{ height: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#787774', fontSize: '14px' }}>데이터 불러오는 중…</div>
          ) : (
            <div style={{ fontSize: '14px' }} className="unified-calendar-wrapper">
              <Calendar
                value={viewDate}
                onChange={(v) => { const d = v as Date; setSelectedDate(toYMD(d)) }}
                onActiveStartDateChange={({ activeStartDate }) => activeStartDate && setViewDate(activeStartDate)}
                tileContent={({ date }) => dayDots(date)}
                locale="ko-KR"
                formatShortWeekday={(_, d) => ['일','월','화','수','목','금','토'][d.getDay()]}
              />
            </div>
          )}
        </div>

        {/* 날짜별 요약 패널 */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.06)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', position: isMobile ? 'relative' : 'sticky', top: isMobile ? 0 : 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 800, color: '#37352F' }}>
            {selectedDate ? fmtDateKo(selectedDate) : '날짜를 선택하세요'}
          </h3>
          {!selectedDate ? (
            <p style={{ margin: 0, fontSize: '13px', color: '#9B9A97' }}>캘린더에서 날짜를 클릭하면 해당 날짜의 퀘스트, 저널, 운세 기록을 볼 수 있습니다.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {dayQuests.length > 0 && (
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: '#ef4444', letterSpacing: '0.05em' }}>퀘스트 마감일</p>
                  <ul style={{ margin: 0, paddingLeft: '18px' }}>
                    {dayQuests.map(q => (
                      <li key={q.id} style={{ marginBottom: '4px', fontSize: '13px', color: '#37352F' }}>{q.name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {dayJournals.length > 0 && (
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: '#3b82f6', letterSpacing: '0.05em' }}>데일리 저널</p>
                  <ul style={{ margin: 0, paddingLeft: '18px', listStyle: 'none' }}>
                    {dayJournals.map(n => (
                      <li key={n.id} style={{ marginBottom: '6px' }}>
                        <button onClick={() => onOpenNote(String(n.id), n.title)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '13px', color: '#6366f1', fontWeight: 600, textAlign: 'left' }}>{n.title}</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {dayFortuneLog?.fortune_feedback && (
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: '#7C3AED', letterSpacing: '0.05em' }}>운세 피드백 (Fortune Journal)</p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#6B6B6B', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{dayFortuneLog.fortune_feedback}</p>
                </div>
              )}
              {dayReadings.length > 0 && (
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: '#7C3AED', letterSpacing: '0.05em' }}>타로 점괘 기록</p>
                  <ul style={{ margin: 0, paddingLeft: '18px', listStyle: 'none' }}>
                    {dayReadings.map(r => {
                      const drawn = r.drawn_cards ?? []
                      return (
                        <li key={r.id} style={{ marginBottom: '8px' }}>
                          <button
                            onClick={() => setSelectedReading(r)}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '10px 14px',
                              borderRadius: '10px',
                              border: '1px solid rgba(124,58,237,0.2)',
                              backgroundColor: 'rgba(124,58,237,0.04)',
                              fontSize: '13px',
                              color: '#37352F',
                              lineHeight: 1.5,
                              cursor: 'pointer',
                              transition: 'background-color 0.2s, border-color 0.2s',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.backgroundColor = 'rgba(124,58,237,0.1)'
                              e.currentTarget.style.borderColor = 'rgba(124,58,237,0.35)'
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.backgroundColor = 'rgba(124,58,237,0.04)'
                              e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', rowGap: '4px' }}>
                              <span style={{ color: '#7C3AED', fontWeight: 600 }}>[🔮 운세]</span>
                              <span>{r.question}</span>
                              {drawn.length > 0 && (
                                <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {drawn.map((c, i) => (
                                    <span key={i} style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                                      padding: '2px 8px', borderRadius: '6px',
                                      backgroundColor: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)',
                                      fontSize: '11px', fontWeight: 600, color: '#7C3AED',
                                    }}>
                                      <span style={{ fontSize: '12px' }}>{c.emoji}</span>
                                      {c.name_ko}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
              {dayQuests.length === 0 && dayJournals.length === 0 && !dayFortuneLog?.fortune_feedback && dayReadings.length === 0 && (
                <p style={{ margin: 0, fontSize: '13px', color: '#9B9A97' }}>이 날짜에 기록된 내용이 없습니다.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 점괘 상세 모달 */}
      {selectedReading && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setSelectedReading(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '420px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#7C3AED' }}>🔮 타로 점괘 상세</h3>
              <button onClick={() => setSelectedReading(null)} style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#9B9A97' }}><X size={20} /></button>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, color: '#9B9A97' }}>질문</p>
            <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#37352F', lineHeight: 1.6 }}>{selectedReading.question}</p>
            <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, color: '#9B9A97' }}>뽑은 카드</p>
            <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              {(selectedReading.drawn_cards ?? []).length > 0
                ? renderDrawnCards(selectedReading.drawn_cards)
                : <span style={{ fontSize: '14px', color: '#9B9A97' }}>없음</span>}
            </div>
            <p style={{ margin: '0 0 20px', fontSize: '11px', color: '#9B9A97' }}>
              {new Date(selectedReading.created_at).toLocaleString('ko-KR')}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => handleDeleteReadingFromCalendar(selectedReading.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid rgba(239,68,68,0.4)',
                  backgroundColor: 'rgba(239,68,68,0.08)',
                  color: '#ef4444',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={16} /> 삭제
              </button>
              <button onClick={() => setSelectedReading(null)} style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  JOURNAL CALENDAR PAGE  — Supabase journal_categories + journals 전용
//  퀘스트 시스템과 완전히 독립적
// ══════════════════════════════════════════════════════════════════════════════
function JournalCalendarPage({ onOpenNote }: { onOpenNote: (id: string, title: string) => void }) {
  const isMobile = useIsMobile()
  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  })()

  const [calYear,  setCalYear]  = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [selDate,  setSelDate]  = useState(todayStr)
  const [viewMode, setViewMode] = useState<'date' | 'category'>('date')
  const [selCat,   setSelCat]   = useState<{ group: string; sub: string } | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const [catEditOpen,  setCatEditOpen]  = useState(false)
  const [newGroup,     setNewGroup]     = useState('')
  const [newSub,       setNewSub]       = useState('')
  const [editingCatId, setEditingCatId] = useState<number | null>(null)
  const [editCatGroup, setEditCatGroup] = useState('')
  const [editCatSub,   setEditCatSub]   = useState('')
  const [catSaving,    setCatSaving]    = useState(false)

  const [editorOpen,   setEditorOpen]   = useState(false)
  const [editorNoteId, setEditorNoteId] = useState<number | null>(null)
  const [edDate,       setEdDate]       = useState(todayStr)
  const [edGroup,      setEdGroup]      = useState('')
  const [edSub,        setEdSub]        = useState('')
  const [edTitle,      setEdTitle]      = useState('')
  const [edContent,    setEdContent]    = useState('')
  const [edSaving,     setEdSaving]     = useState(false)

  const [categories,   setCategories]   = useState<JournalCategoryRow[]>([])
  const [notes,        setNotes]        = useState<JournalNoteRow[]>([])
  const [journalDates, setJournalDates] = useState<Set<string>>(new Set())
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const [cats, allNotes, dates] = await Promise.all([
        fetchJournalCategories(),
        fetchJournalNotes(),
        fetchJournalDates(),
      ])
      setCategories(cats)
      setNotes(allNotes)
      setJournalDates(new Set(dates))
      if (cats.length > 0) setExpanded(new Set([cats[0].group_name]))
      setLoading(false)
    })()
  }, [])

  const groupedCats = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const c of categories) {
      if (!map[c.group_name]) map[c.group_name] = []
      if (!map[c.group_name].includes(c.sub_name)) map[c.group_name].push(c.sub_name)
    }
    return map
  }, [categories])

  const catCount = useMemo(() => {
    const map: Record<string, number> = {}
    for (const n of notes) {
      const k = `${n.group_name}||${n.sub_name}`
      map[k] = (map[k] ?? 0) + 1
    }
    return map
  }, [notes])

  const displayedNotes = useMemo(() => {
    if (viewMode === 'date') return notes.filter(n => n.record_date === selDate)
    if (selCat) return notes.filter(n => n.group_name === selCat.group && n.sub_name === selCat.sub)
    return []
  }, [viewMode, selDate, selCat, notes])

  function buildGrid(y: number, m: number): (string | null)[] {
    const firstDay = new Date(y, m, 1).getDay()
    const days = new Date(y, m + 1, 0).getDate()
    const cells: (string | null)[] = Array(firstDay).fill(null)
    for (let d = 1; d <= days; d++)
      cells.push(`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }
  const calGrid  = buildGrid(calYear, calMonth)
  const DOWS_JC  = ['일','월','화','수','목','금','토']
  const MONTHS_JC = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

  function prevMonth() { calMonth === 0 ? (setCalYear(y=>y-1), setCalMonth(11)) : setCalMonth(m=>m-1) }
  function nextMonth() { calMonth === 11 ? (setCalYear(y=>y+1), setCalMonth(0)) : setCalMonth(m=>m+1) }
  function goToday()   { setCalYear(new Date().getFullYear()); setCalMonth(new Date().getMonth()); setSelDate(todayStr); setViewMode('date') }

  function fmtDateKo(dk: string) {
    const d = new Date(dk + 'T00:00:00')
    return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
  }

  function openNew() {
    setEditorNoteId(null)
    setEdDate(viewMode === 'date' ? selDate : todayStr)
    const firstGroup = categories[0]?.group_name ?? ''
    const firstSub   = categories.find(c => c.group_name === firstGroup)?.sub_name ?? ''
    setEdGroup(selCat?.group ?? firstGroup)
    setEdSub(selCat?.sub ?? firstSub)
    setEdTitle(''); setEdContent('')
    setEditorOpen(true)
  }
  function openEdit(note: JournalNoteRow) {
    setEditorNoteId(note.id); setEdDate(note.record_date)
    setEdGroup(note.group_name); setEdSub(note.sub_name)
    setEdTitle(note.title); setEdContent(note.content)
    setEditorOpen(true)
  }

  async function saveNote() {
    if (!edTitle.trim() || !edDate || !edGroup || !edSub) return
    setEdSaving(true)
    if (editorNoteId === null) {
      const created = await insertJournalNote({ record_date: edDate, title: edTitle.trim(), content: edContent, group_name: edGroup, sub_name: edSub })
      if (created) {
        setNotes(prev => [created, ...prev])
        setJournalDates(prev => new Set([...prev, edDate]))
      }
    } else {
      const fields = { record_date: edDate, title: edTitle.trim(), content: edContent, group_name: edGroup, sub_name: edSub }
      await updateJournalNote(editorNoteId, fields)
      setNotes(prev => prev.map(n => n.id === editorNoteId ? { ...n, ...fields } : n))
    }
    setEdSaving(false)
    setEditorOpen(false)
  }

  async function handleDeleteNote(id: number) {
    if (!window.confirm('이 저널을 삭제할까요?')) return
    await deleteJournalNote(id)
    const remaining = notes.filter(n => n.id !== id)
    setNotes(remaining)
    setJournalDates(new Set(remaining.map(n => n.record_date)))
  }

  async function handleAddCat() {
    if (!newGroup.trim() || !newSub.trim()) return
    setCatSaving(true)
    const cat = await insertJournalCategory(newGroup.trim(), newSub.trim())
    if (cat) { setCategories(prev => [...prev, cat]); setNewGroup(''); setNewSub('') }
    setCatSaving(false)
  }
  async function handleDeleteCat(id: number) {
    if (!window.confirm('카테고리를 삭제할까요?')) return
    await deleteJournalCategory(id)
    setCategories(prev => prev.filter(c => c.id !== id))
  }
  async function handleUpdateCat() {
    if (!editingCatId || !editCatGroup.trim() || !editCatSub.trim()) return
    await updateJournalCategory(editingCatId, editCatGroup.trim(), editCatSub.trim())
    setCategories(prev => prev.map(c => c.id === editingCatId ? { ...c, group_name: editCatGroup.trim(), sub_name: editCatSub.trim() } : c))
    setEditingCatId(null)
  }

  const edSubs   = useMemo(() => categories.filter(c => c.group_name === edGroup).map(c => c.sub_name), [categories, edGroup])
  const edGroups = useMemo(() => [...new Set(categories.map(c => c.group_name))], [categories])

  const cardStyle: React.CSSProperties = { backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.06)' }
  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#F1F1EF', color: '#37352F', fontSize: '13px', outline: 'none' }
  const btnPrimary: React.CSSProperties = { padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#6366f1', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }
  const btnGhost: React.CSSProperties  = { padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: 'transparent', color: '#9B9A97', fontSize: '12px', cursor: 'pointer' }

  const panelTitle = viewMode === 'date'
    ? `📅 ${fmtDateKo(selDate)}`
    : `📂 ${selCat?.group} / ${selCat?.sub}`

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '14px 12px' : '28px 44px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: '#37352F' }}>📓 저널 캘린더</h1>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#787774' }}>날짜별 · 카테고리별로 기록을 관리하세요</p>
        </div>
        <button onClick={openNew} style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px' }}>＋</span> 새 저널 작성
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#787774', fontSize: '14px' }}>
          <span style={{ marginRight: '10px' }}>⏳</span> 데이터 불러오는 중…
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr 240px', gap: '20px', alignItems: 'start' }}>

          {/* 좌: 캘린더 */}
          <div style={{ ...cardStyle, padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <button onClick={prevMonth} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#F1F1EF', color: '#9B9A97', cursor: 'pointer', fontSize: '13px' }}>‹</button>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#37352F' }}>{calYear}년 {MONTHS_JC[calMonth]}</p>
              <button onClick={nextMonth} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#F1F1EF', color: '#9B9A97', cursor: 'pointer', fontSize: '13px' }}>›</button>
            </div>
            <button onClick={goToday} style={{ ...btnGhost, width: '100%', marginBottom: '12px', textAlign: 'center' }}>오늘로 이동</button>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: '4px' }}>
              {DOWS_JC.map((d, i) => (
                <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, color: i === 0 ? '#f87171' : i === 6 ? '#60a5fa' : '#787774', padding: '4px 0' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' }}>
              {calGrid.map((dk, idx) => {
                if (!dk) return <div key={idx} />
                const isToday = dk === todayStr
                const isSel   = dk === selDate && viewMode === 'date'
                const hasDot  = journalDates.has(dk)
                const dow     = idx % 7
                return (
                  <button key={dk} onClick={() => { setSelDate(dk); setViewMode('date') }} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '6px 2px', borderRadius: '8px', border: 'none', cursor: 'pointer', minHeight: '36px',
                    backgroundColor: isSel ? '#6366f1' : isToday ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: isSel ? '#fff' : dow === 0 ? '#f87171' : dow === 6 ? '#60a5fa' : '#37352F',
                    fontWeight: isToday ? 800 : 500, fontSize: '12px', transition: 'background 0.1s',
                  }}>
                    {parseInt(dk.slice(8))}
                    {hasDot && <span style={{ width: '4px', height: '4px', borderRadius: '50%', marginTop: '2px', backgroundColor: isSel ? 'rgba(255,255,255,0.8)' : '#7C3AED', display: 'block' }} />}
                  </button>
                )
              })}
            </div>
            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(0,0,0,0.06)', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '11px', color: '#787774' }}>
                이번 달 저널 {notes.filter(n => n.record_date.startsWith(`${calYear}-${String(calMonth+1).padStart(2,'0')}`)).length}개
              </p>
            </div>
          </div>

          {/* 중: 저널 목록 */}
          <div style={{ ...cardStyle, padding: '24px', minHeight: '500px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#37352F' }}>{panelTitle}</h2>
              <button onClick={openNew} style={{ ...btnPrimary, padding: '6px 14px', fontSize: '12px' }}>＋ 작성</button>
            </div>

            {displayedNotes.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
                <p style={{ margin: 0, fontSize: '32px' }}>📝</p>
                <p style={{ margin: 0, color: '#AEAAA4', fontSize: '14px' }}>이 {viewMode === 'date' ? '날짜에' : '카테고리에'} 저널이 없습니다</p>
                <button onClick={openNew} style={btnPrimary}>첫 저널 작성하기</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {displayedNotes.map(note => (
                  <div key={note.id} style={{ padding: '18px 20px', borderRadius: '12px', backgroundColor: '#F1F1EF', border: '1px solid rgba(0,0,0,0.06)', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#EBEBEA')}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#37352F', cursor: 'pointer', display: 'inline-block' }}
                          onClick={() => onOpenNote(String(note.id), note.title)}
                          title="클릭하여 노트 열기"
                          onMouseEnter={e => (e.currentTarget.style.color = '#6366f1')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#37352F')}
                        >{note.title}</p>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#6366f1', backgroundColor: 'rgba(99,102,241,0.12)', padding: '2px 8px', borderRadius: '999px' }}>{note.group_name}</span>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#7C3AED', backgroundColor: 'rgba(167,139,250,0.1)', padding: '2px 8px', borderRadius: '999px' }}>{note.sub_name}</span>
                          <span style={{ fontSize: '10px', color: '#787774' }}>{fmtDateKo(note.record_date)}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button onClick={() => openEdit(note)} style={{ ...btnGhost, padding: '4px 10px', fontSize: '11px' }}>편집</button>
                        <button onClick={() => handleDeleteNote(note.id)} style={{ ...btnGhost, padding: '4px 10px', fontSize: '11px', color: '#f87171', borderColor: 'rgba(248,113,113,0.25)' }}>삭제</button>
                      </div>
                    </div>
                    {note.content && (
                      <p style={{ margin: 0, fontSize: '13px', color: '#6B6B6B', lineHeight: 1.7, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{blockNoteToPlainPreview(note.content, 120)}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 우: 카테고리 사이드바 */}
          <div style={{ ...cardStyle, padding: '18px' }}>
            <p style={{ margin: '0 0 14px', fontSize: '11px', fontWeight: 800, color: '#6366f1', letterSpacing: '0.1em', textTransform: 'uppercase' }}>카테고리</p>
            {Object.keys(groupedCats).length === 0 ? (
              <p style={{ margin: 0, fontSize: '12px', color: '#AEAAA4' }}>카테고리가 없습니다.</p>
            ) : (
              Object.entries(groupedCats).map(([group, subs]) => (
                <div key={group} style={{ marginBottom: '4px' }}>
                  <button
                    onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(group) ? n.delete(group) : n.add(group); return n })}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 8px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left', color: '#37352F', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <span style={{ fontSize: '9px', color: '#787774', display: 'inline-block', transform: expanded.has(group) ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, flex: 1 }}>{group}</span>
                    <span style={{ fontSize: '10px', color: '#787774' }}>{subs.reduce((a,s) => a+(catCount[`${group}||${s}`]??0),0)}</span>
                  </button>
                  {expanded.has(group) && subs.map(sub => {
                    const isActive = viewMode === 'category' && selCat?.group === group && selCat?.sub === sub
                    return (
                      <button key={sub} onClick={() => { setSelCat({ group, sub }); setViewMode('category') }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px 6px 22px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: isActive ? 'rgba(99,102,241,0.15)' : 'transparent', color: isActive ? '#4F46E5' : '#9B9A97', fontSize: '12px', textAlign: 'left', transition: 'background 0.1s' }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#F7F7F5' }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent' }}
                      >
                        <span>· {sub}</span>
                        <span style={{ fontSize: '10px', color: isActive ? '#6366f1' : '#AEAAA4', backgroundColor: isActive ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0.04)', padding: '1px 6px', borderRadius: '999px' }}>
                          {catCount[`${group}||${sub}`] ?? 0}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))
            )}
            <button onClick={() => setCatEditOpen(true)} style={{ ...btnGhost, width: '100%', marginTop: '12px', textAlign: 'center' }}>✏️ 메뉴 편집</button>
          </div>
        </div>
      )}

      {/* 저널 에디터 모달 */}
      {editorOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '560px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.2)', padding: '28px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#37352F' }}>{editorNoteId === null ? '새 저널 작성' : '저널 편집'}</h3>
              <button onClick={() => setEditorOpen(false)} style={{ background: 'none', border: 'none', color: '#787774', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#9B9A97', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>날짜</label>
                <input type="date" value={edDate} onChange={e => setEdDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'light' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#9B9A97', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>대분류</label>
                  <select value={edGroup} onChange={e => { setEdGroup(e.target.value); setEdSub('') }} style={{ ...inputStyle, appearance: 'none' }}>
                    <option value="">선택</option>
                    {edGroups.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#9B9A97', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>소분류</label>
                  <select value={edSub} onChange={e => setEdSub(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                    <option value="">선택</option>
                    {edSubs.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#9B9A97', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>제목</label>
                <input type="text" value={edTitle} onChange={e => setEdTitle(e.target.value)} placeholder="저널 제목을 입력하세요" style={inputStyle} onFocus={e=>(e.target.style.borderColor='#6366f1')} onBlur={e=>(e.target.style.borderColor='#EBEBEA')} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#9B9A97', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>내용</label>
                <RichEditor value={edContent} onChange={setEdContent} contentKey={String(editorNoteId)} placeholder="자유롭게 기록하세요…" minHeight={200} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setEditorOpen(false)} style={btnGhost}>취소</button>
                <button onClick={saveNote} disabled={edSaving || !edTitle.trim() || !edDate || !edGroup || !edSub} style={{ ...btnPrimary, opacity: edSaving || !edTitle.trim() || !edDate || !edGroup || !edSub ? 0.5 : 1, cursor: edSaving ? 'wait' : 'pointer' }}>
                  {edSaving ? '저장 중…' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 카테고리 편집 모달 */}
      {catEditOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '500px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.2)', padding: '28px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#37352F' }}>✏️ 카테고리 편집</h3>
              <button onClick={() => { setCatEditOpen(false); setEditingCatId(null) }} style={{ background: 'none', border: 'none', color: '#787774', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>
            <div style={{ marginBottom: '20px' }}>
              {categories.map(cat => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid #FFFFFF' }}>
                  {editingCatId === cat.id ? (
                    <>
                      <input value={editCatGroup} onChange={e=>setEditCatGroup(e.target.value)} placeholder="대분류" style={{ ...inputStyle, flex: 1 }} />
                      <input value={editCatSub}   onChange={e=>setEditCatSub(e.target.value)}   placeholder="소분류" style={{ ...inputStyle, flex: 1 }} />
                      <button onClick={handleUpdateCat} style={{ ...btnPrimary, padding: '6px 12px', fontSize: '11px' }}>저장</button>
                      <button onClick={() => setEditingCatId(null)} style={{ ...btnGhost, padding: '6px 10px', fontSize: '11px' }}>취소</button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: '12px', color: '#37352F' }}>{cat.group_name}</span>
                      <span style={{ fontSize: '10px', color: '#7C3AED', backgroundColor: 'rgba(167,139,250,0.1)', padding: '2px 8px', borderRadius: '999px' }}>{cat.sub_name}</span>
                      <button onClick={() => { setEditingCatId(cat.id); setEditCatGroup(cat.group_name); setEditCatSub(cat.sub_name) }} style={{ ...btnGhost, padding: '4px 10px', fontSize: '11px' }}>수정</button>
                      <button onClick={() => handleDeleteCat(cat.id)} style={{ ...btnGhost, padding: '4px 10px', fontSize: '11px', color: '#f87171', borderColor: 'rgba(248,113,113,0.2)' }}>삭제</button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 700, color: '#6366f1' }}>＋ 새 카테고리 추가</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input value={newGroup} onChange={e=>setNewGroup(e.target.value)} placeholder="대분류 (예: 창작)" style={{ ...inputStyle, flex: 1, minWidth: '120px' }} />
              <input value={newSub}   onChange={e=>setNewSub(e.target.value)}   placeholder="소분류 (예: 스토리 아이디어)" style={{ ...inputStyle, flex: 1, minWidth: '120px' }} onKeyDown={e => { if (e.key === 'Enter') handleAddCat() }} />
              <button onClick={handleAddCat} disabled={catSaving || !newGroup.trim() || !newSub.trim()} style={{ ...btnPrimary, opacity: !newGroup.trim() || !newSub.trim() ? 0.5 : 1 }}>추가</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── CalendarPage ─────────────────────────────────────────────────────────────
function CalendarPage() {
  const isMobile = useIsMobile()
  const today    = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  const [year,     setYear]     = useState(today.getFullYear())
  const [month,    setMonth]    = useState(today.getMonth())
  const [calStore, setCalStore] = useState<CalStore>(() => loadCalendar())
  const [modal,    setModal]    = useState<{ day: string } | null>(null)
  const [form,     setForm]     = useState<Partial<CalEvent> | null>(null)

  const journalData = loadJournal()
  const grid        = buildCalGrid(year, month)
  const curPfx      = `${year}-${String(month+1).padStart(2,'0')}`

  function prevMonth() { if (month === 0) { setYear(y => y-1); setMonth(11) } else setMonth(m => m-1) }
  function nextMonth() { if (month === 11) { setYear(y => y+1); setMonth(0)  } else setMonth(m => m+1) }
  function goToday()   { setYear(today.getFullYear()); setMonth(today.getMonth()) }

  function getActivity(dk: string): 0|1|2|3 {
    const e = journalData[dk]
    if (!e) return 0
    const b = e.blocks?.length ?? 0
    const l = e.content?.length ?? 0
    if (b >= 3 || l > 400) return 3
    if (b >= 1 || l > 100) return 2
    if (l > 0) return 1
    return 0
  }
  function getDayEvents(dk: string) { return calStore.events.filter(e => e.startDate <= dk && e.endDate >= dk) }
  function saveEvent() {
    if (!form?.title?.trim()) return
    const next: CalStore = { events: [...calStore.events, { title:'', color: EVENT_PALETTE[0], note:'', ...form, id: `ev_${Date.now()}` } as CalEvent] }
    setCalStore(next); saveCalendar(next); setForm(null)
  }
  function removeEvent(id: string) {
    const next = { events: calStore.events.filter(e => e.id !== id) }
    setCalStore(next); saveCalendar(next)
  }

  const ACT = ['', 'rgba(99,102,241,0.3)', 'rgba(99,102,241,0.62)', '#6366f1'] as const
  const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
  const DOWS   = ['일','월','화','수','목','금','토']

  const navBtn: React.CSSProperties = {
    width: '34px', height: '34px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.06)',
    backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.15s', color: '#9B9A97',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', backgroundColor: '#F4F4F2', border: '1px solid rgba(0,0,0,0.06)',
    borderRadius: '10px', padding: '9px 13px', color: '#37352F', fontSize: '13px',
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '14px 10px' : '36px 48px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <CalendarDays size={14} color="#6366f1" />
            <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#6366f1', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Calendar</p>
          </div>
          <p style={{ margin: 0, fontSize: isMobile ? '18px' : '26px', fontWeight: 900, color: '#37352F', letterSpacing: '-0.5px' }}>{year}년 {MONTHS[month]}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={goToday} style={{ padding: '8px 20px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.35)', backgroundColor: 'rgba(99,102,241,0.1)', color: '#4F46E5', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.1)' }}
          >Today</button>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={prevMonth} style={navBtn} onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1' }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#EBEBEA' }}><ChevronLeft size={15} /></button>
            <button onClick={nextMonth} style={navBtn} onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1' }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#EBEBEA' }}><ChevronRight size={15} /></button>
          </div>
        </div>
      </div>

      {/* Grid container */}
      <div style={{ backgroundColor: '#EEF2FF', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>

        {/* DOW header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          {DOWS.map((d, i) => (
            <div key={d} style={{ padding: '13px 0', textAlign: 'center', fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em', color: i === 0 ? '#f87171' : i === 6 ? '#818cf8' : '#787774' }}>{d}</div>
          ))}
        </div>

        {/* Week rows */}
        {grid.map((week, wi) => {
          const wEvs = getWeekEvents(week, calStore.events)
          const maxLv = wEvs.reduce((m, e) => Math.max(m, e.level), -1)
          const evH   = maxLv >= 0 ? (maxLv + 1) * 26 + 10 : 10

          return (
            <div key={wi} style={{ borderBottom: wi < 5 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>

              {/* Day numbers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', height: '48px' }}>
                {week.map((dk, di) => {
                  const inMonth = dk.startsWith(curPfx)
                  const isToday = dk === todayKey
                  const act     = getActivity(dk)
                  const dayNum  = parseInt(dk.slice(8))
                  return (
                    <div key={di} onClick={() => setModal({ day: dk })}
                      style={{ display: 'flex', alignItems: 'center', padding: '0 10px', gap: '5px', borderRight: di < 6 ? '1px solid rgba(0,0,0,0.06)' : 'none', cursor: 'pointer', transition: 'background 0.12s' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.06)' }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '' }}
                    >
                      <span style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? '#6366f1' : '', boxShadow: isToday ? '0 0 14px rgba(99,102,241,0.55)' : '', fontSize: '13px', fontWeight: isToday ? 800 : 400, color: isToday ? '#fff' : !inMonth ? '#383848' : di === 0 ? '#f87171' : di === 6 ? '#818cf8' : '#37352F' }}>
                        {dayNum}
                      </span>
                      {act > 0 && (
                        <span style={{ width: `${4 + act}px`, height: `${4 + act}px`, borderRadius: '50%', flexShrink: 0, backgroundColor: ACT[act], boxShadow: act === 3 ? '0 0 7px rgba(99,102,241,0.7)' : '' }} />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Event bars */}
              <div style={{ position: 'relative', height: `${evH}px`, overflow: 'hidden' }}>
                {wEvs.map(ev => {
                  const prevW = ev.startDate < week[0]
                  const nextW = ev.endDate   > week[6]
                  return (
                    <div key={`${ev.id}_${wi}`}
                      onClick={e => { e.stopPropagation(); setModal({ day: prevW ? week[0] : week[ev.sc] }) }}
                      style={{ position: 'absolute', top: `${ev.level * 26 + 4}px`, left: `calc(${ev.sc / 7 * 100}% + 2px)`, width: `calc(${(ev.ec - ev.sc + 1) / 7 * 100}% - 4px)`, height: '22px', backgroundColor: `${ev.color}1e`, border: `1px solid ${ev.color}44`, borderRadius: `${prevW ? 0 : 5}px ${nextW ? 0 : 5}px ${nextW ? 0 : 5}px ${prevW ? 0 : 5}px`, display: 'flex', alignItems: 'center', paddingLeft: prevW ? '6px' : '10px', cursor: 'pointer', overflow: 'hidden', transition: 'background 0.12s' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = `${ev.color}32` }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = `${ev.color}1e` }}
                    >
                      {!prevW && <span style={{ fontSize: '11px', fontWeight: 700, color: ev.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '16px', padding: '0 4px' }}>
        <span style={{ fontSize: '11px', color: '#787774' }}>활동 강도:</span>
        {[1,2,3].map(n => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: `${4+n}px`, height: `${4+n}px`, borderRadius: '50%', backgroundColor: ACT[n as 1|2|3], display: 'inline-block', boxShadow: n === 3 ? '0 0 6px rgba(99,102,241,0.6)' : '' }} />
            <span style={{ fontSize: '10px', color: '#AEAAA4' }}>Lv.{n}</span>
          </div>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#AEAAA4' }}>날짜 클릭 → 일정 추가</span>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 7000 }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.56)' }} onClick={() => { setModal(null); setForm(null) }} />
          <div style={{ position: 'absolute', top: isMobile ? 'auto' : '50%', bottom: isMobile ? 0 : 'auto', left: isMobile ? 0 : '50%', right: isMobile ? 0 : 'auto', transform: isMobile ? 'none' : 'translate(-50%,-50%)', width: isMobile ? '100%' : '400px', backgroundColor: '#EEF2FF', borderRadius: isMobile ? '20px 20px 0 0' : '20px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 24px 80px rgba(0,0,0,0.55)', overflow: 'hidden' }}>

            {/* Modal header */}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#37352F' }}>{formatDateKo(modal.day, { full: true })}</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {!form && (
                  <button onClick={() => setForm({ startDate: modal.day, endDate: modal.day, color: EVENT_PALETTE[0], title: '', note: '' })} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 13px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.3)', backgroundColor: 'rgba(99,102,241,0.09)', color: '#4F46E5', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                    <Plus size={11} />일정 추가
                  </button>
                )}
                <button onClick={() => { setModal(null); setForm(null) }} style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={12} color="#6b7280" />
                </button>
              </div>
            </div>

            {!form ? (
              <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '14px 16px' }}>
                {getDayEvents(modal.day).length === 0 ? (
                  <p style={{ margin: 0, padding: '24px 0', textAlign: 'center', fontSize: '13px', color: '#AEAAA4' }}>이 날의 일정이 없습니다</p>
                ) : (
                  getDayEvents(modal.day).map(ev => (
                    <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: '12px', backgroundColor: `${ev.color}10`, border: `1px solid ${ev.color}28`, marginBottom: '8px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: ev.color, flexShrink: 0, marginTop: '4px' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#37352F' }}>{ev.title}</p>
                        {ev.note && <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#787774' }}>{ev.note}</p>}
                        <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#AEAAA4' }}>{ev.startDate === ev.endDate ? ev.startDate : `${ev.startDate} — ${ev.endDate}`}</p>
                      </div>
                      <button onClick={() => removeEvent(ev.id)} style={{ width: '22px', height: '22px', borderRadius: '5px', border: '1px solid rgba(239,68,68,0.22)', backgroundColor: 'rgba(239,68,68,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                        <X size={10} color="#ef4444" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div style={{ padding: '18px 22px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>제목 *</label>
                  <input value={form.title ?? ''} onChange={e => setForm(f => ({ ...f!, title: e.target.value }))} placeholder="일정 제목" style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>시작일</label>
                    <input type="date" value={form.startDate ?? ''} onChange={e => setForm(f => ({ ...f!, startDate: e.target.value }))} style={{ ...inputStyle, colorScheme: 'light' } as React.CSSProperties} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>종료일</label>
                    <input type="date" value={form.endDate ?? ''} onChange={e => setForm(f => ({ ...f!, endDate: e.target.value }))} style={{ ...inputStyle, colorScheme: 'light' } as React.CSSProperties} />
                  </div>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>색상</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {EVENT_PALETTE.map(col => (
                      <button key={col} onClick={() => setForm(f => ({ ...f!, color: col }))} style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: col, border: `2.5px solid ${form.color === col ? '#fff' : 'transparent'}`, cursor: 'pointer', transition: 'transform 0.1s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.25)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }} />
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>메모</label>
                  <textarea value={form.note ?? ''} onChange={e => setForm(f => ({ ...f!, note: e.target.value }))} placeholder="메모 (선택사항)..." rows={2} style={{ ...inputStyle, resize: 'none', lineHeight: '1.6' } as React.CSSProperties} />
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setForm(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: 'transparent', color: '#9B9A97', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>취소</button>
                  <button onClick={saveEvent} style={{ padding: '8px 22px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}>저장</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════ IDENTITY PAGE ══════════════════════════
function IdentityPage({ identities, onRefresh }: { identities: IdentityRow[]; onRefresh: () => void }) {
  const isMobile = useIsMobile()
  const [newName, setNewName] = useState('')
  const [newRoleModel, setNewRoleModel] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRoleModel, setEditRoleModel] = useState('')

  async function handleAdd() {
    const name = newName.trim()
    if (!name) return
    const row = await insertIdentity(name, newRoleModel.trim() || null)
    if (row) {
      setNewName('')
      setNewRoleModel('')
      onRefresh()
    }
  }

  async function handleSave(id: string) {
    const name = editName.trim()
    if (!name) return
    await updateIdentity(id, name, editRoleModel.trim() || null)
    setEditingId(null)
    onRefresh()
  }

  async function handleDelete(id: string) {
    await deleteIdentity(id)
    onRefresh()
  }

  function fmtTime(sec: number): string {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '14px 12px' : '36px 48px' }}>
      <div style={{ marginBottom: '28px' }}>
        <span style={{ fontSize: '10px', fontWeight: 800, color: '#7C3AED', letterSpacing: '0.2em', textTransform: 'uppercase' }}>🎭 Identity</span>
        <h1 style={{ margin: '8px 0 0', fontSize: '28px', fontWeight: 900, color: '#37352F' }}>정체성 (우디르 태세)</h1>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#787774' }}>작업할 때 어떤 정체성으로 몰입하는지 정의하고, 누적 시간과 XP를 확인하세요</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {identities.map(idn => (
          <div
            key={idn.id}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid rgba(0,0,0,0.06)',
              padding: '24px 22px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)' }}
          >
            {editingId === idn.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="이름" style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #6366f1', outline: 'none', fontSize: '14px' }} />
                <input value={editRoleModel} onChange={e => setEditRoleModel(e.target.value)} placeholder="롤모델" style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', outline: 'none', fontSize: '13px' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleSave(idn.id)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', backgroundColor: '#6366f1', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>저장</button>
                  <button onClick={() => setEditingId(null)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', backgroundColor: 'transparent', fontSize: '12px', cursor: 'pointer' }}>취소</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#37352F' }}>{idn.name}</h3>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => { setEditingId(idn.id); setEditName(idn.name); setEditRoleModel(idn.role_model ?? '') }} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: 'rgba(99,102,241,0.1)', color: '#6366f1', fontSize: '11px', cursor: 'pointer' }}>수정</button>
                    <button onClick={() => handleDelete(idn.id)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '11px', cursor: 'pointer' }}>삭제</button>
                  </div>
                </div>
                {idn.role_model && <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#787774' }}>롤모델: {idn.role_model}</p>}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ backgroundColor: 'rgba(99,102,241,0.08)', padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, color: '#6366f1', letterSpacing: '0.08em' }}>누적 시간</p>
                    <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 800, color: '#37352F' }}>{fmtTime(idn.time_spent_sec)}</p>
                  </div>
                  <div style={{ backgroundColor: 'rgba(52,211,153,0.08)', padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(52,211,153,0.2)' }}>
                    <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, color: '#34d399', letterSpacing: '0.08em' }}>XP</p>
                    <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 800, color: '#37352F' }}>{idn.xp}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
        <div
          style={{
            backgroundColor: 'rgba(0,0,0,0.02)',
            borderRadius: '16px',
            border: '2px dashed rgba(0,0,0,0.12)',
            padding: '24px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            cursor: 'pointer',
            transition: 'border-color 0.2s, background 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'; e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.06)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)'; e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)' }}
        >
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#787774' }}>+ 새 정체성 추가</p>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="예: 소설가" style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', outline: 'none', fontSize: '13px' }} />
          <input value={newRoleModel} onChange={e => setNewRoleModel(e.target.value)} placeholder="롤모델 (선택)" style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', outline: 'none', fontSize: '13px' }} />
          <button onClick={handleAdd} disabled={!newName.trim()} style={{ padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: newName.trim() ? '#6366f1' : '#EBEBEA', color: newName.trim() ? '#fff' : '#9B9A97', fontSize: '13px', fontWeight: 700, cursor: newName.trim() ? 'pointer' : 'default' }}>추가</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════ FORTUNE PAGE ══════════════════════════
type TarotCardDisplay = { id: string; name_ko: string; name_en: string; emoji: string; meaning: string }

const TAROT_DECK: TarotCardDisplay[] = [
  { id: '0',  name_ko: '바보',       name_en: 'The Fool',           emoji: '🃏', meaning: '새로운 시작, 순수함, 자유' },
  { id: '1',  name_ko: '마법사',     name_en: 'The Magician',       emoji: '✨', meaning: '의지, 창의력, 가능성' },
  { id: '2',  name_ko: '여사제',     name_en: 'The High Priestess', emoji: '🌙', meaning: '직관, 비밀, 내면의 지혜' },
  { id: '3',  name_ko: '여황제',     name_en: 'The Empress',        emoji: '👑', meaning: '풍요, 창조, 모성' },
  { id: '4',  name_ko: '황제',       name_en: 'The Emperor',        emoji: '⚜️', meaning: '질서, 권위, 구조' },
  { id: '5',  name_ko: '교황',       name_en: 'The Hierophant',     emoji: '📿', meaning: '전통, 가르침, 영성' },
  { id: '6',  name_ko: '연인',       name_en: 'The Lovers',         emoji: '💕', meaning: '선택, 사랑, 조화' },
  { id: '7',  name_ko: '전차',       name_en: 'The Chariot',        emoji: '🏹', meaning: '의지력, 승리, 전진' },
  { id: '8',  name_ko: '힘',         name_en: 'Strength',          emoji: '🦁', meaning: '용기, 인내, 부드러운 힘' },
  { id: '9',  name_ko: '은둔자',     name_en: 'The Hermit',         emoji: '🕯️', meaning: '성찰, 고독, 내면 탐구' },
  { id: '10', name_ko: '운명의 수레바퀴', name_en: 'Wheel of Fortune', emoji: '☸️', meaning: '변화, 순환, 운명' },
  { id: '11', name_ko: '정의',       name_en: 'Justice',            emoji: '⚖️', meaning: '공정함, 균형, 진실' },
  { id: '12', name_ko: '매달린 사람', name_en: 'The Hanged Man',    emoji: '🙃', meaning: '전환, 포기, 새로운 시각' },
  { id: '13', name_ko: '사신',       name_en: 'Death',              emoji: '🦋', meaning: '끝과 시작, 변신, 재탄생' },
  { id: '14', name_ko: '절제',       name_en: 'Temperance',         emoji: '🕊️', meaning: '조화, 인내, 중용' },
  { id: '15', name_ko: '악마',       name_en: 'The Devil',          emoji: '🔗', meaning: '속박, 유혹, 해방' },
  { id: '16', name_ko: '탑',         name_en: 'The Tower',          emoji: '⚡', meaning: '붕괴, 계시, 재건' },
  { id: '17', name_ko: '별',         name_en: 'The Star',           emoji: '⭐', meaning: '희망, 치유, 영감' },
  { id: '18', name_ko: '달',         name_en: 'The Moon',           emoji: '🌜', meaning: '직관, 꿈, 무의식' },
  { id: '19', name_ko: '태양',       name_en: 'The Sun',            emoji: '☀️', meaning: '기쁨, 성공, 활력' },
  { id: '20', name_ko: '심판',       name_en: 'Judgement',          emoji: '📯', meaning: '재탄생, 용서, 소명' },
  { id: '21', name_ko: '세계',       name_en: 'The World',          emoji: '🌍', meaning: '완성, 성취, 통합' },
]

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const FORTUNE_QUICK_LINKS = [
  { id: 'naver', title: '네이버 운세', url: 'https://search.naver.com/search.naver?query=오늘의+운세', emoji: '🍀' },
  { id: 'marie', title: '마리끌레르', url: 'https://www.marieclairekorea.com/horoscope/', emoji: '✨' },
  { id: 'elle', title: '엘르 별자리', url: 'https://www.elle.co.kr/astro', emoji: '🌙' },
  { id: 'saju', title: '만세력', url: 'https://pro.sajuplus.net/', emoji: '📜' },
]

function TarotCardFace({ card, isFront }: { card: TarotCardDisplay; isFront: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        transform: isFront ? 'rotateY(180deg)' : 'rotateY(0deg)',
        transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        ...(isFront
          ? { background: 'linear-gradient(160deg, #fafaf8 0%, #f5f5f0 100%)', border: '1px solid rgba(0,0,0,0.08)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }
          : { background: 'linear-gradient(160deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)', border: '1px solid rgba(139,92,246,0.3)', boxShadow: 'inset 0 0 30px rgba(0,0,0,0.3)' }),
      }}
    >
      {isFront ? (
        <>
          <span style={{ fontSize: 'clamp(24px, 4vw, 36px)', lineHeight: 1, marginBottom: '8px' }}>{card.emoji}</span>
          <span style={{ fontSize: 'clamp(11px, 2vw, 13px)', fontWeight: 800, color: '#37352F', textAlign: 'center' }}>{card.name_ko}</span>
          <span style={{ fontSize: 'clamp(9px, 1.5vw, 10px)', color: '#787774', marginTop: '2px' }}>{card.name_en}</span>
          <span style={{ fontSize: 'clamp(9px, 1.2vw, 10px)', color: '#9B9A97', marginTop: '8px', textAlign: 'center', lineHeight: 1.4 }}>{card.meaning}</span>
        </>
      ) : (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 70%, rgba(167,139,250,0.2) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(99,102,241,0.15) 0%, transparent 40%)', pointerEvents: 'none' }} />
          <span style={{ fontSize: '18px', opacity: 0.9, position: 'relative', zIndex: 1 }}>✨</span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginTop: '6px', letterSpacing: '0.2em', position: 'relative', zIndex: 1 }}>TAROT</span>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', position: 'relative', zIndex: 1 }}>✦ ✧ ✦</span>
        </>
      )}
    </div>
  )
}

function renderDrawnCards(cards: DrawnCardItem[]) {
  if (!cards || cards.length === 0) return null
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
      {cards.map((c, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#37352F' }}>
          {i > 0 && <span style={{ color: '#9B9A97', marginRight: '4px' }}>|</span>}
          <span>{c.emoji}</span>
          <span>{c.name_ko}{c.name_en ? ` (${c.name_en})` : ''}</span>
        </span>
      ))}
    </span>
  )
}

function fortuneCardToDisplay(c: FortuneCardRow): TarotCardDisplay {
  return {
    id: c.id,
    name_ko: c.name_ko,
    name_en: c.name_en ?? '',
    emoji: c.emoji ?? '🃏',
    meaning: c.meaning ?? '',
  }
}

/** 통합 덱 폼 모달: editingDeckId가 null이면 INSERT(추가), 있으면 UPDATE(수정) */
function DeckFormModal({
  editingDeckId,
  initialName,
  initialDescription,
  initialCoverImageUrl,
  onClose,
  onSaved,
}: {
  editingDeckId: string | null
  initialName: string
  initialDescription: string
  initialCoverImageUrl: string
  onClose: () => void
  onSaved: (deck: FortuneDeckRow) => void
}) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [coverImageUrl, setCoverImageUrl] = useState(initialCoverImageUrl)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(initialName)
    setDescription(initialDescription)
    setCoverImageUrl(initialCoverImageUrl)
    setError(null)
  }, [editingDeckId, initialName, initialDescription, initialCoverImageUrl])

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('덱 이름을 입력해 주세요.'); return }
    setSaving(true)
    setError(null)
    if (editingDeckId === null) {
      const deck = await insertFortuneDeck(trimmed, description || undefined, coverImageUrl || undefined)
      setSaving(false)
      if (deck) {
        onSaved(deck)
        onClose()
      } else {
        setError('덱 추가에 실패했습니다.')
      }
    } else {
      const updated = await updateFortuneDeck(editingDeckId, { name: trimmed, description: description || undefined, cover_image_url: coverImageUrl || undefined })
      setSaving(false)
      if (updated) {
        onSaved(updated)
        onClose()
      } else {
        setError('수정에 실패했습니다.')
      }
    }
  }

  const isAddMode = editingDeckId === null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 800, color: '#37352F' }}>{isAddMode ? '새 덱 추가' : '덱 수정'}</h3>
        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setError(null) }}
          placeholder={isAddMode ? '덱 이름 (예: 기본 타로 카드)' : '덱 이름'}
          style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '14px', marginBottom: '10px' }}
        />
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="설명 (선택)"
          style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '14px', marginBottom: '10px' }}
        />
        <input
          type="url"
          value={coverImageUrl}
          onChange={e => setCoverImageUrl(e.target.value)}
          placeholder="표지 이미지 URL (선택)"
          style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '14px', marginBottom: '16px' }}
        />
        {error && <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#ef4444' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>취소</button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: '#7C3AED', color: '#fff', cursor: saving ? 'default' : 'pointer', fontSize: '13px', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>{saving ? '저장 중…' : '저장'}</button>
        </div>
      </div>
    </div>
  )
}

const FALLBACK_DECK: FortuneDeckRow = { id: '__fallback__', name: '기본 타로 카드', sort_order: 0 }

function FortuneReadingCalendar({ readingLogs, selectedDate, onSelectDate }: {
  readingLogs: ReadingLogRow[]
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
}) {
  const [viewDate, setViewDate] = useState(new Date())
  const datesWithReadings = useMemo(() => {
    const set = new Set<string>()
    for (const r of readingLogs) {
      const d = new Date(r.created_at)
      set.add(toYMD(d))
    }
    return set
  }, [readingLogs])

  const dayDots = useCallback((date: Date) => {
    const dk = toYMD(date)
    if (!datesWithReadings.has(dk)) return null
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1px' }}>
        <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#7C3AED', display: 'block' }} title="운세 기록" />
      </div>
    )
  }, [datesWithReadings])

  const calValue = selectedDate ? new Date(selectedDate + 'T12:00:00') : null

  return (
    <div className="fortune-calendar-wrapper" style={{ fontSize: '11px' }}>
      <Calendar
        value={calValue ?? viewDate}
        onChange={(v) => {
          const d = v as Date
          const key = toYMD(d)
          onSelectDate(selectedDate === key ? null : key)
        }}
        onActiveStartDateChange={({ activeStartDate }) => activeStartDate && setViewDate(activeStartDate)}
        tileContent={({ date }) => dayDots(date)}
        calendarType="gregory"
        locale="ko-KR"
        showWeekNumbers
        formatShortWeekday={(_, d) => ['일','월','화','수','목','금','토'][d.getDay()]}
        formatDay={(_locale, date) => date.getDate().toString()}
      />
      {selectedDate && (
        <button onClick={() => onSelectDate(null)} style={{ marginTop: '6px', width: '100%', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.08)', color: '#7C3AED', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>필터 해제</button>
      )}
    </div>
  )
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

function ReadingLogEditModal({ log, onClose, onSaved, onDeleted }: {
  log: ReadingLogRow
  onClose: () => void
  onSaved: (updated: ReadingLogRow) => void
  onDeleted: () => void
}) {
  const [question, setQuestion] = useState(log.question)
  const [notes, setNotes] = useState(log.notes ?? '')
  const [createdAt, setCreatedAt] = useState(toDatetimeLocal(log.created_at))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    setQuestion(log.question)
    setNotes(log.notes ?? '')
    setCreatedAt(toDatetimeLocal(log.created_at))
  }, [log.id, log.question, log.notes, log.created_at])

  async function handleSave() {
    if (!question.trim()) return
    setSaving(true)
    const updated = await updateReadingLog(log.id, {
      question: question.trim(),
      notes: notes.trim() || undefined,
      created_at: new Date(createdAt).toISOString(),
    })
    setSaving(false)
    if (updated) {
      setSaved(true)
      onSaved(updated)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  async function handleDelete() {
    if (!window.confirm('이 기록을 정말 삭제하시겠습니까?')) return
    const ok = await deleteReadingLog(log.id)
    if (ok) {
      onDeleted()
      onClose()
    }
  }

  const drawn = log.drawn_cards ?? []

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div style={{ maxWidth: '520px', width: '100%', maxHeight: '90vh', overflow: 'auto', backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 2px 24px rgba(0,0,0,0.2)', padding: '24px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#37352F' }}>✏️ 기록 수정</h3>
          <button onClick={onClose} style={{ padding: '6px', border: 'none', background: 'rgba(0,0,0,0.06)', borderRadius: '8px', cursor: 'pointer', color: '#787774' }}>✕</button>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, color: '#7C3AED' }}>날짜 및 시간</label>
          <input type="datetime-local" value={createdAt} onChange={e => setCreatedAt(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', background: '#fff', fontSize: '14px', color: '#37352F', outline: 'none' }}
          />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, color: '#7C3AED' }}>질문 / 타이틀</label>
          <textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="질문이나 운세 내용..."
            style={{ width: '100%', minHeight: '80px', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', background: '#F8F8F6', fontSize: '14px', color: '#37352F', lineHeight: 1.5, resize: 'vertical', outline: 'none' }}
          />
        </div>
        {drawn.length > 0 && (
          <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            {drawn.map((c, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '8px', backgroundColor: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', fontSize: '12px', color: '#37352F', fontWeight: 600 }}>
                <span>{c.emoji}</span>
                {c.name_ko ?? c.name_en}
              </span>
            ))}
          </div>
        )}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, color: '#7C3AED' }}>나의 해석 / 코멘트</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="점괘에 대한 피드백, 해석, 느낀 점을 적어보세요..."
            style={{ width: '100%', minHeight: '100px', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', background: '#F8F8F6', fontSize: '14px', color: '#37352F', lineHeight: 1.6, resize: 'vertical', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={handleDelete} style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.06)', color: '#ef4444', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>🗑️ 삭제</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', backgroundColor: saved ? '#34d399' : '#7C3AED', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? '저장 중…' : saved ? '저장됨 ✓' : '수정 ✏️'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FortuneHub({ decks, onSelectDeck, onDecksChange, onReadingSaved }: {
  decks: FortuneDeckRow[]
  onSelectDeck: (d: FortuneDeckRow) => void
  onDecksChange: (decks: FortuneDeckRow[]) => void
  onReadingSaved?: () => void
}) {
  const isMobile = useIsMobile()
  const [decksMenuOpen, setDecksMenuOpen] = useState<string | null>(null)
  /** null=모달 닫힘, 'add'=추가 모드, FortuneDeckRow=수정 모드 */
  const [deckFormState, setDeckFormState] = useState<null | 'add' | FortuneDeckRow>(null)
  const [fortuneFeedback, setFortuneFeedback] = useState('')
  const [savingFeedback, setSavingFeedback] = useState(false)
  const [savedFeedback, setSavedFeedback] = useState(false)
  const [readingLogs, setReadingLogs] = useState<ReadingLogRow[]>([])
  const [detailLog, setDetailLog] = useState<ReadingLogRow | null>(null)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null)

  const filteredReadingLogs = useMemo(() => {
    if (!selectedCalendarDate) return readingLogs
    const sel = selectedCalendarDate
    return readingLogs.filter(r => {
      const d = new Date(r.created_at)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}` === sel
    })
  }, [readingLogs, selectedCalendarDate])

  useEffect(() => {
    fetchReadingLogs().then(setReadingLogs)
  }, [])

  useEffect(() => {
    if (!decksMenuOpen) return
    const close = () => setDecksMenuOpen(null)
    const id = setTimeout(() => document.addEventListener('click', close), 0)
    return () => { clearTimeout(id); document.removeEventListener('click', close) }
  }, [decksMenuOpen])

  const displayDecks = decks.length > 0 ? decks : [FALLBACK_DECK]

  const todaySolar = Solar.fromDate(new Date())
  const lunar = todaySolar.getLunar()
  const eightChar = lunar.getEightChar()
  const todayGanzhi = `${eightChar.getYear()}년 ${eightChar.getMonth()}월 ${eightChar.getDay()}일`
  const solarDateStr = `${todaySolar.getYear()}년 ${todaySolar.getMonth()}월 ${todaySolar.getDay()}일`

  async function handleDeleteDeck(d: FortuneDeckRow) {
    if (d.id === '__fallback__') return
    if (!window.confirm(`"${d.name}" 덱을 정말 삭제하시겠습니까?`)) return
    const ok = await deleteFortuneDeck(d.id)
    if (ok) {
      onDecksChange(decks.filter(x => x.id !== d.id))
      setDecksMenuOpen(null)
    }
  }

  async function handleDeleteReading(log: ReadingLogRow) {
    if (!window.confirm('이 기록을 정말 삭제하시겠습니까?')) return
    const ok = await deleteReadingLog(log.id)
    if (ok) {
      setReadingLogs(prev => prev.filter(r => r.id !== log.id))
      if (detailLog?.id === log.id) setDetailLog(null)
      onReadingSaved?.()
    }
  }

  async function saveFortuneFeedback() {
    const text = fortuneFeedback.trim()
    if (!text) return
    setSavingFeedback(true)
    const row = await insertReadingLog(text, [])
    setSavingFeedback(false)
    if (row) {
      setReadingLogs(prev => [row, ...prev])
      setFortuneFeedback('')
      setSavedFeedback(true)
      setTimeout(() => setSavedFeedback(false), 2000)
      onReadingSaved?.()
    }
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: isMobile ? '12px' : '16px' }}>
      <div style={{ marginBottom: '12px' }}>
        <span style={{ fontSize: '9px', fontWeight: 800, color: '#7C3AED', letterSpacing: '0.15em', textTransform: 'uppercase' }}>🔮 Fortune</span>
        <h1 style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 900, color: '#37352F' }}>Fortune 메인 대시보드</h1>
      </div>

      {/* ── TOP: 캘린더 (좌 30%) + 통합 기록 리스트 (우 70%), 고정 높이 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '3fr 7fr', gap: '16px', marginBottom: '16px', alignItems: 'stretch' }}>
        <div style={{ padding: '12px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 800, color: '#7C3AED' }}>📅 운세 기록</h3>
          <FortuneReadingCalendar
            readingLogs={readingLogs}
            selectedDate={selectedCalendarDate}
            onSelectDate={setSelectedCalendarDate}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', height: isMobile ? 'auto' : '250px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <h3 style={{ margin: 0, padding: '12px 16px 8px', fontSize: '11px', fontWeight: 800, color: '#37352F', flexShrink: 0 }}>통합 운세 & 점괘 기록</h3>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px', minHeight: 0 }}>
            {filteredReadingLogs.length === 0 ? (
              <p style={{ margin: 0, fontSize: '12px', color: '#9B9A97', padding: '24px 8px', textAlign: 'center' }}>
                {selectedCalendarDate ? '선택한 날짜에 기록이 없습니다.' : '아직 기록이 없습니다.'}
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {filteredReadingLogs.map(log => {
                  const d = new Date(log.created_at)
                  const dateStr = d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                  const timeStr = d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true })
                  const drawn = log.drawn_cards ?? []
                  const hasCards = drawn.length > 0
                  const preview = log.question.length > 45 ? log.question.slice(0, 45) + '…' : log.question
                  const notesPreview = (log.notes ?? '').length > 50 ? (log.notes ?? '').slice(0, 50) + '…' : (log.notes ?? '')
                  return (
                    <li
                      key={log.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        backgroundColor: '#F8F8F6',
                        border: '1px solid rgba(0,0,0,0.06)',
                        fontSize: '12px',
                        color: '#37352F',
                        lineHeight: 1.4,
                        transition: 'background-color 0.2s, border-color 0.2s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(124,58,237,0.06)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)' }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F8F8F6'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)' }}
                    >
                      <span style={{ fontSize: '14px', flexShrink: 0 }}>{hasCards ? '🃏' : '📝'}</span>
                      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer', padding: '1px 0' }} onClick={() => setDetailLog(log)}>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', rowGap: '4px' }}>
                          <span style={{ fontWeight: 700, color: '#7C3AED', marginRight: '2px', flexShrink: 0 }}>[{dateStr} {timeStr}]</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 auto', minWidth: 0 }}>{preview}</span>
                          {drawn.length > 0 && (
                            <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', flexShrink: 0 }}>
                              {drawn.map((c, i) => (
                                <span key={i} style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  padding: '2px 8px', borderRadius: '6px',
                                  backgroundColor: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)',
                                  fontSize: '10px', fontWeight: 600, color: '#7C3AED',
                                }}>
                                  <span style={{ fontSize: '11px' }}>{c.emoji}</span>
                                  {c.name_ko}
                                </span>
                              ))}
                            </span>
                          )}
                        </div>
                        {notesPreview && (
                          <div style={{ marginTop: '2px', fontSize: '11px', color: '#9B9A97', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notesPreview}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                        <button onClick={e => { e.stopPropagation(); setDetailLog(log) }} title="수정" style={{ padding: '4px', borderRadius: '6px', border: '1px solid rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.08)', color: '#7C3AED', cursor: 'pointer', fontSize: '10px' }}>✏️</button>
                        <button onClick={e => { e.stopPropagation(); handleDeleteReading(log) }} title="삭제" style={{ padding: '4px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: '10px' }}>🗑️</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ── MIDDLE: 만세력 위젯 & 퀵링크 (좌) + 운세 피드백 입력창 (우) ── 얇은 바 형태 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(99,102,241,0.06) 100%)', border: '1px solid rgba(124,58,237,0.15)' }}>
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '9px', fontWeight: 700, color: '#9B9A97' }}>{solarDateStr}</p>
            <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: 800, color: '#37352F' }}>🔮 {todayGanzhi}</p>
          </div>
          <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            {FORTUNE_QUICK_LINKS.map(link => (
              <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.08)', backgroundColor: '#F4F4F2', color: '#37352F', fontSize: '11px', fontWeight: 500, textDecoration: 'none' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.08)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F4F4F2'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)' }}
              >
                <span>{link.emoji}</span>{link.title}
              </a>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <textarea value={fortuneFeedback} onChange={e => setFortuneFeedback(e.target.value)}
            placeholder="운세 피드백 (Fortune Journal)..."
            style={{ flex: 1, minHeight: '48px', maxHeight: '64px', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', backgroundColor: '#F8F8F6', fontSize: '12px', color: '#37352F', lineHeight: 1.5, resize: 'none', outline: 'none' }}
          />
          <button onClick={saveFortuneFeedback} disabled={savingFeedback || !fortuneFeedback.trim()} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: savedFeedback ? '#34d399' : '#6366f1', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: savingFeedback ? 'default' : 'pointer', opacity: savingFeedback ? 0.7 : 1, flexShrink: 0 }}>{savingFeedback ? '저장 중…' : savedFeedback ? '저장됨 ✓' : '저장'}</button>
        </div>
      </div>

      {/* ── BOTTOM: 나의 오라클 덱 ── 한 줄 가로 스크롤 */}
      <div>
        <h2 style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 800, color: '#37352F' }}>나의 오라클 덱</h2>
        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          {displayDecks.map(d => (
            <div
              key={d.id}
              style={{
                position: 'relative',
                flexShrink: 0,
                width: isMobile ? '140px' : '160px',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid rgba(124,58,237,0.2)',
                background: 'linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(99,102,241,0.04) 100%)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(124,58,237,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div
                onClick={() => onSelectDeck(d)}
                style={{ padding: '12px', minHeight: '100px' }}
              >
                {d.id !== '__fallback__' && (
                  <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 2 }}>
                    <button
                      onClick={e => { e.stopPropagation(); setDecksMenuOpen(prev => prev === d.id ? null : d.id) }}
                      style={{ padding: '4px', borderRadius: '6px', border: 'none', background: 'rgba(0,0,0,0.06)', color: '#787774', cursor: 'pointer' }}
                    >
                      <MoreVertical size={14} />
                    </button>
                    {decksMenuOpen === d.id && (
                      <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: '#fff', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', padding: '4px 0', minWidth: '80px' }}>
                        <button onClick={e => { e.stopPropagation(); setDeckFormState(d); setDecksMenuOpen(null) }} style={{ display: 'block', width: '100%', padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px', textAlign: 'left', color: '#37352F' }}>수정</button>
                        <button onClick={e => { e.stopPropagation(); handleDeleteDeck(d) }} style={{ display: 'block', width: '100%', padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px', textAlign: 'left', color: '#ef4444' }}>삭제</button>
                      </div>
                    )}
                  </div>
                )}
                {d.cover_image_url ? (
                  <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px', background: 'rgba(0,0,0,0.06)' }}>
                    <img src={d.cover_image_url} alt={d.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  </div>
                ) : (
                  <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: '8px', marginBottom: '8px', background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(99,102,241,0.1) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>🃏</div>
                )}
                <h3 style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 800, color: '#37352F' }}>{d.name}</h3>
                {d.description && <p style={{ margin: 0, fontSize: '10px', color: '#787774', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{d.description}</p>}
                <ChevronRight size={14} color="#7C3AED" style={{ position: 'absolute', bottom: '12px', right: '12px' }} />
              </div>
            </div>
          ))}
          <button
            onClick={() => {
              setDeckFormState('add')
            }}
            style={{
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '16px 20px',
              borderRadius: '12px',
              border: '2px dashed rgba(124,58,237,0.4)',
              background: 'rgba(124,58,237,0.04)',
              color: '#7C3AED',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              minWidth: isMobile ? '100px' : '120px',
              minHeight: '100px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(124,58,237,0.08)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.6)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(124,58,237,0.04)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)' }}
          >
            <Plus size={24} />
            [+ 덱 추가]
          </button>
        </div>
      </div>

      {deckFormState && (
        <DeckFormModal
          editingDeckId={deckFormState === 'add' ? null : deckFormState.id}
          initialName={deckFormState === 'add' ? '' : deckFormState.name}
          initialDescription={deckFormState === 'add' ? '' : (deckFormState.description ?? '')}
          initialCoverImageUrl={deckFormState === 'add' ? '' : (deckFormState.cover_image_url ?? '')}
          onClose={() => setDeckFormState(null)}
          onSaved={updated => {
            if (deckFormState === 'add') {
              onDecksChange([...decks, updated])
            } else {
              onDecksChange(decks.map(d => d.id === updated.id ? updated : d))
            }
            setDeckFormState(null)
          }}
        />
      )}
      {detailLog && (
        <ReadingLogEditModal
          log={detailLog}
          onClose={() => setDetailLog(null)}
          onSaved={updated => { setReadingLogs(prev => prev.map(r => r.id === updated.id ? updated : r)); setDetailLog(updated); fetchReadingLogs().then(setReadingLogs) }}
          onDeleted={() => { setReadingLogs(prev => prev.filter(r => r.id !== detailLog.id)); setDetailLog(null); onReadingSaved?.() }}
        />
      )}
    </div>
  )
}

function FortuneSpreadView({
  deck,
  cards,
  onBack,
  onReadingSaved,
}: { deck: FortuneDeckRow; cards: TarotCardDisplay[]; onBack: () => void; onReadingSaved?: () => void }) {
  const isMobile = useIsMobile()
  const today = new Date()
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`

  const [tarotQuestion, setTarotQuestion] = useState('')
  const [shuffledDeck, setShuffledDeck] = useState<TarotCardDisplay[]>(() => shuffleArray(cards))
  const [flippedCards, setFlippedCards] = useState<TarotCardDisplay[]>([])
  const [cardSize, setCardSize] = useState(80)

  useEffect(() => {
    setShuffledDeck(shuffleArray(cards))
    setFlippedCards([])
  }, [deck.id, cards])

  function reshuffleDeck() {
    setShuffledDeck(shuffleArray(cards))
    setFlippedCards([])
  }

  function toggleCard(id: string) {
    const card = shuffledDeck.find(c => c.id === id)
    if (!card) return
    const idx = flippedCards.findIndex(c => c.id === id)
    if (idx >= 0) {
      setFlippedCards(prev => prev.filter(c => c.id !== id))
    } else {
      setFlippedCards(prev => [...prev, card])
    }
  }

  async function handleSaveReading() {
    const question = tarotQuestion.trim()
    if (!question) {
      alert('질문을 입력하고 카드를 먼저 뽑아주세요!')
      return
    }
    if (flippedCards.length === 0) {
      alert('질문을 입력하고 카드를 먼저 뽑아주세요!')
      return
    }
    const drawnCards = flippedCards.map(c => ({ emoji: c.emoji, name_ko: c.name_ko, name_en: c.name_en }))
    const row = await insertReadingLog(question, drawnCards)
    if (row) {
      setFlippedCards([])
      onReadingSaved?.()
    }
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '14px 12px' : '36px 48px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#37352F' }}>
          <ChevronLeft size={16} /> 뒤로 가기 (Fortune 메인으로)
        </button>
        <span style={{ fontSize: '10px', fontWeight: 800, color: '#7C3AED', letterSpacing: '0.2em', textTransform: 'uppercase' }}>🔮 Fortune</span>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#37352F' }}>{deck.name}</h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#787774', fontWeight: 500 }}>{dateStr}</p>
      </div>

      <div style={{
        marginBottom: '24px',
        padding: '24px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(99,102,241,0.04) 100%)',
        border: '1px solid rgba(124,58,237,0.12)',
      }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            value={tarotQuestion}
            onChange={e => setTarotQuestion(e.target.value)}
            placeholder="오늘의 질문이나 주제를 적어보세요..."
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '14px 18px',
              borderRadius: '12px',
              border: '1px solid rgba(0,0,0,0.08)',
              backgroundColor: '#FFFFFF',
              fontSize: '14px',
              color: '#37352F',
              outline: 'none',
            }}
          />
          <button
            onClick={handleSaveReading}
            style={{
              padding: '14px 20px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: '#7C3AED',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 8px rgba(124,58,237,0.3)',
              transition: 'background-color 0.2s, transform 0.15s, box-shadow 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#6D28D9'
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(124,58,237,0.4)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = '#7C3AED'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(124,58,237,0.3)'
            }}
          >
            💾 점괘 기록하기
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#7C3AED' }}>🃏 {cards.length}장 — 카드를 클릭해 뒤집어 보세요</p>
          <button onClick={reshuffleDeck} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(124,58,237,0.3)', backgroundColor: 'rgba(124,58,237,0.08)', color: '#7C3AED', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>다시 섞기</button>
        </div>
        {/* 카드 크기 조절 슬라이더 */}
        <div className="flex flex-col gap-2 mb-4">
          <label className="text-xs font-bold text-[#7C3AED] tracking-wide uppercase flex items-center gap-2">
            <span>카드 크기 조절</span>
            <span className="text-[#9B9A97] font-medium normal-case tracking-normal">({cardSize}px)</span>
          </label>
          <input
            type="range"
            min={80}
            max={350}
            value={cardSize}
            onChange={e => setCardSize(Number(e.target.value))}
            className="fortune-card-size-slider w-full max-w-[280px]"
          />
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`,
            gap: '12px',
          }}
        >
          {shuffledDeck.map(card => (
            <div
              key={card.id}
              onClick={() => toggleCard(card.id)}
              style={{
                aspectRatio: '2/3',
                cursor: 'pointer',
                perspective: '1000px',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  transformStyle: 'preserve-3d',
                  WebkitTransformStyle: 'preserve-3d',
                  transform: flippedCards.some(c => c.id === card.id) ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <TarotCardFace card={card} isFront={false} />
                <TarotCardFace card={card} isFront={true} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FortunePage({ onReadingSaved }: { onReadingSaved?: () => void }) {
  const isMobile = useIsMobile()
  const [decks, setDecks] = useState<FortuneDeckRow[]>([])
  const [selectedDeck, setSelectedDeck] = useState<FortuneDeckRow | null>(null)
  const [spreadCards, setSpreadCards] = useState<TarotCardDisplay[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetchFortuneDecks().then(d => {
      setDecks(d)
      setLoading(false)
    })
  }, [])

  async function handleSelectDeck(deck: FortuneDeckRow) {
    setLoading(true)
    if (deck.id === '__fallback__') {
      setSpreadCards(TAROT_DECK)
      setSelectedDeck(deck)
    } else {
      const rows = await fetchFortuneCards(deck.id)
      const display = rows.length > 0 ? rows.map(fortuneCardToDisplay) : TAROT_DECK
      setSpreadCards(display)
      setSelectedDeck(deck)
    }
    setLoading(false)
  }

  function handleBack() {
    setSelectedDeck(null)
    setSpreadCards([])
  }

  if (loading && !selectedDeck) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px', textAlign: 'center' }}>
        <p style={{ color: '#787774', fontSize: '14px' }}>덱 목록을 불러오는 중…</p>
      </div>
    )
  }

  if (selectedDeck && spreadCards.length > 0) {
    return (
      <>
        <FortuneSpreadView deck={selectedDeck} cards={spreadCards} onBack={handleBack} onReadingSaved={onReadingSaved} />
      </>
    )
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '14px 12px' : '36px 48px' }}>
      <FortuneHub
        decks={decks}
        onSelectDeck={handleSelectDeck}
        onDecksChange={setDecks}
        onReadingSaved={onReadingSaved}
      />
    </div>
  )
}

// ═══════════════════════════════════════ TRAVEL ══════════════════════════════
const TRAVEL_KEY = 'creative_os_travel_v1'
const TRAVEL_TRIPS_KEY = 'creative_os_travel_trips_v1'

type TravelTrip = { id: string; title: string; startDate: string; endDate: string; color: string; note: string; countryFlag?: string }
const DEFAULT_TRAVEL_TRIPS: TravelTrip[] = [
  { id: 'osaka-2026', title: '오사카 여행', startDate: '2026-04-27', endDate: '2026-04-30', color: '#f97316', note: '오사카성 · 만화박물관 · 도톤보리 거리 탐방', countryFlag: '🇯🇵' },
]

const TRIP_COLORS = ['#f97316', '#6366f1', '#34d399', '#f472b6', '#fbbf24', '#60a5fa', '#7C3AED']

function loadTravelTrips(): TravelTrip[] {
  try {
    const raw = localStorage.getItem(TRAVEL_TRIPS_KEY)
    if (!raw) return DEFAULT_TRAVEL_TRIPS
    const saved = JSON.parse(raw) as TravelTrip[]
    const defaultIds = new Set(DEFAULT_TRAVEL_TRIPS.map(t => t.id))
    return [...DEFAULT_TRAVEL_TRIPS, ...saved.filter(t => !defaultIds.has(t.id))]
  } catch { return DEFAULT_TRAVEL_TRIPS }
}
function saveTravelTrips(trips: TravelTrip[]) {
  const defaultIds = new Set(DEFAULT_TRAVEL_TRIPS.map(t => t.id))
  const custom = trips.filter(t => !defaultIds.has(t.id))
  localStorage.setItem(TRAVEL_TRIPS_KEY, JSON.stringify(custom))
  kvSet(TRAVEL_TRIPS_KEY, custom)
}

/** 2026.04.27 ~ 2026.04.30 형식 (년도 포함) */
function fmtTripDateRange(start: string, end: string): string {
  const s = start.split('-'), e = end.split('-')
  return `${s[0]}.${s[1]}.${s[2]} ~ ${e[0]}.${e[1]}.${e[2]}`
}

/** 2026.4.27 ~ 2026.4.30 형식 (년도.월.일, 앞자리 0 제거) */
function fmtTripDateShort(start: string, end: string): string {
  const s = start.split('-'), e = end.split('-')
  return `${s[0]}.${Number(s[1])}.${Number(s[2])} ~ ${e[0]}.${Number(e[1])}.${Number(e[2])}`
}

/** 여행 기간 박/일 계산 (예: 3박 4일) */
function calcTripNights(start: string, end: string): string {
  const [y1, m1, d1] = start.split('-').map(Number)
  const [y2, m2, d2] = end.split('-').map(Number)
  const startD = new Date(y1, m1 - 1, d1)
  const endD = new Date(y2, m2 - 1, d2)
  const diffMs = endD.getTime() - startD.getTime()
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1
  const nights = days - 1
  return `${nights}박 ${days}일`
}

/** D-Day 자동 계산: 여행 시작일과 오늘 비교 */
function calcDDay(startDate: string): { text: string; isPast: boolean } {
  const [y, m, d] = startDate.split('-').map(Number)
  const startD = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  startD.setHours(0, 0, 0, 0)
  const diffMs = startD.getTime() - today.getTime()
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (days > 0) return { text: `D-${days}`, isPast: false }
  if (days === 0) return { text: 'D-Day', isPast: false }
  return { text: '여행완료', isPast: true }
}

type PackItem     = { id: string; label: string; checked: boolean }
type PackCategory = { id: string; label: string; emoji: string; items: PackItem[] }
type TravelStore  = { packing: PackCategory[]; spotMemos: Record<string, string> }

const DEFAULT_PACKING: PackCategory[] = [
  { id: 'essential', label: '필수', emoji: '🛂', items: [
    { id: 'passport',  label: '여권',                         checked: false },
    { id: 'flight',    label: '비행기 표',                     checked: false },
    { id: 'hotel',     label: '호텔 예약 확인서',               checked: false },
    { id: 'yen',       label: '엔화 환전',                      checked: false },
    { id: 'esim',      label: 'eSIM',                          checked: false },
  ]},
  { id: 'creative', label: '창작 도구', emoji: '🎨', items: [
    { id: 'ipad',      label: '아이패드 / 태블릿',              checked: false },
    { id: 'charger',   label: '충전기',                         checked: false },
    { id: 'battery',   label: '보조배터리',                     checked: false },
    { id: 'notebook',  label: '영감 기록용 수첩',               checked: false },
  ]},
  { id: 'daily', label: '생활', emoji: '🧴', items: [
    { id: 'meds',      label: '상비약 (다이어트 보조제 포함)',   checked: false },
    { id: 'shoes',     label: '편한 신발',                      checked: false },
    { id: 'toiletry',  label: '세면도구',                       checked: false },
  ]},
]

const DEFAULT_TRAVEL_SPOTS = [
  { id: 'osaka_castle',  name: '오사카성',               emoji: '🏯', tag: '역사적 영감 & 풍경 촬영', desc: '도요토미 히데요시의 천하통일 성채. 거대한 돌벽과 황금 지붕이 만드는 압도적 스케일 — 웹툰 배경 레퍼런스로 반드시 촬영.' },
  { id: 'tezuka_museum', name: '테즈카 오사무 만화 박물관', emoji: '✒️', tag: '만화의 신께 바치는 순례', desc: '아톰, 블랙잭의 아버지 테즈카 오사무가 남긴 창작의 유산. 작화와 스토리텔링의 근원을 직접 느끼는 창작 성지.' },
  { id: 'kyoto_day',     name: '교토 당일치기',          emoji: '⛩️', tag: '전통미 & 정적인 충전',   desc: '후시미이나리의 붉은 도리이, 아라시야마 대나무 숲. 한국 웹툰에서 보기 드문 동양 판타지 세계관을 흡수하는 감성 코스.' },
]

// ── 여행별 상세 데이터 (커스텀 가능) ──
type TravelSpot = { id: string; name: string; emoji: string; tag: string; desc: string }
type ScheduleItem = { id: string; date: string; title: string; note: string; time?: string }
type PhotoItem = { id: string; url: string; caption?: string }
type ItineraryStep = { id: string; title?: string; imageUrl?: string; note?: string }
type ExpenseCategory = { id: string; label: string; emoji: string; sort_order: number }
type RetroRatingItem = { id: string; label: string; emoji: string; sort_order: number }
type RetroTextQuestion = { id: string; label: string; placeholder?: string; sort_order: number }
type RetrospectiveTemplates = { ratingItems: RetroRatingItem[]; textQuestions: RetroTextQuestion[] }

type TravelExpense = { id: string; date: string; category: string; usage: string; amount: number }
type TravelReview = { ratings: Record<string, number>; textAnswers: Record<string, string> }
type TripDetailData = {
  packing: PackCategory[]
  spots: TravelSpot[]
  spotMemos: Record<string, string>
  schedule: ScheduleItem[]
  photos: PhotoItem[]
  tips?: { icon: string; text: string }[]
  coverImageUrl?: string
  coverImagePosition?: string
  heroIcon?: string
  heroMemo?: string
  itinerarySteps?: ItineraryStep[]
  expenses?: TravelExpense[]
  review?: TravelReview | null
}
const TRAVEL_TRIP_DETAIL_KEY = 'creative_os_travel_trip_detail_v1'
const TRAVEL_EXPENSE_CATEGORIES_KEY = 'creative_os_travel_expense_categories_v1'
const TRAVEL_RETROSPECTIVE_TEMPLATES_KEY = 'creative_os_travel_retrospective_templates_v1'

const DEFAULT_ITINERARY_STEPS: ItineraryStep[] = Array.from({ length: 10 }, (_, i) => ({ id: `step_${i}`, title: '', imageUrl: '', note: '' }))

function getDefaultExpenseCategories(): ExpenseCategory[] {
  return [
    { id: 'food', label: '식비', emoji: '🍽️', sort_order: 0 },
    { id: 'transport', label: '교통', emoji: '🚆', sort_order: 1 },
    { id: 'shopping', label: '쇼핑', emoji: '🛍️', sort_order: 2 },
    { id: 'accommodation', label: '숙박', emoji: '🛏️', sort_order: 3 },
    { id: 'other', label: '기타', emoji: '🎫', sort_order: 4 },
  ]
}

function getDefaultRetrospectiveTemplates(): RetrospectiveTemplates {
  return {
    ratingItems: [
      { id: 'satisfaction', label: '만족도 (총평)', emoji: '⭐', sort_order: 0 },
      { id: 'food', label: '식도락 (음식)', emoji: '🍣', sort_order: 1 },
      { id: 'weather', label: '날씨와 운', emoji: '☀️', sort_order: 2 },
    ],
    textQuestions: [
      { id: 'bestMoment', label: '이번 여행에서 가장 좋았던 순간은?', placeholder: '감상을 자유롭게 적어보세요...', sort_order: 0 },
      { id: 'inspiration', label: '새로운 스토리나 작업에 적용할 만한 영감이 있었나요?', placeholder: '창작에 도움이 된 아이디어나 메모를 적어보세요...', sort_order: 1 },
    ],
  }
}

async function loadExpenseCategories(): Promise<ExpenseCategory[]> {
  try {
    const fromKv = await kvGet<ExpenseCategory[]>(TRAVEL_EXPENSE_CATEGORIES_KEY)
    if (fromKv && Array.isArray(fromKv) && fromKv.length > 0) return fromKv
    const raw = localStorage.getItem(TRAVEL_EXPENSE_CATEGORIES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ExpenseCategory[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { /* ignore */ }
  return getDefaultExpenseCategories()
}

function saveExpenseCategories(cats: ExpenseCategory[]) {
  try {
    localStorage.setItem(TRAVEL_EXPENSE_CATEGORIES_KEY, JSON.stringify(cats))
    kvSet(TRAVEL_EXPENSE_CATEGORIES_KEY, cats)
  } catch { /* ignore */ }
}

async function loadRetrospectiveTemplates(): Promise<RetrospectiveTemplates> {
  try {
    const fromKv = await kvGet<RetrospectiveTemplates>(TRAVEL_RETROSPECTIVE_TEMPLATES_KEY)
    if (fromKv && fromKv.ratingItems && fromKv.textQuestions) return fromKv
    const raw = localStorage.getItem(TRAVEL_RETROSPECTIVE_TEMPLATES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as RetrospectiveTemplates
      if (parsed.ratingItems && parsed.textQuestions) return parsed
    }
  } catch { /* ignore */ }
  return getDefaultRetrospectiveTemplates()
}

function saveRetrospectiveTemplates(t: RetrospectiveTemplates) {
  try {
    localStorage.setItem(TRAVEL_RETROSPECTIVE_TEMPLATES_KEY, JSON.stringify(t))
    kvSet(TRAVEL_RETROSPECTIVE_TEMPLATES_KEY, t)
  } catch { /* ignore */ }
}

// ── 여행 설정 편집 모달 (카테고리/회고록 항목 CRUD + 정렬) ────────────────────────
function TravelSettingsEditModal({
  open,
  onClose,
  expenseCategories,
  retrospectiveTemplates,
  onSaveExpenseCategories,
  onSaveRetrospectiveTemplates,
  inputBase,
}: {
  open: boolean
  onClose: () => void
  expenseCategories: ExpenseCategory[]
  retrospectiveTemplates: RetrospectiveTemplates
  onSaveExpenseCategories: (c: ExpenseCategory[]) => void
  onSaveRetrospectiveTemplates: (t: RetrospectiveTemplates) => void
  inputBase: React.CSSProperties
}) {
  const [tab, setTab] = useState<'expense' | 'retro'>('expense')
  const [cats, setCats] = useState<ExpenseCategory[]>(() => expenseCategories)
  const [templates, setTemplates] = useState<RetrospectiveTemplates>(() => retrospectiveTemplates)

  useEffect(() => {
    if (open) {
      setCats([...expenseCategories].sort((a, b) => a.sort_order - b.sort_order))
      setTemplates({
        ratingItems: [...retrospectiveTemplates.ratingItems].sort((a, b) => a.sort_order - b.sort_order),
        textQuestions: [...retrospectiveTemplates.textQuestions].sort((a, b) => a.sort_order - b.sort_order),
      })
    }
  }, [open, expenseCategories, retrospectiveTemplates])

  const moveCat = (idx: number, dir: -1 | 1) => {
    const next = [...cats]
    const ni = idx + dir
    if (ni < 0 || ni >= next.length) return
    ;[next[idx], next[ni]] = [next[ni], next[idx]]
    next.forEach((c, i) => { c.sort_order = i })
    setCats(next)
  }
  const addCat = () => {
    const id = `cat_${Date.now()}`
    setCats([...cats, { id, label: '새 카테고리', emoji: '📦', sort_order: cats.length }])
  }
  const updateCat = (idx: number, patch: Partial<ExpenseCategory>) => {
    const next = [...cats]
    next[idx] = { ...next[idx], ...patch }
    setCats(next)
  }
  const removeCat = (idx: number) => {
    if (cats.length <= 1) return
    const next = cats.filter((_, i) => i !== idx)
    next.forEach((c, i) => { c.sort_order = i })
    setCats(next)
  }

  const moveRating = (idx: number, dir: -1 | 1) => {
    const next = [...templates.ratingItems]
    const ni = idx + dir
    if (ni < 0 || ni >= next.length) return
    ;[next[idx], next[ni]] = [next[ni], next[idx]]
    next.forEach((r, i) => { r.sort_order = i })
    setTemplates({ ...templates, ratingItems: next })
  }
  const addRating = () => {
    const id = `rating_${Date.now()}`
    const items = [...templates.ratingItems, { id, label: '새 평가 항목', emoji: '⭐', sort_order: templates.ratingItems.length }]
    setTemplates({ ...templates, ratingItems: items })
  }
  const updateRating = (idx: number, patch: Partial<RetroRatingItem>) => {
    const next = [...templates.ratingItems]
    next[idx] = { ...next[idx], ...patch }
    setTemplates({ ...templates, ratingItems: next })
  }
  const removeRating = (idx: number) => {
    const next = templates.ratingItems.filter((_, i) => i !== idx)
    next.forEach((r, i) => { r.sort_order = i })
    setTemplates({ ...templates, ratingItems: next })
  }

  const moveText = (idx: number, dir: -1 | 1) => {
    const next = [...templates.textQuestions]
    const ni = idx + dir
    if (ni < 0 || ni >= next.length) return
    ;[next[idx], next[ni]] = [next[ni], next[idx]]
    next.forEach((q, i) => { q.sort_order = i })
    setTemplates({ ...templates, textQuestions: next })
  }
  const addText = () => {
    const id = `text_${Date.now()}`
    const items = [...templates.textQuestions, { id, label: '새 질문', placeholder: '답변을 입력하세요...', sort_order: templates.textQuestions.length }]
    setTemplates({ ...templates, textQuestions: items })
  }
  const updateText = (idx: number, patch: Partial<RetroTextQuestion>) => {
    const next = [...templates.textQuestions]
    next[idx] = { ...next[idx], ...patch }
    setTemplates({ ...templates, textQuestions: next })
  }
  const removeText = (idx: number) => {
    const next = templates.textQuestions.filter((_, i) => i !== idx)
    next.forEach((q, i) => { q.sort_order = i })
    setTemplates({ ...templates, textQuestions: next })
  }

  const handleSave = () => {
    onSaveExpenseCategories(cats)
    onSaveRetrospectiveTemplates(templates)
    onClose()
  }

  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 20, maxWidth: 520, width: '90%', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#37352F' }}>⚙️ 항목 편집</h3>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(0,0,0,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', gap: 4, padding: '12px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: 'rgba(0,0,0,0.02)' }}>
          <button onClick={() => setTab('expense')} style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none', background: tab === 'expense' ? '#fff' : 'transparent', color: tab === 'expense' ? '#37352F' : '#787774', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: tab === 'expense' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none' }}>💰 가계부 카테고리</button>
          <button onClick={() => setTab('retro')} style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none', background: tab === 'retro' ? '#fff' : 'transparent', color: tab === 'retro' ? '#37352F' : '#787774', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: tab === 'retro' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none' }}>📝 회고록 항목</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {tab === 'expense' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#787774' }}>지출 카테고리 (이모지 + 이름)</span>
                <button onClick={addCat} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)', color: '#4F46E5', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}><Plus size={12} />추가</button>
              </div>
              {cats.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '12px 14px', background: '#F4F4F2', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button onClick={() => moveCat(i, -1)} disabled={i === 0} style={{ width: 28, height: 20, padding: 0, border: 'none', background: 'transparent', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1 }}><ChevronUp size={16} /></button>
                    <button onClick={() => moveCat(i, 1)} disabled={i === cats.length - 1} style={{ width: 28, height: 20, padding: 0, border: 'none', background: 'transparent', cursor: i === cats.length - 1 ? 'default' : 'pointer', opacity: i === cats.length - 1 ? 0.3 : 1 }}><ChevronDown size={16} /></button>
                  </div>
                  <input value={c.emoji} onChange={e => updateCat(i, { emoji: e.target.value || '📦' })} style={{ width: 40, textAlign: 'center', fontSize: 18, border: 'none', background: 'transparent', outline: 'none' }} maxLength={2} />
                  <input value={c.label} onChange={e => updateCat(i, { label: e.target.value })} style={{ ...inputBase, flex: 1, padding: '8px 10px' }} placeholder="카테고리 이름" />
                  <button onClick={() => removeCat(i)} disabled={cats.length <= 1} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: cats.length <= 1 ? 'default' : 'pointer', opacity: cats.length <= 1 ? 0.4 : 1 }}><Trash2 size={14} color="#ef4444" /></button>
                </div>
              ))}
            </div>
          )}
          {tab === 'retro' && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#787774' }}>5점 평가 항목</span>
                  <button onClick={addRating} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)', color: '#4F46E5', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}><Plus size={12} />추가</button>
                </div>
                {templates.ratingItems.map((r, i) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '12px 14px', background: '#F4F4F2', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button onClick={() => moveRating(i, -1)} disabled={i === 0} style={{ width: 28, height: 20, padding: 0, border: 'none', background: 'transparent', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1 }}><ChevronUp size={16} /></button>
                      <button onClick={() => moveRating(i, 1)} disabled={i === templates.ratingItems.length - 1} style={{ width: 28, height: 20, padding: 0, border: 'none', background: 'transparent', cursor: i === templates.ratingItems.length - 1 ? 'default' : 'pointer', opacity: i === templates.ratingItems.length - 1 ? 0.3 : 1 }}><ChevronDown size={16} /></button>
                    </div>
                    <input value={r.emoji} onChange={e => updateRating(i, { emoji: e.target.value || '⭐' })} style={{ width: 40, textAlign: 'center', fontSize: 18, border: 'none', background: 'transparent', outline: 'none' }} maxLength={2} />
                    <input value={r.label} onChange={e => updateRating(i, { label: e.target.value })} style={{ ...inputBase, flex: 1, padding: '8px 10px' }} placeholder="평가 항목 이름" />
                    <button onClick={() => removeRating(i)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Trash2 size={14} color="#ef4444" /></button>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#787774' }}>텍스트 질문</span>
                  <button onClick={addText} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)', color: '#4F46E5', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}><Plus size={12} />추가</button>
                </div>
                {templates.textQuestions.map((q, i) => (
                  <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10, padding: '12px 14px', background: '#F4F4F2', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <button onClick={() => moveText(i, -1)} disabled={i === 0} style={{ width: 28, height: 20, padding: 0, border: 'none', background: 'transparent', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1 }}><ChevronUp size={16} /></button>
                        <button onClick={() => moveText(i, 1)} disabled={i === templates.textQuestions.length - 1} style={{ width: 28, height: 20, padding: 0, border: 'none', background: 'transparent', cursor: i === templates.textQuestions.length - 1 ? 'default' : 'pointer', opacity: i === templates.textQuestions.length - 1 ? 0.3 : 1 }}><ChevronDown size={16} /></button>
                      </div>
                      <input value={q.label} onChange={e => updateText(i, { label: e.target.value })} style={{ ...inputBase, flex: 1, padding: '8px 10px' }} placeholder="질문 내용" />
                      <button onClick={() => removeText(i)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><Trash2 size={14} color="#ef4444" /></button>
                    </div>
                    <input value={q.placeholder ?? ''} onChange={e => updateText(i, { placeholder: e.target.value })} style={{ ...inputBase, padding: '8px 10px', marginLeft: 44 }} placeholder="placeholder (선택)" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', background: 'transparent', color: '#787774', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>취소</button>
          <button onClick={handleSave} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>저장</button>
        </div>
      </div>
    </div>
  )
}

function getDefaultTripDetail(tripId: string, trip?: TravelTrip): TripDetailData {
  const isOsaka = tripId === 'osaka-2026' || trip?.title?.includes('오사카')
  return {
    packing: DEFAULT_PACKING.map(cat => ({ ...cat, items: cat.items.map(i => ({ ...i, checked: false })) })),
    spots: isOsaka ? [...DEFAULT_TRAVEL_SPOTS] : [],
    spotMemos: {},
    schedule: [],
    photos: [],
    itinerarySteps: DEFAULT_ITINERARY_STEPS,
    tips: isOsaka ? [
      { icon: '🚇', text: 'IC 카드(ICOCA) 첫날 바로 구매 → 지하철·버스 올인원 교통' },
      { icon: '🍜', text: '도톤보리 타코야키 & 라멘 → 창작 에너지 보충 필수' },
      { icon: '📸', text: '오사카성 & 만화박물관 → 웹툰 배경 레퍼런스 대량 촬영' },
      { icon: '🕐', text: '교토 당일치기 → 아침 일찍 출발해 후시미이나리 인파 피하기' },
    ] : [],
  }
}

function loadTripDetail(tripId: string, trip?: TravelTrip): TripDetailData {
  try {
    const raw = localStorage.getItem(TRAVEL_TRIP_DETAIL_KEY)
    if (!raw) return getDefaultTripDetail(tripId, trip)
    const all: Record<string, TripDetailData> = JSON.parse(raw)
    const saved = all[tripId]
    if (!saved) return getDefaultTripDetail(tripId, trip)
    const def = getDefaultTripDetail(tripId, trip)
    return {
      packing: (saved.packing?.length ? saved.packing : def.packing).map(cat => ({
        ...cat,
        items: cat.items.map(item => ({ ...item, checked: item.checked ?? false })),
      })),
      spots: saved.spots?.length ? saved.spots : def.spots,
      spotMemos: saved.spotMemos ?? {},
      schedule: saved.schedule ?? [],
      photos: saved.photos ?? [],
      tips: saved.tips?.length ? saved.tips : def.tips,
      coverImageUrl: saved.coverImageUrl ?? def.coverImageUrl,
      coverImagePosition: saved.coverImagePosition ?? def.coverImagePosition ?? 'center center',
      heroIcon: saved.heroIcon ?? def.heroIcon ?? '✈️',
      heroMemo: saved.heroMemo ?? def.heroMemo ?? '',
      itinerarySteps: (saved.itinerarySteps?.length ? saved.itinerarySteps : def.itinerarySteps ?? DEFAULT_ITINERARY_STEPS).map((s, i) => ({ ...s, id: s.id || `step_${i}` })),
      expenses: (saved.expenses ?? []).map(e => ({ ...e, category: typeof e.category === 'string' ? e.category : String(e.category) })),
      review: migrateReview(saved.review),
    }
  } catch { return getDefaultTripDetail(tripId, trip) }
}

function migrateReview(r: unknown): TravelReview | null {
  if (!r || typeof r !== 'object') return null
  const o = r as Record<string, unknown>
  if (o.ratings && o.textAnswers && typeof o.ratings === 'object' && typeof o.textAnswers === 'object') return r as TravelReview
  const ratings: Record<string, number> = {}
  const textAnswers: Record<string, string> = {}
  if (typeof o.satisfaction === 'number') ratings.satisfaction = o.satisfaction
  if (typeof o.food === 'number') ratings.food = o.food
  if (typeof o.weather === 'number') ratings.weather = o.weather
  if (typeof o.bestMoment === 'string') textAnswers.bestMoment = o.bestMoment
  if (typeof o.inspiration === 'string') textAnswers.inspiration = o.inspiration
  if (Object.keys(ratings).length === 0 && Object.keys(textAnswers).length === 0) return null
  return { ratings, textAnswers }
}

function saveTripDetail(tripId: string, data: TripDetailData) {
  try {
    const raw = localStorage.getItem(TRAVEL_TRIP_DETAIL_KEY)
    const all: Record<string, TripDetailData> = raw ? JSON.parse(raw) : {}
    all[tripId] = data
    localStorage.setItem(TRAVEL_TRIP_DETAIL_KEY, JSON.stringify(all))
    kvSet(TRAVEL_TRIP_DETAIL_KEY, all)
  } catch { /* ignore */ }
}

function loadTravel(): TravelStore {
  try {
    const raw = localStorage.getItem(TRAVEL_KEY)
    if (!raw) return { packing: DEFAULT_PACKING, spotMemos: {} }
    const saved = JSON.parse(raw) as TravelStore
    return {
      packing: DEFAULT_PACKING.map(cat => ({
        ...cat,
        items: cat.items.map(item => {
          const scat = saved.packing?.find(c => c.id === cat.id)
          const sit  = scat?.items?.find(i => i.id === item.id)
          return sit ? { ...item, checked: sit.checked } : item
        }),
      })),
      spotMemos: saved.spotMemos ?? {},
    }
  } catch { return { packing: DEFAULT_PACKING, spotMemos: {} } }
}
function saveTravel(d: TravelStore) { localStorage.setItem(TRAVEL_KEY, JSON.stringify(d)); kvSet(TRAVEL_KEY, d) }

// ── Gourmet & Diet ────────────────────────────────────────────────────────────
const GOURMET_KEY = 'creative_os_gourmet_v1'

type RestaurantItem = {
  id: string; name: string; area: string
  type: 'cheat' | 'diet'; note: string; visited: boolean
}
type MealEntry    = { breakfast: string; lunch: string; dinner: string; dietOk: boolean }
type GourmetStore = {
  restaurants: RestaurantItem[]
  dietMenuNotes: Record<string, string>
  meals: Record<string, MealEntry>
}

const DEFAULT_RESTAURANTS: RestaurantItem[] = [
  { id: 'ichiran',      name: '이치란 라멘 (난바점)',      area: '오사카 난바',      type: 'cheat', note: '', visited: false },
  { id: 'takoyaki',     name: '도톤보리 타코야키',          area: '도톤보리',         type: 'cheat', note: '', visited: false },
  { id: 'okonomiyaki',  name: '오코노미야키 (기시다야)',    area: '오사카',           type: 'cheat', note: '', visited: false },
  { id: 'sashimi_r',    name: '사시미 정식',               area: '어시장 근처',      type: 'diet',  note: '', visited: false },
  { id: 'yudofu_r',     name: '교토 유도후',               area: '교토 전통 식당',   type: 'diet',  note: '', visited: false },
  { id: 'cvs_r',        name: '편의점 샐러드 치킨',         area: '패밀리마트/로손',  type: 'diet',  note: '', visited: false },
]

const DIET_MENUS = [
  { id: 'yakitori',    cat: 'protein' as const, emoji: '🍢', name: '야키토리 (소금구이)',   desc: '고단백·저지방. 소금구이 주문 시 소스 당분 없음.' },
  { id: 'sashimi_d',   cat: 'protein' as const, emoji: '🐟', name: '사시미 정식',          desc: '생선회+미소시루. 순수 단백질 폭격. 이자카야·어시장.' },
  { id: 'cvs_chicken', cat: 'protein' as const, emoji: '🥗', name: '편의점 샐러드 치킨',   desc: '로손·패밀리마트. 100g당 ~23g 단백질.' },
  { id: 'yudofu_d',    cat: 'lowcarb' as const, emoji: '🍲', name: '유도후 (교토 두부탕)', desc: '교토 전통 두부탕. 저칼로리·고단백. 담백한 정석.' },
  { id: 'konjac',      cat: 'lowcarb' as const, emoji: '🍜', name: '곤약면 요리',          desc: '탄수화물 제로에 가까움. 슈퍼마켓·편의점 구매 가능.' },
  { id: 'miso',        cat: 'lowcarb' as const, emoji: '🍵', name: '미소시루',             desc: '저탄수 국물 요리. 포만감 UP. 어느 식당에서나 가능.' },
]

const TRAVEL_DATES = [
  { key: '2026-04-27', label: '4/27 (월)', theme: '🏯 오사카 도착' },
  { key: '2026-04-28', label: '4/28 (화)', theme: '🏙️ 오사카 탐방' },
  { key: '2026-04-29', label: '4/29 (수)', theme: '⛩️ 교토 당일치기' },
  { key: '2026-04-30', label: '4/30 (목)', theme: '✈️ 귀국일' },
]

const EMPTY_MEAL: MealEntry = { breakfast: '', lunch: '', dinner: '', dietOk: false }

function loadGourmet(): GourmetStore {
  try {
    const raw = localStorage.getItem(GOURMET_KEY)
    if (!raw) return { restaurants: DEFAULT_RESTAURANTS, dietMenuNotes: {}, meals: {} }
    const saved = JSON.parse(raw) as GourmetStore
    const existing = new Set((saved.restaurants ?? []).map(r => r.id))
    return {
      restaurants: [...DEFAULT_RESTAURANTS.filter(r => !existing.has(r.id)), ...(saved.restaurants ?? [])],
      dietMenuNotes: saved.dietMenuNotes ?? {},
      meals: saved.meals ?? {},
    }
  } catch { return { restaurants: DEFAULT_RESTAURANTS, dietMenuNotes: {}, meals: {} } }
}
function saveGourmet(d: GourmetStore) { localStorage.setItem(GOURMET_KEY, JSON.stringify(d)); kvSet(GOURMET_KEY, d) }

// ── 여행 가계부 (Expense Ledger) ────────────────────────────────────────────────
function ExpenseLedger({
  expenses,
  categories,
  onAdd,
  onUpdate,
  onRemove,
  onOpenSettings,
  inputBase,
  isCompact,
}: {
  expenses: TravelExpense[]
  categories: ExpenseCategory[]
  onAdd: (e: TravelExpense) => void
  onUpdate: (id: string, patch: Partial<TravelExpense>) => void
  onRemove: (id: string) => void
  onOpenSettings?: () => void
  inputBase: React.CSSProperties
  isCompact?: boolean
}) {
  const sortedCats = [...categories].sort((a, b) => a.sort_order - b.sort_order)
  const firstCatId = sortedCats[0]?.id ?? 'other'
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), category: firstCatId, usage: '', amount: '' })
  const [editingId, setEditingId] = useState<string | null>(null)

  const total = expenses.reduce((s, e) => s + e.amount, 0)
  const byCat = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount
    return acc
  }, {} as Record<string, number>)

  const handleSubmit = () => {
    const amount = parseInt( String(form.amount).replace(/\D/g, ''), 10 )
    if (!form.usage.trim() || isNaN(amount) || amount <= 0) return
    onAdd({ id: `exp_${Date.now()}`, date: form.date, category: form.category, usage: form.usage.trim(), amount })
    setForm({ ...form, usage: '', amount: '' })
  }

  const grouped = expenses.reduce((acc, e) => {
    if (!acc[e.date]) acc[e.date] = []
    acc[e.date].push(e)
    return acc
  }, {} as Record<string, TravelExpense[]>)
  const sortedDates = Object.keys(grouped).sort()

  const formatAmount = (n: number) => n.toLocaleString() + '원'

  useEffect(() => {
    if (!sortedCats.some(c => c.id === form.category)) setForm(f => ({ ...f, category: firstCatId }))
  }, [sortedCats, firstCatId, form.category])

  return (
    <div style={{ width: '100%', padding: isCompact ? 20 : 0 }}>
      {/* 섹션 헤더 + 설정 버튼 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#37352F' }}>💰 여행 가계부</h3>
        {onOpenSettings && (
          <button onClick={onOpenSettings} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', background: 'transparent', color: '#787774', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} title="항목 편집">
            <Settings size={16} />항목 편집
          </button>
        )}
      </div>
      {/* 대시보드 */}
      <div style={{ background: isCompact ? '#F4F4F2' : 'rgba(255,255,255,0.6)', backdropFilter: isCompact ? 'none' : 'blur(20px)', WebkitBackdropFilter: isCompact ? 'none' : 'blur(20px)', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: isCompact ? 18 : 28, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>총 지출</p>
        <p style={{ margin: '8px 0 16px', fontSize: 36, fontWeight: 900, color: '#37352F', letterSpacing: '-0.02em' }}>{formatAmount(total)}</p>
        {total > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sortedCats.map(({ id, emoji, label }) => {
              const amt = byCat[id] ?? 0
              const pct = total > 0 ? (amt / total) * 100 : 0
              return (
                <div key={id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#37352F' }}>{emoji} {label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#37352F' }}>{formatAmount(amt)} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div style={{ height: 6, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 입력 폼 */}
      <div style={{ background: isCompact ? '#F4F4F2' : 'rgba(255,255,255,0.6)', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: isCompact ? 16 : 20, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: isCompact ? '1 1 calc(50% - 5px)' : '1 1 120px', minWidth: isCompact ? 80 : 100 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#787774', marginBottom: 4 }}>날짜</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={{ ...inputBase, width: '100%', padding: '10px 12px' }} />
          </div>
          <div style={{ flex: isCompact ? '1 1 calc(50% - 5px)' : '1 1 140px', minWidth: isCompact ? 80 : 100 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#787774', marginBottom: 4 }}>카테고리</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...inputBase, width: '100%', padding: '10px 12px', cursor: 'pointer' }}>
              {sortedCats.map(c => (
                <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: isCompact ? '1 1 100%' : '2 1 180px', minWidth: isCompact ? '100%' : 120 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#787774', marginBottom: 4 }}>사용처</label>
            <input value={form.usage} onChange={e => setForm(f => ({ ...f, usage: e.target.value }))} placeholder="도톤보리 타코야키, 오사카역 전철" style={{ ...inputBase, width: '100%', padding: '10px 12px' }} />
          </div>
          <div style={{ flex: isCompact ? '1 1 calc(50% - 5px)' : '1 1 100px', minWidth: isCompact ? 80 : 90 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#787774', marginBottom: 4 }}>금액</label>
            <input type="text" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',') }))} placeholder="50,000" style={{ ...inputBase, width: '100%', padding: '10px 12px' }} />
          </div>
          <button onClick={handleSubmit} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flex: isCompact ? '1 1 calc(50% - 5px)' : 'none', justifyContent: 'center', minWidth: isCompact ? 80 : undefined }}>
            <Plus size={16} />추가
          </button>
        </div>
      </div>

      {/* 리스트 (compact 시 스크롤 영역) */}
      {expenses.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, background: 'rgba(99,102,241,0.04)', borderRadius: 14, border: '1px dashed rgba(99,102,241,0.25)', color: '#787774', fontSize: 14, minHeight: isCompact ? 120 : 180 }}>
          <span style={{ fontSize: 40, marginBottom: 8, opacity: 0.6 }}>💰</span>
          <p style={{ margin: 0, fontWeight: 600 }}>아직 기록된 지출이 없어요</p>
          <p style={{ margin: '4px 0 0', fontSize: 12 }}>위 폼에서 지출을 추가해보세요</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: isCompact ? 600 : undefined, overflowY: isCompact ? 'auto' : undefined, paddingRight: isCompact ? 4 : 0 }}>
          {sortedDates.map(date => (
            <div key={date} style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.5)', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '12px 18px', backgroundColor: 'rgba(99,102,241,0.08)', borderBottom: '1px solid rgba(99,102,241,0.12)', fontSize: 12, fontWeight: 700, color: '#4F46E5' }}>
                {date.replace(/-/g, '.')} · {grouped[date].length}건
              </div>
              {grouped[date].map(exp => (
                <div key={exp.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <span style={{ fontSize: 20 }}>{sortedCats.find(c => c.id === exp.category)?.emoji ?? '🎫'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#37352F' }}>{exp.usage}</p>
                    <span style={{ fontSize: 11, color: '#787774' }}>{sortedCats.find(c => c.id === exp.category)?.label ?? exp.category}</span>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#37352F' }}>{formatAmount(exp.amount)}</span>
                  {editingId === exp.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input type="date" value={exp.date} onChange={e => onUpdate(exp.id, { date: e.target.value })} style={{ ...inputBase, width: 110, padding: '6px 8px' }} />
                      <select value={exp.category} onChange={e => onUpdate(exp.id, { category: e.target.value })} style={{ ...inputBase, width: 90, padding: '6px 8px' }}>
                        {sortedCats.map(c => <option key={c.id} value={c.id}>{c.emoji}</option>)}
                      </select>
                      <input value={exp.usage} onChange={e => onUpdate(exp.id, { usage: e.target.value })} style={{ ...inputBase, width: 120, padding: '6px 8px' }} />
                      <input type="number" value={exp.amount} onChange={e => onUpdate(exp.id, { amount: parseInt(e.target.value, 10) || 0 })} style={{ ...inputBase, width: 90, padding: '6px 8px' }} />
                      <button onClick={() => setEditingId(null)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: '#34d399', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>저장</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => setEditingId(exp.id)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="수정">
                        <Pencil size={14} color="#6366f1" />
                      </button>
                      <button onClick={() => onRemove(exp.id)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="삭제">
                        <Trash2 size={14} color="#ef4444" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 여행 회고록 (Trip Retrospective) ────────────────────────────────────────────
function TripRetrospective({ review, templates, onSave, onOpenSettings, inputBase, isCompact }: {
  review: TravelReview | null
  templates: RetrospectiveTemplates
  onSave: (r: TravelReview) => void
  onOpenSettings?: () => void
  inputBase: React.CSSProperties
  isCompact?: boolean
}) {
  const [editing, setEditing] = useState(!review)
  const [form, setForm] = useState<TravelReview>(() => ({
    ratings: { ...review?.ratings },
    textAnswers: { ...review?.textAnswers },
  }))

  useEffect(() => {
    if (review) setForm({ ratings: { ...review.ratings }, textAnswers: { ...review.textAnswers } })
  }, [review])

  const handleSave = () => {
    onSave(form)
    setEditing(false)
  }

  const ratingItems = [...templates.ratingItems].sort((a, b) => a.sort_order - b.sort_order)
  const textQuestions = [...templates.textQuestions].sort((a, b) => a.sort_order - b.sort_order)

  const StarRating = ({ value, onChange, max = 5, emoji = '⭐' }: { value: number; onChange: (n: number) => void; max?: number; emoji?: string }) => (
    <div style={{ display: 'flex', gap: 4 }}>
      {Array.from({ length: max }, (_, i) => (
        <button key={i} type="button" onClick={() => onChange(i + 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, fontSize: 24, opacity: i < value ? 1 : 0.25, transition: 'opacity 0.2s' }}>
          {emoji}
        </button>
      ))}
    </div>
  )

  const cardStyle: React.CSSProperties = {
    background: isCompact ? '#F4F4F2' : 'rgba(255,255,255,0.6)',
    backdropFilter: isCompact ? 'none' : 'blur(20px)',
    WebkitBackdropFilter: isCompact ? 'none' : 'blur(20px)',
    borderRadius: isCompact ? 14 : 20,
    border: '1px solid rgba(0,0,0,0.06)',
    padding: isCompact ? 20 : 28,
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
  }

  if (!editing && review) {
    const hasRatings = ratingItems.some(r => (review.ratings[r.id] ?? 0) > 0)
    const hasText = textQuestions.some(q => (review.textAnswers[q.id] ?? '').trim())
    const hasContent = hasRatings || hasText
    return (
      <div style={{ width: '100%', padding: isCompact ? 20 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#37352F' }}>📝 여행 회고록</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {onOpenSettings && (
              <button onClick={onOpenSettings} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', background: 'transparent', color: '#787774', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} title="항목 편집">
                <Settings size={16} />항목 편집
              </button>
            )}
            <button onClick={() => setEditing(true)} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)', color: '#4F46E5', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Pencil size={14} style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} />편집
            </button>
          </div>
        </div>
        <div style={cardStyle}>
          {!hasContent ? (
            <p style={{ margin: 0, fontSize: 14, color: '#9B9A97', fontStyle: 'italic' }}>아직 작성된 내용이 없어요. 편집 버튼을 눌러 회고록을 작성해보세요.</p>
          ) : (
          <>
          {ratingItems.map(r => {
            const v = review.ratings[r.id] ?? 0
            if (v <= 0) return null
            return (
              <div key={r.id} style={{ marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#787774', marginBottom: 4 }}>{r.label}</p>
                <span style={{ fontSize: 18 }}>{r.emoji.repeat(v)}</span>
              </div>
            )
          })}
          {textQuestions.map(q => {
            const text = review.textAnswers[q.id] ?? ''
            if (!text.trim()) return null
            return (
              <div key={q.id} style={{ marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#787774', marginBottom: 4 }}>{q.label}</p>
                <p style={{ margin: 0, fontSize: 14, color: '#37352F', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{text}</p>
              </div>
            )
          })}
          </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', padding: isCompact ? 20 : 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#37352F' }}>📝 여행 회고록</h3>
        {onOpenSettings && (
          <button onClick={onOpenSettings} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', background: 'transparent', color: '#787774', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} title="항목 편집">
            <Settings size={16} />항목 편집
          </button>
        )}
      </div>
      {!review && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20, padding: 24, background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(12px)', borderRadius: 16, border: '1px dashed rgba(99,102,241,0.2)', color: '#787774', fontSize: 13 }}>
          <span style={{ fontSize: 36, marginBottom: 8, opacity: 0.7 }}>📝</span>
          <p style={{ margin: 0, fontWeight: 600 }}>여행의 감상을 남겨보세요</p>
          <p style={{ margin: '4px 0 0', fontSize: 11 }}>별점과 메모로 여행을 기록해요</p>
        </div>
      )}
      <div style={cardStyle}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 20 }}>여행 회고록</p>
        {ratingItems.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: isCompact ? `repeat(${Math.min(ratingItems.length, 3)}, 1fr)` : `repeat(${Math.min(ratingItems.length, 4)}, 1fr)`, gap: isCompact ? 12 : 20, marginBottom: 20 }}>
            {ratingItems.map(r => (
              <div key={r.id}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#787774', marginBottom: 8 }}>{r.label}</p>
                <StarRating value={form.ratings[r.id] ?? 0} onChange={v => setForm(f => ({ ...f, ratings: { ...f.ratings, [r.id]: v } }))} emoji={r.emoji} />
              </div>
            ))}
          </div>
        )}
        {textQuestions.map(q => (
          <div key={q.id} style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#787774', marginBottom: 8 }}>{q.label}</label>
            <textarea value={form.textAnswers[q.id] ?? ''} onChange={e => setForm(f => ({ ...f, textAnswers: { ...f.textAnswers, [q.id]: e.target.value } }))} placeholder={q.placeholder ?? '답변을 입력하세요...'} rows={isCompact ? 5 : 4} style={{ ...inputBase, width: '100%', lineHeight: 1.8, minHeight: isCompact ? 100 : undefined }} />
          </div>
        ))}
        <button onClick={handleSave} style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          저장하기
        </button>
      </div>
    </div>
  )
}

// ── GourmetSection ────────────────────────────────────────────────────────────
function GourmetSection() {
  const isMobile = useIsMobile()
  const [gourmet,     setGourmet]     = useState<GourmetStore>(() => loadGourmet())
  const [activeMenu,  setActiveMenu]  = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newRest,     setNewRest]     = useState<{ name: string; area: string; type: 'cheat'|'diet' }>({ name: '', area: '', type: 'diet' })

  function persistG(next: GourmetStore) { setGourmet(next); saveGourmet(next) }

  function toggleVisited(id: string) {
    persistG({ ...gourmet, restaurants: gourmet.restaurants.map(r => r.id === id ? { ...r, visited: !r.visited } : r) })
  }
  function addRestaurant() {
    if (!newRest.name.trim()) return
    persistG({ ...gourmet, restaurants: [...gourmet.restaurants, { ...newRest, id: `rest_${Date.now()}`, note: '', visited: false }] })
    setNewRest({ name: '', area: '', type: 'diet' }); setShowAddForm(false)
  }
  function removeRestaurant(id: string) {
    persistG({ ...gourmet, restaurants: gourmet.restaurants.filter(r => r.id !== id) })
  }
  function updateDietNote(menuId: string, note: string) {
    persistG({ ...gourmet, dietMenuNotes: { ...gourmet.dietMenuNotes, [menuId]: note } })
  }
  function updateMeal(dateKey: string, field: keyof MealEntry, value: string | boolean) {
    const cur = gourmet.meals[dateKey] ?? { ...EMPTY_MEAL }
    persistG({ ...gourmet, meals: { ...gourmet.meals, [dateKey]: { ...cur, [field]: value } } })
  }

  const dietOkCount   = TRAVEL_DATES.filter(d => gourmet.meals[d.key]?.dietOk).length
  const proteinMenus  = DIET_MENUS.filter(m => m.cat === 'protein')
  const lowcarbMenus  = DIET_MENUS.filter(m => m.cat === 'lowcarb')

  const cellInput: React.CSSProperties = {
    backgroundColor: '#F4F4F2', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '8px',
    padding: '7px 10px', color: '#37352F', fontSize: '12px', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit', width: '100%',
  }

  function MenuCard({ m, accentColor }: { m: typeof DIET_MENUS[0]; accentColor: string }) {
    const isActive = activeMenu === m.id
    return (
      <div style={{ backgroundColor: '#EEF2FF', borderRadius: '12px', border: `1px solid ${isActive ? `${accentColor}50` : '#EBEBEA'}`, marginBottom: '8px', overflow: 'hidden', transition: 'border-color 0.2s' }}>
        <div onClick={() => setActiveMenu(isActive ? null : m.id)}
          style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '9px', transition: 'background 0.12s' }}
          onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = `${accentColor}08` }}
          onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = '' }}
        >
          <span style={{ fontSize: '20px', flexShrink: 0 }}>{m.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#37352F' }}>{m.name}</p>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#787774', lineHeight: 1.4 }}>{m.desc}</p>
          </div>
          <span style={{ fontSize: '9px', color: isActive ? accentColor : '#D3D1CB', transition: 'transform 0.2s, color 0.2s', display: 'inline-block', transform: isActive ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
        </div>
        {isActive && (
          <div style={{ borderTop: `1px solid ${accentColor}18`, padding: '10px 12px', backgroundColor: `${accentColor}06` }}>
            <p style={{ margin: '0 0 6px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.14em', textTransform: 'uppercase' }}>📍 어디서 먹을까? 메모</p>
            <input value={gourmet.dietMenuNotes[m.id] ?? ''} onChange={e => updateDietNote(m.id, e.target.value)} placeholder="식당 이름 / 편의점 위치..." style={cellInput} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ marginTop: '32px' }}>
      {/* Section divider & header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px', paddingBottom: '18px', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '32px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg,#f97316,#ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(249,115,22,0.35)' }}>
          <Utensils size={18} color="#fff" />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#f97316', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Gourmet &amp; Diet</p>
          <p style={{ margin: 0, fontSize: '19px', fontWeight: 900, color: '#37352F' }}>오사카 미식 설계도</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: dietOkCount === 4 ? 'rgba(52,211,153,0.1)' : 'rgba(99,102,241,0.08)', borderRadius: '12px', padding: '9px 18px', border: `1px solid ${dietOkCount === 4 ? 'rgba(52,211,153,0.3)' : 'rgba(99,102,241,0.2)'}` }}>
          <Heart size={14} color={dietOkCount === 4 ? '#34d399' : '#6366f1'} fill={dietOkCount === 4 ? '#34d399' : 'none'} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: dietOkCount === 4 ? '#34d399' : '#4F46E5' }}>다이어트 준수율: {dietOkCount}/4일</span>
        </div>
      </div>

      {/* Two-column: Wishlist + Diet Guide */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: '22px' }}>

        {/* Restaurant Wishlist */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ fontSize: '16px' }}>🗺️</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#37352F' }}>맛집 위시리스트</span>
            </div>
            <button onClick={() => setShowAddForm(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.28)', backgroundColor: 'rgba(99,102,241,0.08)', color: '#4F46E5', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={10} />추가
            </button>
          </div>

          {showAddForm && (
            <div style={{ backgroundColor: '#EEF2FF', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.22)', padding: '14px', marginBottom: '12px' }}>
              <input value={newRest.name} onChange={e => setNewRest(p => ({ ...p, name: e.target.value }))} placeholder="식당 이름" style={{ ...cellInput, marginBottom: '8px' }} />
              <input value={newRest.area} onChange={e => setNewRest(p => ({ ...p, area: e.target.value }))} placeholder="위치/지역" style={{ ...cellInput, marginBottom: '10px' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['cheat', 'diet'] as const).map(t => (
                  <button key={t} onClick={() => setNewRest(p => ({ ...p, type: t }))} style={{ flex: 1, padding: '7px', borderRadius: '8px', border: `1px solid ${newRest.type === t ? (t === 'cheat' ? '#f97316' : '#34d399') : '#EBEBEA'}`, backgroundColor: newRest.type === t ? (t === 'cheat' ? 'rgba(249,115,22,0.12)' : 'rgba(52,211,153,0.12)') : 'transparent', color: newRest.type === t ? (t === 'cheat' ? '#f97316' : '#34d399') : '#787774', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                    {t === 'cheat' ? '🍔 치팅 데이' : '🥗 다이어트'}
                  </button>
                ))}
                <button onClick={addRestaurant} style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>저장</button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
            {gourmet.restaurants.map(rest => (
              <div key={rest.id} style={{
                backgroundColor: '#fff', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)',
                padding: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', opacity: rest.visited ? 0.6 : 1,
                transition: 'all 0.2s', position: 'relative', display: 'flex', flexDirection: 'column', gap: '8px',
              }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
                  <div onClick={() => toggleVisited(rest.id)} style={{ width: '18px', height: '18px', borderRadius: '5px', border: `2px solid ${rest.visited ? '#6366f1' : '#D3D1CB'}`, backgroundColor: rest.visited ? '#6366f1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s' }}>
                    {rest.visited && <span style={{ fontSize: '10px', color: '#fff', lineHeight: 1 }}>✓</span>}
                  </div>
                  <button onClick={() => removeRestaurant(rest.id)} style={{ width: '22px', height: '22px', borderRadius: '6px', border: 'none', backgroundColor: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, opacity: 0.7 }} onMouseEnter={e => { e.currentTarget.style.opacity = '1' }} onMouseLeave={e => { e.currentTarget.style.opacity = '0.7' }}>
                    <X size={12} color="#ef4444" />
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: rest.visited ? '#9B9A97' : '#37352F', textDecoration: rest.visited ? 'line-through' : 'none', lineHeight: 1.4, flex: 1 }}>{rest.name}</p>
                {rest.area && <p style={{ margin: 0, fontSize: '11px', color: '#787774', lineHeight: 1.3 }}>📍 {rest.area}</p>}
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '8px', color: rest.type === 'cheat' ? '#f97316' : '#34d399', backgroundColor: rest.type === 'cheat' ? 'rgba(249,115,22,0.1)' : 'rgba(52,211,153,0.1)', border: `1px solid ${rest.type === 'cheat' ? 'rgba(249,115,22,0.2)' : 'rgba(52,211,153,0.2)'}`, alignSelf: 'flex-start' }}>
                  {rest.type === 'cheat' ? '🍔 치팅' : '🥗 식단'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Diet Menu Guide */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
            <Apple size={15} color="#34d399" />
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#37352F' }}>현지 다이어트 메뉴 가이드</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <p style={{ margin: '0 0 9px', fontSize: '10px', fontWeight: 800, color: '#f472b6', letterSpacing: '0.13em', textTransform: 'uppercase' }}>💪 고단백</p>
              {proteinMenus.map(m => <MenuCard key={m.id} m={m} accentColor="#f472b6" />)}
            </div>
            <div>
              <p style={{ margin: '0 0 9px', fontSize: '10px', fontWeight: 800, color: '#34d399', letterSpacing: '0.13em', textTransform: 'uppercase' }}>🌿 저탄수</p>
              {lowcarbMenus.map(m => <MenuCard key={m.id} m={m} accentColor="#34d399" />)}
            </div>
          </div>
        </div>
      </div>

      {/* Daily Meal Tracker */}
      <div style={{ backgroundColor: '#EEF2FF', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)', overflow: isMobile ? 'auto' : 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '9px' }}>
          <span style={{ fontSize: '16px' }}>📅</span>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#37352F' }}>일일 식단 트래커 — 4일간 미식 기록</p>
        </div>

        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '148px 1fr 1fr 1fr 96px' }}>
          {['날짜/일정', '🌅 아침', '☀️ 점심', '🌙 저녁', '식단 OK?'].map((h, i) => (
            <div key={i} style={{ padding: '10px 14px', fontSize: '10px', fontWeight: 800, color: '#787774', letterSpacing: '0.12em', textTransform: 'uppercase', borderRight: i < 4 ? '1px solid rgba(0,0,0,0.06)' : 'none', borderBottom: '1px solid rgba(0,0,0,0.06)', backgroundColor: 'rgba(0,0,0,0.02)' }}>{h}</div>
          ))}
        </div>

        {/* Table rows */}
        {TRAVEL_DATES.map((d, ri) => {
          const meal = gourmet.meals[d.key] ?? EMPTY_MEAL
          return (
            <div key={d.key} style={{ display: 'grid', gridTemplateColumns: '148px 1fr 1fr 1fr 96px', borderBottom: ri < 3 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
              <div style={{ padding: '12px 14px', borderRight: '1px solid rgba(0,0,0,0.06)' }}>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 800, color: '#37352F' }}>{d.label}</p>
                <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#787774' }}>{d.theme}</p>
              </div>
              {(['breakfast', 'lunch', 'dinner'] as const).map((field) => (
                <div key={field} style={{ padding: '10px 12px', borderRight: '1px solid rgba(0,0,0,0.06)' }}>
                  <input value={meal[field]} onChange={e => updateMeal(d.key, field, e.target.value)} placeholder="기록..." style={cellInput} />
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div onClick={() => updateMeal(d.key, 'dietOk', !meal.dietOk)} style={{ width: '30px', height: '30px', borderRadius: '8px', border: `2px solid ${meal.dietOk ? '#34d399' : '#D3D1CB'}`, backgroundColor: meal.dietOk ? 'rgba(52,211,153,0.15)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: meal.dietOk ? '0 0 12px rgba(52,211,153,0.35)' : 'none' }}>
                  {meal.dietOk && <span style={{ fontSize: '15px', color: '#34d399' }}>✓</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** 캘린더와 동기화된 여행 목록 (캘린더에서 수정한 일자가 반영됨) */
function getTripsWithCalendarDates(baseTrips: TravelTrip[]): TravelTrip[] {
  const cal = loadCalendar()
  const eventMap = new Map(cal.events.map(e => [e.id, e]))
  return baseTrips.map(t => {
    const ev = eventMap.get(t.id)
    if (ev) return { ...t, startDate: ev.startDate, endDate: ev.endDate }
    return t
  })
}

function AddTripModal({ onClose, onAdded }: { onClose: () => void; onAdded: (trip: TravelTrip) => void }) {
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = () => {
    const t = title.trim()
    if (!t) { setError('여행 이름을 입력해 주세요.'); return }
    if (!startDate) { setError('시작일을 선택해 주세요.'); return }
    if (!endDate) { setError('종료일을 선택해 주세요.'); return }
    if (endDate < startDate) { setError('종료일은 시작일 이후여야 합니다.'); return }
    setError(null)
    const id = `trip_${Date.now()}`
    const trip: TravelTrip = {
      id,
      title: t,
      startDate,
      endDate,
      color: TRIP_COLORS[Math.floor(Math.random() * TRIP_COLORS.length)],
      note: note.trim() || '',
    }
    const cal = loadCalendar()
    cal.events.push({ id, title: t, startDate, endDate, color: trip.color, note: trip.note })
    saveCalendar(cal)
    onAdded(trip)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '400px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 800, color: '#37352F' }}>새 여행 추가</h3>
        <input type="text" value={title} onChange={e => { setTitle(e.target.value); setError(null) }} placeholder="여행 이름 (예: 도쿄 여행)" style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#787774', marginBottom: '4px' }}>시작일</label>
            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setError(null) }} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '13px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#787774', marginBottom: '4px' }}>종료일</label>
            <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setError(null) }} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '13px', boxSizing: 'border-box' }} />
          </div>
        </div>
        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="메모 (선택)" style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box' }} />
        {error && <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#ef4444' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>취소</button>
          <button onClick={handleSubmit} style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: '#7C3AED', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>추가</button>
        </div>
      </div>
    </div>
  )
}

// ── ItineraryStepBox ────────────────────────────────────────────────────────
function ItineraryStepBox({
  step,
  index,
  onUpdate,
  onRemove,
  uploadImageToMedia,
}: {
  step: ItineraryStep
  index: number
  onUpdate: (patch: Partial<ItineraryStep>) => void
  onRemove?: () => void
  uploadImageToMedia: (file: File) => Promise<string>
}) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file?.type.startsWith('image/')) return
    setUploading(true)
    try {
      const url = await uploadImageToMedia(file)
      onUpdate({ imageUrl: url })
    } catch (err) { console.error('[이미지 업로드 실패]', err) }
    finally { setUploading(false); e.target.value = '' }
  }, [onUpdate, uploadImageToMedia])

  return (
    <div style={{
      flexShrink: 0,
      width: 140,
      borderRadius: '12px',
      border: '1px solid rgba(0,0,0,0.08)',
      background: '#fff',
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 120,
    }}>
      <div style={{ padding: '6px 8px', background: 'rgba(99,102,241,0.08)', fontSize: '11px', fontWeight: 800, color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>#{index + 1}</span>
        {onRemove && (
          <button onClick={e => { e.stopPropagation(); onRemove() }} title="삭제" style={{ width: 20, height: 20, borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Trash2 size={10} color="#ef4444" />
          </button>
        )}
      </div>
      <div
        onClick={() => fileRef.current?.click()}
        style={{
          flex: 1,
          minHeight: 64,
          background: step.imageUrl ? `url(${step.imageUrl}) center/cover` : 'rgba(0,0,0,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
        {!step.imageUrl && (uploading ? <span style={{ fontSize: '11px', color: '#94a3b8' }}>업로드 중…</span> : <Image size={22} color="#94a3b8" />)}
      </div>
      <input
        value={step.title ?? ''}
        onChange={e => onUpdate({ title: e.target.value })}
        placeholder="장소명"
        style={{ padding: '8px 10px', border: 'none', borderTop: '1px solid rgba(0,0,0,0.06)', fontSize: '13px', fontWeight: 600, outline: 'none' }}
      />
      <input
        value={step.note ?? ''}
        onChange={e => onUpdate({ note: e.target.value })}
        placeholder="메모"
        style={{ padding: '4px 10px 10px', border: 'none', fontSize: '12px', color: '#787774', outline: 'none' }}
      />
    </div>
  )
}

// ── ItineraryStepsCarousel (가로 스크롤 + 화살표) ─────────────────────────────
function ItineraryStepsCarousel({
  steps,
  onUpdate,
  onRemove,
  uploadImageToMedia,
  isMobile,
}: {
  steps: ItineraryStep[]
  onUpdate: (stepId: string, patch: Partial<ItineraryStep>) => void
  onRemove: (stepId: string) => void
  uploadImageToMedia: (file: File) => Promise<string>
  isMobile: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => {
    if (!scrollRef.current) return
    scrollRef.current.scrollBy({ left: dir * 320, behavior: 'smooth' })
  }
  const showArrows = steps.length > (isMobile ? 3 : 6)
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
      {showArrows && (
        <button onClick={() => scroll(-1)} style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} title="왼쪽으로">
          <ChevronLeft size={22} color="#6366f1" />
        </button>
      )}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          display: 'flex',
          gap: '12px',
          padding: '8px 0',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'thin',
        }}
      >
        {steps.map((step, idx) => (
          <div key={step.id} style={{ scrollSnapAlign: 'start' }}>
            <ItineraryStepBox step={step} index={idx} onUpdate={p => onUpdate(step.id, p)} onRemove={steps.length > 1 ? () => onRemove(step.id) : undefined} uploadImageToMedia={uploadImageToMedia} />
          </div>
        ))}
      </div>
      {showArrows && (
        <button onClick={() => scroll(1)} style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} title="오른쪽으로">
          <ChevronRight size={22} color="#6366f1" />
        </button>
      )}
    </div>
  )
}

// ── TripPhotosSection ───────────────────────────────────────────────────────
function TripPhotosSection({
  detail,
  onAdd,
  onUpdate,
  onRemove,
  inputBase,
}: {
  detail: TripDetailData
  onAdd: (url: string, caption?: string) => void
  onUpdate: (id: string, patch: Partial<PhotoItem>) => void
  onRemove: (id: string) => void
  inputBase: React.CSSProperties
}) {
  const [urlInput, setUrlInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoItem | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!lightboxPhoto) return
    const photos = detail.photos
    const idx = photos.findIndex(p => p.id === lightboxPhoto.id)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxPhoto(null)
      else if (e.key === 'ArrowLeft' && idx > 0) setLightboxPhoto(photos[idx - 1])
      else if (e.key === 'ArrowRight' && idx < photos.length - 1) setLightboxPhoto(photos[idx + 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxPhoto, detail.photos])

  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return
    const url = await uploadImageToMedia(file)
    onAdd(url)
  }, [onAdd])

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await uploadFile(file)
    } catch (err) {
      console.error('[사진 업로드 실패]', err)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }, [uploadFile])

  const [isDragging, setIsDragging] = useState(false)
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer?.types?.includes('Files')) setIsDragging(true)
  }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const related = e.relatedTarget as Node | null
    if (!related || !e.currentTarget.contains(related)) setIsDragging(false)
  }, [])
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'))
    if (files.length === 0) return
    setUploading(true)
    try {
      for (const file of files) {
        await uploadFile(file)
      }
    } catch (err) {
      console.error('[사진 업로드 실패]', err)
    } finally {
      setUploading(false)
    }
  }, [uploadFile])

  const handleAddByUrl = () => {
    const url = urlInput.trim()
    if (!url) return
    onAdd(url)
    setUrlInput('')
  }

  return (
    <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg,#f97316,#ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(249,115,22,0.35)' }}>
            <Image size={18} color="#fff" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#f97316', letterSpacing: '0.2em', textTransform: 'uppercase' }}>사진</p>
            <p style={{ margin: 0, fontSize: '19px', fontWeight: 900, color: '#37352F' }}>여행 사진</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <input type="file" ref={fileInputRef} accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(249,115,22,0.3)', backgroundColor: 'rgba(249,115,22,0.08)', color: '#ea580c', fontSize: '11px', fontWeight: 700, cursor: uploading ? 'wait' : 'pointer' }}>
            {uploading ? '업로드 중…' : '📤 사진 업로드'}
          </button>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddByUrl()} placeholder="이미지 URL 붙여넣기" style={{ ...inputBase, width: '200px', padding: '8px 12px' }} />
            <button onClick={handleAddByUrl} style={{ padding: '8px 14px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>추가</button>
          </div>
        </div>
      </div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          minHeight: '120px',
          borderRadius: '16px',
          border: isDragging ? '2px dashed rgba(249,115,22,0.6)' : '1px dashed rgba(249,115,22,0.2)',
          backgroundColor: isDragging ? 'rgba(249,115,22,0.08)' : 'rgba(249,115,22,0.03)',
          transition: 'all 0.2s',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px', padding: detail.photos.length > 0 ? '24px' : '0' }}>
          {detail.photos.map((photo) => (
            <div key={photo.id} style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
              <div
                style={{ aspectRatio: '4/3', overflow: 'hidden', backgroundColor: '#e5e5e0', cursor: 'pointer' }}
                onClick={() => setLightboxPhoto(photo)}
              >
                <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }} />
              </div>
              <input value={photo.caption ?? ''} onChange={e => onUpdate(photo.id, { caption: e.target.value })} placeholder="설명" style={{ ...inputBase, width: '100%', border: 'none', borderRadius: 0, borderTop: '1px solid rgba(0,0,0,0.06)', padding: '10px 12px', fontSize: '12px' }} />
              <button onClick={e => { e.stopPropagation(); onRemove(photo.id) }} style={{ position: 'absolute', top: '10px', right: '10px', width: 30, height: 30, borderRadius: '8px', border: 'none', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.7)' }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.5)' }} title="삭제">
                <Trash2 size={14} color="#fff" />
              </button>
            </div>
          ))}
        </div>
        {detail.photos.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: 'inherit', fontSize: '13px' }}>
            {isDragging ? (
              <span style={{ color: '#ea580c', fontWeight: 600 }}>여기에 놓기</span>
            ) : (
              <span style={{ color: '#787774' }}>사진이 없습니다. 업로드하거나 URL을 붙여넣어 여행 사진을 추가하세요.<br style={{ marginTop: '4px' }} /><span style={{ fontSize: '11px', color: '#9B9A97' }}>또는 파일을 드래그하여 여기에 놓으세요</span></span>
            )}
          </div>
        )}
      </div>

      {/* 사진 확대 뷰 (노트 모달처럼) */}
      {lightboxPhoto && (() => {
        const photos = detail.photos
        const idx = photos.findIndex(p => p.id === lightboxPhoto.id)
        const prevPhoto = idx > 0 ? photos[idx - 1] : null
        const nextPhoto = idx >= 0 && idx < photos.length - 1 ? photos[idx + 1] : null
        return (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: '20px',
            }}
            onClick={() => setLightboxPhoto(null)}
          >
            {/* 사진 + 좌우 화살표 (사진 중심에 붙어서) */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: 'calc(100vw - 80px)' }} onClick={e => e.stopPropagation()}>
              {/* 이전 사진 - 사진 왼쪽에 붙음 */}
              {prevPhoto && (
                <button
                  onClick={e => { e.stopPropagation(); setLightboxPhoto(prevPhoto) }}
                  style={{
                    position: 'absolute', left: '-46px', top: '50%', transform: 'translateY(-50%)',
                    width: 34, height: 34, borderRadius: '50%', border: 'none',
                    backgroundColor: 'rgba(255,255,255,0.9)', color: '#37352F', boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2,
                  }}
                  onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.transform = 'translateY(-50%) scale(1.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.9)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1)' }}
                >
                  <ChevronLeft size={20} />
                </button>
              )}

              {/* 사진 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                <img
                  src={lightboxPhoto.url}
                  alt=""
                  style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 140px)', objectFit: 'contain', borderRadius: '8px', display: 'block' }}
                />
                {lightboxPhoto.caption && (
                  <p style={{ margin: '16px 0 0', fontSize: '14px', color: '#37352F', maxWidth: '600px', textAlign: 'center' }}>
                    {lightboxPhoto.caption}
                  </p>
                )}
              </div>

              {/* 다음 사진 - 사진 오른쪽에 붙음 */}
              {nextPhoto && (
                <button
                  onClick={e => { e.stopPropagation(); setLightboxPhoto(nextPhoto) }}
                  style={{
                    position: 'absolute', right: '-46px', top: '50%', transform: 'translateY(-50%)',
                    width: 34, height: 34, borderRadius: '50%', border: 'none',
                    backgroundColor: 'rgba(255,255,255,0.9)', color: '#37352F', boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2,
                  }}
                  onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.transform = 'translateY(-50%) scale(1.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.9)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1)' }}
                >
                  <ChevronRight size={20} />
                </button>
              )}

              {/* 닫기 버튼 - 사진 오른쪽, 약간 아래 */}
              <button
                onClick={e => { e.stopPropagation(); setLightboxPhoto(null) }}
                style={{
                  position: 'absolute', top: '12px', right: '-23px',
                  width: 22, height: 22, borderRadius: '50%', border: 'none',
                  backgroundColor: 'rgba(255,255,255,0.9)', color: '#37352F', boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', zIndex: 3,
                }}
                onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.backgroundColor = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.9)' }}
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ── TravelPage ────────────────────────────────────────────────────────────────
function TravelPage() {
  const isMobile = useIsMobile()
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null)
  const [activeSpot, setActiveSpot] = useState<string | null>(null)
  const [tripsBase,  setTripsBase]  = useState<TravelTrip[]>(() => loadTravelTrips())
  const [addTripOpen, setAddTripOpen] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [coverUploading, setCoverUploading] = useState(false)
  const [coverPositionMode, setCoverPositionMode] = useState(false)
  const [coverPositionDrag, setCoverPositionDrag] = useState({ x: 50, y: 50 })
  const [coverPositionDragging, setCoverPositionDragging] = useState(false)
  const coverPositionDragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)

  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>(getDefaultExpenseCategories())
  const [retrospectiveTemplates, setRetrospectiveTemplates] = useState<RetrospectiveTemplates>(getDefaultRetrospectiveTemplates())
  const [travelSettingsOpen, setTravelSettingsOpen] = useState(false)

  useEffect(() => {
    loadExpenseCategories().then(setExpenseCategories)
    loadRetrospectiveTemplates().then(setRetrospectiveTemplates)
  }, [])

  const trips = getTripsWithCalendarDates(tripsBase)
  const currentTrip = trips.find(t => t.id === selectedTrip)

  // 여행별 상세 데이터 (선택된 여행에 따라 로드)
  const [detail, setDetail] = useState<TripDetailData>(() =>
    selectedTrip ? loadTripDetail(selectedTrip, currentTrip ?? undefined) : getDefaultTripDetail('', undefined)
  )

  useEffect(() => {
    if (selectedTrip && currentTrip) {
      setDetail(loadTripDetail(selectedTrip, currentTrip))
    }
  }, [selectedTrip, currentTrip?.id])

  function handleAddTrip(trip: TravelTrip) {
    setTripsBase(prev => {
      const next = [...prev, trip]
      saveTravelTrips(next)
      return next
    })
  }

  function persist(next: TripDetailData) {
    if (selectedTrip) {
      setDetail(next)
      saveTripDetail(selectedTrip, next)
    }
  }

  function updateItineraryStep(stepId: string, patch: Partial<ItineraryStep>) {
    persist({
      ...detail,
      itinerarySteps: (detail.itinerarySteps ?? DEFAULT_ITINERARY_STEPS).map(s => s.id === stepId ? { ...s, ...patch } : s),
    })
  }
  function addItineraryStep() {
    const steps = detail.itinerarySteps ?? DEFAULT_ITINERARY_STEPS
    persist({
      ...detail,
      itinerarySteps: [...steps, { id: `step_${Date.now()}`, title: '', imageUrl: '', note: '' }],
    })
  }
  function removeItineraryStep(stepId: string) {
    persist({
      ...detail,
      itinerarySteps: (detail.itinerarySteps ?? DEFAULT_ITINERARY_STEPS).filter(s => s.id !== stepId),
    })
  }

  const expenses = detail.expenses ?? []
  const addExpense = (e: TravelExpense) => persist({ ...detail, expenses: [...expenses, e] })
  const updateExpense = (id: string, patch: Partial<TravelExpense>) =>
    persist({ ...detail, expenses: expenses.map(x => x.id === id ? { ...x, ...patch } : x) })
  const removeExpense = (id: string) => persist({ ...detail, expenses: expenses.filter(x => x.id !== id) })

  const review = detail.review ?? null
  const saveReview = (r: TravelReview) => persist({ ...detail, review: r })

  const allItems     = detail.packing.flatMap(c => c.items)
  const checkedCount = allItems.filter(i => i.checked).length
  const totalCount   = allItems.length
  const pct          = totalCount > 0 ? Math.round(checkedCount / totalCount * 100) : 0

  const ddayResult = currentTrip ? calcDDay(currentTrip.startDate) : { text: '-', isPast: false }

  const CAT_COLOR: Record<string, string> = { essential: '#6366f1', creative: '#f472b6', daily: '#34d399' }
  const PACK_COLORS = ['#6366f1', '#f472b6', '#34d399', '#f97316', '#8b5cf6']

  function toggleItem(catId: string, itemId: string) {
    persist({
      ...detail,
      packing: detail.packing.map(cat => cat.id !== catId ? cat : {
        ...cat,
        items: cat.items.map(item => item.id === itemId ? { ...item, checked: !item.checked } : item),
      }),
    })
  }

  function updateMemo(spotId: string, text: string) {
    persist({ ...detail, spotMemos: { ...detail.spotMemos, [spotId]: text } })
  }

  function addSpot() {
    const id = `spot_${Date.now()}`
    persist({
      ...detail,
      spots: [...detail.spots, { id, name: '새 스팟', emoji: '📍', tag: '', desc: '' }],
    })
    setActiveSpot(id)
  }
  function updateSpot(id: string, patch: Partial<TravelSpot>) {
    persist({
      ...detail,
      spots: detail.spots.map(s => s.id === id ? { ...s, ...patch } : s),
    })
  }
  function removeSpot(id: string) {
    const spotMemos = { ...detail.spotMemos }; delete spotMemos[id]
    persist({ ...detail, spots: detail.spots.filter(s => s.id !== id), spotMemos })
    if (activeSpot === id) setActiveSpot(null)
  }

  function addScheduleItem() {
    const date = currentTrip?.startDate ?? new Date().toISOString().slice(0, 10)
    persist({
      ...detail,
      schedule: [...detail.schedule, { id: `sch_${Date.now()}`, date, title: '', note: '', time: '' }],
    })
  }
  function updateScheduleItem(id: string, patch: Partial<ScheduleItem>) {
    persist({
      ...detail,
      schedule: detail.schedule.map(s => s.id === id ? { ...s, ...patch } : s),
    })
  }
  function removeScheduleItem(id: string) {
    persist({ ...detail, schedule: detail.schedule.filter(s => s.id !== id) })
  }

  function addPhoto(url: string, caption?: string) {
    persist({
      ...detail,
      photos: [...detail.photos, { id: `photo_${Date.now()}`, url, caption: caption ?? '' }],
    })
  }
  function updatePhoto(id: string, patch: Partial<PhotoItem>) {
    persist({
      ...detail,
      photos: detail.photos.map(p => p.id === id ? { ...p, ...patch } : p),
    })
  }
  function removePhoto(id: string) {
    persist({ ...detail, photos: detail.photos.filter(p => p.id !== id) })
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file?.type.startsWith('image/')) return
    setCoverUploading(true)
    try {
      const url = await uploadImageToMedia(file)
      persist({ ...detail, coverImageUrl: url })
    } catch (err) { console.error('[커버 업로드 실패]', err) }
    finally { setCoverUploading(false); e.target.value = '' }
  }

  // ── Packing (카테고리/항목 추가·수정·삭제) ──
  function addPackingCategory() {
    const id = `pack_cat_${Date.now()}`
    persist({
      ...detail,
      packing: [...detail.packing, { id, label: '새 카테고리', emoji: '📦', items: [] }],
    })
  }
  function updatePackingCategory(catId: string, patch: Partial<PackCategory>) {
    persist({
      ...detail,
      packing: detail.packing.map(c => c.id === catId ? { ...c, ...patch } : c),
    })
  }
  function removePackingCategory(catId: string) {
    persist({ ...detail, packing: detail.packing.filter(c => c.id !== catId) })
  }
  function addPackingItem(catId: string) {
    const id = `pack_item_${Date.now()}`
    persist({
      ...detail,
      packing: detail.packing.map(c => c.id !== catId ? c : { ...c, items: [...c.items, { id, label: '새 항목', checked: false }] }),
    })
  }
  function updatePackingItem(catId: string, itemId: string, patch: Partial<PackItem>) {
    persist({
      ...detail,
      packing: detail.packing.map(c => c.id !== catId ? c : {
        ...c,
        items: c.items.map(i => i.id !== itemId ? i : { ...i, ...patch }),
      }),
    })
  }
  function removePackingItem(catId: string, itemId: string) {
    persist({
      ...detail,
      packing: detail.packing.map(c => c.id !== catId ? c : { ...c, items: c.items.filter(i => i.id !== itemId) }),
    })
  }

  // ── Tips (꿀팁 추가·수정·삭제) ──
  const tips = detail.tips ?? []
  function addTip() {
    persist({ ...detail, tips: [...tips, { icon: '💡', text: '' }] })
  }
  function updateTip(index: number, patch: { icon?: string; text?: string }) {
    const next = [...tips]
    next[index] = { ...next[index], ...patch }
    persist({ ...detail, tips: next })
  }
  function removeTip(index: number) {
    persist({ ...detail, tips: tips.filter((_, i) => i !== index) })
  }


  const inputBase: React.CSSProperties = {
    width: '100%', backgroundColor: '#F4F4F2', border: '1px solid rgba(0,0,0,0.06)',
    borderRadius: '12px', padding: '12px 14px', color: '#37352F', fontSize: '12px',
    outline: 'none', resize: 'none', boxSizing: 'border-box', lineHeight: '1.7', fontFamily: 'inherit',
  }

  // ── 목록 뷰 (List View) - image_0 스타일 + 국기/D-Day ──
  if (!selectedTrip) {
    return (
      <>
      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '14px 12px' : '36px 48px' }}>
        <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#f97316', letterSpacing: '0.2em', textTransform: 'uppercase' }}>✈️ Travel Center</span>
            <h1 style={{ margin: '8px 0 0', fontSize: '28px', fontWeight: 900, color: '#37352F' }}>여행 프로젝트</h1>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#787774' }}>여행지를 선택하거나 새 여행을 추가하세요</p>
          </div>
          {trips.length > 0 && (
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#9B9A97', letterSpacing: '0.05em' }}>
              {trips[0].startDate.split('-')[0]}년
            </span>
          )}
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '20px',
        }}>
          {trips.map(trip => {
            const dday = calcDDay(trip.startDate)
            return (
              <button
                key={trip.id}
                onClick={() => setSelectedTrip(trip.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '24px 22px',
                  borderRadius: '16px',
                  border: '1px solid rgba(0,0,0,0.06)',
                  backgroundColor: '#FFFFFF',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.12)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'
                }}
              >
                {/* 카드 우측 상단: 년도 */}
                <span style={{ position: 'absolute', top: '16px', right: '18px', fontSize: '13px', fontWeight: 800, color: '#37352F', letterSpacing: '0.03em' }}>
                  {trip.startDate.split('-')[0]}년
                </span>
                {/* 비행기 아이콘 (좌상단) */}
                <span style={{ fontSize: '28px', lineHeight: 1 }}>✈️</span>
                {/* 녹색 일본 지도 + 제목 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px', lineHeight: 1, filter: 'hue-rotate(100deg) saturate(1.3)', display: 'inline-block' }} title="일본">🗾</span>
                  <p style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#37352F' }}>{trip.title}</p>
                </div>
                {/* 국기 + 날짜 + D-Day (한 줄) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '6px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
                    <span style={{ width: 18, height: 14, borderRadius: 2, overflow: 'hidden', display: 'inline-block', flexShrink: 0 }}>
                      <svg width="18" height="14" viewBox="0 0 20 15" xmlns="http://www.w3.org/2000/svg">
                        <rect width="20" height="15" fill="#fff"/>
                        <circle cx="10" cy="7.5" r="3.3" fill="#bc002d"/>
                      </svg>
                    </span>
                    <span style={{ fontSize: '11px', color: '#787774', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fmtTripDateRange(trip.startDate, trip.endDate)}</span>
                  </div>
                  <span style={{ fontSize: '16px', color: dday.isPast ? '#94a3b8' : '#475569', fontWeight: 600, flexShrink: 0, letterSpacing: '-0.02em' }}>{dday.text}</span>
                </div>
                {trip.note && <p style={{ margin: 0, fontSize: '11px', color: '#9B9A97', lineHeight: 1.5 }}>{trip.note}</p>}
              </button>
            )
          })}
          <button
            onClick={() => setAddTripOpen(true)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '24px 22px',
              borderRadius: '16px',
              border: '2px dashed rgba(0,0,0,0.12)',
              backgroundColor: 'rgba(0,0,0,0.02)',
              cursor: 'pointer',
              transition: 'transform 0.2s, border-color 0.2s, background 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'
              e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.06)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)'
              e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)'
            }}
          >
            <span style={{ fontSize: '32px', color: '#9B9A97' }}>+</span>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#787774' }}>새로운 여행 추가</p>
          </button>
        </div>
      </div>
      {addTripOpen && <AddTripModal onClose={() => setAddTripOpen(false)} onAdded={handleAddTrip} />}
      </>
    )
  }

  // ── 상세 뷰 (Detail View) ──
  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '14px 12px' : '36px 48px' }}>

      {/* <- 목록으로 돌아가기 */}
      <button
        onClick={() => setSelectedTrip(null)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '20px',
          padding: '8px 14px',
          borderRadius: '10px',
          border: '1px solid rgba(0,0,0,0.08)',
          backgroundColor: 'transparent',
          color: '#6366f1',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.08)'
          e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'
        }}
      >
        <span style={{ fontSize: '16px' }}>←</span>
        목록으로 돌아가기
      </button>

      {/* ── Travel Hero Header (3단 Grid + Glassmorphism + 드래그 위치 조정) ── */}
      {(() => {
        const parsePos = (s: string | undefined) => {
          if (!s) return { x: 50, y: 50 }
          const m = s.match(/(\d+)\s*%\s*(\d+)\s*%/)
          if (m) return { x: Math.min(100, Math.max(0, +m[1])), y: Math.min(100, Math.max(0, +m[2])) }
          return { x: 50, y: 50 }
        }
        const pos = coverPositionMode ? coverPositionDrag : parsePos(detail.coverImagePosition)
        const posStr = `${pos.x}% ${pos.y}%`
        const handleCoverMouseDown = (e: React.MouseEvent) => {
          if (!coverPositionMode || !detail.coverImageUrl) return
          coverPositionDragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
          setCoverPositionDragging(true)
        }
        const handleCoverMouseMove = (e: React.MouseEvent) => {
          const ref = coverPositionDragStart.current
          if (!ref) return
          const el = e.currentTarget as HTMLElement
          const rect = el.getBoundingClientRect()
          const dx = ((e.clientX - ref.mx) / rect.width) * 100
          const dy = ((e.clientY - ref.my) / rect.height) * 100
          setCoverPositionDrag({
            x: Math.min(100, Math.max(0, ref.px - dx)),
            y: Math.min(100, Math.max(0, ref.py - dy)),
          })
        }
        const handleCoverMouseUp = () => { coverPositionDragStart.current = null; setCoverPositionDragging(false) }
        const handleCoverMouseLeave = () => { coverPositionDragStart.current = null; setCoverPositionDragging(false) }
        const saveCoverPosition = () => {
          persist({ ...detail, coverImagePosition: posStr })
          setCoverPositionMode(false)
        }
        const ACCENT = '#9b8ff0'
        const iconBtn = (onClick: () => void, children: React.ReactNode, title: string, disabled?: boolean) => (
          <button onClick={onClick} disabled={disabled} title={title} style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'wait' : 'pointer', opacity: disabled ? 0.6 : 1, fontSize: 11 }} onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}>
            {children}
          </button>
        )
        return (
      <div
        style={{
          position: 'relative',
          borderRadius: 16,
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #0f1229 0%, #141736 60%, #1a1e3d 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: isMobile ? '28px 32px' : '40px 48px',
          marginBottom: '24px',
          minHeight: 200,
          cursor: coverPositionMode && detail.coverImageUrl ? (coverPositionDragging ? 'grabbing' : 'grab') : undefined,
        }}
        onMouseDown={handleCoverMouseDown}
        onMouseMove={handleCoverMouseMove}
        onMouseUp={handleCoverMouseUp}
        onMouseLeave={handleCoverMouseLeave}
      >
        <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverUpload} style={{ display: 'none' }} />

        {coverPositionMode && detail.coverImageUrl && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, padding: '12px 16px', background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#fff' }}>이미지를 드래그하여 위치를 조정하세요</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveCoverPosition} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: ACCENT, color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>저장</button>
              <button onClick={() => { setCoverPositionMode(false); setCoverPositionDrag(parsePos(detail.coverImagePosition)) }} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.4)', background: 'transparent', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>취소</button>
            </div>
          </div>
        )}

        {/* 3-column Grid: 좌(캘린더) | 중(타이틀⬅️➡️메모) | 우(연도/아이콘/D-day) */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr auto', gap: 32, alignItems: 'stretch', minHeight: 160 }}>
          {/* 좌측: 캘린더 (Glassmorphism) */}
          {currentTrip && (() => {
            const [sy, sm, sd] = currentTrip.startDate.split('-').map(Number)
            const [ey, em, ed] = currentTrip.endDate.split('-').map(Number)
            const start = new Date(sy, sm - 1, sd)
            const end = new Date(ey, em - 1, ed)
            const sameMonth = sy === ey && sm === em
            const calW = isMobile ? 120 : 130
            if (!sameMonth) {
              return (
                <div style={{ width: calW, padding: '12px 10px', borderRadius: 14, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>📅</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{sm}/{sd}~{em}/{ed}</span>
                </div>
              )
            }
            const month = start.getMonth()
            const year = start.getFullYear()
            const firstDay = new Date(year, month, 1).getDay()
            const daysInMonth = new Date(year, month + 1, 0).getDate()
            const isInRange = (d: number) => {
              const dte = new Date(year, month, d)
              return dte >= start && dte <= end
            }
            return (
              <div style={{ width: calW, padding: '12px 10px', borderRadius: 14, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{year}.{String(month + 1).padStart(2,'0')}</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, width: '100%', justifyItems: 'center' }}>
                  {['일','월','화','수','목','금','토'].map(d => <span key={d} style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontWeight: 600 }}>{d}</span>)}
                  {Array.from({ length: firstDay }, (_, i) => <span key={`e${i}`} />)}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const d = i + 1
                    const active = isInRange(d)
                    return (
                      <span key={d} style={{
                        fontSize: 10, fontWeight: active ? 700 : 500, color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                        background: active ? ACCENT : 'transparent', borderRadius: 4, textAlign: 'center', padding: '2px 0', minWidth: 16, boxSizing: 'border-box',
                      }}>{d}</span>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* 중앙: 타이틀(좌) ⬅️ ➡️ 메모장(우, flex-1) — 가로 한 줄, 절대 밑으로 안 떨어짐 */}
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 28, minWidth: 0, flex: 1, flexWrap: 'nowrap' }}>
            <div style={{ flexShrink: 0, minWidth: 0, paddingTop: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span onClick={() => { const v = window.prompt('아이콘: 이모지 또는 URL', detail.heroIcon ?? '✈️'); if (v !== null) persist({ ...detail, heroIcon: v.trim() || '✈️' }) }} style={{ fontSize: 24, lineHeight: 1, cursor: 'pointer', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}>
                  {detail.heroIcon?.startsWith('http') || detail.heroIcon?.startsWith('data:') ? (
                    <img src={detail.heroIcon} alt="" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 6 }} />
                  ) : (
                    detail.heroIcon || '✈️'
                  )}
                </span>
                <h1 style={{ margin: 0, fontSize: isMobile ? 28 : 36, fontWeight: 800, color: '#fff', lineHeight: 1.2, letterSpacing: '-0.02em', textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
                  {currentTrip?.title ?? '여행'}
                </h1>
              </div>
              {currentTrip?.note && <p style={{ margin: '8px 0 0', fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>{currentTrip.note}</p>}
              {currentTrip && (
                <p style={{ margin: '6px 0 0', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, textShadow: '0 1px 3px rgba(0,0,0,0.25)' }}>
                  {fmtTripDateShort(currentTrip.startDate, currentTrip.endDate)}
                  <span style={{ marginLeft: 8 }}>· {calcTripNights(currentTrip.startDate, currentTrip.endDate)}</span>
                </p>
              )}
            </div>
            <textarea
              data-travel-memo
              value={detail.heroMemo ?? ''}
              onChange={e => persist({ ...detail, heroMemo: e.target.value })}
              placeholder="여행에 대한 메모를 자유롭게 적어보세요"
              rows={2}
              style={{
                flex: 1, minWidth: 180, maxWidth: '100%', minHeight: 72, padding: '12px 16px', borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)',
                fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(140,120,240,0.5)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
            />
          </div>

          {/* 우측: 2026년(타이틀보다 작게) + 아이콘(소) + D-day(하단 정렬) */}
          {currentTrip && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', minWidth: 90 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1, letterSpacing: '-0.02em', textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
                  {currentTrip.startDate.split('-')[0]}년
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {iconBtn(() => coverInputRef.current?.click(), coverUploading ? '…' : <Image size={12} />, '커버 이미지', coverUploading)}
                  {detail.coverImageUrl && (
                    <>
                      {iconBtn(() => { setCoverPositionMode(true); setCoverPositionDrag(parsePos(detail.coverImagePosition)) }, <Move size={12} />, '위치 이동')}
                      {iconBtn(() => persist({ ...detail, coverImageUrl: '' }), <Trash2 size={12} />, '커버 제거')}
                    </>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 22, fontWeight: 700, color: ACCENT, marginTop: 'auto', textShadow: '0 1px 8px rgba(0,0,0,0.3)' }}>
                {ddayResult.text}
              </span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>▪ 여행 준비 완료율</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{pct}% ({checkedCount}/{totalCount}){pct === 100 && ' 🎉'}</span>
          </div>
          <div style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: 'rgba(140,120,240,0.8)', transition: 'width 0.3s ease' }} />
          </div>
        </div>
      </div>
        )})()}

      {/* ── 여행 단계별 방문 장소 (10개 이상 가능, 가로 스크롤) ── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: 8 }}>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#37352F', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📍</span> 여행 단계별 방문 장소
          </p>
          <button onClick={addItineraryStep} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.28)', backgroundColor: 'rgba(99,102,241,0.08)', color: '#4F46E5', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={10} />단계 추가
          </button>
        </div>
        <ItineraryStepsCarousel
          steps={detail.itinerarySteps ?? DEFAULT_ITINERARY_STEPS}
          onUpdate={updateItineraryStep}
          onRemove={removeItineraryStep}
          uploadImageToMedia={uploadImageToMedia}
          isMobile={isMobile}
        />
      </div>

      {/* ── 원페이지 대시보드: 일정/체크리스트 | 가계부 | 회고록 통합 ── */}
      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      {/* ── Two column layout: 체크리스트 + 스팟 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', alignItems: 'start' }}>

        {/* ── Left: Packing Checklist ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🧳</span>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#37352F' }}>스마트 체크리스트</p>
            </div>
            <button onClick={addPackingCategory} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.28)', backgroundColor: 'rgba(99,102,241,0.08)', color: '#4F46E5', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={10} />카테고리 추가
            </button>
          </div>

          {detail.packing.map(cat => {
            const catChecked = cat.items.filter(i => i.checked).length
            const ac = (CAT_COLOR[cat.id] ?? PACK_COLORS[detail.packing.indexOf(cat) % PACK_COLORS.length])
            return (
              <div key={cat.id} style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.06)', marginBottom: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                    <input value={cat.emoji} onChange={e => updatePackingCategory(cat.id, { emoji: e.target.value || '📦' })} style={{ width: 36, textAlign: 'center', padding: '4px 2px', fontSize: '16px', border: 'none', backgroundColor: 'transparent', outline: 'none', fontFamily: 'inherit' }} maxLength={2} title="이모지" />
                    <input value={cat.label} onChange={e => updatePackingCategory(cat.id, { label: e.target.value })} style={{ border: 'none', padding: 0, backgroundColor: 'transparent', fontSize: '13px', fontWeight: 800, color: '#37352F', flex: 1, minWidth: 80, outline: 'none', fontFamily: 'inherit' }} placeholder="카테고리 이름" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: catChecked === cat.items.length ? '#34d399' : ac, backgroundColor: `${ac}15`, padding: '3px 11px', borderRadius: '999px', border: `1px solid ${ac}30` }}>
                      {catChecked}/{cat.items.length} {catChecked === cat.items.length ? '✓' : ''}
                    </span>
                    <button onClick={() => removePackingCategory(cat.id)} style={{ width: 24, height: 24, borderRadius: 6, border: 'none', backgroundColor: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="카테고리 삭제">
                      <Trash2 size={12} color="#ef4444" />
                    </button>
                  </div>
                </div>
                <div style={{ padding: '12px 16px' }}>
                  {cat.items.map((item, idx) => (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0',
                      borderBottom: idx < cat.items.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                      transition: 'background 0.12s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '' }}
                    >
                      <div onClick={() => toggleItem(cat.id, item.id)} style={{ width: '18px', height: '18px', borderRadius: '5px', border: `2px solid ${item.checked ? ac : '#D3D1CB'}`, backgroundColor: item.checked ? ac : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s', boxShadow: item.checked ? `0 0 8px ${ac}50` : 'none' }}>
                        {item.checked && <span style={{ fontSize: '10px', color: '#fff', lineHeight: 1 }}>✓</span>}
                      </div>
                      <input value={item.label} onChange={e => updatePackingItem(cat.id, item.id, { label: e.target.value })} onClick={e => e.stopPropagation()} style={{
                        flex: 1, minWidth: 0, border: 'none', padding: '4px 0', backgroundColor: 'transparent',
                        fontSize: '13px', color: item.checked ? '#9B9A97' : '#37352F', textDecoration: item.checked ? 'line-through' : 'none',
                        outline: 'none', fontFamily: 'inherit',
                      }} placeholder="항목" />
                      <button onClick={() => removePackingItem(cat.id, item.id)} style={{ width: 22, height: 22, borderRadius: 6, border: 'none', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, opacity: 0.5 }} onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)' }} onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.backgroundColor = 'transparent' }} title="삭제">
                        <Trash2 size={11} color="#ef4444" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addPackingItem(cat.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', padding: '10px', marginTop: '4px', borderRadius: '8px', border: '1px dashed rgba(0,0,0,0.12)', backgroundColor: 'transparent', color: '#9B9A97', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; e.currentTarget.style.color = '#6366f1' }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)'; e.currentTarget.style.color = '#9B9A97' }}>
                    <Plus size={12} />항목 추가
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Right: Inspiration Spots ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>📍</span>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#37352F' }}>주요 스팟 가이드</p>
            </div>
            <button onClick={addSpot} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.28)', backgroundColor: 'rgba(99,102,241,0.08)', color: '#4F46E5', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={10} />스팟 추가
            </button>
          </div>
          {detail.spots.map(spot => {
            const isActive = activeSpot === spot.id
            const spotBorder = isActive ? 'rgba(99,102,241,0.38)' : 'rgba(0,0,0,0.06)'
            const spotShadow = isActive ? '0 4px 20px rgba(99,102,241,0.12)' : '0 2px 8px rgba(0,0,0,0.03)'
            return (
              <div key={spot.id} style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: `1px solid ${spotBorder}`, marginBottom: '14px', overflow: 'hidden', transition: 'border-color 0.2s', boxShadow: spotShadow }}>
                <div onClick={() => setActiveSpot(isActive ? null : spot.id)}
                  style={{ padding: '18px 20px', cursor: 'pointer', transition: 'background 0.12s' }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.04)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = '' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '32px', lineHeight: 1, flexShrink: 0 }}>{spot.emoji}</span>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: '0 0 5px', fontSize: '14px', fontWeight: 800, color: '#37352F' }}>{spot.name}</p>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#7C3AED', backgroundColor: 'rgba(167,139,250,0.1)', padding: '3px 9px', borderRadius: '999px', border: '1px solid rgba(167,139,250,0.22)' }}>{spot.tag}</span>
                        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#787774', lineHeight: 1.65 }}>{spot.desc}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <button onClick={e => { e.stopPropagation(); removeSpot(spot.id) }} style={{ width: 24, height: 24, borderRadius: 6, border: 'none', backgroundColor: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="삭제">
                        <Trash2 size={12} color="#ef4444" />
                      </button>
                      <span style={{ color: isActive ? '#6366f1' : '#D3D1CB', fontSize: '11px', display: 'inline-block', transform: isActive ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s, color 0.2s' }}>▼</span>
                    </div>
                  </div>
                </div>

                {isActive && (
                  <>
                  <div style={{ borderTop: '1px solid rgba(99,102,241,0.14)', padding: '14px 18px', backgroundColor: 'rgba(99,102,241,0.04)' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>✏️ 스팟 정보 편집</p>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input value={spot.emoji} onChange={e => updateSpot(spot.id, { emoji: e.target.value || '📍' })} placeholder="이모지" style={{ ...inputBase, width: '50px', textAlign: 'center' }} maxLength={2} />
                      <input value={spot.name} onChange={e => updateSpot(spot.id, { name: e.target.value })} placeholder="스팟 이름" style={{ ...inputBase, flex: 1 }} />
                    </div>
                    <input value={spot.tag} onChange={e => updateSpot(spot.id, { tag: e.target.value })} placeholder="태그 (예: 역사적 영감)" style={{ ...inputBase, marginBottom: '8px' }} />
                    <textarea value={spot.desc} onChange={e => updateSpot(spot.id, { desc: e.target.value })} placeholder="설명" rows={2} style={inputBase} />
                  </div>
                  <div style={{ borderTop: '1px solid rgba(99,102,241,0.14)', padding: '14px 18px', backgroundColor: 'rgba(99,102,241,0.04)' }}>
                    <p style={{ margin: '0 0 9px', fontSize: '9px', fontWeight: 800, color: '#787774', letterSpacing: '0.15em', textTransform: 'uppercase' }}>✏️ 여기서 꼭 할 일 & 영감 메모</p>
                    <textarea
                      value={detail.spotMemos[spot.id] ?? ''}
                      onChange={e => updateMemo(spot.id, e.target.value)}
                      placeholder={`${spot.name}에서의 계획을 자유롭게 적어보세요...`}
                      rows={4}
                      style={inputBase}
                    />
                  </div>
                  </>
                )}
              </div>
            )
          })}

          {/* Tips card - 추가·수정·삭제 가능 */}
          <div style={{ backgroundColor: '#fff', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.06)', marginTop: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#37352F' }}>💡 여행 꿀팁</p>
              <button onClick={addTip} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.25)', backgroundColor: 'transparent', color: '#6366f1', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                <Plus size={10} />추가
              </button>
            </div>
            <div style={{ padding: '12px 18px' }}>
              {tips.map((tip, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < tips.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                  <input value={tip.icon} onChange={e => updateTip(i, { icon: e.target.value })} style={{ width: 32, textAlign: 'center', padding: '4px 2px', fontSize: '14px', border: 'none', backgroundColor: 'transparent', outline: 'none', fontFamily: 'inherit', flexShrink: 0 }} maxLength={2} placeholder="이모지" />
                  <input value={tip.text} onChange={e => updateTip(i, { text: e.target.value })} style={{ flex: 1, minWidth: 0, border: 'none', padding: '4px 0', backgroundColor: 'transparent', fontSize: '12px', color: '#37352F', outline: 'none', fontFamily: 'inherit' }} placeholder="꿀팁 내용을 입력하세요" />
                  <button onClick={() => removeTip(i)} style={{ width: 24, height: 24, borderRadius: 6, border: 'none', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, opacity: 0.5 }} onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)' }} onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.backgroundColor = 'transparent' }} title="삭제">
                    <Trash2 size={11} color="#ef4444" />
                  </button>
                </div>
              ))}
              {tips.length === 0 && (
                <p style={{ margin: 0, padding: '16px 0', fontSize: '12px', color: '#9B9A97', textAlign: 'center' }}>꿀팁이 없습니다. &quot;추가&quot; 버튼을 눌러 추가하세요.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 일정 (Schedule) Section ── */}
      <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}>
              <CalendarRange size={18} color="#fff" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#6366f1', letterSpacing: '0.2em', textTransform: 'uppercase' }}>일정</p>
              <p style={{ margin: 0, fontSize: '19px', fontWeight: 900, color: '#37352F' }}>여행 일정</p>
            </div>
          </div>
          <button onClick={addScheduleItem} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.3)', backgroundColor: 'rgba(99,102,241,0.08)', color: '#4F46E5', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={14} />일정 추가
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {detail.schedule
            .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
            .map((item) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 18px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <input type="date" value={item.date} onChange={e => updateScheduleItem(item.id, { date: e.target.value })} style={{ ...inputBase, width: '130px', padding: '8px 10px' }} />
                  <input type="time" value={item.time ?? ''} onChange={e => updateScheduleItem(item.id, { time: e.target.value })} placeholder="시간" style={{ ...inputBase, width: '130px', padding: '8px 10px' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input value={item.title} onChange={e => updateScheduleItem(item.id, { title: e.target.value })} placeholder="제목" style={{ ...inputBase, marginBottom: '8px', fontWeight: 700 }} />
                  <textarea value={item.note} onChange={e => updateScheduleItem(item.id, { note: e.target.value })} placeholder="메모" rows={2} style={inputBase} />
                </div>
                <button onClick={() => removeScheduleItem(item.id)} style={{ width: 32, height: 32, borderRadius: '8px', border: 'none', backgroundColor: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }} title="삭제">
                  <Trash2 size={14} color="#ef4444" />
                </button>
              </div>
            ))}
          {detail.schedule.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', backgroundColor: 'rgba(99,102,241,0.04)', borderRadius: '12px', border: '1px dashed rgba(99,102,241,0.25)', color: '#787774', fontSize: '13px' }}>
              일정이 없습니다. &quot;일정 추가&quot; 버튼을 눌러 여행 일정을 추가하세요.
            </div>
          )}
        </div>
      </div>

      {/* ── 사진 (Photos) Section ── */}
      <TripPhotosSection detail={detail} onAdd={addPhoto} onUpdate={updatePhoto} onRemove={removePhoto} inputBase={inputBase} />
      {/* ── Gourmet & Diet Section ── */}
      <GourmetSection />

      {/* ── 하단 2단 그리드: 가계부 | 회고록 ── */}
      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          style={{ alignItems: 'start' }}
        >
          {/* 좌측: 여행 가계부 */}
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
            <ExpenseLedger expenses={expenses} categories={expenseCategories} onAdd={addExpense} onUpdate={updateExpense} onRemove={removeExpense} onOpenSettings={() => setTravelSettingsOpen(true)} inputBase={inputBase} isCompact />
          </div>
          {/* 우측: 여행 회고록 */}
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
            <TripRetrospective review={review} templates={retrospectiveTemplates} onSave={saveReview} onOpenSettings={() => setTravelSettingsOpen(true)} inputBase={inputBase} isCompact />
          </div>
        </div>
      </div>
    </div>

      <TravelSettingsEditModal
        open={travelSettingsOpen}
        onClose={() => setTravelSettingsOpen(false)}
        expenseCategories={expenseCategories}
        retrospectiveTemplates={retrospectiveTemplates}
        onSaveExpenseCategories={(c) => { setExpenseCategories(c); saveExpenseCategories(c) }}
        onSaveRetrospectiveTemplates={(t) => { setRetrospectiveTemplates(t); saveRetrospectiveTemplates(t) }}
        inputBase={inputBase}
      />
    </div>
  )
}

// ═══════════════════════════════════════ APP ═════════════════════════════════
export default function App() {
  // ── Auth ──
  const [session, setSession] = useState<Session | null | 'loading'>('loading')

  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [selectedQuests,   setSelectedQuests]   = useState<string[]>([])
  const [focusOpen,        setFocusOpen]         = useState(false)
  const [isZenMode,        setIsZenMode]         = useState(false)
  const [noteTarget,       setNoteTarget]        = useState<NoteTarget | null>(null)

  // ── 페이지 라우팅 ──
  const [activePage, setActivePage] = useState<PageId>('dashboard')
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0)
  const isMobile = useIsMobile()

  // ── 스탯 상태 ──
  const [stats, setStats] = useState<StatDef[]>(DEFAULT_STATS)

  // ── 퀘스트 완료 상태 ──
  const [completedQuests, setCompletedQuests] = useState<string[]>([])

  // ── Areas (빈 배열로 시작 — Supabase에서 로드) ──
  const [areas,          setAreas]          = useState<AreaRow[]>([])
  const [newAreaName,    setNewAreaName]    = useState('')
  const [editingAreaId,  setEditingAreaId]  = useState<string | null>(null)
  const [editingAreaName,setEditingAreaName] = useState('')

  // ── 프로젝트 (빈 배열로 시작 — Supabase에서 로드) ──
  const [projects,         setProjects]         = useState<ProjectRow[]>([])
  const [newProjectName,   setNewProjectName]   = useState('')
  const [newProjectAreaId, setNewProjectAreaId] = useState<string>('')
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingProjectName, setEditingProjectName] = useState('')

  // ── Identity (정체성) ──
  const [identities, setIdentities] = useState<IdentityRow[]>([])

  // ── 사용자 정의 퀘스트 (빈 배열로 시작 — Supabase에서 로드) ──
  const [userQuests,       setUserQuests]       = useState<Card[]>([])
  const [newQuestTitle,    setNewQuestTitle]    = useState('')
  const [newQuestCat,      setNewQuestCat]      = useState<CatId>('writing')
  const [newQuestAreaId,   setNewQuestAreaId]   = useState<string>('')
  const [newQuestProjectId,setNewQuestProjectId] = useState<string>('')
  const [newQuestIdentityId, setNewQuestIdentityId] = useState<string>('')
  const [newQuestTags, setNewQuestTags] = useState<string[]>([])
  const [addingQuest,      setAddingQuest]      = useState(false)
  const pomodoroStartRef         = useRef<number | null>(null)
  const pomodoroSessionProcessedRef = useRef(false) // 동일 세션 daily_logs 중복 누적 방지
  const focusQuestProjectIdRef   = useRef<string | null>(null)
  const focusQuestAreaIdRef    = useRef<string | null>(null)
  const [focusQuestId, setFocusQuestId] = useState<string | null>(null)

  // ── XP / 레벨 ──
  const [xpState,       setXpState]       = useState<XpState>(() => loadXp())
  const [levelUpAnim,   setLevelUpAnim]   = useState(false)
  const [levelUpNewLv,  setLevelUpNewLv]  = useState(1)

  // ── Toast ──
  const [toastVisible, setToastVisible] = useState(false)
  const [toastMsg,     setToastMsg]     = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Undo/Redo ──
  const { pushUndo } = useUndoRedo()

  // ── Supabase 동기화 상태 ──
  type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')

  // 타이머 상태 (App 레벨 — 모달↔젠모드 전환 중에도 계속 실행됨)
  const [timerTotal,   setTimerTotal]   = useState(25 * 60)
  const [timerSec,     setTimerSec]     = useState(25 * 60)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerDone,    setTimerDone]    = useState(false)
  const [isOvertime,   setIsOvertime]   = useState(false)
  const [overtimeSec,  setOvertimeSec]  = useState(0)
  const [dailyLog,     setDailyLog]     = useState<{ total_pomodoros: number; total_time_sec: number; time_score_applied?: number } | null>(null)
  const [levelRewards, setLevelRewards] = useState<{ id: string; target_level: number; reward_text: string; is_claimed: boolean }[]>([])
  const [newRewardLevel, setNewRewardLevel] = useState('')
  const [newRewardText, setNewRewardText] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerSecRef = useRef(timerSec)
  const isOvertimeRef = useRef(false)

  // ── 초기 로드 (localStorage) ──
  // ── Auth 세션 초기화 ──
  useEffect(() => {
    getSession().then(s => setSession(s))
    const unsub = onAuthStateChange(s => setSession(s))
    return unsub
  }, [])

  useEffect(() => {
    const saved = loadStatus()
    if (saved.selected_projects.length) setSelectedProjects(saved.selected_projects)
    if (saved.selected_quests.length)   setSelectedQuests(saved.selected_quests)
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
    setSyncStatus('syncing')

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
          id:          String(r.id),
          name:        r.title,
          sub:         r.category,
          emoji:       CAT_OPTS.find(c => c.id === r.category)?.emoji ?? '✅',
          projectId:   r.project_id != null ? String(r.project_id) : null,
          identityId:  r.identity_id ?? null,
          status:      r.status ?? 'someday',
          tags:        r.tags ?? [],
          sortOrder:   r.sort_order ?? 0,
          priority:    r.priority,
          deadline:    r.deadline,
          timeSpentSec: r.time_spent_sec,
          remainingTimeSec: r.remaining_time_sec ?? null,
          pomodoroCount: r.pomodoro_count ?? 0,
          startedAt:   r.started_at,
          endedAt:     r.ended_at,
        }))
        setUserQuests(cards)
      }),

      // ⑤-a Area 목록 로드
      fetchAreas().then(rows => setAreas(rows)),

      // ⑤-b 프로젝트 목록 로드
      fetchProjects().then(rows => setProjects(rows)),

      // ⑤-b2 Identity 목록 로드
      fetchIdentities().then(rows => setIdentities(rows)),

      // ⑤-c 오늘 daily_logs 로드
      fetchDailyLog(new Date().toISOString().split('T')[0]).then(row => {
        if (row) setDailyLog({ total_pomodoros: row.total_pomodoros, total_time_sec: row.total_time_sec, time_score_applied: row.time_score_applied })
        else setDailyLog({ total_pomodoros: 0, total_time_sec: 0 })
      }).catch(() => setDailyLog({ total_pomodoros: 0, total_time_sec: 0 })),

      // ⑤-d 레벨 보상함 로드
      fetchLevelRewards().then(rows => setLevelRewards(rows)),

      // ⑤ 나머지 데이터(worlds · saju · calendar · travel · gourmet) → app_kv
      kvGetAll().then(all => {
        const passThrough = [WORLDS_KEY, SAJU_KEY, CALENDAR_KEY, TRAVEL_KEY, TRAVEL_TRIP_DETAIL_KEY, GOURMET_KEY, TRAVEL_EXPENSE_CATEGORIES_KEY, TRAVEL_RETROSPECTIVE_TEMPLATES_KEY]
        passThrough.forEach(k => { if (all[k]) localStorage.setItem(k, JSON.stringify(all[k])) })
      }),
    ])
      .then(() => { setSyncStatus('synced'); setTimeout(() => setSyncStatus('idle'), 3000) })
      .catch(() => { setSyncStatus('error'); setTimeout(() => setSyncStatus('idle'), 5000) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Supabase 실시간 구독 (다른 기기 변경 → 자동 반영) ──
  useEffect(() => {
    const channel = subscribeKv((key, value) => {
      setSyncStatus('synced')
      setTimeout(() => setSyncStatus('idle'), 2000)
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
      focusQuestAreaIdRef.current    = null
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

  // ── 시간 점수 → total_xp 동기화 (Delta만 가산) ──
  async function syncTimeScoreToXp(recordDate: string) {
    const row = await fetchDailyLog(recordDate)
    if (!row) return
    const newScore = calculateTimeScore(Math.floor(row.total_time_sec / 60))
    const oldScore = row.time_score_applied ?? 0
    const delta = newScore - oldScore
    if (delta === 0) return
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
    const next: XpState = { totalXp: Math.max(0, newTotalXp) }
    setXpState(next)
    saveXp(next)
  }

  // ── XP 수동 편집 (Override): 현재 레벨 경험치 수정 → baseXpForCurrentLevel + 입력값으로 total_xp 역산 ──
  function handleEditCurrentLevelXp(newCurrentLevelXp: number) {
    const calc = calculateLevel(xpState.totalXp)
    const newTotalXp = Math.max(0, calc.baseXpForCurrentLevel + newCurrentLevelXp)
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
        fireToast('체크 해제 — -20 XP')
        adjustXp(-XP_PER_QUEST)
      } else {
        fireToast('Quest Clear! ✓  +20 XP')
        adjustXp(XP_PER_QUEST)
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

    const questId   = focusQuestId
    const projectId = focusQuestProjectIdRef.current
    const areaId    = focusQuestAreaIdRef.current

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

  async function addUserQuest() {
    const title = newQuestTitle.trim()
    if (!title || !_sbClient) return
    if (!newQuestAreaId) { fireToast('Vision Area를 먼저 선택해주세요!'); return }
    if (!newQuestProjectId) { fireToast('Real Projects를 먼저 선택해주세요!'); return }
    setAddingQuest(true)
    const projectId = newQuestProjectId  // 반드시 string
    const payload: Record<string, unknown> = { title, category: newQuestCat, is_completed: false }
    if (projectId) payload.project_id = projectId
    if (newQuestIdentityId) payload.identity_id = newQuestIdentityId
    if (newQuestTags.length) payload.tags = newQuestTags
    const { data, error } = await _sbClient
      .from('quests')
      .insert(payload)
      .select()
      .single()
    if (error) {
      fireToast(`퀘스트 추가 실패: ${error.message}`)
    } else if (data) {
      const catOpt = CAT_OPTS.find(c => c.id === newQuestCat) ?? CAT_OPTS[0]
      const newCard: Card = { id: String(data.id), name: title, sub: newQuestCat, emoji: catOpt.emoji, projectId: String(projectId), identityId: newQuestIdentityId || null, tags: [...newQuestTags], pomodoroCount: 0 }
      setUserQuests(prev => [...prev, newCard])
      setNewQuestTitle('')
      setNewQuestProjectId('')
      setNewQuestIdentityId('')
      setNewQuestTags([])
    }
    setAddingQuest(false)
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
      await deleteUserQuestRow(questId)
    } catch {
      fireToast('삭제 실패 — 목록을 새로고침합니다')
      fetchUserCreatedQuests().then(rows => {
        setUserQuests(rows.map(r => ({
          id: String(r.id), name: r.title, sub: r.category, emoji: CAT_OPTS.find(c=>c.id===r.category)?.emoji??'✅',
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
    setFocusOpen(false)
    handleReset()
  }

  /** 완료 버튼 클릭 시에만 실행: 시간 누적 + 도장 +1 (overtime 포함 정확 합산) */
  async function handleComplete() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setTimerRunning(false)
    setTimerDone(true)
    if (pomodoroSessionProcessedRef.current) return
    pomodoroSessionProcessedRef.current = true
    const elapsed = isOvertime ? timerTotal + overtimeSec : timerTotal - timerSec
    const elapsedClamped = Math.max(0, elapsed)
    const today = new Date().toISOString().split('T')[0]
    const flushed = await _flushPomodoroTime(elapsedClamped)
    if (flushed > 0) {
      await upsertDailyLog(today, 1, flushed)
      const row = await fetchDailyLog(today)
      if (row) {
        setDailyLog({ total_pomodoros: row.total_pomodoros, total_time_sec: row.total_time_sec, time_score_applied: row.time_score_applied })
        await syncTimeScoreToXp(today)
      }
    }
    if (focusQuestId) {
      await updateQuestRemainingTime(focusQuestId, 0)
      incrementQuestPomodoroCount(focusQuestId)
      const focusQuest = userQuests.find(q => q.id === focusQuestId)
      if (focusQuest?.identityId && elapsedClamped > 0) {
        const xpGain = Math.max(1, Math.floor(elapsedClamped / 60))
        await addIdentityTimeAndXp(focusQuest.identityId, elapsedClamped, xpGain)
      }
      setUserQuests(prev => prev.map(q => q.id === focusQuestId ? { ...q, remainingTimeSec: 0, pomodoroCount: (q.pomodoroCount ?? 0) + 1 } : q))
    }
    recordFocusSession(Math.round(timerTotal / 60))
    setIsOvertime(false)
    setOvertimeSec(0)
    isOvertimeRef.current = false
  }

  function handleExtend() {
    const extendSec = 300
    pomodoroSessionProcessedRef.current = false
    pomodoroStartRef.current = Date.now()
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
  const questLabels   = selectedQuests.map(id => userQuests.find(q => q.id === id)?.name ?? id)
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  // ── Auth 게이트 ──
  if (session === 'loading') {
    return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', backgroundColor:'#F4F4F2', color:'#787774', fontSize:'14px' }}>⏳ 로그인 확인 중…</div>
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

      {/* ── 레벨업 연출 ── */}
      {levelUpAnim && (
        <LevelUpScreen level={levelUpNewLv} onDone={() => setLevelUpAnim(false)} />
      )}

      {/* ── 젠 모드 전체화면 ── */}
      {/* ── 노트 상세 패널 ── */}
      {noteTarget && (
        <NoteModal
          target={noteTarget}
          onClose={() => setNoteTarget(null)}
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

      {/* ── 포모도로 모달 ── */}
      {focusOpen && !isZenMode && (
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
      )}

      {/* ════════════════ NAV ════════════════ */}
      <nav style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid rgba(0,0,0,0.06)', position: 'sticky', top: 0, zIndex: 100, display: isMobile ? 'none' : undefined }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '48px' }}>

          {/* 로고 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IcoPen />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: '13px', color: '#37352F', lineHeight: 1 }}>창작 OS</p>
              <p style={{ margin: 0, fontSize: '9px', color: '#787774', marginTop: '1px' }}>웹툰 작가 성장형 작업실</p>
            </div>
            {/* Supabase 동기화 상태 표시 */}
            {isSupabaseReady && syncStatus !== 'idle' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '999px', backgroundColor: syncStatus === 'error' ? 'rgba(239,68,68,0.1)' : syncStatus === 'syncing' ? 'rgba(251,191,36,0.1)' : 'rgba(52,211,153,0.1)', border: `1px solid ${syncStatus === 'error' ? 'rgba(239,68,68,0.3)' : syncStatus === 'syncing' ? 'rgba(251,191,36,0.3)' : 'rgba(52,211,153,0.3)'}` }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: syncStatus === 'error' ? '#ef4444' : syncStatus === 'syncing' ? '#fbbf24' : '#34d399', display: 'inline-block', animation: syncStatus === 'syncing' ? 'spin 1s linear infinite' : 'none' }} />
                <span style={{ fontSize: '9px', fontWeight: 700, color: syncStatus === 'error' ? '#ef4444' : syncStatus === 'syncing' ? '#fbbf24' : '#34d399' }}>
                  {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'synced' ? 'Synced ✓' : 'Sync Error'}
                </span>
              </div>
            )}
            {isSupabaseReady && syncStatus === 'idle' && (
              <div title="Supabase 연결됨" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34d399', boxShadow: '0 0 6px rgba(52,211,153,0.6)', flexShrink: 0 }} />
            )}
            <button
              onClick={async () => { await signOut(); setSession(null) }}
              title="로그아웃"
              style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', backgroundColor: 'transparent', color: '#9B9A97', fontSize: '11px', cursor: 'pointer', marginLeft: '4px', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#f87171'; e.currentTarget.style.color = '#f87171' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#EBEBEA'; e.currentTarget.style.color = '#9B9A97' }}
            >로그아웃</button>
          </div>

          {/* 페이지 탭 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {([
              { id: 'identity',  label: 'Identity',  emoji: '🎭' },
              { id: 'dashboard', label: 'Dashboard', emoji: '⚡' },
              { id: 'library',   label: 'Library',   emoji: '📚' },
              { id: 'worlds',    label: 'Worlds',    emoji: '🌐' },
              { id: 'journal',   label: 'Journal',   emoji: '📓' },
              { id: 'calendar',  label: 'Calendar',  emoji: '📅' },
              { id: 'travel',    label: 'Travel',    emoji: '✈️' },
              { id: 'fortune',   label: 'Fortune',   emoji: '🔮' },
            ] as const).map(p => (
              <button key={p.id} onClick={() => setActivePage(p.id)} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 16px', borderRadius: '8px', cursor: 'pointer', border: 'none',
                fontSize: '13px', fontWeight: activePage === p.id ? 700 : 500,
                color: activePage === p.id ? '#fff' : '#787774',
                backgroundColor: activePage === p.id ? 'rgba(99,102,241,0.08)' : 'transparent',
                transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: '13px' }}>{p.emoji}</span>
                {p.label}
                {activePage === p.id && (
                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#818cf8', display: 'inline-block' }} />
                )}
              </button>
            ))}
          </div>

          {/* 우측 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
            <p style={{ margin: 0, fontSize: '11px', color: '#787774' }}>{today}</p>
            {timerRunning && (
              <button onClick={() => setIsZenMode(true)} style={{
                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700,
                color: '#4F46E5', backgroundColor: 'rgba(99,102,241,0.1)',
                border: '1px solid rgba(99,102,241,0.28)', padding: '5px 14px', borderRadius: '999px', cursor: 'pointer',
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6366f1', display: 'inline-block' }} />
                집중 중 · 젠모드 복귀
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ════════════════ MOBILE BOTTOM NAV ════════════════ */}
      {isMobile && <MobileBottomNav active={activePage} onNav={p => setActivePage(p)} />}

      {/* ════════════════ BODY ════════════════ */}
      <div style={{ paddingBottom: isMobile ? '70px' : 0 }}>
      {activePage === 'calendar' && (
        <UnifiedCalendar
          userQuests={userQuests}
          onOpenNote={(id, title) => setNoteTarget({ table: 'journals', id, title })}
          refreshTrigger={calendarRefreshKey}
        />
      )}
      {activePage === 'identity' && <IdentityPage identities={identities} onRefresh={() => fetchIdentities().then(rows => setIdentities(rows))} />}
      {activePage === 'travel'   && <TravelPage />}
      {activePage === 'fortune'  && <FortunePage onReadingSaved={() => setCalendarRefreshKey(k => k + 1)} />}
      {activePage === 'worlds' && <WorldsPage />}
      {activePage === 'library' && (
        <LibraryPage
          xpState={xpState}
          completedQuestsCount={completedQuests.length}
          onNavigate={page => setActivePage(page)}
        />
      )}
      {activePage === 'journal' && (
        <JournalPage
          completedQuests={completedQuests}
          xpState={xpState}
          userQuests={userQuests}
        />
      )}
      {activePage === 'dashboard' && <div style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '16px 14px 24px' : '36px 48px' }}>

        {/* ── 일일 경험치 대시보드 (Daily XP Bar) ── */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(0,0,0,0.06)',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 700, color: '#6366f1', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            오늘의 몰입 레벨
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
                목표 10개 중 {(dailyLog?.total_pomodoros ?? 0)}개 완료
              </p>
            </div>
            <div style={{ display: 'flex', gap: '20px', flexShrink: 0, alignItems: 'flex-start' }}>
              <div>
                <p style={{ margin: 0, fontSize: '10px', color: '#9B9A97', marginBottom: '6px' }}>포모도로 도장</p>
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
                <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#9B9A97' }}>누적 집중 (분 단위 수정)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats — 클릭 편집 가능 */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: isMobile ? '10px' : '18px', marginBottom: '16px' }}>
          {stats.map(s => (
            <StatCard key={s.id} stat={s} onUpdate={updateStat} />
          ))}
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

        {/* 갑술(甲戌) 오늘의 기운 */}
        <div style={{
          backgroundColor: '#F1F1EF', border: '1px solid rgba(251,191,36,0.18)',
          borderRadius: '16px', padding: '16px 22px', marginBottom: '28px',
          display: 'flex', alignItems: 'flex-start', gap: '14px',
        }}>
          <span style={{ fontSize: '22px', flexShrink: 0, marginTop: '1px' }}>🌲</span>
          <div>
            <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '5px' }}>
              갑술(甲戌) · 산 위의 나무 — 오늘의 기운
            </p>
            <p style={{ margin: 0, fontSize: '13px', color: '#fde68a', lineHeight: 1.7, fontStyle: 'italic' }}>
              "{DAILY_FORTUNE}"
            </p>
          </div>
        </div>

        {/* 3열 그리드: Area + 프로젝트 + 퀘스트 */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 2fr', gap: '16px', marginBottom: '20px' }}>

          {/* ── Area 관리 섹션 ── */}
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#37352F' }}>
                <span style={{ marginRight: '6px' }}>🌐</span>Area
              </h2>
              <span style={{ fontSize: '10px', color: '#9B9A97' }}>{areas.length}개</span>
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
                          onKeyDown={e => { if (e.key==='Enter') commitEditArea(a.id); if (e.key==='Escape') setEditingAreaId(null) }}
                          onBlur={() => commitEditArea(a.id)}
                          style={{ flex:1, backgroundColor:'#FFFFFF', border:'1px solid #6366f1', borderRadius:'6px', padding:'3px 6px', fontSize:'12px', color:'#37352F', outline:'none' }}
                        />
                        <button onClick={()=>setEditingAreaId(null)} style={{ padding:'2px 6px', borderRadius:'5px', border:'1px solid rgba(0,0,0,0.08)', backgroundColor:'transparent', color:'#9B9A97', fontSize:'10px', cursor:'pointer' }}>취소</button>
                      </>
                    ) : (
                      <>
                        <div style={{ flex:1, minWidth:0 }}>
                          <span
                            onClick={() => setNoteTarget({ table:'areas', id:a.id, title:a.name, meta:{ timeSpentSec: a.time_spent_sec } })}
                            style={{ fontSize:'12px', color:'#37352F', fontWeight:500, display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor:'pointer', textDecoration:'underline', textDecorationColor:'rgba(0,0,0,0.15)' }}
                            title="클릭하여 노트 열기"
                          >{a.name}</span>
                          {fmtHM(a.time_spent_sec) && (
                            <span style={{ fontSize:'10px', color:'#0369A1', fontWeight:600 }}>⏱ {fmtHM(a.time_spent_sec)}</span>
                          )}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:'2px' }}>
                          <button onClick={()=>moveAreaUp(a.id)} disabled={areas.indexOf(a)===0} style={{ padding:'2px 4px', border:'none', backgroundColor:'transparent', color:'#9B9A97', cursor:areas.indexOf(a)===0?'default':'pointer', opacity:areas.indexOf(a)===0?0.4:1 }} title="위로"><ChevronUp size={14} /></button>
                          <button onClick={()=>moveAreaDown(a.id)} disabled={areas.indexOf(a)===areas.length-1} style={{ padding:'2px 4px', border:'none', backgroundColor:'transparent', color:'#9B9A97', cursor:areas.indexOf(a)===areas.length-1?'default':'pointer', opacity:areas.indexOf(a)===areas.length-1?0.4:1 }} title="아래로"><ChevronDown size={14} /></button>
                        </div>
                        <button onClick={()=>{ setEditingAreaId(a.id); setEditingAreaName(a.name) }}
                          style={{ padding:'2px 6px', borderRadius:'5px', border:'1px solid rgba(0,0,0,0.06)', backgroundColor:'transparent', color:'#787774', fontSize:'10px', cursor:'pointer' }} title="수정">✏️</button>
                        <button onClick={()=>removeArea(a.id)}
                          style={{ padding:'2px 6px', borderRadius:'5px', border:'1px solid rgba(248,113,113,0.2)', backgroundColor:'transparent', color:'#f87171', fontSize:'10px', cursor:'pointer' }}
                          onMouseEnter={e=>(e.currentTarget.style.backgroundColor='rgba(248,113,113,0.1)')}
                          onMouseLeave={e=>(e.currentTarget.style.backgroundColor='transparent')}
                          title="삭제">삭제</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '6px' }}>
              <input value={newAreaName} onChange={e=>setNewAreaName(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter') addArea() }}
                placeholder="새 Vision Area 이름"
                style={{ flex:1, padding:'7px 10px', borderRadius:'7px', border:'1px solid rgba(0,0,0,0.06)', backgroundColor:'#F1F1EF', color:'#37352F', fontSize:'12px', outline:'none' }}
                onFocus={e=>(e.target.style.borderColor='#0369A1')}
                onBlur={e=>(e.target.style.borderColor='rgba(0,0,0,0.06)')}
              />
              <button onClick={addArea} disabled={!newAreaName.trim()}
                style={{ padding:'7px 12px', borderRadius:'7px', border:'none', backgroundColor: newAreaName.trim() ? '#0369A1' : '#EBEBEA', color: newAreaName.trim() ? '#fff' : '#787774', fontSize:'12px', fontWeight:700, cursor: newAreaName.trim()?'pointer':'default', transition:'background 0.15s' }}
              >+</button>
            </div>
          </div>

          {/* ── 프로젝트 관리 섹션 ── */}
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#37352F' }}>
                <span style={{ marginRight: '6px' }}>📁</span>Real Projects
              </h2>
              <span style={{ fontSize: '10px', color: '#9B9A97' }}>{projects.length}개</span>
            </div>

            {projects.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#AEAAA4', margin: '0 0 14px', textAlign: 'center', padding: '12px 0' }}>아직 프로젝트 없음</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '14px' }}>
                {projects.map(p => {
                  const parentArea = p.area_id ? areas.find(a => a.id === p.area_id) : null
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', borderRadius: '8px', backgroundColor: '#F4F4F2', border: '1px solid rgba(0,0,0,0.04)' }}>
                      {editingProjectId === p.id ? (
                        <>
                          <input autoFocus value={editingProjectName}
                            onChange={e=>setEditingProjectName(e.target.value)}
                            onKeyDown={e=>{ if(e.key==='Enter') commitEditProject(p.id); if(e.key==='Escape') setEditingProjectId(null) }}
                            onBlur={()=>commitEditProject(p.id)}
                            style={{ flex:1, backgroundColor:'#FFFFFF', border:'1px solid #6366f1', borderRadius:'6px', padding:'3px 6px', fontSize:'12px', color:'#37352F', outline:'none' }}
                          />
                          <button onClick={()=>setEditingProjectId(null)} style={{ padding:'2px 6px', borderRadius:'5px', border:'1px solid rgba(0,0,0,0.08)', backgroundColor:'transparent', color:'#9B9A97', fontSize:'10px', cursor:'pointer' }}>취소</button>
                        </>
                      ) : (
                        <>
                          <div style={{ flex:1, minWidth:0 }}>
                            <span
                              onClick={() => setNoteTarget({ table:'projects', id:p.id, title:p.name, meta:{ timeSpentSec: p.time_spent_sec, areaName: areas.find(a => String(a.id) === String(p.area_id))?.name } })}
                              style={{ fontSize:'12px', color:'#37352F', fontWeight:500, display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor:'pointer', textDecoration:'underline', textDecorationColor:'rgba(0,0,0,0.15)' }}
                              title="클릭하여 노트 열기"
                            >{p.name}</span>
                            <div style={{ display:'flex', gap:'6px', alignItems:'center', marginTop:'1px' }}>
                              {parentArea && <span style={{ fontSize:'9px', color:'#0369A1', backgroundColor:'#E0F2FE', padding:'1px 5px', borderRadius:'999px' }}>{parentArea.name}</span>}
                              {fmtHM(p.time_spent_sec) && <span style={{ fontSize:'9px', color:'#6366f1', fontWeight:600 }}>⏱ {fmtHM(p.time_spent_sec)}</span>}
                            </div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:'2px' }}>
                            <button onClick={()=>moveProjectUp(p.id)} disabled={projects.indexOf(p)===0} style={{ padding:'2px 4px', border:'none', backgroundColor:'transparent', color:'#9B9A97', cursor:projects.indexOf(p)===0?'default':'pointer', opacity:projects.indexOf(p)===0?0.4:1 }} title="위로"><ChevronUp size={14} /></button>
                            <button onClick={()=>moveProjectDown(p.id)} disabled={projects.indexOf(p)===projects.length-1} style={{ padding:'2px 4px', border:'none', backgroundColor:'transparent', color:'#9B9A97', cursor:projects.indexOf(p)===projects.length-1?'default':'pointer', opacity:projects.indexOf(p)===projects.length-1?0.4:1 }} title="아래로"><ChevronDown size={14} /></button>
                          </div>
                          <button onClick={()=>{ setEditingProjectId(p.id); setEditingProjectName(p.name) }}
                            style={{ padding:'2px 6px', borderRadius:'5px', border:'1px solid rgba(0,0,0,0.06)', backgroundColor:'transparent', color:'#787774', fontSize:'10px', cursor:'pointer' }} title="수정">✏️</button>
                          <button onClick={()=>removeProject(p.id)}
                            style={{ padding:'2px 6px', borderRadius:'5px', border:'1px solid rgba(248,113,113,0.2)', backgroundColor:'transparent', color:'#f87171', fontSize:'10px', cursor:'pointer' }}
                            onMouseEnter={e=>(e.currentTarget.style.backgroundColor='rgba(248,113,113,0.1)')}
                            onMouseLeave={e=>(e.currentTarget.style.backgroundColor='transparent')}
                            title="삭제">삭제</button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* 새 프로젝트 추가 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <select value={newProjectAreaId} onChange={e=>setNewProjectAreaId(e.target.value)}
                style={{ padding:'7px 10px', borderRadius:'7px', border:'1px solid rgba(0,0,0,0.06)', backgroundColor:'#F1F1EF', color: newProjectAreaId ? '#37352F' : '#9B9A97', fontSize:'12px', outline:'none' }}>
                <option value="">{areas.length===0 ? 'Vision Area를 먼저 생성해주세요' : 'Vision Area 선택 (필수)'}</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <div style={{ display:'flex', gap:'6px' }}>
                <input value={newProjectName} onChange={e=>setNewProjectName(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter') addProject() }}
                  placeholder="새 프로젝트 이름"
                  style={{ flex:1, padding:'7px 10px', borderRadius:'7px', border:'1px solid rgba(0,0,0,0.06)', backgroundColor:'#F1F1EF', color:'#37352F', fontSize:'12px', outline:'none' }}
                  onFocus={e=>(e.target.style.borderColor='#6366f1')}
                  onBlur={e=>(e.target.style.borderColor='rgba(0,0,0,0.06)')}
                />
                <button onClick={addProject} disabled={!newProjectName.trim() || !newProjectAreaId}
                  style={{ padding:'7px 12px', borderRadius:'7px', border:'none', backgroundColor: (newProjectName.trim() && newProjectAreaId) ? '#6366f1' : '#EBEBEA', color: (newProjectName.trim() && newProjectAreaId) ? '#fff' : '#787774', fontSize:'12px', fontWeight:700, cursor: (newProjectName.trim() && newProjectAreaId)?'pointer':'default', transition:'background 0.15s' }}
                >+</button>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#37352F' }}>
                <span style={{ color: '#6366f1', marginRight: '8px' }}>2.</span>오늘의 핵심 퀘스트
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {selectedQuests.length > 0 && (
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#7C3AED', backgroundColor: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', padding: '3px 10px', borderRadius: '999px' }}>
                    {selectedQuests.length}개 선택
                  </span>
                )}
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#34d399', backgroundColor: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', padding: '3px 10px', borderRadius: '999px' }}>
                  {completedQuests.filter(id => userQuests.some(q => q.id === id)).length} / {userQuests.length} 완료
                </span>
              </div>
            </div>

            {/* QuestTable — Supabase 데이터만 표시 */}
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
              adding={addingQuest}
              onAdd={addUserQuest}
              onToggleComplete={toggleComplete}
              onDelete={removeUserQuest}
              onSelectPomodoro={handleSelectFocusQuest}
              onOpenNote={(id, title, meta) => setNoteTarget({ table:'quests', id, title, meta })}
              onQuestNameUpdate={(id, newName) => setUserQuests(prev => prev.map(q => q.id === id ? { ...q, name: newName } : q))}
              onQuestDeadlineUpdate={(id, deadline) => setUserQuests(prev => prev.map(q => q.id === id ? { ...q, deadline: deadline ?? undefined } : q))}
              onQuestStatusUpdate={(id, status) => { updateQuestStatus(id, status); setUserQuests(prev => prev.map(q => q.id === id ? { ...q, status } : q)) }}
              onQuestTagsUpdate={(id, tags) => { updateQuestTags(id, tags); setUserQuests(prev => prev.map(q => q.id === id ? { ...q, tags } : q)) }}
              onMoveQuestUp={(id) => {
                const idx = userQuests.findIndex(q => q.id === id)
                if (idx <= 0) return
                const prev = userQuests[idx - 1]
                const curr = userQuests[idx]
                updateQuestSortOrder(prev.id, idx)
                updateQuestSortOrder(curr.id, idx - 1)
                setUserQuests(prevQ => { const n=[...prevQ]; n[idx-1]=curr; n[idx]=prev; return n })
              }}
              onMoveQuestDown={(id) => {
                const idx = userQuests.findIndex(q => q.id === id)
                if (idx < 0 || idx >= userQuests.length - 1) return
                const curr = userQuests[idx]
                const nextItem = userQuests[idx + 1]
                updateQuestSortOrder(curr.id, idx + 1)
                updateQuestSortOrder(nextItem.id, idx)
                setUserQuests(prevQ => { const n=[...prevQ]; n[idx]=nextItem; n[idx+1]=curr; return n })
              }}
              onPushQuestNameUndo={pushQuestNameUndo}
              onPushQuestDeadlineUndo={pushQuestDeadlineUndo}
            />
          </div>
        </div>

        {/* Focus CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', paddingBottom: '48px' }}>
          {selectedProjects.length === 0 && selectedQuests.length === 0 && (
            <p style={{ margin: 0, fontSize: '12px', color: '#AEAAA4' }}>
              ↑ 프로젝트와 퀘스트를 선택하면 집중 세션이 활성화됩니다
            </p>
          )}
          <button
            onClick={() => { setFocusOpen(true); handleReset() }}
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
        </div>

      </div>}
      </div>{/* end body wrapper */}
    </div>
    </>
  )
}
