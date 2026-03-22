/**
 * Quest — 모험일지 (노션형 BlockNote · 탐색기 파일 드래그)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { ManualDocEditor } from './ManualEditor'
import type { ManualDocumentRow } from './supabase'
import { loadAdventureJournal, saveAdventureJournal } from './adventureJournalData'

const JOURNAL_DOC_ID = 'quest-adventure-journal'

function manualRowFromBlocks(blocks: unknown): ManualDocumentRow {
  return {
    id: JOURNAL_DOC_ID,
    user_id: '',
    title: '모험일지',
    sort_order: 0,
    blocks,
    attachments: [],
    category: '',
    tags: [],
    importance_score: 0,
    completion_rate: 0,
    last_viewed_at: null,
    cover_hue: null,
    notes: '',
    rating: 0,
    created_at: '',
    updated_at: '',
  }
}

export function QuestAdventureJournal() {
  const [ready, setReady] = useState(false)
  const [blocks, setBlocks] = useState<unknown>(() => [])

  useEffect(() => {
    const s = loadAdventureJournal()
    setBlocks(s.blocks)
    setReady(true)
  }, [])

  const doc = useMemo(() => manualRowFromBlocks(blocks), [blocks])

  const onPersistBlocks = useCallback((json: string) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      return
    }
    setBlocks(parsed)
    saveAdventureJournal({ blocks: parsed })
  }, [])

  if (!ready) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#9B9A97', fontSize: 14 }}>
        모험일지를 불러오는 중…
      </div>
    )
  }

  const hasContent = Array.isArray(blocks) && blocks.length > 0

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '2px solid rgba(124,58,237,0.25)',
        borderRadius: '18px',
        padding: '24px 22px 28px',
        marginBottom: '24px',
        boxShadow: '0 8px 36px rgba(124,58,237,0.1), 0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'linear-gradient(145deg, rgba(124,58,237,0.15), rgba(99,102,241,0.08))',
            border: '1px solid rgba(124,58,237,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <BookOpen size={26} color="#6d28d9" strokeWidth={2.2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 800, color: '#7C3AED', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Quest
          </p>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#37352F', lineHeight: 1.2 }}>
            모험일지
          </h2>
          <p style={{ margin: '10px 0 0', fontSize: 13, color: '#787774', lineHeight: 1.55, maxWidth: 640 }}>
            퀘스트를 진행하며 겪은 일·감정·발견을 한 권의 일지처럼 남겨 보세요. 본문은 Manual과 같이{' '}
            <strong style={{ color: '#4F46E5' }}>슬래시(/) 메뉴</strong>와{' '}
            <strong style={{ color: '#4F46E5' }}>파일 드래그 앤 드롭</strong>으로 꾸밀 수 있습니다.
          </p>
          {!hasContent && (
            <p style={{ margin: '10px 0 0', fontSize: 12, color: '#A8A29E', fontStyle: 'italic' }}>
              첫 문단을 쓰거나 이미지를 끌어 넣어 오늘의 모험을 열어 보세요.
            </p>
          )}
        </div>
      </div>
      <ManualDocEditor doc={doc} onPersistBlocks={onPersistBlocks} />
    </div>
  )
}
