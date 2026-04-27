import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { data: profiles, error } = await db
    .from('profiles')
    .select('id, username, display_name, country, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!profiles?.length) return NextResponse.json([])

  const ids = profiles.map((p: { id: string }) => p.id)
  const { data: soundStats } = await db
    .from('sounds')
    .select('uploaded_by, play_count')
    .in('uploaded_by', ids)
    .eq('is_public', true)

  const byUser: Record<string, { count: number; plays: number }> = {}
  for (const s of soundStats ?? []) {
    const u = s as { uploaded_by: string; play_count: number }
    if (!byUser[u.uploaded_by]) byUser[u.uploaded_by] = { count: 0, plays: 0 }
    byUser[u.uploaded_by].count++
    byUser[u.uploaded_by].plays += u.play_count ?? 0
  }

  return NextResponse.json(
    profiles.map((p: { id: string; username: string; display_name: string; country: string | null; created_at: string }) => ({
      ...p,
      sound_count: byUser[p.id]?.count ?? 0,
      total_plays: byUser[p.id]?.plays ?? 0,
    }))
  )
}
