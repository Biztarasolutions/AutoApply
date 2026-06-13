-- Migration 004: Auto Apply System Architecture

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. Update profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS github_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS portfolio_url TEXT;

-- 1. jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  salary TEXT,
  remote_type TEXT,
  description TEXT,
  requirements JSONB DEFAULT '[]'::jsonb,
  source TEXT NOT NULL,
  apply_url TEXT NOT NULL,
  ats_platform TEXT,
  posted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company, title, apply_url)
);

-- 2. application_logs table
CREATE TABLE IF NOT EXISTS application_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('success', 'failure')),
  message TEXT,
  screenshot_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. question_memory table
CREATE TABLE IF NOT EXISTS question_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL,
  question_text TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, question_type)
);

-- 4. job_sources table (tracks configured job scrapers)
CREATE TABLE IF NOT EXISTS job_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. automation_rules table
CREATE TABLE IF NOT EXISTS automation_rules (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  minimum_match_score INTEGER DEFAULT 80 CHECK (minimum_match_score >= 0 AND minimum_match_score <= 100),
  remote_only BOOLEAN DEFAULT false,
  minimum_salary NUMERIC,
  target_roles JSONB DEFAULT '[]'::jsonb,
  countries JSONB DEFAULT '[]'::jsonb,
  ats_platforms JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. cover_letters table
CREATE TABLE IF NOT EXISTS cover_letters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_custom BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);

CREATE INDEX IF NOT EXISTS idx_app_logs_app_id ON application_logs(application_id);

CREATE INDEX IF NOT EXISTS idx_question_memory_user ON question_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_question_memory_type ON question_memory(question_type);

CREATE INDEX IF NOT EXISTS idx_cover_letters_user ON cover_letters(user_id);
CREATE INDEX IF NOT EXISTS idx_cover_letters_job ON cover_letters(job_id);

-- Updated At Triggers
-- Triggers moved to migration 008; removed to avoid missing function error.


-- RLS
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE cover_letters ENABLE ROW LEVEL SECURITY;

-- jobs (Public read, Service write)
CREATE POLICY "Jobs are viewable by everyone" ON jobs FOR SELECT USING (true);
CREATE POLICY "System can insert jobs" ON jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update jobs" ON jobs FOR UPDATE USING (true);

-- job_sources (Public read, Service write)
CREATE POLICY "Job sources are viewable by everyone" ON job_sources FOR SELECT USING (true);

-- application_logs (Users can view their own, System can insert)
CREATE POLICY "Users view own app logs" ON application_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM applications WHERE applications.id = application_logs.application_id AND applications.user_id = auth.uid())
);
CREATE POLICY "System can insert app logs" ON application_logs FOR INSERT WITH CHECK (true);

-- question_memory (Users full access)
CREATE POLICY "Users access own question memory" ON question_memory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own question memory" ON question_memory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own question memory" ON question_memory FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own question memory" ON question_memory FOR DELETE USING (auth.uid() = user_id);

-- automation_rules (Users full access)
CREATE POLICY "Users access own automation rules" ON automation_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own automation rules" ON automation_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own automation rules" ON automation_rules FOR UPDATE USING (auth.uid() = user_id);

-- cover_letters (Users full access)
CREATE POLICY "Users access own cover letters" ON cover_letters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own cover letters" ON cover_letters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own cover letters" ON cover_letters FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own cover letters" ON cover_letters FOR DELETE USING (auth.uid() = user_id);
