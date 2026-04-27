'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore, getDominantHue } from '@/stores/themeStore'

async function computeDominantHue(userId: string): Promise<number> {
  try {
    const [{ data: reactions }, { data: plays }] = await Promise.all([
      supabase.from('reactions').select('sound_id').eq('user_id', userId),
      supabase.from('play_history').select('sound_id').eq('user_id', userId)
        .order('played_at', { ascending: false }).limit(60),
    ])

    const ids = [...new Set([
      ...(reactions?.map((r: { sound_id: string }) => r.sound_id) ?? []),
      ...(plays?.map((p: { sound_id: string }) => p.sound_id) ?? []),
    ])]
    if (!ids.length) return 25

    // Try to get themes + mood (may not exist if DB columns not yet created)
    const { data: sounds, error } = await supabase
      .from('sounds')
      .select('themes, mood, genre')
      .in('id', ids)

    if (error || !sounds?.length) return 25

    const words: string[] = []
    sounds.forEach((s: { themes?: string[]; mood?: string; genre?: string }) => {
      if (Array.isArray(s.themes)) words.push(...s.themes)
      if (s.mood) words.push(...s.mood.split(',').map((m: string) => m.trim()))
      // Fallback: use genre as a rough proxy for theme
      if (s.genre) words.push(s.genre)
    })

    return getDominantHue(words)
  } catch {
    return 25
  }
}

export function ThemeColorProvider() {
  const profile = useAuthStore((s) => s.profile)
  const setAccentHue = useThemeStore((s) => s.setAccentHue)

  useEffect(() => {
    if (!profile) return
    computeDominantHue(profile.id).then(setAccentHue)
  }, [profile?.id])

  return null
}
