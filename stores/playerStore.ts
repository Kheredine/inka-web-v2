'use client'
import { create } from 'zustand'
import { Sound } from '@/types'

export type RepeatMode = 'off' | 'queue' | 'track'
export type ShuffleMode = 'off' | 'shuffle' | 'ai'

interface PlayerState {
  currentSound: Sound | null
  queue: Sound[]
  queueIndex: number
  isPlaying: boolean
  isVisible: boolean
  shuffleMode: ShuffleMode
  repeatMode: RepeatMode
  position: number
  duration: number
  queueVisible: boolean
  howl: unknown

  setCurrentSound: (sound: Sound | null) => void
  setQueue: (sounds: Sound[]) => void
  setIsPlaying: (playing: boolean) => void
  setIsVisible: (visible: boolean) => void
  setRepeatMode: (mode: RepeatMode) => void
  setPosition: (position: number) => void
  setDuration: (duration: number) => void
  setHowl: (howl: unknown) => void
  setQueueVisible: (visible: boolean) => void

  playSound: (sound: Sound, queue?: Sound[]) => void
  togglePlay: () => void
  skipToNext: () => void
  skipToPrevious: () => void
  cycleShuffleMode: () => void
  cycleRepeat: () => void
  seekTo: (position: number) => void
  stop: () => void
  reorderRemainingQueue: (sounds: Sound[]) => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSound: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  isVisible: false,
  shuffleMode: 'off',
  repeatMode: 'off',
  position: 0,
  duration: 0,
  queueVisible: false,
  howl: null,

  setCurrentSound: (sound) => set({ currentSound: sound }),
  setQueue: (queue) => set({ queue }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsVisible: (isVisible) => set({ isVisible }),
  setRepeatMode: (repeatMode) => set({ repeatMode }),
  setPosition: (position) => set({ position }),
  setDuration: (duration) => set({ duration }),
  setHowl: (howl) => set({ howl }),
  setQueueVisible: (queueVisible) => set({ queueVisible }),

  playSound: (sound, queue) => {
    const q = queue ?? [sound]
    const idx = Math.max(q.findIndex((s) => s.id === sound.id), 0)
    set({
      currentSound: sound,
      queue: q,
      queueIndex: idx,
      isPlaying: true,
      isVisible: true,
      position: 0,
    })
  },

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  skipToNext: () => {
    const { queue, queueIndex, shuffleMode, repeatMode } = get()
    if (queue.length === 0) return

    let nextIdx: number
    if (shuffleMode === 'shuffle' || shuffleMode === 'ai') {
      const candidates = queue.map((_, i) => i).filter((i) => i !== queueIndex)
      if (!candidates.length) {
        if (repeatMode === 'queue') nextIdx = 0
        else return
      } else {
        nextIdx = candidates[Math.floor(Math.random() * candidates.length)]
      }
    } else {
      nextIdx = queueIndex + 1
      if (nextIdx >= queue.length) {
        if (repeatMode === 'queue') nextIdx = 0
        else return
      }
    }
    set({ queueIndex: nextIdx, currentSound: queue[nextIdx], position: 0, isPlaying: true })
  },

  skipToPrevious: () => {
    const { queue, queueIndex, position } = get()
    if (queue.length === 0) return
    if (position > 3) {
      set({ position: 0 })
      return
    }
    const prevIdx = queueIndex - 1
    if (prevIdx >= 0) {
      set({ queueIndex: prevIdx, currentSound: queue[prevIdx], position: 0, isPlaying: true })
    }
  },

  cycleShuffleMode: () => {
    const { shuffleMode } = get()
    const next: ShuffleMode =
      shuffleMode === 'off' ? 'shuffle' : shuffleMode === 'shuffle' ? 'ai' : 'off'
    set({ shuffleMode: next })
  },

  cycleRepeat: () => {
    const { repeatMode } = get()
    const next: RepeatMode =
      repeatMode === 'off' ? 'queue' : repeatMode === 'queue' ? 'track' : 'off'
    set({ repeatMode: next })
  },

  seekTo: (position) => set({ position }),

  stop: () => set({ isPlaying: false, isVisible: false, currentSound: null, position: 0 }),

  // Replace the tail of the queue (after current track) with AI-ordered sounds
  reorderRemainingQueue: (sounds) => {
    const { queue, queueIndex } = get()
    const played = queue.slice(0, queueIndex + 1)
    const playedIds = new Set(played.map((s) => s.id))
    const newTail = sounds.filter((s) => !playedIds.has(s.id))
    set({ queue: [...played, ...newTail] })
  },
}))
