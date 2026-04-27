import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Lightweight snapshot saved client-side so we can show bookmarked sounds
// in the Library without a DB query.
export interface SavedSound {
  id: string
  title: string
  artist: string
  genre?: string
  duration: number
  savedAt: string
}

interface SavedSoundsState {
  saved: SavedSound[]
  isSaved: (id: string) => boolean
  save: (sound: SavedSound) => void
  remove: (id: string) => void
}

export const useSavedSoundsStore = create<SavedSoundsState>()(
  persist(
    (set, get) => ({
      saved: [],
      isSaved: (id) => get().saved.some((s) => s.id === id),
      save: (sound) => {
        if (get().isSaved(sound.id)) return
        set((state) => ({ saved: [sound, ...state.saved] }))
      },
      remove: (id) => {
        set((state) => ({ saved: state.saved.filter((s) => s.id !== id) }))
      },
    }),
    { name: 'inka-saved-sounds' }
  )
)
