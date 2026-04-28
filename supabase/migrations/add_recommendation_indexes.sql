-- Indexes for the /api/recommendations scoring pipeline.
-- Covers the 5 query patterns: user plays, sound trending, genre candidates,
-- artist candidates, fresh sounds, and collaborative peer lookup.

-- play_history: user feed (user profile building + collaborative peer lookup)
CREATE INDEX IF NOT EXISTS play_history_user_played_at
  ON play_history (user_id, played_at DESC);

-- play_history: trending window scan (sound_id → recent count)
CREATE INDEX IF NOT EXISTS play_history_sound_played_at
  ON play_history (sound_id, played_at DESC);

-- reactions: user profile building + peer lookup
CREATE INDEX IF NOT EXISTS reactions_user_id_idx
  ON reactions (user_id);

-- reactions: peer endorsement count (sound_id → how many liked it)
CREATE INDEX IF NOT EXISTS reactions_sound_emoji
  ON reactions (sound_id, emoji);

-- sounds: genre candidate scan (partial — only public sounds)
CREATE INDEX IF NOT EXISTS sounds_genre_public
  ON sounds (genre)
  WHERE is_public = true AND genre IS NOT NULL;

-- sounds: recency candidate scan
CREATE INDEX IF NOT EXISTS sounds_created_at_public
  ON sounds (created_at DESC)
  WHERE is_public = true;

-- sounds: artist candidate scan
CREATE INDEX IF NOT EXISTS sounds_artist_public
  ON sounds (artist)
  WHERE is_public = true;

-- sounds: popularity fallback
CREATE INDEX IF NOT EXISTS sounds_play_count_public
  ON sounds (play_count DESC)
  WHERE is_public = true;
