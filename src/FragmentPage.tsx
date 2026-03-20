/**
 * Fragment — 그때그때 떠오른 메모·노트·영감 조각
 */
import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react'
import {
  loadFragmentStore,
  saveFragmentStore,
  upsertFragment,
  deleteFragment,
  FRAGMENT_KIND_META,
  type FragmentStore,
  type FragmentKind,
  type FragmentEntry,
} from './fragmentData'

function useIsMobile(): boolean {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return m
}

const KINDS: FragmentKind[] = ['memo', 'note', 'spark']

function fmtShort(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    if (sameDay) return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function FragmentPage() {
  const isMobile = useIsMobile()
  const [store, setStore] = useState<FragmentStore>(() => loadFragmentStore())
  const [kind, setKind] = useState<FragmentKind>('memo')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterKind, setFilterKind] = useState<FragmentKind | 'all'>('all')
  const [query, setQuery] = useState('')

  const persist = useCallback((next: FragmentStore) => {
    setStore(next)
    saveFragmentStore(next)
  }, [])

  const resetComposer = () => {
    setEditingId(null)
    setKind('memo')
    setTitle('')
    setBody('')
  }

  const save = () => {
    const t = body.trim() || title.trim()
    if (!t) return
    const next = upsertFragment(store, {
      id: editingId ?? undefined,
      kind,
      title: title.trim(),
      body: body.trim(),
      pinned: store.entries.find(e => e.id === editingId)?.pinned ?? false,
    })
    persist(next)
    resetComposer()
  }

  const startEdit = (e: FragmentEntry) => {
    setEditingId(e.id)
    setKind(e.kind)
    setTitle(e.title)
    setBody(e.body)
  }

  const togglePin = (e: FragmentEntry) => {
    persist(upsertFragment(store, { ...e, pinned: !e.pinned }))
  }

  const remove = (id: string) => {
    if (!window.confirm('이 조각을 삭제할까요?')) return
    persist(deleteFragment(store, id))
    if (editingId === id) resetComposer()
  }

  const filtered = useMemo(() => {
    let list = [...store.entries]
    if (filterKind !== 'all') list = list.filter(e => e.kind === filterKind)
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(e => `${e.title} ${e.body}`.toLowerCase().includes(q))
    }
    list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updatedAt.localeCompare(a.updatedAt)
    })
    return list
  }, [store.entries, filterKind, query])

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: isMobile ? '18px 14px 40px' : '28px 44px 56px', minHeight: 'calc(100vh - 52px)' }}>
      {/* 헤더 — OS 톤 */}
      <header style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 22, lineHeight: 1, opacity: 0.85 }} title="Fragment">◇</span>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#6366f1', letterSpacing: '0.18em', textTransform: 'uppercase' }}>Fragment</p>
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: isMobile ? 22 : 26, fontWeight: 900, color: '#37352F' }}>떠오른 조각</h1>
        <p style={{ margin: 0, fontSize: 13, color: '#787774', lineHeight: 1.65, maxWidth: 520 }}>
          정리하지 않아도 됩니다. 생각나는 순간만 메모·노트·영감으로 남겨 두세요. 창작 OS의 흐름 속에 가볍게 쌓입니다.
        </p>
      </header>

      {/* 작성 카드 */}
      <div
        style={{
          marginBottom: 24,
          padding: isMobile ? 18 : 22,
          borderRadius: 16,
          border: '1px solid rgba(0,0,0,0.06)',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, color: '#37352F' }}>{editingId ? '조각 수정' : '새 조각'}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {KINDS.map(k => {
            const meta = FRAGMENT_KIND_META[k]
            const on = kind === k
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: on ? '1px solid #6366f1' : '1px solid rgba(0,0,0,0.08)',
                  background: on ? 'rgba(99,102,241,0.1)' : '#F7F7F5',
                  color: on ? '#4F46E5' : '#787774',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {meta.emoji} {meta.label}
              </button>
            )
          })}
        </div>
        <p style={{ margin: '0 0 8px', fontSize: 11, color: '#9B9A97' }}>{FRAGMENT_KIND_META[kind].hint}</p>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="제목 (선택)"
          style={inp}
        />
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="여기에 적어요…"
          rows={5}
          style={{ ...inp, marginTop: 10, minHeight: 120, resize: 'vertical', lineHeight: 1.6 }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={save}
            disabled={!body.trim() && !title.trim()}
            style={{
              padding: '11px 22px',
              borderRadius: 10,
              border: 'none',
              background: body.trim() || title.trim() ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : '#EBEBEA',
              color: body.trim() || title.trim() ? '#fff' : '#AEAAA4',
              fontSize: 14,
              fontWeight: 800,
              cursor: body.trim() || title.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {editingId ? '저장' : '남기기'}
          </button>
          {editingId && (
            <button type="button" onClick={resetComposer} style={{ padding: '11px 18px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', background: '#fff', color: '#787774', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              취소
            </button>
          )}
        </div>
      </div>

      {/* 검색 · 필터 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="검색…"
          style={{ ...inp, flex: '1 1 200px', maxWidth: 320 }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setFilterKind('all')}
            style={filterChip(filterKind === 'all')}
          >
            전체
          </button>
          {KINDS.map(k => (
            <button key={k} type="button" onClick={() => setFilterKind(k)} style={filterChip(filterKind === k)}>
              {FRAGMENT_KIND_META[k].emoji} {FRAGMENT_KIND_META[k].label}
            </button>
          ))}
        </div>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#9B9A97' }}>{filtered.length}개 조각</p>

      {/* 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              borderRadius: 14,
              border: '2px dashed rgba(0,0,0,0.08)',
              background: '#FAFAF8',
              color: '#AEAAA4',
              fontSize: 14,
            }}
          >
            아직 조각이 없습니다. 위에서 가볍게 한 줄이라도 남겨 보세요.
          </div>
        ) : (
          filtered.map(e => {
            const meta = FRAGMENT_KIND_META[e.kind]
            return (
              <article
                key={e.id}
                style={{
                  padding: 18,
                  borderRadius: 14,
                  border: e.pinned ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(0,0,0,0.06)',
                  backgroundColor: '#FFFFFF',
                  boxShadow: e.pinned ? '0 2px 12px rgba(99,102,241,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', padding: '3px 10px', borderRadius: 999, background: 'rgba(99,102,241,0.1)' }}>
                      {meta.emoji} {meta.label}
                    </span>
                    {e.pinned && <span style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa' }}>📌 고정</span>}
                    <span style={{ fontSize: 11, color: '#AEAAA4' }}>{fmtShort(e.updatedAt)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button type="button" onClick={() => togglePin(e)} style={btnMini}>
                      {e.pinned ? '고정 해제' : '고정'}
                    </button>
                    <button type="button" onClick={() => startEdit(e)} style={btnMini}>
                      편집
                    </button>
                    <button type="button" onClick={() => remove(e.id)} style={{ ...btnMini, color: '#ef4444', borderColor: 'rgba(239,68,68,0.25)' }}>
                      삭제
                    </button>
                  </div>
                </div>
                {e.title ? <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: '#37352F' }}>{e.title}</h2> : null}
                <p style={{ margin: 0, fontSize: 14, color: '#4B5563', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{e.body || '(제목만)'}</p>
              </article>
            )
          })
        )}
      </div>

      <p style={{ marginTop: 32, fontSize: 11, color: '#AEAAA4' }}>로컬 저장 · 동기화 키 <code style={{ fontSize: 10, background: '#F1F1EF', padding: '2px 6px', borderRadius: 4 }}>creative_os_fragment_v1</code></p>
    </div>
  )
}

const inp: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 14px',
  borderRadius: 10,
  border: '1px solid rgba(0,0,0,0.08)',
  background: '#F7F7F5',
  fontSize: 14,
  color: '#37352F',
  outline: 'none',
  fontFamily: 'inherit',
}

function filterChip(active: boolean): CSSProperties {
  return {
    padding: '6px 12px',
    borderRadius: 999,
    border: active ? '1px solid #6366f1' : '1px solid rgba(0,0,0,0.08)',
    background: active ? 'rgba(99,102,241,0.1)' : '#fff',
    color: active ? '#4F46E5' : '#787774',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
  }
}

const btnMini: CSSProperties = {
  padding: '5px 10px',
  borderRadius: 8,
  border: '1px solid rgba(0,0,0,0.08)',
  background: '#FAFAF8',
  fontSize: 11,
  fontWeight: 600,
  color: '#37352F',
  cursor: 'pointer',
}
