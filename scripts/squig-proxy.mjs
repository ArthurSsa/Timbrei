// Shared proxy for CrinGraph / squig.link data.
//
// Browsers cannot read these databases directly: the responses lack CORS
// headers, and some instances reject requests without a matching Referer
// (hotlink protection). This handler fetches the upstream resource with a
// browser-like User-Agent and a Referer set to the target origin, then returns
// it with permissive CORS. Requests are restricted to an allowlist of
// squig.link-style hosts so the proxy cannot be used to reach arbitrary hosts.
//
// It is mounted at `/squig/<url-encoded target>` by both the Vite dev server
// (see vite.config.ts) and the standalone server (scripts/serve.mjs).

const ALLOW = [
  /(^|\.)squig\.link$/i,
  /(^|\.)hangout\.audio$/i,
  /(^|\.)github\.io$/i,
];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// `rest` is the request path after the `/squig` mount, beginning with `/`.
export async function handleSquig(req, res, rest) {
  try {
    const encoded = (rest ?? '').replace(/^\//, '');
    const target = decodeURIComponent(encoded);

    let u;
    try {
      u = new URL(target);
    } catch {
      res.statusCode = 400;
      return res.end('bad target url');
    }
    if (u.protocol !== 'https:' || !ALLOW.some(re => re.test(u.hostname))) {
      res.statusCode = 403;
      return res.end('host not allowed');
    }

    const upstream = await fetch(u.href, {
      headers: { 'User-Agent': UA, Referer: u.origin + '/', Accept: '*/*' },
      redirect: 'follow',
    });
    const body = Buffer.from(await upstream.arrayBuffer());

    res.statusCode = upstream.status;
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/plain; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.end(body);
  } catch (err) {
    res.statusCode = 502;
    res.end('proxy error: ' + (err && err.message ? err.message : String(err)));
  }
}
