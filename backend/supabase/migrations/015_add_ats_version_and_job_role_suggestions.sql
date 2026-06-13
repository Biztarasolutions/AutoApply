-- Migration: 015_add_ats_version_and_job_role_suggestions.sql
-- Add ATS version column if missing
ALTER TABLE ats_scores
  ADD COLUMN IF NOT EXISTS ats_version INTEGER,
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ai_generation_status TEXT;

-- Create job role suggestions table
CREATE TABLE IF NOT EXISTS job_role_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  suggested_role TEXT NOT NULL,
  confidence_score NUMERIC,
  source_resume_id UUID,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Future‑proof profile fields
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS preferred_salary NUMERIC,
      ADD COLUMN IF NOT EXISTS preferred_countries JSONB,
      ADD COLUMN IF NOT EXISTS visa_sponsorship_required BOOLEAN,
      ADD COLUMN IF NOT EXISTS preferred_company_types JSONB;
  END IF;
END $$;
