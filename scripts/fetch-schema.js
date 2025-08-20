#!/usr/bin/env node
// Fetch GraphQL schema to src/schema.from-server.graphql
// Strategy: try npx get-graphql-schema, fall back to introspection + graphql print
import {spawnSync} from 'child_process';
import fs from 'fs';
import https from 'https';
import {buildClientSchema, printSchema, getIntrospectionQuery} from 'graphql';

const ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'https://production-api.waremu.com/graphql';
const OUT_SDL = 'src/schema.from-server.graphql';
const OUT_JSON = 'src/schema.introspection.json';

function tryNpx() {
  console.log('Trying npx get-graphql-schema...');
  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const res = spawnSync(cmd, ['--yes', 'get-graphql-schema', ENDPOINT], {encoding: 'utf8', maxBuffer: 10 * 1024 * 1024});
  if (res.error) {
    console.log('npx failed:', res.error.message);
    return false;
  }
  if (res.status !== 0) {
    console.log('npx exited non-zero:', res.status, res.stderr);
    return false;
  }
  try {
    fs.writeFileSync(OUT_SDL, res.stdout, 'utf8');
    console.log('Wrote', OUT_SDL);
    return true;
  } catch (e) {
    console.log('Write failed:', e.message);
    return false;
  }
}

function introspect() {
  console.log('Falling back to introspection...');
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({query: getIntrospectionQuery()});
    const u = new URL(ENDPOINT);
    const opts = {method: 'POST', hostname: u.hostname, path: u.pathname + (u.search || ''), headers: {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body)}};
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          fs.writeFileSync(OUT_JSON, data, 'utf8');
        } catch (e) {
          return reject(e);
        }
        let parsed;
        try { parsed = JSON.parse(data); } catch (e) { return reject(e); }
        if (!parsed.data) return reject(new Error('No data in introspection result'));
        try {
          const schema = buildClientSchema(parsed.data);
          const sdl = printSchema(schema);
          fs.writeFileSync(OUT_SDL, sdl, 'utf8');
          console.log('Wrote', OUT_SDL);
          resolve(true);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', e => reject(e));
    req.write(body);
    req.end();
  });
}

(async function main(){
  try {
    if (tryNpx()) return;
    await introspect();
  } catch (e) {
    console.error('Failed to fetch schema:', e.message);
    process.exit(1);
  }
})();
