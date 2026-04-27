import { NextResponse } from 'next/server'

// Searches Deezer for tracks matching a query.
// Used by the browse page "Sons" search tab to show external results
// alongside Inka's internal library.
export const dynamic = 'force-dynamic'

const FRESH: RequestInit = { cache: 'no-store' }

interface DeezerTrack {
  id: number
  title: string
  duration: number
  rank: number
  preview: string
  artist: { id: number; name: string }
  album: { id: number; title: string; cover_medium: string }
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ tracks: [] })

  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=20&order=RANKING`,
      FRESH
    )
    if (!res.ok) return NextResponse.json({ tracks: [] })

    const data = await res.json()
    const tracks = ((data.data ?? []) as DeezerTrack[]).map((t) => ({
      id: t.id,
      title: t.title,
      duration: t.duration,
      rank: t.rank,
      previewUrl: t.preview || null,
      artist: { id: t.artist.id, name: t.artist.name },
      album: {
        id: t.album.id,
        title: t.album.title,
        cover: t.album.cover_medium,
      },
    }))

    return NextResponse.json({ tracks })
  } catch {
    return NextResponse.json({ tracks: [] })
  }
}
