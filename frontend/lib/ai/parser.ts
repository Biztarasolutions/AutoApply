import { GoogleGenerativeAI } from '@google/generative-ai';

export async function parseResume(resumeText: string) {
  const apiKey = process.env.GEMINI_API_KEY;

  // AQ. prefix = OAuth token, not a valid Gemini API key
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

Return only valid JSON. Use empty string or empty array for missing fields. Extract every skill mentioned.

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
    full_name: ai.full_name || fallback.full_name,
    email: ai.email || fallback.email,
    phone: ai.phone || fallback.phone,
    linkedin: ai.linkedin || fallback.linkedin,
    github: ai.github || fallback.github,
    website: ai.website || fallback.website,
    location: ai.location || fallback.location,
    headline: ai.headline || fallback.headline,
    bio: ai.bio || fallback.bio,
    skills: ai.skills?.length ? ai.skills : fallback.skills,
    experience: ai.experience?.length ? ai.experience : fallback.experience,
    education: ai.education?.length ? ai.education : fallback.education,
    projects: ai.projects?.length ? ai.projects : fallback.projects,
    certifications: ai.certifications?.length ? ai.certifications : fallback.certifications,
    achievements: ai.achievements?.length ? ai.achievements : fallback.achievements,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Heuristic extractor — no AI needed
// ────────────────────────────────────────────────────────────────────────────

export function extractResumeFromText(rawText: string) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = lines.join('\n');

  // ── Contact fields ──────────────────────────────────────────────────────
  const email = (fullText.match(/([a-zA-Z0-9._+%-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/)?.[0] || '').toLowerCase();
  const phone = extractPhone(fullText);
  const linkedin = fullText.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_]+)/i)?.[0]
    ? 'https://www.' + fullText.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_]+)/i)![0]
    : (fullText.match(/linkedin[^\s,|]{0,30}/i)?.[0]?.replace(/^.*?(linkedin)/i, 'https://www.linkedin') || '');
  const github = fullText.match(/github\.com\/([a-zA-Z0-9\-_]+)/i)?.[0]
    ? 'https://' + fullText.match(/github\.com\/([a-zA-Z0-9\-_]+)/i)![0]
    : '';
  const website = extractWebsite(fullText, email, linkedin, github);
  const location = extractLocation(fullText);

  // ── Name ─────────────────────────────────────────────────────────────────
  const full_name = extractName(lines, email, phone);

  // ── Find section boundaries ───────────────────────────────────────────────
  const sections = detectSections(lines);

  // ── Headline ─────────────────────────────────────────────────────────────
  const headline = extractHeadline(lines, full_name, sections);

  // ── Bio/Summary ───────────────────────────────────────────────────────────
  const bio = extractSection(lines, sections, 'summary');

  // ── Skills ────────────────────────────────────────────────────────────────
  const skills = extractSkills(lines, sections, fullText);

  // ── Experience ────────────────────────────────────────────────────────────
  const experience = extractExperience(lines, sections);

  // ── Education ─────────────────────────────────────────────────────────────
  const education = extractEducation(lines, sections);

  // ── Projects ──────────────────────────────────────────────────────────────
  const projects = extractProjects(lines, sections);

  // ── Certifications ────────────────────────────────────────────────────────
  const certifications = extractCertifications(lines, sections);

  // ── Achievements ──────────────────────────────────────────────────────────
  const achievements = extractAchievements(lines, sections);

  return {
    full_name, email, phone, linkedin, github, website, location,
    headline, bio, skills, experience, education,
    projects, certifications, achievements,
  };
}

// ── Phone ──────────────────────────────────────────────────────────────────
function extractPhone(text: string): string {
  // Match phone numbers: must have 7+ digits, not look like a year range
  const patterns = [
    /\+?[1-9]\d{0,3}[\s\-.]?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/,  // intl format
    /\b(?:\+91[\s\-]?)?[6-9]\d{9}\b/,  // Indian mobile
    /\b\d{3}[\s\-]\d{3}[\s\-]\d{4}\b/,  // US format
    /\b91[\s]?\d{10}\b/,  // Indian with country code
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0].trim();
  }
  return '';
}

