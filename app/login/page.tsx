'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { colors, spacing, radius, typography } from '@/lib/theme'

function LoginForm() {
  const { signIn } = useAuthStore()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [username, setUsername] = useState(searchParams.get('username') ?? '')
  const [pin, setPin] = useState(['', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRefs = useRef<Array<HTMLInputElement | null>>([null, null, null, null])

  useEffect(() => {
    const prefill = searchParams.get('code')
    if (prefill && prefill.length === 4) {
      setPin(prefill.split(''))
    }
  }, [])

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    const next = [...pin]
    next[index] = value
    setPin(next)
    if (value && index < 3) inputRefs.current[index + 1]?.focus()
  }

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePinPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (text.length === 4) {
      setPin(text.split(''))
      inputRefs.current[3]?.focus()
      e.preventDefault()
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const fullPin = pin.join('')
    if (!username.trim() || fullPin.length !== 4) return

    // Admin shortcut — no Supabase account needed
    if (username.trim().toLowerCase() === 'admin' && fullPin === '0000') {
      sessionStorage.setItem('inka_admin', '1')
      router.replace('/admin')
      return
    }

    setLoading(true)
    setError(null)
    const { error } = await signIn(username.trim(), fullPin)
    if (error) {
      setError(error)
      setLoading(false)
    } else {
      router.replace('/feed')
    }
  }

  const pinFilled = pin.every(Boolean)

  return (
    <main style={{ minHeight: '100dvh', background: colors.background, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
      <div style={{ width: '100%', maxWidth: 360 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: spacing.xxl }}>
          <div style={{ width: 72, height: 72, borderRadius: radius.xl, background: 'linear-gradient(135deg, #FF6A00, #D94F2A)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', marginBottom: spacing.lg }}>
            <span style={{ fontSize: 36, fontWeight: 700, color: '#fff' }}>I</span>
          </div>
          <h1 style={{ color: colors.textPrimary, fontSize: typography.xxl.fontSize, fontWeight: 700, letterSpacing: 2, margin: 0 }}>Inka</h1>
          <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, marginTop: spacing.xs, letterSpacing: 0.5 }}>Audio. Famille. Partage.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>

          {/* Username */}
          <div>
            <label style={{ display: 'block', color: colors.textMuted, fontSize: typography.xs.fontSize, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>Ton nom</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ex: Karyl"
              autoComplete="username"
              autoCapitalize="words"
              required
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                padding: `${spacing.md}px ${spacing.lg}px`,
                color: colors.textPrimary,
                fontSize: typography.base.fontSize,
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* PIN digits */}
          <div>
            <label style={{ display: 'block', color: colors.textMuted, fontSize: typography.xs.fontSize, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>Code à 4 chiffres</label>
            <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'center' }} onPaste={handlePinPaste}>
              {pin.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el }}
                  type="tel"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinChange(i, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(i, e)}
                  style={{
                    width: 56,
                    height: 64,
                    background: colors.surface,
                    border: `1px solid ${digit ? colors.primary : colors.border}`,
                    borderRadius: radius.md,
                    color: colors.textPrimary,
                    fontSize: 28,
                    fontWeight: 700,
                    textAlign: 'center',
                    outline: 'none',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.15s',
                  }}
                />
              ))}
            </div>
          </div>

          {error && (
            <p style={{ color: colors.error, fontSize: typography.sm.fontSize, textAlign: 'center', margin: 0 }}>
              {error}
            </p>
          )}

          <Button label="Se connecter" loading={loading} type="submit" disabled={!username.trim() || !pinFilled} />
        </form>

        {/* Links */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: spacing.lg }}>
          <Link href="/reset-code" style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, textDecoration: 'none' }}>
            Code oublié ?
          </Link>
          <Link href="/register" style={{ color: colors.primary, fontSize: typography.sm.fontSize, textDecoration: 'none', fontWeight: 500 }}>
            Pas encore de compte ?
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
