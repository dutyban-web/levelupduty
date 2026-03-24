/**
 * 인과율의 기록 보관소 — 유산 갤러리 · 영광의 통계 · 영광의 회상
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadRpgProfile, saveRpgProfile } from './levelupRpgProfile'
import { BL_RPG_SYNC } from './questRpgIntegration'
import { DialogueBox } from './DialogueBox'
import {
  BL_LEGACY_ARCHIVE_SYNC,
  loadLegacyArchive,
  type LegacyArchiveEntry,
  randomLegacyRecall,
} from './legacyArchiveData'

function formatMin(m: number): string {
  if (m >= 60) return `${Math.floor(m / 60)}시간 ${m % 60}분`
  return `${m}분`
}

function codexEmoji(style: LegacyArchiveEntry['codexStyle']): string {
  switch (style) {
    case 'relic':
      return '🏺'
    case 'scroll':
      return '📜'
    default:
      return '📚'
  }
}

export function LegacyGalleryView() {
  const [entries, setEntries] = useState<LegacyArchiveEntry[]>(() => loadLegacyArchive().entries)
  const [selected, setSelected] = useState<LegacyArchiveEntry | null>(null)
  const [recallOpen, setRecallOpen] = useState(false)
  const [recallText, setRecallText] = useState('')
  const [recallTitle, setRecallTitle] = useState('')

  const refresh = useCallback(() => {
    setEntries(loadLegacyArchive().entries)
  }, [])

  useEffect(() => {
    const h = () => refresh()
    window.addEventListener(BL_LEGACY_ARCHIVE_SYNC, h)
    return () => window.removeEventListener(BL_LEGACY_ARCHIVE_SYNC, h)
  }, [refresh])

  const sorted = useMemo(
    () => [...entries].sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1)),
    [entries],
  )

  const doRecall = () => {
    const r = randomLegacyRecall()
    if (!r) {
      window.alert('회상할 Try·회고 문장이 아직 없습니다. 프로젝트 워크스페이스에 메모를 남기거나 유산을 더 쌓아 주세요.')
      return
    }
    const p = loadRpgProfile()
    const max = p.mp[1]
    const add = Math.ceil(max * 0.5)
    const nextMp: [number, number] = [Math.min(max, p.mp[0] + add), max]
    saveRpgProfile({ ...p, mp: nextMp })
    try {
      window.dispatchEvent(new CustomEvent(BL_RPG_SYNC))
    } catch {
      /* ignore */
    }
    setRecallTitle(r.title)
    setRecallText(r.text)
    setRecallOpen(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <style>{`
        @keyframes lg-butterfly {
          0% { transform: translate(0, 0) rotate(-8deg) scale(0.85); opacity: 0.35; }
          35% { opacity: 1; }
          100% { transform: translate(12px, -88px) rotate(14deg) scale(1.05); opacity: 0; }
        }
        @keyframes lg-glow-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(251,191,36,0.15); }
          50% { box-shadow: 0 0 36px rgba(251,191,36,0.35); }
        }
      `}</style>

      <div
        style={{
          padding: '14px 16px',
          borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(30,27,46,0.95), rgba(15,23,42,0.98))',
          border: '1px solid rgba(120,113,108,0.45)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(251,191,36,0.08)',
        }}
      >
        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 900, color: '#fde68a', letterSpacing: '0.06em' }}>
          Archives of Causality
        </h2>
        <p style={{ margin: 0, fontSize: 12, color: '#a8a29e', lineHeight: 1.6 }}>
          완료된 보스 전장과 출판 이력이 한데 모인 서고입니다. 카드를 열면 <strong style={{ color: '#e7e5e4' }}>영광의 통계</strong>와 나비효과 지표를 볼 수 있습니다.
        </p>
        <button
          type="button"
          onClick={doRecall}
          style={{
            marginTop: 14,
            padding: '12px 18px',
            borderRadius: 10,
            border: '1px solid rgba(167,139,250,0.5)',
            background: 'linear-gradient(180deg, rgba(76,29,149,0.45), rgba(30,27,46,0.95))',
            color: '#e9d5ff',
            fontWeight: 900,
            fontSize: 13,
            cursor: 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          영광의 회상 — 과거의 한 줄을 무작위로 불러옵니다
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        {sorted.map(e => (
          <button
            key={e.id}
            type="button"
            onClick={() => setSelected(e)}
            style={{
              textAlign: 'left',
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: 12,
            }}
          >
            <div
              style={{
                position: 'relative',
                height: '100%',
                minHeight: 200,
                borderRadius: 12,
                background: 'linear-gradient(165deg, #1c1410 0%, #0c0a09 100%)',
                border: '2px solid #5c4033',
                boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5), 0 8px 28px rgba(0,0,0,0.4)',
                padding: '16px 14px',
                animation: 'lg-glow-pulse 4s ease-in-out infinite',
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.95 }}>{codexEmoji(e.codexStyle)}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#a8a29e', letterSpacing: '0.12em', marginBottom: 6 }}>
                {e.kind === 'seed' ? '기록된 유산' : e.kind === 'project' ? '보스 전장' : '메인 퀘스트'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#fafaf9', lineHeight: 1.35, marginBottom: 6 }}>{e.title}</div>
              {e.subtitle ? (
                <div style={{ fontSize: 10, color: '#78716c', lineHeight: 1.4 }}>{e.subtitle}</div>
              ) : null}
              <div style={{ position: 'absolute', bottom: 12, right: 12, fontSize: 10, color: '#57534e' }}>
                나비 {e.butterflyScore}
              </div>
            </div>
          </button>
        ))}
      </div>

      {selected ? (
        <div
          role="dialog"
          aria-modal
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 8800,
            background: 'rgba(2,6,23,0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setSelected(null)}
        >
          <div
            onClick={ev => ev.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              maxHeight: '90vh',
              overflow: 'auto',
              borderRadius: 16,
              border: '2px solid rgba(251,191,36,0.35)',
              background: 'linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%)',
              padding: '22px 20px',
              boxShadow: '0 24px 80px rgba(0,0,0,0.65)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 900, color: '#fde68a', letterSpacing: '0.2em' }}>영광의 통계</p>
                <h3 style={{ margin: '8px 0 0', fontSize: 20, fontWeight: 900, color: '#fafaf9' }}>{selected.title}</h3>
                {selected.subtitle ? <p style={{ margin: '6px 0 0', fontSize: 12, color: '#94a3b8' }}>{selected.subtitle}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                style={{
                  border: 'none',
                  background: 'rgba(148,163,184,0.2)',
                  color: '#e2e8f0',
                  borderRadius: 8,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                닫기
              </button>
            </div>

            <div style={{ position: 'relative', height: 120, margin: '18px 0', overflow: 'hidden' }}>
              {Array.from({ length: 14 }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${6 + (i * 11) % 82}%`,
                    bottom: 8 + (i % 4) * 3,
                    fontSize: 12 + (i % 3),
                    opacity: 0.88,
                    animation: `lg-butterfly ${2.4 + (i % 5) * 0.15}s ease-in-out infinite`,
                    animationDelay: `${i * 0.12}s`,
                  }}
                >
                  🦋
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <StatBar label="몰입(포모도로) 추정 시간" value={formatMin(selected.stats.pomodoroMinutesTotal)} pct={88} color="#38bdf8" />
              <StatBar label="획득 EXP (추정)" value={`${selected.stats.totalExpEst.toLocaleString()} XP`} pct={72} color="#4ade80" />
              <StatBar
                label="격파한 하위 퀘스트"
                value={`${selected.stats.subQuestsCleared}건`}
                pct={Math.min(100, selected.stats.subQuestsCleared * 7)}
                color="#f472b6"
              />
              <StatBar label="몰입 세션 수" value={`${selected.stats.sessionsCount}회`} pct={65} color="#fbbf24" />
              <div
                style={{
                  marginTop: 8,
                  padding: 12,
                  borderRadius: 10,
                  background: 'rgba(15,23,42,0.65)',
                  border: '1px solid rgba(99,102,241,0.35)',
                }}
              >
                <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#a5b4fc', letterSpacing: '0.1em' }}>나비효과 지수</p>
                <div style={{ marginTop: 8, height: 10, borderRadius: 999, background: 'rgba(0,0,0,0.35)' }}>
                  <div
                    style={{
                      width: `${selected.butterflyScore}%`,
                      height: '100%',
                      borderRadius: 999,
                      background: 'linear-gradient(90deg, #6366f1, #c084fc, #f472b6)',
                    }}
                  />
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 11, color: '#cbd5e1' }}>
                  이 유산이 다른 목표에 퍼져 나간 파급을 상징합니다 (서사 지표).
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <DialogueBox
        open={recallOpen}
        speaker="【과거의 화신】"
        onDismiss={() => setRecallOpen(false)}
      >
        {`「${recallTitle}」에서의 한 줄입니다.\n\n${recallText}\n\n과거의 당신이 오늘의 당신을 응원합니다.`}
      </DialogueBox>
    </div>
  )
}

function StatBar({
  label,
  value,
  pct,
  color,
}: {
  label: string
  value: string
  pct: number
  color: string
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, color: '#94a3b8' }}>
        <span>{label}</span>
        <span style={{ color: '#f8fafc', fontWeight: 800 }}>{value}</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: 'rgba(0,0,0,0.4)' }}>
        <div
          style={{
            width: `${Math.min(100, pct)}%`,
            height: '100%',
            borderRadius: 999,
            background: `linear-gradient(90deg, ${color}66, ${color})`,
          }}
        />
      </div>
    </div>
  )
}
