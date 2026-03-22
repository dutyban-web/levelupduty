/**
 * QuantumFlow — 시공편지 (미래/과거의 나에게)
 * 중앙 모달 · BlockNote 본문 · 보관함 비밀번호 · 타임캡슐
 */
import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import { X, Bell, Lock } from 'lucide-react'
import {
  loadQuantumFlowStore,
  saveQuantumFlowStore,
  upsertLetter,
  deleteLetter,
  activeLetters,
  canReadLetter,
  hasLetterArrived,
  toYMD,
  formatSentDateTime,
  formatSentAgoFromNow,
  formatSpacetimeMailboxNarrative,
  normalizeOpenTime,
  sha256Hex,
  setVaultPasswordHash,
  upsertTimebox,
  deleteTimebox,
  isTimeboxUnlocked,
  type QuantumLetter,
  type SpacetimeDirection,
  type QuantumFlowStore,
  type QuantumTimebox,
} from './quantumFlowData'
import { useIsMobile } from './hooks/useIsMobile'
import { QuantumLetterRichEditor } from './QuantumLetterRichEditor'

const dirLabel: Record<SpacetimeDirection, string> = {
  to_future: '미래의 나에게',
  to_past: '과거의 나에게',
}

const VAULT_TITLE: Record<'to_future' | 'to_past', string> = {
  to_future: '과거의 내가 미래로 보냈던 편지',
  to_past: '미래의 내가 과거로 보냈던 편지',
}

const SESS = { to_future: 'qf_vault_unlock_future', to_past: 'qf_vault_unlock_past' } as const
const SESS_TIMEBOX = 'qf_vault_unlock_timebox'

type LetterModal = { letter: QuantumLetter; mode: 'view' | 'edit' }

function readVaultSession(which: 'to_future' | 'to_past'): boolean {
  try {
    return sessionStorage.getItem(SESS[which]) === '1'
  } catch {
    return false
  }
}

function setVaultSession(which: 'to_future' | 'to_past', ok: boolean) {
  try {
    if (ok) sessionStorage.setItem(SESS[which], '1')
    else sessionStorage.removeItem(SESS[which])
  } catch {
    /* ignore */
  }
}

function defaultDatetimeLocalPlusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setSeconds(0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function readTimeboxVaultSession(): boolean {
  try {
    return sessionStorage.getItem(SESS_TIMEBOX) === '1'
  } catch {
    return false
  }
}

function setTimeboxVaultSession(ok: boolean) {
  try {
    if (ok) sessionStorage.setItem(SESS_TIMEBOX, '1')
    else sessionStorage.removeItem(SESS_TIMEBOX)
  } catch {
    /* ignore */
  }
}

export function QuantumFlowPage({ onSaved }: { onSaved?: () => void }) {
  const isMobile = useIsMobile()
  const todayYmd = toYMD(new Date())
  const [store, setStore] = useState<QuantumFlowStore>(loadQuantumFlowStore)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [openDate, setOpenDate] = useState(todayYmd)
  const [openTime, setOpenTime] = useState('00:00')
  const [direction, setDirection] = useState<SpacetimeDirection>('to_future')
  const [lockUntilOpen, setLockUntilOpen] = useState(true)
  const [calDate, setCalDate] = useState(() => new Date())
  const [letterModal, setLetterModal] = useState<LetterModal | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [draftOpenDate, setDraftOpenDate] = useState(todayYmd)
  const [draftOpenTime, setDraftOpenTime] = useState('00:00')
  const [draftDirection, setDraftDirection] = useState<SpacetimeDirection>('to_future')
  const [draftLockUntilOpen, setDraftLockUntilOpen] = useState(true)
  const [unlockFuture, setUnlockFuture] = useState(() => readVaultSession('to_future'))
  const [unlockPast, setUnlockPast] = useState(() => readVaultSession('to_past'))
  const [pwTryF, setPwTryF] = useState('')
  const [pwTryP, setPwTryP] = useState('')
  const [pwNewF, setPwNewF] = useState('')
  const [pwNewF2, setPwNewF2] = useState('')
  const [pwNewP, setPwNewP] = useState('')
  const [pwNewP2, setPwNewP2] = useState('')
  const [unlockTimebox, setUnlockTimebox] = useState(() => readTimeboxVaultSession())
  const [pwTryTb, setPwTryTb] = useState('')
  const [pwNewTb, setPwNewTb] = useState('')
  const [pwNewTb2, setPwNewTb2] = useState('')
  const [tbTitle, setTbTitle] = useState('')
  const [tbBody, setTbBody] = useState('')
  const [tbUnlockLocal, setTbUnlockLocal] = useState(() => defaultDatetimeLocalPlusDays(7))
  const [tbComposeKey, setTbComposeKey] = useState(0)

  const lettersSorted = useMemo(
    () =>
      [...activeLetters(store.letters)].sort(
        (a, b) => b.openDate.localeCompare(a.openDate) || b.updatedAt.localeCompare(a.updatedAt),
      ),
    [store.letters],
  )

  const lettersFuture = useMemo(() => lettersSorted.filter(l => l.direction === 'to_future'), [lettersSorted])
  const lettersPast = useMemo(() => lettersSorted.filter(l => l.direction === 'to_past'), [lettersSorted])

  const arrivalsToday = useMemo(() => {
    const n = new Date()
    const d = toYMD(n)
    return activeLetters(store.letters).filter(
      l => l.lockUntilOpen && hasLetterArrived(l, n) && l.openDate === d,
    )
  }, [store.letters])

  const openDates = useMemo(() => {
    const s = new Set<string>()
    for (const l of activeLetters(store.letters)) s.add(l.openDate)
    return s
  }, [store.letters])

  const closeLetterModal = useCallback(() => setLetterModal(null), [])

  useEffect(() => {
    if (!letterModal) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [letterModal])

  useEffect(() => {
    if (!letterModal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLetterModal(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [letterModal])

  const persist = useCallback((next: QuantumFlowStore) => {
    setStore(next)
    saveQuantumFlowStore(next)
    onSaved?.()
  }, [onSaved])

  const saveNew = useCallback(() => {
    const t = title.trim()
    if (!t) return
    const next = upsertLetter(store, {
      title: t,
      body,
      openDate,
      openTime: normalizeOpenTime(openTime),
      direction,
      lockUntilOpen,
    })
    persist(next)
    setTitle('')
    setBody('')
    setOpenDate(todayYmd)
    setOpenTime('00:00')
    setDirection('to_future')
    setLockUntilOpen(true)
  }, [store, title, body, openDate, openTime, direction, lockUntilOpen, todayYmd, persist])

  const openViewModal = (l: QuantumLetter) => setLetterModal({ letter: l, mode: 'view' })

  const openEditModal = (l: QuantumLetter) => {
    setDraftTitle(l.title)
    setDraftBody(l.body)
    setDraftOpenDate(l.openDate)
    setDraftOpenTime(normalizeOpenTime(l.openTime))
    setDraftDirection(l.direction)
    setDraftLockUntilOpen(l.lockUntilOpen)
    setLetterModal({ letter: l, mode: 'edit' })
  }

  const saveModalLetter = () => {
    if (!letterModal || letterModal.mode !== 'edit') return
    const t = draftTitle.trim()
    if (!t) return
    const next = upsertLetter(store, {
      id: letterModal.letter.id,
      title: t,
      body: draftBody,
      openDate: draftOpenDate,
      openTime: normalizeOpenTime(draftOpenTime),
      direction: draftDirection,
      lockUntilOpen: draftLockUntilOpen,
    })
    persist(next)
    setLetterModal(null)
  }

  const remove = (id: string) => {
    if (!window.confirm('이 시공편지를 삭제할까요?')) return
    persist(deleteLetter(store, id))
    if (letterModal?.letter.id === id) setLetterModal(null)
  }

  const verifyVault = async (which: 'to_future' | 'to_past', password: string) => {
    const hash = which === 'to_future' ? store.vaultPwHashToFuture : store.vaultPwHashToPast
    if (!hash) return
    const h = await sha256Hex(password)
    if (h === hash) {
      setVaultSession(which, true)
      if (which === 'to_future') setUnlockFuture(true)
      else setUnlockPast(true)
      setPwTryF('')
      setPwTryP('')
    } else {
      window.alert('비밀번호가 올바르지 않습니다.')
    }
  }

  const verifyTimeboxVault = async (password: string) => {
    const hash = store.vaultPwHashTimebox
    if (!hash) return
    const h = await sha256Hex(password)
    if (h === hash) {
      setTimeboxVaultSession(true)
      setUnlockTimebox(true)
      setPwTryTb('')
    } else {
      window.alert('비밀번호가 올바르지 않습니다.')
    }
  }

  const setVaultPw = async (which: 'to_future' | 'to_past', a: string, b: string) => {
    if (a !== b) {
      window.alert('비밀번호가 서로 다릅니다.')
      return
    }
    if (a.length < 2) {
      window.alert('비밀번호를 2자 이상 입력하세요.')
      return
    }
    const h = await sha256Hex(a)
    const next = setVaultPasswordHash(store, which, h)
    persist(next)
    setVaultSession(which, true)
    if (which === 'to_future') {
      setUnlockFuture(true)
      setPwNewF('')
      setPwNewF2('')
    } else {
      setUnlockPast(true)
      setPwNewP('')
      setPwNewP2('')
    }
  }

  const setTimeboxVaultPw = async (a: string, b: string) => {
    if (a !== b) {
      window.alert('비밀번호가 서로 다릅니다.')
      return
    }
    if (a.length < 2) {
      window.alert('비밀번호를 2자 이상 입력하세요.')
      return
    }
    const h = await sha256Hex(a)
    const next = setVaultPasswordHash(store, 'timebox', h)
    persist(next)
    setTimeboxVaultSession(true)
    setUnlockTimebox(true)
    setPwNewTb('')
    setPwNewTb2('')
  }

  const addTimebox = () => {
    const t = tbTitle.trim()
    if (!t) return
    const unlock = new Date(tbUnlockLocal)
    if (Number.isNaN(unlock.getTime())) {
      window.alert('잠금 해제 시각을 확인해 주세요.')
      return
    }
    const now = new Date()
    if (unlock.getTime() <= now.getTime()) {
      window.alert('잠금 해제 시각은 지금 이후로 설정해 주세요.')
      return
    }
    const next = upsertTimebox(store, {
      title: t,
      body: tbBody.trim() || JSON.stringify([{ type: 'paragraph', content: '' }]),
      unlockAt: unlock.toISOString(),
    })
    persist(next)
    setTbTitle('')
    setTbBody('')
    setTbUnlockLocal(defaultDatetimeLocalPlusDays(7))
    setTbComposeKey(k => k + 1)
  }

  const removeTimebox = (id: string) => {
    if (!window.confirm('이 타임캡슐을 삭제할까요?')) return
    persist(deleteTimebox(store, id))
  }

  const vaultInputStyle: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(148,163,184,0.25)',
    background: 'rgba(15,23,42,0.6)',
    color: '#f8fafc',
    fontSize: 13,
    outline: 'none',
  }

  const vaultBtnStyle: CSSProperties = {
    marginTop: 10,
    padding: '8px 14px',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg,#7c3aed,#0891b2)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  }

  const calTile = ({ date }: { date: Date }) => {
    const dk = toYMD(date)
    if (!openDates.has(dk)) return null
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 2 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,#22d3ee,#a855f7)',
            boxShadow: '0 0 6px rgba(168,85,247,0.8)',
          }}
          title="시공편지 도착일"
        />
      </div>
    )
  }

  const darkModalShell: CSSProperties = {
    border: '1px solid rgba(103,232,249,0.25)',
    background: 'linear-gradient(145deg, rgba(30,27,46,0.98) 0%, rgba(18,16,28,0.99) 100%)',
    boxShadow: '0 0 0 1px rgba(168,85,247,0.08), 0 24px 48px rgba(0,0,0,0.5)',
    color: '#e8e6f0',
  }

  const renderLetterCard = (l: QuantumLetter) => {
    const readable = canReadLetter(l, new Date())
    return (
      <div
        key={l.id}
        style={{
          borderRadius: 14,
          border: '1px solid rgba(103,232,249,0.15)',
          background: 'linear-gradient(90deg, rgba(30,27,46,0.9) 0%, rgba(20,18,32,0.95) 100%)',
          padding: 14,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#a5f3fc', letterSpacing: '0.06em' }}>{dirLabel[l.direction]}</span>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                도착 {l.openDate} {normalizeOpenTime(l.openTime)}
              </span>
              {l.lockUntilOpen && !readable && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#fbbf24',
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'rgba(251,191,36,0.12)',
                  }}
                >
                  잠김
                </span>
              )}
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
              발송 {formatSentDateTime(new Date(l.createdAt))} · {formatSentAgoFromNow(l.createdAt)}
            </p>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#5eead4', lineHeight: 1.55 }}>
              {formatSpacetimeMailboxNarrative(l)}
            </p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{l.title}</p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => {
                if (!readable && l.lockUntilOpen) return
                openViewModal(l)
              }}
              disabled={!readable && l.lockUntilOpen}
              style={{
                padding: '6px 12px',
                borderRadius: 10,
                border: '1px solid rgba(103,232,249,0.35)',
                background: readable || !l.lockUntilOpen ? 'rgba(103,232,249,0.1)' : 'rgba(51,65,85,0.4)',
                color: readable || !l.lockUntilOpen ? '#a5f3fc' : '#475569',
                fontSize: 11,
                fontWeight: 700,
                cursor: readable || !l.lockUntilOpen ? 'pointer' : 'not-allowed',
              }}
            >
              {!readable && l.lockUntilOpen ? '도착 전' : '열기'}
            </button>
            <button
              type="button"
              onClick={() => openEditModal(l)}
              disabled={!readable && l.lockUntilOpen}
              style={{
                padding: '6px 12px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.3)',
                background: 'transparent',
                color: !readable && l.lockUntilOpen ? '#475569' : '#94a3b8',
                fontSize: 11,
                fontWeight: 600,
                cursor: !readable && l.lockUntilOpen ? 'not-allowed' : 'pointer',
              }}
            >
              편집
            </button>
            <button
              type="button"
              onClick={() => remove(l.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 10,
                border: '1px solid rgba(248,113,113,0.35)',
                background: 'transparent',
                color: '#f87171',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              삭제
            </button>
          </div>
        </div>
        {!readable && l.lockUntilOpen && (
          <p style={{ margin: '10px 0 0', fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
            도착 시각({l.openDate} {normalizeOpenTime(l.openTime)})이 되면 잠금이 풀립니다.
          </p>
        )}
      </div>
    )
  }

  const renderVault = (which: 'to_future' | 'to_past', list: QuantumLetter[]) => {
    const hash = which === 'to_future' ? store.vaultPwHashToFuture : store.vaultPwHashToPast
    const unlocked = which === 'to_future' ? unlockFuture : unlockPast
    return (
      <div
        style={{
          borderRadius: 16,
          border: '1px solid rgba(168,85,247,0.25)',
          background: 'rgba(18,16,28,0.75)',
          padding: 14,
          minHeight: 200,
        }}
      >
        <h3 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: '#e9d5ff', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Lock className="h-4 w-4 text-violet-300" aria-hidden />
          {VAULT_TITLE[which]}
        </h3>
        {!hash ? (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            <p style={{ margin: '0 0 8px' }}>이 보관함을 열려면 비밀번호를 먼저 설정하세요.</p>
            <input
              type="password"
              placeholder="새 비밀번호"
              value={which === 'to_future' ? pwNewF : pwNewP}
              onChange={e => (which === 'to_future' ? setPwNewF : setPwNewP)(e.target.value)}
              style={vaultInputStyle}
            />
            <input
              type="password"
              placeholder="비밀번호 확인"
              value={which === 'to_future' ? pwNewF2 : pwNewP2}
              onChange={e => (which === 'to_future' ? setPwNewF2 : setPwNewP2)(e.target.value)}
              style={{ ...vaultInputStyle, marginTop: 8 }}
            />
            <button
              type="button"
              onClick={() => void setVaultPw(which, which === 'to_future' ? pwNewF : pwNewP, which === 'to_future' ? pwNewF2 : pwNewP2)}
              style={vaultBtnStyle}
            >
              비밀번호 설정
            </button>
          </div>
        ) : !unlocked ? (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            <input
              type="password"
              placeholder="비밀번호"
              value={which === 'to_future' ? pwTryF : pwTryP}
              onChange={e => (which === 'to_future' ? setPwTryF : setPwTryP)(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') void verifyVault(which, which === 'to_future' ? pwTryF : pwTryP)
              }}
              style={vaultInputStyle}
            />
            <button type="button" onClick={() => void verifyVault(which, which === 'to_future' ? pwTryF : pwTryP)} style={vaultBtnStyle}>
              잠금 해제
            </button>
          </div>
        ) : list.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>아직 편지가 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{list.map(renderLetterCard)}</div>
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 52px)',
        background:
          'radial-gradient(ellipse 120% 80% at 50% -20%, rgba(56,189,248,0.15) 0%, transparent 50%), radial-gradient(ellipse 80% 60% at 100% 50%, rgba(168,85,247,0.12) 0%, transparent 45%), linear-gradient(180deg,#0c0a14 0%,#12101c 40%,#0f0d18 100%)',
        color: '#e8e6f0',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '20px 14px 32px' : '36px 40px 48px' }}>
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.35em', color: '#67e8f9', textTransform: 'uppercase' }}>
            Quantum Flow
          </p>
          <h1
            style={{
              margin: '10px 0 8px',
              fontSize: isMobile ? 26 : 34,
              fontWeight: 900,
              background: 'linear-gradient(135deg,#e0f2fe,#c4b5fd,#f0abfc)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            시공편지
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(226,232,240,0.65)', lineHeight: 1.6, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
            시간선을 넘어 <strong style={{ color: '#a5f3fc' }}>미래의 나</strong> 또는 <strong style={{ color: '#d8b4fe' }}>과거의 나</strong>에게
            편지를 보냅니다. 본문은 <strong style={{ color: '#fde68a' }}>/ 슬래시</strong>와 파일 끌어넣기로 꾸밀 수 있습니다.
          </p>
          <Link
            to="/master-board?warehouse=calendar"
            style={{
              display: 'inline-block',
              marginTop: 14,
              fontSize: 12,
              fontWeight: 700,
              color: '#67e8f9',
              textDecoration: 'none',
              borderBottom: '1px solid rgba(103,232,249,0.4)',
            }}
          >
            통합 캘린더에서 도착일 확인 →
          </Link>
          {arrivalsToday.length > 0 && (
            <div
              style={{
                marginTop: 14,
                marginLeft: 'auto',
                marginRight: 'auto',
                maxWidth: 480,
                padding: '12px 14px',
                borderRadius: 14,
                border: '1px solid rgba(103,232,249,0.35)',
                background: 'rgba(103,232,249,0.08)',
                textAlign: 'left',
              }}
            >
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: '#a5f3fc', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden />
                도착 알림 · 오늘 열리는 편지
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#cbd5e1' }}>
                {arrivalsToday.map(a => (
                  <li key={a.id} style={{ marginBottom: 4 }}>
                    <strong style={{ color: '#f1f5f9' }}>{a.title}</strong>
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#94a3b8' }}>
                      {normalizeOpenTime(a.openTime)} 도착
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: 24, alignItems: 'start' }}>
          <div
            style={{
              borderRadius: 20,
              border: '1px solid rgba(103,232,249,0.25)',
              background: 'linear-gradient(145deg, rgba(30,27,46,0.95) 0%, rgba(18,16,28,0.98) 100%)',
              boxShadow: '0 0 0 1px rgba(168,85,247,0.08), 0 24px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
              padding: 24,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <h2 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 800, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>✦</span> 새 편지 발송
            </h2>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 6 }}>제목</span>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="예: 일주일 뒤의 나에게"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(148,163,184,0.2)',
                  background: 'rgba(15,23,42,0.6)',
                  color: '#e2e8f0',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </label>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 6 }}>본문</span>
              <div
                style={{
                  borderRadius: 14,
                  overflow: 'hidden',
                  border: '1px solid rgba(148,163,184,0.2)',
                  background: 'rgba(15,23,42,0.75)',
                }}
              >
                <QuantumLetterRichEditor
                  body={body}
                  onChange={setBody}
                  editorKey="composer-new"
                  readOnly={false}
                  minEditorHeight={260}
                  variant="dark"
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 14, alignItems: 'flex-end' }}>
              <label style={{ flex: '1 1 140px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 6 }}>도착일</span>
                <input
                  type="date"
                  value={openDate}
                  onChange={e => setOpenDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid rgba(148,163,184,0.2)',
                    background: 'rgba(15,23,42,0.6)',
                    color: '#f8fafc',
                    fontSize: 13,
                  }}
                />
              </label>
              <label style={{ flex: '1 1 120px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 6 }}>도착 시각</span>
                <input
                  type="time"
                  value={openTime}
                  onChange={e => setOpenTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid rgba(148,163,184,0.2)',
                    background: 'rgba(15,23,42,0.6)',
                    color: '#f8fafc',
                    fontSize: 13,
                  }}
                />
              </label>
              <div style={{ flex: '1 1 180px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 6 }}>방향</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['to_future', 'to_past'] as const).map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDirection(d)}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: direction === d ? '1px solid #67e8f9' : '1px solid rgba(148,163,184,0.2)',
                        background: direction === d ? 'rgba(103,232,249,0.12)' : 'rgba(15,23,42,0.4)',
                        color: direction === d ? '#a5f3fc' : '#94a3b8',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {dirLabel[d]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={lockUntilOpen}
                onChange={e => setLockUntilOpen(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#a855f7' }}
              />
              <span style={{ fontSize: 13, color: '#cbd5e1' }}>
                <strong style={{ color: '#e9d5ff' }}>도착 시각 전까지 잠금</strong>
                <span style={{ display: 'block', fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  켜면 도착일·시각이 되기 전에는 편지함에서 내용을 열 수 없습니다.
                </span>
              </span>
            </label>
            <button
              type="button"
              onClick={saveNew}
              disabled={!title.trim()}
              style={{
                padding: '12px 24px',
                borderRadius: 14,
                border: 'none',
                background: title.trim() ? 'linear-gradient(135deg,#0891b2,#7c3aed)' : 'rgba(71,85,105,0.5)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 800,
                cursor: title.trim() ? 'pointer' : 'not-allowed',
                boxShadow: title.trim() ? '0 8px 32px rgba(124,58,237,0.35)' : 'none',
              }}
            >
              시공으로 전송
            </button>
          </div>
          <div
            style={{
              borderRadius: 20,
              border: '1px solid rgba(168,85,247,0.2)',
              background: 'rgba(18,16,28,0.85)',
              padding: 18,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, color: '#c4b5fd' }}>도착일이 있는 날</p>
            <div className="quantum-cal-wrap">
              <Calendar value={calDate} onChange={v => v && setCalDate(v as Date)} locale="ko-KR" tileContent={calTile} />
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
              도착일에 맞춰 청록·보라 점이 찍힙니다.{' '}
              <Link to="/master-board?warehouse=calendar" style={{ color: '#67e8f9' }}>
                통합 캘린더
              </Link>
              에서도 확인할 수 있어요.
            </p>
          </div>
        </div>

        <div style={{ marginTop: 32 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ opacity: 0.9 }}>◇</span> 편지 보관함
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 14,
              alignItems: 'start',
            }}
          >
            {renderVault('to_future', lettersFuture)}
            {renderVault('to_past', lettersPast)}
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ opacity: 0.9 }}>⏳</span> 타임캡슐
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#94a3b8', lineHeight: 1.55 }}>
            본문은 시공편지와 같이 <strong style={{ color: '#a5f3fc' }}>/</strong> 명령과 파일 끌어넣기를 쓸 수 있습니다. 설정한 시각이 되기 전까지는 잠금이며, 이 영역은 별도 비밀번호로 보호됩니다.
          </p>
          <div
            style={{
              borderRadius: 16,
              border: '1px solid rgba(139,92,246,0.3)',
              background: 'rgba(18,16,32,0.9)',
              padding: 16,
              marginBottom: 14,
            }}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 800, color: '#ddd6fe', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lock className="h-4 w-4 text-violet-300" aria-hidden />
              타임캡슐 금고
            </h3>
            {!store.vaultPwHashTimebox ? (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                <p style={{ margin: '0 0 8px' }}>타임캡슐을 쓰려면 먼저 이 영역 전용 비밀번호를 설정하세요.</p>
                <input
                  type="password"
                  placeholder="새 비밀번호"
                  value={pwNewTb}
                  onChange={e => setPwNewTb(e.target.value)}
                  style={vaultInputStyle}
                />
                <input
                  type="password"
                  placeholder="비밀번호 확인"
                  value={pwNewTb2}
                  onChange={e => setPwNewTb2(e.target.value)}
                  style={{ ...vaultInputStyle, marginTop: 8 }}
                />
                <button type="button" onClick={() => void setTimeboxVaultPw(pwNewTb, pwNewTb2)} style={vaultBtnStyle}>
                  비밀번호 설정
                </button>
              </div>
            ) : !unlockTimebox ? (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                <input
                  type="password"
                  placeholder="비밀번호"
                  value={pwTryTb}
                  onChange={e => setPwTryTb(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') void verifyTimeboxVault(pwTryTb)
                  }}
                  style={vaultInputStyle}
                />
                <button type="button" onClick={() => void verifyTimeboxVault(pwTryTb)} style={vaultBtnStyle}>
                  잠금 해제
                </button>
              </div>
            ) : (
              <>
                <div
                  style={{
                    borderRadius: 14,
                    border: '1px solid rgba(103,232,249,0.2)',
                    background: 'rgba(30,27,46,0.6)',
                    padding: 14,
                    marginBottom: 14,
                  }}
                >
                  <label style={{ display: 'block', marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 6 }}>제목</span>
                    <input
                      value={tbTitle}
                      onChange={e => setTbTitle(e.target.value)}
                      style={{ ...vaultInputStyle, marginTop: 0, color: '#e2e8f0' }}
                    />
                  </label>
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 6 }}>본문</span>
                    <div
                      style={{
                        borderRadius: 12,
                        overflow: 'hidden',
                        border: '1px solid rgba(103,232,249,0.15)',
                        background: 'rgba(15,23,42,0.5)',
                      }}
                    >
                      <QuantumLetterRichEditor
                        key={tbComposeKey}
                        body={tbBody}
                        onChange={setTbBody}
                        editorKey={`tb-new-${tbComposeKey}`}
                        minEditorHeight={220}
                        variant="dark"
                      />
                    </div>
                  </div>
                  <label style={{ display: 'block', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>잠금 해제 시각</span>
                    <input
                      type="datetime-local"
                      value={tbUnlockLocal}
                      onChange={e => setTbUnlockLocal(e.target.value)}
                      style={{ ...vaultInputStyle, marginTop: 6 }}
                    />
                    <span style={{ display: 'block', marginTop: 6, fontSize: 10, color: '#64748b', lineHeight: 1.45 }}>
                      원하는 날짜·시각을 자유롭게 지정할 수 있습니다. (지금 이후여야 합니다.)
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={addTimebox}
                    disabled={!tbTitle.trim()}
                    style={{ ...vaultBtnStyle, marginTop: 0, opacity: tbTitle.trim() ? 1 : 0.5 }}
                  >
                    타임캡슐 만들기
                  </button>
                </div>
                {(store.timeboxes ?? []).length === 0 ? (
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>아직 타임캡슐이 없습니다.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(store.timeboxes ?? []).map(tb => {
                      const open = isTimeboxUnlocked(tb, new Date())
                      return (
                        <div
                          key={tb.id}
                          style={{
                            borderRadius: 14,
                            border: '1px solid rgba(139,92,246,0.22)',
                            background: 'rgba(20,18,32,0.95)',
                            padding: 14,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div>
                              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#f1f5f9' }}>{tb.title}</p>
                              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94a3b8' }}>
                                {open ? '시간 잠금 해제됨' : `열림 예정: ${new Date(tb.unlockAt).toLocaleString('ko-KR')}`}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeTimebox(tb.id)}
                              style={{ fontSize: 11, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                              삭제
                            </button>
                          </div>
                          {open ? (
                            <div style={{ marginTop: 10, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                              <QuantumLetterRichEditor
                                body={tb.body}
                                onChange={() => {}}
                                readOnly
                                editorKey={`tb-${tb.id}-${tb.updatedAt}`}
                                minEditorHeight={160}
                                variant="dark"
                              />
                            </div>
                          ) : (
                            <p style={{ margin: '10px 0 0', fontSize: 12, color: '#a78bfa' }}>
                              잠금 · 설정한 시각이 되기 전까지 본문을 볼 수 없습니다.
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {letterModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal aria-labelledby="quantum-letter-modal-title">
          <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={closeLetterModal} aria-label="닫기" />
          <div className="relative z-10 flex max-h-[min(92vh,860px)] w-full max-w-[min(640px,100%)] flex-col overflow-hidden rounded-2xl" style={darkModalShell}>
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.2em] text-cyan-300/90">시공편지</p>
                <h3 id="quantum-letter-modal-title" className="mt-1.5 text-lg font-black leading-snug text-slate-100 sm:text-xl">
                  {letterModal.mode === 'edit' ? draftTitle || '제목 없음' : letterModal.letter.title}
                </h3>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  {dirLabel[letterModal.mode === 'edit' ? draftDirection : letterModal.letter.direction]} · 도착{' '}
                  {letterModal.mode === 'edit' ? draftOpenDate : letterModal.letter.openDate}{' '}
                  {normalizeOpenTime(letterModal.mode === 'edit' ? draftOpenTime : letterModal.letter.openTime)}
                  {letterModal.mode === 'view' && (
                    <>
                      {' '}
                      · 발송 {formatSentDateTime(new Date(letterModal.letter.createdAt))}
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={closeLetterModal}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                title="닫기 (Esc)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5">
              {letterModal.mode === 'view' && (
                <div className="rounded-xl border border-white/10 bg-slate-950/40 p-1">
                  <QuantumLetterRichEditor
                    body={letterModal.letter.body}
                    onChange={() => {}}
                    readOnly
                    editorKey={`view-${letterModal.letter.id}-${letterModal.letter.updatedAt}`}
                    minEditorHeight={280}
                    variant="dark"
                  />
                </div>
              )}
              {letterModal.mode === 'edit' && (
                <>
                  <label className="mb-3 block">
                    <span className="mb-1 block text-[11px] font-bold text-slate-500">제목</span>
                    <input
                      value={draftTitle}
                      onChange={e => setDraftTitle(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-slate-950/50 px-3 py-2.5 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-500/50"
                    />
                  </label>
                  <div className="mb-3 flex flex-wrap gap-3">
                    <label className="min-w-[140px] flex-1">
                      <span className="mb-1 block text-[11px] font-bold text-slate-500">도착일</span>
                      <input
                        type="date"
                        value={draftOpenDate}
                        onChange={e => setDraftOpenDate(e.target.value)}
                        className="w-full rounded-xl border border-white/15 bg-slate-950/50 px-3 py-2 text-sm text-slate-100"
                      />
                    </label>
                    <label className="min-w-[120px] flex-1">
                      <span className="mb-1 block text-[11px] font-bold text-slate-500">도착 시각</span>
                      <input
                        type="time"
                        value={draftOpenTime}
                        onChange={e => setDraftOpenTime(e.target.value)}
                        className="w-full rounded-xl border border-white/15 bg-slate-950/50 px-3 py-2 text-sm text-slate-100"
                      />
                    </label>
                    <div className="min-w-[180px] flex-1">
                      <span className="mb-1 block text-[11px] font-bold text-slate-500">방향</span>
                      <div className="flex gap-2">
                        {(['to_future', 'to_past'] as const).map(d => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setDraftDirection(d)}
                            className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold ${
                              draftDirection === d ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100' : 'border-white/15 bg-slate-950/40 text-slate-400'
                            }`}
                          >
                            {dirLabel[d]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <label className="mb-3 flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draftLockUntilOpen}
                      onChange={e => setDraftLockUntilOpen(e.target.checked)}
                      className="h-4 w-4 accent-violet-500"
                    />
                    <span className="text-sm text-slate-300">도착 시각 전까지 잠금</span>
                  </label>
                  <p className="mb-2 text-[11px] font-bold text-slate-500">본문</p>
                  <div className="rounded-xl border border-white/10 bg-slate-950/40 p-1">
                    <QuantumLetterRichEditor
                      body={draftBody}
                      onChange={setDraftBody}
                      readOnly={false}
                      editorKey={`edit-${letterModal.letter.id}`}
                      minEditorHeight={300}
                      variant="dark"
                    />
                  </div>
                </>
              )}
            </div>
            {letterModal.mode === 'edit' && (
              <div className="flex shrink-0 flex-wrap gap-2 border-t border-white/10 px-4 py-3 sm:px-5">
                <button
                  type="button"
                  onClick={saveModalLetter}
                  disabled={!draftTitle.trim()}
                  className="rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  변경 저장
                </button>
                <button
                  type="button"
                  onClick={closeLetterModal}
                  className="rounded-xl border border-white/20 bg-transparent px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5"
                >
                  취소
                </button>
              </div>
            )}
            {letterModal.mode === 'view' && (
              <div className="flex shrink-0 justify-end border-t border-white/10 px-4 py-3 sm:px-5">
                <button
                  type="button"
                  onClick={closeLetterModal}
                  className="rounded-xl border border-white/20 bg-transparent px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5"
                >
                  닫기
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .quantum-cal-wrap .react-calendar { width: 100%; border: none; background: transparent; font-family: inherit; color: #e2e8f0; }
        .quantum-cal-wrap .react-calendar__navigation button { color: #c4b5fd; }
        .quantum-cal-wrap .react-calendar__tile { font-size: 12px; color: #cbd5e1; }
        .quantum-cal-wrap .react-calendar__tile--active { background: rgba(103,232,249,0.25) !important; color: #fff !important; }
        .quantum-cal-wrap .react-calendar__month-view__weekdays { color: #64748b; }
      `}</style>
    </div>
  )
}
