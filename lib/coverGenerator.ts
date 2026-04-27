export interface CoverData {
  gradient: [string, string]
  letter: string
}

function djb2(s: string): number {
  let hash = 5381
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) ^ s.charCodeAt(i)
    hash = hash >>> 0
  }
  return hash
}

export function generateCover(title: string, artist: string): CoverData {
  const h = djb2(`${title}${artist}`)
  const hue1 = h % 360
  const hue2 = (hue1 + 40) % 360
  return {
    gradient: [
      `hsl(${hue1}, 55%, 28%)`,
      `hsl(${hue2}, 48%, 20%)`,
    ],
    letter: (title[0] ?? '\u266a').toUpperCase(),
  }
}
