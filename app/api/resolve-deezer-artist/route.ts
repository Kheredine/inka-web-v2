import { NextResponse } from 'next/server'
import { resolveDeezerArtistId } from '@/lib/resolve-deezer-artist'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { artistName, titles } = (await req.json()) as {
    artistName: string
    titles: string[]
  }

  if (!artistName?.trim()) {
    return NextResponse.json({ deezerId: null }, { status: 400 })
  }

  const deezerId = await resolveDeezerArtistId(artistName.trim(), titles ?? [])
  return NextResponse.json({ deezerId })
}
