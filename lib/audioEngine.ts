// ── Audio Engine ─────────────────────────────────────────────────────────────
// The single most important file in Inka V2.
// Implements: Request ID system, Dual Howl architecture, lifecycle management.
// Treat as untouchable once stable. Any change requires written justification.
//
// Killers prevented:
//   #1 — Wrong-Song-Showing Bug (Request ID)
//   #2 — Songs Stop Between Tracks (Dual Howl preload)
//   #4 — App Crashes After ~20 Songs (strict unload lifecycle)

import { Howl, Howler } from 'howler'
import { usePlaybackStore } from '@/stores/playbackStore'
import { useQueueStore } from '@/stores/queueStore'
import type { UnifiedTrack } from '@/types/track'
import { audioEvents } from './audioEvents'

class AudioEngine {
  private currentHowl: Howl | null = null
  private nextHowl: Howl | null = null
  private currentRequestId = ''
  private currentTrackId = ''
  private preloadedTrackId: string | null = null
  private retryCountMap = new Map<string, number>()
  private playStartTime = 0
  private playCountReported = false

  // ── Main entry: play a track ──────────────────────────────────────────────

  async playTrack(track: UnifiedTrack): Promise<void> {
    const requestId = crypto.randomUUID()
    this.currentRequestId = requestId
    this.currentTrackId = track.id
    this.playCountReported = false
    this.playStartTime = Date.now()

    usePlaybackStore.getState().setCurrentTrack(track)
    usePlaybackStore.getState().setBuffering(true)
    usePlaybackStore.getState().setError(null)
    usePlaybackStore.getState().setPlaying(false)

    // Fast path: track is already preloaded as nextHowl — crossfade
    if (this.nextHowl && this.preloadedTrackId === track.id) {
      this.crossfadeToNext(requestId)
      return
    }

    this.loadFresh(track, requestId)
  }

  // ── Fresh load (no preload available) ─────────────────────────────────────

  private loadFresh(track: UnifiedTrack, requestId: string): void {
    const oldHowl = this.currentHowl
    const oldNextHowl = this.nextHowl

    // Clean up preloaded howl if it's not what we need
    if (oldNextHowl && this.preloadedTrackId !== track.id) {
      oldNextHowl.unload()
      this.nextHowl = null
      this.preloadedTrackId = null
    }

    const store = usePlaybackStore.getState()

    this.currentHowl = new Howl({
      src: [track.audio.url],
      html5: true,
      preload: true,
      format: [track.audio.format],
      volume: store.isMuted ? 0 : store.volume,
      rate: store.playbackRate,

      onload: () => {
        if (this.currentRequestId !== requestId) {
          // Stale request — discard
          this.currentHowl?.unload()
          return
        }
        const dur = this.currentHowl?.duration() ?? 0
        usePlaybackStore.getState().setDuration(dur)
        usePlaybackStore.getState().setBuffering(false)
      },

      onplay: () => {
        if (this.currentRequestId !== requestId) return
        usePlaybackStore.getState().setPlaying(true)
        audioEvents.emit('play', { track })
        this.preloadNextTrack()
      },

      onpause: () => {
        if (this.currentRequestId !== requestId) return
        usePlaybackStore.getState().setPlaying(false)
        audioEvents.emit('pause', { track })
      },

      onend: () => {
        if (this.currentRequestId !== requestId) return
        audioEvents.emit('ended', { track })
        useQueueStore.getState().addToHistory(track.id)
        this.reportPlayCount(track)
        this.advanceQueue()
      },

      onloaderror: (_id, error) => {
        if (this.currentRequestId !== requestId) return
        this.handleLoadError(track, String(error), requestId)
      },

      onplayerror: (_id, error) => {
        if (this.currentRequestId !== requestId) return
        // AudioContext suspended — try resume + replay
        const ctx = Howler.ctx as AudioContext | undefined
        if (ctx?.state === 'suspended') {
          ctx.resume().then(() => {
            if (this.currentRequestId === requestId) {
              this.currentHowl?.play()
            }
          })
        } else {
          this.handleLoadError(track, String(error), requestId)
        }
      },
    })

    this.currentHowl.play()

    // 5-second grace for fallback before unloading old howl
    setTimeout(() => {
      oldHowl?.unload()
    }, 5000)
  }

  // ── Preload next track at volume 0 ────────────────────────────────────────

  preloadNextTrack(): void {
    const nextItems = useQueueStore.getState().getNextItems(1)
    if (nextItems.length === 0) return
    const nextTrack = nextItems[0].track

    // Already preloading/preloaded the right track
    if (this.preloadedTrackId === nextTrack.id) return

    // Different track preloaded — unload it
    if (this.nextHowl) {
      this.nextHowl.unload()
      this.nextHowl = null
    }

    this.nextHowl = new Howl({
      src: [nextTrack.audio.url],
      html5: true,
      preload: true,
      format: [nextTrack.audio.format],
      volume: 0,
    })
    this.preloadedTrackId = nextTrack.id
    audioEvents.emit('preload', { trackId: nextTrack.id })
  }

  // ── Crossfade current → next ──────────────────────────────────────────────

