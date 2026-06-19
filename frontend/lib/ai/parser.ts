import { GoogleGenerativeAI } from '@google/generative-ai';

export async function parseResume(resumeText: string) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key') {
    return getMockParsedResume(resumeText);
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
  "headline": "string",
  "bio": "string",
  "skills": ["string"],
  "experience": [{ "company": "string", "role": "string", "dates": "string", "description": "string" }],
  "education": [{ "school": "string", "degree": "string", "field": "string", "dates": "string" }]
}

Resume Text:
---
${resumeText}
---`;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (error: any) {
    console.error('Gemini parse error:', error.message);
    return getMockParsedResume(resumeText);
  }
}

function getMockParsedResume(text = '') {
  const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return {
    full_name: lines[0]?.replace(/[^a-zA-Z\s]/g, '') || 'Jane Doe',
    email: emailMatch?.[0] || 'jane.doe@example.com',
    headline: 'Senior Full Stack Engineer',
    bio: 'Dynamic software developer with 5+ years building scalable web applications.',
    skills: ['JavaScript', 'React', 'Node.js', 'Next.js', 'PostgreSQL', 'TypeScript', 'Git'],
    experience: [
      { company: 'DevSolutions Tech', role: 'Lead Frontend Developer', dates: '2023 - Present', description: 'Led Next.js portal development, improving load speed 30%.' },
      { company: 'WebFlow Systems', role: 'Full Stack Engineer', dates: '2021 - 2023', description: 'Built React dashboards and optimized PostgreSQL queries.' },
    ],
    education: [{ school: 'State Tech University', degree: 'B.S. Computer Science', field: 'Computer Science', dates: '2017 - 2021' }],
  };
}
