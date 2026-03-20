import { useState, useMemo, useCallback, type CSSProperties } from 'react'
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

const emptyForm = (): Omit<NetworkContact, 'createdAt' | 'updatedAt'> => ({
  id: '',
  name: '',
  roleTitle: '',
  org: '',
  relationship: '',
  theirNetwork: '',
  valueToMe: '',
  benefits: [],
  strength: 3,
  memo: '',
})

export function NetworkPage() {
  const [store, setStore] = useState(loadNetworkStore)
  const [filterBenefit, setFilterBenefit] = useState<NetworkBenefitId | 'all'>('all')
  const [editing, setEditing] = useState<NetworkContact | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [creating, setCreating] = useState(false)

  const persist = useCallback((next: typeof store) => {
    setStore(next)
    saveNetworkStore(next)
  }, [])

  const counts = useMemo(() => countByBenefit(store.contacts), [store.contacts])

  const filtered = useMemo(() => {
    if (filterBenefit === 'all') return store.contacts
    return store.contacts.filter(c => c.benefits.includes(filterBenefit))
  }, [store.contacts, filterBenefit])

  function openCreate() {
    setCreating(true)
    setEditing(null)
    setForm({ ...emptyForm(), id: newContactId() })
  }

  function openEdit(c: NetworkContact) {
    setCreating(false)
    setEditing(c)
    setForm({
      id: c.id,
      name: c.name,
      roleTitle: c.roleTitle,
      org: c.org,
      relationship: c.relationship,
      theirNetwork: c.theirNetwork,
      valueToMe: c.valueToMe,
      benefits: [...c.benefits],
      strength: c.strength,
      memo: c.memo,
    })
  }

  function toggleBenefit(id: NetworkBenefitId) {
    setForm(f => ({
      ...f,
      benefits: f.benefits.includes(id) ? f.benefits.filter(x => x !== id) : [...f.benefits, id],
    }))
  }

  function handleSave() {
    const name = form.name.trim()
    if (!name) return
    const next = upsertContact(store, form)
    persist(next)
    setCreating(false)
    setEditing(null)
    setForm(emptyForm())
  }

  function handleDelete(id: string) {
    if (!confirm('이 사람을 명부에서 삭제할까요?')) return
    persist(deleteContact(store, id))
    if (editing?.id === id || form.id === id) {
      setEditing(null)
      setCreating(false)
      setForm(emptyForm())
    }
  }

  const isModalOpen = creating || editing !== null

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'clamp(16px, 3vw, 36px) clamp(14px, 3vw, 48px) 48px' }}>
      <header style={{ marginBottom: '24px' }}>
        <span style={{ fontSize: '10px', fontWeight: 800, color: '#6366f1', letterSpacing: '0.15em' }}>NETWORK</span>
        <h1 style={{ margin: '6px 0 8px', fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: 900, color: '#37352F' }}>Network</h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#787774', lineHeight: 1.65 }}>
          아는 사람 명부와, <strong style={{ color: '#4F46E5' }}>그 사람·그 주변 네트워크가 나에게 줄 수 있는 가치</strong>를 한곳에 모읍니다.
          로컬에만 저장되며, 이후 Supabase로 옮길 수 있게 설계했습니다.
        </p>
      </header>

      {/* 아이디어 박스 */}
      <section
        style={{
          marginBottom: '22px',
          padding: '16px 18px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(14,165,233,0.06) 100%)',
          border: '1px solid rgba(99,102,241,0.18)',
        }}
      >
        <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 800, color: '#4F46E5', letterSpacing: '0.06em' }}>설계 아이디어 (v1)</p>
        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#4B5563', lineHeight: 1.7 }}>
          <li><strong>가치 태그</strong>: 연결·조언·협업 등으로 분류해 필터 → “누구를 부를까?”를 빠르게.</li>
          <li><strong>그들의 네트워크</strong>: 상대가 아는 업계·인물을 적어 두면, <em>2-hop 인맥</em>을 계획할 때 참고.</li>
          <li><strong>나에게 이로운 점</strong>: 한 줄 요약 + 강도(1~5)로 우선순위·접촉 전략을 잡기 좋게.</li>
          <li><strong>다음 단계</strong>: 프로젝트/Quest와 링크, 마지막 연락일, 알림 등을 붙일 수 있습니다.</li>
        </ul>
      </section>

      {/* 한눈에: 혜택별 인원 */}
      <section style={{ marginBottom: '20px' }}>
        <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 800, color: '#9B9A97', letterSpacing: '0.08em' }}>한눈에 · 가치 유형별</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setFilterBenefit('all')}
            style={{
              padding: '8px 12px',
              borderRadius: '999px',
              border: filterBenefit === 'all' ? '2px solid #6366f1' : '1px solid rgba(0,0,0,0.08)',
              backgroundColor: filterBenefit === 'all' ? 'rgba(99,102,241,0.12)' : '#fff',
              fontSize: '12px',
              fontWeight: filterBenefit === 'all' ? 800 : 600,
              color: '#37352F',
              cursor: 'pointer',
            }}
          >
            전체 {store.contacts.length}
          </button>
          {BENEFIT_OPTIONS.map(o => (
            <button
              key={o.id}
              type="button"
              onClick={() => setFilterBenefit(o.id)}
              style={{
                padding: '8px 12px',
                borderRadius: '999px',
                border: filterBenefit === o.id ? '2px solid #6366f1' : '1px solid rgba(0,0,0,0.08)',
                backgroundColor: filterBenefit === o.id ? 'rgba(99,102,241,0.12)' : '#fff',
                fontSize: '12px',
                fontWeight: filterBenefit === o.id ? 800 : 600,
                color: '#37352F',
                cursor: 'pointer',
              }}
            >
              {o.emoji} {o.short} <span style={{ color: '#6366f1' }}>{counts[o.id]}</span>
            </button>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: '#787774' }}>
          {filterBenefit === 'all' ? `총 ${filtered.length}명` : `필터: ${BENEFIT_OPTIONS.find(b => b.id === filterBenefit)?.label} · ${filtered.length}명`}
        </p>
        <button
          type="button"
          onClick={openCreate}
          style={{
            padding: '10px 18px',
            borderRadius: '999px',
            border: 'none',
            background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(79,70,229,0.35)',
          }}
        >
          + 사람 추가
        </button>
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            borderRadius: '16px',
            border: '2px dashed rgba(0,0,0,0.1)',
            backgroundColor: 'rgba(0,0,0,0.02)',
          }}
        >
          <p style={{ margin: 0, fontSize: '15px', color: '#787774' }}>아직 명부가 비어 있어요. 인맥을 한 명씩 쌓아 보세요.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {filtered.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => openEdit(c)}
              style={{
                textAlign: 'left',
                padding: '18px 16px',
                borderRadius: '14px',
                border: '1px solid rgba(0,0,0,0.08)',
                backgroundColor: '#fff',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                cursor: 'pointer',
                transition: 'box-shadow 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#37352F' }}>{c.name}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#787774' }}>
                    {[c.roleTitle, c.org].filter(Boolean).join(' · ') || '직함·소속 미입력'}
                  </p>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#6366f1', flexShrink: 0 }}>Lv.{c.strength}</span>
              </div>
              {c.relationship && (
                <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#6B7280', lineHeight: 1.45 }}>
                  <span style={{ color: '#9B9A97' }}>관계</span> {c.relationship}
                </p>
              )}
              {c.benefits.length > 0 && (
                <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {c.benefits.map(bid => {
                    const o = BENEFIT_OPTIONS.find(x => x.id === bid)
                    return (
                      <span
                        key={bid}
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '999px',
                          backgroundColor: 'rgba(99,102,241,0.12)',
                          color: '#4F46E5',
                        }}
                      >
                        {o?.emoji} {o?.short}
                      </span>
                    )
                  })}
                </div>
              )}
              {c.valueToMe && (
                <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#37352F', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {c.valueToMe}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* 편집 모달 */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 800,
            backgroundColor: 'rgba(15,23,42,0.45)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '16px',
            backdropFilter: 'blur(4px)',
          }}
          onClick={e => {
            if (e.target === e.currentTarget) {
              setCreating(false)
              setEditing(null)
              setForm(emptyForm())
            }
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              maxHeight: '90vh',
              overflow: 'auto',
              borderRadius: '16px 16px 0 0',
              backgroundColor: '#fff',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
              padding: '22px 20px 28px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 800, color: '#37352F' }}>
              {creating ? '사람 추가' : '명부 수정'}
            </h2>

            <label style={lbl}>이름 *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="홍길동" style={inp} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={lbl}>직함·역할</label>
                <input value={form.roleTitle} onChange={e => setForm(f => ({ ...f, roleTitle: e.target.value }))} placeholder="PD" style={inp} />
              </div>
              <div>
                <label style={lbl}>소속</label>
                <input value={form.org} onChange={e => setForm(f => ({ ...f, org: e.target.value }))} placeholder="회사·팀" style={inp} />
              </div>
            </div>

            <label style={lbl}>어떻게 아는 사람인지</label>
            <input value={form.relationship} onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))} placeholder="대학 동기, 전 직장 상사…" style={inp} />

            <label style={lbl}>그 사람의 네트워크 (2차 인맥·업계 등)</label>
            <textarea
              value={form.theirNetwork}
              onChange={e => setForm(f => ({ ...f, theirNetwork: e.target.value }))}
              placeholder="아는 분야, 소개 가능한 사람 유형, 자주 얽히는 커뮤니티…"
              rows={3}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}
            />

            <label style={lbl}>나에게 이롭게 작용할 수 있는 점</label>
            <textarea
              value={form.valueToMe}
              onChange={e => setForm(f => ({ ...f, valueToMe: e.target.value }))}
              placeholder="소개 요청 시 도움, 특정 정보 접근, 협업 가능성…"
              rows={3}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}
            />

            <label style={lbl}>가치 유형 (복수 선택)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
              {BENEFIT_OPTIONS.map(o => {
                const on = form.benefits.includes(o.id)
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggleBenefit(o.id)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '999px',
                      border: on ? '2px solid #6366f1' : '1px solid rgba(0,0,0,0.1)',
                      backgroundColor: on ? 'rgba(99,102,241,0.12)' : '#f9fafb',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#37352F',
                      cursor: 'pointer',
                    }}
                  >
                    {o.emoji} {o.label}
                  </button>
                )
              })}
            </div>

            <label style={lbl}>관계 강도 (1~5)</label>
            <input
              type="range"
              min={1}
              max={5}
              value={form.strength}
              onChange={e => setForm(f => ({ ...f, strength: Number(e.target.value) }))}
              style={{ width: '100%', marginBottom: '12px' }}
            />
            <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#6366f1', fontWeight: 700 }}>선택: {form.strength}</p>

            <label style={lbl}>메모</label>
            <textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} placeholder="기타" rows={2} style={{ ...inp, resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: '10px', marginTop: '18px', flexWrap: 'wrap' }}>
              <button type="button" onClick={handleSave} style={btnPrimary}>
                저장
              </button>
              {!creating && form.id && (
                <button type="button" onClick={() => handleDelete(form.id)} style={btnDanger}>
                  삭제
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setCreating(false)
                  setEditing(null)
                  setForm(emptyForm())
                }}
                style={btnGhost}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const lbl: CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 700, color: '#6B7280', marginBottom: '6px' }
const inp: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  marginBottom: '12px',
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid rgba(0,0,0,0.1)',
  fontSize: '14px',
  outline: 'none',
  fontFamily: 'inherit',
}
const btnPrimary: CSSProperties = {
  flex: 1,
  minWidth: '100px',
  padding: '12px',
  borderRadius: '10px',
  border: 'none',
  background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
  color: '#fff',
  fontSize: '14px',
  fontWeight: 700,
  cursor: 'pointer',
}
const btnDanger: CSSProperties = {
  padding: '12px 16px',
  borderRadius: '10px',
  border: '1px solid rgba(239,68,68,0.4)',
  backgroundColor: 'rgba(239,68,68,0.08)',
  color: '#dc2626',
  fontSize: '14px',
  fontWeight: 700,
  cursor: 'pointer',
}
const btnGhost: CSSProperties = {
  padding: '12px 16px',
  borderRadius: '10px',
  border: '1px solid rgba(0,0,0,0.1)',
  backgroundColor: '#fff',
  color: '#6B7280',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
}
