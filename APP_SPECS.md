# Inka-Web-V2 — Complete Technical Specification

## Overview

**Inka** is a Progressive Web App (PWA) for music discovery and sharing, targeting the African diaspora community. Users can upload, discover, react to, and share sounds. The platform features AI-powered recommendations, automatic track enrichment, and integration with major music metadata services.

---

## 1. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14.2.5 |
| Language | TypeScript | 5.4.5 |
| UI Library | React | 18.3.1 |
| State Management | Zustand | 4.5.5 |
| Data Fetching | SWR | 2.4.1 |
| Database | Supabase (PostgreSQL + RLS) | — |
| Auth | Supabase Auth (PIN-based) | — |
| Object Storage | Cloudflare R2 (S3-compatible) | — |
| Audio Playback | Howler.js | 2.2.4 |
| AI Inference | OpenAI Chat Completions | gpt-4o-mini |
| PWA | next-pwa + Workbox | 5.6.0 |
| Image Processing | sharp | 0.34.5 |

---

## 2. Project Structure

```
/app                          Next.js App Router pages + layouts
  /feed                       Personalized feed ("Pour Toi")
  /browse                     Discovery hub (search, genres, trending)
  /popular                    Top sounds (last 7 days by play count)
  /trending                   Global charts (Last.fm + iTunes)
  /library                    Saved sounds & playlists
  /inbox                      Shared sounds from other users
  /upload                     Audio upload + AI enrichment flow
  /settings                   User preferences
  /player/[id]                Full-page player
  /playlist/[id]              Playlist detail view
  /artist/[artistId]          Deezer artist profile
  /releases/[artistId]        Artist discography
  /releases/[artistId]/album/[albumId]  Album track list
  /profile/[id]               User profile page
  /login                      PIN login
  /register                   Account registration
  /reset-code                 PIN reset flow
  /admin                      Admin stats dashboard
  /admin/genres               Genre management

/components                   ~20+ reusable UI components
/hooks                        Custom SWR hooks (browse data fetching)
/stores                       8 Zustand state stores
/lib                          Utilities: theme, audio optimizer, supabase client
/types                        TypeScript type definitions
/supabase/migrations          SQL migration files
/workers                      Background job handlers
/scripts                      Build and utility scripts
/public                       Static assets: manifest.json, offline.html
```

---

## 3. Pages & Routes

| Route | Purpose |
|-------|---------|
| `/` | Redirect to `/feed` |
| `/feed` | Personalized recommendation feed |
| `/browse` | Discovery: search, genres, recommendations, trending |
| `/popular` | Top sounds ranked by play count (last 7 days) |
| `/trending` | Last.fm Top 10 + iTunes rising charts |
| `/library` | User's saved sounds and playlists |
| `/inbox` | Received sound/playlist shares |
| `/upload` | Upload audio + trigger AI enrichment |
| `/settings` | User settings and preferences |
| `/player/[id]` | Full-screen sound player |
| `/playlist/[id]` | Playlist detail and playback |
| `/artist/[artistId]` | Deezer artist profile |
| `/releases/[artistId]` | Artist discography (Deezer) |
| `/releases/[artistId]/album/[albumId]` | Album track listing |
| `/profile/[id]` | User profile with uploads and stats |
| `/login` | PIN-based login |
| `/register` | New account registration |
| `/reset-code` | PIN reset via email |
| `/admin` | Admin dashboard (stats overview) |
| `/admin/genres` | Genre management tools |

---

## 4. API Endpoints

### Authentication — `/api/auth`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register user (generates 4-digit PIN) |
| POST | `/api/auth/delete-account` | Delete user account and data |
| POST | `/api/auth/reset-code` | Reset PIN via email |

### Audio & Storage

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/audio?r2=<key>` | Redirect to R2 presigned GET URL |
| GET | `/api/audio?url=<url>` | Proxy Supabase audio (legacy) |
| POST | `/api/upload-url` | Generate R2 presigned PUT URL for browser upload |

### Search

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/search/tracks?q=` | Search Deezer tracks (20 results) |
| GET | `/api/search/artists?q=` | Search Deezer artists (8 results) |

