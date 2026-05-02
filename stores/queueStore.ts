// ── Queue Store ──────────────────────────────────────────────────────────────
// Manages play queue with shuffle, repeat, and history.
// Persists items + history + shuffle/repeat modes. Never persists currentIndex.
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { QueueItem } from '@/types/track'

export type RepeatMode = 'off' | 'one' | 'all'
export type ShuffleMode = 'normal' | 'random' | 'ai'

export interface QueueState {
  items: QueueItem[]
  currentIndex: number
  history: string[]                // last 50 track IDs, newest first
  originalOrder: string[]          // track IDs in original order (for shuffle restore)
  shuffleMode: ShuffleMode
  repeatMode: RepeatMode
  isLoadingNext: boolean
}

export interface QueueActions {
  /** Replace the entire queue, optionally starting at a specific index */
  setQueue: (items: QueueItem[], startIndex?: number) => void
  /** Add items to the end of the queue */
  appendToQueue: (items: QueueItem[]) => void
  /** Add items right after the current track (Play Next) */
  prependToQueue: (items: QueueItem[]) => void
  /** Remove an item by its queue index */
  removeFromQueue: (index: number) => void
  /** Move an item from one position to another */
  moveItem: (fromIndex: number, toIndex: number) => void
  /** Advance to next track. Returns the next QueueItem or null */
  next: () => QueueItem | null
  /** Go back to previous track. Returns the previous QueueItem or null */
  previous: () => QueueItem | null
  /** Toggle shuffle on/off (Fisher-Yates when on, restore original when off) */
  toggleShuffle: () => void
  /** Cycle repeat: off → all → one → off */
  cycleRepeat: () => void
  /** Set the current index directly */
  setCurrentIndex: (index: number) => void
  /** Record a track ID in history (max 50) */
  addToHistory: (trackId: string) => void
  /** Clear the history */
  clearHistory: () => void
  /** Get the next N items after currentIndex without mutating state */
  getNextItems: (count: number) => QueueItem[]
  /** Get the previous N items before currentIndex from history */
  getPreviousItems: (count: number) => QueueItem[]
  /** Update offline status for a track */
  updateOfflineStatus: (trackId: string, isOffline: boolean) => void
  /** Set loading state for next batch */
  setLoadingNext: (loading: boolean) => void
  /** Clear the entire queue */
  clearQueue: () => void
}

type QueueStore = QueueState & QueueActions

const MAX_HISTORY = 50

