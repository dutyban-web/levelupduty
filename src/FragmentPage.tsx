/**
 * Fragment — 영감 구름 + 노트북 서가 + 유통기한 시스템
 */
import React, { useState, useEffect, useMemo, useCallback, useRef, type CSSProperties } from 'react'
import {
  loadFragmentStore,
  saveFragmentStore,
  upsertFragment,
  softDeleteFragment,
  getActiveFragmentEntries,
  preserveFragment,
  autoTrashExpired,
  upsertNotebook,
  removeNotebook,
  assignToNotebook,
  mergeFragments,
  decayRatio,
  isExpired,
  FRAGMENT_KIND_META,
  EXPIRY_MS,
  type FragmentStore,
  type FragmentKind,
  type FragmentEntry,
  type FragmentNotebook,
} from './fragmentData'
import { Plus, BookOpen, Cloud, List, Trash2, Archive, Pin, Pencil, Sparkles, GripVertical } from 'lucide-react'
import { useIsMobile } from './hooks/useIsMobile'

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

function remainingLabel(e: FragmentEntry): string {
  if (e.preserved || e.pinned) return '보관됨'
  const rem = EXPIRY_MS - (Date.now() - new Date(e.createdAt).getTime())
  if (rem <= 0) return '소멸'
  const h = Math.floor(rem / 3600000)
  const m = Math.floor((rem % 3600000) / 60000)
  return `${h}시간 ${m}분`
}

type ViewMode = 'list' | 'cloud' | 'notebook'

