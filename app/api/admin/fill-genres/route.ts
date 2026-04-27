/**
 * POST /api/admin/fill-genres
 *
 * Finds all public sounds with no genre, then for each:
 *  1. Tries MusicBrainz → genre from recordings
 *  2. Falls back to Last.fm top tag
 *  3. Falls back to OpenAI inference
 * Updates the genre field in the DB for each match found.
 *
 * Returns a report: { total, updated, skipped, results[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { askAI } from '@/lib/ai'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function toTitleCase(str: string): string {
  return str.split(' ').map((w) => w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w).join(' ').trim()
}

// ── MusicBrainz ───────────────────────────────────────────────────────────────

async function getGenreFromMusicBrainz(title: string, artist: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`recording:"${title}" AND artist:"${artist}"`)
    const res = await fetch(
      `https://musicbrainz.org/ws/2/recording?query=${q}&fmt=json&limit=1&inc=genres+tags`,
      { headers: { 'User-Agent': 'Inka/1.0 (contact@inka.app)' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const rec = data.recordings?.[0]
    if (!rec) return null
    const genre = rec.genres?.[0]?.name ?? rec.tags?.[0]?.name ?? null
    return genre ? toTitleCase(genre) : null
  } catch { return null }
}

// ── Last.fm ───────────────────────────────────────────────────────────────────

async function getGenreFromLastFm(title: string, artist: string): Promise<string | null> {
  const key = process.env.LASTFM_API_KEY
  if (!key) return null
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${key}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&format=json&autocorrect=1`
    const res = await fetch(url, { headers: { 'User-Agent': 'Inka/1.0 (contact@inka.app)' } })
    if (!res.ok) return null
    const data = await res.json()
    const tags: Array<{ name: string }> = data?.track?.toptags?.tag ?? []
    // Filter out generic tags like 'seen live', 'favourites', etc.
    const SKIP = new Set(['seen live', 'favourites', 'favorite', 'love', 'awesome', 'good', 'best'])
    const genre = tags.find((t) => !SKIP.has(t.name.toLowerCase()))?.name ?? null
    return genre ? toTitleCase(genre) : null
  } catch { return null }
}

// ── OpenAI fallback ────────────────────────────────────────────────────────────

async function getGenreFromAI(title: string, artist: string): Promise<string | null> {
  try {
    const raw = await askAI(
      `What is the music genre of "${title}" by "${artist}"? Reply with only the genre name, nothing else. One or two words maximum. Examples: "Rap", "R&B", "Afrobeats", "Pop", "Soul", "Jazz", "Electronic".`,
      20
    )
    const genre = raw.trim().replace(/^["']|["']$/g, '')
    return genre.length > 0 && genre.length < 30 ? toTitleCase(genre) : null
  } catch { return null }
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Optional: restrict to admin
  const { limit = 50 } = await req.json().catch(() => ({})) as { limit?: number }

  // Fetch sounds with no genre
  const { data: sounds, error } = await supabaseAdmin
    .from('sounds')
    .select('id, title, artist')
    .eq('is_public', true)
    .or('genre.is.null,genre.eq.')
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!sounds?.length) return NextResponse.json({ total: 0, updated: 0, skipped: 0, results: [] })

  const results: Array<{ id: string; title: string; artist: string; genre: string | null; source: string }> = []
  let updated = 0

  for (const sound of sounds) {
    // MusicBrainz rate limit: 1 req/sec
    await new Promise((r) => setTimeout(r, 1100))

    let genre: string | null = null
    let source = 'none'

    genre = await getGenreFromMusicBrainz(sound.title, sound.artist)
    if (genre) { source = 'musicbrainz' }

    if (!genre) {
      genre = await getGenreFromLastFm(sound.title, sound.artist)
      if (genre) source = 'lastfm'
    }

    if (!genre) {
      genre = await getGenreFromAI(sound.title, sound.artist)
      if (genre) source = 'openai'
    }

    if (genre) {
      await supabaseAdmin.from('sounds').update({ genre }).eq('id', sound.id)
      updated++
    }

    results.push({ id: sound.id, title: sound.title, artist: sound.artist, genre, source })
  }

  return NextResponse.json({
    total: sounds.length,
    updated,
    skipped: sounds.length - updated,
    results,
  })
}
