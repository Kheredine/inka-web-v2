'use client'

import { useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useCurrentTrack, useIsExpanded } from '@/stores/selectors'
import { usePlayerUIModeStore } from '@/stores/playerUIModeStore'
import { useVibeStore } from '@/stores/vibeStore'
import { applyTrackVibe } from '@/lib/vibeEngine'
import { ProgressBar } from './ProgressBar'
import { PlayerControls } from './PlayerControls'
import { ReactionBar } from './ReactionBar'

export function FullPlayer() {
  const track = useCurrentTrack()
  const { setExpanded } = usePlayerUIModeStore()
  const palette = useVibeStore((s) => s.palette)

  // Apply vibe when track changes
  useEffect(() => {
    if (track) applyTrackVibe(track)
  }, [track])

  const handleCollapse = useCallback(() => {
    setExpanded(false)
  }, [setExpanded])

  if (!track) return null

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: `linear-gradient(180deg, ${palette.background} 0%, #0d0d0d 100%)`,
        padding: 'env(safe-area-inset-top, 48px) 0 env(safe-area-inset-bottom, 32px)',
        overflow: 'hidden',
      }}
    >
      {/* Header: collapse handle */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '12px 24px 4px',
        flexShrink: 0,
      }}>
        <button
          onClick={handleCollapse}
          aria-label="Collapse player"
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.3)',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        />
      </div>

      {/* Cover Art */}
      <div style={{
        flex: '1 1 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 32px',
        minHeight: 0,
      }}>
        <motion.img
          src={track.coverArt.large}
          alt={track.title}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          style={{
            width: 'min(75vw, 400px)',
            height: 'min(75vw, 400px)',
            aspectRatio: '1',
            objectFit: 'cover',
            borderRadius: 16,
            boxShadow: '0 25px 50px -12px rgba(139, 92, 246, 0.25)',
          }}
          loading="lazy"
          decoding="async"
        />
      </div>

      {/* Track Info */}
      <div style={{
        padding: '0 24px',
        flexShrink: 0,
      }}>
        <h2 style={{
          color: '#fff',
          fontSize: 22,
          fontWeight: 700,
          margin: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {track.title}
        </h2>
        <p style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: 15,
          margin: '4px 0 0',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {track.artists.join(', ')}
        </p>
      </div>

      {/* Reaction Bar */}
      <div style={{ flexShrink: 0, marginTop: 12 }}>
        <ReactionBar />
      </div>

      {/* Progress Bar */}
      <div style={{ flexShrink: 0, marginTop: 8 }}>
        <ProgressBar />
      </div>

      {/* Player Controls */}
      <div style={{ flexShrink: 0 }}>
        <PlayerControls />
      </div>
    </div>
  )
}