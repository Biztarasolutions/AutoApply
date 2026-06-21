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

    const prompt = `You are an expert ATS resume parser. Extract ALL information from the resume text below into this exact JSON structure. Return ONLY sections that actually exist in the document — never infer or hallucinate content.

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
  "skills": [{"category": "string", "items": ["string"]}],
  "experience": [{"title": "string", "company": "string", "location": "string", "startDate": "string", "endDate": "string", "description": "string", "bullets": ["string"]}],
  "education": [{"school": "string", "degree": "string", "field": "string", "dates": "string", "gpa": "string"}],
  "projects": [{"name": "string", "description": "string", "technologies": ["string"], "dates": "string"}],
  "certifications": [{"name": "string", "issuer": "string", "date": "string", "url": "string"}]
}

Rules:
- skills.category must be the exact category heading from the resume (e.g. "Programming & Data")
- experience.bullets must be the actual bullet points from the resume, not paraphrased
- Never create an "achievements" top-level section; put achievements inside each experience entry's bullets
- Empty string or empty array for missing fields

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

// ─── Schema normalisation helpers ────────────────────────────────────────────

function normaliseExp(e: any) {
  const title = (e.title || e.role || '').trim();
  const bullets = (e.bullets || e.achievements || []).map((b: string) => b.trim()).filter(Boolean);
  const dates = (e.dates || [e.startDate, e.endDate].filter(Boolean).join(' – ')).trim();
  const { startDate, endDate } = splitDates(dates);
  return {
    title,
    role: title,           // backward-compat alias
    company:     (e.company  || '').trim(),
    location:    (e.location || '').trim(),
    startDate,
    endDate,
    dates,
    description: (e.description || '').trim(),
    bullets,
    achievements: bullets, // backward-compat alias
  };
}

function mergeStructures(ai: any, fallback: any) {
  // Skills: prefer heuristic categorised form
  const skills: Array<{ category: string; items: string[] }> =
    fallback.skills?.length ? fallback.skills
    : (ai.skills?.length
        ? ai.skills.map((s: any) =>
            typeof s === 'string'
              ? { category: 'Skills', items: [s] }
              : { category: s.category || 'Skills', items: s.items || [] })
        : []);

  const experience = ai.experience?.length
    ? ai.experience.map(normaliseExp)
    : fallback.experience;

  return {
    full_name:        ai.full_name      || fallback.full_name,
    email:            ai.email          || fallback.email,
    phone:            ai.phone          || fallback.phone,
    linkedin:         ai.linkedin       || fallback.linkedin,
    github:           ai.github         || fallback.github,
    website:          ai.website        || fallback.website,
    location:         ai.location       || fallback.location,
    headline:         ai.headline       || fallback.headline,
    bio:              ai.bio            || fallback.bio,
    skills,
    // backward-compat alias consumed by older frontend code and templates
    skill_categories: skills.map(c => ({ name: c.category, skills: c.items })),
    experience,
    education:        ai.education?.length      ? ai.education      : fallback.education,
    projects:         ai.projects?.length       ? ai.projects       : fallback.projects,
    certifications:   ai.certifications?.length ? ai.certifications : fallback.certifications,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Section detection — handles both line-structured and single-paragraph PDFs
// ─────────────────────────────────────────────────────────────────────────────

interface TextSection { name: string; content: string }

const SECTION_DEFS: Array<{ name: string; keywords: string[] }> = [
  { name: 'summary',        keywords: ['Professional Summary', 'Career Summary', 'Executive Summary', 'Summary', 'Profile', 'Objective', 'About Me', 'Overview', 'Career Objective'] },
  { name: 'skills',         keywords: ['Technical Skills', 'Core Competencies', 'Key Skills', 'Skills', 'Expertise', 'Technologies', 'Tools & Technologies'] },
  { name: 'experience',     keywords: ['Work Experience', 'Professional Experience', 'Employment History', 'Work History', 'Career History', 'Experience', 'Employment'] },
  { name: 'education',      keywords: ['Academic Background', 'Educational Background', 'Education', 'Academic Qualifications', 'Qualifications', 'Schooling'] },
  { name: 'projects',       keywords: ['Notable Projects', 'Key Projects', 'Personal Projects', 'Academic Projects', 'Projects'] },
  { name: 'certifications', keywords: ['Professional Certifications', 'Certifications', 'Certificates', 'Certification', 'Credentials', 'Licenses'] },
];

function splitIntoSections(text: string): TextSection[] {
  const hits: Array<{ name: string; headerStart: number; headerEnd: number }> = [];

  for (const { name, keywords } of SECTION_DEFS) {
    // Try longer keywords first so "Work Experience" beats "Experience"
    for (const kw of [...keywords].sort((a, b) => b.length - a.length)) {
      // Case-SENSITIVE — "skills" mid-sentence won't match the "Skills" heading
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      const re = new RegExp(`(?:^|(?<![a-zA-Z]))${escaped}(?![a-zA-Z])`);
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

  const bio              = getSec(sections, 'summary').trim();
  const skillsRaw        = getSec(sections, 'skills');
  const skills           = extractSkillCategories(skillsRaw);
  const experience       = extractExperience(getSec(sections, 'experience'));
  const education        = extractEducation(getSec(sections, 'education'));
  const projects         = extractProjects(getSec(sections, 'projects'));
  const certifications   = extractCertifications(getSec(sections, 'certifications'));

  return {
    full_name, email, phone, linkedin, github, website, location, headline, bio,
    skills,
    skill_categories: skills.map(c => ({ name: c.category, skills: c.items })),
    experience,
    education,
    projects,
    certifications,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Contact extractors
// ─────────────────────────────────────────────────────────────────────────────

function extractEmail(text: string): string {
  return (text.match(/([a-zA-Z0-9._+%-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/)?.[0] ?? '').toLowerCase();
}

function extractPhone(text: string): string {
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
// Name / headline / location
// ─────────────────────────────────────────────────────────────────────────────

const NON_NAME_WORDS = new Set([
  'Senior', 'Junior', 'Lead', 'Principal', 'Staff', 'Chief', 'Head', 'Associate',
  'Analytics', 'Analyst', 'Data', 'Business', 'Software', 'Product', 'Solutions',
  'Application', 'Development', 'Professional', 'Independent', 'Consulting',
  'Freelance', 'Technical', 'Corporate', 'Executive', 'Research', 'Platform',
  'Manager', 'Director', 'Engineer', 'Specialist', 'Scientist', 'Architect',
  'Consultant', 'Developer', 'Designer', 'Officer', 'Intern',
  'Summary', 'Skills', 'Education', 'Experience', 'Certification', 'Projects',
  'Objective', 'Profile', 'Overview', 'Resume', 'Curriculum',
  'January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December',
  'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sep', 'Sept', 'Oct', 'Nov', 'Dec',
]);

function extractContactBlock(text: string, email: string) {
  const full_name = findName(text, email);
  const headline  = findHeadline(text, full_name);
  const location  = findLocation(text, email);
  return { full_name, headline, location };
}

function findName(text: string, email: string): string {
  if (!email) return '';
  const emailIdx = text.indexOf(email);
  if (emailIdx < 0) return '';

  const lookback = text.slice(Math.max(0, emailIdx - 400), emailIdx);
  const cleaned = lookback
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\S+\.(com|io|net|org|in|co)\S*/gi, ' ')
    .replace(/\bProjects?\b/gi, ' ')
    .replace(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/gi, ' ')
    .replace(/\b\d[\d\s./\-]+/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const PAIR_RE = /\b([A-Z][a-z]{1,19})\s+([A-Z][a-z]{1,19})\b/g;
  const candidates: Array<{ name: string; idx: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = PAIR_RE.exec(cleaned)) !== null) {
    if (!NON_NAME_WORDS.has(m[1]) && !NON_NAME_WORDS.has(m[2])) {
      candidates.push({ name: `${m[1]} ${m[2]}`, idx: m.index });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.idx - a.idx);
    return candidates[0].name;
  }

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
  const after = text.slice(nameIdx + name.length, nameIdx + name.length + 120).replace(/^\s+/, '');
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
  const m = win.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,\s*(?:[A-Z][a-z]+|[A-Z]{2,3}))\b/);
  if (m) return m[1];
  for (const city of ['Bangalore', 'Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Noida', 'Gurgaon', 'Gurugram']) {
    if (new RegExp(`\\b${city}\\b`, 'i').test(win)) return `${city}, India`;
  }
  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Skills — categorised extraction
// ─────────────────────────────────────────────────────────────────────────────

// Words that, when appearing as the SECOND word before & in a pipe-split token, indicate
// that both words together form the category prefix (e.g. "Machine Learning & …")
const KNOWN_CAT_PRE = new Set([
  'Machine', 'Data', 'Programming', 'Software', 'Technical', 'Core',
  'Computer', 'Network', 'Cloud', 'Digital', 'Business', 'Advanced',
]);

// Words that, when appearing as the SECOND word after & in a pipe-split token, should be
// included in the category suffix (e.g. "… & Data Science")
const KNOWN_CAT_POST = new Set([
  'Science', 'Technology', 'Technologies', 'Engineering', 'Intelligence',
  'Analytics', 'Systems', 'Development', 'Architecture', 'Services', 'Management',
]);

export function extractSkillCategories(skillsSection: string): Array<{ category: string; items: string[] }> {
  if (!skillsSection) return [];

  // ── Multi-line format: category header on its own line ────────────────────
  if (skillsSection.includes('\n')) {
    const lines = skillsSection.split(/\n/).map(l => l.trim()).filter(Boolean);
    const cats: Array<{ category: string; items: string[] }> = [];
    let cur: { category: string; items: string[] } | null = null;
    for (const line of lines) {
      const looksLikeHeader = !line.includes('|') && line.length < 60 && /^[A-Z]/.test(line) && !/^\d/.test(line);
      if (looksLikeHeader) {
        if (cur?.items.length) cats.push(cur);
        cur = { category: line.replace(/[:\-–]+$/, '').trim(), items: [] };
      } else if (cur) {
        cur.items.push(
          ...line.split('|').map(s => s.replace(/[()]/g, ' ').trim()).filter(s => s.length >= 2 && s.length <= 50)
        );
      }
    }
    if (cur?.items.length) cats.push(cur);
    if (cats.length > 0) return cats;
  }

  // ── Single-line format (unpdf mergePages:true produces one long string) ───
  // Strategy: split by '|', then detect category transitions within each token.
  // A transition token contains ' & ' and has the form:
  //   [prevSkill?] [catPrefix] & [catSuffix] [firstSkill?]
  // We use KNOWN_CAT_PRE / KNOWN_CAT_POST to decide whether to include a 2nd word.

  const text = skillsSection.replace(/\n/g, ' ');
  const tokens = text.split('|').map(t => t.trim()).filter(Boolean);

  const result: Array<{ category: string; items: string[] }> = [];
  let current: { category: string; items: string[] } | null = null;

  const cleanSkill = (s: string) => s.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();

  for (const token of tokens) {
    const ampIdx = token.indexOf(' & ');
    if (ampIdx < 0) {
      // Pure skill token
      const sk = cleanSkill(token);
      if (sk.length >= 2 && sk.length <= 60 && /[a-zA-Z]/.test(sk) && current) {
        current.items.push(sk);
      }
      continue;
    }

    // Token contains ' & ' — find the category boundary
    const beforeAmp = token.slice(0, ampIdx).trim();
    const afterAmp  = token.slice(ampIdx + 3).trim(); // skip ' & '

    const beforeWords = beforeAmp.split(/\s+/).filter(Boolean);
    const afterWords  = afterAmp.split(/\s+/).filter(Boolean);

    if (!beforeWords.length || !afterWords.length) {
      if (current) current.items.push(cleanSkill(token));
      continue;
    }

    // Category prefix: last word before &, optionally preceded by a second word
    const lastBefore   = beforeWords[beforeWords.length - 1];
    const secondBefore = beforeWords.length >= 2 ? beforeWords[beforeWords.length - 2] : '';
    const useTwoWordPre = secondBefore && KNOWN_CAT_PRE.has(secondBefore);
    const catPrefix    = useTwoWordPre ? `${secondBefore} ${lastBefore}` : lastBefore;
    const prevSkillArr = useTwoWordPre ? beforeWords.slice(0, -2) : beforeWords.slice(0, -1);
    const prevSkill    = cleanSkill(prevSkillArr.join(' '));

    // Category suffix: first word after &, optionally followed by a second word
    const firstAfter  = afterWords[0];
    const secondAfter = afterWords.length >= 2 ? afterWords[1] : '';
    const useTwoWordPost = secondAfter && KNOWN_CAT_POST.has(secondAfter);
    const catSuffix    = useTwoWordPost ? `${firstAfter} ${secondAfter}` : firstAfter;
    const firstSkillArr = useTwoWordPost ? afterWords.slice(2) : afterWords.slice(1);
    const firstSkill   = cleanSkill(firstSkillArr.join(' '));

    const catName = `${catPrefix} & ${catSuffix}`;

    // Close previous category, adding the trailing skill from this transition token
    if (prevSkill && prevSkill.length >= 2 && current) current.items.push(prevSkill);
    if (current && current.items.length > 0) result.push(current);

    // Open new category
    current = { category: catName, items: [] };
    if (firstSkill && firstSkill.length >= 2) current.items.push(firstSkill);
  }

  if (current && current.items.length > 0) result.push(current);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Experience extraction
// ─────────────────────────────────────────────────────────────────────────────

const MON = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';

// Date-range pattern — handles:
//   "Dec 2024   Present"   (multiple spaces, no dash — after en-dash stripped by sanitizer)
//   "Sept 2021   Dec 2024"
//   "2020 - 2022"
const DATE_RANGE = `(?:${MON}\\s+\\d{4}[\\s\\-–]+(?:${MON}\\s+)?(?:\\d{4}|Present|Current|Till\\s+Date|Now)|\\d{4}\\s*[\\-–]\\s*(?:\\d{4}|Present|Current|Now))`;

// Single-line job-header:  "Role+Company | City | DateRange"
// Using 'g' only (NOT 'gi') so [A-Z] matches only uppercase — prevents hundreds of
// false-positive matches that plague the 'gi' version.
const JOB_HEADER_SOURCE = `([A-Z][^|\\n]{5,80}?)\\s+\\|\\s+([^|\\n]{2,40}?)\\s+\\|\\s+(${DATE_RANGE})`;

// Title terms used to split "RoleCompany" into role + company
const TITLE_TERMS = /\b(Analyst|Engineer|Developer|Manager|Architect|Director|Consultant|Associate|Specialist|Scientist|Designer|Advisor|Professional|Executive|Officer|Intern|Lead|VP|Head)\b/i;

function splitDates(dates: string): { startDate: string; endDate: string } {
  // "Dec 2024   Present" → two or more spaces as separator
  const spaceMatch = dates.match(/^(.+?)\s{2,}(.+)$/);
  if (spaceMatch) return { startDate: spaceMatch[1].trim(), endDate: spaceMatch[2].trim() };
  // "Sept 2021 – Dec 2024" or "Sept 2019 - Aug 2020"
  const dashMatch = dates.match(/^(.+?)\s*[\-–]+\s*(.+)$/);
  if (dashMatch) return { startDate: dashMatch[1].trim(), endDate: dashMatch[2].trim() };
  return { startDate: dates.trim(), endDate: '' };
}

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
    .split(/[•·▪▸→\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 500)
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

interface JobMatch {
  title: string; company: string; location: string; dates: string;
  headerStart: number; headerEnd: number;
}

export function extractExperience(expSection: string): any[] {
  if (!expSection) return [];

  const re = new RegExp(JOB_HEADER_SOURCE, 'g'); // 'g' only — NOT 'gi'
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  const matches: JobMatch[] = [];

  while ((m = re.exec(expSection)) !== null) {
    const roleCompany = m[1].trim();
    // Only accept matches whose first character is uppercase (filters out
    // mid-sentence false positives that slipped through)
    if (!/^[A-Z]/.test(roleCompany)) continue;
    const { role, company } = splitRoleCompany(roleCompany);
    const dates = m[3].trim();
    const { startDate, endDate } = splitDates(dates);
    matches.push({
      title:       role,
      company:     company,
      location:    m[2].trim(),
      dates,
      headerStart: m.index,
      headerEnd:   m.index + m[0].length,
    });
  }

  if (matches.length === 0) {
    return [{
      title: '', role: '', company: '', location: '',
      startDate: '', endDate: '', dates: '',
      description: expSection.slice(0, 600).trim(),
      bullets: extractBullets(expSection).slice(0, 6),
      achievements: [],
    }];
  }

  return matches.map((hdr, i) => {
    // Text before this header (between previous header's end and this header's start)
    const prevEnd    = i === 0 ? 0 : matches[i - 1].headerEnd;
    const beforeText = stripContactNoise(expSection.slice(prevEnd, hdr.headerStart));

    // Text after this header (between this header's end and next header's start)
    const afterText  = stripContactNoise(
      expSection.slice(hdr.headerEnd, matches[i + 1]?.headerStart ?? expSection.length)
    );

    // Combine both chunks; whichever is longer tends to be the real description
    const combined = [beforeText, afterText]
      .filter(t => t.length > 20)
      .join('\n')
      .trim();

    const bullets = extractBullets(combined);
    const prose   = combined
      .replace(/[•·▪▸→][^•·▪▸→\n]*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const { startDate, endDate } = splitDates(hdr.dates);

    return {
      title:        hdr.title,
      role:         hdr.title,      // backward-compat
      company:      hdr.company,
      location:     hdr.location,
      startDate,
      endDate,
      dates:        hdr.dates,
      description:  prose.slice(0, 1500),
      bullets:      bullets.slice(0, 8),
      achievements: bullets.slice(0, 8), // backward-compat
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Education
// ─────────────────────────────────────────────────────────────────────────────

const DEGREE_SPLIT_RE = /(?=\b(?:B\.?Tech|B\.?E\.?|B\.?Sc?\.?|M\.?Tech|M\.?E\.?|M\.?Sc?\.?|MBA|MCA|Ph\.?D\.?|Bachelor|Master|Diploma|12th\s+Standard|10th\s+Standard|12th|10th|HSC|SSC)\b)/gi;
const EDU_DATE_RE = /\d{1,2}\/\d{4}[\s\-–]+\d{1,2}\/\d{4}/g;
const SCORE_RE    = /\b\d{1,3}(?:\.\d{1,2})?\s*\/\s*\d{1,3}\b/g;

export function extractEducation(eduSection: string): any[] {
  if (!eduSection) return [];
  const chunks = eduSection.split(DEGREE_SPLIT_RE).filter(s => s.trim().length > 5);

  return chunks.map(chunk => {
    const degreeMatch = chunk.match(
      /^(B\.?Tech(?:\s+in\s+[\w\s]+)?|B\.?E\.?|B\.?Sc?\.?|M\.?Tech(?:\s+in\s+[\w\s]+)?|M\.?E\.?|M\.?Sc?\.?|MBA|MCA|Ph\.?D\.?|Bachelor(?:\s+of\s+[\w\s]+)?|Master(?:\s+of\s+[\w\s]+)?|Diploma(?:\s+in\s+[\w\s]+)?|12th\s+Standard(?:\s*\([A-Z]+\))?|10th\s+Standard(?:\s*\([A-Z]+\))?|12th|10th|HSC|SSC)/i
    );
    const degree = degreeMatch?.[0]?.trim() ?? '';
    if (!degree) return null;

    EDU_DATE_RE.lastIndex = 0;
    const dateMatch = EDU_DATE_RE.exec(chunk);
    const dates = dateMatch?.[0]?.trim() ?? '';

    let school = '';
    if (dates && dateMatch) {
      const afterDate = chunk.slice(dateMatch.index + dateMatch[0].length).trim();
      school = afterDate.replace(new RegExp(SCORE_RE.source, 'g'), '').replace(/\s+/g, ' ').trim().slice(0, 100);
    }

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
  const cleaned   = certSection.replace(/\bCredential\s+Link\s*/gi, '').trim();
  const nameMatch = cleaned.match(/^([A-Z][^\d.!?\n]{10,100}?)(?=\s+(?:\d|Credential|\d{2}\/\d{4}))/i)
    ?? cleaned.match(/^(.{10,80})/);
  const name = nameMatch?.[1]?.trim() ?? cleaned.slice(0, 80).trim();
  if (!name || name.length < 5) return [];
  return [{ name, issuer: '', date: dateMatch?.[0]?.trim() ?? '', url: urlMatch?.[0] ?? '' }];
}

// ─────────────────────────────────────────────────────────────────────────────
// ATS scoring
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

function countSkillItems(s: any): number {
  if (!s.skills?.length) return 0;
  // New format: [{category, items}]
  if (typeof s.skills[0] === 'object' && s.skills[0] !== null) {
    return s.skills.reduce((acc: number, c: any) => acc + (c.items?.length || 0), 0);
  }
  // Old format: string[]
  return s.skills.length;
}

const KNOWN_SKILLS_LIST = [
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

export function calculateAts(parsedText: string, structure: any): AtsResult {
  const s    = structure || {};
  const text = parsedText || '';
  const recommendations: string[] = [];
  const missingKeywords: string[] = [];

  // 1. Completeness (25 pts)
  let completeness = 0;
  const compFields: Array<[boolean, number, string]> = [
    [!!s.full_name?.trim(),          4, 'Add your full name'],
    [!!s.email?.trim(),              4, 'Add your email address'],
    [!!s.phone?.trim(),              3, 'Add your phone number'],
    [!!s.linkedin?.trim(),           2, 'Add your LinkedIn profile URL'],
    [!!s.headline?.trim(),           4, 'Add a professional headline/title'],
    [!!(s.bio?.trim()?.length > 80), 5, 'Add a professional summary (80+ words)'],
    [countSkillItems(s) >= 5,        2, 'List at least 5 skills'],
    [!!s.location?.trim(),           1, 'Add your city/location'],
  ];
  for (const [ok, pts, msg] of compFields) {
    if (ok) completeness += pts;
    else recommendations.push(msg);
  }

  // 2. Keywords & content (25 pts)
  const ACTION_VERBS = ['led', 'built', 'developed', 'designed', 'implemented', 'managed', 'created', 'delivered', 'improved', 'optimized', 'reduced', 'increased', 'drove', 'launched', 'spearheaded', 'collaborated', 'mentored', 'automated', 'analyzed', 'forecasted', 'deployed', 'scaled', 'streamlined', 'enabled'];
  const foundVerbs  = ACTION_VERBS.filter(v => new RegExp(`\\b${v}\\b`, 'i').test(text));
  const verbScore   = Math.min(10, Math.floor(foundVerbs.length * 1.5));

  const quantCount  = [/\d+%/, /\d+x\b/, /\$[\d,]+/, /\d+\s*(?:million|thousand|k\b)/i].filter(p => p.test(text)).length;
  const quantScore  = Math.min(10, quantCount * 3);
  if (quantCount === 0) recommendations.push('Add quantified achievements (%, $, numbers)');

  const words       = text.trim().split(/\s+/).length;
  const lengthScore = words >= 600 ? 5 : words >= 400 ? 3 : words >= 200 ? 1 : 0;
  if (words < 400) recommendations.push('Expand resume content — aim for 400-700 words');

  const keywordScore = Math.min(25, verbScore + quantScore + lengthScore);

  // 3. Skills (20 pts)
  const skillCount  = countSkillItems(s);
  const skillsScore =
    skillCount >= 20 ? 20 :
    skillCount >= 15 ? 17 :
    skillCount >= 10 ? 14 :
    skillCount >= 6  ? 10 :
    skillCount >= 3  ? 6  :
    skillCount > 0   ? 3  : 0;
  if (skillCount < 10) {
    recommendations.push(`Add more skills — you have ${skillCount}, aim for 10+`);
    const allItems = typeof s.skills?.[0] === 'object'
      ? s.skills.flatMap((c: any) => c.items || [])
      : (s.skills || []);
    const current = allItems.map((sk: string) => sk.toLowerCase());
    KNOWN_SKILLS_LIST.filter(sk => !current.includes(sk.toLowerCase())).slice(0, 5).forEach(kw => missingKeywords.push(kw));
  }

  // 4. Experience (20 pts)
  const expCount  = s.experience?.length || 0;
  const expBase   = expCount >= 4 ? 12 : expCount === 3 ? 10 : expCount === 2 ? 7 : expCount === 1 ? 4 : 0;
  const hasContent = s.experience?.some((e: any) =>
    (e.bullets?.length > 0 || e.achievements?.length > 0) || (e.description?.trim()?.length > 40)
  ) ?? false;
  const expBonus       = hasContent ? 8 : 0;
  const experienceScore = Math.min(20, expBase + expBonus);
  if (expCount === 0)   recommendations.push('Add work experience with role, company, and dates');
  else if (!hasContent) recommendations.push('Add achievement bullets to each experience entry');

  // 5. Structure (10 pts)
  let structureScore = 0;
  if ((s.education?.length    || 0) > 0) structureScore += 3; else recommendations.push('Add your education section');
  if (expCount                    > 0) structureScore += 3;
  if (skillCount                  > 0) structureScore += 2;
  if ((s.certifications?.length || 0) > 0 || (s.projects?.length || 0) > 0) structureScore += 2;
  else if (expCount > 0) recommendations.push('Add certifications or projects to strengthen your profile');

  const score = Math.min(100, completeness + keywordScore + skillsScore + experienceScore + structureScore);

  return {
    score: Math.round(score),
    completeness, keywordScore, skillsScore, experienceScore, structureScore,
    missingKeywords: missingKeywords.slice(0, 8),
    recommendations: recommendations.slice(0, 6),
  };
}
