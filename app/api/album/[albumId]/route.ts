import { NextResponse } from 'next/server'
import type { ReleaseType, ReleaseTrack } from '@/types'

export const revalidate = 86400

interface DeezerAlbumFull {
  id: number
  title: string
  cover_medium: string
  cover_xl: string
  record_type: string
  release_date: string
  nb_tracks: number
  artist: { id: number; name: string; picture_medium: string }
}

interface DeezerTrack {
  id: number
  title: string
  duration: number
  track_position: number
  preview: string
}

function normalizeType(t: string): ReleaseType {
  const l = t.toLowerCase()
  if (l === 'ep') return 'ep'
  if (l === 'single') return 'single'
  return 'album'
}

export async function GET(
  _req: Request,
  { params }: { params: { albumId: string } }
) {
  const [albumRes, tracksRes] = await Promise.allSettled([
    fetch(`https://api.deezer.com/album/${params.albumId}`, { next: { revalidate: 86400 } }),
    fetch(`https://api.deezer.com/album/${params.albumId}/tracks?limit=100`, {
      next: { revalidate: 86400 },
    }),
  ])

  if (albumRes.status !== 'fulfilled' || !albumRes.value.ok) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 })
  }

  const albumData = (await albumRes.value.json()) as DeezerAlbumFull
  const tracksJson =
    tracksRes.status === 'fulfilled' && tracksRes.value.ok
      ? await tracksRes.value.json()
      : { data: [] }

  const tracks: ReleaseTrack[] = ((tracksJson.data ?? []) as DeezerTrack[]).map((t) => ({
    id: t.id,
    title: t.title,
    duration: t.duration,
    position: t.track_position,
    previewUrl: t.preview || null,
  }))

  return NextResponse.json({
    album: {
      id: albumData.id,
      title: albumData.title,
      cover: albumData.cover_medium,
      coverXl: albumData.cover_xl,
      type: normalizeType(albumData.record_type),
      releaseDate: albumData.release_date,
      trackCount: albumData.nb_tracks,
      artist: {
        id: albumData.artist.id,
        name: albumData.artist.name,
        image: albumData.artist.picture_medium,
      },
    },
    tracks,
  })
}
