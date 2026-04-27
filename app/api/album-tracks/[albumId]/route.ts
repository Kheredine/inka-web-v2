import { NextResponse } from 'next/server'
import type { ReleaseTrack } from '@/types'

export const revalidate = 86400

interface DeezerTrack {
  id: number
  title: string
  duration: number
  track_position: number
  preview: string
}

export async function GET(
  _req: Request,
  { params }: { params: { albumId: string } }
) {
  try {
    const res = await fetch(
      `https://api.deezer.com/album/${params.albumId}/tracks?limit=100`,
      { next: { revalidate: 86400 } }
    )
    if (!res.ok) return NextResponse.json({ tracks: [] })
    const data = await res.json()
    const tracks: ReleaseTrack[] = ((data.data ?? []) as DeezerTrack[]).map((t) => ({
      id: t.id,
      title: t.title,
      duration: t.duration,
      position: t.track_position,
      previewUrl: t.preview || null,
    }))
    return NextResponse.json({ tracks })
  } catch {
    return NextResponse.json({ tracks: [] })
  }
}
