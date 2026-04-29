import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../public/icons/screenshot-mobile.png')

const W = 390
const H = 844
const BG = '#0d0d0d'
const SURFACE = '#1a1a1a'
const SURFACE2 = '#242424'
const ACCENT = '#E8902A'
const ACCENT_DARK = '#B8701E'
const TEXT = '#F0EDE8'
const TEXT2 = '#8A8680'
const TEXT3 = '#4A4744'
const BORDER = 'rgba(255,255,255,0.08)'

// Mock data for the feed cards
const cards = [
  { title: 'Nuit tropicale', artist: 'Djali', genre: 'Afrobeat', emoji: '🌙', reactions: 12, comments: 4 },
  { title: 'Freestyle 94', artist: 'Marcus', genre: 'Hip-Hop', emoji: '🎤', reactions: 8, comments: 2 },
  { title: 'Sahel groove', artist: 'Amara', genre: 'World', emoji: '🌍', reactions: 21, comments: 7 },
  { title: 'Blue midnight', artist: 'Kofi', genre: 'Jazz', emoji: '🎷', reactions: 5, comments: 1 },
]

function card(x, y, w, h, { title, artist, genre, emoji, reactions, comments }, idx) {
  const hue = idx * 37
  const coverGrad = `
    <defs>
      <linearGradient id="cg${idx}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="hsl(${30 + hue},55%,28%)"/>
        <stop offset="100%" stop-color="hsl(${hue},40%,15%)"/>
      </linearGradient>
    </defs>`

  return `
    <g>
      <!-- Card background -->
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${SURFACE}"/>

      <!-- Cover art -->
      ${coverGrad}
      <rect x="${x + 12}" y="${y + 12}" width="${w - 24}" height="${w - 24}" rx="8" fill="url(#cg${idx})"/>
      <!-- Emoji overlay -->
      <text x="${x + w / 2}" y="${y + 12 + (w - 24) / 2 + 10}" font-size="38" text-anchor="middle" dominant-baseline="middle">${emoji}</text>

      <!-- Play button overlay -->
      <circle cx="${x + w - 28}" cy="${y + w - 12}" r="18" fill="${ACCENT}" opacity="0.92"/>
      <polygon points="${x + w - 34},${y + w - 18} ${x + w - 34},${y + w - 6} ${x + w - 20},${y + w - 12}" fill="white"/>

      <!-- Title -->
      <text x="${x + 12}" y="${y + w + 6}" font-size="13" font-weight="600" fill="${TEXT}" font-family="system-ui,sans-serif">${title}</text>
      <!-- Artist -->
      <text x="${x + 12}" y="${y + w + 22}" font-size="11" fill="${TEXT2}" font-family="system-ui,sans-serif">${artist}</text>
      <!-- Genre pill -->
      <rect x="${x + 12}" y="${y + w + 32}" width="${genre.length * 7 + 12}" height="16" rx="8" fill="${SURFACE2}"/>
      <text x="${x + 18}" y="${y + w + 43}" font-size="9" fill="${TEXT2}" font-family="system-ui,sans-serif">${genre}</text>

      <!-- Reactions -->
      <text x="${x + 12}" y="${y + h - 10}" font-size="11" fill="${TEXT3}" font-family="system-ui,sans-serif">❤️ ${reactions}  💬 ${comments}</text>
    </g>`
}

const TOPBAR_H = 100
const BOTTOMNAV_H = 70
const PADDING = 16
const CARD_W = (W - PADDING * 3) / 2
const CARD_H = CARD_W + 70

// Two rows of 2 cards
const c0 = card(PADDING, TOPBAR_H + PADDING, CARD_W, CARD_H, cards[0], 0)
const c1 = card(PADDING * 2 + CARD_W, TOPBAR_H + PADDING, CARD_W, CARD_H, cards[1], 1)
const c2 = card(PADDING, TOPBAR_H + PADDING * 2 + CARD_H, CARD_W, CARD_H, cards[2], 2)
const c3 = card(PADDING * 2 + CARD_W, TOPBAR_H + PADDING * 2 + CARD_H, CARD_W, CARD_H, cards[3], 3)

