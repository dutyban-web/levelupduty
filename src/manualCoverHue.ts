/** 책 표지 hue — 문서 id 기반 자동 색 (0–360) */
export function manualCoverHueFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 360
  return h
}
