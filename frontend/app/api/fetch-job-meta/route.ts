import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

  // ── 1. Parse info directly from the URL (no fetch needed) ─────────────────
  const fromUrl = parseFromUrl(url);

  // ── 2. Try fetching the page for richer metadata ───────────────────────────
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });

    const html = res.ok ? await res.text() : '';

    // JSON-LD structured data (most reliable when present)
    const jsonLd = extractJsonLd(html);
    if (jsonLd.title || jsonLd.company) {
      return NextResponse.json({
        title:    jsonLd.title    || fromUrl.title,
        company:  jsonLd.company  || fromUrl.company,
        location: jsonLd.location || fromUrl.location,
      });
    }

    // og:title / <title> parsing
    const meta = makeMeta(html);
    const ogTitle  = meta('og:title');
    const ogDesc   = meta('og:description');
    const ogSite   = meta('og:site_name');
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || '';

    const parsed = parseFromHtml(url, ogTitle, ogDesc, ogSite, titleTag);

    return NextResponse.json({
      title:    parsed.title    || fromUrl.title,
      company:  parsed.company  || fromUrl.company,
      location: parsed.location || fromUrl.location,
    });

  } catch {
    // Network failed — return what we got from URL parsing
    return NextResponse.json(fromUrl);
  }
}

// ── Parse job info directly from the URL slug ─────────────────────────────────
// LinkedIn:   /jobs/view/senior-data-analyst-at-google-4026892851/
// Greenhouse: /boards.greenhouse.io/company/jobs/7654321
// Lever:      /jobs.lever.co/company/uuid
// Naukri:     /job-listings-senior-analyst-company-bengaluru-3-to-5-years-240624900002

function parseFromUrl(url: string): { title: string; company: string; location: string } {
  let title = '', company = '', location = '';

  try {
    const u = new URL(url);
    const path = u.pathname;

    // LinkedIn: /jobs/view/<slug>-<jobId>/
    if (/linkedin\.com/i.test(url)) {
      const m = path.match(/\/jobs\/view\/(.+?)(?:\/|$)/);
      if (m) {
        const slug = m[1].replace(/-\d{7,}$/, ''); // strip trailing job ID
        // slug = "senior-data-analyst-at-google" or just "4026892851"
        if (/at-/.test(slug)) {
          const atIdx = slug.lastIndexOf('-at-');
          if (atIdx > 0) {
            title   = toTitle(slug.slice(0, atIdx));
            company = toTitle(slug.slice(atIdx + 4));
          }
        } else if (!/^\d+$/.test(slug)) {
          title = toTitle(slug);
        }
      }
    }

    // Greenhouse: boards.greenhouse.io/{company}/jobs/{id}
    else if (/greenhouse\.io/i.test(url)) {
      const m = path.match(/^\/([^/]+)\/jobs\//);
      if (m) company = toTitle(m[1]);
    }

    // Lever: jobs.lever.co/{company}/{uuid}
    else if (/lever\.co/i.test(url)) {
      const m = path.match(/^\/([^/]+)\//);
      if (m && !m[1].match(/^[0-9a-f-]{36}$/)) company = toTitle(m[1]);
    }

    // Naukri: /job-listings-{title}-{company}-...
    else if (/naukri\.com/i.test(url)) {
      const m = path.match(/\/job-listings-(.+?)(?:-\d{10,})?(?:\.htm|\/|$)/);
      if (m) {
        const parts = m[1].split('-');
        // Naukri slugs: title words then company words — hard to split reliably
        // Best effort: take first 4 words as title
        title = toTitle(parts.slice(0, 4).join('-'));
      }
    }
  } catch {}

  return { title, company, location };
}

// ── Parse from HTML meta tags ─────────────────────────────────────────────────

function parseFromHtml(
  url: string,
  ogTitle: string, ogDesc: string, ogSite: string, titleTag: string,
): { title: string; company: string; location: string } {
  let title = '', company = '', location = '';
  const raw = ogTitle || titleTag;

  if (/linkedin\.com/i.test(url)) {
    // "Senior Data Analyst at Google | LinkedIn"
    const m = raw.match(/^(.+?)\s+at\s+(.+?)(?:\s*[\|–|-]|$)/i);
    if (m) { title = m[1].trim(); company = m[2].replace(/\s*\|.*$/, '').trim(); }
    else title = raw.replace(/\s*\|.*$/, '').trim();
    const locM = ogDesc.match(/·\s*([^·]+(?:India|Remote|Hybrid|USA|UK|Bangalore|Mumbai|Delhi|Hyderabad|Pune|Chennai))/i);
    if (locM) location = locM[1].trim();
  }
  else if (/naukri\.com/i.test(url)) {
    const pipe = raw.split('|')[0].trim();
    const parts = pipe.split(' - ');
    if (parts.length >= 2) {
      company = parts[parts.length - 1].trim();
      const rest = parts.slice(0, -1).join(' - ');
      const jobIn = rest.match(/^(.+?)\s+Jobs?\s+in\s+(.+)$/i);
      if (jobIn) { title = jobIn[1].trim(); location = jobIn[2].trim(); }
      else title = rest;
    } else title = pipe;
  }
  else if (/greenhouse\.io/i.test(url)) {
    const m = raw.match(/^(.+?)\s+at\s+(.+?)(?:\s*[\|–|-]|$)/i);
    if (m) { title = m[1].trim(); company = m[2].replace(/\s*\|.*$/, '').trim(); }
    else title = raw.replace(/\s*\|.*$/, '').trim();
  }
  else if (/lever\.co/i.test(url)) {
    const idx = raw.lastIndexOf(' - ');
    if (idx > 0) { title = raw.slice(0, idx).trim(); company = raw.slice(idx + 3).trim(); }
    else title = raw;
  }
  else {
    title = raw.replace(/\s*[\|–|-].*$/, '').trim();
    company = ogSite || '';
  }

  return { title, company, location };
}

// ── JSON-LD extractor ─────────────────────────────────────────────────────────

function extractJsonLd(html: string): { title: string; company: string; location: string } {
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const s of scripts) {
    try {
      const inner = s.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
      const data = JSON.parse(inner);
      const job = Array.isArray(data) ? data.find((d: any) => d['@type'] === 'JobPosting') : data;
      if (job?.['@type'] === 'JobPosting') {
        return {
          title:    job.title || '',
          company:  job.hiringOrganization?.name || '',
          location: job.jobLocation?.address?.addressLocality || job.jobLocation?.address?.addressRegion || '',
        };
      }
    } catch {}
  }
  return { title: '', company: '', location: '' };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMeta(html: string) {
  return (name: string): string => {
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, 'i'),
      new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'),
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m) return m[1].trim();
    }
    return '';
  };
}

function toTitle(slug: string): string {
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .trim();
}
