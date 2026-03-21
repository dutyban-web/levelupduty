/**
 * Value — 행동 자산 명세서 (표준 원가·전략 가치) · 작업 순서도(Workflows)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  type ValueAction,
  type ValueActionStore,
  type StrategicValueLevel,
  type DensityLevel,
  loadValueActionStore,
  saveValueActionStore,
  upsertValueAction,
  deleteValueAction,
  newValueActionId,
  computeHourlyRateKrw,
  uniqueIdentities,
} from './valueActionData'
import {
  LayoutGrid,
  Plus,
  Pencil,
  Table2,
  Trash2,
  Gem,
  Sparkles,
  Workflow,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { WorkflowEditorPage } from './WorkflowEditorPage'
import {
  fetchWorkflows,
  insertWorkflow,
  deleteWorkflow,
  supabase,
  type WorkflowRow,
} from './supabase'

const STRATEGIC_LABEL: Record<StrategicValueLevel, { ko: string; className: string }> = {
  high: { ko: '상', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  mid: { ko: '중', className: 'bg-amber-50 text-amber-900 border-amber-200' },
  low: { ko: '하', className: 'bg-slate-100 text-slate-600 border-slate-200' },
}

function minutesToInputHours(m: number): string {
  if (!m || m <= 0) return ''
  const h = m / 60
  return String(Math.round(h * 100) / 100)
}

function parseInputHours(s: string): number {
  const t = s.trim().replace(',', '.')
  const n = parseFloat(t)
  if (!Number.isFinite(n) || n <= 0) return 60
  return Math.max(1, Math.round(n * 60))
}

function formatMinutesHuman(m: number): string {
  if (m < 60) return `${m}분`
  const h = Math.floor(m / 60)
  const mm = m % 60
  if (mm === 0) return `${h}시간`
  return `${h}시간 ${mm}분`
}

function emptyDraft(): Omit<ValueAction, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    actionName: '',
    identity: '',
    standardTimeMinutes: 60,
    economicValueKrw: 0,
    cognitiveDensity: 3,
    strategicValue: 'mid',
    rewardIntensity: 3,
  }
}

export function ValuePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const workflowMatch = location.pathname.match(/^\/value\/workflow\/([^/]+)/)
  const workflowIdFromRoute = workflowMatch?.[1]

  const [workflows, setWorkflows] = useState<WorkflowRow[]>([])
  const [workflowsLoading, setWorkflowsLoading] = useState(false)
  /** Area·Projects 접기와 같이 기본 접힘 */
  const [workflowSectionExpanded, setWorkflowSectionExpanded] = useState(false)

  useEffect(() => {
    if (workflowIdFromRoute) return
    let cancelled = false
    ;(async () => {
      setWorkflowsLoading(true)
      const list = await fetchWorkflows()
      if (!cancelled) setWorkflows(list)
      if (!cancelled) setWorkflowsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [workflowIdFromRoute])

  const openWorkflow = useCallback(
    (id: string) => {
      navigate(`/value/workflow/${id}`)
    },
    [navigate],
  )

  const createWorkflow = useCallback(async () => {
    if (!supabase) {
      window.alert('Supabase가 연결되지 않았습니다. .env 설정을 확인하세요.')
      return
    }
    const row = await insertWorkflow('새 작업 순서도', '', [], [])
    if (!row) {
      window.alert('순서도를 만들 수 없습니다. 로그인 상태를 확인하세요.')
      return
    }
    openWorkflow(row.id)
  }, [openWorkflow])

  const removeWorkflow = useCallback(
    async (id: string) => {
      if (!confirm('이 순서도를 삭제할까요?')) return
      const ok = await deleteWorkflow(id)
      if (ok) setWorkflows(prev => prev.filter(w => w.id !== id))
      else window.alert('삭제에 실패했습니다.')
    },
    [],
  )

  const [store, setStore] = useState<ValueActionStore>(() => loadValueActionStore())
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [identityFilter, setIdentityFilter] = useState<string>('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<ValueAction | null>(null)
  const [draft, setDraft] = useState<Omit<ValueAction, 'id' | 'createdAt' | 'updatedAt'>>(emptyDraft())

  const persist = useCallback((updater: (prev: ValueActionStore) => ValueActionStore) => {
    setStore(prev => {
      const next = updater(prev)
      saveValueActionStore(next)
      return next
    })
  }, [])

  const identities = useMemo(() => uniqueIdentities(store.items), [store.items])

  const filtered = useMemo(() => {
    let list = store.items
    if (identityFilter.trim()) {
      list = list.filter(i => i.identity.trim() === identityFilter.trim())
    }
    return [...list].sort((a, b) => a.actionName.localeCompare(b.actionName, 'ko'))
  }, [store.items, identityFilter])

  const openNew = () => {
    setEditing(null)
    setDraft(emptyDraft())
    setEditorOpen(true)
  }

  const openEdit = (row: ValueAction) => {
    setEditing(row)
    setDraft({
      actionName: row.actionName,
      identity: row.identity,
      standardTimeMinutes: row.standardTimeMinutes,
      economicValueKrw: row.economicValueKrw,
      cognitiveDensity: row.cognitiveDensity,
      strategicValue: row.strategicValue,
      rewardIntensity: row.rewardIntensity,
    })
    setEditorOpen(true)
  }

  const saveRow = () => {
    const t = new Date().toISOString()
    const name = draft.actionName.trim() || '제목 없음'
    const row: ValueAction = editing
      ? {
          ...editing,
          ...draft,
          actionName: name,
          identity: draft.identity.trim(),
          updatedAt: t,
        }
      : {
          id: newValueActionId(),
          ...draft,
          actionName: name,
          identity: draft.identity.trim(),
          createdAt: t,
          updatedAt: t,
        }
    persist(prev => upsertValueAction(prev, row))
    setEditorOpen(false)
  }

  const remove = (id: string) => {
    if (!confirm('이 행동 자산을 삭제할까요?')) return
    persist(prev => deleteValueAction(prev, id))
  }

  if (workflowIdFromRoute) {
    return (
      <WorkflowEditorPage
        workflowId={workflowIdFromRoute}
        onBack={() => navigate('/value')}
      />
    )
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-10 py-8 pb-16">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-[10px] font-extrabold text-violet-600 tracking-[0.2em]">VALUE</span>
          <h1 className="mt-3 text-3xl font-black text-slate-900 flex items-center gap-2">
            <Gem className="w-8 h-8 text-violet-500 shrink-0" />
            행동 자산 명세
          </h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-2xl">
            모든 행동을 <strong className="text-violet-700">재화·자산</strong>으로 규격화합니다. 표준 시간과 금액으로 시간당 단가를 산출하고,
            퀘스트 설계 시 우측 참조 패널에서 이 기준을 바로 확인하세요.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                viewMode === 'table' ? 'bg-violet-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              테이블
            </button>
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                viewMode === 'card' ? 'bg-violet-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              카드
            </button>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 text-white px-4 py-2.5 text-sm font-bold shadow-lg shadow-violet-500/25 hover:bg-violet-700"
          >
            <Plus className="w-4 h-4" />
            행동 추가
          </button>
        </div>
      </header>

      {/* 퀘스트 화면 Area·Projects 접기와 유사: 기본 접힘 */}
      <div className="mb-8 rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setWorkflowSectionExpanded(v => !v)}
          className={`w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 text-left border-0 cursor-pointer transition-colors ${
            workflowSectionExpanded ? 'bg-violet-50/90' : 'bg-white hover:bg-slate-50/90'
          }`}
        >
          <span className="text-sm font-bold text-slate-800 flex items-center gap-2 flex-wrap min-w-0">
            <Workflow className="w-4 h-4 text-violet-600 shrink-0" />
            <span>작업 순서도 (Workflows)</span>
            <span className="text-xs font-semibold text-slate-500">
              ({workflowsLoading ? '…' : `${workflows.length}개`})
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-violet-600 shrink-0">
            {workflowSectionExpanded ? '접기' : '펼치기'}
            {workflowSectionExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>
        {workflowSectionExpanded && (
          <div className="px-4 sm:px-5 pb-5 pt-0 border-t border-slate-100">
            <p className="text-xs text-slate-500 mt-3 mb-3 leading-relaxed">
              작업 흐름을 <strong className="text-violet-700">순서도</strong>로 시각화합니다. 노드를 배치하고 연결하면 Supabase에 저장됩니다.
            </p>
            <div className="flex flex-wrap justify-end gap-2 mb-4">
              <button
                type="button"
                onClick={createWorkflow}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 text-white px-4 py-2.5 text-sm font-bold shadow-lg shadow-violet-500/25 hover:bg-violet-700"
              >
                <Plus className="w-4 h-4" />
                새 순서도 만들기
              </button>
            </div>
            {workflowsLoading ? (
              <p className="text-slate-500 text-sm py-6 text-center">불러오는 중…</p>
            ) : workflows.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 py-14 text-center">
                <Sparkles className="w-10 h-10 text-violet-300 mx-auto mb-3" />
                <p className="text-slate-600 m-0 text-sm">아직 순서도가 없습니다. &quot;새 순서도 만들기&quot;로 추가해 보세요.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {workflows.map(w => (
                  <div
                    key={w.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openWorkflow(w.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openWorkflow(w.id)
                      }
                    }}
                    className="rounded-2xl border-2 border-slate-200/90 bg-white p-5 shadow-sm hover:shadow-md hover:border-violet-300 cursor-pointer text-left transition-all flex flex-col gap-3 min-h-[140px]"
                  >
                    <div className="flex justify-between gap-2 items-start">
                      <h2 className="text-lg font-black text-slate-900 m-0 leading-snug">{w.title}</h2>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          removeWorkflow(w.id)
                        }}
                        className="p-1.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 shrink-0"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-sm text-slate-600 m-0 line-clamp-4 flex-1">
                      {(w.description ?? '').trim() || '설명이 없습니다. 카드를 열어 편집하세요.'}
                    </p>
                    <p className="text-[10px] text-slate-400 m-0 pt-1 border-t border-slate-100">
                      수정 {new Date(w.updated_at).toLocaleString('ko-KR')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <section className="mb-6 flex flex-wrap items-center gap-3">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">정체성 필터</label>
        <select
          value={identityFilter}
          onChange={e => setIdentityFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 min-w-[200px]"
        >
          <option value="">전체</option>
          {identities.map(id => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        {identityFilter && (
          <button type="button" onClick={() => setIdentityFilter('')} className="text-xs font-bold text-violet-600 underline">
            초기화
          </button>
        )}
      </section>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 py-20 text-center">
          <Sparkles className="w-10 h-10 text-violet-300 mx-auto mb-3" />
          <p className="text-slate-600 m-0">아직 등록된 행동 자산이 없습니다. 상단에서 추가하거나 필터를 바꿔 보세요.</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          <table className="w-full text-left text-sm border-collapse min-w-[960px]">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                <th className="px-3 py-3 border-b border-slate-100">행동명</th>
                <th className="px-3 py-3 border-b border-slate-100">정체성</th>
                <th className="px-3 py-3 border-b border-slate-100">표준시간</th>
                <th className="px-3 py-3 border-b border-slate-100">경제가치</th>
                <th className="px-3 py-3 border-b border-slate-100">시간당 단가</th>
                <th className="px-3 py-3 border-b border-slate-100">인지밀도</th>
                <th className="px-3 py-3 border-b border-slate-100">전략</th>
                <th className="px-3 py-3 border-b border-slate-100">보상</th>
                <th className="px-3 py-3 border-b border-slate-100 w-[100px]" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const hr = computeHourlyRateKrw(row.standardTimeMinutes, row.economicValueKrw)
                return (
                  <tr key={row.id} className="hover:bg-violet-50/40 border-b border-slate-50">
                    <td className="px-3 py-3 font-bold text-slate-900">{row.actionName}</td>
                    <td className="px-3 py-3 text-slate-700">{row.identity || '—'}</td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{formatMinutesHuman(row.standardTimeMinutes)}</td>
                    <td className="px-3 py-3 text-slate-800">{row.economicValueKrw.toLocaleString()}원</td>
                    <td className="px-3 py-3 font-semibold text-violet-700 whitespace-nowrap">
                      {hr != null ? `${hr.toLocaleString()}원/h` : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs font-bold rounded-lg bg-indigo-50 text-indigo-800 px-2 py-0.5">L{row.cognitiveDensity}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${STRATEGIC_LABEL[row.strategicValue].className}`}
                      >
                        {STRATEGIC_LABEL[row.strategicValue].ko}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs font-bold rounded-lg bg-fuchsia-50 text-fuchsia-800 px-2 py-0.5">L{row.rewardIntensity}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                          title="수정"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(row.id)}
                          className="p-1.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(row => {
            const hr = computeHourlyRateKrw(row.standardTimeMinutes, row.economicValueKrw)
            return (
              <div
                key={row.id}
                className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm hover:shadow-md hover:border-violet-200 transition-all flex flex-col gap-3"
              >
                <div className="flex justify-between gap-2 items-start">
                  <div className="min-w-0">
                    <p className="text-base font-extrabold text-slate-900 m-0 leading-snug">{row.actionName}</p>
                    <p className="text-xs text-slate-500 mt-1 m-0">{row.identity || '정체성 미입력'}</p>
                  </div>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0 ${STRATEGIC_LABEL[row.strategicValue].className}`}
                  >
                    전략 {STRATEGIC_LABEL[row.strategicValue].ko}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                    <span className="text-slate-400 block text-[10px] font-bold">표준</span>
                    {formatMinutesHuman(row.standardTimeMinutes)}
                  </div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                    <span className="text-slate-400 block text-[10px] font-bold">경제가치</span>
                    {row.economicValueKrw.toLocaleString()}원
                  </div>
                  <div className="rounded-lg bg-violet-50 px-2 py-1.5 col-span-2">
                    <span className="text-violet-500 block text-[10px] font-bold">시간당 단가</span>
                    <span className="font-black text-violet-800">{hr != null ? `${hr.toLocaleString()}원/h` : '—'}</span>
                  </div>
                </div>
                <div className="flex gap-2 text-[11px] font-bold text-slate-600">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800">인지 L{row.cognitiveDensity}</span>
                  <span className="px-2 py-0.5 rounded-md bg-fuchsia-50 text-fuchsia-800">보상 L{row.rewardIntensity}</span>
                </div>
                <div className="flex gap-2 mt-auto pt-1">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(row.id)}
                    className="px-3 py-2 rounded-xl border border-red-100 text-xs font-bold text-red-600 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editorOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]" role="dialog">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-black text-slate-900 m-0">{editing ? '행동 자산 수정' : '행동 자산 추가'}</h2>
            <label className="block text-xs font-bold text-slate-500">
              행동명
              <input
                value={draft.actionName}
                onChange={e => setDraft(d => ({ ...d, actionName: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="예: 웹툰 1화 콘티 작업"
              />
            </label>
            <label className="block text-xs font-bold text-slate-500">
              정체성 (주체)
              <input
                value={draft.identity}
                onChange={e => setDraft(d => ({ ...d, identity: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="예: 웹툰 작가"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-slate-500 col-span-2">
                표준 소요 시간 (시간 단위, 소수 가능)
                <input
                  value={minutesToInputHours(draft.standardTimeMinutes)}
                  onChange={e => setDraft(d => ({ ...d, standardTimeMinutes: parseInputHours(e.target.value) }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="예: 3 또는 2.5"
                />
              </label>
              <label className="block text-xs font-bold text-slate-500 col-span-2">
                경제적 가치 (원)
                <input
                  type="number"
                  min={0}
                  value={draft.economicValueKrw || ''}
                  onChange={e => setDraft(d => ({ ...d, economicValueKrw: Math.max(0, Number(e.target.value) || 0) }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="rounded-xl bg-violet-50 border border-violet-100 px-3 py-2 text-sm font-bold text-violet-900">
              시간당 단가:{' '}
              {(() => {
                const hr = computeHourlyRateKrw(draft.standardTimeMinutes, draft.economicValueKrw)
                return hr != null ? `${hr.toLocaleString()}원/h` : '시간·금액을 입력하세요'
              })()}
            </div>
            <label className="block text-xs font-bold text-slate-500">
              인지적 밀도 (1=기계적 · 5=고집중·창의)
              <input
                type="range"
                min={1}
                max={5}
                value={draft.cognitiveDensity}
                onChange={e => setDraft(d => ({ ...d, cognitiveDensity: Number(e.target.value) as DensityLevel }))}
                className="mt-2 w-full accent-violet-600"
              />
              <span className="text-sm font-bold text-slate-800">L{draft.cognitiveDensity}</span>
            </label>
            <label className="block text-xs font-bold text-slate-500">
              전략적 가치
              <select
                value={draft.strategicValue}
                onChange={e => setDraft(d => ({ ...d, strategicValue: e.target.value as StrategicValueLevel }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="high">상 — 장기 목표에 직접 기여</option>
                <option value="mid">중 — 간접·조건부 기여</option>
                <option value="low">하 — 유지·부수적</option>
              </select>
            </label>
            <label className="block text-xs font-bold text-slate-500">
              보상 특성 (도파민/성취감)
              <input
                type="range"
                min={1}
                max={5}
                value={draft.rewardIntensity}
                onChange={e => setDraft(d => ({ ...d, rewardIntensity: Number(e.target.value) as DensityLevel }))}
                className="mt-2 w-full accent-fuchsia-600"
              />
              <span className="text-sm font-bold text-slate-800">L{draft.rewardIntensity}</span>
            </label>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600"
              >
                취소
              </button>
              <button type="button" onClick={saveRow} className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold">
                저장
              </button>
            </div>
            <p className="text-[11px] text-slate-400 m-0">
              저장 시 브라우저 로컬에 보관됩니다. Quest 완료 시 실행 자산 누적은{' '}
              <Link to="/quest" className="text-violet-600 font-bold underline">
                퀘스트
              </Link>{' '}
              화면 참조 패널에서 연결할 수 있습니다.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
