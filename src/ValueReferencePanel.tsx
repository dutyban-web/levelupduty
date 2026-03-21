/**
 * Quest 화면용 — 행동 자산(Value) 참조 패널 + 퀘스트 연결
 */
import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  loadValueActionStore,
  loadQuestValueLinks,
  setQuestValueLink,
  computeHourlyRateKrw,
  uniqueIdentities,
  type ValueActionStore,
} from './valueActionData'
import { Gem, ChevronRight, Link2, X } from 'lucide-react'

export type QuestRef = { id: string; name: string }

type Props = {
  quests: QuestRef[]
  /** 모달 모드일 때 닫기 */
  onClose?: () => void
}

export function ValueReferencePanel({ quests, onClose }: Props) {
  const [store, setStore] = useState<ValueActionStore>(() => loadValueActionStore())
  const [links, setLinks] = useState(() => loadQuestValueLinks())
  const [identityFilter, setIdentityFilter] = useState('')
  const [linkQuestId, setLinkQuestId] = useState('')
  const [linkValueId, setLinkValueId] = useState('')

  const refresh = useCallback(() => {
    setStore(loadValueActionStore())
    setLinks(loadQuestValueLinks())
  }, [])

  const identities = useMemo(() => uniqueIdentities(store.items), [store.items])

  const filtered = useMemo(() => {
    let list = store.items
    if (identityFilter.trim()) list = list.filter(i => i.identity.trim() === identityFilter.trim())
    return [...list].sort((a, b) => a.actionName.localeCompare(b.actionName, 'ko'))
  }, [store.items, identityFilter])

  const saveLink = () => {
    if (!linkQuestId || !linkValueId) return
    setQuestValueLink(linkQuestId, linkValueId)
    refresh()
    setLinkQuestId('')
    setLinkValueId('')
  }

  const clearLink = (questId: string) => {
    setQuestValueLink(questId, null)
    refresh()
  }

  return (
    <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-b from-white to-violet-50/40 shadow-md overflow-hidden">
      <div className="px-3 py-2.5 border-b border-violet-100 flex items-center justify-between gap-2 bg-violet-50/80">
        <div className="flex items-center gap-2 min-w-0">
          <Gem className="w-4 h-4 text-violet-600 shrink-0" />
          <span className="text-[11px] font-black text-violet-900 truncate">행동 자산 표준</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link
            to="/value"
            className="text-[10px] font-bold text-violet-600 hover:underline flex items-center gap-0.5"
          >
            편집
            <ChevronRight className="w-3 h-3" />
          </Link>
          {onClose && (
            <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-violet-100 text-slate-500 md:hidden" aria-label="닫기">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-3 space-y-3 max-h-[min(70vh,560px)] overflow-y-auto">
        <p className="text-[10px] text-slate-500 leading-snug m-0">
          퀘스트 설계 시 표준 시간·단가·전략 가치를 바로 확인하세요. 완료 시 누적 합산을 위해 아래에서 퀘스트와 연결할 수 있습니다.
        </p>

        <div>
          <label className="text-[9px] font-bold text-slate-400 uppercase">정체성</label>
          <select
            value={identityFilter}
            onChange={e => setIdentityFilter(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-800"
          >
            <option value="">전체</option>
            {identities.map(id => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>

        <ul className="space-y-2 list-none m-0 p-0">
          {filtered.length === 0 ? (
            <li className="text-[11px] text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-xl">
              등록된 행동이 없습니다.{' '}
              <Link to="/value" className="text-violet-600 font-bold underline">
                Value
              </Link>
              에서 추가하세요.
            </li>
          ) : (
            filtered.map(row => {
              const hr = computeHourlyRateKrw(row.standardTimeMinutes, row.economicValueKrw)
              return (
                <li key={row.id} className="rounded-xl border border-slate-100 bg-white/90 px-2.5 py-2 text-[11px] shadow-sm">
                  <p className="font-bold text-slate-900 m-0 leading-tight">{row.actionName}</p>
                  {row.identity && <p className="text-slate-500 m-0 mt-0.5 truncate">{row.identity}</p>}
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 text-[10px] text-slate-600">
                    <span>{Math.round(row.standardTimeMinutes / 60 * 10) / 10}h 기준</span>
                    <span className="text-violet-700 font-bold">{hr != null ? `${hr.toLocaleString()}원/h` : '—'}</span>
                    <span className="text-slate-400">인지L{row.cognitiveDensity}</span>
                    <span className="text-slate-400">
                      전략{row.strategicValue === 'high' ? '상' : row.strategicValue === 'mid' ? '중' : '하'}
                    </span>
                  </div>
                </li>
              )
            })
          )}
        </ul>

        <div className="border-t border-violet-100 pt-3 space-y-2">
          <div className="flex items-center gap-1 text-[10px] font-black text-violet-800 uppercase tracking-wide">
            <Link2 className="w-3.5 h-3.5" />
            퀘스트 ↔ 행동 연결
          </div>
          <select
            value={linkQuestId}
            onChange={e => setLinkQuestId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px]"
          >
            <option value="">퀘스트 선택</option>
            {quests.map(q => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
          <select
            value={linkValueId}
            onChange={e => setLinkValueId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px]"
          >
            <option value="">행동 자산 선택</option>
            {store.items.map(v => (
              <option key={v.id} value={v.id}>
                {v.actionName}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={saveLink}
            disabled={!linkQuestId || !linkValueId}
            className="w-full py-2 rounded-lg bg-violet-600 text-white text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            연결 저장
          </button>

          {Object.keys(links).length > 0 && (
            <ul className="list-none m-0 p-0 space-y-1">
              {Object.entries(links).map(([qid, vid]) => {
                const qn = quests.find(q => q.id === qid)?.name ?? qid
                const va = store.items.find(v => v.id === vid)
                return (
                  <li key={qid} className="flex items-start justify-between gap-1 text-[10px] text-slate-600 bg-slate-50 rounded-lg px-2 py-1">
                    <span className="min-w-0">
                      <span className="font-bold text-slate-800">{qn}</span>
                      <span className="text-slate-400"> → </span>
                      {va?.actionName ?? vid}
                    </span>
                    <button type="button" onClick={() => clearLink(qid)} className="text-red-500 font-bold shrink-0">
                      해제
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/** 모바일: 우하단 FAB + 전체화면 시트 */
export function ValueReferenceMobileFab({ quests }: { quests: QuestRef[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[76px] right-4 z-[400] w-12 h-12 rounded-full bg-violet-600 text-white shadow-lg shadow-violet-500/40 flex items-center justify-center md:hidden border border-white/20"
        title="행동 자산 참조"
        aria-label="행동 자산 참조 열기"
      >
        <Gem className="w-5 h-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[450] md:hidden flex flex-col bg-black/50" role="dialog">
          <div className="mt-auto max-h-[85vh] overflow-hidden rounded-t-2xl bg-white shadow-2xl flex flex-col">
            <ValueReferencePanel quests={quests} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
