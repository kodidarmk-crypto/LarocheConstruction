const { api } = require('../../lib/shared');

module.exports = async function handler(req, res) {
  const url = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);
  const routePath = Array.isArray(req.query?.path)
    ? req.query.path.join('/')
    : String(req.query?.path || '').replace(/^\/+/, '');
  url.pathname = `/api/admin/${routePath}`;
  return api(req, res, url);
};