// ── Website ────────────────────────────────────────────────────────────────
function extractWebsite(text: string, email: string, linkedin: string, github: string): string {
  const urlMatch = text.match(/https?:\/\/(?!linkedin|github)[a-zA-Z0-9\-.]+\.[a-zA-Z]{2,}(?:\/[^\s,|)]*)?/i);
  return urlMatch?.[0] || '';
}

// ── Location ──────────────────────────────────────────────────────────────
function extractLocation(text: string): string {
  // Common city names or "City, State/Country" pattern
  const m = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,\s*(?:[A-Z]{2}|[A-Z][a-z]+))\b/);
  if (m) return m[0];
  // Indian cities
  const indianCities = ['Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Noida', 'Gurgaon'];
  for (const city of indianCities) {
    if (new RegExp(`\\b${city}\\b`, 'i').test(text)) return city + ', India';
  }
  return '';
}

// ── Name extraction — multi-strategy ───────────────────────────────────────
function extractName(lines: string[], email: string, phone: string): string {
  // Strategy 1: Look for "FirstName LastName" pattern across ALL lines
  // (2-4 words, each Capitalized, alpha only, 4-50 chars total)
  const namePattern = /^([A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20}){1,3})$/;

  // Collect candidates with their line index
  const candidates: Array<{ name: string; score: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Try exact match first
    if (namePattern.test(line) && line.length >= 5 && line.length <= 50) {
      let score = 100 - i; // prefer earlier lines
      // Bonus if email or phone appears nearby
      if (Math.abs(i - lines.findIndex(l => l.includes('@'))) <= 5) score += 30;
      if (Math.abs(i - lines.findIndex(l => phone && l.includes(phone.slice(0, 8)))) <= 5) score += 20;
      candidates.push({ name: line, score });
    }
    // Try line that starts with name and has title/separator after
    const titleSep = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*[|\-–—,]/);
    if (titleSep) {
      candidates.push({ name: titleSep[1].trim(), score: 80 - i });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].name;
  }

  // Strategy 2: Derive from email (john.doe@example.com → John Doe)
  if (email) {
    const localPart = email.split('@')[0].replace(/[._\-+]/g, ' ');
    const words = localPart.split(' ').filter(w => w.length > 1 && /^[a-z]+$/i.test(w));
    if (words.length >= 2) {
      return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }

  // Strategy 3: First line that looks like a name (more permissive)
  for (const line of lines.slice(0, 10)) {
    const cleaned = line.replace(/[^a-zA-Z\s]/g, '').trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 4 && cleaned.length >= 5 && cleaned.length <= 50) {
      if (words.every(w => /^[A-Z]/.test(w) && w.length >= 2)) {
        return cleaned;
      }
    }
  }

  return '';
}

// ── Section detection ─────────────────────────────────────────────────────
type SectionName = 'summary' | 'skills' | 'experience' | 'education' | 'projects' | 'certifications' | 'achievements' | 'awards';

const SECTION_PATTERNS: Record<SectionName, RegExp> = {
  summary: /^(summary|professional\s+summary|profile|objective|about\s+me|career\s+objective|overview)/i,
  skills: /^(skills?|technical\s+skills?|core\s+competencies|key\s+skills?|expertise|technologies)/i,
  experience: /^(work\s+experience|experience|employment|professional\s+experience|work\s+history|career\s+history|positions?)/i,
  education: /^(education|academic|qualification|schooling|degrees?)/i,
  projects: /^(projects?|personal\s+projects?|key\s+projects?|notable\s+projects?|portfolio)/i,
  certifications: /^(certifications?|certificates?|licenses?|credentials?|accreditations?)/i,
  achievements: /^(achievements?|accomplishments?|honors?|awards?|recognition)/i,
  awards: /^(awards?|honors?|recognition|accolades)/i,
};

