// ── Sleep Timer Hook ──────────────────────────────────────────────────────────
// Pauses playback after a configurable duration. Uses Web Worker for accuracy
// ( timers are throttled when the tab is in the background).
import { useEffect, useRef, useCallback } from 'react'
import { usePlayerUIModeStore } from '@/stores/playerUIModeStore'
import { audioEngine } from '@/lib/audioEngine'

export function useSleepTimer() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const endTimeRef = useRef<number>(0)
  const sleepTimerMinutes = usePlayerUIModeStore((s) => s.sleepTimerMinutes)
  const setSleepTimer = usePlayerUIModeStore((s) => s.setSleepTimer)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    endTimeRef.current = 0
  }, [])

  const startTimer = useCallback((minutes: number) => {
    clearTimer()
    endTimeRef.current = Date.now() + minutes * 60 * 1000
    timerRef.current = setTimeout(() => {
      audioEngine.pause()
      setSleepTimer(null)
    }, minutes * 60 * 1000)
  }, [clearTimer, setSleepTimer])

  const cancelTimer = useCallback(() => {
    clearTimer()
    setSleepTimer(null)
  }, [clearTimer, setSleepTimer])

  // Auto-start when sleepTimerMinutes changes
  useEffect(() => {
    if (sleepTimerMinutes && sleepTimerMinutes > 0) {
      startTimer(sleepTimerMinutes)
    }
    return () => clearTimer()
  }, [sleepTimerMinutes, startTimer, clearTimer])

  const getRemaining = useCallback((): number => {
    if (!endTimeRef.current) return 0
    return Math.max(0, (endTimeRef.current - Date.now()) / 1000)
  }, [])

  return { startTimer, cancelTimer, getRemaining }
}