'use client'
import { create } from 'zustand'
import { Sound } from '@/types'

export type RepeatMode = 'off' | 'queue' | 'track'

interface PlayerState {
  currentSound: Sound | null
  queue: Sound[]
  isPlaying: boolean
  isVisible: boolean
  shuffle: boolean
  repeatMode: RepeatMode
  position: number
  duration: number
  howl: unknown // Howler instance, typed as unknown to avoid SSR issues

  setCurrentSound: (sound: Sound | null) => void
  setQueue: (sounds: Sound[]) => void
  setIsPlaying: (playing: boolean) => void
  setIsVisible: (visible: boolean) => void
  setShuffle: (shuffle: boolean) => void
  setRepeatMode: (mode: RepeatMode) => void
  setPosition: (position: number) => void
  setDuration: (duration: number) => void
  setHowl: (howl: unknown) => void

  playSound: (sound: Sound, queue?: Sound[]) => void
  togglePlay: () => void
  skipToNext: () => void
  skipToPrevious: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  seekTo: (position: number) => void
  stop: () => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSound: null,
  queue: [],
  isPlaying: false,
  isVisible: false,
  shuffle: false,
  repeatMode: 'off',
  position: 0,
  duration: 0,
  howl: null,

  setCurrentSound: (sound) => set({ currentSound: sound }),
  setQueue: (queue) => set({ queue }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsVisible: (isVisible) => set({ isVisible }),
  setShuffle: (shuffle) => set({ shuffle }),
  setRepeatMode: (repeatMode) => set({ repeatMode }),
  setPosition: (position) => set({ position }),
  setDuration: (duration) => set({ duration }),
  setHowl: (howl) => set({ howl }),

  playSound: (sound, queue) => {
    set({
      currentSound: sound,
      queue: queue ?? [sound],
      isPlaying: true,
      isVisible: true,
      position: 0,
    })
  },

  togglePlay: () => {
    set((state) => ({ isPlaying: !state.isPlaying }))
  },

  skipToNext: () => {
    const { queue, currentSound, shuffle } = get()
    if (!currentSound || queue.length === 0) return
    const idx = queue.findIndex((s) => s.id === currentSound.id)
    let next: Sound | undefined
    if (shuffle) {
      const remaining = queue.filter((_, i) => i !== idx)
      next = remaining[Math.floor(Math.random() * remaining.length)]
    } else {
      next = queue[idx + 1]
    }
    if (next) set({ currentSound: next, position: 0, isPlaying: true })
  },

  skipToPrevious: () => {
    const { queue, currentSound, position } = get()
    if (!currentSound || queue.length === 0) return
    if (position > 3) {
      set({ position: 0 })
      return
    }
    const idx = queue.findIndex((s) => s.id === currentSound.id)
    const prev = queue[idx - 1]
    if (prev) set({ currentSound: prev, position: 0, isPlaying: true })
  },

  toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),

  cycleRepeat: () => {
    const { repeatMode } = get()
    const next: RepeatMode = repeatMode === 'off' ? 'queue' : repeatMode === 'queue' ? 'track' : 'off'
    set({ repeatMode: next })
  },

  seekTo: (position) => set({ position }),

  stop: () => set({ isPlaying: false, isVisible: false, currentSound: null, position: 0 }),
}))
