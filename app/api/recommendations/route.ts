/**
 * GET /api/recommendations?userId=<uuid>&limit=<n>
 *
 * Hybrid recommendation engine for "Pour Toi":
 *   A) Content-based  — genre + artist match from user history
 *   B) Collaborative  — sounds endorsed by taste-similar users
 *   C) Trending       — high engagement in last 48 h
 *   D) Fresh          — recent uploads (last 90 days)
 *
 * Scoring (weighted sum, all weights sum to 1.00):
 *   genre_match   * 0.35
 *   artist_match  * 0.20
 *   collab_score  * 0.20
 *   trending      * 0.15
 *   recency       * 0.10
 *
 * Diversity guards: max 3 sounds/artist, max 6 sounds/genre.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Sound } from '@/types'

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 40

/** Window for "recent" user activity used to build taste profile */
const PROFILE_WINDOW_MS = 14 * 86_400_000

/** Window for trending play count */
const TRENDING_WINDOW_MS = 48 * 3_600_000

/** Age threshold for "fresh" candidates */
const FRESH_DAYS = 90

/** A user who played ≥ this many times already knows the song well */
const HEAVY_PLAY_THRESHOLD = 3

/** Reaction signal weights (sleep = weak negative, excluded from pool) */
const REACTION_WEIGHT: Record<string, number> = {
  fire: 4,
  heart: 3,
  pray: 2,
  sleep: -2,
}

/** Diversity caps */
const MAX_PER_ARTIST = 3
const MAX_PER_GENRE = 6

// Supabase service-role client (full read access, no RLS)
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Types ──────────────────────────────────────────────────────────────────────

interface ScoredSound {
  sound: Sound
  score: number
}

