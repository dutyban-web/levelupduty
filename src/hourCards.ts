/** 하루 24시간 — 1시간 카드 세그먼트 (0~23) */

export function hourCardSegments(now: Date): { hour: number; isPassed: boolean }[] {
  const h = now.getHours()
  const out: { hour: number; isPassed: boolean }[] = []
  for (let i = 0; i < 24; i++) {
    out.push({ hour: i, isPassed: i < h })
  }
  return out
}

export function remainingHourCards(now: Date): number {
  return 24 - now.getHours()
}
