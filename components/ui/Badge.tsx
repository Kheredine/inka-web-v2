import { colors, radius, spacing, typography } from '@/lib/theme'
import { CSSProperties } from 'react'

interface BadgeProps {
  count: number
  style?: CSSProperties
}

export function Badge({ count, style }: BadgeProps) {
  if (count === 0) return null
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        borderRadius: radius.full,
        background: colors.error,
        color: colors.textPrimary,
        fontSize: typography.xs.fontSize,
        fontWeight: 700,
        paddingInline: 4,
        ...style,
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
