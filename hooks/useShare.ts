'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useInboxStore } from '@/stores/inboxStore'
import { Share } from '@/types'

export function useShare() {
  const { profile } = useAuthStore()
  const { setUnreadCount, decrement } = useInboxStore()
  const [shares, setShares] = useState<Share[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const fetchInbox = useCallback(async () => {
    if (!profile) return
    setIsLoading(true)
    const { data } = await supabase
      .from('shares')
      .select('*, sound:sounds(*, reactions(*), uploader:profiles!uploaded_by(*)), playlist:playlists(*), sender:profiles!from_user(*)')
      .eq('to_user', profile.id)
      .order('created_at', { ascending: false })
    const items = (data as Share[]) ?? []
    setShares(items)
    setUnreadCount(items.filter((s) => !s.is_read).length)
    setIsLoading(false)
  }, [profile, setUnreadCount])

  const markAsRead = useCallback(async (shareId: string) => {
    await supabase.from('shares').update({ is_read: true }).eq('id', shareId)
    setShares((prev) => prev.map((s) => s.id === shareId ? { ...s, is_read: true } : s))
    decrement()
  }, [decrement])

  // Realtime subscription — only one channel per profile, cleaned up on unmount
  useEffect(() => {
    if (!profile) return
    // Remove any existing channel first to avoid duplicates
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }
    const channel = supabase
      .channel(`shares-inbox-${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'shares', filter: `to_user=eq.${profile.id}` },
        () => fetchInbox()
      )
      .subscribe()
    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [profile?.id]) // only re-run if profile id changes, NOT on fetchInbox change

  return { shares, isLoading, fetchInbox, markAsRead }
}
