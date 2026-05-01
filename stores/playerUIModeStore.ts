// ── Player UI Mode Store ─────────────────────────────────────────────────────
// PURELY UI — never persisted. Reset on every page load.
import { create } from 'zustand'

export interface PlayerUIModeState {
  isExpanded: boolean
  mode: 'audio' | 'video' | 'story'
  isFullscreen: boolean
  activeTab: 'up-next' | 'lyrics' | 'about' | 'related'
  showQueue: boolean
  showSleepTimer: boolean
  sleepTimerMinutes: number | null
}

export interface PlayerUIModeActions {
  setExpanded: (expanded: boolean) => void
  toggleExpanded: () => void
  setMode: (mode: 'audio' | 'video' | 'story') => void
  toggleMode: () => void
  setFullscreen: (fullscreen: boolean) => void
  setActiveTab: (tab: PlayerUIModeState['activeTab']) => void
  toggleQueue: () => void
  setShowQueue: (show: boolean) => void
  setSleepTimer: (minutes: number | null) => void
}

type PlayerUIModeStore = PlayerUIModeState & PlayerUIModeActions

const initialState: PlayerUIModeState = {
  isExpanded: false,
  mode: 'audio',
  isFullscreen: false,
  activeTab: 'up-next',
  showQueue: false,
  showSleepTimer: false,
  sleepTimerMinutes: null,
}

export const usePlayerUIModeStore = create<PlayerUIModeStore>()((set) => ({
  ...initialState,

  setExpanded: (isExpanded) => set({ isExpanded }),
  toggleExpanded: () => set((s) => ({ isExpanded: !s.isExpanded })),
  setMode: (mode) => set({ mode }),
  toggleMode: () => set((s) => ({ mode: s.mode === 'audio' ? 'video' : s.mode === 'video' ? 'story' : 'audio' })),
  setFullscreen: (isFullscreen) => set({ isFullscreen }),
  setActiveTab: (activeTab) => set({ activeTab }),
  toggleQueue: () => set((s) => ({ showQueue: !s.showQueue })),
  setShowQueue: (showQueue) => set({ showQueue }),
  setSleepTimer: (sleepTimerMinutes) => set({ sleepTimerMinutes }),
}))