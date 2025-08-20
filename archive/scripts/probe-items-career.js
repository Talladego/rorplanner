// Probe items by ID for career matching
// Usage: node scripts/probe-items-career.js --career=SQUIG_HERDER --ids=435323,435335,...

import fetch from 'node-fetch';

const GQL_URL = 'https://production-api.waremu.com/graphql';

async function post(query, variables) {
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
      'origin': 'https://killboard.returnofreckoning.com',
      'referer': 'https://killboard.returnofreckoning.com/'
    },
    body: JSON.stringify({ query, variables })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors) {
    const msg = json?.errors?.[0]?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json.data;
}

function parseArg(name, defVal = '') {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : defVal;
}

async function fetchItem(id) {
  const q = `query($id:ID!){
    item(id:$id){ id name type slot rarity itemLevel levelRequirement careerRestriction }
  }`;
  const data = await post(q, { id: String(id) });
  return data?.item || null;
}

function checkItem(it, career) {
  const cr = Array.isArray(it?.careerRestriction) ? it.careerRestriction : [];
  const has = cr.includes(career);
  const unrestricted = cr.length === 0;
  return { has, unrestricted };
}

async function main() {
  const career = parseArg('career', 'SQUIG_HERDER');
  const idsArg = parseArg('ids', '');
  const ids = idsArg.split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length) {
    console.error('No --ids provided');
    process.exit(1);
  }
  const out = [];
  for (const id of ids) {
    try {
      const it = await fetchItem(id);
      if (!it) { out.push({ id, ok: false, error: 'Not found' }); continue; }
      const res = checkItem(it, career);
      out.push({ id, ok: true, name: it.name, slot: it.slot, careerRestriction: it.careerRestriction || [], ...res });
    } catch (e) {
      out.push({ id, ok: false, error: String(e.message || e) });
    }
  }
  const summary = {
    career,
    total: out.length,
    matches: out.filter(r => r.ok && r.has).length,
    unrestricted: out.filter(r => r.ok && r.unrestricted).length,
    missing: out.filter(r => r.ok && !r.has && !r.unrestricted).map(r => r.id)
  };
  console.log(JSON.stringify({ summary, results: out }, null, 2));
}

main().catch(e => { console.error('Probe failed:', e.message || e); process.exit(1); });