/** Fisher-Yates shuffle, keeping the item at keepIndex in place */
function shuffleArray<T>(arr: T[], keepIndex: number): T[] {
  const result = [...arr]
  // Move the keep item to index 0
  if (keepIndex > 0 && keepIndex < result.length) {
    const keep = result.splice(keepIndex, 1)[0]
    result.unshift(keep)
  }
  // Shuffle everything after index 0
  for (let i = result.length - 1; i > 0; i--) {
    const j = 1 + Math.floor(Math.random() * i)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** AI shuffle — groups tracks by genre/artist similarity for cohesive listening.
 *  Keeps the current track at index 0, then sorts remaining tracks so that
 *  songs with the same genre or artist are played consecutively. */
function aiShuffle(items: QueueItem[], currentIndex: number): QueueItem[] {
  if (items.length <= 2) return [...items]

  const result = [...items]
  const current = currentIndex >= 0 && currentIndex < result.length ? result.splice(currentIndex, 1)[0] : null

  // Sort by genre then artist for cohesive flow
  result.sort((a, b) => {
    const genreA = a.track.genre ?? ''
    const genreB = b.track.genre ?? ''
    if (genreA !== genreB) return genreA.localeCompare(genreB)
    // Same genre — group by artist
    const artistA = a.track.artists?.[0] ?? ''
    const artistB = b.track.artists?.[0] ?? ''
    return artistA.localeCompare(artistB)
  })

  if (current) result.unshift(current)
  return result
}

export const useQueueStore = create<QueueStore>()(
  persist(
    (set, get) => ({
      items: [],
      currentIndex: 0,
      history: [],
      originalOrder: [],
      shuffleMode: 'normal' as ShuffleMode,
      repeatMode: 'off' as RepeatMode,
      isLoadingNext: false,

      setQueue: (items, startIndex = 0) => {
        const originalOrder = items.map((i) => i.track.id)
        set({
          items,
          currentIndex: startIndex,
          originalOrder,
        })
      },

      appendToQueue: (newItems) => {
        set((s) => {
          const items = [...s.items, ...newItems]
          const originalOrder = [...s.originalOrder, ...newItems.map((i) => i.track.id)]
          return { items, originalOrder }
        })
      },

      prependToQueue: (newItems) => {
        set((s) => {
          // Insert right after currentIndex
          const insertAt = s.currentIndex + 1
          const items = [
            ...s.items.slice(0, insertAt),
            ...newItems,
            ...s.items.slice(insertAt),
          ]
          const originalOrder = items.map((i) => i.track.id)
          return { items, originalOrder }
        })
      },

      removeFromQueue: (index) => {
        set((s) => {
          const items = s.items.filter((_, i) => i !== index)
          const originalOrder = items.map((i) => i.track.id)
          // Adjust currentIndex if needed
          let currentIndex = s.currentIndex
          if (index < currentIndex) currentIndex--
          else if (index === currentIndex) currentIndex = Math.min(currentIndex, items.length - 1)
          return { items, originalOrder, currentIndex }
        })
      },

      moveItem: (fromIndex, toIndex) => {
        set((s) => {
          const items = [...s.items]
          const [moved] = items.splice(fromIndex, 1)
          items.splice(toIndex, 0, moved)
          const originalOrder = items.map((i) => i.track.id)
          return { items, originalOrder }
        })
      },

      next: () => {
        const s = get()
        const { items, currentIndex, repeatMode, shuffleMode } = s

        if (items.length === 0) return null

        // Repeat one: return same track
        if (repeatMode === 'one') {
          return items[currentIndex] ?? null
        }

        const nextIndex = currentIndex + 1

        // End of queue
        if (nextIndex >= items.length) {
          if (repeatMode === 'all') {
            // Wrap around
            set({ currentIndex: 0 })
            return items[0] ?? null
          }
          // No repeat — end of queue
          return null
        }

        set({ currentIndex: nextIndex })
        return items[nextIndex]
      },

      previous: () => {
        const s = get()
        const { items, currentIndex, history } = s

        // If we have history, go back
        if (history.length > 0) {
          const prevTrackId = history[0]
          const prevIndex = items.findIndex((i) => i.track.id === prevTrackId)
          if (prevIndex >= 0) {
            set({ currentIndex: prevIndex })
            return items[prevIndex]
          }
        }

        // Otherwise go to previous index
        if (currentIndex > 0) {
          const prevIndex = currentIndex - 1
          set({ currentIndex: prevIndex })
          return items[prevIndex]
        }

        return null
      },

      toggleShuffle: () => {
        set((s) => {
          const modes: ShuffleMode[] = ['normal', 'random', 'ai']
          const nextMode = modes[(modes.indexOf(s.shuffleMode) + 1) % modes.length]
          const currentItemId = s.items[s.currentIndex]?.track.id

          if (nextMode === 'normal') {
            // Restore original order
            const restoredOrder = s.originalOrder
            const items = [...s.items].sort((a, b) => {
              const aIdx = restoredOrder.indexOf(a.track.id)
              const bIdx = restoredOrder.indexOf(b.track.id)
              return aIdx - bIdx
            })
            const newCurrentIndex = currentItemId
              ? items.findIndex((i) => i.track.id === currentItemId)
              : 0
            return {
              items,
              currentIndex: Math.max(0, newCurrentIndex),
              shuffleMode: 'normal' as ShuffleMode,
            }
          } else if (nextMode === 'random') {
            // Fisher-Yates random shuffle
            const shuffled = shuffleArray(s.items, s.currentIndex)
            const newCurrentIndex = currentItemId
              ? shuffled.findIndex((i) => i.track.id === currentItemId)
              : 0
            return {
              items: shuffled,
              currentIndex: newCurrentIndex,
              shuffleMode: 'random' as ShuffleMode,
            }
          } else {
            // AI shuffle — sort by genre/mood similarity
            const aiSorted = aiShuffle(s.items, s.currentIndex)
            const newCurrentIndex = currentItemId
              ? aiSorted.findIndex((i) => i.track.id === currentItemId)
              : 0
            return {
              items: aiSorted,
              currentIndex: newCurrentIndex,
              shuffleMode: 'ai' as ShuffleMode,
            }
          }
        })
      },

      cycleRepeat: () => {
        set((s) => {
          const modes: RepeatMode[] = ['off', 'all', 'one']
          const nextIdx = (modes.indexOf(s.repeatMode) + 1) % modes.length
          return { repeatMode: modes[nextIdx] }
        })
      },

      setCurrentIndex: (index) => set({ currentIndex: index }),

      addToHistory: (trackId) => {
        set((s) => {
          // Remove if already in history, then prepend
          const filtered = s.history.filter((id) => id !== trackId)
          return { history: [trackId, ...filtered].slice(0, MAX_HISTORY) }
        })
      },

      clearHistory: () => set({ history: [] }),

      getNextItems: (count) => {
        const { items, currentIndex } = get()
        return items.slice(currentIndex + 1, currentIndex + 1 + count)
      },

      getPreviousItems: (count) => {
        const { history } = get()
        return history.slice(0, count)
          .map((id) => get().items.find((i) => i.track.id === id))
          .filter((item): item is QueueItem => item != null)
      },

      updateOfflineStatus: (trackId, isOffline) => {
        set((s) => ({
          items: s.items.map((item) =>
            item.track.id === trackId
              ? { ...item, isAvailableOffline: isOffline }
              : item
          ),
        }))
      },

      setLoadingNext: (isLoadingNext) => set({ isLoadingNext }),

      clearQueue: () => set({
        items: [],
        currentIndex: 0,
        originalOrder: [],
        isLoadingNext: false,
      }),
    }),
    {
      name: 'inka-queue',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        history: state.history,
        shuffleMode: state.shuffleMode,
        repeatMode: state.repeatMode,
        originalOrder: state.originalOrder,
      }),
    }
  )
)