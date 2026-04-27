'use client'
import { MouseEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { colors, radius, spacing, typography } from '@/lib/theme'
import { Sound } from '@/types'
import { formatDuration, formatTimeAgo } from '@/lib/utils'
import { ShareModal } from './ShareModal'
import { CoverArt } from '@/components/ui/CoverArt'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { usePlayerStore } from '@/stores/playerStore'
import { useFeedStore } from '@/stores/feedStore'
import { useAuthStore } from '@/stores/authStore'
import { AddToPlaylistModal } from '@/components/playlist/AddToPlaylistModal'
import { supabase } from '@/lib/supabase'

interface FeedItemProps {
  sound: Sound
  targetPlaylistId?: string | null
}

export function FeedItem({ sound, targetPlaylistId }: FeedItemProps) {
  const router = useRouter()
  const { playSound, currentSound, isPlaying } = usePlayerStore()
  const { sounds } = useFeedStore()
  const profile = useAuthStore(s => s.profile)

  const [shareOpen, setShareOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedPlaylist, setSavedPlaylist] = useState<string | null>(null)
  const [addingToPlaylist, setAddingToPlaylist] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [liked, setLiked] = useState(
    sound.reactions?.some((r: { user_id: string }) => r.user_id === profile?.id) ?? false
  )
  const [likeAnimating, setLikeAnimating] = useState(false)

  const isActive = currentSound?.id === sound.id
  const uploaderName = sound.uploader?.display_name ?? 'Membre'
  const uploaderUsername = sound.uploader?.username ?? uploaderName

  const handlePlay = (e: MouseEvent) => {
    e.stopPropagation()
    playSound(sound, sounds)
  }

  const toggleLike = async (e: MouseEvent) => {
    e.stopPropagation()
    if (!profile) return
    setLikeAnimating(true)
    setTimeout(() => setLikeAnimating(false), 300)
    if (liked) {
      setLiked(false)
      await supabase.from('reactions').delete().eq('sound_id', sound.id).eq('user_id', profile.id)
    } else {
      setLiked(true)
      await supabase.from('reactions').upsert({ sound_id: sound.id, user_id: profile.id })
    }
  }

  const handleAddToPlaylist = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (!profile) return
    if (!targetPlaylistId) { setSaveOpen(true); return }
    setAddingToPlaylist(true)
    try {
      const { data: existing } = await supabase
        .from('playlist_sounds').select('position')
        .eq('playlist_id', targetPlaylistId).order('position', { ascending: false }).limit(1)
      const position = (((existing?.[0] as { position?: number })?.position) ?? 0) + 1
      const { error } = await supabase.from('playlist_sounds').upsert(
        { playlist_id: targetPlaylistId, sound_id: sound.id, position },
        { onConflict: 'playlist_id,sound_id' }
      )
      if (!error) { setSavedPlaylist('la playlist'); setTimeout(() => setSavedPlaylist(null), 1800) }
    } catch (err) {
      console.error('Ajout à la playlist échoué', err)
    } finally {
      setAddingToPlaylist(false)
    }
  }

  const handleAutoSave = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (!profile || saving) return
    setSaving(true)
    try {
      const { data: existing } = await supabase
        .from('playlists').select('id,title')
        .eq('created_by', profile.id).ilike('description', '%##inka_auto_save##%').limit(1).maybeSingle()

      let playlist = existing as { id: string; title: string } | null
      if (!playlist) {
        const res = await fetch('/api/playlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ songs: [{ title: sound.title, artist: sound.artist, genre: sound.genre }] }) })
        const aiData = await res.json() as { title?: string; tags?: string[]; description?: string }
        const title = aiData.title?.trim() || 'Mes sauvegardes'
        const description = `${aiData.tags?.join(', ') ?? ''}${aiData.description ? ` — ${aiData.description}` : ''}##inka_auto_save##`
        const { data } = await supabase.from('playlists').insert({ title, description, created_by: profile.id, is_public: false }).select().single()
        playlist = data as { id: string; title: string }
      }
      if (!playlist) return
      const { data: lastPos } = await supabase.from('playlist_sounds').select('position').eq('playlist_id', playlist.id).order('position', { ascending: false }).limit(1)
      const position = (((lastPos?.[0] as { position?: number })?.position) ?? 0) + 1
      await supabase.from('playlist_sounds').upsert({ playlist_id: playlist.id, sound_id: sound.id, position })
      setSavedPlaylist(playlist.title)
      setTimeout(() => setSavedPlaylist(null), 1800)
    } catch (err) {
      console.error('Auto-save failed', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <article
      className="feed-item"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: colors.surface,
        border: `0.5px solid ${isActive ? 'var(--accent)' : colors.border}`,
        borderRadius: radius.md,
        overflow: 'hidden',
        cursor: 'pointer',
        transform: hovered ? 'translateY(-2px) scale(1.01)' : 'translateY(0) scale(1)',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        transition: 'transform var(--ease-enter), box-shadow var(--ease-enter), border-color var(--ease-default)',
      }}
    >
      {/* Artwork with hover overlay */}
      <div
        onClick={handlePlay}
        style={{ position: 'relative', width: '100%', aspectRatio: '1', overflow: 'hidden', flexShrink: 0 }}
      >
        <CoverArt title={sound.title} artist={sound.artist} genre={sound.genre} size={200} isPlaying={isActive && isPlaying} />

        {/* Dark overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          opacity: hovered ? 1 : 0,
          transition: 'opacity var(--ease-enter)',
          pointerEvents: 'none',
        }} />

        {/* Play button */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hovered ? 1 : 0,
          transition: 'opacity var(--ease-enter)',
        }}>
          <button
            onClick={(e) => { e.stopPropagation(); handlePlay(e) }}
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

        {/* Active playing indicator */}
        {isActive && (
          <div style={{
            position: 'absolute', bottom: 8, right: 8,
            background: 'var(--accent)', borderRadius: radius.full,
            padding: '3px 8px', fontSize: 9, color: '#fff', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <i className="fa-solid fa-waveform-lines" style={{ fontSize: 9 }} />
            En cours
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: spacing.md, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Row 1: title + duration */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4 }}>
          <div
            onClick={() => router.push(`/player/${sound.id}`)}
            style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, cursor: 'pointer' }}
          >
            {sound.title}
          </div>
          <span style={{ color: colors.textMuted, fontSize: typography.xs.fontSize, flexShrink: 0 }}>
            {formatDuration(sound.duration)}
          </span>
        </div>

        {/* Row 2: artist */}
        <div style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sound.artist}
        </div>

        {/* Row 3: waveform strip */}
        <div style={{
          height: 3, borderRadius: 2, marginTop: 10,
          background: isActive
            ? `linear-gradient(90deg, var(--accent), rgba(232,144,42,0.5))`
            : `linear-gradient(90deg, var(--accent), rgba(232,144,42,0.15))`,
        }} />

        {/* Uploader attribution — always visible, compact */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm }}>
          <Link
            href={`/profile/${sound.uploaded_by}`}
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}
          >
            <UserAvatar username={uploaderUsername} displayName={uploaderName} size={16} />
            <span style={{ color: colors.textMuted, fontSize: 11 }}>{uploaderName}</span>
          </Link>
          <span style={{ color: colors.textMuted, fontSize: 11, marginLeft: 'auto' }}>
            {formatTimeAgo(sound.created_at)}
          </span>
        </div>

        {/* Action row — on hover */}
        <div style={{
          display: 'flex', gap: 6, marginTop: 10,
          opacity: hovered ? 1 : 0,
          maxHeight: hovered ? 30 : 0,
          overflow: 'hidden',
          transition: 'opacity var(--ease-enter), max-height var(--ease-enter)',
          pointerEvents: hovered ? 'auto' : 'none',
        }}>
          {/* Like */}
          <ActionBtn onClick={toggleLike} active={liked} activeColor="#E84393">
            <i className={`fa-${liked ? 'solid' : 'regular'} fa-heart ${likeAnimating ? 'like-animating' : ''}`} />
          </ActionBtn>
          {/* Save to playlist */}
          <ActionBtn onClick={handleAutoSave} active={!!savedPlaylist}>
            <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-bookmark'}`} />
          </ActionBtn>
          {/* Add to specific playlist */}
          <ActionBtn onClick={handleAddToPlaylist}>
            <i className={`fa-solid ${addingToPlaylist ? 'fa-spinner fa-spin' : 'fa-plus'}`} />
          </ActionBtn>
          {/* Share */}
          <ActionBtn onClick={(e) => { e.stopPropagation(); setShareOpen(true) }}>
            <i className="fa-solid fa-arrow-up-right-from-square" />
          </ActionBtn>
          {/* Detail */}
          <ActionBtn onClick={(e) => { e.stopPropagation(); router.push(`/player/${sound.id}`) }}>
            <i className="fa-solid fa-ellipsis" />
          </ActionBtn>
        </div>

        {savedPlaylist && (
          <div style={{ marginTop: spacing.xs, color: colors.success, fontSize: 11 }}>
            ✓ Ajouté à «{savedPlaylist}»
          </div>
        )}
      </div>

      <ShareModal sound={sound} visible={shareOpen} onClose={() => setShareOpen(false)} />
      {profile && (
        <AddToPlaylistModal
          soundId={sound.id}
          soundTitle={sound.title}
          soundArtist={sound.artist}
          visible={saveOpen}
          onClose={() => setSaveOpen(false)}
          userId={profile.id}
        />
      )}
    </article>
  )
}

function ActionBtn({ onClick, children, active, activeColor }: {
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
  children: React.ReactNode
  active?: boolean
  activeColor?: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 28, height: 28, borderRadius: '50%',
        background: active ? `${activeColor ?? 'var(--accent)'}20` : 'rgba(255,255,255,0.06)',
        border: `0.5px solid rgba(255,255,255,0.1)`,
        color: active ? (activeColor ?? 'var(--accent)') : colors.textSecondary,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, transition: 'all var(--ease-default)', flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}
