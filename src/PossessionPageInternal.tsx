import { useState, useEffect, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { useIsMobile } from './hooks/useIsMobile'
import { kvSet } from './lib/supabase'
import {
  insertIdentity,
  updateIdentity,
  deleteIdentity,
  updateActiveIdentity,
  type IdentityRow,
} from './supabase'
import { ACT_ROLE_REF_KEY, ACT_MASTER_KEY } from './kvSyncedKeys'
import { emitAppSyncStatus, scheduleSyncIdle, SYNC_IDLE_MS } from './syncIndicatorBus'

// ═══════════════════════════════════════ IDENTITY PAGE ══════════════════════════
export function PossessionPage({ identities, activeIdentityId, onRefresh, onRefreshActive, onToast, onOptimisticIdentityPatch }: {
  identities: IdentityRow[]
  activeIdentityId: string | null
  onRefresh: () => void
  onRefreshActive: () => void
  onToast?: (msg: string) => void
  onOptimisticIdentityPatch?: (id: string, name: string, role_model: string | null) => void
}) {
  const isMobile = useIsMobile()
  const [roleRefText, setRoleRefText] = useState('')
  const [masterText, setMasterText] = useState('')
  const [newName, setNewName] = useState('')
  const [newRoleModel, setNewRoleModel] = useState('')
  const [adding, setAdding] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  /** 태세 전환 직후 정체성 선언 모달 */
  const [declaration, setDeclaration] = useState<IdentityRow | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRoleModel, setEditRoleModel] = useState('')

  useEffect(() => {
    try {
      const readAct = (key: string): string => {
        const raw = localStorage.getItem(key)
        if (!raw) return ''
        try {
          const p = JSON.parse(raw) as { text?: string }
          if (p && typeof p.text === 'string') return p.text
        } catch {
          return raw
        }
        return ''
      }
      setRoleRefText(readAct(ACT_ROLE_REF_KEY))
      setMasterText(readAct(ACT_MASTER_KEY))
    } catch {
      /* ignore */
    }
  }, [])

  const persistRoleRef = useCallback((v: string) => {
    setRoleRefText(v)
    try {
      const payload = { text: v }
      localStorage.setItem(ACT_ROLE_REF_KEY, JSON.stringify(payload))
      void kvSet(ACT_ROLE_REF_KEY, payload)
    } catch {
      /* ignore */
    }
  }, [])

  const persistMaster = useCallback((v: string) => {
    setMasterText(v)
    try {
      const payload = { text: v }
      localStorage.setItem(ACT_MASTER_KEY, JSON.stringify(payload))
      void kvSet(ACT_MASTER_KEY, payload)
    } catch {
      /* ignore */
    }
  }, [])

  async function handleSwitchStance(id: string) {
    if (activeIdentityId === id) return
    setSwitchingId(id)
    try {
      const ok = await updateActiveIdentity(id)
      if (ok) {
        onRefreshActive()
        const row = identities.find(i => i.id === id)
        if (row) setDeclaration(row)
        onToast?.('태세가 전환되었습니다.')
      } else {
        onToast?.('태세 전환에 실패했습니다.')
      }
    } finally {
      setSwitchingId(null)
    }
  }

  async function handleEndStance() {
    setSwitchingId('__end__')
    try {
      const ok = await updateActiveIdentity(null)
      if (ok) {
        onRefreshActive()
        onToast?.('태세가 종료되었습니다.')
      } else {
        onToast?.('태세 종료에 실패했습니다.')
      }
    } finally {
      setSwitchingId(null)
    }
  }

  async function handleAdd() {
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    try {
      const result = await insertIdentity(name, newRoleModel.trim() || null)
      if ('row' in result) {
        setNewName('')
        setNewRoleModel('')
        onRefresh()
        onToast?.('정체성이 추가되었습니다.')
      } else {
        onToast?.(result.error || '정체성 추가에 실패했습니다.')
      }
    } finally {
      setAdding(false)
    }
  }

  async function handleSave(id: string) {
    const name = editName.trim()
    if (!name) return
    const rm = editRoleModel.trim() || null
    setEditingId(null)
    onOptimisticIdentityPatch?.(id, name, rm)
    emitAppSyncStatus('syncing')
    const ok = await updateIdentity(id, name, rm)
    if (ok) {
      emitAppSyncStatus('synced')
      scheduleSyncIdle(SYNC_IDLE_MS)
    } else {
      onRefresh()
      emitAppSyncStatus('error')
    }
  }

  async function handleDelete(id: string) {
    await deleteIdentity(id)
    onRefresh()
  }

  function fmtTime(sec: number): string {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  const actBox: CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid rgba(0,0,0,0.08)',
    padding: isMobile ? '18px 16px' : '24px 22px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '14px 12px' : '36px 48px' }}>
      <div style={{ marginBottom: '24px' }}>
        <span style={{ fontSize: '10px', fontWeight: 800, color: '#7C3AED', letterSpacing: '0.2em', textTransform: 'uppercase' }}>🎭 Act</span>
        <h1 style={{ margin: '8px 0 0', fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: 900, color: '#37352F' }}>Act</h1>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#787774' }}>역할참조 · 정체성 · Master를 한 화면에서 정리합니다</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ① 역할참조 */}
        <section style={actBox}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#6366f1', letterSpacing: '0.12em' }}>ROLE REF</span>
          <h2 style={{ margin: '6px 0 8px', fontSize: '20px', fontWeight: 900, color: '#37352F' }}>역할참조</h2>
          <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#787774', lineHeight: 1.5 }}>
            지금 맡은 역할·참고할 롤모델·기대 행동을 적어 두세요. (Supabase app_kv 동기화)
          </p>
          <textarea
            value={roleRefText}
            onChange={e => persistRoleRef(e.target.value)}
            placeholder="예: 팀에서의 역할, 본받고 싶은 사람, 이 역할에서 지켜야 할 태도…"
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '12px 14px',
              fontSize: '14px',
              lineHeight: 1.55,
              borderRadius: '12px',
              border: '1px solid rgba(0,0,0,0.08)',
              backgroundColor: '#fafafa',
              color: '#37352F',
              resize: 'vertical',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </section>

        {/* ② 정체성 */}
        <section style={actBox}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#7C3AED', letterSpacing: '0.12em' }}>IDENTITY</span>
          <h2 style={{ margin: '6px 0 8px', fontSize: '20px', fontWeight: 900, color: '#37352F' }}>정체성 (우디르 태세)</h2>
          <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#787774', lineHeight: 1.5 }}>
            작업할 때 어떤 정체성으로 몰입하는지 정의하고, 누적 시간과 XP를 확인하세요
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {identities.map(idn => {
          const isActive = activeIdentityId === idn.id
          return (
          <div
            key={idn.id}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: isActive ? '2px solid #7C3AED' : '1px solid rgba(0,0,0,0.06)',
              padding: '24px 22px',
              boxShadow: isActive ? '0 4px 16px rgba(124,58,237,0.2)' : '0 2px 12px rgba(0,0,0,0.06)',
              transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)' }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)' }}
          >
            {editingId === idn.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="이름" style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #6366f1', outline: 'none', fontSize: '14px' }} />
                <input value={editRoleModel} onChange={e => setEditRoleModel(e.target.value)} placeholder="롤모델" style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', outline: 'none', fontSize: '13px' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleSave(idn.id)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', backgroundColor: '#6366f1', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>저장</button>
                  <button onClick={() => setEditingId(null)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', backgroundColor: 'transparent', fontSize: '12px', cursor: 'pointer' }}>취소</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#37352F' }}>{idn.name}</h3>
                    {isActive && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#7C3AED', backgroundColor: 'rgba(124,58,237,0.12)', padding: '3px 8px', borderRadius: '999px', letterSpacing: '0.05em' }}>활성 태세</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {isActive ? (
                      <button onClick={handleEndStance} disabled={switchingId === '__end__'} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.35)', backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '11px', fontWeight: 600, cursor: switchingId === '__end__' ? 'default' : 'pointer' }}>{switchingId === '__end__' ? '종료 중…' : '태세 종료'}</button>
                    ) : (
                      <button onClick={() => handleSwitchStance(idn.id)} disabled={switchingId === idn.id} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(124,58,237,0.4)', backgroundColor: 'rgba(124,58,237,0.08)', color: '#7C3AED', fontSize: '11px', fontWeight: 600, cursor: switchingId === idn.id ? 'default' : 'pointer' }}>{switchingId === idn.id ? '전환 중…' : '태세 전환'}</button>
                    )}
                    <button onClick={() => { setEditingId(idn.id); setEditName(idn.name); setEditRoleModel(idn.role_model ?? '') }} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: 'rgba(99,102,241,0.1)', color: '#6366f1', fontSize: '11px', cursor: 'pointer' }}>수정</button>
                    <button onClick={() => handleDelete(idn.id)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '11px', cursor: 'pointer' }}>삭제</button>
                  </div>
                </div>
                {idn.role_model && <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#787774' }}>롤모델: {idn.role_model}</p>}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ backgroundColor: 'rgba(99,102,241,0.08)', padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, color: '#6366f1', letterSpacing: '0.08em' }}>누적 시간</p>
                    <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 800, color: '#37352F' }}>{fmtTime(idn.time_spent_sec)}</p>
                  </div>
                    <div style={{ flex: 1, minWidth: '120px' }}>
                    <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, color: '#34d399', letterSpacing: '0.08em', marginBottom: '6px' }}>XP</p>
                    <div style={{ height: '8px', borderRadius: '999px', backgroundColor: 'rgba(52,211,153,0.2)', overflow: 'hidden', marginBottom: '4px' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, (idn.xp / 500) * 100)}%`, borderRadius: '999px', background: 'linear-gradient(90deg, #34d399, #10b981)', transition: 'width 0.6s cubic-bezier(0.34, 1.2, 0.64, 1)' }} />
                    </div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#37352F', transition: 'transform 0.3s ease' }}>{idn.xp} XP</p>
                  </div>
                </div>
              </>
            )}
          </div>
          )
        })}
        <div
          style={{
            backgroundColor: 'rgba(0,0,0,0.02)',
            borderRadius: '16px',
            border: '2px dashed rgba(0,0,0,0.12)',
            padding: '24px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            cursor: 'pointer',
            transition: 'border-color 0.2s, background 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'; e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.06)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)'; e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)' }}
        >
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#787774' }}>+ 새 정체성 추가</p>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="예: 소설가" style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', outline: 'none', fontSize: '13px' }} />
          <input value={newRoleModel} onChange={e => setNewRoleModel(e.target.value)} placeholder="롤모델 (선택)" style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', outline: 'none', fontSize: '13px' }} />
          <button onClick={handleAdd} disabled={!newName.trim() || adding} style={{ padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: newName.trim() && !adding ? '#6366f1' : '#EBEBEA', color: newName.trim() && !adding ? '#fff' : '#9B9A97', fontSize: '13px', fontWeight: 700, cursor: newName.trim() && !adding ? 'pointer' : 'default' }}>{adding ? '저장 중…' : '추가'}</button>
        </div>
          </div>
        </section>

        {declaration && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 400,
              background: 'rgba(15,23,42,0.55)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
            role="dialog"
            aria-modal
            aria-labelledby="identity-declaration-title"
          >
            <div
              style={{
                maxWidth: 520,
                width: '100%',
                background: '#fff',
                borderRadius: 20,
                padding: '28px 26px',
                boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
                border: '1px solid rgba(124,58,237,0.25)',
              }}
            >
              <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#7C3AED', letterSpacing: '0.2em' }}>IDENTITY DECLARATION</p>
              <h2 id="identity-declaration-title" style={{ margin: '10px 0 16px', fontSize: 20, fontWeight: 900, color: '#37352F', lineHeight: 1.35 }}>
                오늘의 존재 방식
              </h2>
              <p style={{ margin: 0, fontSize: 15, color: '#37352F', lineHeight: 1.75, fontWeight: 600 }}>
                나는 오늘{' '}
                <strong style={{ color: '#7C3AED' }}>[{declaration.name}]</strong> 태세로서,{' '}
                <strong style={{ color: '#4F46E5' }}>
                  {declaration.role_model?.trim() || '나만의 방향과 약속'}
                </strong>
                을(를) 향해 한 걸음씩 나아가는 존재가 되기로 결정했다.
              </p>
              <p style={{ margin: '14px 0 0', fontSize: 12, color: '#787774', lineHeight: 1.55 }}>
                문장을 소리 내어 읽거나 마음속으로 되새기면, 실행에 대한 의미가 뇌에 각인됩니다.
              </p>
              <button
                type="button"
                onClick={() => setDeclaration(null)}
                style={{
                  marginTop: 22,
                  width: '100%',
                  padding: '12px 18px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg,#7c3aed,#6366f1)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                확인 · 오늘의 태세로 시작하기
              </button>
            </div>
          </div>
        )}

        {/* ③ Master */}
        <section style={actBox}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#0d9488', letterSpacing: '0.12em' }}>MASTER</span>
          <h2 style={{ margin: '6px 0 8px', fontSize: '20px', fontWeight: 900, color: '#37352F' }}>Master</h2>
          <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#787774', lineHeight: 1.5 }}>
            한 단계 위 시야·원칙·메모를 적어 두세요. (Supabase app_kv 동기화)
          </p>
          <textarea
            value={masterText}
            onChange={e => persistMaster(e.target.value)}
            placeholder="예: 이번 분기 원칙, 절대 지키고 싶은 기준, 마스터 보드와 연결할 아이디어…"
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '12px 14px',
              fontSize: '14px',
              lineHeight: 1.55,
              borderRadius: '12px',
              border: '1px solid rgba(0,0,0,0.08)',
              backgroundColor: '#fafafa',
              color: '#37352F',
              resize: 'vertical',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </section>
      </div>
    </div>
  )
}
