/* eslint-env node */
import process from 'node:process';
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
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors) {
    const msg = (json.errors && json.errors[0] && (json.errors[0].message || json.errors[0].extensions?.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json.data;
}

async function fetchBySlot(slot, limit = 2000) {
  const q = `query($first:Int,$after:String,$where: ItemFilterInput){
    items(first:$first, after:$after, where:$where){
      edges{ node{ id name description slot type itemLevel renownRankRequirement uniqueEquipped } }
      pageInfo{ hasNextPage endCursor }
    }
  }`;
  const where = { slot: { eq: slot } };
  const out = [];
  let after = undefined;
  let hasNext = true;
  while (hasNext) {
    const data = await post(q, { first: 50, after: after || null, where });
    const conn = data?.items;
    const edges = conn?.edges || [];
    for (const e of edges) out.push(e.node);
    hasNext = !!(conn?.pageInfo?.hasNextPage) && out.length < limit;
    after = hasNext ? (conn.pageInfo.endCursor || undefined) : undefined;
  }
  return out;
}

function inferLock(node) {
  const desc = String(node?.description || '').toLowerCase();
  const m = /only\s+be\s+equipped\s+in\s+jewel(?:ler)?y\s+slot\s+([1-4])/i.exec(desc);
  if (m) return Number(m[1]);
  return 0; // 0 = unlocked
}

async function main() {
  const slots = ['JEWELLERY1','JEWELLERY2','JEWELLERY3','JEWELLERY4'];
  const report = { generatedAt: new Date().toISOString(), bySlot: {} };
  for (const slot of slots) {
    const items = await fetchBySlot(slot);
    const counts = { total: items.length, locked: 0, unlocked: 0, locks: { } };
    for (const it of items) {
      const lockN = inferLock(it);
      if (lockN) {
        counts.locked += 1;
        const k = `slot${lockN}`;
        counts.locks[k] = (counts.locks[k] || 0) + 1;
      } else {
        counts.unlocked += 1;
      }
    }
    report.bySlot[slot] = counts;
  }
  const outPath = path.join('public','data','_audit_jewelry_locks.json');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('Saved audit ->', outPath);
  for (const [slot, c] of Object.entries(report.bySlot)) {
    console.log(`${slot}: total=${c.total}, locked=${c.locked}, unlocked=${c.unlocked}`);
  }
}

main().catch(e => { console.error('Audit failed:', e?.message || String(e)); process.exitCode = 1; });
