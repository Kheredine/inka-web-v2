'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SoundCard } from '@/components/ui/Card'
import { useSavedReleasesStore } from '@/stores/savedReleasesStore'
import { useToastStore } from '@/stores/toastStore'
import { usePlayerStore } from '@/stores/playerStore'
import { colors, spacing, radius, typography } from '@/lib/theme'
import { formatDuration } from '@/lib/utils'
import type { Sound, SavedRelease } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ArtistProfile {
  id: number
  name: string
  picture: string
  pictureMedium: string
  fanCount: number
  nbAlbum: number
  realName: string | null
  birthDate: string | null
  country: string | null
  countryCode: string | null
  mbType: string | null
  genres: string[]
  bio: string | null
}

interface TopTrack {
  id: number
  title: string
  rank: number
  duration: number
  albumId: number | null
  albumTitle: string | null
  cover: string | null
  previewUrl: string | null
}

interface Release {
  id: number
  title: string
  type: 'album' | 'ep' | 'single'
  releaseDate: string
  cover: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtFans(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

function fmtRank(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InfoChip({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 12px', borderRadius: radius.full,
      background: colors.surface,
      border: `0.5px solid ${colors.border}`,
      fontSize: typography.xs.fontSize,
      color: colors.textSecondary,
      flexShrink: 0,
    }}>
      <i className={`fa-solid ${icon}`} style={{ color: 'var(--accent)', fontSize: 10 }} />
      {label}
    </div>
  )
}

function GenrePill({ label }: { label: string }) {
  return (
    <span style={{
      padding: '4px 10px', borderRadius: radius.full,
      background: 'var(--accent-muted)',
      border: '0.5px solid var(--accent)33',
      color: 'var(--accent)',
      fontSize: 11, fontWeight: 500,
      textTransform: 'capitalize' as const,
    }}>
      {label}
    </span>
  )
}

// ── Track row in Top Songs ─────────────────────────────────────────────────────

function TrackRow({
  track,
  index,
  artistId,
  isPlaying,
  onPreview,
}: {
  track: TopTrack
  index: number
  artistId: string
  isPlaying: boolean
  onPreview: () => void
}) {
  const router = useRouter()
  const [hovered, setHovered] = useState(false)

  const handleClick = () => {
    if (track.albumId) {
      router.push(`/releases/${artistId}/album/${track.albumId}`)
    }
  }

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: spacing.md,
        padding: `${spacing.sm}px ${spacing.md}px`,
        borderRadius: radius.md,
        background: isPlaying ? `${colors.primary}12` : hovered ? colors.surface : 'transparent',
        border: `0.5px solid ${isPlaying ? colors.primary + '44' : hovered ? colors.border : 'transparent'}`,
        cursor: 'pointer',
        transition: 'background var(--ease-default), border-color var(--ease-default)',
      }}
    >
      {/* Index */}
      <span style={{ width: 20, textAlign: 'center', flexShrink: 0, color: colors.textMuted, fontSize: 12, fontWeight: 500 }}>
        {index + 1}
      </span>

      {/* Cover */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {track.cover ? (
          <img
            src={track.cover}
            alt={track.title}
            style={{ width: 44, height: 44, borderRadius: radius.sm, objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: radius.sm, background: colors.surfaceElevated, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa-solid fa-music" style={{ color: colors.textMuted, fontSize: 14 }} />
          </div>
        )}
        {/* Preview button overlay */}
        {track.previewUrl && (
          <button
            onClick={(e) => { e.stopPropagation(); onPreview() }}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.55)',
              borderRadius: radius.sm, border: 'none', cursor: 'pointer',
              opacity: hovered || isPlaying ? 1 : 0,
              transition: 'opacity var(--ease-enter)',
            }}
          >
            <i className={`fa-solid fa-${isPlaying ? 'pause' : 'play'}`} style={{ color: '#fff', fontSize: 13, marginLeft: isPlaying ? 0 : 2 }} />
          </button>
        )}
      </div>

      {/* Title + album */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: isPlaying ? colors.primary : colors.textPrimary,
          fontSize: typography.sm.fontSize, fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          transition: 'color var(--ease-default)',
        }}>
          {track.title}
        </div>
        {track.albumTitle && (
          <div style={{ color: colors.textMuted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {track.albumTitle}
          </div>
        )}
      </div>

      {/* Rank + duration */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: 2 }}>
        <span style={{ color: colors.textMuted, fontSize: 11 }}>{formatDuration(track.duration)}</span>
        {track.rank > 0 && (
          <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 500 }}>
            {fmtRank(track.rank)}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Release card in Discography ────────────────────────────────────────────────

function ReleaseCard({
  release,
  artistId,
  artist,
}: {
  release: Release
  artistId: string
  artist: ArtistProfile
}) {
  const router = useRouter()
  const { isSaved, save, remove } = useSavedReleasesStore()
  const toast = useToastStore()
  const [hovered, setHovered] = useState(false)
  const saved = isSaved(release.id)

  const typeLabel =
    release.type === 'album' ? 'Album' : release.type === 'ep' ? 'EP' : 'Single'
  const year = new Date(release.releaseDate).getFullYear()

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (saved) {
      remove(release.id)
      toast.show('Retiré de la bibliothèque', 'info')
    } else {
      const entry: SavedRelease = {
        id: release.id,
        title: release.title,
        type: release.type,
        artistId: artist.id,
        artistName: artist.name,
        cover: release.cover,
        releaseDate: release.releaseDate,
        savedAt: new Date().toISOString(),
      }
      save(entry)
      const dest = release.type === 'single' ? 'Coups de cœur' : 'Albums & EP (Playlists)'
      toast.show(`Sauvegardé dans ${dest}`)
    }
  }

  return (
    <div
      onClick={() => router.push(`/releases/${artistId}/album/${release.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        background: colors.surface,
        border: `0.5px solid ${hovered ? 'var(--accent)44' : colors.border}`,
        cursor: 'pointer',
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.25)' : 'none',
        transition: 'transform var(--ease-enter), box-shadow var(--ease-enter), border-color var(--ease-enter)',
      }}
    >
      {/* Cover */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <img
          src={release.cover}
          alt={release.title}
          style={{ width: 56, height: 56, borderRadius: radius.md, objectFit: 'cover', display: 'block' }}
        />
        <div style={{
          position: 'absolute', inset: 0, borderRadius: radius.md,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hovered ? 1 : 0,
          transition: 'opacity var(--ease-enter)',
        }}>
          <i className="fa-solid fa-play" style={{ color: '#fff', fontSize: 14, marginLeft: 2 }} />
        </div>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const,
          color: 'var(--accent)', background: 'var(--accent-muted)',
          borderRadius: 4, padding: '2px 6px', display: 'inline-block', marginBottom: 4,
        }}>
          {typeLabel}
        </span>
        <div style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {release.title}
        </div>
        <div style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>{year}</div>
      </div>

      {/* Save + chevron */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexShrink: 0 }}>
        <button
          onClick={handleSave}
          title={saved ? 'Retirer' : 'Sauvegarder'}
          style={{
            width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: saved ? `${colors.primary}20` : 'rgba(255,255,255,0.06)',
            color: saved ? colors.primary : colors.textMuted,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all var(--ease-default)',
          }}
        >
          <i className={`fa-${saved ? 'solid' : 'regular'} fa-bookmark`} style={{ fontSize: 12 }} />
        </button>
        <i className="fa-solid fa-chevron-right" style={{ color: colors.textMuted, fontSize: 11, opacity: hovered ? 1 : 0.4, transition: 'opacity var(--ease-enter)' }} />
      </div>
    </div>
  )
}

// ── Bio section ────────────────────────────────────────────────────────────────

function BioSection({ bio }: { bio: string }) {
  const [expanded, setExpanded] = useState(false)
  const SHORT_LIMIT = 260
  const isLong = bio.length > SHORT_LIMIT

  return (
    <div style={{ padding: `0 ${spacing.lg}px`, marginBottom: spacing.xl }}>
      <h2 style={{ color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 600, margin: `0 0 ${spacing.sm}px` }}>
        <i className="fa-solid fa-circle-info" style={{ color: 'var(--accent)', fontSize: 12, marginRight: 8 }} />
        Biographie
      </h2>
      <p style={{
        color: colors.textSecondary, fontSize: typography.sm.fontSize,
        lineHeight: 1.65, margin: 0,
        display: '-webkit-box', WebkitLineClamp: expanded ? 'unset' : 4,
        WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
      }}>
        {bio}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            marginTop: spacing.sm, background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--accent)', fontSize: typography.sm.fontSize, padding: 0,
            fontFamily: 'inherit', fontWeight: 500,
          }}
        >
          {expanded ? 'Voir moins' : 'Voir plus'}
        </button>
      )}
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionTitle({ icon, title, count }: { icon: string; title: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: `0 ${spacing.lg}px`, marginBottom: spacing.md }}>
      <h2 style={{ color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className={`fa-solid ${icon}`} style={{ color: 'var(--accent)', fontSize: 12 }} />
        {title}
      </h2>
      {count !== undefined && count > 0 && (
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: radius.full,
          background: 'var(--accent-muted)', color: 'var(--accent)',
          border: '0.5px solid var(--accent)33',
        }}>
          {count}
        </span>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ArtistPage() {
  const params = useParams()
  const router = useRouter()
  const artistId = params.artistId as string
  const { playSound } = usePlayerStore()

  const [artist, setArtist] = useState<ArtistProfile | null>(null)
  const [topTracks, setTopTracks] = useState<TopTrack[]>([])
  const [releases, setReleases] = useState<Release[]>([])
  const [inAppSounds, setInAppSounds] = useState<Sound[]>([])
  const [loading, setLoading] = useState(true)

  const [discoTab, setDiscoTab] = useState<'album' | 'ep' | 'single'>('album')
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null)
  const previewRef = useRef<HTMLAudioElement | null>(null)

  // Stop preview on unmount
  useEffect(() => () => { previewRef.current?.pause() }, [])

  // Load artist profile
  useEffect(() => {
    if (!artistId) return
    setLoading(true)
    fetch(`/api/artist-profile/${artistId}`)
      .then((r) => r.json())
      .then((data) => {
        setArtist(data.artist ?? null)
        setTopTracks(data.topTracks ?? [])
        setReleases(data.releases ?? [])

        // Also look up in-app sounds for this artist
        if (data.artist?.name) {
          const safe = data.artist.name.replace(/[%,()]/g, '')
          supabase
            .from('sounds')
            .select('*, reactions(*)')
            .eq('is_public', true)
            .ilike('artist', `%${safe}%`)
            .order('play_count', { ascending: false })
            .limit(10)
            .then(({ data: sounds }) => setInAppSounds((sounds as Sound[]) ?? []))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [artistId])

  // Preview toggle
  const togglePreview = (track: TopTrack) => {
    if (!track.previewUrl) return
    if (playingTrackId === track.id) {
      previewRef.current?.pause()
      setPlayingTrackId(null)
      return
    }
    previewRef.current?.pause()
    const audio = new Audio(track.previewUrl)
    audio.play()
    audio.onended = () => setPlayingTrackId(null)
    previewRef.current = audio
    setPlayingTrackId(track.id)
  }

  // Discography tabs
  const albums  = releases.filter((r) => r.type === 'album')
  const eps     = releases.filter((r) => r.type === 'ep')
  const singles = releases.filter((r) => r.type === 'single')
  const discoItems = discoTab === 'album' ? albums : discoTab === 'ep' ? eps : singles

  // Choose first non-empty tab
  useEffect(() => {
    if (releases.length === 0) return
    if (albums.length > 0) setDiscoTab('album')
    else if (eps.length > 0) setDiscoTab('ep')
    else setDiscoTab('single')
  }, [releases.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: colors.background }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ color: colors.textMuted, fontSize: 24 }} />
      </div>
    )
  }

  if (!artist) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: colors.background, gap: spacing.md }}>
        <i className="fa-solid fa-circle-exclamation" style={{ color: colors.textMuted, fontSize: 32 }} />
        <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize }}>Artiste introuvable.</p>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: typography.sm.fontSize, fontFamily: 'inherit' }}>
          Retour
        </button>
      </div>
    )
  }

  return (
    <div style={{ background: colors.background, minHeight: '100dvh', maxWidth: 600, margin: '0 auto', paddingBottom: 100 }}>

      {/* ── Sticky header ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: `${spacing.md}px ${spacing.lg}px`,
        position: 'sticky', top: 0,
        background: `${colors.background}f0`,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        zIndex: 10,
        borderBottom: `0.5px solid ${colors.border}`,
      }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textPrimary, fontSize: 20, padding: 4, display: 'flex', alignItems: 'center' }}
        >
          <i className="fa-solid fa-arrow-left" />
        </button>
        <span style={{ flex: 1, color: colors.textMuted, fontSize: typography.sm.fontSize, textAlign: 'center', fontWeight: 500 }}>
          {artist.name}
        </span>
        <div style={{ width: 28 }} />
      </div>

      {/* ── Hero ── */}
      <div style={{ position: 'relative', marginBottom: spacing.lg }}>
        {/* Background photo (blurred) */}
        <div style={{ width: '100%', height: 220, overflow: 'hidden', position: 'relative' }}>
          {artist.picture ? (
            <>
              <img
                src={artist.picture}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', filter: 'blur(0px)' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(13,13,13,0.15) 20%, #0d0d0d 100%)' }} />
            </>
          ) : (
            <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${colors.surface}, ${colors.surfaceElevated})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-user" style={{ color: colors.textMuted, fontSize: 48 }} />
            </div>
          )}
        </div>

        {/* Name + quick stats overlay */}
        <div style={{ position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg }}>
          <h1 style={{ color: colors.textPrimary, fontSize: 26, fontWeight: 700, margin: `0 0 ${spacing.xs}px`, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
            {artist.name}
          </h1>
          {artist.realName && artist.realName !== artist.name && (
            <p style={{ color: 'rgba(240,237,232,0.7)', fontSize: typography.xs.fontSize, margin: `0 0 ${spacing.xs}px`, fontStyle: 'italic' }}>
              {artist.realName}
            </p>
          )}
          <p style={{ color: 'rgba(240,237,232,0.6)', fontSize: typography.xs.fontSize, margin: 0 }}>
            {fmtFans(artist.fanCount)} fans
            {artist.nbAlbum > 0 && ` · ${artist.nbAlbum} sorties`}
          </p>
        </div>
      </div>

      {/* ── Info chips row ── */}
      {(artist.country || artist.birthDate || artist.mbType) && (
        <div style={{ display: 'flex', gap: spacing.sm, padding: `0 ${spacing.lg}px`, marginBottom: spacing.lg, flexWrap: 'wrap' }}>
          {artist.mbType === 'Group' && <InfoChip icon="fa-users" label="Groupe" />}
          {artist.country && <InfoChip icon="fa-location-dot" label={artist.country} />}
          {artist.birthDate && (
            <InfoChip
              icon={artist.mbType === 'Group' ? 'fa-calendar-plus' : 'fa-cake-candles'}
              label={artist.birthDate}
            />
          )}
        </div>
      )}

      {/* ── Genres ── */}
      {artist.genres.length > 0 && (
        <div style={{ display: 'flex', gap: spacing.sm, padding: `0 ${spacing.lg}px`, marginBottom: spacing.xl, flexWrap: 'wrap' }}>
          {artist.genres.map((g) => <GenrePill key={g} label={g} />)}
        </div>
      )}

      {/* ── Biography ── */}
      {artist.bio && <BioSection bio={artist.bio} />}

      {/* ── In-app songs ── */}
      {inAppSounds.length > 0 && (
        <div style={{ marginBottom: spacing.xl }}>
          <SectionTitle icon="fa-music" title="Dans l'app" count={inAppSounds.length} />
          <div style={{ padding: `0 ${spacing.lg}px`, display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
            {inAppSounds.map((s) => (
              <SoundCard key={s.id} sound={s} onPress={() => playSound(s, inAppSounds)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Top Songs ── */}
      {topTracks.length > 0 && (
        <div style={{ marginBottom: spacing.xl }}>
          <SectionTitle icon="fa-chart-simple" title="Top songs" count={topTracks.length} />
          <div style={{ padding: `0 ${spacing.lg}px`, display: 'flex', flexDirection: 'column' }}>
            {topTracks.map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i}
                artistId={artistId}
                isPlaying={playingTrackId === track.id}
                onPreview={() => togglePreview(track)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Discography ── */}
      {releases.length > 0 && (
        <div style={{ marginBottom: spacing.xl }}>
          <SectionTitle icon="fa-compact-disc" title="Discographie" />

          {/* Type tabs */}
          <div style={{ display: 'flex', gap: spacing.sm, padding: `0 ${spacing.lg}px`, marginBottom: spacing.md }}>
            {([['album', 'Albums', albums.length], ['ep', 'EPs', eps.length], ['single', 'Singles', singles.length]] as [typeof discoTab, string, number][])
              .filter(([, , count]) => count > 0)
              .map(([tab, label, count]) => {
                const active = discoTab === tab
                return (
                  <button
                    key={tab}
                    onClick={() => setDiscoTab(tab)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 14px', borderRadius: radius.full,
                      border: `0.5px solid ${active ? 'var(--accent)' : colors.border}`,
                      background: active ? 'var(--accent-muted)' : 'transparent',
                      color: active ? 'var(--accent)' : colors.textSecondary,
                      fontSize: typography.xs.fontSize, fontWeight: active ? 600 : 400,
                      cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all var(--ease-default)',
                    }}
                  >
                    {label}
                    <span style={{ fontSize: 10, opacity: 0.75 }}>{count}</span>
                  </button>
                )
              })
            }
          </div>

          {/* Release list */}
          <div style={{ padding: `0 ${spacing.lg}px`, display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            {discoItems.map((release) => (
              <ReleaseCard
                key={release.id}
                release={release}
                artistId={artistId}
                artist={artist}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
