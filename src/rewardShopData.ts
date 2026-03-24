/**
 * 비밀 상점 카탈로그 + 사용자 심상화(미래 상황) 아이템
 */
import { kvSet } from './lib/supabase'

export const VISUALIZATION_ITEMS_KEY = 'bl_visualization_items_v1'

export type ShopCatalogItem = {
  id: string
  title: string
  description: string
  costGold: number
  emoji: string
}

/** 정적 상점 품목 */
export const SHOP_CATALOG: ShopCatalogItem[] = [
  { id: 'hour_sand', title: '모래시계 조각', description: '다음 집중 세션 +1분(상징).', costGold: 28, emoji: '⏳' },
  { id: 'ember_coin', title: '잿불 동전', description: '골드 루틴에 행운을 더한다(상징).', costGold: 40, emoji: '🪙' },
  { id: 'oracle_feather', title: '예언의 깃털', description: '리뷰 노트를 한 줄 열게 한다(상징).', costGold: 55, emoji: '🪶' },
  { id: 'forge_seal', title: '대장간 인장', description: '완료한 퀘스트에 낙인을 남긴다(상징).', costGold: 72, emoji: '🔥' },
]

export type CreditShopCategory = 'consumable' | 'equipment' | 'relic'

export type CreditShopItem = {
  id: string
  category: CreditShopCategory
  title: string
  description: string
  costCredits: number
  emoji: string
}

/** 시뮬레이션 크레딧(EXP) 전용 상점 품목 */
export const CREDIT_SHOP_ITEMS: CreditShopItem[] = [
  { id: 'c_focus_herb', category: 'consumable', title: '몰입의 허브', description: '집중 전 염원을 품는다(상징).', costCredits: 35, emoji: '🌿' },
  { id: 'c_stamina_drop', category: 'consumable', title: '스태미나 방울', description: '오늘을 한 칸 밀어준다(상징).', costCredits: 48, emoji: '💧' },
  { id: 'c_routine_spark', category: 'consumable', title: '루틴 불씨', description: '연속 달성의 기억을 되새긴다(상징).', costCredits: 42, emoji: '🔥' },
  { id: 'e_quill_band', category: 'equipment', title: '필경의 고리', description: '원고와의 연결을 단단히 한다(상징).', costCredits: 120, emoji: '💍' },
  { id: 'e_lens_frame', category: 'equipment', title: '분석 렌즈 띠', description: '데이터를 한 겹 밝게 본다(상징).', costCredits: 135, emoji: '🔎' },
  { id: 'e_travel_boots', category: 'equipment', title: '탐험가의 신발', description: '새 프로젝트 발을 내딛는다(상징).', costCredits: 150, emoji: '👢' },
  { id: 'r_memory_shard', category: 'relic', title: '기억의 파편', description: '과거 승리의 잔향을 소환한다(상징).', costCredits: 200, emoji: '✨' },
  { id: 'r_destiny_thread', category: 'relic', title: '운명의 실', description: '미래 장면을 한 올 묶는다(상징).', costCredits: 280, emoji: '🧵' },
  { id: 'r_golden_page', category: 'relic', title: '황금 페이지', description: '완결 장면을 머릿속에 새긴다(상징).', costCredits: 320, emoji: '📜' },
]

export const CREDIT_SHOP_CATEGORY_LABEL: Record<CreditShopCategory, string> = {
  consumable: '소모품',
  equipment: '장비',
  relic: '심상화 유물',
}

export type VisualizationItem = {
  id: string
  title: string
  /** 바라는 미래 상황 */
  description: string
  costGold: number
  createdAt: string
}

export type VisualizationStore = {
  version: 1
  items: VisualizationItem[]
}

export function newVizId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `viz_${crypto.randomUUID()}`
  return `viz_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function loadVisualizationItems(): VisualizationStore {
  try {
    const raw = localStorage.getItem(VISUALIZATION_ITEMS_KEY)
    if (!raw) return { version: 1, items: [] }
    const p = JSON.parse(raw) as Partial<VisualizationStore>
    if (p.version !== 1 || !Array.isArray(p.items)) return { version: 1, items: [] }
    return {
      version: 1,
      items: p.items.filter(
        (v): v is VisualizationItem =>
          v != null &&
          typeof v === 'object' &&
          typeof (v as VisualizationItem).id === 'string' &&
          typeof (v as VisualizationItem).title === 'string',
      ),
    }
  } catch {
    return { version: 1, items: [] }
  }
}

export function saveVisualizationItems(next: VisualizationStore): void {
  try {
    localStorage.setItem(VISUALIZATION_ITEMS_KEY, JSON.stringify(next))
    void kvSet(VISUALIZATION_ITEMS_KEY, next)
  } catch {
    /* quota */
  }
}

export function addVisualizationItem(input: { title: string; description: string; costGold: number }): VisualizationStore {
  const s = loadVisualizationItems()
  const row: VisualizationItem = {
    id: newVizId(),
    title: input.title.trim(),
    description: input.description.trim(),
    costGold: Math.max(1, Math.round(input.costGold)),
    createdAt: new Date().toISOString(),
  }
  const next = { ...s, items: [row, ...s.items] }
  saveVisualizationItems(next)
  return next
}

export function deleteVisualizationItem(id: string): VisualizationStore {
  const s = loadVisualizationItems()
  const next = { ...s, items: s.items.filter(x => x.id !== id) }
  saveVisualizationItems(next)
  return next
}
