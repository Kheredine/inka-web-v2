export interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
  bio?: string
  country?: string
  created_at: string
}

export type SoundStatus = 'processing' | 'ready' | 'error'

export interface Sound {
  id: string
  title: string
  artist: string
  artists: string[]
  producer?: string
  genre?: string
  country?: string
  year?: number
  duration: number
  lyrics?: string
  description?: string
  audio_url: string
  audio_url_original?: string
  uploaded_by: string
  uploader?: Profile
  play_count: number
  is_public: boolean
  created_at: string
  reactions?: Reaction[]
  // Compression pipeline
  status?: SoundStatus
  compression_attempts?: number
  compressed_at?: string
  file_size_original?: number
  file_size_compressed?: number
  bitrate?: number
  audio_format?: string
  acoustid_fingerprint?: string
  storage_ref?: string
  // Enrichissement IA
  mood?: string
  energy_level?: number
  themes?: string[]
  similar_sounds?: string[]
  // Video
  youtube_url?: string
}

export interface Playlist {
  id: string
  title: string
  description?: string
  created_by: string
  creator?: Profile
  is_public: boolean
  created_at: string
  sounds?: Sound[]
  sound_count?: number
}

export interface Album {
  id: string
  title: string
  artist_name: string
  cover_url?: string
  created_at?: string
}

export interface Share {
  id: string
  from_user: string
  to_user: string
  sound_id?: string
  playlist_id?: string
  sound?: Sound
  playlist?: Playlist
  sender?: Profile
  message?: string
  is_read: boolean
  created_at: string
}

export type ReactionEmoji = 'fire' | 'heart' | 'sleep' | 'pray'

export interface Reaction {
  id: string
  sound_id: string
  user_id: string
  emoji: ReactionEmoji
  created_at: string
  user?: Profile
}

export interface PlayHistory {
  id: string
  user_id: string
  sound_id: string
  sound?: Sound
  played_at: string
}

export const REACTION_EMOJIS: Record<ReactionEmoji, string> = {
  fire:  '🔥',
  heart: '❤️',
  sleep: '😴',
  pray:  '🙏',
}

// ── External releases (Deezer) ─────────────────────────────────────────────────

export type ReleaseType = 'album' | 'ep' | 'single'

export interface ArtistReleaseCard {
  artistId: number
  artistName: string
  artistImage: string
  fanCount: number
  latestRelease: {
    id: number
    title: string
    type: ReleaseType
    releaseDate: string
    cover: string
  }
}

export interface ReleaseItem {
  id: number
  title: string
  type: ReleaseType
  releaseDate: string
  cover: string
  coverXl: string
  trackCount: number
}

export interface ReleaseTrack {
  id: number
  title: string
  duration: number
  position: number
  previewUrl: string | null
}

export interface SavedRelease {
  id: number
  title: string
  type: ReleaseType
  artistId: number
  artistName: string
  cover: string
  releaseDate: string
  savedAt: string
}
