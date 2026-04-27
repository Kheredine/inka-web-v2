'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { usePlayerStore } from '@/stores/playerStore'
import { SoundCard } from '@/components/ui/Card'
import { CoverArt } from '@/components/ui/CoverArt'
import { Sound } from '@/types'
import { colors, spacing, radius, typography } from '@/lib/theme'

interface PlaylistWithSounds {
  id: string
  title: string
  description?: string
  created_by: string
  playlist_sounds?: Array<{ position: number; sound: Sound | null }>
}

export default function PlaylistPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { playSound } = usePlayerStore()
  const [playlist, setPlaylist] = useState<PlaylistWithSounds | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    const loadPlaylist = async () => {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('playlists')
        .select('*, playlist_sounds(position, sound:sounds(*, reactions(*), uploader:profiles!uploaded_by(*)))')
        .eq('id', params.id)
        .single()

      if (error || !data) {
        setIsError(true)
      } else {
        setPlaylist(data as PlaylistWithSounds)
      }
      setIsLoading(false)
    }

    loadPlaylist()
  }, [params.id])

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: colors.background }}>
        <span style={{ color: colors.textMuted, fontSize: typography.base.fontSize }}>Chargement…</span>
      </div>
    )
  }

  if (isError || !playlist) {
    return (
      <div style={{ padding: `${spacing.lg}px ${spacing.md}px`, minHeight: '100dvh', background: colors.background }}>
        <button onClick={() => router.back()} style={{ background: 'transparent', border: 'none', color: colors.primary, cursor: 'pointer', marginBottom: spacing.md }}>
          ← Retour
        </button>
        <p style={{ color: colors.textMuted, fontSize: typography.base.fontSize }}>Playlist introuvable.</p>
      </div>
    )
  }

  const sounds = (playlist.playlist_sounds ?? [])
    .sort((a, b) => a.position - b.position)
    .map((ps) => ps.sound)
    .filter(Boolean) as Sound[]

  return (
    <div style={{ background: colors.background, minHeight: '100dvh', maxWidth: 700, margin: '0 auto', paddingBottom: spacing.xl }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: `${spacing.md}px ${spacing.lg}px`, position: 'sticky', top: 0, background: colors.background, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textPrimary, fontSize: 20, padding: 4, display: 'flex', alignItems: 'center' }}>
          <i className="fa-solid fa-arrow-left" />
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: spacing.sm }}> 
          <button
            type="button"
            onClick={() => sounds.length && playSound(sounds[0], sounds)}
            disabled={sounds.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radius.md, background: sounds.length ? 'var(--accent)' : colors.surface, color: sounds.length ? '#fff' : colors.textMuted, border: 'none', cursor: sounds.length ? 'pointer' : 'not-allowed', fontSize: typography.sm.fontSize, fontFamily: 'inherit' }}
          >
            <i className="fa-solid fa-play" />
            Lire
          </button>
          <button
            type="button"
            onClick={() => router.push(`/feed?addTo=${playlist.id}`)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radius.md, background: 'transparent', color: colors.textSecondary, border: `0.5px solid ${colors.border}`, cursor: 'pointer', fontSize: typography.sm.fontSize, fontFamily: 'inherit' }}
          >
            <i className="fa-solid fa-circle-plus" />
            Ajouter des sons
          </button>
        </div>
      </div>

      <div style={{ padding: `0 ${spacing.lg}px` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
          <div style={{ width: 72, height: 72, borderRadius: radius.xl, overflow: 'hidden', background: colors.surface, flexShrink: 0 }}>
            <CoverArt title={playlist.title} artist={playlist.description ?? ''} size={72} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ color: colors.textPrimary, fontSize: typography.xl.fontSize, margin: 0, fontWeight: 700 }}>{playlist.title}</h1>
            {playlist.description && <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, margin: `${spacing.xs}px 0 0` }}>{playlist.description}</p>}
            <p style={{ color: colors.textSecondary, fontSize: typography.sm.fontSize, margin: `${spacing.xs}px 0 0` }}>{sounds.length} son{sounds.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {sounds.length === 0 ? (
          <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, padding: `${spacing.xl}px 0` }}>
            Cette playlist ne contient encore aucun son.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: spacing.md }}>
            {sounds.map((sound) => (
              <SoundCard key={sound.id} sound={sound} variant="grid" onPress={() => playSound(sound, sounds)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
