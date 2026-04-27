'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SavedRelease } from '@/types'

interface SavedReleasesStore {
  saved: SavedRelease[]
  isSaved: (releaseId: number) => boolean
  save: (release: SavedRelease) => void
  remove: (releaseId: number) => void
}

export const useSavedReleasesStore = create<SavedReleasesStore>()(
  persist(
    (set, get) => ({
      saved: [],
      isSaved: (id) => get().saved.some((r) => r.id === id),
      save: (release) => {
        if (get().isSaved(release.id)) return
        set((s) => ({ saved: [release, ...s.saved] }))
      },
      remove: (id) => set((s) => ({ saved: s.saved.filter((r) => r.id !== id) })),
    }),
    { name: 'inka-saved-releases' }
  )
)
