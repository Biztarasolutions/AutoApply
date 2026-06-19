import { GoogleGenerativeAI } from '@google/generative-ai';

export async function calculateAtsScore(resumeText: string, jobDescription: string) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key') {
    return getMockAtsScore(resumeText, jobDescription);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `You are an ATS scoring bot. Evaluate the resume against the job description and return JSON:
{
  "score": number (0-100),
  "matchedKeywords": ["string"],
  "missingKeywords": ["string"],
  "suggestions": ["string"]
}

Resume:
---
${resumeText}
---

Job Description:
---
${jobDescription}
---`;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (error: any) {
    console.error('Gemini ATS error:', error.message);
    return getMockAtsScore(resumeText, jobDescription);
  }
}

function getMockAtsScore(resumeText = '', jobDescription = '') {
  const techKeywords = [
    'react', 'next.js', 'typescript', 'javascript', 'node.js', 'express',
    'postgresql', 'database', 'supabase', 'css', 'html', 'git', 'docker',
    'aws', 'rest api', 'graphql', 'python', 'scrum', 'agile', 'testing',
  ];

  const resumeLower = resumeText.toLowerCase();
  const jdLower = jobDescription.toLowerCase();
  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  techKeywords.forEach((kw) => {
    if (jdLower.includes(kw)) {
      (resumeLower.includes(kw) ? matchedKeywords : missingKeywords).push(kw.toUpperCase());
    }
  });

  let score = 50;
  const total = matchedKeywords.length + missingKeywords.length;
  if (total > 0) score = Math.round((matchedKeywords.length / total) * 100);
  score = Math.max(35, Math.min(93, score));

  const suggestions = [];
  if (missingKeywords.length > 0) {
    suggestions.push(`Add missing skills: ${missingKeywords.slice(0, 3).join(', ')} into your experience bullets.`);
  }
  suggestions.push("Quantify achievements with metrics, e.g., 'improved load speed by 30%'.");
  suggestions.push("Align your job title headline with the target role to improve ATS indexing.");

  return {
    score,
    matchedKeywords: matchedKeywords.length > 0 ? matchedKeywords : ['JAVASCRIPT', 'REACT', 'GIT'],
    missingKeywords: missingKeywords.length > 0 ? missingKeywords : ['TYPESCRIPT', 'DOCKER', 'POSTGRESQL'],
    suggestions,
  };
}
