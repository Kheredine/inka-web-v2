'use client'
/**
 * AudioProvider — mounted ONCE in the root layout.
 * Owns the single Howl instance. All other components
 * read state from playerStore and call store actions.
 */
import { useEffect, useRef } from 'react'
import { Howl } from 'howler'
import { usePlayerStore } from '@/stores/playerStore'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'

// Cache signed URLs for 50 minutes (they last 60min, refresh before expiry)
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()
const preloadInProgress = new Set<string>()

async function resolveAudioUrl(url: string): Promise<string | undefined> {
  const cached = signedUrlCache.get(url)
  if (cached && Date.now() < cached.expiresAt) return cached.url

  const cache = (resolved: string) => {
    signedUrlCache.set(url, { url: resolved, expiresAt: Date.now() + 50 * 60 * 1000 })
    return resolved
  }

  // R2 path: stored as "r2:<object-key>" in the database
  if (url.startsWith('r2:')) {
    const key = url.slice(3)
    return cache(`/api/audio?r2=${encodeURIComponent(key)}`)
  }

  const createSignedUrl = async (bucket: string, filePath: string) => {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(filePath, 3600)
    return data?.signedUrl
  }

  // Legacy Supabase paths
  try {
    const parsed = new URL(url)
    const signedPath = parsed.pathname.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+)/)
    if (signedPath) {
      const bucket = signedPath[1]
      const filePath = decodeURIComponent(signedPath[2])
      const signedUrl = await createSignedUrl(bucket, filePath)
      return signedUrl ? cache(`/api/audio?url=${encodeURIComponent(signedUrl)}`) : undefined
    }
    const publicPath = parsed.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/)
    if (publicPath) {
      const bucket = publicPath[1]
      const filePath = decodeURIComponent(publicPath[2])
      const signedUrl = await createSignedUrl(bucket, filePath)
      return signedUrl ? cache(`/api/audio?url=${encodeURIComponent(signedUrl)}`) : undefined
    }
    return cache(`/api/audio?url=${encodeURIComponent(url)}`)
  } catch {
    const { data } = await supabase.storage.from('audio-files').createSignedUrl(url, 3600)
    return data?.signedUrl ? cache(`/api/audio?url=${encodeURIComponent(data.signedUrl)}`) : undefined
  }
}

export function preloadAudioUrl(url: string): void {
  if (preloadInProgress.has(url) || signedUrlCache.has(url)) return
  preloadInProgress.add(url)
  resolveAudioUrl(url).finally(() => preloadInProgress.delete(url))
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const howlRef = useRef<Howl | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { profile } = useAuthStore()

  const {
    currentSound,
    isPlaying,
    position,
    repeatMode,
    setPosition,
    setDuration,
    setIsPlaying,
    skipToNext,
  } = usePlayerStore()

  // ── Create / replace Howl when currentSound changes ─────────────────────────
  useEffect(() => {
    if (!currentSound) return

    let isCancelled = false
    let currentHowl: Howl | null = null

    if (howlRef.current) {
      howlRef.current.stop()
      howlRef.current.unload()
      howlRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    const getAudioFormat = (url: string): string | undefined => {
      const knownFormats = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac', 'webm', 'opus']
      try {
        const parsed = new URL(url)
        const ext = parsed.pathname.split('.').pop()?.toLowerCase()
        return ext && knownFormats.includes(ext) ? ext : undefined
      } catch {
        const path = url.split('?')[0]
        const ext = path.split('.').pop()?.toLowerCase()
        return ext && knownFormats.includes(ext) ? ext : undefined
      }
    }

    const initHowl = async () => {
      const audioUrl = await resolveAudioUrl(currentSound.audio_url)
      const audioFormat = getAudioFormat(currentSound.audio_url)
      if (isCancelled) return
      if (!audioUrl) {
        console.error('Invalid audio URL for current sound', currentSound)
        setIsPlaying(false)
        return
      }

      const howlOptions: any = {
        src: [audioUrl],
        html5: true,
        xhr: { withCredentials: false },
        ...(audioFormat ? { format: [audioFormat] } : {}),
        onload: () => setDuration(howl.duration()),
        onloaderror: (_soundId: number, err: unknown) => {
          console.error('Audio load error', err)
          setIsPlaying(false)
          howl.unload()
        },
        onplayerror: (_soundId: number, err: unknown) => {
          console.error('Audio play error', err)
          setIsPlaying(false)
          howl.unload()
        },
        onend: () => {
          if (repeatMode === 'track') {
            howl.seek(0)
            howl.play()
          } else {
            skipToNext()
          }
        },
        onplay: () => {
          setIsPlaying(true)
          intervalRef.current = setInterval(() => {
            setPosition(howl.seek() as number)
          }, 500)
        },
        onpause: () => {
          setIsPlaying(false)
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
        },
        onstop: () => {
          setIsPlaying(false)
          setPosition(0)
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
        },
      }

      const howl = new Howl(howlOptions)

      currentHowl = howl
      howlRef.current = howl
      howl.play()

      if (profile) {
        supabase.from('play_history').insert({ user_id: profile.id, sound_id: currentSound.id }).then(() => {})
      }
    }

    initHowl()

    return () => {
      isCancelled = true
      if (currentHowl) {
        currentHowl.stop()
        currentHowl.unload()
      }
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    }
  }, [currentSound?.id, currentSound?.audio_url]) // ← re-run when the song changes or its audio source changes

  // ── Sync play / pause ────────────────────────────────────────────────────────
  useEffect(() => {
    const howl = howlRef.current
    if (!howl) return
    if (isPlaying && !howl.playing()) {
      howl.play()
    } else if (!isPlaying && howl.playing()) {
      howl.pause()
    }
  }, [isPlaying])

  // ── Expose globals so components can seek and preload audio ──────────────────
  useEffect(() => {
    const w = window as Window & { __inkaSeekTo?: (pos: number) => void }
    w.__inkaSeekTo = (pos: number) => {
      if (howlRef.current) howlRef.current.seek(pos)
      setPosition(pos)
    }
  }, [])

  return <>{children}</>
}
