'use client'
import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useFeed } from '@/hooks/useFeed'
import { FeedItem } from '@/components/social/FeedItem'
import { FeedItemSkeleton } from '@/components/ui/Skeleton'
import { SoundCard } from '@/components/ui/Card'
import { SoundCardSkeleton } from '@/components/ui/Skeleton'
import { usePlayerStore } from '@/stores/playerStore'
import { useAuthStore } from '@/stores/authStore'
import { Sound, Profile } from '@/types'
import { colors, spacing, typography, radius } from '@/lib/theme'
import { TopBar } from '@/components/layout/TopBar'

type DateFilter = 'today' | 'week' | 'month' | null
interface MemberFilter { id: string; name: string }

function getDateISO(filter: DateFilter): string | null {
  if (!filter) return null
  const now = new Date()
  if (filter === 'today') {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }
  if (filter === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    return d.toISOString()
  }
  if (filter === 'month') {
    const d = new Date(now)
    d.setMonth(d.getMonth() - 1)
    return d.toISOString()
  }
  return null
}

function FeedContent() {
  const searchParams = useSearchParams()
  const targetPlaylistId = searchParams?.get('addTo')
  const { sounds: feedSounds, isLoading, hasMore, refresh, loadMore } = useFeed()
  const { playSound } = usePlayerStore()
  const loaderRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  // Members for filter pills
  const [members, setMembers] = useState<MemberFilter[]>([])

  // Active filter state
  const [activeMember, setActiveMember] = useState<string | null>(null)
  const [activeDateFilter, setActiveDateFilter] = useState<DateFilter>(null)

  // Filtered sounds (when a filter is active, bypass feed store)
  const [filteredSounds, setFilteredSounds] = useState<Sound[] | null>(null)
  const [filterLoading, setFilterLoading] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Sound[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchDebounce = useRef<ReturnType<typeof setTimeout>>()

  // Fetch members for pills
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, display_name')
      .then(({ data }) => {
        if (data) {
          setMembers((data as Profile[]).map((p) => ({ id: p.id, name: p.display_name })))
        }
      })
  }, [])

  // Infinite scroll via IntersectionObserver (only used when no filter active)
  useEffect(() => {
    const el = loaderRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadMore()
    }, { threshold: 0.1 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  // Supabase Realtime — auto-refresh on new sounds
  useEffect(() => {
    const channel = supabase
      .channel('feed-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sounds' },
        () => {
          refresh()
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [refresh])

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text)
  }, [])

  useEffect(() => {
    const normalizedQuery = searchQuery.trim()
    if (!normalizedQuery) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const timeout = setTimeout(async () => {
      try {
        const escapedQuery = normalizedQuery.replace(/[\\%_]/g, '\\$&')
        const searchPattern = `%${escapedQuery}%`
        const { data, error } = await supabase
          .from('sounds')
          .select('*, uploader:profiles!uploaded_by(*), reactions(*)')
          .or(`title.ilike.${searchPattern},artist.ilike.${searchPattern},genre.ilike.${searchPattern}`)
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(20)

        if (error) {
          console.error('Search failed', error)
          setSearchResults([])
        } else {
          setSearchResults((data as Sound[]) ?? [])
        }
      } catch (err) {
        console.error('Search error', err)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [searchQuery])

  // Fetch filtered sounds
  const applyFilter = useCallback(async (memberId: string | null, dateFilter: DateFilter) => {
    if (!memberId && !dateFilter) {
      setFilteredSounds(null)
      return
    }
    setFilterLoading(true)
    let query = supabase
      .from('sounds')
      .select('*, uploader:profiles!uploaded_by(*), reactions(*)')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(40)

    if (memberId) {
      query = query.eq('uploaded_by', memberId)
    }
    const isoDate = getDateISO(dateFilter)
    if (isoDate) {
      query = query.gte('created_at', isoDate)
    }

    const { data } = await query
    setFilteredSounds((data as Sound[]) ?? [])
    setFilterLoading(false)
  }, [])

  const handleMemberFilter = (id: string | null) => {
    setActiveMember(id)
    setActiveDateFilter(null)
    applyFilter(id, null)
  }

  const handleDateFilter = (f: DateFilter) => {
    setActiveDateFilter(f)
    setActiveMember(null)
    applyFilter(null, f)
  }

  const handleAllFilter = () => {
    setActiveMember(null)
    setActiveDateFilter(null)
    setFilteredSounds(null)
  }

  const isFiltered = activeMember !== null || activeDateFilter !== null
  const isSearchMode = searchQuery.trim().length > 0
  const displayedSounds = isFiltered ? (filteredSounds ?? []) : feedSounds
  const displayLoading = isFiltered ? filterLoading : isLoading

  const [filtersOpen, setFiltersOpen] = useState(false)

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 14px',
    borderRadius: radius.full,
    border: `0.5px solid ${active ? 'var(--accent)' : colors.border}`,
    background: active ? 'var(--accent-muted)' : 'transparent',
    color: active ? 'var(--accent)' : colors.textSecondary,
    fontSize: typography.xs.fontSize,
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all var(--ease-default)',
    flexShrink: 0,
    fontFamily: 'inherit',
  })

  return (
    <div>
      <div ref={topRef} />

      <TopBar
        title="Feed"
        search={{
          value: searchQuery,
          onChange: handleSearch,
          placeholder: 'Rechercher…',
        }}
        afterSearch={
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            style={{
              background: filtersOpen || isFiltered ? 'var(--accent-gradient)' : colors.surface,
              border: `0.5px solid ${filtersOpen || isFiltered ? 'transparent' : colors.border}`,
              borderRadius: radius.full,
              width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, position: 'relative',
              color: filtersOpen || isFiltered ? '#fff' : colors.textMuted,
              fontSize: 15,
            }}
            aria-label="Filtres"
          >
            <i className="fa-solid fa-sliders" />
            {isFiltered && !filtersOpen && (
              <span style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', background: '#fff', border: `1.5px solid var(--accent)` }} />
            )}
          </button>
        }
      >
        {/* Collapsible filter panel */}
        {filtersOpen && (
          <div style={{ borderTop: `0.5px solid ${colors.border}`, paddingTop: spacing.sm }}>
            {isFiltered && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <span style={{ color: colors.textMuted, fontSize: typography.xs.fontSize }}>Filtre actif</span>
                <button onClick={handleAllFilter} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: typography.xs.fontSize, fontFamily: 'inherit' }}>Effacer</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: spacing.sm, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: spacing.sm }}>
              <button style={pillStyle(!isFiltered)} onClick={handleAllFilter}>Tous</button>
              {members.map((m) => (
                <button key={m.id} style={pillStyle(activeMember === m.id)}
                  onClick={() => activeMember === m.id ? handleAllFilter() : handleMemberFilter(m.id)}>
                  {m.name}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: spacing.sm, overflowX: 'auto', scrollbarWidth: 'none' }}>
              {([['today', "Aujourd'hui"], ['week', 'Cette semaine'], ['month', 'Ce mois']] as [DateFilter, string][]).map(([val, label]) => (
                <button key={val!} style={pillStyle(activeDateFilter === val)}
                  onClick={() => activeDateFilter === val ? handleAllFilter() : handleDateFilter(val)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </TopBar>

      {isSearchMode ? (
        isSearching ? (
          <div style={{ display: 'grid', gap: spacing.md, gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', padding: spacing.lg }}>
            {Array.from({ length: 6 }).map((_, i) => <SoundCardSkeleton key={i} />)}
          </div>
        ) : searchResults.length === 0 ? (
          <p style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl, fontSize: typography.sm.fontSize }}>
            Aucun r&eacute;sultat pour &quot;{searchQuery}&quot;
          </p>
        ) : (
          <div style={{ display: 'grid', gap: spacing.md, gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', padding: `${spacing.sm}px ${spacing.lg}px` }}>
            {searchResults.map((s) => (
              <SoundCard key={s.id} sound={s} variant="grid" onPress={() => playSound(s, searchResults)} />
            ))}
          </div>
        )
      ) : (
        <>
          {/* Feed */}
          {targetPlaylistId && (
            <div style={{ margin: `${spacing.lg}px ${spacing.lg}px`, padding: spacing.md, borderRadius: radius.md, background: 'var(--accent-muted)', border: `0.5px solid var(--accent)`, color: colors.textPrimary, fontSize: typography.sm.fontSize }}>
              Mode ajout à la playlist — cliquez sur <i className="fa-solid fa-plus" style={{ fontSize: 11 }} /> pour ajouter un son.
            </div>
          )}
          {displayLoading && displayedSounds.length === 0 ? (
            <div style={{ display: 'grid', gap: spacing.md, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', padding: spacing.lg }}>
              {Array.from({ length: 4 }).map((_, i) => <FeedItemSkeleton key={i} />)}
            </div>
          ) : displayedSounds.length === 0 ? (
            <div style={{ textAlign: 'center', padding: spacing.xxl }}>
              <p style={{ color: colors.textSecondary, fontSize: typography.md.fontSize }}>Aucun son pour l&apos;instant.</p>
              <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize }}>Sois le premier &agrave; uploader !</p>
            </div>
          ) : (
            <>
              {/* Section label */}
              {!isFiltered && (
                <div style={{ padding: `${spacing.md}px ${spacing.lg}px ${spacing.sm}px` }}>
                  <span className="section-label">Récemment partagé</span>
                </div>
              )}
              <div style={{ display: 'grid', gap: spacing.md, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', padding: `0 ${spacing.lg}px ${spacing.lg}px` }}>
                {displayedSounds.map((sound) => <FeedItem key={sound.id} sound={sound} targetPlaylistId={targetPlaylistId} />)}
              </div>
              {/* Infinite scroll trigger only for unfiltered feed */}
              {!isFiltered && (
                <>
                  <div ref={loaderRef} style={{ height: 1 }} />
                  {isLoading && (
                    <div style={{ padding: spacing.md, textAlign: 'center', color: colors.textMuted, fontSize: typography.sm.fontSize }}>
                      Chargement...
                    </div>
                  )}
                  {!hasMore && feedSounds.length > 0 && (
                    <div style={{ padding: spacing.xl, textAlign: 'center', color: colors.textMuted, fontSize: typography.sm.fontSize }}>
                      C&apos;est tout pour l&apos;instant.
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

    </div>
  )
}

export default function FeedPage() {
  return (
    <Suspense>
      <FeedContent />
    </Suspense>
  )
}
