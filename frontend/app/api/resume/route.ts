import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

function sanitize(text: string) {
  return text
    .replace(/\\/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

// POST /api/resume — upload, extract, parse, score, and save
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null;
    const userEmail = formData.get('userEmail') as string | null;

    if (!file || !userId) {
      return NextResponse.json({ error: 'file and userId are required' }, { status: 400 });
    }

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only PDF, DOCX, and TXT files are allowed' }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be under 5MB' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let parsedText = '';

    if (file.type === 'application/pdf') {
      try {
        const { extractText } = await import('unpdf');
        const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
        // Preserve line breaks — collapse only horizontal whitespace per line
        parsedText = text
          .split(/\r?\n/)
          .map((l: string) => l.replace(/[ \t]+/g, ' ').trim())
          .filter((l: string) => l.length > 0)
          .join('\n');
      } catch (e: any) {
        console.error('PDF parse error:', e?.message || e);
        parsedText = '';
      }
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        parsedText = result.value || '';
      } catch (e) {
        console.error('DOCX parse error:', e);
      }
    } else {
      parsedText = buffer.toString('utf-8');
    }

    const ext = file.name.split('.').pop() || 'pdf';
    const safeFileName = `${userId}/${Date.now()}-resume.${ext}`;

    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('placeholder')) {
      return NextResponse.json({
        success: true,
        resume: { id: `mock-${Date.now()}`, user_id: userId, file_path: safeFileName, parsed_text: parsedText, parsed_structure: {}, ats_score: null, created_at: new Date().toISOString() },
        mock: true,
      });
    }

    const supabase = getServiceClient();

    // Upload file to storage (non-fatal if it fails)
    const { error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(safeFileName, buffer, { contentType: file.type, upsert: false });
    if (uploadError) console.error('Storage upload error:', uploadError.message);

    // Ensure profile row exists
    try {
      const email = userEmail || `${userId}@autoapply.local`;
      await supabase.from('profiles').upsert({ id: userId, email }, { onConflict: 'id' });
    } catch (e) {
      console.error('Profile upsert error:', e);
    }

    // Sanitize extracted text
    parsedText = sanitize(parsedText);

    // Parse structure from text (heuristic or Gemini)
    let parsedStructure: any = {};
    try {
      const { parseResume } = await import('@/lib/ai/parser');
      parsedStructure = await parseResume(parsedText);
    } catch (e) {
      console.error('Parser error:', e);
    }

    // Calculate resume strength score (no job description needed)
    let atsScore: number | null = null;
    try {
      const { calculateResumeStrength } = await import('@/lib/ai/parser');
      atsScore = calculateResumeStrength(parsedText, parsedStructure);
    } catch (e) {
      console.error('ATS score error:', e);
    }

    const { data: resumeRow, error: dbError } = await supabase
      .from('resumes')
      .insert({
        user_id: userId,
        file_path: safeFileName,
        parsed_text: parsedText,
        parsed_structure: parsedStructure,
        ats_score: atsScore,
        parser_status: 'parsed',
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB insert error:', dbError.message);
      return NextResponse.json({
        success: true,
        resume: { id: `local-${Date.now()}`, user_id: userId, file_path: safeFileName, parsed_text: parsedText, parsed_structure: parsedStructure, ats_score: atsScore, created_at: new Date().toISOString() },
        warning: `Resume parsed but could not save to database: ${dbError.message}`,
      });
    }

    return NextResponse.json({ success: true, resume: resumeRow });
  } catch (error: any) {
    console.error('Resume upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}

// PATCH /api/resume — update fields (no updated_at column in schema)
export async function PATCH(request: Request) {
  try {
    const { resumeId, userId, parsed_text, parsed_structure } = await request.json();
    if (!resumeId || !userId) {
      return NextResponse.json({ error: 'resumeId and userId required' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('placeholder')) {
      return NextResponse.json({ success: true, mock: true });
    }

    const supabase = getServiceClient();
    const updates: any = {};
    if (parsed_text !== undefined) updates.parsed_text = sanitize(parsed_text);
    if (parsed_structure !== undefined) updates.parsed_structure = parsed_structure;

    // Recalculate ATS score after edit
    if (parsed_text !== undefined || parsed_structure !== undefined) {
      try {
        const { calculateResumeStrength } = await import('@/lib/ai/parser');
        const text = updates.parsed_text ?? parsed_text ?? '';
        const structure = updates.parsed_structure ?? parsed_structure ?? {};
        updates.ats_score = calculateResumeStrength(text, structure);
      } catch (e) {
        console.error('ATS recalc error:', e);
      }
    }

    const { data, error } = await supabase
      .from('resumes')
      .update(updates)
      .eq('id', resumeId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, resume: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/resume?userId=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('placeholder')) {
      return NextResponse.json({ resumes: [], mock: true, message: 'Database not configured' });
    }

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('resumes')
      .select('id, file_path, parsed_text, parsed_structure, ats_score, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Generate signed URLs
    const resumesWithUrls = await Promise.all(
      (data || []).map(async (resume) => {
        if (!resume.file_path) return { ...resume, url: null };
        const { data: urlData } = await supabase.storage
          .from('resumes')
          .createSignedUrl(resume.file_path, 3600);
        return { ...resume, url: urlData?.signedUrl || null };
      })
    );

    return NextResponse.json({ resumes: resumesWithUrls });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/resume
export async function DELETE(request: Request) {
  try {
    const { resumeId, userId, filePath } = await request.json();
    if (!resumeId || !userId) {
      return NextResponse.json({ error: 'resumeId and userId are required' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('placeholder')) {
      return NextResponse.json({ success: true, mock: true });
    }

    const supabase = getServiceClient();
    if (filePath) {
      await supabase.storage.from('resumes').remove([filePath]);
    }

    const { error } = await supabase
      .from('resumes')
      .delete()
      .eq('id', resumeId)
      .eq('user_id', userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
