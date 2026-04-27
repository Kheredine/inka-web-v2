/**
 * Génère tous les PNG nécessaires à l'installabilité cross-platform :
 *   - icon-192.png / icon-512.png     → manifest "any"
 *   - icon-maskable-192.png / -512.png → manifest "maskable" (Android adaptive icons)
 *   - apple-touch-icon.png (180×180)   → iOS "Add to Home Screen"
 *   - favicon.png (32×32)              → onglets bureau
 *
 * Usage : node scripts/generate-icons.mjs
 * Prérequis : sharp (déjà en devDependency)
 */

import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(__dirname, '../public/icons')

// ── SVG normal (avec coins arrondis) ──────────────────────────────────────────
const svgNormal = readFileSync(join(iconsDir, 'icon.svg'))

// ── SVG maskable (fond plein, contenu dans la safe-zone 80%) ─────────────────
// Android masque l'icône en cercle ou squircle — le contenu doit rester
// dans les 80% centraux pour ne pas être rogné.
const svgMaskable = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0F0A07"/>
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF6A00"/>
      <stop offset="100%" stop-color="#D94F2A"/>
    </linearGradient>
  </defs>
  <rect x="106" y="106" width="300" height="300" rx="56" fill="url(#g)"/>
  <text x="256" y="308" font-family="-apple-system,sans-serif" font-size="180" font-weight="700" fill="white" text-anchor="middle">I</text>
</svg>`)

const icons = [
  // Icônes "any" — manifest standard
  { src: svgNormal,   size: 192, name: 'icon-192.png' },
  { src: svgNormal,   size: 512, name: 'icon-512.png' },

  // Icônes maskable — Android adaptive icons
  { src: svgMaskable, size: 192, name: 'icon-maskable-192.png' },
  { src: svgMaskable, size: 512, name: 'icon-maskable-512.png' },

  // Apple Touch Icon — iOS "Add to Home Screen"
  { src: svgNormal,   size: 180, name: 'apple-touch-icon.png' },

  // Favicon — onglets bureau
  { src: svgNormal,   size: 32,  name: 'favicon-32.png' },
  { src: svgNormal,   size: 16,  name: 'favicon-16.png' },
]

for (const { src, size, name } of icons) {
  await sharp(src).resize(size, size).png({ compressionLevel: 9 }).toFile(join(iconsDir, name))
  console.log(`✓ ${name} (${size}×${size})`)
}

// Copier le favicon-32 vers la racine public pour compatibilité maximale
const faviconData = readFileSync(join(iconsDir, 'favicon-32.png'))
writeFileSync(join(__dirname, '../public/favicon.png'), faviconData)
console.log('✓ public/favicon.png (copie 32×32)')

console.log('\nTous les icônes ont été générés avec succès.')
console.log('Vérifier dans public/icons/ avant de déployer.')
