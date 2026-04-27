'use client'
import { useToastStore } from '@/stores/toastStore'
import { colors, spacing, radius, typography } from '@/lib/theme'

export function ToastContainer() {
  const { toasts, dismiss } = useToastStore()
  if (!toasts.length) return null

  return (
    <div style={{
      position: 'fixed', bottom: 148, left: 0, right: 0,
      zIndex: 9000,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: spacing.sm, pointerEvents: 'none',
      padding: `0 ${spacing.lg}px`,
    }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          style={{
            pointerEvents: 'auto',
            background: colors.surfaceElevated,
            border: `0.5px solid ${t.type === 'error' ? colors.error : t.type === 'info' ? colors.border : '#4CAF5066'}`,
            borderRadius: radius.lg,
            padding: `${spacing.sm + 2}px ${spacing.md}px`,
            fontSize: typography.sm.fontSize,
            fontWeight: 500,
            color: colors.textPrimary,
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', gap: spacing.sm,
            maxWidth: 360, width: '100%',
            cursor: 'pointer',
            animation: 'toast-in 0.2s ease',
          }}
        >
          {t.type === 'success' && <i className="fa-solid fa-circle-check" style={{ color: '#4CAF50', fontSize: 15, flexShrink: 0 }} />}
          {t.type === 'error'   && <i className="fa-solid fa-circle-exclamation" style={{ color: colors.error, fontSize: 15, flexShrink: 0 }} />}
          {t.type === 'info'    && <i className="fa-solid fa-circle-info" style={{ color: 'var(--accent)', fontSize: 15, flexShrink: 0 }} />}
          <span style={{ flex: 1 }}>{t.message}</span>
          <i className="fa-solid fa-xmark" style={{ color: colors.textMuted, fontSize: 12, flexShrink: 0 }} />
        </div>
      ))}
    </div>
  )
}
