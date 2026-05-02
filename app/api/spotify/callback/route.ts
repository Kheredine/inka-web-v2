/**
 * GET /api/spotify/callback
 * Handles the Spotify OAuth callback.
 * Exchanges the code for tokens and stores them in the database.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exchangeCode } from '@/lib/spotify'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?spotify_error=${encodeURIComponent(error)}`, req.url)
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/settings?spotify_error=missing_params', req.url)
    )
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCode(code)

    // Store tokens in spotify_tokens table
    const { error: dbErr } = await sb
      .from('spotify_tokens')
      .upsert({
        user_id: state,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scope: tokens.scope,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (dbErr) {
      console.error('[spotify/callback] DB error:', dbErr)
      return NextResponse.redirect(
        new URL('/settings?spotify_error=db_error', req.url)
      )
    }

    // Redirect back to settings with success
    return NextResponse.redirect(
      new URL('/settings?spotify_connected=1', req.url)
    )
  } catch (err) {
    console.error('[spotify/callback] Token exchange failed:', err)
    return NextResponse.redirect(
      new URL('/settings?spotify_error=token_exchange_failed', req.url)
    )
  }
}