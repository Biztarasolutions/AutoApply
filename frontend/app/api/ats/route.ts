import { NextResponse } from 'next/server';
import { calculateAtsScore } from '@/lib/ai/ats';

export async function POST(request: Request) {
  try {
    const { resumeText, jobDescription } = await request.json();

    if (!resumeText || !jobDescription) {
      return NextResponse.json({ error: 'Both resumeText and jobDescription are required' }, { status: 400 });
    }

    const atsReport = await calculateAtsScore(resumeText, jobDescription);
    return NextResponse.json(atsReport);
  } catch (error: any) {
    console.error('Error in ATS API route:', error);
    return NextResponse.json({ error: error.message || 'Failed to calculate ATS score' }, { status: 500 });
  }
}
