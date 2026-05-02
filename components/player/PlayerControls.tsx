'use client'

import { useCallback } from 'react'
import { useIsPlaying, useShuffleMode, useRepeatMode } from '@/stores/selectors'
import { useQueueStore } from '@/stores/queueStore'
import { audioEngine } from '@/lib/audioEngine'
import type { RepeatMode, ShuffleMode } from '@/stores/queueStore'

export function PlayerControls() {
  const isPlaying = useIsPlaying()
  const shuffleMode = useShuffleMode()
  const repeatMode = useRepeatMode()

  const handleTogglePlay = useCallback(() => {
    audioEngine.toggle()
  }, [])

  const handleNext = useCallback(() => {
    const next = useQueueStore.getState().next()
    if (next) audioEngine.playTrack(next.track)
  }, [])

  const handlePrevious = useCallback(() => {
    const prev = useQueueStore.getState().previous()
    if (prev) audioEngine.playTrack(prev.track)
  }, [])

  const handleShuffle = useCallback(() => {
    useQueueStore.getState().toggleShuffle()
  }, [])

  const handleRepeat = useCallback(() => {
    useQueueStore.getState().cycleRepeat()
  }, [])

  const repeatIcon: Record<RepeatMode, string> = {
    off: '🔁',
    all: '🔁',
    one: '🔂',
  }

  const shuffleConfig: Record<ShuffleMode, { icon: string; label: string; color: string }> = {
    normal: { icon: '🔀', label: 'Normal', color: 'rgba(255,255,255,0.6)' },
    random: { icon: '🔀', label: 'Aléatoire', color: '#8b5cf6' },
    ai: { icon: '🧠', label: 'Smart Shuffle', color: '#f59e0b' },
  }

  const currentShuffle = shuffleConfig[shuffleMode]

  const btnStyle = (active: boolean): React.CSSProperties => ({
    width: 44,
    height: 44,
    border: 'none',
    background: 'transparent',
    color: active ? '#8b5cf6' : 'rgba(255,255,255,0.6)',
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
  })

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: '8px 24px',
    }}>
      {/* Shuffle — cycles: normal → random → ai → normal */}
      <button
        onClick={handleShuffle}
        aria-label={`Shuffle: ${currentShuffle.label}`}
        style={{
          ...btnStyle(shuffleMode !== 'normal'),
          color: currentShuffle.color,
        }}
      >
        {currentShuffle.icon}
        {/* Mode indicator dot */}
        {shuffleMode !== 'normal' && (
          <span style={{
            position: 'absolute',
            bottom: 6,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: currentShuffle.color,
          }} />
        )}
      </button>

      {/* Previous */}
      <button onClick={handlePrevious} aria-label="Previous track" style={btnStyle(false)}>
        ⏮
      </button>

      {/* Play/Pause — large */}
      <button
        onClick={handleTogglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          border: 'none',
          background: '#8b5cf6',
          color: '#fff',
          fontSize: 24,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      {/* Next */}
      <button onClick={handleNext} aria-label="Next track" style={btnStyle(false)}>
        ⏭
      </button>

      {/* Repeat */}
      <button
        onClick={handleRepeat}
        aria-label={`Repeat: ${repeatMode}`}
        style={btnStyle(repeatMode !== 'off')}
      >
        {repeatIcon[repeatMode]}
      </button>
    </div>
  )
}
