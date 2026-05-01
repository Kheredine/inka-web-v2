// ── POST /api/play ────────────────────────────────────────────────────────────
// Records a play event using the atomic record_play RPC.
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sound_id } = body

    if (!sound_id) {
      return NextResponse.json({ error: 'sound_id required' }, { status: 400 })
    }

    // Get user from auth header
    const authHeader = request.headers.get('authorization')
    let userId: string | null = null

    if (authHeader) {
      const { data: { user } } = await supabaseAdmin.auth.getUser(
        authHeader.replace('Bearer ', '')
      )
      userId = user?.id ?? null
    }

    if (!userId) {
      // Anonymous play: just increment play_count directly
      const { error } = await supabaseAdmin.rpc('record_play', {
        p_sound_id: sound_id,
        p_user_id: '00000000-0000-0000-0000-000000000000',
      })
      if (error) console.error('[/api/play] Anon RPC error:', error)
      return NextResponse.json({ ok: true, anonymous: true })
    }

    // Authenticated play: use atomic RPC
    const { error } = await supabaseAdmin.rpc('record_play', {
      p_sound_id: sound_id,
      p_user_id: userId,
    })

    if (error) {
      console.error('[/api/play] RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/play] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}