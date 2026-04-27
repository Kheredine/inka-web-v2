'use client'
import { create } from 'zustand'
import { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Profile } from '@/types'

function usernameToEmail(username: string): string {
  return `${username.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}@inka.app`
}

interface AuthState {
  session: Session | null
  profile: Profile | null
  isLoading: boolean
  setSession: (session: Session | null) => void
  setProfile: (profile: Profile | null) => void
  fetchProfile: (userId: string) => Promise<void>
  signIn: (username: string, pin: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  isLoading: true,

  setSession: (session) => set((state) => ({
    session,
    profile: state.profile && session && state.profile.id === session.user.id
      ? { ...state.profile, avatar_url: session.user.user_metadata?.avatar_url ?? state.profile.avatar_url ?? null }
      : state.profile,
  })),
  setProfile: (profile) => set({ profile }),

  fetchProfile: async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) {
      const session = get().session
      set({
        profile: {
          ...data,
          avatar_url: session?.user.id === userId
            ? (session.user.user_metadata?.avatar_url ?? data.avatar_url ?? null)
            : (data.avatar_url ?? null),
        },
      })
    }
  },

  signIn: async (username, pin) => {
    const email = usernameToEmail(username)
    // Try padded format first (new accounts store pin+"00")
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pin + '00' })
    if (error) {
      // Fallback: old accounts stored the raw pin without padding
      const { data: data2, error: error2 } = await supabase.auth.signInWithPassword({ email, password: pin })
      if (error2) return { error: 'Nom ou code incorrect' }
      if (data2.session) {
        set({ session: data2.session })
        await get().fetchProfile(data2.session.user.id)
      }
      return { error: null }
    }
    if (data.session) {
      set({ session: data.session })
      await get().fetchProfile(data.session.user.id)
    }
    return { error: null }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, profile: null })
  },
}))
