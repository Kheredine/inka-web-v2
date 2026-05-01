/**
 * POST /api/upload-url
 * Body: { key: string, contentType: string }
 *
 * Returns a presigned PUT URL for the client to upload directly to R2.
 * The key must start with the authenticated user's ID to prevent path traversal.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUploadUrl } from '@/lib/r2'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: { user }, error: authErr } = await sb.auth.getUser(token)
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as { key?: string; contentType?: string }
  const { key, contentType } = body

  if (!key || !contentType) {
    return NextResponse.json({ error: 'key and contentType required' }, { status: 400 })
  }

  // Enforce that the key starts with the user's own ID
  if (!key.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: 'Key must start with your user ID' }, { status: 403 })
  }

  try {
    const uploadUrl = await getUploadUrl(key, contentType)
    return NextResponse.json({ uploadUrl, key })
  } catch (err) {
    console.error('[upload-url] getUploadUrl failed:', err)
    return NextResponse.json({ error: 'R2 presigned URL generation failed', detail: String(err) }, { status: 502 })
  }
}
