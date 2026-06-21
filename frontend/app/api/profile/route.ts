import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return NextResponse.json({ profile: data || null });
  } catch (e: any) {
    // Return empty profile if table doesn't exist yet
    return NextResponse.json({ profile: null });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, ...profileData } = body;
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: userId, ...profileData, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ profile: data });
  } catch (e: any) {
    // Graceful fallback — return the payload as-is so frontend can cache locally
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ profile: body, _offline: true });
  }
}
