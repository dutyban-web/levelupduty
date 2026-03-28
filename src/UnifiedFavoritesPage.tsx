/**
 * 데이터 창고 — 통합 즐겨찾기
 * 여러 화면에서 별표로 모은 항목을 카드 그리드로 확인합니다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, RefreshCw, Trash2 } from 'lucide-react'
import {
  loadUnifiedFavoritesStore,
  removeUnifiedFavorite,
  unifiedFavoriteKindLabel,
  type UnifiedFavoriteEntry,
  type UnifiedFavoriteKind,
} from './unifiedFavorites'
import { enrichUnifiedFavoritesFromSources } from './unifiedFavoritesEnrich'

export default function UnifiedFavoritesPage({ refreshKey = 0 }: { refreshKey?: number }) {
  const [items, setItems] = useState<UnifiedFavoriteEntry[]>(() => loadUnifiedFavoritesStore().items)
  const [kindFilter, setKindFilter] = useState<UnifiedFavoriteKind | 'all'>('all')
  const [enriching, setEnriching] = useState(false)
  const [enrichHint, setEnrichHint] = useState<string | null>(null)

  const reload = useCallback(() => {
    setItems(loadUnifiedFavoritesStore().items)
  }, [])

  useEffect(() => {
    reload()
  }, [reload, refreshKey])

  const kindsInUse = useMemo(() => {
    const s = new Set<UnifiedFavoriteKind>()
    for (const it of items) s.add(it.kind)
    return [...s].sort((a, b) => unifiedFavoriteKindLabel(a).localeCompare(unifiedFavoriteKindLabel(b), 'ko'))
  }, [items])

  const filtered = useMemo(() => {
    if (kindFilter === 'all') return items
    return items.filter(x => x.kind === kindFilter)
  }, [items, kindFilter])

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [filtered],
  )

  const onRemove = (e: UnifiedFavoriteEntry) => {
    if (!confirm('이 항목을 즐겨찾기에서 제거할까요?')) return
    removeUnifiedFavorite(e.kind, e.refId)
    reload()
  }

  const onEnrich = async () => {
    setEnriching(true)
    setEnrichHint(null)
    try {
      const { updated, store } = await enrichUnifiedFavoritesFromSources()
      setItems(store.items)
      setEnrichHint(updated > 0 ? `${updated}개 항목의 제목·링크를 최신으로 맞췄습니다.` : '이미 최신 상태입니다.')
    } catch (err) {
      console.error('[통합 즐겨찾기]', err)
      setEnrichHint('불러오기에 실패했습니다.')
    } finally {
      setEnriching(false)
    }
  }

  return (
    <div
      style={{
        maxWidth: 1100,
        padding: '20px 22px',
        borderRadius: 14,
        border: '1px solid rgba(99,102,241,0.22)',
        background: 'linear-gradient(145deg, rgba(245,158,11,0.06) 0%, rgba(255,255,255,0.98) 45%)',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: '#37352F', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bookmark size={20} className="text-amber-600" aria-hidden />
            즐겨찾기
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: '#787774', lineHeight: 1.6 }}>
            Manual·작업 순서도·인물 등에서 <strong style={{ color: '#b45309' }}>별표</strong>로 넣은 항목이 여기 모입니다.
            Board → 데이터 창고에서 언제든 열 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          disabled={enriching || items.length === 0}
          onClick={() => void onEnrich()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.1)',
            background: '#fff',
            fontSize: 12,
            fontWeight: 700,
            color: enriching ? '#94a3b8' : '#4F46E5',
            cursor: enriching || items.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={14} className={enriching ? 'animate-spin' : ''} aria-hidden />
          메타 새로고침
        </button>
      </div>

      {enrichHint && (
        <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 600, color: '#b45309' }}>{enrichHint}</p>
      )}

      {items.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: '0.06em' }}>구분</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              onClick={() => setKindFilter('all')}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                border: kindFilter === 'all' ? '2px solid #6366f1' : '1px solid rgba(0,0,0,0.1)',
                background: kindFilter === 'all' ? 'rgba(99,102,241,0.12)' : '#fff',
                color: kindFilter === 'all' ? '#4F46E5' : '#64748b',
                fontSize: 12,
                fontWeight: kindFilter === 'all' ? 800 : 600,
                cursor: 'pointer',
              }}
            >
              전체 ({items.length})
            </button>
            {kindsInUse.map(k => {
              const n = items.filter(x => x.kind === k).length
              const active = kindFilter === k
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKindFilter(k)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    border: active ? '2px solid #6366f1' : '1px solid rgba(0,0,0,0.1)',
                    background: active ? 'rgba(99,102,241,0.12)' : '#fff',
                    color: active ? '#4F46E5' : '#64748b',
                    fontSize: 12,
                    fontWeight: active ? 800 : 600,
                    cursor: 'pointer',
                  }}
                >
                  {unifiedFavoriteKindLabel(k)} ({n})
                </button>
              )
            })}
          </div>
        </div>
      )}

      {sorted.length === 0 && items.length > 0 && (
        <p style={{ margin: '12px 0', fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>이 구분에 해당하는 항목이 없습니다.</p>
      )}

      {items.length === 0 && (
        <div
          style={{
            padding: '24px 16px',
            borderRadius: 12,
            background: 'rgba(0,0,0,0.03)',
            border: '1px dashed rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}
        >
          <Bookmark size={28} color="#a8a29e" style={{ marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#57534e' }}>아직 즐겨찾기가 없습니다</p>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#787774', lineHeight: 1.5 }}>
            <Link to="/manual" style={{ color: '#4F46E5', fontWeight: 700 }}>Manual</Link> 문서,{' '}
            <Link to="/value" style={{ color: '#4F46E5', fontWeight: 700 }}>Value</Link> 순서도, 인물 등에서 별표를 눌러 추가해 보세요.
          </p>
        </div>
      )}

      {sorted.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 10,
          }}
        >
          {sorted.map(e => (
            <div
              key={e.id}
              style={{
                position: 'relative',
                aspectRatio: '1',
                borderRadius: 14,
                border: '1px solid rgba(0,0,0,0.08)',
                background: '#fff',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                minHeight: 0,
                overflow: 'hidden',
                transition: 'box-shadow 0.15s, border-color 0.15s',
              }}
              onMouseEnter={ev => {
                ev.currentTarget.style.boxShadow = '0 4px 14px rgba(99,102,241,0.15)'
                ev.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'
              }}
              onMouseLeave={ev => {
                ev.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'
                ev.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'
              }}
            >
              <button
                type="button"
                aria-label="즐겨찾기에서 제거"
                title="제거"
                onClick={ev => {
                  ev.preventDefault()
                  ev.stopPropagation()
                  onRemove(e)
                }}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 5,
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.06)',
                  background: 'rgba(255,255,255,0.92)',
                  color: '#dc2626',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                }}
              >
                <Trash2 size={13} aria-hidden />
              </button>
              <Link
                to={e.href}
                style={{
                  boxSizing: 'border-box',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '12px 10px',
                  textDecoration: 'none',
                  color: 'inherit',
                  minHeight: 0,
                  overflow: 'hidden',
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
                  {unifiedFavoriteKindLabel(e.kind)}
                </span>
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
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
                      textAlign: 'center',
                      width: '100%',
                    }}
                  >
                    {e.title}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#94a3b8',
                    marginTop: 6,
                    lineHeight: 1.2,
                    flexShrink: 0,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    wordBreak: 'break-word',
                  }}
                >
                  {e.subtitle?.trim() || '—'}
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
                  <Bookmark size={13} fill="#fbbf24" color="#f59e0b" aria-hidden />
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      <p style={{ margin: '18px 0 0', fontSize: 11, color: '#a8a29e', lineHeight: 1.5 }}>
        즐겨찾기는 이 브라우저에 저장되며, 로그인 시 서버와 동기화될 수 있습니다.
      </p>
    </div>
  )
}
