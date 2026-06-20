import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// POST /api/resume â€” upload a resume file, extract text, parse, and save
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null;
    const userEmail = formData.get('userEmail') as string | null;

    console.log('Resume upload â€” userId:', userId, '| userEmail:', userEmail, '| file:', file?.name);
    if (!file || !userId) {
      return NextResponse.json({ error: 'file and userId are required' }, { status: 400 });
    }

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only PDF, DOCX, and TXT files are allowed' }, { status: 400 });
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size must be under 5MB' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from file
    let parsedText = '';

    if (file.type === 'application/pdf') {
      try {
        // unpdf: serverless-safe PDF text extraction (bundles pdfjs with all browser polyfills)
        const { extractText } = await import('unpdf');
        const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
        parsedText = text.replace(/\s+/g, ' ').trim();
        console.log('PDF extraction success, length:', parsedText.length);
      } catch (e: any) {
        console.error('PDF parse error:', e?.message || e);
        parsedText = `[PDF extraction failed: ${e?.message || 'unknown error'}]`;
      }
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        parsedText = result.value;
      } catch (e) {
        console.error('DOCX parse error:', e);
        parsedText = '[DOCX text extraction failed â€” please paste resume text manually]';
      }
    } else {
      parsedText = buffer.toString('utf-8');
    }

    const ext = file.name.split('.').pop() || 'pdf';
    const safeFileName = `${userId}/${Date.now()}-resume.${ext}`;

    // If Supabase is available, upload to storage and save to DB
    if (supabaseUrl && supabaseServiceKey && !supabaseUrl.includes('placeholder')) {
      const supabase = getServiceClient();

      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(safeFileName, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        // Continue without storage â€” save text to DB only
      }

      // Ensure profile row exists (resumes.user_id FK references profiles.id)
      try {
        const email = userEmail || `${userId}@autoapply.local`;
        await supabase
          .from('profiles')
          .upsert({ id: userId, email, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      } catch (e) {
        console.error('Profile upsert error:', e);
      }

      // Sanitize text â€” remove backslashes and control chars that break PostgreSQL unicode parsing
      parsedText = parsedText
        .replace(/\\/g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .trim();

      // AI-parse the extracted text
      let parsedStructure = {};
      try {
        const { parseResume } = await import('@/lib/ai/parser');
        parsedStructure = await parseResume(parsedText);
      } catch (e) {
        console.error('AI parse error:', e);
      }

      const { data: resumeRow, error: dbError } = await supabase
        .from('resumes')
        .insert({
          user_id: userId,
          file_path: safeFileName,
          parsed_text: parsedText,
          parsed_structure: parsedStructure,
        })
        .select()
        .single();

      if (dbError) {
        console.error('DB insert error:', dbError.message, dbError.code, dbError.details);
        // Still return success with parsed text so user can use it even if DB save fails
        return NextResponse.json({
          success: true,
          resume: {
            id: `local-${Date.now()}`,
            user_id: userId,
            file_path: safeFileName,
            parsed_text: parsedText,
            parsed_structure: parsedStructure,
            created_at: new Date().toISOString(),
          },
          parsedText,
          parsedStructure,
          warning: `Resume parsed successfully but could not save to database: ${dbError.message}`,
        });
      }

      return NextResponse.json({
        success: true,
        resume: resumeRow,
        parsedText,
        parsedStructure,
      });
    }

    // Mock mode fallback
    return NextResponse.json({
      success: true,
      resume: {
        id: `mock-${Date.now()}`,
        user_id: userId,
        file_path: safeFileName,
        parsed_text: parsedText,
        parsed_structure: {},
        created_at: new Date().toISOString(),
      },
      parsedText,
      parsedStructure: {},
      mock: true,
    });

  } catch (error: any) {
    console.error('Resume upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}

// PATCH /api/resume â€” update parsed_text or parsed_structure
export async function PATCH(request: Request) {
  try {
    const { resumeId, userId, parsed_text, parsed_structure } = await request.json();
    if (!resumeId || !userId) return NextResponse.json({ error: 'resumeId and userId required' }, { status: 400 });

    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('placeholder')) {
      return NextResponse.json({ success: true, mock: true });
    }

    const supabase = getServiceClient();
    const updates: any = { updated_at: new Date().toISOString() };
    if (parsed_text !== undefined) updates.parsed_text = parsed_text.replace(/\\/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
    if (parsed_structure !== undefined) updates.parsed_structure = parsed_structure;

    const { data, error } = await supabase
      .from('resumes').update(updates).eq('id', resumeId).eq('user_id', userId).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, resume: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/resume?userId=xxx â€” list user's resumes
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('placeholder')) {
      return NextResponse.json({
        resumes: [],
        mock: true,
        message: 'Database not configured â€” no resumes stored yet',
      });
    }

    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from('resumes')
      .select('id, file_path, parsed_text, parsed_structure, ats_score, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate signed URLs for each resume
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

// DELETE /api/resume â€” delete a resume
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

    // Delete file from storage
    if (filePath) {
      await supabase.storage.from('resumes').remove([filePath]);
    }

    const { error } = await supabase
      .from('resumes')
      .delete()
      .eq('id', resumeId)
      .eq('user_id', userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

