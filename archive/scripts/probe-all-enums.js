// Probe and list all GraphQL enum types and their values via introspection.
// Usage:
//   node scripts/probe-all-enums.js

import fetch from 'node-fetch';

const GQL_URL = 'https://production-api.waremu.com/graphql';

async function post(query, variables) {
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
      // Mirror headers from site client to avoid odd rejections
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

async function main() {
  const q = `{
    __schema {
      types {
        name
        kind
        enumValues { name description }
      }
    }
  }`;
  const data = await post(q, {});
  const types = data?.__schema?.types || [];
  const enums = types
    .filter(t => t && t.kind === 'ENUM' && t.name && !t.name.startsWith('__'))
    .map(t => ({ name: t.name, values: (t.enumValues || []).map(v => v.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const out = Object.fromEntries(enums.map(e => [e.name, e.values]));
  console.log(JSON.stringify(out, null, 2));
}

main().catch(e => { console.error('Probe failed:', e.message || e); process.exit(1); });
