/**
 * 내실 관리 — 동료(Garrison), 전리품(Treasury), 지도 핀(Library/Spatial)
 * MapHub MapZoneId와 동일 키로 app_kv 동기화
 */
import { kvSet } from './lib/supabase'
import { BL_INNER_WORLD_SYNC } from './questRpgIntegration'
import { MAP_ZONES, type MapZoneId } from './mapHubZones'

const VALID_MAP_ZONE_IDS = new Set<string>(MAP_ZONES.map(z => z.id))

export const INNER_WORLD_KEY = 'bl_inner_world_v1'

export type CompanionTraitId = 'mentor' | 'ally' | 'resource' | 'creative' | 'tech' | 'finance' | 'heart'

export const COMPANION_TRAITS: { id: CompanionTraitId; emoji: string; label: string }[] = [
  { id: 'mentor', emoji: '🎓', label: '멘토' },
  { id: 'ally', emoji: '🛡️', label: '동맹' },
  { id: 'resource', emoji: '🧰', label: '자원' },
  { id: 'creative', emoji: '🎨', label: '창작' },
  { id: 'tech', emoji: '⚙️', label: '기술' },
  { id: 'finance', emoji: '💹', label: '재무' },
  { id: 'heart', emoji: '💜', label: '정서' },
]

/** 도움을 주고받은 기록 */
export type HelpExchangeEntry = {
  id: string
  dateYmd: string
  direction: 'give' | 'receive'
  note: string
}

export type CompanionCard = {
  id: string
  name: string
  /** 0–100 — 우호도 */
  affinity: number
  /** YYYY-MM-DD */
  lastInteractionYmd: string
  traits: CompanionTraitId[]
  /** Net 명부와 연결 (선택) */
  networkContactId?: string
  memo: string
  /** 주요 대화·관심 키워드 (쉼표 구분 가능) */
  dialogKeywords: string
  /** 도움 주고받은 기록 */
  helpExchangeLog: HelpExchangeEntry[]
  createdAt: string
  updatedAt: string
}

export type TreasuryKind = 'pdf' | 'image' | 'audio' | 'youtube' | 'link' | 'other'

export type TreasuryTier = 'loot' | 'artifact'

export type TreasuryLoot = {
  id: string
  kind: TreasuryKind
  /** 전리품 vs 유물 */
  tier: TreasuryTier
  title: string
  url: string
  memo: string
  createdAt: string
  /** 전략 비디오: 초 단위 타임스탬프 */
  youtubeTimestampSec?: number | null
  strategyMemo?: string
  mapZoneId?: MapZoneId | null
}

export type MapMemoPin = {
  id: string
  mapZoneId: MapZoneId
  title: string
  body: string
  /** 영토·테마 태그 (예: 사우디아라비아, 중동) — 검색·팝업 표시 */
  themeTags: string[]
  createdAt: string
  treasuryLootId?: string
}

export type InnerWorldStore = {
  version: 1
  /** 명성 (동료 활동으로 상승) */
  reputation: number
  companions: CompanionCard[]
  treasury: TreasuryLoot[]
  mapPins: MapMemoPin[]
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** "사우디, OPEC" → ['사우디', 'OPEC'] */
export function parseThemeTags(input: string): string[] {
  return input
    .split(/[,，;；\n]/)
    .map(s => s.trim())
    .filter(Boolean)
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

function migrateHelpEntry(raw: unknown): HelpExchangeEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const h = raw as Record<string, unknown>
  if (typeof h.id !== 'string' || typeof h.dateYmd !== 'string' || typeof h.note !== 'string') return null
  const dir = h.direction === 'give' || h.direction === 'receive' ? h.direction : 'give'
  return { id: h.id, dateYmd: h.dateYmd, direction: dir, note: h.note }
}

export function migrateCompanion(raw: unknown): CompanionCard | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Record<string, unknown>
  if (typeof c.id !== 'string' || typeof c.name !== 'string') return null
  const traits = Array.isArray(c.traits)
    ? (c.traits as CompanionTraitId[]).filter(t => COMPANION_TRAITS.some(x => x.id === t))
    : (['ally'] as CompanionTraitId[])
  const logRaw = c.helpExchangeLog
  let helpExchangeLog: HelpExchangeEntry[] = []
  if (Array.isArray(logRaw)) {
    helpExchangeLog = logRaw.map(migrateHelpEntry).filter((x): x is HelpExchangeEntry => x != null)
  }
  const aff = typeof c.affinity === 'number' ? Math.min(100, Math.max(0, Math.round(c.affinity))) : 35
  const now = new Date().toISOString()
  return {
    id: c.id,
    name: c.name,
    affinity: aff,
    lastInteractionYmd: typeof c.lastInteractionYmd === 'string' ? c.lastInteractionYmd : todayYmd(),
    traits: traits.length ? traits : ['ally'],
    networkContactId: typeof c.networkContactId === 'string' ? c.networkContactId : undefined,
    memo: typeof c.memo === 'string' ? c.memo : '',
    dialogKeywords: typeof c.dialogKeywords === 'string' ? c.dialogKeywords : '',
    helpExchangeLog,
    createdAt: typeof c.createdAt === 'string' ? c.createdAt : now,
    updatedAt: typeof c.updatedAt === 'string' ? c.updatedAt : now,
  }
}

