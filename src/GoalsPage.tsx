import { useState, useEffect, useCallback } from 'react'
import { kvSet } from './lib/supabase'
import { GOALS_KV_KEY } from './kvSyncedKeys'

type GoalsPayload = { text: string }

function readGoalsTextFromStorage(): string {
  try {
    const raw = localStorage.getItem(GOALS_KV_KEY)
    if (!raw) return ''
    try {
      const p = JSON.parse(raw) as unknown
      if (typeof p === 'object' && p !== null && 'text' in p && typeof (p as GoalsPayload).text === 'string') {
        return (p as GoalsPayload).text
      }
    } catch {
      return raw
    }
  } catch {
    /* ignore */
  }
  return ''
}

/** 인생 목표 — app_kv + localStorage */
export function GoalsPage() {
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setText(readGoalsTextFromStorage())
  }, [])

  const save = useCallback(() => {
    const payload: GoalsPayload = { text }
    try {
      localStorage.setItem(GOALS_KV_KEY, JSON.stringify(payload))
      void kvSet(GOALS_KV_KEY, payload)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1500)
    } catch {
      /* ignore */
    }
  }, [text])

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: 'clamp(16px, 4vw, 36px) clamp(14px, 4vw, 48px) 48px' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 800, color: '#37352F' }}>Goals</h1>
      <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#787774', lineHeight: 1.6 }}>
        인생의 목표를 자유롭게 적어 두세요. Supabase(app_kv)에 동기화됩니다.
      </p>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() => void save()}
        placeholder="예: 5년 안에 · 건강 · 관계 · 일 · 재정 · 배움…"
        style={{
          width: '100%',
          minHeight: '280px',
          padding: '16px',
          fontSize: '15px',
          lineHeight: 1.6,
          borderRadius: '12px',
          border: '1px solid rgba(0,0,0,0.08)',
          backgroundColor: '#fafafa',
          color: '#37352F',
          resize: 'vertical',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => void save()}
          style={{
            padding: '10px 20px',
            borderRadius: '999px',
            border: 'none',
            background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          저장
        </button>
        {saved && <span style={{ fontSize: '13px', color: '#34d399', fontWeight: 600 }}>저장됨</span>}
      </div>
    </div>
  )
}
