/* Local backend. Static files are served here; API routes use the shared handler. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { api } = require('./lib/shared');

const root = __dirname;
const port = Number(process.env.PORT || 3000);

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}
function fail(res, status, message) { return send(res, status, { message }); }
function staticFile(res, url) {
  let requested = decodeURIComponent(url.pathname); if (requested === '/') requested = '/index.html';
  const file = path.resolve(root, `.${requested}`);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return fail(res, 404, 'Fichier introuvable.');
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
  res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' }); fs.createReadStream(file).pipe(res);
}
http.createServer(async (req, res) => {
  try { const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); if (url.pathname.startsWith('/api/')) return await api(req, res, url); return staticFile(res, url); }
  catch (e) { console.error('Request error:', e.message); if (!res.headersSent) fail(res, 500, 'Erreur serveur.'); }
}).listen(port, () => console.log(`Laroche local server: http://localhost:${port}`));
