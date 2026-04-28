'use client'
import { useState } from 'react'

export interface UserAvatarProps {
  username: string
  displayName?: string
  avatarUrl?: string | null
  size?: number
}

function avatarHue(username: string): number {
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) & 0xffffff
  }
  return hash % 360
}

export function UserAvatar({ username, displayName, avatarUrl, size = 36 }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false)
  const hue = avatarHue(username)
  const label = displayName ?? username
  const initials = label.slice(0, 2).toUpperCase()
  const fontSize = Math.round(size * 0.38)
  const showImage = avatarUrl && !imgError

  return (
    <div
      aria-label={label}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `hsl(${hue}, 45%, 26%)`,
        border: `1.5px solid hsl(${hue}, 55%, 38%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        fontWeight: 700,
        color: `hsl(${hue}, 65%, 78%)`,
        flexShrink: 0,
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {showImage ? (
        <img
          src={avatarUrl!}
          alt={label}
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : initials}
    </div>
  )
}
