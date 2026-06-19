import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || '';

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  const result: any = {
    env: {
      url_len: url.length,
      url_prefix: url.slice(0, 30),
      service_key_len: serviceKey.length,
      service_key_prefix: serviceKey.slice(0, 20),
      anon_key_len: anonKey.length,
      has_gemini: !!(process.env.GEMINI_API_KEY),
    },
    userId,
  };

  if (!url || !serviceKey) {
    result.error = 'Missing env vars';
    return NextResponse.json(result);
  }

  try {
    const supabase = createClient(url, serviceKey);

    // Check profile
    const { data: profile, error: pErr } = await supabase
      .from('profiles').select('id, email').eq('id', userId).single();
    result.profile = profile || null;
    result.profile_error = pErr?.message || null;

    // Check resumes
    const { data: resumes, error: rErr } = await supabase
      .from('resumes').select('id, file_path, created_at').eq('user_id', userId).order('created_at', { ascending: false });
    result.resumes = resumes || [];
    result.resumes_error = rErr?.message || null;

    // Try inserting a test resume
    if (profile) {
      const { data: ins, error: iErr } = await supabase
        .from('resumes')
        .insert({ user_id: userId, file_path: `${userId}/debug-test.txt`, parsed_text: 'debug test' })
        .select().single();
      result.test_insert = ins ? 'OK' : null;
      result.test_insert_error = iErr?.message || null;
      if (ins) {
        await supabase.from('resumes').delete().eq('id', ins.id);
      }
    }
  } catch (e: any) {
    result.exception = e.message;
  }

  return NextResponse.json(result);
}
