'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { colors, spacing, radius, typography } from '@/lib/theme'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Stats {
  users: number
  sounds: number
  totalPlays: number
  reactions: number
  playlists: number
  soundsNoGenre: number
  newUsersWeek: number
  newSoundsWeek: number
}

interface SoundRow {
  id: string
  title: string
  artist: string
  genre: string | null
  play_count: number
  is_public: boolean
  created_at: string
  uploader: { username: string; display_name: string } | null
}

interface UserRow {
  id: string
  username: string
  display_name: string
  country: string | null
  created_at: string
  sound_count: number
  total_plays: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return "Aujourd'hui"
  if (d === 1) return 'Hier'
  if (d < 30) return `Il y a ${d}j`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, sub, color }: { label: string; value: string | number; icon: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: colors.surface, border: `0.5px solid ${colors.border}`, borderRadius: radius.lg, padding: spacing.lg, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <i className={`fa-solid ${icon}`} style={{ color: color ?? 'var(--accent)', fontSize: 12 }} />
        <span style={{ color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div style={{ color: colors.textPrimary, fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: colors.textMuted, fontSize: 11 }}>{sub}</div>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: spacing.xl }}>
      <h2 style={{ color: colors.textPrimary, fontSize: typography.md.fontSize, fontWeight: 700, margin: `0 0 ${spacing.md}px` }}>{title}</h2>
      {children}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'overview' | 'sounds' | 'users' | 'tools'>('overview')
  const [stats, setStats] = useState<Stats | null>(null)
  const [sounds, setSounds] = useState<SoundRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingSounds, setLoadingSounds] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [searchSound, setSearchSound] = useState('')
  const [genreLimit, setGenreLimit] = useState(20)
  const [genreRunning, setGenreRunning] = useState(false)
  const [genreReport, setGenreReport] = useState<{ total: number; updated: number; skipped: number } | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const logout = () => {
    sessionStorage.removeItem('inka_admin')
    router.replace('/login')
  }

  // ── Load stats ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoadingStats(false))
  }, [])

  // ── Load sounds ──────────────────────────────────────────────────────────────
  const loadSounds = useCallback(async () => {
    setLoadingSounds(true)
    const url = searchSound.trim()
      ? `/api/admin/sounds?q=${encodeURIComponent(searchSound.trim())}`
      : '/api/admin/sounds'
    const data = await fetch(url).then((r) => r.json()).catch(() => [])
    setSounds(Array.isArray(data) ? data : [])
    setLoadingSounds(false)
  }, [searchSound])

  useEffect(() => {
    if (tab === 'sounds') loadSounds()
  }, [tab, loadSounds])

  // ── Load users ───────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    const data = await fetch('/api/admin/users').then((r) => r.json()).catch(() => [])
    setUsers(Array.isArray(data) ? data : [])
    setLoadingUsers(false)
  }, [])

  useEffect(() => {
    if (tab === 'users') loadUsers()
  }, [tab, loadUsers])

  // ── Sound actions ─────────────────────────────────────────────────────────────
  const toggleVisibility = async (id: string, current: boolean) => {
    await fetch('/api/admin/sounds', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_public: !current }),
    })
    setSounds((prev) => prev.map((s) => s.id === id ? { ...s, is_public: !current } : s))
    setActionMsg(`Son ${!current ? 'rendu public' : 'masqué'}`)
    setTimeout(() => setActionMsg(null), 2000)
  }

  const deleteSound = async (id: string) => {
    if (!confirm('Supprimer ce son définitivement ?')) return
    await fetch('/api/admin/sounds', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setSounds((prev) => prev.filter((s) => s.id !== id))
    setActionMsg('Son supprimé')
    setTimeout(() => setActionMsg(null), 2000)
  }

  // ── Fill genres tool ──────────────────────────────────────────────────────────
  const runFillGenres = async () => {
    setGenreRunning(true)
    setGenreReport(null)
    try {
      const res = await fetch('/api/admin/fill-genres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: genreLimit }),
      })
      const data = await res.json()
      setGenreReport(data)
      setStats((prev) => prev ? { ...prev, soundsNoGenre: Math.max(0, prev.soundsNoGenre - (data.updated ?? 0)) } : prev)
    } catch { /* ignore */ }
    setGenreRunning(false)
  }

  // ── Styles ────────────────────────────────────────────────────────────────────
  const inputStyle = {
    background: colors.surface, border: `0.5px solid ${colors.border}`,
    borderRadius: radius.sm, padding: '6px 12px', color: colors.textPrimary,
    fontSize: typography.sm.fontSize, outline: 'none', fontFamily: 'inherit',
  }

  const TAB_LABELS: Record<string, string> = {
    overview: 'Vue d\'ensemble',
    sounds: 'Sons',
    users: 'Membres',
    tools: 'Outils',
  }

  return (
    <div style={{ background: colors.background, minHeight: '100dvh' }}>
      {/* Header */}
      <div style={{ borderBottom: `0.5px solid ${colors.border}`, background: colors.surface, padding: `${spacing.md}px ${spacing.lg}px`, display: 'flex', alignItems: 'center', gap: spacing.md, position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: colors.textPrimary, fontWeight: 700, fontSize: typography.md.fontSize }}>
            <i className="fa-solid fa-shield-halved" style={{ color: 'var(--accent)', marginRight: 8 }} />
            Inka Admin
          </div>
        </div>
        {actionMsg && (
          <span style={{ color: colors.success, fontSize: typography.xs.fontSize, background: `${colors.success}18`, padding: '3px 10px', borderRadius: radius.sm }}>
            {actionMsg}
          </span>
        )}
        <button
          onClick={logout}
          style={{ background: 'transparent', border: `0.5px solid ${colors.border}`, borderRadius: radius.sm, padding: '5px 12px', color: colors.textSecondary, fontSize: typography.xs.fontSize, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <i className="fa-solid fa-right-from-bracket" />
          Déconnexion
        </button>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: `0.5px solid ${colors.border}`, display: 'flex', gap: 0, padding: `0 ${spacing.lg}px`, background: colors.surface }}>
        {(['overview', 'sounds', 'users', 'tools'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: 'transparent', border: 'none', borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
              color: tab === t ? 'var(--accent)' : colors.textSecondary,
              padding: `${spacing.md}px ${spacing.md}px`, cursor: 'pointer',
              fontSize: typography.sm.fontSize, fontWeight: tab === t ? 600 : 400, fontFamily: 'inherit',
              transition: 'color 150ms, border-color 150ms',
            }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: `${spacing.xl}px ${spacing.lg}px`, paddingBottom: 80 }}>

        {/* ── Overview ── */}
        {tab === 'overview' && (
          <>
            <Section title="Statistiques globales">
              {loadingStats ? (
                <div style={{ color: colors.textMuted, fontSize: typography.sm.fontSize }}>Chargement…</div>
              ) : stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: spacing.md }}>
                  <StatCard label="Membres" value={fmt(stats.users)} icon="fa-users" sub={`+${stats.newUsersWeek} cette semaine`} />
                  <StatCard label="Sons publics" value={fmt(stats.sounds)} icon="fa-music" sub={`+${stats.newSoundsWeek} cette semaine`} />
                  <StatCard label="Écoutes totales" value={fmt(stats.totalPlays)} icon="fa-headphones" />
                  <StatCard label="Réactions" value={fmt(stats.reactions)} icon="fa-heart" color="#E84393" />
                  <StatCard label="Playlists" value={fmt(stats.playlists)} icon="fa-list" />
                  <StatCard label="Sans genre" value={stats.soundsNoGenre} icon="fa-tag" color={stats.soundsNoGenre > 0 ? colors.error : colors.success} sub="Sons sans genre" />
                </div>
              )}
            </Section>

            <Section title="Actions rapides">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.md }}>
                {[
                  { label: 'Gérer les sons', icon: 'fa-music', action: () => setTab('sounds') },
                  { label: 'Gérer les membres', icon: 'fa-users', action: () => setTab('users') },
                  { label: 'Remplir les genres', icon: 'fa-tag', action: () => setTab('tools') },
                ].map(({ label, icon, action }) => (
                  <button
                    key={label}
                    onClick={action}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: `${spacing.sm}px ${spacing.md}px`, background: colors.surface, border: `0.5px solid ${colors.border}`, borderRadius: radius.md, color: colors.textPrimary, cursor: 'pointer', fontSize: typography.sm.fontSize, fontFamily: 'inherit' }}
                  >
                    <i className={`fa-solid ${icon}`} style={{ color: 'var(--accent)' }} />
                    {label}
                  </button>
                ))}
              </div>
            </Section>
          </>
        )}

        {/* ── Sounds ── */}
        {tab === 'sounds' && (
          <Section title="Gestion des sons">
            <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.md, alignItems: 'center' }}>
              <input
                value={searchSound}
                onChange={(e) => setSearchSound(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadSounds()}
                placeholder="Chercher par titre ou artiste…"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={loadSounds} style={{ ...inputStyle, cursor: 'pointer', background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 600 }}>
                Chercher
              </button>
            </div>

            {loadingSounds ? (
              <div style={{ color: colors.textMuted, fontSize: typography.sm.fontSize }}>Chargement…</div>
            ) : (
              <div style={{ background: colors.surface, borderRadius: radius.md, border: `0.5px solid ${colors.border}`, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px 80px 100px 80px', padding: `${spacing.sm}px ${spacing.md}px`, borderBottom: `0.5px solid ${colors.border}` }}>
                  {['Son', 'Genre', 'Écoutes', 'Statut', 'Ajouté', 'Actions'].map((h) => (
                    <span key={h} style={{ color: colors.textMuted, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
                  ))}
                </div>
                {sounds.map((s) => (
                  <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px 80px 100px 80px', padding: `${spacing.sm}px ${spacing.md}px`, borderBottom: `0.5px solid ${colors.border}`, alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                      <div style={{ color: colors.textMuted, fontSize: 11 }}>{s.artist} · @{(s.uploader as unknown as { username: string } | null)?.username ?? '?'}</div>
                    </div>
                    <span style={{ color: s.genre ? colors.textSecondary : colors.textMuted, fontSize: 12 }}>{s.genre ?? '—'}</span>
                    <span style={{ color: colors.textSecondary, fontSize: 12 }}>{fmt(s.play_count)}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, width: 'fit-content',
                      background: s.is_public ? '#4CAF5018' : `${colors.error}18`,
                      color: s.is_public ? '#4CAF50' : colors.error,
                      border: `0.5px solid ${s.is_public ? '#4CAF5040' : `${colors.error}40`}`,
                    }}>
                      {s.is_public ? 'Public' : 'Masqué'}
                    </span>
                    <span style={{ color: colors.textMuted, fontSize: 11 }}>{timeAgo(s.created_at)}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => toggleVisibility(s.id, s.is_public)}
                        title={s.is_public ? 'Masquer' : 'Rendre public'}
                        style={{ background: 'transparent', border: `0.5px solid ${colors.border}`, borderRadius: 4, padding: '3px 6px', cursor: 'pointer', color: colors.textSecondary, fontSize: 11 }}
                      >
                        <i className={`fa-solid ${s.is_public ? 'fa-eye-slash' : 'fa-eye'}`} />
                      </button>
                      <button
                        onClick={() => deleteSound(s.id)}
                        title="Supprimer"
                        style={{ background: 'transparent', border: `0.5px solid ${colors.error}40`, borderRadius: 4, padding: '3px 6px', cursor: 'pointer', color: colors.error, fontSize: 11 }}
                      >
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  </div>
                ))}
                {sounds.length === 0 && !loadingSounds && (
                  <p style={{ color: colors.textMuted, textAlign: 'center', padding: spacing.xl, fontSize: typography.sm.fontSize }}>Aucun son trouvé.</p>
                )}
              </div>
            )}
          </Section>
        )}

        {/* ── Users ── */}
        {tab === 'users' && (
          <Section title="Membres">
            {loadingUsers ? (
              <div style={{ color: colors.textMuted, fontSize: typography.sm.fontSize }}>Chargement…</div>
            ) : (
              <div style={{ background: colors.surface, borderRadius: radius.md, border: `0.5px solid ${colors.border}`, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 100px', padding: `${spacing.sm}px ${spacing.md}px`, borderBottom: `0.5px solid ${colors.border}` }}>
                  {['Membre', 'Pays', 'Sons', 'Écoutes', 'Inscrit'].map((h) => (
                    <span key={h} style={{ color: colors.textMuted, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
                  ))}
                </div>
                {users.map((u) => (
                  <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 100px', padding: `${spacing.sm}px ${spacing.md}px`, borderBottom: `0.5px solid ${colors.border}`, alignItems: 'center' }}>
                    <div>
                      <div style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 500 }}>{u.display_name}</div>
                      <div style={{ color: colors.textMuted, fontSize: 11 }}>@{u.username}</div>
                    </div>
                    <span style={{ color: colors.textSecondary, fontSize: 12 }}>{u.country ?? '—'}</span>
                    <span style={{ color: colors.textSecondary, fontSize: 12 }}>{u.sound_count}</span>
                    <span style={{ color: colors.textSecondary, fontSize: 12 }}>{fmt(u.total_plays)}</span>
                    <span style={{ color: colors.textMuted, fontSize: 11 }}>{timeAgo(u.created_at)}</span>
                  </div>
                ))}
                {users.length === 0 && (
                  <p style={{ color: colors.textMuted, textAlign: 'center', padding: spacing.xl, fontSize: typography.sm.fontSize }}>Aucun membre.</p>
                )}
              </div>
            )}
          </Section>
        )}

        {/* ── Tools ── */}
        {tab === 'tools' && (
          <>
            <Section title="Remplissage automatique des genres">
              <div style={{ background: colors.surface, border: `0.5px solid ${colors.border}`, borderRadius: radius.md, padding: spacing.lg }}>
                <p style={{ color: colors.textSecondary, fontSize: typography.sm.fontSize, margin: `0 0 ${spacing.md}px` }}>
                  Cherche le genre de chaque son sans genre via MusicBrainz → Last.fm → OpenAI et met à jour la base de données.
                  MusicBrainz impose ~1 req/s — compter environ 1 seconde par son.
                  {stats && stats.soundsNoGenre > 0 && (
                    <span style={{ color: colors.error }}> {stats.soundsNoGenre} sons sans genre actuellement.</span>
                  )}
                </p>
                <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ color: colors.textMuted, fontSize: 11, display: 'block', marginBottom: 4 }}>Sons à traiter</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={genreLimit}
                      onChange={(e) => setGenreLimit(Number(e.target.value))}
                      style={{ ...inputStyle, width: 80 }}
                    />
                  </div>
                  <button
                    onClick={runFillGenres}
                    disabled={genreRunning}
                    style={{ marginTop: 18, padding: `${spacing.sm}px ${spacing.lg}px`, borderRadius: radius.md, border: 'none', background: genreRunning ? colors.surfaceElevated : 'var(--accent)', color: genreRunning ? colors.textMuted : '#fff', fontSize: typography.sm.fontSize, fontWeight: 600, cursor: genreRunning ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                  >
                    {genreRunning ? `En cours… (~${genreLimit}s)` : 'Lancer'}
                  </button>
                </div>

                {genreReport && (
                  <div style={{ marginTop: spacing.lg, display: 'flex', gap: spacing.md, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Traités', value: genreReport.total },
                      { label: 'Genres trouvés', value: genreReport.updated, color: colors.success },
                      { label: 'Sans résultat', value: genreReport.skipped, color: colors.textMuted },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: colors.background, borderRadius: radius.sm, padding: `${spacing.sm}px ${spacing.md}px`, textAlign: 'center', minWidth: 80 }}>
                        <div style={{ color: color ?? colors.textPrimary, fontSize: 20, fontWeight: 800 }}>{value}</div>
                        <div style={{ color: colors.textMuted, fontSize: 11 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>

            <Section title="Liens directs">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.md }}>
                {[
                  { label: 'Page d\'accueil', href: '/feed' },
                  { label: 'Découvrir', href: '/browse' },
                  { label: 'Bibliothèque', href: '/library' },
                  { label: 'Uploader un son', href: '/upload' },
                  { label: 'Page de genres (détaillée)', href: '/admin/genres' },
                ].map(({ label, href }) => (
                  <a
                    key={href}
                    href={href}
                    style={{ padding: `${spacing.sm}px ${spacing.md}px`, background: colors.surface, border: `0.5px solid ${colors.border}`, borderRadius: radius.md, color: colors.textSecondary, fontSize: typography.sm.fontSize, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 10 }} />
                    {label}
                  </a>
                ))}
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}
