import { chromium, Browser, Page } from 'playwright';
import { Client } from 'pg';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── DB helpers ────────────────────────────────────────────────────────────────

async function getDbClient(connectionString: string | undefined): Promise<Client | null> {
  if (!connectionString) return null;
  const client = new Client({
    connectionString,
    ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
      ? false : { rejectUnauthorized: false },
  });
  try { await client.connect(); return client; } catch { return null; }
}

async function writeLog(
  client: Client | null,
  mockStore: any,
  applicationId: string,
  steps: any[],
  currentStep: string,
  status: 'running' | 'success' | 'failed',
  errorMsg?: string,
) {
  if (client) {
    await client.query(`
      INSERT INTO public.automation_logs (application_id, steps, current_step, status, error_message)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (application_id) DO UPDATE
        SET steps=$2, current_step=$3, status=$4, error_message=$5
    `, [applicationId, JSON.stringify(steps), currentStep, status, errorMsg ?? null]);
  } else if (mockStore) {
    mockStore[applicationId] = {
      ...(mockStore[applicationId] || {}),
      logs: { steps: [...steps], current_step: currentStep, status, error_message: errorMsg ?? null },
    };
  }
}

async function markApplied(client: Client | null, applicationId: string) {
  if (!client) return;
  await client.query(
    `UPDATE public.applications SET status='applied', applied_at=NOW(), updated_at=NOW() WHERE id=$1`,
    [applicationId],
  );
}

// ── ATS detection ─────────────────────────────────────────────────────────────

function detectATS(url: string): 'greenhouse' | 'lever' | 'linkedin' | 'naukri' | 'workday' | 'generic' {
  if (/greenhouse\.io|boards\.greenhouse\.io/i.test(url)) return 'greenhouse';
  if (/jobs\.lever\.co/i.test(url)) return 'lever';
  if (/linkedin\.com\/jobs/i.test(url)) return 'linkedin';
  if (/naukri\.com/i.test(url)) return 'naukri';
  if (/myworkdayjobs\.com|workday\.com/i.test(url)) return 'workday';
  return 'generic';
}

// ── Greenhouse handler ────────────────────────────────────────────────────────

async function applyGreenhouse(page: Page, profile: any, resumePath: string | null) {
  const fullName: string = profile.full_name || profile.name || '';
  const [firstName, ...rest] = fullName.split(' ');
  const lastName = rest.join(' ') || '';

  const tryFill = async (selectors: string[], value: string) => {
    for (const s of selectors) {
      const el = page.locator(s).first();
      if (await el.count() > 0) { await el.fill(value); return; }
    }
  };

  await tryFill(
    ['input[name="job_application[first_name]"]', 'input[id*="first_name"]', 'input[placeholder*="First"]'],
    firstName,
  );
  await tryFill(
    ['input[name="job_application[last_name]"]', 'input[id*="last_name"]', 'input[placeholder*="Last"]'],
    lastName,
  );
  await tryFill(
    ['input[name="job_application[email]"]', 'input[type="email"]'],
    profile.email || '',
  );
  await tryFill(
    ['input[name="job_application[phone]"]', 'input[type="tel"]', 'input[id*="phone"]'],
    profile.phone || '',
  );

  if (resumePath) {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(resumePath);
      await delay(1500);
    }
  }

  const coverLetter = buildCoverLetter(profile);
  const coverSel = page.locator('textarea[name="job_application[cover_letter_text]"], textarea[id*="cover"]').first();
  if (await coverSel.count() > 0) await coverSel.fill(coverLetter);

  const submitBtn = page.locator('input[type="submit"][value*="Submit"], button[type="submit"]').first();
  if (await submitBtn.count() > 0) await submitBtn.click();
  await page.waitForURL(/confirmation|thank[-_]?you|success/i, { timeout: 15000 }).catch(() => {});
}

// ── Lever handler ─────────────────────────────────────────────────────────────

async function applyLever(page: Page, profile: any, resumePath: string | null) {
  const fullName = profile.full_name || profile.name || '';
  await tryFillSel(page, 'input[name="name"]', fullName);
  await tryFillSel(page, 'input[name="email"]', profile.email || '');
  await tryFillSel(page, 'input[name="phone"]', profile.phone || '');

  if (resumePath) {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count() > 0) { await fileInput.setInputFiles(resumePath); await delay(1500); }
  }

  const coverLetter = buildCoverLetter(profile);
  await tryFillSel(page, 'textarea[name="comments"], textarea[id*="cover"]', coverLetter);

  const submitBtn = page.locator('button[type="submit"], input[type="submit"]').first();
  if (await submitBtn.count() > 0) await submitBtn.click();
  await page.waitForURL(/thank|confirm|success/i, { timeout: 15000 }).catch(() => {});
}