export function FragmentPage() {
  const isMobile = useIsMobile()
  const [store, setStore] = useState<FragmentStore>(() => loadFragmentStore())
  const [kind, setKind] = useState<FragmentKind>('memo')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterKind, setFilterKind] = useState<FragmentKind | 'all' | 'expiring'>('all')
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null)

  const persist = useCallback((next: FragmentStore) => {
    setStore(next)
    saveFragmentStore(next)
  }, [])

  useEffect(() => {
    const trashed = autoTrashExpired(store)
    if (trashed !== store) persist(trashed)
  }, [])

  useEffect(() => {
    const iv = setInterval(() => {
      setStore(prev => {
        const next = autoTrashExpired(prev)
        if (next !== prev) {
          saveFragmentStore(next)
          return next
        }
        return prev
      })
    }, 60000)
    return () => clearInterval(iv)
  }, [])

  const [, forceRender] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => forceRender(c => c + 1), 30000)
    return () => clearInterval(iv)
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
    const existing = store.entries.find(e => e.id === editingId)
    const next = upsertFragment(store, {
      id: editingId ?? undefined,
      kind,
      title: title.trim(),
      body: body.trim(),
      pinned: existing?.pinned ?? false,
      preserved: existing?.preserved,
      notebookId: existing?.notebookId ?? (activeNotebookId && viewMode === 'notebook' ? activeNotebookId : undefined),
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

  const doPreserve = (id: string) => {
    persist(preserveFragment(store, id))
  }

  const remove = (id: string) => {
    if (!window.confirm('이 조각을 휴지통으로 보낼까요?')) return
    persist(softDeleteFragment(store, id))
    if (editingId === id) resetComposer()
  }

  const filtered = useMemo(() => {
    let list = getActiveFragmentEntries(store)
    if (viewMode === 'notebook' && activeNotebookId) {
      list = list.filter(e => e.notebookId === activeNotebookId)
    }
    if (filterKind === 'expiring') {
      list = list.filter(e => !e.preserved && !e.pinned && decayRatio(e) > 0.5)
    } else if (filterKind !== 'all') {
      list = list.filter(e => e.kind === filterKind)
    }
    const q = query.trim().toLowerCase()
    if (q) list = list.filter(e => `${e.title} ${e.body}`.toLowerCase().includes(q))
    list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updatedAt.localeCompare(a.updatedAt)
    })
    return list
  }, [store.entries, filterKind, query, viewMode, activeNotebookId])

  const addNotebook = () => {
    const t = window.prompt('노트북 이름')
    if (!t?.trim()) return
    const emoji = window.prompt('이모지 (기본: 📓)') || '📓'
    persist(upsertNotebook(store, { title: t.trim(), emoji: emoji.trim() }))
  }

  const deleteNotebook = (id: string) => {
    if (!window.confirm('이 노트북을 삭제할까요? (조각은 유지됩니다)')) return
    persist(removeNotebook(store, id))
    if (activeNotebookId === id) setActiveNotebookId(null)
  }

  const moveToNotebook = (fragId: string, nbId: string | undefined) => {
    persist(assignToNotebook(store, fragId, nbId))
  }

  return (
    <div style={{ margin: '0 auto', padding: isMobile ? '14px 10px 40px' : '24px 28px 56px', minHeight: 'calc(100vh - 52px)', maxWidth: viewMode === 'cloud' ? undefined : 1200 }}>
      {/* Header */}
      <header style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22, lineHeight: 1, opacity: 0.85 }}>◇</span>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#6366f1', letterSpacing: '0.18em', textTransform: 'uppercase' }}>Fragment</p>
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: isMobile ? 22 : 26, fontWeight: 900, color: '#37352F' }}>떠오른 조각</h1>
        <p style={{ margin: 0, fontSize: 13, color: '#787774', lineHeight: 1.65, maxWidth: 620 }}>
          조각은 <strong>72시간</strong> 유통기한이 있습니다. 시간이 지나면 흐려지다 소멸합니다. <strong>보관</strong> 또는 <strong>노트북</strong>에 넣으면 영구 보존됩니다.
        </p>
      </header>

      {/* View mode toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {([['list', '리스트', <List size={14} key="l" />], ['cloud', '영감 구름', <Cloud size={14} key="c" />], ['notebook', '노트북', <BookOpen size={14} key="n" />]] as const).map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setViewMode(id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 10,
              border: viewMode === id ? '1px solid #6366f1' : '1px solid rgba(0,0,0,0.08)',
              background: viewMode === id ? 'rgba(99,102,241,0.1)' : '#fff',
              color: viewMode === id ? '#4f46e5' : '#57534e',
              fontWeight: 700, fontSize: 12, cursor: 'pointer',
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {viewMode === 'notebook' ? (
        <NotebookView
          store={store}
          isMobile={isMobile}
          persist={persist}
          filtered={filtered}
          activeNotebookId={activeNotebookId}
          setActiveNotebookId={setActiveNotebookId}
          onAddNotebook={addNotebook}
          onDeleteNotebook={deleteNotebook}
          onStartEdit={startEdit}
          onTogglePin={togglePin}
          onPreserve={doPreserve}
          onRemove={remove}
          onMoveToNotebook={moveToNotebook}
          filterKind={filterKind}
          setFilterKind={setFilterKind}
          query={query}
          setQuery={setQuery}
          kind={kind}
          setKind={setKind}
          title={title}
          setTitle={setTitle}
          body={body}
          setBody={setBody}
          editingId={editingId}
          save={save}
          resetComposer={resetComposer}
        />
      ) : viewMode === 'cloud' ? (
        <InspirationCloud
          entries={filtered}
          store={store}
          persist={persist}
          onStartEdit={startEdit}
          onTogglePin={togglePin}
          onPreserve={doPreserve}
          onRemove={remove}
        />
      ) : (
        <ListView
          isMobile={isMobile}
          filtered={filtered}
          store={store}
          filterKind={filterKind}
          setFilterKind={setFilterKind}
          query={query}
          setQuery={setQuery}
          kind={kind}
          setKind={setKind}
          title={title}
          setTitle={setTitle}
          body={body}
          setBody={setBody}
          editingId={editingId}
          save={save}
          resetComposer={resetComposer}
          onStartEdit={startEdit}
          onTogglePin={togglePin}
          onPreserve={doPreserve}
          onRemove={remove}
        />
      )}

      <p style={{ marginTop: 32, fontSize: 11, color: '#AEAAA4' }}>
        로컬 저장 · 동기화 키 <code style={{ fontSize: 10, background: '#F1F1EF', padding: '2px 6px', borderRadius: 4 }}>creative_os_fragment_v1</code>
      </p>
    </div>
  )
}

/* ═══════════════════ Shared Styles ═══════════════════════════════════════════ */

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
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
}

