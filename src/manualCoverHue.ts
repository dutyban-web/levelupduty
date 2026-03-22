/** 책 표지 hue — 문서 id 기반 자동 색 (0–360, 카테고리 없을 때) */
export function manualCoverHueFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 360
  return h
}

/** 같은 카테고리 문자열 → 항상 같은 hue (12색 팔레트) */
const CATEGORY_HUES = [28, 45, 85, 118, 158, 188, 218, 248, 278, 308, 328, 352] as const

export function hueFromCategory(category: string): number {
  const t = category.trim()
  if (!t) return CATEGORY_HUES[0]!
  let h = 0
  for (let i = 0; i < t.length; i++) h = (h + t.charCodeAt(i) * (i + 11)) % 999_983
  return CATEGORY_HUES[h % CATEGORY_HUES.length]!
}

/** 표시용: 수동 cover_hue > 카테고리 기본 > 문서 id 기반 */
export function effectiveManualCoverHue(doc: {
  id: string
  category: string
  cover_hue: number | null
}): number {
  if (doc.cover_hue != null) return doc.cover_hue
  const c = doc.category?.trim()
  if (c) return hueFromCategory(c)
  return manualCoverHueFromId(doc.id)
}
