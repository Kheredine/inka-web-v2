'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { SoundCard, HScrollRow, ArtistCard } from '@/components/ui/Card'
import { SoundCardSkeleton } from '@/components/ui/Skeleton'
import type { ArtistReleaseCard } from '@/types'
import { usePlayerStore } from '@/stores/playerStore'
import { useAuthStore } from '@/stores/authStore'
import { Sound } from '@/types'
import { colors, spacing, radius, typography } from '@/lib/theme'
import { TopBar } from '@/components/layout/TopBar'
import { useGenres, useRecentSounds, usePopularSounds, useFreshDrops, useRecommendations } from '@/hooks/useBrowseData'

// ── External track types + components ────────────────────────────────────────

interface ExternalTrack {
  id: number
  title: string
  duration: number
  rank: number
  previewUrl: string | null
  artist: { id: number; name: string }
  album: { id: number; title: string; cover: string }
}

function formatDur(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function ExternalTrackCard({
  track,
  onPress,
}: {
  track: ExternalTrack
  onPress: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const togglePreview = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!track.previewUrl) return
    if (previewing) {
      audioRef.current?.pause()
      setPreviewing(false)
    } else {
      if (!audioRef.current) audioRef.current = new Audio(track.previewUrl)
      audioRef.current.play()
      audioRef.current.onended = () => setPreviewing(false)
      setPreviewing(true)
    }
  }

  // Clean up audio when unmounted
  useEffect(() => {
    return () => { audioRef.current?.pause() }
  }, [])

  return (
    <div
      onClick={onPress}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: spacing.md,
        padding: `${spacing.sm}px ${spacing.md}px`,
        borderRadius: radius.md,
        background: hovered ? colors.surface : 'transparent',
        border: `0.5px solid ${hovered ? colors.border : 'transparent'}`,
        cursor: 'pointer',
        transition: 'background var(--ease-default), border-color var(--ease-default)',
      }}
    >
      {/* Cover + preview overlay */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <img
          src={track.album.cover}
          alt={track.album.title}
          style={{ width: 44, height: 44, borderRadius: radius.sm, objectFit: 'cover', display: 'block' }}
        />
        {track.previewUrl && (
          <button
            onClick={togglePreview}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.55)',
              borderRadius: radius.sm, border: 'none', cursor: 'pointer',
              opacity: hovered || previewing ? 1 : 0,
              transition: 'opacity var(--ease-enter)',
            }}
          >
            <i
              className={`fa-solid fa-${previewing ? 'pause' : 'play'}`}
              style={{ color: '#fff', fontSize: 12, marginLeft: previewing ? 0 : 2 }}
            />
          </button>
        )}
      </div>

      {/* Title + artist */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: previewing ? 'var(--accent)' : colors.textPrimary,
          fontSize: typography.sm.fontSize, fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          transition: 'color var(--ease-default)',
        }}>
          {track.title}
        </div>
        <div style={{ color: colors.textMuted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {track.artist.name}
        </div>
      </div>

      {/* Duration + external badge */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        <span style={{ color: colors.textMuted, fontSize: 11 }}>{formatDur(track.duration)}</span>
        <i className="fa-solid fa-arrow-up-right-from-square" style={{ color: colors.textMuted, fontSize: 9, opacity: hovered ? 0.8 : 0.4, transition: 'opacity var(--ease-enter)' }} />
      </div>
    </div>
  )
}

function ExternalTrackSkeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: `${spacing.sm}px ${spacing.md}px` }}>
      <div style={{ width: 44, height: 44, borderRadius: radius.sm, background: colors.surface, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height: 13, width: '55%', borderRadius: 4, background: colors.surface }} />
        <div style={{ height: 11, width: '35%', borderRadius: 4, background: colors.surface }} />
      </div>
      <div style={{ width: 28, height: 11, borderRadius: 4, background: colors.surface }} />
    </div>
  )
}

// ── ArtistSearchCard ──────────────────────────────────────────────────────────

