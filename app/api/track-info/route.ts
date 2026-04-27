import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const title = searchParams.get('title') ?? ''
  const artist = searchParams.get('artist') ?? ''

  if (!title || !artist) return NextResponse.json({})

  const key = process.env.LASTFM_API_KEY
  if (!key) return NextResponse.json({})

  try {
    const res = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${key}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&format=json`,
      { next: { revalidate: 3600 } }
    )
    const data = await res.json()
    const t = data?.track
    if (!t) return NextResponse.json({})

    const durationMs = Number(t.duration ?? 0)
    const published: string | null = t.wiki?.published ?? null
    const year = published ? (published.match(/\b(19|20)\d{2}\b/)?.[0] ?? null) : null

    return NextResponse.json({
      listeners: t.listeners ? Number(t.listeners).toLocaleString() : null,
      playcount: t.playcount ? Number(t.playcount).toLocaleString() : null,
      release_date: year,
      album: t.album?.title ?? null,
      tags: (t.toptags?.tag ?? []).slice(0, 5).map((tg: { name: string }) => tg.name),
      wiki: t.wiki?.summary
        ? t.wiki.summary.replace(/<a[^>]*>.*?<\/a>/g, '').replace(/<[^>]+>/g, '').trim().split('. Read more')[0]
        : null,
      duration: durationMs > 0
        ? `${Math.floor(durationMs / 60000)}:${String(Math.floor((durationMs % 60000) / 1000)).padStart(2, '0')}`
        : null,
    })
  } catch {
    return NextResponse.json({})
  }
}
