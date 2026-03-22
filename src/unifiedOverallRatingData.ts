/**
 * 통합 레이팅 척도 — 0.5 단위, 최대 5 (0 = 미설정)
 * 개별 데이터(manual_documents.rating 등)와 동일 규칙.
 */
export function clampUnifiedOverallRating(n: number): number {
  const r = Math.round(n * 2) / 2
  if (r < 0) return 0
  if (r > 5) return 5
  return r
}
