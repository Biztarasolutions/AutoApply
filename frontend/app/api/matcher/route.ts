import { NextResponse } from 'next/server';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { profile, job } = await request.json();

    if (!profile || !job) {
      return NextResponse.json({ error: 'Both profile and job details are required' }, { status: 400 });
    }

    // Static resolution of backend modules
    const { matchJob } = require('../../../../backend/ai/matcher');

    const matchReport = await matchJob(profile, job);

    return NextResponse.json(matchReport);
  } catch (error: any) {
    console.error('❌ Error in matcher API route:', error);
    return NextResponse.json({ error: error.message || 'Failed to match profile to job' }, { status: 500 });
  }
}
