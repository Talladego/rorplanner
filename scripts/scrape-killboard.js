import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

// Timing helpers for progress logging
const START_TS = Date.now();
const sinceStartSec = () => ((Date.now() - START_TS) / 1000).toFixed(1);
let LOG_FILE = '';
async function writeLogFile(line) {
  if (!LOG_FILE) return;
  try {
    await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
    await fs.appendFile(LOG_FILE, line + '\n', 'utf8');
  } catch {}
}
const logp = async (...args) => {
  const msg = `[+${sinceStartSec()}s] ${args.map(a => String(a)).join(' ')}`;
  console.log(msg);
  await writeLogFile(msg);
};

async function saveDebugHtml(page, id) {
  try {
    const html = await page.content();
    const fp = path.resolve(process.cwd(), 'public', 'debug', `item_${id}.html`);
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, html, 'utf8');
    await logp(`Saved debug HTML for ${id} -> ${path.relative(process.cwd(), fp)}`);
  } catch {}
}

// Allowed slots per spec
const ALLOWED_SLOTS = new Set([
  'Event Item', 'Helm', 'Shoulder', 'Back', 'Body', 'Gloves', 'Belt', 'Boots',
  'Main Hand', 'Weapon', 'Ranged Weapon', 'Off Hand', 'Jewellery', 'Pocket Item'
]);

// Map friendly/varied type inputs to canonical list filter tokens
function normalizeRequestedType(input) {
  const v = (input || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (!v || v === 'all') return 'all';
  if (/(^|\b)robe(s)?($|\b)/.test(v)) return 'robe';
  if (/(^|\b)(light|light armor|leather)($|\b)/.test(v)) return 'light armor';
  if (/(^|\b)(medium|medium armor|chain)($|\b)/.test(v)) return 'medium armor';
  if (/(^|\b)(heavy|heavy armor|plate)($|\b)/.test(v)) return 'heavy armor';
  if (/(^|\b)(accessory|accessories)($|\b)/.test(v)) return 'accessory';
  if (/(^|\b)(weapon|weapons)($|\b)/.test(v)) return 'weapon';
  return v;
}

// Normalize various career inputs (case/spacing/aliases) to Killboard's expected tokens
function canonicalizeCareer(input) {
  const raw = (input || '').trim();
  if (!raw) return '';
  const key = raw.toUpperCase().replace(/[^A-Z]/g, ''); // letters only for matching
  const map = {
    ARCHMAGE: 'ARCHMAGE',
    SHAMAN: 'SHAMAN',
    WHITELION: 'WHITE_LION',
    SWORDMASTER: 'SWORDMASTER',
    IRONBREAKER: 'IRONBREAKER',
    BRIGHTWIZARD: 'BRIGHT_WIZARD',
    RUNEPRIEST: 'RUNE_PRIEST',
    WARRIORPRIEST: 'WARRIOR_PRIEST',
    KNIGHTOFTHEBLAZINGSUN: 'KNIGHT_OF_THE_BLAZING_SUN',
    WITCHHUNTER: 'WITCH_HUNTER',
    ENGINEER: 'ENGINEER',
    SHADOWWARRIOR: 'SHADOW_WARRIOR',
    SORCERER: 'SORCERER',
    WITCHELF: 'WITCH_ELF',
    ZEALOT: 'ZEALOT',
    DISCIPLEOFKHAINE: 'DISCIPLE_OF_KHAINE',
    CHOSEN: 'CHOSEN',
    MARAUDER: 'MARAUDER',
    MAGUS: 'MAGUS',
    CHOPPA: 'CHOPPA',
    BLACKORC: 'BLACK_ORC',
    SQUIGHERDER: 'SQUIG_HERDER',
    BLACKGUARD: 'BLACKGUARD',
    SLAYER: 'SLAYER'
  };
  if (map[key]) return map[key];
  // Fallback: uppercase words joined with underscore
  return raw.trim().toUpperCase().replace(/\s+/g, '_');
}

// Convert our normalized type to Killboard's expected query token (uppercase, underscores)
function canonicalizeTypeParam(input) {
  const v = (input || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  // Special-case: Killboard expects lower-case 'all' (UPPERCASE fails)
  if (!v || v === 'all') return 'all';
  if (v === 'robe') return 'ROBE';
  if (v === 'light armor') return 'LIGHT_ARMOR';
  if (v === 'medium armor') return 'MEDIUM_ARMOR';
  if (v === 'heavy armor') return 'HEAVY_ARMOR';
  if (v === 'accessory' || v === 'accessories') return 'ACCESSORY';
  if (v === 'weapon' || v === 'weapons') return 'WEAPON';
  // Fallback: uppercase and replace spaces with underscores
  return v.toUpperCase().replace(/\s+/g, '_');
}

function parseArgs() {
  const args = {
    id: '',           // single item id
    query: '',        // name query
    type: '',         // list type
    career: '',       // career filter
    outFile: 'public/data/kb_items.json',
    limit: 0,         // limit number of items from listing to fetch
    delayMs: 300,
    headful: false,
    debug: false,
  concurrency: 1,   // parallel worker processes for detail scraping (list mode)
  fastList: false,   // start spawning workers after first batch; lighter waits/scrolls
  logFile: '',
  pageConcurrency: 0,
  maxPages: 0,
  pool: false,
  detailTimeoutMs: 40000,
  detailRetries: 1,
  blockExtraneous: true
  };
  for (let i = 2; i < (process.argv.length || 2); i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const [k, vRaw] = a.slice(2).split('=');
    const v = vRaw === undefined ? '' : vRaw;
    if (k === 'id') args.id = v;
    if (k === 'query') args.query = v;
    if (k === 'type') args.type = v;
    if (k === 'career') args.career = v;
    if (k === 'outFile') args.outFile = v;
    if (k === 'limit') args.limit = Number(v) || 0;
    if (k === 'delayMs') args.delayMs = Number(v) || args.delayMs;
    if (k === 'headful') args.headful = v === 'true' || v === '';
    if (k === 'debug') args.debug = v === 'true' || v === '';
  if (k === 'concurrency') args.concurrency = Math.max(1, Math.min(15, Number(v) || 1));
  if (k === 'fastList') args.fastList = v === 'true' || v === '';
  if (k === 'logFile') args.logFile = v;
  if (k === 'pageConcurrency') args.pageConcurrency = Number(v) || 0;
  if (k === 'maxPages') args.maxPages = Number(v) || 0;
  if (k === 'pool') args.pool = v === 'true' || v === '';
  if (k === 'detailTimeoutMs') args.detailTimeoutMs = Math.max(5000, Number(v) || args.detailTimeoutMs);
  if (k === 'detailRetries') args.detailRetries = Math.max(0, Number(v) || args.detailRetries);
  if (k === 'blockExtraneous') args.blockExtraneous = v === 'true' || v === '';
  if (k === 'reversePages') args.reversePages = v === 'true' || v === '';
  }
  return args;
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function autoScroll(page, steps = 6) {
  for (let i = 0; i < steps; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await delay(400);
  }
}

async function clickLoadMoreIfPresent(page, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      const cand = btns.find((b) => /load more|show more/i.test(b.textContent || ''));
      if (cand && cand.offsetParent !== null && !cand.disabled) { cand.click(); return true; }
      return false;
    });
    if (!clicked) break;
    await delay(800);
  }
}

