'use client'

export interface CoverArtProps {
  title: string
  artist: string
  genre?: string
  mood?: string
  energy?: 'low' | 'medium' | 'high'
  size?: number
  isPlaying?: boolean
}

type Mood = 'chill' | 'energetic' | 'dark' | 'classic' | 'experimental'

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = Math.abs((h * 31 + s.charCodeAt(i)) & 0xffffff)
  return h
}

function vary(seed: number, offset: number): number {
  return ((seed >> (offset % 24)) & 0x3f) / 63
}

const moodLabels: Mood[] = ['chill', 'energetic', 'dark', 'classic', 'experimental']

function normalizeText(value?: string): string {
  return (value ?? '').trim().toLowerCase()
}

function inferMood(genre?: string, energy?: string, mood?: string, h = 0): Mood {
  const requested = normalizeText(mood)
  if (moodLabels.includes(requested as Mood)) return requested as Mood

  const normalizedGenre = normalizeText(genre)
  if (energy === 'high') return 'energetic'
  if (energy === 'low') return 'chill'
  if (/(hip.?hop|rap|trap|drill|grime)/.test(normalizedGenre)) return 'dark'
  if (/(pop|dance|edm|house|techno|funk|afro|soul)/.test(normalizedGenre)) return 'energetic'
  if (/(jazz|ambient|lofi|lo-fi|chill|r\.b)/.test(normalizedGenre)) return 'chill'
  if (/(classical|acoustic|folk|country|orchestral|baroque|symphony)/.test(normalizedGenre)) return 'classic'
  if (/(rock|metal|punk|goth|industrial)/.test(normalizedGenre)) return 'dark'
  if (/(experimental|avant-garde|psychedelic|soundscape)/.test(normalizedGenre)) return 'experimental'

  return moodLabels[h % moodLabels.length]
}

