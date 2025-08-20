// Lightweight schema loader used at runtime to fetch introspection data (enum values, SDL endpoint hints).
// Does not depend on graphql package; performs small introspection queries to populate enum values.
const DEFAULT_ENDPOINT = 'https://production-api.waremu.com/graphql';

function detectEndpoint() {
  try {
    // Prefer Vite-provided proxy URL when available
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GQL_PROXY_URL) {
      return import.meta.env.VITE_GQL_PROXY_URL;
    }
  } catch (_) {}
  try {
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      return '/graphql';
    }
  } catch (_) {}
  return DEFAULT_ENDPOINT;
}

const ENDPOINT = detectEndpoint();

let _loaded = false;
let _enumMap = Object.create(null);
let _rawSchema = null;

async function fetchIntrospection() {
  // Minimal introspection to capture enum values and basic type names.
  const q = `query IntrospectionForEnums { __schema { types { kind name enumValues(includeDeprecated: true) { name } } } }`;
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept': 'application/json' },
    body: JSON.stringify({ query: q })
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Introspection request failed: ${res.status} ${txt}`);
  }
  const parsed = await res.json();
  if (!parsed || !parsed.data || !parsed.data.__schema) {
    throw new Error('Introspection response missing __schema');
  }
  _rawSchema = parsed.data.__schema;
  const types = _rawSchema.types || [];
  for (const t of types) {
    if (t && t.kind === 'ENUM' && Array.isArray(t.enumValues)) {
      _enumMap[t.name] = t.enumValues.map(v => v.name);
    }
  }
  _loaded = true;
}

export async function ensureSchemaLoaded() {
  if (_loaded) return { enumMap: _enumMap, raw: _rawSchema };
  try {
    await fetchIntrospection();
  } catch (e) {
    // Do not throw for consumers; surface the error but allow app to continue.
    console.error('schemaLoader: failed to load schema:', e.message);
  }
  return { enumMap: _enumMap, raw: _rawSchema };
}

export function getEnumValues(name) {
  return _enumMap[name] ? Array.from(_enumMap[name]) : [];
}

export function getEndpoint() {
  return ENDPOINT;
}

export function getRawSchema() {
  return _rawSchema;
}

export default {
  ensureSchemaLoaded,
  getEnumValues,
  getEndpoint,
  getRawSchema
};
