'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SoundCard } from '@/components/ui/Card'
import { Sound } from '@/types'
import { colors, spacing, radius, typography } from '@/lib/theme'
import type { Fact } from '@/app/api/facts/route'

// ── Sub-components (mirrors player page) ───────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: `${spacing.sm}px 0`, borderBottom: `1px solid ${colors.border}` }}>
      <span style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, flexShrink: 0, marginRight: spacing.md }}>{label}</span>
      <span style={{ color: colors.textSecondary, fontSize: typography.sm.fontSize, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function TagPill({ tag }: { tag: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      background: colors.surfaceElevated, color: colors.textSecondary,
      fontSize: typography.xs.fontSize, border: `1px solid ${colors.border}`,
    }}>
      {tag}
    </span>
  )
}

function SkeletonLine({ width = '100%', height = 14 }: { width?: string | number; height?: number }) {
  return <div style={{ width, height, borderRadius: 6, background: colors.surface, marginBottom: 4 }} />
}

// ── Main ───────────────────────────────────────────────────────────────────────

interface TrackInfo {
  listeners: string | null
  playcount: string | null
  release_date: string | null
  album: string | null
  tags: string[]
  wiki: string | null
  duration: string | null
}

interface EnrichData {
  similar_external?: Array<{ title: string; artist: string }>
}

