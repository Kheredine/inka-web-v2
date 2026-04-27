'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { colors } from '@/lib/theme'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('inka_admin') === '1') {
      setAllowed(true)
    } else {
      router.replace('/login')
    }
  }, [])

  if (!allowed) {
    return (
      <div style={{ minHeight: '100dvh', background: colors.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: colors.textMuted, fontSize: 14 }}>Vérification…</span>
      </div>
    )
  }

  return <>{children}</>
}
