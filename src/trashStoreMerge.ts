/**
 * 휴지통 목록용: 로컬 캐시 + app_kv 원격 JSON을 병합해 소프트삭제 항목이 누락되지 않게 함
 * (Fragment 페이지는 이미 mergeFragmentStores 사용 — 동일 패턴)
 *
 * 병합 시 한쪽만 is_deleted 인 경우 → 삭제 쪽을 유지(최신 updatedAt 본문 + 휴지통 플래그)
 */
import { itemIsTrashed } from './kvItemTrash'
import type { LedgerStore } from './accountLedgerData'
import type { ValueActionStore } from './valueActionData'
import type { NetworkStore } from './networkData'
import type { QuantumFlowStore } from './quantumFlowData'
import type { EvolutionStore } from './evolutionData'
import type { PlaybookStore } from './humanRelationsPlaybookData'
import type { LevelupRpgProfile } from './levelupRpgProfile'

/** 동일 id: 더 최신 updatedAt 레코드를 베이스로 하되, 어느 한쪽이라도 휴지통이면 is_deleted 유지 */
function mergeTwoRecords<T extends { id: string; updatedAt: string; is_deleted?: boolean }>(left: T, right: T): T {
  const newer = (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '') >= 0 ? right : left
  const trashed = itemIsTrashed(left) || itemIsTrashed(right)
  if (!trashed) return newer
  return { ...newer, is_deleted: true as const } as T
}

function mergeRecordsByUpdatedAt<T extends { id: string; updatedAt: string; is_deleted?: boolean }>(a: T[], b: T[]): T[] {
  const map = new Map<string, T>()
  for (const e of a) map.set(e.id, e)
  for (const e of b) {
    const prev = map.get(e.id)
    if (!prev) {
      map.set(e.id, e)
      continue
    }
    map.set(e.id, mergeTwoRecords(prev, e))
  }
  return [...map.values()]
}

/** updatedAt 없는 서브행 — id 기준으로 원격이 덮어씀 */
function mergeRowsById<T extends { id: string }>(a: T[], b: T[]): T[] {
  const map = new Map<string, T>()
  for (const e of a) map.set(e.id, e)
  for (const e of b) map.set(e.id, e)
  return [...map.values()]
}

export function mergeLedgerStores(local: LedgerStore, remote: LedgerStore | null): LedgerStore {
  if (!remote || remote.version !== 1) return local
  return {
    version: 1,
    categories: local.categories.length >= remote.categories.length ? local.categories : remote.categories,
    entries: mergeRecordsByUpdatedAt(local.entries, remote.entries),
  }
}

export function mergeValueActionStores(local: ValueActionStore, remote: ValueActionStore | null): ValueActionStore {
  if (!remote || !Array.isArray(remote.items)) return local
  return { items: mergeRecordsByUpdatedAt(local.items, remote.items) }
}

export function mergeNetworkStores(local: NetworkStore, remote: NetworkStore | null): NetworkStore {
  if (!remote || !Array.isArray(remote.contacts)) return local
  return { contacts: mergeRecordsByUpdatedAt(local.contacts, remote.contacts) }
}

export function mergeQuantumFlowStores(local: QuantumFlowStore, remote: QuantumFlowStore | null): QuantumFlowStore {
  if (!remote || !Array.isArray(remote.letters)) return local
  const letters = mergeRecordsByUpdatedAt(local.letters, remote.letters)
  const timeboxes = mergeRecordsByUpdatedAt(local.timeboxes ?? [], remote.timeboxes ?? [])
  return {
    ...local,
    ...remote,
    letters,
    timeboxes,
    vaultPwHashToFuture: remote.vaultPwHashToFuture ?? local.vaultPwHashToFuture,
    vaultPwHashToPast: remote.vaultPwHashToPast ?? local.vaultPwHashToPast,
    vaultPwHashTimebox: remote.vaultPwHashTimebox ?? local.vaultPwHashTimebox,
  }
}

export function mergeEvolutionStores(local: EvolutionStore, remote: EvolutionStore | null): EvolutionStore {
  if (!remote || remote.version !== 1) return local
  return {
    version: 1,
    totalEvolutionXp: Math.max(local.totalEvolutionXp, remote.totalEvolutionXp),
    items: mergeRecordsByUpdatedAt(local.items, remote.items),
  }
}

export function mergePlaybookStores(local: PlaybookStore, remote: PlaybookStore | null): PlaybookStore {
  if (!remote || !Array.isArray(remote.items)) return local
  return { items: mergeRecordsByUpdatedAt(local.items, remote.items) }
}

export function mergeRpgProfilesForTrash(local: LevelupRpgProfile, remote: LevelupRpgProfile | null): LevelupRpgProfile {
  if (!remote) return local
  return {
    ...local,
    ...remote,
    statLines: mergeRowsById(local.statLines, remote.statLines),
    bosses: mergeRowsById(local.bosses, remote.bosses),
    maps: mergeRowsById(local.maps, remote.maps),
    quests: mergeRowsById(local.quests, remote.quests),
    skills: mergeRowsById(local.skills, remote.skills),
    equipment: Array.isArray(remote.equipment) && remote.equipment.length ? remote.equipment : local.equipment,
  }
}
