/**
 * Value — 작업 순서도 에디터 (React Flow / @xyflow/react)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  ReactFlowProvider,
  useReactFlow,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'
import {
  fetchWorkflowById,
  updateWorkflow,
  deleteWorkflow,
  type WorkflowRow,
} from './supabase'

export const WORKFLOW_NODE_TYPE = 'workflowStep' as const

export type WorkflowNodeData = { label: string }

function WorkflowStepNode({ id, data }: NodeProps<WorkflowNodeData>) {
  const { setNodes } = useReactFlow()
  const label = String(data?.label ?? '')
  return (
    <div className="rounded-xl border-2 border-violet-400 bg-white shadow-md px-3 py-2 min-w-[160px] max-w-[240px]">
      <Handle type="target" position={Position.Top} className="!bg-violet-500 !w-2.5 !h-2.5" />
      <textarea
        className="w-full text-sm font-semibold text-slate-800 min-h-[52px] resize-none bg-transparent outline-none leading-snug"
        value={label}
        onChange={e => {
          const v = e.target.value
          setNodes(nds =>
            nds.map(n => (n.id === id ? { ...n, data: { ...n.data, label: v } } : n)),
          )
        }}
        rows={2}
        placeholder="단계 설명"
      />
      <Handle type="source" position={Position.Bottom} className="!bg-violet-500 !w-2.5 !h-2.5" />
    </div>
  )
}

const nodeTypes = { [WORKFLOW_NODE_TYPE]: WorkflowStepNode }

function sanitizeNodes(nodes: Node[]): unknown[] {
  return nodes.map(n => ({
    id: n.id,
    type: WORKFLOW_NODE_TYPE,
    position: n.position,
    data: { label: String((n.data as WorkflowNodeData)?.label ?? '') },
  }))
}

function sanitizeEdges(edges: Edge[]): unknown[] {
  return edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
  }))
}

function parseNodes(raw: unknown): Node<WorkflowNodeData>[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item, i) => {
    const o = item as Record<string, unknown>
    const pos = o.position as { x?: unknown; y?: unknown } | undefined
    const data = (o.data as Record<string, unknown>) ?? {}
    return {
      id: String(o.id ?? `node-${i}`),
      type: WORKFLOW_NODE_TYPE,
      position: {
        x: Number(pos?.x ?? 80 + i * 40),
        y: Number(pos?.y ?? 60 + i * 40),
      },
      data: { label: String(data.label ?? '단계') },
    }
  })
}

function parseEdges(raw: unknown): Edge[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, i) => {
      const o = item as Record<string, unknown>
      return {
        id: String(o.id ?? `e-${i}`),
        source: String(o.source ?? ''),
        target: String(o.target ?? ''),
        sourceHandle: o.sourceHandle != null ? String(o.sourceHandle) : null,
        targetHandle: o.targetHandle != null ? String(o.targetHandle) : null,
      }
    })
    .filter(e => e.source && e.target)
}

const defaultNodes = (): Node<WorkflowNodeData>[] => [
  {
    id: 'n-start',
    type: WORKFLOW_NODE_TYPE,
    position: { x: 180, y: 80 },
    data: { label: '시작' },
  },
]

function WorkflowEditorInner({
  workflowId,
  onBack,
}: {
  workflowId: string
  onBack: () => void
}) {
  const [row, setRow] = useState<WorkflowRow | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNodeData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [saving, setSaving] = useState(false)
  const { screenToFlowPosition } = useReactFlow()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadError(null)
      const w = await fetchWorkflowById(workflowId)
      if (cancelled) return
      if (!w) {
        setLoadError('순서도를 찾을 수 없거나 권한이 없습니다.')
        return
      }
      setRow(w)
      setTitle(w.title)
      setDescription(w.description ?? '')
      const pn = parseNodes(w.nodes)
      setNodes(pn.length ? pn : defaultNodes())
      setEdges(parseEdges(w.edges))
    })()
    return () => {
      cancelled = true
    }
  }, [workflowId, setNodes, setEdges])

  const onConnect = useCallback(
    (c: Connection) => setEdges(eds => addEdge({ ...c, animated: true }, eds)),
    [setEdges],
  )

  const addNode = useCallback(() => {
    const id = `n-${crypto.randomUUID().slice(0, 8)}`
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    setNodes(nds => [
      ...nds,
      {
        id,
        type: WORKFLOW_NODE_TYPE,
        position: { x: center.x - 80, y: center.y - 40 },
        data: { label: '새 단계' },
      },
    ])
  }, [setNodes, screenToFlowPosition])

  const handleSave = useCallback(async () => {
    if (!row) return
    setSaving(true)
    try {
      const ok = await updateWorkflow(row.id, {
        title: title.trim() || '제목 없음',
        description: description.trim() || null,
        nodes: sanitizeNodes(nodes),
        edges: sanitizeEdges(edges),
      })
      if (!ok) {
        window.alert('저장에 실패했습니다. Supabase 연결·로그인을 확인하세요.')
      }
    } finally {
      setSaving(false)
    }
  }, [row, title, description, nodes, edges])

  const handleDeleteWorkflow = useCallback(async () => {
    if (!row) return
    if (!confirm('이 순서도를 삭제할까요?')) return
    const ok = await deleteWorkflow(row.id)
    if (ok) onBack()
    else window.alert('삭제에 실패했습니다.')
  }, [row, onBack])

  const flowKey = useMemo(() => workflowId + (row?.updated_at ?? ''), [workflowId, row?.updated_at])

  if (loadError) {
    return (
      <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-white p-6">
        <p className="text-slate-700 font-medium mb-4">{loadError}</p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 text-white px-4 py-2 text-sm font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          목록으로
        </button>
      </div>
    )
  }

  if (!row) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-white">
        <p className="text-slate-500">불러오는 중…</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-slate-100">
      <header className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white shadow-sm shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="w-4 h-4" />
          뒤로
        </button>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="flex-1 min-w-[200px] rounded-xl border border-slate-200 px-3 py-2 text-base font-bold text-slate-900"
          placeholder="순서도 제목"
        />
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="flex-[2] min-w-[200px] rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600"
          placeholder="간단한 설명 (선택)"
        />
        <button
          type="button"
          onClick={handleDeleteWorkflow}
          className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
          title="순서도 삭제"
        >
          <Trash2 className="w-4 h-4" />
          삭제
        </button>
      </header>

      <div className="flex-1 min-h-0 relative" key={flowKey}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          deleteKeyCode={['Backspace', 'Delete']}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} color="#c4b5fd" />
          <Controls className="!shadow-lg !border-slate-200" />
          <MiniMap
            className="!rounded-lg !border !border-slate-200 !shadow-md"
            maskColor="rgba(124, 58, 237, 0.08)"
            nodeColor={() => '#8b5cf6'}
          />
          <Panel position="top-right" className="flex gap-2 m-2">
            <button
              type="button"
              onClick={addNode}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white border-2 border-violet-200 text-violet-800 px-3 py-2 text-sm font-bold shadow-sm hover:bg-violet-50"
            >
              <Plus className="w-4 h-4" />
              노드 추가
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 text-white px-4 py-2 text-sm font-bold shadow-lg shadow-violet-500/25 hover:bg-violet-700 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {saving ? '저장 중…' : '저장'}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" />
              목록
            </button>
          </Panel>
        </ReactFlow>
      </div>
      <p className="text-[11px] text-slate-500 px-4 py-2 bg-white border-t border-slate-100 shrink-0">
        노드를 드래그해 배치하고, 하단 핸들에서 다른 노드의 상단 핸들로 연결하세요. 노드 선택 후 Delete로 삭제할 수 있습니다.
      </p>
    </div>
  )
}

export function WorkflowEditorPage(props: { workflowId: string; onBack: () => void }) {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner {...props} />
    </ReactFlowProvider>
  )
}
