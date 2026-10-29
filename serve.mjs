// Dream common: the one static server every Dream tool runs.
// No dependencies. A tool's server.mjs is just:
//   import { serveFolder } from '../dream-common/serve.mjs';
//   serveFolder(import.meta.url, { name: 'Dream Paint', port: 5250 });
// It serves the tool's folder on all network interfaces and passes /dl/* through to the
// Dream Library (port 5230, or DREAM_LIBRARY), so a page only ever talks to its own origin.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm' };

const LIBRARY = new URL(process.env.DREAM_LIBRARY || 'http://127.0.0.1:5230');
function toLibrary(req, res) {
  const up = http.request({ host: LIBRARY.hostname, port: LIBRARY.port, method: req.method, path: req.url.slice(3) || '/', headers: { ...req.headers, host: LIBRARY.host } }, (r) => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  up.on('error', () => { res.writeHead(502, { 'Content-Type': 'text/plain' }); res.end('The Dream Library is not running'); });
  req.pipe(up);
}

/** Serve one file from inside `dir`; 404 for anything outside it, in a dot folder, or not a plain file. */
export function sendFile(res, dir, rel) {
  const file = path.join(dir, rel === '/' ? 'index.html' : rel);
  if (!file.startsWith(dir + path.sep) || /[\\/]\.[^\\/]/.test(file) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404);
    return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

/**
 * Serve the folder of `fileUrl` (a tool's import.meta.url) as `name` on `port`.
 * `/dl/*` goes to the Dream Library; `/common/*` serves dream-common/web (the shared browser-side kit);
 * `routes(req, res)` may answer a request first and return true.
 */
export function serveFolder(fileUrl, { name, port, routes } = {}) {
  const dir = path.dirname(fileURLToPath(fileUrl)), common = path.join(path.dirname(fileURLToPath(import.meta.url)), 'web');
  const server = http.createServer((req, res) => {
    try {
      if (routes?.(req, res)) return;
      if (req.url.startsWith('/dl/')) return toLibrary(req, res);
      let rel;
      try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end('Bad request'); } // a bad %-escape must not take the server down
      if (rel.startsWith('/common/')) return sendFile(res, common, rel.slice(7));
      sendFile(res, dir, rel);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) res.writeHead(500);
      res.end('Server error');
    }
  });
  server.on('error', (e) => { console.error(e.code === 'EADDRINUSE' ? `${name}: port ${port} is already in use (is it running already?)` : e); process.exit(1); });
  server.listen(port, '0.0.0.0', () => console.log(`${name}: http://localhost:${port}`));
  return server;
}
