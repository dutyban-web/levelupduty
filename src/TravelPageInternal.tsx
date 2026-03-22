import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useIsMobile } from './hooks/useIsMobile'
import { kvSet, kvGet, isSupabaseReady } from './lib/supabase'
import { subscribeAppSyncStatus } from './syncIndicatorBus'
import {
  fetchTravelEvents, insertTravelEvent, updateTravelEvent, deleteTravelEvent, type TravelTripRow,
  uploadImageToMedia,
} from './supabase'
import {
  Plus, X, ChevronRight, ChevronLeft, ChevronUp, ChevronDown,
  Utensils, Apple, Heart, Pencil, Trash2, Image, File, FileText, FileSpreadsheet, Presentation,
  Archive, CalendarRange, Move, Settings, GripVertical,
  type LucideIcon,
} from 'lucide-react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ═══════════════════════════════════════ TRAVEL ══════════════════════════════
const TRAVEL_KEY = 'creative_os_travel_v1'
const TRAVEL_TRIP_ORDER_KEY = 'creative_os_travel_trip_order_v1'

const COUNTRY_OPTIONS: { code: string; name: string; flag: string }[] = [
  { code: 'KR', name: '한국', flag: '🇰🇷' },
  { code: 'JP', name: '일본', flag: '🇯🇵' },
  { code: 'US', name: '미국', flag: '🇺🇸' },
  { code: 'CN', name: '중국', flag: '🇨🇳' },
  { code: 'TH', name: '태국', flag: '🇹🇭' },
  { code: 'VN', name: '베트남', flag: '🇻🇳' },
  { code: 'TW', name: '대만', flag: '🇹🇼' },
  { code: 'SG', name: '싱가포르', flag: '🇸🇬' },
  { code: 'MY', name: '말레이시아', flag: '🇲🇾' },
  { code: 'GB', name: '영국', flag: '🇬🇧' },
  { code: 'FR', name: '프랑스', flag: '🇫🇷' },
  { code: 'IT', name: '이탈리아', flag: '🇮🇹' },
  { code: 'ES', name: '스페인', flag: '🇪🇸' },
  { code: 'AU', name: '호주', flag: '🇦🇺' },
  { code: 'ETC', name: '기타', flag: '🌍' },
]

type TravelTrip = TravelTripRow

/** 국내/국외 구분: isDomestic 우선, 없으면 countryFlag 🇰🇷 또는 제목에 한국 도시명 포함 시 국내 */
function isDomesticTrip(trip: TravelTrip): boolean {
  if (typeof trip.isDomestic === 'boolean') return trip.isDomestic
  if (trip.countryFlag === '🇰🇷') return true
  const domesticKeywords = ['부산', '서울', '제주', '강릉', '대구', '인천', '광주', '대전', '수원', '춘천', '전주', '여수']
  return domesticKeywords.some(k => trip.title?.includes(k))
}

/**
 * 카드에 표시할 국기. 예전 잘못된 기본값 🗾(일본 지도 문자)는 사용하지 않음.
 * 저장값 없을 때: 국내면 🇰🇷, 아니면 🌍(기타).
 */
function resolvedCountryFlag(trip: TravelTrip): string {
  const f = trip.countryFlag
  if (f && f !== '🗾') return f
  if (f === '🗾') return isDomesticTrip(trip) ? '🇰🇷' : '🌍'
  return isDomesticTrip(trip) ? '🇰🇷' : '🌍'
}

function countryCodeForSelect(trip: TravelTrip): string {
  const flag = resolvedCountryFlag(trip)
  return COUNTRY_OPTIONS.find(c => c.flag === flag)?.code ?? 'ETC'
}

/** 여행 카드 제목 + 기간. vertical: 목록 카드 중단 히어로 영역(국가는 상단 셀렉트에서만 변경) */
function TravelTripTitleRow({
  trip,
  onSaveTitle,
  isEditing,
  onCloseEdit,
  compact,
  variant = 'default',
  ddayText,
}: {
  trip: TravelTrip
  onSaveTitle: (title: string) => void
  isEditing: boolean
  onCloseEdit: () => void
  compact?: boolean
  variant?: 'default' | 'vertical'
  /** vertical 전용: 기간 줄 오른쪽 끝에 D-Day 등 표시 */
  ddayText?: string
}) {
  const [draft, setDraft] = useState(trip.title)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    setDraft(trip.title)
  }, [trip.id, trip.title])
  useEffect(() => {
    if (isEditing) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 0)
      return () => window.clearTimeout(t)
    }
  }, [isEditing])

  const flag = resolvedCountryFlag(trip)
  const fs = compact ? 16 : 20
  const titleFs = variant === 'vertical' ? 22 : (compact ? 15 : 20)

  function commit() {
    const t = draft.trim()
    if (t && t !== trip.title) onSaveTitle(t)
    else setDraft(trip.title)
    onCloseEdit()
  }

  const stopCard = (e: React.SyntheticEvent) => {
    e.stopPropagation()
  }

  if (variant === 'vertical') {
    return (
      <div style={{ width: '100%', minWidth: 0, position: 'relative', zIndex: 2 }}>
        {isEditing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onPointerDown={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') {
                setDraft(trip.title)
                onCloseEdit()
              }
            }}
            style={{
              width: '100%',
              minWidth: 0,
              fontSize: titleFs,
              fontWeight: 800,
              color: '#37352F',
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid #6366f1',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              lineHeight: 1.35,
            }}
          />
        ) : (
          <h3
            style={{
              margin: 0,
              fontSize: titleFs,
              fontWeight: 800,
              color: '#111827',
              width: '100%',
              lineHeight: 1.35,
              wordBreak: 'break-word',
              whiteSpace: 'normal',
            }}
          >
            {trip.title}
          </h3>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            marginTop: 8,
            width: '100%',
            minWidth: 0,
          }}
        >
          <span style={{ fontSize: 12, color: '#787774', fontWeight: 500, lineHeight: 1.45, minWidth: 0, flex: 1 }}>
            {fmtTripDateRange(trip.startDate, trip.endDate)}
          </span>
          {ddayText != null && ddayText !== '' && (
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', lineHeight: 1.45, flexShrink: 0, textAlign: 'right' }}>
              {ddayText}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', minWidth: 0, position: 'relative', zIndex: 2 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          minWidth: 0,
          width: '100%',
        }}
      >
        <span style={{ fontSize: fs, lineHeight: 1.35, flexShrink: 0, paddingTop: 2 }} title="국가는 위 드롭다운에서 변경">{flag}</span>
        {isEditing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onMouseDown={stopCard}
            onClick={stopCard}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') {
                setDraft(trip.title)
                onCloseEdit()
              }
            }}
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: compact ? 15 : 20,
              fontWeight: 800,
              color: '#37352F',
              padding: '4px 8px',
              borderRadius: 8,
              border: '1px solid #6366f1',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <p
            style={{
              margin: 0,
              fontSize: compact ? 15 : 20,
              fontWeight: 800,
              color: '#37352F',
              flex: 1,
              minWidth: 0,
              lineHeight: 1.35,
              wordBreak: 'break-word',
              whiteSpace: 'normal',
            }}
          >
            {trip.title}
          </p>
        )}
      </div>
      <div style={{ marginTop: 8, width: '100%' }}>
        <span style={{ fontSize: 11, color: '#787774', fontWeight: 500, lineHeight: 1.45 }}>
          {fmtTripDateRange(trip.startDate, trip.endDate)}
        </span>
      </div>
    </div>
  )
}

const TRIP_COLORS = ['#f97316', '#6366f1', '#34d399', '#f472b6', '#fbbf24', '#60a5fa', '#7C3AED']

