-- Migration 008: Create trigger function to auto-update updated_at timestamps

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables that have an updated_at column
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='question_memory' AND column_name='updated_at') THEN
    CREATE TRIGGER set_question_memory_updated_at BEFORE UPDATE ON question_memory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='updated_at') THEN
    CREATE TRIGGER set_automation_rules_updated_at BEFORE UPDATE ON automation_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cover_letters' AND column_name='updated_at') THEN
    CREATE TRIGGER set_cover_letters_updated_at BEFORE UPDATE ON cover_letters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
