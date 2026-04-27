'use client'
import { useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useFeedStore } from '@/stores/feedStore'
import { Sound } from '@/types'

const PAGE_SIZE = 20
const STALE_MS = 60_000 // refresh if cache is older than 60s

export function useFeed() {
  const store = useFeedStore()
  const isLoadingRef = useRef(false)
  const pageRef = useRef(0)
  const hasMoreRef = useRef(true)
  const lastFetchRef = useRef(0)

  const load = useCallback(async (reset = false) => {
    if (isLoadingRef.current) return
    if (!reset && !hasMoreRef.current) return
    isLoadingRef.current = true
    store.setIsLoading(true)

    const currentPage = reset ? 0 : pageRef.current
    const from = currentPage * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data } = await supabase
      .from('sounds')
      .select('*, uploader:profiles!uploaded_by(*), reactions(*)')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(from, to)

    const items = (data as Sound[]) ?? []

    if (reset) {
      store.setSounds(items)
      pageRef.current = 1
      lastFetchRef.current = Date.now()
    } else {
      store.appendSounds(items)
      pageRef.current = currentPage + 1
    }

    const hasMore = items.length === PAGE_SIZE
    hasMoreRef.current = hasMore
    store.setHasMore(hasMore)
    store.setPage(pageRef.current)
    isLoadingRef.current = false
    store.setIsLoading(false)
  }, []) // stable — never recreated

  useEffect(() => {
    if (store.sounds.length === 0) {
      load(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh when the user returns to the tab if cache is stale
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        const stale = Date.now() - lastFetchRef.current > STALE_MS
        if (stale) {
          hasMoreRef.current = true
          load(true)
        }
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  const refresh = useCallback(() => {
    hasMoreRef.current = true
    load(true)
  }, [load])

  const loadMore = useCallback(() => {
    if (hasMoreRef.current && !isLoadingRef.current) load(false)
  }, [load])

  return { sounds: store.sounds, isLoading: store.isLoading, hasMore: store.hasMore, refresh, loadMore }
}
