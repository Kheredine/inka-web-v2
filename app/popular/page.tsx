'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { colors, spacing, radius, typography } from '@/lib/theme'
import { CoverArt } from '@/components/ui/CoverArt'
import { Sound } from '@/types'

export default function PopularPage() {
  const router = useRouter()
  const [sounds, setSounds] = useState<Sound[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/popular')
      .then((r) => r.json())
      .then((data) => setSounds(Array.isArray(data) ? data : []))
      .catch(() => setSounds([]))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <main style={{
      background: colors.background,
      minHeight: '100dvh',
      padding: `${spacing.lg}px`,
      boxSizing: 'border-box',
      maxWidth: 640,
      margin: '0 auto',
    }}>
      {/* Header */}
      <header style={{ marginBottom: spacing.xl, paddingTop: spacing.md }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
          <span style={{ fontSize: 22 }}>🔥</span>
          <h1 style={{
            color: colors.textPrimary,
            fontSize: typography.xxl.fontSize,
            fontWeight: 700,
            margin: 0,
            lineHeight: 1.1,
          }}>
            Popular Now
          </h1>
        </div>
        <p style={{
          color: colors.textMuted,
          fontSize: typography.sm.fontSize,
          margin: `${spacing.xs}px 0 0`,
          letterSpacing: '0.01em',
        }}>
          Les sons les plus écoutés
        </p>
        <div style={{
          marginTop: spacing.md,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{
            color: colors.primary,
            fontSize: typography.xs.fontSize,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>Inka</span>
          <span style={{
            width: 3, height: 3, borderRadius: '50%',
            background: colors.textMuted, display: 'inline-block',
          }} />
          <span style={{ color: colors.textMuted, fontSize: typography.xs.fontSize }}>
            Mis à jour en temps réel
          </span>
        </div>
      </header>

      {/* Ranked list */}
      {isLoading ? (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <li key={i} style={{
              display: 'flex', alignItems: 'center', gap: spacing.md,
              padding: `${spacing.md}px 0`,
              borderBottom: `0.5px solid ${colors.border}`,
            }}>
              <div style={{ width: 28, textAlign: 'right', flexShrink: 0 }}>
                <div style={{ height: 16, width: 20, borderRadius: radius.sm, background: colors.surfaceElevated, opacity: 0.5, marginLeft: 'auto' }} />
              </div>
              <div style={{ width: 48, height: 48, borderRadius: radius.sm, background: colors.surfaceElevated, opacity: 0.4, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ height: 13, width: '60%', borderRadius: radius.sm, background: colors.surfaceElevated, opacity: 0.5 }} />
                <div style={{ height: 11, width: '40%', borderRadius: radius.sm, background: colors.surfaceElevated, opacity: 0.3 }} />
              </div>
            </li>
          ))}
        </ol>
      ) : sounds.length === 0 ? (
        <div style={{ textAlign: 'center', color: colors.textMuted, fontSize: typography.base.fontSize, marginTop: spacing.xxl }}>
          Aucun son populaire pour l'instant
        </div>
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {sounds.map((s, i) => (
            <li
              key={s.id}
              onClick={() => router.push(`/player/${s.id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.md,
                padding: `${spacing.md}px 0`,
                borderBottom: `0.5px solid ${colors.border}`,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLLIElement).style.background = colors.surface
                ;(e.currentTarget as HTMLLIElement).style.borderRadius = `${radius.md}px`
                ;(e.currentTarget as HTMLLIElement).style.padding = `${spacing.md}px ${spacing.sm}px`
                ;(e.currentTarget as HTMLLIElement).style.margin = `0 -${spacing.sm}px`
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLLIElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLLIElement).style.borderRadius = '0'
                ;(e.currentTarget as HTMLLIElement).style.padding = `${spacing.md}px 0`
                ;(e.currentTarget as HTMLLIElement).style.margin = '0'
              }}
            >
              {/* Rank */}
              <div style={{
                width: 28,
                textAlign: 'right',
                flexShrink: 0,
                color: i < 3 ? colors.primary : colors.textMuted,
                fontSize: i < 3 ? typography.base.fontSize : typography.sm.fontSize,
                fontWeight: i < 3 ? 700 : 500,
                fontVariantNumeric: 'tabular-nums',
              }}>
                #{i + 1}
              </div>

              {/* Cover art */}
              <div style={{ width: 48, height: 48, borderRadius: radius.sm, overflow: 'hidden', flexShrink: 0 }}>
                <CoverArt title={s.title} artist={s.artist} genre={s.genre} size={48} />
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color: colors.textPrimary,
                  fontSize: typography.sm.fontSize,
                  fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {s.title}
                </div>
                <div style={{
                  color: colors.textSecondary,
                  fontSize: typography.xs.fontSize,
                  marginTop: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {s.artist}
                </div>
                {/* Play count */}
                {s.play_count > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                    <i className="fa-solid fa-headphones" style={{ fontSize: 9, color: colors.textMuted }} />
                    <span style={{ color: colors.textMuted, fontSize: 10 }}>
                      {s.play_count.toLocaleString()} écoutes
                    </span>
                  </div>
                )}
              </div>

              {/* Genre chip */}
              {s.genre && (
                <span style={{
                  fontSize: 9,
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  color: 'var(--accent)',
                  background: 'var(--accent-muted)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  textTransform: 'uppercase',
                }}>
                  {s.genre}
                </span>
              )}

              {/* Chevron */}
              <i className="fa-solid fa-chevron-right" style={{ color: colors.textMuted, fontSize: 11, flexShrink: 0 }} />
            </li>
          ))}
        </ol>
      )}

      {/* Footer CTA */}
      <footer style={{
        marginTop: spacing.xxl,
        paddingTop: spacing.lg,
        borderTop: `0.5px solid ${colors.border}`,
        textAlign: 'center',
      }}>
        <p style={{ color: colors.textMuted, fontSize: typography.sm.fontSize, margin: `0 0 ${spacing.md}px` }}>
          Tu veux découvrir encore plus de sons ?
        </p>
        <a
          href="/register"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: spacing.sm,
            padding: `${spacing.sm + 2}px ${spacing.xl}px`,
            borderRadius: radius.full,
            background: 'var(--accent-gradient)',
            color: '#fff',
            fontWeight: 600,
            fontSize: typography.sm.fontSize,
            textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(232,144,42,0.3)',
          }}
        >
          <i className="fa-solid fa-user-plus" style={{ fontSize: 13 }} />
          Rejoins Inka
        </a>
      </footer>
    </main>
  )
}
