import { NextResponse } from 'next/server'
import type { ReleaseItem, ReleaseType } from '@/types'

// force-dynamic: DB-backed or user-navigated pages should always be fresh.
// Individual Deezer fetches use cache:'no-store' to avoid stale disk-cache entries.
export const dynamic = 'force-dynamic'

// Max albums to show per artist on the releases page.
// No time-window filter here — users tapped through to see this artist specifically,
// so we always show their full recent discography (most recent first).
const MAX_RELEASES = 30

interface DeezerArtistInfo {
  id: number
  name: string
  picture_xl: string
  picture_medium: string
  nb_fan: number
}

interface DeezerAlbum {
  id: number
  title: string
  release_date: string
  record_type: string
  cover_medium: string
  cover_xl: string
  // nb_tracks is NOT present in the /artist/{id}/albums list endpoint
}

function normalizeType(t: string): ReleaseType {
  const l = t.toLowerCase()
  if (l === 'ep') return 'ep'
  if (l === 'single') return 'single'
  return 'album'
}

export async function GET(
  _req: Request,
  { params }: { params: { artistId: string } }
) {
  const { artistId } = params

  const [artistRes, albumsRes] = await Promise.allSettled([
    fetch(`https://api.deezer.com/artist/${artistId}`, { cache: 'no-store' }),
    fetch(`https://api.deezer.com/artist/${artistId}/albums?limit=50`, { cache: 'no-store' }),
  ])

  if (artistRes.status !== 'fulfilled' || !artistRes.value.ok) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  const artistData = (await artistRes.value.json()) as DeezerArtistInfo

  const albumsJson =
    albumsRes.status === 'fulfilled' && albumsRes.value.ok
      ? await albumsRes.value.json()
      : { data: [] }

  // Sort all albums newest-first.
  // NOTE: Deezer's /artist/{id}/albums list endpoint does NOT include nb_tracks.
  const sorted = ((albumsJson.data ?? []) as DeezerAlbum[])
    .filter((a) => a.release_date)
    .sort((a, b) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime())
    .slice(0, MAX_RELEASES)

  // Verify primary artist for each candidate in parallel.
  // Deezer lists every album an artist contributed to, including features.
  // /album/{id} has the real primary artist.id so we can filter accurately.
  const verifications = await Promise.allSettled(
    sorted.map((a) =>
      fetch(`https://api.deezer.com/album/${a.id}`, { cache: 'no-store' })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => ({ id: a.id, primary: data?.artist?.id === artistData.id }))
        .catch(() => ({ id: a.id, primary: true })) // include if verify fails
    )
  )

  const primaryIds = new Set(
    verifications
      .filter((r): r is PromiseFulfilledResult<{ id: number; primary: boolean }> =>
        r.status === 'fulfilled' && r.value.primary
      )
      .map((r) => r.value.id)
  )

  const releases: ReleaseItem[] = sorted
    .filter((a) => primaryIds.has(a.id))
    .map((a) => ({
      id: a.id,
      title: a.title,
      type: normalizeType(a.record_type),
      releaseDate: a.release_date,
      cover: a.cover_medium,
      coverXl: a.cover_xl,
      trackCount: 0,
    }))

  return NextResponse.json({
    artist: {
      id: artistData.id,
      name: artistData.name,
      imageXl: artistData.picture_xl,
      imageMedium: artistData.picture_medium,
      fanCount: artistData.nb_fan,
    },
    releases,
  })
}
