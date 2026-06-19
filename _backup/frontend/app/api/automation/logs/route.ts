import { NextResponse } from 'next/server';
import { Client } from 'pg';
import { mockApplicationsDb } from '../route';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId');

    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId is required' }, { status: 400 });
    }

    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      // Return local memory logs if database is offline
      const mockApp = mockApplicationsDb[applicationId];
      if (mockApp && mockApp.logs) {
        return NextResponse.json(mockApp.logs);
      }
      return NextResponse.json({ 
        steps: [], 
        current_step: 'Offline simulation pending...', 
        status: 'running' 
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
      const logRes = await client.query(
        'SELECT steps, current_step, status, error_message FROM public.automation_logs WHERE application_id = $1',
        [applicationId]
      );

      if (logRes.rows.length === 0) {
        return NextResponse.json({ steps: [], current_step: 'Initializing log row...', status: 'running' });
      }

      return NextResponse.json(logRes.rows[0]);
    } finally {
      await client.end();
    }

  } catch (error: any) {
    console.error('❌ Error fetching automation logs:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch logs' }, { status: 500 });
  }
}
