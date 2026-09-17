const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const sessions = new Map();
const attempts = new Map();

function loadEnv() {
  if (process.env.VERCEL) return;
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1');
  }
}
loadEnv();
const publishableKey = () => process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const secretKey = () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}
function fail(res, status, message) { return send(res, status, { message }); }
function jsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2_000_000) reject(new Error('RequÃƒÂªte trop volumineuse.')); });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('JSON invalide.')); }
    });
    req.on('error', reject);
  });
}
async function db(endpoint, options = {}, key = secretKey()) {
  if (!process.env.SUPABASE_URL || !key) throw new Error('Configuration Supabase absente.');
  const r = await fetch(`${process.env.SUPABASE_URL}${endpoint}`, {
    ...options,
    headers: { apikey: key, Authorization: ['Bearer', key].join(' '), 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!r.ok) throw new Error(data?.message || data?.hint || `Supabase HTTP ${r.status}`);
  return data;
}
async function notifyTelegram(lead) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return false;
  const message = [
    'Nouveau projet Laroche Construction',
    `Nom : ${lead.first_name} ${lead.last_name}`,
    `Email : ${lead.email}`,
    `TÃƒÂ©lÃƒÂ©phone : ${lead.phone}`,
    `Budget : ${lead.budget ?? 'Non prÃƒÂ©cisÃƒÂ©'} FCFA`,
    `Estimation : ${lead.estimate_amount ?? 'Non prÃƒÂ©cisÃƒÂ©e'} FCFA`
  ].join('\n');
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: message })
  });
  return response.ok;
}
function cookie(req, name) {
  return (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${name}=`))?.slice(name.length + 1);
}
function sessionSecret() {
  return secretKey() || process.env.SUPABASE_URL || 'laroche-admin-session-secret';
}
function encodeSession(session) {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
function decodeSession(value) {
  if (!value) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', sessionSecret()).update(payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return parsed && typeof parsed.userId === 'string' && Number.isFinite(parsed.expiresAt) ? parsed : null;
  } catch {
    return null;
  }
}
function session(req) {
  const s = decodeSession(cookie(req, 'laroche_admin'));
  if (!s || s.expiresAt < Date.now()) return null;
  return s;
}
function admin(req, res) {
  const s = session(req);
  if (!s) { fail(res, 401, 'Session absente.'); return null; }
  return s;
}
const emailOk = value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
const text = (v, max) => typeof v === 'string' && v.length <= max ? v.trim() : '';
const idPath = (base, id) => `${base}/${encodeURIComponent(id)}`;
const safeFields = 'id,slug,name,type,surface,surfaces,price,description,cover_path,status,created_at,updated_at';

async function api(req, res, url) {
  const p = url.pathname.startsWith('/api/') ? url.pathname : `/api/${url.pathname.replace(/^\/+/, '')}`;
  if (p === '/api/health' && req.method === 'GET') {
    await db('/rest/v1/site_stats?select=id&limit=1', {}, publishableKey());
    return send(res, 200, { ok: true, supabase: 'connected' });
  }
  if (p === '/api/public/settings' && req.method === 'GET') {
    const rows = await db('/rest/v1/site_settings?select=key,value', {}, publishableKey());
    const settings = Object.fromEntries((rows || []).map(x => [x.key, typeof x.value === 'string' ? x.value : x.value?.value ?? x.value]));
    return send(res, 200, { settings });
  }
  if (p === '/api/public/stats' && req.method === 'GET') return send(res, 200, (await db('/rest/v1/site_stats?select=projects,experience,collaborators,cities,clients&limit=1', {}, publishableKey()))[0] || {});
  if (p === '/api/public/plans' && req.method === 'GET') return send(res, 200, await db(`/rest/v1/public_plans?select=${safeFields}&order=price.asc,created_at.desc`, {}, publishableKey()));
  if (p === '/api/public/news' && req.method === 'GET') return send(res, 200, await db('/rest/v1/public_news?select=*&order=published_on.desc,created_at.desc', {}, publishableKey()));
  if (p.match(/^\/api\/public\/news\/[^/]+$/) && req.method === 'GET') {
    const id = p.split('/').pop();
    const rows = await db(`/rest/v1/public_news?select=*&id=eq.${encodeURIComponent(id)}&limit=1`, {}, publishableKey());
    return rows[0] ? send(res, 200, rows[0]) : fail(res, 404, 'ActualitÃƒÂ© introuvable.');
  }
  if (p === '/api/public/videos' && req.method === 'GET') return send(res, 200, await db('/rest/v1/public_videos?select=*&order=published_at.desc&limit=9', {}, publishableKey()));
  if (p === '/api/public/social-links' && req.method === 'GET') return send(res, 200, await db('/rest/v1/public_social_links?select=*', {}, publishableKey()));

  if (p === '/api/newsletter/subscribe' && req.method === 'POST') {
    const b = await jsonBody(req), e = String(b.email || '').trim().toLowerCase();
    if (!emailOk(e)) return fail(res, 400, 'Adresse email invalide.');
    const source = ['website', 'plan-order', 'project-quiz', 'contact'].includes(b.source) ? b.source : 'website';
    const rows = await db('/rest/v1/newsletter_subscribers?on_conflict=email', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ email: e, source, status: 'active' }) });
    return send(res, 200, { ok: true, subscriber: rows?.[0] ? { id: rows[0].id, email: rows[0].email } : undefined });
  }
  if (p === '/api/project-leads' && req.method === 'POST') {
    const b = await jsonBody(req);
    const contact = b.contact && typeof b.contact === 'object' ? b.contact : b;
    const estimate = b.estimate && typeof b.estimate === 'object' ? b.estimate : b;
    if (!text(contact.first_name || contact.firstName, 120) || !text(contact.last_name || contact.lastName, 120) || !emailOk(contact.email) || !text(contact.phone, 40)) return fail(res, 400, 'CoordonnÃƒÂ©es invalides.');
    const lead = { first_name: text(contact.first_name || contact.firstName, 120), last_name: text(contact.last_name || contact.lastName, 120), email: contact.email.trim().toLowerCase(), phone: text(contact.phone, 40), budget: Number.isFinite(Number(contact.budget)) ? Number(contact.budget) : null, estimate_amount: Number.isFinite(Number(estimate.amount)) ? Number(estimate.amount) : null, quiz: b.quiz && typeof b.quiz === 'object' ? b.quiz : {} };
    const rows = await db('/rest/v1/project_leads', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(lead) });
    const telegramSent = await notifyTelegram(lead).catch(() => false);
    if (rows?.[0]?.id) await db(`/rest/v1/project_leads?id=eq.${encodeURIComponent(rows[0].id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ telegram_status: telegramSent ? 'sent' : 'failed' }) }).catch(() => {});
    await db('/rest/v1/newsletter_subscribers?on_conflict=email', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ email: lead.email, source: 'project-quiz', status: 'active' }) }).catch(() => {});
    return send(res, 201, { ok: true, lead: rows?.[0] && { id: rows[0].id } });
  }
  if (p === '/api/plan-orders' && req.method === 'POST') {
    const b = await jsonBody(req);
    const planId = b.plan_id || b.planId;
    if (!planId || !text(b.name, 180) || !emailOk(b.email) || !text(b.phone, 40)) return fail(res, 400, 'Commande invalide.');
    const plans = await db(`/rest/v1/plans?select=id,price,status&id=eq.${encodeURIComponent(planId)}`, {}, secretKey());
    const plan = plans[0]; if (!plan || plan.status !== 'published') return fail(res, 400, 'Plan indisponible.');
    const amount = Number(plan.price); const rows = await db('/rest/v1/plan_orders', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ plan_id: plan.id, name: text(b.name, 180), email: b.email.trim().toLowerCase(), phone: text(b.phone, 40), surface: text(b.surface, 80), requirements: text(b.requirements, 4000), amount, currency: 'XAF' }) });
    return send(res, 201, { ok: true, order: rows?.[0] && { id: rows[0].id, amount, currency: 'XAF', status: 'pending' }, payment: { status: 'not_configured', message: 'Le paiement Monetbil sera activÃƒÂ© aprÃƒÂ¨s configuration du webhook.' } });
  }

  if (p === '/api/admin/login' && req.method === 'POST') {
    const b = await jsonBody(req), e = String(b.email || '').trim().toLowerCase(), pin = String(b.pin || '');
    const a = attempts.get(e) || { count: 0, until: 0 };
    if (a.until > Date.now()) return fail(res, 429, 'Trop de tentatives. RÃƒÂ©essayez plus tard.');
    if (!emailOk(e) || !b.password || !/^\d{6}$/.test(pin)) return fail(res, 400, 'Email, mot de passe et PIN ÃƒÂ  six chiffres requis.');
    const auth = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: publishableKey(), 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, password: b.password }) });
    if (!auth.ok) { a.count++; if (a.count >= 5) a.until = Date.now() + 15 * 60 * 1000; attempts.set(e, a); return fail(res, 401, 'Identifiants incorrects.'); }
    const token = await auth.json();
    const admins = await db(`/rest/v1/admin_users?select=user_id&user_id=eq.${encodeURIComponent(token.user.id)}`);
    let verified = false; if (admins.length) verified = await db('/rest/v1/rpc/verify_admin_pin_public', { method: 'POST', body: JSON.stringify({ requested_user_id: token.user.id, requested_pin: pin }) }).catch(() => false);
    if (!admins.length || verified !== true) { a.count++; if (a.count >= 5) a.until = Date.now() + 15 * 60 * 1000; attempts.set(e, a); return fail(res, 401, 'PIN incorrect ou compte non autorisÃƒÂ©.'); }
    attempts.delete(e);
    const sessionValue = encodeSession({ userId: token.user.id, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
    return send(res, 200, { ok: true }, { 'Set-Cookie': `laroche_admin=${sessionValue}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800` });
  }
  if (p === '/api/admin/session' && req.method === 'GET') return session(req) ? send(res, 200, { authenticated: true }) : fail(res, 401, 'Session absente.');
  if (p === '/api/admin/logout' && req.method === 'POST') return send(res, 200, { ok: true }, { 'Set-Cookie': 'laroche_admin=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0' });
  const s = p.startsWith('/api/admin/') ? admin(req, res) : null; if (p.startsWith('/api/admin/') && !s) return;
  if (p === '/api/admin/plans' && req.method === 'GET') return send(res, 200, await db(`/rest/v1/plans?select=*&order=created_at.desc`));
  if (p === '/api/admin/news' && req.method === 'GET') return send(res, 200, await db('/rest/v1/news?select=*&order=created_at.desc'));
  if (p === '/api/admin/stats' && req.method === 'GET') return send(res, 200, (await db('/rest/v1/site_stats?select=*&limit=1'))[0] || {});
  if (p === '/api/admin/settings' && req.method === 'GET') return send(res, 200, await db('/rest/v1/site_settings?select=*'));
  if (p === '/api/admin/videos' && req.method === 'GET') return send(res, 200, await db('/rest/v1/videos?select=*&order=published_at.desc'));
  if (p === '/api/admin/newsletter/subscribers' && req.method === 'GET') return send(res, 200, await db('/rest/v1/newsletter_subscribers?select=id,email,source,status,created_at&order=created_at.desc'));
  if (p === '/api/admin/orders' && req.method === 'GET') return send(res, 200, await db('/rest/v1/plan_orders?select=id,plan_id,name,email,phone,amount,currency,status,delivery_status,created_at&order=created_at.desc'));
  if (p === '/api/admin/project-leads' && req.method === 'GET') return send(res, 200, await db('/rest/v1/project_leads?select=id,first_name,last_name,email,phone,budget,estimate_amount,telegram_status,created_at&order=created_at.desc'));
  if (p.match(/^\/api\/admin\/newsletter\/[^/]+\/unsubscribe$/) && req.method === 'POST') { const id = p.split('/')[4]; await db(idPath('/rest/v1/newsletter_subscribers', id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'unsubscribed' }) }); return send(res, 200, { ok: true }); }

  const match = p.match(/^\/api\/admin\/(plans|news)\/([^/]+)$/);
  if (match && ['PUT', 'DELETE'].includes(req.method)) {
    const table = match[1], id = match[2];
    if (req.method === 'DELETE') { await db(idPath(`/rest/v1/${table}`, id), { method: 'DELETE' }); return send(res, 204, null); }
    const b = await jsonBody(req); delete b.id; delete b.pdf_path; delete b.created_at; const allowed = table === 'plans' ? ['slug','name','type','surface','surfaces','price','description','cover_path','status'] : ['title','category','summary','content','location','image_path','published_on','status'];
    const update = Object.fromEntries(allowed.filter(k => b[k] !== undefined).map(k => [k, b[k]])); await db(idPath(`/rest/v1/${table}`, id), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(update) }); return send(res, 200, { ok: true });
  }
  if ((p === '/api/admin/plans' || p === '/api/admin/news') && req.method === 'POST') {
    const b = await jsonBody(req), table = p.endsWith('plans') ? 'plans' : 'news'; const allowed = table === 'plans' ? ['slug','name','type','surface','surfaces','price','description','cover_path','pdf_path','status'] : ['title','category','summary','content','location','image_path','published_on','date','status']; const value = Object.fromEntries(allowed.filter(k => b[k] !== undefined).map(k => [k === 'date' ? 'published_on' : k, b[k]]));
    if (table === 'plans' && !value.slug && value.name) value.slug = String(value.name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `plan-${Date.now()}`;
    if (table === 'plans' && (!text(value.name, 160) || !['residential','commercial','industrial','civil'].includes(value.type))) return fail(res, 400, 'Plan invalide.');
    const rows = await db(`/rest/v1/${table}`, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(value) }); return send(res, 201, rows?.[0] || {});
  }
  if (p === '/api/admin/stats' && req.method === 'PUT') { const b = await jsonBody(req), value = Object.fromEntries(['projects','experience','collaborators','cities','clients'].filter(k => Number.isInteger(Number(b[k])) && Number(b[k]) >= 0).map(k => [k, Number(b[k])])); await db('/rest/v1/site_stats?id=eq.true', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(value) }); return send(res, 200, { ok: true }); }
  if (p === '/api/admin/settings' && req.method === 'PUT') { const b = await jsonBody(req); for (const [key, value] of Object.entries(b)) if (/^[a-z][a-z0-9_.-]{1,80}$/.test(key) && typeof value !== 'object') await db(`/rest/v1/site_settings?key=eq.${encodeURIComponent(key)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ value, updated_by: s.userId }) }); return send(res, 200, { ok: true }); }
  return fail(res, 404, 'Route API introuvable.');
}


module.exports = { api };
