// Test career filtering against GraphQL and our client fetch
// Usage: node scripts/test-blackguard-filter.js --career=BLACKGUARD

import fetch from 'node-fetch';
import { fetchItems, mapCareerEnumDynamic } from '../src/gqlClient.js';

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

async function fetchBySlotDirect(careerEnum, slot, first = 25) {
  const q = `query($first:Int,$where: ItemFilterInput,$usableByCareer: Career){
    items(first:$first, where:$where, usableByCareer:$usableByCareer){
      edges{ node{ id name slot rarity itemLevel levelRequirement careerRestriction } }
      pageInfo{ hasNextPage endCursor }
    }
  }`;
  const where = { slot: { eq: slot } };
  const data = await post(q, { first, where, usableByCareer: careerEnum });
  const edges = data?.items?.edges || [];
  return edges.map(e => e.node);
}

function summarize(items, careerEnum) {
  const total = items.length;
  const matches = items.filter(it => Array.isArray(it.careerRestriction) && it.careerRestriction.includes(careerEnum)).length;
  const unrestricted = items.filter(it => !Array.isArray(it.careerRestriction) || it.careerRestriction.length === 0).length;
  return { total, matches, unrestricted };
}

async function main() {
  const careerArg = process.argv.find(a => a.startsWith('--career='));
  const careerUi = careerArg ? careerArg.split('=')[1] : 'BLACKGUARD';
  const careerEnum = await mapCareerEnumDynamic(careerUi);
  const slots = ['HELM', 'MAIN_HAND', 'OFF_HAND', 'BODY', 'RANGED_WEAPON', 'JEWELLERY1'];
  console.log(`Career enum resolved: ${careerEnum}`);
  for (const s of slots) {
    const direct = await fetchBySlotDirect(careerEnum, s, 50);
    const sum = summarize(direct, careerEnum);
    console.log(`[Direct] ${s}:`, sum, 'sample:', direct.slice(0, 3).map(i => i.name));
  }
  // Now test via client fetchItems
  for (const s of slots) {
    const viaClient = await fetchItems({ career: careerUi, perPage: 50, totalLimit: 200, slotEq: s });
    const sum = summarize(viaClient, careerEnum);
    console.log(`[Client ] ${s}:`, sum, 'sample:', viaClient.slice(0, 3).map(i => i.name));
  }
}

main().catch(e => { console.error('Test failed:', e.message || e); process.exit(1); });
