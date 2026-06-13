/* Migration 012: Enable RLS on ai_logs */
ALTER TABLE IF EXISTS ai_logs ENABLE ROW LEVEL SECURITY;

-- Allow users to view only their own logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_logs' AND policyname = 'User can view own ai logs'
  ) THEN
    CREATE POLICY "User can view own ai logs" ON ai_logs
    FOR SELECT USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Allow inserts (service writes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_logs' AND policyname = 'Service can insert ai logs'
  ) THEN
    CREATE POLICY "Service can insert ai logs" ON ai_logs
    FOR INSERT WITH CHECK (true);
  END IF;
END
$$;
