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
