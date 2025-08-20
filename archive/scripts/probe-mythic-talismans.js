// Probe all Mythic talismans and summarize fields relevant to Legendary support logic
// Usage: node scripts/probe-mythic-talismans.js [--limit=500]

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

function getArg(name, defVal) {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  if (!arg) return defVal;
  const v = arg.split('=')[1];
  return v;
}

async function fetchTalismansByRarity(rarity, limit = 500) {
  const per = 50;
  const byId = new Map();
  const q = `query($cursor:String,$per:Int,$where:ItemFilterInput){
    items(first:$per, after:$cursor, where:$where){
      edges{ cursor node{ id name type rarity slot itemLevel levelRequirement talismanSlots description iconUrl stats{stat value percentage} } }
      pageInfo{ hasNextPage endCursor }
    }
  }`;
  const where = { rarity: { eq: rarity }, type: { in: ['ENHANCEMENT','ENCHANTMENT','TALISMAN'] } };
  let cursor = null;
  while (byId.size < limit) {
    const data = await post(q, { cursor, per, where });
    const conn = data?.items;
    if (!conn) break;
    for (const e of (conn.edges || [])) byId.set(String(e.node.id), e.node);
    if (!conn.pageInfo?.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }
  return Array.from(byId.values());
}

function summarize(it) {
  const hasLegendWord = /legendary talisman/i.test(String(it?.name || '')) || /legendary/i.test(String(it?.description || ''));
  const isAccessory = String(it?.slot || '').toUpperCase().startsWith('JEWEL');
  const statsText = (Array.isArray(it?.stats) ? it.stats : []).map(s => `${s.percentage ? s.value + '%' : s.value} ${s.stat}`).join(', ');
  return {
    id: it.id,
    name: it.name,
    rarity: it.rarity,
    slot: it.slot,
    itemLevel: it.itemLevel,
    levelReq: it.levelRequirement,
    hasLegendWord,
    isAccessory,
    stats: statsText
  };
}

async function main() {
  const limit = parseInt(getArg('limit', '800'), 10) || 800;
  const mythics = await fetchTalismansByRarity('MYTHIC', limit);
  // Split by name marker to see which are likely "Legendary" vs other mythic types
  const withSentinel = mythics.filter(it => /sentinel/i.test(String(it?.name || '')));
  const others = mythics.filter(it => !/sentinel/i.test(String(it?.name || '')));
  console.log('Total MYTHIC talismans:', mythics.length);
  console.log('With "Sentinel" in name:', withSentinel.length);
  console.log('Other MYTHIC talismans:', others.length);
  // Show a small sample from each group
  console.log('\nSample with "Sentinel":');
  console.log(withSentinel.slice(0, 10).map(summarize));
  console.log('\nSample other MYTHIC:');
  console.log(others.slice(0, 10).map(summarize));
  // Quick check for fields we rely on in filtering logic
  const missingIlvl = mythics.filter(it => !it.itemLevel && !it.levelRequirement).length;
  console.log(`\nMYTHIC missing ilvl+levelRequirement fields: ${missingIlvl}`);
}

main().catch(e => { console.error('Probe failed:', e.message || e); process.exit(1); });
