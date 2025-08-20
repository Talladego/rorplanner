// Probe the top 10 highest itemLevel items for each item slot per career and analyze results
// Usage:
//   node scripts/probe-top-items-by-slot.js
//   node scripts/probe-top-items-by-slot.js --careers=ENGINEER,ARCHMAGE --slots=HELM,BODY --first=10

import fetch from 'node-fetch';

const GQL_URL = 'https://production-api.waremu.com/graphql';

async function post(query, variables) {
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      origin: 'https://killboard.returnofreckoning.com',
      referer: 'https://killboard.returnofreckoning.com/'
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

async function fetchCareerEnums() {
  const q = `query{ __type(name:"Career"){ enumValues{ name } } }`;
  const data = await post(q, {});
  const vals = (data?.__type?.enumValues || []).map(v => v.name);
  return new Set(vals);
}

function mapCareerEnum(input, serverEnums) {
  if (!input) return null;
  const up = String(input).toUpperCase();
  if (serverEnums.has(up)) return up;
  const overrides = {
    KNIGHT: 'KNIGHT_OF_THE_BLAZING_SUN',
    IRONBREAKER: 'IRON_BREAKER',
    DISCIPLE: 'DISCIPLE_OF_KHAINE',
    SWORDMASTER: 'SWORD_MASTER',
  };
  const o = overrides[up];
  if (o && serverEnums.has(o)) return o;
  // fallback: underscore-insensitive equality
  const norm = s => s.replace(/_/g, '');
  for (const val of serverEnums) {
    if (norm(val) === norm(up)) return val;
  }
  return null;
}

function parseListArg(name, defVals) {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  if (!arg) return defVals;
  const list = (arg.split('=')[1] || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return list.length ? list : defVals;
}

function parseIntArg(name, defVal) {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  if (!arg) return defVal;
  const v = parseInt(arg.split('=')[1], 10);
  return Number.isFinite(v) ? v : defVal;
}

// Careers to probe (align with server enums)
const DEFAULT_CAREERS = [
  'ARCHMAGE','SHAMAN','BRIGHT_WIZARD','SORCERER','RUNE_PRIEST','ZEALOT',
  'ENGINEER','MAGUS','SHADOW_WARRIOR','SQUIG_HERDER','WITCH_HUNTER','WITCH_ELF',
  'KNIGHT','CHOSEN','IRONBREAKER','BLACK_GUARD','WHITE_LION','MARAUDER','SLAYER','CHOPPA','SWORDMASTER','BLACK_ORC','WARRIOR_PRIEST','DISCIPLE'
];

// Equip slots (server enum). Exclude NONE and STANDARD.
const DEFAULT_SLOTS = [
  'HELM','SHOULDER','BACK','BODY','GLOVES','BELT','BOOTS',
  'MAIN_HAND','OFF_HAND','RANGED_WEAPON','EITHER_HAND',
  'POCKET1','POCKET2',
  'TROPHY1','TROPHY2','TROPHY3','TROPHY4','TROPHY5',
  'JEWELLERY1','JEWELLERY2','JEWELLERY3','JEWELLERY4',
  'EVENT'
];

const WANT_SETS = ['Sovereign','Warlord','Victorious','Triumphant','Invader','Vanquisher'];

const QUERY = `query($first:Int,$where: ItemFilterInput,$usableByCareer: Career,$order:[ItemSortInput!]){
  items(first:$first, where:$where, usableByCareer:$usableByCareer, order:$order){
    nodes{ id name type slot rarity itemLevel levelRequirement renownRankRequirement uniqueEquipped talismanSlots itemSet{ id name } stats{ stat value percentage } }
  }
}`;

function makeWhere(slot) {
  return {
    slot: { eq: slot },
    levelRequirement: { lte: 40 },
    renownRankRequirement: { lte: 80 },
  };
}

const DEFAULT_ORDER = [ { itemLevel: 'DESC' }, { rarity: 'DESC' } ];

async function fetchTopItems({ career, slot, first }) {
  const where = makeWhere(slot);
  const order = DEFAULT_ORDER;
  const data = await post(QUERY, { first, where, usableByCareer: career, order });
  return data?.items?.nodes || [];
}

function analyzeBucket(nodes) {
  const byRarity = {};
  const setNames = new Set();
  let withStats = 0;
  let maxIL = -Infinity, minIL = Infinity;
  let maxRR = -Infinity, minRR = Infinity;
  let maxLR = -Infinity, minLR = Infinity;
  for (const n of nodes) {
    byRarity[n.rarity] = (byRarity[n.rarity] || 0) + 1;
    if (n.itemSet?.name) setNames.add(n.itemSet.name);
    if (Array.isArray(n.stats) && n.stats.length > 0) withStats += 1;
    if (Number.isFinite(n.itemLevel)) {
      maxIL = Math.max(maxIL, n.itemLevel);
      minIL = Math.min(minIL, n.itemLevel);
    }
    if (Number.isFinite(n.renownRankRequirement)) {
      maxRR = Math.max(maxRR, n.renownRankRequirement);
      minRR = Math.min(minRR, n.renownRankRequirement);
    }
    if (Number.isFinite(n.levelRequirement)) {
      maxLR = Math.max(maxLR, n.levelRequirement);
      minLR = Math.min(minLR, n.levelRequirement);
    }
  }
  const setsArray = Array.from(setNames);
  const hasTopSet = setsArray.some(s => WANT_SETS.some(w => s.toLowerCase().includes(w.toLowerCase())));
  return {
    count: nodes.length,
  withStats,
    byRarity,
    itemSets: setsArray,
    hasTopSet,
    itemLevelRange: isFinite(maxIL) && isFinite(minIL) ? [minIL, maxIL] : null,
    renownRankRange: isFinite(maxRR) && isFinite(minRR) ? [minRR, maxRR] : null,
    levelRequirementRange: isFinite(maxLR) && isFinite(minLR) ? [minLR, maxLR] : null,
  };
}

async function main() {
  const careers = parseListArg('careers', DEFAULT_CAREERS);
  const slots = parseListArg('slots', DEFAULT_SLOTS);
  const first = parseIntArg('first', 10);
  const summaryOnly = process.argv.some(a => a === '--summaryOnly');
  const serverCareerEnums = await fetchCareerEnums();
  const mappedCareers = careers.map(c => ({ input: c, mapped: mapCareerEnum(c, serverCareerEnums) }));

  const results = [];
  for (const { input: careerInput, mapped: career } of mappedCareers) {
    if (!career) {
      // record mapping error for all slots
      for (const slot of slots) {
        results.push({ careerInput, career: careerInput, slot, error: 'Unknown career enum; mapping failed' });
      }
      continue;
    }
    for (const slot of slots) {
      try {
        const nodes = await fetchTopItems({ career, slot, first });
        const analysis = analyzeBucket(nodes);
        results.push({ careerInput, career, slot, top: nodes, analysis });
      } catch (e) {
        results.push({ careerInput, career, slot, error: String(e.message || e) });
      }
    }
  }

  // Summarize
  const IGNORE_SLOTS = new Set(['EVENT','TROPHY1','TROPHY2','TROPHY3','TROPHY4','TROPHY5']);
  const summary = {
    careers: careers.length,
    slots: slots.length,
    buckets: results.length,
    emptyBuckets: results.filter(r => !r.error && (!r.top || r.top.length === 0)).map(r => ({ career: r.career, slot: r.slot })),
    withTopSets: results.filter(r => r.analysis?.hasTopSet && !IGNORE_SLOTS.has(r.slot)).length,
    errors: results.filter(r => r.error)
  };

  // Enriched analysis: per-career and per-slot coverage
  const perCareer = {};
  for (const c of careers) perCareer[c] = { career: c, total: 0, withTopSet: 0, empty: 0, missingTopSetSlots: [], mapped: null };
  for (const r of results) {
    const key = r.careerInput || r.career;
    const pc = perCareer[key] || (perCareer[key] = { career: key, total: 0, withTopSet: 0, empty: 0, missingTopSetSlots: [], mapped: r.career });
    if (!pc.mapped && r.career && r.career !== key) pc.mapped = r.career;
    pc.total += IGNORE_SLOTS.has(r.slot) ? 0 : 1;
    if (r.error || !r.top || r.top.length === 0) { pc.empty += 1; pc.missingTopSetSlots.push(r.slot); continue; }
    if (!IGNORE_SLOTS.has(r.slot)) {
      if (r.analysis?.hasTopSet) pc.withTopSet += 1; else pc.missingTopSetSlots.push(r.slot);
    }
  }
  const perSlot = {};
  for (const s of slots) perSlot[s] = { slot: s, careers: careers.length, withTopSet: 0, empty: 0 };
  for (const r of results) {
    const ps = perSlot[r.slot];
    if (r.error || !r.top || r.top.length === 0) { ps.empty += 1; continue; }
    if (!IGNORE_SLOTS.has(r.slot) && r.analysis?.hasTopSet) ps.withTopSet += 1;
  }

  const analysis = {
    overallCoverage: {
      buckets: summary.buckets,
      withTopSets: summary.withTopSets,
      coveragePct: summary.buckets ? Math.round((summary.withTopSets / summary.buckets) * 1000) / 10 : 0,
      emptyCount: summary.emptyBuckets.length
    },
    perCareer: Object.values(perCareer).map(pc => ({
      career: pc.career,
      coveragePct: pc.total ? Math.round((pc.withTopSet / pc.total) * 1000) / 10 : 0,
      empty: pc.empty,
      missingTopSetSlots: pc.missingTopSetSlots
    })),
    perSlot: Object.values(perSlot).map(ps => ({
      slot: ps.slot,
      coveragePct: IGNORE_SLOTS.has(ps.slot) ? null : (ps.careers ? Math.round((ps.withTopSet / ps.careers) * 1000) / 10 : 0),
      empty: ps.empty
    })),
    jewelry: (() => {
      const jewSlots = new Set(['JEWELLERY1','JEWELLERY2','JEWELLERY3','JEWELLERY4']);
      const buckets = results.filter(r => jewSlots.has(r.slot) && !r.error && r.top && r.top.length);
      const bySlot = {};
      for (const r of buckets) {
        const key = r.slot;
        const hasSet = !!r.analysis?.hasTopSet;
        const statful = (r.analysis?.withStats || 0);
        if (!bySlot[key]) bySlot[key] = { slot: key, buckets: 0, withTopSets: 0, statfulTopCount: 0 };
        bySlot[key].buckets += 1;
        bySlot[key].withTopSets += hasSet ? 1 : 0;
        bySlot[key].statfulTopCount += statful;
      }
      return Object.values(bySlot);
    })()
  };

  const payload = summaryOnly ? { ok: true, first, summary, analysis } : { ok: true, first, summary, analysis, results };
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(e => {
  console.error(JSON.stringify({ ok: false, error: String(e.message || e) }));
  process.exit(1);
});
