/**
 * Value 작업 순서도 — Supabase 미연결·삽입 실패 시 로컬 전용 저장 (localStorage)
 */
import type { WorkflowRow } from './supabase'

const LS_KEY = 'creative-os-workflows-local-v1'

/** Supabase user_id와 구분되는 더미 값 */
export const LOCAL_WORKFLOW_USER_ID = '_local'

type Store = { items: WorkflowRow[] }

function ts() {
  return new Date().toISOString()
}

export function loadLocalWorkflows(): WorkflowRow[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const p = JSON.parse(raw) as Store
    if (!Array.isArray(p.items)) return []
    return p.items.filter(w => w && typeof w.id === 'string')
  } catch {
    return []
  }
}

function persist(items: WorkflowRow[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ items }))
  } catch {
    /* quota */
  }
}

export function insertLocalWorkflow(
  title: string,
  description = '',
  nodes: unknown = [],
  edges: unknown = [],
): WorkflowRow {
  const t = ts()
  const row: WorkflowRow = {
    id: crypto.randomUUID(),
    user_id: LOCAL_WORKFLOW_USER_ID,
    title: title.trim() || '제목 없음',
    description: description.trim() || null,
    nodes: nodes ?? [],
    edges: edges ?? [],
    created_at: t,
    updated_at: t,
  }
  persist([row, ...loadLocalWorkflows()])
  return row
}

export function getLocalWorkflow(id: string): WorkflowRow | null {
  return loadLocalWorkflows().find(w => w.id === id) ?? null
}

export function isLocalWorkflowRow(w: WorkflowRow | null | undefined): boolean {
  return w?.user_id === LOCAL_WORKFLOW_USER_ID
}

export function updateLocalWorkflow(
  id: string,
  patch: {
    title?: string
    description?: string | null
    nodes?: unknown
    edges?: unknown
  },
): boolean {
  const list = loadLocalWorkflows()
  const i = list.findIndex(w => w.id === id)
  if (i < 0) return false
  const cur = list[i]
  list[i] = {
    ...cur,
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.nodes !== undefined ? { nodes: patch.nodes } : {}),
    ...(patch.edges !== undefined ? { edges: patch.edges } : {}),
    updated_at: ts(),
  }
  persist(list)
  return true
}

export function deleteLocalWorkflow(id: string): boolean {
  const list = loadLocalWorkflows()
  const next = list.filter(w => w.id !== id)
  if (next.length === list.length) return false
  persist(next)
  return true
}