interface SectionBounds {
  start: number;
  end: number;
  name: SectionName;
}

function detectSections(lines: string[]): SectionBounds[] {
  const found: Array<{ idx: number; name: SectionName }> = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // Section headers are usually short (< 60 chars) and match a known pattern
    if (l.length > 60) continue;
    for (const [name, pattern] of Object.entries(SECTION_PATTERNS)) {
      if (pattern.test(l)) {
        found.push({ idx: i, name: name as SectionName });
        break;
      }
    }
  }

  return found.map((s, i) => ({
    name: s.name,
    start: s.idx + 1,
    end: found[i + 1]?.idx ?? lines.length,
  }));
}

function getSectionLines(lines: string[], sections: SectionBounds[], name: SectionName): string[] {
  const s = sections.find(s => s.name === name);
  if (!s) return [];
  return lines.slice(s.start, s.end).filter(Boolean);
}

// ── Headline ──────────────────────────────────────────────────────────────
function extractHeadline(lines: string[], name: string, sections: SectionBounds[]): string {
  // Look for "Name | Title" pattern first
  for (const line of lines) {
    const sep = line.match(/^[A-Z][a-z]+.*?[|\-–—]\s*(.{5,80})$/);
    if (sep && sep[1] && !sep[1].includes('@') && !/\d{4}/.test(sep[1].slice(-5))) {
      return sep[1].trim();
    }
  }
  // Line after name
  if (name) {
    const nameIdx = lines.findIndex(l => l === name || l.startsWith(name));
    if (nameIdx >= 0) {
      for (let i = nameIdx + 1; i < Math.min(nameIdx + 4, lines.length); i++) {
        const l = lines[i];
        if (l.length > 5 && l.length < 100 && !l.includes('@') && !/^\d/.test(l)) {
          return l;
        }
      }
    }
  }
  // Check for "Senior X" or "X Analyst" style line in first 15 lines
  for (const l of lines.slice(0, 15)) {
    if (/\b(senior|lead|principal|staff|associate|junior|chief|head|director|manager|analyst|engineer|developer|consultant|specialist|professional)\b/i.test(l)
      && l.length < 80 && !l.includes('@')) {
      return l;
    }
  }
  return '';
}

// ── Bio/Summary ───────────────────────────────────────────────────────────
function extractSection(lines: string[], sections: SectionBounds[], name: SectionName): string {
  const sLines = getSectionLines(lines, sections, name);
  if (!sLines.length) return '';
  return sLines.slice(0, 8).join(' ').slice(0, 600).trim();
}

// ── Skills ────────────────────────────────────────────────────────────────
const SKILL_KEYWORDS = [
  // Programming Languages
  'Python', 'Java', 'JavaScript', 'TypeScript', 'C++', 'C#', 'Go', 'Rust', 'Swift', 'Kotlin', 'Scala', 'Ruby', 'PHP', 'R', 'MATLAB', 'Perl', 'Bash', 'Shell',
  // Web/Frontend
  'React', 'Next.js', 'Vue', 'Angular', 'HTML', 'CSS', 'Sass', 'Tailwind', 'Bootstrap', 'jQuery', 'Redux', 'GraphQL', 'REST API', 'Node.js', 'Express', 'Django', 'Flask', 'FastAPI', 'Spring Boot',
  // Data & Analytics
  'SQL', 'Excel', 'Power BI', 'Tableau', 'Looker', 'Qlik', 'Pandas', 'NumPy', 'SciPy', 'Matplotlib', 'Seaborn', 'Plotly', 'Spark', 'PySpark', 'Hadoop', 'Hive', 'Kafka', 'Airflow', 'dbt', 'Alteryx',
  // Databases
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Snowflake', 'BigQuery', 'Redshift', 'Databricks', 'Oracle', 'DynamoDB', 'Elasticsearch', 'Cassandra',
  // Cloud & DevOps
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Ansible', 'Jenkins', 'GitHub Actions', 'GitLab CI', 'CI/CD', 'Linux', 'Nginx',
  // AI/ML
  'Machine Learning', 'Deep Learning', 'NLP', 'TensorFlow', 'PyTorch', 'Keras', 'Scikit-learn', 'XGBoost', 'LightGBM', 'OpenAI', 'LangChain', 'Hugging Face',
  // Data Science
  'Statistics', 'A/B Testing', 'Regression', 'Classification', 'Clustering', 'Time Series', 'Forecasting', 'Predictive Modeling', 'Feature Engineering', 'CLTV', 'Churn Prediction', 'Cohort Analysis',
  // Management
  'Agile', 'Scrum', 'Kanban', 'JIRA', 'Confluence', 'Product Management', 'Project Management', 'Stakeholder Management', 'KPI', 'OKR',
  // Analytics specific
  'Retail Analytics', 'Customer Analytics', 'Marketing Analytics', 'Business Intelligence', 'Data Visualization', 'Dashboard', 'Reporting',
  // Tools
  'Git', 'GitHub', 'Figma', 'Postman', 'VS Code', 'Jupyter', 'Databricks', 'Colab', 'Cursor', 'Claude',
  // Finance
  'Financial Modeling', 'Valuation', 'Bloomberg', 'Excel VBA', 'SAP',
];

