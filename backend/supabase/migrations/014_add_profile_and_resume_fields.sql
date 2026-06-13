-- Migration: 014_add_profile_and_resume_fields.sql
-- Adds missing columns to existing profiles and resumes tables.
-- Uses ALTER TABLE IF EXISTS and ADD COLUMN IF NOT EXISTS for idempotent migrations.

-- Profiles table enhancements
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS current_title TEXT,
      ADD COLUMN IF NOT EXISTS years_of_experience INTEGER,
      ADD COLUMN IF NOT EXISTS current_company TEXT,
      ADD COLUMN IF NOT EXISTS notice_period TEXT,
      ADD COLUMN IF NOT EXISTS current_ctc NUMERIC,
      ADD COLUMN IF NOT EXISTS expected_ctc NUMERIC,
      ADD COLUMN IF NOT EXISTS preferred_job_roles JSONB,
      ADD COLUMN IF NOT EXISTS preferred_locations JSONB,
      ADD COLUMN IF NOT EXISTS preferred_work_mode TEXT,
      ADD COLUMN IF NOT EXISTS willing_to_relocate BOOLEAN,
      ADD COLUMN IF NOT EXISTS preferred_countries JSONB,
      ADD COLUMN IF NOT EXISTS preferred_salary NUMERIC,
      ADD COLUMN IF NOT EXISTS visa_sponsorship_required BOOLEAN,
      ADD COLUMN IF NOT EXISTS preferred_company_types JSONB,
      ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
      ADD COLUMN IF NOT EXISTS github_url TEXT,
      ADD COLUMN IF NOT EXISTS portfolio_url TEXT,
      ADD COLUMN IF NOT EXISTS profile_completeness_score NUMERIC,
      ADD COLUMN IF NOT EXISTS default_resume_id UUID,
      ADD COLUMN IF NOT EXISTS last_resume_upload_date TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS auto_apply_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS daily_application_limit INTEGER DEFAULT 20,
      ADD COLUMN IF NOT EXISTS minimum_match_score INTEGER DEFAULT 75;
  END IF;
END $$;

-- Resumes table enhancements
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resumes') THEN
    ALTER TABLE resumes
      ADD COLUMN IF NOT EXISTS original_filename TEXT,
      ADD COLUMN IF NOT EXISTS storage_path TEXT,
      ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- End of migration
