import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let supabaseAdmin: any;
if (supabaseUrl && supabaseKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn('Supabase configuration missing; using mock client for build');
  // Mock implementation supporting the required method chain
  supabaseAdmin = {
    from: (_: any) => ({
      select: (_: any) => ({
        eq: (_: any, __: any) => ({
          limit: (_: any) => ({ data: [], error: null })
        })
      })
    })
  } as any;
}

export { supabaseAdmin };
