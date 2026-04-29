import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ArtistReleaseCard, ReleaseType } from '@/types'
import { resolveDeezerArtistId } from '@/lib/resolve-deezer-artist'

export const dynamic = 'force-dynamic'

const NINETY_DAYS_MS = 90  * 24 * 60 * 60 * 1000
const SIX_MONTHS_MS  = 180 * 24 * 60 * 60 * 1000
const FRESH: RequestInit = { cache: 'no-store' }

// ── Types ──────────────────────────────────────────────────────────────────────

interface ArtistEntry {
  name: string
  titles: string[]      // song titles from Inka DB — used for Deezer disambiguation
  deezerId?: number     // stored directly → skip search entirely when present
}

interface DeezerArtist {
  id: number
  name: string
  picture_medium: string
  nb_fan: number
}

interface DeezerAlbum {
  id: number
  title: string
  release_date: string
  record_type: string
  cover_medium: string
  // nb_tracks is NOT present in the /artist/{id}/albums list endpoint
}

interface ItunesCollection {
  wrapperType: string
  artistName: string
  collectionId: number
  collectionName: string
  releaseDate: string
  artworkUrl100: string
  trackCount: number
}

interface LatestRelease {
  id: number
  title: string
  type: ReleaseType
  releaseDate: string
  cover: string
}

