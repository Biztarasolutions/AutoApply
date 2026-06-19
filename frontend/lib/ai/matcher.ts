import { GoogleGenerativeAI } from '@google/generative-ai';

export async function matchJob(profile: any, job: any) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key') {
    return getMockJobMatch(profile, job);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `You are an expert recruiter. Compare this candidate profile to the job and return JSON:
{
  "rating": "Excellent | Good | Fair | Poor",
  "percentage": number (0-100),
  "pros": ["string"],
  "cons": ["string"],
  "tailoringAdvice": "string"
}

Candidate:
- Headline: ${profile.headline || 'Job Seeker'}
- Skills: ${(profile.skills || []).join(', ')}
- Experience: ${JSON.stringify(profile.experience || [])}

Job:
- Title: ${job.title}
- Company: ${job.company}
- Description: ${job.description}
- Requirements: ${(job.requirements || []).join(', ')}`;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (error: any) {
    console.error('Gemini matcher error:', error.message);
    return getMockJobMatch(profile, job);
  }
}

function getMockJobMatch(profile: any, job: any) {
  const profileSkills = (profile.skills || []).map((s: string) => s.toLowerCase());
  const jobReqs = (job.requirements || []).map((r: string) => r.toLowerCase());
  const jobTitle = job.title.toLowerCase();
  const headline = (profile.headline || '').toLowerCase();

  const matched: string[] = [];
  const unmatched: string[] = [];

  jobReqs.forEach((req: string) => {
    const hasSkill = profileSkills.some((skill: string) => req.includes(skill) || skill.includes(req));
    (hasSkill ? matched : unmatched).push(req);
  });

  const titleMatch = jobTitle.split(/\s+/).filter((w: string) => w.length > 3).some((w: string) => headline.includes(w));
  const total = jobReqs.length || 4;
  let percentage = Math.round(((matched.length + (titleMatch ? 1 : 0)) / (total + 1)) * 100);
  percentage = Math.max(30, Math.min(95, percentage));

  let rating = 'Fair';
  if (percentage >= 85) rating = 'Excellent';
  else if (percentage >= 70) rating = 'Good';
  else if (percentage < 45) rating = 'Poor';

  const pros = matched.map((m: string) => `Meets requirement: "${m}"`);
  if (titleMatch) pros.unshift(`Title aligns with "${profile.headline}"`);
  else pros.push('Foundational tech background relevant to the role');

  const cons = unmatched.length > 0 ? unmatched.map((u: string) => `Gap in: "${u}"`) : ['No obvious gaps found'];

  return {
    rating,
    percentage,
    pros: pros.slice(0, 3),
    cons: cons.slice(0, 3),
    tailoringAdvice: `Highlight experience with "${jobReqs[0] || 'relevant skills'}" and demonstrate team impact.`,
  };
}
