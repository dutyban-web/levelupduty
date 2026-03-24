/**
 * 90년대 VN풍 대사창 — 상점·서사 연출용
 */
import type { CSSProperties, ReactNode } from 'react'

export type DialogueBoxVariant = 'oracle' | 'merchant'

const VARIANT_STYLES: Record<
  DialogueBoxVariant,
  { panel: CSSProperties; speaker: CSSProperties; body: CSSProperties; hint: string }
> = {
  oracle: {
    panel: {
      border: '3px solid #e2e8f0',
      background: 'linear-gradient(180deg, rgba(30,64,175,0.94), rgba(15,23,42,0.98))',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)',
    },
    speaker: {
      color: '#fde68a',
      textShadow: '0 1px 0 rgba(0,0,0,0.6)',
    },
    body: {
      color: '#f8fafc',
      textShadow: '0 1px 2px rgba(0,0,0,0.75)',
    },
    hint: '클릭하여 닫기',
  },
  merchant: {
    panel: {
      border: '2px solid #b45309',
      background: 'linear-gradient(180deg, rgba(20,83,45,0.96), rgba(6,24,12,0.99))',
      boxShadow: '0 -6px 28px rgba(0,0,0,0.55), inset 0 1px 0 rgba(253,230,138,0.15)',
    },
    speaker: {
      color: '#fef08a',
      textShadow: '0 1px 0 rgba(0,0,0,0.75)',
    },
    body: {
      color: '#f0fdf4',
      textShadow: '0 1px 3px rgba(0,0,0,0.85)',
    },
    hint: '클릭하여 닫기',
  },
}

export function DialogueBox({
  open,
  speaker,
  children,
  onDismiss,
  variant = 'oracle',
}: {
  open: boolean
  speaker: string
  children: ReactNode
  onDismiss: () => void
  variant?: DialogueBoxVariant
}) {
  if (!open) return null
  const vs = VARIANT_STYLES[variant]
  return (
    <div
      role="dialog"
      aria-modal
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9500,
        padding: '16px 14px calc(16px + env(safe-area-inset-bottom, 0px))',
        background: 'linear-gradient(180deg, transparent, rgba(2,6,23,0.5))',
        pointerEvents: 'auto',
      }}
      onClick={onDismiss}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 720,
          margin: '0 auto',
          borderRadius: 4,
          padding: '14px 16px 16px',
          fontFamily: '"Georgia", "Nanum Myeongjo", "Malgun Gothic", serif',
          ...vs.panel,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.12em',
            marginBottom: 8,
            ...vs.speaker,
          }}
        >
          {speaker}
        </div>
        <div
          style={{
            fontSize: 15,
            lineHeight: 1.65,
            whiteSpace: 'pre-wrap',
            ...vs.body,
          }}
        >
          {children}
        </div>
        <div style={{ marginTop: 12, fontSize: 10, color: '#94a3b8', textAlign: 'right' }}>{vs.hint}</div>
      </div>
    </div>
  )
}
