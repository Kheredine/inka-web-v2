'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { colors, radius, spacing, typography } from '@/lib/theme'
import { Sound, Album, Playlist, ArtistReleaseCard } from '@/types'
import { formatDuration, formatTimeAgo } from '@/lib/utils'
import { CoverArt } from '@/components/ui/CoverArt'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useSavedSoundsStore } from '@/stores/savedSoundsStore'
import { CSSProperties } from 'react'

// ── Like button (shared logic) ──────────────────────────────────────────────────
function useLike(sound: Sound) {
  const profile = useAuthStore((s) => s.profile)
  const hasInitialLike = sound.reactions?.some((r: { user_id: string }) => r.user_id === profile?.id) ?? false
  const [liked, setLiked] = useState(hasInitialLike)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    setLiked(sound.reactions?.some((r: { user_id: string }) => r.user_id === profile?.id) ?? false)
  }, [sound.id, profile?.id])

  const toggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!profile) return
    setAnimating(true)
    setTimeout(() => setAnimating(false), 300)
    if (liked) {
      setLiked(false)
      await supabase.from('reactions').delete().eq('sound_id', sound.id).eq('user_id', profile.id)
    } else {
      setLiked(true)
      await supabase.from('reactions').upsert({ sound_id: sound.id, user_id: profile.id })
    }
  }, [liked, profile, sound.id])

  return { liked, animating, toggle }
}

// ── Save button (localStorage) ─────────────────────────────────────────────────
function useSave(sound: Sound) {
  const { isSaved, save, remove } = useSavedSoundsStore()
  const saved = isSaved(sound.id)
  const [animating, setAnimating] = useState(false)

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setAnimating(true)
    setTimeout(() => setAnimating(false), 300)
    if (saved) {
      remove(sound.id)
    } else {
      save({
        id: sound.id,
        title: sound.title,
        artist: sound.artist,
        genre: sound.genre,
        duration: sound.duration,
        savedAt: new Date().toISOString(),
      })
    }
  }, [saved, sound.id, sound.title, sound.artist, sound.genre, sound.duration, save, remove])

  return { saved, animating, toggle }
}

