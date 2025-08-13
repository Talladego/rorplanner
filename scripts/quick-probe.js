// Quick probe for item fields from GraphQL
// Usage: node scripts/quick-probe.js --id=907479,907279,907399

const GQL_URL = 'https://production-api.waremu.com/graphql';

async function post(query, variables) {
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
      // Spoof typical browser headers to mirror the site client
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

function parseIds() {
  const arg = process.argv.find(a => a.startsWith('--id=')) || '';
  const ids = arg.split('=')[1] || '';
  return ids.split(',').map(s => s.trim()).filter(Boolean);
}

async function main() {
  const ids = parseIds();
  if (!ids.length) {
    console.log('No --id provided');
    process.exit(1);
  }
  const q = `query($id:ID!){ item(id:$id){ id name type slot rarity levelRequirement itemLevel talismanSlots } }`;
  for (const id of ids) {
    try {
      const data = await post(q, { id: String(id) });
      const it = data?.item;
      console.log(JSON.stringify({ id, ok: !!it, item: it }, null, 2));
    } catch (e) {
      console.log(JSON.stringify({ id, ok: false, error: String(e.message || e) }));
    }
  }
}

main();
