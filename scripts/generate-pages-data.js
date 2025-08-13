import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

const GQL_URL = 'https://production-api.waremu.com/graphql';

async function post(query, variables) {
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
      'user-agent': 'rorplanner-pages-bot'
    },
    body: JSON.stringify({ query, variables })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors) {
    const msg = (json.errors && json.errors[0] && (json.errors[0].message || json.errors[0].extensions?.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json.data;
}

const SLOT_ENUMS = [
  'HELM','SHOULDER','BACK','BODY','GLOVES','BELT','BOOTS',
  'MAIN_HAND','OFF_HAND','RANGED_WEAPON','EVENT_ITEM','POCKET1','POCKET2',
  'JEWELLERY1','JEWELLERY2','JEWELLERY3','JEWELLERY4'
];

async function fetchItemsForSlot(slot, perPage = 100, totalLimit = 1000) {
  const q = `query($first:Int,$after:String,$where: ItemFilterInput){
    items(first:$first, after:$after, where:$where){
      edges{ node{ id name description type slot levelRequirement itemLevel renownRankRequirement iconUrl talismanSlots rarity uniqueEquipped careerRestriction itemSet{ id name } stats { stat value percentage } } }
      pageInfo{ hasNextPage endCursor }
    }
  }`;
  const where = { slot: { eq: slot } };
  const out = [];
  let after = undefined;
  do {
    const data = await post(q, { first: perPage, after, where });
    const conn = data?.items;
    const edges = conn?.edges || [];
    for (const e of edges) out.push(e.node);
    if (!conn?.pageInfo?.hasNextPage || out.length >= totalLimit) break;
    after = conn.pageInfo.endCursor || undefined;
  } while (true);
  return out;
}

async function main() {
  const byId = new Map();
  for (const slot of SLOT_ENUMS) {
    const items = await fetchItemsForSlot(slot, 100, 800);
    for (const it of items) {
      const id = String(it.id);
      if (!byId.has(id)) byId.set(id, it);
    }
  }
  const all = Array.from(byId.values());
  await fs.mkdir(path.resolve('public/data'), { recursive: true });
  const outPath = path.resolve('public/data/items_ALL_SOVEREIGN.json');
  await fs.writeFile(outPath, JSON.stringify(all, null, 2), 'utf8');
  console.log(`Wrote ${all.length} items -> ${outPath}`);
}

main().catch((e) => { console.error('generate-pages-data failed:', e?.message || String(e)); process.exitCode = 1; });
