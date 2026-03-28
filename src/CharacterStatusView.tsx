/**
 * 원형(분석가·창작자·자본가·모험가) + 태세 선택 + HP/MP — 현재 앱 기동 시에는 띄우지 않음.
 * Act 태세 전환의 상위 개념(존재 방식) UI로 재사용할 때 참고.
 */
import { useEffect, useMemo, useState } from 'react'
import type { IdentityRow } from './supabase'
import {
  ARCHETYPE_LABEL,
  identitiesForArchetype,
  type IdentityArchetype,
} from './identityArchetypeData'
import { acknowledgeMorningPresence } from './presenceData'
import { PixelSegmentBar } from './PixelGauges'
import { loadRpgProfile } from './levelupRpgProfile'
import { BL_RPG_SYNC } from './questRpgIntegration'

export function CharacterStatusView({
  identities,
  activeIdentityId,
  onSelectIdentity,
  onClose,
}: {
  identities: IdentityRow[]
  activeIdentityId: string | null
  onSelectIdentity: (id: string | null) => Promise<void>
  onClose: () => void
}) {
  const [arch, setArch] = useState<IdentityArchetype>('creator')
  const [selId, setSelId] = useState<string | null>(activeIdentityId)
  const [rpg, setRpg] = useState(loadRpgProfile)

  const filtered = useMemo(() => identitiesForArchetype(identities, arch), [identities, arch])

  const refresh = () => setRpg(loadRpgProfile())
  useEffect(() => {
    const h = () => refresh()
    window.addEventListener(BL_RPG_SYNC, h)
    return () => window.removeEventListener(BL_RPG_SYNC, h)
  }, [])

  const confirm = async () => {
    acknowledgeMorningPresence({ archetype: arch, identityId: selId })
    await onSelectIdentity(selId)
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9600,
        background: 'radial-gradient(ellipse at 50% 20%, rgba(30,27,26,0.97), #0c0a09 65%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <style>{`
        @keyframes status-glow {
          0%, 100% { box-shadow: 0 0 24px rgba(251,191,36,0.15); }
          50% { box-shadow: 0 0 40px rgba(251,191,36,0.35); }
        }
      `}</style>
      <div
        style={{
          width: '100%',
          maxWidth: 920,
          maxHeight: '92vh',
          overflow: 'auto',
          borderRadius: 16,
          border: '2px solid #44403c',
          background: 'linear-gradient(180deg, #1c1917 0%, #0f0e0d 100%)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)',
          padding: '20px 18px 22px',
          animation: 'status-glow 4s ease-in-out infinite',
        }}
      >
        <h2
          style={{
            margin: '0 0 6px',
            fontSize: 18,
            fontWeight: 900,
            color: '#fef3c7',
            letterSpacing: '0.04em',
            textShadow: '0 2px 8px rgba(0,0,0,0.8)',
          }}
        >
          오늘의 존재 방식
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: '#a8a29e', lineHeight: 1.55 }}>
          네 가지 원형 중 하나를 고르고, 그 아래에서 <strong style={{ color: '#fde68a' }}>태세(Identity)</strong>를 연결하세요.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
            marginBottom: 14,
          }}
        >
          {(Object.keys(ARCHETYPE_LABEL) as IdentityArchetype[]).map(k => {
            const meta = ARCHETYPE_LABEL[k]
            const on = arch === k
            return (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setArch(k)
                  setSelId(null)
                }}
                style={{
                  padding: '12px 8px',
                  borderRadius: 12,
                  border: on ? '2px solid #fbbf24' : '1px solid #57534e',
                  background: on ? 'linear-gradient(180deg, rgba(251,191,36,0.2), rgba(28,25,23,0.95))' : '#292524',
                  color: on ? '#fef3c7' : '#a8a29e',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                <div style={{ fontSize: 20 }}>{meta.emoji}</div>
                <div>{meta.label}</div>
                <div style={{ fontSize: 9, fontWeight: 600, marginTop: 4, opacity: 0.85 }}>{meta.blurb}</div>
              </button>
            )
          })}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#d6d3d1', marginBottom: 6 }}>태세 선택 — {ARCHETYPE_LABEL[arch].label}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {filtered.length === 0 ? (
              <span style={{ fontSize: 11, color: '#78716c' }}>
                이 원형에 맞는 Identity가 없습니다. Act 페이지에서 정체성 이름을 조정하거나 새로 만드세요.
              </span>
            ) : (
              filtered.map(i => {
                const on = selId === i.id
                return (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => setSelId(i.id)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 999,
                      border: on ? '2px solid #38bdf8' : '1px solid #44403c',
                      background: on ? 'rgba(56,189,248,0.15)' : '#1c1917',
                      color: on ? '#e0f2fe' : '#d6d3d1',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {i.name}
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: 'repeating-linear-gradient(90deg, #14532d 0px, #14532d 4px, #166534 4px, #166534 8px)',
            border: '2px solid #052e16',
            marginBottom: 14,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 900, color: '#bbf7d0', marginBottom: 8, letterSpacing: '0.08em' }}>
            STATUS
          </div>
          <PixelSegmentBar
            label="HP · 체력"
            current={rpg.hp[0]}
            max={rpg.hp[1]}
            fill="#4ade80"
            back="rgba(0,0,0,0.45)"
          />
          <PixelSegmentBar
            label="MP · 의지력 / 결정 에너지"
            current={rpg.mp[0]}
            max={rpg.mp[1]}
            fill="#38bdf8"
            back="rgba(0,0,0,0.45)"
          />
          <p style={{ margin: 0, fontSize: 10, color: '#dcfce7', lineHeight: 1.45, opacity: 0.9 }}>
            Lv.2 이상에서 우선순위 2+ 또는 보스/레이드 계열 퀘스트를 끝낼 때마다 MP가 소모됩니다.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={confirm}
            style={{
              padding: '12px 22px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(180deg, #ea580c, #9a3412)',
              color: '#fff',
              fontWeight: 900,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            오늘 이대로 시작
          </button>
        </div>
      </div>
    </div>
  )
}