// ── ActionButton ───────────────────────────────────────────────────────────────
function ActionBtn({ onClick, children, active, activeColor }: {
  onClick: (e: React.MouseEvent) => void
  children: React.ReactNode
  active?: boolean
  activeColor?: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 28, height: 28, borderRadius: '50%',
        background: active ? `${activeColor ?? colors.primary}20` : 'rgba(255,255,255,0.06)',
        border: `0.5px solid rgba(255,255,255,0.1)`,
        color: active ? (activeColor ?? colors.primary) : colors.textSecondary,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, transition: 'all var(--ease-default)', flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

// ── SoundCard ──────────────────────────────────────────────────────────────────
interface SoundCardProps {
  sound: Sound
  onPress: () => void
  onShare?: () => void
  onAddToPlaylist?: () => void
  style?: CSSProperties
  variant?: 'list' | 'grid'
  playCount?: number
}

export function SoundCard({ sound, onPress, onShare, onAddToPlaylist, style, variant = 'list', playCount }: SoundCardProps) {
  const router = useRouter()
  const { liked, animating: likeAnim, toggle: toggleLike } = useLike(sound)
  const { saved, animating: saveAnim, toggle: toggleSave } = useSave(sound)
  const [hovered, setHovered] = useState(false)

  const goToDetail = (e: React.MouseEvent) => {
    // Only navigate if the click isn't on an interactive child
    const target = e.target as HTMLElement
    if (target.closest('button')) return
    router.push(`/player/${sound.id}`)
  }

  if (variant === 'grid') {
    return (
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={goToDetail}
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: colors.surface,
          border: `0.5px solid ${colors.border}`,
          borderRadius: radius.md,
          overflow: 'hidden',
          cursor: 'pointer',
          transform: hovered ? 'translateY(-2px) scale(1.01)' : 'translateY(0) scale(1)',
          boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
          transition: 'transform var(--ease-enter), box-shadow var(--ease-enter)',
          ...style,
        }}
      >
        {/* Artwork — clicking play button plays; clicking elsewhere → detail */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', overflow: 'hidden', flexShrink: 0 }}>
          <CoverArt title={sound.title} artist={sound.artist} genre={sound.genre} size={200} />

          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            opacity: hovered ? 1 : 0,
            transition: 'opacity var(--ease-enter)',
            pointerEvents: 'none',
          }} />

          {/* Play button — stops propagation so it plays without navigating */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: hovered ? 1 : 0,
            transition: 'opacity var(--ease-enter)',
          }}>
            <button
              onClick={(e) => { e.stopPropagation(); onPress() }}
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: '#fff', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                transform: hovered ? 'scale(1)' : 'scale(0.85)',
                transition: 'transform var(--ease-enter)',
              }}
            >
              <i className="fa-solid fa-play" style={{ color: '#0d0d0d', fontSize: 15, marginLeft: 2 }} />
            </button>
          </div>
        </div>

        {/* Card body */}
        <div style={{ padding: `${spacing.md}px`, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4 }}>
            <div style={{
              color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 500,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            }}>{sound.title}</div>
            <span style={{ color: colors.textMuted, fontSize: typography.xs.fontSize, flexShrink: 0 }}>
              {formatDuration(sound.duration)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, minWidth: 0 }}>
            <div style={{
              color: colors.textSecondary, fontSize: 12,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            }}>{sound.artist}</div>
            {sound.genre && (
              <span style={{
                fontSize: 9, fontWeight: 500, letterSpacing: '0.04em',
                color: 'var(--accent)', background: 'var(--accent-muted)',
                borderRadius: 4, padding: '1px 5px',
                whiteSpace: 'nowrap', flexShrink: 0, textTransform: 'uppercase',
              }}>{sound.genre}</span>
            )}
          </div>

          <div style={{ height: 3, borderRadius: 2, marginTop: 10, background: `linear-gradient(90deg, var(--accent), rgba(232,144,42,0.15))` }} />

          {playCount !== undefined && playCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
              <i className="fa-solid fa-headphones" style={{ fontSize: 9, color: colors.textMuted }} />
              <span style={{ color: colors.textMuted, fontSize: 10 }}>{playCount.toLocaleString()} écoutes</span>
            </div>
          )}

          {/* Action row — like + save + playlist + share */}
          <div style={{
            display: 'flex', gap: 6, marginTop: 10,
            opacity: hovered ? 1 : 0,
            maxHeight: hovered ? 30 : 0,
            overflow: 'hidden',
            transition: 'opacity var(--ease-enter), max-height var(--ease-enter)',
            pointerEvents: hovered ? 'auto' : 'none',
          }}>
            <ActionBtn onClick={toggleLike} active={liked} activeColor="#E84393">
              <i className={`fa-${liked ? 'solid' : 'regular'} fa-heart ${likeAnim ? 'like-animating' : ''}`} />
            </ActionBtn>
            <ActionBtn onClick={toggleSave} active={saved} activeColor="var(--accent)">
              <i className={`fa-${saved ? 'solid' : 'regular'} fa-bookmark ${saveAnim ? 'like-animating' : ''}`} />
            </ActionBtn>
            {onAddToPlaylist && (
              <ActionBtn onClick={(e) => { e.stopPropagation(); onAddToPlaylist() }}>
                <i className="fa-solid fa-plus" />
              </ActionBtn>
            )}
            {onShare && (
              <ActionBtn onClick={(e) => { e.stopPropagation(); onShare() }}>
                <i className="fa-solid fa-arrow-up-right-from-square" />
              </ActionBtn>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── List variant — card body navigates to detail, play button plays ────────────
  return (
    <div
      onClick={goToDetail}
      className="inka-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md,
        padding: `${spacing.sm + 4}px ${spacing.lg}px`,
        width: '100%',
        background: colors.surface,
        border: `0.5px solid ${colors.border}`,
        borderRadius: radius.md,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'transform var(--ease-enter), box-shadow var(--ease-enter)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        ...style,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(-1px)'
        el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(0)'
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
      }}
    >
      {/* Cover + play button overlay */}
      <div style={{ position: 'relative', width: 48, height: 48, borderRadius: radius.sm, overflow: 'hidden', flexShrink: 0 }}>
        <CoverArt title={sound.title} artist={sound.artist} genre={sound.genre} size={48} />
        <button
          onClick={(e) => { e.stopPropagation(); onPress() }}
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            border: 'none', cursor: 'pointer',
            opacity: 0,
            transition: 'opacity var(--ease-enter)',
          }}
          onMouseEnter={(e) => { e.stopPropagation(); (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
          onMouseLeave={(e) => { e.stopPropagation(); (e.currentTarget as HTMLButtonElement).style.opacity = '0' }}
        >
          <i className="fa-solid fa-play" style={{ color: '#fff', fontSize: 12, marginLeft: 2 }} />
        </button>
      </div>

      {/* Title + artist */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sound.title}</div>
        <div style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sound.artist}</div>
      </div>

      {/* Right side: like + save + duration */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexShrink: 0 }}>
        <ActionBtn onClick={toggleLike} active={liked} activeColor="#E84393">
          <i className={`fa-${liked ? 'solid' : 'regular'} fa-heart`} />
        </ActionBtn>
        <ActionBtn onClick={toggleSave} active={saved} activeColor="var(--accent)">
          <i className={`fa-${saved ? 'solid' : 'regular'} fa-bookmark`} />
        </ActionBtn>
        <span style={{ color: colors.textMuted, fontSize: typography.xs.fontSize }}>{formatDuration(sound.duration)}</span>
      </div>
    </div>
  )
}