function extractSkills(lines: string[], sections: SectionBounds[], fullText: string): string[] {
  const skillsLines = getSectionLines(lines, sections, 'skills');
  const fromSection: string[] = [];

  for (const l of skillsLines) {
    // Handle categorized skills: "Category: skill1 | skill2 | skill3"
    const afterColon = l.includes(':') ? l.split(':').slice(1).join(':') : l;
    const items = afterColon
      .split(/[,|•·\t/]/)
      .map(s => s.trim())
      .filter(s => s.length >= 2 && s.length <= 40 && !/^(and|the|or|in|of|with|for)$/i.test(s));
    fromSection.push(...items);
  }

  // Keyword scan across full text
  const fromKeywords = SKILL_KEYWORDS.filter(sk =>
    new RegExp('\\b' + sk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(fullText)
  );

  // Merge: section skills first (preserve exact casing), then keywords not already present
  const merged = [...fromSection];
  for (const kw of fromKeywords) {
    if (!merged.some(s => s.toLowerCase() === kw.toLowerCase())) {
      merged.push(kw);
    }
  }

  return [...new Set(merged)].filter(s => s.length >= 2);
}

// ── Experience ─────────────────────────────────────────────────────────────
function extractExperience(lines: string[], sections: SectionBounds[]): any[] {
  const expLines = getSectionLines(lines, sections, 'experience');
  if (!expLines.length) return [];

  const entries: any[] = [];

  // Date range regex — Month Year – Month Year or Year – Year or Date – Present
  const DATE_RE = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{4})\b.*?\b(\d{4}|Present|Current|Now|Till Date)\b/i;

  // Find lines with dates — those delineate job entries
  const dateLinesIdx: number[] = [];
  for (let i = 0; i < expLines.length; i++) {
    if (DATE_RE.test(expLines[i])) dateLinesIdx.push(i);
  }

  if (dateLinesIdx.length === 0) {
    // Fallback: try to split by lines that look like "Role | Company | Location"
    return extractExperienceFallback(expLines);
  }

  for (let d = 0; d < dateLinesIdx.length; d++) {
    const di = dateLinesIdx[d];
    const dateLine = expLines[di];
    const datesMatch = dateLine.match(DATE_RE);
    const dates = datesMatch?.[0] || dateLine;

    // Look backward for role/company (up to 3 lines before date)
    const prevLines = expLines.slice(Math.max(0, di - 3), di);

    // Company + role are usually on the same line or separate lines
    // Pattern: "Role Company Location" or "Role | Company" (pipe stripped in PDF)
    let role = '';
    let company = '';
    let location = '';

    if (prevLines.length >= 2) {
      // Check if the date line itself has "Role Company City"
      const dateSplit = dateLine.split(DATE_RE);
      const beforeDate = dateSplit[0].trim();
      if (beforeDate.length > 5) {
        // Parse "Senior Business Analyst Prescience Decision Solutions Bangalore"
        const words = beforeDate.split(/\s+/);
        // Heuristic: company is a proper noun sequence, role is before it
        role = prevLines[prevLines.length - 1] || beforeDate;
        company = prevLines[prevLines.length - 2] || '';
      } else {
        role = prevLines[prevLines.length - 1];
        company = prevLines[prevLines.length - 2] || '';
      }
    } else if (prevLines.length === 1) {
      // Role and company on same line, split by common separators
      const combined = prevLines[0];
      const atMatch = combined.match(/^(.+?)\s+(?:at|@|-|–)\s+(.+)$/i);
      if (atMatch) {
        role = atMatch[1].trim();
        company = atMatch[2].trim();
      } else {
        role = combined;
      }
    }

    // Collect description bullets (between this date and next date marker)
    const nextDateStart = dateLinesIdx[d + 1] ?? expLines.length;
    const descLines = expLines.slice(di + 1, nextDateStart)
      .filter(l => l.length > 10 && !l.match(/^(education|skills?|projects?|certifications?)/i));

    const achievements: string[] = [];
    const descParts: string[] = [];
    for (const l of descLines.slice(0, 8)) {
      if (/^[•\-*▪▸→]/.test(l) || /^\d+\./.test(l)) {
        achievements.push(l.replace(/^[•\-*▪▸→\d.]\s*/, '').trim());
      } else {
        descParts.push(l);
      }
    }

    entries.push({
      role: cleanLine(role),
      company: cleanLine(company),
      dates: dates.trim(),
      location: location,
      description: descParts.join(' ').slice(0, 300),
      achievements: achievements.slice(0, 6),
    });
  }

  return entries.filter(e => e.role || e.company).slice(0, 8);
}

