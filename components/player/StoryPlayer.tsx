'use client'

import { useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { videoEngine } from '@/lib/videoEngine'
import { audioEngine } from '@/lib/audioEngine'
import { useCurrentTrack, useIsPlaying, usePosition, useDuration } from '@/stores/selectors'
import { useSyncStore } from '@/stores/syncStore'
import { usePlayerUIModeStore } from '@/stores/playerUIModeStore'

export function StoryPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const track = useCurrentTrack()
  const isPlaying = useIsPlaying()
  const position = usePosition()
  const duration = useDuration()
  const isVideoReady = useSyncStore((s) => s.isVideoReady)
  const { setMode } = usePlayerUIModeStore()

  // Attach video element to video engine
  useEffect(() => {
    if (videoRef.current) {
      videoEngine.attach(videoRef.current)
      if (track?.video) {
        // YouTube video — we'll use thumbnail as background for now
        // Full YouTube embed integration comes in Phase 5
        videoEngine.loadSource({
          url: `https://img.youtube.com/vi/${track.video.youtubeVideoId}/maxresdefault.jpg`,
          format: 'image',
          thumbnails: [track.video.thumbnailUrl],
        })
      }
    }
    return () => videoEngine.detach()
  }, [track?.video])

  const progress = duration > 0 ? (position / duration) * 100 : 0

  const handleTapLeft = useCallback(() => {
    audioEngine.seek(Math.max(0, audioEngine.getPosition() - 10))
  }, [])

  const handleTapRight = useCallback(() => {
    audioEngine.seek(Math.min(audioEngine.getDuration(), audioEngine.getPosition() + 10))
  }, [])

  const handleExit = useCallback(() => {
    setMode('audio')
  }, [setMode])

  if (!track) return null

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      background: '#000',
      overflow: 'hidden',
    }}>
      {/* Video layer */}
      <video
        ref={videoRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
        playsInline
        muted
      />

      {/* Gradient overlays */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 120,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 200,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
        pointerEvents: 'none',
      }} />

      {/* Top bar: exit + track info */}
      <div style={{
        position: 'absolute',
        top: 'env(safe-area-inset-top, 48px)',
        left: 0,
        right: 0,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <button
          onClick={handleExit}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(255,255,255,0.15)',
            color: '#fff',
            fontSize: 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {track.title}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
            {track.artists.join(', ')}
          </div>
        </div>
      </div>

      {/* Tap zones: left = -10s, right = +10s */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        <div onClick={handleTapLeft} style={{ flex: 1 }} />
        <div onClick={handleTapRight} style={{ flex: 1 }} />
      </div>

      {/* Story progress segments */}
      <div style={{
        position: 'absolute',
        top: 'calc(env(safe-area-inset-top, 48px) + 52px)',
        left: 16,
        right: 16,
        height: 3,
        borderRadius: 2,
        background: 'rgba(255,255,255,0.2)',
      }}>
        <motion.div
          style={{
            height: '100%',
            borderRadius: 2,
            background: '#fff',
          }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.25, ease: 'linear' }}
        />
      </div>

      {/* Center play/pause indicator */}
      {!isPlaying && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          color: '#fff',
          pointerEvents: 'none',
        }}>
          ▶
        </div>
      )}
    </div>
  )
}