### Discovery & Recommendations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/recommendations?userId=&limit=` | Hybrid recommendation engine (limit 20–40) |
| GET | `/api/popular` | Top sounds by play count, last 7 days |
| GET | `/api/trending` | Last.fm Top 10 + iTunes rising artists |
| GET | `/api/recent-releases` | Fresh uploads grouped by artist |
| GET | `/api/new-by-artist?deezerArtistId=` | New sounds from a specific followed artist |
| GET | `/api/facts` | Music trivia facts |

### External Data (Deezer)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/artist-profile/[artistId]` | Artist info, stats, and biography |
| GET | `/api/artist-releases/[artistId]` | Artist discography (max 30, filtered by primary artist) |
| GET | `/api/album/[albumId]` | Album details and metadata |
| GET | `/api/album-tracks/[albumId]` | Track listing for an album |
| POST | `/api/resolve-deezer-artist` | Resolve artist name → Deezer ID |

### Enrichment & AI

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/enrich` | AI + MusicBrainz enrichment (mood, energy, themes, similar tracks) |
| POST | `/api/metadata` | Extract or update sound metadata |
| GET | `/api/lyrics` | Fetch lyrics from external source |
| GET | `/api/youtube-search?q=` | YouTube music video search |
| POST | `/api/playlist` | AI playlist name + description generation |

### Admin — `/api/admin`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/stats` | Dashboard stats (users, sounds, plays, reactions, playlists) |
| POST | `/api/admin/sounds` | Bulk sound operations |
| POST | `/api/admin/fill-genres` | Fill missing genres (MusicBrainz → Last.fm → OpenAI) |
| POST | `/api/admin/backfill-deezer` | Backfill Deezer artist IDs for existing sounds |
| GET | `/api/admin/users` | User listing and stats |

---

## 5. Database Schema

### Table: `profiles`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | References auth.users |
| username | text | Unique |
| display_name | text | |
| bio | text | |
| country | text | |
| created_at | timestamptz | |

### Table: `sounds`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| title | text | |
| artist | text | |
| artists | text[] | Multi-artist support |
| producer | text | |
| genre | text | |
| country | text | |
| year | integer | |
| duration | integer | Seconds |
| lyrics | text | |
| description | text | |
| audio_url | text | Compressed audio (R2) |
| audio_url_original | text | Original upload |
| uploaded_by | uuid FK | → profiles.id |
| play_count | integer | Default 0 |
| is_public | boolean | Default true |
| status | text | processing / ready / error |
| compression_attempts | integer | |
| compressed_at | timestamptz | |
| file_size_original | bigint | Bytes |
| file_size_compressed | bigint | Bytes |
| bitrate | integer | kbps |
| audio_format | text | |
| acoustid_fingerprint | text | |
| storage_ref | text | R2 object key |
| mood | text | AI-inferred |
| energy_level | text | AI-inferred |
| themes | text[] | AI-inferred |
| similar_sounds | uuid[] | AI-matched |
| youtube_url | text | |
| deezer_artist_id | text | |
| created_at | timestamptz | |

### Table: `playlists`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| title | text | |
| description | text | |
| created_by | uuid FK | → profiles.id |
| is_public | boolean | |
| created_at | timestamptz | |

### Table: `playlist_sounds` (M2M)
| Column | Type | Notes |
|--------|------|-------|
| playlist_id | uuid FK | → playlists.id |
| sound_id | uuid FK | → sounds.id |
| position | integer | Ordering |

### Table: `reactions`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| sound_id | uuid FK | → sounds.id |
| user_id | uuid FK | → profiles.id |
| emoji | text | fire / heart / sleep / pray |
| created_at | timestamptz | |

Unique constraint: `(sound_id, user_id, emoji)`

### Table: `shares`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| from_user | uuid FK | → profiles.id |
| to_user | uuid FK | → profiles.id |
| sound_id | uuid FK | nullable → sounds.id |
| playlist_id | uuid FK | nullable → playlists.id |
| message | text | |
| is_read | boolean | Default false |
| created_at | timestamptz | |

