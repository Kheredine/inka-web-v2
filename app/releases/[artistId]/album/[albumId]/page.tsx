'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SoundCard } from '@/components/ui/Card'
import { CoverArt } from '@/components/ui/CoverArt'
import { useSavedReleasesStore } from '@/stores/savedReleasesStore'
import { useToastStore } from '@/stores/toastStore'
import { colors, spacing, radius, typography } from '@/lib/theme'
import { formatDuration } from '@/lib/utils'
import type { ReleaseTrack, ReleaseType, SavedRelease, Sound } from '@/types'

interface AlbumData {
  id: number
  title: string
  cover: string
  coverXl: string
  type: ReleaseType
  releaseDate: string
  trackCount: number
  artist: { id: number; name: string; image: string }
}

// ── Telegram download links ────────────────────────────────────────────────────

function TelegramDownload({ artistName, title }: { artistName: string; title: string }) {
  const query = encodeURIComponent(`${artistName} ${title}`)
  return (
    <div style={{ padding: `0 ${spacing.lg}px`, marginBottom: spacing.lg }}>
      <h3 style={{ color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 600, margin: `0 0 ${spacing.sm}px` }}>
        <i className="fa-brands fa-telegram" style={{ marginRight: 6, color: '#2AABEE', fontSize: 13 }} />
        Télécharger
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
        {[
          { name: 'MusicsHunters', bot: 'MusicsHuntersbot' },
          { name: 'DeezerMusic', bot: 'DeezerMusicBot' },
        ].map(({ name, bot }) => (
          <a
            key={bot}
            href={`https://t.me/${bot}?start=${query}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: spacing.md,
              padding: `${spacing.md}px`,
              borderRadius: radius.md,
              background: colors.surface,
              border: `0.5px solid ${colors.border}`,
              color: colors.textPrimary,
              textDecoration: 'none',
              fontSize: typography.sm.fontSize,
              transition: 'border-color var(--ease-default)',
            }}
          >
            <i className="fa-brands fa-telegram" style={{ color: '#2AABEE', fontSize: 18, width: 20, textAlign: 'center' as const }} />
            <span style={{ flex: 1 }}>{name}</span>
            <i className="fa-solid fa-arrow-up-right-from-square" style={{ color: colors.textMuted, fontSize: 11 }} />
          </a>
        ))}
      </div>
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: `${spacing.sm}px 0`, borderBottom: `1px solid ${colors.border}` }}>
      <span style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, flexShrink: 0, marginRight: spacing.md }}>{label}</span>
      <span style={{ color: colors.textSecondary, fontSize: typography.sm.fontSize, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function SaveButton({ release, artist }: { release: AlbumData; artist: AlbumData['artist'] }) {
  const { isSaved, save, remove } = useSavedReleasesStore()
  const toast = useToastStore()
  const saved = isSaved(release.id)
  return (
    <button
      onClick={() => {
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
      }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: `${spacing.sm}px ${spacing.md}px`,
        borderRadius: radius.md, border: `0.5px solid ${saved ? colors.primary + '66' : colors.border}`,
        background: saved ? `${colors.primary}18` : 'transparent',
        color: saved ? colors.primary : colors.textSecondary,
        cursor: 'pointer', fontSize: typography.sm.fontSize, fontFamily: 'inherit',
        transition: 'all var(--ease-default)',
      }}
    >
      <i className={`fa-${saved ? 'solid' : 'regular'} fa-bookmark`} />
      {saved ? 'Sauvegardé' : 'Sauvegarder'}
    </button>
  )
}

// ── Album / EP template (mirrors playlist page) ───────────────────────────────

function AlbumTemplate({
  release,
  tracks,
  previewRef,
}: {
  release: AlbumData
  tracks: ReleaseTrack[]
  previewRef: React.MutableRefObject<HTMLAudioElement | null>
}) {
  const router = useRouter()
  const [playing, setPlaying] = useState<number | null>(null)

  const playPreview = (track: ReleaseTrack) => {
    if (!track.previewUrl) return
    if (playing === track.id) {
      previewRef.current?.pause()
      setPlaying(null)
      return
    }
    if (previewRef.current) {
      previewRef.current.pause()
    }
    const audio = new Audio(track.previewUrl)
    audio.play()
    audio.onended = () => setPlaying(null)
    previewRef.current = audio
    setPlaying(track.id)
  }

  const typeLabel = release.type === 'ep' ? 'EP' : 'Album'
  const releaseYear = new Date(release.releaseDate).getFullYear()

  return (
    <div style={{ background: colors.background, minHeight: '100dvh', maxWidth: 700, margin: '0 auto', paddingBottom: 100 }}>

      {/* Header — mirrors playlist page */}
      <div style={{ display: 'flex', alignItems: 'center', padding: `${spacing.md}px ${spacing.lg}px`, position: 'sticky', top: 0, background: `${colors.background}f0`, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', zIndex: 10, borderBottom: `0.5px solid ${colors.border}` }}>
        <button onClick={() => router.back()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textPrimary, fontSize: 20, padding: 4, display: 'flex', alignItems: 'center' }}>
          <i className="fa-solid fa-arrow-left" />
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: spacing.sm }}>
          <button
            onClick={() => tracks[0] && playPreview(tracks[0])}
            disabled={!tracks.some((t) => t.previewUrl)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radius.md, background: tracks.length ? 'var(--accent)' : colors.surface, color: tracks.length ? '#fff' : colors.textMuted, border: 'none', cursor: tracks.length ? 'pointer' : 'not-allowed', fontSize: typography.sm.fontSize, fontFamily: 'inherit' }}
          >
            <i className="fa-solid fa-play" />
            Lire
          </button>
          <SaveButton release={release} artist={release.artist} />
        </div>
      </div>

      <div style={{ padding: `0 ${spacing.lg}px` }}>
        {/* Album header — mirrors playlist header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg, marginTop: spacing.md }}>
          <div style={{ width: 72, height: 72, borderRadius: radius.xl, overflow: 'hidden', flexShrink: 0, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
            <img src={release.cover} alt={release.title} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginBottom: 2 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)', background: 'var(--accent-muted)', borderRadius: 4, padding: '2px 6px' }}>
                {typeLabel}
              </span>
            </div>
            <h1 style={{ color: colors.textPrimary, fontSize: typography.xl.fontSize, margin: 0, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {release.title}
            </h1>
            <p style={{ color: colors.textSecondary, fontSize: typography.sm.fontSize, margin: `${spacing.xs}px 0 0` }}>
              {release.artist.name}
            </p>
            <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, margin: `${spacing.xs}px 0 0` }}>
              {tracks.length} piste{tracks.length !== 1 ? 's' : ''} · {releaseYear}
            </p>
          </div>
        </div>

        {/* Track list — mirrors playlist SoundCard grid but as rows */}
        {tracks.length === 0 ? (
          <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, padding: `${spacing.xl}px 0` }}>
            Aucune piste disponible.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
            {tracks.map((track) => {
              const isPlaying = playing === track.id
              return (
                <div
                  key={track.id}
                  onClick={() => playPreview(track)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: spacing.md,
                    padding: `${spacing.sm + 2}px ${spacing.md}px`,
                    borderRadius: radius.md,
                    background: isPlaying ? `${colors.primary}12` : colors.surface,
                    border: `0.5px solid ${isPlaying ? colors.primary + '44' : colors.border}`,
                    cursor: track.previewUrl ? 'pointer' : 'default',
                    transition: 'background var(--ease-default), border-color var(--ease-default)',
                  }}
                >
                  {/* Position / playing indicator */}
                  <div style={{ width: 20, textAlign: 'center', flexShrink: 0 }}>
                    {isPlaying
                      ? <i className="fa-solid fa-pause" style={{ color: colors.primary, fontSize: 12 }} />
                      : <span style={{ color: colors.textMuted, fontSize: 11 }}>{track.position}</span>
                    }
                  </div>

                  {/* Title */}
                  <span style={{ flex: 1, color: isPlaying ? colors.primary : colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: isPlaying ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color var(--ease-default)' }}>
                    {track.title}
                  </span>

                  {/* Duration */}
                  <span style={{ color: colors.textMuted, fontSize: 11, flexShrink: 0 }}>
                    {formatDuration(track.duration)}
                  </span>

                  {/* Preview indicator */}
                  {track.previewUrl && (
                    <i className={`fa-solid fa-${isPlaying ? 'volume-high' : 'headphones'}`} style={{ color: isPlaying ? colors.primary : colors.textMuted, fontSize: 12, flexShrink: 0 }} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <TelegramDownload artistName={release.artist.name} title={release.title} />
    </div>
  )
}

// ── Single template (mirrors player page) ─────────────────────────────────────

function SingleTemplate({
  release,
  track,
  previewRef,
}: {
  release: AlbumData
  track: ReleaseTrack | null
  previewRef: React.MutableRefObject<HTMLAudioElement | null>
}) {
  const router = useRouter()
  const [playing, setPlaying] = useState(false)
  const [videoId, setVideoId] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(true)
  const [similar, setSimilar] = useState<Sound[]>([])

  useEffect(() => {
    const q = `${release.artist.name} - ${release.title} official`
    fetch(`/api/youtube-search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => setVideoId(d.videoId ?? null))
      .catch(() => setVideoId(null))
      .finally(() => setVideoLoading(false))

    // Similar sounds in Inka's DB
    const safe = release.artist.name.replace(/[%,()]/g, '')
    supabase
      .from('sounds')
      .select('*, reactions(*)')
      .eq('is_public', true)
      .ilike('artist', `%${safe}%`)
      .limit(6)
      .then(({ data }) => setSimilar((data as Sound[]) ?? []))
  }, [release.artist.name, release.title])

  const togglePreview = () => {
    if (!track?.previewUrl) return
    if (playing) {
      previewRef.current?.pause()
      setPlaying(false)
    } else {
      const audio = new Audio(track.previewUrl)
      audio.play()
      audio.onended = () => setPlaying(false)
      previewRef.current = audio
      setPlaying(true)
    }
  }

  const releaseDate = new Date(release.releaseDate).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div style={{ background: colors.background, minHeight: '100dvh', maxWidth: 600, margin: '0 auto', paddingBottom: 100 }}>

      {/* Header — mirrors player page */}
      <div style={{ display: 'flex', alignItems: 'center', padding: `${spacing.md}px ${spacing.lg}px`, position: 'sticky', top: 0, background: `${colors.background}f0`, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', zIndex: 10, borderBottom: `0.5px solid ${colors.border}` }}>
        <button onClick={() => router.back()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textPrimary, fontSize: 20, padding: 4, display: 'flex', alignItems: 'center' }}>
          <i className="fa-solid fa-arrow-left" />
        </button>
        <span style={{ flex: 1, color: colors.textMuted, fontSize: typography.sm.fontSize, textAlign: 'center' }}>
          Single
        </span>
        <div style={{ width: 28 }} />
      </div>

      {/* Cover art — mirrors player page */}
      <div style={{ padding: `0 ${spacing.xl}px ${spacing.lg}px` }}>
        <div style={{ width: '100%', aspectRatio: '1', borderRadius: radius.xl, overflow: 'hidden', background: colors.surface, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
          <img src={release.coverXl || release.cover} alt={release.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      </div>

      {/* Title + artist + badge — mirrors player page */}
      <div style={{ padding: `0 ${spacing.xl}px`, marginBottom: spacing.md }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: 4 }}>
          <h2 style={{ color: colors.textPrimary, fontSize: typography.lg.fontSize, fontWeight: 700, margin: 0, flex: 1 }}>
            {release.title}
          </h2>
          <span style={{ padding: '2px 8px', borderRadius: radius.sm, background: colors.surfaceElevated, color: colors.textMuted, fontSize: typography.xs.fontSize, fontWeight: 500, border: `1px solid ${colors.border}`, flexShrink: 0 }}>
            Single
          </span>
        </div>
        <p style={{ color: colors.textSecondary, fontSize: typography.base.fontSize, margin: `${spacing.xs}px 0 0` }}>
          {release.artist.name}
        </p>
      </div>

      {/* Play preview + Save — mirrors play/action row */}
      <div style={{ padding: `0 ${spacing.xl}px`, marginBottom: spacing.lg, display: 'flex', gap: spacing.sm }}>
        {track?.previewUrl && (
          <button
            onClick={togglePreview}
            style={{ flex: 1, padding: `${spacing.md}px`, borderRadius: radius.lg, background: 'var(--accent-gradient)', border: 'none', color: '#fff', fontSize: typography.base.fontSize, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <i className={`fa-solid fa-${playing ? 'pause' : 'play'}`} style={{ marginLeft: playing ? 0 : 2 }} />
            {playing ? 'Pause' : 'Écouter l\'extrait'}
          </button>
        )}
        <SaveButton release={release} artist={release.artist} />
      </div>

      {/* Informations — mirrors player InfoRow block */}
      <div style={{ padding: `0 ${spacing.lg}px`, marginBottom: spacing.lg }}>
        <h3 style={{ color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 600, margin: `0 0 ${spacing.sm}px` }}>Informations</h3>
        <div style={{ background: colors.surface, borderRadius: radius.lg, padding: `0 ${spacing.md}px`, border: `1px solid ${colors.border}` }}>
          <InfoRow label="Artiste" value={release.artist.name} />
          <InfoRow label="Sortie" value={releaseDate} />
          {track && <InfoRow label="Durée" value={formatDuration(track.duration)} />}
          <InfoRow label="Classif." value="Single" />
        </div>
      </div>

      <TelegramDownload artistName={release.artist.name} title={release.title} />

      {/* YouTube embed — mirrors player YouTube section */}
      <div style={{ padding: `0 ${spacing.lg}px`, marginBottom: spacing.lg }}>
        {videoLoading ? (
          <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: radius.lg, background: colors.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ color: colors.textMuted, fontSize: 20 }} />
          </div>
        ) : videoId ? (
          <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: radius.lg, overflow: 'hidden', background: '#000' }}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&color=white`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          </div>
        ) : null}
      </div>

      {/* Similar in Inka's DB — mirrors player "Sons similaires" */}
      {similar.length > 0 && (
        <div style={{ marginBottom: spacing.lg }}>
          <h3 style={{ color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 600, margin: `0 0 ${spacing.sm}px`, padding: `0 ${spacing.lg}px` }}>
            <i className="fa-solid fa-music" style={{ marginRight: 6, color: colors.primary, fontSize: 13 }} />
            Dans l'app
          </h3>
          {similar.map((s) => (
            <SoundCard key={s.id} sound={s} onPress={() => router.push(`/player/${s.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Root page — fetches data, picks template ───────────────────────────────────

export default function AlbumDetailPage() {
  const params = useParams()
  const albumId = params.albumId as string

  const [release, setRelease] = useState<AlbumData | null>(null)
  const [tracks, setTracks] = useState<ReleaseTrack[]>([])
  const [loading, setLoading] = useState(true)
  const previewRef = useRef<HTMLAudioElement | null>(null)

  // Stop any preview on unmount
  useEffect(() => () => { previewRef.current?.pause() }, [])

  useEffect(() => {
    if (!albumId) return
    setLoading(true)
    fetch(`/api/album/${albumId}`)
      .then((r) => r.json())
      .then((data) => {
        setRelease(data.album ?? null)
        setTracks(data.tracks ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [albumId])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: colors.background }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ color: colors.textMuted, fontSize: 24 }} />
      </div>
    )
  }

  if (!release) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: colors.background }}>
        <p style={{ color: colors.textMuted }}>Sortie introuvable.</p>
      </div>
    )
  }

  if (release.type === 'single') {
    return (
      <SingleTemplate
        release={release}
        track={tracks[0] ?? null}
        previewRef={previewRef}
      />
    )
  }

  return (
    <AlbumTemplate
      release={release}
      tracks={tracks}
      previewRef={previewRef}
    />
  )
}
