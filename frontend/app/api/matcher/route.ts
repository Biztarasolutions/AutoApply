import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const { profile, job, userId } = await request.json();

    if (!profile || !job) {
      return NextResponse.json({ error: 'Both profile and job details are required' }, { status: 400 });
    }

    // Static resolution of backend modules
    const { matchJob } = require('../../../../backend/ai/matcher');

    const matchReport = await matchJob(profile, job);

    // Store in Supabase if userId is provided
    if (userId) {
      const { data, error } = await supabase
        .from('job_matches')
        .insert({
          user_id: userId,
          job_data: job,
          match_score: matchReport.percentage || 0,
          source: job.source || 'unknown',
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        console.error('⚠️ Failed to save job match to Supabase:', error.message);
      } else {
        console.log('✅ Successfully saved job match to database:', data.id);
      }
    }

    return NextResponse.json(matchReport);
  } catch (error: any) {
    console.error('❌ Error in matcher API route:', error);
    return NextResponse.json({ error: error.message || 'Failed to match profile to job' }, { status: 500 });
  }
}
