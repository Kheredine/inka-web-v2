'use client'

import { useCallback } from 'react'
import { useCurrentTrack, useIsPlaying, usePosition, useDuration } from '@/stores/selectors'
import { usePlayerUIModeStore } from '@/stores/playerUIModeStore'
import { audioEngine } from '@/lib/audioEngine'

export function MiniPlayer() {
  const track = useCurrentTrack()
  const isPlaying = useIsPlaying()
  const position = usePosition()
  const duration = useDuration()
  const { setExpanded } = usePlayerUIModeStore()

  const progress = duration > 0 ? (position / duration) * 100 : 0

  const handleTogglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    audioEngine.toggle()
  }, [])

  const handleNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const { useQueueStore } = require('@/stores/queueStore')
    const next = useQueueStore.getState().next()
    if (next) audioEngine.playTrack(next.track)
  }, [])

  const handleExpand = useCallback(() => {
    setExpanded(true)
  }, [setExpanded])

  if (!track) return null

  return (
    <div
      onClick={handleExpand}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        padding: '0 12px',
        cursor: 'pointer',
        position: 'relative',
        gap: 12,
      }}
    >
      {/* Progress bar at top */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: 'rgba(255,255,255,0.1)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: '#8b5cf6',
            transition: 'width 0.25s linear',
          }}
        />
      </div>

      {/* Cover art */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 8,
          overflow: 'hidden',
          flexShrink: 0,
          background: 'rgba(255,255,255,0.05)',
        }}
      >
        {track.coverArt.medium && (
          <img
            src={track.coverArt.medium}
            alt={track.title}
            width={48}
            height={48}
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
      </div>

      {/* Title + Artist */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div
          style={{
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {track.title}
        </div>
        <div
          style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: 12,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {track.artists.join(', ')}
        </div>
      </div>

      {/* Play/Pause */}
      <button
        onClick={handleTogglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        style={{
          width: 44,
          height: 44,
          border: 'none',
          background: 'transparent',
          color: '#fff',
          fontSize: 20,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      {/* Next */}
      <button
        onClick={handleNext}
        aria-label="Next track"
        style={{
          width: 44,
          height: 44,
          border: 'none',
          background: 'transparent',
          color: '#fff',
          fontSize: 18,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        ⏭
      </button>
    </div>
  )
}