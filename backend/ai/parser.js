const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Extracts structured data from raw resume text or a base64-encoded file.
 * Falls back to mock parsing if GEMINI_API_KEY is not configured or fails.
 */
async function parseResume(content, mimeType = 'text/plain') {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key') {
    console.log('⚠️ GEMINI_API_KEY not set. Using local mock resume parser...');
    return getMockParsedResume(content);
  }

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: "application/json" }
    });

    const schemaPrompt = `
      You are an expert ATS (Applicant Tracking System) parser. Analyze the resume content and extract the information in JSON format matching the schema below:
      
      Schema:
      {
        "full_name": "string (candidate's name)",
        "email": "string (candidate's email)",
        "headline": "string (professional summary headline)",
        "bio": "string (1-2 sentences of personal summary/bio)",
        "skills": ["string (skill 1)", "string (skill 2)", ...],
        "experience": [
          {
            "company": "string",
            "role": "string",
            "dates": "string",
            "description": "string"
          }
        ],
        "education": [
          {
            "school": "string",
            "degree": "string",
            "field": "string",
            "dates": "string"
          }
        ]
      }
    `;

    let promptParts = [];

    if (mimeType === 'text/plain') {
      promptParts.push(`${schemaPrompt}\n\nResume Text:\n---\n${content}\n---`);
    } else {
      // For binary files like PDF, pass as inlineData
      promptParts.push({
        inlineData: {
          data: content, // base64 representation of the file
          mimeType: mimeType
        }
      });
      promptParts.push(`${schemaPrompt}\n\nPlease parse the attached document and return the structured JSON data.`);
    }

    const result = await model.generateContent(promptParts);
    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error('❌ Error calling Gemini API for resume parsing:', error.message);
    console.log('🔄 Falling back to mock parser...');
    return getMockParsedResume(content);
  }
}

function getMockParsedResume(text = '') {
  let email = 'jane.doe@example.com';
  let full_name = 'Jane Doe';

  if (typeof text === 'string') {
    const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    if (emailMatch) email = emailMatch[0];
    
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) full_name = lines[0].replace(/[^a-zA-Z\s]/g, '');
  }

  return {
    full_name,
    email,
    headline: 'Senior Full Stack Engineer',
    bio: 'Dynamic software developer with over 5 years of experience building scalable web applications and optimizing system performance.',
    skills: ['JavaScript', 'React', 'Node.js', 'Next.js', 'PostgreSQL', 'TypeScript', 'Tailwind CSS', 'Git', 'REST APIs', 'Supabase'],
    experience: [
      {
        company: 'DevSolutions Tech',
        role: 'Lead Frontend Developer',
        dates: '2023 - Present',
        description: 'Led the development of a Next.js client portal, improving page load speed by 30% and user engagement by 15%. Coordinated with backend designers to implement custom REST endpoints.'
      },
      {
        company: 'WebFlow Systems',
        role: 'Full Stack Software Engineer',
        dates: '2021 - 2023',
        description: 'Developed and maintained responsive dashboards using React and Express. Integrated PostgreSQL database schemas and optimized slow queries by adding compound indexes.'
      }
    ],
    education: [
      {
        school: 'State Tech University',
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        dates: '2017 - 2021'
      }
    ]
  };
}

module.exports = { parseResume };
