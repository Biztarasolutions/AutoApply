import { NextResponse } from 'next/server';
import { Client } from 'pg';
import { mockApplicationsDb } from '../automation/route';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      console.log('⚠️ DATABASE_URL not configured. Returning memory mock applications.');
      const list = Object.values(mockApplicationsDb).filter((app: any) => app.user_id === userId);
      
      // Map mock jobs to the mock applications
      const mockJobs = getMockJobs();
      const enrichedList = list.map((app: any) => ({
        ...app,
        job: mockJobs.find(j => j.id === app.job_id) || mockJobs[0]
      }));

      // Add a default one if none exists so the user sees a populated tracker
      if (enrichedList.length === 0) {
        enrichedList.push({
          id: 'mock-app-id-1',
          user_id: userId,
          job_id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
          status: 'interviewing',
          applied_at: new Date().toISOString(),
          job: mockJobs[0]
        });
        enrichedList.push({
          id: 'mock-app-id-2',
          user_id: userId,
          job_id: 'b2c3d4e5-f67a-8b9c-0d1e-2f3a4b5c6d7e',
          status: 'applied',
          applied_at: new Date().toISOString(),
          job: mockJobs[1]
        });
      }

      return NextResponse.json(enrichedList);
    }

    const client = new Client({
      connectionString,
      ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false }
    });

    await client.connect();

    try {
      // Join applications and jobs
      const appRes = await client.query(`
        SELECT 
          a.id,
          a.user_id,
          a.job_id,
          a.resume_id,
          a.status,
          a.applied_at,
          a.notes,
          json_build_object(
            'id', j.id,
            'title', j.title,
            'company', j.company,
            'location', j.location,
            'salary_range', j.salary_range
          ) as job
        FROM public.applications a
        JOIN public.jobs j ON a.job_id = j.id
        WHERE a.user_id = $1
        ORDER BY a.updated_at DESC
      `, [userId]);

      return NextResponse.json(appRes.rows);
    } finally {
      await client.end();
    }

  } catch (error: any) {
    console.error('❌ Error in applications list API:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch applications' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { applicationId, status, notes } = await request.json();

    if (!applicationId || !status) {
      return NextResponse.json({ error: 'applicationId and status are required' }, { status: 400 });
    }

    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      console.log('⚠️ DATABASE_URL not configured. Updating status in memory.');
      if (mockApplicationsDb[applicationId]) {
        mockApplicationsDb[applicationId].status = status;
        if (notes !== undefined) {
          mockApplicationsDb[applicationId].notes = notes;
        }
        return NextResponse.json({ success: true, application: mockApplicationsDb[applicationId] });
      }
      
      // Fallback update for default mock items
      return NextResponse.json({ success: true, message: 'Simulated memory update complete.' });
    }

    const client = new Client({
      connectionString,
      ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false }
    });

    await client.connect();

    try {
      await client.query(`
        UPDATE public.applications
        SET status = $1, notes = COALESCE($2, notes), updated_at = NOW()
        WHERE id = $3
      `, [status, notes || null, applicationId]);

      return NextResponse.json({ success: true });
    } finally {
      await client.end();
    }

  } catch (error: any) {
    console.error('❌ Error updating application status:', error);
    return NextResponse.json({ error: error.message || 'Failed to update application status' }, { status: 500 });
  }
}

function getMockJobs() {
  return [
    {
      id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      title: 'Frontend Engineer (React)',
      company: 'TechCorp Solutions',
      location: 'San Francisco, CA (Hybrid)',
      salary_range: '$120,000 - $150,000'
    },
    {
      id: 'b2c3d4e5-f67a-8b9c-0d1e-2f3a4b5c6d7e',
      title: 'Full Stack Developer (Next.js & Supabase)',
      company: 'StartupX Inc.',
      location: 'Remote (US/Canada)',
      salary_range: '$100,000 - $130,000'
    },
    {
      id: 'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
      title: 'Backend Systems Engineer',
      company: 'FinanceFlow Technologies',
      location: 'New York, NY (Onsite)',
      salary_range: '$140,000 - $180,000'
    }
  ];
}
