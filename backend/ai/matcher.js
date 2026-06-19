
/**
 * Matches a user profile against a specific job posting.
 * Falls back to local match logic if GEMINI_API_KEY is not configured or fails.
 */
async function matchJob(profile, job) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key') {
    console.log('⚠️ GEMINI_API_KEY not set. Using local mock job matcher...');
    return getMockJobMatch(profile, job);
  }

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      You are an expert technical recruiter and talent matcher. Compare the candidate's professional profile against the job posting details.
      Provide your analysis strictly in JSON matching the following schema:
      
      Schema:
      {
        "rating": "string (Excellent | Good | Fair | Poor)",
        "percentage": number (0 to 100),
        "pros": ["string (specific match or experience detail)", ...],
        "cons": ["string (specific gap or mismatched requirement)", ...],
        "tailoringAdvice": "string (1-2 sentences of specific advice for tailoring the application)"
      }

      Candidate Profile:
      - Title/Headline: ${profile.headline || 'Job Seeker'}
      - Bio: ${profile.bio || ''}
      - Skills: ${(profile.skills || []).join(', ')}
      - Experience: ${JSON.stringify(profile.experience || [])}
      
      Job Details:
      - Title: ${job.title}
      - Company: ${job.company}
      - Description: ${job.description}
      - Requirements: ${(job.requirements || []).join(', ')}
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error('❌ Error calling Gemini API for Job Matching:', error.message);
    console.log('🔄 Falling back to mock job matcher...');
    return getMockJobMatch(profile, job);
  }
}

function getMockJobMatch(profile, job) {
  const profileSkills = (profile.skills || []).map(s => s.toLowerCase());
  const jobReqs = (job.requirements || []).map(r => r.toLowerCase());
  const jobTitle = job.title.toLowerCase();
  const headline = (profile.headline || '').toLowerCase();

  const matched = [];
  const unmatched = [];

  // Match job requirements against profile skills
  jobReqs.forEach(req => {
    let hasSkill = false;
    profileSkills.forEach(skill => {
      if (req.includes(skill) || skill.includes(req)) {
        hasSkill = true;
      }
    });

    if (hasSkill) {
      matched.push(req);
    } else {
      unmatched.push(req);
    }
  });

  // Check title alignment
  const titleWords = jobTitle.split(/\s+/).filter(w => w.length > 3);
  let titleMatch = false;
  titleWords.forEach(w => {
    if (headline.includes(w)) {
      titleMatch = true;
    }
  });

  const matchedCount = matched.length;
  const totalCount = jobReqs.length || 4;
  let percentage = 60; // base

  if (totalCount > 0) {
    percentage = Math.round(((matchedCount + (titleMatch ? 1 : 0)) / (totalCount + 1)) * 100);
  }

  // Cap percentage
  if (percentage < 25) percentage = 30;
  if (percentage > 98) percentage = 95;

  let rating = 'Fair';
  if (percentage >= 85) rating = 'Excellent';
  else if (percentage >= 70) rating = 'Good';
  else if (percentage >= 45) rating = 'Fair';
  else rating = 'Poor';

  const pros = matched.map(m => `Meets requirement: "${m}"`);
  if (titleMatch) {
    pros.unshift(`Title alignment with headline "${profile.headline}"`);
  } else {
    pros.push("Possesses foundational tech background relevant to the industry");
  }

  const cons = unmatched.map(u => `Potential gap in: "${u}"`);
  if (cons.length === 0) {
    cons.push("No obvious gaps found based on skills listed");
  }

  const tailoringAdvice = `Emphasize project experience that directly utilizes standard stack requirements like "${jobReqs[0] || 'React'}" and explain how you apply them in teams.`;

  return {
    rating,
    percentage,
    pros: pros.slice(0, 3),
    cons: cons.slice(0, 3),
    tailoringAdvice
  };
}

module.exports = { matchJob };