function extractExperienceFallback(lines: string[]): any[] {
  // When no date patterns found, try to split by empty-line-separated blocks
  const entries: any[] = [];
  let currentBlock: string[] = [];

  for (const l of lines) {
    if (l.length === 0) {
      if (currentBlock.length > 0) {
        entries.push({
          role: currentBlock[0] || '',
          company: currentBlock[1] || '',
          dates: '',
          description: currentBlock.slice(2).join(' ').slice(0, 300),
          achievements: [],
        });
        currentBlock = [];
      }
    } else {
      currentBlock.push(l);
    }
  }
  return entries.slice(0, 8);
}

// ── Education ─────────────────────────────────────────────────────────────
function extractEducation(lines: string[], sections: SectionBounds[]): any[] {
  const eduLines = getSectionLines(lines, sections, 'education');
  if (!eduLines.length) return [];

  const entries: any[] = [];
  const DEGREE_RE = /\b(B\.?Tech|B\.?E\.?|B\.?S\.?|B\.?Sc\.?|M\.?Tech|M\.?E\.?|M\.?S\.?|M\.?Sc\.?|MBA|Ph\.?D\.?|Bachelor|Master|Diploma|Associate|Doctor|High\s+School|CBSE|ICSE|HSC|SSC|12th|10th)/i;

  for (let i = 0; i < eduLines.length; i++) {
    const l = eduLines[i];
    if (DEGREE_RE.test(l)) {
      const dateMatch = l.match(/\b\d{4}\b.*?\b\d{4}\b/) || eduLines[i + 1]?.match(/\b\d{4}\b/);
      entries.push({
        degree: l.trim(),
        school: eduLines[i - 1]?.trim() || '',
        field: '',
        dates: dateMatch?.[0] || '',
        gpa: l.match(/(?:GPA|CGPA|CPI)[:\s]*([\d.]+)/i)?.[1] || '',
      });
    } else if (/\b(University|College|Institute|School|Academy)\b/i.test(l)) {
      // Line is a school name — look for degree on next line
      const nextDegree = eduLines[i + 1] && DEGREE_RE.test(eduLines[i + 1]) ? eduLines[i + 1] : '';
      if (nextDegree) {
        entries.push({
          school: l.trim(),
          degree: nextDegree.trim(),
          field: '',
          dates: eduLines[i + 2]?.match(/\b\d{4}\b/)?.[0] || '',
          gpa: '',
        });
        i++;
      }
    }
  }

  return entries.slice(0, 5);
}

