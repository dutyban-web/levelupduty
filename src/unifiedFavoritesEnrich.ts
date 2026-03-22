/**
 * 통합 즐겨찾기 항목의 제목·부제를 최신 소스에서 다시 채웁니다.
 */
import {
  fetchManualDocuments,
  fetchProjects,
  fetchUnifiedPeople,
  fetchUserCreatedQuests,
  fetchWorkflows,
} from './supabase'
import { loadLocalWorkflows } from './workflowLocalData'
import type { UnifiedFavoritesStore } from './unifiedFavorites'
import { loadUnifiedFavoritesStore, saveUnifiedFavoritesStore } from './unifiedFavorites'

export async function enrichUnifiedFavoritesFromSources(): Promise<{ updated: number; store: UnifiedFavoritesStore }> {
  const store = loadUnifiedFavoritesStore()
  const [manualDocs, quests, projects, people, remoteWf] = await Promise.all([
    fetchManualDocuments().catch(() => []),
    fetchUserCreatedQuests().catch(() => []),
    fetchProjects().catch(() => []),
    fetchUnifiedPeople().catch(() => []),
    fetchWorkflows().catch(() => []),
  ])
  const localWf = loadLocalWorkflows()
  const wfMap = new Map([...remoteWf, ...localWf].map(w => [w.id, w]))
  const manualMap = new Map(manualDocs.map(d => [d.id, d]))
  const questMap = new Map(quests.map(q => [q.id, q]))
  const projectMap = new Map(projects.map(p => [p.id, p]))
  const personMap = new Map(people.map(p => [p.id, p]))

  let updated = 0
  const nextItems = store.items.map(e => {
    let title = e.title
    let subtitle = e.subtitle
    let href = e.href
    switch (e.kind) {
      case 'manual': {
        const d = manualMap.get(e.refId)
        if (d) {
          title = d.title?.trim() || '제목 없음'
          subtitle = d.category?.trim() || ''
          href = `/manual/${d.id}`
        }
        break
      }
      case 'quest': {
        const q = questMap.get(e.refId)
        if (q) {
          title = q.title?.trim() || '(제목 없음)'
          subtitle = q.category ?? ''
          href = '/'
        }
        break
      }
      case 'project': {
        const p = projectMap.get(e.refId)
        if (p) {
          title = p.name?.trim() || '프로젝트'
          subtitle = '프로젝트 허브'
          href = '/project'
        }
        break
      }
      case 'network_person': {
        const p = personMap.get(e.refId)
        if (p) {
          title = p.display_name?.trim() || '이름 없음'
          subtitle = '통합 인물 DB'
          href = '/master-board?warehouse=people'
        }
        break
      }
      case 'workflow': {
        const w = wfMap.get(e.refId)
        if (w) {
          title = w.title?.trim() || '순서도'
          subtitle = (w.description ?? '').trim().slice(0, 80) || '작업 순서도'
          href = `/value/workflow/${w.id}`
        }
        break
      }
      default:
        break
    }
    const changed = title !== e.title || subtitle !== e.subtitle || href !== e.href
    if (changed) updated++
    return { ...e, title, subtitle, href }
  })

  const next: UnifiedFavoritesStore = { items: nextItems }
  saveUnifiedFavoritesStore(next)
  return { updated, store: next }
}