function ArtistSearchCard({
  artist,
  onPress,
}: {
  artist: { id: number; name: string; picture: string; fanCount: number; nbAlbum: number }
  onPress: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const fmtFans = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : String(n)

  return (
    <div
      onClick={onPress}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        background: colors.surface,
        border: `0.5px solid ${hovered ? 'var(--accent)44' : colors.border}`,
        cursor: 'pointer',
        transition: 'border-color var(--ease-default)',
      }}
    >
      {/* Avatar */}
      <div style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: colors.surfaceElevated }}>
        {artist.picture ? (
          <img src={artist.picture} alt={artist.name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa-solid fa-user" style={{ color: colors.textMuted, fontSize: 20 }} />
          </div>
        )}
      </div>
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {artist.name}
        </div>
        <div style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
          {fmtFans(artist.fanCount)} fans
          {artist.nbAlbum > 0 && ` · ${artist.nbAlbum} sorties`}
        </div>
      </div>
      <i className="fa-solid fa-chevron-right" style={{ color: colors.textMuted, fontSize: 12, opacity: hovered ? 1 : 0.5, transition: 'opacity var(--ease-enter)', flexShrink: 0 }} />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const { playSound } = usePlayerStore()
  const profile = useAuthStore((s) => s.profile)
  const router = useRouter()

  const [query, setQuery] = useState('')
  const [searchTab, setSearchTab] = useState<'sons' | 'artistes'>('sons')
  const [searchResults, setSearchResults] = useState<Sound[]>([])
  const [externalTracks, setExternalTracks] = useState<ExternalTrack[]>([])
  const [artistResults, setArtistResults] = useState<{ id: number; name: string; picture: string; fanCount: number; nbAlbum: number }[]>([])
  // ── SWR data (cached across navigations) ─────────────────────────────────────
  const { data: recent = [], isLoading: recentLoading } = useRecentSounds(12)
  const { data: popular = [] } = usePopularSounds()
  const { data: freshDrops = [], isLoading: freshDropsLoading } = useFreshDrops()
  const { data: genres = [] } = useGenres()
  const isLoading = recentLoading

  const { data: recsData, isLoading: recsLoading } = useRecommendations(profile?.id, 20)
  const recommendations = recsData?.sounds ?? []
  const recsPersonal = recsData?.meta.personal ?? false
  const topGenresForExternalRecs = recsData?.meta.topGenres?.[0] ?? null

  const [externalRecs, setExternalRecs] = useState<ExternalTrack[]>([])
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set())
  const [genreSounds, setGenreSounds] = useState<Sound[]>([])
  const [genreLoading, setGenreLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // ── Fire-and-forget: external Deezer recs for top genre ───────────────────────
  useEffect(() => {
    if (!topGenresForExternalRecs || recsLoading) return
    fetch(`/api/search/tracks?q=${encodeURIComponent(topGenresForExternalRecs)}`)
      .then((r) => r.ok ? r.json() : { tracks: [] })
      .then((res) => setExternalRecs((res.tracks ?? []).slice(0, 8)))
      .catch(() => {})
  }, [topGenresForExternalRecs, recsLoading])

  // ── Search ────────────────────────────────────────────────────────────────────
  const handleSearch = useCallback((text: string) => {
    setQuery(text)
    clearTimeout(debounceRef.current)
    if (!text.trim()) { setSearchResults([]); setExternalTracks([]); setArtistResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      const safeText = text.replace(/[%,()]/g, '')
      const q = encodeURIComponent(text.trim())
      // Search Inka sounds, Deezer tracks, and Deezer artists in parallel
      const [{ data }, tracksRes, artistRes] = await Promise.all([
        supabase.from('sounds').select('*, uploader:profiles!uploaded_by(*), reactions(*)').or(`title.ilike.%${safeText}%,artist.ilike.%${safeText}%,genre.ilike.%${safeText}%`).eq('is_public', true).limit(20),
        fetch(`/api/search/tracks?q=${q}`).then((r) => r.ok ? r.json() : { tracks: [] }).catch(() => ({ tracks: [] })),
        fetch(`/api/search/artists?q=${q}`).then((r) => r.ok ? r.json() : { artists: [] }).catch(() => ({ artists: [] })),
      ])
      setSearchResults((data as Sound[]) ?? [])
      setExternalTracks(tracksRes.tracks ?? [])
      setArtistResults(artistRes.artists ?? [])
      setIsSearching(false)
    }, 300)
  }, [])

  // ── Genre filter ──────────────────────────────────────────────────────────────
  const handleGenre = async (genre: string) => {
    const next = new Set(selectedGenres)
    if (next.has(genre)) {
      next.delete(genre)
    } else {
      next.add(genre)
    }
    setSelectedGenres(next)

    if (next.size === 0) {
      setGenreSounds([])
      return
    }

    setGenreLoading(true)
    setGenreSounds([])
    const conditions = [...next].map((g) => `genre.ilike.%${g.replace(/[%,()]/g, '')}%`).join(',')
    const { data } = await supabase
      .from('sounds')
      .select('*, uploader:profiles!uploaded_by(*), reactions(*)')
      .or(conditions)
      .eq('is_public', true)
      .order('play_count', { ascending: false })
      .limit(40)
    setGenreSounds((data as Sound[]) ?? [])
    setGenreLoading(false)
  }

  const clearGenres = () => { setSelectedGenres(new Set()); setGenreSounds([]) }

  const isSearchMode = query.trim().length > 0

  const SectionTitle = ({ icon, title, subtitle, badge }: { icon: string; title: string; subtitle?: string; badge?: string }) => (
    <div style={{ padding: `0 ${spacing.lg}px`, marginBottom: spacing.sm }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3 style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className={`fa-solid ${icon}`} style={{ color: 'var(--accent)', fontSize: 12 }} />
          {title}
        </h3>
        {badge && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent)33', letterSpacing: '0.03em' }}>
            {badge}
          </span>
        )}
      </div>
      {subtitle && <p style={{ color: colors.textMuted, fontSize: typography.xs.fontSize, margin: '2px 0 0', letterSpacing: '0.01em' }}>{subtitle}</p>}
    </div>
  )

  const CARD_W = 160

  return (
    <div>
      <TopBar
        title="Inka"
        search={{
          value: query,
          onChange: handleSearch,
          placeholder: 'Sons, artistes, genres…',
          focused: searchFocused,
          onFocus: () => setSearchFocused(true),
          onBlur: () => setSearchFocused(false),
        }}
      >
        {/* Genre chips — dynamic from DB */}
        {!isSearchMode && (
          <div style={{ display: 'flex', gap: spacing.sm, overflowX: 'auto', scrollbarWidth: 'none' }}>
            <button
              onClick={clearGenres}
              style={{
                padding: '5px 14px',
                borderRadius: radius.full,
                border: `0.5px solid ${selectedGenres.size === 0 ? 'var(--accent)' : colors.border}`,
                background: selectedGenres.size === 0 ? 'var(--accent-muted)' : 'transparent',
                color: selectedGenres.size === 0 ? 'var(--accent)' : colors.textSecondary,
                fontSize: typography.xs.fontSize,
                fontWeight: selectedGenres.size === 0 ? 600 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                fontFamily: 'inherit',
                transition: 'all var(--ease-default)',
              }}
            >
              Tous
            </button>
            {genres.map((g) => {
              const active = selectedGenres.has(g)
              return (
                <button
                  key={g}
                  onClick={() => handleGenre(g)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: radius.full,
                    border: `0.5px solid ${active ? 'var(--accent)' : colors.border}`,
                    background: active ? 'var(--accent-muted)' : 'transparent',
                    color: active ? 'var(--accent)' : colors.textSecondary,
                    fontSize: typography.xs.fontSize,
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    fontFamily: 'inherit',
                    transition: 'all var(--ease-default)',
                  }}
                >
                  {g}
                </button>
              )
            })}
          </div>
        )}
      </TopBar>

      {/* Search results */}
      {isSearchMode ? (
        <>
          {/* Search tabs */}
          <div style={{ display: 'flex', gap: spacing.sm, padding: `${spacing.md}px ${spacing.lg}px ${spacing.xs}px` }}>
            {(['sons', 'artistes'] as const).map((tab) => {
              const active = searchTab === tab
              const count = tab === 'sons' ? searchResults.length : artistResults.length
              return (
                <button
                  key={tab}
                  onClick={() => setSearchTab(tab)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 16px', borderRadius: radius.full,
                    border: `0.5px solid ${active ? 'var(--accent)' : colors.border}`,
                    background: active ? 'var(--accent-muted)' : 'transparent',
                    color: active ? 'var(--accent)' : colors.textSecondary,
                    fontSize: typography.xs.fontSize, fontWeight: active ? 600 : 400,
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all var(--ease-default)',
                    textTransform: 'capitalize' as const,
                  }}
                >
                  {tab === 'sons' ? 'Sons' : 'Artistes'}
                  {!isSearching && count > 0 && (
                    <span style={{ fontSize: 10, opacity: 0.8 }}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>

          {isSearching ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, padding: `${spacing.sm}px ${spacing.lg}px` }}>
              {Array.from({ length: 6 }).map((_, i) => <ExternalTrackSkeleton key={i} />)}
            </div>
          ) : searchTab === 'sons' ? (
            searchResults.length === 0 && externalTracks.length === 0 ? (
              <p style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl, fontSize: typography.sm.fontSize }}>
                Aucun résultat pour «{query}»
              </p>
            ) : (
              <div style={{ paddingBottom: spacing.xl }}>
                {/* In-app results */}
                {searchResults.length > 0 && (
                  <div style={{ marginBottom: spacing.lg }}>
                    <div style={{ padding: `${spacing.sm}px ${spacing.lg}px`, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                      <span style={{ color: colors.textMuted, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>
                        Dans l'app
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--accent)', background: 'var(--accent-muted)', borderRadius: 8, padding: '1px 6px', fontWeight: 600 }}>
                        {searchResults.length}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: spacing.md, padding: `0 ${spacing.lg}px` }}>
                      {searchResults.map((s) => <SoundCard key={s.id} sound={s} variant="grid" onPress={() => playSound(s, searchResults)} />)}
                    </div>
                  </div>
                )}
                {/* External Deezer results */}
                {externalTracks.length > 0 && (
                  <div>
                    <div style={{ padding: `${spacing.sm}px ${spacing.lg}px`, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                      <span style={{ color: colors.textMuted, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>
                        Sur Deezer
                      </span>
                      <span style={{ fontSize: 10, color: colors.textMuted, background: colors.surface, borderRadius: 8, padding: '1px 6px', fontWeight: 500, border: `0.5px solid ${colors.border}` }}>
                        {externalTracks.length}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, padding: `0 ${spacing.lg}px` }}>
                      {externalTracks.map((t) => (
                        <ExternalTrackCard
                          key={t.id}
                          track={t}
                          onPress={() => router.push(`/releases/${t.artist.id}/album/${t.album.id}`)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : (
            /* Artist results */
            artistResults.length === 0 ? (
              <p style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl, fontSize: typography.sm.fontSize }}>
                Aucun artiste pour «{query}»
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, padding: `${spacing.sm}px ${spacing.lg}px` }}>
                {artistResults.map((a) => (
                  <ArtistSearchCard key={a.id} artist={a} onPress={() => router.push(`/artist/${a.id}`)} />
                ))}
              </div>
            )
          )}
        </>
      ) : isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: spacing.md, padding: `${spacing.sm}px ${spacing.lg}px` }}>
          {Array.from({ length: 6 }).map((_, i) => <SoundCardSkeleton key={i} />)}
        </div>
      ) : (
        <>
          {/* Genre filtered results */}
          {selectedGenres.size > 0 && (
            <div style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>
              <SectionTitle
                icon="fa-tag"
                title={[...selectedGenres].join(' · ')}
                subtitle={genreSounds.length > 0 ? `${genreSounds.length} son${genreSounds.length !== 1 ? 's' : ''}` : undefined}
              />
              {genreLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: spacing.md, padding: `${spacing.sm}px ${spacing.lg}px` }}>
                  {Array.from({ length: 6 }).map((_, i) => <SoundCardSkeleton key={i} />)}
                </div>
              ) : genreSounds.length === 0 ? (
                <p style={{ color: colors.textMuted, textAlign: 'center', padding: `${spacing.xl}px ${spacing.lg}px`, fontSize: typography.sm.fontSize }}>
                  Aucun son trouvé pour ces genres
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: spacing.md, padding: `${spacing.sm}px ${spacing.lg}px` }}>
                  {genreSounds.map((s) => <SoundCard key={s.id} sound={s} variant="grid" onPress={() => playSound(s, genreSounds)} />)}
                </div>
              )}
            </div>
          )}

          {selectedGenres.size === 0 && (
            <>
              {/* ── Pour toi — in-app + external recommendations ── */}
              {(recsLoading || recsPersonal) && (
                <div style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>
                  <SectionTitle icon="fa-heart" title="Pour toi" subtitle="Basé sur tes écoutes" />
                  {/* In-app */}
                  <HScrollRow>
                    {recsLoading
                      ? Array.from({ length: 5 }).map((_, i) => <SoundCardSkeleton key={i} style={{ flexShrink: 0, width: CARD_W }} />)
                      : recommendations.map((s) => (
                          <SoundCard key={s.id} sound={s} variant="grid" style={{ flexShrink: 0, width: CARD_W }} onPress={() => playSound(s, recommendations)} />
                        ))
                    }
                  </HScrollRow>
                  {/* External Deezer recs for same genre */}
                  {!recsLoading && externalRecs.length > 0 && (
                    <div style={{ marginTop: spacing.sm, padding: `0 ${spacing.lg}px` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                        <span style={{ color: colors.textMuted, fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
                          Sur Deezer
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {externalRecs.map((t) => (
                          <ExternalTrackCard
                            key={t.id}
                            track={t}
                            onPress={() => router.push(`/releases/${t.artist.id}/album/${t.album.id}`)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Fresh Drops — right after Pour Toi ── */}
              <div style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>
                <SectionTitle icon="fa-circle-dot" title="Fresh Drops" subtitle="Sorties des 90 derniers jours" badge="Nouveau" />
                {freshDropsLoading ? (
                  <HScrollRow>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <SoundCardSkeleton key={i} style={{ flexShrink: 0, width: CARD_W }} />
                    ))}
                  </HScrollRow>
                ) : freshDrops.length > 0 ? (
                  <HScrollRow>
                    {freshDrops.map((card) => (
                      <ArtistCard
                        key={card.artistId}
                        card={card}
                        style={{ flexShrink: 0, width: CARD_W }}
                        onPress={() => router.push(`/releases/${card.artistId}/album/${card.latestRelease.id}`)}
                      />
                    ))}
                  </HScrollRow>
                ) : (
                  <p style={{ color: colors.textMuted, fontSize: typography.xs.fontSize, padding: `${spacing.sm}px ${spacing.lg}px`, margin: 0 }}>
                    Aucune sortie récente parmi les artistes présents sur Inka.
                  </p>
                )}
              </div>

              {/* ── Popular Now ── */}
              {popular.length > 0 && (
                <div style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>
                  <SectionTitle icon="fa-fire" title="Popular Now" subtitle="Les plus écoutés cette semaine" />
                  <HScrollRow>
                    {popular.map((s) => (
                      <SoundCard key={s.id} sound={s} variant="grid" style={{ flexShrink: 0, width: CARD_W }} onPress={() => playSound(s, popular)} playCount={s.play_count} />
                    ))}
                  </HScrollRow>
                </div>
              )}

              {/* ── Nouveautés ── */}
              <div style={{ marginTop: spacing.lg, marginBottom: spacing.xxl }}>
                <SectionTitle icon="fa-clock-rotate-left" title="Nouveautés" />
                <HScrollRow>
                  {recent.map((s) => (
                    <SoundCard key={s.id} sound={s} variant="grid" style={{ flexShrink: 0, width: CARD_W }} onPress={() => playSound(s, recent)} />
                  ))}
                </HScrollRow>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
