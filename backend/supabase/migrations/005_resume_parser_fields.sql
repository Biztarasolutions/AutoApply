-- 005_resume_parser_fields.sql
-- Adds fields for resume parser confidence and status

ALTER TABLE IF EXISTS resumes
ADD COLUMN IF NOT EXISTS parser_confidence_score NUMERIC,
ADD COLUMN IF NOT EXISTS parser_status TEXT DEFAULT 'PENDING';