// ── TrendingCard ───────────────────────────────────────────────────────────────
export interface TrendingTrack {
  rank: number
  title: string
  artist: string
  listeners: string | null
  image: string | null
  url: string | null
}

export function TrendingCard({ track, onPress, style }: { track: TrendingTrack; onPress: () => void; style?: CSSProperties }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onPress}
      style={{
        display: 'flex', flexDirection: 'column',
        background: colors.surface, border: `0.5px solid ${colors.border}`,
        borderRadius: radius.md, overflow: 'hidden', cursor: 'pointer',
        transform: hovered ? 'translateY(-2px) scale(1.01)' : 'translateY(0) scale(1)',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        transition: 'transform var(--ease-enter), box-shadow var(--ease-enter)',
        ...style,
      }}
    >
      {/* Artwork */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1', overflow: 'hidden', flexShrink: 0 }}>
        {track.image
          ? <img src={track.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <CoverArt title={track.title} artist={track.artist} size={200} />
        }
        {/* Hover overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', opacity: hovered ? 1 : 0, transition: 'opacity var(--ease-enter)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: hovered ? 1 : 0, transition: 'opacity var(--ease-enter)' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
            <i className="fa-solid fa-arrow-right" style={{ color: '#0d0d0d', fontSize: 14 }} />
          </div>
        </div>
        {/* Rank badge */}
        <div style={{ position: 'absolute', top: 6, left: 6, minWidth: 22, height: 22, borderRadius: radius.sm, background: track.rank <= 3 ? 'var(--accent)' : 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
          <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>#{track.rank}</span>
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: `${spacing.md}px`, width: '100%', boxSizing: 'border-box' }}>
        <div style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
        <div style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artist}</div>
        {track.listeners && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
            <i className="fa-solid fa-headphones" style={{ fontSize: 9, color: colors.textMuted }} />
            <span style={{ color: colors.textMuted, fontSize: 10 }}>{track.listeners}</span>
          </div>
        )}
        <div style={{ height: 3, borderRadius: 2, marginTop: 10, background: 'linear-gradient(90deg, var(--accent), rgba(232,144,42,0.15))' }} />
      </div>
    </div>
  )
}

// ── SoundGrid ──────────────────────────────────────────────────────────────────
export function SoundGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
      gap: spacing.md,
      padding: `${spacing.sm}px ${spacing.lg}px`,
    }}>
      {children}
    </div>
  )
}

