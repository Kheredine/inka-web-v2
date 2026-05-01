'use client'

import { useCallback, useRef, useState } from 'react'
import { usePosition, useDuration, useBuffered } from '@/stores/selectors'
import { audioEngine } from '@/lib/audioEngine'

function formatTime(s: number): string {
  if (!s || !isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function ProgressBar() {
  const position = usePosition()
  const duration = useDuration()
  const buffered = useBuffered()
  const [isDragging, setIsDragging] = useState(false)
  const [dragPosition, setDragPosition] = useState(0)
  const barRef = useRef<HTMLDivElement>(null)

  const displayPosition = isDragging ? dragPosition : position
  const progress = duration > 0 ? (displayPosition / duration) * 100 : 0
  const bufferedPercent = duration > 0 ? buffered * 100 : 0

  const getPositionFromEvent = useCallback((e: React.PointerEvent | PointerEvent): number => {
    if (!barRef.current) return 0
    const rect = barRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    return (x / rect.width) * duration
  }, [duration])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    setIsDragging(true)
    const pos = getPositionFromEvent(e)
    setDragPosition(pos)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [getPositionFromEvent])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return
    const pos = getPositionFromEvent(e)
    setDragPosition(pos)
  }, [isDragging, getPositionFromEvent])

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    audioEngine.seek(dragPosition)
  }, [isDragging, dragPosition])

  return (
    <div style={{ padding: '0 24px', userSelect: 'none' }}>
      {/* Bar */}
      <div
        ref={barRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: 'relative',
          height: isDragging ? 8 : 4,
          borderRadius: 4,
          background: 'rgba(255,255,255,0.15)',
          cursor: 'pointer',
          touchAction: 'none',
          transition: 'height 0.15s ease',
        }}
      >
        {/* Buffered fill */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            left: 0,
            width: `${bufferedPercent}%`,
            borderRadius: 4,
            background: 'rgba(255,255,255,0.1)',
          }}
        />
        {/* Progress fill */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            left: 0,
            width: `${progress}%`,
            borderRadius: 4,
            background: '#8b5cf6',
            willChange: 'transform',
          }}
        />
        {/* Knob */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: `${progress}%`,
            width: isDragging ? 16 : 0,
            height: isDragging ? 16 : 0,
            borderRadius: '50%',
            background: '#8b5cf6',
            transform: 'translate(-50%, -50%)',
            transition: isDragging ? 'none' : 'width 0.15s, height 0.15s',
          }}
        />
      </div>
      {/* Time labels */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 6,
        color: 'rgba(255,255,255,0.4)',
        fontSize: 11,
        fontVariantNumeric: 'tabular-nums',
      }}>
        <span>{formatTime(displayPosition)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  )
}