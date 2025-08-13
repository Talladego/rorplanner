export default {
  async fetch(request: Request): Promise<Response> {
    const target = 'https://production-api.waremu.com/graphql';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'content-type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Forward the request body; strip problematic headers
    const reqHeaders = new Headers(request.headers);
    reqHeaders.delete('origin');
    reqHeaders.delete('referer');
    reqHeaders.set('content-type', 'application/json');

    const resp = await fetch(target, {
      method: 'POST',
      headers: reqHeaders,
      body: await request.text(),
    });

    // Clone response and add CORS headers
    const outHeaders = new Headers(resp.headers);
    outHeaders.set('Access-Control-Allow-Origin', '*');
    outHeaders.set('Access-Control-Expose-Headers', '*');

    const body = await resp.arrayBuffer();
    return new Response(body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: outHeaders,
    });
  },
};
