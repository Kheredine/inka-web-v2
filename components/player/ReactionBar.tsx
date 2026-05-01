'use client'

import { useCallback, useState } from 'react'
import { useCurrentTrack } from '@/stores/selectors'

const REACTIONS = ['❤️', '🔥', '😭', '👀', '💯', '🚀'] as const

export function ReactionBar() {
  const track = useCurrentTrack()
  const [activeReaction, setActiveReaction] = useState<string | null>(null)

  const handleReaction = useCallback((emoji: string) => {
    setActiveReaction(emoji)
    // TODO: POST to /api/reaction with track.id + emoji
    // Reset after 1.5s
    setTimeout(() => setActiveReaction(null), 1500)
  }, [])

  if (!track) return null

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      gap: 16,
      padding: '8px 24px',
    }}>
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => handleReaction(emoji)}
          aria-label={`React with ${emoji}`}
          style={{
            width: 44,
            height: 44,
            border: 'none',
            background: activeReaction === emoji ? 'rgba(139,92,246,0.2)' : 'transparent',
            borderRadius: '50%',
            fontSize: 22,
            cursor: 'pointer',
            transition: 'transform 0.2s, background 0.2s',
            transform: activeReaction === emoji ? 'scale(1.3)' : 'scale(1)',
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}