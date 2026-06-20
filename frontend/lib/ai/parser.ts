import { GoogleGenerativeAI } from '@google/generative-ai';

export async function parseResume(resumeText: string) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key' || apiKey.startsWith('AQ.')) {
    return extractResumeFromText(resumeText);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `You are an expert ATS resume parser. Extract ALL information from the resume text below into this exact JSON structure:
{
  "full_name": "string",
  "email": "string",
  "phone": "string",
  "linkedin": "string",
  "github": "string",
  "website": "string",
  "location": "string",
  "headline": "string",
  "bio": "string",
  "skills": ["string"],
  "experience": [{ "company": "string", "role": "string", "dates": "string", "location": "string", "description": "string", "achievements": ["string"] }],
  "education": [{ "school": "string", "degree": "string", "field": "string", "dates": "string", "gpa": "string" }],
  "projects": [{ "name": "string", "description": "string", "technologies": ["string"], "dates": "string" }],
  "certifications": [{ "name": "string", "issuer": "string", "date": "string", "url": "string" }],
  "achievements": ["string"]
}
Return only valid JSON. Empty string or empty array for missing fields.

Resume:
---
${resumeText.slice(0, 8000)}
---`;

    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());
    const heuristic = extractResumeFromText(resumeText);
    return mergeStructures(parsed, heuristic);
  } catch (error: any) {
    console.error('Gemini parse error:', error.message);
    return extractResumeFromText(resumeText);
  }
}