function loadManualOrderIds(tripIds: string[]): string[] {
  try {
    const raw = localStorage.getItem(TRAVEL_TRIP_ORDER_KEY)
    if (!raw) return tripIds
    const saved = JSON.parse(raw) as string[]
    const idSet = new Set(tripIds)
    const valid = saved.filter(id => idSet.has(id))
    const newIds = tripIds.filter(id => !valid.includes(id))
    return [...valid, ...newIds]
  } catch { return tripIds }
}
function saveManualOrderIds(ids: string[]) {
  localStorage.setItem(TRAVEL_TRIP_ORDER_KEY, JSON.stringify(ids))
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

/** 천 단위 콤마 포맷 (예: 1,250,000) */
function formatAmount(n: number): string {
  return n.toLocaleString('ko-KR')
}

/** 대시보드 헤더 요약: 여행 총점(게이지) · D-Day · 가계부 총액 */
function HeaderSummary({ totalScore, expenseTotal, ddayText }: { totalScore?: number; expenseTotal: number; ddayText: string }) {
  const score = typeof totalScore === 'number' ? totalScore : 0
  const pct = Math.min(100, Math.max(0, score))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, alignSelf: 'stretch', minWidth: 90 }}>
      {/* 여행 총점: 2026년 아래, D-38 위 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, width: '100%' }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF', textShadow: '0 1px 4px rgba(0,0,0,0.3)', textAlign: 'right' }}>
          {score} / 100
        </span>
        <div style={{ width: '100%', height: 5, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: '#8B5CF6', transition: 'width 0.3s ease' }} />
        </div>
      </div>
      <span style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF', textShadow: '0 1px 8px rgba(0,0,0,0.3)', textAlign: 'right' }}>
        {ddayText}
      </span>
      <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.95)', textShadow: '0 1px 4px rgba(0,0,0,0.3)', textAlign: 'right' }}>
        {formatAmount(expenseTotal)}원
      </span>
    </div>
  )
}

type PackItem = { id: string; label: string; checked: boolean }
type PackCategory = { id: string; label: string; emoji: string; items: PackItem[] }
type TravelStore = { packing: PackCategory[]; spotMemos: Record<string, string> }

const DEFAULT_PACKING: PackCategory[] = [
  {
    id: 'essential', label: '필수', emoji: '🛂', items: [
      { id: 'passport', label: '여권', checked: false },
      { id: 'flight', label: '비행기 표', checked: false },
      { id: 'hotel', label: '호텔 예약 확인서', checked: false },
      { id: 'yen', label: '엔화 환전', checked: false },
      { id: 'esim', label: 'eSIM', checked: false },
    ]
  },
  {
    id: 'creative', label: '창작 도구', emoji: '🎨', items: [
      { id: 'ipad', label: '아이패드 / 태블릿', checked: false },
      { id: 'charger', label: '충전기', checked: false },
      { id: 'battery', label: '보조배터리', checked: false },
      { id: 'notebook', label: '영감 기록용 수첩', checked: false },
    ]
  },
  {
    id: 'daily', label: '생활', emoji: '🧴', items: [
      { id: 'meds', label: '상비약 (다이어트 보조제 포함)', checked: false },
      { id: 'shoes', label: '편한 신발', checked: false },
      { id: 'toiletry', label: '세면도구', checked: false },
    ]
  },
]

const DEFAULT_TRAVEL_SPOTS = [
  { id: 'osaka_castle', name: '오사카성', emoji: '🏯', tag: '역사적 영감 & 풍경 촬영', desc: '도요토미 히데요시의 천하통일 성채. 거대한 돌벽과 황금 지붕이 만드는 압도적 스케일 — 웹툰 배경 레퍼런스로 반드시 촬영.' },
  { id: 'tezuka_museum', name: '테즈카 오사무 만화 박물관', emoji: '✒️', tag: '만화의 신께 바치는 순례', desc: '아톰, 블랙잭의 아버지 테즈카 오사무가 남긴 창작의 유산. 작화와 스토리텔링의 근원을 직접 느끼는 창작 성지.' },
  { id: 'kyoto_day', name: '교토 당일치기', emoji: '⛩️', tag: '전통미 & 정적인 충전', desc: '후시미이나리의 붉은 도리이, 아라시야마 대나무 숲. 한국 웹툰에서 보기 드문 동양 판타지 세계관을 흡수하는 감성 코스.' },
]

// ── 여행별 상세 데이터 (커스텀 가능) ──
type TravelSpot = { id: string; name: string; emoji: string; tag: string; desc: string }
type ScheduleItem = { id: string; date: string; title: string; note: string; time?: string }
type PhotoItem = { id: string; url: string; caption?: string }
/** PDF·기타 여행 관련 파일 (티켓, 예약증 등) */
type TripDocumentItem = { id: string; url: string; name: string }
type ItineraryStep = { id: string; title?: string; imageUrl?: string; note?: string }
type ExpenseCategory = { id: string; label: string; emoji: string; sort_order: number }
type RetroRatingItem = { id: string; label: string; emoji: string; sort_order: number }
type RetroTextQuestion = { id: string; label: string; placeholder?: string; sort_order: number }
type RetrospectiveTemplates = { ratingItems: RetroRatingItem[]; textQuestions: RetroTextQuestion[] }

type TravelExpense = { id: string; date: string; category: string; usage: string; amount: number }
type TravelReview = { ratings: Record<string, number>; textAnswers: Record<string, string>; totalScore?: number }
type TripDetailData = {
  packing: PackCategory[]
  spots: TravelSpot[]
  spotMemos: Record<string, string>
  schedule: ScheduleItem[]
  /** 여행 일정과 사진 사이 — PDF 등 문서 */
  documents: TripDocumentItem[]
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
  const isBusan = trip?.title?.includes('부산')
  const base: TripDetailData = {
    packing: DEFAULT_PACKING.map(cat => ({ ...cat, items: cat.items.map(i => ({ ...i, checked: false })) })),
    spots: isOsaka ? [...DEFAULT_TRAVEL_SPOTS] : [],
    spotMemos: {},
    schedule: [],
    documents: [],
    photos: [],
    itinerarySteps: DEFAULT_ITINERARY_STEPS,
    tips: isOsaka ? [
      { icon: '🚇', text: 'IC 카드(ICOCA) 첫날 바로 구매 → 지하철·버스 올인원 교통' },
      { icon: '🍜', text: '도톤보리 타코야키 & 라멘 → 창작 에너지 보충 필수' },
      { icon: '📸', text: '오사카성 & 만화박물관 → 웹툰 배경 레퍼런스 대량 촬영' },
      { icon: '🕐', text: '교토 당일치기 → 아침 일찍 출발해 후시미이나리 인파 피하기' },
    ] : [],
  }
  if (isBusan) {
    return {
      ...base,
      expenses: [{ id: 'ex_busan', date: '2025-01-15', category: 'other', usage: '예시', amount: 850000 }],
      review: { ratings: {}, textAnswers: {}, totalScore: 92 },
    }
  }
  return base
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
      documents: saved.documents ?? [],
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
  if (o.ratings && o.textAnswers && typeof o.ratings === 'object' && typeof o.textAnswers === 'object') {
    const tr = r as TravelReview
    return { ...tr, totalScore: typeof o.totalScore === 'number' ? o.totalScore : tr.totalScore }
  }
  const ratings: Record<string, number> = {}
  const textAnswers: Record<string, string> = {}
  if (typeof o.satisfaction === 'number') ratings.satisfaction = o.satisfaction
  if (typeof o.food === 'number') ratings.food = o.food
  if (typeof o.weather === 'number') ratings.weather = o.weather
  if (typeof o.bestMoment === 'string') textAnswers.bestMoment = o.bestMoment
  if (typeof o.inspiration === 'string') textAnswers.inspiration = o.inspiration
  const totalScore = typeof o.totalScore === 'number' ? o.totalScore : undefined
  if (Object.keys(ratings).length === 0 && Object.keys(textAnswers).length === 0 && totalScore == null) return null
  return { ratings, textAnswers, totalScore }
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
          const sit = scat?.items?.find(i => i.id === item.id)
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
type MealEntry = { breakfast: string; lunch: string; dinner: string; dietOk: boolean }
type GourmetStore = {
  restaurants: RestaurantItem[]
  dietMenuNotes: Record<string, string>
  meals: Record<string, MealEntry>
}

const DEFAULT_RESTAURANTS: RestaurantItem[] = [
  { id: 'ichiran', name: '이치란 라멘 (난바점)', area: '오사카 난바', type: 'cheat', note: '', visited: false },
  { id: 'takoyaki', name: '도톤보리 타코야키', area: '도톤보리', type: 'cheat', note: '', visited: false },
  { id: 'okonomiyaki', name: '오코노미야키 (기시다야)', area: '오사카', type: 'cheat', note: '', visited: false },
  { id: 'sashimi_r', name: '사시미 정식', area: '어시장 근처', type: 'diet', note: '', visited: false },
  { id: 'yudofu_r', name: '교토 유도후', area: '교토 전통 식당', type: 'diet', note: '', visited: false },
  { id: 'cvs_r', name: '편의점 샐러드 치킨', area: '패밀리마트/로손', type: 'diet', note: '', visited: false },
]

const DIET_MENUS = [
  { id: 'yakitori', cat: 'protein' as const, emoji: '🍢', name: '야키토리 (소금구이)', desc: '고단백·저지방. 소금구이 주문 시 소스 당분 없음.' },
  { id: 'sashimi_d', cat: 'protein' as const, emoji: '🐟', name: '사시미 정식', desc: '생선회+미소시루. 순수 단백질 폭격. 이자카야·어시장.' },
  { id: 'cvs_chicken', cat: 'protein' as const, emoji: '🥗', name: '편의점 샐러드 치킨', desc: '로손·패밀리마트. 100g당 ~23g 단백질.' },
  { id: 'yudofu_d', cat: 'lowcarb' as const, emoji: '🍲', name: '유도후 (교토 두부탕)', desc: '교토 전통 두부탕. 저칼로리·고단백. 담백한 정석.' },
  { id: 'konjac', cat: 'lowcarb' as const, emoji: '🍜', name: '곤약면 요리', desc: '탄수화물 제로에 가까움. 슈퍼마켓·편의점 구매 가능.' },
  { id: 'miso', cat: 'lowcarb' as const, emoji: '🍵', name: '미소시루', desc: '저탄수 국물 요리. 포만감 UP. 어느 식당에서나 가능.' },
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
    const amount = parseInt(String(form.amount).replace(/\D/g, ''), 10)
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
    totalScore: review?.totalScore,
  }))

  useEffect(() => {
    if (review) setForm({ ratings: { ...review.ratings }, textAnswers: { ...review.textAnswers }, totalScore: review.totalScore })
  }, [review])

  const handleSave = () => {
    onSave(form)
    setEditing(false)
  }

  const ratingItems = [...templates.ratingItems].sort((a, b) => a.sort_order - b.sort_order)
  const textQuestions = [...templates.textQuestions].sort((a, b) => a.sort_order - b.sort_order)

  const starSize = isCompact ? 18 : 20
  const starGap = isCompact ? 2 : 3
  const StarRating = ({ value, onChange, max = 5, emoji = '⭐' }: { value: number; onChange: (n: number) => void; max?: number; emoji?: string }) => (
    <div style={{ display: 'flex', gap: starGap, flexWrap: 'nowrap', minWidth: 0, alignItems: 'center' }}>
      {Array.from({ length: max }, (_, i) => (
        <button key={i} type="button" onClick={() => onChange(i + 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: starSize, lineHeight: 1, opacity: i < value ? 1 : 0.25, transition: 'opacity 0.2s', flexShrink: 0 }}>
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
    const hasTotalScore = typeof review.totalScore === 'number'
    const hasRatings = ratingItems.some(r => (review.ratings[r.id] ?? 0) > 0)
    const hasText = textQuestions.some(q => (review.textAnswers[q.id] ?? '').trim())
    const hasContent = hasTotalScore || hasRatings || hasText
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
              {hasTotalScore && (
                <div style={{ marginBottom: 16, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#787774', marginBottom: 4 }}>총점</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#6366f1' }}>{review.totalScore}</span>
                    <span style={{ fontSize: 14, color: '#9B9A97' }}>/ 100</span>
                  </div>
                  <div style={{ height: 8, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 4, overflow: 'hidden', marginTop: 6 }}>
                    <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, review.totalScore ?? 0))}%`, borderRadius: 4, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              )}
              {ratingItems.map(r => {
                const v = review.ratings[r.id] ?? 0
                if (v <= 0) return null
                return (
                  <div key={r.id} style={{ marginBottom: 16, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#787774', marginBottom: 4 }}>{r.label}</p>
                    <span style={{ fontSize: isCompact ? 16 : 18 }}>{r.emoji.repeat(v)}</span>
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
        <div style={{ display: 'grid', gridTemplateColumns: `minmax(72px, 1fr) repeat(${ratingItems.length}, minmax(0, 1fr))`, gap: isCompact ? 16 : 24, marginBottom: 20, minWidth: 0, alignItems: 'stretch' }}>
          {/* 총점 (만족도 별점 왼쪽) */}
          <div style={{ minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#787774', marginBottom: 8 }}>총점</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, minHeight: 28 }}>
              <input
                type="number"
                min={0}
                max={100}
                value={form.totalScore ?? ''}
                onChange={e => {
                  const v = e.target.value === '' ? undefined : Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0))
                  setForm(f => ({ ...f, totalScore: v }))
                }}
                placeholder="0"
                style={{ width: 36, border: 'none', background: 'transparent', fontSize: 18, fontWeight: 800, color: '#6366f1', outline: 'none', fontFamily: 'inherit' }}
              />
              <span style={{ fontSize: 13, color: '#9B9A97', fontWeight: 500 }}>/ 100</span>
            </div>
            <div style={{ height: 8, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, form.totalScore ?? 0))}%`, borderRadius: 4, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', transition: 'width 0.3s ease' }} />
            </div>
          </div>
          {ratingItems.map(r => (
            <div key={r.id} style={{ minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#787774', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</p>
              <div style={{ minHeight: 36, display: 'flex', alignItems: 'center' }}>
                <StarRating value={form.ratings[r.id] ?? 0} onChange={v => setForm(f => ({ ...f, ratings: { ...f.ratings, [r.id]: v } }))} emoji={r.emoji} />
              </div>
            </div>
          ))}
        </div>
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
  const [gourmet, setGourmet] = useState<GourmetStore>(() => loadGourmet())
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newRest, setNewRest] = useState<{ name: string; area: string; type: 'cheat' | 'diet' }>({ name: '', area: '', type: 'diet' })

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

  const dietOkCount = TRAVEL_DATES.filter(d => gourmet.meals[d.key]?.dietOk).length
  const proteinMenus = DIET_MENUS.filter(m => m.cat === 'protein')
  const lowcarbMenus = DIET_MENUS.filter(m => m.cat === 'lowcarb')

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

/** 탐색기 드래그 시 MIME이 비어 있는 경우 대비 */
function isLikelyImageFileForTravel(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'heic', 'avif'].includes(ext)
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
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const processImageFile = useCallback(
    async (file: File) => {
      if (!isLikelyImageFileForTravel(file)) return
      setUploading(true)
      try {
        const url = await uploadImageToMedia(file)
        onUpdate({ imageUrl: url })
      } catch (err) {
        console.error('[이미지 업로드 실패]', err)
      } finally {
        setUploading(false)
      }
    },
    [onUpdate, uploadImageToMedia],
  )

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) await processImageFile(file)
      e.target.value = ''
    },
    [processImageFile],
  )

  const handleImageDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleImageDragEnter = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault()
      setDragOver(true)
    }
  }, [])

  const handleImageDragLeave = useCallback((e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null
    if (!related || !e.currentTarget.contains(related)) setDragOver(false)
  }, [])

  const handleImageDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      const imageFile = files.find(f => isLikelyImageFileForTravel(f))
      if (imageFile) await processImageFile(imageFile)
    },
    [processImageFile],
  )

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
        role="button"
        tabIndex={0}
        title="클릭하거나 탐색기에서 사진을 끌어다 놓기"
        onClick={() => fileRef.current?.click()}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            fileRef.current?.click()
          }
        }}
        onDragEnter={handleImageDragEnter}
        onDragLeave={handleImageDragLeave}
        onDragOver={handleImageDragOver}
        onDrop={handleImageDrop}
        style={{
          flex: 1,
          minHeight: 64,
          background: step.imageUrl ? `url(${step.imageUrl}) center/cover` : 'rgba(0,0,0,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          position: 'relative',
          outline: dragOver ? '2px dashed rgba(99,102,241,0.65)' : 'none',
          outlineOffset: -2,
          boxShadow: dragOver ? 'inset 0 0 0 2px rgba(99,102,241,0.12)' : 'none',
          transition: 'outline 0.12s ease, box-shadow 0.12s ease',
        }}
      >
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
        {!step.imageUrl && (uploading ? <span style={{ fontSize: '11px', color: '#94a3b8' }}>업로드 중…</span> : <Image size={22} color="#94a3b8" />)}
        {dragOver && !uploading && (
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(99,102,241,0.12)', fontSize: 10, fontWeight: 800, color: '#4f46e5', pointerEvents: 'none' }}>
            여기에 놓기
          </span>
        )}
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
        {steps.length === 0 ? (
          <div style={{ padding: '20px 24px', borderRadius: 12, border: '1px dashed rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.04)', color: '#787774', fontSize: 13, fontWeight: 600 }}>
            방문 단계가 없습니다. 위의 &quot;단계 추가&quot;로 카드를 만들면 이미지·장소명·메모를 넣을 수 있어요.
          </div>
        ) : (
          steps.map((step, idx) => (
            <div key={step.id} style={{ scrollSnapAlign: 'start' }}>
              <ItineraryStepBox step={step} index={idx} onUpdate={p => onUpdate(step.id, p)} onRemove={() => onRemove(step.id)} uploadImageToMedia={uploadImageToMedia} />
            </div>
          ))
        )}
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

