/* eslint-env node */
import process from 'node:process';
import fetch from 'node-fetch';

const ENDPOINT = 'https://production-api.waremu.com/graphql';

async function post(query, variables) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
      'origin': 'https://killboard.returnofreckoning.com',
      'referer': 'https://killboard.returnofreckoning.com/',
      'user-agent': 'Mozilla/5.0'
    },
    body: JSON.stringify({ query, variables })
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`Non-JSON (${res.status}): ${text.slice(0,200)}`); }
  if (!res.ok || json.errors) {
    const m = json.errors?.[0]?.message || json.errors?.[0]?.extensions?.message || `HTTP ${res.status}`;
    const e = new Error(m);
    e.payload = json;
    throw e;
  }
  return json.data;
}

async function fetchItemById(id) {
  const q = `query($id:ID!){ item(id:$id){ id name rarity slot levelRequirement renownRankRequirement itemLevel careerRestriction stats{stat value percentage} } }`;
  const data = await post(q, { id: String(id) });
  return data?.item;
}

async function searchAnnulus(limit=100) {
  const q = `query($first:Int,$after:String,$where:ItemFilterInput){ items(first:$first, after:$after, where:$where){ edges{ node{ id name rarity slot careerRestriction } } pageInfo{ hasNextPage endCursor } } }`;
  const out = [];
  let after;
  let got = 0;
  const pageSize = 50;
  let hasNext = true;
  while (hasNext) {
    const data = await post(q, { first: pageSize, after, where: { name: { contains: 'Annulus' } } });
    const conn = data?.items;
    const nodes = (conn?.edges||[]).map(e=>e.node);
    out.push(...nodes);
    got += nodes.length;
    hasNext = !!(conn?.pageInfo?.hasNextPage) && got < limit;
    after = hasNext ? conn.pageInfo.endCursor : undefined;
  }
  return out;
}

(async () => {
  try {
    const ids = ['450841','451134'];
    const byId = [];
    for (const id of ids) {
      try { byId.push(await fetchItemById(id)); } catch(e) { byId.push({ id, error: e.message }); }
    }
    const ann = await searchAnnulus(100);
    console.log(JSON.stringify({ byId, annulus: ann }, null, 2));
  } catch (e) {
    console.error('Probe failed:', e.message);
    if (e.payload) console.error(JSON.stringify(e.payload, null, 2));
    process.exitCode = 1;
  }
})();