async function clickNextIfPresent(page) {
  return await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a, button'));
    const next = links.find((el) => {
      const t = (el.textContent || '').trim().toLowerCase();
      const rel = (el.getAttribute('rel') || '').toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      return rel === 'next' || aria.includes('next') || t === 'next' || t.includes('next ›') || t.includes('next');
    });
    if (next && next.offsetParent !== null && !next.disabled) { next.click(); return true; }
    return false;
  });
}

// Build a quick signature string of the visible item IDs to detect list changes
async function getListSignature(page) {
  try {
    return await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('a[href*="/item/"]'))
        .map(a => {
          const href = a.getAttribute('href') || '';
          const m = href.match(/item\/(\d+)/);
          return m ? m[1] : '';
        })
        .filter(Boolean);
      // Use first and last few IDs for a compact signature
      const head = ids.slice(0, 5).join(',');
      const tail = ids.slice(-5).join(',');
      return `${head}|${tail}|len=${ids.length}`;
    });
  } catch { return ''; }
}

// After clicking Next in a SPA, wait for the items list to change (no navigation occurs)
async function waitForListChange(page, prevSig, timeout = 30000) {
  try {
    await page.waitForFunction((sig) => {
      const ids = Array.from(document.querySelectorAll('a[href*="/item/"]'))
        .map(a => {
          const href = a.getAttribute('href') || '';
          const m = href.match(/item\/(\d+)/);
          return m ? m[1] : '';
        })
        .filter(Boolean);
      const head = ids.slice(0, 5).join(',');
      const tail = ids.slice(-5).join(',');
      const cur = `${head}|${tail}|len=${ids.length}`;
      return cur && cur !== sig;
    }, { timeout }, prevSig).catch(() => {});
  } catch {}
}

