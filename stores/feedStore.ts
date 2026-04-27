'use client'
import { create } from 'zustand'
import { Sound, ReactionEmoji } from '@/types'

interface FeedState {
  sounds: Sound[]
  isLoading: boolean
  hasMore: boolean
  page: number
  setSounds: (sounds: Sound[]) => void
  appendSounds: (sounds: Sound[]) => void
  setIsLoading: (loading: boolean) => void
  setHasMore: (hasMore: boolean) => void
  setPage: (page: number) => void
  updateSound: (id: string, updates: Partial<Sound>) => void
  prependSound: (sound: Sound) => void
  optimisticReaction: (soundId: string, emoji: string, userId: string, add: boolean) => void
  reset: () => void
}

export const useFeedStore = create<FeedState>((set, get) => ({
  sounds: [],
  isLoading: false,
  hasMore: true,
  page: 0,

  setSounds: (sounds) => set({ sounds }),
  appendSounds: (newSounds) => set({ sounds: [...get().sounds, ...newSounds] }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setHasMore: (hasMore) => set({ hasMore }),
  setPage: (page) => set({ page }),

  updateSound: (id, updates) =>
    set({ sounds: get().sounds.map((s) => (s.id === id ? { ...s, ...updates } : s)) }),

  optimisticReaction: (soundId, emoji, userId, add) => {
    set({
      sounds: get().sounds.map((sound) => {
        if (sound.id !== soundId) return sound
        const reactions = sound.reactions ?? []
        if (add) {
          return {
            ...sound,
            reactions: [
              ...reactions,
              { id: 'optimistic', sound_id: soundId, user_id: userId, emoji: emoji as ReactionEmoji, created_at: new Date().toISOString() },
            ],
          }
        }
        return { ...sound, reactions: reactions.filter((r) => !(r.user_id === userId && r.emoji === emoji)) }
      }),
    })
  },

  reset: () => set({ sounds: [], isLoading: false, hasMore: true, page: 0 }),

  prependSound: (sound: Sound) =>
    set({ sounds: [sound, ...get().sounds.filter((s) => s.id !== sound.id)] }),
}))
