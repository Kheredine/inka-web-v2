// ── Canonical track schema for Inka V2 ──────────────────────────────────────
// Every layer (DB, API, store, UI) speaks UnifiedTrack. Mismatched shapes are
// a code-review block.

export interface UnifiedTrack {
  id: string
  title: string
  artists: string[]                  // always array, never single string
  album?: string
  albumArtist?: string
  duration: number                   // seconds
  year?: number
  genre?: string

  coverArt: {
    small: string                    // 64×64 — MiniPlayer, lists, MediaSession
    medium: string                   // 300×300 — cards
    large: string                   // 640×640 — FullPlayer
    original: string                // source resolution
  }

  audio: {
    url: string                      // R2 CDN URL or blob: URL when offline
    format: 'mp3' | 'opus' | 'm4a' | 'flac'
    bitrate: number
    isOfflineAvailable: boolean
    localPath?: string               // for offline files
  }

  video?: {
    youtubeVideoId: string
    videoType: 'official' | 'live' | 'lyric' | 'fan'
    matchConfidence: number          // 0-1; below 0.7 hide the toggle
    isEmbeddable: boolean
    thumbnailUrl: string
  }

  // Cultural & emotional metadata (drives Vibe + recommendations)
  mood?: string                      // 'joyful' | 'chill' | 'sad' | 'love' | 'angry' | 'spiritual'
  energyLevel?: 'low' | 'medium' | 'high'
  themes?: string[]
  country?: string                   // ISO 3166-1 alpha-2
  language?: string[]
  afrobeatSubgenre?: string          // 'afrobeats' | 'afrohouse' | 'amapiano' | 'highlife' | ...

  // Social
  playCount: number
  reactionCounts: Record<'fire' | 'heart' | 'sleep' | 'pray', number>
  userReaction?: 'fire' | 'heart' | 'sleep' | 'pray'
  uploadedBy?: string                // user ID
  deezerArtistId?: string            // for external recs
  isUserUpload: boolean
  createdAt: string                  // ISO timestamp
}

export interface QueueItem {
  id: string                         // queue-local UUID, not track ID
  track: UnifiedTrack
  source: 'inka' | 'user-queued' | 'recommendation' | 'radio'
  youtubeVideoId: string | null
  isPreloaded: boolean
  isAvailableOffline: boolean
}

// ── Helper: convert legacy Sound → UnifiedTrack ──────────────────────────────
// The existing `Sound` type from types/index.ts maps here until full migration.
import type { Sound } from './index'

export function soundToUnifiedTrack(s: Sound): UnifiedTrack {
  const coverBase = `/api/cover/${s.id}`
  const energyVal = s.energy_level
  const energyLevel: 'low' | 'medium' | 'high' | undefined =
    energyVal != null
      ? energyVal < 0.33 ? 'low' : energyVal < 0.66 ? 'medium' : 'high'
      : undefined

  return {
    id: s.id,
    title: s.title,
    artists: s.artists?.length ? s.artists : s.artist?.split(',').map((a: string) => a.trim()) ?? ['Unknown'],
    duration: s.duration ?? 0,
    genre: s.genre || undefined,
    year: s.year ?? undefined,
    coverArt: {
      small: `${coverBase}?size=64`,
      medium: `${coverBase}?size=300`,
      large: `${coverBase}?size=640`,
      original: coverBase,
    },
    audio: {
      url: s.audio_url || '',
      format: (s.audio_format === 'opus' ? 'opus' : s.audio_format === 'm4a' ? 'm4a' : s.audio_format as UnifiedTrack['audio']['format']) || 'mp3',
      bitrate: s.bitrate ?? 128,
      isOfflineAvailable: false,
    },
    video: s.youtube_url
      ? {
          youtubeVideoId: extractYouTubeId(s.youtube_url),
          videoType: 'official' as const,
          matchConfidence: 1,
          isEmbeddable: true,
          thumbnailUrl: `https://img.youtube.com/vi/${extractYouTubeId(s.youtube_url)}/hqdefault.jpg`,
        }
      : undefined,
    mood: s.mood || undefined,
    energyLevel,
    themes: s.themes || undefined,
    country: s.country || undefined,
    playCount: s.play_count ?? 0,
    reactionCounts: {
      fire: s.reactions?.filter((r) => r.emoji === 'fire')?.length ?? 0,
      heart: s.reactions?.filter((r) => r.emoji === 'heart')?.length ?? 0,
      sleep: s.reactions?.filter((r) => r.emoji === 'sleep')?.length ?? 0,
      pray: s.reactions?.filter((r) => r.emoji === 'pray')?.length ?? 0,
    },
    uploadedBy: s.uploaded_by,
    isUserUpload: true,
    createdAt: s.created_at,
  }
}

function extractYouTubeId(url: string): string {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/)
  return match?.[1] ?? ''
}
