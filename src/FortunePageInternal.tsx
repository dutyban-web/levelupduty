import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import { ChevronRight, ChevronLeft, MoreVertical, Plus, X, List, Trash2, Pencil } from 'lucide-react'
import { Solar } from 'lunar-javascript'
import { useIsMobile } from './hooks/useIsMobile'
import {
  fetchFortuneDecks,
  fetchFortuneCards,
  fetchFortuneEvents,
  insertFortuneEvent,
  insertFortuneFeedback,
  updateFortuneEvent,
  deleteFortuneEvent,
  insertFortuneDeck,
  updateFortuneDeck,
  deleteFortuneDeck,
  type ReadingLogRow,
  type DrawnCardItem,
  type FortuneDeckRow,
  type FortuneCardRow,
} from './supabase'
import { FortuneReadingBlockNoteSection, blockNoteToPlainPreview } from './RichEditor'
import { SolutionBookDeckCard, SolutionBookModal, SOLUTION_BOOK_DECK_CARD_HEIGHT_PX } from './SolutionBook'
import { SOLUTION_BOOK_TITLE } from './solutionBookPhrases'
import { PersonLinkPicker } from './PersonLinkPicker'

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// ═══════════════════════════════════════ FORTUNE PAGE ══════════════════════════
type TarotCardDisplay = { id: string; name_ko: string; name_en: string; emoji: string; meaning: string }

const TAROT_DECK: TarotCardDisplay[] = [
  { id: '0', name_ko: '바보', name_en: 'The Fool', emoji: '🃏', meaning: '새로운 시작, 순수함, 자유' },
  { id: '1', name_ko: '마법사', name_en: 'The Magician', emoji: '✨', meaning: '의지, 창의력, 가능성' },
  { id: '2', name_ko: '여사제', name_en: 'The High Priestess', emoji: '🌙', meaning: '직관, 비밀, 내면의 지혜' },
  { id: '3', name_ko: '여황제', name_en: 'The Empress', emoji: '👑', meaning: '풍요, 창조, 모성' },
  { id: '4', name_ko: '황제', name_en: 'The Emperor', emoji: '⚜️', meaning: '질서, 권위, 구조' },
  { id: '5', name_ko: '교황', name_en: 'The Hierophant', emoji: '📿', meaning: '전통, 가르침, 영성' },
  { id: '6', name_ko: '연인', name_en: 'The Lovers', emoji: '💕', meaning: '선택, 사랑, 조화' },
  { id: '7', name_ko: '전차', name_en: 'The Chariot', emoji: '🏹', meaning: '의지력, 승리, 전진' },
  { id: '8', name_ko: '힘', name_en: 'Strength', emoji: '🦁', meaning: '용기, 인내, 부드러운 힘' },
  { id: '9', name_ko: '은둔자', name_en: 'The Hermit', emoji: '🕯️', meaning: '성찰, 고독, 내면 탐구' },
  { id: '10', name_ko: '운명의 수레바퀴', name_en: 'Wheel of Fortune', emoji: '☸️', meaning: '변화, 순환, 운명' },
  { id: '11', name_ko: '정의', name_en: 'Justice', emoji: '⚖️', meaning: '공정함, 균형, 진실' },
  { id: '12', name_ko: '매달린 사람', name_en: 'The Hanged Man', emoji: '🙃', meaning: '전환, 포기, 새로운 시각' },
  { id: '13', name_ko: '사신', name_en: 'Death', emoji: '🦋', meaning: '끝과 시작, 변신, 재탄생' },
  { id: '14', name_ko: '절제', name_en: 'Temperance', emoji: '🕊️', meaning: '조화, 인내, 중용' },
  { id: '15', name_ko: '악마', name_en: 'The Devil', emoji: '🔗', meaning: '속박, 유혹, 해방' },
  { id: '16', name_ko: '탑', name_en: 'The Tower', emoji: '⚡', meaning: '붕괴, 계시, 재건' },
  { id: '17', name_ko: '별', name_en: 'The Star', emoji: '⭐', meaning: '희망, 치유, 영감' },
  { id: '18', name_ko: '달', name_en: 'The Moon', emoji: '🌜', meaning: '직관, 꿈, 무의식' },
  { id: '19', name_ko: '태양', name_en: 'The Sun', emoji: '☀️', meaning: '기쁨, 성공, 활력' },
  { id: '20', name_ko: '심판', name_en: 'Judgement', emoji: '📯', meaning: '재탄생, 용서, 소명' },
  { id: '21', name_ko: '세계', name_en: 'The World', emoji: '🌍', meaning: '완성, 성취, 통합' },
]

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const FORTUNE_QUICK_LINKS = [
  { id: 'naver', title: '네이버 운세', url: 'https://search.naver.com/search.naver?query=오늘의+운세', emoji: '🍀' },
  { id: 'marie', title: '마리끌레르', url: 'https://www.marieclairekorea.com/horoscope/', emoji: '✨' },
  { id: 'elle', title: '엘르 별자리', url: 'https://www.elle.co.kr/astro', emoji: '🌙' },
  { id: 'saju', title: '만세력', url: 'https://pro.sajuplus.net/', emoji: '📜' },
]

function TarotCardFace({ card, isFront }: { card: TarotCardDisplay; isFront: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        transform: isFront ? 'rotateY(180deg)' : 'rotateY(0deg)',
        transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        ...(isFront
          ? { background: 'linear-gradient(160deg, #fafaf8 0%, #f5f5f0 100%)', border: '1px solid rgba(0,0,0,0.08)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }
          : { background: 'linear-gradient(160deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)', border: '1px solid rgba(139,92,246,0.3)', boxShadow: 'inset 0 0 30px rgba(0,0,0,0.3)' }),
      }}
    >
      {isFront ? (
        <>
          <span style={{ fontSize: 'clamp(24px, 4vw, 36px)', lineHeight: 1, marginBottom: '8px' }}>{card.emoji}</span>
          <span style={{ fontSize: 'clamp(11px, 2vw, 13px)', fontWeight: 800, color: '#37352F', textAlign: 'center' }}>{card.name_ko}</span>
          <span style={{ fontSize: 'clamp(9px, 1.5vw, 10px)', color: '#787774', marginTop: '2px' }}>{card.name_en}</span>
          <span style={{ fontSize: 'clamp(9px, 1.2vw, 10px)', color: '#9B9A97', marginTop: '8px', textAlign: 'center', lineHeight: 1.4 }}>{card.meaning}</span>
        </>
      ) : (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 70%, rgba(167,139,250,0.2) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(99,102,241,0.15) 0%, transparent 40%)', pointerEvents: 'none' }} />
          <span style={{ fontSize: '18px', opacity: 0.9, position: 'relative', zIndex: 1 }}>✨</span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginTop: '6px', letterSpacing: '0.2em', position: 'relative', zIndex: 1 }}>TAROT</span>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', position: 'relative', zIndex: 1 }}>✦ ✧ ✦</span>
        </>
      )}
    </div>
  )
}

function renderDrawnCards(cards: DrawnCardItem[]) {
  if (!cards || cards.length === 0) return null
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
      {cards.map((c, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#37352F' }}>
          {i > 0 && <span style={{ color: '#9B9A97', marginRight: '4px' }}>|</span>}
          <span>{c.emoji}</span>
          <span>{c.name_ko}{c.name_en ? ` (${c.name_en})` : ''}</span>
        </span>
      ))}
    </span>
  )
}

function fortuneCardToDisplay(c: FortuneCardRow): TarotCardDisplay {
  return {
    id: c.id,
    name_ko: c.name_ko,
    name_en: c.name_en ?? '',
    emoji: c.emoji ?? '🃏',
    meaning: c.meaning ?? '',
  }
}