async function collectAllPageUrls(page) {
  // Gather all pagination hrefs for the current listing query
  return await page.evaluate(() => {
    const toAbs = (u) => {
      try { const a = document.createElement('a'); a.href = u; return a.href; } catch { return u; }
    };
    const cur = window.location.href;
    const base = cur.replace(/([&?])page=\d+/i, '')
                    .replace(/[#?]$/, '');
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    const urls = new Set();
    for (const a of anchors) {
      const href = a.getAttribute('href') || '';
      if (!/\/items\?/i.test(href)) continue;
      if (!/[&?]page=\d+/i.test(href)) continue;
      const abs = toAbs(href);
      // Only keep same query (ignoring page=)
      const norm = abs.replace(/([&?])page=\d+/i, '');
      if (norm.startsWith(base)) urls.add(abs);
    }
    // Ensure current page is included
    urls.add(cur);
    // Return as array, unique
    return Array.from(urls);
  });
}

async function getPageUrlsBounded(page, maxPages = 0) {
  const urls = await collectAllPageUrls(page);
  if (!Array.isArray(urls) || urls.length === 0) return [];
  // Ensure current page is first
  const cur = page.url();
  const unique = [cur, ...urls.filter((u) => u !== cur)];
  if (maxPages > 0) return unique.slice(0, maxPages);
  return unique;
}

async function scrapeListingPagesParallel(browser, baseWaitUntil, urls, { fastList = false } = {}) {
  const pages = [];
  try {
    const waitUntil = fastList ? 'domcontentloaded' : baseWaitUntil;
    for (let i = 0; i < urls.length; i++) {
      const p = await browser.newPage();
      pages.push(p);
      await p.goto(urls[i], { waitUntil, timeout: 180_000 });
      await p.waitForSelector('a[href*="/item/"]', { timeout: 90_000 }).catch(() => {});
    }
    // Extract on all pages
    const allBatches = [];
    for (const p of pages) {
      if (!fastList) { await autoScroll(p, 2); await clickLoadMoreIfPresent(p, 1); }
      const batch = await extractListFromPage(p);
      allBatches.push(batch);
    }
    return allBatches.flat();
  } finally {
    for (const p of pages) { try { await p.close(); } catch {} }
  }
}

function normalizeSlot(raw) {
  const v = (raw || '').trim().toLowerCase();
  if (!v) return '';
  if (['head','helm','helmet'].includes(v)) return 'Helm';
  if (['shoulder','shoulders'].includes(v)) return 'Shoulder';
  if (['back','cloak'].includes(v)) return 'Back';
  if (['body','chest','robe','armor','armour'].includes(v)) return 'Body';
  if (['hands','gloves'].includes(v)) return 'Gloves';
  if (['waist','belt'].includes(v)) return 'Belt';
  if (['feet','boots'].includes(v)) return 'Boots';
  if (['right hand','main hand','mainhand'].includes(v)) return 'Main Hand';
  if (['left hand','off hand','offhand'].includes(v)) return 'Off Hand';
  if (['ranged','ranged weapon'].includes(v)) return 'Ranged Weapon';
  // Normalize generic weapon/2H to Main Hand to align with UI pickers
  if (['weapon','great weapon','two hand','two-handed','two handed','2h'].includes(v)) return 'Main Hand';
  if (['accessory','jewelry','jewelery','jewellery'].includes(v)) return 'Jewellery';
  if (['event','pocket','event item','pocket item'].includes(v)) return 'Pocket Item';
  const cap = raw.charAt(0).toUpperCase() + raw.slice(1);
  return cap;
}

async function extractListFromPage(page) {
  // Only collect unique item IDs and hrefs; we derive all data from detail pages
  return await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href*="/item/"]'));
    const itemsMap = new Map();
    for (const link of anchors) {
      const href = link.getAttribute('href') || '';
      const id = href.match(/item\/(\d+)/)?.[1];
      if (!id || itemsMap.has(id)) continue;
      itemsMap.set(id, { id, href });
    }
    return Array.from(itemsMap.values());
  });
}

