import { useState, useEffect, useCallback, useRef } from 'react'
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
import { ACT_ROLE_REF_KEY, ACT_MASTER_KEY, ACT_WAY_OF_BEING_KEY } from './kvSyncedKeys'
import { emitAppSyncStatus, scheduleSyncIdle, SYNC_IDLE_MS } from './syncIndicatorBus'
import { ARCHETYPE_LABEL, type IdentityArchetype } from './identityArchetypeData'

const MAX_COVER_DATA_URL_CHARS = 900_000

type ActRoleCard = {
  id: string
  title: string
  body: string
  coverDataUrl?: string | null
}

function newRoleCard(): ActRoleCard {
  return { id: crypto.randomUUID(), title: '', body: '', coverDataUrl: null }
}

function loadWayOfBeingFromStorage(): IdentityArchetype | null {
  try {
    const raw = localStorage.getItem(ACT_WAY_OF_BEING_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as { archetype?: string | null }
    const a = p.archetype
    if (a === 'analyst' || a === 'creator' || a === 'capitalist' || a === 'adventurer') return a
    return null
  } catch {
    return null
  }
}

function saveWayOfBeingToStorage(a: IdentityArchetype | null) {
  const payload = { archetype: a }
  try {
    localStorage.setItem(ACT_WAY_OF_BEING_KEY, JSON.stringify(payload))
    void kvSet(ACT_WAY_OF_BEING_KEY, payload)
  } catch {
    /* ignore */
  }
}

function loadRoleCardsFromStorage(): ActRoleCard[] {
  try {
    const raw = localStorage.getItem(ACT_ROLE_REF_KEY)
    if (!raw) return [newRoleCard()]
    const p = JSON.parse(raw) as { version?: number; blocks?: unknown[]; text?: string }
    if (p && p.version === 2 && Array.isArray(p.blocks) && p.blocks.length > 0) {
      return p.blocks.map((x): ActRoleCard => {
        const b = x as Record<string, unknown>
        return {
          id: typeof b.id === 'string' ? b.id : crypto.randomUUID(),
          title: typeof b.title === 'string' ? b.title : '',
          body: typeof b.body === 'string' ? b.body : '',
          coverDataUrl: typeof b.coverDataUrl === 'string' ? b.coverDataUrl : null,
        }
      })
    }
    if (p && typeof p.text === 'string' && p.text.trim()) {
      return [{ id: crypto.randomUUID(), title: '역할 노트', body: p.text, coverDataUrl: null }]
    }
    return [newRoleCard()]
  } catch {
    return [newRoleCard()]
  }
}

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
  const [roleCards, setRoleCards] = useState<ActRoleCard[]>(() => loadRoleCardsFromStorage())
  const [selectedWay, setSelectedWay] = useState<IdentityArchetype | null>(() => loadWayOfBeingFromStorage())
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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
      setRoleCards(loadRoleCardsFromStorage())
      setSelectedWay(loadWayOfBeingFromStorage())
      setMasterText(readAct(ACT_MASTER_KEY))
    } catch {
      /* ignore */
    }
  }, [])

  const flushRoleCards = useCallback((blocks: ActRoleCard[]) => {
    try {
      const payload = { version: 2 as const, blocks }
      localStorage.setItem(ACT_ROLE_REF_KEY, JSON.stringify(payload))
      void kvSet(ACT_ROLE_REF_KEY, payload)
    } catch {
      /* ignore */
    }
  }, [])

  const schedulePersistRoleCards = useCallback(
    (next: ActRoleCard[]) => {
      if (persistTimer.current) clearTimeout(persistTimer.current)
      persistTimer.current = setTimeout(() => flushRoleCards(next), 320)
    },
    [flushRoleCards],
  )

  useEffect(
    () => () => {
      if (persistTimer.current) clearTimeout(persistTimer.current)
    },
    [],
  )

  const setWayOfBeing = useCallback((a: IdentityArchetype | null) => {
    setSelectedWay(a)
    saveWayOfBeingToStorage(a)
    if (a === null) onToast?.('존재 방식 선택을 비웠습니다.')
  }, [onToast])

  const patchRoleCard = useCallback(
    (id: string, patch: Partial<Pick<ActRoleCard, 'title' | 'body' | 'coverDataUrl'>>) => {
      setRoleCards(prev => {
        const next = prev.map(c => (c.id === id ? { ...c, ...patch } : c))
        schedulePersistRoleCards(next)
        return next
      })
    },
    [schedulePersistRoleCards],
  )

  const addRoleCard = useCallback(() => {
    const card = newRoleCard()
    setRoleCards(prev => {
      const next = [...prev, card]
      flushRoleCards(next)
      return next
    })
  }, [flushRoleCards])

  const removeRoleCard = useCallback(
    (id: string) => {
      if (!window.confirm('이 카드를 삭제할까요?')) return
      setRoleCards(prev => {
        if (prev.length <= 1) {
          onToast?.('카드는 최소 1개 유지됩니다.')
          return prev
        }
        const next = prev.filter(c => c.id !== id)
        flushRoleCards(next)
        return next
      })
    },
    [flushRoleCards, onToast],
  )

  const onCoverPick = useCallback(
    (cardId: string, file: File | undefined) => {
      if (!file || !file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = () => {
        const data = typeof reader.result === 'string' ? reader.result : ''
        if (data.length > MAX_COVER_DATA_URL_CHARS) {
          onToast?.('이미지가 너무 큽니다. 더 작은 파일로 시도해 주세요.')
          return
        }
        setRoleCards(prev => {
          const next = prev.map(c => (c.id === cardId ? { ...c, coverDataUrl: data } : c))
          flushRoleCards(next)
          return next
        })
      }
      reader.readAsDataURL(file)
    },
    [flushRoleCards, onToast],
  )

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
      emitAppSyncStatus('error', { errorCode: 'IDENTITY_UPDATE', errorDetail: '태세(Identity) 저장에 실패했습니다.' })
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
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#787774' }}>존재 방식 · 역할창조 · 정체성 · Master를 한 화면에서 정리합니다</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ⓪ 존재 방식 (4원형) */}
        <section style={actBox}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#a855f7', letterSpacing: '0.14em' }}>WAY OF BEING</span>
          <h2 style={{ margin: '6px 0 8px', fontSize: '20px', fontWeight: 900, color: '#37352F' }}>존재 방식</h2>
          <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#787774', lineHeight: 1.55 }}>
            오늘의 상위 방향(분석가·창작자·자본가·모험가)을 고릅니다. 태세(정체성)보다 한 겉단 — 역할창조·집중 흐름을 잡을 때 참고합니다.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: 10,
              marginBottom: 12,
            }}
          >
            {(Object.keys(ARCHETYPE_LABEL) as IdentityArchetype[]).map(k => {
              const meta = ARCHETYPE_LABEL[k]
              const on = selectedWay === k
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setWayOfBeing(on ? null : k)}
                  style={{
                    padding: '14px 10px',
                    borderRadius: 14,
                    border: on ? '2px solid #a855f7' : '1px solid rgba(0,0,0,0.08)',
                    background: on ? 'linear-gradient(180deg, rgba(168,85,247,0.12), #fff)' : '#fafafa',
                    color: on ? '#6b21a8' : '#57534e',
                    cursor: 'pointer',
                    fontWeight: 800,
                    fontSize: 13,
                    textAlign: 'center',
                    boxShadow: on ? '0 4px 14px rgba(168,85,247,0.2)' : 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{meta.emoji}</div>
                  <div>{meta.label}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, marginTop: 6, opacity: 0.88, lineHeight: 1.35 }}>{meta.blurb}</div>
                </button>
              )
            })}
          </div>
          <p style={{ margin: 0, fontSize: 11, color: '#a8a29e' }}>
            같은 카드를 다시 누르면 선택이 해제됩니다. app_kv에 동기화됩니다.
          </p>
        </section>

        {/* ① 역할창조 — 노션형 카드 블록 */}
        <section style={actBox}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#6366f1', letterSpacing: '0.12em' }}>ROLE CREATE</span>
          <h2 style={{ margin: '6px 0 8px', fontSize: '20px', fontWeight: 900, color: '#37352F' }}>역할창조</h2>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#787774', lineHeight: 1.5 }}>
            카드마다 표지 이미지와 제목·본문을 쌓아 두세요. Notion 페이지처럼 블록을 나눠 역할·롤모델·기대 행동을 정리할 수 있습니다. (Supabase app_kv 동기화)
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {roleCards.map((card, idx) => {
              const placeholderGrad = [
                'linear-gradient(145deg, #e0e7ff 0%, #eef2ff 50%, #f8fafc 100%)',
                'linear-gradient(145deg, #fce7f3 0%, #fdf2f8 50%, #fafafa 100%)',
                'linear-gradient(145deg, #d1fae5 0%, #ecfdf5 50%, #f9fafb 100%)',
                'linear-gradient(145deg, #fef3c7 0%, #fffbeb 50%, #fafaf9 100%)',
              ][idx % 4]
              return (
                <article
                  key={card.id}
                  style={{
                    borderRadius: 14,
                    border: '1px solid rgba(0,0,0,0.07)',
                    overflow: 'hidden',
                    backgroundColor: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      height: 132,
                      background: card.coverDataUrl ? '#1c1917' : placeholderGrad,
                    }}
                  >
                    {card.coverDataUrl ? (
                      <img
                        src={card.coverDataUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <div
                        style={{
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 36,
                          opacity: 0.35,
                          color: '#64748b',
                        }}
                      >
                        🖼
                      </div>
                    )}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        display: 'flex',
                        gap: 6,
                        flexWrap: 'wrap',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <label
                        style={{
                          padding: '5px 10px',
                          borderRadius: 8,
                          background: 'rgba(15,23,42,0.72)',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: '1px solid rgba(255,255,255,0.2)',
                        }}
                      >
                        표지
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={e => {
                            onCoverPick(card.id, e.target.files?.[0])
                            e.target.value = ''
                          }}
                        />
                      </label>
                      {card.coverDataUrl && (
                        <button
                          type="button"
                          onClick={() => patchRoleCard(card.id, { coverDataUrl: null })}
                          style={{
                            padding: '5px 10px',
                            borderRadius: 8,
                            background: 'rgba(255,255,255,0.92)',
                            color: '#57534e',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: '1px solid rgba(0,0,0,0.08)',
                          }}
                        >
                          표지 제거
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ padding: '14px 14px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input
                      value={card.title}
                      onChange={e => patchRoleCard(card.id, { title: e.target.value })}
                      placeholder="제목 없음"
                      style={{
                        width: '100%',
                        border: 'none',
                        outline: 'none',
                        fontSize: 17,
                        fontWeight: 800,
                        color: '#37352F',
                        background: 'transparent',
                        fontFamily: 'inherit',
                      }}
                    />
                    <textarea
                      value={card.body}
                      onChange={e => patchRoleCard(card.id, { body: e.target.value })}
                      placeholder="역할, 롤모델, 이 역할에서 지키고 싶은 태도…"
                      style={{
                        width: '100%',
                        minHeight: 100,
                        border: 'none',
                        outline: 'none',
                        fontSize: 14,
                        lineHeight: 1.55,
                        color: '#44403c',
                        background: 'rgba(0,0,0,0.02)',
                        borderRadius: 10,
                        padding: '10px 12px',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => removeRoleCard(card.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: '1px solid rgba(239,68,68,0.35)',
                          background: 'rgba(254,242,242,0.9)',
                          color: '#b91c1c',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        카드 삭제
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
          <button
            type="button"
            onClick={addRoleCard}
            style={{
              marginTop: 14,
              width: '100%',
              padding: '12px 16px',
              borderRadius: 12,
              border: '2px dashed rgba(99,102,241,0.35)',
              background: 'rgba(99,102,241,0.06)',
              color: '#4f46e5',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            + 블록 추가
          </button>
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
