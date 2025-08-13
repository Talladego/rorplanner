import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

const GQL_URL = 'https://production-api.waremu.com/graphql';

function headers() {
  return {
    'content-type': 'application/json',
    accept: 'application/json',
    origin: 'https://killboard.returnofreckoning.com',
    referer: 'https://killboard.returnofreckoning.com/',
    'user-agent': 'Mozilla/5.0'
  };
}

async function post(query, variables) {
  const res = await fetch(GQL_URL, { method: 'POST', headers: headers(), body: JSON.stringify({ query, variables }) });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

async function introspectEnum(name) {
  const q = `query($name:String!){ __type(name:$name){ kind name enumValues{ name } } }`;
  const r = await post(q, { name });
  if (!r.ok || r.json.errors) throw new Error(`Failed to introspect ${name}: ${JSON.stringify(r.json.errors||r.status)}`);
  return r.json.data.__type;
}

async function main(){
  const outDir = 'public/data';
  await fs.mkdir(outDir, { recursive: true });
  const enums = ['EquipSlot','ItemType','ItemRarity','Career'];
  for (const en of enums) {
    const data = await introspectEnum(en);
    const fp = path.join(outDir, `_gql_enum_${en}.json`);
    await fs.writeFile(fp, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Saved -> ${fp}`);
  }
}

main().catch(e => { console.error('[introspect-enums] Failed:', e.message || String(e)); process.exitCode = 1; });