function mergeStructures(ai: any, fallback: any) {
  return {
    full_name:      ai.full_name      || fallback.full_name,
    email:          ai.email          || fallback.email,
    phone:          ai.phone          || fallback.phone,
    linkedin:       ai.linkedin       || fallback.linkedin,
    github:         ai.github         || fallback.github,
    website:        ai.website        || fallback.website,
    location:       ai.location       || fallback.location,
    headline:       ai.headline       || fallback.headline,
    bio:            ai.bio            || fallback.bio,
    skills:         ai.skills?.length         ? ai.skills         : fallback.skills,
    experience:     ai.experience?.length     ? ai.experience     : fallback.experience,
    education:      ai.education?.length      ? ai.education      : fallback.education,
    projects:       ai.projects?.length       ? ai.projects       : fallback.projects,
    certifications: ai.certifications?.length ? ai.certifications : fallback.certifications,
    achievements:   ai.achievements?.length   ? ai.achievements   : fallback.achievements,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Section detection — handles both line-structured and single-paragraph PDFs
// ─────────────────────────────────────────────────────────────────────────────

interface TextSection { name: string; content: string }

/**
 * Section keywords, ordered longest-first so "Work Experience" wins over
 * "Experience" when both appear in the text.
 */
const SECTION_DEFS: Array<{ name: string; keywords: string[] }> = [
  { name: 'summary',        keywords: ['Professional Summary', 'Career Summary', 'Executive Summary', 'Summary', 'Profile', 'Objective', 'About Me', 'Overview', 'Career Objective'] },
  { name: 'skills',         keywords: ['Technical Skills', 'Core Competencies', 'Key Skills', 'Skills', 'Expertise', 'Technologies', 'Tools & Technologies'] },
  { name: 'experience',     keywords: ['Work Experience', 'Professional Experience', 'Employment History', 'Work History', 'Career History', 'Experience', 'Employment'] },
  { name: 'education',      keywords: ['Academic Background', 'Educational Background', 'Education', 'Academic Qualifications', 'Qualifications', 'Schooling'] },
  { name: 'projects',       keywords: ['Notable Projects', 'Key Projects', 'Personal Projects', 'Academic Projects', 'Projects'] },
  { name: 'certifications', keywords: ['Professional Certifications', 'Certifications', 'Certificates', 'Certification', 'Credentials', 'Licenses'] },
  { name: 'achievements',   keywords: ['Key Achievements', 'Notable Achievements', 'Accomplishments', 'Honors & Awards', 'Honors', 'Awards', 'Recognition'] },
];

function splitIntoSections(text: string): TextSection[] {
  const hits: Array<{ name: string; headerStart: number; headerEnd: number }> = [];

  for (const { name, keywords } of SECTION_DEFS) {
    // Try longer keywords first so "Work Experience" beats "Experience"
    for (const kw of [...keywords].sort((a, b) => b.length - a.length)) {
      // Case-SENSITIVE match so "skills" mid-sentence doesn't match the "Skills" header.
      // Keywords in SECTION_DEFS are already Title-Cased.
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      const re = new RegExp(`(?:^|(?<![a-zA-Z]))${escaped}(?![a-zA-Z])`); // no 'i' flag
      const m = re.exec(text);
      if (m) {
        hits.push({ name, headerStart: m.index, headerEnd: m.index + m[0].length });
        break;
      }
    }
  }

  if (hits.length === 0) return [{ name: 'raw', content: text }];

  hits.sort((a, b) => a.headerStart - b.headerStart);

  return hits.map((h, i) => ({
    name: h.name,
    content: text
      .slice(h.headerEnd, hits[i + 1]?.headerStart ?? text.length)
      .replace(/^[\s:–\-]+/, '')
      .trim(),
  }));
}

function getSec(sections: TextSection[], name: string): string {
  return sections.find(s => s.name === name)?.content ?? '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main heuristic extractor
// ─────────────────────────────────────────────────────────────────────────────

export function extractResumeFromText(rawText: string) {
  const text = rawText.trim();

  const email    = extractEmail(text);
  const phone    = extractPhone(text);
  const linkedin = extractLinkedIn(text);
  const github   = extractGitHub(text);
  const website  = extractWebsite(text);
  const sections = splitIntoSections(text);

  const { full_name, headline, location } = extractContactBlock(text, email);

  const bio            = getSec(sections, 'summary').trim();
  const skills         = extractSkills(getSec(sections, 'skills'), text);
  const experience     = extractExperience(getSec(sections, 'experience'));
  const education      = extractEducation(getSec(sections, 'education'));
  const projects       = extractProjects(getSec(sections, 'projects'));
  const certifications = extractCertifications(getSec(sections, 'certifications'));
  const achievements   = extractAchievements(text, experience);

  return { full_name, email, phone, linkedin, github, website, location, headline, bio, skills, experience, education, projects, certifications, achievements };
}

// ─────────────────────────────────────────────────────────────────────────────
// Contact field extractors
// ─────────────────────────────────────────────────────────────────────────────

function extractEmail(text: string): string {
  return (text.match(/([a-zA-Z0-9._+%-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/)?.[0] ?? '').toLowerCase();
}

function extractPhone(text: string): string {
  // Try specific patterns first (Indian, then US, then generic)
  const patterns = [
    /\+91[\s\-]?[6-9]\d{9}/,
    /\b91\s?[6-9]\d{9}\b/,
    /\b[6-9]\d{9}\b/,
    /\+?1?\s?\(?\d{3}\)?[\s\-]\d{3}[\s\-]\d{4}/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0].trim();
  }
  return '';
}

function extractLinkedIn(text: string): string {
  const m = text.match(/linkedin\.com\/in\/([a-zA-Z0-9_\-]+)/i);
  return m ? `https://www.linkedin.com/in/${m[1]}` : '';
}

function extractGitHub(text: string): string {
  const m = text.match(/github\.com\/([a-zA-Z0-9_\-]+)/i);
  return m ? `https://github.com/${m[1]}` : '';
}

function extractWebsite(text: string): string {
  const m = text.match(/https?:\/\/(?!(?:www\.)?(?:linkedin|github)\.com)[a-zA-Z0-9\-.]+\.[a-zA-Z]{2,}(?:\/[^\s,|)]*)?/i);
  return m?.[0] ?? '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Name, headline, and location
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Words that should NEVER appear as a person's first or last name.
 * Used to filter false-positive 2-word name candidates.
 */
const NON_NAME_WORDS = new Set([
  // Title / seniority words
  'Senior', 'Junior', 'Lead', 'Principal', 'Staff', 'Chief', 'Head', 'Associate',
  // Domain words
  'Analytics', 'Analyst', 'Data', 'Business', 'Software', 'Product', 'Solutions',
  'Application', 'Development', 'Professional', 'Independent', 'Consulting',
  'Freelance', 'Technical', 'Corporate', 'Executive', 'Research', 'Platform',
  // Job titles
  'Manager', 'Director', 'Engineer', 'Specialist', 'Scientist', 'Architect',
  'Consultant', 'Developer', 'Designer', 'Officer', 'Intern',
  // Resume section words
  'Summary', 'Skills', 'Education', 'Experience', 'Certification', 'Projects',
  'Objective', 'Profile', 'Overview', 'Resume', 'Curriculum',
  // Month names — bleed in from job dates extracted before the contact block
  'January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December',
  'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sep', 'Sept', 'Oct', 'Nov', 'Dec',
]);

function extractContactBlock(text: string, email: string): { full_name: string; headline: string; location: string } {
  const full_name = findName(text, email);
  const headline  = findHeadline(text, full_name);
  const location  = findLocation(text, email);
  return { full_name, headline, location };
}

function findName(text: string, email: string): string {
  if (!email) return '';
  const emailIdx = text.indexOf(email);
  if (emailIdx < 0) return '';

  // In sidebar-layout PDFs the name appears in the contact block just before email.
  // Look back up to 400 chars.
  const lookback = text.slice(Math.max(0, emailIdx - 400), emailIdx);

  // Strip noise: URLs, domain names, month names, bare numbers
  const cleaned = lookback
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\S+\.(com|io|net|org|in|co)\S*/gi, ' ')
    .replace(/\bProjects?\b/gi, ' ')
    .replace(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/gi, ' ')
    .replace(/\b\d[\d\s./\-]+/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Find all 2-word Title-Cased pairs where neither word is a known non-name
  const PAIR_RE = /\b([A-Z][a-z]{1,19})\s+([A-Z][a-z]{1,19})\b/g;
  const candidates: Array<{ name: string; idx: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = PAIR_RE.exec(cleaned)) !== null) {
    if (!NON_NAME_WORDS.has(m[1]) && !NON_NAME_WORDS.has(m[2])) {
      candidates.push({ name: `${m[1]} ${m[2]}`, idx: m.index });
    }
  }

  if (candidates.length > 0) {
    // Pick rightmost candidate (closest to email)
    candidates.sort((a, b) => b.idx - a.idx);
    return candidates[0].name;
  }

  // Fallback: derive from email local part (john.doe@... → John Doe)
  const local = email.split('@')[0].replace(/[._\-+\d]/g, ' ').trim();
  const words = local.split(/\s+/).filter(w => w.length > 1);
  if (words.length >= 2) {
    return words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  return '';
}

function findHeadline(text: string, name: string): string {
  if (!name) return '';
  const nameIdx = text.indexOf(name);
  if (nameIdx < 0) return '';

  // The professional title usually appears immediately after the name
  const after = text.slice(nameIdx + name.length, nameIdx + name.length + 120).replace(/^\s+/, '');

  // Match a short title-case phrase; reject anything that looks like a phone/email/date
  const m = after.match(/^([A-Z][^\n@\d]{5,70}?)(?=\s+\d|\s+\S+@|\s*$)/);
  if (m) {
    const c = m[1].trim();
    if (c.length < 80 && !/@/.test(c) && !/^\d/.test(c)) return c;
  }
  return '';
}

function findLocation(text: string, email: string): string {
  const ei = email ? text.indexOf(email) : -1;
  const win = ei >= 0 ? text.slice(ei, Math.min(text.length, ei + 200)) : text.slice(0, 500);

  // "City, Country" or "City, ST" patterns
  const m = win.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,\s*(?:[A-Z][a-z]+|[A-Z]{2,3}))\b/);
  if (m) return m[1];

  // Common Indian cities
  for (const city of ['Bangalore', 'Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Noida', 'Gurgaon', 'Gurugram']) {
    if (new RegExp(`\\b${city}\\b`, 'i').test(win)) return `${city}, India`;
  }
  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Skills
// ─────────────────────────────────────────────────────────────────────────────

const KNOWN_SKILLS = [
  'Python', 'Java', 'JavaScript', 'TypeScript', 'C++', 'C#', 'Go', 'R', 'MATLAB', 'Scala', 'Rust', 'Swift', 'Kotlin', 'PHP', 'Ruby', 'Bash', 'Shell',
  'React', 'Next.js', 'Vue', 'Angular', 'HTML', 'CSS', 'Tailwind', 'Node.js', 'Express', 'Django', 'Flask', 'FastAPI', 'REST API', 'GraphQL',
  'SQL', 'Excel', 'Power BI', 'Tableau', 'Looker', 'Qlik', 'Pandas', 'NumPy', 'PySpark', 'Spark', 'Hadoop', 'Hive', 'Kafka', 'Airflow', 'dbt', 'Alteryx',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Snowflake', 'BigQuery', 'Redshift', 'Databricks', 'Oracle', 'DynamoDB', 'Elasticsearch',
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Git', 'GitHub', 'GitLab', 'CI/CD', 'Jenkins', 'Linux',
  'Machine Learning', 'Deep Learning', 'NLP', 'TensorFlow', 'PyTorch', 'Keras', 'Scikit-learn', 'XGBoost', 'LightGBM', 'OpenAI', 'LangChain',
  'Statistics', 'A/B Testing', 'Regression', 'Classification', 'Clustering', 'Time Series', 'Demand Forecasting', 'Predictive Modeling', 'Feature Engineering',
  'CLTV', 'Churn Prediction', 'Cohort Analysis', 'Customer Analytics', 'Retail Analytics', 'Space Planning', 'Assortment Analytics', 'Revenue Optimization',
  'Agile', 'Scrum', 'JIRA', 'Confluence', 'Stakeholder Management', 'KPI', 'OKR', 'Product Management', 'Project Management',
  'Business Intelligence', 'Data Visualization', 'Reporting', 'Dashboarding',
  'Claude', 'Copilot', 'Cursor',
];

function extractSkills(skillsSection: string, fullText: string): string[] {
  const fromSection: string[] = [];
  if (skillsSection) {
    // Strip category labels like "Programming & Data:" before parsing items
    const stripped = skillsSection
      .replace(/[A-Z][a-zA-Z\s&]+:/g, '|')
      .replace(/[()]/g, ' ');
    stripped
      .split(/[|,•·\t\n]/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length >= 2 && s.length <= 40 && !/^\d+$/.test(s))
      .filter((s: string) => !/^(and|the|or|in|of|with|for|&)$/i.test(s))
      .forEach((s: string) => fromSection.push(s));
  }

  const fromKeywords = KNOWN_SKILLS.filter(sk =>
    new RegExp('\\b' + sk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(fullText)
  );

  const merged = [...fromSection];
  for (const kw of fromKeywords) {
    if (!merged.some(s => s.toLowerCase() === kw.toLowerCase())) merged.push(kw);
  }

  return [...new Set(merged)].filter((s: string) => s.length >= 2 && s.length <= 40);
}

// ─────────────────────────────────────────────────────────────────────────────
// Experience
// ─────────────────────────────────────────────────────────────────────────────

// Month name pattern (handles "Sept" as well as "Sep" / "September")
const MON = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';

// Full date range — covers the common formats seen in this PDF:
//   "Dec 2024  Present"    →  Month Year <spaces> Present
//   "Sept 2021  Dec 2024"  →  Month Year <spaces> Month Year
//   "2020 - 2022"          →  Year - Year
const DATE_RANGE = `(?:${MON}\\s+\\d{4}[\\s\\-–]+(?:${MON}\\s+)?(?:\\d{4}|Present|Current|Till\\s+Date|Now)|\\d{4}\\s*[\\-–]\\s*(?:\\d{4}|Present|Current|Now))`;

/**
 * Job-header pattern for PDF format: "Role Company | City | DateRange"
 * Group 1: everything before the first " | " (role + company concatenated)
 * Group 2: city / location
 * Group 3: date range
 */
const JOB_HEADER_SOURCE = `([A-Z][^|\\n]{5,80}?)\\s+\\|\\s+([^|\\n]{2,40}?)\\s+\\|\\s+(${DATE_RANGE})`;

// Title words used to split "RoleCompany" string at the role terminus
const TITLE_TERMS = /\b(Analyst|Engineer|Developer|Manager|Architect|Director|Consultant|Associate|Specialist|Scientist|Designer|Advisor|Professional|Executive|Officer|Intern|Lead|VP|Head)\b/i;

function splitRoleCompany(combined: string): { role: string; company: string } {
  const m = TITLE_TERMS.exec(combined);
  if (!m) {
    const words = combined.trim().split(/\s+/);
    return { role: words.slice(0, 3).join(' '), company: words.slice(3).join(' ') };
  }
  const titleEnd = m.index + m[0].length;
  const role    = combined.slice(0, titleEnd).trim();
  const company = combined.slice(titleEnd).trim().replace(/^[–\-\s]+/, '');
  return { role, company };
}

function extractBullets(text: string): string[] {
  return text
    .split(/[•·▪▸→]/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 400)
    .filter(s => !/^\d{1,2}\/\d{4}/.test(s));
}

function stripContactNoise(text: string): string {
  return text
    .replace(/\b(?:linkedin|github)\.\S+/gi, '')
    .replace(/\S+@\S+\.\S+/g, '')
    .replace(/\b9[1]?\s?\d{9,10}\b/g, '')
    .replace(/\b\d{10}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractExperience(expSection: string): any[] {
  if (!expSection) return [];

  const re = new RegExp(JOB_HEADER_SOURCE, 'gi');
  const headerMatches: Array<{ roleCompany: string; location: string; dates: string; idx: number; len: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(expSection)) !== null) {
    headerMatches.push({
      roleCompany: m[1].trim(),
      location:    m[2].trim(),
      dates:       m[3].trim(),
      idx:         m.index,
      len:         m[0].length,
    });
  }

  if (headerMatches.length === 0) {
    return [{
      role: '', company: '', dates: '', location: '',
      description: expSection.slice(0, 600).trim(),
      achievements: extractBullets(expSection).slice(0, 6),
    }];
  }

  // Filter invalid headers FIRST so indices (i) are correct during map.
  const validMatches = headerMatches.filter(hdr => /^[A-Z]/.test(hdr.roleCompany));
  if (validMatches.length === 0) return [];

  // Split preamble (text before first valid header) into segments, one per job.
  // In single-paragraph PDF layouts the job descriptions appear BEFORE the job
  // header lines that they describe.
  const preambleRaw = stripContactNoise(expSection.slice(0, validMatches[0].idx));
  const sentences   = preambleRaw.match(/[^.!?]+[.!?]+\s*/g) ?? (preambleRaw.length > 0 ? [preambleRaw] : []);
  const n           = validMatches.length;
  const perJob      = Math.max(1, Math.ceil(sentences.length / n));

  return validMatches.map((hdr, i) => {
    const { role, company } = splitRoleCompany(hdr.roleCompany);

    const contentStart = hdr.idx + hdr.len;
    const contentEnd   = validMatches[i + 1]?.idx ?? expSection.length;
    const rawContent   = stripContactNoise(expSection.slice(contentStart, contentEnd));

    // Assign preamble sentences in forward order (job 0 = first sentences).
    const preambleForJob = sentences
      .slice(i * perJob, Math.min(sentences.length, (i + 1) * perJob))
      .join('')
      .trim();

    const allContent = [preambleForJob, rawContent].filter(Boolean).join(' ').trim();

    const bullets = extractBullets(allContent);
    const prose   = allContent.replace(/[•·▪▸→][^•·▪▸→]*/g, '').replace(/\s+/g, ' ').trim();

    return {
      role,
      company,
      dates:    hdr.dates,
      location: hdr.location,
      description: prose.slice(0, 1500),
      achievements: bullets.slice(0, 8),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Education — degree-keyword splitting
// (degree, date, and school are all on the same inline text run)
// ─────────────────────────────────────────────────────────────────────────────

// Splits the education text into one chunk per degree entry.
// Lookahead so the degree keyword itself is included in the chunk.
const DEGREE_SPLIT_RE = /(?=\b(?:B\.?Tech|B\.?E\.?|B\.?Sc?\.?|M\.?Tech|M\.?E\.?|M\.?Sc?\.?|MBA|MCA|Ph\.?D\.?|Bachelor|Master|Diploma|12th\s+Standard|10th\s+Standard|12th|10th|HSC|SSC)\b)/gi;

// Date range inside an education chunk: "MM/YYYY- MM/YYYY"
const EDU_DATE_RE = /\d{1,2}\/\d{4}[\s\-–]+\d{1,2}\/\d{4}/g;

// GPA / percentage score: "75/10", "82/100", "9/10"
const SCORE_RE = /\b\d{1,3}(?:\.\d{1,2})?\s*\/\s*\d{1,3}\b/g;

export function extractEducation(eduSection: string): any[] {
  if (!eduSection) return [];

  const chunks = eduSection.split(DEGREE_SPLIT_RE).filter(s => s.trim().length > 5);

  return chunks.map(chunk => {
    // Degree: from the start of the chunk
    const degreeMatch = chunk.match(
      /^(B\.?Tech(?:\s+in\s+[\w\s]+)?|B\.?E\.?|B\.?Sc?\.?|M\.?Tech(?:\s+in\s+[\w\s]+)?|M\.?E\.?|M\.?Sc?\.?|MBA|MCA|Ph\.?D\.?|Bachelor(?:\s+of\s+[\w\s]+)?|Master(?:\s+of\s+[\w\s]+)?|Diploma(?:\s+in\s+[\w\s]+)?|12th\s+Standard(?:\s*\([A-Z]+\))?|10th\s+Standard(?:\s*\([A-Z]+\))?|12th|10th|HSC|SSC)/i
    );
    const degree = degreeMatch?.[0]?.trim() ?? '';
    if (!degree) return null;

    // Date range
    EDU_DATE_RE.lastIndex = 0;
    const dateMatch = EDU_DATE_RE.exec(chunk);
    const dates = dateMatch?.[0]?.trim() ?? '';

    // School: text after the date range, with score tokens removed
    let school = '';
    if (dates && dateMatch) {
      const afterDate = chunk.slice(dateMatch.index + dateMatch[0].length).trim();
      school = afterDate
        .replace(new RegExp(SCORE_RE.source, 'g'), '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);
    }

    // GPA/score
    SCORE_RE.lastIndex = 0;
    const scoreMatch = SCORE_RE.exec(chunk);
    const gpa = scoreMatch?.[0]?.trim() ?? '';

    return { degree, school, field: '', dates, gpa };
  }).filter(Boolean) as any[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Projects
// ─────────────────────────────────────────────────────────────────────────────

function extractProjects(projSection: string): any[] {
  if (!projSection) return [];

  const lines = projSection.split(/[•·\n]/).map(s => s.trim()).filter(Boolean);
  const entries: any[] = [];
  let current: any = null;

  for (const l of lines) {
    const isBullet = /^(led|built|developed|created|provided|automated|collaborated|designed|implemented)/i.test(l);
    if (!isBullet && l.length < 80 && l.length > 3) {
      if (current) entries.push(current);
      current = { name: l, description: '', technologies: [], dates: '' };
    } else if (current) {
      current.description += (current.description ? ' ' : '') + l.replace(/^•\s*/, '');
      const tech = l.match(/(?:using|built\s+with|tech(?:nologies)?:|stack:)\s*([^.]{3,60})/i)?.[1];
      if (tech) current.technologies.push(...tech.split(/[,|]/).map((t: string) => t.trim()).filter(Boolean));
    }
  }
  if (current) entries.push(current);

  return entries.slice(0, 6).map(e => ({ ...e, description: e.description.slice(0, 300) }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Certifications
// ─────────────────────────────────────────────────────────────────────────────

function extractCertifications(certSection: string): any[] {
  if (!certSection) return [];

  const dateMatch = certSection.match(/\d{1,2}\/\d{4}[\s\-–]+\d{1,2}\/\d{4}/);
  const urlMatch  = certSection.match(/https?:\/\/[^\s]+/);

  // Strip "Credential Link" label and extract the cert name
  const cleaned = certSection.replace(/\bCredential\s+Link\s*/gi, '').trim();
  const nameMatch = cleaned.match(/^([A-Z][^\d.!?\n]{10,100}?)(?=\s+(?:\d|Credential|\d{2}\/\d{4}))/i)
    ?? cleaned.match(/^(.{10,80})/);
  const name = nameMatch?.[1]?.trim() ?? cleaned.slice(0, 80).trim();

  if (!name || name.length < 5) return [];

  return [{ name, issuer: '', date: dateMatch?.[0]?.trim() ?? '', url: urlMatch?.[0] ?? '' }];
}

// ─────────────────────────────────────────────────────────────────────────────
// Achievements
// ─────────────────────────────────────────────────────────────────────────────

function extractAchievements(text: string, experience: any[]): string[] {
  // Collect quantified bullets from experience entries
  const fromExp: string[] = [];
  for (const exp of experience) {
    for (const a of (exp.achievements || [])) {
      if (a.length > 30) fromExp.push(a.slice(0, 200));
    }
  }

  // Scan full text for strongly quantified sentences
  const QUANT_RE = /([A-Z][^.!?]{15,150}(?:\d+%|\d+x|\$[\d,]+|\d+\s*(?:million|k\b|\+))[^.!?]{0,80}[.!?])/g;
  const fromText: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = QUANT_RE.exec(text)) !== null) {
    const s = m[1].trim();
    if (!fromExp.includes(s)) fromText.push(s);
  }

  return [...new Set([...fromExp, ...fromText])].slice(0, 8);
}

// ─────────────────────────────────────────────────────────────────────────────
// ATS scoring — 5 dimensions
// ─────────────────────────────────────────────────────────────────────────────

export interface AtsResult {
  score: number;
  completeness: number;
  keywordScore: number;
  skillsScore: number;
  experienceScore: number;
  structureScore: number;
  missingKeywords: string[];
  recommendations: string[];
}

export function calculateResumeStrength(parsedText: string, structure: any): number {
  return calculateAts(parsedText, structure).score;
}

export function calculateAts(parsedText: string, structure: any): AtsResult {
  const s    = structure || {};
  const text = parsedText || '';
  const recommendations: string[] = [];
  const missingKeywords: string[] = [];

  // ── 1. Completeness (25 pts) ──────────────────────────────────────────────
  let completeness = 0;
  const compFields: Array<[boolean, number, string]> = [
    [!!s.full_name?.trim(),           4, 'Add your full name'],
    [!!s.email?.trim(),               4, 'Add your email address'],
    [!!s.phone?.trim(),               3, 'Add your phone number'],
    [!!s.linkedin?.trim(),            2, 'Add your LinkedIn profile URL'],
    [!!s.headline?.trim(),            4, 'Add a professional headline/title'],
    [!!(s.bio?.trim()?.length > 80),  5, 'Add a professional summary (80+ words)'],
    [!!(s.skills?.length >= 5),       2, 'List at least 5 skills'],
    [!!s.location?.trim(),            1, 'Add your city/location'],
  ];
  for (const [ok, pts, msg] of compFields) {
    if (ok) completeness += pts;
    else recommendations.push(msg);
  }

  // ── 2. Keywords & content (25 pts) ───────────────────────────────────────
  const ACTION_VERBS = ['led', 'built', 'developed', 'designed', 'implemented', 'managed', 'created', 'delivered', 'improved', 'optimized', 'reduced', 'increased', 'drove', 'launched', 'spearheaded', 'collaborated', 'mentored', 'automated', 'analyzed', 'forecasted', 'deployed', 'scaled', 'streamlined', 'enabled'];
  const foundVerbs  = ACTION_VERBS.filter(v => new RegExp(`\\b${v}\\b`, 'i').test(text));
  const verbScore   = Math.min(10, Math.floor(foundVerbs.length * 1.5));

  const quantCount  = [/\d+%/, /\d+x\b/, /\$[\d,]+/, /\d+\s*(?:million|thousand|k\b)/i].filter(p => p.test(text)).length;
  const quantScore  = Math.min(10, quantCount * 3);
  if (quantCount === 0) recommendations.push('Add quantified achievements (%, $, numbers)');

  const words       = text.trim().split(/\s+/).length;
  const lengthScore = words >= 600 ? 5 : words >= 400 ? 3 : words >= 200 ? 1 : 0;
  if (words < 400)  recommendations.push('Expand resume content — aim for 400-700 words');

  const keywordScore = Math.min(25, verbScore + quantScore + lengthScore);

  // ── 3. Skills (20 pts) ───────────────────────────────────────────────────
  const skillCount  = s.skills?.length || 0;
  const skillsScore =
    skillCount >= 20 ? 20 :
    skillCount >= 15 ? 17 :
    skillCount >= 10 ? 14 :
    skillCount >= 6  ? 10 :
    skillCount >= 3  ? 6  :
    skillCount > 0   ? 3  : 0;
  if (skillCount < 10) {
    recommendations.push(`Add more skills — you have ${skillCount}, aim for 10+`);
    const current = (s.skills || []).map((sk: string) => sk.toLowerCase());
    KNOWN_SKILLS.filter(sk => !current.includes(sk.toLowerCase())).slice(0, 5).forEach(kw => missingKeywords.push(kw));
  }

  // ── 4. Experience (20 pts) ───────────────────────────────────────────────
  const expCount    = s.experience?.length || 0;
  const expBase     = expCount >= 4 ? 12 : expCount === 3 ? 10 : expCount === 2 ? 7 : expCount === 1 ? 4 : 0;
  const hasContent  = s.experience?.some((e: any) => (e.achievements?.length > 0) || (e.description?.trim()?.length > 40)) ?? false;
  const expBonus    = hasContent ? 8 : 0;
  const experienceScore = Math.min(20, expBase + expBonus);
  if (expCount === 0)    recommendations.push('Add work experience with role, company, and dates');
  else if (!hasContent)  recommendations.push('Add achievement bullets to each experience entry');

  // ── 5. Structure (10 pts) ────────────────────────────────────────────────
  let structureScore = 0;
  if ((s.education?.length    || 0) > 0) structureScore += 3; else recommendations.push('Add your education section');
  if (expCount                    > 0) structureScore += 3;
  if (skillCount                  > 0) structureScore += 2;
  if ((s.certifications?.length || 0) > 0 || (s.projects?.length || 0) > 0) structureScore += 2;
  else if (expCount > 0) recommendations.push('Add certifications or projects to strengthen your profile');

  const score = Math.min(100, completeness + keywordScore + skillsScore + experienceScore + structureScore);

  return {
    score: Math.round(score),
    completeness,
    keywordScore,
    skillsScore,
    experienceScore,
    structureScore,
    missingKeywords: missingKeywords.slice(0, 8),
    recommendations: recommendations.slice(0, 6),
  };
}
