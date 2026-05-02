/**
 * DELETE /api/delete-sound
 * Body: { soundId: string }
 *
 * Deletes a sound from the database and its file from R2 (if no other sounds reference it).
 * Only the owner can delete their own sounds.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { deleteR2Object } from '@/lib/r2'

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

  const body = await req.json() as { soundId?: string }
  const { soundId } = body

  if (!soundId) {
    return NextResponse.json({ error: 'soundId required' }, { status: 400 })
  }

  // 1. Fetch the sound and verify ownership
  const { data: sound, error: fetchErr } = await sb
    .from('sounds')
    .select('id, audio_url, uploaded_by, storage_ref')
    .eq('id', soundId)
    .single()

  if (fetchErr || !sound) {
    return NextResponse.json({ error: 'Sound not found' }, { status: 404 })
  }

  if (sound.uploaded_by !== user.id) {
    return NextResponse.json({ error: 'You can only delete your own sounds' }, { status: 403 })
  }

  // 2. Delete the database row first (RLS will double-check ownership)
  const { error: deleteErr } = await sb
    .from('sounds')
    .delete()
    .eq('id', soundId)

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  }

  // 3. Try to delete the R2 file if it's an r2:// reference
  try {
    const audioUrl = sound.audio_url as string
    if (audioUrl?.startsWith('r2:')) {
      const r2Key = audioUrl.replace('r2:', '')

      // Check if any other sounds reference the same R2 file (deduplication)
      const storageRef = sound.storage_ref ?? sound.id
      const { data: refs } = await sb
        .from('sounds')
        .select('id')
        .eq('storage_ref', storageRef)
        .limit(1)

      // Also check by audio_url
      const { data: urlRefs } = await sb
        .from('sounds')
        .select('id')
        .eq('audio_url', audioUrl)
        .limit(1)

      // Only delete from R2 if no other sounds reference this file
      if ((!refs || refs.length === 0) && (!urlRefs || urlRefs.length === 0)) {
        await deleteR2Object(r2Key)
      }
    }
  } catch (r2Err) {
    // R2 deletion failure is non-critical — the DB row is already deleted
    console.error('[delete-sound] R2 deletion failed (non-critical):', r2Err)
  }

  return NextResponse.json({ success: true })
}