/** 파일명 확장자 → 탐색기 스타일 아이콘·배지 색 */
function getTravelDocVisual(fileName: string): { Icon: LucideIcon; iconColor: string; badge: string } {
  const ext = (fileName.split('.').pop() || '').toLowerCase()
  if (ext === 'pdf') return { Icon: FileText, iconColor: '#c62828', badge: 'PDF' }
  if (ext === 'doc' || ext === 'docx') return { Icon: FileText, iconColor: '#1565c0', badge: 'DOC' }
  if (ext === 'xls' || ext === 'xlsx') return { Icon: FileSpreadsheet, iconColor: '#2e7d32', badge: 'XLS' }
  if (ext === 'ppt' || ext === 'pptx') return { Icon: Presentation, iconColor: '#e65100', badge: 'PPT' }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { Icon: Archive, iconColor: '#f57c00', badge: ext.toUpperCase() }
  if (['txt', 'md', 'rtf', 'csv'].includes(ext)) return { Icon: FileText, iconColor: '#546e7a', badge: ext.toUpperCase() }
  if (ext === 'hwp' || ext === 'hwpx') return { Icon: FileText, iconColor: '#3949ab', badge: 'HWP' }
  return { Icon: File, iconColor: '#607d8b', badge: ext ? ext.toUpperCase().slice(0, 5) : 'FILE' }
}

