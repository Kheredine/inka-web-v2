'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { usePlayer } from '@/hooks/usePlayer'
import { useAuthStore } from '@/stores/authStore'
import { PlayerControls } from '@/components/audio/PlayerControls'
import { ProgressBar } from '@/components/audio/ProgressBar'
import { ReactionBar } from '@/components/social/ReactionBar'
import { ShareModal } from '@/components/social/ShareModal'
import { SoundCard } from '@/components/ui/Card'
import { CoverArt } from '@/components/ui/CoverArt'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Sound } from '@/types'
import { colors, spacing, radius, typography } from '@/lib/theme'
import { formatDuration } from '@/lib/utils'
import type { Fact } from '@/app/api/facts/route'

// ── Types ──────────────────────────────────────────────────────────────────────

interface EnrichmentData {
  mood?: string[]
  energy_level?: number
  description?: string
  similar_in_app_query?: string
  similar_external?: Array<{ title: string; artist: string }>
  release_type?: string
  album_name?: string
  release_date?: string
  themes?: string[]
}

interface EditForm {
  title: string
  artist: string
  genre: string
  year: string
  producer: string
  country: string
  description: string
  youtube_url: string
}

// ── YouTube embed ──────────────────────────────────────────────────────────────

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)
  return m?.[1] ?? null
}

function YouTubePlayer({ url }: { url: string }) {
  const id = getYouTubeId(url)
  if (!id) return null
  return (
    <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: radius.lg, overflow: 'hidden', background: '#000' }}>
      <iframe
        src={`https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&color=white`}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: `${spacing.sm}px 0`, borderBottom: `1px solid ${colors.border}` }}>
      <span style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, flexShrink: 0, marginRight: spacing.md }}>{label}</span>
      <span style={{ color: colors.textSecondary, fontSize: typography.sm.fontSize, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function TagPill({ tag, accent }: { tag: string; accent?: boolean }) {
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: radius.full,
      background: accent ? `${colors.primary}18` : colors.surfaceElevated,
      color: accent ? colors.primary : colors.textMuted,
      fontSize: typography.xs.fontSize,
      border: `1px solid ${accent ? colors.primary + '44' : colors.border}`,
    }}>
      {tag}
    </span>
  )
}

