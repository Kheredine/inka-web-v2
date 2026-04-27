'use client'
import { colors } from '@/lib/theme'
import { RepeatMode } from '@/stores/playerStore'

interface PlayerControlsProps {
  isPlaying: boolean
  shuffle: boolean
  repeatMode: RepeatMode
  onTogglePlay: () => void
  onSkipNext: () => void
  onSkipPrev: () => void
  onToggleShuffle: () => void
  onCycleRepeat: () => void
  size?: 'sm' | 'lg'
}

export function PlayerControls({
  isPlaying, shuffle, repeatMode,
  onTogglePlay, onSkipNext, onSkipPrev, onToggleShuffle, onCycleRepeat,
  size = 'lg',
}: PlayerControlsProps) {
  const isLg = size === 'lg'

  const iconBtn = (onClick: () => void, iconClass: string, active?: boolean, badge?: string) => (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: active ? colors.primary : colors.textSecondary,
        fontSize: isLg ? 20 : 16,
        padding: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <i className={`fa-solid ${iconClass}`} />
      {badge && (
        <span style={{
          position: 'absolute',
          top: 2,
          right: 2,
          fontSize: 9,
          fontWeight: 700,
          color: colors.primary,
          lineHeight: 1,
        }}>
          {badge}
        </span>
      )}
    </button>
  )

  const playBtn = (
    <button
      onClick={onTogglePlay}
      style={{
        width: isLg ? 56 : 40,
        height: isLg ? 56 : 40,
        borderRadius: '50%',
        background: 'var(--accent-gradient)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: isLg ? 22 : 16,
        flexShrink: 0,
        color: '#FFFFFF',
      }}
    >
      <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`} style={{ marginLeft: isPlaying ? 0 : 2 }} />
    </button>
  )

  const repeatIcon = repeatMode === 'track' ? 'fa-repeat' : 'fa-repeat'
  const repeatBadge = repeatMode === 'track' ? '1' : undefined

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isLg ? 8 : 4 }}>
      {iconBtn(onToggleShuffle, 'fa-shuffle', shuffle)}
      {iconBtn(onSkipPrev, 'fa-backward-step')}
      {playBtn}
      {iconBtn(onSkipNext, 'fa-forward-step')}
      {iconBtn(onCycleRepeat, repeatIcon, repeatMode !== 'off', repeatBadge)}
    </div>
  )
}
