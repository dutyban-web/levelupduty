/**
 * 성장 루프 — 스킬 트리 · 비밀 상점 · 업적의 전당
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SkillTreeView } from './SkillTreeView'
import { RewardShopView } from './RewardShopView'
import { AchievementsHallView } from './AchievementsHallView'
import { LegacyGalleryView } from './LegacyGalleryView'

type GrowthTab = 'skill' | 'shop' | 'achievements' | 'archive'

const TABS: { id: GrowthTab; label: string; emoji: string }[] = [
  { id: 'skill', label: '스킬 트리', emoji: '🌳' },
  { id: 'shop', label: '비밀 상점', emoji: '🔥' },
  { id: 'achievements', label: '업적의 전당', emoji: '🏛️' },
  { id: 'archive', label: '인과율 서고', emoji: '📜' },
]

export function GrowthPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as GrowthTab | null
  const [tab, setTab] = useState<GrowthTab>(() =>
    tabParam === 'shop' || tabParam === 'achievements' || tabParam === 'archive' ? tabParam : 'skill',
  )

  useEffect(() => {
    const t = searchParams.get('tab') as GrowthTab | null
    if (t === 'shop' || t === 'achievements' || t === 'skill' || t === 'archive') setTab(t)
  }, [searchParams])

  const selectTab = (id: GrowthTab) => {
    setTab(id)
    setSearchParams(prev => {
      const n = new URLSearchParams(prev)
      if (id === 'skill') n.delete('tab')
      else n.set('tab', id)
      return n
    }, { replace: true })
  }

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '22px 16px 48px',
        minHeight: '70vh',
        background: 'linear-gradient(180deg, #fafaf9 0%, #e7e5e4 40%, #d6d3d1 100%)',
      }}
    >
      <header style={{ marginBottom: 18 }}>
        <h1
          style={{
            margin: '0 0 8px',
            fontSize: 22,
            fontWeight: 900,
            color: '#1c1917',
            letterSpacing: '-0.03em',
            textShadow: '0 1px 0 rgba(255,255,255,0.4)',
          }}
        >
          Skill & Reward
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: '#57534e', lineHeight: 1.55 }}>
          가죽 장정과 대장간 불꽃을 모티브로, 퀘스트로 쌓인 골드와 스킬 XP가 한 화면에서 이어집니다. 긴급 프로젝트 레이드는 상단 GNB의{' '}
          <strong>Raid</strong>에서 열 수 있습니다.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="성장 메뉴"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}
      >
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => selectTab(t.id)}
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              border: tab === t.id ? '2px solid #ea580c' : '1px solid rgba(0,0,0,0.1)',
              background:
                tab === t.id
                  ? 'linear-gradient(180deg, rgba(251,191,36,0.35), #fffefb)'
                  : 'rgba(255,255,255,0.75)',
              color: tab === t.id ? '#9a3412' : '#78716c',
              fontWeight: tab === t.id ? 900 : 600,
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: tab === t.id ? '0 4px 14px rgba(234,88,12,0.2)' : 'none',
            }}
          >
            <span style={{ marginRight: 6 }}>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div
        style={{
          padding: tab === 'archive' ? 0 : 18,
          borderRadius: 16,
          background:
            tab === 'archive'
              ? 'linear-gradient(180deg, #0c0a09 0%, #1c1917 100%)'
              : 'linear-gradient(180deg, #fffefb 0%, #f5f5f4 100%)',
          border: tab === 'archive' ? '2px solid #44403c' : '2px solid #a8a29e',
          boxShadow:
            tab === 'archive'
              ? '0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(251,191,36,0.06)'
              : '0 12px 40px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
      >
        {tab === 'skill' && <SkillTreeView />}
        {tab === 'shop' && <RewardShopView />}
        {tab === 'achievements' && <AchievementsHallView />}
        {tab === 'archive' && (
          <div style={{ padding: 18 }}>
            <LegacyGalleryView />
          </div>
        )}
      </div>
    </div>
  )
}
