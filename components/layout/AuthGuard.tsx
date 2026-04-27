'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, setSession, fetchProfile, isLoading } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      useAuthStore.setState({ isLoading: false })
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else useAuthStore.setState({ isLoading: false })
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (isLoading) return
    const publicPaths = ['/login', '/register', '/reset-code', '/admin', '/popular']
    const isPublic = publicPaths.some((p) => pathname.startsWith(p))
    if (!session && !isPublic) {
      router.replace('/login')
    } else if (session && pathname.startsWith('/login')) {
      router.replace('/feed')
    }
  }, [session, isLoading, pathname])

  return <>{children}</>
}
