'use client'
import { usePlayerStore } from '@/stores/playerStore'

/**
 * Thin hook — reads from playerStore.
 * The actual Howl engine lives in <AudioProvider> (mounted once in layout).
 */
export function usePlayer() {
  const store = usePlayerStore()

  const seekTo = (pos: number) => {
    // Delegate to the AudioProvider's exposed function
    const fn = (window as Window & { __inkaSeekTo?: (pos: number) => void }).__inkaSeekTo
    if (fn) fn(pos)
    store.setPosition(pos)
  }

  return { ...store, seekTo }
}
