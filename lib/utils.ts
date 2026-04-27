export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatTimeAgo(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diff < 60) return "à l'instant"
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)}j`
  if (diff < 2592000) return `il y a ${Math.floor(diff / 604800)} sem.`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function parseFilename(filename: string): { title: string; artist: string } | null {
  const name = filename.replace(/\.[^/.]+$/, '')
  const cleaned = name
    .replace(/\(Official.*?\)/gi, '')
    .replace(/\[.*?\]/g, '')
    .replace(/feat\./gi, '')
    .replace(/ft\./gi, '')
    .replace(/\d{3,}kbps/gi, '')
    .replace(/official\s*(video|audio|music video)/gi, '')
    .trim()

  const parts = cleaned.split(/\s*[-–—]\s*/)
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts[1].trim() }
  }
  return null
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 1) + '…'
}
