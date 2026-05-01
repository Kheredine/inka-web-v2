'use client'
/**
 * AudioProvider — mounted ONCE in the root layout.
 *
 * SINGLE AUDIO ELEMENT ARCHITECTURE
 * ──────────────────────────────────
 * One <audio> element lives for the entire session. Track switches change .src only.
 * iOS/Android only allow continued playback on the original user-gesture element.
 *
 * DESYNC PREVENTION
 * ─────────────────
 * opIdRef: every playSoundAtIndex call claims a monotonically-increasing ID.
 *   After each await, the call checks whether it's still the latest — if not, it
 *   aborts. This handles rapid clicks: only the last-clicked song actually plays.
 *
 * playingRef: set synchronously (before any await) to the sound.id being loaded.
 *   The currentSound effect checks this to distinguish "store update from user click"
 *   vs "store update from playSoundAtIndex itself" — the latter must not re-trigger
 *   a second play (which would cause the onEnded auto-advance to double-play).
 *
 * loadingRef: true while URL resolution is in flight. Prevents the isPlaying effect
 *   from calling audio.play() on the old src while a new one is being loaded.
 */
import { useEffect, useRef } from 'react'
import { usePlayerStore } from '@/stores/playerStore'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import type { Sound } from '@/types'
import type { RepeatMode, ShuffleMode } from '@/stores/playerStore'

// ── Signed-URL cache ──────────────────────────────────────────────────────────
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()
const preloadInProgress = new Set<string>()

async function resolveAudioUrl(url: string): Promise<string | undefined> {
  const cached = signedUrlCache.get(url)
  if (cached && Date.now() < cached.expiresAt) return cached.url

  const cache = (resolved: string) => {
    signedUrlCache.set(url, { url: resolved, expiresAt: Date.now() + 50 * 60 * 1000 })
    return resolved
  }

  // R2: just a URL string — no network needed for resolution
  if (url.startsWith('r2:')) {
    return cache(`/api/audio?r2=${encodeURIComponent(url.slice(3))}`)
  }

  const makeSignedUrl = async (bucket: string, path: string) => {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
    return data?.signedUrl
  }

  try {
    const parsed = new URL(url)
    const signed = parsed.pathname.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+)/)
    if (signed) {
      const su = await makeSignedUrl(signed[1], decodeURIComponent(signed[2]))
      return su ? cache(`/api/audio?url=${encodeURIComponent(su)}`) : undefined
    }
    const pub = parsed.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/)
    if (pub) {
      const su = await makeSignedUrl(pub[1], decodeURIComponent(pub[2]))
      return su ? cache(`/api/audio?url=${encodeURIComponent(su)}`) : undefined
    }
    return cache(`/api/audio?url=${encodeURIComponent(url)}`)
  } catch {
    const { data } = await supabase.storage.from('audio-files').createSignedUrl(url, 3600)
    return data?.signedUrl
      ? cache(`/api/audio?url=${encodeURIComponent(data.signedUrl)}`)
      : undefined
  }
}

export function preloadAudioUrl(url: string): void {
  if (preloadInProgress.has(url) || signedUrlCache.has(url)) return
  preloadInProgress.add(url)
  resolveAudioUrl(url).finally(() => preloadInProgress.delete(url))
}

// ── Lock-screen artwork (Canvas → PNG data URL) ───────────────────────────────
function makeArtworkUrl(title: string, artist: string): string {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 256; canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    let h = 0
    for (const c of `${title}|${artist}`) h = Math.abs((h * 31 + c.charCodeAt(0)) & 0xffffff)
    const hue = h % 360
    const bg = ctx.createLinearGradient(0, 0, 256, 256)
    bg.addColorStop(0, `hsl(${hue},55%,20%)`)
    bg.addColorStop(1, `hsl(${(hue + 40) % 360},40%,12%)`)
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 256)
    const glow = ctx.createRadialGradient(128, 128, 0, 128, 128, 120)
    glow.addColorStop(0, `hsla(${hue},70%,50%,0.25)`)
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 256, 256)
    ctx.fillStyle = `hsl(${hue},72%,78%)`
    ctx.font = 'bold 120px Inter,system-ui,sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText((title?.[0] ?? '♪').toUpperCase(), 128, 134)
    return canvas.toDataURL('image/png')
  } catch { return '' }
}

// ── Queue navigation helpers (pure — safe to call from any callback) ──────────
function calcNextIdx(qi: number, q: Sound[], shuffle: ShuffleMode, repeat: RepeatMode): number | null {
  if (!q.length) return null
  if (shuffle === 'shuffle' || shuffle === 'ai') {
    const pool = q.map((_, i) => i).filter((i) => i !== qi)
    if (!pool.length) return repeat === 'queue' ? 0 : null
    return pool[Math.floor(Math.random() * pool.length)]
  }
  const next = qi + 1
  if (next >= q.length) return repeat === 'queue' ? 0 : null
  return next
}

