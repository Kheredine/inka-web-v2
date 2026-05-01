// ── Selector Hooks ───────────────────────────────────────────────────────────
// Always export narrow selector hooks. NEVER select the whole store from a
// component. This prevents cascading re-renders across the app.

import { usePlaybackStore } from './playbackStore'
import { useQueueStore } from './queueStore'
import { usePlayerUIModeStore } from './playerUIModeStore'
import { useSyncStore } from './syncStore'
import { useVibeStore } from './vibeStore'

// ── Playback selectors ─────────────────────────────────────────────────────
export const useCurrentTrack = () => usePlaybackStore((s) => s.currentTrack)
export const useIsPlaying    = () => usePlaybackStore((s) => s.isPlaying)
export const usePosition     = () => usePlaybackStore((s) => s.position)
export const useDuration     = () => usePlaybackStore((s) => s.duration)
export const useBuffered     = () => usePlaybackStore((s) => s.buffered)
export const useVolume       = () => usePlaybackStore((s) => s.volume)
export const useIsMuted      = () => usePlaybackStore((s) => s.isMuted)
export const usePlaybackRate = () => usePlaybackStore((s) => s.playbackRate)
export const useIsBuffering  = () => usePlaybackStore((s) => s.isBuffering)
export const usePlaybackError = () => usePlaybackStore((s) => s.error)
export const useAudioQuality = () => usePlaybackStore((s) => s.audioQuality)

// ── Queue selectors ────────────────────────────────────────────────────────
export const useQueueItems    = () => useQueueStore((s) => s.items)
export const useCurrentIndex  = () => useQueueStore((s) => s.currentIndex)
export const useShuffleMode   = () => useQueueStore((s) => s.shuffleMode)
export const useRepeatMode    = () => useQueueStore((s) => s.repeatMode)
export const useQueueHistory  = () => useQueueStore((s) => s.history)
export const useIsLoadingNext = () => useQueueStore((s) => s.isLoadingNext)
/** Get the currently-playing QueueItem */
export const useCurrentQueueItem = () =>
  useQueueStore((s) => s.items[s.currentIndex] ?? null)

// ── Player UI Mode selectors ───────────────────────────────────────────────
export const useIsExpanded   = () => usePlayerUIModeStore((s) => s.isExpanded)
export const usePlayerMode   = () => usePlayerUIModeStore((s) => s.mode)
export const useIsFullscreen = () => usePlayerUIModeStore((s) => s.isFullscreen)
export const useActiveTab    = () => usePlayerUIModeStore((s) => s.activeTab)
export const useShowQueue    = () => usePlayerUIModeStore((s) => s.showQueue)
export const useSleepTimer   = () => usePlayerUIModeStore((s) => s.sleepTimerMinutes)

// ── Sync selectors ─────────────────────────────────────────────────────────
export const useDrift          = () => useSyncStore((s) => s.drift)
export const useIsSyncing      = () => useSyncStore((s) => s.isSyncing)
export const useIsVideoReady   = () => useSyncStore((s) => s.isVideoReady)
export const useVideoError     = () => useSyncStore((s) => s.videoError)
export const useFallbackToAudio = () => useSyncStore((s) => s.fallbackToAudio)

// ── Vibe selectors ─────────────────────────────────────────────────────────
export const useEnergyLevel = () => useVibeStore((s) => s.energyLevel)
export const useIsAnalyzing = () => useVibeStore((s) => s.isAnalyzing)