import { NextResponse } from 'next/server'

// Full artist profile endpoint.
// Combines Deezer (photo, fans, top tracks, discography) with
// MusicBrainz (real name, birthdate, country, genres) and
// Wikipedia (bio extract). All external — no Supabase dependency.
export const dynamic = 'force-dynamic'

const FRESH: RequestInit = { cache: 'no-store' }
const MB_HEADERS = { 'User-Agent': 'Inka/1.0 (contact@inka.app)' }

// ── Types ──────────────────────────────────────────────────────────────────────

interface DeezerArtist {
  id: number
  name: string
  picture_medium: string
  picture_big: string
  picture_xl: string
  nb_fan: number
  nb_album: number
}

interface DeezerTrack {
  id: number
  title: string
  duration: number
  rank: number
  preview: string
  album: { id: number; title: string; cover_medium: string }
}

interface DeezerAlbum {
  id: number
  title: string
  release_date: string
  record_type: string
  cover_medium: string
}

// ── Country code → name ────────────────────────────────────────────────────────

const COUNTRY_NAMES: Record<string, string> = {
  AF:'Afghanistan', AL:'Albanie', DZ:'Algérie', AR:'Argentine', AU:'Australie',
  AT:'Autriche', BE:'Belgique', BI:'Burundi', BJ:'Bénin', BR:'Brésil',
  BF:'Burkina Faso', CM:'Cameroun', CA:'Canada', CF:'Centrafrique',
  CG:'Congo', CD:'RD Congo', CI:"Côte d'Ivoire", DK:'Danemark',
  EG:'Égypte', ES:'Espagne', US:'États-Unis', ET:'Éthiopie', FI:'Finlande',
  FR:'France', GA:'Gabon', GH:'Ghana', GN:'Guinée', GW:'Guinée-Bissau',
  HT:'Haïti', IN:'Inde', IT:'Italie', JP:'Japon', KE:'Kenya', LR:'Liberia',
  MG:'Madagascar', ML:'Mali', MA:'Maroc', MR:'Mauritanie', MX:'Mexique',
  MZ:'Mozambique', NE:'Niger', NG:'Nigeria', NO:'Norvège', NL:'Pays-Bas',
  PL:'Pologne', PT:'Portugal', RW:'Rwanda', SN:'Sénégal', SL:'Sierra Leone',
  SO:'Somalie', ZA:'Afrique du Sud', SD:'Soudan', SE:'Suède', CH:'Suisse',
  TZ:'Tanzanie', TG:'Togo', TN:'Tunisie', TR:'Turquie', UG:'Ouganda',
  GB:'Royaume-Uni', ZM:'Zambie', ZW:'Zimbabwe',
}

function countryName(code: string | null): string | null {
  if (!code) return null
  return COUNTRY_NAMES[code.toUpperCase()] ?? code
}

// ── MusicBrainz ───────────────────────────────────────────────────────────────

async function getMusicBrainzInfo(name: string): Promise<{
  sortName: string | null
  birthDate: string | null
  country: string | null
  type: string | null
  genres: string[]
} | null> {
  try {
    const q = encodeURIComponent(`artist:"${name}"`)
    const res = await fetch(
      `https://musicbrainz.org/ws/2/artist?query=${q}&fmt=json&limit=3`,
      { ...FRESH, headers: MB_HEADERS }
    )
    if (!res.ok) return null
    const data = await res.json()
    const a = data.artists?.[0]
    if (!a) return null

    // Compute real first name from "Lastname, Firstname" sort-name
    let sortName: string | null = a['sort-name'] ?? null
    if (sortName === name) sortName = null // same as stage name — not useful

    // Convert "Lastname, Firstname" → "Firstname Lastname"
    let realName: string | null = null
    if (sortName) {
      const parts = sortName.split(', ')
      realName = parts.length === 2 ? `${parts[1]} ${parts[0]}` : sortName
    }

    const genres = [
      ...((a.genres ?? []) as { name: string }[]).map((g) => g.name),
      ...((a.tags ?? []) as { name: string; count: number }[])
        .sort((x, y) => y.count - x.count)
        .slice(0, 5)
        .map((t) => t.name),
    ]
    // Deduplicate genres
    const uniqueGenres = [...new Set(genres.map((g) => g.toLowerCase()))].slice(0, 6)

    return {
      sortName: realName,
      birthDate: a['life-span']?.begin ?? null,
      country: a.country ?? null,
      type: a.type ?? null,   // 'Person' | 'Group' | 'Orchestra' etc.
      genres: uniqueGenres,
    }
  } catch {
    return null
  }
}

// ── Wikipedia ─────────────────────────────────────────────────────────────────

