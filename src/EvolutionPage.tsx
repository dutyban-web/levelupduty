/**
 * Evolution — Action / React / Routine / Habit + 진화 XP 게이지 (단일 페이지, 영역 구분)
 */
import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react'
import {
  loadEvolutionStore,
  saveEvolutionStore,
  upsertEvolutionItem,
  deleteEvolutionItem,
  activeEvolutionItems,
  evolutionProgress,
  xpForNextLevel,
  EVOLUTION_CATEGORY_LABEL,
  type EvolutionStore,
  type EvolutionCategory,
  type EvolutionItem,
} from './evolutionData'

function useIsMobile(): boolean {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return m
}

const CATEGORIES: EvolutionCategory[] = ['action', 'react', 'routine', 'habit']

const SECTION_STYLE: Record<EvolutionCategory, { border: string; glow: string; label: string }> = {
  action: { border: 'rgba(45,212,191,0.45)', glow: '0 0 24px rgba(45,212,191,0.12)', label: '#2dd4bf' },
  react: { border: 'rgba(167,139,250,0.45)', glow: '0 0 24px rgba(167,139,250,0.12)', label: '#c4b5fd' },
  routine: { border: 'rgba(251,191,36,0.4)', glow: '0 0 24px rgba(251,191,36,0.1)', label: '#fcd34d' },
  habit: { border: 'rgba(52,211,153,0.45)', glow: '0 0 24px rgba(52,211,153,0.12)', label: '#6ee7b7' },
}

function emptyDraft() {
  return { title: '', body: '', points: 10 }
}

