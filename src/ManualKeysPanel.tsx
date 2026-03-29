/**
 * Manual — 키·시리얼·가입 정보 시트 (날짜 / 분류 / 이름 / 키 / 메모)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import {
  supabase,
  fetchManualKeys,
  insertManualKey,
  updateManualKey,
  deleteManualKey,
  type ManualKeyRow,
} from './supabase'

type KeySortKey = 'entry_date' | 'category' | 'name' | 'updated_at' | 'sort_order'
type SortDir = 'asc' | 'desc'

function sortKeys(list: ManualKeyRow[], key: KeySortKey, dir: SortDir): ManualKeyRow[] {
  const next = [...list]
  const t = (s: string | null | undefined) => (s ? new Date(s).getTime() : 0)
  const inv = dir === 'desc' ? -1 : 1
  next.sort((a, b) => {
    let cmp = 0
    switch (key) {
      case 'entry_date':
        cmp = a.entry_date.localeCompare(b.entry_date)
        break
      case 'category':
        cmp = a.category.localeCompare(b.category, 'ko')
        break
      case 'name':
        cmp = a.name.localeCompare(b.name, 'ko')
        break
      case 'updated_at':
        cmp = t(a.updated_at) - t(b.updated_at)
        break
      case 'sort_order':
        cmp = a.sort_order - b.sort_order
        break
      default:
        cmp = 0
    }
    return cmp * inv
  })
  return next
}

function KeyRowEditor({
  row,
  onSaved,
  onDeleted,
}: {
  row: ManualKeyRow
  onSaved: (next: ManualKeyRow) => void
  onDeleted: (id: string) => void
}) {
  const [entryDate, setEntryDate] = useState(row.entry_date.slice(0, 10))
  const [category, setCategory] = useState(row.category)
  const [name, setName] = useState(row.name)
  const [keyText, setKeyText] = useState(row.key_text)
  const [note, setNote] = useState(row.note ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEntryDate(row.entry_date.slice(0, 10))
    setCategory(row.category)
    setName(row.name)
    setKeyText(row.key_text)
    setNote(row.note ?? '')
  }, [row.id, row.entry_date, row.category, row.name, row.key_text, row.note])

  const save = async () => {
    if (!supabase) {
      window.alert('Supabase가 연결되지 않았습니다.')
      return
    }
    setSaving(true)
    const noteTrim = note.trim()
    const ok = await updateManualKey(row.id, {
      entry_date: entryDate.trim().slice(0, 10) || row.entry_date,
      category: category.trim(),
      name: name.trim() || '제목 없음',
      key_text: keyText,
      note: noteTrim ? noteTrim : null,
    })
    setSaving(false)
    if (!ok) {
      window.alert('저장에 실패했습니다.')
      return
    }
    onSaved({
      ...row,
      entry_date: entryDate.trim().slice(0, 10) || row.entry_date,
      category: category.trim(),
      name: name.trim() || '제목 없음',
      key_text: keyText,
      note: noteTrim ? noteTrim : null,
      updated_at: new Date().toISOString(),
    })
  }

  const remove = async () => {
    if (!confirm('이 행을 삭제할까요?')) return
    const ok = await deleteManualKey(row.id)
    if (!ok) {
      window.alert('삭제에 실패했습니다.')
      return
    }
    onDeleted(row.id)
  }

  const cellInp =
    'w-full min-w-0 rounded-lg border border-indigo-200/80 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200'

  return (
    <tr className="border-b border-indigo-100/90 hover:bg-indigo-50/40">
      <td className="align-top px-2 py-2">
        <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} onBlur={() => void save()} className={cellInp} />
      </td>
      <td className="align-top px-2 py-2 min-w-[6rem]">
        <input value={category} onChange={e => setCategory(e.target.value)} onBlur={() => void save()} className={cellInp} placeholder="분류" />
      </td>
      <td className="align-top px-2 py-2 min-w-[7rem]">
        <input value={name} onChange={e => setName(e.target.value)} onBlur={() => void save()} className={cellInp} placeholder="사이트·앱 이름" />
      </td>
      <td className="align-top px-2 py-2 min-w-[8rem]">
        <textarea
          value={keyText}
          onChange={e => setKeyText(e.target.value)}
          onBlur={() => void save()}
          className={`${cellInp} min-h-[2.5rem] resize-y font-mono text-[11px]`}
          placeholder="키·시리얼·코드"
          rows={2}
        />
      </td>
      <td className="align-top px-2 py-2 min-w-[8rem]">
        <input value={note} onChange={e => setNote(e.target.value)} onBlur={() => void save()} className={cellInp} placeholder="메모" />
      </td>
      <td className="align-top whitespace-nowrap px-2 py-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-900 hover:bg-indigo-100 disabled:opacity-60"
          >
            <Pencil className="h-3 w-3" />
            {saving ? '…' : '저장'}
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-900 hover:bg-red-100"
          >
            <Trash2 className="h-3 w-3" />
            삭제
          </button>
        </div>
      </td>
    </tr>
  )
}

export function ManualKeysPanel() {
  const [rows, setRows] = useState<ManualKeyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [sortKey, setSortKey] = useState<KeySortKey>('entry_date')
  const [sortDirection, setSortDirection] = useState<SortDir>('desc')

  const reload = useCallback(async () => {
    setLoading(true)
    const list = await fetchManualKeys()
    setRows(list)
    setLoading(false)
    return list
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const allCategories = useMemo(() => {
    const s = new Set<string>()
    for (const r of rows) {
      const c = r.category?.trim()
      if (c) s.add(c)
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [rows])

  const filtered = useMemo(() => {
    if (!selectedCategory) return rows
    return rows.filter(r => (r.category ?? '').trim() === selectedCategory)
  }, [rows, selectedCategory])

  const displayRows = useMemo(() => sortKeys(filtered, sortKey, sortDirection), [filtered, sortKey, sortDirection])

  const resetFilters = () => {
    setSelectedCategory('')
    setSortKey('entry_date')
    setSortDirection('desc')
  }

  const addRow = async () => {
    if (!supabase) {
      window.alert('Supabase가 연결되지 않았습니다.')
      return
    }
    const row = await insertManualKey({})
    if (!row) {
      window.alert('행을 추가할 수 없습니다. 로그인과 DB(manual_keys)를 확인하세요.')
      return
    }
    setRows(prev => [...prev, row])
  }

  const onSaved = (next: ManualKeyRow) => {
    setRows(prev => prev.map(r => (r.id === next.id ? next : r)))
  }

  const onDeleted = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="mb-4 rounded-2xl border border-indigo-200/80 bg-indigo-50/95 px-3 py-3 shadow-sm sm:px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3 sm:gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <span className="shrink-0 text-xs font-bold text-indigo-900/75">분류</span>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="min-h-[38px] min-w-[9rem] max-w-[min(100%,200px)] shrink-0 rounded-xl border border-indigo-200/90 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              aria-label="분류로 필터"
            >
              <option value="">전체</option>
              {allCategories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <span className="shrink-0 text-xs font-bold text-indigo-900/75">정렬</span>
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as KeySortKey)}
              className="min-h-[38px] min-w-[10rem] shrink-0 rounded-xl border border-indigo-200/90 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              aria-label="정렬 기준"
            >
              <option value="entry_date">날짜</option>
              <option value="category">분류</option>
              <option value="name">이름 (사이트·앱)</option>
              <option value="updated_at">수정일</option>
              <option value="sort_order">추가 순서</option>
            </select>
            <select
              value={sortDirection}
              onChange={e => setSortDirection(e.target.value as SortDir)}
              className="min-h-[38px] min-w-[7.5rem] shrink-0 rounded-xl border border-indigo-200/90 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              aria-label="정렬 방향"
            >
              <option value="asc">오름차순</option>
              <option value="desc">내림차순</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-indigo-300 bg-white px-4 py-2 text-sm font-bold text-indigo-800 shadow-sm hover:bg-indigo-100/80"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              필터 초기화
            </button>
            <button
              type="button"
              onClick={() => void addRow()}
              className="inline-flex min-h-[38px] shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              새 행
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/80 px-4 py-10 text-center text-sm text-indigo-900">
          불러오는 중…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-indigo-300/80 bg-white/60 py-12 text-center text-sm text-slate-600">
          저장된 키가 없습니다. &quot;새 행&quot;으로 가입일·시리얼·라이선스 등을 적어 두세요.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-indigo-200/90 bg-white shadow-sm">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-indigo-200 bg-indigo-50/95 text-[10px] font-extrabold uppercase tracking-wide text-indigo-900/80 sm:text-xs">
                <th className="px-2 py-2.5 whitespace-nowrap">날짜</th>
                <th className="px-2 py-2.5 whitespace-nowrap">분류</th>
                <th className="px-2 py-2.5 whitespace-nowrap">이름 (사이트·앱)</th>
                <th className="px-2 py-2.5 whitespace-nowrap">키</th>
                <th className="px-2 py-2.5 whitespace-nowrap">메모</th>
                <th className="px-2 py-2.5 whitespace-nowrap w-[1%]">편집</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    이 분류에 맞는 행이 없습니다.
                  </td>
                </tr>
              ) : (
                displayRows.map(r => <KeyRowEditor key={r.id} row={r} onSaved={onSaved} onDeleted={onDeleted} />)
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
