import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
// Use service role key to bypass RLS policies if inserting server-side, 
// or standard anon key if client handles permissions. Let's use service key if available.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const { resumeText, jobDescription, resumeId } = await request.json();

    if (!resumeText || !jobDescription) {
      return NextResponse.json({ error: 'Both resumeText and jobDescription are required' }, { status: 400 });
    }

    // Static resolution of backend modules
    const { calculateAtsScore } = require('../../../../backend/ai/ats');

    const atsReport = await calculateAtsScore(resumeText, jobDescription);

    // Store in Supabase if resumeId is provided
    if (resumeId) {
      const { data, error } = await supabase
        .from('ats_scores')
        .insert({
          resume_id: resumeId,
          job_description: jobDescription,
          score: atsReport.score,
          analysis: atsReport,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        console.error('⚠️ Failed to save ATS score to Supabase:', error.message);
      } else {
        console.log('✅ Successfully saved ATS score to database:', data.id);
      }
    }

    return NextResponse.json(atsReport);
  } catch (error: any) {
    console.error('❌ Error in ATS API route:', error);
    return NextResponse.json({ error: error.message || 'Failed to calculate ATS score' }, { status: 500 });
  }
}
