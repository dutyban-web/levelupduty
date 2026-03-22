/**
 * 데이터 창고 — 통합 레이팅 허브
 * 레이팅이 있는 항목을 작은 정사각형 카드로 모아 보고, 별점으로 필터합니다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Star } from 'lucide-react'
import { fetchManualDocuments, type ManualDocumentRow } from './supabase'

type RatedRow = {
  id: string
  kind: 'manual'
  kindLabel: string
  title: string
  subtitle: string
  rating: number
  href: string
  updatedAt: string
}

/** 0.5 단위, 최고 5 — 필터 옵션 */
/** 낮은 점수(왼쪽) → 높은 점수(오른쪽) */
const STAR_FILTERS = ['all', 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const
type StarFilter = (typeof STAR_FILTERS)[number]

function filterLabel(f: StarFilter): string {
  if (f === 'all') return '전체'
  return `${f}점`
}

export default function UnifiedOverallRatingPage() {
  const [manualDocs, setManualDocs] = useState<ManualDocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [starFilter, setStarFilter] = useState<StarFilter>('all')

  const refresh = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const list = await fetchManualDocuments()
      setManualDocs(list)
    } catch (e) {
      console.error('[통합 레이팅 허브]', e)
      setErr('목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const rows = useMemo((): RatedRow[] => {
    const out: RatedRow[] = []
    for (const d of manualDocs) {
      if (d.rating > 0) {
        const cat = d.category?.trim()
        out.push({
          id: `manual-${d.id}`,
          kind: 'manual',
          kindLabel: 'Manual',
          title: d.title?.trim() || '제목 없음',
          subtitle: cat || '문서',
          rating: d.rating,
          href: `/manual/${d.id}`,
          updatedAt: d.updated_at,
        })
      }
    }
    out.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    return out
  }, [manualDocs])

  const filtered = useMemo(() => {
    if (starFilter === 'all') return rows
    return rows.filter(r => r.rating === starFilter)
  }, [rows, starFilter])

  const stats = useMemo(() => {
    if (rows.length === 0) return { avg: 0, count: 0 }
    const sum = rows.reduce((s, r) => s + r.rating, 0)
    return { avg: Math.round((sum / rows.length) * 10) / 10, count: rows.length }
  }, [rows])

  const countsByStar = useMemo(() => {
    const m = new Map<number, number>()
    for (const r of rows) {
      m.set(r.rating, (m.get(r.rating) ?? 0) + 1)
    }
    return m
  }, [rows])

  return (
    <div
      style={{
        maxWidth: 1100,
        padding: '20px 22px',
        borderRadius: 14,
        border: '1px solid rgba(99,102,241,0.22)',
        background: 'linear-gradient(145deg, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0.98) 50%)',
      }}
    >
      <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: '#37352F' }}>
        통합 레이팅
      </h3>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: '#787774', lineHeight: 1.6 }}>
        데이터에 붙은 별점을 <strong style={{ color: '#4F46E5' }}>카드</strong>로 모아 보입니다. 아래에서{' '}
        <strong style={{ color: '#4F46E5' }}>별점</strong>을 고르면 해당 점수만 골라 볼 수 있습니다.
      </p>

      {!loading && rows.length > 0 && (
        <div
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'rgba(251,191,36,0.1)',
            border: '1px solid rgba(251,191,36,0.3)',
            fontSize: 12,
            fontWeight: 700,
            color: '#92400e',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px 14px',
          }}
        >
          <span>
            <Star size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} aria-hidden />
            전체 <strong>{stats.count}</strong>개 · 평균 <strong>{stats.avg}</strong> / 5
          </span>
          {starFilter !== 'all' && (
            <span style={{ color: '#b45309' }}>
              표시 중: <strong>{filtered.length}</strong>개 ({filterLabel(starFilter)})
            </span>
          )}
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: '0.06em' }}>
            별점 필터
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
            }}
          >
            {STAR_FILTERS.map(f => {
              const count = f === 'all' ? rows.length : (countsByStar.get(f) ?? 0)
              const active = starFilter === f
              const disabled = f !== 'all' && count === 0
              return (
                <button
                  key={String(f)}
                  type="button"
                  disabled={disabled}
                  onClick={() => setStarFilter(f)}
                  title={disabled ? '해당 점수 없음' : undefined}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    border: active ? '2px solid #6366f1' : '1px solid rgba(0,0,0,0.1)',
                    background: active ? 'rgba(99,102,241,0.12)' : '#fff',
                    color: disabled ? '#cbd5e1' : active ? '#4F46E5' : '#64748b',
                    fontSize: 12,
                    fontWeight: active ? 800 : 600,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {f === 'all' ? '전체' : `${f}점`}
                  <span style={{ opacity: 0.75, marginLeft: 4 }}>({count})</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {loading && (
        <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>불러오는 중…</p>
      )}
      {err && (
        <p style={{ margin: '0 0 8px', fontSize: 13, color: '#dc2626' }}>{err}</p>
      )}

      {!loading && !err && rows.length === 0 && (
        <div
          style={{
            padding: '20px 16px',
            borderRadius: 12,
            background: 'rgba(0,0,0,0.03)',
            border: '1px dashed rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}
        >
          <BookOpen size={28} color="#a8a29e" style={{ marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#57534e' }}>
            아직 표시할 레이팅이 없습니다
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#787774', lineHeight: 1.5 }}>
            <Link to="/manual" style={{ color: '#4F46E5', fontWeight: 700 }}>
              Manual
            </Link>
            에서 문서 속성의 레이팅을 설정하면 카드로 모입니다.
          </p>
        </div>
      )}

      {!loading && rows.length > 0 && filtered.length === 0 && (
        <p style={{ margin: '12px 0', fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
          선택한 별점에 해당하는 항목이 없습니다. 필터를 바꿔 보세요.
        </p>
      )}

      {!loading && filtered.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
            gap: 12,
          }}
        >
          {filtered.map(r => (
            <Link
              key={r.id}
              to={r.href}
              style={{
                aspectRatio: '1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '12px 10px',
                borderRadius: 14,
                border: '1px solid rgba(0,0,0,0.08)',
                background: '#fff',
                textDecoration: 'none',
                color: 'inherit',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'box-shadow 0.15s, border-color 0.15s',
                minHeight: 0,
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(99,102,241,0.15)'
                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'
                e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#94a3b8',
                  marginBottom: 6,
                  lineHeight: 1.2,
                  flexShrink: 0,
                }}
              >
                {r.kindLabel}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#1e293b',
                  lineHeight: 1.25,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                  flex: 1,
                  minHeight: 0,
                  alignContent: 'center',
                }}
              >
                {r.title}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#94a3b8',
                  marginTop: 6,
                  lineHeight: 1.2,
                  flexShrink: 0,
                }}
              >
                {r.subtitle}
              </span>
              <div
                style={{
                  marginTop: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  flexShrink: 0,
                }}
              >
                <Star size={13} fill="#fbbf24" color="#fbbf24" aria-hidden />
                <span style={{ fontSize: 12, fontWeight: 800, color: '#b45309' }}>{r.rating}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p style={{ margin: '18px 0 0', fontSize: 11, color: '#a8a29e', lineHeight: 1.5 }}>
        퀘스트·트래커 등 다른 모듈 레이팅이 붙으면 같은 그리드에 합류할 수 있습니다.
      </p>
    </div>
  )
}