function calcPrevIdx(qi: number, position: number): number | null {
  if (position > 3) return null // restart current track
  return qi > 0 ? qi - 1 : null
}

// ── Component ─────────────────────────────────────────────────────────────────
export function AudioProvider({ children }: { children: React.ReactNode }) {
  const audioRef    = useRef<HTMLAudioElement | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const positionRef = useRef(0)

  // Operation ID — increments with every playSoundAtIndex call.
  // After each await, the call verifies it's still current; if not, it aborts.
  // This is what makes rapid clicks safe: only the latest call runs to completion.
  const opIdRef = useRef(0)

  // Set synchronously (before any await) to the sound.id being loaded.
  // The currentSound effect reads this to skip re-triggering when playSoundAtIndex
  // itself wrote the store update (onEnded auto-advance case).
  const playingRef = useRef<string | null>(null)

  // True while URL resolution is in flight — blocks isPlaying effect from
  // calling play() on the old src during a track switch.
  const loadingRef = useRef(false)

  const { profile } = useAuthStore()
  const {
    currentSound, isPlaying, repeatMode, shuffleMode,
    queue, queueIndex,
    setPosition, setDuration, reorderRemainingQueue,
  } = usePlayerStore()

  // Stable refs — event handlers and MediaSession read these without React
  const queueRef       = useRef(queue)
  const queueIndexRef  = useRef(queueIndex)
  const repeatModeRef  = useRef(repeatMode)
  const shuffleModeRef = useRef(shuffleMode)
  const profileRef     = useRef(profile)
  useEffect(() => { queueRef.current       = queue },       [queue])
  useEffect(() => { queueIndexRef.current  = queueIndex },  [queueIndex])
  useEffect(() => { repeatModeRef.current  = repeatMode },  [repeatMode])
  useEffect(() => { shuffleModeRef.current = shuffleMode }, [shuffleMode])
  useEffect(() => { profileRef.current     = profile },     [profile])

  // ── Core play function ────────────────────────────────────────────────────
  // Single entry point for all audio — user clicks, onEnded, MediaSession.
  // Never creates a new element; always mutates the existing one.
  const playSoundAtIndex = async (nextIdx: number) => {
    const q     = queueRef.current
    const sound = q[nextIdx]
    const audio = audioRef.current
    if (!sound || !audio) return

    // Claim this operation. Any concurrent call gets a higher ID and supersedes this one.
    const myOp = ++opIdRef.current

    // These three lines are synchronous — guaranteed to run before any await,
    // so the currentSound effect and isPlaying effect always see consistent state.
    queueIndexRef.current = nextIdx
    loadingRef.current    = true
    playingRef.current    = sound.id  // tells currentSound effect: "I wrote this, skip it"

    usePlayerStore.setState({ queueIndex: nextIdx, currentSound: sound, position: 0, isPlaying: true })

    const url = await resolveAudioUrl(sound.audio_url)
    loadingRef.current = false

    // Abort if a newer click superseded this operation, or element was destroyed
    if (myOp !== opIdRef.current || !audioRef.current) return
    if (!url) return

    // Stop current playback cleanly before swapping src
    audio.pause()
    audio.src = url
    audio.load()

    try {
      await audio.play()
    } catch (err) {
      if (myOp !== opIdRef.current) return // still superseded — don't touch state
      console.warn('[AudioProvider] play() rejected:', err)
      usePlayerStore.setState({ isPlaying: false })
      return
    }

    if (myOp !== opIdRef.current) return

    // Lock-screen metadata + artwork
    if ('mediaSession' in navigator) {
      const art = makeArtworkUrl(sound.title ?? '', sound.artist ?? '')
      navigator.mediaSession.metadata = new MediaMetadata({
        title:   sound.title  ?? '',
        artist:  sound.artist ?? '',
        album:   '',
        artwork: art ? [{ src: art, sizes: '256x256', type: 'image/png' }] : [],
      })
    }

    // Play history (non-blocking)
    if (profileRef.current) {
      supabase.from('play_history')
        .insert({ user_id: profileRef.current.id, sound_id: sound.id })
        .then(() => {})
    }

    // Warm up the URL cache for the next track so the transition is instant
    const preIdx = nextIdx + 1
    if (preIdx < q.length) resolveAudioUrl(q[preIdx].audio_url).catch(() => {})
  }

  // Always-current ref so event callbacks always call the latest closure
  const playSoundAtIndexRef = useRef(playSoundAtIndex)
  playSoundAtIndexRef.current = playSoundAtIndex

  // ── Create <audio> once, wire all persistent event listeners ─────────────
  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'auto'
    audioRef.current = audio

    const onEnded = () => {
      if (repeatModeRef.current === 'track') {
        audio.currentTime = 0
        audio.play().catch(() => {})
        return
      }
      const nextIdx = calcNextIdx(
        queueIndexRef.current, queueRef.current,
        shuffleModeRef.current, repeatModeRef.current,
      )
      if (nextIdx !== null) playSoundAtIndexRef.current(nextIdx)
    }

    const onPlay = () => {
      usePlayerStore.setState({ isPlaying: true })
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => {
        const pos = audio.currentTime
        positionRef.current = pos
        setPosition(pos)
        if ('mediaSession' in navigator && audio.duration && isFinite(audio.duration)) {
          try {
            navigator.mediaSession.setPositionState({
              duration: audio.duration, playbackRate: 1, position: Math.max(0, pos),
            })
          } catch { /* non-critical */ }
        }
      }, 500)
    }

    const onPause = () => {
      usePlayerStore.setState({ isPlaying: false })
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    }

    const onLoadedMetadata = () => setDuration(audio.duration || 0)

    const onError = () => {
      console.error('[AudioProvider] error:', audio.error?.code, audio.error?.message)
      usePlayerStore.setState({ isPlaying: false })
    }

    audio.addEventListener('ended',          onEnded)
    audio.addEventListener('play',           onPlay)
    audio.addEventListener('pause',          onPause)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('error',          onError)

    return () => {
      audio.removeEventListener('ended',          onEnded)
      audio.removeEventListener('play',           onPlay)
      audio.removeEventListener('pause',          onPause)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('error',          onError)
      audio.pause()
      audio.src = ''
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      audioRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── MediaSession action handlers ──────────────────────────────────────────
  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    navigator.mediaSession.setActionHandler('play', () => {
      audioRef.current?.play().catch(() => {})
    })
    navigator.mediaSession.setActionHandler('pause', () => {
      audioRef.current?.pause()
    })
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      const nextIdx = calcNextIdx(
        queueIndexRef.current, queueRef.current,
        shuffleModeRef.current, repeatModeRef.current,
      )
      if (nextIdx !== null) playSoundAtIndexRef.current(nextIdx)
    })
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      const prevIdx = calcPrevIdx(queueIndexRef.current, positionRef.current)
      if (prevIdx !== null) {
        playSoundAtIndexRef.current(prevIdx)
      } else if (audioRef.current) {
        audioRef.current.currentTime = 0
        usePlayerStore.setState({ position: 0 })
      }
    })
    navigator.mediaSession.setActionHandler('seekto', (d) => {
      if (d.seekTime != null && audioRef.current) {
        audioRef.current.currentTime = d.seekTime
        positionRef.current = d.seekTime
        setPosition(d.seekTime)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI Shuffle ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (shuffleMode !== 'ai' || !profile) return
    fetch(`/api/recommendations?userId=${profile.id}&limit=20`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.sounds?.length) reorderRemainingQueue(data.sounds) })
      .catch(() => {})
  }, [shuffleMode, profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-resume after interruption (phone call, notification) ────────────
  useEffect(() => {
    let wasPlaying = false
    const onVisibility = () => {
      if (document.hidden) {
        wasPlaying = !audioRef.current?.paused
      } else if (wasPlaying && audioRef.current?.paused) {
        audioRef.current.play().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // ── UI-triggered track change ─────────────────────────────────────────────
  // Fires when the user clicks a song (currentSound.id changes).
  // Skips if playSoundAtIndex itself wrote this currentSound update — that case
  // is an internal store sync (onEnded auto-advance), not a new user intent.
  useEffect(() => {
    if (!currentSound) return
    if (playingRef.current === currentSound.id) {
      playingRef.current = null // clear the guard; next user click will pass through
      return
    }
    playSoundAtIndexRef.current(queueIndexRef.current)
  }, [currentSound?.id, currentSound?.audio_url]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Play / pause sync (pause button, headphone buttons, etc.) ────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || loadingRef.current) return // don't interfere during a track switch
    if (isPlaying && audio.paused && audio.src)  audio.play().catch(() => {})
    if (!isPlaying && !audio.paused)             audio.pause()
  }, [isPlaying])

  // ── Global seek (ProgressBar → usePlayer.seekTo) ─────────────────────────
  useEffect(() => {
    const w = window as Window & { __inkaSeekTo?: (pos: number) => void }
    w.__inkaSeekTo = (pos: number) => {
      if (audioRef.current) audioRef.current.currentTime = pos
      positionRef.current = pos
      setPosition(pos)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>
}
