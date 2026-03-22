/**
 * 원본(통합 태그) — 사용자 정의 그룹 및 태그 배치 (localStorage + app_kv)
 */
import { kvSet } from './lib/supabase'

export const UNIFIED_TAG_GROUPS_KEY = 'creative_os_unified_tag_groups_v1'

export type UnifiedTagCustomGroup = {
  id: string
  name: string
  sortOrder: number
}

export type UnifiedTagGroupsRegistry = {
  version: 1
  groups: UnifiedTagCustomGroup[]
  /** 태그 전체 문자열 → 사용자 그룹 id */
  tagToGroupId: Record<string, string>
}

export function defaultUnifiedTagGroupsRegistry(): UnifiedTagGroupsRegistry {
  return { version: 1, groups: [], tagToGroupId: {} }
}

export function loadUnifiedTagGroupsRegistry(): UnifiedTagGroupsRegistry {
  try {
    const raw = localStorage.getItem(UNIFIED_TAG_GROUPS_KEY)
    if (!raw) return defaultUnifiedTagGroupsRegistry()
    const p = JSON.parse(raw) as Partial<UnifiedTagGroupsRegistry>
    if (!p || p.version !== 1) return defaultUnifiedTagGroupsRegistry()
    const groups = Array.isArray(p.groups)
      ? p.groups
          .filter((g): g is UnifiedTagCustomGroup => g != null && typeof g.id === 'string' && typeof g.name === 'string')
          .map((g, i) => ({
            id: g.id,
            name: g.name.trim() || '이름 없음',
            sortOrder: typeof g.sortOrder === 'number' ? g.sortOrder : i,
          }))
      : []
    const tagToGroupId =
      p.tagToGroupId && typeof p.tagToGroupId === 'object'
        ? Object.fromEntries(
            Object.entries(p.tagToGroupId).filter(([, v]) => typeof v === 'string' && v.length > 0),
          )
        : {}
    return { version: 1, groups, tagToGroupId }
  } catch {
    return defaultUnifiedTagGroupsRegistry()
  }
}

export function saveUnifiedTagGroupsRegistry(r: UnifiedTagGroupsRegistry): void {
  const payload: UnifiedTagGroupsRegistry = { version: 1, groups: r.groups, tagToGroupId: r.tagToGroupId }
  try {
    localStorage.setItem(UNIFIED_TAG_GROUPS_KEY, JSON.stringify(payload))
    void kvSet(UNIFIED_TAG_GROUPS_KEY, payload)
  } catch {
    /* quota */
  }
}

export function newUnifiedGroupId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `ug-${crypto.randomUUID()}`
  return `ug-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function countTagsInCustomGroup(
  tagKeys: Iterable<string>,
  tagToGroupId: Record<string, string>,
  groupId: string,
): number {
  let n = 0
  for (const t of tagKeys) {
    if (tagToGroupId[t] === groupId) n += 1
  }
  return n
}