interface RecommendationMeta {
  personal: boolean
  topGenres: string[]
  topArtists: string[]
  candidateCount: number
  returnedCount: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function sanitize(s: string): string {
  return s.replace(/[%,()[\]]/g, '')
}

/** Exponential decay: score=1 when age=0, score≈0.22 at 90 days (λ=45d) */
function recencyScore(createdAt: string): number {
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86_400_000
  return Math.exp(-ageDays / 45)
}

// ── Fallback for new users ─────────────────────────────────────────────────────

async function getFallback(limit: number): Promise<NextResponse> {
  const { data } = await sb
    .from('sounds')
    .select('*, uploader:profiles!uploaded_by(*), reactions(*)')
    .eq('is_public', true)
    .order('play_count', { ascending: false })
    .limit(limit)

  return NextResponse.json({
    sounds: data ?? [],
    meta: {
      personal: false,
      topGenres: [],
      topArtists: [],
      candidateCount: 0,
      returnedCount: (data ?? []).length,
    } satisfies RecommendationMeta,
  })
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const userId = searchParams.get('userId')
  const limit = Math.min(Number(searchParams.get('limit') ?? DEFAULT_LIMIT), MAX_LIMIT)

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const now = Date.now()
  const since14d = new Date(now - PROFILE_WINDOW_MS).toISOString()
  const since48h = new Date(now - TRENDING_WINDOW_MS).toISOString()
  const since90d = new Date(now - FRESH_DAYS * 86_400_000).toISOString()

  // ── Step 1: Build user taste profile ────────────────────────────────────────
  const [{ data: allPlaysRaw }, { data: allReactionsRaw }] = await Promise.all([
    sb.from('play_history')
      .select('sound_id, played_at')
      .eq('user_id', userId)
      .order('played_at', { ascending: false })
      .limit(500),
    sb.from('reactions')
      .select('sound_id, emoji, created_at')
      .eq('user_id', userId)
      .limit(200),
  ])

  const allPlays = allPlaysRaw ?? []
  const allReactions = allReactionsRaw ?? []

  // Count plays per sound
  const playCounts: Record<string, number> = {}
  for (const p of allPlays) {
    playCounts[p.sound_id] = (playCounts[p.sound_id] ?? 0) + 1
  }

  // Sounds played heavily (exclude from recommendations — user already knows them)
  const heavyPlayIds = new Set(
    Object.entries(playCounts)
      .filter(([, n]) => n >= HEAVY_PLAY_THRESHOLD)
      .map(([id]) => id)
  )

  // All sounds ever played (exclude from recommendations)
  const playedIds = new Set(Object.keys(playCounts))

  // Reaction scoring: positive signals build taste profile, sleep = exclude
  const reactedPositive: Record<string, number> = {}
  const dislikedIds = new Set<string>()

  for (const r of allReactions) {
    const w = REACTION_WEIGHT[r.emoji] ?? 0
    if (w < 0) {
      dislikedIds.add(r.sound_id)
    } else if (w > 0) {
      reactedPositive[r.sound_id] = (reactedPositive[r.sound_id] ?? 0) + w
    }
  }

  const excludeIds = new Set([...playedIds, ...dislikedIds])

  // New user — no interaction history at all
  if (!allPlays.length && !allReactions.length) {
    return getFallback(limit)
  }

  // Fetch genre + artist for every interacted sound
  const interactedIds = [...new Set([...playedIds, ...Object.keys(reactedPositive)])]
  const { data: interactedMeta } = await sb
    .from('sounds')
    .select('id, genre, artist')
    .in('id', interactedIds.slice(0, 300))

  // Weighted genre and artist scores
  const genreScores: Record<string, number> = {}
  const artistScores: Record<string, number> = {}

  for (const s of (interactedMeta ?? []) as { id: string; genre?: string; artist?: string }[]) {
    const playPts = Math.min(playCounts[s.id] ?? 0, 5) // cap contribution
    const reactionPts = reactedPositive[s.id] ?? 0
    const totalPts = playPts + reactionPts
    if (!totalPts) continue

    if (s.genre) genreScores[s.genre] = (genreScores[s.genre] ?? 0) + totalPts
    if (s.artist) artistScores[s.artist] = (artistScores[s.artist] ?? 0) + totalPts
  }

  const topGenres = Object.entries(genreScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([g]) => g)

  const topArtists = Object.entries(artistScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([a]) => a)

  const topGenreSet = new Set(topGenres)
  const topArtistSet = new Set(topArtists)

  // Edge case: user played sounds but they all have missing genre/artist
  if (!topGenres.length && !topArtists.length) {
    return getFallback(limit)
  }

  // ── Step 2: Build candidate pool (parallel) ──────────────────────────────────

  // Prepare OR conditions for genre/artist queries
  const genreConditions = topGenres
    .slice(0, 4)
    .map((g) => `genre.ilike.%${sanitize(g)}%`)
    .join(',')

  const [
    genreResult,
    artistResult,
    freshResult,
    trendingPlaysResult,
    collabPeersResult,
  ] = await Promise.all([
    // A) Content: genre match
    genreConditions
      ? sb.from('sounds')
          .select('*, uploader:profiles!uploaded_by(*), reactions(*)')
          .eq('is_public', true)
          .or(genreConditions)
          .order('play_count', { ascending: false })
          .limit(80)
      : Promise.resolve({ data: [] }),

    // A) Content: artist match
    topArtists.length
      ? sb.from('sounds')
          .select('*, uploader:profiles!uploaded_by(*), reactions(*)')
          .eq('is_public', true)
          .in('artist', topArtists.slice(0, 6))
          .order('play_count', { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] }),

    // D) Fresh: recent uploads
    sb.from('sounds')
      .select('*, uploader:profiles!uploaded_by(*), reactions(*)')
      .eq('is_public', true)
      .gte('created_at', since90d)
      .order('created_at', { ascending: false })
      .limit(30),

    // C) Trending raw: play events in last 48 h
    sb.from('play_history')
      .select('sound_id')
      .gte('played_at', since48h),

    // B) Collaborative step 1: find peer users
    // Peers = users who positively reacted to sounds the current user liked
    Object.keys(reactedPositive).length
      ? sb.from('reactions')
          .select('user_id')
          .in('sound_id', Object.keys(reactedPositive).slice(0, 30))
          .in('emoji', ['fire', 'heart', 'pray'])
          .neq('user_id', userId)
          .limit(60)
      : Promise.resolve({ data: [] }),
  ])

  // Trending play count map
  const trendingCounts: Record<string, number> = {}
  for (const p of (trendingPlaysResult.data ?? [])) {
    trendingCounts[p.sound_id] = (trendingCounts[p.sound_id] ?? 0) + 1
  }
  const maxTrending = Math.max(...Object.values(trendingCounts), 1)

  // ── Step 2b: Collaborative step 2 — get sounds endorsed by peers ────────────
  const peerIds = [...new Set((collabPeersResult.data ?? []).map((r: { user_id: string }) => r.user_id))].slice(0, 30)

  let collabData: Sound[] = []
  let collabEndorsements: Record<string, number> = {}

