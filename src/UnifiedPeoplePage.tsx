/**
 * Life → 통합 인물 DB — 실제 사람·캐릭터 등 마스터 레코드 (다른 영역에서 링크)
 */
import { useCallback, useEffect, useState } from 'react'
import { Users, Plus, Pencil, Trash2, Link2 } from 'lucide-react'
import {
  supabase,
  fetchUnifiedPeople,
  insertUnifiedPerson,
  updateUnifiedPerson,
  deleteUnifiedPerson,
  fetchPersonEntityLinksForPerson,
  type UnifiedPersonRow,
} from './supabase'
import { personEntityTypeLabel } from './personEntityTypes'
import { UnifiedFavoriteToggle } from './UnifiedFavoriteToggle'

export function UnifiedPeoplePage() {
  const [rows, setRows] = useState<UnifiedPersonRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [linksByPerson, setLinksByPerson] = useState<Record<string, Awaited<ReturnType<typeof fetchPersonEntityLinksForPerson>>>>({})

  const reload = useCallback(async () => {
    setLoading(true)
    const list = await fetchUnifiedPeople()
    setRows(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const addPerson = async () => {
    if (!supabase) {
      window.alert('Supabase에 로그인해 주세요.')
      return
    }
    const row = await insertUnifiedPerson('새 인물')
    if (!row) {
      window.alert('인물을 추가할 수 없습니다. DB(unified_people) 마이그레이션을 확인하세요.')
      return
    }
    setRows(prev => [...prev, row])
  }

  const saveField = async (id: string, patch: { display_name?: string; note?: string | null }) => {
    const ok = await updateUnifiedPerson(id, patch)
    if (!ok) window.alert('저장에 실패했습니다.')
    else setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch, updated_at: new Date().toISOString() } : r)))
  }

  const remove = async (id: string) => {
    if (!confirm('이 인물을 삭제할까요? 다른 화면에 걸린 연결도 함께 사라집니다.')) return
    const ok = await deleteUnifiedPerson(id)
    if (!ok) {
      window.alert('삭제에 실패했습니다.')
      return
    }
    setRows(prev => prev.filter(r => r.id !== id))
    setExpandedId(null)
  }

  const loadLinks = async (personId: string) => {
    if (linksByPerson[personId]) return
    const links = await fetchPersonEntityLinksForPerson(personId)
    setLinksByPerson(prev => ({ ...prev, [personId]: links }))
  }

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    void loadLinks(id)
  }

  return (
    <div className="w-full min-w-0 px-3 pb-24 pt-4 sm:px-6 lg:px-10">
      <header className="mb-6 max-w-3xl">
        <span className="text-[10px] font-extrabold tracking-[0.2em] text-violet-600">BEAUTIFUL LIFE</span>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-black text-slate-900">
          <Users className="h-8 w-8 text-violet-600" />
          인물
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Manual·저널·Goals·점괘·퀘스트 등에서 <strong className="text-violet-800">같은 인물</strong>을 가리킬 때 여기를
          기준으로 연결합니다. 실존 인물·작품 캐릭터 모두 등록해 두고 각 화면에서 체크만 하면 됩니다.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-xs text-slate-500">
          항목 {rows.length}명 · Supabase <code className="rounded bg-slate-100 px-1">unified_people</code>
        </p>
        <button
          type="button"
          onClick={() => void addPerson()}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" />
          인물 추가
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-600">
          불러오는 중…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/40 py-14 text-center text-sm text-slate-600">
          아직 인물이 없습니다. &quot;인물 추가&quot;로 등록해 보세요.
        </div>
      ) : (
        <ul className="m-0 flex max-w-3xl list-none flex-col gap-3 p-0">
          {rows.map(r => (
            <li
              key={r.id}
              className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm"
            >
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <label className="block">
                    <span className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">표시 이름</span>
                    <input
                      defaultValue={r.display_name}
                      key={`${r.id}-name-${r.updated_at}`}
                      onBlur={e => {
                        const v = e.target.value.trim() || '이름 없음'
                        if (v !== r.display_name) void saveField(r.id, { display_name: v })
                      }}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">메모</span>
                    <textarea
                      defaultValue={r.note ?? ''}
                      key={`${r.id}-note-${r.updated_at}`}
                      rows={2}
                      onBlur={e => {
                        const v = e.target.value.trim()
                        const note = v || null
                        if (note !== (r.note ?? null)) void saveField(r.id, { note })
                      }}
                      placeholder="관계, 출처, 작품명 등"
                      className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                    />
                  </label>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end">
                  <UnifiedFavoriteToggle
                    kind="network_person"
                    refId={r.id}
                    title={r.display_name?.trim() || '이름 없음'}
                    subtitle="인물"
                    href="/master-board?warehouse=people"
                  />
                  <button
                    type="button"
                    onClick={() => void toggleExpand(r.id)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    연결 {expandedId === r.id ? '접기' : '보기'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(r.id)}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800 hover:bg-red-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    삭제
                  </button>
                </div>
              </div>
              {expandedId === r.id && (
                <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3">
                  <p className="m-0 mb-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                    <Pencil className="h-3 w-3" />
                    이 인물이 연결된 항목
                  </p>
                  {!linksByPerson[r.id] ? (
                    <p className="m-0 text-xs text-slate-500">불러오는 중…</p>
                  ) : linksByPerson[r.id]!.length === 0 ? (
                    <p className="m-0 text-xs text-slate-500">아직 연결된 항목이 없습니다.</p>
                  ) : (
                    <ul className="m-0 list-inside list-disc space-y-1 p-0 text-xs text-slate-700">
                      {linksByPerson[r.id]!.map(l => (
                        <li key={l.id}>
                          <span className="font-semibold">{personEntityTypeLabel(l.entity_type)}</span>
                          <code className="ml-1 rounded bg-white px-1 text-[10px] text-slate-600">{l.entity_id}</code>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
