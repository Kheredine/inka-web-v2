'use client'
import { usePathname } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { MiniPlayer } from '@/components/audio/MiniPlayer'
import { QueuePanel } from '@/components/audio/QueuePanel'
import { UploadBadge } from '@/components/upload/UploadBadge'
import { FAB } from '@/components/ui/FAB'
import { ToastContainer } from '@/components/ui/Toast'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import { OfflineBanner } from '@/components/pwa/OfflineBanner'

const SHELL_EXCLUDED = ['/admin', '/login', '/register', '/reset-code', '/popular']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isShellless = SHELL_EXCLUDED.some((p) => pathname.startsWith(p))

  if (isShellless) return <>{children}</>

  return (
    <>
      <OfflineBanner />
      <main style={{ paddingBottom: 136 }}>{children}</main>
      <MiniPlayer />
      <QueuePanel />
      <UploadBadge />
      <FAB />
      <ToastContainer />
      <InstallPrompt />
      <Navbar />
    </>
  )
}
