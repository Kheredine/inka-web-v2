const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,

  // ── Désactivé en développement local ─────────────────────────────────────
  // Le service worker ne tourne que sur le build de production (VPS).
  // Localement : `npm run dev` → pas de SW, pas d'install prompt — c'est normal.
  // Sur le VPS : `npm run build && npm start` → SW actif, app installable.
  disable: process.env.NODE_ENV === 'development',

  fallbacks: {
    document: '/offline.html',
  },

  // ── Stratégies de cache ───────────────────────────────────────────────────
  runtimeCaching: [
    // Audio proxy — NetworkFirst (les signed URLs Supabase expirent en 24h)
    {
      urlPattern: /\/api\/audio/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'inka-audio-proxy',
        expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
        networkTimeoutSeconds: 10,
      },
    },

    // Routes Next.js (pages) — NetworkFirst avec fallback offline
    {
      urlPattern: /^\/_next\/data\/.+\.json$/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'inka-next-data',
        expiration: { maxEntries: 32, maxAgeSeconds: 3600 },
      },
    },

    // Assets statiques Next.js (_next/static) — CacheFirst longue durée
    {
      urlPattern: /^\/_next\/static\/.+/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'inka-static-assets',
        expiration: { maxEntries: 256, maxAgeSeconds: 60 * 60 * 24 * 30 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },

    // Google Fonts — StaleWhileRevalidate
    {
      urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'inka-fonts',
        expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
      },
    },

    // FontAwesome local (/fa.min.css) — CacheFirst
    {
      urlPattern: /\/fa\.min\.css/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'inka-fontawesome',
        expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
  ],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Aucune image distante — tout est génératif
  images: {
    remotePatterns: [],
  },

  // Compression gzip activée sur toutes les réponses
  compress: true,

  // Headers cache pour les routes statiques et audio
  async headers() {
    return [
      {
        source: '/api/audio',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=3600' },
          { key: 'Accept-Ranges', value: 'bytes' },
          { key: 'Content-Type', value: 'audio/ogg' },
        ],
      },
      {
        source: '/icons/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
    ]
  },

  webpack(config, { dev }) {
    if (dev) {
      config.cache = false
    }

    return config
  },
}

module.exports = withPWA(nextConfig)
