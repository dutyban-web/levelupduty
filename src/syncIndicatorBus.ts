/**
 * 앱 전역 저장·동기화 상태 — 내부 로직·구독용 (UI는 에러 시에만 표시)
 */
export type AppSyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

/** emitAppSyncStatus('error', …) 시 UI·로그용 */
export type AppSyncErrorMeta = {
  errorCode: string
  errorDetail?: string
}

/** synced 후 idle 복귀까지 대기 (타이핑 디바운스와 동일 계열, 기본 1초) */
export const SYNC_IDLE_MS = 1000

/** unknown → 동기화 에러 배너에 붙일 코드·설명 */
export function appSyncErrorFromUnknown(e: unknown, fallbackCode: string): AppSyncErrorMeta {
  if (e && typeof e === 'object' && 'code' in e && typeof (e as { code: unknown }).code === 'string') {
    const pe = e as { code: string; message?: string; details?: string; hint?: string }
    const detail = [pe.message, pe.details, pe.hint].filter(x => x && String(x).trim()).join(' · ') || undefined
    return { errorCode: `PG_${pe.code}`, errorDetail: detail }
  }
  if (e instanceof DOMException && e.name === 'AbortError') {
    return { errorCode: 'FETCH_ABORT', errorDetail: '요청이 중단되었습니다. 네트워크가 불안정하거나 시간이 초과되었을 수 있습니다.' }
  }
  if (e instanceof Error) {
    const msg = e.message || ''
    if (/abort/i.test(msg) || /timeout/i.test(msg) || /timed?\s*out/i.test(msg)) {
      return { errorCode: 'FETCH_TIMEOUT', errorDetail: msg }
    }
    return { errorCode: e.name && e.name !== 'Error' ? e.name : fallbackCode, errorDetail: msg || undefined }
  }
  if (typeof e === 'string' && e.trim()) return { errorCode: fallbackCode, errorDetail: e }
  return { errorCode: fallbackCode, errorDetail: e != null ? String(e) : undefined }
}

type Listener = (s: AppSyncStatus, err?: AppSyncErrorMeta) => void
const listeners = new Set<Listener>()

let idleTimer: ReturnType<typeof setTimeout> | null = null

export function subscribeAppSyncStatus(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function emitAppSyncStatus(s: AppSyncStatus, err?: AppSyncErrorMeta): void {
  if (s === 'syncing' && idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
  listeners.forEach(l => {
    try {
      l(s, s === 'error' ? err : undefined)
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
