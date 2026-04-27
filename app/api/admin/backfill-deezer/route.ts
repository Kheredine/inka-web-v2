import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveDeezerArtistId } from '@/app/api/resolve-deezer-artist/route'

// One-shot backfill: resolves and stores deezer_artist_id for every artist in the DB
// that doesn't have one yet. Hit GET /api/admin/backfill-deezer once after deploying
// the migration. Safe to re-run (skips artists that already have an ID).
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // Vercel: allow up to 5 min for large libraries

export async function GET(req: Request) {
  // Basic protection — require a secret token so this can't be triggered publicly
  const token = new URL(req.url).searchParams.get('token')
  if (token !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch all sounds that need resolution
  const { data, error } = await supabase
    .from('sounds')
    .select('artist, title')
    .eq('is_public', true)
    .is('deezer_artist_id', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Group songs by artist
  const byArtist = new Map<string, string[]>()
  for (const s of (data ?? []) as { artist: string; title: string }[]) {
    const key = s.artist?.trim()
    if (!key) continue
    const norm = key.toLowerCase()
    if (!byArtist.has(norm)) byArtist.set(norm, [])
    byArtist.get(norm)!.push(s.title ?? '')
  }

  const results: { artist: string; deezerId: number | null }[] = []

  for (const [normName, titles] of byArtist) {
    // Find original casing
    const original = (data ?? []).find(
      (s) => (s as { artist: string }).artist?.trim().toLowerCase() === normName
    ) as { artist: string } | undefined
    const artistName = original?.artist?.trim() ?? normName

    const deezerId = await resolveDeezerArtistId(artistName, titles)
    results.push({ artist: artistName, deezerId })

    if (deezerId) {
      await supabase
        .from('sounds')
        .update({ deezer_artist_id: deezerId })
        .ilike('artist', artistName)
        .is('deezer_artist_id', null)
    }

    // Respect Deezer rate limit (up to 3 calls per artist in scoreCandidateByTitles)
    await new Promise((r) => setTimeout(r, 150))
  }

  const resolved = results.filter((r) => r.deezerId !== null).length
  console.log(`[backfill-deezer] ${resolved}/${results.length} artists resolved`)

  return NextResponse.json({
    total: results.length,
    resolved,
    failed: results.filter((r) => r.deezerId === null).map((r) => r.artist),
    results,
  })
}
