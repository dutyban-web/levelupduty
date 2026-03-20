/**
 * Manifestation — 인과(Cause & Effect) 보드
 * Supabase: causes, effects, cause_effect_links
 * 모달은 createPortal로 body에 렌더
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  supabase,
  fetchManifestationCauses,
  fetchManifestationEffects,
  fetchManifestationLinks,
  insertManifestCause,
  insertManifestEffect,
  deleteManifestCause,
  deleteManifestEffect,
  updateManifestCause,
  updateManifestEffect,
  replaceManifestLinksForCause,
  type ManifestCauseRow,
  type ManifestEffectRow,
  type ManifestInsertResult,
  type ManifestLinkPair,
} from './supabase'
import { ManifestNotionNotePanel } from './ManifestNotionNotePanel'
import { blockNoteToPlainPreview, collectTagsForEntities, entityHasNoteTag } from './manifestNoteUtils'
import type { ManifestNoteKind } from './manifestNoteUtils'

export type { ManifestNoteKind } from './manifestNoteUtils'
import { Plus, Trash2, Sparkles, Link2, Pencil } from 'lucide-react'

function formatManifestInsertFailure(res: Extract<ManifestInsertResult<ManifestCauseRow | ManifestEffectRow>, { ok: false }>): string {
  if (res.reason === 'no_supabase' || res.reason === 'no_user') return res.message
  const e = res.error
  return [e.message, e.details, e.hint].filter(Boolean).join(' — ')
}

type ManifestLinkAxisRow = { id: string; title: string; description?: string | null }

/**
 * 명시 연결 편집 표의 행·열 라벨: 카드 **세부 제목**(`description`) 우선, 비어 있으면 상위분류(`title`).
 * 같은 제목·같은 상위가 여러 개면 `제목 · 상위분류`, 그래도 겹치면 id 앞 6자로 구분.
 */
function buildLinkAxisLabels(rows: ManifestLinkAxisRow[]): Map<string, string> {
  const primary = (r: ManifestLinkAxisRow) => {
    const d = (r.description ?? '').trim()
    return d || (r.title ?? '').trim() || '(제목 없음)'
  }
  const out = new Map<string, string>()
  const primaryGroups = new Map<string, ManifestLinkAxisRow[]>()
  for (const r of rows) {
    const p = primary(r)
    if (!primaryGroups.has(p)) primaryGroups.set(p, [])
    primaryGroups.get(p)!.push(r)
  }
  for (const list of primaryGroups.values()) {
    if (list.length === 1) {
      out.set(list[0].id, primary(list[0]))
      continue
    }
    const byTitle = new Map<string, ManifestLinkAxisRow[]>()
    for (const r of list) {
      const s = (r.title ?? '').trim() || '—'
      if (!byTitle.has(s)) byTitle.set(s, [])
      byTitle.get(s)!.push(r)
    }
    for (const sub of byTitle.values()) {
      if (sub.length === 1) {
        const r = sub[0]
        const t = (r.title ?? '').trim()
        out.set(r.id, t ? `${primary(r)} · ${t}` : primary(r))
      } else {
        for (const r of sub) {
          const t = (r.title ?? '').trim()
          out.set(r.id, t ? `${primary(r)} · ${t} · ${r.id.slice(0, 6)}` : `${primary(r)} · ${r.id.slice(0, 6)}`)
        }
      }
    }
  }
  return out
}

const LOCAL_KEY = 'manifestation_local_v1'
/** 이미 이뤄진 결과 — 원인/결과와 별도 로컬 키 (추후 Supabase 연동 가능) */
const ACHIEVED_KEY = 'manifestation_achieved_v1'

export type AchievedManifestRow = {
  id: string
  title: string
  description: string
  icon: string
  sort_order: number
}

function loadAchieved(): AchievedManifestRow[] {
  try {
    const raw = localStorage.getItem(ACHIEVED_KEY)
    if (raw) {
      const p = JSON.parse(raw) as AchievedManifestRow[]
      if (Array.isArray(p)) return p
    }
  } catch { /* ignore */ }
  return []
}

function persistAchieved(rows: AchievedManifestRow[]) {
  try {
    localStorage.setItem(ACHIEVED_KEY, JSON.stringify(rows))
  } catch { /* ignore */ }
}

type LocalBundle = {
  causes: ManifestCauseRow[]
  effects: ManifestEffectRow[]
  links: ManifestLinkPair[]
}

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function loadLocal(): LocalBundle {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) {
      const p = JSON.parse(raw) as LocalBundle
      if (p.causes && p.effects) {
        return {
          causes: p.causes,
          effects: p.effects,
          links: Array.isArray(p.links) ? p.links : [],
        }
      }
    }
  } catch { /* ignore */ }
  return {
    causes: [
      { id: newId(), title: '건강', description: '10000보 걷기', icon: '🚶', sort_order: 0 },
      { id: newId(), title: '건강', description: '간헐적 단식(16:8)', icon: '🍽️', sort_order: 1 },
    ],
    effects: [
      { id: newId(), title: '자기계발', description: '잘생겨짐', icon: '✨', sort_order: 0 },
      { id: newId(), title: '행운', description: '작은 기적들이 겹침', icon: '🍀', sort_order: 1 },
    ],
    links: [],
  }
}

function saveLocal(b: LocalBundle) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(b))
  } catch { /* ignore */ }
}

