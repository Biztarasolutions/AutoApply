-- AutoApply Initial Schema Migration
-- This migration creates all tables, indexes, RLS policies, and triggers for the AutoApply platform

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  headline TEXT,
  bio TEXT,
  skills JSONB DEFAULT '[]'::jsonb,
  experience JSONB DEFAULT '[]'::jsonb,
  education JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Resumes table
CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  parsed_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ATS Scores table
CREATE TABLE IF NOT EXISTS ats_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  job_description TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job Matches table
CREATE TABLE IF NOT EXISTS job_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  match_score INTEGER NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Applications table
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'interviewing', 'offered', 'rejected', 'withdrawn')),
  cover_letter TEXT,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Application History table (for tracking status changes)
CREATE TABLE IF NOT EXISTS application_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);

-- Resumes indexes
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_created_at ON resumes(created_at);

-- ATS Scores indexes
CREATE INDEX IF NOT EXISTS idx_ats_scores_resume_id ON ats_scores(resume_id);
CREATE INDEX IF NOT EXISTS idx_ats_scores_score ON ats_scores(score);
CREATE INDEX IF NOT EXISTS idx_ats_scores_created_at ON ats_scores(created_at);

-- Job Matches indexes
CREATE INDEX IF NOT EXISTS idx_job_matches_user_id ON job_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_job_matches_match_score ON job_matches(match_score);
CREATE INDEX IF NOT EXISTS idx_job_matches_created_at ON job_matches(created_at);

-- Applications indexes
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_applied_at ON applications(applied_at);

-- Application History indexes
CREATE INDEX IF NOT EXISTS idx_application_history_application_id ON application_history(application_id);
CREATE INDEX IF NOT EXISTS idx_application_history_changed_at ON application_history(changed_at);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ats_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_history ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Resumes policies
CREATE POLICY "Users can view own resumes"
  ON resumes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resumes"
  ON resumes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own resumes"
  ON resumes FOR DELETE
  USING (auth.uid() = user_id);

-- ATS Scores policies
CREATE POLICY "Users can view own ATS scores"
  ON ats_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM resumes
      WHERE resumes.id = ats_scores.resume_id
      AND resumes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own ATS scores"
  ON ats_scores FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM resumes
      WHERE resumes.id = ats_scores.resume_id
      AND resumes.user_id = auth.uid()
    )
  );

-- Job Matches policies
CREATE POLICY "Users can view own job matches"
  ON job_matches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own job matches"
  ON job_matches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own job matches"
  ON job_matches FOR DELETE
  USING (auth.uid() = user_id);

-- Applications policies
CREATE POLICY "Users can view own applications"
  ON applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own applications"
  ON applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own applications"
  ON applications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own applications"
  ON applications FOR DELETE
  USING (auth.uid() = user_id);

-- Application History policies
CREATE POLICY "Users can view own application history"
  ON application_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = application_history.application_id
      AND applications.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert application history"
  ON application_history FOR INSERT
  WITH CHECK (true);

-- ============================================
-- TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to applications
CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on auth user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function to log application status changes
CREATE OR REPLACE FUNCTION log_application_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO application_history (application_id, old_status, new_status, changed_at)
    VALUES (NEW.id, OLD.status, NEW.status, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to log application status changes
CREATE TRIGGER on_application_status_change
  AFTER UPDATE ON applications
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_application_status_change();

-- ============================================
-- STORAGE BUCKETS (RLS)
-- ============================================

-- Note: Storage buckets are created via Supabase Dashboard or API
-- The following RLS policies assume buckets exist: resumes, cover-letters, avatars

-- Resume bucket policies
CREATE POLICY "Users can upload own resumes"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'resumes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own resumes"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'resumes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own resumes"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'resumes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Cover letters bucket policies
CREATE POLICY "Users can upload own cover letters"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cover-letters'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own cover letters"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'cover-letters'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own cover letters"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'cover-letters'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Avatars bucket policies (public read, owner write)
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- SEED DATA
-- ============================================

-- Insert a demo job listing for testing
INSERT INTO job_matches (user_id, job_data, match_score, source)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '{
    "id": "demo-job-1",
    "title": "Senior Full Stack Developer",
    "company": "TechCorp Inc.",
    "location": "Remote",
    "description": "We are looking for an experienced Full Stack Developer to join our team. You will be responsible for building and maintaining web applications using React, Node.js, and PostgreSQL.",
    "requirements": ["React", "Node.js", "TypeScript", "PostgreSQL", "Git", "REST APIs"],
    "salary_range": "$120,000 - $160,000",
    "url": "https://example.com/jobs/senior-full-stack-developer"
  }'::jsonb,
  85,
  'demo'
) ON CONFLICT DO NOTHING;
