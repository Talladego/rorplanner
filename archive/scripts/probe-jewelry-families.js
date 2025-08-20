// Probe jewelry families (Sentinel, Triumphant, Victorious) for Legendary Talisman support
// Usage: node scripts/probe-jewelry-families.js
import fetchPkg from 'node-fetch';
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
  return { ok: res.ok && !json.errors, data: json.data, errors: json.errors };
}

async function searchAccessoriesByPrefix(prefix) {
  const q = `query($first:Int,$after:String,$where:ItemFilterInput){
    items(first:$first, after:$after, where:$where){
      edges{ node{ id name slot type itemLevel levelRequirement talismanSlots description rarity iconUrl } }
      pageInfo{ hasNextPage endCursor }
    }
  }`;
  const where = { name: { startsWith: prefix }, slot: { in: ["JEWELLERY1","JEWELLERY2","JEWELLERY3","JEWELLERY4"] } };
  const out = [];
  let after;
  do {
    const r = await post(q, { first: 50, after, where });
    if (!r.ok) break;
    const conn = r.data?.items;
    for (const e of conn?.edges || []) out.push(e.node);
    after = conn?.pageInfo?.hasNextPage ? conn.pageInfo.endCursor : undefined;
  } while (after && out.length < 500);
  return out;
}

function supportsLegendary(desc) {
  return /legendary talisman/i.test(String(desc || ''));
}

async function run() {
  const families = ['Sentinel', 'Triumphant', 'Victorious'];
  const results = {};
  for (const fam of families) {
    const items = await searchAccessoriesByPrefix(fam);
    results[fam] = items.map(it => ({ id: it.id, name: it.name, slot: it.slot, supportsLegendary: supportsLegendary(it.description), talismanSlots: it.talismanSlots }));
  }
  console.log(JSON.stringify(results, null, 2));
}

run().catch(e => { console.error('probe failed:', e?.message || e); process.exitCode = 1; });
