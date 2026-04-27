import { NextResponse } from 'next/server'

export interface TrendingTrack {
  rank: number
  title: string
  artist: string
  listeners: string | null
  image: string | null
  url: string | null
}

// ── Last.fm chart (positions offset → offset+limit) ────────────────────────────
async function fetchLastFmChart(offset: number, limit: number): Promise<TrendingTrack[]> {
  const key = process.env.LASTFM_API_KEY
  if (!key) return []

  const page = Math.floor(offset / limit) + 1
  const res = await fetch(
    `https://ws.audioscrobbler.com/2.0/?method=chart.getTopTracks&api_key=${key}&format=json&limit=${limit}&page=${page}`,
    { next: { revalidate: 3600 } }
  )
  if (!res.ok) return []

  const data = await res.json()
  const tracks: Array<{
    name: string
    artist: { name: string }
    listeners: string
    image: Array<{ '#text': string; size: string }>
    url: string
  }> = data?.tracks?.track ?? []

  return tracks.map((t, i) => ({
    rank: offset + i + 1,
    title: t.name,
    artist: t.artist?.name ?? '',
    listeners: t.listeners ? Number(t.listeners).toLocaleString() : null,
    image: t.image?.find((img) => img.size === 'large')?.['#text'] || null,
    url: t.url || null,
  }))
}

// ── iTunes Recent Releases (no key required) ───────────────────────────────────
async function fetchItunesRecent(): Promise<TrendingTrack[]> {
  const res = await fetch(
    'https://itunes.apple.com/us/rss/recentreleases/limit=20/json',
    { next: { revalidate: 3600 } }
  )
  if (!res.ok) return []

  const data = await res.json()
  const entries: Array<{
    'im:name': { label: string }
    'im:artist': { label: string }
    'im:image': Array<{ label: string }>
    link: { attributes: { href: string } }
  }> = data?.feed?.entry ?? []

  return entries.map((e, i) => ({
    rank: i + 1,
    title: e['im:name']?.label ?? '',
    artist: e['im:artist']?.label ?? '',
    listeners: null,
    image: e['im:image']?.[2]?.label || e['im:image']?.[0]?.label || null,
    url: e.link?.attributes?.href || null,
  }))
}

// ── iTunes Top Songs fallback (when no Last.fm key) ───────────────────────────
async function fetchItunesTop(offset: number, limit: number): Promise<TrendingTrack[]> {
  const res = await fetch(
    `https://itunes.apple.com/us/rss/topsongs/limit=${offset + limit}/json`,
    { next: { revalidate: 3600 } }
  )
  if (!res.ok) return []

  const data = await res.json()
  const entries: Array<{
    'im:name': { label: string }
    'im:artist': { label: string }
    'im:image': Array<{ label: string }>
    link: { attributes: { href: string } }
  }> = (data?.feed?.entry ?? []).slice(offset, offset + limit)

  return entries.map((e, i) => ({
    rank: offset + i + 1,
    title: e['im:name']?.label ?? '',
    artist: e['im:artist']?.label ?? '',
    listeners: null,
    image: e['im:image']?.[2]?.label || e['im:image']?.[0]?.label || null,
    url: e.link?.attributes?.href || null,
  }))
}

export async function GET() {
  const hasLastFm = !!process.env.LASTFM_API_KEY

  const [trendingNow, rising, newAndHot] = await Promise.all([
    // 🔥 Trending Now — global top 1–10
    hasLastFm ? fetchLastFmChart(0, 10) : fetchItunesTop(0, 10),
    // 📈 Rising — next tier 11–20 (gaining toward the top)
    hasLastFm ? fetchLastFmChart(10, 10) : fetchItunesTop(10, 10),
    // 🆕 New & Hot — genuinely recent releases
    fetchItunesRecent(),
  ])

  return NextResponse.json({ trendingNow, rising, newAndHot })
}
