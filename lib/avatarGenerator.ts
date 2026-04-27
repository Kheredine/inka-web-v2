export interface AvatarData {
  color: string
  initials: string
}

function djb2(s: string): number {
  let hash = 5381
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) ^ s.charCodeAt(i)
    hash = hash >>> 0
  }
  return hash
}

export function generateAvatar(username: string): AvatarData {
  const h = djb2(username)
  const hue = h % 360
  return {
    color: `hsl(${hue}, 45%, 26%)`,
    initials: username.slice(0, 2).toUpperCase(),
  }
}
