/**
 * 예언자의 거울 — 집중·가계·행복(추정) 차트 + 지역 필터(내실 Treasury / Library)
 */
import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { loadPomodoroLog } from './pomodoroLogData'
import { activeLedgerEntries, loadLedgerStore } from './accountLedgerData'
import { loadEmotionalLens } from './boardEmotionalLensData'
import { loadInnerWorldStore, type TreasuryLoot, type MapMemoPin } from './lifeWorldData'
import { BL_INNER_WORLD_SYNC } from './questRpgIntegration'

const REGION_PRESETS: { id: string; label: string; keywords: string[] }[] = [
  { id: 'saudi', label: '사우디아라비아', keywords: ['사우디', '사우디아라비아', 'saudi', 'riyadh', '리야드'] },
  { id: 'jp', label: '일본', keywords: ['일본', 'japan', 'tokyo', '도쿄'] },
  { id: 'us', label: '미국', keywords: ['미국', 'usa', 'u.s.', 'new york'] },
]

function matchRegion(text: string, keywords: string[]): boolean {
  const t = text.toLowerCase()
  return keywords.some(k => t.includes(k.toLowerCase()))
}

function pinMatchesRegion(pin: MapMemoPin, keywords: string[]): boolean {
  const blob = [pin.title, pin.body, ...pin.themeTags].join(' ')
  return matchRegion(blob, keywords) || pin.themeTags.some(tag => matchRegion(tag, keywords))
}

function lootMatchesRegion(loot: TreasuryLoot, keywords: string[]): boolean {
  const blob = `${loot.title} ${loot.memo}`
  return matchRegion(blob, keywords)
}

/** 최근 N일 YYYY-MM-DD 목록 (오늘 포함) */
function lastNDays(n: number): string[] {
  const out: string[] = []
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getTime() - i * 86400000)
    out.push(x.toISOString().slice(0, 10))
  }
  return out
}

export function OracleMirrorPanel() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const h = () => setTick(t => t + 1)
    window.addEventListener(BL_INNER_WORLD_SYNC, h)
    window.addEventListener('focus', h)
    return () => {
      window.removeEventListener(BL_INNER_WORLD_SYNC, h)
      window.removeEventListener('focus', h)
    }
  }, [])

  const [regionId, setRegionId] = useState<string>('saudi')
  const region = REGION_PRESETS.find(r => r.id === regionId) ?? REGION_PRESETS[0]

  const inner = useMemo(() => loadInnerWorldStore(), [tick])
  const pins = useMemo(
    () => inner.mapPins.filter(p => pinMatchesRegion(p, region.keywords)),
    [inner.mapPins, region.keywords],
  )
  const lootIdsFromPins = new Set(pins.map(p => p.treasuryLootId).filter(Boolean) as string[])
  const treasuryHits = useMemo(() => {
    const direct = inner.treasury.filter(l => lootMatchesRegion(l, region.keywords))
    const linked = inner.treasury.filter(l => lootIdsFromPins.has(l.id))
    const map = new Map<string, TreasuryLoot>()
    for (const t of [...direct, ...linked]) map.set(t.id, t)
    return [...map.values()]
  }, [inner.treasury, pins, region.keywords])

  const chartRows = useMemo(() => {
    const days = lastNDays(14)
    const pom = loadPomodoroLog()
    const ledger = loadLedgerStore()
    const entries = activeLedgerEntries(ledger.entries)
    const lens = loadEmotionalLens()
    const joyHint = [lens.present_joy, lens.past_joy].join(' ').length

    const byDayPom: Record<string, number> = {}
    for (const e of pom.entries) {
      byDayPom[e.date] = (byDayPom[e.date] ?? 0) + (e.minutes ?? 0)
    }
    const byDayExp: Record<string, number> = {}
    const byDayInc: Record<string, number> = {}
    for (const e of entries) {
      const k = e.date.slice(0, 10)
      if (e.flow === 'expense') byDayExp[k] = (byDayExp[k] ?? 0) + e.amount
      else byDayInc[k] = (byDayInc[k] ?? 0) + e.amount
    }

    return days.map(d => {
      const focusMin = byDayPom[d] ?? 0
      const expense = Math.round(byDayExp[d] ?? 0)
      const income = Math.round(byDayInc[d] ?? 0)
      const happiness = Math.min(100, Math.round(focusMin * 1.2 + (joyHint > 0 ? 8 : 0)))
      return {
        d: d.slice(5),
        focusMin,
        expense,
        income,
        happiness,
      }
    })
  }, [tick])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        style={{
          padding: 14,
          borderRadius: 12,
          background: 'linear-gradient(145deg, #0f172a 0%, #1e1b4b 55%, #0f172a 100%)',
          border: '1px solid rgba(99,102,241,0.35)',
          color: '#e2e8f0',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: '#a5b4fc', marginBottom: 6 }}>
          INTEGRATED ANALYTICS
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>예언자의 거울</div>
        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
          최근 14일: 포모도로(집중 분), 가계부 수입·지출, 행복도는 집중 시간·감정 보드 텍스트를 반영한 추정치입니다.
        </div>
        <div style={{ width: '100%', height: 300, marginTop: 14 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="d" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="right" dataKey="expense" name="지출" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="income" name="수입" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Line yAxisId="left" type="monotone" dataKey="focusMin" name="집중(분)" stroke="#38bdf8" strokeWidth={2} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="happiness" name="행복 추정" stroke="#fbbf24" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div
        style={{
          padding: 14,
          borderRadius: 12,
          background: '#fffefb',
          border: '1px solid rgba(120,113,108,0.28)',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, color: '#292524', marginBottom: 8 }}>지도·테마 연동 필터</div>
        <p style={{ fontSize: 12, color: '#57534e', margin: '0 0 10px', lineHeight: 1.5 }}>
          Library 핀의 <strong>themeTags</strong>와 Treasury 제목·메모를 검색합니다. 사우디아라비아 예시는 태그에 &quot;사우디&quot; 등을 넣어 두면 집계됩니다.
        </p>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#44403c' }}>
          지역 프리셋{' '}
          <select
            value={regionId}
            onChange={e => setRegionId(e.target.value)}
            style={{ marginLeft: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)' }}
          >
            {REGION_PRESETS.map(r => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Library 핀 ({pins.length})</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 220, overflowY: 'auto', fontSize: 12 }}>
              {pins.map(p => (
                <li
                  key={p.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontWeight: 800 }}>{p.title}</div>
                  <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>{p.themeTags.join(', ') || '태그 없음'}</div>
                  {p.body ? (
                    <div style={{ marginTop: 6, color: '#475569', whiteSpace: 'pre-wrap', maxHeight: 64, overflow: 'hidden' }}>{p.body}</div>
                  ) : null}
                </li>
              ))}
              {pins.length === 0 ? <li style={{ color: '#78716c' }}>해당 키워드와 맞는 핀이 없습니다.</li> : null}
            </ul>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Treasury ({treasuryHits.length})</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 220, overflowY: 'auto', fontSize: 12 }}>
              {treasuryHits.map(t => (
                <li
                  key={t.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: '#fff7ed',
                    border: '1px solid #fed7aa',
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontWeight: 800 }}>{t.title}</div>
                  <div style={{ color: '#9a3412', fontSize: 10, wordBreak: 'break-all' }}>{t.url}</div>
                  {t.memo ? <div style={{ marginTop: 4, color: '#57534e' }}>{t.memo}</div> : null}
                </li>
              ))}
              {treasuryHits.length === 0 ? <li style={{ color: '#78716c' }}>해당 키워드와 맞는 전리품이 없습니다.</li> : null}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
