'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SoundCard, SoundGrid, PlaylistCard } from '@/components/ui/Card'
import { SoundCardSkeleton } from '@/components/ui/Skeleton'
import { CoverArt } from '@/components/ui/CoverArt'
import { ShareModal } from '@/components/social/ShareModal'
import { useAuthStore } from '@/stores/authStore'
import { usePlayerStore } from '@/stores/playerStore'
import { usePlaylists } from '@/hooks/usePlaylists'
import { useSavedReleasesStore } from '@/stores/savedReleasesStore'
import { useSavedSoundsStore } from '@/stores/savedSoundsStore'
import { Sound, PlayHistory, SavedRelease, ReactionEmoji, REACTION_EMOJIS } from '@/types'
import { colors, spacing, radius, typography } from '@/lib/theme'
import { TopBar } from '@/components/layout/TopBar'

type Tab = 'uploads' | 'historique' | 'playlists'
type SortOrder = 'recent' | 'az'
type CoeurFilter = 'all' | ReactionEmoji | 'singles'

// ── Date label helper ──────────────────────────────────────────────────────────
function getDateLabel(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (d.getTime() === today.getTime()) return "Aujourd'hui"
  if (d.getTime() === yesterday.getTime()) return 'Hier'

  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`
}

// ── Group history by date, deduplicate consecutive plays ───────────────────────
interface HistoryEntry { item: PlayHistory; count: number }
interface HistoryGroup { label: string; entries: HistoryEntry[] }

function groupHistory(history: PlayHistory[]): HistoryGroup[] {
  const groups: HistoryGroup[] = []
  let currentGroup: HistoryGroup | null = null
  let lastSoundId: string | null = null

  for (const h of history) {
    const date = new Date(h.played_at)
    const label = getDateLabel(date)

    if (!currentGroup || currentGroup.label !== label) {
      currentGroup = { label, entries: [] }
      groups.push(currentGroup)
      lastSoundId = null
    }

    if (h.sound?.id === lastSoundId && currentGroup.entries.length > 0) {
      currentGroup.entries[currentGroup.entries.length - 1].count++
    } else {
      currentGroup.entries.push({ item: h, count: 1 })
      lastSoundId = h.sound?.id ?? null
    }
  }

  return groups
}

// ── Coups de cœur — unified row ────────────────────────────────────────────────

interface ReactionEntry { emoji: ReactionEmoji; sound: Sound; created_at: string }

function SoundRow({ sound, emojis, onPress }: { sound: Sound; emojis: ReactionEmoji[]; onPress: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onPress}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: spacing.md,
        padding: `${spacing.sm}px ${spacing.lg}px`,
        background: hovered ? colors.surface : 'transparent',
        cursor: 'pointer', transition: 'background var(--ease-default)',
        borderBottom: `0.5px solid ${colors.border}`,
      }}
    >
      <div style={{ width: 48, height: 48, borderRadius: radius.md, overflow: 'hidden', flexShrink: 0 }}>
        <CoverArt title={sound.title} artist={sound.artist} genre={sound.genre} size={48} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sound.title}
        </div>
        <div style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>{sound.artist}</div>
      </div>
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        {emojis.map(e => (
          <span key={e} style={{ fontSize: 14 }}>{REACTION_EMOJIS[e]}</span>
        ))}
      </div>
      <i className="fa-solid fa-chevron-right" style={{ color: colors.textMuted, fontSize: 11, flexShrink: 0, opacity: hovered ? 1 : 0.4 }} />
    </div>
  )
}

function ReleaseRow({ release, onPress }: { release: SavedRelease; onPress: () => void }) {
  const { remove } = useSavedReleasesStore()
  const [hovered, setHovered] = useState(false)
  const typeLabel = release.type === 'album' ? 'Album' : release.type === 'ep' ? 'EP' : 'Single'
  const releaseDate = new Date(release.releaseDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div
      onClick={onPress}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: spacing.md,
        padding: `${spacing.sm}px ${spacing.lg}px`,
        background: hovered ? colors.surface : 'transparent',
        cursor: 'pointer', transition: 'background var(--ease-default)',
        borderBottom: `0.5px solid ${colors.border}`,
      }}
    >
      <img src={release.cover} alt={release.title} style={{ width: 48, height: 48, borderRadius: radius.md, objectFit: 'cover', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginBottom: 2 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--accent)', background: 'var(--accent-muted)', borderRadius: 4, padding: '2px 5px' }}>
            {typeLabel}
          </span>
        </div>
        <div style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {release.title}
        </div>
        <div style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>
          {release.artistName} · {releaseDate}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); remove(release.id) }}
        title="Retirer"
        style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >
        <i className="fa-solid fa-bookmark" style={{ fontSize: 13, color: 'var(--accent)' }} />
      </button>
    </div>
  )
}

// ── Create Playlist Modal ──────────────────────────────────────────────────────
function CreatePlaylistModal({ userId, onClose, onCreated }: { userId: string; onClose: () => void; onCreated: () => void }) {
  const { create } = usePlaylists(userId)
  const [query, setQuery] = useState('')
  const [allSounds, setAllSounds] = useState<Sound[]>([])
  const [filtered, setFiltered] = useState<Sound[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [step, setStep] = useState<'select' | 'name'>('select')
  const [aiTitle, setAiTitle] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    supabase.from('sounds').select('*, uploader:profiles!uploaded_by(*)').eq('is_public', true).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { setAllSounds((data as Sound[]) ?? []); setFiltered((data as Sound[]) ?? []) })
  }, [])

  const handleSearch = (q: string) => {
    setQuery(q)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      if (!q.trim()) { setFiltered(allSounds); return }
      setFiltered(allSounds.filter(s => s.title.toLowerCase().includes(q.toLowerCase()) || s.artist.toLowerCase().includes(q.toLowerCase())))
    }, 200)
  }

  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const handleNext = async () => {
    if (selected.size === 0) return
    setIsGenerating(true)
    try {
      const songs = allSounds.filter(s => selected.has(s.id)).map(s => ({ title: s.title, artist: s.artist, genre: s.genre }))
      const res = await fetch('/api/playlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ songs }) })
      const data = await res.json() as { title?: string }
      setAiTitle(data.title ?? 'Ma Playlist')
    } catch { setAiTitle('Ma Playlist') }
    setIsGenerating(false)
    setStep('name')
  }

  const handleCreate = async () => {
    if (!aiTitle.trim()) return
    setIsCreating(true)
    const playlist = await create(aiTitle.trim())
    if (playlist) {
      const songs = allSounds.filter(s => selected.has(s.id))
      for (let i = 0; i < songs.length; i++) {
        await supabase.from('playlist_sounds').insert({ playlist_id: playlist.id, sound_id: songs[i].id, position: i + 1 })
      }
    }
    setIsCreating(false)
    onCreated()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: colors.surfaceElevated, borderRadius: `${radius.xl}px ${radius.xl}px 0 0`, maxHeight: '85vh', display: 'flex', flexDirection: 'column', borderTop: `0.5px solid ${colors.border}` }}>
        <div style={{ padding: spacing.lg, borderBottom: `0.5px solid ${colors.border}`, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: colors.border, margin: `0 auto ${spacing.md}px` }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ color: colors.textPrimary, margin: 0, fontSize: typography.base.fontSize, fontWeight: 600 }}>
              {step === 'select' ? `Nouvelle playlist${selected.size > 0 ? ` (${selected.size})` : ''}` : 'Nommer la playlist'}
            </h3>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, fontSize: 20 }}>
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        </div>

        {step === 'select' && <>
          <div style={{ padding: `${spacing.sm}px ${spacing.lg}px`, borderBottom: `0.5px solid ${colors.border}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', background: colors.surface, borderRadius: radius.md, padding: `0 ${spacing.md}px`, border: `0.5px solid ${colors.border}` }}>
              <i className="fa-solid fa-magnifying-glass" style={{ color: colors.textMuted, marginRight: spacing.sm, fontSize: 13 }} />
              <input value={query} onChange={e => handleSearch(e.target.value)} placeholder="Rechercher..."
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: colors.textPrimary, fontSize: typography.sm.fontSize, padding: '8px 0', fontFamily: 'inherit' }} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.map(s => (
              <button key={s.id} onClick={() => toggle(s.id)}
                style={{ display: 'flex', alignItems: 'center', gap: spacing.md, width: '100%', background: selected.has(s.id) ? 'var(--accent-muted)' : 'transparent', border: 'none', cursor: 'pointer', padding: `${spacing.sm}px ${spacing.lg}px`, borderBottom: `0.5px solid ${colors.border}` }}>
                <div style={{ width: 40, height: 40, borderRadius: radius.sm, overflow: 'hidden', flexShrink: 0 }}>
                  <CoverArt title={s.title} artist={s.artist} genre={s.genre} size={40} />
                </div>
                <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <div style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                  <div style={{ color: colors.textMuted, fontSize: typography.xs.fontSize }}>{s.artist}</div>
                </div>
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${selected.has(s.id) ? 'var(--accent)' : colors.border}`, background: selected.has(s.id) ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {selected.has(s.id) && <i className="fa-solid fa-check" style={{ color: '#fff', fontSize: 9 }} />}
                </div>
              </button>
            ))}
          </div>
          <div style={{ padding: spacing.lg, borderTop: `0.5px solid ${colors.border}`, flexShrink: 0 }}>
            <button onClick={handleNext} disabled={selected.size === 0 || isGenerating}
              style={{ width: '100%', padding: spacing.md, borderRadius: radius.md, background: selected.size > 0 ? 'var(--accent)' : colors.surface, border: 'none', color: selected.size > 0 ? '#fff' : colors.textMuted, fontSize: typography.sm.fontSize, fontWeight: 600, cursor: selected.size > 0 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
              <i className="fa-solid fa-wand-magic-sparkles" />
              {isGenerating ? 'Génération IA...' : `Continuer avec ${selected.size} son${selected.size > 1 ? 's' : ''}`}
            </button>
          </div>
        </>}

        {step === 'name' && (
          <div style={{ padding: spacing.lg, flex: 1 }}>
            <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, marginBottom: spacing.md }}>L&apos;IA a choisi ce nom pour votre playlist :</p>
            <input value={aiTitle} onChange={e => setAiTitle(e.target.value)}
              style={{ width: '100%', background: colors.surface, border: `1px solid var(--accent)`, borderRadius: radius.md, padding: `${spacing.md}px`, color: colors.textPrimary, fontSize: typography.lg.fontSize, fontWeight: 700, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            <button onClick={handleCreate} disabled={!aiTitle.trim() || isCreating}
              style={{ marginTop: spacing.xl, width: '100%', padding: spacing.md, borderRadius: radius.md, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: typography.sm.fontSize, fontWeight: 600, cursor: 'pointer' }}>
              {isCreating ? 'Création...' : `Créer "${aiTitle}"`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Library Page ──────────────────────────────────────────────────────────────
export default function LibraryPage() {
  const router = useRouter()
  const { profile } = useAuthStore()
  const { playSound } = usePlayerStore()
  const [tab, setTab] = useState<Tab>('uploads')
  const [uploads, setUploads] = useState<Sound[]>([])
  const [history, setHistory] = useState<PlayHistory[]>([])
  const [uploadsSort, setUploadsSort] = useState<SortOrder>('recent')
  const [reactions, setReactions] = useState<ReactionEntry[]>([])
  const [coeurFilter, setCoeurFilter] = useState<CoeurFilter>('all')
  const [showCoeurFilter, setShowCoeurFilter] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [sharingPlaylist, setSharingPlaylist] = useState<{ id: string; title: string } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [deletingSoundId, setDeletingSoundId] = useState<string | null>(null)
  const [deletingSound, setDeletingSound] = useState(false)
  const { playlists, loading: playlistsLoading, load: loadPlaylists, remove, update } = usePlaylists(profile?.id)
  const { saved: savedReleases } = useSavedReleasesStore()
  const { saved: savedSounds, remove: removeSavedSound } = useSavedSoundsStore()

  const loadUploads = useCallback(async () => {
    if (!profile) return
    setIsLoading(true)
    const [uploadsRes, reactionsRes] = await Promise.all([
      supabase.from('sounds').select('*, reactions(*)').eq('uploaded_by', profile.id).order('created_at', { ascending: false }),
      supabase.from('reactions').select('emoji, created_at, sound:sounds(*, reactions(*))').eq('user_id', profile.id).order('created_at', { ascending: false }),
    ])
    setUploads((uploadsRes.data as Sound[]) ?? [])
    const rows = (reactionsRes.data ?? []) as unknown as ReactionEntry[]
    const seen = new Set<string>()
    setReactions(rows.filter(r => {
      if (!r.sound) return false
      const key = `${r.sound.id}:${r.emoji}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }))
    setIsLoading(false)
  }, [profile])

  const handleDeleteSound = useCallback(async (soundId: string) => {
    if (!profile) return
    setDeletingSound(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) return

      const res = await fetch('/api/delete-sound', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ soundId }),
      })

      if (res.ok) {
        setUploads(prev => prev.filter(s => s.id !== soundId))
      }
    } catch (err) {
      console.error('[library] Delete failed:', err)
    } finally {
      setDeletingSound(false)
      setDeletingSoundId(null)
    }
  }, [profile])

  const loadHistory = useCallback(async () => {
    if (!profile) return
    setIsLoading(true)
    const { data } = await supabase.from('play_history').select('*, sound:sounds(*, reactions(*))').eq('user_id', profile.id).order('played_at', { ascending: false }).limit(50)
    setHistory((data as PlayHistory[]) ?? [])
    setIsLoading(false)
  }, [profile])

  useEffect(() => {
    if (tab === 'uploads') loadUploads()
    else if (tab === 'historique') loadHistory()
    else loadPlaylists()
  }, [tab, loadUploads, loadHistory, loadPlaylists])

  const sortedUploads = uploadsSort === 'az'
    ? [...uploads].sort((a, b) => a.title.localeCompare(b.title, 'fr'))
    : uploads

  const historyGroups = groupHistory(history.filter(h => h.sound))

  // ── Coups de cœur derived data ─────────────────────────────────────────────
  // Singles from external store (type === 'single')
  const savedSingles = savedReleases.filter(r => r.type === 'single')
  // Albums/EPs go to Playlists tab
  const savedAlbumsEps = savedReleases.filter(r => r.type !== 'single')

  // Group reactions by sound, collecting all emojis per sound
  const soundReactionMap = reactions.reduce<Map<string, { sound: Sound; emojis: ReactionEmoji[]; date: string }>>((map, r) => {
    const existing = map.get(r.sound.id)
    if (existing) {
      if (!existing.emojis.includes(r.emoji)) existing.emojis.push(r.emoji)
    } else {
      map.set(r.sound.id, { sound: r.sound, emojis: [r.emoji], date: r.created_at })
    }
    return map
  }, new Map())

  // Build combined list filtered by coeurFilter
  type CoeurRow =
    | { kind: 'sound'; sound: Sound; emojis: ReactionEmoji[]; date: string }
    | { kind: 'release'; release: SavedRelease; date: string }

  const coeurRows: CoeurRow[] = (() => {
    const soundRows: CoeurRow[] = coeurFilter === 'singles'
      ? []
      : Array.from(soundReactionMap.values())
          .filter(e => coeurFilter === 'all' || e.emojis.includes(coeurFilter as ReactionEmoji))
          .map(e => ({ kind: 'sound' as const, sound: e.sound, emojis: e.emojis, date: e.date }))

    const releaseRows: CoeurRow[] = (coeurFilter === 'all' || coeurFilter === 'singles')
      ? savedSingles.map(r => ({ kind: 'release' as const, release: r, date: r.savedAt }))
      : []

    return [...soundRows, ...releaseRows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  })()

  const hasCoeurItems = reactions.length > 0 || savedSingles.length > 0

  // Which emoji filters the user actually has
  const usedEmojis = Array.from(new Set(reactions.map(r => r.emoji)))

  const TABS: { key: Tab; label: string }[] = [
    { key: 'uploads', label: 'Mes sons' },
    { key: 'historique', label: 'Historique' },
    { key: 'playlists', label: 'Playlists' },
  ]

  const filterLabel: Record<CoeurFilter, string> = {
    all: 'Tous',
    fire: '🔥',
    heart: '❤️',
    sleep: '😴',
    pray: '🙏',
    singles: 'Singles',
  }

  return (
    <div>
      <TopBar title="Bibliothèque" />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: spacing.sm, padding: `0 ${spacing.lg}px`, marginBottom: spacing.md, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: `5px ${spacing.md}px`, borderRadius: radius.full, whiteSpace: 'nowrap',
              border: `0.5px solid ${tab === t.key ? 'var(--accent)' : colors.border}`,
              background: tab === t.key ? 'var(--accent-muted)' : 'transparent',
              color: tab === t.key ? 'var(--accent)' : colors.textMuted,
              fontSize: typography.sm.fontSize, fontWeight: tab === t.key ? 600 : 400,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all var(--ease-default)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Mes sons tab ─────────────────────────────────────────────────────── */}
      {tab === 'uploads' && (
        <>
          {/* ── Coups de cœur (above uploads) ── */}
          <div style={{ marginBottom: spacing.xl }}>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${spacing.lg}px`, marginBottom: spacing.sm }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <span style={{ color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 700 }}>Coups de cœur</span>
                {hasCoeurItems && (
                  <span style={{ fontSize: typography.xs.fontSize, color: colors.textMuted }}>
                    {coeurRows.length}
                  </span>
                )}
              </div>
              {/* Filter button */}
              {hasCoeurItems && (
                <button
                  onClick={() => setShowCoeurFilter(v => !v)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: `4px 10px`, borderRadius: radius.full,
                    border: `0.5px solid ${coeurFilter !== 'all' ? 'var(--accent)' : colors.border}`,
                    background: coeurFilter !== 'all' ? 'var(--accent-muted)' : 'transparent',
                    color: coeurFilter !== 'all' ? 'var(--accent)' : colors.textMuted,
                    fontSize: typography.xs.fontSize, fontWeight: coeurFilter !== 'all' ? 600 : 400,
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all var(--ease-default)',
                  }}
                >
                  <i className="fa-solid fa-sliders" style={{ fontSize: 11 }} />
                  {coeurFilter !== 'all' ? filterLabel[coeurFilter] : 'Filtrer'}
                </button>
              )}
            </div>

            {/* Filter pills — shown when filter button clicked */}
            {showCoeurFilter && hasCoeurItems && (
              <div style={{ display: 'flex', gap: spacing.sm, padding: `0 ${spacing.lg}px`, marginBottom: spacing.md, overflowX: 'auto', flexWrap: 'nowrap' }}>
                {(['all', ...usedEmojis, ...(savedSingles.length > 0 ? ['singles'] : [])] as CoeurFilter[]).map((f) => {
                  const active = coeurFilter === f
                  return (
                    <button
                      key={f}
                      onClick={() => { setCoeurFilter(f); setShowCoeurFilter(false) }}
                      style={{
                        padding: `4px 12px`, borderRadius: radius.full,
                        border: `0.5px solid ${active ? 'var(--accent)' : colors.border}`,
                        background: active ? 'var(--accent-muted)' : colors.surface,
                        color: active ? 'var(--accent)' : colors.textMuted,
                        fontSize: typography.sm.fontSize, fontWeight: active ? 600 : 400,
                        cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                        transition: 'all var(--ease-default)',
                      }}
                    >
                      {filterLabel[f]}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Content */}
            {isLoading ? (
              <div style={{ padding: `${spacing.md}px ${spacing.lg}px`, display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} style={{ height: 64, borderRadius: radius.md, background: colors.surface, opacity: 0.5 }} />
                ))}
              </div>
            ) : !hasCoeurItems ? (
              <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, padding: `${spacing.md}px ${spacing.lg}px` }}>
                Réagis à des sons ou sauvegarde des sorties pour les retrouver ici.
              </p>
            ) : coeurRows.length === 0 ? (
              <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, padding: `${spacing.md}px ${spacing.lg}px` }}>
                Aucun élément avec ce filtre.
              </p>
            ) : (
              <div>
                {coeurRows.map((row, i) =>
                  row.kind === 'sound' ? (
                    <SoundRow
                      key={`sound-${row.sound.id}`}
                      sound={row.sound}
                      emojis={row.emojis}
                      onPress={() => playSound(row.sound, coeurRows.filter(r => r.kind === 'sound').map(r => (r as { kind: 'sound'; sound: Sound }).sound))}
                    />
                  ) : (
                    <ReleaseRow
                      key={`release-${row.release.id}`}
                      release={row.release}
                      onPress={() => router.push(`/releases/${row.release.artistId}/album/${row.release.id}`)}
                    />
                  )
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: colors.border, margin: `0 ${spacing.lg}px`, marginBottom: spacing.lg }} />

          {/* ── Sauvegardés ── */}
          {savedSounds.length > 0 && (
            <div style={{ marginBottom: spacing.xl }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${spacing.lg}px`, marginBottom: spacing.sm }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                  <span style={{ color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 700 }}>Sauvegardés</span>
                  <span style={{ fontSize: typography.xs.fontSize, color: colors.textMuted }}>{savedSounds.length}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: `0 ${spacing.lg}px` }}>
                {savedSounds.map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: `${spacing.sm}px ${spacing.md}px`, background: colors.surface, borderRadius: radius.md, border: `0.5px solid ${colors.border}` }}>
                    <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => router.push(`/player/${s.id}`)}>
                      <div style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                      <div style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.artist}</div>
                    </div>
                    <button
                      onClick={() => removeSavedSound(s.id)}
                      title="Retirer"
                      style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: colors.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                      <i className="fa-solid fa-xmark" style={{ fontSize: 11 }} />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: colors.border, margin: `${spacing.lg}px ${spacing.lg}px 0` }} />
            </div>
          )}

          {/* ── Mes uploads ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${spacing.lg}px`, marginBottom: spacing.sm }}>
            <span style={{ color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 700 }}>Mes uploads</span>
            {uploads.length > 0 && (
              <div style={{ display: 'flex', background: colors.surface, borderRadius: radius.sm, border: `0.5px solid ${colors.border}`, overflow: 'hidden' }}>
                {(['recent', 'az'] as SortOrder[]).map((s) => (
                  <button key={s} onClick={() => setUploadsSort(s)}
                    style={{
                      padding: '4px 12px', background: uploadsSort === s ? 'var(--accent-muted)' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      color: uploadsSort === s ? 'var(--accent)' : colors.textMuted,
                      fontSize: typography.xs.fontSize, fontWeight: uploadsSort === s ? 600 : 400,
                      fontFamily: 'inherit', transition: 'all var(--ease-default)',
                    }}>
                    {s === 'recent' ? 'Récent' : 'A–Z'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isLoading
            ? <SoundGrid>{Array.from({ length: 6 }).map((_, i) => <SoundCardSkeleton key={i} />)}</SoundGrid>
            : sortedUploads.length === 0
              ? <p style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl, fontSize: typography.sm.fontSize }}>Tu n'as rien uploadé pour l'instant.</p>
              : <SoundGrid>{sortedUploads.map(s => (
                <div key={s.id} style={{ position: 'relative' }}>
                  <SoundCard sound={s} variant="grid" onPress={() => playSound(s, sortedUploads)} />
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeletingSoundId(s.id) }}
                    title="Supprimer"
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                      border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: colors.textMuted, fontSize: 11,
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = colors.error)}
                    onMouseLeave={e => (e.currentTarget.style.color = colors.textMuted)}
                  >
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              ))}</SoundGrid>
          }

          {/* Delete confirmation modal */}
          {deletingSoundId && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={() => setDeletingSoundId(null)}>
              <div onClick={e => e.stopPropagation()} style={{
                background: colors.surfaceElevated, borderRadius: radius.xl, padding: spacing.xl,
                maxWidth: 340, width: '90%', border: `0.5px solid ${colors.border}`,
                textAlign: 'center',
              }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 32, color: colors.error, marginBottom: spacing.md }} />
                <h3 style={{ color: colors.textPrimary, margin: `0 0 ${spacing.sm}px`, fontSize: typography.base.fontSize, fontWeight: 700 }}>
                  Supprimer ce son ?
                </h3>
                <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, margin: `0 0 ${spacing.lg}px` }}>
                  Cette action est irréversible. Le fichier audio sera définitivement supprimé.
                </p>
                <div style={{ display: 'flex', gap: spacing.sm }}>
                  <button onClick={() => setDeletingSoundId(null)}
                    style={{ flex: 1, padding: spacing.md, borderRadius: radius.md, background: colors.surface, border: `0.5px solid ${colors.border}`, color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Annuler
                  </button>
                  <button onClick={() => handleDeleteSound(deletingSoundId)} disabled={deletingSound}
                    style={{ flex: 1, padding: spacing.md, borderRadius: radius.md, background: colors.error, border: 'none', color: '#fff', fontSize: typography.sm.fontSize, fontWeight: 600, cursor: deletingSound ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: deletingSound ? 0.6 : 1 }}>
                    {deletingSound ? 'Suppression...' : 'Supprimer'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Historique tab ──────────────────────────────────────────────────── */}
      {tab === 'historique' && (
        isLoading
          ? <SoundGrid>{Array.from({ length: 6 }).map((_, i) => <SoundCardSkeleton key={i} />)}</SoundGrid>
          : history.length === 0
            ? <p style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl, fontSize: typography.sm.fontSize }}>Aucun son écouté récemment.</p>
            : (
              <div>
                {historyGroups.map((group) => (
                  <div key={group.label}>
                    <div style={{
                      padding: `${spacing.sm}px ${spacing.lg}px`,
                      position: 'sticky', top: 0,
                      background: `${colors.background}f0`,
                      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                      zIndex: 5, borderBottom: `0.5px solid ${colors.border}`,
                    }}>
                      <span className="section-label">{group.label}</span>
                    </div>
                    <SoundGrid>
                      {group.entries.map(({ item, count }, idx) => (
                        <div key={`${item.id}-${idx}`} style={{ position: 'relative' }}>
                          <SoundCard sound={item.sound!} variant="grid" onPress={() => playSound(item.sound!, group.entries.map(e => e.item.sound!).filter(Boolean))} />
                          {count > 1 && (
                            <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', color: colors.textPrimary, fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: radius.full, border: `0.5px solid ${colors.border}` }}>
                              ×{count}
                            </div>
                          )}
                        </div>
                      ))}
                    </SoundGrid>
                  </div>
                ))}
              </div>
            )
      )}

      {/* ── Playlists tab ───────────────────────────────────────────────────── */}
      {tab === 'playlists' && (
        <>
          <button onClick={() => setShowCreate(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing.sm,
              margin: `0 ${spacing.lg}px ${spacing.md}px`,
              padding: `${spacing.sm}px ${spacing.lg}px`,
              borderRadius: radius.md, background: 'var(--accent-muted)',
              border: `0.5px solid var(--accent)`,
              color: 'var(--accent)', fontSize: typography.sm.fontSize, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            <i className="fa-solid fa-plus" />Créer une playlist
          </button>

          {playlistsLoading
            ? <SoundGrid>{Array.from({ length: 3 }).map((_, i) => <SoundCardSkeleton key={i} />)}</SoundGrid>
            : playlists.length === 0 && savedAlbumsEps.length === 0
              ? <p style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl, fontSize: typography.sm.fontSize }}>Aucune playlist. Crée-en une !</p>
              : (
                <div>
                  {playlists.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: spacing.md, padding: `${spacing.sm}px ${spacing.lg}px` }}>
                      {playlists.map(p => {
                        const sounds = (p.playlist_sounds ?? []).sort((a, b) => a.position - b.position).map(ps => ps.sound).filter(Boolean) as Sound[]
                        return (
                          <div key={p.id} style={{ position: 'relative' }}>
                            <PlaylistCard playlist={{ ...p, sound_count: sounds.length }} onPress={() => router.push(`/playlist/${p.id}`)} />
                            <div style={{ display: 'flex', gap: 4, marginTop: spacing.sm }}>
                              <button onClick={() => setSharingPlaylist({ id: p.id, title: p.title })}
                                style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${colors.border}`, borderRadius: radius.sm, color: colors.textMuted, fontSize: 11, padding: '4px 0', cursor: 'pointer' }} title="Partager">
                                <i className="fa-solid fa-share-nodes" />
                              </button>
                              <button onClick={() => { setEditTitle(p.title); setEditingId(p.id) }}
                                style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${colors.border}`, borderRadius: radius.sm, color: colors.textMuted, fontSize: 11, padding: '4px 0', cursor: 'pointer' }} title="Modifier">
                                <i className="fa-solid fa-pen" />
                              </button>
                              <button onClick={async () => { if (confirm('Supprimer cette playlist ?')) await remove(p.id) }}
                                style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${colors.border}`, borderRadius: radius.sm, color: colors.error, fontSize: 11, padding: '4px 0', cursor: 'pointer' }} title="Supprimer">
                                <i className="fa-solid fa-trash" />
                              </button>
                            </div>
                            {editingId === p.id && (
                              <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                                onBlur={async () => { await update(p.id, editTitle); setEditingId(null) }}
                                onKeyDown={async e => { if (e.key === 'Enter') { await update(p.id, editTitle); setEditingId(null) } if (e.key === 'Escape') setEditingId(null) }}
                                autoFocus
                                style={{ position: 'absolute', bottom: 44, left: 0, right: 0, background: colors.surfaceElevated, border: `1px solid var(--accent)`, borderRadius: radius.sm, color: colors.textPrimary, fontSize: typography.sm.fontSize, padding: '6px 10px', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Saved albums & EPs from external releases */}
                  {savedAlbumsEps.length > 0 && (
                    <div style={{ marginTop: playlists.length > 0 ? spacing.xl : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: `0 ${spacing.lg}px`, marginBottom: spacing.sm }}>
                        <span style={{ color: colors.textPrimary, fontSize: typography.base.fontSize, fontWeight: 700 }}>Albums & EP sauvegardés</span>
                        <span style={{ fontSize: typography.xs.fontSize, color: colors.textMuted }}>{savedAlbumsEps.length}</span>
                      </div>
                      {savedAlbumsEps
                        .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
                        .map(r => (
                          <ReleaseRow
                            key={r.id}
                            release={r}
                            onPress={() => router.push(`/releases/${r.artistId}/album/${r.id}`)}
                          />
                        ))}
                    </div>
                  )}
                </div>
              )
          }
        </>
      )}

      {sharingPlaylist && <ShareModal playlist={sharingPlaylist} visible={true} onClose={() => setSharingPlaylist(null)} />}
      {showCreate && profile && <CreatePlaylistModal userId={profile.id} onClose={() => setShowCreate(false)} onCreated={loadPlaylists} />}
    </div>
  )
}
