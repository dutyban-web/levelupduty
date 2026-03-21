/** 서울 좌표 — Open-Meteo (API 키 불필요) */
const SEOUL_LAT = 37.5665
const SEOUL_LON = 126.978

export type SeoulWeatherNow = {
  tempC: number
  /** WMO Weather interpretation code */
  code: number
}

/** Open-Meteo WMO 코드 → 단일 이모지 (대략적) */
export function wmoCodeToEmoji(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 3) return '⛅'
  if (code <= 48) return '🌫️'
  if (code <= 57) return '🌦️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '🌨️'
  if (code <= 82) return '🌧️'
  if (code <= 86) return '🌨️'
  if (code >= 95) return '⛈️'
  return '🌤️'
}

export async function fetchSeoulWeatherNow(): Promise<SeoulWeatherNow | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${SEOUL_LAT}&longitude=${SEOUL_LON}` +
    '&current=temperature_2m,weather_code&timezone=Asia%2FSeoul'
  const res = await fetch(url)
  if (!res.ok) return null
  const j = (await res.json()) as {
    current?: { temperature_2m?: number; weather_code?: number }
  }
  const t = j.current?.temperature_2m
  const code = j.current?.weather_code
  if (typeof t !== 'number' || typeof code !== 'number') return null
  return { tempC: Math.round(t), code }
}
