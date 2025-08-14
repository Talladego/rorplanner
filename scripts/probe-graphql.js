// Probe GraphQL enum values via introspection (defaults to Career)
// Usage:
//   node scripts/probe-graphql.js --enum=Career
//   node scripts/probe-graphql.js --enum=ItemSlot

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

function getArg(name, defVal) {
	const arg = process.argv.find(a => a.startsWith(`--${name}=`));
	if (!arg) return defVal;
	return arg.split('=')[1];
}

async function main() {
	const enumName = getArg('enum', 'Career');
	const q = `query($name:String!){
		__type(name:$name){
			name kind
			enumValues { name description }
		}
	}`;
	const data = await post(q, { name: enumName });
	const t = data?.__type;
	if (!t || t.kind !== 'ENUM') {
		console.error(`Type ${enumName} not found or not an ENUM.`);
		process.exit(2);
	}
	const values = (t.enumValues || []).map(v => v.name);
	console.log(JSON.stringify({ enum: enumName, values }, null, 2));
}

main().catch(e => { console.error('Probe failed:', e.message || e); process.exit(1); });
