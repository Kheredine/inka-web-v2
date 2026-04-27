import { NextRequest, NextResponse } from 'next/server'
import { askAI, parseJSON } from '@/lib/ai'

interface EnrichRequest {
  title: string
  artist: string
  genre?: string
}

export interface EnrichResponse {
  mood: string[]
  energy_level: number
  description: string
  similar_in_app_query: string
  similar_external: Array<{ title: string; artist: string }>
  release_type: string
  album_name: string
  release_date: string
  themes: string[]
}

// ── MusicBrainz lookup for factual metadata ────────────────────────────────────

async function getMusicBrainzInfo(title: string, artist: string) {
  try {
    const q = encodeURIComponent(`recording:"${title}" AND artist:"${artist}"`)
    const res = await fetch(
      `https://musicbrainz.org/ws/2/recording?query=${q}&fmt=json&limit=1&inc=artist-credits+releases+genres+tags`,
      { headers: { 'User-Agent': 'Inka/1.0 (contact@inka.app)' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const rec = data.recordings?.[0]
    if (!rec) return null
    return {
      release_date: rec['first-release-date']?.slice(0, 4) ?? '',
      album_name: rec.releases?.[0]?.title ?? '',
      release_type: rec.releases?.[0]?.['release-group']?.['primary-type'] ?? 'Unknown',
    }
  } catch { return null }
}

export async function POST(req: NextRequest) {
  const { title, artist, genre } = (await req.json()) as EnrichRequest

  // Fetch real release info and AI-based mood/themes in parallel
  const [mbInfo, aiRaw] = await Promise.all([
    getMusicBrainzInfo(title, artist),
    askAI(
      `Tu es un expert musical. Analyse le titre "${title}" par "${artist}"${genre ? ` (${genre})` : ''}.

Retourne UNIQUEMENT un objet JSON avec ces champs exacts :
{
  "mood": tableau de 3 à 5 tags d'ambiance en français (ex: ["mélancolique", "introspectif"]),
  "energy_level": entier de 1 à 10 (1=très calme, 10=très énergique),
  "description": description atmosphérique de 2 phrases en français,
  "similar_in_app_query": terme de recherche (artiste ou genre) pour trouver des sons similaires,
  "similar_external": tableau de exactement 3 objets { "title": string, "artist": string } de chansons similaires,
  "themes": tableau de 2 à 3 tags thématiques lyriques en français
}

Réponds uniquement en JSON, sans markdown.`,
      500
    ).catch(() => null),
  ])

  try {
    const ai = aiRaw ? parseJSON<Omit<EnrichResponse, 'release_date' | 'album_name' | 'release_type'>>(aiRaw) : {}
    return NextResponse.json({
      ...ai,
      // Use real MusicBrainz data when available, fall back to empty strings
      release_date: mbInfo?.release_date ?? '',
      album_name: mbInfo?.album_name ?? '',
      release_type: mbInfo?.release_type ?? 'Unknown',
    } as EnrichResponse)
  } catch (e) {
    console.error('[enrich] error:', e)
    return NextResponse.json({ error: 'enrichment failed', detail: String(e) }, { status: 500 })
  }
}