async function getHasSession(): Promise<boolean> {
  if (!supabase) return false
  const { data: { session } } = await supabase.auth.getSession()
  return Boolean(session?.user)
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

/** 명시 연결 제외 후 1~3개 무작위 (명시 연결이 없는 카드 전용) */
function pickRandomIds(allIds: string[], exclude: Set<string>, maxN: number): string[] {
  const pool = allIds.filter(id => !exclude.has(id))
  shuffleInPlace(pool)
  const n = Math.min(maxN, Math.floor(Math.random() * 3) + 1, pool.length)
  return pool.slice(0, n)
}

/** 명시 연결 제외 후 0~3개 무작위 (연결된 카드 외 추가 강조) */
function pickRandomIdsZeroToThree(allIds: string[], exclude: Set<string>): string[] {
  const pool = allIds.filter(id => !exclude.has(id))
  shuffleInPlace(pool)
  const n = Math.min(Math.floor(Math.random() * 4), pool.length)
  return pool.slice(0, n)
}

/** 초밀도 그리드: 2 → 3 → 4 → 5열 (데스크탑 촘촘) */
function useGridCols(): number {
  const [cols, setCols] = useState(3)
  useEffect(() => {
    const apply = () => {
      const w = typeof window !== 'undefined' ? window.innerWidth : 900
      if (w >= 1024) setCols(5)
      else if (w >= 768) setCols(4)
      else if (w >= 480) setCols(3)
      else setCols(2)
    }
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [])
  return cols
}

/** 원인/결과는 반쪽 열, 이미 이뤄진 결과는 전체 너비 — 같은 카드 크기를 위해 넓은 레이아웃에서만 열 2배 */
function useWideTwoPanelLayout(): boolean {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const apply = () => setWide(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return wide
}

const MODAL_Z = 50000

function ModalPortal({
  open,
  title,
  children,
  onClose,
  onSave,
  saving,
  saveLabel = '저장',
}: {
  open: boolean
  title: string
  children: React.ReactNode
  onClose: () => void
  onSave: () => void
  saving: boolean
  saveLabel?: string
}) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: MODAL_Z,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}
    >
      <div
        style={{
          width: 'min(440px, 100%)',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#fff',
          borderRadius: 16,
          padding: 22,
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 900, color: '#37352F' }}>{title}</h2>
        {children}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', cursor: saving ? 'wait' : 'pointer', fontWeight: 600 }}
          >
            취소
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: 'none',
              background: saving ? '#a5b4fc' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: '#fff',
              fontWeight: 800,
              cursor: saving ? 'wait' : 'pointer',
            }}
          >
            {saving ? '저장 중…' : saveLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

const LINK_MODAL_Z = MODAL_Z + 5

function LinkMatrixModal({
  open,
  onClose,
  onSave,
  saving,
  causes,
  effects,
  linkMatrix,
  onToggle,
}: {
  open: boolean
  onClose: () => void
  onSave: () => void
  saving: boolean
  causes: ManifestCauseRow[]
  effects: ManifestEffectRow[]
  linkMatrix: Map<string, Set<string>>
  onToggle: (causeId: string, effectId: string) => void
}) {
  if (!open || typeof document === 'undefined') return null

  const causeLabels = buildLinkAxisLabels(causes)
  const effectLabels = buildLinkAxisLabels(effects)

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-matrix-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: LINK_MODAL_Z,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}
    >
      <div
        style={{
          width: 'min(960px, 100%)',
          maxHeight: '92vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: 16,
          padding: 22,
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 id="link-matrix-title" style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 900, color: '#37352F' }}>
          명시 연결 편집
        </h2>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#787774', lineHeight: 1.55 }}>
          아래 표는 카드의 <strong>제목</strong>(세부 항목) 기준으로 표시됩니다. 같은 상위분류 안에 여러 카드가 있어도 제목으로 구분해 연결할 수 있습니다. 체크한 쌍은 클릭 시 <strong>무조건</strong> 강조되고, 그 외 카드 중 <strong>0~3개</strong>가 추가로 무작위 강조됩니다. 명시 연결이 <strong>전혀 없는</strong> 카드만 클릭 시 1~3개 무작위만 나옵니다.
        </p>
        {causes.length === 0 || effects.length === 0 ? (
          <p style={{ color: '#9B9A97', fontSize: 14 }}>원인과 결과 카드가 각각 1개 이상 있어야 연결을 만들 수 있습니다.</p>
        ) : (
          <div style={{ overflow: 'auto', maxHeight: 'min(58vh, 520px)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                      padding: '8px 10px',
                      textAlign: 'left',
                      borderBottom: '1px solid rgba(0,0,0,0.08)',
                      minWidth: 120,
                      background: '#fafafa',
                      fontWeight: 800,
                      color: '#6366f1',
                    }}
                  >
                    원인 → 결과
                  </th>
                  {effects.map(eff => {
                    const effLabel = effectLabels.get(eff.id) ?? eff.title
                    return (
                    <th
                      key={eff.id}
                      title={effLabel}
                      style={{
                        padding: '8px 6px',
                        textAlign: 'center',
                        borderBottom: '1px solid rgba(0,0,0,0.08)',
                        maxWidth: 88,
                        minWidth: 44,
                        fontWeight: 700,
                        color: '#8b5cf6',
                        verticalAlign: 'bottom',
                        lineHeight: 1.25,
                      }}
                    >
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {effLabel.length > 8 ? `${effLabel.slice(0, 7)}…` : effLabel}
                      </span>
                    </th>
                  )})}
                </tr>
              </thead>
              <tbody>
                {causes.map(c => {
                  const causeLabel = causeLabels.get(c.id) ?? c.title
                  return (
                  <tr key={c.id}>
                    <td
                      style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                        padding: '8px 10px',
                        borderBottom: '1px solid rgba(0,0,0,0.06)',
                        background: '#fff',
                        fontWeight: 700,
                        color: '#37352F',
                        maxWidth: 160,
                      }}
                      title={causeLabel}
                    >
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {causeLabel}
                      </span>
                    </td>
                    {effects.map(eff => {
                      const checked = linkMatrix.get(c.id)?.has(eff.id) ?? false
                      const effLabel = effectLabels.get(eff.id) ?? eff.title
                      return (
                        <td key={eff.id} style={{ textAlign: 'center', padding: 6, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggle(c.id, eff.id)}
                            aria-label={`${causeLabel} — ${effLabel}`}
                            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#6366f1' }}
                          />
                        </td>
                      )
                    })}
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', cursor: saving ? 'wait' : 'pointer', fontWeight: 600 }}
          >
            취소
          </button>
          <button
            type="button"
            disabled={saving || causes.length === 0 || effects.length === 0}
            onClick={onSave}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: 'none',
              background: saving || causes.length === 0 || effects.length === 0 ? '#a5b4fc' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: '#fff',
              fontWeight: 800,
              cursor: saving ? 'wait' : 'pointer',
            }}
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#787774', marginBottom: 6 }
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', fontSize: 14, boxSizing: 'border-box' }

/** 선택 — 굵은 보라 테두리 유지, 외곽 뽀샤시(큰 블러) 최소화 */
const glowSelected: React.CSSProperties = {
  border: '2px solid #6366f1',
  boxShadow: '0 2px 6px rgba(99,102,241,0.22), 0 0 0 1px rgba(99,102,241,0.08)',
  background: 'linear-gradient(160deg, rgba(99,102,241,0.1), rgba(139,92,246,0.05))',
}

/** 반대편 하이라이트 — 동일하게 타이트한 그림자 */
const glowHighlight: React.CSSProperties = {
  border: '2px solid #8b5cf6',
  boxShadow: '0 2px 6px rgba(139,92,246,0.2), 0 0 0 1px rgba(139,92,246,0.08)',
  background: 'linear-gradient(160deg, rgba(139,92,246,0.08), rgba(99,102,241,0.04))',
}

const cardIdle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  background: '#ffffff',
  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
}

/** 저장용: 첫 그래펨(복합 이모지 1개) — DB icon 컬럼에 저장 */
function iconForStorage(raw: string): string {
  const t = raw.trim()
  if (!t) return '✨'
  try {
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      const seg = new Intl.Segmenter('en', { granularity: 'grapheme' })
      for (const x of seg.segment(t)) {
        return x.segment
      }
    }
  } catch { /* ignore */ }
  return [...t][0] ?? '✨'
}

const EMOJI_PRESETS = ['🏃', '🍎', '💖', '💰', '✨', '🔥', '💪', '📚', '🌱', '☀️', '🎯', '💤', '🧘', '🍽️', '💧', '📝', '🚶', '💎', '🌟', '❤️', '🏋️', '🎨', '✈️']

function EmojiIconField({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <>
      <label style={lbl}>아이콘 (이모지)</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ ...inp, fontSize: 20 }}
        placeholder="직접 입력 (예: 🏃‍♂️, 🍎, 💖)"
        maxLength={8}
      />
      <p style={{ margin: '8px 0 6px', fontSize: 11, fontWeight: 600, color: '#9B9A97' }}>빠른 선택</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {EMOJI_PRESETS.map(em => (
          <button
            key={em}
            type="button"
            onClick={() => onChange(em)}
            title={em}
            style={{
              width: 40,
              height: 40,
              fontSize: 22,
              lineHeight: 1,
              border: value === em ? '2px solid #6366f1' : '1px solid #e5e7eb',
              borderRadius: 10,
              background: value === em ? 'rgba(99,102,241,0.08)' : '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            {em}
          </button>
        ))}
      </div>
    </>
  )
}

const DOUBLE_CLICK_DELAY_MS = 300

/**
 * 정사각형 · 텍스트만 · 중앙 정렬 / 글로우·디밍 유지 / 삭제는 호버 시만 · 더블클릭 시 노트 패널
 * DB 필드 의미: `title` = 상위분류(큰 글자), `description` = 세부 항목 제목(작은 글자·노트 본문 미리보기)
 */
function ManifestMiniCard({
  title,
  description,
  isSel,
  isHi,
  dim,
  onActivate,
  onDelete,
  onEdit,
  onNoteOpen,
}: {
  /** 상위분류 — 카드 상단 굵은 글자 */
  title: string
  /** 세부 제목(및 노트 본문에서 동기화된 미리보기) — 카드 하단 작은 글자 */
  description: string
  isSel: boolean
  isHi: boolean
  dim: boolean
  onActivate: () => void
  onDelete: (e: React.MouseEvent) => void
  /** 편집 — 휴지통 왼쪽, 호버 시에만 표시 */
  onEdit?: (e: React.MouseEvent) => void
  /** 더블클릭 시 상세 노트(싱글클릭 인과 매칭과 분리) */
  onNoteOpen?: () => void
}) {
  const [hover, setHover] = useState(false)
  const [noHoverDevice, setNoHoverDevice] = useState(false)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clickCountRef = useRef(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(hover: none)')
    const apply = () => setNoHoverDevice(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
    }
  }, [])

  const scheduleSingleActivate = () => {
    if (!onNoteOpen) {
      onActivate()
      return
    }
    clickCountRef.current++
    if (clickCountRef.current === 1) {
      clickTimerRef.current = setTimeout(() => {
        if (clickCountRef.current === 1) onActivate()
        clickCountRef.current = 0
        clickTimerRef.current = null
      }, DOUBLE_CLICK_DELAY_MS)
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!onNoteOpen) return
    e.preventDefault()
    e.stopPropagation()
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }
    clickCountRef.current = 0
    onNoteOpen()
  }

  const showTrash = hover || noHoverDevice
  const trashOpacity = noHoverDevice ? 0.42 : hover ? 0.92 : 0
  const showEdit = Boolean(onEdit) && showTrash
  const editOpacity = onEdit ? trashOpacity : 0
  const emphasized = isSel || isHi
  const descPreview = useMemo(() => blockNoteToPlainPreview(description, 120), [description])
  return (
    <div
      role="button"
      tabIndex={0}
      title={onNoteOpen ? '클릭: 연결 · 더블클릭: 상세 노트' : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={scheduleSingleActivate}
      onDoubleClick={handleDoubleClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          scheduleSingleActivate()
        }
      }}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1 / 1',
        borderRadius: 8,
        cursor: 'pointer',
        boxSizing: 'border-box',
        transition: 'opacity 0.2s, box-shadow 0.25s',
        opacity: dim && !emphasized ? 0.8 : 1,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        ...(isSel ? glowSelected : isHi ? glowHighlight : cardIdle),
      }}
    >
      {onEdit && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onEdit(e) }}
          style={{
            position: 'absolute',
            top: 2,
            right: 22,
            padding: 2,
            border: 'none',
            background: showEdit ? 'rgba(255,255,255,0.92)' : 'transparent',
            borderRadius: 4,
            cursor: 'pointer',
            zIndex: 2,
            opacity: editOpacity,
            pointerEvents: showEdit ? 'auto' : 'none',
            lineHeight: 0,
            boxShadow: showEdit ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'opacity 0.12s ease',
          }}
          title="편집"
        >
          <Pencil size={10} color="#9ca3af" strokeWidth={2} />
        </button>
      )}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onDelete(e) }}
        style={{
          position: 'absolute',
          top: 2,
          right: 2,
          padding: 2,
          border: 'none',
          background: showTrash ? 'rgba(255,255,255,0.92)' : 'transparent',
          borderRadius: 4,
          cursor: 'pointer',
          zIndex: 2,
          opacity: trashOpacity,
          pointerEvents: showTrash ? 'auto' : 'none',
          lineHeight: 0,
          boxShadow: showTrash ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          transition: 'opacity 0.12s ease',
        }}
        title="삭제"
      >
        <Trash2 size={10} color="#9ca3af" strokeWidth={2} />
      </button>
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '6px 8px',
          boxSizing: 'border-box',
          minHeight: 0,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 'clamp(10px, 2.4vw, 13px)',
            fontWeight: 800,
            color: '#111827',
            lineHeight: 1.28,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'keep-all',
          }}
        >
          {title}
        </p>
        {descPreview?.trim() ? (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 11,
              fontWeight: 500,
              color: '#6b7280',
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'keep-all',
            }}
          >
            {descPreview}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function ManifestationPage() {
  const gridCols = useGridCols()
  const wideTwoPanel = useWideTwoPanelLayout()
  const [useRemote, setUseRemote] = useState(false)
  const [loading, setLoading] = useState(true)
  const [causes, setCauses] = useState<ManifestCauseRow[]>([])
  const [effects, setEffects] = useState<ManifestEffectRow[]>([])
  const [links, setLinks] = useState<ManifestLinkPair[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  /** 직접 클릭한 카드 (원인 또는 결과 한 장) */
  const [selectedCard, setSelectedCard] = useState<{ side: 'cause' | 'effect'; id: string } | null>(null)
  /** 반대편 보드에서 하이라이트할 카드 ID들 */
  const [highlightedIds, setHighlightedIds] = useState<string[]>([])

  const [causeModalOpen, setCauseModalOpen] = useState(false)
  const [effectModalOpen, setEffectModalOpen] = useState(false)
  /** null이면 추가, 값이 있으면 해당 id 카드 수정 */
  const [editingCauseId, setEditingCauseId] = useState<string | null>(null)
  const [editingEffectId, setEditingEffectId] = useState<string | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formIcon, setFormIcon] = useState('✨')
  const [saving, setSaving] = useState(false)

  const [achieved, setAchieved] = useState<AchievedManifestRow[]>([])
  const [achievedModalOpen, setAchievedModalOpen] = useState(false)
  const [editingAchievedId, setEditingAchievedId] = useState<string | null>(null)
  const [achFormTitle, setAchFormTitle] = useState('')
  const [achFormDesc, setAchFormDesc] = useState('')
  const [achFormIcon, setAchFormIcon] = useState('✨')

  const [noteOpen, setNoteOpen] = useState<{
    kind: ManifestNoteKind
    entityId: string
    title: string
    description: string
    icon: string
  } | null>(null)
  const closeNote = useCallback(() => {
    setNoteOpen(null)
    setNoteTagTick(v => v + 1)
  }, [])

  /** 노트 localStorage 저장 시 헤더 태그 목록 갱신 */
  const [noteTagTick, setNoteTagTick] = useState(0)
  const [filterTagCause, setFilterTagCause] = useState<string | null>(null)
  const [filterTagEffect, setFilterTagEffect] = useState<string | null>(null)
  const [filterTagAchieved, setFilterTagAchieved] = useState<string | null>(null)

  const [linkEditorOpen, setLinkEditorOpen] = useState(false)
  const [linkMatrix, setLinkMatrix] = useState<Map<string, Set<string>>>(() => new Map())
  const [linkSaving, setLinkSaving] = useState(false)

  const persistNoteMeta = useCallback(
    async (kind: ManifestNoteKind, entityId: string, fields: { title: string; description: string; icon: string }) => {
      const t = fields.title.trim()
      const d = fields.description
      const ic = fields.icon.trim() || '✨'
      if (kind === 'cause') {
        if (useRemote) {
          const ok = await updateManifestCause(entityId, { title: t, description: d, icon: ic })
          if (ok) {
            setCauses(prev => prev.map(c => (c.id === entityId ? { ...c, title: t, description: d, icon: ic } : c)))
          }
        } else {
          const loc = loadLocal()
          const next: LocalBundle = {
            ...loc,
            causes: loc.causes.map(c => (c.id === entityId ? { ...c, title: t, description: d, icon: ic } : c)),
          }
          saveLocal(next)
          setCauses(next.causes)
        }
        setNoteTagTick(v => v + 1)
        return
      }
      if (kind === 'effect') {
        if (useRemote) {
          const ok = await updateManifestEffect(entityId, { title: t, description: d, icon: ic })
          if (ok) {
            setEffects(prev => prev.map(e => (e.id === entityId ? { ...e, title: t, description: d, icon: ic } : e)))
          }
        } else {
          const loc = loadLocal()
          const next: LocalBundle = {
            ...loc,
            effects: loc.effects.map(e => (e.id === entityId ? { ...e, title: t, description: d, icon: ic } : e)),
          }
          saveLocal(next)
          setEffects(next.effects)
        }
        setNoteTagTick(v => v + 1)
        return
      }
      setAchieved(prev => {
        const next = prev.map(a => (a.id === entityId ? { ...a, title: t, description: d, icon: ic } : a))
        persistAchieved(next)
        return next
      })
      setNoteTagTick(v => v + 1)
    },
    [useRemote],
  )

  const linksByCause = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const l of links) {
      if (!m.has(l.cause_id)) m.set(l.cause_id, new Set())
      m.get(l.cause_id)!.add(l.effect_id)
    }
    return m
  }, [links])

  const linksByEffect = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const l of links) {
      if (!m.has(l.effect_id)) m.set(l.effect_id, new Set())
      m.get(l.effect_id)!.add(l.cause_id)
    }
    return m
  }, [links])

  const reload = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const remoteOk = await getHasSession()
      if (remoteOk && supabase) {
        const [c, e, l] = await Promise.all([
          fetchManifestationCauses(),
          fetchManifestationEffects(),
          fetchManifestationLinks(),
        ])
        setUseRemote(true)
        setCauses(c)
        setEffects(e)
        setLinks(l)
        return
      }
      setUseRemote(false)
      const loc = loadLocal()
      setCauses(loc.causes)
      setEffects(loc.effects)
      setLinks(loc.links)
    } catch (e) {
      console.error(e)
      setErrorMsg('데이터를 불러오지 못했습니다.')
    } finally {
      setAchieved(loadAchieved())
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!supabase) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void reload() })
    return () => subscription.unsubscribe()
  }, [reload])

  const onClickCause = (causeId: string) => {
    setSelectedCard({ side: 'cause', id: causeId })
    const explicit = new Set([...(linksByCause.get(causeId) ?? [])])
    /** 명시 연결 있음: 연결된 결과는 무조건 + 나머지 결과 중 0~3개 랜덤. 없음: 기존처럼 1~3개만 랜덤 */
    if (explicit.size > 0) {
      const extra = pickRandomIdsZeroToThree(
        effects.map(e => e.id),
        explicit,
      )
      setHighlightedIds([...new Set([...explicit, ...extra])])
    } else {
      setHighlightedIds(
        pickRandomIds(
          effects.map(e => e.id),
          explicit,
          3,
        ),
      )
    }
  }

  const onClickEffect = (effectId: string) => {
    setSelectedCard({ side: 'effect', id: effectId })
    const explicit = new Set([...(linksByEffect.get(effectId) ?? [])])
    if (explicit.size > 0) {
      const extra = pickRandomIdsZeroToThree(
        causes.map(c => c.id),
        explicit,
      )
      setHighlightedIds([...new Set([...explicit, ...extra])])
    } else {
      setHighlightedIds(
        pickRandomIds(
          causes.map(c => c.id),
          explicit,
          3,
        ),
      )
    }
  }

  const openLinkEditor = useCallback(() => {
    const m = new Map<string, Set<string>>()
    for (const l of links) {
      if (!m.has(l.cause_id)) m.set(l.cause_id, new Set())
      m.get(l.cause_id)!.add(l.effect_id)
    }
    setLinkMatrix(m)
    setLinkEditorOpen(true)
  }, [links])

  const toggleLinkPair = useCallback((causeId: string, effectId: string) => {
    setLinkMatrix(prev => {
      const next = new Map(prev)
      const set = new Set(next.get(causeId) ?? [])
      if (set.has(effectId)) set.delete(effectId)
      else set.add(effectId)
      if (set.size === 0) next.delete(causeId)
      else next.set(causeId, set)
      return next
    })
  }, [])

  const saveLinkMatrix = useCallback(async () => {
    if (causes.length === 0 || effects.length === 0) return
    setLinkSaving(true)
    setErrorMsg(null)
    try {
      if (useRemote) {
        for (const c of causes) {
          const ids = [...(linkMatrix.get(c.id) ?? [])]
          await replaceManifestLinksForCause(c.id, ids)
        }
        await reload()
      } else {
        const loc = loadLocal()
        const causeIdSet = new Set(causes.map(c => c.id))
        const nextLinks: ManifestLinkPair[] = loc.links.filter(l => !causeIdSet.has(l.cause_id))
        for (const c of causes) {
          for (const eid of linkMatrix.get(c.id) ?? []) {
            nextLinks.push({ cause_id: c.id, effect_id: eid })
          }
        }
        saveLocal({ ...loc, links: nextLinks })
        setLinks(nextLinks)
      }
      setLinkEditorOpen(false)
    } catch (e) {
      console.error(e)
      setErrorMsg('명시 연결 저장에 실패했습니다.')
    } finally {
      setLinkSaving(false)
    }
  }, [causes, effects, linkMatrix, useRemote, reload])

  const openCauseModal = () => {
    setEditingCauseId(null)
    setFormTitle('')
    setFormDesc('')
    setFormIcon('✨')
    setCauseModalOpen(true)
  }

  const openEditCause = (c: ManifestCauseRow) => {
    setEditingCauseId(c.id)
    setFormTitle(c.title)
    setFormDesc(c.description ?? '')
    setFormIcon(c.icon?.trim() || '✨')
    setCauseModalOpen(true)
  }

  const openEffectModal = () => {
    setEditingEffectId(null)
    setFormTitle('')
    setFormDesc('')
    setFormIcon('✨')
    setEffectModalOpen(true)
  }

  const openEditEffect = (eff: ManifestEffectRow) => {
    setEditingEffectId(eff.id)
    setFormTitle(eff.title)
    setFormDesc(eff.description ?? '')
    setFormIcon(eff.icon?.trim() || '✨')
    setEffectModalOpen(true)
  }

  const openAchievedModal = () => {
    setEditingAchievedId(null)
    setAchFormTitle('')
    setAchFormDesc('')
    setAchFormIcon('✨')
    setAchievedModalOpen(true)
  }

  const openEditAchieved = (a: AchievedManifestRow) => {
    setEditingAchievedId(a.id)
    setAchFormTitle(a.title)
    setAchFormDesc(a.description ?? '')
    setAchFormIcon(a.icon?.trim() || '✨')
    setAchievedModalOpen(true)
  }

  const saveAchievedItem = async () => {
    const t = achFormTitle.trim()
    if (!t) {
      setErrorMsg('상위분류를 입력해 주세요.')
      return
    }
    setSaving(true)
    setErrorMsg(null)
    try {
      const iconStored = iconForStorage(achFormIcon)
      if (editingAchievedId) {
        const next = achieved.map(a =>
          a.id === editingAchievedId
            ? { ...a, title: t, description: achFormDesc.trim(), icon: iconStored }
            : a,
        )
        persistAchieved(next)
        setAchieved(next)
        setEditingAchievedId(null)
      } else {
        const next: AchievedManifestRow[] = [
          ...achieved,
          { id: newId(), title: t, description: achFormDesc.trim(), icon: iconStored, sort_order: achieved.length },
        ]
        persistAchieved(next)
        setAchieved(next)
      }
      setAchievedModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const removeAchieved = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('이 항목을 삭제할까요?')) return
    const next = achieved.filter(a => a.id !== id)
    persistAchieved(next)
    setAchieved(next)
  }

  const saveCause = async () => {
    const t = formTitle.trim()
    if (!t) {
      setErrorMsg('상위분류를 입력해 주세요.')
      return
    }
    setSaving(true)
    setErrorMsg(null)
    try {
      const iconStored = iconForStorage(formIcon)
      if (editingCauseId) {
        if (useRemote) {
          const ok = await updateManifestCause(editingCauseId, { title: t, description: formDesc.trim(), icon: iconStored })
          if (!ok) {
            setErrorMsg('원인 카드 수정에 실패했습니다.')
            return
          }
          setCauses(prev => prev.map(c => (c.id === editingCauseId ? { ...c, title: t, description: formDesc.trim(), icon: iconStored } : c)))
        } else {
          const loc = loadLocal()
          const next: LocalBundle = {
            ...loc,
            causes: loc.causes.map(c =>
              c.id === editingCauseId ? { ...c, title: t, description: formDesc.trim(), icon: iconStored } : c,
            ),
          }
          saveLocal(next)
          setCauses(next.causes)
        }
        setEditingCauseId(null)
        setCauseModalOpen(false)
        setNoteTagTick(v => v + 1)
        return
      }
      if (useRemote) {
        const res = await insertManifestCause(t, formDesc.trim(), iconStored)
        if (!res.ok) {
          setErrorMsg(formatManifestInsertFailure(res))
          return
        }
      } else {
        const loc = loadLocal()
        const next: LocalBundle = {
          causes: [...loc.causes, { id: newId(), title: t, description: formDesc.trim(), icon: iconStored, sort_order: loc.causes.length }],
          effects: loc.effects,
          links: loc.links,
        }
        saveLocal(next)
        setCauses(next.causes)
        setEffects(next.effects)
        setLinks(next.links)
      }
      setCauseModalOpen(false)
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const saveEffect = async () => {
    const t = formTitle.trim()
    if (!t) {
      setErrorMsg('상위분류를 입력해 주세요.')
      return
    }
    setSaving(true)
    setErrorMsg(null)
    try {
      const iconStored = iconForStorage(formIcon)
      if (editingEffectId) {
        if (useRemote) {
          const ok = await updateManifestEffect(editingEffectId, { title: t, description: formDesc.trim(), icon: iconStored })
          if (!ok) {
            setErrorMsg('결과 카드 수정에 실패했습니다.')
            return
          }
          setEffects(prev => prev.map(e => (e.id === editingEffectId ? { ...e, title: t, description: formDesc.trim(), icon: iconStored } : e)))
        } else {
          const loc = loadLocal()
          const next: LocalBundle = {
            ...loc,
            effects: loc.effects.map(e =>
              e.id === editingEffectId ? { ...e, title: t, description: formDesc.trim(), icon: iconStored } : e,
            ),
          }
          saveLocal(next)
          setEffects(next.effects)
        }
        setEditingEffectId(null)
        setEffectModalOpen(false)
        setNoteTagTick(v => v + 1)
        return
      }
      if (useRemote) {
        const res = await insertManifestEffect(t, formDesc.trim(), iconStored)
        if (!res.ok) {
          setErrorMsg(formatManifestInsertFailure(res))
          return
        }
      } else {
        const loc = loadLocal()
        const next: LocalBundle = {
          causes: loc.causes,
          effects: [...loc.effects, { id: newId(), title: t, description: formDesc.trim(), icon: iconStored, sort_order: loc.effects.length }],
          links: loc.links,
        }
        saveLocal(next)
        setCauses(next.causes)
        setEffects(next.effects)
        setLinks(next.links)
      }
      setEffectModalOpen(false)
      await reload()
    } finally {
      setSaving(false)
    }
  }

  const removeCause = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('이 원인 카드를 삭제할까요?')) return
    if (useRemote) {
      await deleteManifestCause(id)
      await reload()
    } else {
      const loc = loadLocal()
      const next: LocalBundle = {
        causes: loc.causes.filter(c => c.id !== id),
        effects: loc.effects,
        links: loc.links.filter(l => l.cause_id !== id),
      }
      saveLocal(next)
      setCauses(next.causes)
      setEffects(next.effects)
      setLinks(next.links)
    }
    if (selectedCard?.side === 'cause' && selectedCard.id === id) {
      setSelectedCard(null)
      setHighlightedIds([])
    }
  }

  const removeEffect = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('이 결과 카드를 삭제할까요?')) return
    if (useRemote) {
      await deleteManifestEffect(id)
      await reload()
    } else {
      const loc = loadLocal()
      const next: LocalBundle = {
        causes: loc.causes,
        effects: loc.effects.filter(x => x.id !== id),
        links: loc.links.filter(l => l.effect_id !== id),
      }
      saveLocal(next)
      setCauses(next.causes)
      setEffects(next.effects)
      setLinks(next.links)
    }
    if (selectedCard?.side === 'effect' && selectedCard.id === id) {
      setSelectedCard(null)
      setHighlightedIds([])
    }
  }

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
    gap: 6,
  }

  /** 전체 너비 패널이므로 열을 2배로 해 원인/결과 칸의 정사각형과 동일한 변 길이 유지 */
  const achievedGridCols = wideTwoPanel ? gridCols * 2 : gridCols
  const achievedGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${achievedGridCols}, minmax(0, 1fr))`,
    gap: 6,
  }

  const isCauseDimmed = (id: string) => {
    if (!selectedCard) return false
    if (selectedCard.side === 'cause') return selectedCard.id !== id
    return !highlightedIds.includes(id)
  }

  const isEffectDimmed = (id: string) => {
    if (!selectedCard) return false
    if (selectedCard.side === 'effect') return selectedCard.id !== id
    return !highlightedIds.includes(id)
  }

  const causeTags = useMemo(
    () => collectTagsForEntities('cause', causes.map(c => c.id)),
    [causes, noteTagTick],
  )
  const effectTags = useMemo(
    () => collectTagsForEntities('effect', effects.map(e => e.id)),
    [effects, noteTagTick],
  )
  const achievedTags = useMemo(
    () => collectTagsForEntities('achieved', achieved.map(a => a.id)),
    [achieved, noteTagTick],
  )

  useEffect(() => {
    if (filterTagCause && !causeTags.includes(filterTagCause)) setFilterTagCause(null)
  }, [filterTagCause, causeTags])
  useEffect(() => {
    if (filterTagEffect && !effectTags.includes(filterTagEffect)) setFilterTagEffect(null)
  }, [filterTagEffect, effectTags])
  useEffect(() => {
    if (filterTagAchieved && !achievedTags.includes(filterTagAchieved)) setFilterTagAchieved(null)
  }, [filterTagAchieved, achievedTags])

  const filteredCauses = useMemo(() => {
    if (!filterTagCause) return causes
    return causes.filter(c => entityHasNoteTag('cause', c.id, filterTagCause))
  }, [causes, filterTagCause, noteTagTick])

  const filteredEffects = useMemo(() => {
    if (!filterTagEffect) return effects
    return effects.filter(e => entityHasNoteTag('effect', e.id, filterTagEffect))
  }, [effects, filterTagEffect, noteTagTick])

  const filteredAchieved = useMemo(() => {
    if (!filterTagAchieved) return achieved
    return achieved.filter(a => entityHasNoteTag('achieved', a.id, filterTagAchieved))
  }, [achieved, filterTagAchieved, noteTagTick])

  const tagChipStyle = (active: boolean, accent: string): React.CSSProperties => ({
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    border: active ? `1px solid ${accent}` : '1px solid rgba(0,0,0,0.08)',
    background: active ? (accent === '#6366f1' ? 'rgba(99,102,241,0.14)' : 'rgba(139,92,246,0.14)') : 'rgba(0,0,0,0.04)',
    color: active ? accent : '#4b5563',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    lineHeight: 1.25,
    fontFamily: 'inherit',
  })

  /** 라벨(CAUSE 등) 오른쪽 — 필터 없을 때도 visibility로 자리만 유지해 세로·가로 점프 방지 */
  const filterClearBesideLabelStyle: React.CSSProperties = {
    padding: 0,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 10,
    color: '#a8a29e',
    fontWeight: 500,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    lineHeight: 1.2,
    flexShrink: 0,
  }

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', padding: '28px 44px', position: 'relative', zIndex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Sparkles size={22} color="#6366f1" />
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#37352F' }}>Manifestation</h1>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: '#787774', lineHeight: 1.6 }}>
            원인·결과 카드를 눌러 인과를 떠올려 보세요. <strong>명시 연결</strong>이 있으면 짝 카드는 항상 강조되고 나머지 중 0~3개가 무작위로 추가됩니다. 연결이 없으면 1~3개 무작위만 나옵니다.
          </p>
          <div style={{ margin: '10px 0 0', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={openLinkEditor}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid rgba(99,102,241,0.35)',
                background: 'rgba(99,102,241,0.06)',
                color: '#4f46e5',
                fontWeight: 700,
                fontSize: 12,
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              <Link2 size={15} strokeWidth={2} />
              명시 연결 편집
            </button>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>원인 행 × 결과 열에서 체크해 고정 인과를 만듭니다.</span>
          </div>
          {!useRemote && (
            <p style={{ margin: '10px 0 0', fontSize: 12, color: '#b45309', background: 'rgba(251,191,36,0.12)', padding: '8px 12px', borderRadius: 8, maxWidth: 560 }}>
              로컬 모드 — <code style={{ fontSize: 11 }}>cause_effect_links</code>는 로컬에만 저장됩니다. Supabase에서 연결을 쓰려면 로그인하세요.
            </p>
          )}
          {errorMsg && (
            <p style={{ margin: '10px 0 0', fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>{errorMsg}</p>
          )}
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#9B9A97' }}>불러오는 중…</p>
      ) : (
        <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12, minHeight: 200, alignItems: 'stretch' }}>
          {/* Cause board */}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 16 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: '#6366f1' }}>CAUSE</p>
                  <button
                    type="button"
                    tabIndex={filterTagCause ? 0 : -1}
                    onClick={() => setFilterTagCause(null)}
                    style={{
                      ...filterClearBesideLabelStyle,
                      visibility: filterTagCause ? 'visible' : 'hidden',
                      pointerEvents: filterTagCause ? 'auto' : 'none',
                    }}
                  >
                    필터 해제
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#37352F' }}>원인 · 행동</span>
                  {causeTags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setFilterTagCause(prev => (prev === tag ? null : tag))}
                      style={tagChipStyle(filterTagCause === tag, '#6366f1')}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={openCauseModal}
                style={{
                  flexShrink: 0,
                  alignSelf: 'flex-start',
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10,
                  border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                }}
              >
                <Plus size={14} /> 원인 추가
              </button>
            </div>
            <div style={{ padding: '8px 8px 10px' }}>
              {causes.length === 0 && <p style={{ color: '#9B9A97', fontSize: 13 }}>원인 카드가 없습니다.</p>}
              {causes.length > 0 && filteredCauses.length === 0 && (
                <p style={{ color: '#9B9A97', fontSize: 13 }}>
                  이 태그에 해당하는 원인 카드가 없습니다.{' '}
                  <button type="button" onClick={() => setFilterTagCause(null)} style={{ border: 'none', background: 'none', color: '#6366f1', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                    필터 해제
                  </button>
                </p>
              )}
              {causes.length > 0 && filteredCauses.length > 0 && (
                <div style={gridStyle}>
                  {filteredCauses.map(c => {
                    const isSel = selectedCard?.side === 'cause' && selectedCard.id === c.id
                    const isHi = selectedCard?.side === 'effect' && highlightedIds.includes(c.id)
                    const dim = isCauseDimmed(c.id)
                    return (
                      <ManifestMiniCard
                        key={c.id}
                        title={c.title}
                        description={c.description ?? ''}
                        isSel={isSel}
                        isHi={isHi}
                        dim={dim}
                        onActivate={() => onClickCause(c.id)}
                        onDelete={ev => void removeCause(ev, c.id)}
                        onEdit={ev => {
                          ev.stopPropagation()
                          openEditCause(c)
                        }}
                        onNoteOpen={() =>
                          setNoteOpen({
                            kind: 'cause',
                            entityId: c.id,
                            title: c.title,
                            description: c.description ?? '',
                            icon: c.icon?.trim() || '✨',
                          })
                        }
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Effect board */}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 16 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: '#8b5cf6' }}>EFFECT</p>
                  <button
                    type="button"
                    tabIndex={filterTagEffect ? 0 : -1}
                    onClick={() => setFilterTagEffect(null)}
                    style={{
                      ...filterClearBesideLabelStyle,
                      visibility: filterTagEffect ? 'visible' : 'hidden',
                      pointerEvents: filterTagEffect ? 'auto' : 'none',
                    }}
                  >
                    필터 해제
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#37352F' }}>결과 · 보상</span>
                  {effectTags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setFilterTagEffect(prev => (prev === tag ? null : tag))}
                      style={tagChipStyle(filterTagEffect === tag, '#8b5cf6')}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={openEffectModal}
                style={{
                  flexShrink: 0,
                  alignSelf: 'flex-start',
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10,
                  border: 'none', background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                }}
              >
                <Plus size={14} /> 결과 추가
              </button>
            </div>
            <div style={{ padding: '8px 8px 10px' }}>
              {effects.length === 0 && <p style={{ color: '#9B9A97', fontSize: 13 }}>결과 카드가 없습니다.</p>}
              {effects.length > 0 && filteredEffects.length === 0 && (
                <p style={{ color: '#9B9A97', fontSize: 13 }}>
                  이 태그에 해당하는 결과 카드가 없습니다.{' '}
                  <button type="button" onClick={() => setFilterTagEffect(null)} style={{ border: 'none', background: 'none', color: '#8b5cf6', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                    필터 해제
                  </button>
                </p>
              )}
              {effects.length > 0 && filteredEffects.length > 0 && (
                <div style={gridStyle}>
                  {filteredEffects.map(eff => {
                    const isSel = selectedCard?.side === 'effect' && selectedCard.id === eff.id
                    const isHi = selectedCard?.side === 'cause' && highlightedIds.includes(eff.id)
                    const dim = isEffectDimmed(eff.id)
                    return (
                      <ManifestMiniCard
                        key={eff.id}
                        title={eff.title}
                        description={eff.description ?? ''}
                        isSel={isSel}
                        isHi={isHi}
                        dim={dim}
                        onActivate={() => onClickEffect(eff.id)}
                        onDelete={ev => void removeEffect(ev, eff.id)}
                        onEdit={ev => {
                          ev.stopPropagation()
                          openEditEffect(eff)
                        }}
                        onNoteOpen={() =>
                          setNoteOpen({
                            kind: 'effect',
                            entityId: eff.id,
                            title: eff.title,
                            description: eff.description ?? '',
                            icon: eff.icon?.trim() || '✨',
                          })
                        }
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 이미 이뤄진 결과 — 한 줄 전체 너비 */}
        <div
          style={{
            marginTop: 16,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            background: '#fff',
            borderRadius: 16,
            border: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 16 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: '#8b5cf6' }}>ACHIEVED</p>
                <button
                  type="button"
                  tabIndex={filterTagAchieved ? 0 : -1}
                  onClick={() => setFilterTagAchieved(null)}
                  style={{
                    ...filterClearBesideLabelStyle,
                    visibility: filterTagAchieved ? 'visible' : 'hidden',
                    pointerEvents: filterTagAchieved ? 'auto' : 'none',
                  }}
                >
                  필터 해제
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: '#37352F' }}>이미 이뤄진 결과</span>
                {achievedTags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setFilterTagAchieved(prev => (prev === tag ? null : tag))}
                    style={tagChipStyle(filterTagAchieved === tag, '#8b5cf6')}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={openAchievedModal}
              style={{
                flexShrink: 0,
                alignSelf: 'flex-start',
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10,
                border: 'none', background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}
            >
              <Plus size={14} /> 추가
            </button>
          </div>
          <div style={{ padding: '8px 8px 10px' }}>
            {achieved.length === 0 && (
              <p style={{ color: '#9B9A97', fontSize: 13 }}>아직 기록이 없습니다. [추가]로 이미 이룬 결과를 남겨 보세요.</p>
            )}
            {achieved.length > 0 && filteredAchieved.length === 0 && (
              <p style={{ color: '#9B9A97', fontSize: 13 }}>
                이 태그에 해당하는 카드가 없습니다.{' '}
                <button type="button" onClick={() => setFilterTagAchieved(null)} style={{ border: 'none', background: 'none', color: '#8b5cf6', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                  필터 해제
                </button>
              </p>
            )}
            {achieved.length > 0 && filteredAchieved.length > 0 && (
              <div style={achievedGridStyle}>
                {filteredAchieved.map(a => (
                  <ManifestMiniCard
                    key={a.id}
                    title={a.title}
                    description={a.description ?? ''}
                    isSel={false}
                    isHi={false}
                    dim={false}
                    onActivate={() => {}}
                    onDelete={ev => removeAchieved(ev, a.id)}
                    onEdit={ev => {
                      ev.stopPropagation()
                      openEditAchieved(a)
                    }}
                    onNoteOpen={() =>
                      setNoteOpen({
                        kind: 'achieved',
                        entityId: a.id,
                        title: a.title,
                        description: a.description ?? '',
                        icon: a.icon?.trim() || '✨',
                      })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        </>
      )}

      <LinkMatrixModal
        open={linkEditorOpen}
        onClose={() => !linkSaving && setLinkEditorOpen(false)}
        onSave={() => void saveLinkMatrix()}
        saving={linkSaving}
        causes={causes}
        effects={effects}
        linkMatrix={linkMatrix}
        onToggle={toggleLinkPair}
      />

      {noteOpen && (
        <ManifestNotionNotePanel
          key={`${noteOpen.kind}-${noteOpen.entityId}`}
          open
          onClose={closeNote}
          kind={noteOpen.kind}
          entityId={noteOpen.entityId}
          initialTitle={noteOpen.title}
          initialDescription={noteOpen.description}
          initialIcon={noteOpen.icon}
          kindLabel={
            noteOpen.kind === 'cause' ? '원인 · 행동' : noteOpen.kind === 'effect' ? '결과 · 보상' : '이미 이뤄진 결과'
          }
          accent={noteOpen.kind === 'cause' ? '#6366f1' : '#8b5cf6'}
          onPersistMeta={fields => {
            void persistNoteMeta(noteOpen.kind, noteOpen.entityId, fields)
          }}
        />
      )}

      <ModalPortal
        open={causeModalOpen}
        title={editingCauseId ? '원인 편집' : '원인 추가'}
        onClose={() => {
          if (saving) return
          setCauseModalOpen(false)
          setEditingCauseId(null)
        }}
        onSave={() => void saveCause()}
        saving={saving}
      >
        <label style={lbl}>상위분류</label>
        <input value={formTitle} onChange={e => setFormTitle(e.target.value)} style={inp} placeholder="예: 건강 · 물건" autoFocus />
        <label style={{ ...lbl, marginTop: 12 }}>제목</label>
        <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} style={{ ...inp, minHeight: 88, resize: 'vertical' }} placeholder="예: 10000보 걷기, 아이맥" />
        <div style={{ marginTop: 14 }}>
          <EmojiIconField value={formIcon} onChange={setFormIcon} />
        </div>
      </ModalPortal>

      <ModalPortal
        open={effectModalOpen}
        title={editingEffectId ? '결과 편집' : '결과 추가'}
        onClose={() => {
          if (saving) return
          setEffectModalOpen(false)
          setEditingEffectId(null)
        }}
        onSave={() => void saveEffect()}
        saving={saving}
      >
        <label style={lbl}>상위분류</label>
        <input value={formTitle} onChange={e => setFormTitle(e.target.value)} style={inp} placeholder="예: 행운 · 물건" autoFocus />
        <label style={{ ...lbl, marginTop: 12 }}>제목</label>
        <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} style={{ ...inp, minHeight: 88, resize: 'vertical' }} placeholder="예: 전기차, 작은 기적들이 겹침" />
        <div style={{ marginTop: 14 }}>
          <EmojiIconField value={formIcon} onChange={setFormIcon} />
        </div>
      </ModalPortal>

      <ModalPortal
        open={achievedModalOpen}
        title={editingAchievedId ? '이미 이뤄진 결과 편집' : '이미 이뤄진 결과 추가'}
        onClose={() => {
          if (saving) return
          setAchievedModalOpen(false)
          setEditingAchievedId(null)
        }}
        onSave={() => void saveAchievedItem()}
        saving={saving}
      >
        <label style={lbl}>상위분류</label>
        <input value={achFormTitle} onChange={e => setAchFormTitle(e.target.value)} style={inp} placeholder="예: 성과 · 물건" autoFocus />
        <label style={{ ...lbl, marginTop: 12 }}>제목</label>
        <textarea value={achFormDesc} onChange={e => setAchFormDesc(e.target.value)} style={{ ...inp, minHeight: 88, resize: 'vertical' }} placeholder="예: 펀딩 성공, 아이맥 구입" />
        <div style={{ marginTop: 14 }}>
          <EmojiIconField value={achFormIcon} onChange={setAchFormIcon} />
        </div>
      </ModalPortal>
    </div>
  )
}
