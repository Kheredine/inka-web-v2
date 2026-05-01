-- ── Atomic Play Count RPC ────────────────────────────────────────────────────
-- Single transaction that: records play history, increments play count,
-- AND updates the user's taste profile. No race conditions, one DB hit.

-- Play history table (if not exists)
CREATE TABLE IF NOT EXISTS play_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sound_id UUID NOT NULL REFERENCES sounds(id) ON DELETE CASCADE,
  played_at TIMESTAMPTZ DEFAULT NOW()
);

-- User taste signals table (if not exists)
CREATE TABLE IF NOT EXISTS user_taste_signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sound_id UUID NOT NULL REFERENCES sounds(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL DEFAULT 'play',
  weight FLOAT NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, sound_id, signal_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_play_history_user ON play_history(user_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_play_history_sound ON play_history(sound_id);
CREATE INDEX IF NOT EXISTS idx_taste_signals_user ON user_taste_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_taste_signals_lookup ON user_taste_signals(user_id, signal_type, weight DESC);

-- The atomic RPC
CREATE OR REPLACE FUNCTION record_play(p_sound_id UUID, p_user_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 1. Record in play history
  INSERT INTO play_history (user_id, sound_id, played_at)
  VALUES (p_user_id, p_sound_id, NOW());

  -- 2. Increment play count on the sound
  UPDATE sounds SET play_count = COALESCE(play_count, 0) + 1 WHERE id = p_sound_id;

  -- 3. Update taste signal (upsert with decay)
  INSERT INTO user_taste_signals (user_id, sound_id, signal_type, weight)
  VALUES (p_user_id, p_sound_id, 'play', 1.0)
  ON CONFLICT (user_id, sound_id, signal_type)
  DO UPDATE SET
    weight = user_taste_signals.weight + 0.1,
    updated_at = NOW();
END;
$$;
+++++++ REPLACE