  private crossfadeToNext(requestId: string, fadeDuration = 2): void {
    if (!this.nextHowl || !this.currentHowl) {
      // Fallback: no valid howls, just play from the preloaded
      if (this.nextHowl) {
        const oldHowl = this.currentHowl
        this.currentHowl = this.nextHowl
        this.nextHowl = null
        this.preloadedTrackId = null
        this.attachPlaybackCallbacks(requestId)
        this.currentHowl.volume(usePlaybackStore.getState().volume)
        this.currentHowl.play()
        setTimeout(() => oldHowl?.unload(), 5000)
      }
      return
    }

    const targetVolume = usePlaybackStore.getState().volume
    const steps = 30
    const stepMs = (fadeDuration * 1000) / steps
    let step = 0

    this.nextHowl.volume(0)
    this.nextHowl.play()

    const tick = () => {
      step++
      const fadeOut = 1 - step / steps
      const fadeIn = step / steps

      this.currentHowl!.volume(targetVolume * fadeOut)
      this.nextHowl!.volume(targetVolume * fadeIn)

      if (step >= steps) {
        // Promote next → current
        const oldHowl = this.currentHowl
        this.currentHowl = this.nextHowl
        this.nextHowl = null
        this.preloadedTrackId = null

        this.attachPlaybackCallbacks(requestId)
        this.preloadNextTrack()

        // Unload old after grace period
        setTimeout(() => oldHowl?.unload(), 5000)
        return
      }
      setTimeout(tick, stepMs)
    }
    tick()
  }

  // ── Attach lifecycle callbacks to the promoted currentHowl ────────────────

  private attachPlaybackCallbacks(requestId: string): void {
    if (!this.currentHowl) return
    const track = usePlaybackStore.getState().currentTrack
    if (!track) return

    this.currentHowl.on('end', () => {
      if (this.currentRequestId !== requestId) return
      audioEvents.emit('ended', { track })
      useQueueStore.getState().addToHistory(track.id)
      this.reportPlayCount(track)
      this.advanceQueue()
    })

    this.currentHowl.on('play', () => {
      if (this.currentRequestId !== requestId) return
      usePlaybackStore.getState().setPlaying(true)
      audioEvents.emit('play', { track })
    })

    this.currentHowl.on('pause', () => {
      if (this.currentRequestId !== requestId) return
      usePlaybackStore.getState().setPlaying(false)
      audioEvents.emit('pause', { track })
    })
  }

  // ── Error handling with exponential backoff ───────────────────────────────

  private handleLoadError(track: UnifiedTrack, error: string, requestId: string): void {
    console.error(`[AudioEngine] Load error for "${track.title}":`, error)
    const retryCount = this.retryCountMap.get(track.id) ?? 0

    if (retryCount < 3) {
      this.retryCountMap.set(track.id, retryCount + 1)
      const backoff = 1000 * Math.pow(2, retryCount)
      console.log(`[AudioEngine] Retry ${retryCount + 1}/3 in ${backoff}ms`)
      setTimeout(() => {
        if (this.currentRequestId === requestId) {
          this.loadFresh(track, requestId)
        }
      }, backoff)
      return
    }

    // Exhausted retries
    this.retryCountMap.delete(track.id)
    usePlaybackStore.getState().setError(`Failed to load: ${track.title}`)
    usePlaybackStore.getState().setBuffering(false)
    audioEvents.emit('error', { track, error })
    // Auto-skip after 2 seconds
    setTimeout(() => this.advanceQueue(), 2000)
  }

  // ── Queue advancement ─────────────────────────────────────────────────────

  private advanceQueue(): void {
    const next = useQueueStore.getState().next()
    if (next) {
      this.playTrack(next.track)
    } else {
      usePlaybackStore.getState().setPlaying(false)
    }
  }

  // ── Play count reporting (after ≥30s of playback) ─────────────────────────

  private reportPlayCount(track: UnifiedTrack): void {
    if (this.playCountReported) return
    const elapsed = (Date.now() - this.playStartTime) / 1000
    if (elapsed >= 30) {
      this.playCountReported = true
      // Fire-and-forget API call
      fetch('/api/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sound_id: track.id }),
      }).catch(() => {
        // Silently fail — play count is non-critical
      })
    }
  }

  // ── Public API (used by components/UI) ────────────────────────────────────

  play(): void {
    const ctx = Howler.ctx as AudioContext | undefined
    if (ctx?.state === 'suspended') ctx.resume()
    this.currentHowl?.play()
  }

  pause(): void {
    this.currentHowl?.pause()
  }

  toggle(): void {
    if (this.currentHowl?.playing()) {
      this.pause()
    } else {
      this.play()
    }
  }

  seek(position: number): void {
    if (!this.currentHowl) return
    this.currentHowl.seek(position)
    usePlaybackStore.getState().setPosition(position)
  }

  setVolume(volume: number): void {
    const v = Math.max(0, Math.min(1, volume))
    this.currentHowl?.volume(v)
    usePlaybackStore.getState().setVolume(v)
  }

  mute(muted: boolean): void {
    Howler.mute(muted)
    this.currentHowl?.volume(muted ? 0 : usePlaybackStore.getState().volume)
  }

  setRate(rate: number): void {
    this.currentHowl?.rate(rate)
    usePlaybackStore.getState().setPlaybackRate(rate)
  }

  getPosition(): number {
    return (this.currentHowl?.seek() as number) ?? 0
  }

  getDuration(): number {
    return this.currentHowl?.duration() ?? 0
  }

  getBuffered(): number {
    const node = (this.currentHowl as unknown as { _sounds?: Array<{ _node: HTMLAudioElement }> })?._sounds?.[0]?._node
    if (!node || !node.buffered.length) return 0
    const dur = node.duration || 1
    const end = node.buffered.end(node.buffered.length - 1)
    return Math.min(1, end / dur)
  }

  /** Full teardown — call on app unmount */
  destroy(): void {
    this.currentHowl?.unload()
    this.nextHowl?.unload()
    this.currentHowl = null
    this.nextHowl = null
    this.preloadedTrackId = null
    this.currentRequestId = ''
    this.retryCountMap.clear()
    audioEvents.removeAllListeners()
  }
}

// ── Singleton export ─────────────────────────────────────────────────────────
export const audioEngine = new AudioEngine()