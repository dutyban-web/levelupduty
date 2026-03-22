/**
 * Real Projects 허브 — Travel Center와 동일한 UX 패턴(목록·필터·카드·상세)
 * 프로젝트별 깊은 기록은 KV + localStorage 동기화 (퀘스트와 별개 워크스페이스)
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { kvSet } from './lib/supabase'
import type { AreaRow, ProjectRow, IdentityRow } from './supabase'
import {
  Plus, Trash2, GripVertical, ChevronUp, ChevronDown, ExternalLink, MoreHorizontal,
  Target, ListChecks, Flag, BookOpen, AlertTriangle, Layers, CalendarRange,
} from 'lucide-react'
import { WorkspaceDataArchiveModal, WorkspaceArchiveTrigger, type WorkspaceArchiveKind } from './WorkspaceDataArchiveModal'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export const PROJECT_WORKSPACE_KEY = 'creative_os_project_workspace_v1'
export const PROJECT_HUB_PREFS_KEY = 'creative_os_project_hub_prefs_v1'

type QuestMini = { id: string; name: string; projectId?: string | null }

export type ProjectStatus = 'planning' | 'active' | 'paused' | 'done' | 'archive'

export type ProjectWorkspaceDetail = {
  heroIcon?: string
  heroMemo?: string
  mission?: string
  northStar?: string
  deepNotes?: string
  weeklyFocus?: string
  /** YYYY-MM-DD */
  periodStart?: string
  /** YYYY-MM-DD 마감 */
  periodEnd?: string
  statusTag?: ProjectStatus
  customTags?: string[]
  checklist?: { id: string; label: string; checked: boolean }[]
  milestones?: { id: string; title: string; targetDate?: string; note?: string; done?: boolean }[]
  resources?: { id: string; title: string; url?: string; note?: string }[]
  risks?: { id: string; text: string }[]
}

function defaultWorkspace(): ProjectWorkspaceDetail {
  return {
    heroIcon: '📁',
    heroMemo: '',
    mission: '',
    northStar: '',
    deepNotes: '',
    weeklyFocus: '',
    statusTag: 'active',
    customTags: [],
    checklist: [],
    milestones: [],
    resources: [],
    risks: [],
  }
}

function loadWorkspace(projectId: string): ProjectWorkspaceDetail {
  try {
    const raw = localStorage.getItem(PROJECT_WORKSPACE_KEY)
    if (!raw) return defaultWorkspace()
    const all = JSON.parse(raw) as Record<string, ProjectWorkspaceDetail>
    const s = all[projectId]
    if (!s) return defaultWorkspace()
    const d = defaultWorkspace()
    return {
      ...d,
      ...s,
      checklist: Array.isArray(s.checklist) ? s.checklist : [],
      milestones: Array.isArray(s.milestones) ? s.milestones : [],
      resources: Array.isArray(s.resources) ? s.resources : [],
      risks: Array.isArray(s.risks) ? s.risks : [],
      customTags: Array.isArray(s.customTags) ? s.customTags : [],
    }
  } catch {
    return defaultWorkspace()
  }
}

export function saveProjectWorkspace(projectId: string, data: ProjectWorkspaceDetail) {
  try {
    const raw = localStorage.getItem(PROJECT_WORKSPACE_KEY)
    const all: Record<string, ProjectWorkspaceDetail> = raw ? JSON.parse(raw) : {}
    all[projectId] = data
    localStorage.setItem(PROJECT_WORKSPACE_KEY, JSON.stringify(all))
    kvSet(PROJECT_WORKSPACE_KEY, all)
  } catch { /* ignore */ }
}

type HubPrefs = {
  sortOrder: 'manual' | 'name' | 'time' | 'status' | 'deadline'
  sortDirection: 'asc' | 'desc'
  filterAreaId: string | '' // '' = all
  filterStatus: ProjectStatus | 'all'
  groupByArea: boolean
  cardMinWidth: number
  manualOrderIds: string[]
}

const defaultHubPrefs = (): HubPrefs => ({
  sortOrder: 'manual',
  sortDirection: 'asc',
  filterAreaId: '',
  filterStatus: 'all',
  groupByArea: true,
  cardMinWidth: 200,
  manualOrderIds: [],
})

function loadPrefs(): HubPrefs {
  try {
    const raw = localStorage.getItem(PROJECT_HUB_PREFS_KEY)
    if (!raw) return defaultHubPrefs()
    const p = JSON.parse(raw) as Partial<HubPrefs>
    return {
      sortOrder: p.sortOrder ?? 'manual',
      sortDirection: p.sortDirection ?? 'asc',
      filterAreaId: p.filterAreaId ?? '',
      filterStatus: (p.filterStatus as HubPrefs['filterStatus']) ?? 'all',
      groupByArea: p.groupByArea ?? true,
      cardMinWidth: typeof p.cardMinWidth === 'number' ? Math.min(360, Math.max(160, p.cardMinWidth)) : 200,
      manualOrderIds: Array.isArray(p.manualOrderIds) ? p.manualOrderIds : [],
    }
  } catch {
    return defaultHubPrefs()
  }
}

function savePrefs(p: HubPrefs) {
  try {
    localStorage.setItem(PROJECT_HUB_PREFS_KEY, JSON.stringify(p))
    kvSet(PROJECT_HUB_PREFS_KEY, p)
  } catch { /* ignore */ }
}

