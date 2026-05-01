import type { Metadata, Viewport } from 'next'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { AudioProvider } from '@/components/audio/AudioProvider'
import { ThemeColorProvider } from '@/components/layout/ThemeColorProvider'
import { AppShell } from '@/components/layout/AppShell'
import { PlayerShell } from '@/components/player/PlayerShell'
import { SWRProvider } from '@/lib/swr-provider'
import { colors } from '@/lib/theme'
import './globals.css'

export const metadata: Metadata = {
  title: 'Inka 🎵',
  description: 'Audio. Famille. Partage.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Inka 🎵',
  },
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/icon.svg',
  },
}

export const viewport: Viewport = {
  themeColor: colors.background,
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="/fa.min.css" />
        <link rel="icon" href="/icons/icon.svg" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
      </head>
      <body style={{ margin: 0, background: colors.background, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        {/* Default CSS accent variables — overridden dynamically by ThemeColorProvider */}
        <style>{`
          :root {
            --accent: #E8902A;
            --accent-dark: #B8701E;
            --accent-gradient: linear-gradient(135deg, #E8902A, #B8701E);
            --accent-glow: rgba(232, 144, 42, 0.35);
            --accent-muted: rgba(232, 144, 42, 0.15);
          }
        `}</style>
        <SWRProvider>
          <AuthGuard>
            <AudioProvider>
              <ThemeColorProvider />
              <AppShell>{children}</AppShell>
              <PlayerShell />
            </AudioProvider>
          </AuthGuard>
        </SWRProvider>
      </body>
    </html>
  )
}
