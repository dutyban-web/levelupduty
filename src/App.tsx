import { useState, useEffect, useRef } from 'react'
import { kvSet, kvGetAll, isSupabaseReady, subscribeKv } from './lib/supabase'
import {
  fetchUserStats, upsertUserStats,
  fetchCompletedQuestIds, upsertQuest,
  fetchAllJournals, syncJournals,
  fetchUserCreatedQuests, insertUserQuest, deleteUserQuestRow,
} from './supabase'
import { loadStatus, saveSelectedProjects, saveSelectedQuests, recordFocusSession } from './utils/storage'
import {
  Trophy, BarChart3, BookOpen, Archive, CalendarDays,
  CheckCircle2, Flame, Footprints, PenLine, Globe2,
  Scroll, Sparkles, Plus, X, ChevronRight, ChevronLeft,
  Utensils, Apple, Heart,
} from 'lucide-react'

// ═══════════════════════════════════════ RESPONSIVE ═══════════════════════════
type PageId = 'dashboard' | 'worlds' | 'journal' | 'library' | 'calendar' | 'travel'

function useIsMobile(): boolean {
  const [mob, setMob] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  useEffect(() => {
    const fn = () => setMob(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mob
}

// ── MobileBottomNav ───────────────────────────────────────────────────────────
function MobileBottomNav({ active, onNav }: { active: PageId; onNav: (p: PageId) => void }) {
  const ITEMS: { id: PageId; emoji: string; label: string }[] = [
    { id: 'dashboard', emoji: '⚡',  label: 'Home'    },
    { id: 'worlds',    emoji: '🌐',  label: 'Worlds'  },
    { id: 'journal',   emoji: '📓',  label: 'Journal' },
    { id: 'library',   emoji: '📚',  label: 'Library' },
    { id: 'calendar',  emoji: '📅',  label: 'Cal'     },
    { id: 'travel',    emoji: '✈️',   label: 'Travel'  },
  ]
  return (
    <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 500, display: 'flex', backgroundColor: 'rgba(20,20,30,0.97)', borderTop: '1px solid #252535', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {ITEMS.map(item => {
        const isActive = active === item.id
        return (
          <button key={item.id} onClick={() => onNav(item.id)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', padding: '10px 2px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', minHeight: '56px', position: 'relative', WebkitTapHighlightColor: 'transparent' }}
          >
            {isActive && <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '28px', height: '2.5px', borderRadius: '999px', backgroundColor: '#6366f1', boxShadow: '0 0 8px rgba(99,102,241,0.7)' }} />}
            <span style={{ fontSize: '18px', lineHeight: 1 }}>{item.emoji}</span>
            <span style={{ fontSize: '9px', fontWeight: isActive ? 800 : 500, color: isActive ? '#a5b4fc' : '#6b7280', letterSpacing: '0.02em', marginTop: '1px' }}>{item.label}</span>
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
type Card = { id: string; name: string; sub: string; emoji?: string }

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

type XpState = { level: number; currentXp: number; requiredXp: number }

function getRequiredXp(level: number): number {
  return Math.floor(100 * (1 + (level - 1) * 0.5))
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
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { level: 1, currentXp: 0, requiredXp: 100 }
}
function saveXp(s: XpState) {
  localStorage.setItem(XP_KEY, JSON.stringify(s))
  kvSet(XP_KEY, s)
  // 전용 테이블에도 upsert (스탯은 현재 localStorage 값 병합)
  const rawStats = localStorage.getItem(STATS_KEY)
  const stats_json = rawStats ? JSON.parse(rawStats) : {}
  upsertUserStats({ level: s.level, current_xp: s.currentXp, required_xp: s.requiredXp, stats_json })
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

// ── 퀘스트 카테고리 (모듈 레벨 — JournalPage/LibraryPage 등에서 참조) ───────
const QUEST_CATEGORIES = [
  {
    id: 'writing', label: '집필', col: '#818cf8',
    quests: [
      { id: 'story_conti',  name: '스토리 콘티',     sub: '다음 화 장면 분할 · 대사 초안',    emoji: '📋' },
      { id: 'sketch_line',  name: '데생 / 선화 마감', sub: '캐릭터 표정 · 배경 스케치 완성',   emoji: '✏️' },
    ] as Card[],
  },
  {
    id: 'business', label: '비즈니스 / 공부', col: '#fbbf24',
    quests: [
      { id: 'funding_page', name: '사주 펀딩 상세페이지', sub: '크라우드펀딩 설명 · 리워드 설계', emoji: '💼' },
      { id: 'saju_db',      name: '사주 DB 정리',         sub: '일주 분석 데이터 구조화',         emoji: '🔯' },
    ] as Card[],
  },
  {
    id: 'health', label: '자기관리', col: '#34d399',
    quests: [
      { id: 'diet_log', name: '식단 기록',    sub: '오늘 섭취 칼로리 · 영양소 메모', emoji: '🥗' },
      { id: 'cardio',   name: '유산소 운동',   sub: '30분 걷기 / 달리기',            emoji: '🏃' },
    ] as Card[],
  },
]
const ALL_QUESTS = QUEST_CATEGORIES.flatMap(c => c.quests)

// 퀘스트 추가 UI에서 사용하는 카테고리 옵션
const CAT_OPTS = [
  { id: 'writing',  label: '집필',         col: '#818cf8', emoji: '📋' },
  { id: 'business', label: '비즈니스/공부', col: '#fbbf24', emoji: '💼' },
  { id: 'health',   label: '자기관리',      col: '#34d399', emoji: '🏃' },
] as const
type CatId = 'writing' | 'business' | 'health'

const USER_QUESTS_KEY = 'creative_os_user_quests_v1'

function loadUserQuests(): Card[] {
  try {
    const raw = localStorage.getItem(USER_QUESTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}
function saveUserQuestsLocal(qs: Card[]) {
  localStorage.setItem(USER_QUESTS_KEY, JSON.stringify(qs))
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
  // 전용 테이블에도 upsert (XP는 현재 localStorage 값 병합)
  const xp = loadXp()
  upsertUserStats({ level: xp.level, current_xp: xp.currentXp, required_xp: xp.requiredXp, stats_json: payload })
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
        backgroundColor: '#1e1e2e', borderRadius: '18px', padding: '22px 24px',
        cursor: editing ? 'default' : 'pointer',
        border: editing ? '1.5px solid rgba(99,102,241,0.45)' : '1.5px solid transparent',
        boxShadow: editing ? '0 0 0 3px rgba(99,102,241,0.08)' : 'none',
        transition: 'border 0.15s, box-shadow 0.15s',
        userSelect: editing ? 'text' : 'none',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* 반짝임 오버레이 */}
      {flash && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '18px',
          background: `radial-gradient(ellipse at center, ${stat.col}22 0%, transparent 70%)`,
          animation: 'statFlash 0.75s ease-out forwards',
          pointerEvents: 'none',
        }} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <p style={{ margin: 0, fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
          {stat.label}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {!editing && <span style={{ fontSize: '10px', color: '#3f3f46' }}>✎</span>}
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
              fontSize: '11px', color: '#a5b4fc', fontFamily: 'inherit',
              resize: 'none', lineHeight: 1.6,
            }}
          />
        ) : stat.memo ? (
          <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#6b7280', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
            {stat.memo}
          </p>
        ) : null
      )}

      {/* 하단 힌트 */}
      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {!stat.hasMemo && (
          <p style={{ margin: 0, fontSize: '11px', color: '#3f3f46' }}>
            {stat.isText ? stat.value : (stat.unit || '')}
          </p>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: editing ? '#6366f1' : '#3f3f46' }}>
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
        backgroundColor: '#1a1a2e', border: '1px solid rgba(99,102,241,0.45)',
        borderRadius: '999px', padding: '10px 22px',
        boxShadow: '0 8px 32px rgba(99,102,241,0.3)',
        color: '#a5b4fc', fontSize: '13px', fontWeight: 800, letterSpacing: '0.04em',
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
const PARTICLE_COLS = ['#6366f1','#818cf8','#a78bfa','#c4b5fd','#7c3aed','#4f46e5','#ddd6fe']
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
          margin: '0 0 6px', fontSize: '88px', fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-4px',
          textShadow: '0 0 60px rgba(99,102,241,0.9), 0 0 130px rgba(139,92,246,0.5)',
        }}>
          Lv.{level}
        </p>
        <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: '#a78bfa', letterSpacing: '0.05em' }}>
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

// ═══════════════════════════════════════ XP BAR ════════════════════════════════
function XpBar({ level, currentXp, requiredXp, doneCount, totalCount }: {
  level: number; currentXp: number; requiredXp: number
  doneCount: number; totalCount: number
}) {
  const pct = requiredXp > 0 ? Math.min((currentXp / requiredXp) * 100, 100) : 0
  return (
    <div style={{
      backgroundColor: '#16162a', border: '1px solid rgba(99,102,241,0.18)',
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
          <span style={{ fontSize: '14px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{level}</span>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{getLevelTitle(level)}</p>
          <p style={{ margin: 0, fontSize: '10px', color: '#6366f1' }}>창작자 등급</p>
        </div>
      </div>

      {/* XP 게이지 */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>경험치 (XP)</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#a5b4fc' }}>{currentXp} / {requiredXp} XP</span>
        </div>
        <div style={{ height: '7px', backgroundColor: '#252535', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: 'linear-gradient(90deg,#6366f1,#a78bfa)',
            borderRadius: '999px', transition: 'width 0.6s ease-out',
            boxShadow: '0 0 10px rgba(99,102,241,0.55)',
          }} />
        </div>
      </div>

      {/* 오늘 완료 */}
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <p style={{ margin: 0, fontSize: '10px', color: '#6b7280' }}>오늘 퀘스트</p>
        <p style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: doneCount === totalCount && totalCount > 0 ? '#34d399' : '#818cf8', lineHeight: 1.1 }}>
          {doneCount}<span style={{ fontSize: '12px', color: '#52525b', fontWeight: 400 }}> / {totalCount}</span>
        </p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════ QUEST GRID ═══════════════════════════
function QuestGrid({ items, selected, completed, onToggle, onComplete }: {
  items: Card[]; selected: string[]; completed: string[]
  onToggle: (id: string) => void; onComplete: (id: string) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '10px' }}>
      {items.map(item => {
        const isSelected = selected.includes(item.id)
        const isDone     = completed.includes(item.id)
        return (
          <div key={item.id} style={{
            position: 'relative',
            opacity: isDone ? 0.45 : 1,
            transition: 'opacity 0.35s',
          }}>
            {/* 카드 본체 */}
            <button
              onClick={() => !isDone && onToggle(item.id)}
              style={{
                width: '100%', textAlign: 'left',
                padding: '13px 14px 13px 46px',
                borderRadius: '14px', cursor: isDone ? 'default' : 'pointer',
                border: `2px solid ${isDone ? 'rgba(52,211,153,0.3)' : isSelected ? '#6366f1' : 'transparent'}`,
                backgroundColor: isDone ? '#16161e' : isSelected ? 'rgba(99,102,241,0.1)' : '#2a2a2a',
                boxShadow: isSelected && !isDone ? '0 0 0 1px rgba(99,102,241,0.2)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                {item.emoji && <span style={{ fontSize: '14px' }}>{item.emoji}</span>}
                <p style={{
                  margin: 0, fontSize: '13px', fontWeight: 700,
                  color: isDone ? '#4b5563' : isSelected ? '#a5b4fc' : '#e2e8f0',
                  textDecoration: isDone ? 'line-through' : 'none',
                  transition: 'all 0.2s',
                }}>
                  {item.name}
                </p>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: isDone ? '#374151' : isSelected ? '#818cf8' : '#6b7280' }}>
                {item.sub}
              </p>
            </button>

            {/* 완료 체크 버튼 */}
            <button
              onClick={e => { e.stopPropagation(); onComplete(item.id) }}
              title={isDone ? '완료 취소' : '완료 처리'}
              style={{
                position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                width: '22px', height: '22px', borderRadius: '50%', cursor: 'pointer',
                border: `2px solid ${isDone ? '#34d399' : isSelected ? '#6366f1' : '#3f3f46'}`,
                backgroundColor: isDone ? '#34d399' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}
              onMouseEnter={e => { if (!isDone) e.currentTarget.style.borderColor = '#34d399' }}
              onMouseLeave={e => { if (!isDone) e.currentTarget.style.borderColor = isSelected ? '#6366f1' : '#3f3f46' }}
            >
              {isDone && (
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#000" strokeWidth={3.5}>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// 공통 버튼 스타일 헬퍼
const ghostBtn = (extra?: React.CSSProperties): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
  cursor: 'pointer', color: '#9ca3af', transition: 'all 0.15s',
  ...extra,
})

// ═══════════════════════════════════════ MULTI SELECT GRID ═══════════════════
function MultiSelectGrid({ items, selected, onToggle }: {
  items: Card[]; selected: string[]; onToggle: (id: string) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '10px' }}>
      {items.map(item => {
        const on = selected.includes(item.id)
        return (
          <button key={item.id} onClick={() => onToggle(item.id)} style={{
            textAlign: 'left', padding: '14px 16px', borderRadius: '14px', cursor: 'pointer',
            border: `2px solid ${on ? '#6366f1' : 'transparent'}`,
            backgroundColor: on ? 'rgba(99,102,241,0.1)' : '#2a2a2a',
            boxShadow: on ? '0 0 0 1px rgba(99,102,241,0.2),0 4px 20px rgba(99,102,241,0.1)' : 'none',
            transition: 'all 0.15s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              {item.emoji && <span style={{ fontSize: '15px' }}>{item.emoji}</span>}
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: on ? '#a5b4fc' : '#e2e8f0' }}>
                {item.name}
              </p>
              {on && (
                <span style={{ marginLeft: 'auto', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IcoCheck />
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: on ? '#818cf8' : '#6b7280' }}>{item.sub}</p>
          </button>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════ QUEST ITEM ══════════════════════════
function QuestItem({ num, title, desc, done = false }: {
  num: number; title: string; desc: string; done?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '13px 0', borderBottom: '1px solid #252525' }}>
      <div style={{
        width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, marginTop: '1px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700,
        backgroundColor: done ? '#6366f1' : '#2a2a2a', color: done ? '#fff' : '#6b7280',
      }}>
        {done ? <IcoCheck /> : num}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, marginBottom: '3px', fontSize: '13px', fontWeight: 600,
          color: done ? '#6b7280' : '#f1f5f9', textDecoration: done ? 'line-through' : 'none' }}>
          {title}
        </p>
        <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', lineHeight: 1.55 }}>{desc}</p>
      </div>
      <button style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#3f3f46', padding: '4px' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#9ca3af')}
        onMouseLeave={e => (e.currentTarget.style.color = '#3f3f46')}
      ><IcoChevron /></button>
    </div>
  )
}

// ═══════════════════════════════════════ ADJUST MINUTES ROW ══════════════════
// +/- 분 조절 UI — 준비됨 상태에서만 표시
function AdjustRow({ totalSec, onAdjust }: { totalSec: number; onAdjust: (delta: number) => void }) {
  const minutes = Math.round(totalSec / 60)
  const adjustBtn = (delta: number, label: string) => (
    <button
      onClick={() => onAdjust(delta)}
      style={{
        ...ghostBtn({ borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: 700 }),
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; e.currentTarget.style.color = '#a5b4fc' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = '#9ca3af' }}
    >
      {label}
    </button>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
      {adjustBtn(-5, '−5')}
      {adjustBtn(-1, '−1')}
      <span style={{ fontSize: '13px', fontWeight: 700, color: '#6366f1', minWidth: '52px', textAlign: 'center' }}>
        {minutes}분
      </span>
      {adjustBtn(+1, '+1')}
      {adjustBtn(+5, '+5')}
    </div>
  )
}

// ═══════════════════════════════════════ ZEN MODE ════════════════════════════
function ZenView({
  seconds, totalSec, running, finished,
  questLabels, projectLabels,
  onPlayPause, onStop,
}: {
  seconds: number; totalSec: number; running: boolean; finished: boolean
  questLabels: string[]; projectLabels: string[]
  onPlayPause: () => void; onStop: () => void
}) {
  const isMobile = useIsMobile()
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  const r = isMobile ? 140 : 120
  const circ = 2 * Math.PI * r
  // 시작(full)→끝(empty): offset = 0→circ
  const dashOffset = circ * (1 - seconds / totalSec)
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
        onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)' }}
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
            stroke={finished ? '#34d399' : '#6366f1'}
            strokeWidth="5" strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={dashOffset}
            style={{
              transition: 'stroke-dashoffset 0.95s linear, stroke 0.4s',
              filter: `drop-shadow(0 0 10px ${finished ? 'rgba(52,211,153,0.6)' : 'rgba(99,102,241,0.55)'})`,
            }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{
            fontSize: isMobile ? '96px' : '82px', fontWeight: 900, letterSpacing: '-5px',
            fontVariantNumeric: 'tabular-nums', lineHeight: 1,
            color: finished ? '#34d399' : '#fff',
            textShadow: finished
              ? '0 0 60px rgba(52,211,153,0.5)'
              : '0 0 60px rgba(99,102,241,0.35), 0 0 120px rgba(99,102,241,0.15)',
          }}>
            {mm}:{ss}
          </span>
          <span style={{ fontSize: '12px', color: '#374151', marginTop: '8px', letterSpacing: '0.08em' }}>
            {finished ? '세션 완료 🎉' : running ? '집중 중...' : '일시정지'}
          </span>
        </div>
      </div>

      {/* 퀘스트 / 프로젝트 태그 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', maxWidth: '520px', marginBottom: '44px' }}>
        {projectLabels.map(p => (
          <span key={p} style={{ fontSize: '12px', color: '#818cf8', backgroundColor: 'rgba(99,102,241,0.09)', border: '1px solid rgba(99,102,241,0.22)', padding: '5px 16px', borderRadius: '999px' }}>{p}</span>
        ))}
        {questLabels.map(q => (
          <span key={q} style={{ fontSize: '12px', color: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.18)', padding: '5px 16px', borderRadius: '999px' }}>{q}</span>
        ))}
        {projectLabels.length === 0 && questLabels.length === 0 && (
          <span style={{ fontSize: '12px', color: '#1f2937' }}>선택된 항목 없음</span>
        )}
      </div>

      {/* 컨트롤 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        {/* 정지 → 대시보드 복귀 */}
        <button onClick={onStop}
          style={{ ...ghostBtn({ borderRadius: '50%', width: '54px', height: '54px' }) }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.45)'; e.currentTarget.style.color = '#f87171' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = '#9ca3af' }}
          title="정지 · 대시보드로 복귀"
        >
          <IcoStop />
        </button>

        {/* 재생 / 일시정지 */}
        <button onClick={onPlayPause} disabled={finished}
          style={{
            width: '80px', height: '80px', borderRadius: '50%', border: 'none',
            background: finished ? '#1f2937' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
            color: '#fff', cursor: finished ? 'default' : 'pointer',
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
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.45)'; e.currentTarget.style.color = '#a5b4fc' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = '#9ca3af' }}
          title="리셋 · 복귀"
        >
          <IcoReset />
        </button>
      </div>

      <p style={{ margin: '28px 0 0', fontSize: '11px', color: '#111827', letterSpacing: '0.05em' }}>
        ESC 또는 ⏹ 버튼으로 대시보드로 복귀
      </p>
    </div>
  )
}

// ═══════════════════════════════════════ POMODORO MODAL ══════════════════════
function PomodoroModal({
  seconds, totalSec, running, finished,
  projectLabels, questLabels,
  onPlayPause, onReset, onAdjust, onClose, onEnterZen,
}: {
  seconds: number; totalSec: number; running: boolean; finished: boolean
  projectLabels: string[]; questLabels: string[]
  onPlayPause: () => void; onReset: () => void
  onAdjust: (delta: number) => void
  onClose: () => void; onEnterZen: () => void
}) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  const r = 80
  const circ = 2 * Math.PI * r
  // 시작 full → 끝 empty
  const dashOffset = circ * (1 - seconds / totalSec)
  const isReady = !running && !finished && seconds === totalSec

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ backgroundColor: '#141420', border: '1px solid #23234a', borderRadius: '26px', padding: '36px 40px', width: '460px', maxWidth: '94vw', position: 'relative' }}>

        <button onClick={onClose}
          style={{ position: 'absolute', top: '14px', right: '14px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '6px' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
        >
          <IcoClose />
        </button>

        <p style={{ margin: 0, fontSize: '10px', color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: '5px' }}>
          Focus Mode
        </p>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '16px' }}>
          몰입 타이머
        </h2>

        {/* 태그 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '26px', minHeight: '26px' }}>
          {projectLabels.map(p => (
            <span key={p} style={{ fontSize: '11px', color: '#818cf8', backgroundColor: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', padding: '3px 11px', borderRadius: '999px' }}>{p}</span>
          ))}
          {questLabels.map(q => (
            <span key={q} style={{ fontSize: '11px', color: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.22)', padding: '3px 11px', borderRadius: '999px' }}>{q}</span>
          ))}
          {projectLabels.length === 0 && questLabels.length === 0 && (
            <span style={{ fontSize: '11px', color: '#52525b' }}>프로젝트 · 퀘스트를 선택하면 여기 표시됩니다</span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>

          {/* 링 타이머 */}
          <div style={{ position: 'relative', width: '210px', height: '210px' }}>
            <svg width="210" height="210" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="105" cy="105" r={r} fill="none" stroke="rgba(99,102,241,0.09)" strokeWidth="7" />
              <circle cx="105" cy="105" r={r} fill="none"
                stroke={finished ? '#34d399' : '#6366f1'}
                strokeWidth="7" strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={dashOffset}
                style={{
                  transition: 'stroke-dashoffset 0.95s linear, stroke 0.3s',
                  filter: `drop-shadow(0 0 7px ${finished ? '#34d399' : '#6366f1'})`,
                }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <span style={{
                fontSize: '48px', fontWeight: 900, letterSpacing: '-2.5px',
                fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                color: finished ? '#34d399' : '#fff',
              }}>
                {mm}:{ss}
              </span>
              <span style={{ fontSize: '11px', color: '#52525b', letterSpacing: '0.05em' }}>
                {finished ? '완료! 🎉' : running ? '집중 중...' : isReady ? '준비됨' : '일시정지'}
              </span>
            </div>
          </div>

          {/* ── 분 조절 (준비됨 상태에서만) ── */}
          {isReady && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <p style={{ margin: 0, fontSize: '10px', color: '#52525b', letterSpacing: '0.08em' }}>
                ▲ 시간 조절 (클릭하여 분 단위 변경)
              </p>
              <AdjustRow totalSec={totalSec} onAdjust={onAdjust} />
            </div>
          )}

          {/* 컨트롤 버튼 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button onClick={onReset}
              style={{ ...ghostBtn({ borderRadius: '50%', width: '46px', height: '46px', border: '1px solid #23234a' }) }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#6366f1')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#23234a')}
            >
              <IcoReset />
            </button>

            {/* ▶ 재생 → 젠 모드 자동 진입 */}
            <button
              onClick={() => { if (!running) { onPlayPause(); onEnterZen() } else { onPlayPause() } }}
              disabled={finished}
              style={{
                width: '72px', height: '72px', borderRadius: '50%', border: 'none',
                background: finished ? '#1f2937' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                color: '#fff', cursor: finished ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: finished ? 'none' : '0 8px 32px rgba(99,102,241,0.48)',
                transition: 'all 0.15s',
              }}
            >
              {running ? <IcoPause /> : <IcoPlay />}
            </button>

            <div style={{ width: '46px' }} />
          </div>

          <p style={{ margin: 0, fontSize: '11px', color: '#27272a', textAlign: 'center' }}>
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
        <p style={{ margin: '0 0 6px', fontSize: '10px', color: '#52525b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          나의 작업 세계
        </p>

        {WORLDS.map(w => {
          const isActive = worldId === w.id
          const totalChars = Object.values(data[w.id] ?? {}).join('').length
          return (
            <button key={w.id} onClick={() => switchWorld(w.id)} style={{
              textAlign: 'left', padding: '16px 18px', borderRadius: '16px', cursor: 'pointer',
              border: `1.5px solid ${isActive ? w.border : 'transparent'}`,
              backgroundColor: isActive ? '#16162a' : '#1a1a1a',
              boxShadow: isActive ? `0 0 0 1px ${w.border}, 0 4px 20px ${w.accent}18` : 'none',
              transition: 'all 0.18s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                <span style={{ fontSize: '18px' }}>{w.emoji}</span>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: isActive ? '#fff' : '#d1d5db' }}>
                  {w.name}
                </p>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: isActive ? w.accent : '#6b7280' }}>
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
              <p style={{ margin: '8px 0 0', fontSize: '10px', color: '#52525b' }}>
                {totalChars > 0 ? `${totalChars.toLocaleString()}자 작성됨` : '아직 작성 내용 없음'}
              </p>
            </button>
          )
        })}

        {/* 전체 작성 현황 */}
        <div style={{ marginTop: 'auto', padding: '14px 16px', backgroundColor: '#16161e', borderRadius: '14px', border: '1px solid #1f1f1f' }}>
          <p style={{ margin: '0 0 10px', fontSize: '10px', color: '#52525b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            작성 현황
          </p>
          {WORLDS.map(w => {
            const count = Object.values(data[w.id] ?? {}).join('').length
            const maxCount = 10000
            const pct = Math.min(count / maxCount * 100, 100)
            return (
              <div key={w.id} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>{w.emoji} {w.name.slice(0, 7)}…</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: w.accent }}>
                    {count > 999 ? `${(count/1000).toFixed(1)}k` : count}자
                  </span>
                </div>
                <div style={{ height: '3px', backgroundColor: '#252535', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, backgroundColor: w.accent, borderRadius: '999px', transition: 'width 0.4s' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 오른쪽 패널: 에디터 ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#111', borderRadius: '20px', border: `1px solid ${world.border}`, overflow: 'hidden' }}>

        {/* 에디터 헤더 */}
        <div style={{ padding: '18px 28px', borderBottom: '1px solid #1c1c1c', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '22px' }}>{world.emoji}</span>
            <div>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#fff' }}>{world.name}</p>
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
        <div style={{ display: 'flex', gap: '2px', padding: '10px 20px 0', borderBottom: '1px solid #1c1c1c', flexShrink: 0, overflowX: 'auto' }}>
          {world.sections.map(s => {
            const isActive = secId === s.id
            const count = (data[worldId]?.[s.id] ?? '').length
            return (
              <button key={s.id} onClick={() => setSecId(s.id)} style={{
                padding: '8px 16px', borderRadius: '8px 8px 0 0', cursor: 'pointer',
                border: 'none', fontSize: '12px', fontWeight: isActive ? 700 : 500,
                color: isActive ? '#fff' : '#6b7280',
                backgroundColor: isActive ? '#1a1a1a' : 'transparent',
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
          <p style={{ margin: '0 0 16px', fontSize: '11px', color: '#3f3f46' }}>
            {draft.length > 0 ? `${draft.length.toLocaleString()}자 · ${draft.split('\n').length}줄` : '아직 작성된 내용이 없습니다.'}
          </p>
          {/* textarea */}
          <textarea
            key={`${worldId}-${secId}`}
            value={draft}
            onChange={e => handleChange(e.target.value)}
            placeholder={section.placeholder}
            style={{
              display: 'block', width: '100%', minHeight: '420px',
              background: 'transparent', border: 'none', outline: 'none', resize: 'none',
              fontSize: '14px', lineHeight: '1.9', color: '#d1d5db',
              fontFamily: "'Inter','Pretendard',system-ui,sans-serif",
              caretColor: world.accent,
            }}
          />
        </div>

        {/* 하단 툴바 */}
        <div style={{ padding: '12px 28px', borderTop: '1px solid #1c1c1c', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            {world.sections.map(s => {
              const count = (data[worldId]?.[s.id] ?? '').length
              return count > 0 ? (
                <span key={s.id} style={{ fontSize: '11px', color: '#52525b' }}>
                  {s.title}: <span style={{ color: world.accent, fontWeight: 700 }}>{count.toLocaleString()}자</span>
                </span>
              ) : null
            })}
          </div>
          <button
            onClick={() => { if (draft && confirm('이 섹션의 내용을 초기화할까요?')) { handleChange('') } }}
            style={{ fontSize: '11px', color: '#374151', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#9ca3af')}
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
function JournalPage({ completedQuests, xpState }: {
  completedQuests: string[]
  xpState: XpState
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
    const next: JournalStore = {
      ...prev,
      [key]: {
        date: key,
        content: prev[key]?.content ?? '',
        questsDone: prev[key]?.questsDone ?? [],
        xpSnapshot: prev[key]?.xpSnapshot ?? 0,
        savedAt: new Date().toISOString(),
        ...prev[key],
        ...patch,
        savedAt: new Date().toISOString(),
      },
    }
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

  // 성과 블록 생성 — 텍스트 대신 AchievementBlock[]으로 저장
  function generateBlocks() {
    const newBlocks: AchievementBlock[] = completedQuests.map(id => {
      const quest = ALL_QUESTS.find(q => q.id === id)
      if (!quest) return null
      const cat = QUEST_CATEGORIES.find(c => c.quests.some(q => q.id === id))
      return {
        questId: id,
        questName: quest.name,
        emoji: quest.emoji ?? '✅',
        categoryLabel: cat?.label ?? '기타',
        categoryColor: cat?.col ?? '#818cf8',
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
      <div style={{ width: isMobile ? '100%' : '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', overflowY: isMobile ? 'visible' : 'auto', borderBottom: isMobile ? '1px solid #252535' : 'none', paddingBottom: isMobile ? '12px' : '0', marginBottom: isMobile ? '12px' : '0' }}>
        <div style={{ paddingBottom: '16px', borderBottom: '1px solid #252525', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
            <PenLine size={14} color="#6366f1" />
            <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#6366f1', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Journal</p>
          </div>
          <p style={{ margin: '0 0 3px', fontSize: '20px', fontWeight: 900, color: '#fff' }}>창작 일지</p>
          <p style={{ margin: 0, fontSize: '11px', color: '#52525b' }}>{entryKeys.length}개의 기록</p>
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
                <span style={{ fontSize: '12px', fontWeight: 700, color: isActive ? '#a5b4fc' : isToday ? '#fbbf24' : '#9ca3af' }}>
                  {isToday ? '📍 오늘' : formatDateKo(key)}
                </span>
                {hasBlocks && (
                  <span style={{ fontSize: '10px', color: '#818cf8', fontWeight: 700 }}>
                    ⚡{(entry!.blocks!.length) * XP_PER_QUEST}XP
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '10px', color: '#3f3f46', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {preview || (isToday ? '오늘의 기록을 시작하세요...' : '내용 없음')}
              </p>
            </button>
          )
        })}
      </div>

      {/* ── 우측: 에디터 ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        backgroundColor: '#16161e', borderRadius: '20px',
        border: '1px solid #1e1e1e', overflow: 'hidden', minWidth: 0,
      }}>

        {/* 헤더 */}
        <div style={{
          padding: '20px 32px 16px', borderBottom: '1px solid #1e1e1e',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <p style={{ margin: 0, fontSize: '11px', color: '#52525b', marginBottom: '4px' }}>
              {activeKey === todayKey ? '✍️ 오늘의 일지' : '📖 지난 기록 (읽기 전용)'}
            </p>
            <p style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#fff' }}>{formatDateKo(activeKey, { full: true })}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {lastSaved && activeKey === todayKey && (
              <span style={{ fontSize: '10px', color: '#3f3f46' }}>
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
                  color: '#fff', fontSize: '12px', fontWeight: 700,
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
                  <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: '#e2e8f0', lineHeight: 1.3 }}>{block.questName}</p>
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
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                총 <strong style={{ color: '#e2e8f0' }}>{activeBlocks.length}개</strong> 퀘스트 완료
              </span>
              <span style={{ width: '1px', height: '12px', backgroundColor: '#333' }} />
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                총 <strong style={{ color: '#818cf8' }}>{totalXp} XP</strong> 획득
              </span>
              <span style={{ width: '1px', height: '12px', backgroundColor: '#333' }} />
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                현재 <strong style={{ color: '#a78bfa' }}>Lv.{xpState.level}</strong> ({xpState.currentXp}/{xpState.requiredXp} XP)
              </span>
            </div>
          </div>
        )}

        {/* 텍스트 영역 */}
        <textarea
          value={content}
          onChange={e => handleContentChange(e.target.value)}
          readOnly={activeKey !== todayKey}
          placeholder={
            activeKey === todayKey
              ? '오늘 하루를 자유롭게 기록해보세요.\n\n어떤 작업을 했나요? 뭔가 막혔던 부분은?\n힘들었던 점, 좋았던 점, 내일의 다짐...'
              : '이 날의 기록이 없습니다.'
          }
          style={{
            flex: 1, backgroundColor: 'transparent', border: 'none', outline: 'none',
            resize: 'none', padding: '28px 40px',
            color: activeKey !== todayKey ? '#6b7280' : '#e2e8f0',
            fontSize: '15px', lineHeight: '1.95',
            fontFamily: "'Noto Serif KR', 'Georgia', 'Batang', 'AppleMyungjo', serif",
            caretColor: '#818cf8',
          }}
        />

        {/* 푸터 */}
        <div style={{
          padding: '10px 32px', borderTop: '1px solid #1a1a1a',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: '11px', color: '#3f3f46' }}>
            {content.length > 0 ? `${content.length.toLocaleString()}자` : ''}
          </span>
          <span style={{ fontSize: '11px', color: '#3f3f46' }}>
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
const SAJU_NAVY  = '#0b0d1c'
const SAJU_CARD  = '#0f1220'
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
  '오행': '#34d399', '십성': '#818cf8', '신살': '#fbbf24', '이론': '#60a5fa', '기타': '#94a3b8',
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
    width: '100%', backgroundColor: '#0d1020', border: `1px solid rgba(212,168,83,0.28)`,
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
      <div style={{ backgroundColor: SAJU_NAVY, borderRadius: '24px', border: `1px solid ${SAJU_BDR}`, overflow: 'hidden' }}>

        {/* ── 갑술 근본 카드 ── */}
        <div style={{ padding: '30px 36px', borderBottom: `1px solid ${SAJU_BDR}`, background: 'linear-gradient(140deg,#0e1228 0%,#0b0d1c 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
            <Sparkles size={15} color={GOLD} />
            <span style={{ fontSize: '10px', fontWeight: 800, color: GOLD, letterSpacing: '0.2em', textTransform: 'uppercase' }}>나의 근본 일주</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '22px' }}>
            <h2 style={{ margin: 0, fontSize: '34px', fontWeight: 900, color: '#fff', fontFamily: 'serif', letterSpacing: '-1px' }}>甲戌 (갑술)</h2>
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
                color: subTab === t.id ? '#fff' : '#52525b',
                fontSize: '13px', fontWeight: subTab === t.id ? 700 : 500, transition: 'all 0.15s',
              }}>
                {t.label}
                <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 700, color: subTab === t.id ? GOLD : '#3f3f46' }}>{t.count}</span>
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
                <Scroll size={30} color="#222" />
                <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#3f3f46' }}>이론 카드가 없습니다</p>
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
                    <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', lineHeight: 1.5 }}>{card.summary}</p>
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
                <BookOpen size={30} color="#222" />
                <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#3f3f46' }}>분석 기록이 없습니다</p>
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#27272a' }}>주변 인물 또는 작품 캐릭터의 사주를 기록해보세요</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {store.records.map(rec => (
                  <div key={rec.id} onClick={() => openRecord(rec)} style={{
                    display: 'flex', alignItems: 'center', gap: '16px',
                    backgroundColor: SAJU_CARD, border: `1px solid ${SAJU_BDR}`,
                    borderRadius: '14px', padding: '14px 18px', cursor: 'pointer', transition: 'all 0.15s',
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
                      <p style={{ margin: 0, fontSize: '11px', color: '#52525b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                <button onClick={() => setPanel(null)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #252535', backgroundColor: '#14142a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#252535' }}
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
                    <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#52525b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>카테고리</label>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {(['오행','십성','신살','이론','기타'] as SajuCard['category'][]).map(cat => (
                          <button key={cat} onClick={() => setCardDraft(d => ({ ...d, category: cat }))} style={{ padding: '5px 14px', borderRadius: '999px', border: `1px solid ${cardDraft.category === cat ? CAT_COL[cat] : 'transparent'}`, backgroundColor: cardDraft.category === cat ? `${CAT_COL[cat]}18` : 'rgba(255,255,255,0.04)', color: cardDraft.category === cat ? CAT_COL[cat] : '#6b7280', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.12s' }}>
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
                    <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#52525b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>제목</label>
                    {isEditing ? <input value={cardDraft.title ?? ''} onChange={e => setCardDraft(d => ({ ...d, title: e.target.value }))} placeholder="예: 甲木 (갑목)" style={inp({ fontSize: '15px', fontWeight: 700, fontFamily: 'serif', color: '#e8d5a3' })} />
                      : <p style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#e8d5a3', fontFamily: 'serif' }}>{cardDraft.title}</p>}
                  </div>
                  {/* 요약 */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#52525b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>요약</label>
                    {isEditing ? <input value={cardDraft.summary ?? ''} onChange={e => setCardDraft(d => ({ ...d, summary: e.target.value }))} placeholder="한 줄 요약" style={inp()} />
                      : <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af', lineHeight: 1.6 }}>{cardDraft.summary}</p>}
                  </div>
                  {/* 상세 */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#52525b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>상세 내용</label>
                    {isEditing
                      ? <textarea value={cardDraft.detail ?? ''} onChange={e => setCardDraft(d => ({ ...d, detail: e.target.value }))} placeholder="특성, 생극제화, 활용법 등..." rows={12} style={inp({ lineHeight: '1.8', resize: 'vertical', fontFamily: 'serif' }) as React.CSSProperties} />
                      : <div style={{ backgroundColor: '#0d1020', border: `1px solid ${SAJU_BDR}`, borderRadius: '10px', padding: '18px 20px' }}>
                          <pre style={{ margin: 0, fontSize: '13px', color: '#d1d5db', lineHeight: '1.9', fontFamily: 'serif', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{cardDraft.detail}</pre>
                        </div>
                    }
                  </div>
                </div>
              )}

              {!isCard && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* 인물명 */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#52525b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>인물 / 캐릭터명</label>
                    {isEditing ? <input value={recDraft.name ?? ''} onChange={e => setRecDraft(d => ({ ...d, name: e.target.value }))} placeholder="예: 김00, 웹툰 주인공A" style={inp({ fontSize: '15px', fontWeight: 700, color: '#e8d5a3' })} />
                      : <p style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#e8d5a3' }}>{recDraft.name}</p>}
                  </div>
                  {/* 사주 + 생년월일 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#52525b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>사주 표기</label>
                      {isEditing ? <input value={recDraft.sajuStr ?? ''} onChange={e => setRecDraft(d => ({ ...d, sajuStr: e.target.value }))} placeholder="甲戌 壬子 庚辰 丙午" style={inp({ color: GOLD, fontFamily: 'serif' })} />
                        : <p style={{ margin: 0, fontSize: '14px', color: GOLD, fontFamily: 'serif', fontWeight: 700 }}>{recDraft.sajuStr || '—'}</p>}
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#52525b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>생년월일</label>
                      {isEditing ? <input value={recDraft.birthdate ?? ''} onChange={e => setRecDraft(d => ({ ...d, birthdate: e.target.value }))} placeholder="1990-05-10" style={inp()} />
                        : <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>{recDraft.birthdate || '—'}</p>}
                    </div>
                  </div>
                  {/* 분석 기록 */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '9px', fontSize: '9px', fontWeight: 800, color: '#52525b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>분석 기록</label>
                    {isEditing
                      ? <textarea value={recDraft.analysis ?? ''} onChange={e => setRecDraft(d => ({ ...d, analysis: e.target.value }))} placeholder="용신, 격국, 특성 분석, 운세 흐름..." rows={12} style={inp({ lineHeight: '1.8', resize: 'vertical', fontFamily: 'serif' }) as React.CSSProperties} />
                      : <div style={{ backgroundColor: '#0d1020', border: `1px solid ${SAJU_BDR}`, borderRadius: '10px', padding: '18px 20px' }}>
                          <pre style={{ margin: 0, fontSize: '13px', color: '#d1d5db', lineHeight: '1.9', fontFamily: 'serif', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{recDraft.analysis || '분석 내용이 없습니다'}</pre>
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
                  <button onClick={() => setPanel(null)} style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid #252535', backgroundColor: 'transparent', color: '#9ca3af', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>취소</button>
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
      label: '현재 레벨', value: `Lv.${xpState.level}`,
      sub: getLevelTitle(xpState.level), col: '#818cf8',
      icon: <Trophy size={20} color="#818cf8" />,
    },
    {
      label: '누적 경험치', value: `${xpState.currentXp} XP`,
      sub: `다음 레벨까지 ${xpState.requiredXp - xpState.currentXp} XP`,
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
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '16px 14px' : '36px 48px' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <BookOpen size={14} color="#6366f1" />
            <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#6366f1', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Library</p>
          </div>
          <p style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>마스터 보드</p>
          <p style={{ margin: 0, fontSize: '13px', color: '#52525b' }}>나의 모든 창작 데이터를 한눈에 관리하는 공간</p>
        </div>
      </div>

      {/* ── 성장 통계 히어로 카드 4개 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: '16px', marginBottom: '28px' }}>
        {heroStats.map(s => (
          <div key={s.label}
            style={{
              backgroundColor: '#1a1a1a', borderRadius: '18px', padding: '24px 26px',
              border: '1px solid #252525', transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.boxShadow = `0 16px 48px ${s.col}20`
              e.currentTarget.style.borderColor = `${s.col}40`
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.borderColor = '#252535'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</span>
              {s.icon}
            </div>
            <p style={{
              margin: '0 0 5px', fontSize: '30px', fontWeight: 900, color: s.col, lineHeight: 1,
              textShadow: `0 0 24px ${s.col}44`,
            }}>{s.value}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#52525b' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── 2열: 집필 실록 + 프로젝트 아카이브 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* 집필 실록 */}
        <div style={{ backgroundColor: '#1a1a1a', borderRadius: '20px', padding: '28px', border: '1px solid #252525' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <PenLine size={16} color="#818cf8" />
              <div>
                <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#6366f1', letterSpacing: '0.12em', textTransform: 'uppercase' }}>집필 실록</p>
                <p style={{ margin: '3px 0 0', fontSize: '15px', fontWeight: 800, color: '#fff' }}>날짜별 일지 아카이브</p>
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
              <PenLine size={32} color="#27272a" style={{ marginBottom: '12px' }} />
              <p style={{ margin: 0, fontSize: '13px', color: '#3f3f46' }}>아직 일지가 없습니다</p>
              <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#27272a' }}>Journal 탭에서 첫 기록을 남겨보세요</p>
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
                      padding: '13px 16px', borderRadius: '14px', cursor: 'pointer',
                      backgroundColor: '#14141e', border: '1px solid #202020',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.32)'
                      e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.05)'
                      e.currentTarget.style.transform = 'translateX(3px)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#202020'
                      e.currentTarget.style.backgroundColor = '#14141e'
                      e.currentTarget.style.transform = 'translateX(0)'
                    }}
                  >
                    {/* 날짜 캘린더 아이콘 */}
                    <div style={{
                      flexShrink: 0, width: '44px', height: '44px', borderRadius: '12px',
                      backgroundColor: '#1e1e2e', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', border: '1px solid #2a2a2a',
                    }}>
                      <span style={{ fontSize: '9px', color: '#6b7280', lineHeight: 1 }}>
                        {new Date(entry.date + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'short' })}
                      </span>
                      <span style={{ fontSize: '17px', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
                        {new Date(entry.date + 'T00:00:00').getDate()}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0' }}>{formatDateKo(entry.date)}</span>
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
                      <p style={{ margin: 0, fontSize: '11px', color: '#52525b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
        <div style={{ backgroundColor: '#1a1a1a', borderRadius: '20px', padding: '28px', border: '1px solid #252525' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Archive size={16} color="#fbbf24" />
              <div>
                <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#fbbf24', letterSpacing: '0.12em', textTransform: 'uppercase' }}>프로젝트 아카이브</p>
                <p style={{ margin: '3px 0 0', fontSize: '15px', fontWeight: 800, color: '#fff' }}>Worlds 기획안 현황</p>
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
                    backgroundColor: '#14141e', border: '1px solid #202020',
                    transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = world.border
                    e.currentTarget.style.backgroundColor = `${world.accent}06`
                    e.currentTarget.style.transform = 'translateX(4px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#202020'
                    e.currentTarget.style.backgroundColor = '#14141e'
                    e.currentTarget.style.transform = 'translateX(0)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '26px' }}>{world.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>{world.name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#52525b' }}>{world.tagline}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: totalChars > 0 ? world.accent : '#27272a', lineHeight: 1 }}>
                        {totalChars.toLocaleString()}
                      </p>
                      <p style={{ margin: 0, fontSize: '9px', color: '#52525b' }}>자 작성</p>
                    </div>
                  </div>
                  {/* 섹션 진행 바 */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {world.sections.map(sec => {
                      const has = (secs[sec.id]?.length ?? 0) > 0
                      return (
                        <div key={sec.id} title={sec.title} style={{
                          flex: 1, height: '4px', borderRadius: '999px',
                          backgroundColor: has ? world.accent : '#252535',
                          boxShadow: has ? `0 0 6px ${world.accent}55` : 'none',
                          transition: 'background 0.3s',
                        }} />
                      )
                    })}
                  </div>
                  <p style={{ margin: '7px 0 0', fontSize: '10px', color: '#52525b' }}>
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
const EVENT_PALETTE = ['#6366f1','#f97316','#34d399','#f472b6','#fbbf24','#60a5fa','#a78bfa']

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
    width: '34px', height: '34px', borderRadius: '10px', border: '1px solid #2a2a3e',
    backgroundColor: '#1e1e2e', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.15s', color: '#9ca3af',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', backgroundColor: '#10101e', border: '1px solid #2a2a3e',
    borderRadius: '10px', padding: '9px 13px', color: '#e2e8f0', fontSize: '13px',
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
          <p style={{ margin: 0, fontSize: isMobile ? '18px' : '26px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>{year}년 {MONTHS[month]}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={goToday} style={{ padding: '8px 20px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.35)', backgroundColor: 'rgba(99,102,241,0.1)', color: '#a5b4fc', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.1)' }}
          >Today</button>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={prevMonth} style={navBtn} onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1' }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a3e' }}><ChevronLeft size={15} /></button>
            <button onClick={nextMonth} style={navBtn} onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1' }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a3e' }}><ChevronRight size={15} /></button>
          </div>
        </div>
      </div>

      {/* Grid container */}
      <div style={{ backgroundColor: '#1a1a2e', borderRadius: '20px', border: '1px solid #2a2a3e', overflow: 'hidden' }}>

        {/* DOW header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid #252535' }}>
          {DOWS.map((d, i) => (
            <div key={d} style={{ padding: '13px 0', textAlign: 'center', fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em', color: i === 0 ? '#f87171' : i === 6 ? '#818cf8' : '#6b7280' }}>{d}</div>
          ))}
        </div>

        {/* Week rows */}
        {grid.map((week, wi) => {
          const wEvs = getWeekEvents(week, calStore.events)
          const maxLv = wEvs.reduce((m, e) => Math.max(m, e.level), -1)
          const evH   = maxLv >= 0 ? (maxLv + 1) * 26 + 10 : 10

          return (
            <div key={wi} style={{ borderBottom: wi < 5 ? '1px solid #252535' : 'none' }}>

              {/* Day numbers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', height: '48px' }}>
                {week.map((dk, di) => {
                  const inMonth = dk.startsWith(curPfx)
                  const isToday = dk === todayKey
                  const act     = getActivity(dk)
                  const dayNum  = parseInt(dk.slice(8))
                  return (
                    <div key={di} onClick={() => setModal({ day: dk })}
                      style={{ display: 'flex', alignItems: 'center', padding: '0 10px', gap: '5px', borderRight: di < 6 ? '1px solid #252535' : 'none', cursor: 'pointer', transition: 'background 0.12s' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.06)' }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '' }}
                    >
                      <span style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? '#6366f1' : '', boxShadow: isToday ? '0 0 14px rgba(99,102,241,0.55)' : '', fontSize: '13px', fontWeight: isToday ? 800 : 400, color: isToday ? '#fff' : !inMonth ? '#383848' : di === 0 ? '#f87171' : di === 6 ? '#818cf8' : '#d4d4e8' }}>
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
        <span style={{ fontSize: '11px', color: '#52525b' }}>활동 강도:</span>
        {[1,2,3].map(n => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: `${4+n}px`, height: `${4+n}px`, borderRadius: '50%', backgroundColor: ACT[n as 1|2|3], display: 'inline-block', boxShadow: n === 3 ? '0 0 6px rgba(99,102,241,0.6)' : '' }} />
            <span style={{ fontSize: '10px', color: '#3f3f46' }}>Lv.{n}</span>
          </div>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#3f3f46' }}>날짜 클릭 → 일정 추가</span>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 7000 }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.56)' }} onClick={() => { setModal(null); setForm(null) }} />
          <div style={{ position: 'absolute', top: isMobile ? 'auto' : '50%', bottom: isMobile ? 0 : 'auto', left: isMobile ? 0 : '50%', right: isMobile ? 0 : 'auto', transform: isMobile ? 'none' : 'translate(-50%,-50%)', width: isMobile ? '100%' : '400px', backgroundColor: '#1a1a2e', borderRadius: isMobile ? '20px 20px 0 0' : '20px', border: '1px solid #2a2a3e', boxShadow: '0 24px 80px rgba(0,0,0,0.55)', overflow: 'hidden' }}>

            {/* Modal header */}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #252535', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#fff' }}>{formatDateKo(modal.day, { full: true })}</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {!form && (
                  <button onClick={() => setForm({ startDate: modal.day, endDate: modal.day, color: EVENT_PALETTE[0], title: '', note: '' })} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 13px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.3)', backgroundColor: 'rgba(99,102,241,0.09)', color: '#a5b4fc', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                    <Plus size={11} />일정 추가
                  </button>
                )}
                <button onClick={() => { setModal(null); setForm(null) }} style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1px solid #2a2a3e', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={12} color="#6b7280" />
                </button>
              </div>
            </div>

            {!form ? (
              <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '14px 16px' }}>
                {getDayEvents(modal.day).length === 0 ? (
                  <p style={{ margin: 0, padding: '24px 0', textAlign: 'center', fontSize: '13px', color: '#3f3f46' }}>이 날의 일정이 없습니다</p>
                ) : (
                  getDayEvents(modal.day).map(ev => (
                    <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: '12px', backgroundColor: `${ev.color}10`, border: `1px solid ${ev.color}28`, marginBottom: '8px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: ev.color, flexShrink: 0, marginTop: '4px' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>{ev.title}</p>
                        {ev.note && <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#6b7280' }}>{ev.note}</p>}
                        <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#3f3f46' }}>{ev.startDate === ev.endDate ? ev.startDate : `${ev.startDate} — ${ev.endDate}`}</p>
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
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '9px', fontWeight: 800, color: '#52525b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>제목 *</label>
                  <input value={form.title ?? ''} onChange={e => setForm(f => ({ ...f!, title: e.target.value }))} placeholder="일정 제목" style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '9px', fontWeight: 800, color: '#52525b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>시작일</label>
                    <input type="date" value={form.startDate ?? ''} onChange={e => setForm(f => ({ ...f!, startDate: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' } as React.CSSProperties} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '9px', fontWeight: 800, color: '#52525b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>종료일</label>
                    <input type="date" value={form.endDate ?? ''} onChange={e => setForm(f => ({ ...f!, endDate: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' } as React.CSSProperties} />
                  </div>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '9px', fontWeight: 800, color: '#52525b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>색상</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {EVENT_PALETTE.map(col => (
                      <button key={col} onClick={() => setForm(f => ({ ...f!, color: col }))} style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: col, border: `2.5px solid ${form.color === col ? '#fff' : 'transparent'}`, cursor: 'pointer', transition: 'transform 0.1s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.25)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }} />
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '9px', fontWeight: 800, color: '#52525b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>메모</label>
                  <textarea value={form.note ?? ''} onChange={e => setForm(f => ({ ...f!, note: e.target.value }))} placeholder="메모 (선택사항)..." rows={2} style={{ ...inputStyle, resize: 'none', lineHeight: '1.6' } as React.CSSProperties} />
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setForm(null)} style={{ padding: '8px 16px', borderRadius: '9px', border: '1px solid #2a2a3e', backgroundColor: 'transparent', color: '#9ca3af', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>취소</button>
                  <button onClick={saveEvent} style={{ padding: '8px 22px', borderRadius: '9px', border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}>저장</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════ TRAVEL ══════════════════════════════
const TRAVEL_KEY = 'creative_os_travel_v1'

type PackItem     = { id: string; label: string; checked: boolean }
type PackCategory = { id: string; label: string; emoji: string; items: PackItem[] }
type TravelStore  = { packing: PackCategory[]; spotMemos: Record<string, string> }

const OSAKA_START = new Date(2026, 3, 27)

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

const TRAVEL_SPOTS = [
  { id: 'osaka_castle',  name: '오사카성',               emoji: '🏯', tag: '역사적 영감 & 풍경 촬영', desc: '도요토미 히데요시의 천하통일 성채. 거대한 돌벽과 황금 지붕이 만드는 압도적 스케일 — 웹툰 배경 레퍼런스로 반드시 촬영.' },
  { id: 'tezuka_museum', name: '테즈카 오사무 만화 박물관', emoji: '✒️', tag: '만화의 신께 바치는 순례', desc: '아톰, 블랙잭의 아버지 테즈카 오사무가 남긴 창작의 유산. 작화와 스토리텔링의 근원을 직접 느끼는 창작 성지.' },
  { id: 'kyoto_day',     name: '교토 당일치기',          emoji: '⛩️', tag: '전통미 & 정적인 충전',   desc: '후시미이나리의 붉은 도리이, 아라시야마 대나무 숲. 한국 웹툰에서 보기 드문 동양 판타지 세계관을 흡수하는 감성 코스.' },
]

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
    backgroundColor: '#10101e', border: '1px solid #2a2a3e', borderRadius: '8px',
    padding: '7px 10px', color: '#e2e8f0', fontSize: '12px', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit', width: '100%',
  }

  function MenuCard({ m, accentColor }: { m: typeof DIET_MENUS[0]; accentColor: string }) {
    const isActive = activeMenu === m.id
    return (
      <div style={{ backgroundColor: '#1a1a2e', borderRadius: '12px', border: `1px solid ${isActive ? `${accentColor}50` : '#2a2a3e'}`, marginBottom: '8px', overflow: 'hidden', transition: 'border-color 0.2s' }}>
        <div onClick={() => setActiveMenu(isActive ? null : m.id)}
          style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '9px', transition: 'background 0.12s' }}
          onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = `${accentColor}08` }}
          onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = '' }}
        >
          <span style={{ fontSize: '20px', flexShrink: 0 }}>{m.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#e2e8f0' }}>{m.name}</p>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#52525b', lineHeight: 1.4 }}>{m.desc}</p>
          </div>
          <span style={{ fontSize: '9px', color: isActive ? accentColor : '#3a3a5e', transition: 'transform 0.2s, color 0.2s', display: 'inline-block', transform: isActive ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
        </div>
        {isActive && (
          <div style={{ borderTop: `1px solid ${accentColor}18`, padding: '10px 12px', backgroundColor: `${accentColor}06` }}>
            <p style={{ margin: '0 0 6px', fontSize: '9px', fontWeight: 800, color: '#52525b', letterSpacing: '0.14em', textTransform: 'uppercase' }}>📍 어디서 먹을까? 메모</p>
            <input value={gourmet.dietMenuNotes[m.id] ?? ''} onChange={e => updateDietNote(m.id, e.target.value)} placeholder="식당 이름 / 편의점 위치..." style={cellInput} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ marginTop: '32px' }}>
      {/* Section divider & header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px', paddingBottom: '18px', borderTop: '1px solid #252535', paddingTop: '32px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg,#f97316,#ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(249,115,22,0.35)' }}>
          <Utensils size={18} color="#fff" />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#f97316', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Gourmet &amp; Diet</p>
          <p style={{ margin: 0, fontSize: '19px', fontWeight: 900, color: '#fff' }}>오사카 미식 설계도</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: dietOkCount === 4 ? 'rgba(52,211,153,0.1)' : 'rgba(99,102,241,0.08)', borderRadius: '12px', padding: '9px 18px', border: `1px solid ${dietOkCount === 4 ? 'rgba(52,211,153,0.3)' : 'rgba(99,102,241,0.2)'}` }}>
          <Heart size={14} color={dietOkCount === 4 ? '#34d399' : '#6366f1'} fill={dietOkCount === 4 ? '#34d399' : 'none'} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: dietOkCount === 4 ? '#34d399' : '#a5b4fc' }}>다이어트 준수율: {dietOkCount}/4일</span>
        </div>
      </div>

      {/* Two-column: Wishlist + Diet Guide */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: '22px' }}>

        {/* Restaurant Wishlist */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ fontSize: '16px' }}>🗺️</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>맛집 위시리스트</span>
            </div>
            <button onClick={() => setShowAddForm(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.28)', backgroundColor: 'rgba(99,102,241,0.08)', color: '#a5b4fc', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={10} />추가
            </button>
          </div>

          {showAddForm && (
            <div style={{ backgroundColor: '#1a1a2e', borderRadius: '14px', border: '1px solid rgba(99,102,241,0.22)', padding: '14px', marginBottom: '12px' }}>
              <input value={newRest.name} onChange={e => setNewRest(p => ({ ...p, name: e.target.value }))} placeholder="식당 이름" style={{ ...cellInput, marginBottom: '8px' }} />
              <input value={newRest.area} onChange={e => setNewRest(p => ({ ...p, area: e.target.value }))} placeholder="위치/지역" style={{ ...cellInput, marginBottom: '10px' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['cheat', 'diet'] as const).map(t => (
                  <button key={t} onClick={() => setNewRest(p => ({ ...p, type: t }))} style={{ flex: 1, padding: '7px', borderRadius: '8px', border: `1px solid ${newRest.type === t ? (t === 'cheat' ? '#f97316' : '#34d399') : '#2a2a3e'}`, backgroundColor: newRest.type === t ? (t === 'cheat' ? 'rgba(249,115,22,0.12)' : 'rgba(52,211,153,0.12)') : 'transparent', color: newRest.type === t ? (t === 'cheat' ? '#f97316' : '#34d399') : '#6b7280', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                    {t === 'cheat' ? '🍔 치팅 데이' : '🥗 다이어트'}
                  </button>
                ))}
                <button onClick={addRestaurant} style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>저장</button>
              </div>
            </div>
          )}

          <div style={{ maxHeight: '340px', overflowY: 'auto', paddingRight: '3px' }}>
            {gourmet.restaurants.map(rest => (
              <div key={rest.id} style={{ backgroundColor: '#1a1a2e', borderRadius: '12px', border: '1px solid #2a2a3e', padding: '11px 13px', marginBottom: '8px', opacity: rest.visited ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div onClick={() => toggleVisited(rest.id)} style={{ width: '16px', height: '16px', borderRadius: '4px', border: `1.5px solid ${rest.visited ? '#6366f1' : '#3a3a5e'}`, backgroundColor: rest.visited ? '#6366f1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s' }}>
                    {rest.visited && <span style={{ fontSize: '9px', color: '#fff' }}>✓</span>}
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: rest.visited ? '#4a4a6a' : '#e2e8f0', flex: 1, textDecoration: rest.visited ? 'line-through' : 'none' }}>{rest.name}</span>
                  <span style={{ fontSize: '9px', fontWeight: 800, padding: '2px 9px', borderRadius: '999px', color: rest.type === 'cheat' ? '#f97316' : '#34d399', backgroundColor: rest.type === 'cheat' ? 'rgba(249,115,22,0.1)' : 'rgba(52,211,153,0.1)', border: `1px solid ${rest.type === 'cheat' ? 'rgba(249,115,22,0.25)' : 'rgba(52,211,153,0.25)'}`, flexShrink: 0 }}>
                    {rest.type === 'cheat' ? '🍔 치팅' : '🥗 식단'}
                  </span>
                  <button onClick={() => removeRestaurant(rest.id)} style={{ width: '18px', height: '18px', borderRadius: '4px', border: 'none', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <X size={10} color="#3f3f5e" />
                  </button>
                </div>
                {rest.area && <p style={{ margin: '4px 0 0 24px', fontSize: '10px', color: '#52525b' }}>📍 {rest.area}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Diet Menu Guide */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
            <Apple size={15} color="#34d399" />
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>현지 다이어트 메뉴 가이드</span>
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
      <div style={{ backgroundColor: '#1a1a2e', borderRadius: '20px', border: '1px solid #2a2a3e', overflow: isMobile ? 'auto' : 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #252535', display: 'flex', alignItems: 'center', gap: '9px' }}>
          <span style={{ fontSize: '16px' }}>📅</span>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#fff' }}>일일 식단 트래커 — 4일간 미식 기록</p>
        </div>

        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '148px 1fr 1fr 1fr 96px' }}>
          {['날짜/일정', '🌅 아침', '☀️ 점심', '🌙 저녁', '식단 OK?'].map((h, i) => (
            <div key={i} style={{ padding: '10px 14px', fontSize: '10px', fontWeight: 800, color: '#52525b', letterSpacing: '0.12em', textTransform: 'uppercase', borderRight: i < 4 ? '1px solid #252535' : 'none', borderBottom: '1px solid #252535', backgroundColor: 'rgba(255,255,255,0.02)' }}>{h}</div>
          ))}
        </div>

        {/* Table rows */}
        {TRAVEL_DATES.map((d, ri) => {
          const meal = gourmet.meals[d.key] ?? EMPTY_MEAL
          return (
            <div key={d.key} style={{ display: 'grid', gridTemplateColumns: '148px 1fr 1fr 1fr 96px', borderBottom: ri < 3 ? '1px solid #252535' : 'none' }}>
              <div style={{ padding: '12px 14px', borderRight: '1px solid #252535' }}>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 800, color: '#e2e8f0' }}>{d.label}</p>
                <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#52525b' }}>{d.theme}</p>
              </div>
              {(['breakfast', 'lunch', 'dinner'] as const).map((field) => (
                <div key={field} style={{ padding: '10px 12px', borderRight: '1px solid #252535' }}>
                  <input value={meal[field]} onChange={e => updateMeal(d.key, field, e.target.value)} placeholder="기록..." style={cellInput} />
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div onClick={() => updateMeal(d.key, 'dietOk', !meal.dietOk)} style={{ width: '30px', height: '30px', borderRadius: '9px', border: `2px solid ${meal.dietOk ? '#34d399' : '#3a3a5e'}`, backgroundColor: meal.dietOk ? 'rgba(52,211,153,0.15)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: meal.dietOk ? '0 0 12px rgba(52,211,153,0.35)' : 'none' }}>
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

// ── TravelPage ────────────────────────────────────────────────────────────────
function TravelPage() {
  const isMobile = useIsMobile()
  const [store,      setStore]      = useState<TravelStore>(() => loadTravel())
  const [activeSpot, setActiveSpot] = useState<string | null>(null)

  const allItems     = store.packing.flatMap(c => c.items)
  const checkedCount = allItems.filter(i => i.checked).length
  const totalCount   = allItems.length
  const pct          = totalCount > 0 ? Math.round(checkedCount / totalCount * 100) : 0

  const now   = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dday  = Math.ceil((OSAKA_START.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const ddayTxt   = dday > 0 ? `D-${dday}` : dday === 0 ? 'D-DAY!' : `D+${Math.abs(dday)}`
  const ddayColor = dday <= 0 ? '#fbbf24' : dday <= 7 ? '#f97316' : dday <= 30 ? '#a78bfa' : '#818cf8'

  const CAT_COLOR: Record<string, string> = { essential: '#6366f1', creative: '#f472b6', daily: '#34d399' }

  function persist(next: TravelStore) { setStore(next); saveTravel(next) }

  function toggleItem(catId: string, itemId: string) {
    persist({
      ...store,
      packing: store.packing.map(cat => cat.id !== catId ? cat : {
        ...cat,
        items: cat.items.map(item => item.id === itemId ? { ...item, checked: !item.checked } : item),
      }),
    })
  }

  function updateMemo(spotId: string, text: string) {
    persist({ ...store, spotMemos: { ...store.spotMemos, [spotId]: text } })
  }

  const tips = [
    { icon: '🚇', text: 'IC 카드(ICOCA) 첫날 바로 구매 → 지하철·버스 올인원 교통' },
    { icon: '🍜', text: '도톤보리 타코야키 & 라멘 → 창작 에너지 보충 필수' },
    { icon: '📸', text: '오사카성 & 만화박물관 → 웹툰 배경 레퍼런스 대량 촬영' },
    { icon: '🕐', text: '교토 당일치기 → 아침 일찍 출발해 후시미이나리 인파 피하기' },
  ]

  const inputBase: React.CSSProperties = {
    width: '100%', backgroundColor: '#10101e', border: '1px solid #2a2a3e',
    borderRadius: '12px', padding: '12px 14px', color: '#e2e8f0', fontSize: '12px',
    outline: 'none', resize: 'none', boxSizing: 'border-box', lineHeight: '1.7', fontFamily: 'inherit',
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '14px 12px' : '36px 48px' }}>

      {/* ── Travel Hero Header ── */}
      <div style={{ position: 'relative', borderRadius: '24px', overflow: 'hidden', background: 'linear-gradient(135deg, #0c0c1e 0%, #1a1440 55%, #0d1828 100%)', border: '1px solid rgba(99,102,241,0.22)', padding: isMobile ? '24px 20px' : '40px 48px', marginBottom: '24px' }}>
        {/* Decorative glows */}
        <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '320px', height: '320px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.13) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-80px', left: '25%', width: '240px', height: '240px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.09) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '24px' }}>
          {/* Left: title */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px' }}>✈️</span>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#f97316', letterSpacing: '0.22em', textTransform: 'uppercase' }}>Travel Center</span>
            </div>
            <h1 style={{ margin: '0 0 10px', fontSize: '42px', fontWeight: 900, color: '#fff', letterSpacing: '-1.5px', lineHeight: 1.05 }}>
              OSAKA <span style={{ color: '#6366f1' }}>&amp;</span> KYOTO
            </h1>
            <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#94a3b8', fontWeight: 500 }}>2026년 4월 27일 (월) — 4월 30일 (목) · 3박 4일</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['일본 오사카', '교토 당일치기', '만화 성지순례', '창작 충전'].map(tag => (
                <span key={tag} style={{ fontSize: '10px', fontWeight: 700, color: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.1)', padding: '4px 12px', borderRadius: '999px', border: '1px solid rgba(167,139,250,0.2)' }}>{tag}</span>
              ))}
            </div>
          </div>

          {/* Right: D-Day */}
          <div style={{ textAlign: 'center', padding: '28px 40px', borderRadius: '20px', backgroundColor: 'rgba(0,0,0,0.38)', border: `1px solid ${ddayColor}40`, backdropFilter: 'blur(12px)', flexShrink: 0 }}>
            <p style={{ margin: '0 0 6px', fontSize: '10px', fontWeight: 700, color: '#6b7280', letterSpacing: '0.18em', textTransform: 'uppercase' }}>출발까지</p>
            <p style={{ margin: '0 0 6px', fontSize: '56px', fontWeight: 900, color: ddayColor, lineHeight: 1, letterSpacing: '-2px', textShadow: `0 0 32px ${ddayColor}55` }}>{ddayTxt}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#52525b' }}>2026.04.27 (화)</p>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ position: 'relative', marginTop: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#52525b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>🧳 여행 준비 완료율</span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: pct === 100 ? '#34d399' : '#e2e8f0' }}>
              {pct}% <span style={{ fontSize: '10px', color: '#52525b', fontWeight: 500 }}>({checkedCount}/{totalCount})</span>
              {pct === 100 && <span style={{ marginLeft: '8px', fontSize: '13px' }}>🎉 준비 완료!</span>}
            </span>
          </div>
          <div style={{ height: '7px', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: '999px', background: pct === 100 ? 'linear-gradient(90deg,#34d399,#10b981)' : 'linear-gradient(90deg,#6366f1,#a78bfa)', transition: 'width 0.45s cubic-bezier(0.4,0,0.2,1)', boxShadow: pct > 0 ? `0 0 12px rgba(99,102,241,0.5)` : 'none' }} />
          </div>
        </div>
      </div>

      {/* ── Two column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', alignItems: 'start' }}>

        {/* ── Left: Packing Checklist ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '18px' }}>🧳</span>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#fff' }}>스마트 체크리스트</p>
          </div>

          {store.packing.map(cat => {
            const catChecked = cat.items.filter(i => i.checked).length
            const ac = CAT_COLOR[cat.id] ?? '#6366f1'
            return (
              <div key={cat.id} style={{ backgroundColor: '#1e1e2e', borderRadius: '18px', border: '1px solid #2a2a3e', marginBottom: '14px', overflow: 'hidden' }}>
                <div style={{ padding: '13px 18px', borderBottom: '1px solid #252535', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>{cat.emoji}</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>{cat.label}</span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: catChecked === cat.items.length ? '#34d399' : ac, backgroundColor: `${ac}15`, padding: '3px 11px', borderRadius: '999px', border: `1px solid ${ac}30` }}>
                    {catChecked}/{cat.items.length} {catChecked === cat.items.length ? '✓' : ''}
                  </span>
                </div>
                <div style={{ padding: '8px 10px' }}>
                  {cat.items.map(item => (
                    <div key={item.id} onClick={() => toggleItem(cat.id, item.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 10px', borderRadius: '10px', cursor: 'pointer', transition: 'background 0.12s' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.06)' }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '' }}
                    >
                      <div style={{ width: '18px', height: '18px', borderRadius: '5px', border: `2px solid ${item.checked ? ac : '#3a3a5e'}`, backgroundColor: item.checked ? ac : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s', boxShadow: item.checked ? `0 0 8px ${ac}50` : 'none' }}>
                        {item.checked && <span style={{ fontSize: '10px', color: '#fff', lineHeight: 1 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: '13px', color: item.checked ? '#4a4a6a' : '#d4d4e8', textDecoration: item.checked ? 'line-through' : 'none', transition: 'all 0.2s' }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Right: Inspiration Spots ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '18px' }}>📍</span>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#fff' }}>주요 스팟 가이드</p>
          </div>

          {TRAVEL_SPOTS.map(spot => {
            const isActive = activeSpot === spot.id
            return (
              <div key={spot.id} style={{ backgroundColor: '#1e1e2e', borderRadius: '18px', border: `1px solid ${isActive ? 'rgba(99,102,241,0.38)' : '#2a2a3e'}`, marginBottom: '14px', overflow: 'hidden', transition: 'border-color 0.2s', boxShadow: isActive ? '0 0 24px rgba(99,102,241,0.12)' : 'none' }}>
                <div onClick={() => setActiveSpot(isActive ? null : spot.id)}
                  style={{ padding: '16px 18px', cursor: 'pointer', transition: 'background 0.12s' }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.04)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = '' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '30px', lineHeight: 1, flexShrink: 0 }}>{spot.emoji}</span>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: '0 0 5px', fontSize: '14px', fontWeight: 800, color: '#fff' }}>{spot.name}</p>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.1)', padding: '3px 9px', borderRadius: '999px', border: '1px solid rgba(167,139,250,0.22)' }}>{spot.tag}</span>
                        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#6b7280', lineHeight: 1.65 }}>{spot.desc}</p>
                      </div>
                    </div>
                    <span style={{ color: isActive ? '#6366f1' : '#3a3a5e', flexShrink: 0, fontSize: '11px', marginTop: '3px', display: 'inline-block', transform: isActive ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s, color 0.2s' }}>▼</span>
                  </div>
                </div>

                {isActive && (
                  <div style={{ borderTop: '1px solid rgba(99,102,241,0.14)', padding: '14px 18px', backgroundColor: 'rgba(99,102,241,0.04)' }}>
                    <p style={{ margin: '0 0 9px', fontSize: '9px', fontWeight: 800, color: '#52525b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>✏️ 여기서 꼭 할 일 & 영감 메모</p>
                    <textarea
                      value={store.spotMemos[spot.id] ?? ''}
                      onChange={e => updateMemo(spot.id, e.target.value)}
                      placeholder={`${spot.name}에서의 계획을 자유롭게 적어보세요...`}
                      rows={4}
                      style={inputBase}
                    />
                  </div>
                )}
              </div>
            )
          })}

          {/* Tips card */}
          <div style={{ backgroundColor: 'rgba(99,102,241,0.05)', borderRadius: '18px', border: '1px solid rgba(99,102,241,0.14)', padding: '18px 20px' }}>
            <p style={{ margin: '0 0 14px', fontSize: '10px', fontWeight: 800, color: '#6366f1', letterSpacing: '0.12em', textTransform: 'uppercase' }}>💡 오사카 여행 꿀팁</p>
            {tips.map((tip, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: i < tips.length - 1 ? '10px' : 0 }}>
                <span style={{ fontSize: '14px', flexShrink: 0, lineHeight: 1.5 }}>{tip.icon}</span>
                <span style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.6 }}>{tip.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Gourmet & Diet Section ── */}
      <GourmetSection />
    </div>
  )
}

// ═══════════════════════════════════════ APP ═════════════════════════════════
export default function App() {
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [selectedQuests,   setSelectedQuests]   = useState<string[]>([])
  const [focusOpen,        setFocusOpen]         = useState(false)
  const [isZenMode,        setIsZenMode]         = useState(false)

  // ── 페이지 라우팅 ──
  const [activePage, setActivePage] = useState<PageId>('dashboard')
  const isMobile = useIsMobile()

  // ── 스탯 상태 ──
  const [stats, setStats] = useState<StatDef[]>(DEFAULT_STATS)

  // ── 퀘스트 완료 상태 ──
  const [completedQuests, setCompletedQuests] = useState<string[]>([])

  // ── 사용자 정의 퀘스트 ──
  const [userQuests,     setUserQuests]     = useState<Card[]>(() => loadUserQuests())
  const [newQuestTitle,  setNewQuestTitle]  = useState('')
  const [newQuestCat,    setNewQuestCat]    = useState<CatId>('writing')
  const [addingQuest,    setAddingQuest]    = useState(false)

  // ── XP / 레벨 ──
  const [xpState,       setXpState]       = useState<XpState>(() => loadXp())
  const [levelUpAnim,   setLevelUpAnim]   = useState(false)
  const [levelUpNewLv,  setLevelUpNewLv]  = useState(1)

  // ── Toast ──
  const [toastVisible, setToastVisible] = useState(false)
  const [toastMsg,     setToastMsg]     = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Supabase 동기화 상태 ──
  type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')

  // 타이머 상태 (App 레벨 — 모달↔젠모드 전환 중에도 계속 실행됨)
  const [timerTotal,   setTimerTotal]   = useState(25 * 60)
  const [timerSec,     setTimerSec]     = useState(25 * 60)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerDone,    setTimerDone]    = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── 초기 로드 (localStorage) ──
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
        const xp: XpState = { level: row.level, currentXp: row.current_xp, requiredXp: row.required_xp }
        localStorage.setItem(XP_KEY, JSON.stringify(xp))
        setXpState(xp)
        if (row.stats_json && Object.keys(row.stats_json).length) {
          localStorage.setItem(STATS_KEY, JSON.stringify(row.stats_json))
          setStats(loadStats())
        }
      }),

      // ② quests 테이블에서 완료된 퀘스트 ID 가져오기
      fetchCompletedQuestIds().then(ids => {
        if (!ids.length) return
        localStorage.setItem(COMPLETED_KEY, JSON.stringify(ids))
        setCompletedQuests(ids)
      }),

      // ③ journals 테이블에서 일지 전체 가져오기
      fetchAllJournals().then(rows => {
        if (!rows.length) return
        type JEntry = { date: string; content: string; blocks: unknown[] }
        const store: Record<string, JEntry> = {}
        rows.forEach(r => { store[r.date] = { date: r.date, content: r.content, blocks: r.blocks } })
        localStorage.setItem(JOURNAL_KEY, JSON.stringify(store))
      }),

      // ④ 사용자 직접 생성 퀘스트
      fetchUserCreatedQuests().then(rows => {
        if (!rows.length) return
        const cards: Card[] = rows.map(r => ({
          id:    r.quest_id,
          name:  r.title,
          sub:   CAT_OPTS.find(c => c.id === r.category)?.label ?? r.category,
          emoji: CAT_OPTS.find(c => c.id === r.category)?.emoji ?? '✅',
        }))
        setUserQuests(cards)
        saveUserQuestsLocal(cards)
      }),

      // ⑤ 나머지 데이터(worlds · saju · calendar · travel · gourmet) → app_kv
      kvGetAll().then(all => {
        const passThrough = [WORLDS_KEY, SAJU_KEY, CALENDAR_KEY, TRAVEL_KEY, GOURMET_KEY]
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
        const x = value as XpState
        localStorage.setItem(key, JSON.stringify(x))
        setXpState(x)
      } else {
        // Journal, Worlds, Saju, Calendar, Travel, Gourmet
        localStorage.setItem(key, JSON.stringify(value))
      }
    })
    return () => { channel?.unsubscribe() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Toast 트리거 ──
  function fireToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToastMsg(msg); setToastVisible(true)
    toastTimer.current = setTimeout(() => setToastVisible(false), 2200)
  }

  // ── XP 획득 ──
  function gainXp(amount: number) {
    setXpState(prev => {
      let { level, currentXp, requiredXp } = prev
      currentXp += amount
      let didLevelUp = false
      while (currentXp >= requiredXp) {
        currentXp -= requiredXp
        level++
        requiredXp = getRequiredXp(level)
        didLevelUp = true
      }
      const next: XpState = { level, currentXp, requiredXp }
      saveXp(next)
      if (didLevelUp) {
        setTimeout(() => { setLevelUpNewLv(level); setLevelUpAnim(true) }, 0)
      }
      return next
    })
  }

  // ── 퀘스트 완료 토글 ──
  function toggleComplete(id: string) {
    setCompletedQuests(prev => {
      const isDone = prev.includes(id)
      const next = isDone ? prev.filter(x => x !== id) : [...prev, id]
      localStorage.setItem(COMPLETED_KEY, JSON.stringify(next))
      kvSet(COMPLETED_KEY, next)
      upsertQuest(id, !isDone)
      if (!isDone) {
        fireToast('Quest Clear! ✓  +20 XP')
        gainXp(XP_PER_QUEST)
      }
      return next
    })
  }

  // ── 사용자 퀘스트 추가 ──
  async function addUserQuest() {
    const title = newQuestTitle.trim()
    if (!title) return
    setAddingQuest(true)
    const questId = `user_${Date.now()}`
    const catOpt  = CAT_OPTS.find(c => c.id === newQuestCat) ?? CAT_OPTS[0]
    const newCard: Card = { id: questId, name: title, sub: catOpt.label, emoji: catOpt.emoji }
    setUserQuests(prev => {
      const next = [...prev, newCard]
      saveUserQuestsLocal(next)
      return next
    })
    await insertUserQuest(questId, title, newQuestCat)
    setNewQuestTitle('')
    setAddingQuest(false)
  }

  // ── 사용자 퀘스트 삭제 ──
  function removeUserQuest(questId: string) {
    setUserQuests(prev => {
      const next = prev.filter(q => q.id !== questId)
      saveUserQuestsLocal(next)
      return next
    })
    setCompletedQuests(prev => {
      const next = prev.filter(id => id !== questId)
      localStorage.setItem(COMPLETED_KEY, JSON.stringify(next))
      return next
    })
    deleteUserQuestRow(questId)
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

  // 타이머 엔진
  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => {
        setTimerSec(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current!)
            setTimerRunning(false)
            setTimerDone(true)
            recordFocusSession(Math.round(timerTotal / 60))
            return 0
          }
          return s - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [timerRunning, timerTotal])

  // ── 타이머 분 조절 (준비됨 상태에서만) ──────────────────────────────────
  function adjustMinutes(delta: number) {
    const newMin = Math.max(1, Math.min(90, Math.round(timerTotal / 60) + delta))
    const newTotal = newMin * 60
    setTimerTotal(newTotal)
    setTimerSec(newTotal)
  }

  function handlePlayPause() {
    if (timerDone) return
    setTimerRunning(r => !r)
  }

  function handleReset() {
    setTimerRunning(false)
    setTimerSec(timerTotal)
    setTimerDone(false)
  }

  function enterZen() {
    setIsZenMode(true)
    setFocusOpen(false)
  }

  function exitZen() {
    setIsZenMode(false)
    setTimerRunning(false)
  }

  function toggleProject(id: string) {
    setSelectedProjects(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      saveSelectedProjects(next); return next
    })
  }
  function toggleQuest(id: string) {
    setSelectedQuests(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      saveSelectedQuests(next); return next
    })
  }

  const projects: Card[] = [
    { id: 'webtoon_main', name: '성인 웹툰 (메인)', sub: '주력 연재 · 마감 D-3',     emoji: '🎨' },
    { id: 'side_funding', name: '사이드 펀딩',      sub: '크라우드펀딩 준비 중',       emoji: '💰' },
    { id: 'saju_study',   name: '사주 공부',         sub: '명리학 · 일주 분석',        emoji: '🔯' },
    { id: 'diet_manage',  name: '식단 관리',         sub: '칼로리 · 영양소 트래킹',     emoji: '🥗' },
  ]
  const projectLabels = selectedProjects.map(id => projects.find(p => p.id === id)?.name ?? id)
  const questLabels   = selectedQuests.map(id => ALL_QUESTS.find(q => q.id === id)?.name ?? id)
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

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
    `}</style>
    <div style={{ backgroundColor: '#14141e', minHeight: '100vh', color: '#cbd5e1', fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* ── Toast ── */}
      <Toast msg={toastMsg} visible={toastVisible} />

      {/* ── 레벨업 연출 ── */}
      {levelUpAnim && (
        <LevelUpScreen level={levelUpNewLv} onDone={() => setLevelUpAnim(false)} />
      )}

      {/* ── 젠 모드 전체화면 ── */}
      {isZenMode && (
        <ZenView
          seconds={timerSec} totalSec={timerTotal}
          running={timerRunning} finished={timerDone}
          projectLabels={projectLabels} questLabels={questLabels}
          onPlayPause={handlePlayPause} onStop={exitZen}
        />
      )}

      {/* ── 포모도로 모달 ── */}
      {focusOpen && !isZenMode && (
        <PomodoroModal
          seconds={timerSec} totalSec={timerTotal}
          running={timerRunning} finished={timerDone}
          projectLabels={projectLabels} questLabels={questLabels}
          onPlayPause={handlePlayPause}
          onReset={handleReset}
          onAdjust={adjustMinutes}
          onClose={() => { setFocusOpen(false); handleReset() }}
          onEnterZen={enterZen}
        />
      )}

      {/* ════════════════ NAV ════════════════ */}
      <nav style={{ backgroundColor: '#1a1a26', borderBottom: '1px solid #252525', position: 'sticky', top: 0, zIndex: 100, display: isMobile ? 'none' : undefined }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '52px' }}>

          {/* 로고 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IcoPen />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: '13px', color: '#fff', lineHeight: 1 }}>창작 OS</p>
              <p style={{ margin: 0, fontSize: '9px', color: '#52525b', marginTop: '1px' }}>웹툰 작가 성장형 작업실</p>
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
          </div>

          {/* 페이지 탭 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {([
              { id: 'dashboard', label: 'Dashboard', emoji: '⚡' },
              { id: 'library',   label: 'Library',   emoji: '📚' },
              { id: 'worlds',    label: 'Worlds',    emoji: '🌐' },
              { id: 'journal',   label: 'Journal',   emoji: '📓' },
              { id: 'calendar',  label: 'Calendar',  emoji: '📅' },
              { id: 'travel',    label: 'Travel',    emoji: '✈️' },
            ] as const).map(p => (
              <button key={p.id} onClick={() => setActivePage(p.id)} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 16px', borderRadius: '8px', cursor: 'pointer', border: 'none',
                fontSize: '13px', fontWeight: activePage === p.id ? 700 : 500,
                color: activePage === p.id ? '#fff' : '#6b7280',
                backgroundColor: activePage === p.id ? 'rgba(99,102,241,0.18)' : 'transparent',
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
            <p style={{ margin: 0, fontSize: '11px', color: '#52525b' }}>{today}</p>
            {timerRunning && (
              <button onClick={() => setIsZenMode(true)} style={{
                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700,
                color: '#a5b4fc', backgroundColor: 'rgba(99,102,241,0.1)',
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
      {activePage === 'calendar' && <CalendarPage />}
      {activePage === 'travel'   && <TravelPage />}
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
        />
      )}
      {activePage === 'dashboard' && <div style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '16px 14px 24px' : '36px 48px' }}>

        {/* Stats — 클릭 편집 가능 */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: isMobile ? '10px' : '18px', marginBottom: '16px' }}>
          {stats.map(s => (
            <StatCard key={s.id} stat={s} onUpdate={updateStat} />
          ))}
        </div>

        {/* XP 게이지 바 */}
        <XpBar
          level={xpState.level} currentXp={xpState.currentXp} requiredXp={xpState.requiredXp}
          doneCount={completedQuests.filter(id => [...ALL_QUESTS, ...userQuests].some(q => q.id === id)).length}
          totalCount={ALL_QUESTS.length + userQuests.length}
        />

        {/* 갑술(甲戌) 오늘의 기운 */}
        <div style={{
          backgroundColor: '#16162a', border: '1px solid rgba(251,191,36,0.18)',
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

        {/* 2열 그리드: 프로젝트 + 퀘스트 */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div style={{ backgroundColor: '#1e1e2e', borderRadius: '20px', padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#fff' }}>
                <span style={{ color: '#6366f1', marginRight: '8px' }}>1.</span>현재 진행 프로젝트
              </h2>
              {selectedProjects.length > 0 && (
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', padding: '3px 10px', borderRadius: '999px' }}>
                  {selectedProjects.length}개 선택
                </span>
              )}
            </div>
            <p style={{ margin: 0, marginBottom: '20px', fontSize: '12px', color: '#6b7280' }}>오늘 집중할 프로젝트 선택 (복수 가능)</p>
            <MultiSelectGrid items={projects} selected={selectedProjects} onToggle={toggleProject} />
          </div>

          <div style={{ backgroundColor: '#1e1e2e', borderRadius: '20px', padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#fff' }}>
                <span style={{ color: '#6366f1', marginRight: '8px' }}>2.</span>오늘의 핵심 퀘스트
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {selectedQuests.length > 0 && (
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', padding: '3px 10px', borderRadius: '999px' }}>
                    {selectedQuests.length}개 선택
                  </span>
                )}
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#34d399', backgroundColor: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', padding: '3px 10px', borderRadius: '999px' }}>
                  {completedQuests.filter(id => [...ALL_QUESTS, ...userQuests].some(q => q.id === id)).length} / {ALL_QUESTS.length + userQuests.length} 완료
                </span>
              </div>
            </div>

            {/* 전체 퀘스트 프로그레스 바 */}
            {(() => {
              const allQ = [...ALL_QUESTS, ...userQuests]
              const doneCount = completedQuests.filter(id => allQ.some(q => q.id === id)).length
              const pct = allQ.length > 0 ? (doneCount / allQ.length) * 100 : 0
              return (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ height: '4px', backgroundColor: '#252535', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`, borderRadius: '999px',
                      background: pct >= 100
                        ? 'linear-gradient(90deg,#34d399,#10b981)'
                        : 'linear-gradient(90deg,#6366f1,#a78bfa)',
                      transition: 'width 0.5s ease, background 0.4s',
                      boxShadow: pct >= 100 ? '0 0 8px rgba(52,211,153,0.5)' : '0 0 8px rgba(99,102,241,0.4)',
                    }} />
                  </div>
                  {pct >= 100 && (
                    <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#34d399', textAlign: 'center', fontWeight: 700 }}>
                      🎉 오늘의 모든 퀘스트 완료!
                    </p>
                  )}
                </div>
              )
            })()}

            <p style={{ margin: 0, marginBottom: '14px', fontSize: '12px', color: '#6b7280' }}>
              ○ 완료 클릭 → +20 XP 획득 · 카드 클릭 → 몰입 세션 포함
            </p>

            {/* 카테고리별 퀘스트 */}
            {QUEST_CATEGORIES.map(cat => {
              const catDone = completedQuests.filter(id => cat.quests.some(q => q.id === id)).length
              return (
                <div key={cat.id} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: cat.col, boxShadow: `0 0 6px ${cat.col}`, flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', fontWeight: 800, color: cat.col, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {cat.label}
                    </span>
                    <span style={{ fontSize: '10px', color: '#52525b' }}>
                      {catDone} / {cat.quests.length} 완료
                    </span>
                  </div>
                  <QuestGrid
                    items={cat.quests}
                    selected={selectedQuests}
                    completed={completedQuests}
                    onToggle={toggleQuest}
                    onComplete={toggleComplete}
                  />
                </div>
              )
            })}

            {/* ── 사용자 추가 퀘스트 섹션 ─────────────────────────────── */}
            {userQuests.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#a78bfa', boxShadow: '0 0 6px #a78bfa', flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#a78bfa', letterSpacing: '0.08em', textTransform: 'uppercase' }}>내 퀘스트</span>
                  <span style={{ fontSize: '10px', color: '#52525b' }}>
                    {completedQuests.filter(id => userQuests.some(q => q.id === id)).length} / {userQuests.length} 완료
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '10px' }}>
                  {userQuests.map(item => {
                    const isDone = completedQuests.includes(item.id)
                    return (
                      <div key={item.id} style={{ position: 'relative', opacity: isDone ? 0.45 : 1, transition: 'opacity 0.3s' }}>
                        <button
                          onClick={() => !isDone && toggleQuest(item.id)}
                          style={{
                            width: '100%', textAlign: 'left',
                            padding: '13px 14px 13px 46px',
                            borderRadius: '14px', cursor: isDone ? 'default' : 'pointer',
                            border: `2px solid ${selectedQuests.includes(item.id) ? '#6366f1' : isDone ? 'rgba(99,102,241,0.3)' : 'transparent'}`,
                            backgroundColor: isDone ? 'rgba(99,102,241,0.08)' : '#252535',
                            transition: 'all 0.2s',
                          }}
                        >
                          <div style={{ fontSize: '13px', fontWeight: 700, color: isDone ? '#6b7280' : '#e2e8f0', textDecoration: isDone ? 'line-through' : 'none' }}>
                            {item.emoji} {item.name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#52525b', marginTop: '2px' }}>{item.sub}</div>
                        </button>
                        {/* 완료 체크 버튼 */}
                        <button
                          onClick={e => { e.stopPropagation(); toggleComplete(item.id) }}
                          title={isDone ? '완료 취소' : '완료 처리'}
                          style={{
                            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                            width: '22px', height: '22px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            backgroundColor: isDone ? '#6366f1' : 'rgba(99,102,241,0.15)',
                            color: isDone ? '#fff' : '#6366f1',
                            transition: 'all 0.2s',
                          }}
                        >
                          <IcoCheck />
                        </button>
                        {/* 삭제 버튼 */}
                        <button
                          onClick={e => { e.stopPropagation(); removeUserQuest(item.id) }}
                          title="퀘스트 삭제"
                          style={{
                            position: 'absolute', right: '8px', top: '8px',
                            width: '18px', height: '18px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171',
                            fontSize: '10px', fontWeight: 900, lineHeight: 1,
                            opacity: 0.7, transition: 'opacity 0.2s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── 새 퀘스트 추가 폼 ────────────────────────────────────── */}
            <div style={{ marginTop: '20px', padding: '18px', backgroundColor: '#13131f', borderRadius: '16px', border: '1px dashed rgba(99,102,241,0.3)' }}>
              <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 700, color: '#6366f1', letterSpacing: '0.06em' }}>＋ 새 퀘스트 추가</p>

              {/* 카테고리 선택 */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                {CAT_OPTS.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setNewQuestCat(cat.id)}
                    style={{
                      padding: '5px 12px', borderRadius: '999px', border: 'none', cursor: 'pointer',
                      fontSize: '11px', fontWeight: 700,
                      backgroundColor: newQuestCat === cat.id ? cat.col : 'rgba(255,255,255,0.05)',
                      color: newQuestCat === cat.id ? '#0f0f1a' : '#71717a',
                      transition: 'all 0.18s',
                    }}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>

              {/* 제목 입력 + 추가 버튼 */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={newQuestTitle}
                  onChange={e => setNewQuestTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addUserQuest() }}
                  placeholder="퀘스트 제목 입력 (예: 마감 치기, 운동하기)"
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: '10px',
                    backgroundColor: '#1e1e2e', border: '1px solid #303050',
                    color: '#e2e8f0', fontSize: '13px', outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#6366f1')}
                  onBlur={e  => (e.target.style.borderColor = '#303050')}
                />
                <button
                  onClick={addUserQuest}
                  disabled={addingQuest || !newQuestTitle.trim()}
                  style={{
                    padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    backgroundColor: addingQuest || !newQuestTitle.trim() ? '#2a2a3a' : '#6366f1',
                    color: addingQuest || !newQuestTitle.trim() ? '#52525b' : '#fff',
                    fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    boxShadow: addingQuest || !newQuestTitle.trim() ? 'none' : '0 0 16px rgba(99,102,241,0.35)',
                  }}
                >
                  {addingQuest ? '저장 중…' : '추가'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 체크리스트 */}
        <div style={{ backgroundColor: '#1e1e2e', borderRadius: '20px', padding: '30px', marginBottom: '30px' }}>
          <h2 style={{ margin: 0, marginBottom: '8px', fontSize: '16px', fontWeight: 800, color: '#fff' }}>
            <span style={{ color: '#6366f1', marginRight: '8px' }}>3.</span>오늘의 퀘스트 체크
          </h2>
          <p style={{ margin: 0, marginBottom: '20px', fontSize: '12px', color: '#6b7280' }}>완료 항목을 확인하세요</p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '0' : '0 48px' }}>
            <QuestItem num={1} done title="저널 · 오늘의 영감 기록" desc="드림 로그 + 레퍼런스 이미지 3장 완료" />
            <QuestItem num={3} title="건강 · 유산소 30분" desc="식사 후 걷기 또는 달리기 기록" />
            <QuestItem num={2} title="원고 · 3화 콘티 완성" desc="주인공 내면 갈등 씬 포함 총 32컷 목표" />
            <QuestItem num={4} title="사주 · 일주 분석 메모" desc="오늘의 천간·지지 운세 정리" />
          </div>
        </div>

        {/* Focus CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', paddingBottom: '48px' }}>
          {selectedProjects.length === 0 && selectedQuests.length === 0 && (
            <p style={{ margin: 0, fontSize: '12px', color: '#3f3f46' }}>
              ↑ 프로젝트와 퀘스트를 선택하면 집중 세션이 활성화됩니다
            </p>
          )}
          <button
            onClick={() => { setFocusOpen(true); handleReset() }}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '17px 52px', borderRadius: '16px', border: 'none',
              background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
              color: '#fff', fontSize: '15px', fontWeight: 800, letterSpacing: '0.03em', cursor: 'pointer',
              boxShadow: '0 8px 48px rgba(99,102,241,0.38)',
              transition: 'transform 0.15s,box-shadow 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 14px 60px rgba(99,102,241,0.54)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 48px rgba(99,102,241,0.38)' }}
          >
            <IcoFocus />
            몰입 시작 (Focus Mode)
          </button>
          <p style={{ margin: 0, fontSize: '11px', color: '#3f3f46' }}>
            ▶ 재생 버튼 누르면 자동으로 젠 모드 진입 · ESC로 복귀
          </p>
        </div>

      </div>}
      </div>{/* end body wrapper */}
    </div>
    </>
  )
}
