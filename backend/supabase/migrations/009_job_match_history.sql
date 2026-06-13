-- Migration 009: job_match_history table

CREATE TABLE IF NOT EXISTS job_match_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  job_id UUID NOT NULL REFERENCES jobs(id),
  resume_id UUID NOT NULL REFERENCES resumes(id),
  overall_match_score NUMERIC,
  skills_score NUMERIC,
  experience_score NUMERIC,
  location_score NUMERIC,
  salary_score NUMERIC,
  ats_score NUMERIC,
  missing_skills TEXT[],
  recommendations TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_job_match_history_user ON job_match_history(user_id);
CREATE INDEX IF NOT EXISTS idx_job_match_history_job ON job_match_history(job_id);
CREATE INDEX IF NOT EXISTS idx_job_match_history_resume ON job_match_history(resume_id);
