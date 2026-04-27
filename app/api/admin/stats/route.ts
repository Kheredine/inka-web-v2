import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString()

  const [
    { count: users },
    { count: sounds },
    { data: playsData },
    { count: reactions },
    { count: playlists },
    { count: noGenre },
    { count: newUsers },
    { count: newSounds },
  ] = await Promise.all([
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('sounds').select('*', { count: 'exact', head: true }).eq('is_public', true),
    db.from('sounds').select('play_count').eq('is_public', true),
    db.from('reactions').select('*', { count: 'exact', head: true }),
    db.from('playlists').select('*', { count: 'exact', head: true }),
    db.from('sounds').select('*', { count: 'exact', head: true }).eq('is_public', true).or('genre.is.null,genre.eq.'),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
    db.from('sounds').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
  ])

  const totalPlays = (playsData ?? []).reduce(
    (s: number, r: { play_count: number }) => s + (r.play_count ?? 0), 0
  )

  return NextResponse.json({
    users: users ?? 0,
    sounds: sounds ?? 0,
    totalPlays,
    reactions: reactions ?? 0,
    playlists: playlists ?? 0,
    soundsNoGenre: noGenre ?? 0,
    newUsersWeek: newUsers ?? 0,
    newSoundsWeek: newSounds ?? 0,
  })
}