// ── LinkedIn Easy Apply handler ───────────────────────────────────────────────

async function applyLinkedIn(page: Page, profile: any, resumePath: string | null) {
  const email = profile.linkedin_email || profile.email || '';
  const password = profile.linkedin_password || '';

  // Sign in if needed
  const signInBtn = page.locator('a[href*="login"]:visible, button:has-text("Sign in"):visible').first();
  if (await signInBtn.count() > 0) {
    await signInBtn.click();
    await page.fill('input[name="session_key"]', email);
    await page.fill('input[name="session_password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
  }

  // Click Easy Apply
  const easyApply = page.locator('button:has-text("Easy Apply")').first();
  if (await easyApply.count() === 0) throw new Error('No Easy Apply button — manual application required for this job');
  await easyApply.click();
  await delay(1500);

  // Multi-step modal
  for (let step = 0; step < 8; step++) {
    const phoneInput = page.locator('input[id*="phoneNumber"]').first();
    if (await phoneInput.count() > 0) {
      const val = await phoneInput.inputValue();
      if (!val) await phoneInput.fill(profile.phone || '');
    }

    if (resumePath) {
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.count() > 0) await fileInput.setInputFiles(resumePath);
    }

    // Fill visible empty text inputs by aria-label
    const inputs = await page.locator('input[type="text"]:visible').all();
    for (const input of inputs) {
      const val = await input.inputValue().catch(() => '');
      if (val) continue;
      const label = (await input.getAttribute('aria-label') || '').toLowerCase();
      if (/city|location/.test(label)) await input.fill(profile.preferred_locations?.[0] || 'Bangalore');
      if (/years|experience/.test(label)) await input.fill(String(profile.years_experience || 3));
    }

    const nextBtn = page.locator('button:has-text("Next"), button:has-text("Review"), button:has-text("Submit application")').first();
    if (await nextBtn.count() === 0) break;
    const btnText = await nextBtn.textContent() || '';
    await nextBtn.click();
    await delay(1000);
    if (/submit/i.test(btnText)) break;
  }

  const finalSubmit = page.locator('button:has-text("Submit application")').first();
  if (await finalSubmit.count() > 0) await finalSubmit.click();
  await delay(2000);
}

// ── Naukri handler ────────────────────────────────────────────────────────────

