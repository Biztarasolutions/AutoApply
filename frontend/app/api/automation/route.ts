import { NextResponse } from 'next/server';
import { Client } from 'pg';
import path from 'path';

// Local in-memory store for mock applications when database is offline
const mockApplicationsDb: Record<string, any> = {};

export async function POST(request: Request) {
  try {
    const { userId, jobId, resumeId } = await request.json();

    if (!userId || !jobId) {
      return NextResponse.json({ error: 'userId and jobId are required' }, { status: 400 });
    }

    const connectionString = process.env.DATABASE_URL;
    let applicationId = crypto.randomUUID();

    if (!connectionString) {
      console.log('⚠️ DATABASE_URL not configured. Simulating application creation in memory.');
      mockApplicationsDb[applicationId] = {
        id: applicationId,
        user_id: userId,
        job_id: jobId,
        resume_id: resumeId || null,
        status: 'pending',
        created_at: new Date().toISOString()
      };
      
      // Start background simulation
      triggerMockAutomation(applicationId);
      
      return NextResponse.json({ 
        success: true, 
        message: 'Mock application automation started in memory.',
        applicationId 
      });
    }

    const client = new Client({
      connectionString,
      ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false }
    });

    await client.connect();

    try {
      // Check if application already exists
      const existingRes = await client.query(
        'SELECT id FROM public.applications WHERE user_id = $1 AND job_id = $2',
        [userId, jobId]
      );

      if (existingRes.rows.length > 0) {
        applicationId = existingRes.rows[0].id;
        // Reset status to pending
        await client.query(
          "UPDATE public.applications SET status = 'pending', updated_at = NOW() WHERE id = $1",
          [applicationId]
        );
      } else {
        // Create new application
        const insertRes = await client.query(
          `INSERT INTO public.applications (id, user_id, job_id, resume_id, status)
           VALUES ($1, $2, $3, $4, 'pending')
           RETURNING id`,
          [applicationId, userId, jobId, resumeId || null]
        );
        applicationId = insertRes.rows[0].id;
      }

      // Initialize empty automation log row
      await client.query(
        `INSERT INTO public.automation_logs (application_id, steps, current_step, status)
         VALUES ($1, '[]'::jsonb, 'Starting...', 'running')
         ON CONFLICT (application_id) DO UPDATE
         SET steps = '[]'::jsonb, current_step = 'Starting...', status = 'running', error_message = NULL`,
        [applicationId]
      );

      // Static resolution of backend modules
      const { runAutoApply } = require('../../../../backend/automation/runner');
      
      // Execute in background
      runAutoApply(applicationId).catch((err: any) => {
        console.error('❌ Background automation runner failed:', err.message);
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Automation runner triggered successfully.',
        applicationId 
      });

    } finally {
      await client.end();
    }

  } catch (error: any) {
    console.error('❌ Error in automation API:', error);
    return NextResponse.json({ error: error.message || 'Failed to trigger automation' }, { status: 500 });
  }
}

// In-memory simulation runner when database is offline
async function triggerMockAutomation(applicationId: string) {
  const steps = [
    { step: 'Initialization', status: 'success', details: 'Launching headless browser and setting up anti-detection proxies...', timestamp: new Date().toISOString() },
    { step: 'Navigation', status: 'success', details: 'Navigating to job posting details page...', timestamp: new Date().toISOString() },
    { step: 'Form Extraction', status: 'success', details: 'Detected application fields: Full Name, Email, Resume Upload, Cover Letter, Custom Questions.', timestamp: new Date().toISOString() },
    { step: 'Form Filling', status: 'success', details: 'Auto-filling profile variables into standard fields.', timestamp: new Date().toISOString() },
    { step: 'Resume Uploading', status: 'success', details: 'Retrieving resume file from Supabase storage and attaching to input[type=file].', timestamp: new Date().toISOString() },
    { step: 'Custom Questions', status: 'success', details: 'Answering custom recruiter screeners with AI-generated responses.', timestamp: new Date().toISOString() },
    { step: 'Form Submission', status: 'success', details: 'Submitting form data via simulated human clicks.', timestamp: new Date().toISOString() },
    { step: 'Submission Verifying', status: 'success', details: 'Successfully verified confirmation text and application ID. Application registered.', timestamp: new Date().toISOString() }
  ];

  const currentSteps: any[] = [];
  mockApplicationsDb[applicationId].logs = {
    steps: currentSteps,
    current_step: 'Starting...',
    status: 'running'
  };

  for (let i = 0; i < steps.length; i++) {
    await new Promise(r => setTimeout(r, 1200));
    currentSteps.push(steps[i]);
    mockApplicationsDb[applicationId].logs = {
      steps: [...currentSteps],
      current_step: steps[i].step,
      status: i === steps.length - 1 ? 'success' : 'running'
    };
    if (i === steps.length - 1) {
      mockApplicationsDb[applicationId].status = 'applied';
    }
  }
}

export { mockApplicationsDb };
