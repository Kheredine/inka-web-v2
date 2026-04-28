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

    // Popular & recent-releases — StaleWhileRevalidate (ok to show slightly stale)
    {
      urlPattern: /\/api\/(popular|recent-releases)/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'inka-api-public',
        expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 2 },
      },
    },

    // Deezer CDN images — CacheFirst
    {
      urlPattern: /^https:\/\/.*dzcdn\.net\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'inka-deezer-images',
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },

    // Supabase public storage images (avatars, covers) — StaleWhileRevalidate
    {
      urlPattern: /^https:\/\/.*supabase\.co\/storage\/v1\/object\/public\/.*/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'inka-supabase-images',
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remote images: Supabase storage + Deezer CDN
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/**' },
      { protocol: 'https', hostname: 'e-cdns-images.dzcdn.net' },
      { protocol: 'https', hostname: 'api.deezer.com' },
      { protocol: 'https', hostname: 'cdns-images.dzcdn.net' },
    ],
  },

  // Compression gzip activée sur toutes les réponses
  compress: true,

  // Headers cache
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
        source: '/api/popular',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=900, stale-while-revalidate=300' },
        ],
      },
      {
        source: '/api/recent-releases',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=1800, stale-while-revalidate=600' },
        ],
      },
      {
        source: '/api/search/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=300, stale-while-revalidate=60' },
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
