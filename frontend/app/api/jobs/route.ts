import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function GET() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.log('⚠️ DATABASE_URL is not set. Returning mock jobs...');
    return NextResponse.json(getMockJobs());
  }

  const client = new Client({
    connectionString,
    ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const res = await client.query('SELECT * FROM public.jobs ORDER BY created_at DESC');
    
    if (res.rows.length === 0) {
      // Seed data on demand if empty
      console.log('🌱 Jobs table is empty. Returning mock fallback jobs.');
      return NextResponse.json(getMockJobs());
    }

    return NextResponse.json(res.rows);
  } catch (error: any) {
    console.error('❌ Database error in jobs API:', error.message);
    return NextResponse.json(getMockJobs());
  } finally {
    await client.end();
  }
}

function getMockJobs() {
  return [
    {
      id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      title: 'Frontend Engineer (React)',
      company: 'TechCorp Solutions',
      location: 'San Francisco, CA (Hybrid)',
      description: 'We are looking for a passionate Frontend Engineer with experience in React and Next.js. You will build user-facing web applications, collaborate with designers, and optimize web performance.',
      requirements: ['3+ years experience with React/Next.js', 'Strong proficiency in HTML, CSS, and modern JS', 'Experience with state management (Redux, Zustand)'],
      url: 'https://careers.techcorp.com/jobs/frontend-engineer',
      source: 'LinkedIn',
      salary_range: '$120,000 - $150,000'
    },
    {
      id: 'b2c3d4e5-f67a-8b9c-0d1e-2f3a4b5c6d7e',
      title: 'Full Stack Developer (Next.js & Supabase)',
      company: 'StartupX Inc.',
      location: 'Remote (US/Canada)',
      description: 'Join our fast-growing startup as a Full Stack Developer! You will work on our core product using Next.js, TypeScript, and Supabase. You will design database schemas, implement API routes, and build features.',
      requirements: ['Experience with Next.js App Router', 'Comfortable working with PostgreSQL and Supabase', 'Strong knowledge of TypeScript'],
      url: 'https://startupx.io/careers/full-stack-dev',
      source: 'Indeed',
      salary_range: '$100,000 - $130,000'
    },
    {
      id: 'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
      title: 'Backend Systems Engineer',
      company: 'FinanceFlow Technologies',
      location: 'New York, NY (Onsite)',
      description: 'FinanceFlow is seeking a Backend Systems Engineer to join our core API team. You will be responsible for scaling our transaction systems, developing microservices, and securing user data.',
      requirements: ['Solid experience in Node.js, Go, or Python', 'Experience designing relational databases (PostgreSQL/MySQL)', 'Understanding of microservice architecture'],
      url: 'https://financeflow.tech/careers/backend-systems',
      source: 'Glassdoor',
      salary_range: '$140,000 - $180,000'
    }
  ];
}
