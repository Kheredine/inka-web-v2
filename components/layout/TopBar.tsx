'use client'
import Link from 'next/link'
import { useAuthStore } from '@/stores/authStore'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { colors, spacing, radius, typography } from '@/lib/theme'

export interface TopBarSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  focused?: boolean
  onFocus?: () => void
  onBlur?: () => void
}

interface TopBarProps {
  title: string
  search?: TopBarSearchProps
  /** Extra controls rendered inline after the search bar (e.g. a filter button) */
  afterSearch?: React.ReactNode
  /** Extra content rendered inside the sticky container, below the search row */
  children?: React.ReactNode
}

export function TopBar({ title, search, afterSearch, children }: TopBarProps) {
  const profile = useAuthStore((s) => s.profile)

  return (
    <div style={{
      position: 'sticky', top: 0,
      background: `${colors.background}ee`,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      zIndex: 10,
      borderBottom: `0.5px solid ${colors.border}`,
      padding: `${spacing.md}px ${spacing.lg}px`,
      display: 'flex',
      flexDirection: 'column',
      gap: spacing.md,
    }}>
      {/* Logo · page title · profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        <div style={{
          width: 30, height: 30, borderRadius: radius.md,
          background: 'var(--accent-gradient)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 900, lineHeight: 1 }}>I</span>
        </div>

        <h1 style={{
          color: colors.textPrimary, fontSize: typography.xl.fontSize,
          fontWeight: 800, letterSpacing: 1, margin: 0, flex: 1,
        }}>
          {title}
        </h1>

        {profile && (
          <Link href={`/profile/${profile.id}`} style={{
            display: 'flex', alignItems: 'center', gap: spacing.sm,
            textDecoration: 'none', color: colors.textPrimary, flexShrink: 0,
          }}>
            <span className="topbar-profile-name" style={{
              fontSize: typography.sm.fontSize, fontWeight: 700,
              maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {profile.display_name}
            </span>
            <UserAvatar
              username={profile.username}
              displayName={profile.display_name}
              avatarUrl={profile.avatar_url}
              size={32}
            />
          </Link>
        )}
      </div>

      {/* Search row (Home + Feed only) */}
      {search && (
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            background: colors.surface,
            borderRadius: radius.full,
            padding: `0 ${spacing.md}px`,
            border: `0.5px solid ${search.focused ? 'var(--accent)' : colors.border}`,
            boxShadow: search.focused
              ? '0 0 0 3px rgba(232,144,42,0.12), inset 0 0 0 1px rgba(232,144,42,0.2)'
              : 'none',
            height: 40,
            flex: 1,
            transition: 'border-color var(--ease-default), box-shadow var(--ease-default)',
          }}>
            <i className="fa-solid fa-magnifying-glass" style={{
              color: search.focused ? 'var(--accent)' : colors.textMuted,
              marginRight: spacing.sm, fontSize: 13,
              transition: 'color var(--ease-default)',
            }} />
            <input
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              onFocus={search.onFocus}
              onBlur={search.onBlur}
              placeholder={search.placeholder ?? 'Rechercher…'}
              style={{
                flex: 1, background: 'transparent', border: 'none',
                outline: 'none', color: colors.textPrimary,
                fontSize: typography.sm.fontSize, fontFamily: 'inherit', minWidth: 0,
              }}
            />
            {search.value && (
              <button
                onClick={() => search.onChange('')}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: colors.textMuted, fontSize: 13, padding: 4, display: 'flex',
                }}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>
          {afterSearch}
        </div>
      )}

      {children}

      <style jsx>{`
        @media (max-width: 640px) {
          .topbar-profile-name {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
