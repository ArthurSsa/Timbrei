// Standalone local server: serves the production build in dist/ and proxies
// CrinGraph / squig.link data through /squig. This is the one-command way to
// host Timbrei locally (see `npm run start`): no Rust toolchain and no external
// services are required.

import http from 'http';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { handleSquig } from './squig-proxy.mjs';

const DIST = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');
const PORT = Number(process.env.PORT) || 4178;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

if (!existsSync(DIST)) {
  console.error('dist/ not found. Run `npm run build` first (or `npm run start`).');
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  const url = decodeURI((req.url || '/').split('?')[0]);

  if (url.startsWith('/squig/')) {
    return handleSquig(req, res, url.slice('/squig'.length));
  }

  // Static files, with SPA fallback to index.html.
  const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
  let file = join(DIST, rel);
  if (!file.startsWith(DIST)) {
    res.statusCode = 403;
    return res.end('forbidden');
  }
  try {
    let body = await readFile(file).catch(() => null);
    if (body === null) {
      file = join(DIST, 'index.html');
      body = await readFile(file);
    }
    res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end('not found');
  }
});

server.listen(PORT, () => {
  console.log(`Timbrei is running at http://localhost:${PORT}`);
});
