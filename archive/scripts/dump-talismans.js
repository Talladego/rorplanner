// Dump all talismans to public/data/talismans.json
// Usage: node scripts/dump-talismans.js [--limit=4000]
import fetchPkg from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

const fetch = fetchPkg.default || fetchPkg;
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

function getArg(name, defVal) {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  if (!arg) return defVal;
  return arg.split('=')[1];
}

async function pageItems(where, limit) {
  const q = `query($first:Int,$after:String,$where:ItemFilterInput){
    items(first:$first, after:$after, where:$where){
      edges{ node{ id name description type slot rarity levelRequirement itemLevel talismanSlots iconUrl
        stats{ stat value percentage }
        itemSet{ id name }
        abilities{ id name description }
        buffs{ id name description }
      } }
      pageInfo{ hasNextPage endCursor }
    }
  }`;
  const byId = new Map();
  let after;
  const first = 50;
  do {
    const data = await post(q, { first, after, where });
    const conn = data?.items;
    for (const e of (conn?.edges || [])) byId.set(String(e.node.id), e.node);
    after = conn?.pageInfo?.hasNextPage && byId.size < limit ? conn.pageInfo.endCursor : undefined;
  } while (after);
  return byId;
}

async function fetchAllTalismans(limit = 4000) {
  const byId = new Map();
  // Fetch by type variants with variables (enum names as strings are fine in variables)
  for (const type of ['ENHANCEMENT','ENCHANTMENT','TALISMAN']) {
    try {
      const where = { type: { eq: type } };
      const m = await pageItems(where, limit);
      for (const [id, node] of m) byId.set(id, node);
    } catch {}
  }
  // Fetch by slot NONE
  try {
    const m2 = await pageItems({ slot: { eq: 'NONE' } }, limit);
    for (const [id, node] of m2) byId.set(id, node);
  } catch {}
  // Fallback: name contains 'talisman'
  try {
    const m3 = await pageItems({ name: { contains: 'talisman' } }, limit);
    for (const [id, node] of m3) byId.set(id, node);
  } catch {}
  return Array.from(byId.values());
}

async function main() {
  const limit = parseInt(getArg('limit', '4000'), 10) || 4000;
  const list = await fetchAllTalismans(limit);
  const outDir = path.join('public', 'data');
  try { await fs.mkdir(outDir, { recursive: true }); } catch {}
  const outPath = path.join(outDir, 'talismans.json');
  await fs.writeFile(outPath, JSON.stringify({ count: list.length, items: list }, null, 2), 'utf8');
  console.log(`Wrote ${list.length} talismans to ${outPath}`);
}

main().catch(err => { console.error('dump failed:', err.message || err); process.exitCode = 1; });
