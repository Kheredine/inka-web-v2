import { colors, radius, spacing } from '@/lib/theme'
import { CSSProperties } from 'react'

interface SkeletonProps {
  width?: number | string
  height?: number | string
  borderRadius?: number
  style?: CSSProperties
}

export function Skeleton({ width = '100%', height = 16, borderRadius = radius.sm, style }: SkeletonProps) {
  return (
    <span
      style={{
        display: 'block',
        width,
        height,
        borderRadius,
        background: `linear-gradient(90deg, ${colors.surface} 25%, ${colors.surfaceElevated} 50%, ${colors.surface} 75%)`,
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.4s infinite',
        ...style,
      }}
    />
  )
}

export function SoundCardSkeleton({ style }: { style?: CSSProperties }) {
  // Grid-style skeleton when a fixed width is provided
  if (style?.width !== undefined) {
    return (
      <div style={{ background: colors.surface, border: `0.5px solid ${colors.border}`, borderRadius: radius.md, overflow: 'hidden', ...style }}>
        <Skeleton width="100%" height={0} style={{ paddingBottom: '100%' }} borderRadius={0} />
        <div style={{ padding: spacing.md, display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
          <Skeleton width="70%" height={13} />
          <Skeleton width="50%" height={11} />
          <Skeleton width="100%" height={3} borderRadius={2} style={{ marginTop: spacing.xs }} />
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', gap: spacing.md, padding: `${spacing.md}px ${spacing.lg}px`, alignItems: 'center', ...style }}>
      <Skeleton width={48} height={48} borderRadius={radius.md} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
        <Skeleton width="60%" height={13} />
        <Skeleton width="40%" height={11} />
      </div>
      <Skeleton width={32} height={11} />
    </div>
  )
}

export function FeedItemSkeleton() {
  return (
    <div style={{ padding: `${spacing.md}px`, background: colors.surface, border: `0.5px solid ${colors.border}`, borderRadius: radius.md }}>
      <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.md, alignItems: 'center' }}>
        <Skeleton width={32} height={32} borderRadius={radius.full} />
        <Skeleton width="30%" height={12} />
      </div>
      <Skeleton width="100%" height={80} borderRadius={radius.md} />
    </div>
  )
}
