import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q') ?? ''
  if (!q.trim()) return NextResponse.json({ videoId: null })

  const key = process.env.YOUTUBE_API_KEY
  if (!key) return NextResponse.json({ videoId: null })

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&videoCategoryId=10&maxResults=1&key=${key}`,
      { next: { revalidate: 86400 } }
    )
    const data = await res.json()
    const videoId = data?.items?.[0]?.id?.videoId ?? null
    return NextResponse.json({ videoId })
  } catch {
    return NextResponse.json({ videoId: null })
  }
}
