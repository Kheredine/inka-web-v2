-- Spotify imported data storage
-- Stores liked tracks, playlists, and albums imported from Spotify

-- ── spotify_liked_tracks ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.spotify_liked_tracks (
  id            UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spotify_id    TEXT NOT NULL,
  name          TEXT NOT NULL,
  artists       TEXT NOT NULL,
  album         TEXT,
  album_art     TEXT,
  duration_ms   INT,
  spotify_url   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, spotify_id)
);

ALTER TABLE public.spotify_liked_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own Spotify liked tracks" ON public.spotify_liked_tracks;
DROP POLICY IF EXISTS "Users can insert own Spotify liked tracks" ON public.spotify_liked_tracks;
DROP POLICY IF EXISTS "Users can delete own Spotify liked tracks" ON public.spotify_liked_tracks;

CREATE POLICY "Users can read own Spotify liked tracks"
  ON public.spotify_liked_tracks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own Spotify liked tracks"
  ON public.spotify_liked_tracks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own Spotify liked tracks"
  ON public.spotify_liked_tracks FOR DELETE
  USING (auth.uid() = user_id);

-- ── spotify_saved_albums ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.spotify_saved_albums (
  id            UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spotify_id    TEXT NOT NULL,
  name          TEXT NOT NULL,
  artists       TEXT NOT NULL,
  image         TEXT,
  album_type    TEXT,
  release_date  TEXT,
  total_tracks  INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, spotify_id)
);

ALTER TABLE public.spotify_saved_albums ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own Spotify saved albums" ON public.spotify_saved_albums;
DROP POLICY IF EXISTS "Users can insert own Spotify saved albums" ON public.spotify_saved_albums;
DROP POLICY IF EXISTS "Users can delete own Spotify saved albums" ON public.spotify_saved_albums;

CREATE POLICY "Users can read own Spotify saved albums"
  ON public.spotify_saved_albums FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own Spotify saved albums"
  ON public.spotify_saved_albums FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own Spotify saved albums"
  ON public.spotify_saved_albums FOR DELETE
  USING (auth.uid() = user_id);

-- ── spotify_playlists ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.spotify_playlists (
  id            UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spotify_id    TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  image         TEXT,
  track_count   INT NOT NULL DEFAULT 0,
  owner         TEXT,
  is_public     BOOLEAN NOT NULL DEFAULT false,
  spotify_url   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, spotify_id)
);

ALTER TABLE public.spotify_playlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own Spotify playlists" ON public.spotify_playlists;
DROP POLICY IF EXISTS "Users can insert own Spotify playlists" ON public.spotify_playlists;
DROP POLICY IF EXISTS "Users can delete own Spotify playlists" ON public.spotify_playlists;

CREATE POLICY "Users can read own Spotify playlists"
  ON public.spotify_playlists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own Spotify playlists"
  ON public.spotify_playlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own Spotify playlists"
  ON public.spotify_playlists FOR DELETE
  USING (auth.uid() = user_id);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_spotify_liked_tracks_user ON public.spotify_liked_tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_spotify_saved_albums_user ON public.spotify_saved_albums(user_id);
CREATE INDEX IF NOT EXISTS idx_spotify_playlists_user ON public.spotify_playlists(user_id);