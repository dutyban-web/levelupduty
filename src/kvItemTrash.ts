/**
 * JSON 배열 아이템 소프트 삭제 — `is_deleted: true` 플래그 공통 처리
 */

/** Fragment entryIsTrashed 와 동일 — DB/마이그레이션에서 불리언이 아닐 수 있음 */
export function itemIsTrashed(x: { is_deleted?: boolean } | null | undefined): boolean {
  if (!x) return false
  if (x.is_deleted === true) return true
  const v = (x as Record<string, unknown>).is_deleted
  return v === 'true' || v === 1 || v === '1'
}

export function filterActiveItems<T extends { is_deleted?: boolean }>(items: T[]): T[] {
  return items.filter(i => !itemIsTrashed(i))
}

export function filterTrashedItems<T extends { is_deleted?: boolean }>(items: T[]): T[] {
  return items.filter(i => itemIsTrashed(i))
}
