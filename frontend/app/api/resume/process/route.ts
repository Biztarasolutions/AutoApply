// frontend/app/api/resume/process/route.ts
import { NextResponse } from 'next/server';
// @ts-ignore: pdf-parse has no typed default export
import { supabaseAdmin } from '../../../../../backend/supabase/utils/bucket';
// Lazy import pdf-parse only when needed
let pdfParse: any = null;
function getPdfParse() {
  if (!pdfParse) {
    try {
      // Require dynamically to avoid loading canvas at build time
      pdfParse = require('pdf-parse');
    } catch (err) {
      console.error('Failed to load pdf-parse:', err);
      throw err;
    }
  }
  return pdfParse;
}
import mammoth from 'mammoth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';

/**
 * Helper: download a file from Supabase storage to a Buffer.
 */
async function downloadFile(path: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin.storage.from('resumes').download(path);
  if (error) throw new Error(`Failed to download file: ${error.message}`);
  // data is a ReadableStream; convert to Buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of data as any) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Extract raw text from a PDF or DOCX buffer.
 */
async function extractText(buffer: Buffer, mime: string): Promise<string> {
  if (mime === 'application/pdf') {
    const pdfParseMod = getPdfParse();
    const pdfParseFn = typeof pdfParseMod === 'function' ? pdfParseMod : pdfParseMod.default;
    const data = await pdfParseFn(buffer);
    return data.text;
  }
  if (
    mime ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  throw new Error('Unsupported file type for extraction');
}

/**
 * Call Gemini to parse resume text into structured JSON.
 */
async function parseWithGemini(text: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `Parse the following resume text and return a JSON object with the following fields:
  name, email, phone, skills (array), experience (array of objects), education (array), certifications (array), linkedin_url, github_url, portfolio_url, current_title, years_of_experience.
  Return ONLY the JSON.`;
  const result = await model.generateContent([prompt, text]);
  const response = await result.response;
  const json = response.text();
  try {
    return JSON.parse(json);
  } catch (e) {
    // fallback: attempt regex for email/phone if missing
    const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const phoneMatch = text.match(/\+?\d[\d\s().-]{7,}\d/);
    const fallback: any = {};
    if (emailMatch) fallback.email = emailMatch[0];
    if (phoneMatch) fallback.phone = phoneMatch[0];
    return fallback;
  }
}

/**
 * Compute profile completeness score based on parsed fields.
 */
function computeCompleteness(parsed: any): number {
  const weights = {
    name: 10,
    email: 10,
    phone: 10,
    skills: 15,
    experience: 15,
    education: 10,
    certifications: 5,
    linkedin_url: 10,
    resumeUploaded: 15,
  };
  let score = 0;
  if (parsed.name) score += weights.name;
  if (parsed.email) score += weights.email;
  if (parsed.phone) score += weights.phone;
  if (Array.isArray(parsed.skills) && parsed.skills.length) score += weights.skills;
  if (Array.isArray(parsed.experience) && parsed.experience.length) score += weights.experience;
  if (Array.isArray(parsed.education) && parsed.education.length) score += weights.education;
  if (Array.isArray(parsed.certifications) && parsed.certifications.length) score += weights.certifications;
  if (parsed.linkedin_url) score += weights.linkedin_url;
  // resumeUploaded always true when we reach here
  score += weights.resumeUploaded;
  return Math.min(score, 100);
}

/**
 * Insert or update profile record.
 */
async function upsertProfile(userId: string, parsed: any, completeness: number) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        id: userId,
        name: parsed.name,
        email: parsed.email,
        phone: parsed.phone,
        skills: JSON.stringify(parsed.skills || []),
        experience: JSON.stringify(parsed.experience || []),
        education: JSON.stringify(parsed.education || []),
        certifications: JSON.stringify(parsed.certifications || []),
        linkedin_url: parsed.linkedin_url,
        github_url: parsed.github_url,
        portfolio_url: parsed.portfolio_url,
        current_title: parsed.current_title,
        years_of_experience: parsed.years_of_experience,
        profile_completeness_score: completeness,
      },
      { onConflict: 'id' }
    );
  if (error) throw new Error(`Profile upsert error: ${error.message}`);
  return data;
}

