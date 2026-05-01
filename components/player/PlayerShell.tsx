'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePlaybackSync } from '@/hooks/usePlaybackSync'
import { useCurrentTrack, useIsExpanded } from '@/stores/selectors'
import { usePlayerUIModeStore } from '@/stores/playerUIModeStore'
import { backgroundAudio } from '@/lib/backgroundAudioManager'
import { MiniPlayer } from './MiniPlayer'
import { FullPlayer } from './FullPlayer'
import { StoryPlayer } from './StoryPlayer'

export function PlayerShell() {
  usePlaybackSync() // Mount the rAF bridge here — once, at the root

  const track = useCurrentTrack()
  const isExpanded = useIsExpanded()
  const mode = usePlayerUIModeStore((s) => s.mode)
  const { setExpanded } = usePlayerUIModeStore()

  // Initialize background audio on first user interaction
  useEffect(() => {
    const init = () => {
      backgroundAudio.init()
      document.removeEventListener('click', init)
      document.removeEventListener('touchstart', init)
    }
    document.addEventListener('click', init, { once: true })
    document.addEventListener('touchstart', init, { once: true })
    return () => {
      document.removeEventListener('click', init)
      document.removeEventListener('touchstart', init)
    }
  }, [])

  // ESC collapses FullPlayer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isExpanded, setExpanded])

  if (!track) return null

  return (
    <AnimatePresence mode="wait">
      {/* Story Mode: full-screen video */}
      {isExpanded && mode === 'story' ? (
        <motion.div
          key="story"
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#000' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <StoryPlayer />
        </motion.div>
      ) : isExpanded ? (
        /* Audio Mode: full-screen player */
        <motion.div
          key="full"
          layoutId="player-shell"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: '#000',
          }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300, mass: 0.8 }}
        >
          <FullPlayer />
        </motion.div>
      ) : (
        /* MiniPlayer: collapsed bar */
        <motion.div
          key="mini"
          layoutId="player-shell"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 40,
            height: 64,
            background: 'rgba(24, 24, 27, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300, mass: 0.8 }}
        >
          <MiniPlayer />
        </motion.div>
      )}
    </AnimatePresence>
  )
}