  if (peerIds.length) {
    const { data: peerReactions } = await sb
      .from('reactions')
      .select('sound_id, emoji')
      .in('user_id', peerIds)
      .in('emoji', ['fire', 'heart'])
      .limit(200)

    // Count endorsements per sound
    for (const r of (peerReactions ?? [])) {
      const w = r.emoji === 'fire' ? 2 : 1
      collabEndorsements[r.sound_id] = (collabEndorsements[r.sound_id] ?? 0) + w
    }

    // Fetch the most-endorsed sounds not already in other candidate sets
    const collabSoundIds = Object.entries(collabEndorsements)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([id]) => id)

    if (collabSoundIds.length) {
      const { data } = await sb
        .from('sounds')
        .select('*, uploader:profiles!uploaded_by(*), reactions(*)')
        .in('id', collabSoundIds)
        .eq('is_public', true)
      collabData = (data as Sound[]) ?? []
    }
  }

  const maxCollab = Math.max(...Object.values(collabEndorsements), 1)

  // ── Step 3: Merge + deduplicate candidates ───────────────────────────────────
  const candidateMap = new Map<string, Sound>()
  const allCandidateLists = [
    genreResult.data ?? [],
    artistResult.data ?? [],
    freshResult.data ?? [],
    collabData,
  ]
  for (const list of allCandidateLists) {
    for (const s of list as Sound[]) {
      if (!candidateMap.has(s.id)) candidateMap.set(s.id, s)
    }
  }

  // ── Step 4: Score each candidate ────────────────────────────────────────────
  const scored: ScoredSound[] = []

  for (const [, s] of candidateMap) {
    // Hard filters
    if (excludeIds.has(s.id)) continue
    if (!s.is_public) continue

    // Genre match (partial match if genre contains a top-genre substring)
    let genreMatch = 0
    if (s.genre) {
      if (topGenreSet.has(s.genre)) {
        genreMatch = 1
      } else {
        for (const tg of topGenres) {
          if (s.genre.toLowerCase().includes(tg.toLowerCase()) ||
              tg.toLowerCase().includes(s.genre.toLowerCase())) {
            genreMatch = 0.6
            break
          }
        }
      }
    }

    // Artist match
    const artistMatch = s.artist && topArtistSet.has(s.artist) ? 1 : 0

    // Collaborative: normalized endorsement count from peers
    const collab = collabEndorsements[s.id]
      ? Math.min(collabEndorsements[s.id] / maxCollab, 1)
      : 0

    // Trending: normalized 48h play count
    const trending = trendingCounts[s.id]
      ? Math.min(trendingCounts[s.id] / maxTrending, 1)
      : 0

    // Recency: exponential decay (λ = 45 days)
    const recency = recencyScore(s.created_at)

    const score =
      genreMatch * 0.35 +
      artistMatch * 0.20 +
      collab     * 0.20 +
      trending   * 0.15 +
      recency    * 0.10

    scored.push({ sound: s, score })
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // ── Step 5: Diversity filter ─────────────────────────────────────────────────
  const result: Sound[] = []
  const artistCount: Record<string, number> = {}
  const genreCount: Record<string, number> = {}

  for (const { sound } of scored) {
    if (result.length >= limit) break

    const artistKey = sound.artist ?? ''
    const genreKey = sound.genre ?? ''

    if ((artistCount[artistKey] ?? 0) >= MAX_PER_ARTIST) continue
    if (genreKey && (genreCount[genreKey] ?? 0) >= MAX_PER_GENRE) continue

    result.push(sound)
    artistCount[artistKey] = (artistCount[artistKey] ?? 0) + 1
    if (genreKey) genreCount[genreKey] = (genreCount[genreKey] ?? 0) + 1
  }

  // ── Step 6: Top-up with popular if result is thin ────────────────────────────
  if (result.length < limit / 2) {
    const resultIds = new Set(result.map((s) => s.id))
    const { data: popular } = await sb
      .from('sounds')
      .select('*, uploader:profiles!uploaded_by(*), reactions(*)')
      .eq('is_public', true)
      .order('play_count', { ascending: false })
      .limit(limit)

    for (const s of (popular as Sound[]) ?? []) {
      if (result.length >= limit) break
      if (!resultIds.has(s.id) && !excludeIds.has(s.id)) {
        result.push(s)
        resultIds.add(s.id)
      }
    }
  }

  return NextResponse.json({
    sounds: result,
    meta: {
      personal: true,
      topGenres,
      topArtists,
      candidateCount: candidateMap.size,
      returnedCount: result.length,
    } satisfies RecommendationMeta,
  })
}