export function EvolutionPage() {
  const isMobile = useIsMobile()
  const [store, setStore] = useState<EvolutionStore>(() => loadEvolutionStore())
  const [drafts, setDrafts] = useState<Record<EvolutionCategory, { title: string; body: string; points: number }>>(() => ({
    action: emptyDraft(),
    react: emptyDraft(),
    routine: emptyDraft(),
    habit: emptyDraft(),
  }))
  const [editingId, setEditingId] = useState<string | null>(null)

  const prog = useMemo(() => evolutionProgress(store.totalEvolutionXp), [store.totalEvolutionXp])
  const pct = prog.xpForNext > 0 ? Math.min(100, Math.round((prog.xpIntoLevel / prog.xpForNext) * 100)) : 0

  const itemsByCategory = useMemo(() => {
    const m: Record<EvolutionCategory, EvolutionItem[]> = {
      action: [],
      react: [],
      routine: [],
      habit: [],
    }
    for (const i of activeEvolutionItems(store.items)) {
      m[i.category].push(i)
    }
    for (const c of CATEGORIES) {
      m[c].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    }
    return m
  }, [store.items])

  const persist = useCallback((next: EvolutionStore) => {
    setStore(next)
    saveEvolutionStore(next)
  }, [])

  const resetSection = (category: EvolutionCategory) => {
    setDrafts(d => ({ ...d, [category]: emptyDraft() }))
    const item = editingId ? store.items.find(i => i.id === editingId) : null
    if (item?.category === category) setEditingId(null)
  }

  const submit = (category: EvolutionCategory) => {
    const d = drafts[category]
    const t = d.title.trim()
    if (!t) return
    if (editingId) {
      const existing = store.items.find(i => i.id === editingId)
      if (!existing || existing.category !== category) return
    }
    const next = upsertEvolutionItem(store, {
      id: editingId ?? undefined,
      category,
      title: t,
      body: d.body.trim(),
      evolutionPoints: d.points,
      completed: store.items.find(i => i.id === editingId)?.completed ?? false,
    })
    persist(next)
    setDrafts(x => ({ ...x, [category]: emptyDraft() }))
    setEditingId(null)
  }

  const toggleComplete = (item: EvolutionItem) => {
    const n = upsertEvolutionItem(store, {
      ...item,
      completed: !item.completed,
      completedAt: !item.completed ? new Date().toISOString() : undefined,
    })
    persist(n)
  }

  const remove = (id: string) => {
    if (!window.confirm('삭제할까요? 완료된 항목은 XP에서도 차감됩니다.')) return
    persist(deleteEvolutionItem(store, id))
    const item = store.items.find(i => i.id === id)
    if (item) setDrafts(d => (editingId === id ? { ...d, [item.category]: emptyDraft() } : d))
    if (editingId === id) setEditingId(null)
  }

  const startEdit = (item: EvolutionItem) => {
    setEditingId(item.id)
    setDrafts(d => ({
      ...d,
      [item.category]: { title: item.title, body: item.body, points: item.evolutionPoints },
    }))
  }

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 52px)',
        background: 'linear-gradient(165deg, #0f172a 0%, #1e1b4b 45%, #0c4a6e 100%)',
        color: '#e2e8f0',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '20px 14px 40px' : '28px 36px 48px' }}>
        <header style={{ marginBottom: 24 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.28em', color: '#5eead4', textTransform: 'uppercase' }}>Evolution</p>
          <h1 style={{ margin: '10px 0 8px', fontSize: isMobile ? 26 : 32, fontWeight: 900, background: 'linear-gradient(90deg,#5eead4,#a78bfa,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            진화 트랙
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(226,232,240,0.75)', lineHeight: 1.65, maxWidth: 640 }}>
            네 영역을 한 화면에서 관리합니다. 완료할 때마다 설정한 Evolution 점수가 XP로 쌓입니다.
          </p>
        </header>

        {/* 레벨 게이지 */}
        <div
          style={{
            marginBottom: 28,
            padding: isMobile ? 18 : 22,
            borderRadius: 20,
            border: '1px solid rgba(94,234,212,0.25)',
            background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,27,75,0.85) 100%)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>Evolution Lv.</span>
              <span style={{ marginLeft: 10, fontSize: 28, fontWeight: 900, color: '#5eead4' }}>{prog.level}</span>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              총 누적 XP <strong style={{ color: '#e2e8f0' }}>{prog.totalXp.toLocaleString('ko-KR')}</strong>
            </div>
          </div>
          <div style={{ height: 14, borderRadius: 999, background: 'rgba(15,23,42,0.8)', overflow: 'hidden', border: '1px solid rgba(148,163,184,0.15)' }}>
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                borderRadius: 999,
                background: 'linear-gradient(90deg,#14b8a6,#8b5cf6,#ec4899)',
                boxShadow: '0 0 20px rgba(139,92,246,0.5)',
                transition: 'width 0.35s ease',
              }}
            />
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 12, color: '#64748b' }}>
            이번 레벨 구간: <strong style={{ color: '#a5f3fc' }}>{prog.xpIntoLevel.toLocaleString('ko-KR')}</strong> / {prog.xpForNext.toLocaleString('ko-KR')} XP · 다음 구간 Lv.{prog.level + 1} = {xpForNextLevel(prog.level + 1).toLocaleString('ko-KR')} XP
          </p>
        </div>

        {/* 4영역 — 2×2 또는 1열 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: isMobile ? 18 : 20,
            alignItems: 'stretch',
          }}
        >
          {CATEGORIES.map(cat => {
            const meta = EVOLUTION_CATEGORY_LABEL[cat]
            const sty = SECTION_STYLE[cat]
            const d = drafts[cat]
            const list = itemsByCategory[cat]
            const isEditingHere = editingId && store.items.find(i => i.id === editingId)?.category === cat

            return (
              <section
                key={cat}
                id={`evolution-${cat}`}
                style={{
                  borderRadius: 18,
                  border: `1px solid ${sty.border}`,
                  background: 'rgba(15,23,42,0.65)',
                  boxShadow: `${sty.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
                  padding: isMobile ? 16 : 18,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                }}
              >
                <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid rgba(148,163,184,0.12)` }}>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: sty.label, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 22 }}>{meta.emoji}</span> {meta.label}
                  </h2>
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{meta.hint}</p>
                </div>

                {/* 영역별 입력 */}
                <div style={{ marginBottom: 14 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {isEditingHere ? '카드 수정' : '새 카드'}
                  </p>
                  <input
                    value={d.title}
                    onChange={e => setDrafts(x => ({ ...x, [cat]: { ...x[cat], title: e.target.value } }))}
                    placeholder="제목"
                    style={inp}
                  />
                  <textarea
                    value={d.body}
                    onChange={e => setDrafts(x => ({ ...x, [cat]: { ...x[cat], body: e.target.value } }))}
                    placeholder="메모 (선택)"
                    rows={2}
                    style={{ ...inp, marginTop: 8, minHeight: 56, resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                      XP
                      <input
                        type="number"
                        min={0}
                        value={d.points}
                        onChange={e => setDrafts(x => ({ ...x, [cat]: { ...x[cat], points: Math.max(0, parseInt(e.target.value, 10) || 0) } }))}
                        style={{ ...inp, width: 72, marginTop: 0, padding: '8px 10px' }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => submit(cat)}
                      disabled={!d.title.trim()}
                      style={{
                        ...btnPrimary,
                        padding: '9px 16px',
                        fontSize: 13,
                        opacity: d.title.trim() ? 1 : 0.45,
                        cursor: d.title.trim() ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {isEditingHere ? '저장' : '추가'}
                    </button>
                    {(isEditingHere || d.title || d.body) && (
                      <button type="button" onClick={() => resetSection(cat)} style={{ ...btnGhost, padding: '9px 12px', fontSize: 12 }}>
                        취소
                      </button>
                    )}
                  </div>
                </div>

                {/* 목록 */}
                <div style={{ flex: 1, overflow: 'auto' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#64748b' }}>목록 ({list.length})</p>
                  {list.length === 0 ? (
                    <p style={{ margin: 0, padding: 16, textAlign: 'center', fontSize: 12, color: '#64748b', borderRadius: 10, border: '1px dashed rgba(148,163,184,0.2)' }}>
                      항목 없음
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {list.map(item => (
                        <div
                          key={item.id}
                          style={{
                            padding: 12,
                            borderRadius: 12,
                            border: item.completed ? `1px solid ${sty.border}` : '1px solid rgba(148,163,184,0.12)',
                            background: item.completed ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.5)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>{item.title}</p>
                              {item.body ? <p style={{ margin: '6px 0 0', fontSize: 12, color: '#94a3b8', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{item.body}</p> : null}
                              <p style={{ margin: '8px 0 0', fontSize: 10, color: '#64748b' }}>
                                XP {item.evolutionPoints}
                                {item.completed && item.completedAt ? ` · 완료 ${new Date(item.completedAt).toLocaleDateString('ko-KR')}` : ''}
                              </p>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                              <button type="button" onClick={() => toggleComplete(item)} style={{ ...btnSmall, background: item.completed ? 'rgba(148,163,184,0.15)' : 'linear-gradient(135deg,#0d9488,#7c3aed)', fontSize: 10 }}>
                                {item.completed ? '완료됨' : '완료'}
                              </button>
                              <button type="button" onClick={() => startEdit(item)} style={{ ...btnSmall, fontSize: 10 }}>
                                편집
                              </button>
                              <button type="button" onClick={() => remove(item.id)} style={{ ...btnSmall, fontSize: 10, color: '#fca5a5', borderColor: 'rgba(248,113,113,0.35)' }}>
                                삭제
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>

        <p style={{ marginTop: 28, fontSize: 11, color: '#475569', lineHeight: 1.6 }}>
          데이터 키 <code style={{ fontSize: 10 }}>creative_os_evolution_v1</code>
        </p>
      </div>
    </div>
  )
}

const inp: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid rgba(148,163,184,0.2)',
  background: 'rgba(15,23,42,0.6)',
  color: '#f1f5f9',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
}

const btnPrimary: CSSProperties = {
  borderRadius: 12,
  border: 'none',
  background: 'linear-gradient(135deg,#0d9488,#6366f1)',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
}

const btnGhost: CSSProperties = {
  borderRadius: 10,
  border: '1px solid rgba(148,163,184,0.3)',
  background: 'transparent',
  color: '#94a3b8',
  fontWeight: 600,
  cursor: 'pointer',
}

const btnSmall: CSSProperties = {
  padding: '5px 8px',
  borderRadius: 6,
  border: '1px solid rgba(148,163,184,0.25)',
  background: 'rgba(15,23,42,0.5)',
  color: '#e2e8f0',
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
