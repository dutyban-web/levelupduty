/**
 * 시뮬레이션 머니 — 획득 EXP와 보상 상점 재화 연동
 * bl_simulation_wallet_v1
 */
import { kvSet } from './lib/supabase'

export const SIMULATION_WALLET_KEY = 'bl_simulation_wallet_v1'

export type SimulationWallet = {
  version: 1
  /** 누적 시뮬레이션 크레딧 (EXP 획득분과 1:1 동기화, 상점에서 사용 예정) */
  credits: number
  /** 마지막으로 기록한 동기화 시점 totalXp (선택) */
  lastSyncedTotalXp: number
}

export function loadSimulationWallet(): SimulationWallet {
  try {
    const raw = localStorage.getItem(SIMULATION_WALLET_KEY)
    if (!raw) return { version: 1, credits: 0, lastSyncedTotalXp: 0 }
    const p = JSON.parse(raw) as Partial<SimulationWallet>
    if (p.version !== 1) return { version: 1, credits: 0, lastSyncedTotalXp: 0 }
    return {
      version: 1,
      credits: typeof p.credits === 'number' && p.credits >= 0 ? Math.floor(p.credits) : 0,
      lastSyncedTotalXp: typeof p.lastSyncedTotalXp === 'number' ? Math.max(0, p.lastSyncedTotalXp) : 0,
    }
  } catch {
    return { version: 1, credits: 0, lastSyncedTotalXp: 0 }
  }
}

export function saveSimulationWallet(next: SimulationWallet): void {
  try {
    localStorage.setItem(SIMULATION_WALLET_KEY, JSON.stringify(next))
    void kvSet(SIMULATION_WALLET_KEY, next)
  } catch {
    /* quota */
  }
}

/** XP가 증가한 만큼 시뮬레이션 크레딧 적립 (감소 시에는 크레딧 미차감 — 게임 보상만 추적) */
export function applyXpGainToSimulationWallet(deltaXp: number): SimulationWallet {
  if (!Number.isFinite(deltaXp) || deltaXp <= 0) return loadSimulationWallet()
  const w = loadSimulationWallet()
  const next: SimulationWallet = {
    ...w,
    credits: w.credits + Math.floor(deltaXp),
  }
  saveSimulationWallet(next)
  try {
    window.dispatchEvent(new CustomEvent('bl-simulation-wallet-sync'))
  } catch {
    /* ignore */
  }
  return next
}

export function spendSimulationCredits(amount: number): boolean {
  if (!Number.isFinite(amount) || amount <= 0) return true
  const w = loadSimulationWallet()
  const n = Math.ceil(amount)
  if (w.credits < n) return false
  const next: SimulationWallet = { ...w, credits: w.credits - n }
  saveSimulationWallet(next)
  try {
    window.dispatchEvent(new CustomEvent('bl-simulation-wallet-sync'))
  } catch {
    /* ignore */
  }
  return true
}

export function syncSimulationWalletTotalXp(totalXp: number): SimulationWallet {
  const w = loadSimulationWallet()
  const t = Math.max(0, Math.floor(totalXp))
  if (t <= w.lastSyncedTotalXp) return w
  const gain = t - w.lastSyncedTotalXp
  const next: SimulationWallet = {
    ...w,
    credits: w.credits + gain,
    lastSyncedTotalXp: t,
  }
  saveSimulationWallet(next)
  try {
    window.dispatchEvent(new CustomEvent('bl-simulation-wallet-sync'))
  } catch {
    /* ignore */
  }
  return next
}