// ── Projects ──────────────────────────────────────────────────────────────
function extractProjects(lines: string[], sections: SectionBounds[]): any[] {
  const projLines = getSectionLines(lines, sections, 'projects');
  if (!projLines.length) return [];

  const entries: any[] = [];
  let current: any = null;

  for (const l of projLines) {
    // New project starts with a short line that doesn't look like a bullet
    if (!l.startsWith('•') && !l.startsWith('-') && l.length < 80 && l.length > 3 && !/^(led|built|developed|created|designed|implemented)/i.test(l)) {
      if (current) entries.push(current);
      current = { name: l, description: '', technologies: [], dates: '' };
    } else if (current) {
      const desc = l.replace(/^[•\-*]\s*/, '');
      current.description += (current.description ? ' ' : '') + desc;
      // Extract tech from parens or "using X, Y, Z"
      const tech = l.match(/(?:using|built with|tech:|stack:)\s*([^.]+)/i)?.[1];
      if (tech) {
        current.technologies.push(...tech.split(/[,|]/).map((t: string) => t.trim()).filter(Boolean));
      }
    }
  }
  if (current) entries.push(current);

  return entries.slice(0, 6).map(e => ({ ...e, description: e.description.slice(0, 300) }));
}

// ── Certifications ────────────────────────────────────────────────────────
function extractCertifications(lines: string[], sections: SectionBounds[]): any[] {
  const certLines = getSectionLines(lines, sections, 'certifications');
  if (!certLines.length) {
    // Also look for certification keywords anywhere
    const allCertLines = lines.filter(l =>
      /\b(certif|certified|credential|course|bootcamp)\b/i.test(l) && l.length < 120
    );
    return allCertLines.slice(0, 5).map(l => ({ name: l.replace(/^[•\-*]\s*/, '').trim(), issuer: '', date: '', url: '' }));
  }

  return certLines.slice(0, 6).map(l => {
    const parts = l.split(/[|,–\-]/).map((p: string) => p.trim());
    return {
      name: parts[0] || l,
      issuer: parts[1] || '',
      date: parts[2] || l.match(/\b\d{4}\b/)?.[0] || '',
      url: l.match(/https?:\/\/[^\s]+/)?.[0] || '',
    };
  });
}

// ── Achievements ──────────────────────────────────────────────────────────
function extractAchievements(lines: string[], sections: SectionBounds[]): string[] {
  const achLines = getSectionLines(lines, sections, 'achievements');
  // Also look for lines with quantified impact across all lines
  const quantified = lines.filter(l =>
    /\d+%/.test(l) ||
    /(?:increased|reduced|improved|saved|generated|achieved|delivered|grew|scaled)\s+.*\d/i.test(l)
  );

  const all = [
    ...achLines.map(l => l.replace(/^[•\-*]\s*/, '').trim()),
    ...quantified.map(l => l.replace(/^[•\-*]\s*/, '').trim()),
  ];

  return [...new Set(all)].filter(s => s.length > 15).slice(0, 10);
}

function cleanLine(s: string): string {
  return s.replace(/^[•\-*|]\s*/, '').trim();
}

