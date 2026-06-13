-- Migration 011: Drop duplicate triggers if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_question_memory_updated_at') THEN
    EXECUTE 'DROP TRIGGER set_question_memory_updated_at ON question_memory';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_automation_rules_updated_at') THEN
    EXECUTE 'DROP TRIGGER set_automation_rules_updated_at ON automation_rules';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_cover_letters_updated_at') THEN
    EXECUTE 'DROP TRIGGER set_cover_letters_updated_at ON cover_letters';
  END IF;
END $$;