// Bottom nav icons (simple shapes)
function navItem(x, label, active) {
  const col = active ? ACCENT : TEXT3
  return `
    <circle cx="${x}" cy="${H - BOTTOMNAV_H / 2 - 8}" r="4" fill="${col}"/>
    <text x="${x}" y="${H - 14}" font-size="9" fill="${col}" text-anchor="middle" font-family="system-ui,sans-serif">${label}</text>`
}

const navItems = [
  navItem(W * 0.15, 'Feed', true),
  navItem(W * 0.35, 'Browse', false),
  navItem(W * 0.5, '⊕', false),
  navItem(W * 0.65, 'Library', false),
  navItem(W * 0.85, 'Profile', false),
]

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <!-- Background -->
  <rect width="${W}" height="${H}" fill="${BG}"/>

  <!-- Status bar dots (minimal) -->
  <text x="16" y="22" font-size="11" fill="${TEXT2}" font-family="system-ui,sans-serif">9:41</text>
  <rect x="${W - 50}" y="14" width="32" height="12" rx="4" fill="none" stroke="${TEXT2}" stroke-width="1"/>
  <rect x="${W - 48}" y="16" width="22" height="8" rx="2" fill="${TEXT2}" opacity="0.7"/>

  <!-- TopBar background -->
  <rect width="${W}" height="${TOPBAR_H}" fill="${BG}"/>

  <!-- Logo / Title -->
  <text x="16" y="56" font-size="22" font-weight="800" fill="${TEXT}" font-family="system-ui,sans-serif">Inka</text>
  <text x="68" y="56" font-size="13" fill="${ACCENT}" font-family="system-ui,sans-serif">Feed</text>

  <!-- Search bar -->
  <rect x="16" y="66" width="${W - 70}" height="34" rx="17" fill="${SURFACE}" stroke="${BORDER}" stroke-width="0.5"/>
  <text x="40" y="88" font-size="12" fill="${TEXT3}" font-family="system-ui,sans-serif">Rechercher…</text>
  <!-- Filter button -->
  <rect x="${W - 46}" y="66" width="34" height="34" rx="17" fill="${SURFACE}" stroke="${BORDER}" stroke-width="0.5"/>
  <text x="${W - 29}" y="88" font-size="12" fill="${TEXT3}" text-anchor="middle" font-family="system-ui,sans-serif">≡</text>

  <!-- Section label -->
  <text x="16" y="${TOPBAR_H + 10}" font-size="10" font-weight="600" fill="${TEXT3}" letter-spacing="1.5" font-family="system-ui,sans-serif" text-transform="uppercase">RÉCEMMENT PARTAGÉ</text>

  <!-- Cards -->
  ${c0}
  ${c1}
  ${c2}
  ${c3}

  <!-- Gradient fade at bottom (hides cut-off cards) -->
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BG}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${BG}" stop-opacity="1"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${H - BOTTOMNAV_H - 60}" width="${W}" height="60" fill="url(#fade)"/>

  <!-- Bottom nav bar -->
  <rect x="0" y="${H - BOTTOMNAV_H}" width="${W}" height="${BOTTOMNAV_H}" fill="${SURFACE}"/>
  <line x1="0" y1="${H - BOTTOMNAV_H}" x2="${W}" y2="${H - BOTTOMNAV_H}" stroke="${BORDER}" stroke-width="0.5"/>
  ${navItems.join('')}

  <!-- Active nav indicator -->
  <rect x="${W * 0.15 - 16}" y="${H - BOTTOMNAV_H}" width="32" height="2" rx="1" fill="${ACCENT}"/>
</svg>`

const buf = Buffer.from(svg)

sharp(buf)
  .png()
  .toFile(OUT)
  .then(() => console.log(`Screenshot written → ${OUT}`))
  .catch(err => { console.error(err); process.exit(1) })
