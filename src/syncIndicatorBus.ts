/**
 * 앱 전역 저장·동기화 상태 — 헤더/토스트 등에서 구독
 */
export type AppSyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

type Listener = (s: AppSyncStatus) => void
const listeners = new Set<Listener>()

let idleTimer: ReturnType<typeof setTimeout> | null = null

export function subscribeAppSyncStatus(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function emitAppSyncStatus(s: AppSyncStatus): void {
  if (s === 'syncing' && idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
  listeners.forEach(l => {
    try {
      l(s)
    } catch {
      /* ignore */
    }
  })
}

/** synced/error 후 잠시 뒤 idle 로 복귀 */
export function scheduleSyncIdle(delayMs: number): void {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    emitAppSyncStatus('idle')
    idleTimer = null
  }, delayMs)
}
