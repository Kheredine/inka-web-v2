'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { ReleaseItem, SavedRelease } from '@/types'
import { useSavedReleasesStore } from '@/stores/savedReleasesStore'
import { useToastStore } from '@/stores/toastStore'
import { colors, spacing, radius, typography } from '@/lib/theme'

interface ArtistInfo {
  id: number
  name: string
  imageXl: string
  imageMedium: string
  fanCount: number
}

// ── Date group header ──────────────────────────────────────────────────────────
function DateGroup({ date, children }: { date: string; children: React.ReactNode }) {
  const label = new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return (
    <div style={{ marginBottom: spacing.xl }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: `0 ${spacing.lg}px`, marginBottom: spacing.md }}>
        <span style={{ color: colors.textMuted, fontSize: typography.xs.fontSize, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <div style={{ flex: 1, height: 1, background: colors.border }} />
      </div>
      {children}
    </div>
  )
}

// ── Release card — fully clickable ─────────────────────────────────────────────
function ReleaseCard({
  release,
  artist,
  onClick,
}: {
  release: ReleaseItem
  artist: ArtistInfo
  onClick: () => void
}) {
  const { isSaved, save, remove } = useSavedReleasesStore()
  const toast = useToastStore()
  const [hovered, setHovered] = useState(false)
  const saved = isSaved(release.id)
  const typeLabel = release.type === 'album' ? 'Album' : release.type === 'ep' ? 'EP' : 'Single'

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
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        margin: `0 ${spacing.lg}px ${spacing.sm}px`,
        background: colors.surface,
        border: `0.5px solid ${hovered ? 'var(--accent)44' : colors.border}`,
        borderRadius: radius.lg,
        overflow: 'hidden',
        cursor: 'pointer',
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered ? '0 6px 20px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.15)',
        transition: 'transform var(--ease-enter), box-shadow var(--ease-enter), border-color var(--ease-enter)',
      }}
    >
      <div style={{ display: 'flex', gap: spacing.md, padding: spacing.md, alignItems: 'center' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <img
            src={release.cover}
            alt={release.title}
            style={{ width: 64, height: 64, borderRadius: radius.md, objectFit: 'cover', display: 'block' }}
          />
          {/* Play overlay on cover */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: radius.md,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: hovered ? 1 : 0,
            transition: 'opacity var(--ease-enter)',
          }}>
            <i className="fa-solid fa-play" style={{ color: '#fff', fontSize: 16, marginLeft: 2 }} />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: 'var(--accent)', background: 'var(--accent-muted)',
            borderRadius: 4, padding: '2px 6px', display: 'inline-block', marginBottom: 4,
          }}>
            {typeLabel}
          </span>
          <div style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {release.title}
          </div>
          <div style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
            {release.trackCount > 1 ? `${release.trackCount} pistes` : '1 piste'}
          </div>
        </div>

        {/* Save button + arrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexShrink: 0 }}>
          <button
            onClick={handleSave}
            title={saved ? 'Retirer de la bibliothèque' : 'Sauvegarder'}
            style={{
              width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: saved ? `${colors.primary}20` : 'rgba(255,255,255,0.06)',
              color: saved ? colors.primary : colors.textMuted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all var(--ease-default)',
            }}
          >
            <i className={`fa-${saved ? 'solid' : 'regular'} fa-bookmark`} style={{ fontSize: 13 }} />
          </button>
          <i className="fa-solid fa-chevron-right" style={{ color: colors.textMuted, fontSize: 12, opacity: hovered ? 1 : 0.4, transition: 'opacity var(--ease-enter)' }} />
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ArtistReleasesPage() {
  const params = useParams()
  const router = useRouter()
  const artistId = params.artistId as string

  const [artist, setArtist] = useState<ArtistInfo | null>(null)
  const [releases, setReleases] = useState<ReleaseItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!artistId) return
    setLoading(true)
    fetch(`/api/artist-releases/${artistId}`)
      .then((r) => r.json())
      .then((data) => {
        setArtist(data.artist ?? null)
        setReleases(data.releases ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [artistId])

  // Group releases by release date
  const grouped = releases.reduce<Record<string, ReleaseItem[]>>((acc, r) => {
    ;(acc[r.releaseDate] ??= []).push(r)
    return acc
  }, {})
  const sortedDates = Object.keys(grouped).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  )

  return (
    <div style={{ background: colors.background, minHeight: '100dvh', maxWidth: 600, margin: '0 auto', paddingBottom: 100 }}>

      {/* Sticky header */}
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
        <button
          onClick={() => router.push(`/artist/${artistId}`)}
          style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', color: colors.textMuted, fontSize: typography.sm.fontSize, textAlign: 'center', fontFamily: 'inherit' }}
        >
          Discographie
        </button>
        <div style={{ width: 28 }} />
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ color: colors.textMuted, fontSize: 24 }} />
        </div>
      ) : !artist ? (
        <p style={{ color: colors.textMuted, textAlign: 'center', padding: `${spacing.xl}px ${spacing.lg}px` }}>
          Artiste introuvable.
        </p>
      ) : (
        <>
          {/* Artist hero */}
          <div style={{ position: 'relative', marginBottom: spacing.xl }}>
            <div style={{ width: '100%', height: 220, overflow: 'hidden', position: 'relative' }}>
              <img
                src={artist.imageXl}
                alt={artist.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(13,13,13,0.1) 30%, #0d0d0d)' }} />
            </div>
            <div style={{ position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg }}>
              <h1 style={{ color: colors.textPrimary, fontSize: typography.xl.fontSize, fontWeight: 700, margin: `0 0 ${spacing.xs}px` }}>
                {artist.name}
              </h1>
              <p style={{ color: colors.textMuted, fontSize: typography.xs.fontSize, margin: 0 }}>
                {artist.fanCount.toLocaleString()} fans
                {releases.length > 0 && ` · ${releases.length} sortie${releases.length > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          {/* Releases */}
          {releases.length === 0 ? (
            <p style={{ color: colors.textMuted, textAlign: 'center', padding: `${spacing.xl}px ${spacing.lg}px`, fontSize: typography.sm.fontSize }}>
              Aucune sortie trouvée pour cet artiste.
            </p>
          ) : (
            sortedDates.map((date) => (
              <DateGroup key={date} date={date}>
                {grouped[date].map((release) => (
                  <ReleaseCard
                    key={release.id}
                    release={release}
                    artist={artist}
                    onClick={() => router.push(`/releases/${artistId}/album/${release.id}`)}
                  />
                ))}
              </DateGroup>
            ))
          )}
        </>
      )}
    </div>
  )
}