export function CoverArt({ title, artist, genre, mood, energy, size = 56, isPlaying = false }: CoverArtProps) {
  const h = hash(`${title ?? ''}|${artist ?? ''}|${genre ?? ''}|${mood ?? ''}`)
  const moodCat = inferMood(genre, energy, mood, h)
  const letter = (title?.[0] ?? '\u266a').toUpperCase()
  const uid = `${h}-${size}`
  const fs = size * 0.36
  const v = (o: number) => vary(h, o)

  const cls = isPlaying ? 'cover-art-playing' : ''

  if (moodCat === 'chill') {
    const hue = 220 + Math.round(v(0) * 60)
    const h2 = (hue + 30) % 360; const h3 = (hue + 340) % 360
    const cx1 = 20 + Math.round(v(4) * 40); const cy1 = 15 + Math.round(v(8) * 30)
    const cx2 = 55 + Math.round(v(12) * 25); const cy2 = 50 + Math.round(v(16) * 25)
    const bg = `hsl(${hue},28%,8%)`
    const c1 = `hsl(${hue},52%,32%)`; const c2 = `hsl(${h2},46%,25%)`; const c3 = `hsl(${h3},40%,20%)`
    const tc = `hsl(${hue},68%,80%)`
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0 }} className={cls} aria-label={`${title} — ${artist}`}>
        <defs>
          <filter id={`f-${uid}`}><feGaussianBlur stdDeviation="10" /></filter>
          <radialGradient id={`c1-${uid}`} cx={`${cx1}%`} cy={`${cy1}%`} r="65%"><stop offset="0%" stopColor={c1} /><stop offset="100%" stopColor={bg} stopOpacity="0" /></radialGradient>
          <radialGradient id={`c2-${uid}`} cx={`${cx2}%`} cy={`${cy2}%`} r="55%"><stop offset="0%" stopColor={c2} /><stop offset="100%" stopColor={bg} stopOpacity="0" /></radialGradient>
          <radialGradient id={`c3-${uid}`} cx="30%" cy="70%" r="45%"><stop offset="0%" stopColor={c3} /><stop offset="100%" stopColor={bg} stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="100" height="100" fill={bg} />
        <ellipse cx={cx1} cy={cy1} rx="50" ry="45" fill={`url(#c1-${uid})`} filter={`url(#f-${uid})`} opacity="0.9" />
        <ellipse cx={cx2} cy={cy2} rx="42" ry="48" fill={`url(#c2-${uid})`} filter={`url(#f-${uid})`} opacity="0.8" />
        <ellipse cx="30" cy="70" rx="38" ry="32" fill={`url(#c3-${uid})`} filter={`url(#f-${uid})`} opacity="0.6" />
        <circle cx="50" cy="50" r="30" fill="none" stroke={tc} strokeWidth="0.4" opacity="0.12" />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fill={tc} fontSize={fs} fontWeight="700" fontFamily="'Inter',sans-serif" style={{ userSelect: 'none' }}>{letter}</text>
      </svg>
    )
  }

  if (moodCat === 'energetic') {
    const hue = 18 + Math.round(v(0) * 28)
    const h2 = (hue + 22) % 360; const h3 = (hue + 340) % 360
    const bg = `hsl(${hue},38%,7%)`
    const c1 = `hsl(${hue},88%,42%)`; const c2 = `hsl(${h2},80%,36%)`; const c3 = `hsl(${h3},75%,32%)`
    const tc = `hsl(${hue},92%,84%)`
    const ang = 25 + Math.round(v(8) * 35)
    const px = 8 + Math.round(v(12) * 20)
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0 }} className={cls} aria-label={`${title} — ${artist}`}>
        <defs>
          <radialGradient id={`e1-${uid}`} cx="28%" cy="25%" r="70%"><stop offset="0%" stopColor={c1} /><stop offset="100%" stopColor={bg} stopOpacity="0" /></radialGradient>
          <radialGradient id={`e2-${uid}`} cx="72%" cy="75%" r="60%"><stop offset="0%" stopColor={c2} stopOpacity="0.9" /><stop offset="100%" stopColor={bg} stopOpacity="0" /></radialGradient>
          <radialGradient id={`e3-${uid}`} cx="80%" cy="18%" r="40%"><stop offset="0%" stopColor={c3} stopOpacity="0.7" /><stop offset="100%" stopColor={bg} stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="100" height="100" fill={bg} />
        <rect width="100" height="100" fill={`url(#e1-${uid})`} />
        <rect width="100" height="100" fill={`url(#e2-${uid})`} />
        <rect width="100" height="100" fill={`url(#e3-${uid})`} />
        <line x1={px} y1="0" x2={px + ang} y2="100" stroke={c1} strokeWidth="0.5" opacity="0.22" />
        <line x1={px + 18} y1="0" x2={px + ang + 18} y2="100" stroke={c2} strokeWidth="0.35" opacity="0.16" />
        <polygon points={`0,0 ${32 + Math.round(v(16) * 12)},0 0,${32 + Math.round(v(20) * 12)}`} fill={c1} opacity="0.13" />
        <polygon points={`100,100 ${68 - Math.round(v(24) * 10)},100 100,${68 - Math.round(v(28) * 10)}`} fill={c2} opacity="0.13" />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fill={tc} fontSize={fs} fontWeight="800" fontFamily="'Inter',sans-serif" style={{ userSelect: 'none' }}>{letter}</text>
      </svg>
    )
  }

  if (moodCat === 'dark') {
    const hue = 248 + Math.round(v(0) * 42)
    const h2 = 208 + Math.round(v(4) * 30)
    const bg = `hsl(${hue},28%,5%)`
    const c1 = `hsl(${hue},58%,36%)`; const c2 = `hsl(${h2},48%,30%)`
    const tc = `hsl(${hue},52%,72%)`
    const dots = Array.from({ length: 5 }, (_, i) => ({
      x: 10 + Math.round(v(8 + i * 8) * 80), y: 10 + Math.round(v(12 + i * 8) * 80),
      r: 1 + Math.round(v(16 + i * 4) * 2.5), op: 0.35 + v(20 + i * 4) * 0.55,
    }))
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0 }} className={cls} aria-label={`${title} — ${artist}`}>
        <defs>
          <radialGradient id={`d1-${uid}`} cx="38%" cy="32%" r="65%"><stop offset="0%" stopColor={c1} stopOpacity="0.65" /><stop offset="100%" stopColor={bg} stopOpacity="0" /></radialGradient>
          <radialGradient id={`d2-${uid}`} cx="62%" cy="68%" r="50%"><stop offset="0%" stopColor={c2} stopOpacity="0.45" /><stop offset="100%" stopColor={bg} stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="100" height="100" fill={bg} />
        <rect width="100" height="100" fill={`url(#d1-${uid})`} />
        <rect width="100" height="100" fill={`url(#d2-${uid})`} />
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={i % 2 === 0 ? c1 : c2} opacity={d.op}>
            <animate attributeName="opacity" values={`${d.op};${d.op * 0.4};${d.op}`} dur={`${3 + i * 1.2}s`} repeatCount="indefinite" />
          </circle>
        ))}
        <line x1="0" y1="50" x2="100" y2="50" stroke={c1} strokeWidth="0.2" opacity="0.07" />
        <line x1="50" y1="0" x2="50" y2="100" stroke={c2} strokeWidth="0.2" opacity="0.07" />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fill={tc} fontSize={fs} fontWeight="700" fontFamily="'Inter',sans-serif" style={{ userSelect: 'none' }}>{letter}</text>
      </svg>
    )
  }

  if (moodCat === 'classic') {
    const hue = 28 + Math.round(v(0) * 28)
    const bg = `hsl(${hue},18%,9%)`
    const c1 = `hsl(${hue},32%,28%)`; const c2 = `hsl(${hue + 10},26%,20%)`
    const tc = `hsl(${hue},48%,74%)`
    const gsp = 10 + Math.round(v(4) * 8)
    const lines: Array<[number, number, number, number]> = []
    for (let x = gsp; x < 100; x += gsp) lines.push([x, 0, x, 100])
    for (let y = gsp; y < 100; y += gsp) lines.push([0, y, 100, y])
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0 }} className={cls} aria-label={`${title} — ${artist}`}>
        <defs>
          <radialGradient id={`cl1-${uid}`} cx="50%" cy="40%" r="68%"><stop offset="0%" stopColor={c1} stopOpacity="0.9" /><stop offset="100%" stopColor={bg} stopOpacity="0" /></radialGradient>
          <radialGradient id={`cl2-${uid}`} cx="50%" cy="62%" r="52%"><stop offset="0%" stopColor={c2} stopOpacity="0.6" /><stop offset="100%" stopColor={bg} stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="100" height="100" fill={bg} />
        <rect width="100" height="100" fill={`url(#cl1-${uid})`} />
        <rect width="100" height="100" fill={`url(#cl2-${uid})`} />
        {lines.map((l, i) => <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke={c1} strokeWidth="0.3" opacity="0.13" />)}
        <circle cx="50" cy="50" r="32" fill="none" stroke={c1} strokeWidth="0.5" opacity="0.2" />
        <circle cx="50" cy="50" r="20" fill="none" stroke={c2} strokeWidth="0.4" opacity="0.15" />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fill={tc} fontSize={fs} fontWeight="600" fontFamily="'Inter',sans-serif" style={{ userSelect: 'none' }}>{letter}</text>
      </svg>
    )
  }

  // experimental
  const hue = (h * 137) % 360
  const h2 = (hue + 137) % 360; const h3 = (hue + 251) % 360
  const bg = `hsl(${hue},28%,7%)`
  const c1 = `hsl(${hue},72%,40%)`; const c2 = `hsl(${h2},66%,34%)`; const c3 = `hsl(${h3},60%,28%)`
  const tc = `hsl(${hue},78%,82%)`
  const shapes = Array.from({ length: 3 }, (_, i) => ({
    cx: 15 + Math.round(v(i * 16) * 70), cy: 15 + Math.round(v(i * 16 + 4) * 70),
    rx: 14 + Math.round(v(i * 16 + 8) * 22), ry: 16 + Math.round(v(i * 16 + 12) * 18),
    rot: Math.round(v(i * 16 + 14) * 180),
  }))
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0 }} className={cls} aria-label={`${title} — ${artist}`}>
      <defs>
        <radialGradient id={`x1-${uid}`} cx="34%" cy="34%" r="65%"><stop offset="0%" stopColor={c1} /><stop offset="100%" stopColor={bg} stopOpacity="0" /></radialGradient>
        <radialGradient id={`x2-${uid}`} cx="66%" cy="66%" r="55%"><stop offset="0%" stopColor={c2} stopOpacity="0.85" /><stop offset="100%" stopColor={bg} stopOpacity="0" /></radialGradient>
        <radialGradient id={`x3-${uid}`} cx="62%" cy="22%" r="42%"><stop offset="0%" stopColor={c3} stopOpacity="0.65" /><stop offset="100%" stopColor={bg} stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="100" height="100" fill={bg} />
      <rect width="100" height="100" fill={`url(#x1-${uid})`} />
      <rect width="100" height="100" fill={`url(#x2-${uid})`} />
      <rect width="100" height="100" fill={`url(#x3-${uid})`} />
      {shapes.map((s, i) => (
        <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={[c1, c2, c3][i]} opacity="0.18" transform={`rotate(${s.rot} ${s.cx} ${s.cy})`} />
      ))}
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fill={tc} fontSize={fs} fontWeight="700" fontFamily="'Inter',sans-serif" style={{ userSelect: 'none' }}>{letter}</text>
    </svg>
  )
}
