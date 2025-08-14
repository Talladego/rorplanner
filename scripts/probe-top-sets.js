// Probe for top-set armor items per career/slot without using name filters
// Usage: node scripts/probe-top-sets.js [--careers=ENGINEER,ARCHMAGE,...] [--slots=HELM,SHOULDER,BODY,GLOVES,BOOTS]
// Prints a compact summary indicating which query variant surfaced top sets.

import fetch from 'node-fetch';

const GQL_URL = 'https://production-api.waremu.com/graphql';

async function post(query, variables) {
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
      // Mirror site client headers to avoid odd rejections
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

function parseListArg(name, defVals) {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  if (!arg) return defVals;
  const list = (arg.split('=')[1] || '').split(',').map(s => s.trim()).filter(Boolean);
  return list.length ? list : defVals;
}

const DEFAULT_CAREERS = [
  'ENGINEER','ARCHMAGE','MAGUS','SQUIG_HERDER','BRIGHT_WIZARD','RUNE_PRIEST','BLACK_GUARD','BLACK_ORC',
  'WITCH_HUNTER','WITCH_ELF','KNIGHT','CHOSEN','IRONBREAKER','BLACK_GUARD','WHITE_LION','MARAUDER'
];
const DEFAULT_SLOTS = ['HELM','HEAD','SHOULDER','SHOULDERS','BODY','CHEST','GLOVES','HANDS','BOOTS','FEET'];
const WANT_SETS = ['Sovereign','Warlord','Victorious','Triumphant','Invader','Vanquisher'];

function baseWhere(slot, { capped = true } = {}) {
  const w = { slot: { eq: slot } };
  if (capped) {
    w.levelRequirement = { lte: 40 };
    w.renownRankRequirement = { lte: 80 };
  }
  return w;
}

const QUERY = `query($first:Int,$after:String,$where: ItemFilterInput,$usableByCareer: Career){
  items(first:$first, after:$after, where:$where, usableByCareer:$usableByCareer){
    edges{ node{ id name slot rarity itemLevel levelRequirement renownRankRequirement itemSet{ id name } } }
    pageInfo { hasNextPage endCursor }
  }
}`;

function findTopSetHits(nodes) {
  return (nodes||[]).filter(n => n?.itemSet?.name && WANT_SETS.some(w => n.itemSet.name.toLowerCase().includes(w.toLowerCase())));
}

async function fetchAllNodes({ pageSize = 50, where, usableByCareer, limit = 500 }) {
  let after;
  let out = [];
  let hasNext = true;
  while (hasNext && out.length < limit) {
    const data = await post(QUERY, { first: pageSize, after, where, usableByCareer });
    const conn = data?.items;
    const nodes = (conn?.edges || []).map(e => e.node);
    out.push(...nodes);
    hasNext = !!conn?.pageInfo?.hasNextPage;
    after = hasNext ? (conn?.pageInfo?.endCursor || undefined) : undefined;
  }
  return out;
}

async function probeCareerSlot(career, slot) {
  const where = baseWhere(slot, { capped: true });
  const whereUncapped = baseWhere(slot, { capped: false });
  // 1) Career-filtered
  try {
    const nodes = await fetchAllNodes({ pageSize: 50, where, usableByCareer: career, limit: 300 });
    const hits = findTopSetHits(nodes);
    if (hits.length) return { variant: 'career', hits };
  } catch (e) {
    // swallow and try next variant
  }
  // 2) No-career fallback
  try {
    const nodes = await fetchAllNodes({ pageSize: 50, where, usableByCareer: undefined, limit: 300 });
    const hits = findTopSetHits(nodes);
    if (hits.length) return { variant: 'noCareer', hits };
  } catch (e) {}
  // 3) Rarity VERY_RARE + career
  try {
    const whereVRc = { ...where, rarity: { eq: 'VERY_RARE' } };
    const nodes = await fetchAllNodes({ pageSize: 50, where: whereVRc, usableByCareer: career, limit: 300 });
    const hits = findTopSetHits(nodes);
    if (hits.length) return { variant: 'veryRareCareer', hits };
  } catch (e) {}
  // 4) Rarity VERY_RARE + no-career (still within slot and caps)
  try {
    const whereVR = { ...where, rarity: { eq: 'VERY_RARE' } };
    const nodes = await fetchAllNodes({ pageSize: 50, where: whereVR, usableByCareer: undefined, limit: 300 });
    const hits = findTopSetHits(nodes);
    if (hits.length) return { variant: 'veryRareNoCareer', hits };
  } catch (e) {}
  // 4b) Rarity MYTHIC (with and without career)
  for (const usable of [career, undefined]) {
    try {
      const whereMY = { ...whereUncapped, rarity: { eq: 'MYTHIC' } };
      const nodes = await fetchAllNodes({ pageSize: 50, where: whereMY, usableByCareer: usable, limit: 300 });
      const hits = findTopSetHits(nodes);
      if (hits.length) return { variant: `mythic${usable ? 'Career' : 'NoCareer'}`, hits };
    } catch (e) {}
  }
  // 5) No-career + renown gte thresholds (try 60 then 70)
  for (const gte of [60, 70]) {
    try {
      const whereRR = { ...where, renownRankRequirement: { gte } };
      const nodes = await fetchAllNodes({ pageSize: 50, where: whereRR, usableByCareer: undefined, limit: 300 });
      const hits = findTopSetHits(nodes);
      if (hits.length) return { variant: `noCareerRR>=${gte}`, hits };
    } catch (e) { /* likely filter doesn't support gte; ignore */ }
  }
  // 6) Uncapped no-career
  try {
    const nodes = await fetchAllNodes({ pageSize: 50, where: whereUncapped, usableByCareer: undefined, limit: 300 });
    const hits = findTopSetHits(nodes);
    if (hits.length) return { variant: 'noCareerUncapped', hits };
  } catch (e) {}
  return { variant: 'none', hits: [] };
}

async function main() {
  const careers = parseListArg('careers', DEFAULT_CAREERS);
  const slots = parseListArg('slots', DEFAULT_SLOTS);
  const summary = [];
  for (const career of careers) {
    for (const slot of slots) {
      const res = await probeCareerSlot(career, slot);
      const sets = Array.from(new Set(res.hits.map(h => h.itemSet?.name).filter(Boolean)));
      summary.push({ career, slot, via: res.variant, sets });
    }
  }
  // Compact, easy to scan output
  console.log(JSON.stringify({ ok: true, summary }, null, 2));
}

main().catch(e => { console.error(JSON.stringify({ ok: false, error: String(e.message || e) })); process.exit(1); });