function fmtHM(sec?: number): string | null {
  if (sec == null || sec <= 0) return null
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** 워크스페이스 기간 한 줄 (목록 카드용) */
export function formatProjectPeriodLine(ws: ProjectWorkspaceDetail): string | null {
  const a = ws.periodStart?.trim()
  const b = ws.periodEnd?.trim()
  if (!a && !b) return null
  if (a && b) return `${a} ~ ${b}`
  if (a) return `${a} ~`
  return `~ ${b}`
}

/** 마감일 기준 D-day 라벨 (한국어) */
export function projectDeadlineLabel(endYmd?: string): string | null {
  if (!endYmd?.trim()) return null
  const d = new Date(endYmd.trim() + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return `마감 ${Math.abs(diff)}일 지남`
  if (diff === 0) return '오늘 마감'
  return `D-${diff}`
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: '기획',
  active: '진행',
  paused: '보류',
  done: '완료',
  archive: '보관',
}

/** Area / Project 패널 공통 톤 — 대시보드·Manifestation 느낌 */
const HUB = {
  pageBg: '#F1F1EF',
  panelBg: '#FFFFFF',
  panelBorder: '1px solid rgba(0,0,0,0.08)',
  panelRadius: 12,
  text: '#37352F',
  muted: '#787774',
  subtle: '#9B9A97',
  accent: '#6366f1',
}

function HubModal({
  open, title, onClose, children, footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  if (typeof document === 'undefined' || !open) return null
  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(15,18,40,0.38)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        style={{
          background: '#fff', borderRadius: 14, maxWidth: 420, width: '100%', padding: '22px 22px 18px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.16)', border: '1px solid rgba(0,0,0,0.07)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 800, color: HUB.text }}>{title}</h2>
        {children}
        {footer}
      </div>
    </div>,
    document.body,
  )
}

/** Manifestation·대시보드 스탯 카드 느낌 — 얇은 테두리, 중앙 정렬 타이포 */
const dashCardBase: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid rgba(0,0,0,0.08)',
  borderRadius: 10,
  boxSizing: 'border-box',
}

function ProjectMiniCard({
  p, parentArea, questCountFor, to, isDragging,
}: {
  p: ProjectRow
  parentArea: AreaRow | null | undefined
  questCountFor: (id: string) => number
  to: string
  isDragging?: boolean
}) {
  const ws = loadWorkspace(p.id)
  const st = ws.statusTag ?? 'active'
  const qc = questCountFor(p.id)
  const timeLabel = fmtHM(p.time_spent_sec)
  const periodLine = formatProjectPeriodLine(ws)
  const dday = projectDeadlineLabel(ws.periodEnd)
  return (
    <Link
      to={to}
      style={{
        ...dashCardBase,
        minHeight: 128,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 14px 20px',
        position: 'relative',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: isDragging ? '0 8px 22px rgba(0,0,0,0.08)' : 'none',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.28)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)' }}
    >
      <span style={{ fontSize: 10, fontWeight: 600, color: HUB.subtle, marginBottom: 6 }}>{STATUS_LABEL[st]}</span>
      <p style={{
        margin: 0, fontSize: 16, fontWeight: 800, color: HUB.text, textAlign: 'center', lineHeight: 1.35,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'keep-all' as const,
      }}>{p.name}</p>
      {parentArea && (
        <span style={{ fontSize: 12, fontWeight: 600, color: '#6366f1', marginTop: 10 }}>{parentArea.name}</span>
      )}
      <span style={{ fontSize: 11, color: HUB.muted, marginTop: 8 }}>
        퀘스트 {qc}{timeLabel ? ` · ${timeLabel}` : ''}
      </span>
      {(periodLine || dday) && (
        <span style={{ fontSize: 10, color: dday?.includes('지남') ? '#dc2626' : (dday === '오늘 마감' ? '#d97706' : '#6366f1'), marginTop: 6, fontWeight: 600, textAlign: 'center', lineHeight: 1.35 }}>
          {periodLine && <span style={{ display: 'block' }}>{periodLine}</span>}
          {dday && <span style={{ display: 'block', marginTop: 2 }}>{dday}</span>}
        </span>
      )}
    </Link>
  )
}

const inputBase: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#F4F4F2',
  border: '1px solid rgba(0,0,0,0.06)',
  borderRadius: '12px',
  padding: '12px 14px',
  color: '#37352F',
  fontSize: '12px',
  outline: 'none',
  resize: 'none' as const,
  boxSizing: 'border-box',
  lineHeight: 1.65,
  fontFamily: 'inherit',
}

type NoteTarget = {
  table: 'areas' | 'projects' | 'quests' | 'journals' | 'calendar_journal'
  id: string
  title: string
  meta?: Record<string, unknown>
}

export type ProjectHubPageProps = {
  areas: AreaRow[]
  projects: ProjectRow[]
  userQuests: QuestMini[]
  isMobile: boolean
  newAreaName: string
  setNewAreaName: (v: string) => void
  addArea: () => void | Promise<void>
  editingAreaId: string | null
  setEditingAreaId: (v: string | null) => void
  editingAreaName: string
  setEditingAreaName: (v: string) => void
  commitEditArea: (id: string) => void | Promise<void>
  removeArea: (id: string) => void | Promise<void>
  moveAreaUp: (id: string) => void
  moveAreaDown: (id: string) => void
  newProjectName: string
  setNewProjectName: (v: string) => void
  newProjectAreaId: string
  setNewProjectAreaId: (v: string) => void
  addProject: () => void | Promise<void>
  editingProjectId: string | null
  setEditingProjectId: (v: string | null) => void
  editingProjectName: string
  setEditingProjectName: (v: string) => void
  commitEditProject: (id: string) => void | Promise<void>
  removeProject: (id: string) => void | Promise<void>
  renameProject: (id: string, name: string) => void | Promise<void>
  moveProjectUp: (id: string) => void
  moveProjectDown: (id: string) => void
  setNoteTarget: (t: NoteTarget) => void
  onToast: (msg: string) => void
  addAreaByName: (name: string) => void | Promise<void>
  addProjectByName: (name: string, areaId: string) => void | Promise<void> | Promise<ProjectRow | null>
  identities: IdentityRow[]
  completedQuestIds: string[]
}

export function ProjectHubPage(props: ProjectHubPageProps) {
  const {
    areas, projects, userQuests, isMobile,
    newAreaName, setNewAreaName, addArea,
    editingAreaId, setEditingAreaId, editingAreaName, setEditingAreaName, commitEditArea,
    removeArea, moveAreaUp, moveAreaDown,
    newProjectName, setNewProjectName, newProjectAreaId, setNewProjectAreaId, addProject,
    editingProjectId, setEditingProjectId, editingProjectName, setEditingProjectName, commitEditProject,
    removeProject, renameProject, moveProjectUp, moveProjectDown,
    setNoteTarget, onToast, addAreaByName, addProjectByName,
    identities, completedQuestIds,
  } = props

  const [archiveKind, setArchiveKind] = useState<WorkspaceArchiveKind | null>(null)
  const [areaModalOpen, setAreaModalOpen] = useState(false)
  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [modalAreaName, setModalAreaName] = useState('')
  const [modalProjectName, setModalProjectName] = useState('')
  const [modalProjectAreaId, setModalProjectAreaId] = useState('')
  const [modalPeriodStart, setModalPeriodStart] = useState('')
  const [modalPeriodEnd, setModalPeriodEnd] = useState('')
  const [areaMenuOpenId, setAreaMenuOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (!areaMenuOpenId) return
    const close = () => setAreaMenuOpenId(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [areaMenuOpenId])

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const selectedProjectId = searchParams.get('project')
  const currentProject = projects.find(p => p.id === selectedProjectId)

  const [prefs, setPrefs] = useState<HubPrefs>(() => loadPrefs())
  useEffect(() => { savePrefs(prefs) }, [prefs])

  // 프로젝트 목록 바뀌면 manual order 동기화
  useEffect(() => {
    const ids = projects.map(p => p.id)
    setPrefs(prev => {
      const nextOrder = prev.manualOrderIds.filter(id => ids.includes(id))
      ids.forEach(id => { if (!nextOrder.includes(id)) nextOrder.push(id) })
      if (nextOrder.length === prev.manualOrderIds.length && nextOrder.every((id, i) => id === prev.manualOrderIds[i])) return prev
      return { ...prev, manualOrderIds: nextOrder }
    })
  }, [projects])

  const [detail, setDetail] = useState<ProjectWorkspaceDetail>(() =>
    selectedProjectId ? loadWorkspace(selectedProjectId) : defaultWorkspace(),
  )
  useEffect(() => {
    if (selectedProjectId && currentProject) {
      setDetail(loadWorkspace(selectedProjectId))
    }
  }, [selectedProjectId, currentProject?.id])

  const persist = useCallback((next: ProjectWorkspaceDetail) => {
    if (!selectedProjectId) return
    setDetail(next)
    saveProjectWorkspace(selectedProjectId, next)
  }, [selectedProjectId])

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const questCountFor = useCallback((pid: string) =>
    userQuests.filter(q => String(q.projectId) === String(pid)).length, [userQuests])

  const sortedProjects = useMemo(() => {
    let list = [...projects]
    if (prefs.filterAreaId) list = list.filter(p => String(p.area_id) === String(prefs.filterAreaId))
    if (prefs.filterStatus !== 'all') {
      list = list.filter(p => {
        const st = loadWorkspace(p.id).statusTag ?? 'active'
        return st === prefs.filterStatus
      })
    }
    const mult = prefs.sortDirection === 'desc' ? 1 : -1
    if (prefs.sortOrder === 'manual') {
      const orderMap = new Map(prefs.manualOrderIds.map((id, i) => [id, i]))
      list.sort((a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999))
      return list
    }
    if (prefs.sortOrder === 'name') {
      list.sort((a, b) => mult * a.name.localeCompare(b.name, 'ko'))
      return list
    }
    if (prefs.sortOrder === 'time') {
      list.sort((a, b) => mult * ((b.time_spent_sec ?? 0) - (a.time_spent_sec ?? 0)))
      return list
    }
    if (prefs.sortOrder === 'status') {
      const rank: Record<ProjectStatus, number> = { planning: 0, active: 1, paused: 2, done: 3, archive: 4 }
      list.sort((a, b) => {
        const sa = loadWorkspace(a.id).statusTag ?? 'active'
        const sb = loadWorkspace(b.id).statusTag ?? 'active'
        return mult * (rank[sa] - rank[sb]) || a.name.localeCompare(b.name, 'ko')
      })
      return list
    }
    if (prefs.sortOrder === 'deadline') {
      list.sort((a, b) => {
        const endA = loadWorkspace(a.id).periodEnd?.trim() ?? ''
        const endB = loadWorkspace(b.id).periodEnd?.trim() ?? ''
        if (!endA && !endB) return a.name.localeCompare(b.name, 'ko')
        if (!endA) return 1
        if (!endB) return -1
        const cmp = endA.localeCompare(endB)
        return prefs.sortDirection === 'asc' ? cmp : -cmp
      })
      return list
    }
    return list
  }, [projects, prefs])

  function handleDragEnd(e: DragEndEvent) {
    if (prefs.sortOrder !== 'manual') return
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = prefs.manualOrderIds.indexOf(active.id as string)
    const newIdx = prefs.manualOrderIds.indexOf(over.id as string)
    if (oldIdx === -1 || newIdx === -1) return
    const next = arrayMove(prefs.manualOrderIds, oldIdx, newIdx)
    setPrefs(p => ({ ...p, manualOrderIds: next }))
  }

  const [tagDraft, setTagDraft] = useState('')

  // ── 상세 뷰 ──
  if (selectedProjectId && currentProject) {
    const area = currentProject.area_id ? areas.find(a => String(a.id) === String(currentProject.area_id)) : null
    const relatedQuests = userQuests.filter(q => String(q.projectId) === String(currentProject.id))
    const st = detail.statusTag ?? 'active'
    const deadlineHint = projectDeadlineLabel(detail.periodEnd)

    return (
      <div style={{ maxWidth: 1600, margin: '0 auto', padding: isMobile ? '14px 12px' : '36px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => navigate('/project', { replace: true })}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px',
              borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', background: 'transparent', color: '#6366f1',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 16 }}>←</span>
            목록으로
          </button>
          <WorkspaceArchiveTrigger title="프로젝트 데이터 보관함 — 전체 목록" onClick={() => setArchiveKind('project')} />
        </div>

        {/* Hero — Travel 스타일 다크 헤더 */}
        <div
          style={{
            position: 'relative', borderRadius: 16, overflow: 'hidden',
            background: 'linear-gradient(135deg, #0f1229 0%, #141736 55%, #1a1e3d 100%)',
            border: '1px solid rgba(255,255,255,0.08)', padding: isMobile ? '24px 22px' : '36px 40px', marginBottom: 28,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr auto', gap: 24, alignItems: 'end' }}>
            <button
              type="button"
              onClick={() => {
                const v = window.prompt('대표 아이콘 (이모지)', detail.heroIcon ?? '📁')
                if (v !== null) persist({ ...detail, heroIcon: v.trim() || '📁' })
              }}
              style={{ fontSize: 40, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {detail.heroIcon?.startsWith('http') ? <img src={detail.heroIcon} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} /> : (detail.heroIcon ?? '📁')}
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {area && (
                  <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.85)', padding: '4px 10px', borderRadius: 999, background: 'rgba(99,102,241,0.35)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    🌐 {area.name}
                  </span>
                )}
                <select
                  value={st}
                  onChange={e => persist({ ...detail, statusTag: e.target.value as ProjectStatus })}
                  style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 12, fontWeight: 700 }}
                >
                  {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map(k => (
                    <option key={k} value={k}>{STATUS_LABEL[k]}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setNoteTarget({ table: 'projects', id: currentProject.id, title: currentProject.name, meta: { timeSpentSec: currentProject.time_spent_sec, areaName: area?.name } })}
                  style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                >
                  📝 시스템 노트
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const v = window.prompt('프로젝트 이름', currentProject.name)
                    if (v != null && v.trim()) void renameProject(currentProject.id, v.trim())
                  }}
                  style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                >
                  ✏️ 이름
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm(`「${currentProject.name}」프로젝트를 삭제할까요? (연결 퀘스트의 project는 비워집니다)`)) return
                    void removeProject(currentProject.id)
                    navigate('/project', { replace: true })
                  }}
                  style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.45)', background: 'rgba(239,68,68,0.15)', color: '#fecaca', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                >
                  삭제
                </button>
              </div>
              <h1 style={{ margin: 0, fontSize: isMobile ? 26 : 34, fontWeight: 900, color: '#fff', lineHeight: 1.15 }}>
                {currentProject.name}
              </h1>
              <p style={{ margin: '10px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
                퀘스트는 실행 단위이고, 여기는 기획·자료·장기 체크를 쌓는 워크스페이스입니다.
              </p>
              <div
                style={{
                  marginTop: 14,
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                <CalendarRange size={16} color="rgba(255,255,255,0.75)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.9)' }}>기간 · 마감</span>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>시작</label>
                <input
                  type="date"
                  value={detail.periodStart ?? ''}
                  onChange={e => persist({ ...detail, periodStart: e.target.value || undefined })}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(0,0,0,0.25)',
                    color: '#fff',
                    fontSize: 12,
                  }}
                />
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>마감</label>
                <input
                  type="date"
                  value={detail.periodEnd ?? ''}
                  onChange={e => persist({ ...detail, periodEnd: e.target.value || undefined })}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(0,0,0,0.25)',
                    color: '#fff',
                    fontSize: 12,
                  }}
                />
                {deadlineHint && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: deadlineHint.includes('지남') ? '#fecaca' : '#fde68a' }}>
                    {deadlineHint}
                  </span>
                )}
              </div>
            </div>
            <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#fff' }}>{new Date().getFullYear()}</p>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>⏱ {fmtHM(currentProject.time_spent_sec) ?? '—'}</p>
            </div>
          </div>
          <textarea
            value={detail.heroMemo ?? ''}
            onChange={e => persist({ ...detail, heroMemo: e.target.value })}
            placeholder="한눈에 보는 프로젝트 요약 · 이번 주 한 줄"
            rows={3}
            style={{
              marginTop: 22, width: '100%', minHeight: 72, padding: '12px 16px', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.92)',
              fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <section style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Target size={18} color="#6366f1" />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#37352F' }}>미션 · 왜 이 프로젝트인가</span>
            </div>
            <textarea value={detail.mission ?? ''} onChange={e => persist({ ...detail, mission: e.target.value })} placeholder="배경, 동기, 성공 기준을 길게 적어도 됩니다." rows={5} style={inputBase} />
          </section>
          <section style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Flag size={18} color="#8b5cf6" />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#37352F' }}>노스스타 · 한 줄 방향</span>
            </div>
            <textarea value={detail.northStar ?? ''} onChange={e => persist({ ...detail, northStar: e.target.value })} placeholder="예: 웹툰 1화 완성까지 파이프라인 고정" rows={5} style={inputBase} />
          </section>
        </div>

        <section style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '18px 20px', marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <BookOpen size={18} color="#6366f1" />
            <span style={{ fontSize: 14, fontWeight: 800, color: '#37352F' }}>깊은 노트 · 레퍼런스·스크립트·의사결정 로그</span>
          </div>
          <textarea
            value={detail.deepNotes ?? ''}
            onChange={e => persist({ ...detail, deepNotes: e.target.value })}
            placeholder="장기 작업이라 메모가 길어져도 괜찮습니다. 회의록, 링크 모음, 감정 로그 등 자유롭게."
            rows={14}
            style={{ ...inputBase, minHeight: 280, fontSize: 13 }}
          />
        </section>

        <section style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '18px 20px', marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#6366f1', letterSpacing: '0.08em' }}>이번 주 집중</span>
          <textarea value={detail.weeklyFocus ?? ''} onChange={e => persist({ ...detail, weeklyFocus: e.target.value })} placeholder="이번 주에만 할 최소 목표" rows={3} style={{ ...inputBase, marginTop: 10 }} />
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <section style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ListChecks size={18} color="#6366f1" />
                <span style={{ fontSize: 14, fontWeight: 800 }}>체크리스트</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const id = `chk_${Date.now()}`
                  persist({ ...detail, checklist: [...(detail.checklist ?? []), { id, label: '새 항목', checked: false }] })
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.28)', background: 'rgba(99,102,241,0.08)', color: '#4F46E5', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                <Plus size={12} />추가
              </button>
            </div>
            {(detail.checklist ?? []).map((item, idx) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: idx < (detail.checklist ?? []).length - 1 ? '1px solid rgba(0,0,0,0.05)' : undefined }}>
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => {
                    const checklist = (detail.checklist ?? []).map(c => c.id === item.id ? { ...c, checked: !c.checked } : c)
                    persist({ ...detail, checklist })
                  }}
                  style={{ width: 18, height: 18 }}
                />
                <input
                  value={item.label}
                  onChange={e => {
                    const checklist = (detail.checklist ?? []).map(c => c.id === item.id ? { ...c, label: e.target.value } : c)
                    persist({ ...detail, checklist })
                  }}
                  style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 13, outline: 'none' }}
                />
                <button type="button" onClick={() => persist({ ...detail, checklist: (detail.checklist ?? []).filter(c => c.id !== item.id) })} style={{ border: 'none', background: 'rgba(239,68,68,0.1)', borderRadius: 6, padding: 4, cursor: 'pointer' }}>
                  <Trash2 size={12} color="#ef4444" />
                </button>
              </div>
            ))}
            {(detail.checklist ?? []).length === 0 && <p style={{ margin: 0, fontSize: 12, color: '#9B9A97' }}>필요한 준비물·검수 항목을 적어 두세요.</p>}
          </section>

          <section style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={18} color="#6366f1" />
                <span style={{ fontSize: 14, fontWeight: 800 }}>마일스톤</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const id = `ms_${Date.now()}`
                  persist({ ...detail, milestones: [...(detail.milestones ?? []), { id, title: '새 마일스톤', targetDate: '', note: '', done: false }] })
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.28)', background: 'rgba(99,102,241,0.08)', color: '#4F46E5', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                <Plus size={12} />추가
              </button>
            </div>
            {(detail.milestones ?? []).map((m, idx) => (
              <div key={m.id} style={{ padding: '10px 0', borderBottom: idx < (detail.milestones ?? []).length - 1 ? '1px solid rgba(0,0,0,0.05)' : undefined }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="checkbox" checked={!!m.done} onChange={() => {
                    const milestones = (detail.milestones ?? []).map(x => x.id === m.id ? { ...x, done: !x.done } : x)
                    persist({ ...detail, milestones })
                  }} />
                  <input value={m.title} onChange={e => {
                    const milestones = (detail.milestones ?? []).map(x => x.id === m.id ? { ...x, title: e.target.value } : x)
                    persist({ ...detail, milestones })
                  }} style={{ flex: 1, minWidth: 120, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} />
                  <input type="date" value={m.targetDate ?? ''} onChange={e => {
                    const milestones = (detail.milestones ?? []).map(x => x.id === m.id ? { ...x, targetDate: e.target.value } : x)
                    persist({ ...detail, milestones })
                  }} style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, padding: '6px 8px', fontSize: 11 }} />
                  <button type="button" onClick={() => persist({ ...detail, milestones: (detail.milestones ?? []).filter(x => x.id !== m.id) })} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><Trash2 size={12} color="#ef4444" /></button>
                </div>
                <textarea value={m.note ?? ''} onChange={e => {
                  const milestones = (detail.milestones ?? []).map(x => x.id === m.id ? { ...x, note: e.target.value } : x)
                  persist({ ...detail, milestones })
                }} placeholder="메모" rows={2} style={{ ...inputBase, marginTop: 8, fontSize: 11 }} />
              </div>
            ))}
          </section>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 28 }}>
          <section style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>자료 · 링크</span>
              <button
                type="button"
                onClick={() => {
                  const id = `res_${Date.now()}`
                  persist({ ...detail, resources: [...(detail.resources ?? []), { id, title: '제목', url: '', note: '' }] })
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.28)', background: 'rgba(99,102,241,0.08)', color: '#4F46E5', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                <Plus size={12} />추가
              </button>
            </div>
            {(detail.resources ?? []).map(r => (
              <div key={r.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input value={r.title} onChange={e => {
                    const resources = (detail.resources ?? []).map(x => x.id === r.id ? { ...x, title: e.target.value } : x)
                    persist({ ...detail, resources })
                  }} style={{ flex: 1, ...inputBase, padding: '8px 10px' }} />
                  {r.url && (
                    <a href={r.url.startsWith('http') ? r.url : `https://${r.url}`} target="_blank" rel="noreferrer" style={{ color: '#6366f1' }}>
                      <ExternalLink size={16} />
                    </a>
                  )}
                  <button type="button" onClick={() => persist({ ...detail, resources: (detail.resources ?? []).filter(x => x.id !== r.id) })} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><Trash2 size={12} color="#ef4444" /></button>
                </div>
                <input
                  value={r.url ?? ''}
                  onChange={e => {
                    const resources = (detail.resources ?? []).map(x => x.id === r.id ? { ...x, url: e.target.value } : x)
                    persist({ ...detail, resources })
                  }}
                  placeholder="https://..."
                  style={{ ...inputBase, marginTop: 6, padding: '8px 10px' }}
                />
                <textarea value={r.note ?? ''} onChange={e => {
                  const resources = (detail.resources ?? []).map(x => x.id === r.id ? { ...x, note: e.target.value } : x)
                  persist({ ...detail, resources })
                }} placeholder="메모" rows={2} style={{ ...inputBase, marginTop: 6, fontSize: 11 }} />
              </div>
            ))}
          </section>

          <section style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} color="#f59e0b" />
                <span style={{ fontSize: 14, fontWeight: 800 }}>리스크 · 막힌 점</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const id = `rk_${Date.now()}`
                  persist({ ...detail, risks: [...(detail.risks ?? []), { id, text: '' }] })
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.08)', color: '#b45309', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                <Plus size={12} />추가
              </button>
            </div>
            {(detail.risks ?? []).map(rk => (
              <div key={rk.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  value={rk.text}
                  onChange={e => {
                    const risks = (detail.risks ?? []).map(x => x.id === rk.id ? { ...x, text: e.target.value } : x)
                    persist({ ...detail, risks })
                  }}
                  style={{ flex: 1, ...inputBase, padding: '8px 10px' }}
                />
                <button type="button" onClick={() => persist({ ...detail, risks: (detail.risks ?? []).filter(x => x.id !== rk.id) })} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><Trash2 size={12} color="#ef4444" /></button>
              </div>
            ))}
          </section>
        </div>

        <section style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', padding: '18px 20px', marginBottom: 40, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>🏷 커스텀 태그</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={tagDraft} onChange={e => setTagDraft(e.target.value)} placeholder="태그 입력 후 추가" style={{ ...inputBase, width: 180, padding: '8px 10px' }} onKeyDown={e => {
                if (e.key === 'Enter' && tagDraft.trim()) {
                  const t = tagDraft.trim()
                  if ((detail.customTags ?? []).includes(t)) { onToast('이미 있는 태그입니다'); return }
                  persist({ ...detail, customTags: [...(detail.customTags ?? []), t] })
                  setTagDraft('')
                }
              }} />
              <button
                type="button"
                onClick={() => {
                  if (!tagDraft.trim()) return
                  const t = tagDraft.trim()
                  if ((detail.customTags ?? []).includes(t)) { onToast('이미 있는 태그입니다'); return }
                  persist({ ...detail, customTags: [...(detail.customTags ?? []), t] })
                  setTagDraft('')
                }}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                추가
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(detail.customTags ?? []).map(t => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', fontSize: 12, fontWeight: 600, color: '#4F46E5' }}>
                {t}
                <button type="button" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }} onClick={() => persist({ ...detail, customTags: (detail.customTags ?? []).filter(x => x !== t) })}>×</button>
              </span>
            ))}
          </div>
        </section>

        <section style={{ background: 'rgba(99,102,241,0.06)', borderRadius: 14, border: '1px solid rgba(99,102,241,0.18)', padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#37352F' }}>연결된 퀘스트 (읽기 전용)</span>
            <span style={{ fontSize: 12, color: '#6366f1', fontWeight: 700 }}>{relatedQuests.length}개</span>
          </div>
          {relatedQuests.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: '#787774' }}>이 프로젝트에 묶인 퀘스트가 없습니다. Quest 탭에서 퀘스트를 추가할 때 Real Projects를 선택하세요.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, color: '#37352F', fontSize: 13, lineHeight: 1.8 }}>
              {relatedQuests.map(q => (
                <li key={q.id}>{q.name}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
    )
  }

  // 잘못된 project id
  if (selectedProjectId && !currentProject) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 48, textAlign: 'center' }}>
        <p style={{ fontSize: 16, fontWeight: 700 }}>프로젝트를 찾을 수 없습니다.</p>
        <button type="button" onClick={() => navigate('/project')} style={{ marginTop: 16, padding: '10px 20px', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>목록으로</button>
      </div>
    )
  }

  // ── 목록 뷰 ──
  function SortableProjectCard({ p, parentArea }: { p: ProjectRow; parentArea: AreaRow | null | undefined }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id })
    return (
      <div
        ref={setNodeRef}
        style={{
          position: 'relative',
          transform: CSS.Transform.toString(transform),
          transition,
          zIndex: isDragging ? 3 : 1,
        }}
      >
        <div
          className="project-hub-drag-handle"
          style={{ position: 'absolute', bottom: 6, right: 6, zIndex: 4, cursor: 'grab', touchAction: 'none', opacity: 0.45 }}
          {...attributes}
          {...listeners}
          onClick={e => e.preventDefault()}
        >
          <GripVertical size={14} color="#9B9A97" />
        </div>
        <ProjectMiniCard
          p={p}
          parentArea={parentArea}
          questCountFor={questCountFor}
          to={`/project?project=${p.id}`}
          isDragging={isDragging}
        />
      </div>
    )
  }

  const btnGhost: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: HUB.accent,
    border: '1px solid rgba(99,102,241,0.28)',
    background: '#fff',
    borderRadius: 8,
    padding: '5px 11px',
    cursor: 'pointer',
  }

  return (
    <>
      <div style={{ background: HUB.pageBg, minHeight: '100vh' }}>
        <div style={{ maxWidth: 1600, margin: '0 auto', padding: isMobile ? '14px 12px 32px' : '28px 44px 48px' }}>
          <div style={{ marginBottom: 22, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: 10, fontWeight: 800, color: HUB.subtle, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Workspace</span>
              <h1 style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 800, color: HUB.text }}>Real Projects</h1>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: HUB.muted }}>비전 축(Vision)과 장기 프로젝트를 같은 톤으로 정리했습니다</p>
            </div>
            <WorkspaceArchiveTrigger title="퀘스트 데이터 보관함 — 전체 목록" onClick={() => setArchiveKind('quest')} />
          </div>

          {/* Vision Area — Area와 동일 패널 스타일 */}
          <div style={{ background: HUB.panelBg, border: HUB.panelBorder, borderRadius: HUB.panelRadius, padding: '14px 16px 16px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: HUB.text }}>Vision Area</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <WorkspaceArchiveTrigger title="Vision Area 데이터 보관함 — 전체 목록" onClick={() => setArchiveKind('area')} />
                <span style={{ fontSize: 11, color: HUB.subtle }}>{areas.length}개</span>
                <button
                  type="button"
                  onClick={() => { setModalAreaName(''); setAreaModalOpen(true) }}
                  style={btnGhost}
                >
                  + New
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch' }}>
              {areas.map(a => {
                const active = prefs.filterAreaId === a.id
                return (
                  <div
                    key={a.id}
                    style={{
                      flex: '0 0 auto',
                      width: 148,
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        ...dashCardBase,
                        padding: '14px 12px 12px',
                        textAlign: 'center',
                        position: 'relative',
                        border: active ? '1px solid rgba(99,102,241,0.45)' : dashCardBase.border,
                        boxShadow: active ? '0 0 0 1px rgba(99,102,241,0.12)' : 'none',
                      }}
                    >
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setAreaMenuOpenId(id => id === a.id ? null : a.id) }}
                        style={{ position: 'absolute', top: 6, right: 6, border: 'none', background: 'transparent', padding: 2, cursor: 'pointer', opacity: 0.55 }}
                        aria-label="메뉴"
                      >
                        <MoreHorizontal size={16} color="#787774" />
                      </button>
                      {editingAreaId === a.id ? (
                        <input
                          autoFocus
                          value={editingAreaName}
                          onChange={e => setEditingAreaName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') void commitEditArea(a.id); if (e.key === 'Escape') setEditingAreaId(null) }}
                          onBlur={() => void commitEditArea(a.id)}
                          style={{ width: '100%', border: '1px solid #6366f1', borderRadius: 8, padding: '6px 8px', fontSize: 13 }}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPrefs(p => ({ ...p, filterAreaId: p.filterAreaId === a.id ? '' : a.id }))}
                          style={{ border: 'none', background: 'none', padding: '4px 4px 0', cursor: 'pointer', width: '100%' }}
                        >
                          <div style={{ fontSize: 10, fontWeight: 600, color: HUB.subtle, marginBottom: 6 }}>Vision</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: HUB.text, lineHeight: 1.3, wordBreak: 'keep-all' as const }}>{a.name}</div>
                          <div style={{ fontSize: 11, color: HUB.muted, marginTop: 8 }}>
                            {fmtHM(a.time_spent_sec) ? `⏱ ${fmtHM(a.time_spent_sec)}` : '시간 기록 없음'}
                          </div>
                        </button>
                      )}
                      {areaMenuOpenId === a.id && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 32,
                            right: 0,
                            zIndex: 20,
                            background: '#fff',
                            border: '1px solid rgba(0,0,0,0.1)',
                            borderRadius: 8,
                            padding: 6,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                            minWidth: 120,
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          <button type="button" onClick={() => { setNoteTarget({ table: 'areas', id: a.id, title: a.name, meta: { timeSpentSec: a.time_spent_sec } }); setAreaMenuOpenId(null) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', border: 'none', background: 'none', fontSize: 12, cursor: 'pointer' }}>노트</button>
                          <button type="button" onClick={() => { setEditingAreaId(a.id); setEditingAreaName(a.name); setAreaMenuOpenId(null) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', border: 'none', background: 'none', fontSize: 12, cursor: 'pointer' }}>이름 수정</button>
                          <div style={{ display: 'flex', gap: 4, padding: '4px 0 0' }}>
                            <button type="button" onClick={() => { moveAreaUp(a.id); setAreaMenuOpenId(null) }} disabled={areas.indexOf(a) === 0} style={{ flex: 1, padding: 4, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, background: '#fafafa', cursor: areas.indexOf(a) === 0 ? 'default' : 'pointer', opacity: areas.indexOf(a) === 0 ? 0.4 : 1 }}><ChevronUp size={14} /></button>
                            <button type="button" onClick={() => { moveAreaDown(a.id); setAreaMenuOpenId(null) }} disabled={areas.indexOf(a) === areas.length - 1} style={{ flex: 1, padding: 4, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, background: '#fafafa', cursor: areas.indexOf(a) === areas.length - 1 ? 'default' : 'pointer', opacity: areas.indexOf(a) === areas.length - 1 ? 0.4 : 1 }}><ChevronDown size={14} /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {areas.length === 0 && (
                <span style={{ fontSize: 12, color: HUB.subtle, padding: '12px 0' }}>Vision Area가 없습니다. + New로 추가하세요.</span>
              )}
            </div>
          </div>

          {/* Real Projects — 같은 패널 안에 필터 + 그리드 */}
          <div style={{ background: HUB.panelBg, border: HUB.panelBorder, borderRadius: HUB.panelRadius, padding: '14px 16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: HUB.text }}>Real Projects</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <WorkspaceArchiveTrigger title="프로젝트 데이터 보관함 — 전체 목록" onClick={() => setArchiveKind('project')} />
              <button
                type="button"
                onClick={() => {
                  setModalProjectName('')
                  setModalProjectAreaId(areas[0]?.id ?? '')
                  setModalPeriodStart('')
                  setModalPeriodEnd('')
                  setProjectModalOpen(true)
                }}
                style={btnGhost}
              >
                + New
              </button>
              </div>
            </div>

            {projects.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 14, padding: '10px 12px', background: '#FAFAF9', borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: HUB.muted }}>정렬</span>
                <select
                  value={prefs.sortOrder}
                  onChange={e => setPrefs(p => ({ ...p, sortOrder: e.target.value as HubPrefs['sortOrder'] }))}
                  style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', fontSize: 11 }}
                >
                  <option value="manual">수동</option>
                  <option value="name">이름</option>
                  <option value="time">시간</option>
                  <option value="status">상태</option>
                  <option value="deadline">마감일</option>
                </select>
                {prefs.sortOrder !== 'manual' && (
                  <button
                    type="button"
                    title={prefs.sortOrder === 'deadline' ? (prefs.sortDirection === 'asc' ? '마감 빠른 순' : '마감 늦은 순') : undefined}
                    onClick={() => setPrefs(p => ({ ...p, sortDirection: p.sortDirection === 'desc' ? 'asc' : 'desc' }))}
                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', fontSize: 11, cursor: 'pointer' }}
                  >
                    {prefs.sortDirection === 'desc' ? '↓' : '↑'}
                  </button>
                )}
                <span style={{ fontSize: 11, fontWeight: 700, color: HUB.muted }}>Area</span>
                <select
                  value={prefs.filterAreaId}
                  onChange={e => setPrefs(p => ({ ...p, filterAreaId: e.target.value }))}
                  style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', fontSize: 11, maxWidth: 140 }}
                >
                  <option value="">전체</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <span style={{ fontSize: 11, fontWeight: 700, color: HUB.muted }}>상태</span>
                <select
                  value={prefs.filterStatus}
                  onChange={e => setPrefs(p => ({ ...p, filterStatus: e.target.value as HubPrefs['filterStatus'] }))}
                  style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', fontSize: 11 }}
                >
                  <option value="all">전체</option>
                  {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map(k => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: HUB.text }}>
                  <input type="checkbox" checked={prefs.groupByArea} onChange={e => setPrefs(p => ({ ...p, groupByArea: e.target.checked }))} />
                  구역 묶기
                </label>
                {prefs.groupByArea && prefs.sortOrder === 'manual' && (
                  <span style={{ fontSize: 10, color: '#b45309' }}>※ 묶기 시 드래그 비활성</span>
                )}
                <span style={{ fontSize: 11, color: HUB.muted }}>크기</span>
                <input
                  type="range"
                  min={160}
                  max={360}
                  value={prefs.cardMinWidth}
                  onChange={e => setPrefs(p => ({ ...p, cardMinWidth: +e.target.value }))}
                  style={{ width: 80 }}
                />
                <span style={{ fontSize: 10, color: HUB.subtle }}>{prefs.cardMinWidth}px</span>
                {(prefs.filterAreaId || prefs.filterStatus !== 'all') && (
                  <button type="button" onClick={() => setPrefs(p => ({ ...p, filterAreaId: '', filterStatus: 'all' }))} style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, border: 'none', background: 'rgba(0,0,0,0.06)', fontSize: 11, cursor: 'pointer' }}>
                    초기화
                  </button>
                )}
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : `repeat(auto-fill, minmax(${prefs.cardMinWidth}px, 1fr))`,
                gap: 12,
              }}
            >
              {sortedProjects.length === 0 && projects.length > 0 && (
                <div style={{ gridColumn: '1 / -1', padding: 20, textAlign: 'center', background: '#FFFBEB', borderRadius: 10, border: '1px solid rgba(251,191,36,0.35)' }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#92400e', fontWeight: 600 }}>필터에 맞는 프로젝트가 없습니다</p>
                  <button type="button" onClick={() => setPrefs(p => ({ ...p, filterAreaId: '', filterStatus: 'all' }))} style={{ marginTop: 10, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>필터 초기화</button>
                </div>
              )}

              {prefs.groupByArea ? (
                areas.map(area => {
                  const group = sortedProjects.filter(p => String(p.area_id) === String(area.id))
                  if (!group.length) return null
                  return (
                    <div key={area.id} style={{ gridColumn: '1 / -1' }}>
                      <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 800, color: HUB.muted, letterSpacing: '0.06em' }}>{area.name}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(auto-fill, minmax(${prefs.cardMinWidth}px, 1fr))`, gap: 12 }}>
                        {group.map(p => (
                          <ProjectCardStatic key={p.id} p={p} parentArea={area} questCountFor={questCountFor} />
                        ))}
                      </div>
                    </div>
                  )
                })
              ) : (
                prefs.sortOrder === 'manual' ? (
                  <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={sortedProjects.map(p => p.id)} strategy={rectSortingStrategy}>
                      {sortedProjects.map(p => (
                        <SortableProjectCard key={p.id} p={p} parentArea={areas.find(a => String(a.id) === String(p.area_id))} />
                      ))}
                    </SortableContext>
                  </DndContext>
                ) : (
                  sortedProjects.map(p => (
                    <ProjectCardStatic key={p.id} p={p} parentArea={areas.find(a => String(a.id) === String(p.area_id))} questCountFor={questCountFor} />
                  ))
                )
              )}
            </div>
          </div>
        </div>
      </div>

      <HubModal open={areaModalOpen} title="Vision Area 추가" onClose={() => setAreaModalOpen(false)}>
        <label style={{ fontSize: 11, fontWeight: 700, color: HUB.muted, display: 'block', marginBottom: 6 }}>이름</label>
        <input
          autoFocus
          value={modalAreaName}
          onChange={e => setModalAreaName(e.target.value)}
          placeholder="예: 웹툰, 소설"
          style={{ ...inputBase, marginBottom: 16 }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void (async () => { await addAreaByName(modalAreaName); setAreaModalOpen(false); setModalAreaName('') })() } }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => setAreaModalOpen(false)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', fontSize: 13, cursor: 'pointer' }}>취소</button>
          <button
            type="button"
            onClick={async () => {
              await addAreaByName(modalAreaName)
              setAreaModalOpen(false)
              setModalAreaName('')
            }}
            disabled={!modalAreaName.trim()}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: modalAreaName.trim() ? HUB.accent : '#e5e5e5', color: '#fff', fontSize: 13, fontWeight: 700, cursor: modalAreaName.trim() ? 'pointer' : 'default' }}
          >
            추가
          </button>
        </div>
      </HubModal>

      <HubModal open={projectModalOpen} title="Real Project 추가" onClose={() => setProjectModalOpen(false)}>
        <label style={{ fontSize: 11, fontWeight: 700, color: HUB.muted, display: 'block', marginBottom: 6 }}>Vision Area</label>
        <select
          value={modalProjectAreaId}
          onChange={e => setModalProjectAreaId(e.target.value)}
          style={{ ...inputBase, marginBottom: 12 }}
        >
          <option value="">{areas.length === 0 ? 'Area를 먼저 추가하세요' : '선택'}</option>
          {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <label style={{ fontSize: 11, fontWeight: 700, color: HUB.muted, display: 'block', marginBottom: 6 }}>프로젝트 이름</label>
        <input
          value={modalProjectName}
          onChange={e => setModalProjectName(e.target.value)}
          placeholder="프로젝트 이름"
          style={{ ...inputBase, marginBottom: 12 }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void (async () => {
                const row = await addProjectByName(modalProjectName, modalProjectAreaId)
                if (row && (modalPeriodStart || modalPeriodEnd)) {
                  const cur = loadWorkspace(row.id)
                  saveProjectWorkspace(row.id, { ...cur, periodStart: modalPeriodStart || undefined, periodEnd: modalPeriodEnd || undefined })
                }
                setProjectModalOpen(false)
                setModalProjectName('')
                setModalPeriodStart('')
                setModalPeriodEnd('')
              })()
            }
          }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: HUB.muted, display: 'block', marginBottom: 6 }}>시작일 (선택)</label>
            <input type="date" value={modalPeriodStart} onChange={e => setModalPeriodStart(e.target.value)} style={{ ...inputBase, padding: '8px 10px' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: HUB.muted, display: 'block', marginBottom: 6 }}>마감일 (선택)</label>
            <input type="date" value={modalPeriodEnd} onChange={e => setModalPeriodEnd(e.target.value)} style={{ ...inputBase, padding: '8px 10px' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => setProjectModalOpen(false)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', fontSize: 13, cursor: 'pointer' }}>취소</button>
          <button
            type="button"
            onClick={async () => {
              const row = await addProjectByName(modalProjectName, modalProjectAreaId)
              if (row && (modalPeriodStart || modalPeriodEnd)) {
                const cur = loadWorkspace(row.id)
                saveProjectWorkspace(row.id, { ...cur, periodStart: modalPeriodStart || undefined, periodEnd: modalPeriodEnd || undefined })
              }
              setProjectModalOpen(false)
              setModalProjectName('')
              setModalPeriodStart('')
              setModalPeriodEnd('')
            }}
            disabled={!modalProjectName.trim() || !modalProjectAreaId}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: (modalProjectName.trim() && modalProjectAreaId) ? HUB.accent : '#e5e5e5', color: '#fff', fontSize: 13, fontWeight: 700, cursor: (modalProjectName.trim() && modalProjectAreaId) ? 'pointer' : 'default' }}
          >
            추가
          </button>
        </div>
      </HubModal>

      {archiveKind != null && (
        <WorkspaceDataArchiveModal
          open
          onClose={() => setArchiveKind(null)}
          kind={archiveKind}
          areas={areas}
          projects={projects}
          quests={userQuests}
          identities={identities}
          completedQuestIds={completedQuestIds}
        />
      )}
    </>
  )
}

function ProjectCardStatic({
  p,
  parentArea,
  questCountFor,
}: {
  p: ProjectRow
  parentArea: AreaRow | null | undefined
  questCountFor: (id: string) => number
}) {
  return <ProjectMiniCard p={p} parentArea={parentArea} questCountFor={questCountFor} to={`/project?project=${p.id}`} />
}
