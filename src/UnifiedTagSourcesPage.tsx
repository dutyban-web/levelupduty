/**
 * Board → 데이터 창고 → 원본(통합 태그)
 * 고밀도 그리드 · `/` 계층 · 별표 · 사용자 그룹에 태그 담기
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Tags, RefreshCw, Bookmark, Star, Plus, Minus, Trash2, FolderInput } from 'lucide-react'
import {
  collectUnifiedTagHits,
  groupHitsByTag,
  buildPathGroupStatsExcludingCustom,
  kindLabel,
  tagLeafName,
  tagRelativeToGroup,
  tagTopGroup,
  isFlatTag,
  type UnifiedTagHit,
} from './unifiedTagIndex'
import {
  loadUnifiedTagGroupsRegistry,
  saveUnifiedTagGroupsRegistry,
  newUnifiedGroupId,
  countTagsInCustomGroup,
  type UnifiedTagGroupsRegistry,
} from './unifiedTagGroupsRegistry'

const STARS_KEY = 'creative_os_unified_tag_stars_v1'

function loadStars(): Set<string> {
  try {
    const r = localStorage.getItem(STARS_KEY)
    if (!r) return new Set()
    const a = JSON.parse(r) as unknown
    if (!Array.isArray(a)) return new Set()
    return new Set(a.map(x => String(x)))
  } catch {
    return new Set()
  }
}

function saveStars(next: Set<string>) {
  try {
    localStorage.setItem(STARS_KEY, JSON.stringify([...next]))
  } catch { /* ignore */ }
}

/** all | uncat | starred | path:이름 | custom:id */
type SidebarMode = string

function pathSidebar(name: string): string {
  return `path:${name}`
}

function customSidebar(id: string): string {
  return `custom:${id}`
}

