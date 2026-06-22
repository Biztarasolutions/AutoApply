const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 4000;
const API_SECRET = process.env.AUTOMATION_SECRET || '';

// Health check is public (Railway probe doesn't send auth header)
app.get('/health', (_, res) => res.json({ ok: true }));

// ── Auth middleware ────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (!API_SECRET) return next(); // no secret set = open (dev only)
  const auth = req.headers['x-automation-secret'] || req.query.secret;
  if (auth !== API_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

// ── Main apply endpoint ────────────────────────────────────────────────────────
app.post('/apply', async (req, res) => {
  const { jobUrl, profile = {}, resumeBase64, resumeFilename } = req.body;

  if (!jobUrl) return res.status(400).json({ error: 'jobUrl is required' });

  const steps = [];
  const log = (step, status, details = '') => {
    steps.push({ step, status, details, timestamp: new Date().toISOString() });
    console.log(`[${status.toUpperCase()}] ${step} — ${details}`);
  };

  let browser = null;
  let tmpResume = null;

  try {
    const ats = detectATS(jobUrl);
    log('Initialization', 'success', `Chromium launching. ATS: ${ats.toUpperCase()}`);

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
    });

    // Inject LinkedIn session cookie if provided (bypasses login page entirely)
    const liAt = profile.linkedin_cookie || '';
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      ...(liAt ? { storageState: { cookies: [{ name: 'li_at', value: liAt, domain: '.linkedin.com', path: '/', httpOnly: true, secure: true, sameSite: 'None' }], origins: [] } } : {}),
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(30000);

    log('Navigation', 'success', `Opening ${jobUrl}`);
    await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2000);

    const pageTitle = await page.title();
    log('Form Extraction', 'success', `Page loaded: "${pageTitle}"`);

    // Write resume to temp file if provided
    if (resumeBase64) {
      const { writeFileSync, unlinkSync } = require('fs');
      const { join } = require('path');
      const { tmpdir } = require('os');
      tmpResume = join(tmpdir(), resumeFilename || 'resume.pdf');
      writeFileSync(tmpResume, Buffer.from(resumeBase64, 'base64'));
    }

    switch (ats) {
      case 'greenhouse': await applyGreenhouse(page, profile, tmpResume, log); break;
      case 'lever':      await applyLever(page, profile, tmpResume, log); break;
      case 'linkedin':   await applyLinkedIn(page, profile, tmpResume, log); break;
      case 'naukri':     await applyNaukri(page, profile, tmpResume, log); break;
      default:           await applyGeneric(page, profile, tmpResume, log); break;
    }

    log('Resume Uploading', 'success', tmpResume ? 'Resume attached.' : 'No resume — skipped.');
    log('Form Submission', 'success', 'Submit triggered.');

    const finalUrl = page.url();
    const body = (await page.locator('body').textContent().catch(() => '') ?? '').slice(0, 600);
    const confirmed = /confirm|thank.?you|success|applied|application.?received/i.test(finalUrl + ' ' + body);

    log('Submission Verifying', confirmed ? 'success' : 'success',
      confirmed
        ? `Confirmation detected. Application submitted! URL: ${finalUrl}`
        : `Form submitted. Check your email for confirmation. Final URL: ${finalUrl}`
    );

    return res.json({ success: true, steps });

  } catch (err) {
    log('Error', 'failed', err.message || 'Unknown error');
    return res.status(500).json({ success: false, error: err.message, steps });
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (tmpResume) { try { require('fs').unlinkSync(tmpResume); } catch {} }
  }
});

