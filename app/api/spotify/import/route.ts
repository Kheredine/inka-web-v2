/**
 * POST /api/spotify/import
 * Fetches liked tracks, playlists, and saved albums from Spotify.
 * Body: { type: 'liked' | 'playlists' | 'albums' | 'all' }
 *
 * Returns the fetched data for the client to display and optionally import.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getLikedTracks, getUserPlaylists, getPlaylistTracks, getSavedAlbums, refreshAccessToken } from '@/lib/spotify'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getValidToken(userId: string): Promise<string> {
  const { data: tokenRow, error } = await sb
    .from('spotify_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !tokenRow) {
    throw new Error('No Spotify connection found')
  }

  // Check if token is expired
  const expiresAt = new Date(tokenRow.expires_at)
  if (expiresAt.getTime() < Date.now() + 60000) {
    // Token expired, refresh it
    const refreshed = await refreshAccessToken(tokenRow.refresh_token)
    await sb
      .from('spotify_tokens')
      .update({
        access_token: refreshed.access_token,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
    return refreshed.access_token
  }

  return tokenRow.access_token
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: { user }, error: authErr } = await sb.auth.getUser(token)
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as { type?: string }
  const type = body.type ?? 'all'

  try {
    const accessToken = await getValidToken(user.id)
    const likedTracks: { spotify_id: string; name: string; artists: string; album: string; album_art: string | null; duration_ms: number; spotify_url: string }[] = []
    const playlists: { spotify_id: string; name: string; description: string; image: string | null; track_count: number; owner: string; is_public: boolean; spotify_url: string }[] = []
    const albums: { spotify_id: string; name: string; artists: string; image: string | null; album_type: string; release_date: string; total_tracks: number }[] = []

    if (type === 'liked' || type === 'all') {
      const tracks = await getLikedTracks(accessToken)
      likedTracks.push(...tracks.map(t => ({
        spotify_id: t.id,
        name: t.name,
        artists: t.artists.map(a => a.name).join(', '),
        album: t.album?.name ?? '',
        album_art: t.album?.images?.[0]?.url ?? null,
        duration_ms: t.duration_ms,
        spotify_url: t.external_urls?.spotify ?? '',
      })))

      if (likedTracks.length > 0) {
        await sb.from('spotify_liked_tracks').upsert(
          likedTracks.map(t => ({ user_id: user.id, ...t })),
          { onConflict: 'user_id,spotify_id', ignoreDuplicates: true }
        )
      }
    }

    if (type === 'playlists' || type === 'all') {
      const rawPlaylists = await getUserPlaylists(accessToken)
      playlists.push(...rawPlaylists.map(p => ({
        spotify_id: p.id,
        name: p.name,
        description: p.description ?? '',
        image: p.images?.[0]?.url ?? null,
        track_count: p.tracks?.total ?? 0,
        owner: p.owner?.display_name ?? 'Unknown',
        is_public: p.public ?? false,
        spotify_url: p.external_urls?.spotify ?? '',
      })))

      if (playlists.length > 0) {
        await sb.from('spotify_playlists').upsert(
          playlists.map(p => ({ user_id: user.id, ...p })),
          { onConflict: 'user_id,spotify_id', ignoreDuplicates: true }
        )
      }
    }

    if (type === 'albums' || type === 'all') {
      const rawAlbums = await getSavedAlbums(accessToken)
      albums.push(...rawAlbums.map(a => ({
        spotify_id: a.album.id,
        name: a.album.name,
        artists: a.album.artists.map(ar => ar.name).join(', '),
        image: a.album?.images?.[0]?.url ?? null,
        album_type: a.album.album_type,
        release_date: a.album.release_date,
        total_tracks: a.album.total_tracks,
      })))

      if (albums.length > 0) {
        await sb.from('spotify_saved_albums').upsert(
          albums.map(a => ({ user_id: user.id, ...a })),
          { onConflict: 'user_id,spotify_id', ignoreDuplicates: true }
        )
      }
    }

    return NextResponse.json({ likedTracks, playlists, albums })
  } catch (err) {
    console.error('[spotify/import] Failed:', err)
    if (err instanceof Error && err.message === 'No Spotify connection found') {
      return NextResponse.json({ error: 'Spotify not connected — please connect first' }, { status: 400 })
    }
    if (err instanceof Error && err.message.includes('TOKEN_EXPIRED')) {
      return NextResponse.json({ error: 'Spotify token expired, please reconnect' }, { status: 401 })
    }
    if (err instanceof Error && err.message.includes('Spotify API error')) {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    const detail = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Import failed: ${detail}` }, { status: 500 })
  }
}