import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  type NetworkContact,
  type NetworkBenefitId,
  BENEFIT_OPTIONS,
  loadNetworkStore,
  saveNetworkStore,
  upsertContact,
  deleteContact,
  newContactId,
  countByBenefit,
} from './networkData'
import { blockNoteToPlainPreview } from './manifestNoteUtils'
import { NetworkContactDetail } from './NetworkContactDetail'
import { NetworkHumanRelationsSection } from './NetworkHumanRelationsSection'

export function NetworkPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const contactId = searchParams.get('contact')

  const [store, setStore] = useState(loadNetworkStore)
  const [filterBenefit, setFilterBenefit] = useState<NetworkBenefitId | 'all'>('all')

  const persist = useCallback((updater: (prev: typeof store) => typeof store) => {
    setStore(prev => {
      const next = updater(prev)
      saveNetworkStore(next)
      return next
    })
  }, [])

  const counts = useMemo(() => countByBenefit(store.contacts), [store.contacts])

  const filtered = useMemo(() => {
    if (filterBenefit === 'all') return store.contacts
    return store.contacts.filter(c => c.benefits.includes(filterBenefit))
  }, [store.contacts, filterBenefit])

  const selected = useMemo(
    () => (contactId ? store.contacts.find(c => c.id === contactId) ?? null : null),
    [store.contacts, contactId],
  )

  useEffect(() => {
    if (contactId && !selected) {
      navigate('/network', { replace: true })
    }
  }, [contactId, selected, navigate])

  function openCreate() {
    const id = newContactId()
    persist(prev => upsertContact(prev, { id, name: '새 연락처' }))
    navigate(`/network?contact=${encodeURIComponent(id)}`)
  }

  const handlePersist = useCallback(
    (c: NetworkContact) => {
      persist(prev => upsertContact(prev, c))
    },
    [persist],
  )

  const handleDelete = useCallback(
    (id: string) => {
      persist(prev => deleteContact(prev, id))
    },
    [persist],
  )

  if (selected) {
    return (
      <NetworkContactDetail
        key={selected.id}
        contact={selected}
        onBack={() => navigate('/network', { replace: true })}
        onPersist={handlePersist}
        onDelete={handleDelete}
      />
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-10 py-8 pb-16 space-y-8">
        {/* 카드 1: 인명부 (연락처 목록) — 참고 UI: 보라 라벨 + 제목 + 설명 + 본문 */}
        <section className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-md shadow-slate-300/40 border-l-[5px] border-l-indigo-500">
          <header className="mb-6 sm:mb-8">
            <span className="text-[10px] font-extrabold text-indigo-600 tracking-[0.2em]">NETWORK · ROSTER</span>
            <h1 className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">인명부</h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-2xl m-0">
              인적 자원을 전략적으로 기록합니다. 카드를 열면{' '}
              <strong className="text-indigo-600">속성 패널 · 노션형 본문 · 히스토리 타임라인</strong>을 사용할 수 있어요. 데이터는 브라우저에 저장되며, 히스토리
              날짜는 Supabase 연결 시 통합 캘린더에도 반영됩니다.
            </p>
          </header>

          <section className="mb-5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">가치 유형별</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilterBenefit('all')}
                className={`px-3 py-2 rounded-full text-xs font-bold border transition-colors ${filterBenefit === 'all' ? 'border-indigo-500 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
              >
                전체 {store.contacts.length}
              </button>
              {BENEFIT_OPTIONS.map(o => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setFilterBenefit(o.id)}
                  className={`px-3 py-2 rounded-full text-xs font-bold border transition-colors ${filterBenefit === o.id ? 'border-indigo-500 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
                >
                  {o.emoji} {o.short} <span className="text-indigo-600">{counts[o.id]}</span>
                </button>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
            <p className="text-sm text-slate-500 m-0">
              {filterBenefit === 'all' ? `총 ${filtered.length}명` : `필터: ${BENEFIT_OPTIONS.find(b => b.id === filterBenefit)?.label} · ${filtered.length}명`}
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="px-5 py-2.5 rounded-full text-sm font-bold text-white bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-lg shadow-indigo-500/30 hover:opacity-95"
            >
              + 사람 추가
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 px-6 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/80">
              <p className="text-slate-600 m-0">아직 명부가 비어 있어요. 인맥을 한 명씩 쌓아 보세요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {filtered.map(c => {
                const raw = c.bodyBlocksJson || c.memo
                const preview = blockNoteToPlainPreview(raw, 140)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigate(`/network?contact=${encodeURIComponent(c.id)}`)}
                    className="text-left rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 shadow-sm hover:shadow-md hover:border-indigo-200 hover:bg-white transition-all"
                  >
                    <div className="flex justify-between gap-2 items-start">
                      <div className="min-w-0">
                        <p className="text-lg font-extrabold text-slate-900 m-0 truncate">{c.name}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {[c.roleTitle, c.org].filter(Boolean).join(' · ') || '직함·소속 미입력'}
                        </p>
                      </div>
                      <span className="text-[11px] font-extrabold text-indigo-600 shrink-0">Lv.{c.strength}</span>
                    </div>
                    {c.relationship && (
                      <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                        <span className="text-slate-400">관계</span> {c.relationship}
                      </p>
                    )}
                    {c.benefits.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {c.benefits.map(bid => {
                          const o = BENEFIT_OPTIONS.find(x => x.id === bid)
                          return (
                            <span key={bid} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                              {o?.emoji} {o?.short}
                            </span>
                          )
                        })}
                      </div>
                    )}
                    {(preview || c.valueToMe) && (
                      <p className="text-xs text-slate-700 mt-2 line-clamp-3 leading-relaxed">
                        {preview || c.valueToMe}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* 카드 2: 인간관계론 — 별도 카드로 분리 (보라색 강조) */}
        <NetworkHumanRelationsSection />
      </div>
    </div>
  )
}
