/**
 * Spotify API helper — server-side only.
 * Handles token exchange, refresh, and API calls.
 *
 * Required env vars:
 *   SPOTIFY_CLIENT_ID
 *   SPOTIFY_CLIENT_SECRET
 */

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI ?? 'https://inka-web-xi.vercel.app/api/spotify/callback'

const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const API_BASE = 'https://api.spotify.com/v1'

// ── Token types ────────────────────────────────────────────────────────────────
export interface SpotifyTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope: string
}

// ── Spotify data types ─────────────────────────────────────────────────────────
export interface SpotifyTrack {
  id: string
  name: string
  uri: string
  artists: { id: string; name: string }[]
  album: {
    id: string
    name: string
    images: { url: string; width: number; height: number }[]
    album_type: 'album' | 'single' | 'compilation'
    release_date: string
  }
  duration_ms: number
  external_urls: { spotify: string }
  isrc?: string  // from external_ids when available
}

export interface SpotifyPlaylist {
  id: string
  name: string
  description: string
  images: { url: string; width: number; height: number }[]
  tracks: { total: number; href: string }
  owner: { id: string; display_name: string }
  public: boolean
  external_urls: { spotify: string }
}

export interface SpotifySavedAlbum {
  album: {
    id: string
    name: string
    artists: { id: string; name: string }[]
    images: { url: string; width: number; height: number }[]
    album_type: 'album' | 'single' | 'compilation'
    release_date: string
    total_tracks: number
    external_urls: { spotify: string }
  }
}

// ── OAuth ──────────────────────────────────────────────────────────────────────

/** Generate the Spotify authorization URL */
export function getSpotifyAuthUrl(state: string): string {
  const scopes = [
    'user-library-read',
    'playlist-read-private',
    'playlist-read-collaborative',
  ].join(' ')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: scopes,
    redirect_uri: REDIRECT_URI,
    state,
    show_dialog: 'false',
  })

  return `https://accounts.spotify.com/authorize?${params.toString()}`
}

/** Exchange authorization code for tokens */
export async function exchangeCode(code: string): Promise<SpotifyTokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }).toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Spotify token exchange failed: ${err}`)
  }

  return res.json() as Promise<SpotifyTokens>
}

/** Refresh an expired access token */
export async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Spotify token refresh failed: ${err}`)
  }

  return res.json() as Promise<{ access_token: string; expires_in: number }>
}

// ── API Calls ──────────────────────────────────────────────────────────────────

/** Make an authenticated request to Spotify API */
async function spotifyFetch<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('SPOTIFY_TOKEN_EXPIRED')
    const err = await res.text()
    throw new Error(`Spotify API error (${res.status}): ${err}`)
  }

  return res.json() as Promise<T>
}

/** Fetch all liked/saved tracks (paginated) */
export async function getLikedTracks(accessToken: string): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = []
  let url = '/me/tracks?limit=50'

  while (url) {
    const data = await spotifyFetch<{ items: { track: SpotifyTrack; added_at: string }[]; next: string | null }>(
      accessToken,
      url
    )
    tracks.push(...data.items.map(i => i.track))
    url = data.next ? data.next.replace(API_BASE, '') : ''
  }

  return tracks
}

/** Fetch all user playlists (paginated) */
export async function getUserPlaylists(accessToken: string): Promise<SpotifyPlaylist[]> {
  const playlists: SpotifyPlaylist[] = []
  let url = '/me/playlists?limit=50'

  while (url) {
    const data = await spotifyFetch<{ items: SpotifyPlaylist[]; next: string | null }>(
      accessToken,
      url
    )
    playlists.push(...data.items)
    url = data.next ? data.next.replace(API_BASE, '') : ''
  }

  return playlists
}

/** Fetch tracks from a specific playlist (paginated) */
export async function getPlaylistTracks(accessToken: string, playlistId: string): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = []
  let url = `/playlists/${playlistId}/tracks?limit=100&fields=items(track(id,name,uri,artists(id,name),album(id,name,images,album_type,release_date),duration_ms)),next`

  while (url) {
    const data = await spotifyFetch<{
      items: { track: SpotifyTrack | null }[]
      next: string | null
    }>(accessToken, url)
    tracks.push(...data.items.map(i => i.track).filter((t): t is SpotifyTrack => t !== null))
    url = data.next ? data.next.replace(API_BASE, '') : ''
  }

  return tracks
}

/** Fetch all saved albums (paginated) */
export async function getSavedAlbums(accessToken: string): Promise<SpotifySavedAlbum[]> {
  const albums: SpotifySavedAlbum[] = []
  let url = '/me/albums?limit=50'

  while (url) {
    const data = await spotifyFetch<{ items: SpotifySavedAlbum[]; next: string | null }>(
      accessToken,
      url
    )
    albums.push(...data.items)
    url = data.next ? data.next.replace(API_BASE, '') : ''
  }

  return albums
}

/** Get current Spotify user profile */
export async function getSpotifyProfile(accessToken: string): Promise<{ id: string; display_name: string; images: { url: string }[] }> {
  return spotifyFetch(accessToken, '/me')
}