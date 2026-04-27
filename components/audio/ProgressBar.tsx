'use client'
import { colors, spacing } from '@/lib/theme'
import { formatDuration } from '@/lib/utils'
import { useRef, MouseEvent } from 'react'

interface ProgressBarProps {
  position: number
  duration: number
  onSeek: (position: number) => void
}

export function ProgressBar({ position, duration, onSeek }: ProgressBarProps) {
  const barRef = useRef<HTMLDivElement>(null)

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!barRef.current || !duration) return
    const rect = barRef.current.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    onSeek(ratio * duration)
  }

  const progress = duration > 0 ? (position / duration) * 100 : 0

  return (
    <div style={{ paddingInline: spacing.lg }}>
      <div
        ref={barRef}
        onClick={handleClick}
        style={{
          height: 4,
          borderRadius: 2,
          background: colors.surface,
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${progress}%`,
            background: `linear-gradient(90deg, #FF6A00, #D94F2A)`,
            borderRadius: 2,
            transition: 'width 0.5s linear',
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: spacing.xs }}>
        <span style={{ color: colors.textMuted, fontSize: 11 }}>{formatDuration(position)}</span>
        <span style={{ color: colors.textMuted, fontSize: 11 }}>{formatDuration(duration)}</span>
      </div>
    </div>
  )
}
