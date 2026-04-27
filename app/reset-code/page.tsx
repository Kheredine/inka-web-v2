'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { colors, spacing, radius, typography } from '@/lib/theme'

export default function ResetCodePage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [newPin, setNewPin] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) return
    setLoading(true)
    setError(null)

    const res = await fetch('/api/auth/reset-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim() }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Erreur lors de la réinitialisation')
      setLoading(false)
      return
    }

    setNewPin(data.pin)
    setDone(true)
    setLoading(false)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(newPin)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <main style={{ minHeight: '100dvh', background: colors.background, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
      <div style={{ width: '100%', maxWidth: 360 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: spacing.xxl }}>
          <div style={{ width: 72, height: 72, borderRadius: radius.xl, background: 'linear-gradient(135deg, #FF6A00, #D94F2A)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', marginBottom: spacing.lg }}>
            <span style={{ fontSize: 36, fontWeight: 700, color: '#fff' }}>I</span>
          </div>
          <h1 style={{ color: colors.textPrimary, fontSize: typography.xxl.fontSize, fontWeight: 700, letterSpacing: 2, margin: 0 }}>Inka</h1>
          <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, marginTop: spacing.xs }}>Nouveau code</p>
        </div>

        {!done ? (
          <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
            <div>
              <label style={{ display: 'block', color: colors.textMuted, fontSize: typography.xs.fontSize, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>Ton prénom ou pseudo</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: Karyl"
                autoFocus
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
              <p style={{ color: colors.textMuted, fontSize: typography.xs.fontSize, marginTop: spacing.xs }}>
                Un nouveau code à 4 chiffres sera généré pour toi.
              </p>
            </div>

            {error && (
              <p style={{ color: colors.error, fontSize: typography.sm.fontSize, textAlign: 'center', margin: 0 }}>
                {error}
              </p>
            )}

            <Button label="Réinitialiser mon code" loading={loading} type="submit" disabled={!username.trim()} />

            <div style={{ textAlign: 'center' }}>
              <Link href="/login" style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, textDecoration: 'none' }}>
                Retour à la connexion
              </Link>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>

            {/* Warning */}
            <div style={{ background: `${colors.primary}18`, border: `1px solid ${colors.primary}44`, borderRadius: radius.lg, padding: spacing.md, textAlign: 'center' }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ color: colors.primary, fontSize: 20, marginBottom: spacing.sm, display: 'block' }} />
              <p style={{ color: colors.primary, fontSize: typography.sm.fontSize, fontWeight: 600, margin: 0 }}>
                Voici ton nouveau code !
              </p>
              <p style={{ color: colors.textSecondary, fontSize: typography.xs.fontSize, margin: `${spacing.xs}px 0 0` }}>
                Mémorise-le ou copie-le maintenant.
              </p>
            </div>

            {/* Code display */}
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: colors.textMuted, fontSize: typography.xs.fontSize, marginBottom: spacing.sm, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Nouveau code pour <strong style={{ color: colors.textPrimary }}>{username}</strong>
              </p>
              <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'center', marginBottom: spacing.md }}>
                {newPin.split('').map((digit, i) => (
                  <div key={i} style={{ width: 56, height: 64, background: colors.surface, border: `2px solid ${colors.primary}`, borderRadius: radius.md, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: colors.textPrimary }}>
                    {digit}
                  </div>
                ))}
              </div>

              <button
                onClick={handleCopy}
                style={{
                  background: copied ? `${colors.primary}22` : colors.surface,
                  border: `1px solid ${copied ? colors.primary : colors.border}`,
                  borderRadius: radius.md,
                  padding: `${spacing.sm}px ${spacing.lg}px`,
                  color: copied ? colors.primary : colors.textSecondary,
                  fontSize: typography.sm.fontSize,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: spacing.sm,
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`} />
                {copied ? 'Copié !' : 'Copier le code'}
              </button>
            </div>

            <button
              onClick={() => router.push(`/login?username=${encodeURIComponent(username.trim())}&code=${newPin}`)}
              style={{
                width: '100%',
                padding: `${spacing.md}px`,
                borderRadius: radius.lg,
                background: 'linear-gradient(135deg, #FF6A00, #D94F2A)',
                border: 'none',
                color: '#fff',
                fontSize: typography.base.fontSize,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.sm,
                fontFamily: 'inherit',
              }}
            >
              <i className="fa-solid fa-arrow-right" />
              Me connecter
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
