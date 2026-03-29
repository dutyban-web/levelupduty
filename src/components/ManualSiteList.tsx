import { Fragment, type ReactNode } from 'react'
import type { ManualSiteRow } from '../supabase'
import { isYouTubeUrl } from '../utils/youtube'

export function splitManualSitesByYouTube(sites: ManualSiteRow[]) {
  const youtubeSites = sites.filter(s => isYouTubeUrl(s.url))
  const otherSites = sites.filter(s => !isYouTubeUrl(s.url))
  return { youtubeSites, otherSites }
}

export function ManualSiteList({
  sites,
  renderItem,
}: {
  sites: ManualSiteRow[]
  renderItem: (site: ManualSiteRow) => ReactNode
}) {
  const { youtubeSites, otherSites } = splitManualSitesByYouTube(sites)

  return (
    <div className="flex flex-col gap-8">
      {youtubeSites.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-teal-900/90">YouTube · {youtubeSites.length}</h3>
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-5 lg:gap-3">
            {youtubeSites.map(s => (
              <Fragment key={s.id}>{renderItem(s)}</Fragment>
            ))}
          </ul>
        </section>
      )}
      {otherSites.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-teal-900/90">링크 · {otherSites.length}</h3>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {otherSites.map(s => (
              <Fragment key={s.id}>{renderItem(s)}</Fragment>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
