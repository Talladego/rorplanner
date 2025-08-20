// Probe killboard search pages and attempt to extract career icon image URLs.
// Usage: node scripts/probe-career-icons.js "Talladeg" [maxPages]
// Defaults: query="Talladeg", maxPages=3

import fetch from 'node-fetch';

const BASE = 'https://killboard.returnofreckoning.com';

function absUrl(u) {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('//')) return 'https:' + u;
  if (u.startsWith('/')) return BASE + u;
  return u;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) rorplanner-bot',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.5',
      'referer': BASE + '/',
      'upgrade-insecure-requests': '1',
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

function mkStartCandidates(query) {
  const q = encodeURIComponent(query);
  return [
    `${BASE}/search/${q}`,
    `${BASE}/search/${q}/`,
    `${BASE}/search?search=${q}`,
    `${BASE}/search?q=${q}`,
    `${BASE}/characters/search?name=${q}`,
    `${BASE}/character/search?name=${q}`,
    `${BASE}/characters/search/${q}`,
    `${BASE}/character/search/${q}`,
    `${BASE}/characters/${q}`,
    `${BASE}/character/${q}`,
  ];
}

async function fetchFirstWorking(query) {
  const urls = mkStartCandidates(query);
  for (const u of urls) {
    try {
      console.error('Trying', u);
      const html = await fetchText(u);
      return { url: u, html };
    } catch {
      console.error('Failed', u);
      continue;
    }
  }
  throw new Error('No working search URL pattern found');
}

function extractNextLink(html) {
  // Look for anchors with rel="next" or inner text containing "Next"
  const relMatch = [...html.matchAll(/<a\s+[^>]*rel=["']next["'][^>]*href=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
  if (relMatch.length) return absUrl(relMatch[0]);
  const nextText = [...html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]*next[^<]*)<\/a>/gi)].map(m => m[1]);
  if (nextText.length) return absUrl(nextText[0]);
  return null;
}

// Known careers (pretty names) derived from the planner config; keep local to avoid ESM import.
const KNOWN_CAREERS = [
  'Archmage','Black Guard','Black Orc','Bright Wizard','Choppa','Chosen','Disciple Of Khaine','Engineer','Iron Breaker','Knight Of The Blazing Sun','Magus','Marauder','Rune Priest','Shadow Warrior','Shaman','Slayer','Sorcerer','Squig Herder','Sword Master','Warrior Priest','White Lion','Witch Elf','Witch Hunter','Zealot'
];
function canonCareerName(s) {
  return String(s || '').replace(/[_\s]+/g, ' ').trim().toLowerCase();
}
const CAREER_LOOKUP = new Map(KNOWN_CAREERS.map(n => [canonCareerName(n), n]));

function parseCareerImages(html) {
  const out = [];
  for (const m of html.matchAll(/<img\s+[^>]*src=["']([^"']+)["'][^>]*?(?:alt=["']([^"']+)["'][^>]*?)?[^>]*>/gi)) {
    const src = absUrl(m[1]);
    const alt = m[2] || '';
    const key = canonCareerName(alt);
    if (CAREER_LOOKUP.has(key)) {
      out.push({ career: CAREER_LOOKUP.get(key), src });
      continue;
    }
    // Fallback: try to infer career by filename tokens if alt missing
    try {
      const urlObj = new URL(src);
      const base = urlObj.pathname.split('/').pop() || '';
      const noExt = base.replace(/\.[a-z0-9]+$/i, '');
      const token = canonCareerName(noExt).replace(/-+/g, ' ');
      for (const [ckey, cname] of CAREER_LOOKUP.entries()) {
        // loose contains to catch e.g., witch-elf, bright-wizard
        if (token.includes(ckey.replace(/\s+/g, ''))) { out.push({ career: cname, src }); break; }
      }
    } catch {}
  }
  return out;
}

async function main() {
  const query = process.argv[2] || 'Talladeg';
  const maxPages = Math.max(1, parseInt(process.argv[3] || '3', 10));
  let first;
  try {
    first = await fetchFirstWorking(query);
  } catch (e) {
    console.error('probe-career-icons failed:', e.message || e);
    process.exit(1);
  }
  let url = first.url;
  const seen = new Set();
  const found = new Map(); // career -> src
  for (let i = 0; i < maxPages && url; i++) {
    const html = i === 0 ? first.html : await fetchText(url);
    const pairs = parseCareerImages(html);
    for (const { career, src } of pairs) {
      if (!career || !src) continue;
      if (!found.has(career)) found.set(career, src);
      seen.add(src);
    }
    url = extractNextLink(html);
  }
  console.log(JSON.stringify({ careersFound: found.size, imagesByCareer: Object.fromEntries(found), uniqueImageCount: seen.size }, null, 2));
}

main().catch(err => { console.error('probe-career-icons failed:', err.message || err); process.exit(1); });