async function getWikipediaBio(name: string): Promise<string | null> {
  // Try English first, then French
  for (const lang of ['en', 'fr']) {
    try {
      const res = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`,
        { ...FRESH, headers: { 'User-Agent': 'Inka/1.0 (contact@inka.app)' } }
      )
      if (!res.ok) continue
      const data = await res.json()
      if (data.type === 'disambiguation') continue
      if (data.extract && data.extract.length > 60) return data.extract
    } catch { continue }
  }
  return null
}

// ── Release type normalizer ────────────────────────────────────────────────────

function normalizeType(t: string): 'album' | 'ep' | 'single' {
  const l = t.toLowerCase()
  if (l === 'ep') return 'ep'
  if (l === 'single') return 'single'
  return 'album'
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: { artistId: string } }
) {
  const { artistId } = params

  // Step 1: Fetch Deezer artist, top tracks, albums in parallel
  const [artistRes, topRes, albumsRes] = await Promise.allSettled([
    fetch(`https://api.deezer.com/artist/${artistId}`, FRESH),
    fetch(`https://api.deezer.com/artist/${artistId}/top?limit=12`, FRESH),
    fetch(`https://api.deezer.com/artist/${artistId}/albums?limit=50`, FRESH),
  ])

  if (artistRes.status !== 'fulfilled' || !artistRes.value.ok) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  const deezerArtist = (await artistRes.value.json()) as DeezerArtist

  const topData =
    topRes.status === 'fulfilled' && topRes.value.ok
      ? await topRes.value.json()
      : { data: [] }

  const albumsData =
    albumsRes.status === 'fulfilled' && albumsRes.value.ok
      ? await albumsRes.value.json()
      : { data: [] }

  // Step 2: MusicBrainz + Wikipedia in parallel (non-blocking — failures are OK)
  const [mbInfo, bio] = await Promise.all([
    getMusicBrainzInfo(deezerArtist.name),
    getWikipediaBio(deezerArtist.name),
  ])

  // Step 3: Process discography — sort, slice, verify primary artist
  const allAlbums = ((albumsData.data ?? []) as DeezerAlbum[])
    .filter((a) => a.release_date)
    .sort((a, b) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime())
    .slice(0, 30)

  // Verify primary artist in parallel (same logic as /api/artist-releases)
  const verifications = await Promise.allSettled(
    allAlbums.map((a) =>
      fetch(`https://api.deezer.com/album/${a.id}`, FRESH)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => ({ id: a.id, primary: data?.artist?.id === deezerArtist.id }))
        .catch(() => ({ id: a.id, primary: true }))
    )
  )

  const primaryIds = new Set(
    verifications
      .filter(
        (r): r is PromiseFulfilledResult<{ id: number; primary: boolean }> =>
          r.status === 'fulfilled' && r.value.primary
      )
      .map((r) => r.value.id)
  )

  const releases = allAlbums
    .filter((a) => primaryIds.has(a.id))
    .map((a) => ({
      id: a.id,
      title: a.title,
      type: normalizeType(a.record_type),
      releaseDate: a.release_date,
      cover: a.cover_medium,
    }))

  // Step 4: Top tracks
  const topTracks = ((topData.data ?? []) as DeezerTrack[]).map((t) => ({
    id: t.id,
    title: t.title,
    rank: t.rank,
    duration: t.duration,
    albumId: t.album?.id ?? null,
    albumTitle: t.album?.title ?? null,
    cover: t.album?.cover_medium ?? null,
    previewUrl: t.preview || null,
  }))

  // Step 5: Format birth date
  let birthDate: string | null = null
  if (mbInfo?.birthDate) {
    const d = new Date(mbInfo.birthDate)
    if (!isNaN(d.getTime())) {
      birthDate = d.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    } else {
      birthDate = mbInfo.birthDate // just the year "1995" is also valid
    }
  }

  const isDefaultImage = (url: string) =>
    !url ||
    url.includes('/images/artist//') ||
    url.includes('d41d8cd98f00b204e9800998ecf8427e')

  return NextResponse.json({
    artist: {
      id: deezerArtist.id,
      name: deezerArtist.name,
      picture: isDefaultImage(deezerArtist.picture_xl)
        ? isDefaultImage(deezerArtist.picture_big) ? '' : deezerArtist.picture_big
        : deezerArtist.picture_xl,
      pictureMedium: isDefaultImage(deezerArtist.picture_medium) ? '' : deezerArtist.picture_medium,
      fanCount: deezerArtist.nb_fan,
      nbAlbum: deezerArtist.nb_album,
      realName: mbInfo?.sortName ?? null,
      birthDate,
      country: countryName(mbInfo?.country ?? null),
      countryCode: mbInfo?.country ?? null,
      mbType: mbInfo?.type ?? null,
      genres: mbInfo?.genres ?? [],
      bio,
    },
    topTracks,
    releases,
  })
}