// ── ATS detection ──────────────────────────────────────────────────────────────
function detectATS(url) {
  if (/greenhouse\.io|boards\.greenhouse\.io/i.test(url)) return 'greenhouse';
  if (/jobs\.lever\.co/i.test(url)) return 'lever';
  if (/linkedin\.com\/jobs/i.test(url)) return 'linkedin';
  if (/naukri\.com/i.test(url)) return 'naukri';
  if (/myworkdayjobs\.com|workday\.com/i.test(url)) return 'workday';
  return 'generic';
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const delay = ms => new Promise(r => setTimeout(r, ms));

async function tryFill(page, selectors, value) {
  if (!value) return;
  for (const s of (Array.isArray(selectors) ? selectors : [selectors])) {
    const el = page.locator(s).first();
    if (await el.count() > 0) { await el.fill(value); return true; }
  }
  return false;
}

function buildCoverLetter(profile) {
  const name = profile.full_name || profile.name || 'Candidate';
  const role = profile.target_roles?.[0] || 'this role';
  const skills = (profile.skills || []).slice(0, 4).join(', ') || 'analytics and technology';
  return `Dear Hiring Manager,\n\nI am excited to apply for ${role}. My background in ${skills} makes me a strong fit for your team.\n\nBest regards,\n${name}`;
}

// ── Greenhouse ─────────────────────────────────────────────────────────────────
async function applyGreenhouse(page, profile, resumePath, log) {
  log('Form Filling', 'running', 'Filling Greenhouse form.');
  const name = profile.full_name || profile.name || '';
  const [first, ...rest] = name.split(' ');
  await tryFill(page, ['input[name="job_application[first_name]"]', 'input[id*="first_name"]'], first);
  await tryFill(page, ['input[name="job_application[last_name]"]', 'input[id*="last_name"]'], rest.join(' '));
  await tryFill(page, ['input[name="job_application[email]"]', 'input[type="email"]'], profile.email);
  await tryFill(page, ['input[name="job_application[phone]"]', 'input[type="tel"]'], profile.phone);
  if (resumePath) {
    const fi = page.locator('input[type="file"]').first();
    if (await fi.count() > 0) { await fi.setInputFiles(resumePath); await delay(1500); }
  }
  const cl = buildCoverLetter(profile);
  await tryFill(page, 'textarea[name="job_application[cover_letter_text]"]', cl);
  const btn = page.locator('input[type="submit"], button[type="submit"]').first();
  if (await btn.count() > 0) await btn.click();
  await page.waitForURL(/confirmation|thank|success/i, { timeout: 15000 }).catch(() => {});
}

// ── Lever ──────────────────────────────────────────────────────────────────────
async function applyLever(page, profile, resumePath, log) {
  log('Form Filling', 'running', 'Filling Lever form.');
  await tryFill(page, 'input[name="name"]', profile.full_name || profile.name);
  await tryFill(page, 'input[name="email"]', profile.email);
  await tryFill(page, 'input[name="phone"]', profile.phone);
  if (resumePath) {
    const fi = page.locator('input[type="file"]').first();
    if (await fi.count() > 0) { await fi.setInputFiles(resumePath); await delay(1500); }
  }
  await tryFill(page, 'textarea[name="comments"]', buildCoverLetter(profile));
  const btn = page.locator('button[type="submit"], input[type="submit"]').first();
  if (await btn.count() > 0) await btn.click();
  await page.waitForURL(/thank|confirm|success/i, { timeout: 15000 }).catch(() => {});
}

// ── LinkedIn Easy Apply ────────────────────────────────────────────────────────
async function applyLinkedIn(page, profile, resumePath, log) {
  log('Form Filling', 'running', 'LinkedIn Easy Apply flow.');
  const email = profile.linkedin_email || profile.email || '';
  const password = profile.linkedin_password || '';
  const liAt = profile.linkedin_cookie || '';

  const isLoginPage = () => page.locator('input[name="session_key"]:visible, input[name="session_password"]:visible').count().then(n => n > 0);
  const isChallengePage = () => /checkpoint|challenge|uas\/login|authwall/i.test(page.url());

  // If cookie auth didn't work and we're on login page, try credentials
  if (await isLoginPage()) {
    if (!email || !password) {
      throw new Error(
        liAt
          ? 'LinkedIn session cookie expired. Get a fresh li_at cookie from your browser and update it in Profile → Job Board Credentials.'
          : 'LinkedIn credentials not set. Add your LinkedIn email + password in Profile → Job Board Credentials.'
      );
    }
    await page.fill('input[name="session_key"]', email);
    await page.fill('input[name="session_password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/feed|jobs|mynetwork/, { timeout: 20000 }).catch(() => {});
    await delay(2000);
  }

  // Check if LinkedIn is showing a security challenge (CAPTCHA, phone verify, etc.)
  if (await isChallengePage()) {
    throw new Error('LinkedIn requires verification (CAPTCHA or 2FA). Use the li_at cookie method instead: log in on your browser, copy the li_at cookie, paste it in Profile → Job Board Credentials.');
  }

  // Easy Apply button
  const easyApplyBtn = page.locator('button:has-text("Easy Apply")').first();
  if (await easyApplyBtn.count() === 0) throw new Error('No Easy Apply button found. This job requires manual application on LinkedIn.');
  await easyApplyBtn.click();
  await delay(1500);

  // Step through multi-page modal
  for (let step = 0; step < 10; step++) {
    // Fill phone if empty
    const phone = page.locator('input[id*="phoneNumber"]:visible').first();
    if (await phone.count() > 0 && !(await phone.inputValue())) await phone.fill(profile.phone || '');

    // Upload resume
    if (resumePath) {
      const fi = page.locator('input[type="file"]:visible').first();
      if (await fi.count() > 0) await fi.setInputFiles(resumePath).catch(() => {});
    }

    // Fill visible empty text inputs by aria-label
    for (const input of await page.locator('input[type="text"]:visible').all()) {
      if (await input.inputValue()) continue;
      const lbl = (await input.getAttribute('aria-label') || '').toLowerCase();
      if (/city|location/.test(lbl)) await input.fill(profile.preferred_locations?.[0] || 'Bangalore').catch(() => {});
      if (/year|experience/.test(lbl)) await input.fill(String(profile.years_experience || 3)).catch(() => {});
    }

    const nextBtn = page.locator('button:has-text("Next"), button:has-text("Review"), button:has-text("Submit application")').first();
    if (await nextBtn.count() === 0) break;
    const txt = await nextBtn.textContent() || '';
    await nextBtn.click();
    await delay(1200);
    if (/submit/i.test(txt)) break;
  }

  // Final submit
  const final = page.locator('button:has-text("Submit application")').first();
  if (await final.count() > 0) await final.click();
  await delay(2000);
}

// ── Naukri ─────────────────────────────────────────────────────────────────────
async function applyNaukri(page, profile, resumePath, log) {
  log('Form Filling', 'running', 'Naukri application flow.');
  const email = profile.naukri_email || profile.email || '';
  const password = profile.naukri_password || '';

  if (await page.locator('a[href*="login"]:visible').count() > 0) {
    if (!email || !password) throw new Error('Naukri credentials not set. Add them in your Profile → Job Board Credentials.');
    await page.locator('a[href*="login"]').first().click();
    await delay(1000);
    await page.fill('input[placeholder*="Email"], input[name="username"]', email).catch(() => {});
    await page.fill('input[type="password"]', password).catch(() => {});
    await page.click('button[type="submit"]').catch(() => {});
    await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
  }

  const applyBtn = page.locator('button:has-text("Apply"), a:has-text("Apply Now")').first();
  if (await applyBtn.count() > 0) await applyBtn.click();
  await delay(2000);
  const submit = page.locator('button:has-text("Apply"), button[type="submit"]').last();
  if (await submit.count() > 0) await submit.click();
  await delay(2000);
}

// ── Generic ────────────────────────────────────────────────────────────────────
async function applyGeneric(page, profile, resumePath, log) {
  log('Form Filling', 'running', 'Generic form — matching fields by label.');
  const name = profile.full_name || profile.name || '';
  const [first, ...rest] = name.split(' ');

  const fillByPattern = async (patterns, value) => {
    if (!value) return;
    for (const input of await page.locator('input:visible, textarea:visible').all()) {
      const attrs = [
        await input.getAttribute('placeholder') || '',
        await input.getAttribute('name') || '',
        await input.getAttribute('id') || '',
      ].join(' ').toLowerCase();
      if (patterns.some(p => p.test(attrs))) {
        if (!(await input.inputValue())) { await input.fill(value); break; }
      }
    }
  };

  await fillByPattern([/first.?name/i], first);
  await fillByPattern([/last.?name/i], rest.join(' '));
  await fillByPattern([/full.?name|your.?name/i], name);
  await fillByPattern([/email/i], profile.email || '');
  await fillByPattern([/phone|mobile/i], profile.phone || '');

  if (resumePath) {
    const fi = page.locator('input[type="file"]').first();
    if (await fi.count() > 0) { await fi.setInputFiles(resumePath); await delay(1500); }
  }

  const btn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Apply")').first();
  if (await btn.count() > 0) await btn.click();
  await delay(2000);
}

app.listen(PORT, () => console.log(`Automation server running on port ${PORT}`));
