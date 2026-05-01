// ── Playback Store ───────────────────────────────────────────────────────────
// One of four Zustand stores for Inka V2.
// Persists ONLY user preferences (volume, quality, rate). Never position/track.
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { UnifiedTrack } from '@/types/track'

export interface PlaybackState {
  currentTrack: UnifiedTrack | null
  isPlaying: boolean
  position: number            // seconds
  duration: number
  buffered: number            // 0-1
  volume: number              // 0-1
  isMuted: boolean
  playbackRate: number        // 0.5-2.0
  audioQuality: 'auto' | 'high' | 'data-saver'
  isBuffering: boolean
  error: string | null
}

export interface PlaybackActions {
  setCurrentTrack: (track: UnifiedTrack | null) => void
  setPlaying: (playing: boolean) => void
  setPosition: (position: number) => void
  setDuration: (duration: number) => void
  setBuffered: (buffered: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  setPlaybackRate: (rate: number) => void
  setAudioQuality: (q: 'auto' | 'high' | 'data-saver') => void
  setBuffering: (b: boolean) => void
  setError: (e: string | null) => void
  reset: () => void
}

type PlaybackStore = PlaybackState & PlaybackActions

const initialState: PlaybackState = {
  currentTrack: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  buffered: 0,
  volume: 0.8,
  isMuted: false,
  playbackRate: 1.0,
  audioQuality: 'auto',
  isBuffering: false,
  error: null,
}

export const usePlaybackStore = create<PlaybackStore>()(
  persist(
    (set) => ({
      ...initialState,

      setCurrentTrack: (currentTrack) => set({ currentTrack }),

      setPlaying: (isPlaying) => set({ isPlaying }),

      setPosition: (position) => set({ position }),

      setDuration: (duration) => set({ duration }),

      setBuffered: (buffered) => set({ buffered }),

      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),

      toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),

      setPlaybackRate: (playbackRate) => set({ playbackRate }),

      setAudioQuality: (audioQuality) => set({ audioQuality }),

      setBuffering: (isBuffering) => set({ isBuffering }),

      setError: (error) => set({ error }),

      reset: () => set(initialState),
    }),
    {
      name: 'inka-playback',
      storage: createJSONStorage(() => localStorage),
      // CRITICAL: only persist user preferences, NEVER position/track/playing
      partialize: (state) => ({
        volume: state.volume,
        isMuted: state.isMuted,
        audioQuality: state.audioQuality,
        playbackRate: state.playbackRate,
      }),
    }
  )
)