'use client'
import { useEffect, useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useShare } from '@/hooks/useShare'
import { useAuthStore } from '@/stores/authStore'
import { InboxCard } from '@/components/social/InboxCard'
import { SoundCardSkeleton } from '@/components/ui/Skeleton'
import { Share } from '@/types'
import { colors, spacing, typography, radius } from '@/lib/theme'

export default function InboxPage() {
  const { profile } = useAuthStore()
  const { shares, isLoading, fetchInbox, markAsRead } = useShare()
  const [senderFilter, setSenderFilter] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | null>(null)
  const router = useRouter()

  useEffect(() => { fetchInbox() }, [])

  const handlePress = useCallback((share: Share) => {
    if (!share.is_read) markAsRead(share.id)
    if (share.sound_id) router.push(`/player/${share.sound_id}`)
    else if (share.playlist_id) router.push(`/playlist/${share.playlist_id}`)
  }, [markAsRead, router])

  const senders = useMemo(() => Array.from(new Map(shares
    .filter((share) => share.sender)
    .map((share) => [share.sender!.id, share.sender!.display_name])
  )).map(([id, name]) => ({ id, name })), [shares])

  const filteredShares = useMemo(() => shares.filter((share) => {
    if (senderFilter && share.sender?.id !== senderFilter) return false
    if (dateFilter) {
      const now = new Date()
      const createdAt = new Date(share.created_at)
      if (dateFilter === 'today') {
        const start = new Date(now); start.setHours(0, 0, 0, 0)
        if (createdAt < start) return false
      }
      if (dateFilter === 'week') {
        const start = new Date(now); start.setDate(now.getDate() - 7)
        if (createdAt < start) return false
      }
      if (dateFilter === 'month') {
        const start = new Date(now); start.setMonth(now.getMonth() - 1)
        if (createdAt < start) return false
      }
    }
    return true
  }), [shares, senderFilter, dateFilter])

  const handleSaveShare = useCallback(async (share: Share) => {
    if (!profile) return
    try {
      if (share.sound_id && share.sound) {
        const { data: existing } = await supabase
          .from('playlists').select('id,title')
          .eq('created_by', profile.id).ilike('title', '%Sauvegardes%').limit(1).maybeSingle()

        const playlist = existing ?? (await supabase
          .from('playlists')
          .insert({ title: 'Mes sauvegardes', description: `Sauvegarde de ${share.sender?.display_name ?? 'un membre'}`, created_by: profile.id, is_public: false })
          .select().single()).data

        const { data: existingSound } = await supabase
          .from('playlist_sounds').select('position')
          .eq('playlist_id', playlist.id).order('position', { ascending: false }).limit(1)

        const position = (((existingSound?.[0] as { position?: number })?.position) ?? 0) + 1
        await supabase.from('playlist_sounds').upsert({ playlist_id: playlist.id, sound_id: share.sound_id, position })
      } else if (share.playlist_id) {
        const { data: playlistData } = await supabase
          .from('playlists').select('*, playlist_sounds(position, sound:sounds(*, reactions(*), uploader:profiles!uploaded_by(*)))')
          .eq('id', share.playlist_id).single()
        if (!playlistData) return

        const { data: newPlaylist } = await supabase
          .from('playlists')
          .insert({ title: `Copie de ${playlistData.title}`, description: `Partage de ${share.sender?.display_name ?? 'un membre'}`, created_by: profile.id, is_public: false })
          .select().single()

        const soundsToSave = (playlistData.playlist_sounds ?? [])
          .map((ps: any, index: number) => ({ playlist_id: newPlaylist.id, sound_id: ps.sound?.id, position: index + 1 }))
          .filter((item: any) => item.sound_id)

        if (soundsToSave.length > 0) await supabase.from('playlist_sounds').upsert(soundsToSave)
      }
    } catch (error) {
      console.error('Impossible de sauvegarder le partage', error)
    }
  }, [profile])

  const isFiltered = senderFilter !== null || dateFilter !== null
  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px',
    borderRadius: radius.full,
    border: `0.5px solid ${active ? 'var(--accent)' : colors.border}`,
    background: active ? 'var(--accent-muted)' : 'transparent',
    color: active ? 'var(--accent)' : colors.textSecondary,
    fontSize: typography.xs.fontSize,
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
    fontFamily: 'inherit',
    transition: 'all var(--ease-default)',
  })

  return (
    <div>
      <h1 style={{ color: colors.textPrimary, fontSize: typography.xl.fontSize, fontWeight: 700, padding: `${spacing.md}px ${spacing.lg}px`, margin: 0 }}>Activité</h1>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: spacing.sm, padding: `0 ${spacing.lg}px ${spacing.md}px`, overflowX: 'auto', scrollbarWidth: 'none' }}>
        <button style={pillStyle(!isFiltered)} onClick={() => { setSenderFilter(null); setDateFilter(null) }}>Tous</button>
        {senders.map((sender) => (
          <button key={sender.id} style={pillStyle(senderFilter === sender.id)}
            onClick={() => { setSenderFilter(sender.id); setDateFilter(null) }}>
            {sender.name}
          </button>
        ))}
        <button style={pillStyle(dateFilter === 'today')} onClick={() => { setDateFilter('today'); setSenderFilter(null) }}>Aujourd'hui</button>
        <button style={pillStyle(dateFilter === 'week')} onClick={() => { setDateFilter('week'); setSenderFilter(null) }}>Cette semaine</button>
        <button style={pillStyle(dateFilter === 'month')} onClick={() => { setDateFilter('month'); setSenderFilter(null) }}>Ce mois</button>
      </div>

      {isLoading && filteredShares.length === 0 ? (
        Array.from({ length: 5 }).map((_, i) => <SoundCardSkeleton key={i} />)
      ) : filteredShares.length === 0 ? (
        /* Empty state with icon */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${spacing.xxl}px ${spacing.xl}px`, gap: spacing.md }}>
          <div style={{ fontSize: 48, color: colors.textMuted, opacity: 0.4, lineHeight: 1 }}>
            <i className="fa-regular fa-bell" />
          </div>
          <p style={{ color: colors.textSecondary, fontSize: typography.base.fontSize, fontWeight: 500, margin: 0, textAlign: 'center' }}>
            Rien de nouveau pour l'instant
          </p>
          <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, margin: 0, textAlign: 'center' }}>
            {isFiltered ? 'Ajuste les filtres ou reviens plus tard.' : 'Les partages de tes amis apparaîtront ici.'}
          </p>
          {!isFiltered && (
            <Link
              href="/browse"
              style={{
                marginTop: spacing.sm,
                color: 'var(--accent)',
                fontSize: typography.sm.fontSize,
                fontWeight: 500,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
              }}
            >
              Découvrir de la musique <i className="fa-solid fa-arrow-right" style={{ fontSize: 12 }} />
            </Link>
          )}
        </div>
      ) : (
        filteredShares.map((share) => (
          <InboxCard key={share.id} share={share} onPress={() => handlePress(share)} onSave={() => handleSaveShare(share)} />
        ))
      )}
    </div>
  )
}