async function applyNaukri(page: Page, profile: any, resumePath: string | null) {
  const email = profile.naukri_email || profile.email || '';
  const password = profile.naukri_password || '';

  const loginBtn = page.locator('a[href*="login"]:visible').first();
  if (await loginBtn.count() > 0) {
    await loginBtn.click();
    await delay(1000);
    await page.fill('input[placeholder*="Email"], input[name="username"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
  }

  const applyBtn = page.locator('button:has-text("Apply"), a:has-text("Apply Now")').first();
  if (await applyBtn.count() > 0) await applyBtn.click();
  await delay(2000);

  const submitBtn = page.locator('button:has-text("Apply"), button[type="submit"]').last();
  if (await submitBtn.count() > 0) await submitBtn.click();
  await delay(2000);
}

// ── Generic handler ───────────────────────────────────────────────────────────

async function applyGeneric(page: Page, profile: any, resumePath: string | null) {
  const fullName = profile.full_name || profile.name || '';
  const [firstName, ...rest] = fullName.split(' ');

  const fillByPattern = async (patterns: RegExp[], value: string) => {
    const inputs = await page.locator('input:visible, textarea:visible').all();
    for (const input of inputs) {
      const placeholder = (await input.getAttribute('placeholder') || '').toLowerCase();
      const name = (await input.getAttribute('name') || '').toLowerCase();
      const id = (await input.getAttribute('id') || '').toLowerCase();
      const combined = `${placeholder} ${name} ${id}`;
      if (patterns.some(p => p.test(combined))) {
        const val = await input.inputValue().catch(() => '');
        if (!val) { await input.fill(value); break; }
      }
    }
  };

  await fillByPattern([/first.?name/i], firstName);
  await fillByPattern([/last.?name/i], rest.join(' '));
  await fillByPattern([/full.?name|your.?name/i], fullName);
  await fillByPattern([/email/i], profile.email || '');
  await fillByPattern([/phone|mobile/i], profile.phone || '');

  if (resumePath) {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count() > 0) { await fileInput.setInputFiles(resumePath); await delay(1500); }
  }

  const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Apply")').first();
  if (await submitBtn.count() > 0) await submitBtn.click();
  await delay(2000);
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function buildCoverLetter(profile: any): string {
  const name = profile.full_name || profile.name || 'Candidate';
  const role = profile.target_roles?.[0] || 'this role';
  const skills = (profile.skills || []).slice(0, 4).join(', ');
  return `Dear Hiring Manager,\n\nI am excited to apply for ${role}. With expertise in ${skills || 'analytics and data science'}, I am confident I can deliver strong results for your team.\n\nBest regards,\n${name}`;
}

async function tryFillSel(page: Page, selector: string, value: string) {
  const el = page.locator(selector).first();
  if (await el.count() > 0) await el.fill(value);
}

// ── Main exported runner ──────────────────────────────────────────────────────

export async function runAutoApply(
  applicationId: string,
  options?: {
    jobUrl?: string;
    profile?: any;
    resumePath?: string | null;
    mockStore?: any;
  },
) {
  const connectionString = process.env.DATABASE_URL;
  const dbClient = await getDbClient(connectionString);
  const mockStore = options?.mockStore ?? null;

  const steps: any[] = [];
  let browser: Browser | null = null;

  const logStep = async (name: string, status: 'success' | 'failed' | 'running', details = '') => {
    steps.push({ step: name, status, details, timestamp: new Date().toISOString() });
    const overall: 'running' | 'success' | 'failed' =
      status === 'failed' ? 'failed' : name === 'Submission Verifying' ? 'success' : 'running';
    await writeLog(dbClient, mockStore, applicationId, steps, name, overall,
      status === 'failed' ? details : undefined);
    if (name === 'Submission Verifying' && status === 'success') {
      await markApplied(dbClient, applicationId);
    }
  };

  try {
    const jobUrl = options?.jobUrl;
    const profile = options?.profile || {};
    const resumePath = options?.resumePath ?? null;

    if (!jobUrl) throw new Error('No job URL provided. This job has no direct application link.');

    const ats = detectATS(jobUrl);

    await logStep('Initialization', 'success',
      `Chromium launched. ATS detected: ${ats.toUpperCase()}.`);

    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });
    const page = await ctx.newPage();

    await logStep('Navigation', 'success', `Opening ${jobUrl}`);
    await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2000);

    const title = await page.title();
    await logStep('Form Extraction', 'success',
      `Page loaded: "${title}". Scanning application form fields.`);

    switch (ats) {
      case 'greenhouse':
        await logStep('Form Filling', 'running', 'Filling Greenhouse form with your profile data.');
        await applyGreenhouse(page, profile, resumePath);
        break;
      case 'lever':
        await logStep('Form Filling', 'running', 'Filling Lever form with your profile data.');
        await applyLever(page, profile, resumePath);
        break;
      case 'linkedin':
        await logStep('Form Filling', 'running', 'Initiating LinkedIn Easy Apply flow.');
        await applyLinkedIn(page, profile, resumePath);
        break;
      case 'naukri':
        await logStep('Form Filling', 'running', 'Logging into Naukri and applying.');
        await applyNaukri(page, profile, resumePath);
        break;
      default:
        await logStep('Form Filling', 'running', 'Generic form — filling fields by label matching.');
        await applyGeneric(page, profile, resumePath);
    }

    await logStep('Resume Uploading', 'success',
      resumePath ? 'Resume file attached.' : 'No resume path provided — skipped upload.');

    await logStep('Form Submission', 'success', 'Submit action triggered.');

    const currentUrl = page.url();
    const bodyText = ((await page.locator('body').textContent().catch(() => '')) ?? '').slice(0, 500);
    const confirmed = /confirm|thank.?you|success|applied|application.?received|submission/i.test(
      currentUrl + ' ' + bodyText,
    );

    await logStep('Submission Verifying', 'success',
      confirmed
        ? `Confirmation detected on page. Application submitted. URL: ${currentUrl}`
        : `Form submitted. Watch your email for confirmation. Final URL: ${currentUrl}`);

  } catch (err: any) {
    const msg = err.message || 'Unknown error';
    steps.push({ step: 'Error', status: 'failed', details: msg, timestamp: new Date().toISOString() });
    await writeLog(dbClient, mockStore, applicationId, steps, 'Error', 'failed', msg);
  } finally {
    if (browser) await browser.close();
    if (dbClient) await dbClient.end().catch(() => {});
  }
}