async function extractDetailsFromItem(page) {
  return await page.evaluate(() => {
    const getText = (sel) => {
      const el = document.querySelector(sel);
      return el ? (el.textContent || '').trim() : '';
    };
    const container = document.querySelector('.item, .item-details, main, body') || document.body;
    const text = (container.innerText || '').split('\n').map((s) => s.trim()).filter(Boolean);
    // Prefer actual item name element rendered by the SPA
    const title = getText('.item-name-item-set, .item-name, h1, .item-title, .title, h2') || (document.title || '').trim();
    // Slot and Type
    const slot = text.find((t) => /^(Head|Helm|Shoulder|Shoulders|Back|Cloak|Chest|Body|Robe|Hands|Gloves|Waist|Belt|Feet|Boots|Ranged|Ranged Weapon|Right Hand|Main Hand|Left Hand|Off Hand|Accessory|Jewelry|Jewelery|Jewellery|Event Item|Pocket Item)$/i.test(t)) || '';
    const type = text.find((t) => /^(Robe|Light Armor|Medium Armor|Heavy Armor|Leather|Chain|Plate|Weapon|Accessory)$/i.test(t)) || '';
    // Icon helpers
    function pickIconUrl() {
      const imgs = Array.from(container.querySelectorAll('img'));
      for (const img of imgs) {
        const src = img.getAttribute('src') || '';
        if (/armory\.returnofreckoning\.com|\/icon\/|\/item\//i.test(src)) return src;
      }
      const metas = Array.from(document.querySelectorAll('meta[property], meta[name]'));
      for (const meta of metas) {
        const key = (meta.getAttribute('property') || meta.getAttribute('name') || '').toLowerCase();
        if (key.includes('image')) {
          const content = meta.getAttribute('content') || '';
          if (/armory\.returnofreckoning\.com|\/icon\/|\/item\//i.test(content)) return content;
        }
      }
      return '';
    }
    const iconUrl = pickIconUrl();
    let iconId = '';
    if (iconUrl) {
      const m = iconUrl.match(/\/(icon|item)\/(\d+)/i) || iconUrl.match(/[?&]icon=(\d+)/i);
      if (m) iconId = m[2] || m[1] || '';
    }
    // Simple extras
    const itemLevel = (text.find((t) => /^Item Level\s*:?/i.test(t)) || '').replace(/.*?:\s*/, '');
    const renownRank = (text.find((t) => /Requires\s+\d+\s+Renown/i.test(t)) || '').replace(/.*Requires\s+/i, '').replace(/\s*Renown.*/i, '').trim();
    // Stats lines
    const stats = [];
    const pct = /^\+\s*(\d+(?:\.\d+)?)\s*%\s*(.+)$/i;
    const flat = /^\+\s*(\d+)\s+(.+)$/i;
    for (const line of text) {
      let m = line.match(pct);
      if (m) { stats.push({ value: Number(m[1]), stat: m[2].trim(), unit: '%' }); continue; }
      m = line.match(flat);
      if (m) { stats.push({ value: Number(m[1]), stat: m[2].trim() }); }
    }
    const setBonuses = [];
    const bonusRe = /^\((\d+)\s*piece\s*bonus\)\s*:\s*(.+)$/i;
    for (const line of text) { const m = line.match(bonusRe); if (m) setBonuses.push({ pieces: Number(m[1]), bonus: m[2].trim() }); }
    let setName = '';
    if (setBonuses.length) {
      const firstIdx = text.findIndex((t) => bonusRe.test(t));
      for (let i = firstIdx - 1; i >= 0; i--) {
        const t = text[i];
        if (!t || /^\+/.test(t) || /^\(/.test(t) || /^item level/i.test(t)) continue;
        setName = t;
        break;
      }
    }
    return { title, slot, type, iconId, itemLevel, renownRank, stats, set: { name: setName, bonuses: setBonuses } };
  });
}

async function enableRequestBlocking(page) {
  try {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      const url = req.url();
      // Allow document, script, xhr/fetch; block fonts, images (except item/icon), media, stylesheets from 3rd parties
      if (type === 'document' || type === 'script' || type === 'xhr' || type === 'fetch') return req.continue();
      if (type === 'image') {
        if (/armory\.returnofreckoning\.com\/(icon|item)\//i.test(url)) return req.continue();
        return req.abort();
      }
      // Do NOT block stylesheets on detail pages; allowing CSS can help sites that gate visibility
      if (type === 'font' || type === 'media') return req.abort();
      // Be conservative with 'other' types (can include modulepreload/manifest); allow
      return req.continue();
    });
  } catch {}
}

async function runDetailInPage(page, href, { timeoutMs = 40000 } = {}) {
  await page.goto(href, { waitUntil: 'domcontentloaded', timeout: timeoutMs }).catch(() => {});
  await page.waitForSelector('.item, .item-name-item-set, h1, main, body', { timeout: Math.min(15000, timeoutMs) }).catch(() => {});
  // Hydration settle + readiness wait
  await page.evaluate(async () => {
    const container = document.querySelector('.item, .item-details, #root, main, body') || document.body;
    let stable = 0, last = 0;
    for (let i = 0; i < 40; i++) {
      const len = (container.innerText || '').length;
      if (len !== last) { stable = 0; last = len; await new Promise((r) => setTimeout(r, 200)); } else { stable++; if (stable >= 3) break; await new Promise((r) => setTimeout(r, 150)); }
    }
  }).catch(() => {});
  // Wait for clear signal that the SPA finished rendering the item
  await page.waitForFunction(() => {
    const t = document.title || '';
    const container = document.querySelector('.item, .item-details, main, body') || document.body;
    const txt = (container.innerText || '');
    const hasName = !!document.querySelector('.item-name-item-set, .item-name');
    const hasMeta = /(Item Level|Requires\s+\d+\s+Renown|\(\d+\s*piece\s*bonus\))/i.test(txt);
    return (t && t !== 'Kill Board') && (hasName || hasMeta);
  }, { timeout: Math.min(20000, timeoutMs) }).catch(() => {});
  const details = await extractDetailsFromItem(page).catch(() => ({}) );
  return details || {};
}

async function fetchDetailWithPool(browser, it, args) {
  const href = it.href?.startsWith('http') ? it.href : `https://killboard.returnofreckoning.com${it.href}`;
  const page = await browser.newPage();
  try {
    if (args.blockExtraneous) await enableRequestBlocking(page);
    let attempt = 0;
    let details = {};
    while (attempt <= args.detailRetries) {
      attempt++;
      try {
        details = await runDetailInPage(page, href, { timeoutMs: args.detailTimeoutMs });
        const weak = !details?.title || details.title === 'Kill Board' || (!details.slot && !details.type);
        if (!weak) break;
        await logp(`Weak details detected for ${it.id} (attempt ${attempt}); retrying...`);
        // On retry, disable interception and reload more thoroughly
        try {
          await page.setRequestInterception(false);
        } catch {}
        // Re-navigate to ensure SPA route re-mounts fully
        try {
          await page.goto(href, { waitUntil: 'networkidle2', timeout: args.detailTimeoutMs });
        } catch {}
        await page.waitForSelector('.item, .item-name-item-set, h1, main, body', { timeout: Math.min(25000, args.detailTimeoutMs) }).catch(() => {});
        // Brief idle to allow late XHRs
        await delay(300);
        // Try extracting again immediately on next loop iteration
      } catch {}
    }
    // If still weak after retries, save debug snapshot (if debug flag enabled)
    if ((!details?.title || details.title === 'Kill Board') && args.debug) {
      await saveDebugHtml(page, it.id);
    }
  const iconId = details.iconId || '';
  const titleValid = details.title && details.title !== 'Kill Board';
  const name = titleValid ? details.title : '';
  return { id: it.id, name, type: details.type || '', slot: normalizeSlot(details.slot || ''), iconId, href, details };
  } finally {
    try { await page.close(); } catch {}
  }
}

function buildListUrl({ query, type, career }) {
  const params = [];
  params.push(`type=${encodeURIComponent(canonicalizeTypeParam(type || 'all'))}`);
  if (career) params.push(`career=${encodeURIComponent(canonicalizeCareer(career))}`);
  if (query !== undefined) params.push(`query=${encodeURIComponent(query || '')}`);
  return `https://killboard.returnofreckoning.com/items?${params.join('&')}`;
}

async function spawnDetailWorker(id, baseArgs, _listFallback, tmpDir) {
  const nodeExe = process.execPath || 'node';
  const scriptPath = path.resolve(process.cwd(), 'scripts', 'scrape-killboard.js');
  const outFile = path.join(tmpDir, `${id}.json`);
  const args = [
    scriptPath,
    `--id=${id}`,
    `--outFile=${outFile}`,
    `--delayMs=${baseArgs.delayMs}`,
    `--debug=${baseArgs.debug ? 'true' : 'false'}`,
  ...(baseArgs.logFile ? [`--logFile=${baseArgs.logFile}`] : []),
  ];
  const child = spawn(nodeExe, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  await new Promise((resolve) => child.on('exit', resolve));
  try {
    const raw = await fs.readFile(outFile, 'utf8');
    try { await fs.unlink(outFile); } catch {}
    const data = JSON.parse(raw);
    // Worker writes a single-item array; return the object
    if (Array.isArray(data)) return data[0] || null;
    return data;
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs();
  const reqType = normalizeRequestedType(args.type || '');
  // Initialize log file if provided
  if (args.logFile) {
    try { await fs.mkdir(path.dirname(args.logFile), { recursive: true }); } catch {}
    try { await fs.writeFile(args.logFile, `# scrape-killboard log started at ${new Date().toISOString()}\n`, 'utf8'); } catch {}
    LOG_FILE = args.logFile;
  }

  // Single ID worker mode
  if (args.id) {
    puppeteer.use(StealthPlugin());
    const browser = await puppeteer.launch({ headless: !args.headful, defaultViewport: { width: 1280, height: 1000 } });
    const page = await browser.newPage();
    try {
      const href = `https://killboard.returnofreckoning.com/item/${args.id}`;
      logp(`Open item ${args.id} -> ${href}`);
      await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 180_000 });
      await page.waitForSelector('.item, .item-name-item-set, h1, main, body', { timeout: 60_000 }).catch(() => {});
      logp('Item page loaded; waiting for hydration...');
      // Hydration settle loop
      await page.evaluate(async () => {
        const container = document.querySelector('.item, .item-details, #root, main, body') || document.body;
        let stable = 0, last = 0;
        for (let i = 0; i < 40; i++) {
          const len = (container.innerText || '').length;
          if (len !== last) { stable = 0; last = len; await new Promise((r) => setTimeout(r, 200)); } else { stable++; if (stable >= 3) break; await new Promise((r) => setTimeout(r, 150)); }
        }
      });
      let details = await extractDetailsFromItem(page);
      // Retry once if weak
      if (!details.title || details.title === 'Kill Board' || (!details.slot && !details.type)) {
        logp('Weak details detected, retrying once after reload...');
        try { await page.reload({ waitUntil: 'domcontentloaded' }); } catch {}
        await page.waitForSelector('.item, .item-name-item-set, h1, main, body', { timeout: 60_000 }).catch(() => {});
        await delay(300);
        details = await extractDetailsFromItem(page);
      }
  const name = (details.title && details.title !== 'Kill Board') ? details.title : '';
  const slot = normalizeSlot(details.slot || '');
  const iconId = details.iconId || '';
  let type = details.type || '';
      if (!type && /pocket item/i.test(String(slot))) type = 'Accessory';
      const out = {
        id: String(args.id),
        name,
        type,
        slot,
        iconId,
        href,
        details
      };
      // Finalize type mirroring
      if (!out.type) {
        const s = (out.slot || '').toLowerCase();
        if (['jewellery','jewelry','jewelery','back','cloak','belt','waist','event item','pocket item','event','pocket'].includes(s)) out.type = 'Accessory';
        if (['main hand','off hand','right hand','left hand','ranged weapon','ranged','weapon','two hand','two-handed','great weapon','2h'].includes(s)) out.type = 'Weapon';
      }
      if (!out.details.type) out.details.type = out.type || '';
      await fs.mkdir(path.dirname(args.outFile), { recursive: true });
  await fs.writeFile(args.outFile, JSON.stringify([out], null, 2), 'utf8');
  logp(`Saved 1 item -> ${args.outFile}`);
    } finally {
      await page.close().catch(() => {});
      await browser.close().catch(() => {});
    }
    return;
  }

  // Listing mode
  puppeteer.use(StealthPlugin());
  const browser = await puppeteer.launch({ headless: !args.headful, defaultViewport: { width: 1280, height: 1000 } });
  const page = await browser.newPage();
  const results = [];
  try {
  const listUrl = buildListUrl({ query: args.query, type: reqType, career: args.career });
  logp(`Listing: ${listUrl}`);
    const listWaitUntil = args.fastList ? 'domcontentloaded' : 'networkidle2';
    await page.goto(listUrl, { waitUntil: listWaitUntil, timeout: 180_000 });
  await page.waitForSelector('a[href*="/item/"]', { timeout: 90_000 }).catch(() => {});
  logp('Listing page loaded. Extracting initial batch...');
    if (args.debug) { try { await fs.mkdir('public/debug', { recursive: true }); await fs.writeFile('public/debug/listing.html', await page.content(), 'utf8'); } catch {} }

  const useConcurrency = Math.max(1, Math.min(15, Number(args.concurrency) || 1)) > 1;
  const maxItems = args.limit > 0 ? Number(args.limit) : Number.POSITIVE_INFINITY;
    const itemsCollected = new Map(); // id -> list item

    const tmpDir = useConcurrency ? path.resolve(process.cwd(), 'public', 'data', '_tmp_kb_workers') : '';
    if (useConcurrency) { try { await fs.mkdir(tmpDir, { recursive: true }); } catch {} }

    // Non-blocking scheduler: listing enqueues items, a pump keeps spawning within concurrency
    const maxConc = Math.max(1, Math.min(15, Number(args.concurrency) || 1));
    const enqueued = new Set();
    const inFlight = new Set();
    const queue = [];
    let totalScheduled = 0;
    let listingDone = false;
    let tFirstSpawnSec = null;
    let tFirstResultSec = null;

    function schedule(it) {
      if (!useConcurrency) return;
      const id = String(it.id);
      if (enqueued.has(id)) return;
      if (totalScheduled >= maxItems) return;
      enqueued.add(id);
      totalScheduled++;
      queue.push(it);
    }

    const pumpPromise = (async () => {
      while (!listingDone || queue.length || inFlight.size) {
        // Fill up to concurrency
        while (queue.length && inFlight.size < maxConc) {
          const it = queue.shift();
          const id = String(it.id);
          if (tFirstSpawnSec === null) tFirstSpawnSec = sinceStartSec();
          await logp(`spawn id=${id} (in-flight=${inFlight.size + 1}, queued=${queue.length})`);
          const work = async () => {
            if (args.pool) {
              const res = await fetchDetailWithPool(browser, it, args);
              if (res) results.push(res);
            } else {
              const res = await spawnDetailWorker(id, args, undefined, tmpDir);
              if (res) {
                const arr = Array.isArray(res) ? res : [res];
                for (const item of arr) results.push(item);
              }
            }
          };
          const p = work().then(async () => {
            if (tFirstResultSec === null) tFirstResultSec = sinceStartSec();
            await logp(`done id=${id} results=${results.length}`);
          }).finally(() => { inFlight.delete(p); });
          inFlight.add(p);
        }
        await delay(100);
      }
    })();

    // Heartbeat every 5s
    const hb = setInterval(() => {
      logp(`hb queue=${queue.length} inFlight=${inFlight.size} results=${results.length} collected=${itemsCollected.size}`);
    }, 5000);

    const processBatch = async (arr) => {
      const items = (arr || []).slice();
      for (const it of items) {
        const id = it?.id ? String(it.id) : '';
        if (!id) continue;
        if (!itemsCollected.has(id)) {
          if (itemsCollected.size >= maxItems) break;
          itemsCollected.set(id, { id, href: it.href });
        }
        if (args.fastList) schedule({ id, href: it.href });
      }
    };

    // If reversePages, discover and scrape other pages first
    let first = [];
    if (args.reversePages && !args.fastList) {
      try {
        const allUrls = await getPageUrlsBounded(page, args.maxPages || 0);
        const pageUrls = allUrls.filter((u) => u !== page.url());
        if (pageUrls.length) {
          await logp(`Reverse mode: scraping ${pageUrls.length} other page(s) first...`);
          if (args.pageConcurrency && args.pageConcurrency > 1) {
            const chunks = [];
            for (let i = 0; i < pageUrls.length; i += args.pageConcurrency) {
              chunks.push(pageUrls.slice(i, i + args.pageConcurrency));
            }
            for (const chunk of chunks) {
              const combined = await scrapeListingPagesParallel(browser, listWaitUntil, chunk, { fastList: false });
              await processBatch(combined);
              await logp(`Reverse parallel batch parsed: +${combined.length} (unique collected=${itemsCollected.size})`);
            }
          } else {
            for (const url of pageUrls) {
              try {
                await page.goto(url, { waitUntil: listWaitUntil, timeout: 180_000 });
                await page.waitForSelector('a[href*="/item/"]', { timeout: 90_000 }).catch(() => {});
                await autoScroll(page, 3);
                await clickLoadMoreIfPresent(page, 1);
                const more = await extractListFromPage(page);
                await processBatch(more);
                await logp(`Reverse page batch parsed: +${more.length} (unique collected=${itemsCollected.size})`);
              } catch {}
            }
          }
        }
      } catch {}
    }

    // Now parse current (initial) page batch
    await autoScroll(page, args.fastList ? 2 : 6);
    if (!args.fastList) await clickLoadMoreIfPresent(page, 3);
    first = await extractListFromPage(page);
    if (!first.length) {
      try {
        const html = await page.content();
        const idSet = new Set();
        const rx = /\b\/item\/(\d+)\b/g;
        let m; while ((m = rx.exec(html)) !== null) idSet.add(m[1]);
        first = Array.from(idSet).map((id) => ({ id, href: `/item/${id}`, name: `Item ${id}`, type: '', slot: '', iconId: '' }));
      } catch {}
    }
    await processBatch(first);
    await logp(`Initial batch parsed: ${first.length} item anchor(s) (unique collected=${itemsCollected.size})`);

    // Pagination: collect more pages. If pageConcurrency set, use multi-tab parallel scraping.
    if (!args.fastList) {
      try {
        const allUrls = await getPageUrlsBounded(page, args.maxPages || 0);
        const pageUrls = allUrls.filter((u) => u !== page.url());
        if (Array.isArray(pageUrls) && pageUrls.length > 1) {
          if (args.pageConcurrency && args.pageConcurrency > 1) {
            const chunks = [];
            for (let i = 0; i < pageUrls.length; i += args.pageConcurrency) {
              chunks.push(pageUrls.slice(i, i + args.pageConcurrency));
            }
            for (const chunk of chunks) {
              const combined = await scrapeListingPagesParallel(browser, listWaitUntil, chunk, { fastList: false });
              await processBatch(combined);
              await logp(`Parallel page batch parsed: +${combined.length} (unique collected=${itemsCollected.size})`);
            }
          } else {
            for (const url of pageUrls) {
              try {
                await page.goto(url, { waitUntil: listWaitUntil, timeout: 180_000 });
                await page.waitForSelector('a[href*="/item/"]', { timeout: 90_000 }).catch(() => {});
                await autoScroll(page, 3);
                await clickLoadMoreIfPresent(page, 1);
                const more = await extractListFromPage(page);
                await processBatch(more);
                await logp(`Paginated batch parsed: +${more.length} (unique collected=${itemsCollected.size})`);
              } catch {}
            }
          }
        } else {
          // SPA pagination: click Next and wait for DOM list changes instead of navigation
          for (let p = 0; p < 4; p++) {
            const prevSig = await getListSignature(page);
            const clicked = await clickNextIfPresent(page);
            if (!clicked) break;
            await waitForListChange(page, prevSig, 90_000);
            await autoScroll(page, 2);
            await clickLoadMoreIfPresent(page, 1);
            const more = await extractListFromPage(page);
            await processBatch(more);
            await logp(`Next-page batch parsed: +${more.length} (unique collected=${itemsCollected.size})`);
          }
        }
      } catch {}
    } else {
      // Fast mode: try a couple of next clicks to grab more without waiting for full network idle
      for (let p = 0; p < 2; p++) {
        const prevSig = await getListSignature(page);
        const clicked = await clickNextIfPresent(page);
        if (!clicked) break;
        await waitForListChange(page, prevSig, 60_000);
        await autoScroll(page, 1);
        const more = await extractListFromPage(page);
        await processBatch(more);
        await logp(`FastList next-page parsed: +${more.length} (unique collected=${itemsCollected.size})`);
      }
    }

    // If not using concurrency, fetch details sequentially now
    if (!useConcurrency) {
    const items = Array.from(itemsCollected.values());
    const total = args.limit > 0 ? Math.min(args.limit, items.length) : items.length;
    logp(`Found ${items.length} items; fetching details for ${total}...`);
      for (let i = 0; i < total; i++) {
        const it = items[i];
        const href = it.href?.startsWith('http') ? it.href : `https://killboard.returnofreckoning.com${it.href}`;
        try {
          await page.goto(href, { waitUntil: 'networkidle2', timeout: 180_000 });
          await page.waitForSelector('.item-name-item-set, h1, .item, main, body', { timeout: 60_000 }).catch(() => {});
          // Hydration settle
          await page.evaluate(async () => {
            const container = document.querySelector('.item, .item-details, #root, main, body') || document.body;
            let last = 0;
            for (let i = 0; i < 20; i++) {
              const len = (container.innerText || '').length;
              if (len > last) { last = len; await new Promise((r) => setTimeout(r, 200)); } else { break; }
            }
          });
          const details = await extractDetailsFromItem(page);
      const iconId = details.iconId || '';
      const titleValid = details.title && details.title !== 'Kill Board';
      const name = titleValid ? details.title : '';
      results.push({ id: it.id, name, type: details.type || '', slot: normalizeSlot(details.slot || ''), iconId, href, details });
          if (args.delayMs > 0) await delay(args.delayMs);
        } catch (e) {
          if (args.debug) console.warn(`Detail failed for ${it.id}:`, (e && e.message) ? e.message : String(e));
      results.push({ id: it.id, name: '', type: '', slot: '', iconId: '', href, details: { error: (e && e.message) ? e.message : String(e) } });
        }
      }
    }

  // Finalize: ensure type populated and mirrored
    function inferTypeFromSlot(slot) {
      const s = (slot || '').trim().toLowerCase();
      if (!s) return '';
      if (['jewellery','jewelry','jewelery','back','cloak','belt','waist','event item','pocket item','event','pocket'].includes(s)) return 'Accessory';
      if (['main hand','off hand','right hand','left hand','ranged weapon','ranged','weapon','two hand','two-handed','great weapon','2h'].includes(s)) return 'Weapon';
      if (['helm','head','shoulder','shoulders','body','chest','robe','hands','gloves','feet','boots'].includes(s)) return '';
      return '';
    }
    // Flatten any array-shaped results defensively
    const flatResults = [];
    for (const r of results) {
      if (Array.isArray(r)) flatResults.push(...r);
      else if (r) flatResults.push(r);
    }
    let finalized = flatResults.map((r) => {
      const out = { ...r, details: { ...(r.details || {}) } };
      let t = (out.type || '').trim();
      if (!t) t = (out.details?.type || '').trim();
      if (!t) t = inferTypeFromSlot(out.slot);
      if (!t && /pocket item/i.test(String(out.slot || ''))) t = 'Accessory';
      if (!t) t = '';
      out.type = t;
      if (!out.details.type) out.details.type = t;
      return out;
    });

    // Post-filter by allowed slots and requested type using detail-derived data
    finalized = finalized.filter((it) => ALLOWED_SLOTS.has(it.slot));
    if (reqType && reqType !== 'all') {
      finalized = finalized.filter((it) => {
        const t = (it.type || '').toLowerCase();
        if (!t) return false;
        if (reqType === 'robe') return t.includes('robe');
        if (reqType === 'light armor') return t.includes('light');
        if (reqType === 'medium armor') return t.includes('medium');
        if (reqType === 'heavy armor') return t.includes('heavy');
        if (reqType === 'accessory') return t.includes('accessor');
        if (reqType === 'weapon') return t.includes('weapon');
        return true;
      });
    }

    await fs.mkdir(path.dirname(args.outFile), { recursive: true });
    await fs.writeFile(args.outFile, JSON.stringify(finalized, null, 2), 'utf8');
    const totalSec = Number(sinceStartSec());
    const rate = totalSec > 0 ? (finalized.length / totalSec).toFixed(2) : 'n/a';
    if (typeof tFirstSpawnSec !== 'undefined' || typeof tFirstResultSec !== 'undefined') {
      logp(`Timing: first spawn at ${tFirstSpawnSec ?? 'n/a'}s; first result at ${tFirstResultSec ?? 'n/a'}s`);
    }
    logp(`Saved ${finalized.length} item(s) -> ${args.outFile} (elapsed=${totalSec.toFixed(1)}s, rate=${rate} items/s)`);
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('Scraper failed:', err);
  if (typeof process !== 'undefined') process.exitCode = 1;
});
