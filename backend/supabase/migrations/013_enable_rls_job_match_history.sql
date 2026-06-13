-- Migration 013: Enable RLS on job_match_history and policies

ALTER TABLE IF EXISTS job_match_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'job_match_history' AND policyname = 'job_match_user_read'
  ) THEN
    CREATE POLICY "job_match_user_read" ON job_match_history
    FOR SELECT USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'job_match_history' AND policyname = 'job_match_user_insert'
  ) THEN
    CREATE POLICY "job_match_user_insert" ON job_match_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;