Constraint: `sound_id` OR `playlist_id` must be set (not both).

### Table: `play_history`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK | → profiles.id |
| sound_id | uuid FK | → sounds.id |
| played_at | timestamptz | |

### View: `user_stats`
Aggregates per user: `total_uploads`, `total_listens`, `avg_listens_per_upload`, `total_reactions_received`, `max_play_count`.

### Auto-Cleanup Triggers
- `play_history` → deleted after **90 days**
- Read `shares` → deleted after **180 days**
- `sounds` with status=error → deleted after **7 days**

### Row-Level Security (RLS)
| Table | Read | Write |
|-------|------|-------|
| profiles | Public | Own row only |
| sounds | Public if `is_public=true AND status=ready`, or own | Own row only |
| playlists | Public if `is_public=true`, or own | Own row only |
| reactions | Public | Auth users — own only |
| shares | Own (sender or recipient) | Auth users send; recipients mark read |
| play_history | Own | Own |

---

## 6. Authentication System

**Mechanism:** PIN-based (no passwords)

### Registration Flow
1. User picks a unique username
2. Server generates a random 4-digit PIN
3. Synthetic email: `username@inka.app`
4. Stored in Supabase Auth with password: `PIN + "00"`

### Login Flow
1. User enters username + PIN
2. `usernameToEmail(username)` → synthetic email
3. `signInWithPassword(email, PIN + "00")` (fallback: raw PIN for legacy accounts)
4. Supabase returns JWT session token
5. Session cached in `useAuthStore` (Zustand)

### Authorization
- All mutations guarded by Supabase RLS via JWT
- Server-side operations use `SUPABASE_SERVICE_ROLE_KEY`
- Admin routes check user role server-side

---

## 7. State Management — 8 Zustand Stores

### `authStore`
- **State:** `session`, `profile`, `isLoading`
- **Actions:** `setSession`, `setProfile`, `fetchProfile`, `signIn`, `signOut`

### `playerStore`
- **State:** `currentSound`, `queue`, `isPlaying`, `isVisible`, `shuffle`, `repeatMode`, `position`, `duration`, `howl`
- **Actions:** `setCurrentSound`, `setQueue`, `playSound`, `togglePlay`, `skipToNext`, `skipToPrevious`, `toggleShuffle`, `cycleRepeat`, `seekTo`, `stop`

### `feedStore`
- **State:** `sounds[]`, `isLoading`, `hasMore`, `page`
- **Actions:** `setSounds`, `appendSounds`, `updateSound`, `prependSound`, `optimisticReaction`, `reset`

### `themeStore`
- **State:** `accentHue`, `accentColor`, `accentColorDark`
- **Logic:** Maps French mood keywords → HSL hue → `--accent` / `--accent-dark` CSS vars

### `uploadStore`
- **State:** `status`, `file`, `metadata`, `progress`
- **Actions:** `reset`, `setProgress`

### `savedSoundsStore`
- **State:** `savedSounds: Map<id, SoundMetadata>` (persisted in `localStorage`)
- **Actions:** `save`, `remove`, `isSaved`, `clear`

### `savedReleasesStore`
- **State:** `savedReleases: Map<id, SavedRelease>` (persisted in `localStorage`)
- **Actions:** `save`, `remove`, `isSaved`

### `inboxStore`
- **State:** `shares[]`, `isRead: Map<id, boolean>`
- **Actions:** `setShares`, `markAsRead`

---

## 8. Algorithms & Business Logic

### Recommendation Engine (`/api/recommendations`)

Hybrid weighted scoring for the "Pour Toi" (For You) feed:

```
score = genre_match    × 0.35
      + artist_match   × 0.20
      + collab_score   × 0.20   ← collaborative filtering
      + trending       × 0.15
      + recency        × 0.10

Recency decay: exp(-age_days / 45)
  → ~78% weight at 10d, ~22% weight at 90d

Candidate signals:
  - Play history (last 14 days)
  - Reactions: fire=4pts, heart=3pts, pray=2pts, sleep=-2pts
  - Trending sounds (last 48h)
  - Collaborative: sounds liked by users with similar taste

Diversity filters:
  - Max 3 sounds per artist
  - Max 6 sounds per genre
  - Exclude: already-played sounds, sounds with sleep reaction

New users: Fallback → top sounds by play_count
```

