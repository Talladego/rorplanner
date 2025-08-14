// Prefer a proxy endpoint (e.g., Cloudflare Worker) specified via env, else use dev proxy or direct API.
const CF_PROXY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GQL_PROXY_URL) ? import.meta.env.VITE_GQL_PROXY_URL : '';
const GQL_ENDPOINT = CF_PROXY || ((typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? '/graphql'
  : 'https://production-api.waremu.com/graphql');

async function post(query, variables) {
  const res = await fetch(GQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });
  let json = {};
  try { json = await res.json(); } catch { /* non-JSON response */ }
  if (!res.ok || (json && json.errors)) {
    const firstErr = json?.errors?.[0];
    const msg = (firstErr && (firstErr.message || firstErr.extensions?.message)) || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.response = json;
    throw err;
  }
  return json.data;
}

function toEnum(val) {
  return String(val || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

let CACHED_CAREER_ENUMS = null;
async function fetchCareerEnumsOnce() {
  if (Array.isArray(CACHED_CAREER_ENUMS)) return CACHED_CAREER_ENUMS;
  const q = `query($name:String!){ __type(name:$name){ enumValues { name } } }`;
  try {
    const data = await post(q, { name: 'Career' });
    const vals = (data?.__type?.enumValues || []).map(v => v.name);
    CACHED_CAREER_ENUMS = vals;
  } catch {
    CACHED_CAREER_ENUMS = null;
  }
  return CACHED_CAREER_ENUMS;
}

export function mapCareerEnum(val) {
  const v = toEnum(val);
  // Known mismatches between UI labels and GraphQL enums
  if (v === 'BLACKGUARD') return 'BLACK_GUARD';
  return v;
}

export async function mapCareerEnumDynamic(val) {
  const v = toEnum(val);
  if (v === 'BLACKGUARD') return 'BLACK_GUARD';
  const enums = await fetchCareerEnumsOnce();
  if (Array.isArray(enums) && enums.includes(v)) return v;
  // Try a fuzzy match by removing singular/plural/spacing differences (we already underscore)
  if (Array.isArray(enums)) {
    const found = enums.find(e => e.replace(/_/g, '') === v.replace(/_/g, ''));
    if (found) return found;
  }
  return v;
}

export async function fetchItems({ career, perPage = 50, totalLimit = 200, typeEq, nameContains, allowAnyName = false, slotEq, rarityEq, maxLevelRequirement, maxRenownRankRequirement, order } = {}) {
  const q = `query($first:Int,$after:String,$where: ItemFilterInput,$usableByCareer: Career,$order:[ItemSortInput!]){
    items(first:$first, after:$after, where:$where, usableByCareer:$usableByCareer, order:$order){
      nodes{ id name description type slot levelRequirement itemLevel renownRankRequirement iconUrl talismanSlots rarity uniqueEquipped careerRestriction itemSet{ id name } stats { stat value percentage } }
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
  if (rarityEq) {
    where.rarity = { eq: toEnum(rarityEq) };
  }
  if (typeof maxLevelRequirement === 'number') {
    where.levelRequirement = { lte: maxLevelRequirement };
  }
  if (typeof maxRenownRankRequirement === 'number') {
    where.renownRankRequirement = { lte: maxRenownRankRequirement };
  }
  // Use server-side career filter when provided; we will fallback without it if needed
  const usableCareer = career ? mapCareerEnum(career) : undefined;
  let out = [];
  let after = undefined;
  let currentFirst = Math.max(1, Math.min(Number(perPage) || 50, 50));
  // Fetch pages, reducing page size if server enforces a lower maximum
  // Helper to page through results with current usable flag
  async function pageAll(usableOverride) {
    after = undefined;
    // loop while hasNext to avoid constant-condition warning
    let hasNext = true;
    while (hasNext) {
      let data;
      try {
        data = await post(q, { first: currentFirst, after, where, usableByCareer: usableOverride, order });
      } catch (err) {
        const msg = String(err?.message || '');
        if (/maximum allowed items per page/i.test(msg) && currentFirst > 1) {
          currentFirst = Math.max(1, Math.floor(currentFirst / 2));
          continue; // retry with smaller page size
        }
        throw err;
      }
      const conn = data?.items;
      const nodes = conn?.nodes || [];
      for (const n of nodes) out.push(n);
      hasNext = !!(conn?.pageInfo?.hasNextPage) && out.length < totalLimit;
      after = hasNext ? (conn.pageInfo.endCursor || undefined) : undefined;
    }
  }
  // Only use server-side career filter when provided; do not retry without it
  await pageAll(usableCareer);
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

// Optional: pre-warm the career enum cache on app load;
// non-blocking and failures are ignored.
export function warmCareerEnums() {
  // Fire and forget
  fetchCareerEnumsOnce().catch(() => {});
}