// ────────────────────────────────────────────────────────────────────────────
// ATS Score — 5 dimensions, returns breakdown + recommendations
// ────────────────────────────────────────────────────────────────────────────

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
  const s = structure || {};
  const text = parsedText || '';
  const recommendations: string[] = [];
  const missingKeywords: string[] = [];

  // ── 1. Completeness (25 pts) ─────────────────────────────────────────────
  let completeness = 0;
  const checks: Array<[boolean, number, string]> = [
    [!!s.full_name?.trim(), 5, 'Add your full name'],
    [!!s.email?.trim(), 4, 'Add your email address'],
    [!!s.phone?.trim(), 3, 'Add your phone number'],
    [!!s.linkedin?.trim(), 3, 'Add your LinkedIn profile URL'],
    [!!(s.headline?.trim()), 4, 'Add a professional headline/title'],
    [!!(s.bio?.trim() && s.bio.length > 80), 4, 'Add a professional summary (2-4 sentences)'],
    [s.skills?.length >= 5, 2, 'List at least 5 skills'],
  ];
  for (const [ok, pts, msg] of checks) {
    if (ok) completeness += pts;
    else recommendations.push(msg);
  }

  // ── 2. Keywords (25 pts) ────────────────────────────────────────────────
  const ACTION_VERBS = ['led', 'built', 'developed', 'designed', 'implemented', 'managed', 'created', 'delivered', 'improved', 'optimized', 'reduced', 'increased', 'drove', 'launched', 'architected', 'spearheaded', 'collaborated', 'mentored', 'automated', 'analyzed', 'forecasted'];
  const foundVerbs = ACTION_VERBS.filter(v => new RegExp(`\\b${v}\\b`, 'i').test(text));
  const verbScore = Math.min(10, foundVerbs.length * 2);

  const hasQuantified = /\d+%|\d+x|\$[\d,]+|\d+\s*(?:million|thousand|k\b)/i.test(text);
  const quantifiedScore = hasQuantified ? 10 : 0;
  if (!hasQuantified) recommendations.push('Add quantified achievements (%, $, numbers)');

  const wordCount = text.trim().split(/\s+/).length;
  const lengthScore = wordCount >= 600 ? 5 : wordCount >= 400 ? 3 : wordCount >= 200 ? 1 : 0;
  if (wordCount < 400) recommendations.push('Expand resume content — aim for 400-700 words');

  const keywordScore = verbScore + quantifiedScore + lengthScore;

  // ── 3. Skills (20 pts) ──────────────────────────────────────────────────
  const skillCount = s.skills?.length || 0;
  let skillsScore = 0;
  if (skillCount >= 15) skillsScore = 20;
  else if (skillCount >= 10) skillsScore = 16;
  else if (skillCount >= 6) skillsScore = 12;
  else if (skillCount >= 3) skillsScore = 8;
  else if (skillCount > 0) skillsScore = 4;

  if (skillCount < 10) {
    recommendations.push(`Add more skills — you have ${skillCount}, aim for 10+`);
    // Suggest some common ones not in their list
    const current = (s.skills || []).map((sk: string) => sk.toLowerCase());
    const suggested = SKILL_KEYWORDS.filter(sk => !current.includes(sk.toLowerCase())).slice(0, 5);
    missingKeywords.push(...suggested);
  }

  // ── 4. Experience (20 pts) ──────────────────────────────────────────────
  const expCount = s.experience?.length || 0;
  let experienceScore = 0;
  if (expCount >= 3) experienceScore = 14;
  else if (expCount === 2) experienceScore = 10;
  else if (expCount === 1) experienceScore = 6;
  if (expCount === 0) recommendations.push('Add work experience entries');

  const hasAchievementsInExp = s.experience?.some((e: any) => e.achievements?.length > 0 || (e.description?.length > 50));
  if (hasAchievementsInExp) experienceScore += 6;
  else if (expCount > 0) recommendations.push('Add achievement bullets to each experience entry');

  // ── 5. Structure (10 pts) ───────────────────────────────────────────────
  let structureScore = 0;
  if (s.education?.length > 0) structureScore += 3;
  else recommendations.push('Add your education');
  if (s.experience?.length > 0) structureScore += 3;
  if (s.skills?.length > 0) structureScore += 2;
  if (s.projects?.length > 0 || s.certifications?.length > 0) structureScore += 2;
  else if (expCount > 0) recommendations.push('Add projects or certifications to stand out');

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
