import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const meta = (name: string): string => {
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

    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || '';
    const ogTitle = meta('og:title');
    const ogDesc  = meta('og:description');
    const ogSite  = meta('og:site_name');

    let title = '';
    let company = '';
    let location = '';

    // LinkedIn: og:title = "Job Title at Company | LinkedIn"
    if (/linkedin\.com/i.test(url)) {
      const raw = ogTitle || titleTag;
      const atMatch = raw.match(/^(.+?)\s+at\s+(.+?)(?:\s*[\|–-]|$)/i);
      if (atMatch) { title = atMatch[1].trim(); company = atMatch[2].replace(/\s*\|.*$/, '').trim(); }
      else { title = raw.replace(/\s*\|.*$/, '').trim(); }
      // Location often in description: "X · Location · Job type"
      const locMatch = ogDesc.match(/·\s*([A-Za-z\s,]+(?:India|Remote|Hybrid|USA|UK))/i);
      if (locMatch) location = locMatch[1].trim();
    }
    // Naukri: og:title = "Job Title Job in Location - Company | Naukri.com"
    else if (/naukri\.com/i.test(url)) {
      const raw = ogTitle || titleTag;
      const pipe = raw.split('|')[0].trim();
      const dashParts = pipe.split(' - ');
      if (dashParts.length >= 2) {
        company = dashParts[dashParts.length - 1].trim();
        const rest = dashParts.slice(0, -1).join(' - ');
        const jobIn = rest.match(/^(.+?)\s+Jobs?\s+in\s+(.+)$/i);
        if (jobIn) { title = jobIn[1].trim(); location = jobIn[2].trim(); }
        else title = rest.trim();
      } else title = pipe;
    }
    // Greenhouse: og:title usually "Job Title at Company"
    else if (/greenhouse\.io/i.test(url)) {
      const raw = ogTitle || titleTag;
      const atMatch = raw.match(/^(.+?)\s+at\s+(.+?)(?:\s*[\|–-]|$)/i);
      if (atMatch) { title = atMatch[1].trim(); company = atMatch[2].replace(/\s*\|.*$/, '').trim(); }
      else title = raw.replace(/\s*\|.*$/, '').trim();
    }
    // Lever: og:title = "Job Title - Company"
    else if (/lever\.co/i.test(url)) {
      const raw = ogTitle || titleTag;
      const dashIdx = raw.lastIndexOf(' - ');
      if (dashIdx > 0) { title = raw.slice(0, dashIdx).trim(); company = raw.slice(dashIdx + 3).trim(); }
      else title = raw;
    }
    // Generic fallback
    else {
      title = ogTitle || titleTag.replace(/\s*[\|–-].*$/, '').trim();
      company = ogSite || '';
    }

    return NextResponse.json({ title, company, location });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch' }, { status: 500 });
  }
}
