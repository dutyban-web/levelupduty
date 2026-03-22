/**
 * Area / Project / Quest — 데이터 보관함 뷰 (리스트 ↔ 카드)
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Database, LayoutGrid, List, Search, X } from 'lucide-react'
import type { AreaRow, ProjectRow } from './supabase'

const VIEW_KEY = 'creative_os_workspace_archive_view_v1'

export type WorkspaceArchiveKind = 'area' | 'project' | 'quest'

export type QuestArchiveRow = {
  id: string
  name: string
  projectId?: string | null
  identityId?: string | null
  status?: string
  deadline?: string
  priority?: number
  tags?: string[]
  timeSpentSec?: number
  pomodoroCount?: number
}

function fmtHM(sec?: number): string | null {
  if (sec == null || sec <= 0) return null
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}시간 ${m}분`
  return `${m}분`
}

function loadViewMode(): 'list' | 'card' {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    if (v === 'list' || v === 'card') return v
  } catch { /* noop */ }
  return 'list'
}

function saveViewMode(m: 'list' | 'card') {
  try {
    localStorage.setItem(VIEW_KEY, m)
  } catch { /* noop */ }
}

const TITLE: Record<WorkspaceArchiveKind, string> = {
  area: 'Vision Area 보관함',
  project: 'Real Projects 보관함',
  quest: '퀘스트 보관함',
}

const SUB: Record<WorkspaceArchiveKind, string> = {
  area: '등록된 영역을 한곳에서 검색·열람합니다.',
  project: '프로젝트와 소속 Area·퀘스트 수를 한눈에 봅니다.',
  quest: '모든 퀘스트의 상태·마감·연결 정보를 정리해 보여줍니다.',
}

