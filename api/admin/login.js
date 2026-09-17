const { api } = require('../../lib/shared');

module.exports = async function handler(req, res) {
  const url = new URL(req.url || '/api/admin/login', `https://${req.headers.host || 'localhost'}`);
  url.pathname = '/api/admin/login';
  return api(req, res, url);
};
