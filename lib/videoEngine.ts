// ── Video Engine ──────────────────────────────────────────────────────────────
// Syncs an HTML5 <video> element with the audioEngine.
// Used in Story Mode and Video Mode. Audio is the source of truth for timing.
// Video slave-syncs: if audio seeks, video follows. If video drifts, it corrects.

import { usePlaybackStore } from '@/stores/playbackStore'
import { useSyncStore } from '@/stores/syncStore'
import { audioEngine } from './audioEngine'

type VideoSource = {
  url: string
  format: string
  thumbnails: string[]
}

class VideoEngine {
  private video: HTMLVideoElement | null = null
  private rafId = 0
  private driftThreshold = 0.3 // 300ms drift tolerance

  attach(videoElement: HTMLVideoElement): void {
    this.video = videoElement
    this.video.playsInline = true
    this.video.muted = true // Audio comes from audioEngine
    this.video.preload = 'auto'
    this.startSyncLoop()
  }

  detach(): void {
    this.stopSyncLoop()
    if (this.video) {
      this.video.pause()
      this.video.src = ''
      this.video = null
    }
  }

  loadSource(source: VideoSource): void {
    if (!this.video) return
    this.video.src = source.url
  }

  private startSyncLoop(): void {
    const sync = () => {
      if (!this.video) return

      const audioPos = audioEngine.getPosition()
      const audioDuration = audioEngine.getDuration()
      const isPlaying = usePlaybackStore.getState().isPlaying

      if (!this.video.paused && !isPlaying) {
        this.video.pause()
      } else if (this.video.paused && isPlaying) {
        this.video.play().catch(() => {})
      }

      // Sync position: correct if drifted beyond threshold
      if (isPlaying && audioDuration > 0 && this.video.duration > 0) {
        const videoPos = this.video.currentTime
        const drift = Math.abs(videoPos - audioPos)

        if (drift > this.driftThreshold) {
          this.video.currentTime = audioPos
          useSyncStore.getState().setDrift(drift)
        }

        // Playback rate sync (match audio playback rate)
        const targetRate = usePlaybackStore.getState().playbackRate
        if (Math.abs(this.video.playbackRate - targetRate) > 0.01) {
          this.video.playbackRate = targetRate
        }
      }

      this.rafId = requestAnimationFrame(sync)
    }
    this.rafId = requestAnimationFrame(sync)
  }

  private stopSyncLoop(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId)
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.video
  }
}

export const videoEngine = new VideoEngine()
export type { VideoSource }