/** 통합 덱 폼 모달: editingDeckId가 null이면 INSERT(추가), 있으면 UPDATE(수정) */
function DeckFormModal({
  editingDeckId,
  initialName,
  initialDescription,
  initialCoverImageUrl,
  onClose,
  onSaved,
}: {
  editingDeckId: string | null
  initialName: string
  initialDescription: string
  initialCoverImageUrl: string
  onClose: () => void
  onSaved: (deck: FortuneDeckRow) => void
}) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [coverImageUrl, setCoverImageUrl] = useState(initialCoverImageUrl)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(initialName)
    setDescription(initialDescription)
    setCoverImageUrl(initialCoverImageUrl)
    setError(null)
  }, [editingDeckId, initialName, initialDescription, initialCoverImageUrl])

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('덱 이름을 입력해 주세요.'); return }
    setSaving(true)
    setError(null)
    if (editingDeckId === null) {
      const deck = await insertFortuneDeck(trimmed, description || undefined, coverImageUrl || undefined)
      setSaving(false)
      if (deck) {
        onSaved(deck)
        onClose()
      } else {
        setError('덱 추가에 실패했습니다.')
      }
    } else {
      const updated = await updateFortuneDeck(editingDeckId, { name: trimmed, description: description || undefined, cover_image_url: coverImageUrl || undefined })
      setSaving(false)
      if (updated) {
        onSaved(updated)
        onClose()
      } else {
        setError('수정에 실패했습니다.')
      }
    }
  }

  const isAddMode = editingDeckId === null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 800, color: '#37352F' }}>{isAddMode ? '새 덱 추가' : '덱 수정'}</h3>
        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setError(null) }}
          placeholder={isAddMode ? '덱 이름 (예: 기본 타로 카드)' : '덱 이름'}
          style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '14px', marginBottom: '10px' }}
        />
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="설명 (선택)"
          style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '14px', marginBottom: '10px' }}
        />
        <input
          type="url"
          value={coverImageUrl}
          onChange={e => setCoverImageUrl(e.target.value)}
          placeholder="표지 이미지 URL (선택)"
          style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '14px', marginBottom: '16px' }}
        />
        {error && <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#ef4444' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>취소</button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: '#7C3AED', color: '#fff', cursor: saving ? 'default' : 'pointer', fontSize: '13px', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>{saving ? '저장 중…' : '저장'}</button>
        </div>
      </div>
    </div>
  )
}

const FALLBACK_DECK: FortuneDeckRow = { id: '__fallback__', name: '기본 타로 카드', sort_order: 0 }

function FortuneReadingCalendar({ readingLogs, selectedDate, onSelectDate }: {
  readingLogs: ReadingLogRow[]
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
}) {
  const [viewDate, setViewDate] = useState(new Date())
  const datesWithReadings = useMemo(() => {
    const set = new Set<string>()
    for (const r of readingLogs) {
      set.add(r.event_date ?? toYMD(new Date(r.created_at)))
    }
    return set
  }, [readingLogs])

  const dayDots = useCallback((date: Date) => {
    const dk = toYMD(date)
    if (!datesWithReadings.has(dk)) return null
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1px' }}>
        <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#7C3AED', display: 'block' }} title="운세 기록" />
      </div>
    )
  }, [datesWithReadings])

  const calValue = selectedDate ? new Date(selectedDate + 'T12:00:00') : null

  return (
    <div className="fortune-calendar-wrapper" style={{ fontSize: '11px' }}>
      <Calendar
        value={calValue ?? viewDate}
        onChange={(v) => {
          const d = v as Date
          const key = toYMD(d)
          onSelectDate(selectedDate === key ? null : key)
        }}
        onActiveStartDateChange={({ activeStartDate }) => activeStartDate && setViewDate(activeStartDate)}
        tileContent={({ date }) => dayDots(date)}
        calendarType="gregory"
        locale="ko-KR"
        showWeekNumbers
        formatShortWeekday={(_, d) => ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]}
        formatDay={(_locale, date) => date.getDate().toString()}
      />
      {selectedDate && (
        <button onClick={() => onSelectDate(null)} style={{ marginTop: '6px', width: '100%', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.08)', color: '#7C3AED', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>필터 해제</button>
      )}
    </div>
  )
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

/** 아카이브·편집: 질문 종류 (운세 카테고리) — 해결의 책 전용 라벨은 점괘 종류로 분리 */
const DEFAULT_QUESTION_TYPES = ['직장운', '애정운', '재물운', '건강운', '학업운', '합격운', '인간관계운', '기타']

/** 점괘 종류 고정 프리셋 + 오라클 덱 이름은 decks에서 합성 */
const FIXED_READING_KIND_PRESETS = ['해결의 책', '사주', '점성술', '관상', '손금', '자미두수', '숙요', '인도점성술', '산통점', '주역점', '토정비결', '기타'] as const

