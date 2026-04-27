import { NextRequest, NextResponse } from 'next/server'

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

export async function GET(request: NextRequest) {
  const audioUrl = request.nextUrl.searchParams.get('url')
  if (!audioUrl) {
    return NextResponse.json({ error: 'Missing audio URL' }, { status: 400 })
  }

  try {
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

    // Cache 24h pour les signed URLs (elles ont déjà leur propre TTL)
    headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600')

    // Content-Type correct pour Opus/WebM
    const upstreamType = response.headers.get('content-type') ?? ''
    if (!upstreamType || upstreamType === 'application/octet-stream') {
      headers.set('Content-Type', getContentType(audioUrl, 'audio/webm'))
    }

    return new NextResponse(response.body, {
      status: response.status,
      headers,
    })
  } catch (error) {
    console.error('[audio] Proxy error for URL:', audioUrl?.slice(0, 80), error)
    return NextResponse.json(
      { error: 'Unable to proxy audio', details: String(error) },
      { status: 502 }
    )
  }
}
