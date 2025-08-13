import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

const GQL_URL = 'https://production-api.waremu.com/graphql';

function hdr() {
  return {
    'content-type': 'application/json',
    'accept': 'application/json',
    'origin': 'https://killboard.returnofreckoning.com',
    'referer': 'https://killboard.returnofreckoning.com/',
    'user-agent': 'Mozilla/5.0'
  };
}
async function post(query, variables) {
  const res = await fetch(GQL_URL, { method: 'POST', headers: hdr(), body: JSON.stringify({ query, variables }) });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}

function parseArgs() {
  const args = {
    slot: '', career: '', type: '', rarity: '', name: '',
    minItemLevel: '', maxItemLevel: '', minRenown: '', maxRenown: '',
    first: 20, after: '', out: 'public/data/_gql_items_search.json'
  };
  for (let i=2;i<process.argv.length;i++) {
    const a = process.argv[i]; if (!a.startsWith('--')) continue;
    const [k, vRaw] = a.slice(2).split('='); const v = vRaw === undefined ? '' : vRaw;
    if (k in args) args[k] = v;
    if (k === 'first') args.first = Number(v) || 20;
  }
  return args;
}

function unwrapType(t) {
  let cur = t; while (cur && cur.kind === 'NON_NULL') cur = cur.ofType; return cur || t;
}

async function introspectType(typeName) {
  const q = `query __Type($name: String!){ __type(name:$name){ kind name
    fields { name args { name type { kind name ofType { kind name ofType { kind name } } } } type { kind name ofType { kind name ofType { kind name } } } }
    inputFields { name type { kind name ofType { kind name ofType { kind name } } } }
    possibleTypes { kind name }
    enumValues { name }
  } }`;
  const r = await post(q, { name: typeName });
  return r.json?.data?.__type || null;
}

async function getQueryItemsShape() {
  const Q = await introspectType('Query');
  if (!Q) return null;
  const itemsField = (Q.fields || []).find(f => f.name === 'items');
  if (!itemsField) return null;
  const args = itemsField.args || [];
  const whereArg = args.find(a => a.name === 'where');
  const usableArg = args.find(a => a.name === 'usableByCareer');
  const hasStatsArg = args.find(a => a.name === 'hasStats');
  const firstArg = args.find(a => a.name === 'first');
  const afterArg = args.find(a => a.name === 'after');
  const filterType = whereArg ? unwrapType(whereArg.type).name : '';
  const filterInput = filterType ? await introspectType(filterType) : null;
  const connType = unwrapType(itemsField.type).name; // ItemsConnection
  const conn = connType ? await introspectType(connType) : null;
  return { itemsField, filterInput, firstArg, afterArg, usableArg, hasStatsArg, connType, conn };
}

function toEnum(val) { return String(val || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_'); }

function buildFilter(inputSpec, args) {
  if (!inputSpec) return {};
  const fields = inputSpec.inputFields || [];
  const f = {};
  const byName = new Map(fields.map(x => [x.name, x]));
  const baseName = (n) => { const fd = byName.get(n); return fd ? unwrapType(fd.type).name : ''; };
  // slot
  if (args.slot && byName.has('slot')) {
    const bn = baseName('slot');
    if (/OperationFilterInput$/i.test(bn)) f.slot = { eq: toEnum(args.slot) };
  }
  // type
  if (args.type && byName.has('type')) {
    const bn = baseName('type');
    if (/OperationFilterInput$/i.test(bn)) f.type = { eq: toEnum(args.type) };
  }
  // rarity
  if (args.rarity && byName.has('rarity')) {
    const bn = baseName('rarity');
    if (/OperationFilterInput$/i.test(bn)) f.rarity = { eq: toEnum(args.rarity) };
  }
  // name contains
  if (args.name && byName.has('name')) {
    const bn = baseName('name');
    if (/StringOperationFilterInput$/i.test(bn)) f.name = { contains: args.name };
  }
  // item level bounds (only include if provided)
  const hasMinIL = args.minItemLevel !== '';
  const hasMaxIL = args.maxItemLevel !== '';
  const minIL = hasMinIL ? Number(args.minItemLevel) : NaN;
  const maxIL = hasMaxIL ? Number(args.maxItemLevel) : NaN;
  if ((byName.has('itemLevel')) && (hasMinIL || hasMaxIL)) {
    const cmp = {};
    if (hasMinIL && !Number.isNaN(minIL)) cmp.gte = minIL;
    if (hasMaxIL && !Number.isNaN(maxIL)) cmp.lte = maxIL;
    if (Object.keys(cmp).length) f.itemLevel = cmp;
  }
  // renown bounds
  const hasMinRR = args.minRenown !== '';
  const hasMaxRR = args.maxRenown !== '';
  const minRR = hasMinRR ? Number(args.minRenown) : NaN;
  const maxRR = hasMaxRR ? Number(args.maxRenown) : NaN;
  if ((byName.has('renownRankRequirement')) && (hasMinRR || hasMaxRR)) {
    const cmp = {};
    if (hasMinRR && !Number.isNaN(minRR)) cmp.gte = minRR;
    if (hasMaxRR && !Number.isNaN(maxRR)) cmp.lte = maxRR;
    if (Object.keys(cmp).length) f.renownRankRequirement = cmp;
  }
  return f;
}

async function queryItems(params) {
  const { where, first, after, usableByCareer } = params;
  const q = `query($first:Int,$after:String,$where: ItemFilterInput,$usableByCareer: Career){
    items(first:$first, after:$after, where:$where, usableByCareer:$usableByCareer){
      edges{ node{ id name type slot itemLevel renownRankRequirement iconUrl talismanSlots rarity } }
      pageInfo{ hasNextPage endCursor }
    }
  }`;
  return await post(q, { first, after: after || null, where, usableByCareer: usableByCareer || null });
}

async function main(){
  const args = parseArgs();
  const shape = await getQueryItemsShape();
  if (!shape) { console.error('items field not found on Query'); process.exitCode=2; return; }
  const where = buildFilter(shape.filterInput, args);
  const usableByCareer = args.career ? toEnum(args.career) : '';
  const res = await queryItems({ where, first: args.first, after: args.after, usableByCareer });
  if (!res.ok || res.json.errors) {
    console.error('Query failed', res.json.errors || res.status);
    process.exitCode = 3; return;
  }
  const data = res.json.data.items;
  await fs.mkdir(path.dirname(args.out), { recursive: true });
  await fs.writeFile(args.out, JSON.stringify({ args, where, usableByCareer, data }, null, 2), 'utf8');
  console.log(`Saved -> ${args.out} (edges=${data.edges?.length || 0})`);
}

main().catch(e => { console.error('Failed:', e?.message || String(e)); process.exitCode = 1; });
