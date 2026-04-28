'use client'
import { useEffect, useState } from 'react'
import { colors, spacing, radius, typography } from '@/lib/theme'

const DISMISSED_KEY = 'inka_install_dismissed'
const DISMISS_TTL = 7 * 24 * 60 * 60 * 1000

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return
    const dismissed = localStorage.getItem(DISMISSED_KEY)
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_TTL) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setTimeout(() => setVisible(true), 5000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setVisible(false)
    setDeferredPrompt(null)
  }

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    setVisible(false)
  }

  if (!visible || !deferredPrompt) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 88,
      left: spacing.md,
      right: spacing.md,
      zIndex: 90,
      background: colors.surfaceElevated,
      borderRadius: radius.lg,
      border: `0.5px solid ${colors.border}`,
      padding: spacing.md,
      display: 'flex',
      alignItems: 'center',
      gap: spacing.md,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      animation: 'fadeInUp 250ms var(--ease-enter) both',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: radius.md, flexShrink: 0,
        background: 'var(--accent-gradient)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: '#fff', fontSize: 22, fontWeight: 900, lineHeight: 1 }}>I</span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: typography.sm.fontSize, fontWeight: 700, color: colors.textPrimary, marginBottom: 2 }}>
          Installer Inka
        </div>
        <div style={{ fontSize: typography.xs.fontSize, color: colors.textSecondary, lineHeight: 1.4 }}>
          Accès rapide depuis l&apos;écran d&apos;accueil
        </div>
      </div>

      <div style={{ display: 'flex', gap: spacing.sm, flexShrink: 0 }}>
        <button
          onClick={dismiss}
          style={{
            background: 'transparent',
            border: `0.5px solid ${colors.border}`,
            borderRadius: radius.full,
            color: colors.textMuted,
            fontSize: typography.xs.fontSize,
            padding: '6px 12px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Plus tard
        </button>
        <button
          onClick={install}
          style={{
            background: 'var(--accent-gradient)',
            border: 'none',
            borderRadius: radius.full,
            color: '#fff',
            fontSize: typography.xs.fontSize,
            fontWeight: 600,
            padding: '6px 14px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Installer
        </button>
      </div>
    </div>
  )
}
