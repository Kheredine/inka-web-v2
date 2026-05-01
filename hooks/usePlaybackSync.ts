// ── Playback Sync Hook ───────────────────────────────────────────────────────
// Mount ONCE at the app root (inside PlayerShell or layout).
// Bridges audioEngine state into Zustand stores at 250ms cadence via rAF.
import { useEffect } from 'react'
import { audioEngine } from '@/lib/audioEngine'
import { usePlaybackStore } from '@/stores/playbackStore'

export function usePlaybackSync() {
  useEffect(() => {
    let rafId = 0
    let lastUpdate = 0
    let lastPreloadCheck = 0

    const tick = () => {
      const now = performance.now()

      if (now - lastUpdate > 250) {
        const position = audioEngine.getPosition()
        const duration = audioEngine.getDuration()
        const buffered = audioEngine.getBuffered()

        const store = usePlaybackStore.getState()
        // Only update if values changed (avoid unnecessary re-renders)
        if (store.position !== position) store.setPosition(position)
        if (store.duration !== duration) store.setDuration(duration)
        if (store.buffered !== buffered) store.setBuffered(buffered)

        // Preload trigger at 80% of current track
        if (
          now - lastPreloadCheck > 1000 &&
          duration > 0 &&
          position / duration > 0.8
        ) {
          audioEngine.preloadNextTrack()
          lastPreloadCheck = now
        }

        lastUpdate = now
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])
}