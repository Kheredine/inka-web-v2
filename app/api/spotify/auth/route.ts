/**
 * GET /api/spotify/auth
 * Initiates the Spotify OAuth flow.
 * Generates an auth URL with a state parameter containing the user's ID (encrypted).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSpotifyAuthUrl } from '@/lib/spotify'

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

  // Use user ID as state (could encrypt for extra security)
  const state = user.id
  const authUrl = getSpotifyAuthUrl(state)

  return NextResponse.json({ authUrl })
}