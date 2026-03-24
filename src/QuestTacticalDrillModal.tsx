/**
 * 분석 마비 해제 — 5-Whys 스타일 드릴 후 하위 퀘스트(WBS) 제안
 */
import { useState, type CSSProperties } from 'react'
import { X } from 'lucide-react'

export type DrillQuestRef = { id: string; name: string }

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  backdropFilter: 'blur(6px)',
  zIndex: 600,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
}

const panel: CSSProperties = {
  width: 'min(480px, 100%)',
  maxHeight: 'min(88vh, 720px)',
  overflow: 'auto',
  background: '#fff',
  borderRadius: 16,
  border: '1px solid rgba(0,0,0,0.08)',
  boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
  padding: '20px 22px',
}

const WHY_PROMPTS = [
  '왜 시작하기 힘들지? (겉으로 보이는 이유)',
  '그게 왜 문제인가? (한 단계 더)',
  '그 원인의 뿌리는? (환경·두려움·피로 등)',
  '지금 당장 막는 건 무엇인가?',
  '진짜로 필요한 최소 한 걸음은?',
] as const

function buildSubQuestTitles(parentName: string, answers: string[]): string[] {
  const short = parentName.trim().slice(0, 32) || '이 일'
  const a = answers.map(x => x.trim().slice(0, 40)).filter(Boolean)
  const tail = (i: number) => a[i] || '다음 단계'
  return [
    `[WBS 1/5] ${short} — 준비·환경 정리 (${tail(0)})`,
    `[WBS 2/5] ${short} — 최소 입력·초안/시작 (${tail(1)})`,
    `[WBS 3/5] ${short} — 핵심 한 덩어리만 처리 (${tail(2)})`,
    `[WBS 4/5] ${short} — 막힌 지점 점검 (${tail(3)})`,
    `[WBS 5/5] ${short} — 마무리·다음 액션 확정 (${tail(4)})`,
  ]
}

export function QuestTacticalDrillModal({
  open,
  quest,
  onClose,
  onCommit,
}: {
  open: boolean
  quest: DrillQuestRef | null
  onClose: () => void
  onCommit: (titles: string[]) => void
}) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<string[]>(() => Array(5).fill(''))

  if (!open || !quest) return null

  const promptIdx = Math.min(step, WHY_PROMPTS.length - 1)
  const isWhyPhase = step < 5

  const handleNext = () => {
    if (isWhyPhase) {
      setStep(s => s + 1)
      return
    }
    const titles = buildSubQuestTitles(quest.name, answers)
    onCommit(titles)
    setStep(0)
    setAnswers(Array(5).fill(''))
    onClose()
  }

  return (
    <div style={overlay} role="dialog" aria-modal aria-labelledby="drill-title">
      <div style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#6366f1', letterSpacing: '0.12em' }}>TACTICAL DRILL</p>
            <h2 id="drill-title" style={{ margin: '6px 0 0', fontSize: 17, fontWeight: 900, color: '#37352F' }}>
              AI 쪼개기 · 5-Whys
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#787774', lineHeight: 1.5 }}>
              대상: <strong style={{ color: '#4F46E5' }}>{quest.name}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setStep(0); setAnswers(Array(5).fill('')); onClose() }}
            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 6, color: '#9B9A97' }}
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        {isWhyPhase ? (
          <>
            <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#37352F' }}>
              {WHY_PROMPTS[promptIdx]}
            </p>
            <textarea
              value={answers[promptIdx] ?? ''}
              onChange={e => {
                const v = e.target.value
                setAnswers(prev => {
                  const n = [...prev]
                  n[promptIdx] = v
                  return n
                })
              }}
              placeholder="짧게 적어도 됩니다. 분석 마비를 피하기 위해 속도가 우선입니다."
              rows={4}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.1)',
                fontSize: 13,
                lineHeight: 1.5,
                resize: 'vertical',
                fontFamily: 'inherit',
                marginBottom: 14,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: '#9B9A97' }}>{promptIdx + 1} / 5</span>
              <button
                type="button"
                onClick={handleNext}
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#6366f1',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {promptIdx < 4 ? '다음' : '원인 정리 완료'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#37352F', lineHeight: 1.55 }}>
              아래 5개의 하위 퀘스트로 나누어 퀘스트 보드에 추가합니다. 필요하면 노트에서 이름을 다듬으세요.
            </p>
            <ol style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: 12, color: '#37352F', lineHeight: 1.6 }}>
              {buildSubQuestTitles(quest.name, answers).map((t, i) => (
                <li key={i} style={{ marginBottom: 6 }}>{t}</li>
              ))}
            </ol>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setStep(4)}
                style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                이전
              </button>
              <button
                type="button"
                onClick={handleNext}
                style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#6366f1)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
              >
                보드에 5개 추가
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
