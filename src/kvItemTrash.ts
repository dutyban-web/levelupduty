/**
 * JSON 배열 아이템 소프트 삭제 — `is_deleted: true` 플래그 공통 처리
 */

export function itemIsTrashed(x: { is_deleted?: boolean } | null | undefined): boolean {
  if (!x) return false
  return x.is_deleted === true
}

export function filterActiveItems<T extends { is_deleted?: boolean }>(items: T[]): T[] {
  return items.filter(i => !itemIsTrashed(i))
}

export function filterTrashedItems<T extends { is_deleted?: boolean }>(items: T[]): T[] {
  return items.filter(i => itemIsTrashed(i))
}