function EnergyBar({ level }: { level: number }) {
  const clamped = Math.max(1, Math.min(10, level))
  const hue = Math.round(120 - clamped * 10)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
      <span style={{ color: colors.textMuted, fontSize: typography.xs.fontSize, flexShrink: 0, width: 56 }}>Énergie</span>
      <div style={{ flex: 1, height: 4, background: colors.surfaceElevated, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(clamped / 10) * 100}%`, background: `hsl(${hue}, 70%, 48%)`, borderRadius: 2, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ color: colors.textMuted, fontSize: typography.xs.fontSize, width: 20, textAlign: 'right' }}>{clamped}/10</span>
    </div>
  )
}

function SkeletonLine({ width = '100%', height = 14 }: { width?: string | number; height?: number }) {
  return (
    <div style={{ height, width, borderRadius: radius.sm, background: colors.surfaceElevated, opacity: 0.5 }} />
  )
}

function FieldInput({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  const base: React.CSSProperties = { width: '100%', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: `${spacing.sm}px ${spacing.md}px`, color: colors.textPrimary, fontSize: typography.sm.fontSize, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }
  return (
    <div style={{ marginBottom: spacing.md }}>
      <label style={{ display: 'block', color: colors.textMuted, fontSize: typography.xs.fontSize, marginBottom: 4 }}>{label}</label>
      {multiline ? <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} style={base} /> : <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={base} />}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function PlayerPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const player = usePlayer()
  const profile = useAuthStore((s) => s.profile)

  const isCurrentlyPlaying = player.currentSound?.id === params.id

  const [sound, setSound] = useState<Sound | null>(null)
  const [similar, setSimilar] = useState<Sound[]>([])
  const [localPlayCount, setLocalPlayCount] = useState(0)
  const countedPlayRef = useRef(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [showLyrics, setShowLyrics] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Enrichissement IA
  const [enrichment, setEnrichment] = useState<EnrichmentData | null>(null)
  const [enrichmentLoading, setEnrichmentLoading] = useState(false)
  const [enrichedSimilar, setEnrichedSimilar] = useState<Sound[]>([])

  // Paroles dynamiques
  const [fetchedLyrics, setFetchedLyrics] = useState<string | null>(null)
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [lyricsSource, setLyricsSource] = useState<string | null>(null)

  // Faits intéressants (fallback si aucune parole)
  const [facts, setFacts] = useState<Fact[] | null>(null)
  const [factsLoading, setFactsLoading] = useState(false)

  // YouTube auto-search (when no youtube_url stored)
  const [autoVideoId, setAutoVideoId] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(false)

  const [editForm, setEditForm] = useState<EditForm>({ title: '', artist: '', genre: '', year: '', producer: '', country: '', description: '', youtube_url: '' })

  // ── Chargement du son ──────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      // Always fetch fresh from DB so play_count is current
      const { data } = await supabase
        .from('sounds')
        .select('*, uploader:profiles!uploaded_by(*), reactions(*)')
        .eq('id', params.id)
        .single()
      const s: Sound | null = data ? (data as Sound) : null
      if (!s) return

      setSound(s)
      setEditForm({ title: s.title, artist: s.artist, genre: s.genre ?? '', year: s.year ? String(s.year) : '', producer: s.producer ?? '', country: s.country ?? '', description: s.description ?? '', youtube_url: s.youtube_url ?? '' })

      // Auto-search YouTube if no URL stored
      if (!s.youtube_url) {
        setVideoLoading(true)
        fetch(`/api/youtube-search?q=${encodeURIComponent(`${s.artist} - ${s.title} official`)}`)
          .then((r) => r.json())
          .then((d) => setAutoVideoId(d.videoId ?? null))
          .catch(() => setAutoVideoId(null))
          .finally(() => setVideoLoading(false))
      }

      const safeArtist = s.artist.replace(/[%,()]/g, '')
      const simQuery = supabase
        .from('sounds')
        .select('*, reactions(*)')
        .neq('id', params.id)
        .eq('is_public', true)
      if (s.genre) {
        const safeGenre = s.genre.replace(/[%,()]/g, '')
        simQuery.or(`genre.ilike.%${safeGenre}%,artist.ilike.%${safeArtist}%`)
      } else {
        simQuery.ilike('artist', `%${safeArtist}%`)
      }
      const { data: sim } = await simQuery.limit(6)
      setSimilar((sim as Sound[]) ?? [])
    }
    load()
  }, [params.id])

  // ── Sync local play count + optimistic increment on play ──────────────────
  useEffect(() => {
    if (sound) {
      setLocalPlayCount(sound.play_count)
      countedPlayRef.current = false
    }
  }, [sound?.id])

  useEffect(() => {
    if (isCurrentlyPlaying && !countedPlayRef.current) {
      countedPlayRef.current = true
      setLocalPlayCount((c) => c + 1)
    }
  }, [isCurrentlyPlaying])

  // ── Enrichissement IA ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!sound) return
    setEnrichmentLoading(true)
    setEnrichment(null)
    setEnrichedSimilar([])

    fetch('/api/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: sound.title, artist: sound.artist, genre: sound.genre }),
    })
      .then((r) => r.json())
      .then((data: EnrichmentData) => {
        setEnrichment(data)
        // Persist enrichment to DB so Browse/Pour toi can use it
        if (data.themes?.length || data.energy_level != null) {
          supabase.from('sounds').update({
            themes: data.themes ?? null,
            mood: data.mood?.join(',') ?? null,
            energy_level: data.energy_level ?? null,
          }).eq('id', sound.id).then(() => {})
        }
        if (data.similar_in_app_query?.trim()) {
          const q = data.similar_in_app_query.trim()
          supabase
            .from('sounds')
            .select('*, reactions(*)')
            .neq('id', sound.id)
            .eq('is_public', true)
            .or(`genre.ilike.%${q}%,artist.ilike.%${q}%,title.ilike.%${q}%`)
            .limit(5)
            .then(({ data: sd }) => setEnrichedSimilar((sd as Sound[]) ?? []))
        }
      })
      .catch(() => setEnrichment(null))
      .finally(() => setEnrichmentLoading(false))
  }, [sound?.id])

  // ── Paroles dynamiques : fetch si absent en DB ─────────────────────────────
  useEffect(() => {
    if (!sound || sound.lyrics) return  // déjà en DB → ne pas refetch
    setLyricsLoading(true)

    fetch('/api/lyrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: sound.title, artist: sound.artist }),
    })
      .then((r) => r.json())
      .then(async (d: { lyrics: string | null; source: string | null }) => {
        if (d.lyrics) {
          setFetchedLyrics(d.lyrics)
          setLyricsSource(d.source)
          // Sauvegarder en DB pour la prochaine fois
          await supabase.from('sounds').update({ lyrics: d.lyrics }).eq('id', sound.id)
        } else {
          // Aucune parole trouvée → charger les faits intéressants
          setFactsLoading(true)
          fetch('/api/facts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: sound.title, artist: sound.artist, album: enrichment?.album_name }),
          })
            .then((r) => r.json())
            .then((fd: { facts: Fact[] }) => { if (fd.facts?.length) setFacts(fd.facts) })
            .catch(() => undefined)
            .finally(() => setFactsLoading(false))
        }
      })
      .catch(() => undefined)
      .finally(() => setLyricsLoading(false))
  }, [sound?.id])

  const isOwner = profile?.id === sound?.uploaded_by
  const allSimilar = enrichedSimilar.length > 0 ? enrichedSimilar : similar
  const displayedLyrics = sound?.lyrics ?? fetchedLyrics

  // ── Sauvegarde édition ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!sound) return
    setIsSaving(true)
    const updates = { title: editForm.title.trim(), artist: editForm.artist.trim(), genre: editForm.genre.trim() || null, year: editForm.year ? parseInt(editForm.year) : null, producer: editForm.producer.trim() || null, country: editForm.country.trim() || null, description: editForm.description.trim() || null, youtube_url: editForm.youtube_url.trim() || null }
    const { data } = await supabase.from('sounds').update(updates).eq('id', sound.id).select('*, uploader:profiles!uploaded_by(*), reactions(*)').single()
    if (data) setSound(data as Sound)
    setIsSaving(false)
    setEditOpen(false)
  }

  // ── Suppression ────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!sound) return
    setIsDeleting(true)
    try {
      if (sound.audio_url) await supabase.storage.from('audio-files').remove([sound.audio_url])
      if (sound.audio_url_original && sound.audio_url_original !== sound.audio_url) {
        await supabase.storage.from('audio-files').remove([sound.audio_url_original])
      }
    } catch (_e) { /* non-bloquant */ }
    await supabase.from('sounds').delete().eq('id', sound.id)
    setIsDeleting(false)
    router.back()
  }

  if (!sound) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: colors.background }}>
        <div style={{ textAlign: 'center', color: colors.textMuted, fontSize: typography.base.fontSize }}>Chargement…</div>
      </div>
    )
  }

  return (
    <div style={{ background: colors.background, minHeight: '100dvh', maxWidth: 600, margin: '0 auto', position: 'relative', zIndex: 1, paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: `${spacing.md}px ${spacing.lg}px`, position: 'sticky', top: 0, background: colors.background, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textPrimary, fontSize: 20, padding: 4, display: 'flex', alignItems: 'center' }}>
          <i className="fa-solid fa-arrow-left" />
        </button>
        <span style={{ flex: 1, color: colors.textMuted, fontSize: typography.sm.fontSize, textAlign: 'center' }}>
          {isCurrentlyPlaying ? 'Lecture en cours' : 'Détails du son'}
        </span>
        <div style={{ display: 'flex', gap: spacing.sm }}>
          {isOwner && (
            <button onClick={() => setEditOpen(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, fontSize: 18, padding: 4, display: 'flex', alignItems: 'center' }}>
              <i className="fa-solid fa-pen-to-square" />
            </button>
          )}
          <button onClick={() => setShareOpen(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, fontSize: 18, padding: 4, display: 'flex', alignItems: 'center' }}>
            <i className="fa-solid fa-share-nodes" />
          </button>
        </div>
      </div>

      {/* Cover art */}
      <div style={{ padding: `0 ${spacing.xl}px ${spacing.lg}px` }}>
        <div
          onClick={() => { if (!isCurrentlyPlaying) player.playSound(sound, [sound, ...allSimilar]) }}
          style={{ width: '100%', aspectRatio: '1', borderRadius: radius.xl, overflow: 'hidden', background: colors.surface, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', cursor: isCurrentlyPlaying ? 'default' : 'pointer', position: 'relative' }}
        >
          <CoverArt title={sound.title} artist={sound.artist} genre={sound.genre} size={600} isPlaying={isCurrentlyPlaying && player.isPlaying} />
          {!isCurrentlyPlaying && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', opacity: 0, transition: 'opacity 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
            >
              <i className="fa-solid fa-play" style={{ color: '#fff', fontSize: 48 }} />
            </div>
          )}
        </div>
      </div>

      {/* Titre + artiste + badge release type */}
      <div style={{ padding: `0 ${spacing.xl}px`, marginBottom: spacing.md }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: 4 }}>
          <h2 style={{ color: colors.textPrimary, fontSize: typography.lg.fontSize, fontWeight: 700, margin: 0, flex: 1 }}>{sound.title}</h2>
          {enrichment?.release_type && enrichment.release_type !== 'Unknown' && (
            <span style={{ padding: '2px 8px', borderRadius: radius.sm, background: colors.surfaceElevated, color: colors.textMuted, fontSize: typography.xs.fontSize, fontWeight: 500, border: `1px solid ${colors.border}`, flexShrink: 0 }}>
              {enrichment.release_type}
            </span>
          )}
        </div>
        <p style={{ color: colors.textSecondary, fontSize: typography.base.fontSize, margin: `${spacing.xs}px 0 0` }}>{sound.artist}</p>
        {enrichment?.album_name && (
          <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, margin: `${spacing.xs}px 0 0`, display: 'flex', alignItems: 'center', gap: 5 }}>
            <i className="fa-solid fa-compact-disc" style={{ fontSize: 11, color: colors.primary }} />
            {enrichment.album_name}
          </p>
        )}
      </div>

      {/* Thèmes */}
      {enrichmentLoading ? (
        <div style={{ padding: `0 ${spacing.xl}px`, marginBottom: spacing.md, display: 'flex', gap: 6 }}>
          <SkeletonLine width={80} height={22} />
          <SkeletonLine width={64} height={22} />
          <SkeletonLine width={96} height={22} />
        </div>
      ) : enrichment?.themes?.length ? (
        <div style={{ padding: `0 ${spacing.xl}px`, marginBottom: spacing.md }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
            {enrichment.themes.map((t) => <TagPill key={t} tag={t} />)}
          </div>
        </div>
      ) : null}

      {/* Barre d'énergie */}
      {enrichment?.energy_level != null && (
        <div style={{ padding: `0 ${spacing.xl}px`, marginBottom: spacing.lg }}>
          <EnergyBar level={enrichment.energy_level} />
        </div>
      )}

      {/* Réactions */}
      <div style={{ padding: `0 ${spacing.xl}px`, marginBottom: spacing.lg }}>
        <ReactionBar soundId={sound.id} reactions={sound.reactions ?? []} />
      </div>

      {/* Contrôles de lecture */}
      {isCurrentlyPlaying ? (
        <>
          <div style={{ marginBottom: spacing.md }}>
            <ProgressBar position={player.position} duration={player.duration} onSeek={player.seekTo} />
          </div>
          <div style={{ marginBottom: spacing.xl }}>
            <PlayerControls isPlaying={player.isPlaying} shuffle={player.shuffle} repeatMode={player.repeatMode} onTogglePlay={player.togglePlay} onSkipNext={player.skipToNext} onSkipPrev={player.skipToPrevious} onToggleShuffle={player.toggleShuffle} onCycleRepeat={player.cycleRepeat} />
          </div>
        </>
      ) : (
        <div style={{ padding: `0 ${spacing.xl}px`, marginBottom: spacing.lg }}>
          <button onClick={() => player.playSound(sound, [sound, ...allSimilar])} style={{ width: '100%', padding: `${spacing.md}px`, borderRadius: radius.lg, background: 'var(--accent-gradient)', border: 'none', color: '#fff', fontSize: typography.base.fontSize, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <i className="fa-solid fa-play" style={{ marginLeft: 2 }} />
            Lire ce son
          </button>
        </div>
      )}

      {/* Informations */}
      <div style={{ padding: `0 ${spacing.lg}px`, marginBottom: spacing.lg }}>
        <h3 style={{ color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 600, margin: `0 0 ${spacing.sm}px` }}>Informations</h3>
        <div style={{ background: colors.surface, borderRadius: radius.lg, padding: `0 ${spacing.md}px`, border: `1px solid ${colors.border}` }}>
          {sound.artist        && <InfoRow label="Artiste"     value={sound.artist} />}
          {sound.artists?.length > 1 && <InfoRow label="Featuring"  value={sound.artists.slice(1).join(', ')} />}
          {sound.producer      && <InfoRow label="Producteur"  value={sound.producer} />}
          {/* Classification — AI enrichment si dispo, sinon Single par défaut */}
          <InfoRow label="Classif." value={
            enrichmentLoading ? '…' :
            (enrichment?.release_type && enrichment.release_type !== 'Unknown')
              ? enrichment.release_type
              : 'Single'
          } />
          {/* Album depuis enrichissement IA */}
          {enrichment?.album_name && <InfoRow label="Album" value={enrichment.album_name} />}
          {/* Date de sortie — enrichissement IA ou année DB, fallback "—" */}
          <InfoRow
            label="Sortie"
            value={
              enrichmentLoading && !sound.year
                ? '…'
                : enrichment?.release_date || (sound.year ? String(sound.year) : '—')
            }
          />
          {/* Données de la DB */}
          {sound.genre         && <InfoRow label="Genre"       value={sound.genre} />}
          {sound.country       && <InfoRow label="Pays"        value={sound.country} />}
          {sound.uploader      && <InfoRow label="Partagé par" value={sound.uploader.display_name} />}
          <InfoRow label="Durée"   value={formatDuration(sound.duration)} />
          <InfoRow label="Écoutes" value={String(localPlayCount)} />
        </div>
      </div>

      {/* YouTube player — stored URL or auto-searched */}
      {(sound.youtube_url || autoVideoId || videoLoading) && (
        <div style={{ padding: `0 ${spacing.lg}px`, marginBottom: spacing.lg }}>
          {videoLoading ? (
            <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: radius.lg, background: colors.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ color: colors.textMuted, fontSize: 20 }} />
            </div>
          ) : sound.youtube_url ? (
            <YouTubePlayer url={sound.youtube_url} />
          ) : autoVideoId ? (
            <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: radius.lg, overflow: 'hidden', background: '#000' }}>
              <iframe
                src={`https://www.youtube.com/embed/${autoVideoId}?rel=0&modestbranding=1&color=white`}
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              />
            </div>
          ) : null}
        </div>
      )}

      {/* Description */}
      {(sound.description || enrichment?.description) && (
        <div style={{ padding: `0 ${spacing.lg}px`, marginBottom: spacing.lg }}>
          <h3 style={{ color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 600, margin: `0 0 ${spacing.sm}px` }}>Description</h3>
          <p style={{ color: colors.textSecondary, fontSize: typography.sm.fontSize, lineHeight: 1.7, margin: 0, background: colors.surface, padding: spacing.md, borderRadius: radius.lg, border: `1px solid ${colors.border}` }}>
            {sound.description || enrichment?.description}
          </p>
        </div>
      )}

      {/* ── Paroles ── */}
      <div style={{ padding: `0 ${spacing.lg}px`, marginBottom: spacing.lg }}>
        {lyricsLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, color: colors.textMuted, fontSize: typography.sm.fontSize }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 12 }} />
            Recherche des paroles…
          </div>
        ) : displayedLyrics ? (
          <>
            <button
              onClick={() => setShowLyrics(!showLyrics)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: `0 0 ${spacing.sm}px` }}
            >
              <h3 style={{ color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-microphone" style={{ fontSize: 14, color: colors.primary }} />
                Paroles
                {lyricsSource && <span style={{ fontSize: typography.xs.fontSize, color: colors.textMuted, fontWeight: 400 }}>— {lyricsSource}</span>}
              </h3>
              <i className={`fa-solid ${showLyrics ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{ color: colors.textMuted, fontSize: 14 }} />
            </button>
            {showLyrics && (
              <div style={{ color: colors.textSecondary, fontSize: typography.sm.fontSize, lineHeight: 2, background: colors.surface, padding: spacing.lg, borderRadius: radius.lg, border: `1px solid ${colors.border}`, whiteSpace: 'pre-wrap', maxHeight: 480, overflowY: 'auto' }}>
                {displayedLyrics}
              </div>
            )}
          </>
        ) : !factsLoading && !facts ? null : null}
      </div>

      {/* ── Faits intéressants (fallback si aucune parole) ── */}
      {!displayedLyrics && !lyricsLoading && (
        <div style={{ padding: `0 ${spacing.lg}px`, marginBottom: spacing.lg }}>
          {factsLoading ? (
            <div>
              <h3 style={{ color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 600, margin: `0 0 ${spacing.md}px`, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-lightbulb" style={{ fontSize: 14, color: colors.primary }} />
                Le saviez-vous ?
              </h3>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ background: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, border: `1px solid ${colors.border}` }}>
                  <SkeletonLine width="60%" height={14} />
                  <div style={{ marginTop: 8 }}>
                    <SkeletonLine height={12} />
                    <div style={{ marginTop: 4 }}>
                      <SkeletonLine width="80%" height={12} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : facts && facts.length > 0 ? (
            <div>
              <h3 style={{ color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 600, margin: `0 0 ${spacing.md}px`, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa-solid fa-lightbulb" style={{ fontSize: 14, color: colors.primary }} />
                Le saviez-vous ?
              </h3>
              {facts.map((fact, i) => (
                <div key={i} style={{ background: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, border: `1px solid ${colors.border}` }}>
                  <div style={{ color: colors.primary, fontSize: typography.sm.fontSize, fontWeight: 600, marginBottom: 4 }}>
                    <i className="fa-solid fa-star" style={{ fontSize: 11, marginRight: 6 }} />
                    {fact.title}
                  </div>
                  <div style={{ color: colors.textSecondary, fontSize: typography.sm.fontSize, lineHeight: 1.6 }}>{fact.content}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* ── Sons similaires dans l'app ── */}
      {allSimilar.length > 0 && (
        <div style={{ marginBottom: spacing.lg }}>
          <h3 style={{ color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 600, margin: `0 0 ${spacing.sm}px`, padding: `0 ${spacing.lg}px` }}>
            <i className="fa-solid fa-music" style={{ marginRight: 6, color: colors.primary, fontSize: 13 }} />
            Sons similaires
          </h3>
          {allSimilar.map((s) => (
            <SoundCard key={s.id} sound={s} onPress={() => { player.playSound(s, [sound, ...allSimilar]); router.push(`/player/${s.id}`) }} />
          ))}
        </div>
      )}

      {/* ── Suggestions IA (external — Telegram bots) ── */}
      {enrichment?.similar_external && enrichment.similar_external.length > 0 && (
        <div style={{ padding: `0 ${spacing.lg}px`, marginBottom: spacing.xxl }}>
          <h3 style={{ color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 600, margin: `0 0 ${spacing.md}px`, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fa-solid fa-wand-magic-sparkles" style={{ fontSize: 13, color: colors.primary }} />
            Suggestions IA
          </h3>
          {enrichment.similar_external.map((ext, i) => (
            <div key={i} style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm }}>
              <div style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 600, marginBottom: 2 }}>{ext.title}</div>
              <div style={{ color: colors.textMuted, fontSize: typography.xs.fontSize, marginBottom: spacing.sm }}>{ext.artist}</div>
              <div style={{ display: 'flex', gap: spacing.sm }}>
                <a
                  href={`https://t.me/MusicsHuntersbot?start=${encodeURIComponent(ext.title + ' ' + ext.artist)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 10px', borderRadius: radius.md, background: `${colors.primary}22`, color: colors.primary, fontSize: typography.xs.fontSize, fontWeight: 600, textDecoration: 'none', border: `1px solid ${colors.primary}33` }}
                >
                  🤖 MusicsHuntersbot
                </a>
                <a
                  href={`https://t.me/DeezerMusicBot?start=${encodeURIComponent(ext.title + ' ' + ext.artist)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 10px', borderRadius: radius.md, background: colors.surfaceElevated, color: colors.textMuted, fontSize: typography.xs.fontSize, fontWeight: 600, textDecoration: 'none', border: `1px solid ${colors.border}` }}
                >
                  🎵 DeezerMusicBot
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      <ShareModal sound={sound} visible={shareOpen} onClose={() => setShareOpen(false)} />

      {/* Modale d'édition */}
      <BottomSheet visible={editOpen} onClose={() => setEditOpen(false)} title="Modifier le son">
        <div style={{ paddingBottom: spacing.lg }}>
          <FieldInput label="Titre *" value={editForm.title} onChange={(v) => setEditForm((f) => ({ ...f, title: v }))} />
          <FieldInput label="Artiste *" value={editForm.artist} onChange={(v) => setEditForm((f) => ({ ...f, artist: v }))} />
          <FieldInput label="Genre" value={editForm.genre} onChange={(v) => setEditForm((f) => ({ ...f, genre: v }))} />
          <FieldInput label="Année" value={editForm.year} onChange={(v) => setEditForm((f) => ({ ...f, year: v }))} />
          <FieldInput label="Producteur" value={editForm.producer} onChange={(v) => setEditForm((f) => ({ ...f, producer: v }))} />
          <FieldInput label="Pays" value={editForm.country} onChange={(v) => setEditForm((f) => ({ ...f, country: v }))} />
          <FieldInput label="Description" value={editForm.description} onChange={(v) => setEditForm((f) => ({ ...f, description: v }))} multiline />
          <FieldInput label="Lien YouTube (optionnel)" value={editForm.youtube_url} onChange={(v) => setEditForm((f) => ({ ...f, youtube_url: v }))} />
          <button onClick={handleSave} disabled={isSaving || !editForm.title.trim() || !editForm.artist.trim()} style={{ width: '100%', padding: `${spacing.md}px`, borderRadius: radius.lg, background: 'linear-gradient(135deg, #FF6A00, #D94F2A)', border: 'none', color: '#FFF', fontSize: typography.base.fontSize, fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1, marginBottom: spacing.md }}>
            {isSaving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: spacing.md }}>
            {!deleteConfirm ? (
              <button onClick={() => setDeleteConfirm(true)} style={{ width: '100%', padding: `${spacing.sm}px`, borderRadius: radius.lg, background: 'transparent', border: `1px solid ${colors.error}44`, color: colors.error, fontSize: typography.sm.fontSize, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <i className="fa-solid fa-trash" /> Supprimer ce son
              </button>
            ) : (
              <div>
                <p style={{ color: colors.error, fontSize: typography.sm.fontSize, textAlign: 'center', margin: `0 0 ${spacing.md}px` }}>Cette action est irréversible. Confirmer ?</p>
                <div style={{ display: 'flex', gap: spacing.sm }}>
                  <button onClick={() => setDeleteConfirm(false)} style={{ flex: 1, padding: spacing.sm, borderRadius: radius.md, background: colors.surface, border: `1px solid ${colors.border}`, color: colors.textMuted, cursor: 'pointer', fontSize: typography.sm.fontSize }}>Annuler</button>
                  <button onClick={handleDelete} disabled={isDeleting} style={{ flex: 1, padding: spacing.sm, borderRadius: radius.md, background: colors.error, border: 'none', color: '#FFF', cursor: isDeleting ? 'not-allowed' : 'pointer', fontSize: typography.sm.fontSize, fontWeight: 600, opacity: isDeleting ? 0.7 : 1 }}>
                    {isDeleting ? 'Suppression…' : 'Supprimer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
