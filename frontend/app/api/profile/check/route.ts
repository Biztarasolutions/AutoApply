// frontend/app/api/profile/check/route.ts
import { NextResponse } from 'next/server';
// @ts-ignore
import { supabaseAdmin } from '../../../../../backend/supabase/utils/bucket';

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from('resumes')
      .select('id')
      .eq('user_id', userId)
      .limit(1);
    if (error) throw error;
    const hasResume = data && data.length > 0;
    return NextResponse.json({ hasResume });
  } catch (e: any) {
    console.error('profile check error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
