-- Migration 02: Additional tables for AutoApply platform
-- Run after 01_init.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ATS Scores history (per resume per job)
CREATE TABLE IF NOT EXISTS public.ats_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    resume_id UUID REFERENCES public.resumes(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    matched_keywords TEXT[] DEFAULT '{}'::TEXT[],
    missing_keywords TEXT[] DEFAULT '{}'::TEXT[],
    suggestions JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 2. Job match results history
CREATE TABLE IF NOT EXISTS public.match_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    resume_id UUID REFERENCES public.resumes(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    rating TEXT CHECK (rating IN ('Excellent', 'Good', 'Fair', 'Poor')),
    match_percentage INTEGER CHECK (match_percentage >= 0 AND match_percentage <= 100),
    pros TEXT[] DEFAULT '{}'::TEXT[],
    cons TEXT[] DEFAULT '{}'::TEXT[],
    tailoring_advice TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 3. Cover letters
CREATE TABLE IF NOT EXISTS public.cover_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    tone TEXT DEFAULT 'professional',
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 4. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL, -- 'application_update', 'interview_reminder', 'new_match', 'follow_up'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 5. Automation rules
CREATE TABLE IF NOT EXISTS public.automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    min_ats_score INTEGER DEFAULT 70,
    min_match_percentage INTEGER DEFAULT 60,
    preferred_locations TEXT[] DEFAULT '{}'::TEXT[],
    excluded_companies TEXT[] DEFAULT '{}'::TEXT[],
    auto_apply BOOLEAN DEFAULT false,
    daily_apply_limit INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 6. Application logs (granular event log per application)
CREATE TABLE IF NOT EXISTS public.application_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,
    event_type TEXT NOT NULL, -- 'status_change', 'note_added', 'email_sent', 'interview_scheduled'
    description TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 7. Question memory (stores answers to common screener questions for reuse)
CREATE TABLE IF NOT EXISTS public.question_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT DEFAULT 'general', -- 'salary', 'experience', 'availability', 'general'
    use_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 8. Job sources (configured scrapers / integrations)
CREATE TABLE IF NOT EXISTS public.job_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- 'naukri', 'indeed', 'wellfound', 'dice', 'foundit'
    display_name TEXT NOT NULL,
    base_url TEXT,
    is_active BOOLEAN DEFAULT true,
    scraper_config JSONB DEFAULT '{}'::JSONB,
    last_scraped_at TIMESTAMP WITH TIME ZONE,
    jobs_found_last_run INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 9. Job match history (aggregate per user-job pair, deduplicated)
CREATE TABLE IF NOT EXISTS public.job_match_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
    ats_score INTEGER,
    match_percentage INTEGER,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    applied BOOLEAN DEFAULT false,
    UNIQUE(user_id, job_id)
);

-- 10. AI logs (track Gemini API usage for cost monitoring)
CREATE TABLE IF NOT EXISTS public.ai_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    feature TEXT NOT NULL, -- 'parse', 'ats', 'match', 'cover_letter', 'interview_prep'
    model TEXT DEFAULT 'gemini-1.5-flash',
    input_tokens INTEGER,
    output_tokens INTEGER,
    latency_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable RLS on all new tables
ALTER TABLE public.ats_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cover_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_match_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- ats_scores
CREATE POLICY "Users own ats_scores" ON public.ats_scores FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- match_results
CREATE POLICY "Users own match_results" ON public.match_results FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- cover_letters
CREATE POLICY "Users own cover_letters" ON public.cover_letters FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- notifications
CREATE POLICY "Users own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- automation_rules
CREATE POLICY "Users own automation_rules" ON public.automation_rules FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- application_logs (accessible through application ownership)
CREATE POLICY "Users view their application_logs" ON public.application_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.applications
            WHERE public.applications.id = public.application_logs.application_id
            AND public.applications.user_id = auth.uid()
        )
    );
CREATE POLICY "Service can insert application_logs" ON public.application_logs FOR INSERT WITH CHECK (true);

-- question_memory
CREATE POLICY "Users own question_memory" ON public.question_memory FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- job_sources (read-only for authenticated users, admin-managed)
CREATE POLICY "Authenticated can read job_sources" ON public.job_sources FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service manages job_sources" ON public.job_sources FOR ALL USING (true) WITH CHECK (true);

-- job_match_history
CREATE POLICY "Users own job_match_history" ON public.job_match_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ai_logs (service role only writes, users can read their own)
CREATE POLICY "Users read own ai_logs" ON public.ai_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service inserts ai_logs" ON public.ai_logs FOR INSERT WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ats_scores_user_id ON public.ats_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_ats_scores_job_id ON public.ats_scores(job_id);
CREATE INDEX IF NOT EXISTS idx_cover_letters_user_id ON public.cover_letters(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_question_memory_user_id ON public.question_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_job_match_history_user_id ON public.job_match_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_user_id ON public.ai_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_feature ON public.ai_logs(feature, created_at);

-- Seed default job sources
INSERT INTO public.job_sources (name, display_name, base_url, is_active)
VALUES
    ('naukri', 'Naukri', 'https://www.naukri.com', true),
    ('foundit', 'Foundit (Monster)', 'https://www.foundit.in', true),
    ('indeed', 'Indeed', 'https://www.indeed.com', true),
    ('wellfound', 'Wellfound', 'https://wellfound.com', true),
    ('dice', 'Dice', 'https://www.dice.com', true),
    ('remoteok', 'Remote OK', 'https://remoteok.com', true),
    ('weworkremotely', 'We Work Remotely', 'https://weworkremotely.com', true)
ON CONFLICT (name) DO NOTHING;
