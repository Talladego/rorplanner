import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

const GQL_URL = 'https://production-api.waremu.com/graphql';

function getHeaders() {
  return {
    'content-type': 'application/json',
    'accept': 'application/json',
    // Spoof typical browser headers to mirror the site client
    'origin': 'https://killboard.returnofreckoning.com',
    'referer': 'https://killboard.returnofreckoning.com/',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  };
}

async function post(query, variables) {
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ query, variables })
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, ok: res.ok, json };
}

async function tryIntrospection() {
  // Lightweight introspection: just the Query type fields
  const query = `
    query __MiniIntrospection {
      __schema { queryType { name } }
      __type(name: "Query") {
        name
        fields { name args { name type { kind name ofType { kind name } } } }
      }
    }
  `;
  return await post(query, {});
}

async function introspectType(typeName) {
  const query = `
    query __Type($name: String!) {
      __type(name: $name) {
        kind
        name
        fields { name type { kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name } } } } } } }
        possibleTypes { kind name }
        enumValues { name }
      }
    }
  `;
  return await post(query, { name: typeName });
}

async function buildItemSetBonusSelection(outDir) {
  // Introspect union and generate fragment selection for scalar/enum fields of each possible type
  const unionName = 'ItemSetBonusValue';
  const uni = await introspectType(unionName);
  if (!uni.ok || !uni.json?.data?.__type) return '';
  const utype = uni.json.data.__type;
  try { await fs.writeFile(path.join(outDir, '_gql_type_ItemSetBonusValue.json'), JSON.stringify(utype, null, 2), 'utf8'); } catch {}
  const poss = Array.isArray(utype.possibleTypes) ? utype.possibleTypes.map(t => t.name).filter(Boolean) : [];
  const frags = [];
  for (const tname of poss) {
    const td = await introspectType(tname);
    if (!td.ok || !td.json?.data?.__type) continue;
    const tinfo = td.json.data.__type;
    try { await fs.writeFile(path.join(outDir, `_gql_type_${tname}.json`), JSON.stringify(tinfo, null, 2), 'utf8'); } catch {}
    const fields = (tinfo.fields || []).filter(f => {
      const ty = f.type;
      // unwrap NON_NULL
      const unwrap = (x) => x && x.kind === 'NON_NULL' ? x.ofType : x;
      const base = unwrap(ty);
      if (!base) return false;
      if (base.kind === 'SCALAR' || base.kind === 'ENUM') return true;
      // allow simple list of scalar/enum
      if (base.kind === 'LIST') {
        const inner = unwrap(base.ofType || {});
        return inner && (inner.kind === 'SCALAR' || inner.kind === 'ENUM');
      }
      return false;
    }).map(f => f.name);
    if (fields.length) frags.push(`... on ${tname} { ${fields.join(' ')} }`);
  }
  if (!frags.length) return '__typename';
  return `__typename ${frags.join(' ')}`;
}

function parseArgs() {
  const args = { id: '', outDir: 'public/data', save: true };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const [k, vRaw] = a.slice(2).split('=');
    const v = vRaw === undefined ? '' : vRaw;
    if (k === 'id') args.id = v;
    if (k === 'outDir') args.outDir = v;
    if (k === 'save') args.save = v === 'true' || v === '';
  }
  return args;
}

async function probeItemById(id) {
  // Candidate queries to try if introspection is disabled
  const candidates = [
    { name: 'item(id: Int!)', q: 'query($id: Int!){ item(id:$id){ id name } }', vars: { id: Number(id) } },
    { name: 'item(id: ID!)', q: 'query($id: ID!){ item(id:$id){ id name } }', vars: { id: String(id) } },
    { name: 'itemById', q: 'query($id: Int!){ itemById(id:$id){ id name } }', vars: { id: Number(id) } },
    { name: 'gameItem', q: 'query($id: Int!){ gameItem(id:$id){ id name } }', vars: { id: Number(id) } },
    { name: 'item(itemId)', q: 'query($id: Int!){ item(itemId:$id){ id name } }', vars: { id: Number(id) } },
    // A broader try using items connection with filter
    { name: 'items(filter)', q: 'query($id: Int!){ items(filter:{ id:$id }){ edges{ node{ id name } } } }', vars: { id: Number(id) } },
  ];
  for (const c of candidates) {
    try {
      const r = await post(c.q, c.vars);
      if (r.ok && r.json && !r.json.errors) {
        return { success: true, via: c.name, data: r.json.data };
      }
    } catch {}
  }
  return { success: false };
}

