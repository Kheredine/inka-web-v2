// ── Background Audio Manager ─────────────────────────────────────────────────
// Prevents Killer #3 — audio stops when screen locks or tab is hidden.
// Four-layer defense: Media Session + AudioContext resume + Wake Lock + SW keepalive.
import { Howler } from 'howler'
import { audioEngine } from './audioEngine'
import { audioEvents } from './audioEvents'
import { useQueueStore } from '@/stores/queueStore'
import { usePlaybackStore } from '@/stores/playbackStore'
import type { UnifiedTrack } from '@/types/track'

class BackgroundAudioManager {
  private wakeLock: WakeLockSentinel | null = null
  private keepaliveInterval: ReturnType<typeof setInterval> | null = null
  private isInitialized = false

  async init(): Promise<void> {
    if (this.isInitialized) return
    this.isInitialized = true

    this.setupMediaSession()
    this.setupAudioContextLifecycle()
    this.setupKeepalive()

    document.addEventListener('visibilitychange', this.handleVisibilityChange)

    // Subscribe to audio events for metadata + wake lock management
    audioEvents.on('play', ({ track }) => {
      this.updateMetadata(track)
      this.requestWakeLock()
    })
    audioEvents.on('pause', () => {
      this.releaseWakeLock()
    })
  }

  // ── Media Session API: lock-screen controls + metadata ────────────────────

  private setupMediaSession(): void {
    if (!('mediaSession' in navigator)) return

    navigator.mediaSession.setActionHandler('play', () => audioEngine.play())
    navigator.mediaSession.setActionHandler('pause', () => audioEngine.pause())
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      const prev = useQueueStore.getState().previous()
      if (prev) audioEngine.playTrack(prev.track)
    })
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      const next = useQueueStore.getState().next()
      if (next) audioEngine.playTrack(next.track)
    })
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) audioEngine.seek(details.seekTime)
    })
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      audioEngine.seek(Math.max(0, audioEngine.getPosition() - (details.seekOffset ?? 10)))
    })
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      audioEngine.seek(Math.min(audioEngine.getDuration(), audioEngine.getPosition() + (details.seekOffset ?? 10)))
    })
  }

  updateMetadata(track: UnifiedTrack): void {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artists.join(', '),
      album: track.album || 'Inka',
      artwork: [
        { src: track.coverArt.small, sizes: '64x64', type: 'image/jpeg' },
        { src: track.coverArt.medium, sizes: '300x300', type: 'image/jpeg' },
        { src: track.coverArt.large, sizes: '640x640', type: 'image/jpeg' },
      ],
    })
    navigator.mediaSession.playbackState = usePlaybackStore.getState().isPlaying ? 'playing' : 'paused'
  }

  // ── AudioContext lifecycle: resume on user interaction ─────────────────────

  private setupAudioContextLifecycle(): void {
    const checkAndResume = () => {
      const ctx = Howler.ctx as AudioContext | undefined
      if (ctx?.state === 'suspended') ctx.resume()
    }
    // Resume AudioContext on any user gesture (browser policy)
    const events = ['click', 'touchstart', 'keydown'] as const
    events.forEach((evt) =>
      document.addEventListener(evt, checkAndResume, { passive: true })
    )
  }

  // ── Service Worker keepalive: prevent tab suspension ───────────────────────

  private setupKeepalive(): void {
    if (!('serviceWorker' in navigator)) return
    this.keepaliveInterval = setInterval(() => {
      if (navigator.serviceWorker.controller && usePlaybackStore.getState().isPlaying) {
        navigator.serviceWorker.controller.postMessage({ type: 'KEEPALIVE' })
      }
    }, 20_000)
  }

  // ── Wake Lock: keep screen on during playback (battery-respectful) ─────────

  private async requestWakeLock(): Promise<void> {
    if (!('wakeLock' in navigator)) return
    try {
      this.wakeLock = await navigator.wakeLock.request('screen')
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null
      })
    } catch (err) {
      // Wake lock denied — not critical, background audio still works
      console.log('[BGAudio] Wake lock denied:', err)
    }
  }

  private releaseWakeLock(): void {
    this.wakeLock?.release()
    this.wakeLock = null
  }

  // ── Visibility change handler ─────────────────────────────────────────────

  private handleVisibilityChange = async (): Promise<void> => {
    const ctx = Howler.ctx as AudioContext | undefined

    if (document.hidden) {
      // Tab hidden: ensure AudioContext stays alive
      if (ctx?.state === 'suspended') await ctx.resume()
      // Acquire wake lock if playing (keeps the SW alive)
      if (!this.wakeLock && usePlaybackStore.getState().isPlaying) {
        await this.requestWakeLock()
      }
    } else {
      // Tab visible: resume AudioContext if needed
      if (ctx?.state === 'suspended') await ctx.resume()
      // Update media session playback state
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState =
          usePlaybackStore.getState().isPlaying ? 'playing' : 'paused'
      }
    }
  }

  // ── Teardown ──────────────────────────────────────────────────────────────

  destroy(): void {
    this.releaseWakeLock()
    if (this.keepaliveInterval) clearInterval(this.keepaliveInterval)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    this.isInitialized = false
  }
}

export const backgroundAudio = new BackgroundAudioManager()