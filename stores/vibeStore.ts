// ── Vibe Store ───────────────────────────────────────────────────────────────
// High-frequency audio analysis data + mood-reactive UI palette.
// NEVER subscribe to the whole store from a component — use selectors.
import { create } from 'zustand'

export interface FrequencyData {
  bass: number       // 0-255
  lowMid: number
  mid: number
  highMid: number
  treble: number
  energy: number     // overall RMS
  isBeat: boolean
}

export type Vibe = 'energetic' | 'chill' | 'dark' | 'happy' | 'romantic' | 'dreamy' | 'intense' | 'warm'

export interface VibePalette {
  primary: string
  secondary: string
  background: string
  glow: string
}

export interface VibeState {
  frequencyData: FrequencyData
  energyLevel: 'low' | 'medium' | 'high'
  isAnalyzing: boolean
  vibe: Vibe
  palette: VibePalette
  dominantColor: string | null
}

export interface VibeActions {
  setFrequencyData: (data: FrequencyData) => void
  setEnergyLevel: (level: 'low' | 'medium' | 'high') => void
  setAnalyzing: (analyzing: boolean) => void
  setVibe: (vibe: Vibe) => void
  setPalette: (palette: VibePalette) => void
  setDominantColor: (color: string | null) => void
}

type VibeStore = VibeState & VibeActions

const defaultFrequency: FrequencyData = {
  bass: 0,
  lowMid: 0,
  mid: 0,
  highMid: 0,
  treble: 0,
  energy: 0,
  isBeat: false,
}

const defaultPalette: VibePalette = {
  primary: '#8b5cf6',
  secondary: '#6366f1',
  background: '#0f0a1a',
  glow: 'rgba(139, 92, 246, 0.15)',
}

export const useVibeStore = create<VibeStore>()((set) => ({
  frequencyData: defaultFrequency,
  energyLevel: 'low',
  isAnalyzing: false,
  vibe: 'chill',
  palette: defaultPalette,
  dominantColor: null,

  setFrequencyData: (frequencyData) => set({ frequencyData }),
  setEnergyLevel: (energyLevel) => set({ energyLevel }),
  setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setVibe: (vibe) => set({ vibe }),
  setPalette: (palette) => set({ palette }),
  setDominantColor: (dominantColor) => set({ dominantColor }),
}))