'use client'
import { useEffect, useState } from 'react'
import { usePlaylists } from '@/hooks/usePlaylists'
import { CoverArt } from '@/components/ui/CoverArt'
import { colors, spacing, radius, typography } from '@/lib/theme'

interface Props {
  soundId: string
  soundTitle: string
  soundArtist: string
  visible: boolean
  onClose: () => void
  userId: string
}

export function AddToPlaylistModal({ soundId, soundTitle, soundArtist, visible, onClose, userId }: Props) {
  const { playlists, load, addSound, create } = usePlaylists(userId)
  const [creating, setCreating] = useState(false)
  const [added, setAdded] = useState<string | null>(null)

  useEffect(() => { if (visible) load() }, [visible, load])

  if (!visible) return null

  const handleAdd = async (playlistId: string, playlistTitle: string) => {
    await addSound(playlistId, soundId)
    setAdded(playlistTitle)
    setTimeout(() => { setAdded(null); onClose() }, 1200)
  }

  const handleCreateNew = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songs: [{ title: soundTitle, artist: soundArtist }] }),
      })
      const aiData = await res.json() as { title?: string; tags?: string[]; description?: string }
      const title = aiData.title ?? `Playlist — ${soundArtist}`
      const description = `${aiData.tags?.join(', ') ?? ''}${aiData.description ? ` — ${aiData.description}` : ''}`
      const playlist = await create(title, description)
      if (playlist) await handleAdd(playlist.id, title)
    } catch {
      const playlist = await create('Saved songs', 'Sauvegarde automatique')
      if (playlist) await handleAdd(playlist.id, 'Saved songs')
    }
    setCreating(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: colors.surfaceElevated, borderRadius: `${radius.xl}px ${radius.xl}px 0 0`, padding: spacing.lg, maxHeight: '70vh', overflowY: 'auto', borderTop: `1px solid ${colors.border}` }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: colors.border, margin: `0 auto ${spacing.lg}px` }} />
        <h3 style={{ color: colors.textPrimary, margin: `0 0 ${spacing.md}px`, fontSize: typography.base.fontSize, fontWeight: 700 }}>
          {added ? `Ajout\u00e9 \u00e0 "${added}"` : 'Ajouter \u00e0 une playlist'}
        </h3>
        {!added && <>
          {playlists.map(p => (
            <button key={p.id} onClick={() => handleAdd(p.id, p.title)}
              style={{ display: 'flex', alignItems: 'center', gap: spacing.md, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: `${spacing.sm}px 0`, borderBottom: `1px solid ${colors.border}` }}>
              <div style={{ width: 44, height: 44, borderRadius: radius.sm, overflow: 'hidden', flexShrink: 0 }}>
                <CoverArt title={p.title} artist={p.description ?? ''} size={44} />
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 500 }}>{p.title}</div>
                <div style={{ color: colors.textMuted, fontSize: typography.xs.fontSize }}>
                  {(p.playlist_sounds?.length ?? 0)} sons
                </div>
              </div>
              <i className="fa-solid fa-plus" style={{ color: colors.primary, fontSize: 14 }} />
            </button>
          ))}
          <button onClick={handleCreateNew}
            style={{ marginTop: spacing.md, width: '100%', padding: spacing.md, borderRadius: radius.md, background: `${colors.primary}22`, border: `1px solid ${colors.primary}33`, color: colors.primary, fontSize: typography.sm.fontSize, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
            <i className="fa-solid fa-wand-magic-sparkles" />
            {creating ? 'Cr\u00e9ation IA...' : '+ Nouvelle playlist IA'}
          </button>
        </>}
      </div>
    </div>
  )
}
