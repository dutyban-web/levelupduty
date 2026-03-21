/**
 * 앱 전역 저장·동기화 상태 — 내부 로직·구독용 (UI는 에러 시에만 표시)
 */
export type AppSyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

/** synced 후 idle 복귀까지 대기 (타이핑 디바운스와 동일 계열, 기본 1초) */
export const SYNC_IDLE_MS = 1000

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

/** synced 후 잠시 뒤 idle 로 복귀 (에러 상태는 자동 복귀하지 않음 — 호출부에서 error 뒤에 붙이지 말 것) */
export function scheduleSyncIdle(delayMs: number = SYNC_IDLE_MS): void {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    emitAppSyncStatus('idle')
    idleTimer = null
  }, delayMs)
}
