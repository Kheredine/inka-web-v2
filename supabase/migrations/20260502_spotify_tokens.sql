-- Spotify OAuth tokens storage
-- Stores encrypted tokens for users who connected their Spotify account

CREATE TABLE IF NOT EXISTS public.spotify_tokens (
  user_id       UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  scope         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: users can only read/write their own tokens
ALTER TABLE public.spotify_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own Spotify tokens" ON public.spotify_tokens;
DROP POLICY IF EXISTS "Users can insert own Spotify tokens" ON public.spotify_tokens;
DROP POLICY IF EXISTS "Users can update own Spotify tokens" ON public.spotify_tokens;
DROP POLICY IF EXISTS "Users can delete own Spotify tokens" ON public.spotify_tokens;

CREATE POLICY "Users can read own Spotify tokens"
  ON public.spotify_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own Spotify tokens"
  ON public.spotify_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own Spotify tokens"
  ON public.spotify_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own Spotify tokens"
  ON public.spotify_tokens FOR DELETE
  USING (auth.uid() = user_id);
