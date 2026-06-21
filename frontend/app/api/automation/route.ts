import { NextResponse } from 'next/server';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// In-memory log store used when DATABASE_URL is absent
const mockApplicationsDb: Record<string, any> = {};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, jobId, jobUrl, jobTitle, company, profile: clientProfile, resumeId } = body;

    if (!userId || !jobId) {
      return NextResponse.json({ error: 'userId and jobId are required' }, { status: 400 });
    }

    const applicationId = crypto.randomUUID();

    // Initialise in-memory entry immediately so the log poller has something to read
    mockApplicationsDb[applicationId] = {
      id: applicationId,
      user_id: userId,
      job_id: jobId,
      status: 'pending',
      created_at: new Date().toISOString(),
      logs: { steps: [], current_step: 'Starting…', status: 'running' },
    };

    // Fetch profile from DB/cache — prefer what the client sent, fall back to API
    const profile = clientProfile || {};

    // Locate the user's most recent resume PDF if available
    let resumePath: string | null = null;
    try {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir)
          .filter(f => f.endsWith('.pdf') && f.includes(userId.slice(0, 8)))
          .map(f => ({ name: f, mtime: fs.statSync(path.join(uploadsDir, f)).mtimeMs }))
          .sort((a, b) => b.mtime - a.mtime);
        if (files.length > 0) resumePath = path.join(uploadsDir, files[0].name);
      }
    } catch {}

    // Kick off real Playwright runner in background
    const { runAutoApply } = await import('@/lib/automation/runner');
    runAutoApply(applicationId, {
      jobUrl,
      profile: { ...profile, email: profile.email || userId },
      resumePath,
      mockStore: mockApplicationsDb,
    }).catch((err: any) => {
      console.error('❌ Automation runner error:', err.message);
      mockApplicationsDb[applicationId].logs = {
        steps: [{ step: 'Error', status: 'failed', details: err.message, timestamp: new Date().toISOString() }],
        current_step: 'Error',
        status: 'failed',
        error_message: err.message,
      };
    });

    return NextResponse.json({
      success: true,
      message: 'Real automation started.',
      applicationId,
    });

  } catch (error: any) {
    console.error('❌ Error in automation API:', error);
    return NextResponse.json({ error: error.message || 'Failed to trigger automation' }, { status: 500 });
  }
}

// ── Log endpoint uses the same in-memory store ─────────────────────────────────
export { mockApplicationsDb };
