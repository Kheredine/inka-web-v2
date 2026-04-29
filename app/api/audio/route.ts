import { NextRequest, NextResponse } from 'next/server'
import { getAudioUrl } from '@/lib/r2'

// Mappe les extensions vers les Content-Types corrects
const AUDIO_CONTENT_TYPES: Record<string, string> = {
  webm: 'audio/webm',
  opus: 'audio/ogg; codecs=opus',
  ogg:  'audio/ogg',
  mp3:  'audio/mpeg',
  m4a:  'audio/mp4',
  aac:  'audio/aac',
  flac: 'audio/flac',
  wav:  'audio/wav',
}

function getContentType(url: string, fallback: string): string {
  try {
    const path = new URL(url).pathname.split('?')[0]
    const ext = path.split('.').pop()?.toLowerCase() ?? ''
    return AUDIO_CONTENT_TYPES[ext] ?? fallback
  } catch {
    return fallback
  }
}

async function proxyAudio(request: NextRequest, audioUrl: string): Promise<NextResponse> {
  const rangeHeader = request.headers.get('range')
  const response = await fetch(audioUrl, {
    headers: rangeHeader ? { Range: rangeHeader } : undefined,
  })

  if (!response.ok) {
    return NextResponse.json(
      { error: 'Failed to fetch audio', status: response.status },
      { status: response.status }
    )
  }

  const headers = new Headers(response.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600')

  const upstreamType = response.headers.get('content-type') ?? ''
  if (!upstreamType || upstreamType === 'application/octet-stream') {
    headers.set('Content-Type', getContentType(audioUrl, 'audio/webm'))
  }

  return new NextResponse(response.body, { status: response.status, headers })
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  // R2 path: ?r2=<object-key>  → generate presigned GET URL then redirect
  const r2Key = searchParams.get('r2')
  if (r2Key) {
    try {
      const signedUrl = await getAudioUrl(r2Key)
      // Redirect the player directly to the presigned R2 URL (no server proxy needed)
      return NextResponse.redirect(signedUrl, { status: 302 })
    } catch (error) {
      console.error('[audio] R2 signed URL error:', r2Key, error)
      return NextResponse.json({ error: 'Unable to generate R2 URL' }, { status: 502 })
    }
  }

  // Supabase legacy path: ?url=<signed-url>  → proxy through server
  const audioUrl = searchParams.get('url')
  if (!audioUrl) {
    return NextResponse.json({ error: 'Missing audio URL' }, { status: 400 })
  }

  try {
    return await proxyAudio(request, audioUrl)
  } catch (error) {
    console.error('[audio] Proxy error for URL:', audioUrl?.slice(0, 80), error)
    return NextResponse.json(
      { error: 'Unable to proxy audio', details: String(error) },
      { status: 502 }
    )
  }
}
