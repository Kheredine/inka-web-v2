'use client'
import { create } from 'zustand'

// Maps French theme/mood keywords to accent hues
const THEME_HUES: [string[], number][] = [
  [['melancolique', 'triste', 'nostalgique', 'douleur', 'peine', 'tristesse', 'melancolie', 'lost', 'hurt', 'sad'], 220],
  [['amour', 'romantique', 'sensuel', 'desir', 'passion', 'coeur', 'romance', 'love', 'tender'], 340],
  [['spirituel', 'priere', 'foi', 'divin', 'gospel', 'elevation', 'grace', 'sacred'], 270],
  [['fete', 'joie', 'happy', 'danse', 'celebration', 'euphorique', 'party', 'fun'], 45],
  [['colere', 'rage', 'agressif', 'street', 'trap', 'violence', 'anger', 'dark'], 350],
  [['calme', 'relaxant', 'doux', 'tranquille', 'paisible', 'chill', 'smooth'], 170],
  [['introspectif', 'reflexion', 'meditation', 'pensif', 'profond', 'solitude'], 240],
  [['energique', 'motivant', 'puissant', 'dynamique', 'feu', 'ambition', 'power'], 25],
  [['espoir', 'lumiere', 'positif', 'optimiste', 'hope', 'rise'], 140],
]

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function getDominantHue(words: string[]): number {
  const hueCounts: Record<number, number> = {}
  const normalized = words.map(normalize)
  for (const [keywords, hue] of THEME_HUES) {
    for (const kw of keywords) {
      const n = normalize(kw)
      const count = normalized.filter((w) => w.includes(n) || n.includes(w)).length
      if (count) hueCounts[hue] = (hueCounts[hue] ?? 0) + count
    }
  }
  const entries = Object.entries(hueCounts).filter(([, c]) => c > 0)
  if (!entries.length) return 25
  return parseInt(entries.sort((a, b) => b[1] - a[1])[0][0])
}

function hueToHex(h: number): { primary: string; dark: string } {
  const toHex = (r: number, g: number, b: number) =>
    '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
  const hsl2rgb = (h: number, s: number, l: number) => {
    s /= 100; l /= 100
    const k = (n: number) => (n + h / 30) % 12
    const a = s * Math.min(l, 1 - l)
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
    return [f(0) * 255, f(8) * 255, f(4) * 255] as const
  }
  return {
    primary: toHex(...hsl2rgb(h, 90, 52)),
    dark: toHex(...hsl2rgb(h, 70, 38)),
  }
}

interface ThemeState {
  accentHue: number
  accentColor: string
  accentColorDark: string
  setAccentHue: (hue: number) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  accentHue: 25,
  accentColor: '#FF6A00',
  accentColorDark: '#D94F2A',
  setAccentHue: (hue) => {
    const { primary, dark } = hueToHex(hue)
    set({ accentHue: hue, accentColor: primary, accentColorDark: dark })
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--accent', primary)
      document.documentElement.style.setProperty('--accent-dark', dark)
      document.documentElement.style.setProperty(
        '--accent-gradient',
        `linear-gradient(135deg, ${primary}, ${dark})`
      )
      document.documentElement.style.setProperty(
        '--accent-glow',
        `hsla(${hue}, 80%, 45%, 0.4)`
      )
    }
  },
}))
