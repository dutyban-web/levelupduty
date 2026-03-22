/**
 * MasterBoard — 창작 OS 통합 대시보드
 */
import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { isSupabaseReady } from './lib/supabase'
import {
  fetchTravelEvents,
  fetchManifestationCauses,
  fetchManifestationEffects,
  fetchManifestationLinks,
  fetchFortuneEventsInRange,
  type TravelTripRow,
  type IdentityRow,
  type ReadingLogRow,
} from './supabase'
import { loadLedgerStore, ledgerDayExpenseTotal } from './accountLedgerData'
import { loadEvolutionStore, evolutionProgress } from './evolutionData'
import { loadFragmentStore } from './fragmentData'
import { useIsMobile } from './hooks/useIsMobile'

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}시간 ${m}분`
  return `${m}분`
}

function fmtWon(n: number): string {
  return n.toLocaleString('ko-KR')
}

export type MasterBoardPageProps = {
  xpTotal: number
  currentLevel: number
  levelTitle: string
  currentLevelXp: number
  maxCurrentLevelXp: number
  levelProgressPct: number
  dailyPomodoros: number
  dailyFocusSec: number
  dailyTimeScore?: number
  identities: IdentityRow[]
  activeIdentityId: string | null
  openQuestCount: number
}

export function MasterBoardPage({
  xpTotal,
  currentLevel,
  levelTitle,
  currentLevelXp,
  maxCurrentLevelXp,
  levelProgressPct,
  dailyPomodoros,
  dailyFocusSec,
  dailyTimeScore,
  identities,
  activeIdentityId,
  openQuestCount,
}: MasterBoardPageProps) {
  const isMobile = useIsMobile()
  const ymd = todayYmd()
  const rootRef = useRef<HTMLDivElement | null>(null)

  const [trips, setTrips] = useState<TravelTripRow[]>([])
  const [topCause, setTopCause] = useState<{ title: string; count: number } | null>(null)
  const [topEffect, setTopEffect] = useState<{ title: string; count: number } | null>(null)
  const [fortuneToday, setFortuneToday] = useState<ReadingLogRow[]>([])

  const ledgerExpense = ledgerDayExpenseTotal(loadLedgerStore(), ymd)
  const evolutionStore = loadEvolutionStore()
  const evo = evolutionProgress(evolutionStore.totalEvolutionXp)
  const fragmentCount = loadFragmentStore().entries.length

  useEffect(() => {
    if (!isSupabaseReady) return
    fetchTravelEvents().then(setTrips).catch(() => setTrips([]))
  }, [])

  useEffect(() => {
    if (!isSupabaseReady) return
    ;(async () => {
      try {
        const [causes, effects, links] = await Promise.all([
          fetchManifestationCauses(),
          fetchManifestationEffects(),
          fetchManifestationLinks(),
        ])
        const outCause = new Map<string, number>()
        const outEffect = new Map<string, number>()
        for (const l of links) {
          outCause.set(l.cause_id, (outCause.get(l.cause_id) ?? 0) + 1)
          outEffect.set(l.effect_id, (outEffect.get(l.effect_id) ?? 0) + 1)
        }
        let bestC: { id: string; n: number } | null = null
        for (const [id, n] of outCause) {
          if (!bestC || n > bestC.n) bestC = { id, n }
        }
        let bestE: { id: string; n: number } | null = null
        for (const [id, n] of outEffect) {
          if (!bestE || n > bestE.n) bestE = { id, n }
        }
        if (bestC && bestC.n > 0) {
          const c = causes.find(x => x.id === bestC!.id)
          setTopCause({ title: c?.title ?? '원인', count: bestC.n })
        } else setTopCause(null)
        if (bestE && bestE.n > 0) {
          const e = effects.find(x => x.id === bestE!.id)
          setTopEffect({ title: e?.title ?? '결과', count: bestE.n })
        } else setTopEffect(null)
      } catch {
        setTopCause(null)
        setTopEffect(null)
      }
    })()
  }, [])

  useEffect(() => {
    if (!isSupabaseReady) return
    fetchFortuneEventsInRange(ymd, ymd)
      .then(rows => setFortuneToday(rows.filter(r => (r.event_date ?? r.created_at?.slice(0, 10)) === ymd)))
      .catch(() => setFortuneToday([]))
  }, [ymd])

  const upcomingTrips = useMemo(() => {
    const t = [...trips].filter(x => x.startDate >= ymd).sort((a, b) => a.startDate.localeCompare(b.startDate))
    return t.slice(0, 4)
  }, [trips, ymd])

  const fortuneScoreSummary = useMemo(() => {
    const scores = fortuneToday.map(r => r.fortune_score).filter((x): x is number => typeof x === 'number' && !Number.isNaN(x))
    if (scores.length === 0) return null
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    return { avg: Math.round(avg * 10) / 10, count: scores.length }
  }, [fortuneToday])

  const activeIdentity = identities.find(i => i.id === activeIdentityId)

  const cardStyle: CSSProperties = {
    background: '#FFFFFF',
    borderRadius: 16,
    border: '1px solid rgba(0,0,0,0.06)',
    padding: isMobile ? 16 : 18,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  }

  return (
    <div ref={rootRef} style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '18px 14px 40px' : '28px 40px 48px', minHeight: 'calc(100vh - 52px)' }}>
      <header style={{ marginBottom: 24 }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#6366f1', letterSpacing: '0.16em', textTransform: 'uppercase' }}>MasterBoard</p>
        <h1 style={{ margin: '8px 0 6px', fontSize: isMobile ? 24 : 28, fontWeight: 900, color: '#37352F' }}>오늘의 창작 OS</h1>
        <p style={{ margin: 0, fontSize: 13, color: '#787774', lineHeight: 1.6, maxWidth: 640 }}>
          레벨·몰입·가계·여행·빙의·인과·운세를 한눈에 봅니다. 카드를 눌러 해당 메뉴로 이동할 수 있습니다.
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {/* RPG 레벨 */}
        <Link to="/levelup" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ ...cardStyle, borderLeft: '4px solid #6366f1' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#9B9A97', letterSpacing: '0.06em' }}>QUEST 레벨</p>
            <p style={{ margin: '8px 0 4px', fontSize: 28, fontWeight: 900, color: '#37352F' }}>Lv.{currentLevel}</p>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: '#6366f1', fontWeight: 700 }}>{levelTitle}</p>
            <div style={{ height: 8, borderRadius: 999, background: '#EBEBEA', overflow: 'hidden' }}>
              <div style={{ width: `${levelProgressPct}%`, height: '100%', background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius: 999 }} />
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 11, color: '#9B9A97' }}>
              {currentLevelXp.toLocaleString()} / {maxCurrentLevelXp.toLocaleString()} XP · 총 {xpTotal.toLocaleString()} XP
            </p>
          </div>
        </Link>

        {/* 포모도로 */}
        <div style={{ ...cardStyle, borderLeft: '4px solid #f59e0b' }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#9B9A97' }}>오늘 포모도로</p>
          <p style={{ margin: '10px 0 0', fontSize: 32, fontWeight: 900, color: '#37352F' }}>{dailyPomodoros}<span style={{ fontSize: 16, fontWeight: 700, color: '#787774', marginLeft: 4 }}>회</span></p>
          <Link to="/quest" style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: '#6366f1' }}>Quest로 이동 →</Link>
        </div>

        {/* 집중 시간 */}
        <div style={{ ...cardStyle, borderLeft: '4px solid #3b82f6' }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#9B9A97' }}>오늘 집중 누적</p>
          <p style={{ margin: '10px 0 0', fontSize: 26, fontWeight: 900, color: '#37352F' }}>{fmtDuration(dailyFocusSec)}</p>
          {dailyTimeScore != null && dailyTimeScore > 0 && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#787774' }}>시간 점수 반영: {dailyTimeScore} XP</p>
          )}
        </div>

        {/* 오늘 지출 */}
        <Link to="/account" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ ...cardStyle, borderLeft: '4px solid #ef4444' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#9B9A97' }}>오늘 지출 (가계부)</p>
            <p style={{ margin: '10px 0 0', fontSize: 28, fontWeight: 900, color: '#37352F' }}>{fmtWon(ledgerExpense)}<span style={{ fontSize: 15, fontWeight: 700, color: '#787774', marginLeft: 2 }}>원</span></p>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#9B9A97' }}>통합 가계부 기준 지출 합계</p>
          </div>
        </Link>

        {/* 다가오는 여행 */}
        <div style={{ ...cardStyle, borderLeft: '4px solid #14b8a6' }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#9B9A97' }}>예정된 여행</p>
          {upcomingTrips.length === 0 ? (
            <p style={{ margin: '14px 0 0', fontSize: 13, color: '#AEAAA4' }}>다가오는 일정이 없습니다</p>
          ) : (
            <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: '#37352F', fontSize: 13, lineHeight: 1.55 }}>
              {upcomingTrips.map(t => (
                <li key={t.id} style={{ marginBottom: 6 }}>
                  <strong>{t.title}</strong>
                  <span style={{ color: '#787774', fontSize: 12, marginLeft: 6 }}>{t.startDate}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/travel" style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: '#6366f1', display: 'inline-block' }}>Travel →</Link>
        </div>

        {/* 빙의 태세 */}
        <Link to="/act" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ ...cardStyle, borderLeft: '4px solid #7c3aed' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#9B9A97' }}>현재 태세 (Act)</p>
            <p style={{ margin: '12px 0 0', fontSize: 18, fontWeight: 900, color: '#37352F' }}>
              {activeIdentity ? activeIdentity.name : '선택된 태세 없음'}
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#787774' }}>정체성 {identities.length}개</p>
          </div>
        </Link>

        {/* 인과: 연결 많은 원인/결과 */}
        <Link to="/manifestation" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ ...cardStyle, borderLeft: '4px solid #ec4899' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#9B9A97' }}>Manifestation · 연결 수</p>
            <p style={{ margin: '10px 0 4px', fontSize: 12, fontWeight: 800, color: '#37352F' }}>가장 많이 연결된 원인</p>
            <p style={{ margin: 0, fontSize: 14, color: '#4B5563', lineHeight: 1.45 }}>{topCause ? `${topCause.title} (${topCause.count})` : '연결 데이터 없음'}</p>
            <p style={{ margin: '10px 0 4px', fontSize: 12, fontWeight: 800, color: '#37352F' }}>가장 많이 연결된 결과</p>
            <p style={{ margin: 0, fontSize: 14, color: '#4B5563', lineHeight: 1.45 }}>{topEffect ? `${topEffect.title} (${topEffect.count})` : '연결 데이터 없음'}</p>
          </div>
        </Link>

        {/* 오늘 운세 점수 */}
        <Link to="/fortune" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ ...cardStyle, borderLeft: '4px solid #a855f7' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#9B9A97' }}>오늘의 운세 기록</p>
            {fortuneToday.length === 0 ? (
              <p style={{ margin: '14px 0 0', fontSize: 13, color: '#AEAAA4' }}>오늘 저장된 점괘가 없습니다</p>
            ) : (
              <>
                <p style={{ margin: '10px 0 0', fontSize: 12, color: '#787774' }}>기록 {fortuneToday.length}건</p>
                {fortuneScoreSummary ? (
                  <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 900, color: '#37352F' }}>
                    평균 점수 <span style={{ color: '#7c3aed' }}>{fortuneScoreSummary.avg}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#9B9A97', marginLeft: 6 }}>({fortuneScoreSummary.count}건)</span>
                  </p>
                ) : (
                  <p style={{ margin: '8px 0 0', fontSize: 13, color: '#787774' }}>점수 미입력 기록만 있음</p>
                )}
              </>
            )}
          </div>
        </Link>

        {/* Evolution */}
        <Link to="/evolution" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ ...cardStyle, borderLeft: '4px solid #2dd4bf' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#9B9A97' }}>Evolution</p>
            <p style={{ margin: '10px 0 0', fontSize: 28, fontWeight: 900, color: '#37352F' }}>Lv.{evo.level}</p>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#787774' }}>진화 XP {evolutionStore.totalEvolutionXp.toLocaleString()} · 이번 구간 {evo.xpIntoLevel}/{evo.xpForNext}</p>
          </div>
        </Link>

        {/* Fragment */}
        <Link to="/fragment" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ ...cardStyle, borderLeft: '4px solid #94a3b8' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#9B9A97' }}>Fragment 조각</p>
            <p style={{ margin: '10px 0 0', fontSize: 32, fontWeight: 900, color: '#37352F' }}>{fragmentCount}<span style={{ fontSize: 14, fontWeight: 700, color: '#787774', marginLeft: 4 }}>개</span></p>
          </div>
        </Link>

        {/* 진행 중 퀘스트 */}
        <Link to="/quest" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ ...cardStyle, borderLeft: '4px solid #22c55e' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#9B9A97' }}>진행 중 퀘스트</p>
            <p style={{ margin: '10px 0 0', fontSize: 32, fontWeight: 900, color: '#37352F' }}>{openQuestCount}<span style={{ fontSize: 14, fontWeight: 700, color: '#787774', marginLeft: 4 }}>개</span></p>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#787774' }}>완료 처리 전까지</p>
          </div>
        </Link>

        {/* Life */}
        <Link to="/life" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ ...cardStyle, borderLeft: '4px solid #0ea5e9' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#9B9A97' }}>캘린더</p>
            <p style={{ margin: '12px 0 0', fontSize: 15, fontWeight: 800, color: '#37352F' }}>통합 캘린더 · 저널</p>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#6366f1', fontWeight: 700 }}>Life →</p>
          </div>
        </Link>
      </div>

      <p style={{ marginTop: 28, fontSize: 11, color: '#AEAAA4', lineHeight: 1.6 }}>
        일부 수치는 Supabase 연결 시 갱신됩니다. 가계부·Evolution·Fragment는 로컬 저장 기준입니다.
      </p>
    </div>
  )
}