/** 사진·영상·음원 제외 — 여행 문서(PDF 등)로 취급 */
function isTravelDocumentFile(file: File): boolean {
  const t = (file.type || '').toLowerCase()
  if (t.startsWith('image/') || t.startsWith('video/') || t.startsWith('audio/')) return false
  if (t) return true
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  return ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'hwp', 'hwpx', 'csv', 'md', 'zip', '7z', 'rar'].includes(ext)
}

// ── TripDocumentsSection (여행 일정 ↔ 여행 사진 사이) ─────────────────────────
function TripDocumentsSection({
  detail,
  onAdd,
  onUpdate,
  onRemove,
  inputBase,
}: {
  detail: TripDetailData
  onAdd: (url: string, name: string) => void
  onUpdate: (id: string, patch: Partial<TripDocumentItem>) => void
  onRemove: (id: string) => void
  inputBase: React.CSSProperties
}) {
  const [urlInput, setUrlInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadOne = useCallback(
    async (file: File) => {
      if (!isTravelDocumentFile(file)) return
      const url = await uploadImageToMedia(file)
      onAdd(url, file.name || '문서')
    },
    [onAdd],
  )

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setUploading(true)
      try {
        await uploadOne(file)
      } catch (err) {
        console.error('[여행 문서 업로드 실패]', err)
      } finally {
        setUploading(false)
        e.target.value = ''
      }
    },
    [uploadOne],
  )

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
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      const files = Array.from(e.dataTransfer?.files ?? []).filter(isTravelDocumentFile)
      if (files.length === 0) return
      setUploading(true)
      try {
        for (const file of files) {
          await uploadOne(file)
        }
      } catch (err) {
        console.error('[여행 문서 드롭 실패]', err)
      } finally {
        setUploading(false)
      }
    },
    [uploadOne],
  )

  const handleAddByUrl = () => {
    const url = urlInput.trim()
    if (!url) return
    const tail = url.split('/').pop()?.split('?')[0] || '문서'
    let name = tail
    try {
      name = decodeURIComponent(tail)
    } catch { /* keep */ }
    onAdd(url, name)
    setUrlInput('')
  }

  const docs = detail.documents ?? []
  const [editingDocId, setEditingDocId] = useState<string | null>(null)
  const [hoverDocId, setHoverDocId] = useState<string | null>(null)

  return (
    <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg,#14b8a6,#0d9488)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(20,184,166,0.35)' }}>
            <FileText size={18} color="#fff" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#0d9488', letterSpacing: '0.2em', textTransform: 'uppercase' }}>문서</p>
            <p style={{ margin: 0, fontSize: '19px', fontWeight: 900, color: '#37352F' }}>여행 문서</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.hwp,.hwpx,.zip,.csv,application/pdf,application/*"
            onChange={handleUpload}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px',
              border: '1px solid rgba(13,148,136,0.35)', backgroundColor: 'rgba(13,148,136,0.08)', color: '#0f766e',
              fontSize: '11px', fontWeight: 700, cursor: uploading ? 'wait' : 'pointer',
            }}
          >
            {uploading ? '업로드 중…' : '📤 문서 추가'}
          </button>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddByUrl()}
              placeholder="파일 URL 붙여넣기"
              style={{ ...inputBase, width: '200px', padding: '8px 12px' }}
            />
            <button
              type="button"
              onClick={handleAddByUrl}
              style={{
                padding: '8px 14px', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg,#14b8a6,#0d9488)', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              추가
            </button>
          </div>
        </div>
      </div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          minHeight: '120px',
          borderRadius: '4px',
          border: isDragging ? '2px dashed rgba(13,148,136,0.55)' : '1px solid rgba(0,0,0,0.08)',
          backgroundColor: isDragging ? 'rgba(13,148,136,0.08)' : '#fafafa',
          transition: 'all 0.2s',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))',
            gap: '4px 8px',
            padding: docs.length > 0 ? '12px 10px' : '0',
            alignItems: 'start',
          }}
        >
          {docs.map(doc => {
            const { Icon, iconColor, badge } = getTravelDocVisual(doc.name)
            const isHover = hoverDocId === doc.id
            const isEditing = editingDocId === doc.id
            return (
              <div
                key={doc.id}
                role="presentation"
                onMouseEnter={() => setHoverDocId(doc.id)}
                onMouseLeave={() => setHoverDocId(null)}
                style={{
                  position: 'relative',
                  borderRadius: 2,
                  border: isHover ? '1px solid #cce8ff' : '1px solid transparent',
                  background: isHover ? '#e5f3ff' : 'transparent',
                  padding: '6px 4px 8px',
                  userSelect: isEditing ? 'text' : 'none',
                }}
              >
                {!isEditing ? (
                  <div
                    role="link"
                    tabIndex={0}
                    onClick={e => {
                      if ((e.target as HTMLElement).closest('[data-doc-tool]')) return
                      window.open(doc.url, '_blank', 'noopener,noreferrer')
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        window.open(doc.url, '_blank', 'noopener,noreferrer')
                      }
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: 3,
                        paddingTop: 2,
                      }}
                    >
                      <Icon size={32} color={iconColor} strokeWidth={1.65} aria-hidden />
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          color: iconColor,
                          lineHeight: 1,
                          opacity: 0.95,
                        }}
                      >
                        {badge}
                      </span>
                    </div>
                    <p
                      title={doc.name}
                      style={{
                        margin: 0,
                        width: '100%',
                        maxWidth: '100%',
                        textAlign: 'center',
                        fontSize: 12.5,
                        fontWeight: 600,
                        lineHeight: 1.45,
                        letterSpacing: '-0.015em',
                        color: '#111827',
                        fontFamily: 'system-ui, "Segoe UI", Roboto, "Noto Sans KR", sans-serif',
                        wordBreak: 'break-word',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        padding: '2px 2px 0',
                        WebkitFontSmoothing: 'antialiased',
                      }}
                    >
                      {doc.name}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 3,
                        paddingTop: 2,
                      }}
                    >
                      <Icon size={32} color={iconColor} strokeWidth={1.65} aria-hidden />
                      <span style={{ fontSize: 9, fontWeight: 800, color: iconColor }}>{badge}</span>
                    </div>
                    <textarea
                      value={doc.name}
                      autoFocus
                      onChange={e => onUpdate(doc.id, { name: e.target.value })}
                      onClick={e => e.stopPropagation()}
                      onMouseDown={e => e.stopPropagation()}
                      onBlur={() => setEditingDocId(null)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          setEditingDocId(null)
                        }
                        if (e.key === 'Escape') setEditingDocId(null)
                      }}
                      style={{
                        ...inputBase,
                        width: '100%',
                        fontSize: 12.5,
                        fontWeight: 600,
                        lineHeight: 1.45,
                        letterSpacing: '-0.015em',
                        color: '#111827',
                        fontFamily: 'system-ui, "Segoe UI", Roboto, "Noto Sans KR", sans-serif',
                        padding: '6px 8px',
                        resize: 'none',
                        minHeight: 48,
                        maxHeight: 72,
                        textAlign: 'center',
                        border: '1px solid #99c9ff',
                        borderRadius: 2,
                        boxSizing: 'border-box',
                        WebkitFontSmoothing: 'antialiased',
                      }}
                    />
                  </div>
                )}
                {isHover && !isEditing && (
                  <>
                    <button
                      type="button"
                      data-doc-tool
                      onClick={e => {
                        e.stopPropagation()
                        setEditingDocId(doc.id)
                      }}
                      style={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        width: 22,
                        height: 22,
                        borderRadius: 2,
                        border: '1px solid rgba(0,0,0,0.12)',
                        background: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0,
                        zIndex: 3,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                      }}
                      title="이름 바꾸기"
                    >
                      <Pencil size={11} color="#374151" />
                    </button>
                    <button
                      type="button"
                      data-doc-tool
                      onClick={e => {
                        e.stopPropagation()
                        onRemove(doc.id)
                      }}
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 22,
                        height: 22,
                        borderRadius: 2,
                        border: '1px solid rgba(0,0,0,0.12)',
                        background: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0,
                        zIndex: 3,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                      }}
                      title="삭제"
                    >
                      <Trash2 size={11} color="#b91c1c" />
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
        {docs.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: 'inherit', fontSize: '13px' }}>
            {isDragging ? (
              <span style={{ color: '#0d9488', fontWeight: 600 }}>여기에 놓기</span>
            ) : (
              <span style={{ color: '#787774' }}>
                PDF·예약증 등 여행 관련 파일이 없습니다. &quot;문서 추가&quot; 또는 URL로 추가하세요.
                <br style={{ marginTop: '4px' }} />
                <span style={{ fontSize: '11px', color: '#9B9A97' }}>탐색기에서 파일을 드래그해 이 영역에 놓을 수도 있어요 (사진·영상 제외)</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── TravelPage ────────────────────────────────────────────────────────────────
export function TravelPage({ onToast }: { onToast?: (msg: string) => void }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const tripFromUrl = searchParams.get('trip')
  const [selectedTrip, setSelectedTrip] = useState<string | null>(tripFromUrl)
  useEffect(() => {
    setSelectedTrip(tripFromUrl)
  }, [tripFromUrl])
  const [activeSpot, setActiveSpot] = useState<string | null>(null)
  const [tripsBase, setTripsBase] = useState<TravelTrip[]>([])
  const prevSyncRef = useRef<string>('')

  // calendar_events (event_type='travel')에서 여행 목록 로드
  useEffect(() => {
    if (isSupabaseReady) fetchTravelEvents().then(setTripsBase)
  }, [])
  useEffect(() => {
    const unsub = subscribeAppSyncStatus(s => {
      if (s === 'synced' && prevSyncRef.current !== 'synced') {
        fetchTravelEvents().then(setTripsBase)
      }
      prevSyncRef.current = s
    })
    return unsub
  }, [])
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

  const [sortOrder, setSortOrder] = useState<'manual' | 'score' | 'expense' | 'date' | 'domestic'>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [filterYearStart, setFilterYearStart] = useState<number | ''>('')
  const [filterYearEnd, setFilterYearEnd] = useState<number | ''>('')
  const [filterDomestic, setFilterDomestic] = useState<'all' | 'domestic' | 'international'>('all')
  const [filterCompleted, setFilterCompleted] = useState<'all' | 'planned' | 'completed'>('planned')
  const [filterMinScore, setFilterMinScore] = useState<number | ''>('')
  const [filterMinAmount, setFilterMinAmount] = useState<number | ''>('')
  const [manualOrderIds, setManualOrderIds] = useState<string[]>([])
  const [manageMode, setManageMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  /** 카드 제목 인라인 편집 — 연필(우하단)과 동기화 */
  const [editingTitleTripId, setEditingTitleTripId] = useState<string | null>(null)
  /** 여행 카드/히어로 짧은 메모 (Supabase travel content.note) 편집용 */
  const [tripNoteDraft, setTripNoteDraft] = useState('')

  useEffect(() => {
    loadExpenseCategories().then(setExpenseCategories)
    loadRetrospectiveTemplates().then(setRetrospectiveTemplates)
  }, [])

  const trips = tripsBase
  const currentTrip = trips.find(t => t.id === selectedTrip)

  useEffect(() => {
    setTripNoteDraft(currentTrip?.note ?? '')
  }, [selectedTrip, currentTrip?.id, currentTrip?.note])

  // manualOrderIds 동기화 (trips 변경 시)
  useEffect(() => {
    const ids = trips.map(t => t.id)
    const next = loadManualOrderIds(ids)
    saveManualOrderIds(next)
    setManualOrderIds(next)
  }, [tripsBase])

  // 정렬 및 필터 적용된 카드 목록
  const sortedTrips = (() => {
    const s = typeof filterYearStart === 'number' ? filterYearStart : null
    const e = typeof filterYearEnd === 'number' ? filterYearEnd : null
    const [startY, endY] = s != null && e != null && s > e ? [e, s] : [s, e]
    const minScore = typeof filterMinScore === 'number' ? filterMinScore : null
    const minAmount = typeof filterMinAmount === 'number' ? filterMinAmount : null
    const filtered = trips.filter(trip => {
      const y = parseInt(trip.startDate.split('-')[0], 10)
      if (startY != null && y < startY) return false
      if (endY != null && y > endY) return false
      if (filterDomestic !== 'all') {
        const dom = isDomesticTrip(trip)
        if (filterDomestic === 'domestic' && !dom) return false
        if (filterDomestic === 'international' && dom) return false
      }
      if (filterCompleted !== 'all') {
        const dday = calcDDay(trip.startDate)
        if (filterCompleted === 'planned' && dday.isPast) return false
        if (filterCompleted === 'completed' && !dday.isPast) return false
      }
      if (minScore != null) {
        const d = loadTripDetail(trip.id, trip)
        const score = d.review?.totalScore ?? 0
        if (score < minScore) return false
      }
      if (minAmount != null) {
        const d = loadTripDetail(trip.id, trip)
        const total = (d.expenses ?? []).reduce((s, e) => s + e.amount, 0)
        if (total < minAmount) return false
      }
      return true
    })
    if (sortOrder === 'manual') {
      const orderMap = new Map(manualOrderIds.map((id, i) => [id, i]))
      return [...filtered].sort((a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999))
    }
    const withMeta = filtered.map(trip => {
      const d = loadTripDetail(trip.id, trip)
      return { trip, totalScore: d.review?.totalScore ?? 0, expenseTotal: (d.expenses ?? []).reduce((s, e) => s + e.amount, 0), isDomestic: isDomesticTrip(trip) }
    })
    const mult = sortDirection === 'desc' ? 1 : -1
    const sorted = [...withMeta].sort((a, b) => {
      if (sortOrder === 'score') return mult * (b.totalScore - a.totalScore)
      if (sortOrder === 'expense') return mult * (b.expenseTotal - a.expenseTotal)
      if (sortOrder === 'date') return mult * b.trip.startDate.localeCompare(a.trip.startDate)
      if (sortOrder === 'domestic') return mult * ((b.isDomestic ? 1 : 0) - (a.isDomestic ? 1 : 0))
      return 0
    })
    return sorted.map(x => x.trip)
  })()

  // 여행별 상세 데이터 (선택된 여행에 따라 로드)
  const [detail, setDetail] = useState<TripDetailData>(() =>
    selectedTrip ? loadTripDetail(selectedTrip, currentTrip ?? undefined) : getDefaultTripDetail('', undefined)
  )

  useEffect(() => {
    if (selectedTrip && currentTrip) {
      setDetail(loadTripDetail(selectedTrip, currentTrip))
    }
  }, [selectedTrip, currentTrip?.id])

  async function handleAddTrip(trip: TravelTrip) {
    const row = await insertTravelEvent({ title: trip.title, startDate: trip.startDate, endDate: trip.endDate, color: trip.color, note: trip.note, countryFlag: trip.countryFlag, isDomestic: trip.isDomestic })
    if (!row) { onToast?.('여행 추가 실패 (Supabase 연결 확인)'); return }
    setTripsBase(prev => [...prev, row])
    setManualOrderIds(prev => { const next = [...prev, row.id]; saveManualOrderIds(next); return next })
  }

  async function updateTrip(tripId: string, patch: Partial<TravelTrip>) {
    const p = { ...patch }
    if (patch.countryFlag !== undefined) {
      p.isDomestic = patch.countryFlag === '🇰🇷'
    }
    const row = await updateTravelEvent(tripId, p)
    if (row) setTripsBase(prev => prev.map(t => t.id === tripId ? row : t))
    else onToast?.('저장에 실패했습니다. Supabase 연결을 확인해 주세요.')
  }

  async function handleRemoveSelected() {
    const idsToRemove = [...selectedIds]
    for (const tripId of idsToRemove) await deleteTravelEvent(tripId)
    setTripsBase(prev => prev.filter(t => !selectedIds.has(t.id)))
    setManualOrderIds(prev => { const next = prev.filter(id => !selectedIds.has(id)); saveManualOrderIds(next); return next })
    if (selectedIds.has(selectedTrip ?? '')) setSelectedTrip(null)
    setSelectedIds(new Set())
    setManageMode(false)
    setDeleteConfirmOpen(false)
  }

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = manualOrderIds.indexOf(active.id as string)
    const newIdx = manualOrderIds.indexOf(over.id as string)
    if (oldIdx === -1 || newIdx === -1) return
    const next = arrayMove(manualOrderIds, oldIdx, newIdx)
    setManualOrderIds(next)
    saveManualOrderIds(next)
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

  const allItems = detail.packing.flatMap(c => c.items)
  const checkedCount = allItems.filter(i => i.checked).length
  const totalCount = allItems.length
  const pct = totalCount > 0 ? Math.round(checkedCount / totalCount * 100) : 0

  const ddayResult = currentTrip ? calcDDay(currentTrip.startDate) : { text: '-', isPast: false }

  const saveTripNoteFromDraft = useCallback(() => {
    if (!selectedTrip || !currentTrip) return
    const next = tripNoteDraft.trim()
    if (next === (currentTrip.note ?? '').trim()) return
    void updateTrip(selectedTrip, { note: next })
  }, [selectedTrip, currentTrip, tripNoteDraft, updateTrip])

  const clearTripCardNote = useCallback(() => {
    if (!selectedTrip) return
    if (!tripNoteDraft.trim() && !(currentTrip?.note ?? '').trim()) return
    if (!window.confirm('카드에 표시되는 짧은 메모를 삭제할까요?')) return
    setTripNoteDraft('')
    void updateTrip(selectedTrip, { note: '' })
  }, [selectedTrip, currentTrip?.note, tripNoteDraft])

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

  const documents = detail.documents ?? []
  function addDocument(url: string, name: string) {
    persist({
      ...detail,
      documents: [...documents, { id: `doc_${Date.now()}`, url, name: name.trim() || '문서' }],
    })
  }
  function updateDocument(id: string, patch: Partial<TripDocumentItem>) {
    persist({
      ...detail,
      documents: documents.map(d => d.id === id ? { ...d, ...patch } : d),
    })
  }
  function removeDocument(id: string) {
    persist({ ...detail, documents: documents.filter(d => d.id !== id) })
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

  /** 목록 카드: 상단(국가·연도) / 중단(제목) / 하단(메타·연필) — Link 없이 본문만 */
  function TravelTripListCardContent({
    trip,
    year,
    dday,
    totalScore,
    expenseTotal,
    onCountryChange,
    onSaveTitle,
    onClearTripNote,
  }: {
    trip: TravelTrip
    year: string
    dday: { text: string; isPast: boolean }
    totalScore: number
    expenseTotal: number
    onCountryChange: (flag: string) => void
    onSaveTitle: (title: string) => void
    /** 카드에 보이는 짧은 메모(trip.note) 삭제 */
    onClearTripNote?: () => void
  }) {
    const pct = Math.min(100, Math.max(0, totalScore))
    return (
      <>
        {/* Top: 국가 셀렉트 + 연도 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.06em',
                padding: '3px 8px',
                borderRadius: 6,
                flexShrink: 0,
                ...(isDomesticTrip(trip) ? { color: '#16a34a', backgroundColor: '#f0fdf4' } : { color: '#2563eb', backgroundColor: '#eff6ff' }),
              }}
            >
              {isDomesticTrip(trip) ? '국내' : '국외'}
            </span>
            <div
              data-trip-select-wrap
              role="presentation"
              onPointerDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
              style={{ position: 'relative', zIndex: 5, flex: 1, minWidth: 0, maxWidth: 196 }}
            >
              {/* preventDefault는 네이티브 드롭다운을 막을 수 있어 버블링만 차단 (카드 이동은 handleTripCardNavigate의 closest('select')로 차단) */}
              <select
                value={countryCodeForSelect(trip)}
                onPointerDown={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
                onChange={e => {
                  e.stopPropagation()
                  const o = COUNTRY_OPTIONS.find(c => c.code === e.target.value)
                  if (o) onCountryChange(o.flag)
                }}
                style={{
                  width: '100%',
                  padding: '5px 7px',
                  borderRadius: 6,
                  border: '1px solid rgba(0,0,0,0.14)',
                  background: '#fff',
                  fontSize: 9,
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: 'none',
                  boxSizing: 'border-box',
                  lineHeight: 1.35,
                }}
              >
                {COUNTRY_OPTIONS.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
              </select>
            </div>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b', letterSpacing: '0.02em', flexShrink: 0 }}>{year}년</span>
        </div>

        {/* Middle: 제목 히어로 */}
        <div style={{ marginTop: 16, width: '100%' }}>
          <TravelTripTitleRow
            trip={trip}
            onSaveTitle={onSaveTitle}
            isEditing={editingTitleTripId === trip.id}
            onCloseEdit={() => setEditingTitleTripId(null)}
            variant="vertical"
            ddayText={dday.text}
          />
        </div>
        {trip.note && (
          <div style={{ margin: '10px 0 0', display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
            <p style={{ margin: 0, fontSize: 11, color: '#9B9A97', lineHeight: 1.5, flex: 1, minWidth: 0 }}>{trip.note}</p>
            {onClearTripNote && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  e.preventDefault()
                  onClearTripNote()
                }}
                title="메모 삭제"
                style={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: '1px solid rgba(239,68,68,0.25)',
                  background: 'rgba(239,68,68,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={11} color="#ef4444" />
              </button>
            )}
          </div>
        )}

        {/* Bottom: 부가정보 + 연필 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginTop: 16,
            gap: 12,
            width: '100%',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 10,
              rowGap: 8,
              flex: 1,
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{totalScore} / 100</span>
            <div style={{ width: 64, height: 4, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 999, overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: '#8B5CF6', transition: 'width 0.3s ease' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{formatAmount(expenseTotal)}원</span>
          </div>
          {editingTitleTripId !== trip.id && (
            <button
              type="button"
              data-trip-edit="title"
              title="제목 수정"
              onPointerDown={e => { e.stopPropagation(); e.preventDefault() }}
              onClick={e => {
                e.stopPropagation()
                e.preventDefault()
                setEditingTitleTripId(trip.id)
              }}
              style={{
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                borderRadius: 7,
                border: '1px solid rgba(0,0,0,0.08)',
                background: '#fafafa',
                cursor: 'pointer',
                color: '#9ca3af',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
              }}
            >
              <Pencil size={11} strokeWidth={2.25} />
            </button>
          )}
        </div>
      </>
    )
  }

  function handleTripCardNavigate(e: React.MouseEvent, tripId: string) {
    if (manageMode) return
    if ((e.target as Element).closest('select, button, input, [data-drag-handle], [data-trip-select-wrap]')) return
    navigate(`/travel?trip=${tripId}`)
  }

  function SortableTripCard({ trip, dday, totalScore, expenseTotal, year, manageMode, selectedIds, onToggleSelect, onUpdateCountry, onUpdateTitle }: {
    trip: TravelTrip
    dday: { text: string; isPast: boolean }
    totalScore: number
    expenseTotal: number
    year: string
    manageMode: boolean
    selectedIds: Set<string>
    onToggleSelect: (e: React.MouseEvent) => void
    onUpdateCountry: (flag: string) => void
    onUpdateTitle: (title: string) => void
  }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: trip.id })
    const style: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: 0,
      padding: '24px 22px',
      borderRadius: '16px',
      border: '1px solid rgba(0,0,0,0.06)',
      backgroundColor: '#FFFFFF',
      boxShadow: isDragging ? '0 12px 28px rgba(0,0,0,0.2)' : '0 2px 12px rgba(0,0,0,0.06)',
      cursor: manageMode ? 'default' : 'pointer',
      textAlign: 'left',
      transition,
      position: 'relative' as const,
      transform: CSS.Transform.toString(transform),
      opacity: isDragging ? 0.9 : 1,
    }
    return (
      <div
        ref={setNodeRef}
        style={style}
        onClick={e => handleTripCardNavigate(e, trip.id)}
        role="button"
        tabIndex={0}
      >
        {manageMode && (
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 1 }} onClick={e => { e.stopPropagation(); onToggleSelect(e); }}>
            <input type="checkbox" checked={selectedIds.has(trip.id)} readOnly style={{ width: 18, height: 18, cursor: 'pointer', pointerEvents: 'none' }} />
          </div>
        )}
        <div data-drag-handle style={{ position: 'absolute', top: 12, right: 12, cursor: 'grab', touchAction: 'none', zIndex: 2 }} {...attributes} {...listeners} title="드래그하여 순서 변경">
          <GripVertical size={18} color="#9B9A97" />
        </div>
        <div style={{ marginLeft: manageMode ? 28 : 0, marginRight: 8, width: '100%', minWidth: 0 }}>
          <TravelTripListCardContent
            trip={trip}
            year={year}
            dday={dday}
            totalScore={totalScore}
            expenseTotal={expenseTotal}
            onCountryChange={onUpdateCountry}
            onSaveTitle={onUpdateTitle}
            onClearTripNote={
              trip.note?.trim()
                ? () => {
                    if (!window.confirm('이 여행 카드의 짧은 메모를 삭제할까요?')) return
                    void updateTrip(trip.id, { note: '' })
                  }
                : undefined
            }
          />
        </div>
      </div>
    )
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
          {/* 정렬 및 연도 필터 */}
          {trips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginBottom: 20, padding: '14px 18px', background: 'rgba(99,102,241,0.06)', borderRadius: 12, border: '1px solid rgba(99,102,241,0.15)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', letterSpacing: '0.05em' }}>정렬</span>
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value as 'manual' | 'score' | 'expense' | 'date' | 'domestic')}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: '#fff', color: '#37352F', fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none' }}
              >
                <option value="date">날짜순</option>
                <option value="score">총점순</option>
                <option value="domestic">국내/국외순</option>
                <option value="expense">가계부 금액순</option>
                <option value="manual">자유 정렬 (Manual)</option>
              </select>
              {sortOrder !== 'manual' && (
                <button
                  type="button"
                  onClick={() => setSortDirection(d => d === 'desc' ? 'asc' : 'desc')}
                  style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: sortDirection === 'desc' ? 'rgba(99,102,241,0.15)' : '#fff', color: '#4F46E5', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  title={sortDirection === 'desc' ? '내림차순 (클릭 시 오름차순)' : '오름차순 (클릭 시 내림차순)'}
                >
                  {sortDirection === 'desc' ? '↓ 내림차순' : '↑ 오름차순'}
                </button>
              )}
              <span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', letterSpacing: '0.05em', marginLeft: 8 }}>연도 필터</span>
              <select
                value={filterYearStart === '' ? '' : filterYearStart}
                onChange={e => setFilterYearStart(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: '#fff', color: '#37352F', fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none' }}
              >
                <option value="">전체</option>
                {Array.from({ length: 31 }, (_, i) => 2000 + i).map(y => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
              <span style={{ fontSize: 13, color: '#9B9A97' }}>~</span>
              <select
                value={filterYearEnd === '' ? '' : filterYearEnd}
                onChange={e => setFilterYearEnd(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: '#fff', color: '#37352F', fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none' }}
              >
                <option value="">전체</option>
                {Array.from({ length: 31 }, (_, i) => 2000 + i).map(y => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', letterSpacing: '0.05em', marginLeft: 12 }}>국내/국외</span>
              <select value={filterDomestic} onChange={e => setFilterDomestic(e.target.value as 'all' | 'domestic' | 'international')} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: '#fff', color: '#37352F', fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
                <option value="all">전체</option>
                <option value="domestic">국내만</option>
                <option value="international">국외만</option>
              </select>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', letterSpacing: '0.05em', marginLeft: 8 }}>완료 여부</span>
              <select value={filterCompleted} onChange={e => setFilterCompleted(e.target.value as 'all' | 'planned' | 'completed')} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: '#fff', color: '#37352F', fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
                <option value="all">전체</option>
                <option value="planned">예정</option>
                <option value="completed">완료</option>
              </select>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', letterSpacing: '0.05em', marginLeft: 8 }}>점수</span>
              <input type="number" min={1} max={100} placeholder="이상" value={filterMinScore === '' ? '' : filterMinScore} onChange={e => setFilterMinScore(e.target.value === '' ? '' : Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))} style={{ width: 56, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: '#fff', fontSize: 13, outline: 'none' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', letterSpacing: '0.05em', marginLeft: 8 }}>금액</span>
              <input type="number" min={0} placeholder="원 이상" value={filterMinAmount === '' ? '' : filterMinAmount} onChange={e => setFilterMinAmount(e.target.value === '' ? '' : Math.max(0, parseInt(String(e.target.value).replace(/\D/g, ''), 10) || 0))} style={{ width: 100, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: '#fff', fontSize: 13, outline: 'none' }} />
              {(filterYearStart !== '' || filterYearEnd !== '' || filterDomestic !== 'all' || filterCompleted !== 'all' || filterMinScore !== '' || filterMinAmount !== '') && (
                <button type="button" onClick={() => { setFilterYearStart(''); setFilterYearEnd(''); setFilterDomestic('all'); setFilterCompleted('all'); setFilterMinScore(''); setFilterMinAmount('') }} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'rgba(99,102,241,0.2)', color: '#4F46E5', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  필터 초기화
                </button>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                {manageMode ? (
                  <>
                    {selectedIds.size > 0 && (
                      <>
                        <span style={{ fontSize: 13, color: '#6366f1', fontWeight: 600 }}>{selectedIds.size}개 선택</span>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmOpen(true)}
                          style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >
                          선택 항목 삭제
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => { setManageMode(false); setSelectedIds(new Set()) }}
                      style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: '#fff', color: '#4F46E5', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      완료
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setManageMode(true)}
                    style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    카드 관리
                  </button>
                )}
              </div>
            </div>
          )}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px',
          }}>
            {sortedTrips.length === 0 && trips.length > 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '24px', textAlign: 'center', background: 'rgba(251,191,36,0.08)', borderRadius: 12, border: '1px solid rgba(251,191,36,0.25)' }}>
                <p style={{ margin: '0 0 12px', fontSize: 14, color: '#92400e', fontWeight: 600 }}>연도·정렬·필터 조건에 맞는 카드가 없습니다</p>
                <p style={{ margin: 0, fontSize: 13, color: '#787774' }}>필터를 초기화하면 추가한 여행 카드가 보입니다</p>
                <button type="button" onClick={() => { setFilterYearStart(''); setFilterYearEnd(''); setFilterDomestic('all'); setFilterCompleted('all'); setFilterMinScore(''); setFilterMinAmount('') }} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>필터 초기화</button>
              </div>
            )}
            {sortOrder === 'manual' ? (
              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={sortedTrips.map(t => t.id)} strategy={rectSortingStrategy}>
                  {sortedTrips.map(trip => (
                    <SortableTripCard
                      key={trip.id}
                      trip={trip}
                      dday={calcDDay(trip.startDate)}
                      totalScore={loadTripDetail(trip.id, trip).review?.totalScore ?? 0}
                      expenseTotal={(loadTripDetail(trip.id, trip).expenses ?? []).reduce((s, e) => s + e.amount, 0)}
                      year={trip.startDate.split('-')[0]}
                      manageMode={manageMode}
                      selectedIds={selectedIds}
                      onToggleSelect={e => { e.stopPropagation(); setSelectedIds(prev => { const n = new Set(prev); if (n.has(trip.id)) n.delete(trip.id); else n.add(trip.id); return n }) }}
                      onUpdateCountry={flag => updateTrip(trip.id, { countryFlag: flag })}
                      onUpdateTitle={title => updateTrip(trip.id, { title })}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              sortedTrips.map(trip => {
                const dday = calcDDay(trip.startDate)
                const detail = loadTripDetail(trip.id, trip)
                const totalScore = detail.review?.totalScore ?? 0
                const expenseTotal = (detail.expenses ?? []).reduce((s, e) => s + e.amount, 0)
                const year = trip.startDate.split('-')[0]
                const cardStyle: React.CSSProperties = {
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 0,
                  padding: '24px 22px',
                  borderRadius: '16px',
                  border: '1px solid rgba(0,0,0,0.06)',
                  backgroundColor: '#FFFFFF',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                  cursor: manageMode ? 'default' : 'pointer',
                  textAlign: 'left',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  position: 'relative',
                  color: 'inherit',
                }
                return (
                  <div
                    key={trip.id}
                    style={cardStyle}
                    onClick={e => handleTripCardNavigate(e, trip.id)}
                    role="button"
                    tabIndex={0}
                    onMouseEnter={e => { if (!manageMode) { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.12)' } }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)' }}
                  >
                    {manageMode && (
                      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 1 }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(trip.id)}
                          onChange={ev => { ev.stopPropagation(); setSelectedIds(prev => { const n = new Set(prev); if (n.has(trip.id)) n.delete(trip.id); else n.add(trip.id); return n }) }}
                          onClick={e => e.stopPropagation()}
                          style={{ width: 18, height: 18, cursor: 'pointer' }}
                        />
                      </div>
                    )}
                    <div style={{ marginLeft: manageMode ? 28 : 0, marginRight: 8, width: '100%', minWidth: 0 }}>
                      <TravelTripListCardContent
                        trip={trip}
                        year={year}
                        dday={dday}
                        totalScore={totalScore}
                        expenseTotal={expenseTotal}
                        onCountryChange={flag => updateTrip(trip.id, { countryFlag: flag })}
                        onSaveTitle={title => updateTrip(trip.id, { title })}
                        onClearTripNote={
                          trip.note?.trim()
                            ? () => {
                                if (!window.confirm('이 여행 카드의 짧은 메모를 삭제할까요?')) return
                                void updateTrip(trip.id, { note: '' })
                              }
                            : undefined
                        }
                      />
                    </div>
                  </div>
                )
              })
            )}
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
        {deleteConfirmOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setDeleteConfirmOpen(false)}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 360, boxShadow: '0 2px 24px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#37352F' }}>삭제하시겠습니까?</p>
              <p style={{ margin: '8px 0 16px', fontSize: 14, color: '#787774' }}>선택한 {selectedIds.size}개의 여행이 삭제됩니다.</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button onClick={() => setDeleteConfirmOpen(false)} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', background: 'transparent', color: '#787774', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>취소</button>
                <button onClick={handleRemoveSelected} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>삭제</button>
              </div>
            </div>
          </div>
        )}
        {addTripOpen && <AddTripModal onClose={() => setAddTripOpen(false)} onAdded={handleAddTrip} />}
      </>
    )
  }

  // ── 상세 뷰 (Detail View) ──
  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '14px 12px' : '36px 48px' }}>

      {/* <- 목록으로 돌아가기 */}
      <button
        onClick={() => navigate('/travel', { replace: true })}
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
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr auto', gap: 32, alignItems: 'stretch', minHeight: 180 }}>
              {/* 좌측: 캘린더 (Glassmorphism) */}
              {currentTrip && (() => {
                const [sy, sm, sd] = currentTrip.startDate.split('-').map(Number)
                const [ey, em, ed] = currentTrip.endDate.split('-').map(Number)
                const start = new Date(sy, sm - 1, sd)
                const end = new Date(ey, em - 1, ed)
                const sameMonth = sy === ey && sm === em
                const calW = isMobile ? 130 : 150
                if (!sameMonth) {
                  return (
                    <div style={{ width: calW, padding: 16, borderRadius: 14, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box' }}>
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
                  <div style={{ width: calW, padding: 16, borderRadius: 14, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, boxSizing: 'border-box' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)', flexShrink: 0 }}>{year}.{String(month + 1).padStart(2, '0')}</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, width: '100%', justifyItems: 'center', minWidth: 0, overflow: 'hidden' }}>
                      {['일', '월', '화', '수', '목', '금', '토'].map(d => <span key={d} style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontWeight: 600 }}>{d}</span>)}
                      {Array.from({ length: firstDay }, (_, i) => <span key={`e${i}`} />)}
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const d = i + 1
                        const active = isInRange(d)
                        return (
                          <span key={d} style={{
                            fontSize: 10, fontWeight: active ? 700 : 500, color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                            background: active ? ACCENT : 'transparent', borderRadius: 4, textAlign: 'center', padding: '2px 0', minWidth: 14, maxWidth: 18, boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>{d}</span>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* 중앙: 타이틀(좌) ⬅️ ➡️ 메모장(우, flex-1) — 하단 정렬, 메모장 세로 꽉 채움 */}
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: 28, minWidth: 0, flex: 1, flexWrap: 'nowrap', alignSelf: 'stretch' }}>
                <div style={{ flexShrink: 0, minWidth: 0, paddingBottom: 2 }}>
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
                  {currentTrip && (
                    <div style={{ marginTop: 10, width: '100%', maxWidth: 'min(100%, 560px)' }}>
                      <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>한 줄 메모 · 목록 카드에 표시</p>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <textarea
                          value={tripNoteDraft}
                          onChange={e => setTripNoteDraft(e.target.value)}
                          onBlur={() => saveTripNoteFromDraft()}
                          placeholder="예: 도톤보리 · 교토 당일치기"
                          rows={2}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            minHeight: 52,
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid rgba(255,255,255,0.22)',
                            background: 'rgba(255,255,255,0.08)',
                            color: 'rgba(255,255,255,0.92)',
                            fontSize: 14,
                            fontWeight: 500,
                            lineHeight: 1.5,
                            outline: 'none',
                            resize: 'vertical',
                            boxSizing: 'border-box',
                            textShadow: '0 1px 3px rgba(0,0,0,0.25)',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => clearTripCardNote()}
                          disabled={!tripNoteDraft.trim() && !(currentTrip.note ?? '').trim()}
                          title="메모 삭제"
                          style={{
                            flexShrink: 0,
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            border: '1px solid rgba(239,68,68,0.35)',
                            background: 'rgba(239,68,68,0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: (!tripNoteDraft.trim() && !(currentTrip.note ?? '').trim()) ? 'default' : 'pointer',
                            opacity: (!tripNoteDraft.trim() && !(currentTrip.note ?? '').trim()) ? 0.35 : 1,
                          }}
                        >
                          <Trash2 size={15} color="#fca5a5" />
                        </button>
                      </div>
                    </div>
                  )}
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
                  rows={4}
                  style={{
                    flex: 1, minWidth: 180, maxWidth: '100%', minHeight: 100, alignSelf: 'stretch', padding: '12px 16px', borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)',
                    fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(140,120,240,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
                />
              </div>

              {/* 우측: 2026년 + 아이콘 + HeaderSummary(총점 · D-Day · 가계부 총액) */}
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
                  <HeaderSummary
                    totalScore={review?.totalScore}
                    expenseTotal={expenses.reduce((s, e) => s + e.amount, 0)}
                    ddayText={ddayResult.text}
                  />
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
        )
      })()}

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

        {/* ── 문서 (PDF 등) — 일정 아래 · 사진 위 ── */}
        <TripDocumentsSection
          detail={detail}
          onAdd={addDocument}
          onUpdate={updateDocument}
          onRemove={removeDocument}
          inputBase={inputBase}
        />

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