/* Vercel Node runtime entrypoint. Every API path is handled by the shared router. */
const { api } = require('../lib/shared');

module.exports = async function handler(req, res) {
  try {
    const url = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);
    if (!url.pathname.startsWith('/api/')) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ message: 'Route API introuvable.' }));
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
