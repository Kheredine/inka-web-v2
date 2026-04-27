import { NextResponse } from 'next/server'

// Fast Deezer artist search — used by the browse page search bar.
// Returns up to 8 results sorted by fan count (Deezer default).
export const dynamic = 'force-dynamic'

const FRESH: RequestInit = { cache: 'no-store' }

interface DeezerArtist {
  id: number
  name: string
  picture_medium: string
  nb_fan: number
  nb_album: number
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ artists: [] })

  try {
    const res = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=8`,
      FRESH
    )
    if (!res.ok) return NextResponse.json({ artists: [] })

    const data = await res.json()
    const artists = ((data.data ?? []) as DeezerArtist[]).map((a) => ({
      id: a.id,
      name: a.name,
      picture: a.picture_medium,
      fanCount: a.nb_fan,
      nbAlbum: a.nb_album,
    }))

    return NextResponse.json({ artists })
  } catch {
    return NextResponse.json({ artists: [] })
  }
}
