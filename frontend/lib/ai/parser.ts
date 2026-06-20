import { GoogleGenerativeAI } from '@google/generative-ai';

export async function parseResume(resumeText: string) {
  const apiKey = process.env.GEMINI_API_KEY;

  // AQ. prefix = OAuth token, not a valid API key
  if (!apiKey || apiKey === 'your_gemini_api_key' || apiKey.startsWith('AQ.')) {
    return extractResumeFromText(resumeText);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `You are an expert ATS parser. Analyze the following resume text and extract information in JSON format:
{
  "full_name": "string",
  "email": "string",
  "phone": "string",
  "headline": "string",
  "bio": "string",
  "skills": ["string"],
  "experience": [{ "company": "string", "role": "string", "dates": "string", "description": "string" }],
  "education": [{ "school": "string", "degree": "string", "field": "string", "dates": "string" }]
}

Return only valid JSON. If a field is not found, use null or empty array.

Resume Text:
---
${resumeText}
---`;

    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());
    // Merge with heuristic extraction as fallback for empty fields
    const heuristic = extractResumeFromText(resumeText);
    return {
      full_name: parsed.full_name || heuristic.full_name,
      email: parsed.email || heuristic.email,
      phone: parsed.phone || heuristic.phone,
      headline: parsed.headline || heuristic.headline,
      bio: parsed.bio || heuristic.bio,
      skills: parsed.skills?.length ? parsed.skills : heuristic.skills,
      experience: parsed.experience?.length ? parsed.experience : heuristic.experience,
      education: parsed.education?.length ? parsed.education : heuristic.education,
    };
  } catch (error: any) {
    console.error('Gemini parse error:', error.message);
    return extractResumeFromText(resumeText);
  }
}