export function WorkspaceDataArchiveModal({
  open,
  onClose,
  kind,
  areas,
  projects,
  quests,
  identities,
  completedQuestIds = [],
}: {
  open: boolean
  onClose: () => void
  kind: WorkspaceArchiveKind
  areas: AreaRow[]
  projects: ProjectRow[]
  quests: QuestArchiveRow[]
  identities: { id: string; name: string }[]
  completedQuestIds?: string[]
}) {
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'card'>(() => loadViewMode())

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) setQuery('')
  }, [open, kind])

  const areaById = useMemo(() => new Map(areas.map(a => [a.id, a])), [areas])
  const projectById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects])
  const idName = useMemo(() => new Map(identities.map(i => [i.id, i.name])), [identities])

  const filteredAreas = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return areas
    return areas.filter(a => a.name.toLowerCase().includes(q))
  }, [areas, query])

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = projects
    if (q) {
      list = projects.filter(p => {
        const an = p.area_id ? areaById.get(p.area_id)?.name ?? '' : ''
        return p.name.toLowerCase().includes(q) || an.toLowerCase().includes(q)
      })
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [projects, query, areaById])

  const filteredQuests = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = quests
    if (q) {
      list = quests.filter(x => {
        const pn = x.projectId ? projectById.get(x.projectId)?.name ?? '' : ''
        const tags = (x.tags ?? []).join(' ')
        const idn = x.identityId ? idName.get(x.identityId) ?? '' : ''
        return (
          x.name.toLowerCase().includes(q)
          || pn.toLowerCase().includes(q)
          || (x.status ?? '').toLowerCase().includes(q)
          || tags.toLowerCase().includes(q)
          || idn.toLowerCase().includes(q)
        )
      })
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [quests, query, projectById, idName])

  if (!open) return null

  const setMode = (m: 'list' | 'card') => {
    setViewMode(m)
    saveViewMode(m)
  }

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ws-archive-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100020,
        background: 'rgba(15,18,41,0.52)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: 'min(960px, 100%)',
          maxHeight: 'min(88vh, 900px)',
          background: '#FAFAF9',
          borderRadius: 18,
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#fff', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.12))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Database size={22} color="#4F46E5" strokeWidth={2} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 id="ws-archive-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1c1917' }}>{TITLE[kind]}</h2>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#78716c', lineHeight: 1.45 }}>{SUB[kind]}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden', background: '#fff' }}>
              <button
                type="button"
                onClick={() => setMode('list')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: 'none', cursor: 'pointer',
                  background: viewMode === 'list' ? 'rgba(99,102,241,0.12)' : 'transparent',
                  color: viewMode === 'list' ? '#4F46E5' : '#78716c', fontSize: 12, fontWeight: 700,
                }}
              >
                <List size={16} /> 리스트
              </button>
              <button
                type="button"
                onClick={() => setMode('card')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: 'none', cursor: 'pointer',
                  borderLeft: '1px solid rgba(0,0,0,0.06)',
                  background: viewMode === 'card' ? 'rgba(99,102,241,0.12)' : 'transparent',
                  color: viewMode === 'card' ? '#4F46E5' : '#78716c', fontSize: 12, fontWeight: 700,
                }}
              >
                <LayoutGrid size={16} /> 카드
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={20} color="#57534e" />
            </button>
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 480, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: '8px 12px', background: '#FAFAF9' }}>
            <Search size={18} color="#a8a29e" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="이름·태그·상태로 검색…"
              style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, outline: 'none', color: '#1c1917' }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px 22px' }}>
          {kind === 'area' && (
            viewMode === 'list' ? (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F5F5F4', color: '#57534e', fontSize: 11, fontWeight: 800, textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px' }}>이름</th>
                      <th style={{ padding: '10px 14px' }}>누적 시간</th>
                      <th style={{ padding: '10px 14px' }}>정렬</th>
                      <th style={{ padding: '10px 14px' }}>생성</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAreas.length === 0 ? (
                      <tr><td colSpan={4} style={{ padding: 28, textAlign: 'center', color: '#a8a29e' }}>항목이 없습니다</td></tr>
                    ) : filteredAreas.map(a => (
                      <tr key={a.id} style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: '#1c1917' }}>{a.name}</td>
                        <td style={{ padding: '12px 14px', color: '#57534e' }}>{fmtHM(a.time_spent_sec) ?? '—'}</td>
                        <td style={{ padding: '12px 14px', color: '#78716c' }}>{a.sort_order ?? '—'}</td>
                        <td style={{ padding: '12px 14px', color: '#a8a29e', fontSize: 12 }}>{a.created_at ? String(a.created_at).slice(0, 10) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {filteredAreas.length === 0 ? <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#a8a29e', padding: 24 }}>항목이 없습니다</p> : filteredAreas.map(a => (
                  <div key={a.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '16px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1c1917', lineHeight: 1.35 }}>{a.name}</p>
                    <p style={{ margin: '10px 0 0', fontSize: 12, color: '#78716c' }}>⏱ {fmtHM(a.time_spent_sec) ?? '기록 없음'}</p>
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: '#a8a29e' }}>생성 {a.created_at ? String(a.created_at).slice(0, 10) : '—'}</p>
                  </div>
                ))}
              </div>
            )
          )}

          {kind === 'project' && (
            viewMode === 'list' ? (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F5F5F4', color: '#57534e', fontSize: 11, fontWeight: 800, textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px' }}>프로젝트</th>
                      <th style={{ padding: '10px 14px' }}>Vision Area</th>
                      <th style={{ padding: '10px 14px' }}>퀘스트 수</th>
                      <th style={{ padding: '10px 14px' }}>누적 시간</th>
                      <th style={{ padding: '10px 14px' }}>생성</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: 28, textAlign: 'center', color: '#a8a29e' }}>항목이 없습니다</td></tr>
                    ) : filteredProjects.map(p => {
                      const qc = quests.filter(q => String(q.projectId) === String(p.id)).length
                      const an = p.area_id ? areaById.get(p.area_id)?.name ?? '—' : '—'
                      return (
                        <tr key={p.id} style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 600, color: '#1c1917' }}>{p.name}</td>
                          <td style={{ padding: '12px 14px', color: '#4F46E5', fontWeight: 600 }}>{an}</td>
                          <td style={{ padding: '12px 14px', color: '#57534e' }}>{qc}</td>
                          <td style={{ padding: '12px 14px', color: '#57534e' }}>{fmtHM(p.time_spent_sec) ?? '—'}</td>
                          <td style={{ padding: '12px 14px', color: '#a8a29e', fontSize: 12 }}>{p.created_at ? String(p.created_at).slice(0, 10) : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {filteredProjects.length === 0 ? <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#a8a29e', padding: 24 }}>항목이 없습니다</p> : filteredProjects.map(p => {
                  const qc = quests.filter(q => String(q.projectId) === String(p.id)).length
                  const an = p.area_id ? areaById.get(p.area_id)?.name : null
                  return (
                    <div key={p.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '16px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1c1917', lineHeight: 1.35 }}>{p.name}</p>
                      {an && <p style={{ margin: '8px 0 0', fontSize: 11, fontWeight: 700, color: '#6366f1' }}>🌐 {an}</p>}
                      <p style={{ margin: '10px 0 0', fontSize: 12, color: '#78716c' }}>퀘스트 {qc} · ⏱ {fmtHM(p.time_spent_sec) ?? '—'}</p>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {kind === 'quest' && (
            viewMode === 'list' ? (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 640 }}>
                  <thead>
                    <tr style={{ background: '#F5F5F4', color: '#57534e', fontSize: 11, fontWeight: 800, textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px' }}>퀘스트</th>
                      <th style={{ padding: '10px 12px' }}>프로젝트</th>
                      <th style={{ padding: '10px 12px' }}>Area</th>
                      <th style={{ padding: '10px 12px' }}>상태</th>
                      <th style={{ padding: '10px 12px' }}>마감</th>
                      <th style={{ padding: '10px 12px' }}>태그</th>
                      <th style={{ padding: '10px 12px' }}>포모</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuests.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: 28, textAlign: 'center', color: '#a8a29e' }}>항목이 없습니다</td></tr>
                    ) : filteredQuests.map(q => {
                      const proj = q.projectId ? projectById.get(q.projectId) : undefined
                      const ar = proj?.area_id ? areaById.get(proj.area_id) : undefined
                      const done = completedQuestIds.includes(q.id) || q.status === 'done'
                      const idLabel = q.identityId ? idName.get(q.identityId) : null
                      return (
                        <tr key={q.id} style={{ borderTop: '1px solid rgba(0,0,0,0.05)', opacity: done ? 0.65 : 1 }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1c1917', textDecoration: done ? 'line-through' : undefined }}>{q.name}</td>
                          <td style={{ padding: '10px 12px', color: '#4F46E5' }}>{proj?.name ?? '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#57534e' }}>{ar?.name ?? '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#78716c' }}>{done ? '완료' : (q.status ?? '—')}{idLabel ? ` · ${idLabel}` : ''}</td>
                          <td style={{ padding: '10px 12px', color: '#57534e' }}>{q.deadline ?? '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#a8a29e', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(q.tags ?? []).join(', ') || '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#57534e' }}>{q.pomodoroCount ?? 0}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                {filteredQuests.length === 0 ? <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#a8a29e', padding: 24 }}>항목이 없습니다</p> : filteredQuests.map(q => {
                  const proj = q.projectId ? projectById.get(q.projectId) : undefined
                  const ar = proj?.area_id ? areaById.get(proj.area_id) : undefined
                  const done = completedQuestIds.includes(q.id) || q.status === 'done'
                  const idLabel = q.identityId ? idName.get(q.identityId) : null
                  return (
                    <div key={q.id} style={{ background: '#fff', borderRadius: 14, border: `1px solid ${done ? 'rgba(52,211,153,0.35)' : 'rgba(0,0,0,0.06)'}`, padding: '16px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', opacity: done ? 0.72 : 1 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#1c1917', lineHeight: 1.35, textDecoration: done ? 'line-through' : undefined }}>{q.name}</p>
                      <p style={{ margin: '8px 0 0', fontSize: 11, color: '#6366f1', fontWeight: 600 }}>{proj?.name ?? '프로젝트 없음'}{ar ? ` · ${ar.name}` : ''}</p>
                      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: done ? 'rgba(52,211,153,0.15)' : 'rgba(99,102,241,0.1)', color: done ? '#047857' : '#4F46E5' }}>{done ? '완료' : (q.status ?? '진행')}</span>
                        {q.deadline && <span style={{ fontSize: 10, color: '#78716c' }}>📅 {q.deadline}</span>}
                        {idLabel && <span style={{ fontSize: 10, color: '#78716c' }}>태세 {idLabel}</span>}
                      </div>
                      {(q.tags ?? []).length > 0 && (
                        <p style={{ margin: '10px 0 0', fontSize: 11, color: '#a8a29e' }}>{(q.tags ?? []).join(' · ')}</p>
                      )}
                      <p style={{ margin: '8px 0 0', fontSize: 11, color: '#78716c' }}>🍅 {q.pomodoroCount ?? 0}</p>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}

/** 작은 보관함 입구 버튼 (우측 상단용) */
export function WorkspaceArchiveTrigger({
  title,
  onClick,
}: {
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={e => { e.stopPropagation(); onClick() }}
      style={{
        flexShrink: 0,
        width: 34,
        height: 34,
        borderRadius: 10,
        border: '1px solid rgba(99,102,241,0.22)',
        background: 'rgba(99,102,241,0.06)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Database size={17} color="#4F46E5" strokeWidth={2} />
    </button>
  )
}
