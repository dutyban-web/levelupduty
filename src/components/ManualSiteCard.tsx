import { useState } from 'react'
import { Play } from 'lucide-react'
import { getYouTubeThumbnail, isYouTubeUrl } from '../utils/youtube'
import type { ManualSiteRow } from '../supabase'

function hrefFromUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return '#'
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

function domainFromUrl(raw: string): string {
  try {
    const u = new URL(hrefFromUrl(raw))
    return u.hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function ManualSiteCard({ site }: { site: ManualSiteRow }) {
  const href = hrefFromUrl(site.url)
  const open = () => {
    if (href === '#') return
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  const youtube = isYouTubeUrl(site.url)
  const [thumbFailed, setThumbFailed] = useState(false)
  const [faviconFailed, setFaviconFailed] = useState(false)
  const thumbSrc = youtube ? getYouTubeThumbnail(site.url) : null

  if (youtube) {
    return (
      <button
        type="button"
        onClick={open}
        className="group flex w-full flex-col overflow-hidden rounded-2xl border border-teal-200/90 bg-white/95 text-left shadow-sm transition hover:border-teal-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
      >
        <div className="relative aspect-video w-full shrink-0 bg-slate-200">
          {thumbSrc && !thumbFailed ? (
            <img
              src={thumbSrc}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              onError={() => setThumbFailed(true)}
            />
          ) : null}
          {(thumbFailed || !thumbSrc) && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-300/90 text-slate-600">
              <Play className="h-10 w-10 opacity-90" strokeWidth={1.5} aria-hidden />
            </div>
          )}
        </div>
        <div className="min-w-0 px-3 py-2.5">
          <p className="line-clamp-2 text-sm font-bold text-slate-900">{site.title || '제목 없음'}</p>
        </div>
      </button>
    )
  }

  const domain = domainFromUrl(site.url)
  const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32` : ''

  return (
    <button
      type="button"
      onClick={open}
      className="flex w-full min-w-0 items-center gap-3 rounded-2xl border border-teal-200/90 bg-white/95 px-3 py-2.5 text-left shadow-sm transition hover:border-teal-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 sm:px-4"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {faviconUrl && !faviconFailed ? (
          <img
            src={faviconUrl}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
            loading="lazy"
            onError={() => setFaviconFailed(true)}
          />
        ) : (
          <span className="text-xs font-bold text-slate-400">·</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-slate-900">{site.title || '제목 없음'}</span>
        {domain ? <span className="mt-0.5 block truncate text-xs text-slate-500">{domain}</span> : null}
      </span>
    </button>
  )
}
