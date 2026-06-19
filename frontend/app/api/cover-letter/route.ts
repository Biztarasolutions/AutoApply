import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const geminiApiKey = process.env.GEMINI_API_KEY!;

// POST /api/cover-letter — generate a personalized cover letter
export async function POST(request: Request) {
  try {
    const { userId, jobId, resumeText, jobTitle, company, jobDescription, tone = 'professional' } =
      await request.json();

    if (!resumeText || !jobTitle || !company || !jobDescription) {
      return NextResponse.json(
        { error: 'resumeText, jobTitle, company, and jobDescription are required' },
        { status: 400 }
      );
    }

    let coverLetterContent = '';

    if (geminiApiKey) {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const toneInstructions: Record<string, string> = {
        professional: 'formal and professional',
        enthusiastic: 'enthusiastic and energetic while staying professional',
        concise: 'brief and concise (under 250 words)',
        creative: 'creative and memorable while being professional',
      };

      const prompt = `You are an expert career coach. Write a compelling, personalized cover letter.

Tone: ${toneInstructions[tone] || toneInstructions.professional}

Job Title: ${jobTitle}
Company: ${company}
Job Description:
${jobDescription}

Candidate Resume:
${resumeText}

Instructions:
- Address it to the hiring team (use "Dear Hiring Team," if no specific name available)
- Open with a strong hook that references the specific company or role
- Highlight 2-3 most relevant skills/experiences from the resume that match the job
- Show genuine enthusiasm for the company and role
- Include a concrete achievement with a number or metric if visible in the resume
- Close with a clear call to action requesting an interview
- Keep it to 3-4 paragraphs, under 400 words
- Do NOT use generic filler phrases like "I am writing to apply for..."
- Format as plain text with paragraph breaks, no markdown headers

Write only the cover letter body — no subject line or meta-commentary.`;

      const result = await model.generateContent(prompt);
      coverLetterContent = result.response.text();
    } else {
      // Fallback: template-based cover letter
      coverLetterContent = generateTemplateCoverLetter({ jobTitle, company, jobDescription, resumeText, tone });
    }

    // Save to DB if available
    if (userId && jobId && supabaseUrl && supabaseServiceKey && !supabaseUrl.includes('placeholder')) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase.from('cover_letters').insert({
        user_id: userId,
        job_id: jobId,
        content: coverLetterContent,
        tone,
      });
    }

    return NextResponse.json({ content: coverLetterContent, tone });
  } catch (error: any) {
    console.error('Cover letter generation error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate cover letter' }, { status: 500 });
  }
}

// GET /api/cover-letter?userId=xxx — list user's cover letters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('placeholder')) {
      return NextResponse.json({ coverLetters: [], mock: true });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase
      .from('cover_letters')
      .select('id, job_id, content, tone, version, is_active, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ coverLetters: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function generateTemplateCoverLetter({
  jobTitle,
  company,
  jobDescription,
  resumeText,
  tone,
}: {
  jobTitle: string;
  company: string;
  jobDescription: string;
  resumeText: string;
  tone: string;
}) {
  const skillMatches = extractTopSkills(resumeText, jobDescription);

  return `Dear Hiring Team,

I am excited to apply for the ${jobTitle} position at ${company}. With my background in ${skillMatches.join(', ')}, I am confident I can make an immediate impact on your team.

${generateBodyParagraph(resumeText, jobDescription)}

What particularly draws me to ${company} is the opportunity to work on challenging problems with a team that values excellence. I am eager to bring my experience and passion to contribute to your mission.

I would welcome the opportunity to discuss how my skills align with your team's goals. Thank you for your consideration, and I look forward to hearing from you.

Best regards`;
}

function extractTopSkills(resumeText: string, jobDescription: string): string[] {
  const techKeywords = [
    'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'SQL',
    'AWS', 'Docker', 'Kubernetes', 'REST', 'GraphQL', 'Machine Learning', 'AI',
    'PostgreSQL', 'MongoDB', 'Redis', 'Git', 'CI/CD', 'Agile', 'Scrum',
  ];

  const jdLower = jobDescription.toLowerCase();
  const resumeLower = resumeText.toLowerCase();

  return techKeywords
    .filter((k) => jdLower.includes(k.toLowerCase()) && resumeLower.includes(k.toLowerCase()))
    .slice(0, 3);
}

function generateBodyParagraph(resumeText: string, jobDescription: string): string {
  const hasLeadership = /lead|manage|team|mentor/i.test(resumeText);
  const hasImpact = /\d+%|\d+x|million|thousand|improved|reduced|increased/i.test(resumeText);

  if (hasImpact) {
    return 'Throughout my career, I have consistently delivered measurable results. My experience spans building scalable systems, collaborating cross-functionally, and driving projects from inception to production.';
  }

  if (hasLeadership) {
    return 'In my previous roles, I have led engineering teams, mentored junior developers, and driven technical decisions that improved product quality and team velocity.';
  }

  return 'My experience has given me a strong foundation in building reliable, maintainable software. I thrive in collaborative environments and enjoy solving complex technical challenges.';
}
