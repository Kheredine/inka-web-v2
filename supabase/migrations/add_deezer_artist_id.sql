-- Add Deezer artist ID to sounds table for reliable artist matching.
-- This eliminates name-based search ambiguity (e.g. multiple "Bex" artists on Deezer).
-- Populated at upload time via /api/resolve-deezer-artist and backfilled via /api/admin/backfill-deezer.

ALTER TABLE sounds
  ADD COLUMN IF NOT EXISTS deezer_artist_id BIGINT;

-- Index for Fresh Drops query (groups artists by stored ID)
CREATE INDEX IF NOT EXISTS sounds_deezer_artist_id_idx
  ON sounds (deezer_artist_id)
  WHERE deezer_artist_id IS NOT NULL;
