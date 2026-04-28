'use client'
import { useEffect, useState, useRef } from 'react'
import { spacing, typography } from '@/lib/theme'

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!navigator.onLine) {
      setIsOffline(true)
      setShowBanner(true)
    }

    const handleOffline = () => {
      clearTimeout(hideTimer.current)
      setIsOffline(true)
      setShowBanner(true)
    }

    const handleOnline = () => {
      setIsOffline(false)
      // Keep "back online" banner visible for 2.5s then hide
      hideTimer.current = setTimeout(() => setShowBanner(false), 2500)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      clearTimeout(hideTimer.current)
    }
  }, [])

  if (!showBanner) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 200,
      background: isOffline ? '#1c1c1e' : 'var(--accent)',
      color: '#fff',
      padding: `${spacing.sm}px ${spacing.md}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      fontSize: typography.xs.fontSize,
      fontWeight: 600,
      transition: 'background 300ms ease',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    }}>
      <i
        className={`fa-solid ${isOffline ? 'fa-wifi' : 'fa-circle-check'}`}
        style={{ fontSize: 12 }}
      />
      {isOffline ? 'Pas de connexion — certains contenus peuvent être indisponibles' : 'Connexion rétablie'}
    </div>
  )
}