### Genre Enrichment Cascade (`/api/admin/fill-genres`)

```
1. MusicBrainz  → query by title+artist → extract genre tags
2. Last.fm      → track.getInfo → top tags
                  Filter out: "seen live", "favourite", etc.
3. OpenAI       → inference fallback for unresolved tracks
```

### Theme Color Generation (`themeStore`)

Maps French mood keywords to HSL hues, generates CSS custom properties:

| Mood Keywords | Hue |
|--------------|-----|
| triste, nostalgique, douleur | 220° (blue) |
| amour, passion, coeur | 340° (rose) |
| spirituel, prière, gospel | 270° (violet) |
| fête, joie, danse | 45° (yellow) |
| colère, rage, street, dark | 350° (red) |
| calme, relaxant, chill | 170° (teal) |
| introspectif, méditation | 240° (indigo) |
| énergique, motivant, puissant | 25° (orange) |
| espoir, lumière, positif | 140° (green) |

HSL → RGB conversion generates `--accent`, `--accent-dark`, `--accent-gradient` CSS vars applied globally.

### Audio Compression (`/lib/audioOptimizer.ts`)

- Client-side Opus 128kbps VBR via `MediaRecorder` API
- SHA-256 fingerprint for deduplication
- Fallback to original file if codec unsupported
- Tracks: `file_size_original`, `file_size_compressed`, `bitrate`, `audio_format`

### AI Track Enrichment (`/api/enrich`)

For each uploaded sound, calls OpenAI to infer:
- `mood` — emotional tone (French keywords)
- `energy_level` — low / medium / high
- `themes[]` — lyrical/sonic themes
- `similar_sounds[]` — matched sound IDs from database

---

## 9. UI/UX Design System

### Colors

```
Primary:       #E8902A  (orange — brand)
Background:    #0d0d0d  (near-black)
Surface:       #1a1a1a
Elevated:      #242424
Text Primary:  #F0EDE8
Text Secondary:#8A8680
Text Muted:    #4A4744
Accent:        Dynamic — mood-based HSL
```

### Spacing Scale

```
xs: 4px   sm: 8px   md: 16px   lg: 24px   xl: 32px   xxl: 48px
```

### Border Radius Scale

```
sm: 8px   md: 12px   lg: 16px   xl: 24px   full: 9999px
```

### Key UI Components

| Component | Role |
|-----------|------|
| `SoundCard` | Grid/list track card; hover lifts with shadow + play button |
| `TrendingCard` | Ranked track card with listener count badge |
| `ArtistCard` | Artist latest release with follow action |
| `PlaylistCard` | Playlist preview with cover grid |
| `CoverArt` | Generative album art from title/artist/genre |
| `UserAvatar` | Profile avatar with size variants |
| `ReactionBar` | Fire/Heart/Sleep/Pray emoji reactions |
| `MiniPlayer` | Sticky bottom player (always visible during playback) |
| `Navbar` | Bottom tab navigation: Feed / Browse / Library / Inbox / Profile |
| `TopBar` | Page header with search input and genre filter chips |
| `FAB` | Floating Action Button for upload |
| `BottomSheet` | Modal overlay for playlist add / share flows |
| `Button` | Primary / secondary / ghost variants |
| `Badge` | Count/status badges |

### UX Patterns

- **Optimistic UI** — reactions update instantly before server confirmation
- **Debounced search** — 300ms delay, parallel Inka + Deezer results
- **Card hover effects** — translateY lift + box-shadow + play button reveal
- **PWA install prompt** — shown after engagement threshold
- **Offline banner** — notifies user when network is unavailable
- **Sticky MiniPlayer** — persists across navigation; expands to full player
- **Infinite scroll** — feed loads more sounds on scroll

