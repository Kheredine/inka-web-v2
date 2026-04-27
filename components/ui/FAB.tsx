'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function FAB() {
  const pathname = usePathname()

  const authPaths = ['/login', '/register', '/reset-code']
  if (pathname === '/upload' || authPaths.some((p) => pathname.startsWith(p))) {
    return null
  }

  return (
    <Link
      href="/upload"
      style={{
        position: 'fixed',
        bottom: 140,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'var(--accent-gradient)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textDecoration: 'none',
        zIndex: 45,
        boxShadow: '0 4px 20px var(--accent-glow), 0 2px 8px rgba(0,0,0,0.4)',
        color: '#FFFFFF',
        fontSize: 22,
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      aria-label="Uploader un son"
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement
        el.style.transform = 'scale(1.08)'
        el.style.boxShadow = '0 6px 28px var(--accent-glow), 0 2px 8px rgba(0,0,0,0.4)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement
        el.style.transform = 'scale(1)'
        el.style.boxShadow = '0 4px 20px var(--accent-glow), 0 2px 8px rgba(0,0,0,0.4)'
      }}
    >
      <i className="fa-solid fa-plus" />
    </Link>
  )
}
