-- Seed Jobs Table
INSERT INTO public.jobs (id, title, company, location, description, requirements, url, source, salary_range)
VALUES
  (
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'Frontend Engineer (React)',
    'TechCorp Solutions',
    'San Francisco, CA (Hybrid)',
    'We are looking for a passionate Frontend Engineer with experience in React and Next.js. You will build user-facing web applications, collaborate with designers, and optimize web performance.',
    ARRAY['3+ years experience with React/Next.js', 'Strong proficiency in HTML, CSS, and modern JS', 'Experience with state management (Redux, Zustand)', 'Understanding of RESTful APIs and modern frontend tooling'],
    'https://careers.techcorp.com/jobs/frontend-engineer',
    'LinkedIn',
    '$120,000 - $150,000'
  ),
  (
    'b2c3d4e5-f67a-8b9c-0d1e-2f3a4b5c6d7e',
    'Full Stack Developer (Next.js & Supabase)',
    'StartupX Inc.',
    'Remote (US/Canada)',
    'Join our fast-growing startup as a Full Stack Developer! You will work on our core product using Next.js, TypeScript, and Supabase. You will design database schemas, implement API routes, and build features.',
    ARRAY['Experience with Next.js App Router', 'Comfortable working with PostgreSQL and Supabase', 'Strong knowledge of TypeScript', 'Ability to work independently in a fast-paced environment'],
    'https://startupx.io/careers/full-stack-dev',
    'Indeed',
    '$100,000 - $130,000'
  ),
  (
    'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
    'Backend Systems Engineer',
    'FinanceFlow Technologies',
    'New York, NY (Onsite)',
    'FinanceFlow is seeking a Backend Systems Engineer to join our core API team. You will be responsible for scaling our transaction systems, developing microservices, and securing user data.',
    ARRAY['Solid experience in Node.js, Go, or Python', 'Experience designing relational databases (PostgreSQL/MySQL)', 'Understanding of microservice architecture and Docker', 'Knowledge of security standards (OAuth, JWT, encryption)'],
    'https://financeflow.tech/careers/backend-systems',
    'Glassdoor',
    '$140,000 - $180,000'
  ),
  (
    'd4e5f67a-8b9c-0d1e-2f3a-4b5c6d7e8f9a',
    'AI Integration Specialist',
    'InnovateAI Lab',
    'Remote',
    'We are looking for an engineer to integrate large language models (LLMs) into our workflow productivity tools. You will create custom prompts, build parsing engines, and deploy smart agents.',
    ARRAY['Proficiency in JavaScript/TypeScript or Python', 'Experience working with OpenAI API or Google Gemini API', 'Familiarity with LangChain, LlamaIndex, or vector databases', 'Interest in the future of generative AI'],
    'https://innovateai.lab/careers/ai-specialist',
    'Remote.co',
    '$110,000 - $140,000'
  )
ON CONFLICT (id) DO NOTHING;
