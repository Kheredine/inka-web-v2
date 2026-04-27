'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePlayer } from '@/hooks/usePlayer'
import { useAuthStore } from '@/stores/authStore'
import { CoverArt } from '@/components/ui/CoverArt'
import { supabase } from '@/lib/supabase'
import { colors, spacing, radius } from '@/lib/theme'

export function MiniPlayer() {
  const { currentSound, isPlaying, position, duration, togglePlay, skipToNext } = usePlayer()
  const pathname = usePathname()
  const profile = useAuthStore((s) => s.profile)

  const [liked, setLiked] = useState(false)
  const [likeAnimating, setLikeAnimating] = useState(false)

  // Sync like state whenever the track changes
  useEffect(() => {
    if (!currentSound || !profile) { setLiked(false); return }
    if (currentSound.reactions) {
      setLiked(currentSound.reactions.some((r: { user_id: string }) => r.user_id === profile.id))
      return
    }
    supabase
      .from('reactions')
      .select('id')
      .eq('sound_id', currentSound.id)
      .eq('user_id', profile.id)
      .limit(1)
      .then(({ data }) => setLiked((data?.length ?? 0) > 0))
  }, [currentSound?.id, profile?.id])

  const toggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!profile || !currentSound) return
    setLikeAnimating(true)
    setTimeout(() => setLikeAnimating(false), 300)
    if (liked) {
      setLiked(false)
      await supabase.from('reactions').delete().eq('sound_id', currentSound.id).eq('user_id', profile.id)
    } else {
      setLiked(true)
      await supabase.from('reactions').upsert({ sound_id: currentSound.id, user_id: profile.id })
    }
  }

  const authPaths = ['/login', '/register', '/reset-code']
  if (!currentSound || pathname === `/player/${currentSound.id}` || authPaths.some((p) => pathname.startsWith(p))) return null

  const progress = duration > 0 ? (position / duration) * 100 : 0

  return (
    <div style={{
      position: 'fixed',
      bottom: 64,
      left: 0,
      right: 0,
      background: colors.surfaceElevated,
      borderTop: `0.5px solid ${colors.border}`,
      zIndex: 40,
    }}>
      {/* Progress bar — always visible at top */}
      <div style={{ height: 2, background: 'rgba(255,255,255,0.06)' }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'var(--accent)',
          transition: 'width 0.5s linear',
        }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', padding: `${spacing.sm}px ${spacing.md}px`, gap: spacing.sm }}>
        {/* Cover + song info — tapping navigates to player */}
        <Link
          href={`/player/${currentSound.id}`}
          style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flex: 1, minWidth: 0, textDecoration: 'none' }}
        >
          <div style={{ width: 38, height: 38, borderRadius: radius.sm, overflow: 'hidden', flexShrink: 0 }}>
            <CoverArt title={currentSound.title} artist={currentSound.artist} genre={currentSound.genre} size={38} isPlaying={isPlaying} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentSound.title}
            </div>
            <div style={{ color: colors.textSecondary, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentSound.artist}
            </div>
          </div>
        </Link>

        {/* Like button */}
        <button
          onClick={toggleLike}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: liked ? '#E84393' : colors.textMuted,
            fontSize: 16, padding: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color var(--ease-default)',
          }}
        >
          <i className={`fa-${liked ? 'solid' : 'regular'} fa-heart ${likeAnimating ? 'like-animating' : ''}`} />
        </button>

        {/* Playback controls */}
        <button
          onClick={togglePlay}
          style={{
            background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer',
            color: colors.textPrimary, fontSize: 16, padding: 0,
            width: 36, height: 36, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background var(--ease-default)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.14)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)' }}
        >
          <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`} style={{ marginLeft: isPlaying ? 0 : 2, fontSize: 14 }} />
        </button>
        <button
          onClick={skipToNext}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: colors.textSecondary, fontSize: 16, padding: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <i className="fa-solid fa-forward-step" />
        </button>
      </div>
    </div>
  )
}

export function CoverPlaceholder({ title, size = 52 }: { title: string; size?: number }) {
  const letter = title?.[0]?.toUpperCase() ?? '♪'
  const hue = (title?.charCodeAt(0) ?? 0) % 360
  return (
    <div style={{
      width: size, height: size,
      background: `hsl(${hue}, 30%, 15%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700,
      color: `hsl(${hue}, 50%, 60%)`,
      flexShrink: 0,
    }}>
      {letter}
    </div>
  )
}