export function migrateTreasuryLoot(raw: unknown): TreasuryLoot | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Record<string, unknown>
  if (typeof t.id !== 'string' || typeof t.url !== 'string' || typeof t.title !== 'string') return null
  const ks = String(t.kind)
  const kind: TreasuryKind = ['pdf', 'image', 'audio', 'youtube', 'link', 'other'].includes(ks)
    ? (ks as TreasuryKind)
    : detectTreasuryKind(String(t.url))
  const tier: TreasuryTier = t.tier === 'artifact' ? 'artifact' : 'loot'
  const mz = typeof t.mapZoneId === 'string' && VALID_MAP_ZONE_IDS.has(t.mapZoneId) ? (t.mapZoneId as MapZoneId) : null
  return {
    id: t.id,
    kind,
    tier,
    title: t.title,
    url: t.url,
    memo: typeof t.memo === 'string' ? t.memo : '',
    createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
    youtubeTimestampSec: typeof t.youtubeTimestampSec === 'number' ? t.youtubeTimestampSec : null,
    strategyMemo: typeof t.strategyMemo === 'string' ? t.strategyMemo : undefined,
    mapZoneId: mz,
  }
}

export function migrateMapPin(raw: unknown): MapMemoPin | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  if (typeof p.id !== 'string' || typeof p.title !== 'string' || typeof p.body !== 'string') return null
  if (typeof p.mapZoneId !== 'string' || !VALID_MAP_ZONE_IDS.has(p.mapZoneId)) return null
  let themeTags: string[] = []
  if (Array.isArray(p.themeTags)) {
    themeTags = p.themeTags.filter((x): x is string => typeof x === 'string').map(s => s.trim()).filter(Boolean)
  } else if (typeof (p as { themeKeywords?: string }).themeKeywords === 'string') {
    themeTags = parseThemeTags((p as { themeKeywords: string }).themeKeywords)
  }
  return {
    id: p.id,
    mapZoneId: p.mapZoneId as MapZoneId,
    title: p.title,
    body: p.body,
    themeTags,
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
    treasuryLootId: typeof p.treasuryLootId === 'string' ? p.treasuryLootId : undefined,
  }
}

export function detectTreasuryKind(url: string): TreasuryKind {
  const u = url.trim().toLowerCase()
  if (!u) return 'other'
  if (/youtube\.com|youtu\.be/.test(u)) return 'youtube'
  if (/\.pdf(\?|#|$)/i.test(u) || /\/pdf\//i.test(u)) return 'pdf'
  if (/\.(jpg|jpeg|png|gif|webp|svg)(\?|#|$)/i.test(u)) return 'image'
  if (/\.(mp3|wav|ogg|m4a|flac)(\?|#|$)/i.test(u)) return 'audio'
  if (/^https?:\/\//i.test(u)) return 'link'
  return 'other'
}

export function parseYoutubeTime(input: string): number | null {
  const s = input.trim()
  if (!s) return null
  if (/^\d+$/.test(s)) return parseInt(s, 10)
  const m = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/)
  if (m) {
    const h = m[3] != null ? parseInt(m[1], 10) : 0
    const min = m[3] != null ? parseInt(m[2], 10) : parseInt(m[1], 10)
    const sec = m[3] != null ? parseInt(m[3], 10) : parseInt(m[2], 10)
    if (m[3] != null) return h * 3600 + min * 60 + sec
    return min * 60 + sec
  }
  return null
}

export function youtubeEmbedUrl(url: string, tSec?: number | null): string {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace(/^\//, '')
      const x = new URL(`https://www.youtube.com/embed/${id}`)
      if (tSec != null && tSec > 0) x.searchParams.set('start', String(Math.floor(tSec)))
      return x.toString()
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) {
        const x = new URL(`https://www.youtube.com/embed/${v}`)
        if (tSec != null && tSec > 0) x.searchParams.set('start', String(Math.floor(tSec)))
        return x.toString()
      }
    }
  } catch {
    /* ignore */
  }
  return url
}

export function loadInnerWorldStore(): InnerWorldStore {
  try {
    const raw = localStorage.getItem(INNER_WORLD_KEY)
    if (!raw) {
      return { version: 1, reputation: 0, companions: [], treasury: [], mapPins: [] }
    }
    const p = JSON.parse(raw) as Partial<InnerWorldStore>
    if (p.version !== 1) {
      return { version: 1, reputation: 0, companions: [], treasury: [], mapPins: [] }
    }
    const companions = Array.isArray(p.companions)
      ? p.companions.map(migrateCompanion).filter((x): x is CompanionCard => x != null)
      : []
    const treasury = Array.isArray(p.treasury)
      ? p.treasury.map(migrateTreasuryLoot).filter((x): x is TreasuryLoot => x != null)
      : []
    const mapPins = Array.isArray(p.mapPins)
      ? p.mapPins.map(migrateMapPin).filter((x): x is MapMemoPin => x != null)
      : []
    return {
      version: 1,
      reputation: typeof p.reputation === 'number' ? Math.max(0, p.reputation) : 0,
      companions,
      treasury,
      mapPins,
    }
  } catch {
    return { version: 1, reputation: 0, companions: [], treasury: [], mapPins: [] }
  }
}

export function saveInnerWorldStore(s: InnerWorldStore): void {
  try {
    localStorage.setItem(INNER_WORLD_KEY, JSON.stringify(s))
    void kvSet(INNER_WORLD_KEY, s)
    try {
      window.dispatchEvent(new CustomEvent(BL_INNER_WORLD_SYNC))
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}

export function bumpReputation(delta: number): number {
  const st = loadInnerWorldStore()
  const reputation = Math.max(0, st.reputation + delta)
  saveInnerWorldStore({ ...st, reputation })
  return reputation
}
