/**
 * GET /api/spotify/status  — Check if user has Spotify connected
 * DELETE /api/spotify/status  — Disconnect Spotify (remove tokens)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: { user }, error: authErr } = await sb.auth.getUser(token)
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: spotifyToken } = await sb
    .from('spotify_tokens')
    .select('user_id, scope, updated_at')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({
    connected: !!spotifyToken,
    connectedAt: spotifyToken?.updated_at ?? null,
  })
}

export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: { user }, error: authErr } = await sb.auth.getUser(token)
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await sb
    .from('spotify_tokens')
    .delete()
    .eq('user_id', user.id)

  return NextResponse.json({ success: true })
}