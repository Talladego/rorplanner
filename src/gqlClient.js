// On GitHub Pages, you cannot proxy /graphql. This app expects the API to be available
// via the same origin under BASE + 'graphql' during local dev. For production on Pages,
// either pre-bundle data under public/data and avoid live calls, or point to a CORS-enabled
// absolute endpoint here.
const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : '/';
const GQL_ENDPOINT = `${BASE}graphql`;

async function post(query, variables) {
  const res = await fetch(GQL_ENDPOINT, {
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
  const msg = (json.errors && json.errors[0] && (json.errors[0].message || json.errors[0].extensions?.message)) || `HTTP ${res.status}`;
  const err = new Error(msg);
  err.response = json;
    throw err;
  }
  return json.data;
}

function toEnum(val) {
  return String(val || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

export async function fetchSovereignItems({ career, perPage = 50, totalLimit = 200, typeEq, nameContains, allowAnyName = false, slotEq }) {
  const q = `query($first:Int,$after:String,$where: ItemFilterInput,$usableByCareer: Career){
    items(first:$first, after:$after, where:$where, usableByCareer:$usableByCareer){
      edges{ node{ id name description type slot levelRequirement itemLevel renownRankRequirement iconUrl talismanSlots rarity uniqueEquipped careerRestriction itemSet{ id name } stats { stat value percentage } } }
      pageInfo{ hasNextPage endCursor }
    }
  }`;
  const where = allowAnyName || !nameContains ? {} : { name: { contains: nameContains } };
  if (typeEq) {
    where.type = { eq: toEnum(typeEq) };
  }
  if (slotEq) {
    where.slot = { eq: toEnum(slotEq) };
  }
  const usable = career ? toEnum(career) : undefined;
  const out = [];
  let after = undefined;
  do {
    const data = await post(q, { first: perPage, after, where, usableByCareer: usable });
    const conn = data?.items;
    const edges = conn?.edges || [];
    for (const e of edges) out.push(e.node);
    if (!conn?.pageInfo?.hasNextPage || out.length >= totalLimit) break;
    after = conn.pageInfo.endCursor || undefined;
  } while (true);
  return out;
}

export async function fetchItemDetails(id) {
  const q = `query($id: ID!){
    item(id:$id){
      id name description type slot rarity armor dps speed levelRequirement renownRankRequirement itemLevel uniqueEquipped iconUrl talismanSlots
      stats{ stat value percentage }
      itemSet{ id name level bonuses{ itemsRequired bonus{ __typename ... on ItemStat { stat value percentage } ... on Ability { id description name } } } }
      abilities{ id name description }
      buffs{ id name description }
    }
  }`;
  const data = await post(q, { id: String(id) });
  return data?.item || null;
}
