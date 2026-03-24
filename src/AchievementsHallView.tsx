/**
 * 업적의 전당 — 전설 배지 그리드
 */
import { useState } from 'react'
import {
  ACHIEVEMENT_DEFINITIONS,
  loadAchievementsState,
  lockAchievement,
  tierLabel,
  unlockAchievement,
  type AchievementDef,
} from './achievementsData'

export function AchievementsHallView() {
  const [state, setState] = useState(loadAchievementsState)

  const toggleUnlock = (def: AchievementDef) => {
    const unlocked = state.unlockedIds.includes(def.id)
    if (unlocked) {
      if (!window.confirm('이 업적을 다시 잠글까요? (시연용)')) return
      setState(lockAchievement(def.id))
      return
    }
    if (!window.confirm(`「${def.title}」 업적을 해금할까요? (실제 경력에 맞게 기록하세요.)`)) return
    setState(unlockAchievement(def.id))
  }

  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#57534e', lineHeight: 1.55 }}>
        전설 등급 훈장은 미리 새겨 두었습니다. 본인의 경력과 맞을 때 <strong>패널을 눌러 해금</strong>하세요.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {ACHIEVEMENT_DEFINITIONS.map(def => {
          const unlocked = state.unlockedIds.includes(def.id)
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => toggleUnlock(def)}
              style={{
                textAlign: 'left',
                padding: 14,
                borderRadius: 14,
                border: unlocked ? '2px solid #fbbf24' : '2px solid #78716c',
                background: unlocked
                  ? 'linear-gradient(145deg, rgba(251,191,36,0.15), rgba(28,25,23,0.95))'
                  : 'linear-gradient(145deg, #292524, #1c1917)',
                cursor: 'pointer',
                boxShadow: unlocked ? '0 0 20px rgba(251,191,36,0.25)' : 'inset 0 0 0 1px rgba(0,0,0,0.3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 28, filter: unlocked ? undefined : 'grayscale(1) opacity(0.45)' }}>{def.emoji}</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: unlocked ? '#fde68a' : '#78716c',
                    letterSpacing: '0.06em',
                  }}
                >
                  {tierLabel(def.tier)}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 900, color: unlocked ? '#fafaf9' : '#a8a29e' }}>{def.title}</div>
              <div style={{ fontSize: 11, color: unlocked ? '#d6d3d1' : '#57534e', marginTop: 6, lineHeight: 1.45 }}>
                {def.description}
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: unlocked ? '#22c55e' : '#78716c' }}>
                {unlocked ? '해금됨 · 다시 누르면 잠금(시연)' : '잠김 · 눌러 해금'}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
