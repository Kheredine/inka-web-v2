/**
 * GET /api/popular
 * Returns sounds trending over the last 7 days, ranked by recent play count.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString()

  // Fetch recent play events
  const { data: plays } = await supabase
    .from('play_history')
    .select('sound_id')
    .gte('played_at', since)

  if (!plays?.length) {
    // Fall back to all-time top if no recent history
    const { data } = await supabase
      .from('sounds')
      .select('*, uploader:profiles!uploaded_by(*), reactions(*)')
      .eq('is_public', true)
      .order('play_count', { ascending: false })
      .limit(12)
    return NextResponse.json(data ?? [])
  }

  // Count plays per sound
  const counts: Record<string, number> = {}
  for (const p of plays) counts[p.sound_id] = (counts[p.sound_id] ?? 0) + 1

  // Top 12 IDs by recent plays
  const topIds = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([id]) => id)

  const { data: sounds } = await supabase
    .from('sounds')
    .select('*, uploader:profiles!uploaded_by(*), reactions(*)')
    .in('id', topIds)
    .eq('is_public', true)

  // Re-sort by recent play count (Supabase IN doesn't preserve order)
  const sorted = (sounds ?? []).sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))

  return NextResponse.json(sorted)
}