---

## 10. Third-Party Integrations

| Service | Purpose | Notes |
|---------|---------|-------|
| **Supabase** | Database, auth, RLS | Core data layer |
| **Cloudflare R2** | Audio file storage | Presigned URLs (PUT: 15min, GET: 1hr) |
| **OpenAI** | Mood enrichment, playlist naming, genre inference | Default: gpt-4o-mini |
| **Deezer** | Artist profiles, discography, track search, cover CDN | REST API |
| **Last.fm** | Trending charts, track metadata | Optional (LASTFM_API_KEY) |
| **MusicBrainz** | Genre/release metadata | Open API |
| **iTunes** | Trending + recent releases | RSS/JSON feed |
| **YouTube** | Music video discovery | Search API |
| **Howler.js** | Web Audio playback engine | Client-side |
| **next-pwa/Workbox** | Service Worker + offline caching | Production only |

---

## 11. PWA Caching Strategy (Workbox)

| Resource Type | Strategy | TTL |
|--------------|----------|-----|
| Audio files (`/api/audio`) | NetworkFirst | 24 hours |
| Static assets (JS, CSS) | CacheFirst | 30 days |
| Page data / API responses | NetworkFirst | 1 hour |
| Google Fonts | StaleWhileRevalidate | 1 year |
| Deezer CDN images | CacheFirst | 7 days |
| Supabase storage images | CacheFirst | 1 day |

Service Worker is **disabled in development** (`NODE_ENV=development`) and **active in production**.

---

## 12. Environment Variables

### Server-Side (Secret)

```bash
SUPABASE_SERVICE_ROLE_KEY        # Supabase admin key — never expose to client
OPENAI_API_KEY                   # OpenAI API key
OPENAI_MODEL                     # Model name (default: gpt-4o-mini)
R2_ACCOUNT_ID                    # Cloudflare R2 account ID
R2_ACCESS_KEY_ID                 # R2 access key
R2_SECRET_ACCESS_KEY             # R2 secret key
R2_BUCKET_NAME                   # R2 bucket name
R2_PUBLIC_URL                    # Public bucket URL (optional; disables signed GET URLs)
LASTFM_API_KEY                   # Last.fm API key (optional)
```

### Public (Client-Accessible)

```bash
NEXT_PUBLIC_SUPABASE_URL         # Supabase project URL (safe to expose)
```

---

## 13. Performance Optimizations

### Data Fetching
- **SWR** for browse data: 10min dedup for genres, 2min for recent, 10min for popular
- **Parallel queries** in recommendation engine (`Promise.all`)
- **Server-side pagination** (recommendations return 20–40 items)

### Audio
- Client-side Opus compression before upload reduces storage/bandwidth
- Presigned PUT URLs bypass server for direct R2 upload

### Rendering
- Next.js App Router with Server Components where possible
- Dynamic imports for heavy components (player, playlists)
- Route-based code splitting (automatic via Next.js)

### Images
- `sharp` for server-side thumbnail optimization
- Lazy loading on all cards
- Deezer CDN for external artwork

---

## 14. Security Considerations

- **PIN storage:** `PIN + "00"` suffix in Supabase Auth (compatibility padding)
- **Service role key:** Server-side only — never sent to client
- **R2 access:** All reads/writes via presigned URLs — no direct bucket access
- **RLS enforcement:** Every table has Supabase Row-Level Security policies
- **File scoping:** Audio files keyed under user ID in R2 (`userId/filename`)
- **Data retention:** Automatic cleanup of play history (90d), shares (180d), errors (7d)
- **No persistent tracking:** No long-term analytics or user behavioral logging

---

## 15. Build & Deployment

```bash
npm run dev      # Development server (Service Worker disabled)
npm run build    # Production build
npm start        # Production server (Service Worker active)
```

### Database Migrations
- SQL files in `/supabase/migrations/`
- Applied via Supabase CLI or dashboard

### Hosting
- Next.js app deployed on VPS
- Environment variables set in server environment
- Cloudflare R2 for audio storage (no egress fees within Cloudflare network)
