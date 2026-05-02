'use client'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { profileAvatars } from '@/lib/profileAvatars'
import { SoundCard, SoundGrid } from '@/components/ui/Card'
import { SoundCardSkeleton } from '@/components/ui/Skeleton'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Button } from '@/components/ui/Button'
import { usePlayerStore } from '@/stores/playerStore'
import { useAuthStore } from '@/stores/authStore'
import { Profile, Sound } from '@/types'
import { colors, spacing, radius, typography } from '@/lib/theme'

// ── Statistics helpers ─────────────────────────────────────────────────────────

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div style={{ background: colors.background, border: `1px solid ${colors.border}`, borderRadius: radius.lg, padding: spacing.md, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: colors.textMuted, fontSize: typography.xs.fontSize }}>
        <i className={`fa-solid ${icon}`} style={{ color: colors.primary, fontSize: 11 }} />
        {label}
      </div>
      <div style={{ color: colors.textPrimary, fontSize: typography.xl.fontSize, fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
    </div>
  )
}

function MiniBar({ label, value, max, secondary }: { label: string; value: number; max: number; secondary?: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0
  return (
    <div style={{ marginBottom: spacing.sm }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: colors.textSecondary, fontSize: typography.xs.fontSize, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{label}</span>
        <span style={{ color: colors.textMuted, fontSize: typography.xs.fontSize, flexShrink: 0 }}>{secondary ?? value}</span>
      </div>
      <div style={{ height: 5, background: colors.surfaceElevated, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent-gradient)', borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

function MonthlySparkline({ sounds }: { sounds: Sound[] }) {
  const months = useMemo(() => {
    const result = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleString('fr-FR', { month: 'short' })
      const count = sounds.filter((s) => s.created_at.startsWith(key)).length
      result.push({ key, label, count })
    }
    return result
  }, [sounds])

  const max = Math.max(...months.map((m) => m.count), 1)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 64, padding: `0 ${spacing.xs}px` }}>
      {months.map(({ key, label, count }) => (
        <div key={key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
            <div
              title={`${count} upload${count !== 1 ? 's' : ''}`}
              style={{
                width: '100%',
                height: count === 0 ? 3 : `${(count / max) * 100}%`,
                background: count === 0 ? colors.surfaceElevated : 'var(--accent-gradient)',
                borderRadius: '3px 3px 0 0',
                transition: 'height 0.6s ease',
                opacity: count === 0 ? 0.3 : 1,
              }}
            />
          </div>
          <span style={{ fontSize: 9, color: colors.textMuted, lineHeight: 1 }}>{label}</span>
        </div>
      ))}
    </div>
  )
}

function ProfileStats({ sounds, isLoading }: { sounds: Sound[]; isLoading: boolean }) {
  const stats = useMemo(() => {
    if (!sounds.length) return null
    const totalListens = sounds.reduce((acc, s) => acc + (s.play_count ?? 0), 0)
    const totalReactions = sounds.reduce((acc, s) => acc + (s.reactions?.length ?? 0), 0)
    const avgListens = totalListens / sounds.length
    const topSound = [...sounds].sort((a, b) => (b.play_count ?? 0) - (a.play_count ?? 0))[0]

    const genreMap: Record<string, number> = {}
    for (const s of sounds) {
      if (s.genre) genreMap[s.genre] = (genreMap[s.genre] ?? 0) + 1
    }
    const topGenres = Object.entries(genreMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    const topSounds = [...sounds]
      .sort((a, b) => (b.play_count ?? 0) - (a.play_count ?? 0))
      .slice(0, 5)

    return { totalListens, totalReactions, avgListens, topSound, topGenres, topSounds }
  }, [sounds])

  if (isLoading) {
    return (
      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg }}>
        <div style={{ height: 20, width: 120, background: colors.surfaceElevated, borderRadius: radius.sm, opacity: 0.5, marginBottom: spacing.md }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing.sm }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: 72, background: colors.surfaceElevated, borderRadius: radius.lg, opacity: 0.4 }} />
          ))}
        </div>
      </div>
    )
  }

  if (!stats || sounds.length === 0) return null

  const formatNum = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg }}>
      <h3 style={{ color: colors.textPrimary, fontSize: typography.md.fontSize, fontWeight: 700, margin: `0 0 ${spacing.md}px`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className="fa-solid fa-chart-bar" style={{ color: colors.primary, fontSize: 14 }} />
        Statistiques
      </h3>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing.sm, marginBottom: spacing.md }}>
        <StatCard label="Total écoutes" value={formatNum(stats.totalListens)} icon="fa-headphones" />
        <StatCard label="Moy. écoutes / son" value={stats.avgListens.toFixed(1)} icon="fa-chart-line" />
        <StatCard label="Réactions reçues" value={formatNum(stats.totalReactions)} icon="fa-heart" />
        <StatCard label="Sons publiés" value={sounds.length} icon="fa-music" />
      </div>

      {/* Upload usage bar */}
      {(() => {
        const LIMIT = 1000
        const used = sounds.length
        const pct = Math.min(100, (used / LIMIT) * 100)
        const nearLimit = pct >= 80
        return (
          <div style={{ marginBottom: spacing.lg, background: colors.background, border: `1px solid ${nearLimit ? colors.error + '66' : colors.border}`, borderRadius: radius.lg, padding: spacing.md }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: colors.textMuted, fontSize: typography.xs.fontSize }}>
                <i className="fa-solid fa-hard-drive" style={{ color: nearLimit ? colors.error : colors.primary, fontSize: 11 }} />
                Espace uploads
              </div>
              <span style={{ fontSize: typography.xs.fontSize, fontWeight: 600, color: nearLimit ? colors.error : colors.textSecondary }}>
                {used} / {LIMIT}
              </span>
            </div>
            <div style={{ height: 6, background: colors.surfaceElevated, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                background: nearLimit ? `linear-gradient(90deg, ${colors.error}, ${colors.error}aa)` : 'var(--accent-gradient)',
                borderRadius: 3,
                transition: 'width 0.6s ease',
              }} />
            </div>
            {nearLimit && (
              <p style={{ color: colors.error, fontSize: typography.xs.fontSize, margin: `${spacing.xs}px 0 0` }}>
                {pct >= 100 ? 'Limite atteinte — supprime des sons pour continuer.' : `Plus que ${LIMIT - used} upload${LIMIT - used > 1 ? 's' : ''} disponible${LIMIT - used > 1 ? 's' : ''}.`}
              </p>
            )}
          </div>
        )
      })()}

      {/* Monthly uploads */}
      <div style={{ marginBottom: spacing.lg }}>
        <div style={{ color: colors.textMuted, fontSize: typography.xs.fontSize, marginBottom: spacing.sm, display: 'flex', alignItems: 'center', gap: 5 }}>
          <i className="fa-solid fa-calendar" style={{ fontSize: 10, color: colors.primary }} />
          Uploads — 6 derniers mois
        </div>
        <MonthlySparkline sounds={sounds} />
      </div>

      {/* Top sounds by play count */}
      {stats.topSounds.length > 0 && (
        <div style={{ marginBottom: spacing.lg }}>
          <div style={{ color: colors.textMuted, fontSize: typography.xs.fontSize, marginBottom: spacing.sm, display: 'flex', alignItems: 'center', gap: 5 }}>
            <i className="fa-solid fa-fire" style={{ fontSize: 10, color: colors.primary }} />
            Sons les plus écoutés
          </div>
          {stats.topSounds.map((s) => (
            <MiniBar
              key={s.id}
              label={`${s.title} — ${s.artist}`}
              value={s.play_count ?? 0}
              max={stats.topSounds[0].play_count ?? 1}
              secondary={`${formatNum(s.play_count ?? 0)} écoutes`}
            />
          ))}
        </div>
      )}

      {/* Genre distribution */}
      {stats.topGenres.length > 0 && (
        <div>
          <div style={{ color: colors.textMuted, fontSize: typography.xs.fontSize, marginBottom: spacing.sm, display: 'flex', alignItems: 'center', gap: 5 }}>
            <i className="fa-solid fa-tag" style={{ fontSize: 10, color: colors.primary }} />
            Genres
          </div>
          {stats.topGenres.map(([genre, count]) => (
            <MiniBar
              key={genre}
              label={genre}
              value={count}
              max={stats.topGenres[0][1]}
              secondary={`${count} son${count !== 1 ? 's' : ''}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function usernameToEmail(username: string): string {
  return `${username.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}@inka.app`
}

export default function ProfilePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { playSound } = usePlayerStore()
  const authProfile = useAuthStore((state) => state.profile)
  const session = useAuthStore((state) => state.session)
  const setAuthProfile = useAuthStore((state) => state.setProfile)
  const setSession = useAuthStore((state) => state.setSession)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [sounds, setSounds] = useState<Sound[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [country, setCountry] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null)
  const [securityFeedback, setSecurityFeedback] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingSecurity, setSavingSecurity] = useState(false)
  const [currentCode, setCurrentCode] = useState('')
  const [newCode, setNewCode] = useState('')
  const [confirmCode, setConfirmCode] = useState('')
  const [showCodes, setShowCodes] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const signOut = useAuthStore((state) => state.signOut)

  // ── Spotify state ──
  const [spotifyConnected, setSpotifyConnected] = useState(false)
  const [spotifyLoading, setSpotifyLoading] = useState(true)
  const [importStep, setImportStep] = useState<'idle' | 'loading' | 'preview' | 'done'>('idle')
  const [importData, setImportData] = useState<{
    likedTracks: { spotify_id: string; name: string; artists: string; album_art: string | null }[]
    playlists: { spotify_id: string; name: string; image: string | null; track_count: number; owner: string }[]
    albums: { spotify_id: string; name: string; artists: string; image: string | null; total_tracks: number }[]
  }>({ likedTracks: [], playlists: [], albums: [] })
  const [spotifyError, setSpotifyError] = useState<string | null>(null)

  const isOwner = authProfile?.id === params.id

  useEffect(() => {
    let isActive = true

    Promise.all([
      supabase.from('profiles').select('*').eq('id', params.id).single(),
      supabase.from('sounds').select('*, reactions(*)').eq('uploaded_by', params.id).order('created_at', { ascending: false }),
    ]).then(([profileRes, soundsRes]) => {
      if (!isActive) return

      const baseProfile = profileRes.data as Profile | null
      const nextProfile = baseProfile
        ? {
            ...baseProfile,
            avatar_url: isOwner ? authProfile?.avatar_url ?? null : null,
          }
        : null

      setProfile(nextProfile)
      setSounds((soundsRes.data as Sound[]) ?? [])
      setIsLoading(false)
    })

    return () => {
      isActive = false
    }
  }, [params.id, isOwner, authProfile?.avatar_url])

  useEffect(() => {
    if (!profile) return
    setDisplayName(profile.display_name ?? '')
    setBio(profile.bio ?? '')
    setCountry(profile.country ?? '')
    setAvatarPreview(profile.avatar_url ?? profileAvatars[0].src)
  }, [profile])

  // ── Spotify checks & handlers ──
  useEffect(() => {
    if (!isOwner) { setSpotifyLoading(false); return }
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token
      if (!token) { setSpotifyLoading(false); return }
      fetch('/api/spotify/status', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : { connected: false })
        .then(d => { setSpotifyConnected(d.connected); setSpotifyLoading(false) })
        .catch(() => setSpotifyLoading(false))
    })
  }, [isOwner])

  const handleConnectSpotify = async () => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    const res = await fetch('/api/spotify/auth', { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) { const d = await res.json(); window.location.href = d.authUrl }
  }

  const handleDisconnectSpotify = async () => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    await fetch('/api/spotify/status', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    setSpotifyConnected(false); setImportStep('idle')
    setImportData({ likedTracks: [], playlists: [], albums: [] })
  }

  const handleSpotifyImport = async () => {
    setImportStep('loading'); setSpotifyError(null)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) return
      const res = await fetch('/api/spotify/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: 'all' }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Import failed') }
      const d = await res.json()
      setImportData({
        likedTracks: d.likedTracks ?? [],
        playlists: d.playlists ?? [],
        albums: d.albums ?? [],
      })
      setImportStep('preview')
    } catch (err) {
      setSpotifyError(err instanceof Error ? err.message : 'Import failed'); setImportStep('idle')
    }
  }

  const joinedAt = useMemo(() => {
    if (!profile?.created_at) return null
    return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(profile.created_at))
  }, [profile?.created_at])

  const handleLogout = async () => {
    await signOut()
    router.replace('/login')
  }

  const handleDeleteAccount = async () => {
    if (!session) return
    setDeletingAccount(true)
    await fetch('/api/auth/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: session.user.id }),
    })
    await signOut()
    router.replace('/login')
  }

  const handleProfileSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!session || !authProfile) return

    setSavingProfile(true)
    setProfileFeedback(null)

    const nextDisplayName = displayName.trim() || authProfile.username
    const nextBio = bio.trim() || null
    const nextCountry = country.trim() || null
    const nextAvatarUrl = avatarPreview?.trim() ? avatarPreview : null

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        display_name: nextDisplayName,
        bio: nextBio,
        country: nextCountry,
      })
      .eq('id', session.user.id)

    if (profileError) {
      setSavingProfile(false)
      setProfileFeedback(profileError.message)
      return
    }

    const { error: userError } = await supabase.auth.updateUser({
      data: {
        avatar_url: nextAvatarUrl,
        display_name: nextDisplayName,
      },
    })

    if (userError) {
      setSavingProfile(false)
      setProfileFeedback(userError.message)
      return
    }

    const { data: sessionData } = await supabase.auth.getSession()
    if (sessionData.session) setSession(sessionData.session)

    const nextProfile: Profile = {
      ...(profile as Profile),
      display_name: nextDisplayName,
      bio: nextBio ?? undefined,
      country: nextCountry ?? undefined,
      avatar_url: nextAvatarUrl,
    }

    setProfile(nextProfile)
    setAuthProfile(nextProfile)
    setSavingProfile(false)
    setProfileFeedback('Profil mis a jour')
  }

  const handleCodeSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!authProfile) return

    setSecurityFeedback(null)

    if (!/^\d{4}$/.test(currentCode)) {
      setSecurityFeedback('Entre ton code actuel a 4 chiffres')
      return
    }
    if (!/^\d{4}$/.test(newCode)) {
      setSecurityFeedback('Le nouveau code doit contenir 4 chiffres')
      return
    }
    if (newCode !== confirmCode) {
      setSecurityFeedback('La confirmation du code ne correspond pas')
      return
    }
    if (newCode === currentCode) {
      setSecurityFeedback('Choisis un code different du code actuel')
      return
    }

    setSavingSecurity(true)

    // Try padded format first, then raw for backward compat
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(authProfile.username),
      password: currentCode + '00',
    })
    if (signInError) {
      const { error: signInError2 } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(authProfile.username),
        password: currentCode,
      })
      if (signInError2) {
        setSavingSecurity(false)
        setSecurityFeedback('Le code actuel est incorrect')
        return
      }
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newCode + '00' })
    if (updateError) {
      setSavingSecurity(false)
      setSecurityFeedback(updateError.message)
      return
    }

    const { data: sessionData } = await supabase.auth.getSession()
    if (sessionData.session) setSession(sessionData.session)

    setCurrentCode('')
    setNewCode('')
    setConfirmCode('')
    setSavingSecurity(false)
    setSecurityFeedback('Code mis a jour')
  }

  return (
    <div style={{ paddingBottom: spacing.xxl }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: `${spacing.md}px ${spacing.lg}px` }}>
        <button onClick={() => router.back()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textPrimary, fontSize: 20, padding: 4, display: 'flex', alignItems: 'center' }}>
          <i className="fa-solid fa-arrow-left" />
        </button>
        <h1 style={{ color: colors.textPrimary, fontSize: typography.lg.fontSize, fontWeight: 700, margin: 0 }}>
          {isOwner ? 'Mon profil' : 'Profil'}
        </h1>
      </div>

      <div style={{ maxWidth: 980, margin: '0 auto', padding: `0 ${spacing.lg}px` }}>
        <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.lg }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.lg }}>
            <div>
              <UserAvatar
                username={profile?.username ?? '?'}
                displayName={profile?.display_name}
                avatarUrl={avatarPreview}
                size={88}
              />
            </div>

            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              {isLoading ? (
                <div style={{ color: colors.textMuted }}>Chargement...</div>
              ) : (
                <>
                  <h2 style={{ color: colors.textPrimary, fontSize: typography.xl.fontSize, fontWeight: 800, margin: 0 }}>
                    {profile?.display_name}
                  </h2>
                  <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, margin: `${spacing.xs}px 0 0` }}>
                    @{profile?.username}
                  </p>
                  {(profile?.bio || isOwner) && (
                    <p style={{ color: colors.textSecondary, fontSize: typography.sm.fontSize, marginTop: spacing.md, marginBottom: 0 }}>
                      {profile?.bio || 'Ajoute une bio pour te presenter rapidement.'}
                    </p>
                  )}
                </>
              )}
            </div>

            {!isLoading && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(80px, 1fr))', gap: spacing.md, flex: '1 1 260px' }}>
                <div style={{ background: colors.background, border: `1px solid ${colors.border}`, borderRadius: radius.lg, padding: spacing.md }}>
                  <div style={{ color: colors.textPrimary, fontSize: typography.lg.fontSize, fontWeight: 800 }}>{sounds.length}</div>
                  <div style={{ color: colors.textMuted, fontSize: typography.xs.fontSize }}>Sons</div>
                </div>
                <div style={{ background: colors.background, border: `1px solid ${colors.border}`, borderRadius: radius.lg, padding: spacing.md }}>
                  <div style={{ color: colors.textPrimary, fontSize: typography.lg.fontSize, fontWeight: 800 }}>{profile?.country || '-'}</div>
                  <div style={{ color: colors.textMuted, fontSize: typography.xs.fontSize }}>Pays</div>
                </div>
                <div style={{ background: colors.background, border: `1px solid ${colors.border}`, borderRadius: radius.lg, padding: spacing.md }}>
                  <div style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 800 }}>{joinedAt || '-'}</div>
                  <div style={{ color: colors.textMuted, fontSize: typography.xs.fontSize }}>Membre depuis</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {isOwner && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: spacing.lg, marginBottom: spacing.xl }}>
            <form onSubmit={handleProfileSave} style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.xl, padding: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
              <div>
                <h3 style={{ color: colors.textPrimary, fontSize: typography.md.fontSize, fontWeight: 700, margin: 0 }}>Informations du profil</h3>
                <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, margin: `${spacing.xs}px 0 0` }}>
                  Modifie ton avatar, ton nom affiche et ta presentation.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', color: colors.textMuted, fontSize: typography.xs.fontSize, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Nom affiche</label>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', background: colors.background, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: `${spacing.md}px ${spacing.lg}px`, color: colors.textPrimary, fontFamily: 'inherit', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: colors.textMuted, fontSize: typography.xs.fontSize, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Bio</label>
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  rows={4}
                  style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', background: colors.background, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: `${spacing.md}px ${spacing.lg}px`, color: colors.textPrimary, fontFamily: 'inherit', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: colors.textMuted, fontSize: typography.xs.fontSize, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pays</label>
                <input
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', background: colors.background, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: `${spacing.md}px ${spacing.lg}px`, color: colors.textPrimary, fontFamily: 'inherit', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: colors.textMuted, fontSize: typography.xs.fontSize, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 }}>Avatar</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: spacing.sm }}>
                  {profileAvatars.map((avatar) => {
                    const selected = avatarPreview === avatar.src
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => setAvatarPreview(avatar.src)}
                        aria-label={avatar.label}
                        style={{
                          background: selected ? `${colors.primary}18` : colors.background,
                          border: `2px solid ${selected ? colors.primary : colors.border}`,
                          borderRadius: radius.lg,
                          padding: spacing.xs,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: selected ? '0 8px 18px rgba(255, 107, 53, 0.18)' : 'none',
                        }}
                      >
                        <img
                          src={avatar.src}
                          alt={avatar.label}
                          style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: radius.md }}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>

              {profileFeedback && (
                <p style={{ color: profileFeedback === 'Profil mis a jour' ? colors.primary : colors.error, fontSize: typography.sm.fontSize, margin: 0 }}>
                  {profileFeedback}
                </p>
              )}

              <Button label="Enregistrer les modifications" loading={savingProfile} type="submit" />
            </form>

            <form onSubmit={handleCodeSave} style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.xl, padding: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
              <div>
                <h3 style={{ color: colors.textPrimary, fontSize: typography.md.fontSize, fontWeight: 700, margin: 0 }}>Securite</h3>
                <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, margin: `${spacing.xs}px 0 0` }}>
                  Ton code actuel ne peut pas etre affiche pour des raisons de securite, mais tu peux le remplacer ici.
                </p>
              </div>

              <button type="button" onClick={() => setShowCodes((value) => !value)} style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 0, fontFamily: 'inherit', fontSize: typography.sm.fontSize }}>
                {showCodes ? 'Masquer les codes' : 'Afficher les codes'}
              </button>

              <div>
                <label style={{ display: 'block', color: colors.textMuted, fontSize: typography.xs.fontSize, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Code actuel</label>
                <input
                  type={showCodes ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={4}
                  value={currentCode}
                  onChange={(event) => setCurrentCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
                  style={{ width: '100%', boxSizing: 'border-box', background: colors.background, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: `${spacing.md}px ${spacing.lg}px`, color: colors.textPrimary, fontFamily: 'inherit', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: colors.textMuted, fontSize: typography.xs.fontSize, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Nouveau code</label>
                <input
                  type={showCodes ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={4}
                  value={newCode}
                  onChange={(event) => setNewCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
                  style={{ width: '100%', boxSizing: 'border-box', background: colors.background, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: `${spacing.md}px ${spacing.lg}px`, color: colors.textPrimary, fontFamily: 'inherit', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: colors.textMuted, fontSize: typography.xs.fontSize, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Confirmer le nouveau code</label>
                <input
                  type={showCodes ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={4}
                  value={confirmCode}
                  onChange={(event) => setConfirmCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
                  style={{ width: '100%', boxSizing: 'border-box', background: colors.background, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: `${spacing.md}px ${spacing.lg}px`, color: colors.textPrimary, fontFamily: 'inherit', outline: 'none' }}
                />
              </div>

              {securityFeedback && (
                <p style={{ color: securityFeedback === 'Code mis a jour' ? colors.primary : colors.error, fontSize: typography.sm.fontSize, margin: 0 }}>
                  {securityFeedback}
                </p>
              )}

              <Button label="Modifier mon code" loading={savingSecurity} type="submit" />
            </form>

          </div>
        )}

        {/* ── Spotify Integration ── */}
        {isOwner && (
          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.xl, overflow: 'hidden', marginBottom: spacing.lg }}>
            <div style={{ padding: spacing.lg, borderBottom: `1px solid ${colors.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
                <i className="fa-brands fa-spotify" style={{ fontSize: 28, color: '#1DB954' }} />
                <div>
                  <div style={{ color: colors.textPrimary, fontSize: typography.md.fontSize, fontWeight: 600 }}>Spotify</div>
                  <div style={{ color: colors.textMuted, fontSize: typography.xs.fontSize }}>
                    {spotifyConnected ? 'Connecté — Importe tes titres et playlists' : 'Importe tes titres Spotify dans Inka'}
                  </div>
                </div>
              </div>

              {spotifyLoading ? (
                <div style={{ textAlign: 'center', padding: spacing.md }}>
                  <div style={{ color: colors.textMuted, fontSize: typography.sm.fontSize }}>Vérification...</div>
                </div>
              ) : spotifyConnected ? (
                <div style={{ display: 'flex', gap: spacing.sm }}>
                  {importStep === 'idle' && (
                    <button onClick={handleSpotifyImport}
                      style={{ flex: 1, padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radius.md, background: '#1DB954', border: 'none', color: '#fff', fontSize: typography.sm.fontSize, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <i className="fa-solid fa-download" style={{ marginRight: 6 }} />
                      Importer mes données
                    </button>
                  )}
                  <button onClick={handleDisconnectSpotify}
                    style={{ padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radius.md, background: 'transparent', border: `1px solid ${colors.border}`, color: colors.textMuted, fontSize: typography.sm.fontSize, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Déconnecter
                  </button>
                </div>
              ) : (
                <button onClick={handleConnectSpotify}
                  style={{ width: '100%', padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radius.md, background: '#1DB954', border: 'none', color: '#fff', fontSize: typography.sm.fontSize, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <i className="fa-brands fa-spotify" />
                  Connecter Spotify
                </button>
              )}
            </div>

            {/* Import loading */}
            {importStep === 'loading' && (
              <div style={{ padding: spacing.xl, textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid ${colors.border}`, borderTopColor: '#1DB954', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, marginTop: spacing.md }}>Importation en cours depuis Spotify...</p>
              </div>
            )}

            {/* Import preview */}
            {importStep === 'preview' && (
              <div>
                {importData.likedTracks.length > 0 && (
                  <div style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <div style={{ padding: `${spacing.sm}px ${spacing.lg}px`, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                      <i className="fa-solid fa-heart" style={{ color: '#1DB954', fontSize: 14 }} />
                      <span style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 600 }}>Titres likés ({importData.likedTracks.length})</span>
                    </div>
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                      {importData.likedTracks.slice(0, 20).map(t => (
                        <div key={t.spotify_id} style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: `${spacing.xs}px ${spacing.lg}px`, borderBottom: `0.5px solid ${colors.border}` }}>
                          {t.album_art ? <img src={t.album_art} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} /> : <div style={{ width: 32, height: 32, borderRadius: 4, background: colors.background }} />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                            <div style={{ color: colors.textMuted, fontSize: 10 }}>{t.artists}</div>
                          </div>
                        </div>
                      ))}
                      {importData.likedTracks.length > 20 && <div style={{ padding: `${spacing.xs}px ${spacing.lg}px`, color: colors.textMuted, fontSize: 11, textAlign: 'center' }}>+{importData.likedTracks.length - 20} autres titres</div>}
                    </div>
                  </div>
                )}
                {importData.playlists.length > 0 && (
                  <div style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <div style={{ padding: `${spacing.sm}px ${spacing.lg}px`, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                      <i className="fa-solid fa-list" style={{ color: '#1DB954', fontSize: 14 }} />
                      <span style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 600 }}>Playlists ({importData.playlists.length})</span>
                    </div>
                    {importData.playlists.map(p => (
                      <div key={p.spotify_id} style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: `${spacing.xs}px ${spacing.lg}px`, borderBottom: `0.5px solid ${colors.border}` }}>
                        {p.image ? <img src={p.image} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} /> : <div style={{ width: 32, height: 32, borderRadius: 4, background: colors.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fa-solid fa-music" style={{ fontSize: 12, color: colors.textMuted }} /></div>}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                          <div style={{ color: colors.textMuted, fontSize: 10 }}>{p.track_count} titres · par {p.owner}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {importData.albums.length > 0 && (
                  <div>
                    <div style={{ padding: `${spacing.sm}px ${spacing.lg}px`, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                      <i className="fa-solid fa-compact-disc" style={{ color: '#1DB954', fontSize: 14 }} />
                      <span style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 600 }}>Albums sauvegardés ({importData.albums.length})</span>
                    </div>
                    {importData.albums.slice(0, 10).map(a => (
                      <div key={a.spotify_id} style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: `${spacing.xs}px ${spacing.lg}px`, borderBottom: `0.5px solid ${colors.border}` }}>
                        {a.image ? <img src={a.image} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} /> : <div style={{ width: 32, height: 32, borderRadius: 4, background: colors.background }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                          <div style={{ color: colors.textMuted, fontSize: 10 }}>{a.artists} · {a.total_tracks} titres</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ padding: spacing.md }}>
                  <button onClick={() => setImportStep('done')} style={{ width: '100%', padding: spacing.md, borderRadius: radius.md, background: '#1DB954', border: 'none', color: '#fff', fontSize: typography.sm.fontSize, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <i className="fa-solid fa-check" style={{ marginRight: 6 }} />Vu — Retourner au profil
                  </button>
                </div>
              </div>
            )}

            {importStep === 'done' && (
              <div style={{ padding: spacing.lg, textAlign: 'center' }}>
                <i className="fa-solid fa-circle-check" style={{ fontSize: 32, color: '#1DB954', marginBottom: spacing.sm }} />
                <p style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 600 }}>Import Spotify terminé !</p>
                <p style={{ color: colors.textMuted, fontSize: typography.xs.fontSize, marginTop: spacing.xs }}>Tes titres likés, playlists et albums sont visibles dans ta Bibliothèque.</p>
                <button onClick={() => router.push('/library')} style={{ marginTop: spacing.md, padding: `${spacing.sm}px ${spacing.lg}px`, borderRadius: radius.md, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: typography.sm.fontSize, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Ouvrir la Bibliothèque</button>
              </div>
            )}

            {spotifyError && (
              <div style={{ padding: spacing.md, background: 'rgba(239,68,68,0.1)', margin: spacing.md, borderRadius: radius.md }}>
                <p style={{ color: colors.error, fontSize: typography.sm.fontSize, margin: 0 }}><i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }} />{spotifyError}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Statistiques ── */}
        <ProfileStats sounds={sounds} isLoading={isLoading} />

        {/* Account actions card */}
        {isOwner && (
          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.xl, padding: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.md, marginBottom: spacing.lg }}>
            <div>
              <h3 style={{ color: colors.textPrimary, fontSize: typography.md.fontSize, fontWeight: 700, margin: 0 }}>Compte</h3>
              <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, margin: `${spacing.xs}px 0 0` }}>
                Gérer ta session et ton compte.
              </p>
            </div>

            <button
              onClick={handleLogout}
              style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: `${spacing.sm}px ${spacing.md}px`, background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: radius.md, color: colors.textSecondary, cursor: 'pointer', fontSize: typography.sm.fontSize, fontFamily: 'inherit', width: '100%' }}
            >
              <i className="fa-solid fa-right-from-bracket" style={{ color: colors.textMuted }} />
              Se déconnecter
            </button>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: `${spacing.sm}px ${spacing.md}px`, background: 'transparent', border: `1px solid ${colors.error}40`, borderRadius: radius.md, color: colors.error, cursor: 'pointer', fontSize: typography.sm.fontSize, fontFamily: 'inherit', width: '100%' }}
              >
                <i className="fa-solid fa-triangle-exclamation" />
                Supprimer mon compte
              </button>
            ) : (
              <div style={{ background: `${colors.error}0d`, border: `1px solid ${colors.error}40`, borderRadius: radius.md, padding: spacing.md, display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                <p style={{ color: colors.error, fontSize: typography.sm.fontSize, margin: 0, fontWeight: 500 }}>
                  Cette action est irréversible. Ton profil, tes playlists et tes écoutes seront supprimés. Tes sons seront masqués.
                </p>
                <div style={{ display: 'flex', gap: spacing.sm }}>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    style={{ flex: 1, padding: `${spacing.sm}px`, background: colors.surfaceElevated, border: `1px solid ${colors.border}`, borderRadius: radius.sm, color: colors.textSecondary, cursor: 'pointer', fontSize: typography.sm.fontSize, fontFamily: 'inherit' }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount}
                    style={{ flex: 1, padding: `${spacing.sm}px`, background: colors.error, border: 'none', borderRadius: radius.sm, color: '#fff', cursor: deletingAccount ? 'not-allowed' : 'pointer', fontSize: typography.sm.fontSize, fontWeight: 600, fontFamily: 'inherit' }}
                  >
                    {deletingAccount ? 'Suppression…' : 'Confirmer la suppression'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: spacing.md }}>
          <h3 style={{ color: colors.textPrimary, fontSize: typography.lg.fontSize, fontWeight: 700, marginBottom: spacing.xs }}>
            Sons publiés
          </h3>
          <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, margin: 0 }}>
            {isOwner ? 'Retrouve tous les sons que tu as mis en ligne.' : 'Decouvre les sons publies par ce profil.'}
          </p>
        </div>

        <div>
          {isLoading ? (
            <SoundGrid>{Array.from({ length: 4 }).map((_, index) => <SoundCardSkeleton key={index} />)}</SoundGrid>
          ) : sounds.length > 0 ? (
            <SoundGrid>{sounds.map((sound) => <SoundCard key={sound.id} sound={sound} variant="grid" onPress={() => playSound(sound, sounds)} />)}</SoundGrid>
          ) : (
            <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.xl, padding: spacing.xl, textAlign: 'center', color: colors.textMuted }}>
              Aucun son publié pour le moment.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