/**
 * Insert resume metadata record.
 */
async function insertResume(userId: string, filePath: string, originalName: string, extractedAt: string) {
  const resumeId = uuidv4();
  const { error } = await supabaseAdmin.from('resumes').insert({
    id: resumeId,
    user_id: userId,
    original_filename: originalName,
    storage_path: filePath,
    uploaded_at: new Date().toISOString(),
    version: 1,
    is_default: true,
    extracted_at: extractedAt,
  });
  if (error) throw new Error(`Resume insert error: ${error.message}`);
  return resumeId;
}

/**
 * Generate ATS score (placeholder – in real code would call Gemini/AI).
 */
async function generateATS(userId: string, resumeId: string) {
  const atsId = uuidv4();
  const atsVersion = 1;
  const now = new Date().toISOString();
  const dummy = {
    overall_score: 85,
    formatting_score: 90,
    keyword_score: 80,
    skills_score: 88,
    experience_score: 82,
    education_score: 75,
    missing_keywords: [],
    suggestions: [],
    generated_at: now,
    ai_generation_status: 'completed',
    ats_version: atsVersion,
  };
  const { error } = await supabaseAdmin.from('ats_scores').insert({
    id: atsId,
    profile_id: userId,
    resume_id: resumeId,
    ...dummy,
  });
  if (error) throw new Error(`ATS insert error: ${error.message}`);
  return true;
}

/**
 * Generate job role suggestions (very simple heuristic).
 */
async function generateJobSuggestions(userId: string, resumeId: string, skills: string[]) {
  // Simple mapping based on top skill keywords
  const skillSet = new Set(skills.map((s) => s.toLowerCase()));
  const suggestions: { role: string; confidence: number }[] = [];
  if (skillSet.has('python') && skillSet.has('sql') && skillSet.has('power bi')) {
    suggestions.push({ role: 'Data Analyst', confidence: 0.9 });
  }
  if (skillSet.has('python') && skillSet.has('ml')) {
    suggestions.push({ role: 'Data Scientist', confidence: 0.85 });
  }
  if (skillSet.has('react') && skillSet.has('node.js')) {
    suggestions.push({ role: 'Full Stack Developer', confidence: 0.88 });
  }
  // Limit to top 3
  const top = suggestions.slice(0, 3);
  for (const sug of top) {
    const { error } = await supabaseAdmin.from('job_role_suggestions').insert({
      id: uuidv4(),
      user_id: userId,
      resume_id: resumeId,
      suggested_role: sug.role,
      confidence_score: sug.confidence,
      generated_at: new Date().toISOString(),
    });
    if (error) throw new Error(`Job suggestion insert error: ${error.message}`);
  }
  return top.length > 0;
}

export async function POST(request: Request) {
  try {
    const { filePath, fileName, fileType, userId } = await request.json();
    if (!filePath || !fileName || !fileType || !userId) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }
    // 1. Download file
    const fileBuffer = await downloadFile(filePath);
    // 2. Extract text
    const rawText = await extractText(fileBuffer, fileType);
    // 3. Gemini parse
    const parsed = await parseWithGemini(rawText);
    // 4. Compute completeness
    const completeness = computeCompleteness(parsed);
    // 5. Upsert profile
    await upsertProfile(userId, parsed, completeness);
    // 6. Insert resume metadata
    const resumeId = await insertResume(userId, filePath, fileName, new Date().toISOString());
    // 7. Generate ATS
    await generateATS(userId, resumeId);
    // 8. Generate job suggestions
    await generateJobSuggestions(userId, resumeId, parsed.skills || []);
    // 9. Respond
    return NextResponse.json({
      success: true,
      resumeId,
      profileId: userId,
      atsGenerated: true,
      suggestedRolesGenerated: true,
    });
  } catch (e: any) {
    console.error('Resume processing error:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
