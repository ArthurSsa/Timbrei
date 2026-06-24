// Production backing for the /squig measurement proxy.
//
// Locally the same proxy is mounted by the Vite dev/preview server
// (vite.config.ts) and by scripts/serve.mjs. On Netlify the build is served as
// static files with no Node server, so without this function /squig/* is
// unhandled and every measurement request fails ("Failed to load this source").
//
// Logic mirrors scripts/squig-proxy.mjs: fetch the upstream resource with a
// browser-like User-Agent and a Referer set to the target origin (some squig
// instances use hotlink protection), then return it with permissive CORS.
// Requests are restricted to an allowlist of squig.link-style hosts.

const ALLOW = [
  /(^|\.)squig\.link$/i,
  /(^|\.)hangout\.audio$/i,
  /(^|\.)github\.io$/i,
];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export default async (req) => {
  // The frontend calls /squig/<url-encoded target> (see src/app/dsp/squig.ts).
  const encoded = new URL(req.url).pathname.replace(/^\/squig\//, '');

  let target;
  try {
    target = decodeURIComponent(encoded);
  } catch {
    return new Response('bad target url', { status: 400 });
  }

  let u;
  try {
    u = new URL(target);
  } catch {
    return new Response('bad target url', { status: 400 });
  }
  if (u.protocol !== 'https:' || !ALLOW.some((re) => re.test(u.hostname))) {
    return new Response('host not allowed', { status: 403 });
  }

  try {
    const upstream = await fetch(u.href, {
      headers: { 'User-Agent': UA, Referer: u.origin + '/', Accept: '*/*' },
      redirect: 'follow',
    });
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('content-type') || 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    return new Response(
      'proxy error: ' + (err && err.message ? err.message : String(err)),
      { status: 502 },
    );
  }
};

// Netlify Functions v2: bind this function directly to the proxy path, so no
// redirect rule is needed and it takes precedence over the static SPA.
export const config = { path: '/squig/*' };
