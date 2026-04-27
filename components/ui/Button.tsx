'use client'
import { colors, radius, spacing, typography } from '@/lib/theme'
import { CSSProperties, ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  loading?: boolean
  variant?: 'primary' | 'ghost'
  onPress?: () => void
}

export function Button({ label, loading, variant = 'primary', style, disabled, onPress, onClick, ...props }: ButtonProps) {
  const handleClick = onPress ?? onClick
  const isPrimary = variant === 'primary'

  const btn: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingInline: spacing.xl,
    paddingBlock: spacing.md,
    borderRadius: radius.md,
    border: 'none',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    fontSize: typography.base.fontSize,
    fontWeight: 600,
    opacity: disabled || loading ? 0.6 : 1,
    transition: 'opacity 0.15s',
    background: isPrimary ? 'var(--accent-gradient)' : 'transparent',
    color: colors.textPrimary,
    width: '100%',
    ...style,
  }

  return (
    <button style={btn} disabled={disabled || loading} onClick={handleClick} {...props}>
      {loading ? <span style={{ opacity: 0.7 }}>Chargement…</span> : label}
    </button>
  )
}
