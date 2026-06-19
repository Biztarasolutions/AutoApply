-- 02_extra_tables.sql
-- Additional tables for ATS scoring, match results, and user notifications

-- 1. ATS Scores Table
CREATE TABLE IF NOT EXISTS public.ats_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID REFERENCES public.resumes(id) ON DELETE CASCADE NOT NULL,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
    score INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 2. Match Results Table
CREATE TABLE IF NOT EXISTS public.match_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    resume_id UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
    match_percentage NUMERIC(5,2) NOT NULL,
    relevance_score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 3. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable Row Level Security for new tables
ALTER TABLE public.ats_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- ATS Scores: users can view/update their own scores
CREATE POLICY "User can view own ATS scores" ON public.ats_scores
    FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.resumes WHERE id = ats_scores.resume_id));
CREATE POLICY "User can insert own ATS scores" ON public.ats_scores
    FOR INSERT WITH CHECK (auth.uid() = (SELECT user_id FROM public.resumes WHERE id = ats_scores.resume_id));

-- Match Results: users can view their own match results
CREATE POLICY "User can view own match results" ON public.match_results
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User can insert own match results" ON public.match_results
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Notifications: users can view and mark their own notifications
CREATE POLICY "User can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User can insert own notifications" ON public.notifications
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ats_scores_resume_id ON public.ats_scores(resume_id);
CREATE INDEX IF NOT EXISTS idx_ats_scores_job_id ON public.ats_scores(job_id);
CREATE INDEX IF NOT EXISTS idx_match_results_user_id ON public.match_results(user_id);
CREATE INDEX IF NOT EXISTS idx_match_results_job_id ON public.match_results(job_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
