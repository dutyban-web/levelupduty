/**
 * Account — 통합 가계부 (범용 틀 + Travel 로컬 지출 가져오기)
 */
import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { fetchTravelEvents, type TravelTripRow } from './supabase'
import { isSupabaseReady } from './lib/supabase'
import {
  loadLedgerStore,
  saveLedgerStore,
  upsertLedgerEntry,
  deleteLedgerEntry,
  activeLedgerEntries,
  importAllTravelExpensesFromLocal,
  summarizeMonth,
  categoryLabel,
  type LedgerStore,
  type LedgerEntry,
  type LedgerFlow,
} from './accountLedgerData'

function useIsMobile(): boolean {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return m
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function currentMonthStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

function formatWon(n: number): string {
  return n.toLocaleString('ko-KR')
}

export function AccountLedgerPage() {
  const isMobile = useIsMobile()
  const [store, setStore] = useState<LedgerStore>(() => loadLedgerStore())
  const [month, setMonth] = useState(currentMonthStr)
  const [tagFilter, setTagFilter] = useState<string>('')
  const [trips, setTrips] = useState<TravelTripRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [formAmount, setFormAmount] = useState('')
  const [formFlow, setFormFlow] = useState<LedgerFlow>('expense')
  const [formCategoryId, setFormCategoryId] = useState('food')
  const [formMemo, setFormMemo] = useState('')
  const [formTags, setFormTags] = useState('')

  useEffect(() => {
    if (!isSupabaseReady) return
    fetchTravelEvents().then(setTrips).catch(() => setTrips([]))
  }, [])

  const catsForFlow = useMemo(
    () => store.categories.filter(c => !c.scope || c.scope === 'both' || c.scope === formFlow),
    [store.categories, formFlow],
  )

  const activeEntries = useMemo(() => activeLedgerEntries(store.entries), [store.entries])

  const filteredEntries = useMemo(() => {
    let list = activeEntries.filter(e => e.date.startsWith(month))
    if (tagFilter) list = list.filter(e => e.tags.includes(tagFilter))
    return [...list].sort((a, b) => (a.date === b.date ? b.updatedAt.localeCompare(a.updatedAt) : b.date.localeCompare(a.date)))
  }, [activeEntries, month, tagFilter])

  const summary = useMemo(() => summarizeMonth(activeEntries, month), [activeEntries, month])

  const allTags = useMemo(() => {
    const s = new Set<string>()
    for (const e of activeEntries) for (const t of e.tags) if (t) s.add(t)
    return [...s].sort()
  }, [activeEntries])

  const persist = useCallback((next: LedgerStore) => {
    setStore(next)
    saveLedgerStore(next)
  }, [])

  const resetForm = () => {
    setEditingId(null)
    setFormDate(new Date().toISOString().slice(0, 10))
    setFormAmount('')
    setFormFlow('expense')
    setFormCategoryId('food')
    setFormMemo('')
    setFormTags('')
  }

  const submitForm = () => {
    const raw = formAmount.replace(/,/g, '').trim()
    const amt = Math.abs(Number(raw))
    if (!raw || Number.isNaN(amt) || amt <= 0) return
    const tags = formTags.split(/[,#\s]+/).map(t => t.trim()).filter(Boolean)
    const next = upsertLedgerEntry(store, {
      id: editingId ?? undefined,
      date: formDate.slice(0, 10),
      amount: amt,
      flow: formFlow,
      categoryId: formCategoryId,
      memo: formMemo.trim(),
      tags,
      source: { kind: 'manual' },
    })
    persist(next)
    resetForm()
  }

  const startEdit = (e: LedgerEntry) => {
    if (e.source.kind === 'travel') return
    setEditingId(e.id)
    setFormDate(e.date)
    setFormAmount(String(e.amount))
    setFormFlow(e.flow)
    setFormCategoryId(e.categoryId)
    setFormMemo(e.memo)
    setFormTags(e.tags.join(' '))
  }

  const remove = (id: string) => {
    if (!window.confirm('이 거래를 삭제할까요?')) return
    persist(deleteLedgerEntry(store, id))
    if (editingId === id) resetForm()
  }

  const runTravelImport = async () => {
    setImporting(true)
    setImportMsg(null)
    try {
      let labels: Record<string, string> = {}
      if (trips.length > 0) for (const t of trips) labels[t.id] = t.title || t.id
      else {
        const raw = localStorage.getItem('creative_os_travel_trip_detail_v1')
        if (raw) {
          const all = JSON.parse(raw) as Record<string, unknown>
          labels = Object.fromEntries(Object.keys(all).map(id => [id, id]))
        }
      }
      const { next, added, skipped } = importAllTravelExpensesFromLocal(store, labels)
      setStore(next)
      saveLedgerStore(next)
      setImportMsg(`가져옴 ${added}건 · 건너뜀(중복) ${skipped}건`)
    } catch {
      setImportMsg('가져오기에 실패했습니다.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '18px 14px 32px' : '28px 44px 48px' }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#6366f1', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Account</p>
        <h1 style={{ margin: '6px 0 8px', fontSize: 24, fontWeight: 900, color: '#37352F' }}>통합 가계부</h1>
        <p style={{ margin: 0, fontSize: 13, color: '#787774', lineHeight: 1.6, maxWidth: 720 }}>
          수입·지출을 한곳에 모읍니다. <strong>Travel</strong> 메뉴의 여행별 가계부는 로컬에 저장된 지출을 여기로 가져와{' '}
          <span style={{ color: '#6366f1', fontWeight: 600 }}>태그 <code style={{ fontSize: 11 }}>travel</code></span>로 묶입니다. DB 스키마는 나중에{' '}
          <code style={{ fontSize: 11, background: '#f4f4f2', padding: '2px 6px', borderRadius: 4 }}>ledger_entries</code> 등으로 옮기기 쉽게 설계했습니다.
        </p>
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <Link to="/travel" style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', textDecoration: 'none' }}>
            Travel로 이동 →
          </Link>
        </div>
      </div>

      {/* 요약 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: `${month} 지출`, value: summary.expense, color: '#ef4444', bg: 'rgba(239,68,68,0.06)' },
          { label: `${month} 수입`, value: summary.income, color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
          { label: '순액 (수입−지출)', value: summary.income - summary.expense, color: '#37352F', bg: 'rgba(99,102,241,0.06)' },
        ].map((b, i) => (
          <div
            key={i}
            style={{
              borderRadius: 16,
              border: '1px solid rgba(0,0,0,0.06)',
              background: '#fff',
              padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#9B9A97', letterSpacing: '0.06em' }}>{b.label}</p>
            <p style={{ margin: '8px 0 0', fontSize: 22, fontWeight: 900, color: b.color }}>{formatWon(b.value)}원</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '340px 1fr', gap: 24, alignItems: 'start' }}>
        {/* 입력 폼 */}
        <div
          style={{
            borderRadius: 16,
            border: '1px solid rgba(0,0,0,0.06)',
            background: '#fff',
            padding: 20,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800, color: '#37352F' }}>{editingId ? '거래 수정' : '거래 추가'}</h2>
          <label style={{ display: 'block', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#787774' }}>날짜</span>
            <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={inp} />
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {(['expense', 'income'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFormFlow(f)
                  const first = store.categories.find(c => !c.scope || c.scope === 'both' || c.scope === f)
                  if (first) setFormCategoryId(first.id)
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 10,
                  border: formFlow === f ? `2px solid ${f === 'expense' ? '#ef4444' : '#22c55e'}` : '1px solid rgba(0,0,0,0.08)',
                  background: formFlow === f ? (f === 'expense' ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.08)') : '#fff',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                  color: f === 'expense' ? '#b91c1c' : '#15803d',
                }}
              >
                {f === 'expense' ? '지출' : '수입'}
              </button>
            ))}
          </div>
          <label style={{ display: 'block', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#787774' }}>금액 (원)</span>
            <input
              value={formAmount}
              onChange={e => setFormAmount(e.target.value)}
              placeholder="10000"
              inputMode="numeric"
              style={inp}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#787774' }}>카테고리</span>
            <select value={formCategoryId} onChange={e => setFormCategoryId(e.target.value)} style={inp}>
              {catsForFlow.map(c => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'block', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#787774' }}>메모</span>
            <input value={formMemo} onChange={e => setFormMemo(e.target.value)} placeholder="내용" style={inp} />
          </label>
          <label style={{ display: 'block', marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#787774' }}>태그 (공백·쉼표)</span>
            <input value={formTags} onChange={e => setFormTags(e.target.value)} placeholder="예: travel 프로젝트A" style={inp} />
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={submitForm}
              style={{
                padding: '11px 20px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                color: '#fff',
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {editingId ? '저장' : '추가'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} style={{ padding: '11px 16px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#787774' }}>
                취소
              </button>
            )}
          </div>
        </div>

        {/* 목록 + 필터 */}
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#37352F' }}>
              월{' '}
              <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...inp, width: 140, marginLeft: 6 }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#37352F' }}>
              태그
              <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} style={{ ...inp, width: 140, marginLeft: 6 }}>
                <option value="">전체</option>
                {allTags.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Travel 가져오기 */}
          <div
            style={{
              marginBottom: 18,
              padding: 16,
              borderRadius: 14,
              border: '1px dashed rgba(99,102,241,0.35)',
              background: 'rgba(99,102,241,0.04)',
            }}
          >
            <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: '#4F46E5' }}>Travel 연동</p>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#787774', lineHeight: 1.5 }}>
              로컬에 저장된 각 여행의 가계부 지출을 가져옵니다. 이미 가져온 항목은 건너뜁니다.
            </p>
            <button
              type="button"
              disabled={importing}
              onClick={runTravelImport}
              style={{
                padding: '10px 18px',
                borderRadius: 10,
                border: 'none',
                background: importing ? '#cbd5e1' : '#4F46E5',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                cursor: importing ? 'wait' : 'pointer',
              }}
            >
              {importing ? '가져오는 중…' : 'Travel 지출 일괄 가져오기'}
            </button>
            {importMsg && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#059669', fontWeight: 600 }}>{importMsg}</p>}
          </div>

          <div style={{ borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', background: '#fff', overflow: 'auto' }}>
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={th}>날짜</th>
                  <th style={th}>구분</th>
                  <th style={th}>카테고리</th>
                  <th style={{ ...th, textAlign: 'right' }}>금액</th>
                  <th style={th}>메모 · 출처</th>
                  <th style={{ ...th, width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 36, textAlign: 'center', color: '#9B9A97' }}>
                      이 달에 기록이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={td}>{e.date}</td>
                      <td style={td}>
                        <span style={{ fontWeight: 800, color: e.flow === 'expense' ? '#dc2626' : '#16a34a' }}>{e.flow === 'expense' ? '지출' : '수입'}</span>
                      </td>
                      <td style={td}>{categoryLabel(store, e.categoryId)}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: e.flow === 'expense' ? '#b91c1c' : '#15803d' }}>{formatWon(e.amount)}원</td>
                      <td style={td}>
                        <div style={{ maxWidth: 280 }}>{e.memo}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                          {e.source.kind === 'travel' ? `🔗 Travel · ${e.source.tripLabel ?? e.source.tripId}` : '✍️ 직접 입력'}
                          {e.tags.length > 0 && <span> · #{e.tags.join(' #')}</span>}
                        </div>
                      </td>
                      <td style={td}>
                        <button type="button" onClick={() => startEdit(e)} disabled={e.source.kind === 'travel'} style={{ marginRight: 6, padding: '4px 8px', fontSize: 11, borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: e.source.kind === 'travel' ? 'not-allowed' : 'pointer', opacity: e.source.kind === 'travel' ? 0.4 : 1 }}>
                          수정
                        </button>
                        <button type="button" onClick={() => remove(e.id)} style={{ padding: '4px 8px', fontSize: 11, borderRadius: 6, border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.06)', color: '#dc2626', cursor: 'pointer' }}>
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p style={{ marginTop: 28, fontSize: 11, color: '#AEAAA4', lineHeight: 1.6 }}>
        스키마 확장 시: <code>ledger_entries</code> 테이블에 <code>source_type</code>, <code>external_ref</code>(travel trip_id + expense_id) 컬럼을 두면 현재 구조와 1:1 매핑됩니다.
      </p>
    </div>
  )
}

const inp: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 4,
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid rgba(0,0,0,0.08)',
  background: '#fafafa',
  fontSize: 14,
  color: '#37352F',
}

const th: CSSProperties = { padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#64748b' }
const td: CSSProperties = { padding: '12px 14px', verticalAlign: 'top', color: '#37352F' }