interface ArtistDebug {
  name: string
  deezerId: number | null
  deezerFound: boolean
  deezerAlbums: number
  itunesFound: boolean
  hitTitle: string | null
  hitDate: string | null
  reason: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function deezerType(t: string): ReleaseType {
  const l = t.toLowerCase()
  if (l === 'ep') return 'ep'
  if (l === 'single') return 'single'
  return 'album'
}

function itunesType(trackCount: number): ReleaseType {
  if (trackCount === 1) return 'single'
  if (trackCount <= 6) return 'ep'
  return 'album'
}

// Deezer's "no image" patterns:
//   1. Empty path segment:            /images/artist//250x250-...
//   2. MD5 of empty string as hash:   d41d8cd98f00b204e9800998ecf8427e
// Both resolve to a grey square — onError never fires on the client.
const DEEZER_EMPTY_HASH = 'd41d8cd98f00b204e9800998ecf8427e'

function isDefaultDeezerImage(url: string): boolean {
  if (!url) return true
  if (url.includes('/images/artist//') || url.includes('/images/cover//')) return true
  if (url.includes(DEEZER_EMPTY_HASH)) return true
  return false
}

// Verify that an album's primary artist matches the expected Deezer artist ID.
// Deezer's /artist/{id}/albums includes albums where the artist is only featured.
async function isPrimaryRelease(albumId: number, artistId: number): Promise<boolean> {
  try {
    const res = await fetch(`https://api.deezer.com/album/${albumId}`, FRESH)
    if (!res.ok) return true
    const data = await res.json()
    return (data.artist?.id ?? artistId) === artistId
  } catch {
    return true
  }
}

// ── DB ─────────────────────────────────────────────────────────────────────────

async function getAllDbArtists(): Promise<ArtistEntry[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await supabase
    .from('sounds')
    .select('artist, title, deezer_artist_id')
    .eq('is_public', true)

  if (error) {
    console.error('[fresh-drops] DB error:', error.message)
    return []
  }

  const map = new Map<string, ArtistEntry>()
  for (const s of (data ?? []) as { artist: string; title: string; deezer_artist_id: number | null }[]) {
    const key = s.artist?.trim()
    if (!key) continue
    const norm = key.toLowerCase()

    if (!map.has(norm)) {
      map.set(norm, { name: key, titles: [], deezerId: s.deezer_artist_id ?? undefined })
    }
    const entry = map.get(norm)!
    if (s.title?.trim()) entry.titles.push(s.title.trim())
    // Prefer the first non-null stored ID we find
    if (!entry.deezerId && s.deezer_artist_id) entry.deezerId = s.deezer_artist_id
  }

  const out = Array.from(map.values())
  console.log(`[fresh-drops] ${out.length} unique artists from DB:`, out.map((a) => a.name))
  return out
}

// ── Deezer ────────────────────────────────────────────────────────────────────

async function deezerGetArtist(id: number): Promise<DeezerArtist | null> {
  try {
    const res = await fetch(`https://api.deezer.com/artist/${id}`, FRESH)
    return res.ok ? (await res.json()) as DeezerArtist : null
  } catch {
    return null
  }
}

async function deezerGetAlbums(artistId: number): Promise<DeezerAlbum[]> {
  try {
    const res = await fetch(
      `https://api.deezer.com/artist/${artistId}/albums?limit=50`,
      FRESH
    )
    if (!res.ok) return []
    return ((await res.json()).data ?? []) as DeezerAlbum[]
  } catch {
    return []
  }
}

// ── iTunes ────────────────────────────────────────────────────────────────────

async function itunesRecentRelease(name: string): Promise<ItunesCollection | null> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=album&limit=25&country=fr`,
      FRESH
    )
    if (!res.ok) return null
    const cutoff = Date.now() - SIX_MONTHS_MS
    const norm = name.toLowerCase().trim()

    const hit = ((await res.json()).results ?? [] as ItunesCollection[])
      .filter(
        (r: ItunesCollection) => {
          const an = (r.artistName ?? '').toLowerCase().trim()
          return (
            r.wrapperType === 'collection' &&
            (an === norm || an.startsWith(norm) || norm.startsWith(an)) &&
            new Date(r.releaseDate).getTime() >= cutoff
          )
        }
      )
      .sort(
        (a: ItunesCollection, b: ItunesCollection) =>
          new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
      )[0] as ItunesCollection | undefined

    return hit ?? null
  } catch {
    return null
  }
}

// ── Per-artist check ───────────────────────────────────────────────────────────

async function checkArtist(
  entry: ArtistEntry,
  debugOut?: ArtistDebug[]
): Promise<ArtistReleaseCard | null> {
  const dbg: ArtistDebug = {
    name: entry.name, deezerId: entry.deezerId ?? null,
    deezerFound: false, deezerAlbums: 0,
    itunesFound: false, hitTitle: null, hitDate: null, reason: null,
  }

  // Step 1: Get Deezer artist — use stored ID directly, or resolve via name+title search
  let deezerArtist: DeezerArtist | null = null

  if (entry.deezerId) {
    // Stored ID: direct fetch, no name search, no ambiguity
    deezerArtist = await deezerGetArtist(entry.deezerId)
    if (!deezerArtist) {
      dbg.reason = `stored deezer_artist_id=${entry.deezerId} returned no data`
      debugOut?.push(dbg)
      return null
    }
  } else {
    // No stored ID: resolve via title cross-reference search
    const resolvedId = await resolveDeezerArtistId(entry.name, entry.titles)
    if (!resolvedId) {
      dbg.reason = 'no Deezer artist match'
      debugOut?.push(dbg)
      console.log(`[fresh-drops] "${entry.name}" → skipped (no Deezer artist)`)
      return null
    }
    deezerArtist = await deezerGetArtist(resolvedId)
    if (!deezerArtist) {
      dbg.reason = `resolved ID ${resolvedId} returned no data`
      debugOut?.push(dbg)
      return null
    }
  }

  dbg.deezerFound = true
  dbg.deezerId = deezerArtist.id

  // Step 2: Fetch full discography + iTunes in parallel
  const [deezerAlbums, itunesHit] = await Promise.all([
    deezerGetAlbums(deezerArtist.id),
    itunesRecentRelease(entry.name),
  ])
  dbg.deezerAlbums = deezerAlbums.length
  dbg.itunesFound = itunesHit !== null

  const now      = Date.now()
  const cutoff90 = now - NINETY_DAYS_MS
  const cutoff6m = now - SIX_MONTHS_MS

  // Sort newest-first.
  // NOTE: Deezer's /artist/{id}/albums list endpoint does NOT include nb_tracks.
  const sorted = deezerAlbums
    .filter((a) => a.release_date)
    .sort((a, b) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime())

  // Pool: 90-day window first, 6-month fallback for quarterly-release artists
  const pool = sorted.filter((a) => new Date(a.release_date).getTime() >= cutoff90)
  const pool6m = sorted.filter((a) => new Date(a.release_date).getTime() >= cutoff6m)
  const candidates = pool.length > 0 ? pool : pool6m

  // Walk candidates newest-first, verifying primary artist to skip features
  let deezerHit: DeezerAlbum | null = null
  for (const candidate of candidates.slice(0, 5)) {
    const primary = await isPrimaryRelease(candidate.id, deezerArtist.id)
    if (primary) { deezerHit = candidate; break }
    console.log(`[fresh-drops] "${entry.name}" — skipping feature album "${candidate.title}"`)
  }

  const deezerRelease: LatestRelease | null = deezerHit
    ? {
        id: deezerHit.id,
        title: deezerHit.title,
        type: deezerType(deezerHit.record_type),
        releaseDate: deezerHit.release_date,
        cover: deezerHit.cover_medium,
      }
    : null

  // Step 3: Cross-reference iTunes result against Deezer album list by title
  // CRITICAL: iTunes collectionId ≠ Deezer album ID (separate namespaces).
  // Always use the Deezer album ID for navigation.
  let itunesRelease: LatestRelease | null = null
  if (itunesHit) {
    const itunesNorm = itunesHit.collectionName.toLowerCase().trim()
    const deezerMatch = deezerAlbums.find((a) => {
      const dn = a.title.toLowerCase().trim()
      return dn === itunesNorm || dn.includes(itunesNorm) || itunesNorm.includes(dn)
    })
    if (deezerMatch) {
      itunesRelease = {
        id: deezerMatch.id,
        title: deezerMatch.title,
        type: itunesType(itunesHit.trackCount),
        releaseDate: itunesHit.releaseDate.split('T')[0],
        cover: (itunesHit.artworkUrl100 ?? '').replace('100x100bb', '600x600bb') || deezerMatch.cover_medium,
      }
    }
  }

  const candidates2 = [deezerRelease, itunesRelease].filter(Boolean) as LatestRelease[]
  if (!candidates2.length) {
    const newest = sorted[0]
    dbg.reason = newest
      ? `latest album "${newest.title}" (${newest.release_date}) is outside 6-month window`
      : 'no valid albums on Deezer'
    debugOut?.push(dbg)
    console.log(`[fresh-drops] "${entry.name}" → skipped (${dbg.reason})`)
    return null
  }

  const best = candidates2.sort(
    (a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
  )[0]

  dbg.hitTitle = best.title
  dbg.hitDate  = best.releaseDate
  debugOut?.push(dbg)
  console.log(`[fresh-drops] "${entry.name}" → "${best.title}" (${best.releaseDate})`)

  return {
    artistId: deezerArtist.id,
    artistName: deezerArtist.name,
    artistImage: isDefaultDeezerImage(deezerArtist.picture_medium)
      ? ''
      : deezerArtist.picture_medium,
    fanCount: deezerArtist.nb_fan,
    latestRelease: best,
  }
}

// ── Batching (Deezer rate limit: ~50 req/5 s) ─────────────────────────────────

async function inBatches<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  size = 8
): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = []
  for (let i = 0; i < items.length; i += size) {
    const batch = await Promise.allSettled(items.slice(i, i + size).map(fn))
    out.push(...batch)
    if (i + size < items.length) await new Promise((r) => setTimeout(r, 250))
  }
  return out
}

// ── In-memory cache ────────────────────────────────────────────────────────────

interface CacheEntry { cards: ArtistReleaseCard[]; ts: number }

const CACHE_TTL = 30 * 60 * 1000
const CACHE_VER = 5                     // bump to bust cache after logic changes
let memCache: CacheEntry | null = null
let buildPromise: Promise<ArtistReleaseCard[]> | null = null

async function buildCards(debugLog?: ArtistDebug[]): Promise<ArtistReleaseCard[]> {
  const artists = await getAllDbArtists()
  if (!artists.length) {
    console.log('[fresh-drops] No public artists in DB → returning empty')
    return []
  }

  const results = await inBatches(artists, (entry) => checkArtist(entry, debugLog))

  const cards = results
    .filter((r): r is PromiseFulfilledResult<ArtistReleaseCard> =>
      r.status === 'fulfilled' && r.value !== null
    )
    .map((r) => r.value)
    .sort(
      (a, b) =>
        new Date(b.latestRelease.releaseDate).getTime() -
        new Date(a.latestRelease.releaseDate).getTime()
    )
    .slice(0, 20)

  console.log(`[fresh-drops] v${CACHE_VER}: built ${cards.length} cards`)
  return cards
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const url = new URL(req.url)
  const isDebug = url.searchParams.has('debug')
  const bustCache = url.searchParams.has('bust')

  if (isDebug) {
    const debugLog: ArtistDebug[] = []
    const cards = await buildCards(debugLog)
    return NextResponse.json({ data: cards, debug: debugLog })
  }

  if (bustCache) memCache = null

  if (memCache && Date.now() - memCache.ts < CACHE_TTL) {
    console.log('[fresh-drops] Serving from memory cache')
    return NextResponse.json({ data: memCache.cards })
  }

  if (!buildPromise) {
    buildPromise = buildCards().finally(() => { buildPromise = null })
  }

  const cards = await buildPromise
  memCache = { cards, ts: Date.now() }
  return NextResponse.json({ data: cards })
}
