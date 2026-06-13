-- Migration 006: ATS Engine additional fields

ALTER TABLE IF EXISTS ats_scores
  ADD COLUMN IF NOT EXISTS raw_ai_response TEXT,
  ADD COLUMN IF NOT EXISTS ai_model TEXT,
  ADD COLUMN IF NOT EXISTS ai_prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS ai_generation_status TEXT DEFAULT 'SUCCESS';

-- Indexes for debugging
CREATE INDEX IF NOT EXISTS idx_ats_scores_ai_status ON ats_scores(ai_generation_status);
