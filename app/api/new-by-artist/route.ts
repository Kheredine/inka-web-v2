import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Sound } from '@/types'

export const revalidate = 300

function deduplicateByArtist(sounds: Sound[], limit = 8): Sound[] {
  const seen = new Set<string>()
  const result: Sound[] = []
  for (const s of sounds) {
    const key = `${s.artist?.toLowerCase().trim()}::${s.title?.toLowerCase().trim()}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push(s)
    }
    if (result.length >= limit) break
  }
  return result
}

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const since = new Date()
  since.setDate(since.getDate() - 30)

  const { data: recent } = await supabase
    .from('sounds')
    .select('*, uploader:profiles!uploaded_by(*), reactions(*)')
    .eq('is_public', true)
    .not('uploaded_by', 'is', null)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(50)

  const sounds = (recent ?? []) as Sound[]

  if (sounds.length >= 4) {
    return NextResponse.json({ data: deduplicateByArtist(sounds) })
  }

  // Fallback: no recent uploads — use all-time, still deduplicated
  const { data: allTime } = await supabase
    .from('sounds')
    .select('*, uploader:profiles!uploaded_by(*), reactions(*)')
    .eq('is_public', true)
    .not('uploaded_by', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ data: deduplicateByArtist((allTime ?? []) as Sound[]) })
}
