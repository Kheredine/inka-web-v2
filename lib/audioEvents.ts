// ── Audio Event Bus ──────────────────────────────────────────────────────────
// Typed event bus for engine→UI signals. Engines never import React or Zustand
// directly for event emission — they use this bus, and hooks/components subscribe.
import type { UnifiedTrack } from '@/types/track'

export type AudioEventMap = {
  play: { track: UnifiedTrack }
  pause: { track: UnifiedTrack }
  ended: { track: UnifiedTrack }
  error: { track: UnifiedTrack; error: string }
  preload: { trackId: string }
}

type Handler<T> = (payload: T) => void

class AudioEventBus {
  private listeners = new Map<string, Set<Handler<unknown>>>()

  on<K extends keyof AudioEventMap>(
    event: K,
    handler: Handler<AudioEventMap[K]>
  ): () => void {
    const key = event as string
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set())
    }
    const set = this.listeners.get(key)!
    const wrapped = handler as Handler<unknown>
    set.add(wrapped)
    return () => set.delete(wrapped)
  }

  off<K extends keyof AudioEventMap>(
    event: K,
    handler: Handler<AudioEventMap[K]>
  ): void {
    const key = event as string
    this.listeners.get(key)?.delete(handler as Handler<unknown>)
  }

  emit<K extends keyof AudioEventMap>(
    event: K,
    payload: AudioEventMap[K]
  ): void {
    const key = event as string
    this.listeners.get(key)?.forEach((handler) => {
      try {
        handler(payload)
      } catch (err) {
        console.error(`[AudioEventBus] Error in ${key} handler:`, err)
      }
    })
  }

  removeAllListeners(): void {
    this.listeners.clear()
  }
}

export const audioEvents = new AudioEventBus()