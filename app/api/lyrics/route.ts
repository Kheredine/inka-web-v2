/**
 * POST /api/lyrics
 *
 * Recherche les vraies paroles via plusieurs sources gratuites :
 * 1. lrclib.net   — base open-source, parfois synced (LRC), grande couverture
 * 2. lyrics.ovh   — fallback généraliste
 *
 * Aucun IA pour les paroles : on veut les vraies paroles, pas des hallucinations.
 * Si aucune source ne trouve, retourne lyrics: null.
 */

import { NextRequest, NextResponse } from 'next/server'

interface LyricsResult {
  lyrics: string | null
  source: 'lrclib' | 'lyricsovh' | null
  synced: string | null  // LRC timestamps si disponibles
}

async function tryLrcLib(title: string, artist: string): Promise<LyricsResult | null> {
  try {
    const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data = await res.json() as { plainLyrics?: string | null; syncedLyrics?: string | null }
    if (data.plainLyrics?.trim()) {
      return { lyrics: data.plainLyrics.trim(), source: 'lrclib', synced: data.syncedLyrics ?? null }
    }
    return null
  } catch { return null }
}

async function tryLyricsOvh(title: string, artist: string): Promise<LyricsResult | null> {
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data = await res.json() as { lyrics?: string }
    if (data.lyrics?.trim()) {
      return { lyrics: data.lyrics.trim(), source: 'lyricsovh', synced: null }
    }
    return null
  } catch { return null }
}

export async function POST(req: NextRequest) {
  const { title, artist } = (await req.json()) as { title: string; artist: string }

  if (!title || !artist) {
    return NextResponse.json({ lyrics: null, source: null, synced: null })
  }

  // Source 1 : lrclib.net (meilleure couverture, parfois synced)
  const lrclib = await tryLrcLib(title, artist)
  if (lrclib) return NextResponse.json(lrclib)

  // Source 2 : lyrics.ovh
  const ovh = await tryLyricsOvh(title, artist)
  if (ovh) return NextResponse.json(ovh)

  // Aucune source trouvée
  return NextResponse.json({ lyrics: null, source: null, synced: null })
}
