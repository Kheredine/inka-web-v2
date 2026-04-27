import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { userId } = (await req.json()) as { userId: string }
  if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 })

  // Delete all user data in order (respects FK constraints)
  await supabaseAdmin.from('reactions').delete().eq('user_id', userId)
  await supabaseAdmin.from('play_history').delete().eq('user_id', userId)
  await supabaseAdmin.from('inbox').delete().eq('recipient_id', userId)
  await supabaseAdmin.from('inbox').delete().eq('sender_id', userId)

  // Remove user from playlist_sounds indirectly via playlists
  const { data: playlists } = await supabaseAdmin
    .from('playlists').select('id').eq('created_by', userId)
  if (playlists?.length) {
    const ids = playlists.map((p: { id: string }) => p.id)
    await supabaseAdmin.from('playlist_sounds').delete().in('playlist_id', ids)
    await supabaseAdmin.from('playlists').delete().eq('created_by', userId)
  }

  // Make user sounds private rather than deleting (preserves history for others)
  await supabaseAdmin.from('sounds').update({ is_public: false }).eq('uploaded_by', userId)

  // Delete profile
  await supabaseAdmin.from('profiles').delete().eq('id', userId)

  // Delete auth user
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
