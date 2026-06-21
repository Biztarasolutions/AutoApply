import { NextResponse } from 'next/server';

// In-memory log store — keyed by applicationId
// Railway service streams steps; we poll this from the logs endpoint
const mockApplicationsDb: Record<string, any> = {};

const AUTOMATION_URL = process.env.AUTOMATION_SERVER_URL || '';
const AUTOMATION_SECRET = process.env.AUTOMATION_SECRET || '';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, jobId, jobUrl, jobTitle, company, profile } = body;

    if (!userId || !jobId) {
      return NextResponse.json({ error: 'userId and jobId are required' }, { status: 400 });
    }

    const applicationId = crypto.randomUUID();

    // Initialise log entry so the poller has something to read immediately
    mockApplicationsDb[applicationId] = {
      logs: { steps: [], current_step: 'Starting…', status: 'running' },
    };

    if (!jobUrl) {
      // No URL — can't apply
      mockApplicationsDb[applicationId].logs = {
        steps: [{ step: 'Error', status: 'failed', details: 'No application URL provided for this job. Use "Add Job URL" to paste a direct link.', timestamp: new Date().toISOString() }],
        current_step: 'Error', status: 'failed',
      };
      return NextResponse.json({ success: false, error: 'No job URL', applicationId });
    }

    if (!AUTOMATION_URL) {
      // Automation server not configured
      mockApplicationsDb[applicationId].logs = {
        steps: [{ step: 'Error', status: 'failed', details: 'AUTOMATION_SERVER_URL is not configured. Deploy the automation-server to Railway and add the env var.', timestamp: new Date().toISOString() }],
        current_step: 'Error', status: 'failed',
      };
      return NextResponse.json({ success: false, error: 'Automation server not configured', applicationId });
    }

    // Fire-and-forget: call the Railway automation server in background
    runRemoteApply(applicationId, { jobUrl, profile, jobTitle, company }).catch(err => {
      console.error('Remote apply error:', err.message);
    });

    return NextResponse.json({ success: true, applicationId });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 });
  }
}

async function runRemoteApply(
  applicationId: string,
  opts: { jobUrl: string; profile: any; jobTitle?: string; company?: string },
) {
  const setLog = (steps: any[], currentStep: string, status: string) => {
    mockApplicationsDb[applicationId] = {
      logs: { steps, current_step: currentStep, status },
    };
  };

  try {
    const res = await fetch(`${AUTOMATION_URL}/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AUTOMATION_SECRET ? { 'x-automation-secret': AUTOMATION_SECRET } : {}),
      },
      body: JSON.stringify({
        jobUrl: opts.jobUrl,
        profile: opts.profile || {},
      }),
      signal: AbortSignal.timeout(5 * 60 * 1000), // 5 min max
    });

    const data = await res.json();
    const steps = data.steps || [];
    const lastStep = steps[steps.length - 1];
    const status = res.ok && data.success ? 'success' : 'failed';
    const currentStep = lastStep?.step || (status === 'success' ? 'Submission Verifying' : 'Error');

    setLog(steps, currentStep, status);

  } catch (err: any) {
    setLog(
      [{ step: 'Error', status: 'failed', details: err.message, timestamp: new Date().toISOString() }],
      'Error',
      'failed',
    );
  }
}

export { mockApplicationsDb };
