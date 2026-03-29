import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { sendEmailOtp, verifyEmailOtp } from '../supabase'

const RESEND_COOLDOWN_SEC = 60
const OTP_ERR = '코드가 올바르지 않거나 만료되었습니다.'

export interface OtpVerifyScreenProps {
  email: string
  onSuccess: () => void
  onBack: () => void
  /** verifyOtp 직전에 호출 (예: 앱 게이트에서 비밀번호 세션 무시 플래그 해제) */
  prepareVerify?: () => void
}

export function OtpVerifyScreen({ email, onSuccess, onBack, prepareVerify }: OtpVerifyScreenProps) {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const verifyingRef = useRef(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setInterval(() => {
      setCooldown(c => (c <= 1 ? 0 : c - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [cooldown])

  const handleVerify = useCallback(
    async (code: string) => {
      const t = code.replace(/\D/g, '').slice(0, 6)
      if (t.length !== 6 || verifyingRef.current) return
      verifyingRef.current = true
      setLoading(true)
      setError('')
      try {
        prepareVerify?.()
        await verifyEmailOtp(email, t)
        onSuccess()
      } catch {
        setError(OTP_ERR)
      } finally {
        verifyingRef.current = false
        setLoading(false)
      }
    },
    [email, onSuccess, prepareVerify],
  )

  const onTokenChange = (raw: string) => {
    const next = raw.replace(/\D/g, '').slice(0, 6)
    setToken(next)
    setError('')
    if (next.length === 6) void handleVerify(next)
  }

  const resend = async () => {
    if (cooldown > 0 || loading) return
    setError('')
    setLoading(true)
    try {
      await sendEmailOtp(email)
      setCooldown(RESEND_COOLDOWN_SEC)
    } catch {
      setError('코드를 다시 보내지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  const fontSans = "'Noto Sans KR', system-ui, sans-serif"
  const inp: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '14px 16px',
    borderRadius: '2px',
    border: '1px solid rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    color: '#f1f5f9',
    fontSize: '20px',
    fontFamily: fontSans,
    letterSpacing: '0.35em',
    textAlign: 'center',
    outline: 'none',
    marginBottom: '14px',
  }

  return (
    <>
      <style>{`
        .otp-verify input::placeholder { color: rgba(241,245,249,0.28); }
      `}</style>
      <div className="otp-verify" style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
        <p
          style={{
            margin: '0 0 20px',
            fontSize: '13px',
            color: 'rgba(226, 214, 180, 0.92)',
            lineHeight: 1.6,
            textAlign: 'center',
            fontWeight: 500,
          }}
        >
          <strong style={{ color: '#f1f5f9' }}>{email}</strong>
          로 인증 코드를 발송했습니다.
        </p>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={token}
          onChange={e => onTokenChange(e.target.value)}
          placeholder="6자리 코드"
          disabled={loading}
          aria-label="인증 코드 6자리"
          style={inp}
          onFocus={e => {
            e.target.style.borderColor = 'rgba(226, 214, 180, 0.45)'
            e.target.style.backgroundColor = 'rgba(0,0,0,0.5)'
          }}
          onBlur={e => {
            e.target.style.borderColor = 'rgba(255,255,255,0.18)'
            e.target.style.backgroundColor = 'rgba(0,0,0,0.35)'
          }}
        />
        {error && (
          <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#fca5a5', textAlign: 'center', fontWeight: 500, lineHeight: 1.5 }}>
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => void handleVerify(token)}
          disabled={loading || token.length !== 6}
          style={{
            width: '100%',
            padding: '14px 16px',
            marginBottom: '10px',
            borderRadius: '2px',
            border: '1px solid rgba(255,255,255,0.12)',
            cursor: loading || token.length !== 6 ? 'default' : 'pointer',
            fontFamily: fontSans,
            fontSize: '14px',
            fontWeight: 600,
            letterSpacing: '0.06em',
            color: '#e8e4dc',
            background: loading || token.length !== 6 ? 'rgba(35,38,48,0.95)' : 'rgba(28,32,42,0.95)',
            transition: 'background 0.2s, border-color 0.2s',
          }}
        >
          {loading ? '확인 중…' : '인증하기'}
        </button>
        <button
          type="button"
          onClick={() => void resend()}
          disabled={loading || cooldown > 0}
          style={{
            width: '100%',
            padding: '12px 16px',
            marginBottom: '10px',
            borderRadius: '2px',
            border: '1px solid rgba(255,255,255,0.1)',
            cursor: loading || cooldown > 0 ? 'default' : 'pointer',
            fontFamily: fontSans,
            fontSize: '12px',
            fontWeight: 600,
            color: cooldown > 0 ? 'rgba(241,245,249,0.35)' : 'rgba(226, 214, 180, 0.85)',
            background: 'rgba(0,0,0,0.25)',
          }}
        >
          {cooldown > 0 ? `코드 재발송 (${cooldown}초)` : '코드 재발송'}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px 16px',
            border: 'none',
            background: 'transparent',
            cursor: loading ? 'default' : 'pointer',
            fontFamily: fontSans,
            fontSize: '12px',
            fontWeight: 500,
            color: 'rgba(241,245,249,0.45)',
            textDecoration: 'underline',
          }}
        >
          뒤로 — 이메일 다시 입력
        </button>
      </div>
    </>
  )
}
