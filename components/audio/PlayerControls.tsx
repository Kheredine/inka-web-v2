'use client'
import { colors } from '@/lib/theme'
import { RepeatMode, ShuffleMode } from '@/stores/playerStore'

interface PlayerControlsProps {
  isPlaying: boolean
  shuffleMode: ShuffleMode
  repeatMode: RepeatMode
  onTogglePlay: () => void
  onSkipNext: () => void
  onSkipPrev: () => void
  onCycleShuffleMode: () => void
  onCycleRepeat: () => void
  onOpenQueue?: () => void
  size?: 'sm' | 'lg'
}

export function PlayerControls({
  isPlaying, shuffleMode, repeatMode,
  onTogglePlay, onSkipNext, onSkipPrev, onCycleShuffleMode, onCycleRepeat, onOpenQueue,
  size = 'lg',
}: PlayerControlsProps) {
  const isLg = size === 'lg'

  const iconBtn = (
    onClick: () => void,
    iconClass: string,
    active?: boolean,
    badge?: string,
    title?: string,
  ) => (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: active ? 'var(--accent)' : colors.textSecondary,
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
          color: 'var(--accent)',
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

  // Shuffle: off=gray, shuffle=accent, ai=accent + 'AI' badge
  const shuffleActive = shuffleMode !== 'off'
  const shuffleBadge = shuffleMode === 'ai' ? 'AI' : undefined
  const shuffleTitle =
    shuffleMode === 'off' ? 'Activer l\'aléatoire' :
    shuffleMode === 'shuffle' ? 'Passer en IA shuffle' :
    'Désactiver l\'aléatoire'

  const repeatIcon = 'fa-repeat'
  const repeatBadge = repeatMode === 'track' ? '1' : undefined

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isLg ? 4 : 2 }}>
      {iconBtn(onCycleShuffleMode, 'fa-shuffle', shuffleActive, shuffleBadge, shuffleTitle)}
      {iconBtn(onSkipPrev, 'fa-backward-step')}
      {playBtn}
      {iconBtn(onSkipNext, 'fa-forward-step')}
      {iconBtn(onCycleRepeat, repeatIcon, repeatMode !== 'off', repeatBadge)}
      {onOpenQueue && iconBtn(onOpenQueue, 'fa-list', false, undefined, 'File d\'attente')}
    </div>
  )
}
