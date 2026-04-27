'use client'
import { useState } from 'react'
import { colors, radius, spacing, typography } from '@/lib/theme'
import { Share } from '@/types'
import { formatTimeAgo } from '@/lib/utils'
import { CoverArt } from '@/components/ui/CoverArt'

interface InboxCardProps {
  share: Share
  onPress: () => void
  onSave?: () => Promise<void>
}

export function InboxCard({ share, onPress, onSave }: InboxCardProps) {
  const sound = share.sound
  const playlist = share.playlist
  const sender = share.sender
  const [isSaved, setIsSaved] = useState(false)

  const handleSave = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (!onSave) return
    try {
      await onSave()
      setIsSaved(true)
    } catch (err) {
      console.error('Save failed', err)
    }
  }

  const title = playlist ? playlist.title : sound?.title ?? 'Inconnu'
  const artist = playlist
    ? (playlist.creator?.display_name ?? 'Playlist')
    : (sound?.artist ?? '')
  const genre = sound?.genre

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPress}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPress() }
      }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: spacing.md,
        padding: `${spacing.md}px ${spacing.lg}px`,
        width: '100%',
        background: share.is_read ? 'transparent' : 'rgba(232,144,42,0.04)',
        border: 'none',
        borderBottom: `0.5px solid ${colors.border}`,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background var(--ease-default)',
      }}
    >
      <div style={{ width: 48, height: 48, borderRadius: radius.md, overflow: 'hidden', flexShrink: 0 }}>
        <CoverArt title={title} artist={artist} genre={genre} size={48} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginBottom: 2 }}>
          {!share.is_read && (
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
          )}
          <span style={{ color: colors.textSecondary, fontSize: typography.xs.fontSize, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <strong style={{ color: colors.textPrimary, fontWeight: 500 }}>{sender?.display_name ?? 'Quelqu\'un'}</strong> t'a partagé
          </span>
        </div>
        <div style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        {share.message && (
          <div style={{ color: colors.textMuted, fontSize: typography.xs.fontSize, marginTop: 2, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            "{share.message}"
          </div>
        )}
        <div style={{ color: colors.textMuted, fontSize: typography.xs.fontSize, marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{formatTimeAgo(share.created_at)}</span>
          {onSave && (
            <button
              type="button"
              onClick={handleSave}
              style={{
                background: isSaved ? 'rgba(76,175,80,0.12)' : 'var(--accent-muted)',
                border: `0.5px solid ${isSaved ? '#4CAF50' : 'var(--accent)'}`,
                color: isSaved ? '#4CAF50' : 'var(--accent)',
                cursor: 'pointer',
                padding: '3px 10px',
                borderRadius: radius.sm,
                fontSize: typography.xs.fontSize,
                fontWeight: 500,
                fontFamily: 'inherit',
                transition: 'all var(--ease-default)',
              }}
            >
              {isSaved ? '✓ Sauvegardé' : 'Sauvegarder'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
