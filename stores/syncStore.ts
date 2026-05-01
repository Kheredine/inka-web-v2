// ── Sync Store ───────────────────────────────────────────────────────────────
// Memory-only, high-frequency updates. Drives the audio↔video sync UI.
// Never persisted — resets on every page load.
import { create } from 'zustand'

export interface SyncState {
  isVideoReady: boolean
  isAudioReady: boolean
  drift: number               // seconds, |video - audio|
  lastSyncAt: number           // performance.now() timestamp
  isSyncing: boolean
  videoError: string | null
  fallbackToAudio: boolean     // when video fails, sticky-stay in audio mode
}

export interface SyncActions {
  setVideoReady: (ready: boolean) => void
  setAudioReady: (ready: boolean) => void
  setDrift: (drift: number) => void
  setSyncing: (syncing: boolean) => void
  setVideoError: (error: string | null) => void
  setFallbackToAudio: (fallback: boolean) => void
  reset: () => void
}

type SyncStore = SyncState & SyncActions

const initialState: SyncState = {
  isVideoReady: false,
  isAudioReady: false,
  drift: 0,
  lastSyncAt: 0,
  isSyncing: false,
  videoError: null,
  fallbackToAudio: false,
}

export const useSyncStore = create<SyncStore>()((set) => ({
  ...initialState,

  setVideoReady: (isVideoReady) => set({ isVideoReady }),
  setAudioReady: (isAudioReady) => set({ isAudioReady }),
  setDrift: (drift) => set({ drift, lastSyncAt: performance.now() }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setVideoError: (videoError) => set({ videoError }),
  setFallbackToAudio: (fallbackToAudio) => set({ fallbackToAudio }),
  reset: () => set(initialState),
}))