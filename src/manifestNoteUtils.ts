import type { PartialBlock } from '@blocknote/core'
import { kvSet } from './lib/supabase'

export type ManifestNoteKind = 'cause' | 'effect' | 'achieved'

export const MANIFEST_NOTE_BUNDLE_KEY = 'manifestation_notion_notes_v1'
const NOTE_BUNDLE_KEY = MANIFEST_NOTE_BUNDLE_KEY

export type StoredManifestNotionNote = {
  title: string
  icon: string
  tags: string[]
  /** JSON.stringify(BlockNote Block[]) */
  blocksJson: string
}

export function manifestNoteStorageKey(kind: ManifestNoteKind, entityId: string): string {
  return `${kind}:${entityId}`
}

export function loadManifestNotionNote(key: string): StoredManifestNotionNote | null {
  try {
    const raw = localStorage.getItem(NOTE_BUNDLE_KEY)
    if (!raw) return null
    const all = JSON.parse(raw) as Record<string, StoredManifestNotionNote>
    const v = all[key]
    if (!v || typeof v.blocksJson !== 'string') return null
    return v
  } catch {
    return null
  }
}

export function saveManifestNotionNote(key: string, data: StoredManifestNotionNote): void {
  try {
    const raw = localStorage.getItem(NOTE_BUNDLE_KEY)
    const all = raw ? (JSON.parse(raw) as Record<string, StoredManifestNotionNote>) : {}
    all[key] = data
    localStorage.setItem(NOTE_BUNDLE_KEY, JSON.stringify(all))
    void kvSet(NOTE_BUNDLE_KEY, all)
  } catch {
    /* ignore quota */
  }
}

/** 해당 섹션 카드들의 노트에 붙은 태그 전체(중복 제거, 가나다순) */
export function collectTagsForEntities(kind: ManifestNoteKind, entityIds: string[]): string[] {
  const set = new Set<string>()
  for (const id of entityIds) {
    const note = loadManifestNotionNote(manifestNoteStorageKey(kind, id))
    if (note?.tags?.length) {
      for (const t of note.tags) {
        const s = t.trim()
        if (s) set.add(s)
      }
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ko'))
}

export function entityHasNoteTag(kind: ManifestNoteKind, entityId: string, tag: string): boolean {
  const note = loadManifestNotionNote(manifestNoteStorageKey(kind, entityId))
  return Boolean(note?.tags?.some(t => t.trim() === tag))
}

/** 카드 미리보기용: 블록 JSON 또는 일반 문자열에서 짧은 텍스트 */
export function blockNoteToPlainPreview(value: string, maxLen = 120): string {
  if (!value?.trim()) return ''
  const t = value.trim()
  if (!t.startsWith('[')) return t.replace(/\n/g, ' ').slice(0, maxLen)
  try {
    const blocks = JSON.parse(t) as Array<{ content?: unknown; children?: unknown[] }>
    const texts: string[] = []
    const extract = (c: unknown) => {
      if (typeof c === 'string') texts.push(c)
      else if (c && typeof c === 'object' && 'text' in c && typeof (c as { text: string }).text === 'string') texts.push((c as { text: string }).text)
      else if (Array.isArray(c)) c.forEach(extract)
      else if (c && typeof c === 'object' && 'content' in c) extract((c as { content: unknown }).content)
    }
    blocks.forEach(b => {
      extract(b.content)
      ;(b.children || []).forEach(ch => extract(ch))
    })
    return texts.join(' ').replace(/\n/g, ' ').slice(0, maxLen) || ''
  } catch {
    return t.slice(0, maxLen)
  }
}

export function parseToInitialBlocks(value: string): PartialBlock[] | undefined {
  if (!value || !value.trim()) return undefined
  const trimmed = value.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as PartialBlock[]
    } catch {
      /* fall through */
    }
  }
  return [{ type: 'paragraph', content: trimmed }]
}
