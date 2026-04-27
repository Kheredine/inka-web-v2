'use client'
import { usePathname } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { MiniPlayer } from '@/components/audio/MiniPlayer'
import { UploadBadge } from '@/components/upload/UploadBadge'
import { FAB } from '@/components/ui/FAB'
import { ToastContainer } from '@/components/ui/Toast'

const SHELL_EXCLUDED = ['/admin', '/login', '/register', '/reset-code', '/popular']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isShellless = SHELL_EXCLUDED.some((p) => pathname.startsWith(p))

  if (isShellless) return <>{children}</>

  return (
    <>
      <main style={{ paddingBottom: 136 }}>{children}</main>
      <MiniPlayer />
      <UploadBadge />
      <FAB />
      <ToastContainer />
      <Navbar />
    </>
  )
}