// Heuristic extraction — works without AI by parsing text patterns
export function extractResumeFromText(text: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Email
  const emailMatch = text.match(/([a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/);
  const email = emailMatch?.[0] || '';

  // Phone
  const phoneMatch = text.match(/(\+?[\d\s\-().]{10,15})/);
  const phone = phoneMatch?.[0]?.trim() || '';

  // Name — first non-email, non-phone line of reasonable length
  const nameLine = lines.find(l =>
    l.length > 3 && l.length < 60 &&
    !l.includes('@') &&
    !l.match(/^\+?[\d\s\-().]{8,}$/) &&
    !l.toLowerCase().includes('resume') &&
    !l.toLowerCase().includes('curriculum')
  );
  const full_name = nameLine?.replace(/[^a-zA-Z\s.'-]/g, '').trim() || '';

  // Headline — line after name that looks like a title
  const nameIdx = nameLine ? lines.indexOf(nameLine) : -1;
  const headlineLine = nameIdx >= 0
    ? lines.slice(nameIdx + 1, nameIdx + 4).find(l =>
        l.length > 5 && l.length < 100 &&
        !l.includes('@') &&
        !l.match(/^\+?[\d\s\-().]{8,}$/)
      )
    : undefined;
  const headline = headlineLine || '';

  // Skills — look for skills section
  const skillsSectionIdx = lines.findIndex(l => /^skills?$/i.test(l) || /^technical skills?$/i.test(l) || /^core competencies$/i.test(l));
  let skills: string[] = [];
  if (skillsSectionIdx >= 0) {
    // Collect lines after "Skills" header until next section header
    const sectionLines = lines.slice(skillsSectionIdx + 1, skillsSectionIdx + 15);
    for (const l of sectionLines) {
      if (/^(experience|education|work|projects?|certifications?|summary|profile|objective)$/i.test(l)) break;
      // Skills are often comma or pipe separated
      const items = l.split(/[,|•·\t]/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 40);
      skills.push(...items);
    }
  }
  // Also scan full text for common skill keywords
  const commonSkills = [
    'Python', 'Java', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'SQL', 'Excel',
    'Power BI', 'Tableau', 'R', 'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes',
    'Machine Learning', 'Deep Learning', 'NLP', 'TensorFlow', 'PyTorch',
    'Pandas', 'NumPy', 'Spark', 'Hadoop', 'Airflow', 'dbt', 'Snowflake',
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Git', 'CI/CD', 'Agile', 'Scrum',
    'Next.js', 'Vue', 'Angular', 'CSS', 'HTML', 'REST API', 'GraphQL',
  ];
  const foundSkills = commonSkills.filter(sk => new RegExp(sk.replace('.', '\\.'), 'i').test(text));
  const allSkills = [...new Set([...skills, ...foundSkills])].slice(0, 20);

  // Experience — look for experience/work section
  const expIdx = lines.findIndex(l => /^(work experience|experience|employment|professional experience)$/i.test(l));
  const experience: any[] = [];
  if (expIdx >= 0) {
    let i = expIdx + 1;
    while (i < lines.length && experience.length < 5) {
      const l = lines[i];
      if (/^(education|skills?|projects?|certifications?|summary|profile)$/i.test(l)) break;
      // Date patterns like "Jan 2020 – Dec 2022" or "2018 - 2020"
      const dateMatch = l.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4})\b.*?\b(\d{4}|Present|Current)\b/i);
      if (dateMatch) {
        // The line before this is likely company or role
        const prevLine = lines[i - 1] || '';
        const prevPrevLine = lines[i - 2] || '';
        experience.push({
          company: prevPrevLine.length < 60 ? prevPrevLine : '',
          role: prevLine.length < 80 ? prevLine : '',
          dates: dateMatch[0],
          description: lines.slice(i + 1, i + 4).join(' '),
        });
        i += 5;
      } else {
        i++;
      }
    }
  }

  // Education
  const eduIdx = lines.findIndex(l => /^education$/i.test(l));
  const education: any[] = [];
  if (eduIdx >= 0) {
    const eduLines = lines.slice(eduIdx + 1, eduIdx + 10);
    for (let i = 0; i < eduLines.length; i++) {
      const l = eduLines[i];
      if (/\b(B\.?S\.?|B\.?E\.?|M\.?S\.?|M\.?B\.?A\.?|Ph\.?D\.?|Bachelor|Master|Diploma)\b/i.test(l)) {
        education.push({
          degree: l.trim(),
          school: eduLines[i - 1]?.trim() || '',
          field: '',
          dates: eduLines[i + 1]?.match(/\d{4}/)?.[0] || '',
        });
      }
    }
  }

  // Bio — look for summary/profile/objective section
  const bioIdx = lines.findIndex(l => /^(summary|profile|objective|about|professional summary)$/i.test(l));
  let bio = '';
  if (bioIdx >= 0) {
    bio = lines.slice(bioIdx + 1, bioIdx + 5).join(' ').slice(0, 400);
  }

  return { full_name, email, phone, headline, bio, skills: allSkills, experience, education };
}

// Resume strength score (0-100) based on content completeness — no job description needed
export function calculateResumeStrength(parsedText: string, structure: any): number {
  let score = 0;

  if (structure?.full_name?.trim()) score += 10;
  if (structure?.email?.trim()) score += 8;
  if (structure?.phone?.trim()) score += 5;
  if (structure?.headline?.trim()) score += 7;
  if (structure?.bio?.trim() && structure.bio.length > 50) score += 10;

  const skillCount = structure?.skills?.length || 0;
  score += Math.min(20, skillCount * 2); // up to 20 pts for 10+ skills

  const expCount = structure?.experience?.length || 0;
  score += Math.min(20, expCount * 7); // up to 20 pts for 3+ entries

  if (structure?.education?.length > 0) score += 8;

  // Text length / richness
  const words = parsedText.trim().split(/\s+/).length;
  if (words > 200) score += 5;
  if (words > 400) score += 5;
  if (words > 600) score += 2;

  return Math.min(100, Math.round(score));
}
