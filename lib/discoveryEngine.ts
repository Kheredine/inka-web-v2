// ── Discovery Engine ─────────────────────────────────────────────────────────
// Generates personalized recommendations based on user taste signals.
// Runs client-side with SWR caching. Falls back to trending if no taste data.
import useSWR from 'swr'
import { createClient } from '@supabase/supabase-js'
import type { UnifiedTrack } from '@/types/track'
import { soundToUnifiedTrack } from '@/types/track'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface DiscoveryParams {
  userId: string | null
  limit?: number
  seedTrackId?: string
}

// ── Fetcher: personalized recommendations ────────────────────────────────────

async function fetchRecommendations(params: DiscoveryParams): Promise<UnifiedTrack[]> {
  const { userId, limit = 20, seedTrackId } = params

  if (!userId) {
    // No user: return trending sounds
    return fetchTrending(limit)
  }

  try {
    // Step 1: Get user's top genres from taste signals
    const { data: tasteSignals } = await supabase
      .from('user_taste_signals')
      .select('sound_id, weight, sounds(genre)')
      .eq('user_id', userId)
      .order('weight', { ascending: false })
      .limit(50)

    if (!tasteSignals || tasteSignals.length === 0) {
      return fetchTrending(limit)
    }

    // Step 2: Weight genres by accumulated taste signal
    const genreWeights = new Map<string, number>()
    const listenedIds = new Set(tasteSignals.map((s) => s.sound_id))

    for (const signal of tasteSignals) {
      const genre = (signal.sounds as unknown as { genre: string })?.genre
      if (genre) {
        genreWeights.set(genre, (genreWeights.get(genre) ?? 0) + signal.weight)
      }
    }

    // Step 3: Get top 3 genres
    const topGenres = [...genreWeights.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre]) => genre)

    // Step 4: Fetch sounds from those genres the user hasn't heard
    const { data: recommendations } = await supabase
      .from('sounds')
      .select('*')
      .in('genre', topGenres)
      .not('id', 'in', `(${[...listenedIds].slice(0, 50).join(',')})`)
      .neq('user_id', userId)
      .gt('play_count', 10)
      .order('play_count', { ascending: false })
      .limit(limit)

    if (recommendations && recommendations.length > 0) {
      // Shuffle for variety
      return shuffleArray(recommendations.map(soundToUnifiedTrack))
    }

    // Fallback: if seed track provided, get similar
    if (seedTrackId) {
      return fetchSimilar(seedTrackId, limit)
    }

    return fetchTrending(limit)
  } catch (err) {
    console.error('[Discovery] Error:', err)
    return fetchTrending(limit)
  }
}

async function fetchTrending(limit: number): Promise<UnifiedTrack[]> {
  const { data } = await supabase
    .from('sounds')
    .select('*')
    .gt('play_count', 50)
    .order('play_count', { ascending: false })
    .limit(limit)
  return (data ?? []).map(soundToUnifiedTrack)
}

async function fetchSimilar(trackId: string, limit: number): Promise<UnifiedTrack[]> {
  // Get the seed track's genre, then find similar
  const { data: seed } = await supabase
    .from('sounds')
    .select('genre')
    .eq('id', trackId)
    .single()

  if (!seed) return fetchTrending(limit)

  const { data } = await supabase
    .from('sounds')
    .select('*')
    .eq('genre', seed.genre)
    .neq('id', trackId)
    .gt('play_count', 5)
    .order('play_count', { ascending: false })
    .limit(limit)

  return (data ?? []).map(soundToUnifiedTrack)
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// ── SWR Hook ─────────────────────────────────────────────────────────────────

export function useDiscovery(params: DiscoveryParams) {
  const key = params.userId
    ? `discovery-${params.userId}-${params.seedTrackId ?? 'home'}`
    : 'discovery-trending'

  return useSWR<UnifiedTrack[]>(
    key,
    () => fetchRecommendations(params),
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 60000, // 1 min dedup
    }
  )
}

export { fetchRecommendations, fetchTrending, fetchSimilar }