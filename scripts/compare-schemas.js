import fs from 'fs';
import fetch from 'node-fetch';

const localPath = 'src/schema.from-server.graphql';
if (!fs.existsSync(localPath)) {
	console.error('No local fetched schema found at', localPath);
	process.exit(2);
}
const local = fs.readFileSync(localPath,'utf8');
const rx = /^\s*(type|input|enum|union|interface|scalar)\s+([A-Za-z0-9_]+)/mg;
async function run(){
	// Fetch a fresh copy from production to compare
	const res = await fetch('https://production-api.waremu.com/graphql', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({query: '{ __schema { types { kind name } } }'})});
	if (!res.ok) { console.error('Failed to fetch remote introspection', res.status); process.exit(3); }
	const json = await res.json();
	const namesRemote = (json?.data?.__schema?.types || []).map(t=>t.name).filter(Boolean).sort();
	const namesLocal = [...local.matchAll(rx)].map(m=>m[2]).sort();
	const onlyLocal = namesLocal.filter(x=>!namesRemote.includes(x));
	const onlyRemote = namesRemote.filter(x=>!namesLocal.includes(x));
	const out = {onlyInLocalFetchedFile: onlyLocal, onlyInRemote: onlyRemote, localCount: namesLocal.length, remoteCount: namesRemote.length};
	fs.mkdirSync('tmp', {recursive:true});
	fs.writeFileSync('tmp/schema-diff.json', JSON.stringify(out,null,2),'utf8');
	console.log('WROTE tmp/schema-diff.json');
}

run().catch(e=>{ console.error(e); process.exit(1); });
