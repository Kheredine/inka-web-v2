import useSWR from 'swr'
import { supabase } from '@/lib/supabase'
import type { Sound, ArtistReleaseCard } from '@/types'

interface RecommendationResult {
  sounds: Sound[]
  meta: {
    personal: boolean
    topGenres: string[]
    topArtists: string[]
    candidateCount: number
    returnedCount: number
  }
}

// Genres list — rarely changes, cache for 10 min
export function useGenres() {
  return useSWR(
    'browse/genres',
    async () => {
      const { data } = await supabase
        .from('sounds')
        .select('genre')
        .eq('is_public', true)
        .not('genre', 'is', null)
      const unique = [
        ...new Set(
          (data ?? []).map((s: { genre: string }) => s.genre).filter(Boolean)
        ),
      ].sort()
      return unique as string[]
    },
    { dedupingInterval: 10 * 60 * 1000 },
  )
}

// Recent uploads — cache for 2 min
export function useRecentSounds(limit = 12) {
  return useSWR(
    `browse/recent/${limit}`,
    async () => {
      const { data } = await supabase
        .from('sounds')
        .select('*, uploader:profiles!uploaded_by(*), reactions(*)')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(limit)
      return (data as Sound[]) ?? []
    },
    { dedupingInterval: 2 * 60 * 1000 },
  )
}

// Popular this week — cache for 10 min
export function usePopularSounds() {
  return useSWR<Sound[]>(
    'browse/popular',
    async () => {
      const res = await fetch('/api/popular')
      if (!res.ok) return []
      return res.json()
    },
    { dedupingInterval: 10 * 60 * 1000 },
  )
}

// External releases (Fresh Drops) — cache for 30 min
export function useFreshDrops() {
  return useSWR<ArtistReleaseCard[]>(
    'browse/fresh-drops',
    async () => {
      const res = await fetch('/api/recent-releases')
      if (!res.ok) return []
      const body = await res.json()
      return Array.isArray(body.data) ? body.data : []
    },
    { dedupingInterval: 30 * 60 * 1000 },
  )
}

// Personalised "Pour Toi" recommendations — 5 min cache, refreshed on userId change
export function useRecommendations(userId: string | null | undefined, limit = 20) {
  return useSWR<RecommendationResult>(
    userId ? `browse/recommendations/${userId}` : null,
    async () => {
      const res = await fetch(`/api/recommendations?userId=${userId}&limit=${limit}`)
      if (!res.ok) return { sounds: [], meta: { personal: false, topGenres: [], topArtists: [], candidateCount: 0, returnedCount: 0 } }
      return res.json()
    },
    {
      dedupingInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
    },
  )
}