// ── HScrollRow — horizontal scroll with fade-out edge ─────────────────────────
export function HScrollRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <div
        className="scroll-x"
        style={{ display: 'flex', gap: spacing.md, padding: `${spacing.xs}px ${spacing.lg}px`, alignItems: 'flex-start' }}
      >
        {children}
        {/* Spacer so last card isn't flush against edge */}
        <div style={{ flexShrink: 0, width: spacing.lg }} />
      </div>
      {/* Right fade */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 56,
        background: `linear-gradient(to left, #0d0d0d, transparent)`,
        pointerEvents: 'none',
      }} />
    </div>
  )
}

// ── ArtistCard — external recent-releases section ─────────────────────────────

function artistGradient(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  const hue = hash % 360
  const hue2 = (hue + 45) % 360
  return `linear-gradient(135deg, hsl(${hue},65%,28%) 0%, hsl(${hue2},70%,18%) 100%)`
}

export function ArtistCard({
  card,
  onPress,
  style,
}: {
  card: ArtistReleaseCard
  onPress: () => void
  style?: CSSProperties
}) {
  const [hovered, setHovered] = useState(false)
  const [imgError, setImgError] = useState(false)
  const typeLabel =
    card.latestRelease.type === 'album'
      ? 'Album'
      : card.latestRelease.type === 'ep'
      ? 'EP'
      : 'Single'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onPress}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: colors.surface,
        border: `0.5px solid ${colors.border}`,
        borderRadius: radius.md,
        overflow: 'hidden',
        cursor: 'pointer',
        transform: hovered ? 'translateY(-2px) scale(1.01)' : 'translateY(0) scale(1)',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        transition: 'transform var(--ease-enter), box-shadow var(--ease-enter)',
        ...style,
      }}
    >
      {/* Artist image */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1', overflow: 'hidden', flexShrink: 0 }}>
        {imgError || !card.artistImage ? (
          <div style={{ width: '100%', height: '100%', background: artistGradient(card.artistName), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', userSelect: 'none' }}>
              {card.artistName.charAt(0).toUpperCase()}
            </span>
          </div>
        ) : (
          <img
            src={card.artistImage}
            alt={card.artistName}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', opacity: hovered ? 1 : 0, transition: 'opacity var(--ease-enter)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: hovered ? 1 : 0, transition: 'opacity var(--ease-enter)' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
            <i className="fa-solid fa-arrow-right" style={{ color: '#0d0d0d', fontSize: 14 }} />
          </div>
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: `${spacing.md}px`, width: '100%', boxSizing: 'border-box' }}>
        <div style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {card.artistName}
        </div>
        <div style={{ color: colors.textMuted, fontSize: 11, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {typeLabel} · {formatTimeAgo(card.latestRelease.releaseDate)}
        </div>
        <div style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
          {card.latestRelease.title}
        </div>
        <div style={{ height: 3, borderRadius: 2, marginTop: 8, background: 'linear-gradient(90deg, var(--accent), rgba(232,144,42,0.15))' }} />
      </div>
    </div>
  )
}

// ── AlbumCard ──────────────────────────────────────────────────────────────────
interface AlbumCardProps { album: Album; onPress: () => void; style?: CSSProperties }

export function AlbumCard({ album, onPress, style }: AlbumCardProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onPress}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform var(--ease-enter)',
        ...style,
      }}
    >
      <div style={{ width: '100%', aspectRatio: '1', borderRadius: radius.md, overflow: 'hidden', marginBottom: spacing.sm }}>
        <CoverArt title={album.title} artist={album.artist_name} size={200} />
      </div>
      <div style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{album.title}</div>
      <div style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{album.artist_name}</div>
    </button>
  )
}

// ── PlaylistCard ───────────────────────────────────────────────────────────────
interface PlaylistCardProps { playlist: Playlist; onPress: () => void; style?: CSSProperties }

export function PlaylistCard({ playlist, onPress, style }: PlaylistCardProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onPress}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform var(--ease-enter)',
        ...style,
      }}
    >
      <div style={{ width: '100%', aspectRatio: '1', borderRadius: radius.md, overflow: 'hidden', marginBottom: spacing.sm }}>
        <CoverArt title={playlist.title} artist={playlist.creator?.display_name ?? 'Playlist'} size={200} />
      </div>
      <div style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{playlist.title}</div>
      <div style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{playlist.sound_count ?? 0} sons</div>
    </button>
  )
}
