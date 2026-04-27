'use client'
import { useState } from 'react'
import { colors, spacing, radius, typography } from '@/lib/theme'

interface SoundResult {
  id: string
  title: string
  artist: string
  genre: string | null
  source: 'musicbrainz' | 'lastfm' | 'openai' | 'none'
}

interface Report {
  total: number
  updated: number
  skipped: number
  results: SoundResult[]
}

const SOURCE_LABEL: Record<string, string> = {
  musicbrainz: 'MusicBrainz',
  lastfm: 'Last.fm',
  openai: 'OpenAI',
  none: '—',
}

const SOURCE_COLOR: Record<string, string> = {
  musicbrainz: '#4CAF50',
  lastfm: '#E84393',
  openai: '#10A37F',
  none: colors.textMuted,
}

export default function FillGenresPage() {
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setLoading(true)
    setReport(null)
    setError(null)
    try {
      const res = await fetch('/api/admin/fill-genres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit }),
      })
      if (!res.ok) throw new Error(await res.text())
      setReport(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: `${spacing.xl}px ${spacing.lg}px`, paddingBottom: 120 }}>
      <h1 style={{ color: colors.textPrimary, fontSize: typography.xl.fontSize, fontWeight: 700, marginBottom: 4 }}>
        Remplissage automatique des genres
      </h1>
      <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, marginBottom: spacing.xl }}>
        Recherche les sons sans genre et tente de le trouver via MusicBrainz → Last.fm → OpenAI.
        MusicBrainz impose une limite de 1 req/s — prévoir ~1 sec par son.
      </p>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
        <div>
          <label style={{ color: colors.textMuted, fontSize: 11, display: 'block', marginBottom: 4 }}>
            Nombre de sons à traiter
          </label>
          <input
            type="number"
            min={1}
            max={200}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{
              width: 80, background: colors.surface, border: `0.5px solid ${colors.border}`,
              borderRadius: radius.sm, padding: '6px 10px', color: colors.textPrimary,
              fontSize: typography.sm.fontSize, outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>
        <button
          onClick={run}
          disabled={loading}
          style={{
            marginTop: 18,
            padding: `${spacing.sm}px ${spacing.lg}px`,
            borderRadius: radius.md, border: 'none',
            background: loading ? colors.surface : 'var(--accent)',
            color: loading ? colors.textMuted : '#fff',
            fontSize: typography.sm.fontSize, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}
        >
          {loading ? `Traitement en cours… (~${limit}s)` : 'Lancer'}
        </button>
      </div>

      {error && (
        <div style={{ background: `${colors.error}18`, border: `0.5px solid ${colors.error}`, borderRadius: radius.md, padding: spacing.md, color: colors.error, fontSize: typography.sm.fontSize, marginBottom: spacing.lg }}>
          {error}
        </div>
      )}

      {report && (
        <>
          {/* Summary */}
          <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.lg }}>
            {[
              { label: 'Sons traités', value: report.total },
              { label: 'Genres trouvés', value: report.updated, color: '#4CAF50' },
              { label: 'Sans résultat', value: report.skipped, color: colors.textMuted },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ flex: 1, background: colors.surface, borderRadius: radius.md, padding: spacing.md, border: `0.5px solid ${colors.border}`, textAlign: 'center' }}>
                <div style={{ color: color ?? colors.textPrimary, fontSize: 24, fontWeight: 700 }}>{value}</div>
                <div style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Results table */}
          <div style={{ background: colors.surface, borderRadius: radius.md, border: `0.5px solid ${colors.border}`, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 0, borderBottom: `0.5px solid ${colors.border}`, padding: `${spacing.sm}px ${spacing.md}px` }}>
              {['Titre', 'Artiste', 'Genre', 'Source'].map((h) => (
                <span key={h} style={{ color: colors.textMuted, fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
              ))}
            </div>
            {report.results.map((r) => (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 0, padding: `${spacing.sm}px ${spacing.md}px`, borderBottom: `0.5px solid ${colors.border}`, alignItems: 'center' }}>
                <span style={{ color: colors.textPrimary, fontSize: typography.sm.fontSize, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                <span style={{ color: colors.textSecondary, fontSize: typography.sm.fontSize, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.artist}</span>
                <span style={{ color: r.genre ? colors.textPrimary : colors.textMuted, fontSize: typography.sm.fontSize, paddingRight: spacing.md }}>
                  {r.genre ?? '—'}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 4,
                  background: r.source !== 'none' ? `${SOURCE_COLOR[r.source]}18` : 'transparent',
                  color: SOURCE_COLOR[r.source],
                  border: r.source !== 'none' ? `0.5px solid ${SOURCE_COLOR[r.source]}40` : 'none',
                  whiteSpace: 'nowrap',
                }}>
                  {SOURCE_LABEL[r.source]}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {!report && !loading && (
        <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, textAlign: 'center', marginTop: spacing.xxl }}>
          Aucun traitement lancé. Configure le nombre de sons puis clique sur Lancer.
        </p>
      )}
    </div>
  )
}
