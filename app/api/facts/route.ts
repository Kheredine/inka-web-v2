/**
 * POST /api/facts
 *
 * Fetches REAL information from Wikipedia and Last.fm, then uses OpenAI
 * to extract 3 interesting facts from that real content.
 * Never invents facts — AI only formats verified real-world data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { askAI, parseJSON } from '@/lib/ai'

export interface Fact {
  title: string
  content: string
}

export interface FactsResponse {
  facts: Fact[]
}

// ── Wikipedia REST API (free, no key) ──────────────────────────────────────────

async function fetchWikipedia(query: string): Promise<string | null> {
  try {
    const slug = encodeURIComponent(query.replace(/ /g, '_'))
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`,
      { headers: { 'User-Agent': 'Inka/1.0 (contact@inka.app)' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.extract ?? null
  } catch { return null }
}

async function searchWikipedia(query: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json`,
      { headers: { 'User-Agent': 'Inka/1.0 (contact@inka.app)' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const firstTitle = data[1]?.[0]
    if (!firstTitle) return null
    return fetchWikipedia(firstTitle)
  } catch { return null }
}

// ── Last.fm (free API key via LASTFM_API_KEY env var) ─────────────────────────

async function fetchLastFmTrack(artist: string, title: string): Promise<string | null> {
  const key = process.env.LASTFM_API_KEY
  if (!key) return null
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${key}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&format=json&autocorrect=1`
    const res = await fetch(url, { headers: { 'User-Agent': 'Inka/1.0 (contact@inka.app)' } })
    if (!res.ok) return null
    const data = await res.json()
    const wiki = data?.track?.wiki?.content
    if (!wiki) return null
    // Strip Last.fm read-more links
    return wiki.replace(/<a href="[^"]*">[^<]*<\/a>/g, '').replace(/<[^>]+>/g, '').trim() || null
  } catch { return null }
}

async function fetchLastFmArtist(artist: string): Promise<string | null> {
  const key = process.env.LASTFM_API_KEY
  if (!key) return null
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getInfo&api_key=${key}&artist=${encodeURIComponent(artist)}&format=json&autocorrect=1`
    const res = await fetch(url, { headers: { 'User-Agent': 'Inka/1.0 (contact@inka.app)' } })
    if (!res.ok) return null
    const data = await res.json()
    const bio = data?.artist?.bio?.content
    if (!bio) return null
    return bio.replace(/<a href="[^"]*">[^<]*<\/a>/g, '').replace(/<[^>]+>/g, '').trim() || null
  } catch { return null }
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { title, artist, album } = (await req.json()) as { title: string; artist: string; album?: string }

  // Fetch real sources in parallel
  const [trackWiki, artistWiki, lfTrack, lfArtist] = await Promise.all([
    searchWikipedia(`${title} ${artist} song`),
    fetchWikipedia(artist),
    fetchLastFmTrack(artist, title),
    fetchLastFmArtist(artist),
  ])

  const sources = [
    trackWiki && `[Wikipedia — chanson]\n${trackWiki}`,
    artistWiki && `[Wikipedia — artiste]\n${artistWiki}`,
    lfTrack && `[Last.fm — chanson]\n${lfTrack}`,
    lfArtist && `[Last.fm — artiste]\n${lfArtist}`,
  ].filter(Boolean).join('\n\n')

  if (!sources) {
    return NextResponse.json({ facts: [] }, { status: 200 })
  }

  const prompt = `Voici des informations RÉELLES et VÉRIFIÉES sur la chanson "${title}" par "${artist}"${album ? ` (album : ${album})` : ''} :

${sources}

À partir de ces informations réelles uniquement (ne rien inventer), extrais 3 faits intéressants, insolites, amusants ou des anecdotes sur la chanson, l'artiste ou l'album.
Si une information n'est pas dans les sources ci-dessus, ne l'inclus pas.

Retourne UNIQUEMENT un objet JSON :
{
  "facts": [
    { "title": "titre court du fait (5 mots max)", "content": "explication de 1 à 2 phrases" },
    { "title": "...", "content": "..." },
    { "title": "...", "content": "..." }
  ]
}

Réponds uniquement en JSON, sans markdown.`

  try {
    const raw = await askAI(prompt, 600)
    const data = parseJSON<FactsResponse>(raw)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ facts: [] }, { status: 500 })
  }
}