function mergeReadingKindOptions(decks: FortuneDeckRow[]): string[] {
  const set = new Set<string>([...FIXED_READING_KIND_PRESETS])
  for (const d of decks) {
    const n = d.name?.trim()
    if (n) set.add(n)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'))
}

const FORTUNE_READING_EDIT_Z = 50025

function ReadingLogEditModal({ log, onClose, onSaved, onDeleted, decks }: {
  log: ReadingLogRow
  onClose: () => void
  onSaved: (updated: ReadingLogRow) => void
  onDeleted: () => void
  decks: FortuneDeckRow[]
}) {
  const [question, setQuestion] = useState(log.question)
  const [notes, setNotes] = useState(log.notes ?? '')
  /** 저장 시 즉시 반영(디바운스보다 최신 JSON 보장) */
  const notesJsonRef = useRef<string>(log.notes ?? '')
  const [notesBootstrapKey, setNotesBootstrapKey] = useState(0)
  const lastSyncedNotesFromLogRef = useRef<{ id: string; notes: string | null | undefined }>({ id: log.id, notes: log.notes })
  const [createdAt, setCreatedAt] = useState(toDatetimeLocal(log.created_at))
  const [fortuneType, setFortuneType] = useState(log.fortune_type ?? '')
  const [readingKind, setReadingKind] = useState(log.reading_kind ?? '')
  const readingKindOptions = useMemo(() => mergeReadingKindOptions(decks), [decks])
  const [fortuneScore, setFortuneScore] = useState(log.fortune_score != null ? String(log.fortune_score) : '')
  const [fortuneOutcome, setFortuneOutcome] = useState<'good' | 'bad' | ''>(log.fortune_outcome ?? '')
  const [accuracyScore, setAccuracyScore] = useState(log.accuracy_score != null ? String(log.accuracy_score) : '')
  const [relatedPeople, setRelatedPeople] = useState(log.related_people ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    setQuestion(log.question)
    const n = log.notes ?? ''
    setNotes(n)
    notesJsonRef.current = n
    setCreatedAt(toDatetimeLocal(log.created_at))
    setFortuneType(log.fortune_type ?? '')
    setReadingKind(log.reading_kind ?? '')
    setFortuneScore(log.fortune_score != null ? String(log.fortune_score) : '')
    setFortuneOutcome(log.fortune_outcome ?? '')
    setAccuracyScore(log.accuracy_score != null ? String(log.accuracy_score) : '')
    setRelatedPeople(log.related_people ?? '')
    const prev = lastSyncedNotesFromLogRef.current
    if (prev.id !== log.id || prev.notes !== log.notes) {
      lastSyncedNotesFromLogRef.current = { id: log.id, notes: log.notes }
      setNotesBootstrapKey(k => k + 1)
    }
  }, [log.id, log.question, log.notes, log.created_at, log.fortune_type, log.reading_kind, log.fortune_score, log.fortune_outcome, log.accuracy_score, log.related_people])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSave() {
    if (!question.trim()) return
    setSaving(true)
    const fs = fortuneScore === '' ? undefined : Math.min(100, Math.max(1, parseInt(fortuneScore, 10) || 0))
    const acc = accuracyScore === '' ? undefined : Math.min(100, Math.max(1, parseInt(accuracyScore, 10) || 0))
    const notesPayload = (notesJsonRef.current || '').trim() || undefined
    const updated = await updateFortuneEvent(log.id, {
      question: question.trim(),
      notes: notesPayload,
      created_at: new Date(createdAt).toISOString(),
      fortune_type: fortuneType.trim() || null,
      reading_kind: readingKind.trim() || null,
      fortune_score: fs ?? null,
      fortune_outcome: (fortuneOutcome === 'good' || fortuneOutcome === 'bad') ? fortuneOutcome : null,
      accuracy_score: acc ?? null,
      related_people: relatedPeople.trim() || null,
    })
    setSaving(false)
    if (updated) {
      setSaved(true)
      onSaved(updated)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  async function handleDelete() {
    if (!window.confirm('이 기록을 정말 삭제하시겠습니까?')) return
    const ok = await deleteFortuneEvent(log.id)
    if (ok) {
      onDeleted()
      onClose()
    }
  }

  const drawn = log.drawn_cards ?? []
  const headerEmoji = drawn[0]?.emoji ?? '🔮'

  const fieldInp: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.08)',
    background: '#fff',
    fontSize: 14,
    color: '#37352f',
    outline: 'none',
    boxSizing: 'border-box',
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fortune-reading-edit-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: FORTUNE_READING_EDIT_Z,
        background: 'rgba(15, 23, 42, 0.42)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: 'min(820px, 100%)',
          maxHeight: 'min(92vh, 960px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.03)',
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            padding: 8,
            borderRadius: 8,
            border: 'none',
            background: 'rgba(0,0,0,0.04)',
            cursor: 'pointer',
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} color="#64748b" strokeWidth={2} />
        </button>

        <div style={{ overflowY: 'auto', flex: 1, padding: '28px 36px 16px', minHeight: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.12em',
              color: '#7C3AED',
            }}
          >
            운세 · 기록
          </p>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 10 }}>
            <span
              style={{
                width: 56,
                flexShrink: 0,
                padding: '4px 2px',
                fontSize: 40,
                lineHeight: 1,
                textAlign: 'center',
                userSelect: 'none',
              }}
              title="뽑은 카드 대표"
              aria-hidden
            >
              {headerEmoji}
            </span>
            <textarea
              id="fortune-reading-edit-title"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="질문 / 타이틀"
              rows={2}
              style={{
                flex: 1,
                margin: 0,
                padding: '4px 36px 4px 0',
                fontSize: 'clamp(22px, 3.8vw, 32px)',
                fontWeight: 800,
                color: '#111827',
                lineHeight: 1.25,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontFamily: 'inherit',
                resize: 'none',
                minHeight: 44,
                maxHeight: 120,
                overflowY: 'auto',
              }}
            />
          </div>

          {drawn.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <List size={16} color="#9ca3af" strokeWidth={2} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#787774' }}>[뽑은 카드]</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 20px', alignItems: 'flex-start' }}>
                {drawn.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      width: 76,
                      textAlign: 'center',
                    }}
                  >
                    <span style={{ fontSize: 30, lineHeight: 1 }}>{c.emoji}</span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        lineHeight: 1.35,
                        letterSpacing: '-0.015em',
                        color: '#111827',
                        wordBreak: 'keep-all',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        width: '100%',
                      }}
                    >
                      {c.name_ko ?? c.name_en ?? ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <List size={16} color="#9ca3af" strokeWidth={2} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#787774' }}>[기록]</span>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#7C3AED' }}>날짜 및 시간</label>
              <input type="datetime-local" value={createdAt} onChange={e => setCreatedAt(e.target.value)} style={fieldInp} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#7C3AED' }}>점괘 종류</label>
                <input list="reading-kinds" value={readingKind} onChange={e => setReadingKind(e.target.value)} placeholder="해결의 책, 덱 이름, 사주…" style={fieldInp} />
                <datalist id="reading-kinds">{readingKindOptions.map(t => <option key={t} value={t} />)}</datalist>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#7C3AED' }}>질문 종류</label>
                <input list="question-types" value={fortuneType} onChange={e => setFortuneType(e.target.value)} placeholder="직장운, 애정운 등" style={fieldInp} />
                <datalist id="question-types">{DEFAULT_QUESTION_TYPES.map(t => <option key={t} value={t} />)}</datalist>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#7C3AED' }}>운세 좋음/나쁨</label>
                <select value={fortuneOutcome} onChange={e => setFortuneOutcome(e.target.value as 'good' | 'bad' | '')} style={{ ...fieldInp, cursor: 'pointer' }}>
                  <option value="">선택 안 함</option>
                  <option value="good">좋은 운세</option>
                  <option value="bad">나쁜 운세</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#7C3AED' }}>점괘 점수 (1~100)</label>
                <input type="number" min={1} max={100} value={fortuneScore} onChange={e => setFortuneScore(e.target.value)} placeholder="점수" style={fieldInp} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#7C3AED' }}>적중도 (1~100)</label>
              <input type="number" min={1} max={100} value={accuracyScore} onChange={e => setAccuracyScore(e.target.value)} placeholder="실제로 맞았는지" style={fieldInp} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#7C3AED' }}>관련 인물</label>
              <input type="text" value={relatedPeople} onChange={e => setRelatedPeople(e.target.value)} placeholder="예: 엄마, 직장 동료, 친구" style={fieldInp} />
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED', marginBottom: 8 }}>통합 인물 DB 연결</div>
              <PersonLinkPicker entityType="reading_log" entityId={log.id} compact />
            </div>
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <List size={16} color="#9ca3af" strokeWidth={2} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#787774' }}>[나의 해석 / 코멘트]</span>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#7C3AED' }}>본문</p>
            <FortuneReadingBlockNoteSection
              key={`${log.id}-${notesBootstrapKey}`}
              bootstrapKey={`${log.id}-${notesBootstrapKey}`}
              initialNotes={notes}
              onSerializedChange={json => {
                notesJsonRef.current = json
                setNotes(json)
              }}
            />
            <p style={{ margin: '12px 0 0', fontSize: 11, color: '#9ca3af', lineHeight: 1.55 }}>
              본문에서 <strong style={{ color: '#6b7280' }}>/</strong> 로 블록을 넣거나, <strong style={{ color: '#6b7280' }}>탐색기에서 이미지·영상·파일을 끌어다 놓으면</strong> 삽입됩니다. (로그인 시 클라우드 업로드, 비로그인 시 이 기기에만 보이는 방식으로 저장될 수 있어요.)
            </p>
          </div>

          <p style={{ margin: '16px 0 0', fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>
            질문은 위 제목란에, 해석·본문은 아래 편집기에 적을 수 있어요. 날짜·점수·종류 등은 [기록]에서 수정됩니다.
          </p>
        </div>

        <div
          style={{
            borderTop: '1px solid rgba(0,0,0,0.06)',
            padding: '14px 24px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            flexShrink: 0,
            flexWrap: 'wrap',
            background: '#fff',
          }}
        >
          <button
            type="button"
            onClick={handleDelete}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              borderRadius: 10,
              border: '1px solid rgba(239,68,68,0.35)',
              background: 'rgba(239,68,68,0.06)',
              color: '#dc2626',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Trash2 size={14} /> 삭제
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 20px',
              borderRadius: 10,
              border: 'none',
              background: saved ? '#10b981' : 'linear-gradient(135deg,#7c3aed,#6d28d9)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 800,
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.75 : 1,
            }}
          >
            <Pencil size={14} /> {saving ? '저장 중…' : saved ? '저장됨 ✓' : '수정'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function FortuneRecordsSheet({ readingLogs, decks, onDeleteLog, onPatchLog }: {
  readingLogs: ReadingLogRow[]
  decks: FortuneDeckRow[]
  onDeleteLog: (log: ReadingLogRow) => void
  onPatchLog: (id: string, patch: Parameters<typeof updateFortuneEvent>[1]) => Promise<void>
}) {
  const isMobile = useIsMobile()
  const [filterQuestionType, setFilterQuestionType] = useState<string>('')
  const [filterReadingKind, setFilterReadingKind] = useState<string>('')
  const [filterOutcome, setFilterOutcome] = useState<'good' | 'bad' | ''>('')
  const [filterMinScore, setFilterMinScore] = useState('')
  const [filterMinAccuracy, setFilterMinAccuracy] = useState('')
  const [filterYear, setFilterYear] = useState<string>('')
  const [filterMonth, setFilterMonth] = useState<string>('')
  const [sortBy, setSortBy] = useState<'date' | 'score' | 'accuracy' | 'questionType' | 'readingKind'>('date')
  const [sortAsc, setSortAsc] = useState(false)
  /** 필터·정렬 후 목록에서 화면에 보이는 행 수 (데이터가 많을 때 스크롤/렌더 부담 완화) */
  const [pageSize, setPageSize] = useState<'10' | '30' | '50' | '100' | 'all'>('30')

  const allYears = useMemo(() => {
    const set = new Set<number>()
    for (const r of readingLogs) {
      const ed = r.event_date ?? r.created_at?.slice(0, 10)
      if (ed) set.add(parseInt(ed.slice(0, 4), 10))
    }
    return Array.from(set).sort((a, b) => b - a)
  }, [readingLogs])

  const allQuestionTypes = useMemo(() => {
    const set = new Set<string>(DEFAULT_QUESTION_TYPES)
    for (const r of readingLogs) {
      const t = r.fortune_type?.trim()
      if (t && t !== SOLUTION_BOOK_TITLE) set.add(t)
    }
    return Array.from(set).sort()
  }, [readingLogs])

  const allReadingKinds = useMemo(() => {
    const base = mergeReadingKindOptions(decks)
    const set = new Set<string>(base)
    for (const r of readingLogs) {
      const k = r.reading_kind?.trim()
      if (k) set.add(k)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [readingLogs, decks])

  const getLogDate = (r: ReadingLogRow) => r.event_date ?? r.created_at?.slice(0, 10) ?? ''

  const filteredAndSorted = useMemo(() => {
    let list = [...readingLogs]
    if (filterQuestionType) list = list.filter(r => (r.fortune_type ?? '') === filterQuestionType)
    if (filterReadingKind) list = list.filter(r => (r.reading_kind ?? '') === filterReadingKind)
    if (filterOutcome) list = list.filter(r => r.fortune_outcome === filterOutcome)
    const minScore = filterMinScore === '' ? 0 : Math.max(0, parseInt(filterMinScore, 10) || 0)
    if (minScore > 0) list = list.filter(r => (r.fortune_score ?? 0) >= minScore)
    const minAcc = filterMinAccuracy === '' ? 0 : Math.max(0, parseInt(filterMinAccuracy, 10) || 0)
    if (minAcc > 0) list = list.filter(r => (r.accuracy_score ?? 0) >= minAcc)
    if (filterYear) list = list.filter(r => getLogDate(r).slice(0, 4) === filterYear)
    if (filterMonth) list = list.filter(r => getLogDate(r).slice(5, 7) === filterMonth)
    list.sort((a, b) => {
      const mul = sortAsc ? 1 : -1
      if (sortBy === 'date') return mul * ((getLogDate(a) || '9999').localeCompare(getLogDate(b) || '9999'))
      if (sortBy === 'score') return mul * ((a.fortune_score ?? 0) - (b.fortune_score ?? 0))
      if (sortBy === 'accuracy') return mul * ((a.accuracy_score ?? 0) - (b.accuracy_score ?? 0))
      if (sortBy === 'questionType') return mul * ((a.fortune_type ?? '').localeCompare(b.fortune_type ?? ''))
      if (sortBy === 'readingKind') return mul * ((a.reading_kind ?? '').localeCompare(b.reading_kind ?? ''))
      return 0
    })
    return list
  }, [readingLogs, filterQuestionType, filterReadingKind, filterOutcome, filterMinScore, filterMinAccuracy, filterYear, filterMonth, sortBy, sortAsc])

  const displayedRows = useMemo(() => {
    if (pageSize === 'all') return filteredAndSorted
    const n = parseInt(pageSize, 10)
    return filteredAndSorted.slice(0, n)
  }, [filteredAndSorted, pageSize])

  const totalFiltered = filteredAndSorted.length
  const shownCount = displayedRows.length

  const readingKindOptions = useMemo(() => mergeReadingKindOptions(decks), [decks])

  /** 표 행과 같은 톤 — 테두리 없음(클릭·포커스 시 편집) */
  const cellInp: React.CSSProperties = {
    width: '100%',
    maxWidth: '100%',
    padding: '2px 2px',
    borderRadius: 2,
    border: 'none',
    fontSize: 11,
    background: 'transparent',
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: 'inherit',
    color: 'inherit',
    boxShadow: 'none',
  }

  const hasFilters = filterQuestionType || filterReadingKind || filterOutcome || filterMinScore || filterMinAccuracy || filterYear || filterMonth
  function clearFilters() {
    setFilterQuestionType('')
    setFilterReadingKind('')
    setFilterOutcome('')
    setFilterMinScore('')
    setFilterMinAccuracy('')
    setFilterYear('')
    setFilterMonth('')
  }

  return (
    <div style={{ marginTop: '24px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
      <h2 style={{ margin: 0, padding: '14px 16px', fontSize: '12px', fontWeight: 800, color: '#37352F', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        📋 점괘 아카이브 리스트
      </h2>
      <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#F8F8F6' }}>
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '12px', background: '#fff' }} title="연도 필터">
          <option value="">연도</option>
          {allYears.map(y => <option key={y} value={String(y)}>{y}년</option>)}
        </select>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '12px', background: '#fff' }} title="월 필터">
          <option value="">월</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => <option key={m} value={String(m).padStart(2, '0')}>{m}월</option>)}
        </select>
        <select value={filterReadingKind} onChange={e => setFilterReadingKind(e.target.value)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '12px', background: '#fff' }} title="점괘종류 (해결의 책, 덱, 사주 등)">
          <option value="">점괘종류</option>
          {allReadingKinds.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterQuestionType} onChange={e => setFilterQuestionType(e.target.value)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '12px', background: '#fff' }} title="질문종류 (직장운 등)">
          <option value="">질문종류</option>
          {allQuestionTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterOutcome} onChange={e => setFilterOutcome(e.target.value as 'good' | 'bad' | '')} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '12px', background: '#fff' }}>
          <option value="">운세 전체</option>
          <option value="good">좋은 운세</option>
          <option value="bad">나쁜 운세</option>
        </select>
        <input type="number" min={1} max={100} value={filterMinScore} onChange={e => setFilterMinScore(e.target.value)} placeholder="점수 이상"
          style={{ width: '80px', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '12px', background: '#fff' }}
        />
        <input type="number" min={1} max={100} value={filterMinAccuracy} onChange={e => setFilterMinAccuracy(e.target.value)} placeholder="적중도 이상"
          style={{ width: '90px', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '12px', background: '#fff' }}
        />
        <span style={{ fontSize: '11px', color: '#787774', marginLeft: '4px' }}>정렬:</span>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '12px', background: '#fff' }}>
          <option value="date">날짜순</option>
          <option value="score">점수순</option>
          <option value="accuracy">적중도순</option>
          <option value="questionType">질문종류순</option>
          <option value="readingKind">점괘종류순</option>
        </select>
        <button onClick={() => setSortAsc(a => !a)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.08)', color: '#7C3AED', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
          {sortAsc ? '↑ 오름차순' : '↓ 내림차순'}
        </button>
        <span style={{ fontSize: '11px', color: '#787774', marginLeft: '4px' }}>표시:</span>
        <select value={pageSize} onChange={e => setPageSize(e.target.value as typeof pageSize)} title="현재 필터·정렬 결과 중 몇 건까지 표시할지"
          style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '12px', background: '#fff' }}>
          <option value="10">10개</option>
          <option value="30">30개</option>
          <option value="50">50개</option>
          <option value="100">100개</option>
          <option value="all">전부</option>
        </select>
        {hasFilters && (
          <button onClick={clearFilters} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.15)', background: '#fff', fontSize: '11px', color: '#787774', cursor: 'pointer' }}>필터 초기화</button>
        )}
      </div>
      {totalFiltered > 0 && (
        <div style={{ padding: '8px 16px', fontSize: '11px', color: '#787774', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#FAFAF9' }}>
          {pageSize === 'all' || shownCount >= totalFiltered
            ? <>필터·정렬 결과 <strong style={{ color: '#37352F' }}>{totalFiltered}</strong>건 전체 표시</>
            : <>필터·정렬 결과 <strong style={{ color: '#37352F' }}>{totalFiltered}</strong>건 중 앞쪽 <strong style={{ color: '#37352F' }}>{shownCount}</strong>건만 표시 · 더 보려면 위 &quot;표시&quot;에서 개수를 늘리거나 &quot;전부&quot;를 선택하세요</>}
        </div>
      )}
      <div style={{ overflowX: 'auto', maxHeight: isMobile ? '400px' : '500px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '10%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '28%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '6%' }} />
          </colgroup>
          <thead style={{ position: 'sticky', top: 0, background: '#F4F4F2', zIndex: 1 }}>
            <tr>
              <th style={{ padding: '8px 4px', textAlign: 'left', fontWeight: 700, color: '#7C3AED', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>날짜</th>
              <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 700, color: '#7C3AED', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>점괘종류</th>
              <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 700, color: '#7C3AED', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>질문종류</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#7C3AED', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>질문/타이틀</th>
              <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 700, color: '#7C3AED', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>카드</th>
              <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: '#7C3AED', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>점수</th>
              <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: '#7C3AED', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>운세 내용</th>
              <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: '#7C3AED', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>적중도</th>
              <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 700, color: '#7C3AED', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>관련 인물</th>
              <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: '#7C3AED', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: '32px 16px', textAlign: 'center', color: '#9B9A97', fontSize: '13px' }}>기록이 없습니다. 위 필터를 조정해보세요.</td></tr>
            ) : (
              displayedRows.map(log => {
                const isSolutionBook = log.reading_kind === SOLUTION_BOOK_TITLE
                const drawn = log.drawn_cards ?? []
                return (
                  <tr key={log.id} style={{
                    borderBottom: '1px solid rgba(0,0,0,0.05)',
                    backgroundColor: isSolutionBook ? 'rgba(74, 20, 18, 0.05)' : undefined,
                    boxShadow: isSolutionBook ? 'inset 3px 0 0 rgba(139, 55, 48, 0.55)' : undefined,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = isSolutionBook ? 'rgba(74, 20, 18, 0.1)' : 'rgba(124,58,237,0.04)' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = isSolutionBook ? 'rgba(74, 20, 18, 0.05)' : 'transparent' }}
                  >
                    <td style={{ padding: '8px 4px', verticalAlign: 'top' }} onClick={e => e.stopPropagation()}>
                      <input
                        type="datetime-local"
                        defaultValue={toDatetimeLocal(log.created_at)}
                        key={`${log.id}-dt-${log.created_at}`}
                        style={{ ...cellInp, fontSize: 10, minWidth: 0, maxWidth: '100%', color: isSolutionBook ? '#5c3d3a' : '#787774' }}
                        onBlur={e => {
                          const v = e.target.value
                          if (!v) return
                          const iso = new Date(v).toISOString()
                          if (iso !== log.created_at) void onPatchLog(log.id, { created_at: iso })
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 6px', verticalAlign: 'top' }} onClick={e => e.stopPropagation()}>
                      <input
                        list={`reading-kinds-${log.id}`}
                        defaultValue={log.reading_kind?.trim() ?? ''}
                        key={`${log.id}-rk-${log.reading_kind ?? ''}`}
                        placeholder="점괘 종류"
                        style={{ ...cellInp, fontSize: 11, color: isSolutionBook ? '#6b2f2a' : '#37352F', fontWeight: isSolutionBook ? 700 : undefined }}
                        onBlur={e => {
                          const v = e.target.value.trim()
                          const next = v || null
                          if ((log.reading_kind ?? '') !== (next ?? '')) void onPatchLog(log.id, { reading_kind: next })
                        }}
                      />
                      <datalist id={`reading-kinds-${log.id}`}>{readingKindOptions.map(t => <option key={t} value={t} />)}</datalist>
                    </td>
                    <td style={{ padding: '8px 6px', verticalAlign: 'top' }} onClick={e => e.stopPropagation()}>
                      <input
                        list={`question-types-${log.id}`}
                        defaultValue={log.fortune_type?.trim() ?? ''}
                        key={`${log.id}-ft-${log.fortune_type ?? ''}`}
                        placeholder="질문 종류"
                        style={{ ...cellInp, fontSize: 11 }}
                        onBlur={e => {
                          const v = e.target.value.trim()
                          const next = v || null
                          if ((log.fortune_type ?? '') !== (next ?? '')) void onPatchLog(log.id, { fortune_type: next })
                        }}
                      />
                      <datalist id={`question-types-${log.id}`}>{DEFAULT_QUESTION_TYPES.map(t => <option key={t} value={t} />)}</datalist>
                    </td>
                    <td style={{ padding: '8px 10px', verticalAlign: 'top', minWidth: 0 }}>
                      <Link
                        to={`/fortune?log=${log.id}`}
                        title={log.question}
                        style={{
                          color: isSolutionBook ? '#5c241f' : '#37352F',
                          cursor: 'pointer',
                          textDecoration: 'none',
                          fontWeight: isSolutionBook ? 600 : undefined,
                          lineHeight: 1.55,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                          minWidth: 0,
                        }}
                      >
                        {log.question}
                      </Link>
                    </td>
                    <td style={{ padding: '8px 8px', verticalAlign: 'top', minWidth: 0 }}>
                      {drawn.length > 0 ? (
                        isSolutionBook ? (
                          <span
                            style={{
                              display: 'block',
                              fontSize: '11px',
                              lineHeight: 1.45,
                              color: '#3d1814',
                              background: 'linear-gradient(145deg, #fef5e8 0%, #f8e8d8 100%)',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: '1px solid rgba(110, 45, 40, 0.22)',
                              borderLeft: '3px solid rgba(160, 65, 55, 0.65)',
                              whiteSpace: 'normal',
                              wordBreak: 'keep-all',
                            }}
                            title={drawn[0]?.name_ko}
                          >
                            <span style={{ marginRight: '6px' }}>{drawn[0]?.emoji ?? '📖'}</span>
                            {drawn[0]?.name_ko}
                          </span>
                        ) : (
                          <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                            {drawn.slice(0, 4).map((c, i) => <span key={i} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(124,58,237,0.1)', color: '#7C3AED', whiteSpace: 'nowrap' }}>{c.emoji} {c.name_ko}</span>)}
                            {drawn.length > 4 && <span style={{ fontSize: '10px', color: '#787774' }}>+{drawn.length - 4}</span>}
                          </span>
                        )
                      ) : '-'}
                    </td>
                    <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'top' }} onClick={e => e.stopPropagation()}>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        defaultValue={log.fortune_score != null ? String(log.fortune_score) : ''}
                        key={`${log.id}-fs-${log.fortune_score ?? 'x'}`}
                        placeholder="—"
                        style={{ ...cellInp, fontSize: 12, textAlign: 'center', width: 40, maxWidth: 48, padding: '2px 0' }}
                        onBlur={e => {
                          const raw = e.target.value.trim()
                          if (raw === '') {
                            if (log.fortune_score != null) void onPatchLog(log.id, { fortune_score: null })
                            return
                          }
                          const parsed = parseInt(raw, 10)
                          if (Number.isNaN(parsed)) return
                          const n = Math.min(100, Math.max(1, parsed))
                          if (n !== log.fortune_score) void onPatchLog(log.id, { fortune_score: n })
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'top' }} onClick={e => e.stopPropagation()}>
                      <select
                        value={log.fortune_outcome ?? ''}
                        style={{ ...cellInp, cursor: 'pointer', padding: '1px 0', fontSize: 11 }}
                        onChange={e => {
                          const v = e.target.value as '' | 'good' | 'bad'
                          const next = v === 'good' || v === 'bad' ? v : null
                          void onPatchLog(log.id, { fortune_outcome: next })
                        }}
                      >
                        <option value="">—</option>
                        <option value="good">좋음</option>
                        <option value="bad">나쁨</option>
                      </select>
                    </td>
                    <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'top' }} onClick={e => e.stopPropagation()}>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        defaultValue={log.accuracy_score != null ? String(log.accuracy_score) : ''}
                        key={`${log.id}-as-${log.accuracy_score ?? 'x'}`}
                        placeholder="—"
                        style={{ ...cellInp, textAlign: 'center', width: 40, maxWidth: 48, padding: '2px 0' }}
                        onBlur={e => {
                          const raw = e.target.value.trim()
                          if (raw === '') {
                            if (log.accuracy_score != null) void onPatchLog(log.id, { accuracy_score: null })
                            return
                          }
                          const parsed = parseInt(raw, 10)
                          if (Number.isNaN(parsed)) return
                          const n = Math.min(100, Math.max(1, parsed))
                          if (n !== log.accuracy_score) void onPatchLog(log.id, { accuracy_score: n })
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 6px', verticalAlign: 'top' }} onClick={e => e.stopPropagation()}>
                      <input
                        defaultValue={log.related_people ?? ''}
                        key={`${log.id}-rp-${log.related_people ?? ''}`}
                        placeholder="관련 인물"
                        style={{ ...cellInp, fontSize: 10 }}
                        onBlur={e => {
                          const v = e.target.value.trim()
                          const next = v || null
                          if ((log.related_people ?? '') !== (next ?? '')) void onPatchLog(log.id, { related_people: next })
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                      <Link to={`/fortune?log=${log.id}`} style={{ padding: '4px', borderRadius: '6px', border: '1px solid rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.08)', color: '#7C3AED', cursor: 'pointer', fontSize: '10px', marginRight: '4px', textDecoration: 'none', display: 'inline-block' }} title="수정">✏️</Link>
                      <button type="button" onClick={() => onDeleteLog(log)} title="삭제" style={{ padding: '4px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: '10px' }}>🗑️</button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FortuneHub({ decks, onSelectDeck, onDecksChange, onReadingSaved }: {
  decks: FortuneDeckRow[]
  onSelectDeck: (d: FortuneDeckRow) => void
  onDecksChange: (decks: FortuneDeckRow[]) => void
  onReadingSaved?: () => void
}) {
  const isMobile = useIsMobile()
  const [decksMenuOpen, setDecksMenuOpen] = useState<string | null>(null)
  /** null=모달 닫힘, 'add'=추가 모드, FortuneDeckRow=수정 모드 */
  const [deckFormState, setDeckFormState] = useState<null | 'add' | FortuneDeckRow>(null)
  const [fortuneFeedback, setFortuneFeedback] = useState('')
  const [savingFeedback, setSavingFeedback] = useState(false)
  const [savedFeedback, setSavedFeedback] = useState(false)
  const [readingLogs, setReadingLogs] = useState<ReadingLogRow[]>([])
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const logIdFromUrl = searchParams.get('log')
  const [detailLog, setDetailLog] = useState<ReadingLogRow | null>(null)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null)
  const [solutionBookOpen, setSolutionBookOpen] = useState(false)
  useEffect(() => {
    if (logIdFromUrl && readingLogs.length) {
      const found = readingLogs.find(r => r.id === logIdFromUrl)
      if (found) setDetailLog(found)
    }
  }, [logIdFromUrl, readingLogs])

  const filteredReadingLogs = useMemo(() => {
    if (!selectedCalendarDate) return readingLogs
    const sel = selectedCalendarDate
    return readingLogs.filter(r => (r.event_date ?? toYMD(new Date(r.created_at))) === sel)
  }, [readingLogs, selectedCalendarDate])

  useEffect(() => {
    fetchFortuneEvents().then(setReadingLogs)
  }, [])

  useEffect(() => {
    if (!decksMenuOpen) return
    const close = () => setDecksMenuOpen(null)
    const id = setTimeout(() => document.addEventListener('click', close), 0)
    return () => { clearTimeout(id); document.removeEventListener('click', close) }
  }, [decksMenuOpen])

  const displayDecks = decks.length > 0 ? decks : [FALLBACK_DECK]
  /** 덱 카드·[+ 덱 추가] 공통 가로(추가 덱도 동일) */
  const oracleDeckCardW = isMobile ? 100 : 120

  const todaySolar = Solar.fromDate(new Date())
  const lunar = todaySolar.getLunar()
  const eightChar = lunar.getEightChar()
  const todayGanzhi = `${eightChar.getYear()}년 ${eightChar.getMonth()}월 ${eightChar.getDay()}일`
  const solarDateStr = `${todaySolar.getYear()}년 ${todaySolar.getMonth()}월 ${todaySolar.getDay()}일`

  async function handleDeleteDeck(d: FortuneDeckRow) {
    if (d.id === '__fallback__') return
    if (!window.confirm(`"${d.name}" 덱을 정말 삭제하시겠습니까?`)) return
    const ok = await deleteFortuneDeck(d.id)
    if (ok) {
      onDecksChange(decks.filter(x => x.id !== d.id))
      setDecksMenuOpen(null)
    }
  }

  async function handleDeleteReading(log: ReadingLogRow) {
    if (!window.confirm('이 기록을 정말 삭제하시겠습니까?')) return
    const ok = await deleteFortuneEvent(log.id)
    if (ok) {
      setReadingLogs(prev => prev.filter(r => r.id !== log.id))
      if (detailLog?.id === log.id) setDetailLog(null)
      onReadingSaved?.()
    }
  }

  const handlePatchReadingLog = useCallback(async (id: string, patch: Parameters<typeof updateFortuneEvent>[1]) => {
    const updated = await updateFortuneEvent(id, patch)
    if (updated) {
      setReadingLogs(prev => prev.map(r => (r.id === id ? updated : r)))
      setDetailLog(d => (d?.id === id ? updated : d))
      onReadingSaved?.()
    }
  }, [onReadingSaved])

  async function saveFortuneFeedback() {
    const text = fortuneFeedback.trim()
    if (!text) return
    setSavingFeedback(true)
    const todayStr = toYMD(new Date())
    const row = await insertFortuneFeedback(text, todayStr)
    setSavingFeedback(false)
    if (row) {
      fetchFortuneEvents().then(setReadingLogs)
      setFortuneFeedback('')
      setSavedFeedback(true)
      setTimeout(() => setSavedFeedback(false), 2000)
      onReadingSaved?.()
    }
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: isMobile ? '12px' : '16px' }}>
      <div style={{ marginBottom: '12px' }}>
        <span style={{ fontSize: '9px', fontWeight: 800, color: '#7C3AED', letterSpacing: '0.15em', textTransform: 'uppercase' }}>🔮 Fortune</span>
        <h1 style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 900, color: '#37352F' }}>Fortune 메인 대시보드</h1>
      </div>

      {/* ── TOP: 캘린더 (좌 30%) + 통합 기록 리스트 (우 70%), 고정 높이 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '3fr 7fr', gap: '16px', marginBottom: '16px', alignItems: 'stretch' }}>
        <div style={{ padding: '12px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 800, color: '#7C3AED' }}>📅 운세 기록</h3>
          <FortuneReadingCalendar
            readingLogs={readingLogs}
            selectedDate={selectedCalendarDate}
            onSelectDate={setSelectedCalendarDate}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', height: isMobile ? 'auto' : '250px', borderRadius: '12px', background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <h3 style={{ margin: 0, padding: '12px 16px 8px', fontSize: '11px', fontWeight: 800, color: '#37352F', flexShrink: 0 }}>통합 운세 & 점괘 기록</h3>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px', minHeight: 0 }}>
            {filteredReadingLogs.length === 0 ? (
              <p style={{ margin: 0, fontSize: '12px', color: '#9B9A97', padding: '24px 8px', textAlign: 'center' }}>
                {selectedCalendarDate ? '선택한 날짜에 기록이 없습니다.' : '아직 기록이 없습니다.'}
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {filteredReadingLogs.map(log => {
                  const d = new Date(log.created_at)
                  const dateStr = d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                  const timeStr = d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true })
                  const drawn = log.drawn_cards ?? []
                  const hasCards = drawn.length > 0
                  const preview = log.question.length > 45 ? log.question.slice(0, 45) + '…' : log.question
                  const notesPlain = blockNoteToPlainPreview(log.notes ?? '', 120)
                  const notesPreview = notesPlain.length > 50 ? notesPlain.slice(0, 50) + '…' : notesPlain
                  return (
                    <li
                      key={log.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        backgroundColor: '#F8F8F6',
                        border: '1px solid rgba(0,0,0,0.06)',
                        fontSize: '12px',
                        color: '#37352F',
                        lineHeight: 1.4,
                        transition: 'background-color 0.2s, border-color 0.2s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(124,58,237,0.06)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)' }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F8F8F6'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)' }}
                    >
                      <span style={{ fontSize: '14px', flexShrink: 0 }}>{hasCards ? '🃏' : '📝'}</span>
                      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer', padding: '1px 0' }} onClick={() => setDetailLog(log)}>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', rowGap: '4px' }}>
                          <span style={{ fontWeight: 700, color: '#7C3AED', marginRight: '2px', flexShrink: 0 }}>[{dateStr} {timeStr}]</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 auto', minWidth: 0 }}>{preview}</span>
                          {drawn.length > 0 && (
                            <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', flexShrink: 0 }}>
                              {drawn.map((c, i) => (
                                <span key={i} style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  padding: '2px 8px', borderRadius: '6px',
                                  backgroundColor: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)',
                                  fontSize: '10px', fontWeight: 600, color: '#7C3AED',
                                }}>
                                  <span style={{ fontSize: '11px' }}>{c.emoji}</span>
                                  {c.name_ko}
                                </span>
                              ))}
                            </span>
                          )}
                        </div>
                        {notesPreview && (
                          <div style={{ marginTop: '2px', fontSize: '11px', color: '#9B9A97', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notesPreview}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                        <button onClick={e => { e.stopPropagation(); setDetailLog(log) }} title="수정" style={{ padding: '4px', borderRadius: '6px', border: '1px solid rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.08)', color: '#7C3AED', cursor: 'pointer', fontSize: '10px' }}>✏️</button>
                        <button onClick={e => { e.stopPropagation(); handleDeleteReading(log) }} title="삭제" style={{ padding: '4px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: '10px' }}>🗑️</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ── MIDDLE: 만세력 위젯 & 퀵링크 (좌) + 운세 피드백 입력창 (우) ── 얇은 바 형태 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(99,102,241,0.06) 100%)', border: '1px solid rgba(124,58,237,0.15)' }}>
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '9px', fontWeight: 700, color: '#9B9A97' }}>{solarDateStr}</p>
            <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: 800, color: '#37352F' }}>🔮 {todayGanzhi}</p>
          </div>
          <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            {FORTUNE_QUICK_LINKS.map(link => (
              <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.08)', backgroundColor: '#F4F4F2', color: '#37352F', fontSize: '11px', fontWeight: 500, textDecoration: 'none' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.08)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F4F4F2'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)' }}
              >
                <span>{link.emoji}</span>{link.title}
              </a>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <textarea value={fortuneFeedback} onChange={e => setFortuneFeedback(e.target.value)}
            placeholder="운세 내용…"
            style={{ flex: 1, minHeight: '48px', maxHeight: '64px', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', backgroundColor: '#F8F8F6', fontSize: '12px', color: '#37352F', lineHeight: 1.5, resize: 'none', outline: 'none' }}
          />
          <button onClick={saveFortuneFeedback} disabled={savingFeedback || !fortuneFeedback.trim()} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: savedFeedback ? '#34d399' : '#6366f1', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: savingFeedback ? 'default' : 'pointer', opacity: savingFeedback ? 0.7 : 1, flexShrink: 0 }}>{savingFeedback ? '저장 중…' : savedFeedback ? '저장됨 ✓' : '저장'}</button>
        </div>
      </div>

      {/* ── BOTTOM: 해결의 책 | (구분선) | 나의 오라클 덱 ── */}
      <div>
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'stretch',
            gap: 0,
          }}
        >
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '12px', fontWeight: 800, color: '#37352F' }}>해결의 책</h2>
            <SolutionBookDeckCard isMobile={isMobile} onOpen={() => setSolutionBookOpen(true)} />
          </div>
          <div
            role="separator"
            aria-orientation={isMobile ? 'horizontal' : 'vertical'}
            style={
              isMobile
                ? {
                    width: '100%',
                    height: '1px',
                    margin: '14px 0',
                    flexShrink: 0,
                    background: 'linear-gradient(90deg, transparent 0%, rgba(124,58,237,0.2) 20%, rgba(55,53,47,0.12) 50%, rgba(124,58,237,0.2) 80%, transparent 100%)',
                  }
                : {
                    width: '1px',
                    alignSelf: 'stretch',
                    minHeight: '168px',
                    margin: '0 18px',
                    flexShrink: 0,
                    background: 'linear-gradient(180deg, transparent 0%, rgba(124,58,237,0.22) 12%, rgba(55,53,47,0.14) 50%, rgba(124,58,237,0.22) 88%, transparent 100%)',
                  }
            }
          />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '12px', fontWeight: 800, color: '#37352F' }}>나의 오라클 덱</h2>
            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', flexWrap: isMobile ? 'wrap' : 'nowrap', alignItems: 'stretch' }}>
          {displayDecks.map(d => (
            <div
              key={d.id}
              style={{
                position: 'relative',
                flexShrink: 0,
                width: `${oracleDeckCardW}px`,
                minWidth: `${oracleDeckCardW}px`,
                height: `${SOLUTION_BOOK_DECK_CARD_HEIGHT_PX}px`,
                minHeight: `${SOLUTION_BOOK_DECK_CARD_HEIGHT_PX}px`,
                maxHeight: `${SOLUTION_BOOK_DECK_CARD_HEIGHT_PX}px`,
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid rgba(124,58,237,0.2)',
                background: 'linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(99,102,241,0.04) 100%)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(124,58,237,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div
                onClick={() => onSelectDeck(d)}
                style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}
              >
                {d.id !== '__fallback__' && (
                  <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 2 }}>
                    <button
                      onClick={e => { e.stopPropagation(); setDecksMenuOpen(prev => prev === d.id ? null : d.id) }}
                      style={{ padding: '4px', borderRadius: '6px', border: 'none', background: 'rgba(0,0,0,0.06)', color: '#787774', cursor: 'pointer' }}
                    >
                      <MoreVertical size={14} />
                    </button>
                    {decksMenuOpen === d.id && (
                      <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: '#fff', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', padding: '4px 0', minWidth: '80px' }}>
                        <button onClick={e => { e.stopPropagation(); setDeckFormState(d); setDecksMenuOpen(null) }} style={{ display: 'block', width: '100%', padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px', textAlign: 'left', color: '#37352F' }}>수정</button>
                        <button onClick={e => { e.stopPropagation(); handleDeleteDeck(d) }} style={{ display: 'block', width: '100%', padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px', textAlign: 'left', color: '#ef4444' }}>삭제</button>
                      </div>
                    )}
                  </div>
                )}
                {d.cover_image_url ? (
                  <div style={{ width: '100%', flex: '1 1 0', minHeight: '72px', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px', background: 'rgba(0,0,0,0.06)' }}>
                    <img src={d.cover_image_url} alt={d.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  </div>
                ) : (
                  <div style={{ width: '100%', flex: '1 1 0', minHeight: '72px', borderRadius: '8px', marginBottom: '8px', background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(99,102,241,0.1) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>🃏</div>
                )}
                <h3 style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 800, color: '#37352F', flexShrink: 0 }}>{d.name}</h3>
                {d.description && <p style={{ margin: 0, fontSize: '10px', color: '#787774', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', flexShrink: 0 }}>{d.description}</p>}
                <ChevronRight size={14} color="#7C3AED" style={{ position: 'absolute', bottom: '12px', right: '12px' }} />
              </div>
            </div>
          ))}
          <button
            onClick={() => {
              setDeckFormState('add')
            }}
            style={{
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '16px 20px',
              borderRadius: '12px',
              border: '2px dashed rgba(124,58,237,0.4)',
              background: 'rgba(124,58,237,0.04)',
              color: '#7C3AED',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              width: `${oracleDeckCardW}px`,
              minWidth: `${oracleDeckCardW}px`,
              height: `${SOLUTION_BOOK_DECK_CARD_HEIGHT_PX}px`,
              minHeight: `${SOLUTION_BOOK_DECK_CARD_HEIGHT_PX}px`,
              maxHeight: `${SOLUTION_BOOK_DECK_CARD_HEIGHT_PX}px`,
              boxSizing: 'border-box',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(124,58,237,0.08)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.6)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(124,58,237,0.04)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)' }}
          >
            <Plus size={24} />
            [+ 덱 추가]
          </button>
            </div>
          </div>
        </div>
      </div>

      <FortuneRecordsSheet
        readingLogs={readingLogs}
        decks={decks}
        onDeleteLog={handleDeleteReading}
        onPatchLog={handlePatchReadingLog}
      />

      {deckFormState && (
        <DeckFormModal
          editingDeckId={deckFormState === 'add' ? null : deckFormState.id}
          initialName={deckFormState === 'add' ? '' : deckFormState.name}
          initialDescription={deckFormState === 'add' ? '' : (deckFormState.description ?? '')}
          initialCoverImageUrl={deckFormState === 'add' ? '' : (deckFormState.cover_image_url ?? '')}
          onClose={() => setDeckFormState(null)}
          onSaved={updated => {
            if (deckFormState === 'add') {
              onDecksChange([...decks, updated])
            } else {
              onDecksChange(decks.map(d => d.id === updated.id ? updated : d))
            }
            setDeckFormState(null)
          }}
        />
      )}
      {detailLog && (
        <ReadingLogEditModal
          log={detailLog}
          decks={decks}
          onClose={() => { setDetailLog(null); navigate('/fortune', { replace: true }) }}
          onSaved={updated => { setReadingLogs(prev => prev.map(r => r.id === updated.id ? updated : r)); setDetailLog(updated); fetchFortuneEvents().then(setReadingLogs) }}
          onDeleted={() => { setReadingLogs(prev => prev.filter(r => r.id !== detailLog.id)); setDetailLog(null); onReadingSaved?.() }}
        />
      )}
      <SolutionBookModal
        open={solutionBookOpen}
        onClose={() => setSolutionBookOpen(false)}
        onArchived={() => {
          fetchFortuneEvents().then(setReadingLogs)
          onReadingSaved?.()
        }}
      />
    </div>
  )
}

function FortuneSpreadView({
  deck,
  cards,
  onBack,
  onReadingSaved,
}: { deck: FortuneDeckRow; cards: TarotCardDisplay[]; onBack: () => void; onReadingSaved?: () => void }) {
  const isMobile = useIsMobile()
  const today = new Date()
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`

  const [tarotQuestion, setTarotQuestion] = useState('')
  const [shuffledDeck, setShuffledDeck] = useState<TarotCardDisplay[]>(() => shuffleArray(cards))
  const [flippedCards, setFlippedCards] = useState<TarotCardDisplay[]>([])
  const [cardSize, setCardSize] = useState(80)

  useEffect(() => {
    setShuffledDeck(shuffleArray(cards))
    setFlippedCards([])
  }, [deck.id, cards])

  function reshuffleDeck() {
    setShuffledDeck(shuffleArray(cards))
    setFlippedCards([])
  }

  function toggleCard(id: string) {
    const card = shuffledDeck.find(c => c.id === id)
    if (!card) return
    const idx = flippedCards.findIndex(c => c.id === id)
    if (idx >= 0) {
      setFlippedCards(prev => prev.filter(c => c.id !== id))
    } else {
      setFlippedCards(prev => [...prev, card])
    }
  }

  async function handleSaveReading() {
    const question = tarotQuestion.trim()
    if (!question) {
      alert('질문을 입력하고 카드를 먼저 뽑아주세요!')
      return
    }
    if (flippedCards.length === 0) {
      alert('질문을 입력하고 카드를 먼저 뽑아주세요!')
      return
    }
    const drawnCards = flippedCards.map(c => ({ emoji: c.emoji, name_ko: c.name_ko, name_en: c.name_en }))
    const row = await insertFortuneEvent(question, drawnCards, { deckId: deck.id, deckName: deck.name })
    if (row) {
      setFlippedCards([])
      onReadingSaved?.()
    }
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '14px 12px' : '36px 48px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#37352F' }}>
          <ChevronLeft size={16} /> 뒤로 가기 (Fortune 메인으로)
        </button>
        <span style={{ fontSize: '10px', fontWeight: 800, color: '#7C3AED', letterSpacing: '0.2em', textTransform: 'uppercase' }}>🔮 Fortune</span>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#37352F' }}>{deck.name}</h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#787774', fontWeight: 500 }}>{dateStr}</p>
      </div>

      <div style={{
        marginBottom: '24px',
        padding: '24px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(99,102,241,0.04) 100%)',
        border: '1px solid rgba(124,58,237,0.12)',
      }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            value={tarotQuestion}
            onChange={e => setTarotQuestion(e.target.value)}
            placeholder="오늘의 질문이나 주제를 적어보세요..."
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '14px 18px',
              borderRadius: '12px',
              border: '1px solid rgba(0,0,0,0.08)',
              backgroundColor: '#FFFFFF',
              fontSize: '14px',
              color: '#37352F',
              outline: 'none',
            }}
          />
          <button
            onClick={handleSaveReading}
            style={{
              padding: '14px 20px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: '#7C3AED',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 8px rgba(124,58,237,0.3)',
              transition: 'background-color 0.2s, transform 0.15s, box-shadow 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#6D28D9'
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(124,58,237,0.4)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = '#7C3AED'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(124,58,237,0.3)'
            }}
          >
            💾 점괘 기록하기
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#7C3AED' }}>🃏 {cards.length}장 — 카드를 클릭해 뒤집어 보세요</p>
          <button onClick={reshuffleDeck} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(124,58,237,0.3)', backgroundColor: 'rgba(124,58,237,0.08)', color: '#7C3AED', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>다시 섞기</button>
        </div>
        {/* 카드 크기 조절 슬라이더 */}
        <div className="flex flex-col gap-2 mb-4">
          <label className="text-xs font-bold text-[#7C3AED] tracking-wide uppercase flex items-center gap-2">
            <span>카드 크기 조절</span>
            <span className="text-[#9B9A97] font-medium normal-case tracking-normal">({cardSize}px)</span>
          </label>
          <input
            type="range"
            min={80}
            max={350}
            value={cardSize}
            onChange={e => setCardSize(Number(e.target.value))}
            className="fortune-card-size-slider w-full max-w-[280px]"
          />
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`,
            gap: '12px',
          }}
        >
          {shuffledDeck.map(card => (
            <div
              key={card.id}
              onClick={() => toggleCard(card.id)}
              style={{
                aspectRatio: '2/3',
                cursor: 'pointer',
                perspective: '1000px',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  transformStyle: 'preserve-3d',
                  WebkitTransformStyle: 'preserve-3d',
                  transform: flippedCards.some(c => c.id === card.id) ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <TarotCardFace card={card} isFront={false} />
                <TarotCardFace card={card} isFront={true} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function FortunePage({ onReadingSaved }: { onReadingSaved?: () => void }) {
  const isMobile = useIsMobile()
  const [decks, setDecks] = useState<FortuneDeckRow[]>([])
  const [selectedDeck, setSelectedDeck] = useState<FortuneDeckRow | null>(null)
  const [spreadCards, setSpreadCards] = useState<TarotCardDisplay[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetchFortuneDecks().then(d => {
      setDecks(d)
      setLoading(false)
    })
  }, [])

  async function handleSelectDeck(deck: FortuneDeckRow) {
    setLoading(true)
    if (deck.id === '__fallback__') {
      setSpreadCards(TAROT_DECK)
      setSelectedDeck(deck)
    } else {
      const rows = await fetchFortuneCards(deck.id)
      const display = rows.length > 0 ? rows.map(fortuneCardToDisplay) : TAROT_DECK
      setSpreadCards(display)
      setSelectedDeck(deck)
    }
    setLoading(false)
  }

  function handleBack() {
    setSelectedDeck(null)
    setSpreadCards([])
  }

  if (loading && !selectedDeck) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px', textAlign: 'center' }}>
        <p style={{ color: '#787774', fontSize: '14px' }}>덱 목록을 불러오는 중…</p>
      </div>
    )
  }

  if (selectedDeck && spreadCards.length > 0) {
    return (
      <>
        <FortuneSpreadView deck={selectedDeck} cards={spreadCards} onBack={handleBack} onReadingSaved={onReadingSaved} />
      </>
    )
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '14px 12px' : '36px 48px' }}>
      <FortuneHub
        decks={decks}
        onSelectDeck={handleSelectDeck}
        onDecksChange={setDecks}
        onReadingSaved={onReadingSaved}
      />
    </div>
  )
}