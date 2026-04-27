import { NextResponse } from 'next/server'

// Resolves the correct Deezer artist ID for a given artist name by cross-referencing
// known song titles from Inka's DB against each candidate's Deezer top tracks.
// Called by the upload page after insert and by the backfill admin route.
export const dynamic = 'force-dynamic'

const FRESH: RequestInit = { cache: 'no-store' }

interface DeezerArtist {
  id: number
  name: string
  nb_fan: number
  picture_medium: string
}

interface DeezerTrack {
  title: string
}

function nameMatches(a: string, b: string): boolean {
  const na = a.toLowerCase().trim()
  const nb = b.toLowerCase().trim()
  return na === nb || na.startsWith(nb) || nb.startsWith(na)
}

async function searchCandidates(artistName: string): Promise<DeezerArtist[]> {
  try {
    const res = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName)}&limit=10`,
      FRESH
    )
    if (!res.ok) return []
    const norm = artistName.toLowerCase().trim()
    const all = ((await res.json()).data ?? []) as DeezerArtist[]

    // Exact-name matches first, then prefix matches
    const exact = all.filter((r) => r.name.toLowerCase().trim() === norm)
    if (exact.length > 0) return exact
    return all.filter((r) => nameMatches(artistName, r.name))
  } catch {
    return []
  }
}

async function scoreCandidateByTitles(
  candidate: DeezerArtist,
  knownTitles: string[]
): Promise<number> {
  if (!knownTitles.length) return 0
  try {
    const res = await fetch(
      `https://api.deezer.com/artist/${candidate.id}/top?limit=50`,
      FRESH
    )
    if (!res.ok) return 0
    const tracks = ((await res.json()).data ?? []) as DeezerTrack[]
    const deezerTitles = tracks.map((t) => t.title.toLowerCase().trim())

    let score = 0
    for (const title of knownTitles) {
      const norm = title.toLowerCase().trim()
      if (deezerTitles.some((dt) => dt === norm || dt.includes(norm) || norm.includes(dt))) {
        score++
      }
    }
    return score
  } catch {
    return 0
  }
}

export async function resolveDeezerArtistId(
  artistName: string,
  knownTitles: string[]
): Promise<number | null> {
  const candidates = await searchCandidates(artistName)
  if (!candidates.length) return null

  // Single candidate — no ambiguity, return immediately
  if (candidates.length === 1) return candidates[0].id

  // Multiple candidates — score each by title overlap with Inka's DB
  const scores = await Promise.allSettled(
    candidates.slice(0, 5).map(async (c) => ({
      candidate: c,
      score: await scoreCandidateByTitles(c, knownTitles),
    }))
  )

  const ranked = scores
    .filter(
      (r): r is PromiseFulfilledResult<{ candidate: DeezerArtist; score: number }> =>
        r.status === 'fulfilled'
    )
    .map((r) => r.value)
    .sort((a, b) => b.score - a.score || b.candidate.nb_fan - a.candidate.nb_fan)

  const best = ranked[0]
  if (!best) return null

  // If no title matched any candidate, fall back to the highest fan count
  console.log(
    `[resolve-deezer] "${artistName}" → ID ${best.candidate.id} "${best.candidate.name}" ` +
    `(score=${best.score}, fans=${best.candidate.nb_fan})`
  )

  return best.candidate.id
}

// ── HTTP handler — used by upload page ────────────────────────────────────────

export async function POST(req: Request) {
  const { artistName, titles } = (await req.json()) as {
    artistName: string
    titles: string[]
  }

  if (!artistName?.trim()) {
    return NextResponse.json({ deezerId: null }, { status: 400 })
  }

  const deezerId = await resolveDeezerArtistId(artistName.trim(), titles ?? [])
  return NextResponse.json({ deezerId })
}