function TrendingDetailContent() {
  const router = useRouter()
  const params = useSearchParams()

  const title    = params.get('title')    ?? ''
  const artist   = params.get('artist')   ?? ''
  const listeners = params.get('listeners')
  const image    = params.get('image')
  const lfmUrl   = params.get('url')

  const [videoId, setVideoId]         = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(true)
  const [trackInfo, setTrackInfo]     = useState<TrackInfo | null>(null)
  const [infoLoading, setInfoLoading] = useState(true)
  const [facts, setFacts]             = useState<Fact[] | null>(null)
  const [factsLoading, setFactsLoading] = useState(true)
  const [similar, setSimilar]         = useState<Sound[]>([])
  const [enrichData, setEnrichData]   = useState<EnrichData | null>(null)

  useEffect(() => {
    if (!title || !artist) return

    // YouTube search
    setVideoLoading(true)
    fetch(`/api/youtube-search?q=${encodeURIComponent(`${artist} - ${title} official`)}`)
      .then((r) => r.json())
      .then((d) => setVideoId(d.videoId ?? null))
      .catch(() => setVideoId(null))
      .finally(() => setVideoLoading(false))

    // Last.fm track info
    fetch(`/api/track-info?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`)
      .then((r) => r.json())
      .then((d) => setTrackInfo({ listeners: d.listeners ?? null, playcount: d.playcount ?? null, tags: d.tags ?? [], wiki: d.wiki ?? null, duration: d.duration ?? null }))
      .catch(() => setTrackInfo(null))
      .finally(() => setInfoLoading(false))

    // Facts
    setFactsLoading(true)
    fetch('/api/facts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, artist }),
    })
      .then((r) => r.json())
      .then((d) => setFacts(Array.isArray(d.facts) ? d.facts : null))
      .catch(() => setFacts(null))
      .finally(() => setFactsLoading(false))

    // AI enrichment for external suggestions
    fetch('/api/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, artist }),
    })
      .then((r) => r.json())
      .then((d: EnrichData) => {
        setEnrichData(d)
        // Find similar in-app songs by genre tags
        if (d.similar_external?.length) {
          const query = d.similar_external.map((s) => s.artist).join(',').slice(0, 60)
          supabase
            .from('sounds')
            .select('*, reactions(*)')
            .eq('is_public', true)
            .ilike('artist', `%${query.split(',')[0]}%`)
            .limit(6)
            .then(({ data }) => setSimilar((data as Sound[]) ?? []))
        }
      })
      .catch(() => undefined)
  }, [title, artist])

  if (!title || !artist) {
    return (
      <div style={{ minHeight: '100dvh', background: colors.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: colors.textMuted }}>Aucune chanson sélectionnée.</p>
      </div>
    )
  }

  const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${artist} ${title}`)}`

  return (
    <div style={{ background: colors.background, minHeight: '100dvh', maxWidth: 600, margin: '0 auto', position: 'relative', zIndex: 1, paddingBottom: 100 }}>

      {/* ── Header (mirrors player page) ── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: `${spacing.md}px ${spacing.lg}px`, position: 'sticky', top: 0, background: colors.background, zIndex: 10 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textPrimary, fontSize: 20, padding: 4, display: 'flex', alignItems: 'center' }}
        >
          <i className="fa-solid fa-arrow-left" />
        </button>
        <span style={{ flex: 1, color: colors.textMuted, fontSize: typography.sm.fontSize, textAlign: 'center' }}>
          Tendances mondiales
        </span>
        {lfmUrl && (
          <a
            href={lfmUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: colors.textMuted, fontSize: 18, padding: 4, display: 'flex', alignItems: 'center', textDecoration: 'none' }}
          >
            <i className="fa-solid fa-arrow-up-right-from-square" />
          </a>
        )}
      </div>

      {/* ── YouTube player (same padding as cover art) ── */}
      <div style={{ padding: `0 ${spacing.xl}px ${spacing.lg}px` }}>
        {videoLoading ? (
          <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: radius.xl, background: colors.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ color: colors.textMuted, fontSize: 24 }} />
          </div>
        ) : videoId ? (
          <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: radius.xl, overflow: 'hidden', background: '#000', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&color=white`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          </div>
        ) : (
          <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: radius.xl, background: colors.surface, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: spacing.md, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            {image && <img src={image} alt="" loading="lazy" decoding="async" style={{ width: 72, height: 72, borderRadius: radius.lg, objectFit: 'cover', opacity: 0.5 }} />}
            <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, margin: 0 }}>Vidéo non disponible</p>
            <a
              href={youtubeSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: `${spacing.sm}px ${spacing.lg}px`, borderRadius: radius.md, background: '#FF0000', color: '#fff', fontSize: typography.sm.fontSize, fontWeight: 600, textDecoration: 'none' }}
            >
              <i className="fa-brands fa-youtube" />
              Rechercher sur YouTube
            </a>
          </div>
        )}
      </div>

      {/* ── Titre + artiste ── */}
      <div style={{ padding: `0 ${spacing.xl}px`, marginBottom: spacing.md }}>
        <h2 style={{ color: colors.textPrimary, fontSize: typography.lg.fontSize, fontWeight: 700, margin: 0 }}>{title}</h2>
        <p style={{ color: colors.textSecondary, fontSize: typography.base.fontSize, margin: `${spacing.xs}px 0 0` }}>{artist}</p>
        {infoLoading && (
          <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, margin: `${spacing.xs}px 0 0` }}>
            <i className="fa-solid fa-globe" style={{ fontSize: 11, color: colors.primary, marginRight: 5 }} />
            Tendances mondiales
          </p>
        )}
      </div>

      {/* ── Tags (mirrors themes section) ── */}
      {infoLoading ? (
        <div style={{ padding: `0 ${spacing.xl}px`, marginBottom: spacing.md, display: 'flex', gap: 6 }}>
          <SkeletonLine width={80} height={22} />
          <SkeletonLine width={64} height={22} />
          <SkeletonLine width={96} height={22} />
        </div>
      ) : trackInfo?.tags?.length ? (
        <div style={{ padding: `0 ${spacing.xl}px`, marginBottom: spacing.md }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
            {trackInfo.tags.map((tag) => <TagPill key={tag} tag={tag} />)}
          </div>
        </div>
      ) : null}

      {/* ── Open on YouTube button ── */}
      <div style={{ padding: `0 ${spacing.xl}px`, marginBottom: spacing.lg }}>
        <a
          href={videoId ? `https://www.youtube.com/watch?v=${videoId}` : youtubeSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: `${spacing.md}px`, borderRadius: radius.lg, background: '#FF0000', color: '#fff', fontSize: typography.base.fontSize, fontWeight: 600, textDecoration: 'none', boxSizing: 'border-box' }}
        >
          <i className="fa-brands fa-youtube" />
          {videoId ? 'Ouvrir sur YouTube' : 'Rechercher sur YouTube'}
        </a>
      </div>

      {/* ── Informations ── */}
      <div style={{ padding: `0 ${spacing.lg}px`, marginBottom: spacing.lg }}>
        <h3 style={{ color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 600, margin: `0 0 ${spacing.sm}px` }}>Informations</h3>
        <div style={{ background: colors.surface, borderRadius: radius.lg, padding: `0 ${spacing.md}px`, border: `1px solid ${colors.border}` }}>
          <InfoRow label="Artiste" value={artist} />
          {infoLoading ? (
            <div style={{ padding: `${spacing.sm}px 0` }}><SkeletonLine width="60%" height={14} /></div>
          ) : (
            <>
              {trackInfo?.album && <InfoRow label="Album" value={trackInfo.album} />}
              <InfoRow label="Sortie" value={trackInfo?.release_date ?? '—'} />
              {trackInfo?.duration && <InfoRow label="Durée" value={trackInfo.duration} />}
              <InfoRow label="Auditeurs / mois" value={trackInfo?.listeners ?? listeners ?? '—'} />
              <InfoRow label="Écoutes totales" value={trackInfo?.playcount ?? '—'} />
            </>
          )}
          <InfoRow label="Source" value="Tendances mondiales" />
        </div>
      </div>

      {/* ── Description / Wiki ── */}
      {!infoLoading && trackInfo?.wiki && (
        <div style={{ padding: `0 ${spacing.lg}px`, marginBottom: spacing.lg }}>
          <h3 style={{ color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 600, margin: `0 0 ${spacing.sm}px` }}>Description</h3>
          <p style={{ color: colors.textSecondary, fontSize: typography.sm.fontSize, lineHeight: 1.7, margin: 0, background: colors.surface, padding: spacing.md, borderRadius: radius.lg, border: `1px solid ${colors.border}` }}>
            {trackInfo.wiki}
          </p>
        </div>
      )}

      {/* ── Le saviez-vous ── */}
      <div style={{ padding: `0 ${spacing.lg}px`, marginBottom: spacing.lg }}>
        {factsLoading ? (
          <div>
            <h3 style={{ color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 600, margin: `0 0 ${spacing.md}px`, display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fa-solid fa-lightbulb" style={{ fontSize: 14, color: colors.primary }} />
              Le saviez-vous ?
            </h3>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ background: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, border: `1px solid ${colors.border}` }}>
                <SkeletonLine width="60%" height={14} />
                <SkeletonLine height={12} />
                <SkeletonLine width="80%" height={12} />
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

      {/* ── Sons similaires dans l'app ── */}
      {similar.length > 0 && (
        <div style={{ marginBottom: spacing.lg }}>
          <h3 style={{ color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 600, margin: `0 0 ${spacing.sm}px`, padding: `0 ${spacing.lg}px` }}>
            <i className="fa-solid fa-music" style={{ marginRight: 6, color: colors.primary, fontSize: 13 }} />
            Sons similaires dans l'app
          </h3>
          {similar.map((s) => (
            <SoundCard
              key={s.id}
              sound={s}
              onPress={() => router.push(`/player/${s.id}`)}
            />
          ))}
        </div>
      )}

      {/* ── Suggestions IA ── */}
      {enrichData?.similar_external && enrichData.similar_external.length > 0 && (
        <div style={{ padding: `0 ${spacing.lg}px`, marginBottom: spacing.xxl }}>
          <h3 style={{ color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 600, margin: `0 0 ${spacing.md}px`, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fa-solid fa-wand-magic-sparkles" style={{ fontSize: 13, color: colors.primary }} />
            Suggestions IA
          </h3>
          {enrichData.similar_external.map((ext, i) => (
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

    </div>
  )
}

export default function TrendingDetailPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', background: colors.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ color: colors.textMuted, fontSize: 24 }} />
      </div>
    }>
      <TrendingDetailContent />
    </Suspense>
  )
}