async function enrichItemDetails(id, bonusSel) {
  // Progressive enrichment: run multiple safe queries and merge fields
  function q(sel) { return `query($id:ID!){ item(id:$id){ ${sel} } }`; }
  const merge = (a, b) => ({ ...(a || {}), ...(b || {}) });
  let node = null;
  // Base fields
  const baseSel = 'id name description type slot rarity armor dps speed levelRequirement renownRankRequirement itemLevel uniqueEquipped careerRestriction raceRestriction iconUrl talismanSlots';
  let r = await post(q(baseSel), { id: String(id) });
  if (r.ok && r.json?.data?.item) node = r.json.data.item;
  // Try stats variants
  const statVariants = [
    'stats { stat value unit }',
    'stats { name value unit }',
    'stats { name value }',
    'stats { type value }',
    'stats { stat value percentage }',
    'stats { type value percentage }'
  ];
  for (const sv of statVariants) {
    r = await post(q(sv), { id: String(id) });
    if (r.ok && r.json?.data?.item?.stats) { node = merge(node, { stats: r.json.data.item.stats }); break; }
  }
  // Item set with bonuses where available (try multiple shapes)
  const setShapes = bonusSel && bonusSel.trim() ? [
    `itemSet { id name level bonuses { itemsRequired bonus { ${bonusSel} } } }`,
  ] : [
    'itemSet { id name level bonuses { itemsRequired } }',
    'itemSet { id name level bonuses { itemsRequired bonus { __typename } } }',
  ];
  for (const shape of setShapes) {
    r = await post(q(shape), { id: String(id) });
    if (r.ok && r.json?.data?.item?.itemSet) { node = merge(node, { itemSet: r.json.data.item.itemSet }); break; }
  }
  // Abilities and buffs minimal
  const extras = [
    'abilities { id name description }',
    'buffs { id name description }'
  ];
  for (const ex of extras) {
    r = await post(q(ex), { id: String(id) });
    if (r.ok && r.json?.data?.item) {
      const partial = r.json.data.item;
      const key = Object.keys(partial)[0];
      if (key && partial[key] !== undefined) node = merge(node, { [key]: partial[key] });
    }
  }
  // Connections (minimal: id, name)
  const connFields = [
    'rewardedFromQuests(first:5){ edges{ node{ id name } } }',
    'rewardedFromChapters(first:5){ edges{ node{ id name } } }',
  'soldByVendors(first:5){ edges{ node{ id name zone { name } } } }',
  'usedToPurchase(first:5){ edges{ node{ id name } } }',
    'dropsFromCreatures(first:5){ edges{ node{ id name } } }',
    'dropsFromGameObjects(first:5){ edges{ node{ id name } } }'
  ];
  for (const cf of connFields) {
    r = await post(q(cf), { id: String(id) });
    if (r.ok && r.json?.data?.item) {
      const partial = r.json.data.item;
      const key = Object.keys(partial)[0];
      if (key && partial[key] !== undefined) node = merge(node, { [key]: partial[key] });
    }
  }
  return node ? { via: 'item', node } : null;
}

async function main() {
  const args = parseArgs();
  const id = args.id || '435295';
  console.log(`[probe-graphql] Trying introspection...`);
  const intro = await tryIntrospection();
  if (intro.ok && intro.json && !intro.json.errors) {
    const fieldNames = intro.json?.data?.__type?.fields?.map(f => f.name) || [];
    console.log(`[probe-graphql] Introspection fields on Query: ${fieldNames.join(', ')}`);
    await fs.mkdir(args.outDir, { recursive: true }).catch(() => {});
    await fs.writeFile(path.join(args.outDir, '_gql_introspection.json'), JSON.stringify(intro.json.data, null, 2), 'utf8').catch(() => {});
    // Also inspect the Item type if present
    if (fieldNames.includes('item')) {
      const itemType = await introspectType('Item');
      if (itemType.ok && itemType.json && itemType.json.data && itemType.json.data.__type) {
        await fs.writeFile(path.join(args.outDir, '_gql_type_Item.json'), JSON.stringify(itemType.json.data.__type, null, 2), 'utf8').catch(() => {});
        const names = (itemType.json.data.__type.fields || []).map(f => f.name).join(', ');
        console.log(`[probe-graphql] Item fields: ${names}`);
      }
      const setType = await introspectType('ItemSet');
      if (setType.ok && setType.json && setType.json.data && setType.json.data.__type) {
        await fs.writeFile(path.join(args.outDir, '_gql_type_ItemSet.json'), JSON.stringify(setType.json.data.__type, null, 2), 'utf8').catch(() => {});
        const names = (setType.json.data.__type.fields || []).map(f => f.name).join(', ');
        console.log(`[probe-graphql] ItemSet fields: ${names}`);
      }
      const setBonusType = await introspectType('ItemSetBonus');
      if (setBonusType.ok && setBonusType.json && setBonusType.json.data && setBonusType.json.data.__type) {
        await fs.writeFile(path.join(args.outDir, '_gql_type_ItemSetBonus.json'), JSON.stringify(setBonusType.json.data.__type, null, 2), 'utf8').catch(() => {});
        const names = (setBonusType.json.data.__type.fields || []).map(f => f.name).join(', ');
        console.log(`[probe-graphql] ItemSetBonus fields: ${names}`);
      }
    }
  } else {
    console.log(`[probe-graphql] Introspection failed or disabled.`);
    if (intro.json && intro.json.errors) console.log(JSON.stringify(intro.json.errors));
  }

  console.log(`[probe-graphql] Probing item id=${id} with candidate queries...`);
  const probe = await probeItemById(id);
  if (!probe.success) {
    console.error(`[probe-graphql] Could not retrieve item with any candidate query.`);
    process.exitCode = 2;
    return;
  }
  console.log(`[probe-graphql] Success via '${probe.via}'. Raw data keys: ${Object.keys(probe.data || {}).join(', ')}`);

  // Build a dynamic selection for set bonus union types to retrieve readable fields
  const bonusSel = await buildItemSetBonusSelection(args.outDir).catch(() => '');
  const detail = await enrichItemDetails(id, bonusSel);
  const out = { id: String(id), probe, detail };
  if (args.save) {
    const fp = path.join(args.outDir, `_gql_item_${id}.json`);
    await fs.writeFile(fp, JSON.stringify(out, null, 2), 'utf8');
    console.log(`[probe-graphql] Saved -> ${fp}`);
  } else {
    console.log(JSON.stringify(out, null, 2));
  }
}

main().catch((err) => { console.error('[probe-graphql] Failed:', err?.message || String(err)); process.exitCode = 1; });
