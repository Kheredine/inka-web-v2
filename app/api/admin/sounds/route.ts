import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const search = new URL(req.url).searchParams.get('q') ?? ''

  const q = db
    .from('sounds')
    .select('id, title, artist, genre, play_count, is_public, created_at, uploader:profiles!uploaded_by(username, display_name)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (search.trim()) {
    const s = search.trim().replace(/[%,()]/g, '')
    q.or(`title.ilike.%${s}%,artist.ilike.%${s}%`)
  }

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function PATCH(req: NextRequest) {
  const { id, is_public } = await req.json()
  const { error } = await db.from('sounds').update({ is_public }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await db.from('reactions').delete().eq('sound_id', id)
  await db.from('playlist_sounds').delete().eq('sound_id', id)
  await db.from('play_history').delete().eq('sound_id', id)
  const { error } = await db.from('sounds').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
