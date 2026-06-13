-- Migration 010: ai_logs table for AI request logging

CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- ensure uuid generation

CREATE TABLE IF NOT EXISTS ai_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  service_type TEXT NOT NULL,
  request_size INT NOT NULL,
  response_size INT NOT NULL,
  retry_count INT NOT NULL,
  estimated_cost NUMERIC,
  status TEXT NOT NULL,
  error_message TEXT,
  model_name TEXT,
  prompt_version TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_ai_logs_user ON ai_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_service ON ai_logs(service_type);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at ON ai_logs(created_at);
