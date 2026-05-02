'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { colors, spacing, radius, typography } from '@/lib/theme'

interface SpotifyTrack {
  id: string
  name: string
  artists: string[]
  album: string
  albumArt: string | null
  duration_ms: number
  spotifyUrl: string
}

interface SpotifyPlaylist {
  id: string
  name: string
  description: string
  image: string | null
  trackCount: number
  owner: string
  isPublic: boolean
  spotifyUrl: string
}

interface SpotifyAlbum {
  id: string
  name: string
  artists: string[]
  image: string | null
  albumType: string
  releaseDate: string
  totalTracks: number
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Chargement...</div>}>
      <SettingsContent />
    </Suspense>
  )
}

function SettingsContent() {
  const { profile, signOut } = useAuthStore()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [spotifyConnected, setSpotifyConnected] = useState(false)
  const [spotifyLoading, setSpotifyLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importStep, setImportStep] = useState<'idle' | 'loading' | 'preview' | 'done'>('idle')
  const [importData, setImportData] = useState<{
    likedTracks: SpotifyTrack[]
    playlists: SpotifyPlaylist[]
    albums: SpotifyAlbum[]
  }>({ likedTracks: [], playlists: [], albums: [] })
  const [importError, setImportError] = useState<string | null>(null)

  // Check URL params for Spotify connection result
  useEffect(() => {
    if (searchParams.get('spotify_connected')) {
      setSpotifyConnected(true)
      setSpotifyLoading(false)
      window.history.replaceState({}, '', '/settings')
    }
    if (searchParams.get('spotify_error')) {
      setImportError(searchParams.get('spotify_error'))
      setSpotifyLoading(false)
      window.history.replaceState({}, '', '/settings')
    }
  }, [searchParams])

  // Check Spotify connection status
  const checkSpotifyStatus = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) { setSpotifyLoading(false); return }

      const res = await fetch('/api/spotify/status', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setSpotifyConnected(data.connected)
      }
    } catch {
      // ignore
    } finally {
      setSpotifyLoading(false)
    }
  }, [])

  useEffect(() => { checkSpotifyStatus() }, [checkSpotifyStatus])

  const handleConnectSpotify = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) return

      const res = await fetch('/api/spotify/auth', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        window.location.href = data.authUrl
      }
    } catch (err) {
      setImportError('Failed to connect to Spotify')
    }
  }

  const handleDisconnectSpotify = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) return

      await fetch('/api/spotify/status', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setSpotifyConnected(false)
      setImportStep('idle')
      setImportData({ likedTracks: [], playlists: [], albums: [] })
    } catch {
      // ignore
    }
  }

  const handleImport = async () => {
    setImportStep('loading')
    setImportError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) return

      const res = await fetch('/api/spotify/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'all' }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Import failed')
      }

      const data = await res.json()
      setImportData({
        likedTracks: (data.likedTracks as SpotifyTrack[]) ?? [],
        playlists: (data.playlists as SpotifyPlaylist[]) ?? [],
        albums: (data.albums as SpotifyAlbum[]) ?? [],
      })
      setImportStep('preview')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
      setImportStep('idle')
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  return (
    <div style={{ padding: spacing.lg, maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl }}>
        <button onClick={() => router.back()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textPrimary, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="fa-solid fa-arrow-left" />
        </button>
        <h1 style={{ color: colors.textPrimary, fontSize: typography.lg.fontSize, fontWeight: 700, margin: 0 }}>Paramètres</h1>
      </div>

      {/* Profile card */}
      <div style={{ background: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.xl, border: `1px solid ${colors.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
          <UserAvatar
            username={profile?.username ?? '?'}
            displayName={profile?.display_name}
            size={56}
          />
          <div>
            <div style={{ color: colors.textPrimary, fontSize: typography.md.fontSize, fontWeight: 600 }}>{profile?.display_name}</div>
            <div style={{ color: colors.textMuted, fontSize: typography.sm.fontSize }}>@{profile?.username}</div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div style={{ background: colors.surface, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.xl, border: `1px solid ${colors.border}` }}>
        {[
          { label: 'Nom affiché', value: profile?.display_name ?? '—' },
          { label: "Nom d'utilisateur", value: `@${profile?.username ?? '—'}` },
          { label: 'Pays', value: profile?.country ?? '—' },
        ].map((row, i, arr) => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${spacing.md}px ${spacing.lg}px`, borderBottom: i < arr.length - 1 ? `1px solid ${colors.border}` : 'none' }}>
            <span style={{ color: colors.textMuted, fontSize: typography.sm.fontSize }}>{row.label}</span>
            <span style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* ── Spotify Integration ── */}
      <div style={{ background: colors.surface, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.xl, border: `1px solid ${colors.border}` }}>
        <div style={{ padding: spacing.lg, borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
            <i className="fa-brands fa-spotify" style={{ fontSize: 28, color: '#1DB954' }} />
            <div>
              <div style={{ color: colors.textPrimary, fontSize: typography.md.fontSize, fontWeight: 600 }}>Spotify</div>
              <div style={{ color: colors.textMuted, fontSize: typography.xs.fontSize }}>
                {spotifyConnected ? 'Connecté' : 'Importe tes titres Spotify dans Inka'}
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
                <button
                  onClick={handleImport}
                  style={{
                    flex: 1, padding: `${spacing.sm}px ${spacing.md}px`,
                    borderRadius: radius.md, background: '#1DB954',
                    border: 'none', color: '#fff', fontSize: typography.sm.fontSize,
                    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <i className="fa-solid fa-download" style={{ marginRight: 6 }} />
                  Importer mes données
                </button>
              )}
              <button
                onClick={handleDisconnectSpotify}
                style={{
                  padding: `${spacing.sm}px ${spacing.md}px`,
                  borderRadius: radius.md, background: 'transparent',
                  border: `1px solid ${colors.border}`, color: colors.textMuted,
                  fontSize: typography.sm.fontSize, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Déconnecter
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectSpotify}
              style={{
                width: '100%', padding: `${spacing.sm}px ${spacing.md}px`,
                borderRadius: radius.md, background: '#1DB954',
                border: 'none', color: '#fff', fontSize: typography.sm.fontSize,
                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <i className="fa-brands fa-spotify" />
              Connecter Spotify
            </button>
          )}
        </div>

        {/* Import loading state */}
        {importStep === 'loading' && (
          <div style={{ padding: spacing.xl, textAlign: 'center' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: `3px solid ${colors.border}`,
              borderTopColor: '#1DB954',
              animation: 'spin 1s linear infinite',
              margin: '0 auto',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, marginTop: spacing.md }}>
              Importation en cours depuis Spotify...
            </p>
          </div>
        )}

        {/* Import preview */}
        {importStep === 'preview' && (
          <div>
            {/* Liked tracks */}
            {importData.likedTracks.length > 0 && (
              <div style={{ borderBottom: `1px solid ${colors.border}` }}>
                <div style={{ padding: `${spacing.sm}px ${spacing.lg}px`, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                  <i className="fa-solid fa-heart" style={{ color: '#1DB954', fontSize: 14 }} />
                  <span style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 600 }}>
                    Titres likés ({importData.likedTracks.length})
                  </span>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {importData.likedTracks.slice(0, 20).map(t => (
                    <div key={t.id} style={{
                      display: 'flex', alignItems: 'center', gap: spacing.sm,
                      padding: `${spacing.xs}px ${spacing.lg}px`,
                      borderBottom: `0.5px solid ${colors.border}`,
                    }}>
                      {t.albumArt ? (
                        <img src={t.albumArt} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: 4, background: colors.surface }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.name}
                        </div>
                        <div style={{ color: colors.textMuted, fontSize: 10 }}>
                          {t.artists.join(', ')}
                        </div>
                      </div>
                    </div>
                  ))}
                  {importData.likedTracks.length > 20 && (
                    <div style={{ padding: `${spacing.xs}px ${spacing.lg}px`, color: colors.textMuted, fontSize: 11, textAlign: 'center' }}>
                      +{importData.likedTracks.length - 20} autres titres
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Playlists */}
            {importData.playlists.length > 0 && (
              <div style={{ borderBottom: `1px solid ${colors.border}` }}>
                <div style={{ padding: `${spacing.sm}px ${spacing.lg}px`, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                  <i className="fa-solid fa-list" style={{ color: '#1DB954', fontSize: 14 }} />
                  <span style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 600 }}>
                    Playlists ({importData.playlists.length})
                  </span>
                </div>
                {importData.playlists.map(p => (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: spacing.sm,
                    padding: `${spacing.xs}px ${spacing.lg}px`,
                    borderBottom: `0.5px solid ${colors.border}`,
                  }}>
                    {p.image ? (
                      <img src={p.image} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: 4, background: colors.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="fa-solid fa-music" style={{ fontSize: 12, color: colors.textMuted }} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </div>
                      <div style={{ color: colors.textMuted, fontSize: 10 }}>
                        {p.trackCount} titres · par {p.owner}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Albums */}
            {importData.albums.length > 0 && (
              <div>
                <div style={{ padding: `${spacing.sm}px ${spacing.lg}px`, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                  <i className="fa-solid fa-compact-disc" style={{ color: '#1DB954', fontSize: 14 }} />
                  <span style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 600 }}>
                    Albums sauvegardés ({importData.albums.length})
                  </span>
                </div>
                {importData.albums.slice(0, 10).map(a => (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: spacing.sm,
                    padding: `${spacing.xs}px ${spacing.lg}px`,
                    borderBottom: `0.5px solid ${colors.border}`,
                  }}>
                    {a.image ? (
                      <img src={a.image} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: 4, background: colors.surface }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.name}
                      </div>
                      <div style={{ color: colors.textMuted, fontSize: 10 }}>
                        {a.artists.join(', ')} · {a.totalTracks} titres
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Done button */}
            <div style={{ padding: spacing.md }}>
              <button
                onClick={() => setImportStep('done')}
                style={{
                  width: '100%', padding: spacing.md,
                  borderRadius: radius.md, background: '#1DB954',
                  border: 'none', color: '#fff', fontSize: typography.sm.fontSize,
                  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <i className="fa-solid fa-check" style={{ marginRight: 6 }} />
                Vu — Retourner aux paramètres
              </button>
            </div>
          </div>
        )}

        {/* Done state */}
        {importStep === 'done' && (
          <div style={{ padding: spacing.lg, textAlign: 'center' }}>
            <i className="fa-solid fa-circle-check" style={{ fontSize: 32, color: '#1DB954', marginBottom: spacing.sm }} />
            <p style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, fontWeight: 600 }}>
              Import Spotify terminé !
            </p>
            <p style={{ color: colors.textMuted, fontSize: typography.xs.fontSize, marginTop: spacing.xs }}>
              Tes titres likés, playlists et albums sont visibles dans ta Bibliothèque.
            </p>
            <button
              onClick={() => router.push('/library')}
              style={{
                marginTop: spacing.md, padding: `${spacing.sm}px ${spacing.lg}px`,
                borderRadius: radius.md, background: 'var(--accent)',
                border: 'none', color: '#fff', fontSize: typography.sm.fontSize,
                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Ouvrir la Bibliothèque
            </button>
          </div>
        )}

        {/* Error */}
        {importError && (
          <div style={{ padding: spacing.md, background: 'rgba(239,68,68,0.1)', margin: spacing.md, borderRadius: radius.md }}>
            <p style={{ color: colors.error, fontSize: typography.sm.fontSize, margin: 0 }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }} />
              {importError}
            </p>
          </div>
        )}
      </div>

      {/* Sign out */}
      <Button label="Se déconnecter" onPress={handleSignOut} variant="ghost"
        style={{ border: `1px solid ${colors.error}`, color: colors.error }} />
    </div>
  )
}