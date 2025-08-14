// Introspect and demo how ItemsConnection works for retrieving items
// Usage: node scripts/probe-items-connection.js

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

function unwrapType(t) {
  // Recursively unwrap NON_NULL/LIST to get underlying name and a string form
  const parts = [];
  let cur = t;
  while (cur) {
    if (cur.kind === 'NON_NULL') { parts.push('!'); cur = cur.ofType; continue; }
    if (cur.kind === 'LIST') { parts.unshift('['); parts.push(']'); cur = cur.ofType; continue; }
    if (cur.name) { parts.splice(parts[0] === '[' ? 1 : 0, 0, cur.name); break; }
    cur = cur.ofType;
  }
  return { name: cur?.name || t?.name || '', display: parts.join('') || (cur?.name || '') };
}

async function introspectItemsConnection() {
  const q = `{
    __schema { queryType { name } }
    queryType: __type(name: "Query") { fields { name type { kind name ofType { kind name ofType { kind name } } } args { name type { kind name ofType { kind name ofType { kind name } } } } } }
    itemsConn: __type(name: "ItemsConnection") { fields { name type { kind name ofType { kind name ofType { kind name } } } } }
    itemEdge: __type(name: "ItemEdge") { fields { name type { kind name ofType { kind name ofType { kind name } } } } }
    pageInfo: __type(name: "PageInfo") { fields { name type { kind name ofType { kind name ofType { kind name } } } } }
  itemFilter: __type(name: "ItemFilterInput") { inputFields { name type { kind name ofType { kind name ofType { kind name } } } } }
  itemSort: __type(name: "ItemSortInput") { inputFields { name type { kind name ofType { kind name ofType { kind name } } } } }
  sortEnum: __type(name: "SortEnumType") { name kind enumValues { name description } }
  }`;
  const data = await post(q, {});
  const itemsField = (data?.queryType?.fields || []).find(f => f.name === 'items') || null;
  const formatArgs = (args) => (args || []).map(a => ({ name: a.name, type: unwrapType(a.type).display }));
  const result = {
    queryField: {
      name: 'items',
      args: formatArgs(itemsField?.args),
      returns: unwrapType(itemsField?.type).display
    },
    itemsConnection: (data?.itemsConn?.fields || []).map(f => ({ name: f.name, type: unwrapType(f.type).display })),
    itemEdge: (data?.itemEdge?.fields || []).map(f => ({ name: f.name, type: unwrapType(f.type).display })),
    pageInfo: (data?.pageInfo?.fields || []).map(f => ({ name: f.name, type: unwrapType(f.type).display })),
  itemFilter: (data?.itemFilter?.inputFields || []).map(f => ({ name: f.name, type: unwrapType(f.type).display })),
  itemSort: (data?.itemSort?.inputFields || []).map(f => ({ name: f.name, type: unwrapType(f.type).display })),
  sortEnum: (data?.sortEnum?.enumValues || []).map(v => v.name)
  };
  return result;
}

async function demoListQuery() {
  const q = `query($first:Int,$where: ItemFilterInput,$order:[ItemSortInput!]){
    items(first:$first, where:$where, order:$order){
      nodes{ id name slot rarity itemLevel levelRequirement renownRankRequirement itemSet{ id name } }
      pageInfo{ hasNextPage endCursor }
    }
  }`;
  const where = {
    slot: { eq: 'HELM' },
    levelRequirement: { lte: 40 },
    renownRankRequirement: { lte: 80 },
  };
  const order = [ { itemLevel: 'DESC' }, { rarity: 'DESC' } ];
  const data = await post(q, { first: 10, where, order });
  const nodes = data?.items?.nodes || [];
  return {
    sampleCount: nodes.length,
    sample: nodes.slice(0, 5).map(n => ({ id: n.id, name: n.name, slot: n.slot, rarity: n.rarity, ilvl: n.itemLevel })),
    pageInfo: data?.items?.pageInfo || null
  };
}

async function main() {
  const schema = await introspectItemsConnection();
  const demo = await demoListQuery();
  console.log(JSON.stringify({ ok: true, schema, demo }, null, 2));
}

main().catch(e => { console.error(JSON.stringify({ ok: false, error: String(e.message || e) })); process.exit(1); });
