import { useState, useRef } from 'react'
import { CheckCircle2, PenLine } from 'lucide-react'
import { useIsMobile } from './hooks/useIsMobile'
import { kvSet } from './lib/supabase'
import { syncJournals } from './supabase'
import { RichEditor } from './RichEditor'
import { SettlementReviewPage } from './SettlementReviewPage'

// ── Quest row shape (matches App userQuests) ─────────────────────────────────
type Card = {
  id: string; name: string; sub: string; emoji?: string
  projectId?: string | null
  identityId?: string | null
  status?: string
  tags?: string[]
  sortOrder?: number
  priority?: number; deadline?: string
  timeSpentSec?: number; remainingTimeSec?: number | null
  pomodoroCount?: number
  startedAt?: string; endedAt?: string
}

type XpState = { totalXp: number }

const XP_PER_QUEST = 20
const JOURNAL_KEY = 'creative_os_journal_v1'

function getRequiredXp(level: number): number {
  if (level <= 100) return 1_000
  if (level <= 300) return 3_000
  if (level <= 450) return 4_500
  return 7_500
}

const MAX_LEVEL = 500

function calculateLevel(totalXp: number): {
  currentLevel: number
  currentLevelXp: number
  maxCurrentLevelXp: number
  baseXpForCurrentLevel: number
  totalXp: number
  progressPct: number
  progressPercentage: number
} {
  const clamped = Math.max(0, totalXp)
  let level = 1
  let acc = 0
  for (; ;) {
    const req = getRequiredXp(level)
    if (acc + req > clamped || level >= MAX_LEVEL) break
    acc += req
    level++
  }
  const baseXpForCurrentLevel = acc
  const currentLevelXp = clamped - acc
  const maxCurrentLevelXp = getRequiredXp(level)
  const progressPct = maxCurrentLevelXp > 0 ? Math.min((currentLevelXp / maxCurrentLevelXp) * 100, 100) : 0
  return {
    currentLevel: level,
    currentLevelXp,
    maxCurrentLevelXp,
    baseXpForCurrentLevel,
    totalXp: clamped,
    progressPct,
    progressPercentage: progressPct,
  }
}

type AchievementBlock = {
  questId: string; questName: string; emoji: string
  categoryLabel: string; categoryColor: string; xp: number
}
type JournalEntry = {
  date: string
  content: string
  questsDone: string[]
  xpSnapshot: number
  savedAt: string
  blocks?: AchievementBlock[]
}
type JournalStore = Record<string, JournalEntry>

function getTodayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function loadJournal(): JournalStore {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return {}
}
function persistJournal(store: JournalStore) {
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(store))
  kvSet(JOURNAL_KEY, store)
  syncJournals(store)
}
function formatDateKo(key: string, opts?: { full?: boolean }) {
  const d = new Date(key + 'T00:00:00')
  if (opts?.full) return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

// ═══════════════════════════════════════ REVIEW PAGE (구 Journal) ════════════
export function ReviewPage({ completedQuests, xpState, userQuests, onJournalChange }: {
  completedQuests: string[]
  xpState: XpState
  userQuests: Card[]
  onJournalChange?: () => void
}) {
  const isMobile = useIsMobile()
  const [journalTab, setJournalTab] = useState<'diary' | 'settlement'>('diary')
  const todayKey = getTodayKey()
  const [store, setStore] = useState<JournalStore>(() => loadJournal())
  const [activeKey, setActiveKey] = useState(todayKey)
  const [content, setContent] = useState(() => loadJournal()[todayKey]?.content ?? '')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [blocksDone, setBlocksDone] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeBlocks: AchievementBlock[] = store[activeKey]?.blocks ?? []

  function selectEntry(key: string) {
    setActiveKey(key)
    setContent(store[key]?.content ?? '')
  }

  function mergeEntry(key: string, patch: Partial<JournalEntry>, prev: JournalStore): JournalStore {
    const existing = prev[key] ?? {}
    const base: JournalEntry = {
      date: key,
      content: existing.content ?? '',
      questsDone: existing.questsDone ?? [],
      xpSnapshot: existing.xpSnapshot ?? 0,
      savedAt: new Date().toISOString(),
    }
    const merged: JournalEntry = { ...base, ...patch, date: key, savedAt: new Date().toISOString() }
    const next: JournalStore = { ...prev, [key]: merged }
    persistJournal(next)
    setLastSaved(new Date())
    return next
  }

  function handleContentChange(val: string) {
    setContent(val)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      setStore(prev => mergeEntry(activeKey, { content: val }, prev))
    }, 700)
  }

  function generateBlocks() {
    const catTextColor: Record<string, string> = { writing: '#4F46E5', business: '#B45309', health: '#065F46' }
    const catLabel: Record<string, string> = { writing: '집필', business: '비즈니스/공부', health: '자기관리' }
    const newBlocks: AchievementBlock[] = completedQuests.map(id => {
      const quest = userQuests.find(q => q.id === id)
      if (!quest) return null
      return {
        questId: id,
        questName: quest.name,
        emoji: quest.emoji ?? '✅',
        categoryLabel: catLabel[quest.sub] ?? quest.sub,
        categoryColor: catTextColor[quest.sub] ?? '#4F46E5',
        xp: XP_PER_QUEST,
      } as AchievementBlock
    }).filter(Boolean) as AchievementBlock[]

    setStore(prev => mergeEntry(activeKey, {
      blocks: newBlocks,
      questsDone: completedQuests,
      xpSnapshot: newBlocks.length * XP_PER_QUEST,
    }, prev))
    setBlocksDone(true)
    setTimeout(() => setBlocksDone(false), 2000)
  }

  const entryKeys = Object.keys(store).sort((a, b) => b.localeCompare(a))
  if (!entryKeys.includes(todayKey)) entryKeys.unshift(todayKey)
  const totalXp = activeBlocks.length * XP_PER_QUEST

  if (journalTab === 'settlement') {
    return (
      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '14px 12px' : '28px 48px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '12px' }}>
          <button type="button" onClick={() => setJournalTab('diary')} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: '#787774' }}>창작 일지</button>
          <button type="button" onClick={() => setJournalTab('settlement')} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #6366f1', background: 'rgba(99,102,241,0.1)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#4F46E5' }}>결산</button>
        </div>
        <SettlementReviewPage onSaved={onJournalChange} />
      </div>
    )
  }

  return (
    <div style={{
      maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '14px 12px' : '28px 48px',
      display: 'flex', flexDirection: 'column', height: isMobile ? 'auto' : 'calc(100vh - 52px)', overflow: isMobile ? 'visible' : 'hidden',
    }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
        <button type="button" onClick={() => setJournalTab('diary')} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #6366f1', background: 'rgba(99,102,241,0.1)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#4F46E5' }}>창작 일지</button>
        <button type="button" onClick={() => setJournalTab('settlement')} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: '#787774' }}>결산</button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '0' : '24px', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ width: isMobile ? '100%' : '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', overflowY: isMobile ? 'visible' : 'auto', borderBottom: isMobile ? '1px solid rgba(0,0,0,0.06)' : 'none', paddingBottom: isMobile ? '12px' : '0', marginBottom: isMobile ? '12px' : '0' }}>
          <div style={{ paddingBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.06)', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
              <PenLine size={14} color="#6366f1" />
              <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, color: '#6366f1', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Review</p>
            </div>
            <p style={{ margin: '0 0 3px', fontSize: '20px', fontWeight: 900, color: '#37352F' }}>Review — 하루 결산</p>
            <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#787774' }}>매일의 결산을 적고 마무리하는 공간입니다.</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#787774' }}>{entryKeys.length}개의 기록</p>
          </div>

          {entryKeys.map(key => {
            const entry = store[key]
            const isToday = key === todayKey
            const isActive = key === activeKey
            const hasBlocks = (entry?.blocks?.length ?? 0) > 0
            const preview = entry?.content?.replace(/\n/g, ' ')?.slice(0, 42) ?? ''
            return (
              <button key={key} onClick={() => selectEntry(key)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '11px 14px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                backgroundColor: isActive ? 'rgba(99,102,241,0.10)' : 'transparent',
                borderLeft: `3px solid ${isActive ? '#6366f1' : 'transparent'}`,
                marginBottom: '3px', transition: 'all 0.15s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: isActive ? '#4F46E5' : isToday ? '#fbbf24' : '#9B9A97' }}>
                    {isToday ? '📍 오늘' : formatDateKo(key)}
                  </span>
                  {hasBlocks && (
                    <span style={{ fontSize: '10px', color: '#818cf8', fontWeight: 700 }}>
                      ⚡{(entry!.blocks!.length) * XP_PER_QUEST}XP
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '10px', color: '#AEAAA4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {preview || (isToday ? '오늘의 기록을 시작하세요...' : '내용 없음')}
                </p>
              </button>
            )
          })}
        </div>

        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          backgroundColor: '#F1F1EF', borderRadius: '12px',
          border: '1px solid #1e1e1e', overflow: 'hidden', minWidth: 0,
        }}>

          <div style={{
            padding: '20px 32px 16px', borderBottom: '1px solid #1e1e1e',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <div>
              <p style={{ margin: 0, fontSize: '11px', color: '#787774', marginBottom: '4px' }}>
                {activeKey === todayKey ? '✍️ 오늘의 일지' : '📖 지난 기록 (읽기 전용)'}
              </p>
              <p style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#37352F' }}>{formatDateKo(activeKey, { full: true })}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {lastSaved && activeKey === todayKey && (
                <span style={{ fontSize: '10px', color: '#AEAAA4' }}>
                  자동 저장 {lastSaved.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {activeKey === todayKey && (
                <button
                  onClick={generateBlocks}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    padding: '8px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    background: blocksDone
                      ? 'linear-gradient(135deg,#065f46,#047857)'
                      : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                    color: '#37352F', fontSize: '12px', fontWeight: 700,
                    boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { if (!blocksDone) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(99,102,241,0.55)' } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.35)' }}
                >
                  {blocksDone ? '✅ 블록 생성 완료!' : activeBlocks.length > 0 ? '🔄 성과 블록 재생성' : '⚡ 오늘의 성과 불러오기'}
                </button>
              )}
            </div>
          </div>

          {activeBlocks.length > 0 && (
            <div style={{
              padding: '20px 32px', borderBottom: '1px solid #1e1e1e',
              backgroundColor: 'rgba(99,102,241,0.03)', flexShrink: 0,
            }}>
              <p style={{ margin: '0 0 14px', fontSize: '11px', fontWeight: 800, color: '#6366f1', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={13} color="#6366f1" />
                오늘의 성과 블록
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                {activeBlocks.map(block => (
                  <div key={block.questId} style={{
                    backgroundColor: `${block.categoryColor}0d`,
                    border: `1px solid ${block.categoryColor}30`,
                    borderRadius: '16px', padding: '16px 18px',
                    minWidth: '150px', maxWidth: '200px',
                    transition: 'transform 0.18s, box-shadow 0.18s, border-color 0.18s',
                    cursor: 'default',
                  }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'
                      e.currentTarget.style.boxShadow = `0 10px 32px ${block.categoryColor}28`
                      e.currentTarget.style.borderColor = `${block.categoryColor}60`
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0) scale(1)'
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.borderColor = `${block.categoryColor}30`
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '24px' }}>{block.emoji}</span>
                      <span style={{
                        fontSize: '9px', fontWeight: 800, color: block.categoryColor,
                        backgroundColor: `${block.categoryColor}18`,
                        border: `1px solid ${block.categoryColor}30`,
                        padding: '2px 8px', borderRadius: '999px', letterSpacing: '0.08em',
                      }}>
                        {block.categoryLabel}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: '#37352F', lineHeight: 1.3 }}>{block.questName}</p>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      backgroundColor: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
                      borderRadius: '999px', padding: '3px 10px',
                    }}>
                      <span style={{ fontSize: '10px' }}>⚡</span>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#818cf8' }}>+{block.xp} XP</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '12px', color: '#787774' }}>
                  총 <strong style={{ color: '#37352F' }}>{activeBlocks.length}개</strong> 퀘스트 완료
                </span>
                <span style={{ width: '1px', height: '12px', backgroundColor: '#EBEBEA' }} />
                <span style={{ fontSize: '12px', color: '#787774' }}>
                  총 <strong style={{ color: '#818cf8' }}>{totalXp} XP</strong> 획득
                </span>
                <span style={{ width: '1px', height: '12px', backgroundColor: '#EBEBEA' }} />
                <span style={{ fontSize: '12px', color: '#787774' }}>
                  현재 <strong style={{ color: '#7C3AED' }}>Lv.{calculateLevel(xpState.totalXp).currentLevel}</strong> ({calculateLevel(xpState.totalXp).currentLevelXp}/{calculateLevel(xpState.totalXp).maxCurrentLevelXp} XP)
                </span>
              </div>
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <RichEditor
              value={content}
              onChange={handleContentChange}
              contentKey={activeKey}
              placeholder={
                activeKey === todayKey
                  ? '오늘 하루를 자유롭게 기록해보세요.\n\n어떤 작업을 했나요? 뭔가 막혔던 부분은?\n힘들었던 점, 좋았던 점, 내일의 다짐...'
                  : '이 날의 기록이 없습니다.'
              }
              minHeight={320}
              readOnly={activeKey !== todayKey}
            />
          </div>

          <div style={{
            padding: '10px 32px', borderTop: '1px solid #FFFFFF',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
          }}>
            <span style={{ fontSize: '11px', color: '#AEAAA4' }}>
              {content.length > 0 ? `${content.length.toLocaleString()}자` : ''}
            </span>
            <span style={{ fontSize: '11px', color: '#AEAAA4' }}>
              {activeKey !== todayKey ? '📖 읽기 전용' : '700ms 자동 저장'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
