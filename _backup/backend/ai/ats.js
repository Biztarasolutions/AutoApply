const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Calculates ATS matching score, matching keywords, missing keywords, and profile suggestions.
 * Falls back to local calculations if GEMINI_API_KEY is not set or fails.
 */
async function calculateAtsScore(resumeText, jobDescription) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key') {
    console.log('⚠️ GEMINI_API_KEY not set. Using local mock ATS scoring engine...');
    return getMockAtsScore(resumeText, jobDescription);
  }

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      You are an advanced Applicant Tracking System (ATS) parsing bot. Your task is to evaluate the candidate's resume text against a target job description.
      Provide the evaluation strictly in JSON format matching the following schema:
      
      Schema:
      {
        "score": number (0 to 100),
        "matchedKeywords": ["string (keyword found in both)", ...],
        "missingKeywords": ["string (important skill/keyword present in job description but missing or weak in resume)", ...],
        "suggestions": ["string (concrete recommendation on how to edit the resume to improve match)", ...]
      }

      Candidate Resume:
      ---
      ${resumeText}
      ---

      Job Description:
      ---
      ${jobDescription}
      ---
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error('❌ Error calling Gemini API for ATS scoring:', error.message);
    console.log('🔄 Falling back to mock ATS scorer...');
    return getMockAtsScore(resumeText, jobDescription);
  }
}

function getMockAtsScore(resumeText = '', jobDescription = '') {
  // Common tech keywords to search for
  const techKeywords = [
    'react', 'next.js', 'typescript', 'javascript', 'node.js', 'express', 
    'postgresql', 'database', 'supabase', 'css', 'html', 'git', 'docker', 
    'aws', 'rest api', 'graphql', 'python', 'scrum', 'agile', 'testing'
  ];

  const resumeLower = resumeText.toLowerCase();
  const jdLower = jobDescription.toLowerCase();

  const matchedKeywords = [];
  const missingKeywords = [];

  techKeywords.forEach(kw => {
    const inJd = jdLower.includes(kw);
    const inResume = resumeLower.includes(kw);

    if (inJd) {
      if (inResume) {
        matchedKeywords.push(kw.toUpperCase());
      } else {
        missingKeywords.push(kw.toUpperCase());
      }
    }
  });

  // Calculate score based on matches
  let score = 50; // base score
  if (matchedKeywords.length + missingKeywords.length > 0) {
    score = Math.round((matchedKeywords.length / (matchedKeywords.length + missingKeywords.length)) * 100);
  }

  // Ensure score is within reasonable bounds
  if (score < 30) score = 35;
  if (score > 95) score = 93;

  const suggestions = [];
  if (missingKeywords.length > 0) {
    suggestions.push(`Integrate missing technical skills: ${missingKeywords.slice(0, 3).join(', ')} directly into your experience bullet points.`);
  }
  suggestions.push("Quantify your professional achievements by adding metrics, e.g., 'improved app load speed by 30%'.");
  suggestions.push("Match your job role headlines more closely with the targeted job title to capture automated ATS indexing.");

  return {
    score,
    matchedKeywords: matchedKeywords.length > 0 ? matchedKeywords : ['JAVASCRIPT', 'REACT', 'GIT'],
    missingKeywords: missingKeywords.length > 0 ? missingKeywords : ['TYPESCRIPT', 'DOCKER', 'POSTGRESQL'],
    suggestions
  };
}

module.exports = { calculateAtsScore };
