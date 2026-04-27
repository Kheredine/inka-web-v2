'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useInboxStore } from '@/stores/inboxStore'
import { Badge } from '@/components/ui/Badge'
import { colors } from '@/lib/theme'

const NAV = [
  { href: '/browse',  icon: 'fa-house',             label: 'Accueil' },
  { href: '/feed',    icon: 'fa-rss',               label: 'Feed' },
  { href: '/library', icon: 'fa-music',             label: 'Bibliothèque' },
  { href: '/inbox',   icon: 'fa-bell',              label: 'Activité' },
]

export function Navbar() {
  const pathname = usePathname()
  const unreadCount = useInboxStore((s) => s.unreadCount)

  const authPaths = ['/login', '/register', '/reset-code']
  if (authPaths.some((p) => pathname.startsWith(p))) return null

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 64,
      background: colors.surfaceElevated,
      borderTop: `0.5px solid ${colors.border}`,
      display: 'flex',
      alignItems: 'center',
      zIndex: 50,
    }}>
      {NAV.map(({ href, icon, label }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        const isInbox = href === '/inbox'
        return (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              textDecoration: 'none',
              padding: '10px 0 8px',
              position: 'relative',
            }}
          >
            <div style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              width: active ? 20 : 0, height: 2,
              background: 'var(--accent)', borderRadius: '0 0 2px 2px',
              transition: 'width var(--ease-enter)',
            }} />
            <i
              className={`fa-solid ${icon}`}
              style={{ fontSize: 18, color: active ? 'var(--accent)' : colors.textMuted, transition: 'color var(--ease-default)' }}
            />
            <span style={{
              fontSize: 10, color: active ? 'var(--accent)' : colors.textMuted,
              fontWeight: active ? 600 : 400, letterSpacing: active ? '0.01em' : 0,
              transition: 'color var(--ease-default)', whiteSpace: 'nowrap',
            }}>
              {label}
            </span>
            {isInbox && unreadCount > 0 && (
              <Badge count={unreadCount} style={{ position: 'absolute', top: 4, right: '50%', transform: 'translateX(12px)' }} />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