export function UnifiedTagSourcesPage({ refreshKey = 0 }: { refreshKey?: number }) {
  const [hits, setHits] = useState<UnifiedTagHit[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [sidebar, setSidebar] = useState<SidebarMode>('all')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [stars, setStars] = useState<Set<string>>(() => loadStars())
  const [registry, setRegistry] = useState<UnifiedTagGroupsRegistry>(() => loadUnifiedTagGroupsRegistry())
  const [newGroupName, setNewGroupName] = useState('')
  /** 태그에 그룹 지정용 미니 피커 (+ 클릭 시, 사이드바가 내 그룹이 아닐 때) */
  const [openGroupPickerFor, setOpenGroupPickerFor] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const list = await collectUnifiedTagHits()
      setHits(list)
    } catch (e) {
      console.error('[UnifiedTagSources]', e)
      setErr(e instanceof Error ? e.message : '불러오기 실패')
      setHits([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload, refreshKey])

  const byTag = useMemo(() => groupHitsByTag(hits), [hits])

  const customAssigned = useMemo(
    () => new Set(Object.keys(registry.tagToGroupId)),
    [registry.tagToGroupId],
  )

  const { groups: pathGroupStats, uncatCount } = useMemo(
    () => buildPathGroupStatsExcludingCustom(byTag.keys(), customAssigned),
    [byTag, customAssigned],
  )

  const sortedCustomGroups = useMemo(() => {
    return [...registry.groups].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ko'))
  }, [registry.groups])

  const totalUnique = byTag.size
  const starCount = useMemo(() => [...byTag.keys()].filter(t => stars.has(t)).length, [byTag, stars])

  const allTagKeys = useMemo(() => [...byTag.keys()], [byTag])

  const filteredTagKeys = useMemo(() => {
    let keys = [...byTag.keys()]
    const qq = q.trim().toLowerCase()
    if (qq) keys = keys.filter(t => t.toLowerCase().includes(qq))

    if (sidebar === 'starred') keys = keys.filter(t => stars.has(t))
    else if (sidebar === 'uncat') keys = keys.filter(t => isFlatTag(t) && !registry.tagToGroupId[t])
    else if (sidebar.startsWith('path:')) {
      const gn = sidebar.slice('path:'.length)
      keys = keys.filter(t => !registry.tagToGroupId[t] && tagTopGroup(t) === gn)
    } else if (sidebar.startsWith('custom:')) {
      const id = sidebar.slice('custom:'.length)
      keys = keys.filter(t => registry.tagToGroupId[t] === id)
    } else if (sidebar !== 'all') {
      keys = []
    }

    keys.sort((a, b) => {
      const ca = (byTag.get(a)?.length ?? 0) - (byTag.get(b)?.length ?? 0)
      if (ca !== 0) return -ca
      return a.localeCompare(b, 'ko')
    })
    return keys
  }, [byTag, q, sidebar, stars, registry.tagToGroupId])

  useEffect(() => {
    if (activeTag != null && !filteredTagKeys.includes(activeTag)) setActiveTag(null)
  }, [activeTag, filteredTagKeys])

  useEffect(() => {
    setOpenGroupPickerFor(null)
  }, [sidebar])

  const toggleStar = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setStars(prev => {
      const n = new Set(prev)
      if (n.has(tag)) n.delete(tag)
      else n.add(tag)
      saveStars(n)
      return n
    })
  }

  const persistRegistry = useCallback((next: UnifiedTagGroupsRegistry) => {
    saveUnifiedTagGroupsRegistry(next)
    setRegistry(next)
  }, [])

  const addCustomGroup = () => {
    const name = newGroupName.trim()
    if (!name) return
    const id = newUnifiedGroupId()
    const next: UnifiedTagGroupsRegistry = {
      ...registry,
      groups: [...registry.groups, { id, name, sortOrder: Date.now() }].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ko'),
      ),
    }
    persistRegistry(next)
    setNewGroupName('')
    setSidebar(customSidebar(id))
    setActiveTag(null)
  }

  const removeCustomGroup = (id: string) => {
    if (!window.confirm('이 그룹을 삭제할까요? 안에 넣었던 태그 배치만 풀립니다.')) return
    const tagToGroupId = { ...registry.tagToGroupId }
    for (const [k, v] of Object.entries(tagToGroupId)) {
      if (v === id) delete tagToGroupId[k]
    }
    const next: UnifiedTagGroupsRegistry = {
      ...registry,
      groups: registry.groups.filter(g => g.id !== id),
      tagToGroupId,
    }
    persistRegistry(next)
    if (sidebar === customSidebar(id)) {
      setSidebar('all')
      setActiveTag(null)
    }
  }

  const assignTagToGroup = (tag: string, groupId: string) => {
    const tagToGroupId = { ...registry.tagToGroupId }
    if (!groupId) delete tagToGroupId[tag]
    else tagToGroupId[tag] = groupId
    persistRegistry({ ...registry, tagToGroupId })
    setOpenGroupPickerFor(null)
  }

  const onPlusClick = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (sortedCustomGroups.length === 0) return
    if (sidebar.startsWith('custom:')) {
      const id = sidebar.slice('custom:'.length)
      assignTagToGroup(tag, id)
      return
    }
    setOpenGroupPickerFor(prev => (prev === tag ? null : tag))
  }

  const onMinusClick = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!registry.tagToGroupId[tag]) return
    assignTagToGroup(tag, '')
  }

  const sidebarTitle = useMemo(() => {
    if (sidebar === 'all') return `전체 (${filteredTagKeys.length})`
    if (sidebar === 'uncat') return `분류 없음 (${filteredTagKeys.length})`
    if (sidebar === 'starred') return `별표 (${filteredTagKeys.length})`
    if (sidebar.startsWith('path:')) return `${sidebar.slice('path:'.length)} (${filteredTagKeys.length})`
    if (sidebar.startsWith('custom:')) {
      const id = sidebar.slice('custom:'.length)
      const g = registry.groups.find(x => x.id === id)
      return `${g?.name ?? '그룹'} (${filteredTagKeys.length})`
    }
    return `(${filteredTagKeys.length})`
  }, [sidebar, filteredTagKeys.length, registry.groups])

  const uniqueTags = byTag.size
  const totalRefs = hits.length

  return (
    <div className="w-full min-w-0 px-2 pb-24 pt-3 sm:px-4 lg:px-8">
      <header className="mb-4 max-w-6xl">
        <span className="text-[10px] font-extrabold tracking-[0.2em] text-amber-700">DATA WAREHOUSE</span>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-black text-slate-900 sm:text-2xl">
          <Tags className="h-7 w-7 shrink-0 text-amber-600 sm:h-8 sm:w-8" />
          태그
        </h1>
        <p className="mt-1 max-w-3xl text-[11px] leading-snug text-slate-600 sm:text-xs">
          태그에 <code className="rounded bg-slate-100 px-1 text-[10px]">/</code>를 넣으면 경로 그룹으로 잡힙니다.{' '}
          <strong className="text-slate-800">내 그룹</strong>을 만들면 태그에 마우스를 올려 오른쪽 위 <strong className="text-slate-800">+ / −</strong>로 넣고 뺄 수 있습니다.
        </p>
      </header>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[10px] text-slate-500 sm:text-xs">
          고유 <strong className="text-slate-800">{uniqueTags}</strong> · 연결 <strong className="text-slate-800">{totalRefs}</strong>
        </p>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:text-xs"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      <div className="mb-3">
        <label className="sr-only" htmlFor="unified-tag-filter">
          태그 검색
        </label>
        <input
          id="unified-tag-filter"
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="전체 경로 검색…"
          spellCheck={false}
          className="w-full max-w-xl rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
        />
      </div>

      {err && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{err}</div>
      )}

      {loading && hits.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-600">불러오는 중…</div>
      ) : (
        <div className="flex min-h-[min(72vh,920px)] max-w-[1600px] flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-[#f3f3f2] shadow-sm lg:flex-row">
          <aside className="flex max-h-[48vh] shrink-0 flex-col border-b border-slate-200/80 bg-[#ececea] lg:max-h-none lg:w-[min(260px,28vw)] lg:border-b-0 lg:border-r">
            <div className="space-y-0.5 p-2">
              <SidebarRow
                icon={<Bookmark className="h-3.5 w-3.5 opacity-60" />}
                label="전체"
                count={totalUnique}
                active={sidebar === 'all'}
                onClick={() => { setSidebar('all'); setActiveTag(null) }}
              />
              <SidebarRow
                icon={<Bookmark className="h-3.5 w-3.5 opacity-60" />}
                label="분류 없음"
                count={uncatCount}
                active={sidebar === 'uncat'}
                onClick={() => { setSidebar('uncat'); setActiveTag(null) }}
              />
              <SidebarRow
                icon={<Star className="h-3.5 w-3.5 text-amber-600" />}
                label="별표"
                count={starCount}
                active={sidebar === 'starred'}
                onClick={() => { setSidebar('starred'); setActiveTag(null) }}
              />
            </div>

            <div className="border-t border-slate-200/60 px-2 py-1.5">
              <div className="flex items-center justify-between gap-1">
                <p className="m-0 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">내 그룹 ({sortedCustomGroups.length})</p>
              </div>
              <div className="mt-1.5 flex gap-1">
                <input
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="새 그룹 이름"
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-900 placeholder:text-slate-400"
                  onKeyDown={e => {
                    if (e.key === 'Enter') addCustomGroup()
                  }}
                />
                <button
                  type="button"
                  title="그룹 추가"
                  onClick={() => addCustomGroup()}
                  className="shrink-0 rounded-md border border-amber-300 bg-amber-100/80 p-1.5 text-amber-900 hover:bg-amber-200/90"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <nav className="max-h-32 min-h-0 overflow-y-auto border-b border-slate-200/50 px-2 pb-2">
              <ul className="m-0 list-none p-0">
                {sortedCustomGroups.map(g => (
                  <li key={g.id} className="mb-0.5 flex items-center gap-0.5">
                    <div className="min-w-0 flex-1">
                      <SidebarRow
                        icon={<FolderInput className="h-3.5 w-3.5 text-amber-700" />}
                        label={g.name}
                        count={countTagsInCustomGroup(allTagKeys, registry.tagToGroupId, g.id)}
                        active={sidebar === customSidebar(g.id)}
                        onClick={() => { setSidebar(customSidebar(g.id)); setActiveTag(null) }}
                      />
                    </div>
                    <button
                      type="button"
                      title="그룹 삭제"
                      className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-100 hover:text-red-700"
                      onClick={() => removeCustomGroup(g.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="border-t border-slate-200/60 px-2 py-1.5">
              <p className="m-0 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">경로 그룹 ({pathGroupStats.length})</p>
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              <ul className="m-0 list-none p-0">
                {pathGroupStats.map(g => (
                  <li key={g.name} className="mb-0.5">
                    <SidebarRow
                      icon={<Bookmark className="h-3.5 w-3.5 text-slate-500" />}
                      label={g.name}
                      count={g.tagCount}
                      active={sidebar === pathSidebar(g.name)}
                      onClick={() => { setSidebar(pathSidebar(g.name)); setActiveTag(null) }}
                    />
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#fafaf8]">
            <div className="border-b border-slate-200/60 px-2 py-1.5 sm:px-3">
              <p className="m-0 text-[11px] font-bold text-slate-700">{sidebarTitle}</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 sm:px-3">
              {filteredTagKeys.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">표시할 태그가 없습니다.</p>
              ) : (
                <>
                  <ul className="m-0 grid list-none grid-cols-2 gap-x-2 gap-y-0.5 p-0 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
                    {filteredTagKeys.map(tag => {
                      const list = byTag.get(tag) ?? []
                      const leaf = tagLeafName(tag)
                      let rel = tag
                      if (sidebar.startsWith('path:')) {
                        rel = tagRelativeToGroup(tag, sidebar.slice('path:'.length))
                      } else if (sidebar.startsWith('custom:')) {
                        rel = tag
                      } else if (sidebar !== 'all' && sidebar !== 'uncat' && sidebar !== 'starred') {
                        rel = tag
                      }
                      const open = activeTag === tag
                      const inGroup = Boolean(registry.tagToGroupId[tag])
                      return (
                        <li key={tag} className="min-w-0">
                          <div
                            className={`group/tagcell relative rounded border border-transparent px-1 py-0.5 pr-6 transition-colors ${
                              open ? 'border-amber-300/80 bg-amber-50/90' : 'hover:bg-black/[0.04]'
                            }`}
                          >
                            {sortedCustomGroups.length > 0 && (
                              <div className="pointer-events-none absolute right-0 top-0 z-10 flex gap-0.5 opacity-0 transition-opacity group-hover/tagcell:pointer-events-auto group-hover/tagcell:opacity-100">
                                <button
                                  type="button"
                                  title={
                                    sidebar.startsWith('custom:')
                                      ? `이 태그를 «${registry.groups.find(g => g.id === sidebar.slice('custom:'.length))?.name ?? ''}»에 넣기`
                                      : '내 그룹에 넣기'
                                  }
                                  className="rounded bg-white/95 p-0.5 text-amber-700 shadow-sm ring-1 ring-slate-200/80 hover:bg-amber-50 hover:text-amber-900"
                                  onClick={e => onPlusClick(tag, e)}
                                >
                                  <Plus className="h-3 w-3" strokeWidth={2.5} />
                                </button>
                                <button
                                  type="button"
                                  title="내 그룹에서 빼기"
                                  disabled={!inGroup}
                                  className={`rounded p-0.5 shadow-sm ring-1 ring-slate-200/80 ${
                                    inGroup
                                      ? 'bg-white/95 text-slate-600 hover:bg-red-50 hover:text-red-700'
                                      : 'cursor-not-allowed bg-slate-100/80 text-slate-300'
                                  }`}
                                  onClick={e => onMinusClick(tag, e)}
                                >
                                  <Minus className="h-3 w-3" strokeWidth={2.5} />
                                </button>
                              </div>
                            )}
                            {openGroupPickerFor === tag && sortedCustomGroups.length > 0 && (
                              <div
                                className="absolute right-0 top-5 z-20 min-w-[140px] max-w-[min(220px,85vw)] rounded-md border border-slate-200 bg-white py-1 shadow-md"
                                onClick={e => e.stopPropagation()}
                              >
                                <p className="m-0 border-b border-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">담을 그룹</p>
                                <ul className="m-0 max-h-36 list-none overflow-y-auto p-0">
                                  {sortedCustomGroups.map(g => (
                                    <li key={g.id}>
                                      <button
                                        type="button"
                                        className="w-full px-2 py-1.5 text-left text-[10px] font-medium text-slate-800 hover:bg-amber-50"
                                        onClick={e => {
                                          e.stopPropagation()
                                          assignTagToGroup(tag, g.id)
                                        }}
                                      >
                                        {g.name}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <div className="flex items-start gap-0.5">
                              <button
                                type="button"
                                title={stars.has(tag) ? '별표 해제' : '별표'}
                                className="mt-0.5 shrink-0 text-amber-600/80 hover:text-amber-700"
                                onClick={e => toggleStar(tag, e)}
                              >
                                <Star className={`h-3 w-3 ${stars.has(tag) ? 'fill-amber-400' : ''}`} strokeWidth={stars.has(tag) ? 0 : 2} />
                              </button>
                              <button
                                type="button"
                                className="min-w-0 flex-1 text-left"
                                onClick={() => {
                                  setOpenGroupPickerFor(null)
                                  setActiveTag(open ? null : tag)
                                }}
                              >
                                <span className="text-[10px] leading-tight text-slate-400">·</span>
                                <span className="text-[10px] font-semibold leading-tight text-slate-800 sm:text-[11px]">{leaf}</span>
                                <span className="text-[10px] leading-tight text-slate-500"> ({list.length})</span>
                                {rel !== leaf && (
                                  <span className="mt-0.5 block truncate text-[9px] leading-none text-slate-400" title={tag}>
                                    {rel}
                                  </span>
                                )}
                              </button>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                  {activeTag != null && (byTag.get(activeTag)?.length ?? 0) > 0 && (
                    <div className="mt-3 border-t border-slate-200/80 bg-white/50 px-1 py-3 sm:px-2">
                      <div className="flex gap-3 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:thin]">
                        {(byTag.get(activeTag) ?? []).map((h, i) => (
                          <article
                            key={`${activeTag}-${i}-${h.kind}-${h.href}`}
                            className="flex aspect-square w-[min(118px,31vw)] shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-2.5 py-2.5 text-center shadow-sm ring-1 ring-black/[0.03] sm:w-[126px] sm:gap-2 sm:px-3 sm:py-3"
                          >
                            <p className="m-0 line-clamp-2 w-full text-center text-[9px] font-semibold uppercase tracking-[0.06em] leading-tight text-slate-400 sm:text-[10px]">
                              {kindLabel(h.kind)}
                            </p>
                            <Link
                              to={h.href}
                              className="line-clamp-4 w-full text-center text-[13px] font-extrabold leading-snug text-slate-900 underline-offset-2 hover:text-indigo-700 hover:underline sm:text-[14px]"
                            >
                              {h.title}
                            </Link>
                            {h.subtitle ? (
                              <p className="m-0 line-clamp-3 w-full text-center text-[9px] leading-relaxed text-slate-500 sm:text-[10px]">
                                {h.subtitle}
                              </p>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SidebarRow({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: ReactNode
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] font-medium transition-colors ${
        active ? 'bg-slate-300/50 text-slate-900' : 'text-slate-700 hover:bg-black/[0.06]'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 tabular-nums text-[10px] text-slate-500">{count}</span>
    </button>
  )
}
