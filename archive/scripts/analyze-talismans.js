// Analyze public/data/talismans.json for matching patterns
// Usage: node scripts/analyze-talismans.js
import fs from 'fs/promises';

function wordFreq(arr, pick) {
  const map = new Map();
  for (const it of arr) {
    const text = (pick(it) || '').toLowerCase();
    for (const m of text.matchAll(/[a-z']+/g)) {
      const w = m[0];
      map.set(w, (map.get(w) || 0) + 1);
    }
  }
  return Array.from(map.entries()).sort((a,b) => b[1]-a[1]).slice(0, 100);
}

function groupBy(arr, key) {
  const m = new Map();
  for (const it of arr) {
    const k = key(it);
    const g = m.get(k) || []; g.push(it); m.set(k, g);
  }
  return m;
}

function hasLegendaryHost(desc) { return /legendary talisman/i.test(String(desc||'')); }
function isLegendaryTalis(it) { return /sentinel/i.test(String(it?.name||'')) && String(it?.rarity||'').toUpperCase()==='MYTHIC'; }
function isTwilightTide(it) { return /twilight'?s?\s+tide/i.test(String(it?.description||'')); }

async function main() {
  const raw = await fs.readFile('public/data/talismans.json','utf8').catch(()=>'');
  if (!raw) { console.log('No talisman dump found.'); return; }
  const data = JSON.parse(raw);
  const items = Array.isArray(data.items) ? data.items : [];
  console.log('Total talismans loaded:', items.length);
  const mythics = items.filter(x => String(x?.rarity||'').toUpperCase()==='MYTHIC');
  const sentinelMythics = mythics.filter(isLegendaryTalis);
  const otherMythics = mythics.filter(x => !isLegendaryTalis(x));
  console.log('MYTHIC:', mythics.length, 'Sentinel-named:', sentinelMythics.length, 'Other MYTHIC:', otherMythics.length);
  // Common description phrases across talismans
  console.log('\nTop words in talisman descriptions:');
  console.log(wordFreq(items, it => it.description).slice(0, 40));
  // Look for phrases like "only works on" and extract following tokens
  const onlyWorks = items.filter(it => /only works on/i.test(String(it.description||'')));
  console.log('\nTalismans with phrase "only works on":', onlyWorks.length);
  const afterWorks = onlyWorks.map(it => String(it.description||'').split(/only works on/i)[1]||'').map(s=>s.trim()).filter(Boolean);
  console.log('Examples after "only works on":', afterWorks.slice(0, 10));
  // Names containing event markers
  const twilight = items.filter(isTwilightTide);
  console.log('\nTwilight Tide talismans:', twilight.length);
  // Slots and types distribution
  const byType = groupBy(items, it => it.type);
  const bySlot = groupBy(items, it => it.slot);
  console.log('\nTypes:', Array.from(byType, ([k,v]) => [k, v.length]));
  console.log('Slots:', Array.from(bySlot, ([k,v]) => [k, v.length]));
}

main().catch(e => { console.error('analyze failed:', e.message || e); process.exitCode = 1; });
