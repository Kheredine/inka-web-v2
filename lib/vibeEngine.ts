// ── Vibe Engine ───────────────────────────────────────────────────────────────
// Derives a "vibe" (color palette + mood) from the current track.
// Used by the vibeStore to drive mood-reactive UI gradients.
import { useVibeStore, type Vibe, type VibePalette } from '@/stores/vibeStore'
import type { UnifiedTrack } from '@/types/track'

// ── Genre → Vibe mapping ─────────────────────────────────────────────────────

const GENRE_VIBES: Record<string, Vibe> = {
  // Electronic
  'electronic': 'energetic',
  'techno': 'energetic',
  'house': 'energetic',
  'edm': 'energetic',
  'dubstep': 'intense',
  'drum-and-bass': 'intense',
  'trance': 'dreamy',

  // Hip-Hop / R&B
  'hip-hop': 'chill',
  'rap': 'energetic',
  'r&b': 'romantic',
  'soul': 'warm',
  'lo-fi': 'chill',

  // Rock
  'rock': 'energetic',
  'metal': 'intense',
  'punk': 'intense',
  'indie': 'chill',
  'alternative': 'dark',

  // Pop
  'pop': 'happy',
  'k-pop': 'energetic',
  'synthpop': 'dreamy',

  // Ambient / Classical
  'ambient': 'dreamy',
  'classical': 'warm',
  'jazz': 'warm',
  'bossa-nova': 'romantic',

  // Latin / African
  'reggaeton': 'energetic',
  'afrobeats': 'happy',
  'salsa': 'happy',
  'amapiano': 'chill',
}

// ── Vibe → Color palette ─────────────────────────────────────────────────────

const VIBE_PALETTES: Record<Vibe, VibePalette> = {
  energetic: {
    primary: '#f97316',    // orange-500
    secondary: '#ef4444',  // red-500
    background: '#1c1917', // stone-900
    glow: 'rgba(249, 115, 22, 0.15)',
  },
  chill: {
    primary: '#8b5cf6',    // violet-500
    secondary: '#6366f1',  // indigo-500
    background: '#0f0a1a', // deep purple-black
    glow: 'rgba(139, 92, 246, 0.15)',
  },
  dark: {
    primary: '#6b7280',    // gray-500
    secondary: '#374151',  // gray-700
    background: '#030712', // near-black
    glow: 'rgba(107, 114, 128, 0.1)',
  },
  happy: {
    primary: '#f59e0b',    // amber-500
    secondary: '#10b981',  // emerald-500
    background: '#1a1a0a', // warm dark
    glow: 'rgba(245, 158, 11, 0.15)',
  },
  romantic: {
    primary: '#ec4899',    // pink-500
    secondary: '#f43f5e',  // rose-500
    background: '#1a0a14', // dark rose
    glow: 'rgba(236, 72, 153, 0.15)',
  },
  dreamy: {
    primary: '#a78bfa',    // violet-400
    secondary: '#818cf8',  // indigo-400
    background: '#0a0a1f', // deep blue-black
    glow: 'rgba(167, 139, 250, 0.15)',
  },
  intense: {
    primary: '#dc2626',    // red-600
    secondary: '#b91c1c',  // red-700
    background: '#1a0505', // dark red
    glow: 'rgba(220, 38, 38, 0.2)',
  },
  warm: {
    primary: '#d97706',    // amber-600
    secondary: '#92400e',  // amber-800
    background: '#1a1408', // warm dark
    glow: 'rgba(217, 119, 6, 0.15)',
  },
}

// ── Derive vibe from track ───────────────────────────────────────────────────

export function deriveVibe(track: UnifiedTrack): Vibe {
  // Primary: genre mapping
  const genre = (track as unknown as { genre?: string }).genre?.toLowerCase() ?? ''
  if (GENRE_VIBES[genre]) return GENRE_VIBES[genre]

  // Fallback: check tags for mood hints
  const tags = (track as unknown as { tags?: string[] }).tags ?? []
  if (tags.length) {
    const moodMap: Record<string, Vibe> = {
      energetic: 'energetic',
      chill: 'chill',
      dark: 'dark',
      happy: 'happy',
      romantic: 'romantic',
      dreamy: 'dreamy',
      intense: 'intense',
      warm: 'warm',
    }
    for (const tag of tags) {
      if (moodMap[tag.toLowerCase()]) return moodMap[tag.toLowerCase()]
    }
  }

  // Default
  return 'chill'
}

export function getVibePalette(vibe: Vibe): VibePalette {
  return VIBE_PALETTES[vibe]
}

// ── Apply vibe to the store ──────────────────────────────────────────────────

export function applyTrackVibe(track: UnifiedTrack): void {
  const vibe = deriveVibe(track)
  const palette = getVibePalette(vibe)

  useVibeStore.getState().setVibe(vibe)
  useVibeStore.getState().setPalette(palette)

  // Extract dominant color from cover art if available
  extractDominantColor(track.coverArt.medium).then((color) => {
    if (color) {
      useVibeStore.getState().setDominantColor(color)
    }
  })
}

// ── Dominant color extraction via canvas ──────────────────────────────────────

async function extractDominantColor(imageUrl: string): Promise<string | null> {
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imageUrl

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
      setTimeout(() => reject(new Error('timeout')), 3000)
    })

    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(img, 0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return `rgb(${r}, ${g}, ${b})`
  } catch {
    return null
  }
}