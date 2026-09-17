/* Vercel Node runtime entrypoint. Every API path is handled by the shared router. */
const { api } = require('../lib/shared');

module.exports = async function handler(req, res) {
  try {
    const rawUrl = req.url || '/';
    const url = new URL(rawUrl, `https://${req.headers.host || 'localhost'}`);
    const routePath = Array.isArray(req.query?.path) ? req.query.path.join('/') : req.query?.path;
    if (!url.pathname.startsWith('/api/')) {
      const normalizedPath = routePath ? `/api/${String(routePath).replace(/^\/+/, '')}` : `/api/${url.pathname.replace(/^\/+/, '')}`;
      url.pathname = normalizedPath;
    }
    return await api(req, res, url);
  } catch (error) {
    console.error('Request error:', error.message);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ message: 'Erreur serveur.' }));
    }
  }
};