function decayStyle(e: FragmentEntry): CSSProperties {
  const d = decayRatio(e)
  if (d <= 0) return {}
  return {
    opacity: 1 - d * 0.55,
    filter: d > 0.7 ? `grayscale(${Math.round(d * 60)}%)` : undefined,
    borderColor: d > 0.5 ? `rgba(180,160,140,${0.15 + d * 0.3})` : undefined,
    boxShadow: d > 0.7 ? `inset 0 0 20px rgba(160,140,120,${d * 0.15})` : undefined,
  }
}

function ExpiryBadge({ e }: { e: FragmentEntry }) {
  const d = decayRatio(e)
  if (e.preserved || e.pinned) {
    return <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: 999 }}>보관됨</span>
  }
  const label = remainingLabel(e)
  const color = d > 0.7 ? '#b91c1c' : d > 0.4 ? '#d97706' : '#6b7280'
  const bg = d > 0.7 ? '#fef2f2' : d > 0.4 ? '#fffbeb' : '#f9fafb'
  return <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, padding: '2px 8px', borderRadius: 999 }}>{label}</span>
}

/* ═══════════════════ Composer ════════════════════════════════════════════════ */

function Composer({
  kind, setKind, title, setTitle, body, setBody, editingId, save, resetComposer, isMobile,
}: {
  kind: FragmentKind; setKind: (k: FragmentKind) => void
  title: string; setTitle: (s: string) => void
  body: string; setBody: (s: string) => void
  editingId: string | null; save: () => void; resetComposer: () => void
  isMobile: boolean
}) {
  const hasContent = body.trim() || title.trim()
  return (
    <div style={{ marginBottom: 24, padding: isMobile ? 18 : 22, borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, color: '#37352F' }}>{editingId ? '조각 수정' : '새 조각'}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {KINDS.map(k => {
          const meta = FRAGMENT_KIND_META[k]
          const on = kind === k
          return (
            <button key={k} type="button" onClick={() => setKind(k)} style={{ padding: '8px 14px', borderRadius: 999, border: on ? '1px solid #6366f1' : '1px solid rgba(0,0,0,0.08)', background: on ? 'rgba(99,102,241,0.1)' : '#F7F7F5', color: on ? '#4F46E5' : '#787774', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {meta.emoji} {meta.label}
            </button>
          )
        })}
      </div>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="제목 (선택)" style={inp} />
      <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="여기에 적어요…" rows={5} style={{ ...inp, marginTop: 10, minHeight: 120, resize: 'vertical', lineHeight: 1.6 }} />
      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <button type="button" onClick={save} disabled={!hasContent} style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: hasContent ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : '#EBEBEA', color: hasContent ? '#fff' : '#AEAAA4', fontSize: 14, fontWeight: 800, cursor: hasContent ? 'pointer' : 'not-allowed' }}>
          {editingId ? '저장' : '남기기'}
        </button>
        {editingId && (
          <button type="button" onClick={resetComposer} style={{ padding: '11px 18px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', background: '#fff', color: '#787774', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            취소
          </button>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════ Fragment Card ═══════════════════════════════════════════ */

function FragmentCard({
  e,
  onStartEdit,
  onTogglePin,
  onPreserve,
  onRemove,
  showNotebookBtns,
  notebooks,
  onMoveToNotebook,
}: {
  e: FragmentEntry
  onStartEdit: (e: FragmentEntry) => void
  onTogglePin: (e: FragmentEntry) => void
  onPreserve: (id: string) => void
  onRemove: (id: string) => void
  showNotebookBtns?: boolean
  notebooks?: FragmentNotebook[]
  onMoveToNotebook?: (fId: string, nbId: string | undefined) => void
}) {
  const meta = FRAGMENT_KIND_META[e.kind]
  return (
    <article style={{ padding: 18, borderRadius: 14, border: e.pinned ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(0,0,0,0.06)', backgroundColor: '#fff', boxShadow: e.pinned ? '0 2px 12px rgba(99,102,241,0.08)' : '0 1px 3px rgba(0,0,0,0.04)', ...decayStyle(e) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', padding: '3px 10px', borderRadius: 999, background: 'rgba(99,102,241,0.1)' }}>{meta.emoji} {meta.label}</span>
          {e.pinned && <span style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa' }}>📌</span>}
          <ExpiryBadge e={e} />
          <span style={{ fontSize: 11, color: '#AEAAA4' }}>{fmtShort(e.updatedAt)}</span>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap' }}>
          {!e.preserved && !e.pinned && (
            <button type="button" onClick={() => onPreserve(e.id)} style={{ ...btnMini, color: '#059669', borderColor: '#6ee7b7' }}>
              <Archive size={12} /> 보관
            </button>
          )}
          <button type="button" onClick={() => onTogglePin(e)} style={btnMini}>
            <Pin size={12} /> {e.pinned ? '해제' : '고정'}
          </button>
          <button type="button" onClick={() => onStartEdit(e)} style={btnMini}>
            <Pencil size={12} />
          </button>
          <button type="button" onClick={() => onRemove(e.id)} style={{ ...btnMini, color: '#ef4444', borderColor: 'rgba(239,68,68,0.25)' }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {e.title ? <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: '#37352F' }}>{e.title}</h2> : null}
      <p style={{ margin: 0, fontSize: 14, color: '#4B5563', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{e.body || '(제목만)'}</p>
      {showNotebookBtns && notebooks && onMoveToNotebook && notebooks.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, lineHeight: '24px' }}>노트북:</span>
          {notebooks.map(nb => (
            <button key={nb.id} type="button" onClick={() => onMoveToNotebook(e.id, e.notebookId === nb.id ? undefined : nb.id)} style={{ ...btnMini, fontSize: 10, padding: '3px 8px', background: e.notebookId === nb.id ? 'rgba(99,102,241,0.12)' : '#fafafa', borderColor: e.notebookId === nb.id ? '#6366f1' : 'rgba(0,0,0,0.06)', color: e.notebookId === nb.id ? '#4f46e5' : '#787774' }}>
              {nb.emoji} {nb.title}
            </button>
          ))}
        </div>
      )}
    </article>
  )
}

/* ═══════════════════ List View ═══════════════════════════════════════════════ */

function ListView({
  isMobile, filtered, store,
  filterKind, setFilterKind, query, setQuery,
  kind, setKind, title, setTitle, body, setBody, editingId, save, resetComposer,
  onStartEdit, onTogglePin, onPreserve, onRemove,
}: {
  isMobile: boolean; filtered: FragmentEntry[]; store: FragmentStore
  filterKind: FragmentKind | 'all' | 'expiring'; setFilterKind: (f: FragmentKind | 'all' | 'expiring') => void
  query: string; setQuery: (s: string) => void
  kind: FragmentKind; setKind: (k: FragmentKind) => void
  title: string; setTitle: (s: string) => void
  body: string; setBody: (s: string) => void
  editingId: string | null; save: () => void; resetComposer: () => void
  onStartEdit: (e: FragmentEntry) => void; onTogglePin: (e: FragmentEntry) => void; onPreserve: (id: string) => void; onRemove: (id: string) => void
}) {
  const expiringCount = useMemo(() => getActiveFragmentEntries(store).filter(e => !e.preserved && !e.pinned && decayRatio(e) > 0.5).length, [store.entries])
  return (
    <>
      <Composer kind={kind} setKind={setKind} title={title} setTitle={setTitle} body={body} setBody={setBody} editingId={editingId} save={save} resetComposer={resetComposer} isMobile={isMobile} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="검색…" style={{ ...inp, flex: '1 1 200px', maxWidth: 320 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setFilterKind('all')} style={filterChip(filterKind === 'all')}>전체</button>
          {KINDS.map(k => (
            <button key={k} type="button" onClick={() => setFilterKind(k)} style={filterChip(filterKind === k)}>
              {FRAGMENT_KIND_META[k].emoji} {FRAGMENT_KIND_META[k].label}
            </button>
          ))}
          <button type="button" onClick={() => setFilterKind('expiring')} style={{ ...filterChip(filterKind === 'expiring'), color: filterKind === 'expiring' ? '#b91c1c' : '#d97706', borderColor: filterKind === 'expiring' ? '#fca5a5' : 'rgba(0,0,0,0.08)', background: filterKind === 'expiring' ? '#fef2f2' : '#fff' }}>
            ⏳ 소멸 임박{expiringCount > 0 && ` (${expiringCount})`}
          </button>
        </div>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#9B9A97' }}>{filtered.length}개 조각</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', borderRadius: 14, border: '2px dashed rgba(0,0,0,0.08)', background: '#FAFAF8', color: '#AEAAA4', fontSize: 14 }}>
            {filterKind === 'expiring' ? '소멸 임박 조각이 없습니다.' : '아직 조각이 없습니다.'}
          </div>
        ) : (
          filtered.map(e => (
            <FragmentCard key={e.id} e={e} onStartEdit={onStartEdit} onTogglePin={onTogglePin} onPreserve={onPreserve} onRemove={onRemove} showNotebookBtns notebooks={store.notebooks} onMoveToNotebook={undefined} />
          ))
        )}
      </div>
    </>
  )
}

/* ═══════════════════ Notebook View ══════════════════════════════════════════ */

function NotebookView({
  store, isMobile, persist, filtered, activeNotebookId, setActiveNotebookId,
  onAddNotebook, onDeleteNotebook, onStartEdit, onTogglePin, onPreserve, onRemove, onMoveToNotebook,
  filterKind, setFilterKind, query, setQuery,
  kind, setKind, title, setTitle, body, setBody, editingId, save, resetComposer,
}: {
  store: FragmentStore; isMobile: boolean; persist: (s: FragmentStore) => void
  filtered: FragmentEntry[]; activeNotebookId: string | null; setActiveNotebookId: (id: string | null) => void
  onAddNotebook: () => void; onDeleteNotebook: (id: string) => void
  onStartEdit: (e: FragmentEntry) => void; onTogglePin: (e: FragmentEntry) => void; onPreserve: (id: string) => void; onRemove: (id: string) => void
  onMoveToNotebook: (fId: string, nbId: string | undefined) => void
  filterKind: FragmentKind | 'all' | 'expiring'; setFilterKind: (f: FragmentKind | 'all' | 'expiring') => void
  query: string; setQuery: (s: string) => void
  kind: FragmentKind; setKind: (k: FragmentKind) => void
  title: string; setTitle: (s: string) => void
  body: string; setBody: (s: string) => void
  editingId: string | null; save: () => void; resetComposer: () => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '240px 1fr', gap: 20, alignItems: 'start' }}>
      {/* Left: Bookshelf */}
      <aside style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '14px 12px', position: isMobile ? 'static' : 'sticky', top: 68 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#37352F' }}>서가</h3>
          <button type="button" onClick={onAddNotebook} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6366f1', fontWeight: 700, fontSize: 18 }} title="노트북 추가">
            <Plus size={18} />
          </button>
        </div>
        {/* All fragments button */}
        <button
          type="button"
          onClick={() => setActiveNotebookId(null)}
          style={{
            width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 12px', borderRadius: 10, marginBottom: 4, cursor: 'pointer',
            border: !activeNotebookId ? '1px solid #6366f1' : '1px solid transparent',
            background: !activeNotebookId ? 'rgba(99,102,241,0.08)' : 'transparent',
            color: !activeNotebookId ? '#4f46e5' : '#57534e',
            fontWeight: 700, fontSize: 13,
          }}
        >
          <span style={{ fontSize: 16 }}>◇</span> 전체 조각
        </button>
        {store.notebooks.map(nb => {
          const count = getActiveFragmentEntries(store).filter(e => e.notebookId === nb.id).length
          const active = activeNotebookId === nb.id
          return (
            <div key={nb.id} style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
              <button
                type="button"
                onClick={() => setActiveNotebookId(nb.id)}
                style={{
                  flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                  border: active ? '1px solid #6366f1' : '1px solid transparent',
                  background: active ? 'rgba(99,102,241,0.08)' : 'transparent',
                  color: active ? '#4f46e5' : '#37352F',
                  fontWeight: 700, fontSize: 13,
                  minWidth: 0,
                }}
              >
                <span style={{ fontSize: 16 }}>{nb.emoji}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{nb.title}</span>
                <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>{count}</span>
              </button>
              <button type="button" onClick={() => onDeleteNotebook(nb.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
                <Trash2 size={12} color="#9ca3af" />
              </button>
            </div>
          )
        })}
      </aside>

      {/* Right: Editor / list */}
      <div>
        <Composer kind={kind} setKind={setKind} title={title} setTitle={setTitle} body={body} setBody={setBody} editingId={editingId} save={save} resetComposer={resetComposer} isMobile={isMobile} />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="검색…" style={{ ...inp, flex: '1 1 200px', maxWidth: 280 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setFilterKind('all')} style={filterChip(filterKind === 'all')}>전체</button>
            {KINDS.map(k => (
              <button key={k} type="button" onClick={() => setFilterKind(k)} style={filterChip(filterKind === k)}>
                {FRAGMENT_KIND_META[k].emoji} {FRAGMENT_KIND_META[k].label}
              </button>
            ))}
          </div>
        </div>

        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#9B9A97' }}>{filtered.length}개 조각</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', borderRadius: 14, border: '2px dashed rgba(0,0,0,0.08)', background: '#FAFAF8', color: '#AEAAA4', fontSize: 14 }}>
              {activeNotebookId ? '이 노트북에 조각이 없습니다.' : '조각이 없습니다.'}
            </div>
          ) : (
            filtered.map(e => (
              <FragmentCard key={e.id} e={e} onStartEdit={onStartEdit} onTogglePin={onTogglePin} onPreserve={onPreserve} onRemove={onRemove} showNotebookBtns notebooks={store.notebooks} onMoveToNotebook={onMoveToNotebook} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════ Inspiration Cloud ══════════════════════════════════════ */

type CloudPos = { x: number; y: number; vx: number; vy: number }

function InspirationCloud({
  entries, store, persist,
  onStartEdit, onTogglePin, onPreserve, onRemove,
}: {
  entries: FragmentEntry[]; store: FragmentStore; persist: (s: FragmentStore) => void
  onStartEdit: (e: FragmentEntry) => void; onTogglePin: (e: FragmentEntry) => void; onPreserve: (id: string) => void; onRemove: (id: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const posRef = useRef<Map<string, CloudPos>>(new Map())
  const draggingRef = useRef<string | null>(null)
  const dragOffRef = useRef({ x: 0, y: 0 })
  const [, refresh] = useState(0)
  const [mergeHint, setMergeHint] = useState<{ a: string; b: string } | null>(null)
  const rafRef = useRef<number | null>(null)

  const CARD_W = 180
  const CARD_H = 120
  const MERGE_DIST = 50

  useEffect(() => {
    const rect = containerRef.current?.getBoundingClientRect()
    const cw = rect?.width ?? 800
    const ch = rect?.height ?? 600

    for (const e of entries) {
      if (!posRef.current.has(e.id)) {
        posRef.current.set(e.id, {
          x: Math.random() * Math.max(100, cw - CARD_W - 40) + 20,
          y: Math.random() * Math.max(100, ch - CARD_H - 40) + 20,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
        })
      }
    }
    const currentIds = new Set(entries.map(e => e.id))
    for (const k of posRef.current.keys()) {
      if (!currentIds.has(k)) posRef.current.delete(k)
    }
  }, [entries])

  useEffect(() => {
    const animate = () => {
      const rect = containerRef.current?.getBoundingClientRect()
      const cw = rect?.width ?? 800
      const ch = rect?.height ?? 600
      const positions = posRef.current

      for (const [id, p] of positions) {
        if (id === draggingRef.current) continue
        p.x += p.vx
        p.y += p.vy

        if (p.x < 10 || p.x > cw - CARD_W - 10) p.vx *= -1
        if (p.y < 10 || p.y > ch - CARD_H - 10) p.vy *= -1
        p.x = Math.max(5, Math.min(cw - CARD_W - 5, p.x))
        p.y = Math.max(5, Math.min(ch - CARD_H - 5, p.y))

        if (Math.random() < 0.005) {
          p.vx += (Math.random() - 0.5) * 0.2
          p.vy += (Math.random() - 0.5) * 0.2
        }
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (speed > 0.6) {
          p.vx *= 0.98
          p.vy *= 0.98
        }
      }
      refresh(c => c + 1)
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const onPointerDown = (id: string, ev: React.PointerEvent) => {
    ev.preventDefault()
    draggingRef.current = id
    const p = posRef.current.get(id)
    const rect = containerRef.current?.getBoundingClientRect()
    if (p && rect) {
      const localX = ev.clientX - rect.left
      const localY = ev.clientY - rect.top
      dragOffRef.current = { x: localX - p.x, y: localY - p.y }
    }
    const el = ev.currentTarget as HTMLElement
    el.setPointerCapture(ev.pointerId)
  }

  const onPointerMove = (ev: React.PointerEvent) => {
    const id = draggingRef.current
    if (!id) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const p = posRef.current.get(id)
    if (!p) return
    p.x = ev.clientX - rect.left - dragOffRef.current.x
    p.y = ev.clientY - rect.top - dragOffRef.current.y
    p.vx = 0
    p.vy = 0

    let nearest: string | null = null
    let minD = Infinity
    for (const [oId, op] of posRef.current) {
      if (oId === id) continue
      const dx = (p.x + CARD_W / 2) - (op.x + CARD_W / 2)
      const dy = (p.y + CARD_H / 2) - (op.y + CARD_H / 2)
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < MERGE_DIST + CARD_W && dist < minD) {
        minD = dist
        nearest = oId
      }
    }
    setMergeHint(nearest && minD < MERGE_DIST + CARD_W / 2 ? { a: id, b: nearest } : null)
  }

  const onPointerUp = () => {
    const id = draggingRef.current
    draggingRef.current = null
    if (!id || !mergeHint) {
      setMergeHint(null)
      return
    }
    if (window.confirm('두 조각을 융합할까요?')) {
      persist(mergeFragments(store, mergeHint.a, mergeHint.b))
    }
    setMergeHint(null)
  }

  return (
    <div
      ref={containerRef}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: 'relative',
        width: '100%',
        height: 'max(65vh, 500px)',
        borderRadius: 20,
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at 30% 40%, #1e1b4b 0%, #0f172a 50%, #020617 100%)',
        border: '1px solid rgba(99,102,241,0.2)',
        cursor: draggingRef.current ? 'grabbing' : 'default',
      }}
    >
      {/* Stars bg */}
      <CloudStars />

      {entries.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 16, fontWeight: 600 }}>
          리스트 뷰에서 조각을 추가해 보세요. 이곳에 떠다닙니다.
        </div>
      )}

      {entries.map(e => {
        const p = posRef.current.get(e.id)
        if (!p) return null
        const isMergeTarget = mergeHint?.a === e.id || mergeHint?.b === e.id
        const d = decayRatio(e)
        return (
          <div
            key={e.id}
            onPointerDown={ev => onPointerDown(e.id, ev)}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              width: CARD_W,
              minHeight: CARD_H,
              padding: '12px 14px',
              borderRadius: 14,
              background: isMergeTarget
                ? 'rgba(99,102,241,0.35)'
                : `rgba(255,255,255,${0.08 + (1 - d) * 0.07})`,
              backdropFilter: 'blur(10px)',
              border: isMergeTarget
                ? '2px solid #818cf8'
                : `1px solid rgba(255,255,255,${0.1 + (1 - d) * 0.1})`,
              boxShadow: isMergeTarget
                ? '0 0 30px rgba(99,102,241,0.5)'
                : `0 4px 20px rgba(0,0,0,${0.2 + d * 0.15})`,
              color: '#fff',
              cursor: draggingRef.current === e.id ? 'grabbing' : 'grab',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              opacity: 1 - d * 0.4,
              transition: isMergeTarget ? 'border 0.2s, box-shadow 0.2s, background 0.2s' : 'none',
              zIndex: draggingRef.current === e.id ? 100 : 1,
              touchAction: 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#a5b4fc', background: 'rgba(99,102,241,0.25)', padding: '2px 8px', borderRadius: 999 }}>
                {FRAGMENT_KIND_META[e.kind].emoji} {FRAGMENT_KIND_META[e.kind].label}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                {!e.preserved && !e.pinned && (
                  <button type="button" onClick={ev => { ev.stopPropagation(); onPreserve(e.id) }} style={{ border: 'none', background: 'rgba(255,255,255,0.15)', borderRadius: 6, padding: 4, cursor: 'pointer', color: '#6ee7b7', fontSize: 10, fontWeight: 700 }} title="보관">
                    <Archive size={12} />
                  </button>
                )}
                <button type="button" onClick={ev => { ev.stopPropagation(); onRemove(e.id) }} style={{ border: 'none', background: 'rgba(255,255,255,0.1)', borderRadius: 6, padding: 4, cursor: 'pointer', color: '#fca5a5' }} title="삭제">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            {e.title && <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 800, lineHeight: 1.3 }}>{e.title}</p>}
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: 'rgba(255,255,255,0.8)', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{e.body || '(내용 없음)'}</p>
            <div style={{ marginTop: 6, fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
              <ExpiryBadgeCloud e={e} />
            </div>
          </div>
        )
      })}

      {mergeHint && (
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(99,102,241,0.9)', color: '#fff', padding: '8px 20px', borderRadius: 999, fontSize: 13, fontWeight: 800, boxShadow: '0 4px 20px rgba(99,102,241,0.5)' }}>
          <Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          놓으면 두 조각을 융합합니다
        </div>
      )}
    </div>
  )
}

function ExpiryBadgeCloud({ e }: { e: FragmentEntry }) {
  if (e.preserved || e.pinned) return <span style={{ color: '#6ee7b7' }}>보관됨</span>
  const label = remainingLabel(e)
  const d = decayRatio(e)
  const color = d > 0.7 ? '#fca5a5' : d > 0.4 ? '#fcd34d' : 'rgba(255,255,255,0.5)'
  return <span style={{ color }}>{label}</span>
}

function CloudStars() {
  const stars = useMemo(() => {
    const arr: { x: number; y: number; s: number; o: number; d: number }[] = []
    for (let i = 0; i < 80; i++) {
      arr.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        s: Math.random() * 2 + 0.5,
        o: Math.random() * 0.6 + 0.1,
        d: Math.random() * 8 + 4,
      })
    }
    return arr
  }, [])

  return (
    <>
      {stars.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.s,
            height: s.s,
            borderRadius: '50%',
            background: '#fff',
            opacity: s.o,
            animation: `twinkle ${s.d}s ease-in-out infinite alternate`,
            pointerEvents: 'none',
          }}
        />
      ))}
      <style>{`@keyframes twinkle { 0% { opacity: 0.1; } 100% { opacity: 0.7; } }`}</style>
    </>
  )
}
