'use client'
import { colors, radius, spacing } from '@/lib/theme'
import { ReactNode, useEffect } from 'react'

interface BottomSheetProps {
  visible: boolean
  onClose: () => void
  children: ReactNode
  title?: string
}

export function BottomSheet({ visible, onClose, children, title }: BottomSheetProps) {
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [visible])

  if (!visible) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />

      {/* Sheet */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: colors.surfaceElevated,
        borderTopLeftRadius: radius.xl,
        borderTopRightRadius: radius.xl,
        padding: spacing.lg,
        maxHeight: '80vh',
        overflowY: 'auto',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: colors.border, margin: '0 auto', marginBottom: spacing.lg }} />
        {title && (
          <div style={{ color: colors.textPrimary, fontSize: 17, fontWeight: 600, marginBottom: spacing.lg, textAlign: 'center' }}>
            {title}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
