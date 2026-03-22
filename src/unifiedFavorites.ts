/**
 * 통합 즐겨찾기 — Manual·순서도·인물 등 여러 데이터를 한곳에서 카드로 모아 봅니다.
 * 로컬 + app_kv 동기화
 */
import { kvSet } from './lib/supabase'
import { kindLabel, type UnifiedTagSourceKind } from './unifiedTagIndex'

export const UNIFIED_FAVORITES_KEY = 'creative_os_unified_favorites_v1'

export type UnifiedFavoriteExtraKind =
  | 'network_person'
  | 'workflow'
  | 'manual_site'
  | 'fortune_deck'
  | 'journal'

export type UnifiedFavoriteKind = UnifiedTagSourceKind | UnifiedFavoriteExtraKind

const EXTRA_LABEL: Record<UnifiedFavoriteExtraKind, string> = {
  network_person: '통합 인물',
  workflow: '작업 순서도',
  manual_site: 'Manual 링크',
  fortune_deck: '점괘 덱',
  journal: '저널',
}

export function unifiedFavoriteKindLabel(kind: UnifiedFavoriteKind): string {
  if (kind in EXTRA_LABEL) return EXTRA_LABEL[kind as UnifiedFavoriteExtraKind]
  return kindLabel(kind as UnifiedTagSourceKind)
}

export type UnifiedFavoriteEntry = {
  id: string
  kind: UnifiedFavoriteKind
  refId: string
  title: string
  subtitle: string
  href: string
  createdAt: string
}

export type UnifiedFavoritesStore = { items: UnifiedFavoriteEntry[] }

export function favoriteKey(kind: UnifiedFavoriteKind, refId: string): string {
  return `${kind}:${refId}`
}

export function loadUnifiedFavoritesStore(): UnifiedFavoritesStore {
  try {
    const raw = localStorage.getItem(UNIFIED_FAVORITES_KEY)
    if (!raw) return { items: [] }
    const p = JSON.parse(raw) as UnifiedFavoritesStore
    if (!p.items || !Array.isArray(p.items)) return { items: [] }
    return {
      items: p.items.filter(
        x => x && typeof x.id === 'string' && x.kind && typeof x.refId === 'string' && x.href,
      ),
    }
  } catch {
    return { items: [] }
  }
}

export function saveUnifiedFavoritesStore(s: UnifiedFavoritesStore) {
  try {
    localStorage.setItem(UNIFIED_FAVORITES_KEY, JSON.stringify(s))
    kvSet(UNIFIED_FAVORITES_KEY, s)
  } catch {
    /* ignore */
  }
}

export function isUnifiedFavorite(kind: UnifiedFavoriteKind, refId: string): boolean {
  const k = favoriteKey(kind, refId)
  return loadUnifiedFavoritesStore().items.some(e => favoriteKey(e.kind, e.refId) === k)
}

export function addUnifiedFavorite(
  patch: Omit<UnifiedFavoriteEntry, 'id' | 'createdAt'> & { id?: string },
): UnifiedFavoritesStore {
  const store = loadUnifiedFavoritesStore()
  const k = favoriteKey(patch.kind, patch.refId)
  const now = new Date().toISOString()
  const existingIdx = store.items.findIndex(e => favoriteKey(e.kind, e.refId) === k)
  const entry: UnifiedFavoriteEntry = {
    id: patch.id ?? crypto.randomUUID(),
    kind: patch.kind,
    refId: patch.refId,
    title: patch.title.trim() || '제목 없음',
    subtitle: patch.subtitle?.trim() ?? '',
    href: patch.href,
    createdAt: existingIdx >= 0 ? store.items[existingIdx].createdAt : now,
  }
  if (existingIdx >= 0) {
    store.items[existingIdx] = { ...entry, createdAt: store.items[existingIdx].createdAt }
  } else {
    store.items = [entry, ...store.items]
  }
  saveUnifiedFavoritesStore(store)
  return store
}

export function removeUnifiedFavorite(kind: UnifiedFavoriteKind, refId: string): UnifiedFavoritesStore {
  const k = favoriteKey(kind, refId)
  const store = loadUnifiedFavoritesStore()
  store.items = store.items.filter(e => favoriteKey(e.kind, e.refId) !== k)
  saveUnifiedFavoritesStore(store)
  return store
}

export function toggleUnifiedFavorite(
  input: Omit<UnifiedFavoriteEntry, 'id' | 'createdAt'> & { id?: string },
): boolean {
  if (isUnifiedFavorite(input.kind, input.refId)) {
    removeUnifiedFavorite(input.kind, input.refId)
    return false
  }
  addUnifiedFavorite(input)
  return true
}
