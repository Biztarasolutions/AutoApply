-- Migration 007: Add ATS version and created_at index

ALTER TABLE IF EXISTS ats_scores
  ADD COLUMN IF NOT EXISTS ats_version TEXT DEFAULT 'v1';

-- Index for created_at (already exists as default timestamp, but add index for faster queries)
CREATE INDEX IF NOT EXISTS idx_ats_scores_created_at ON ats_scores(created_at);
