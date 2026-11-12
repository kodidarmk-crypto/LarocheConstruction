const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { getServiceSupabaseClient } = require("./supabase");
const { sendEmailViaGoogleAppsScript } = require("./email");
const root = path.resolve(__dirname, "..");
const sessions = new Map();
const attempts = new Map();
const ipAttempts = new Map();
const publicRateLimits = new Map();

function loadEnv() {
  if (process.env.VERCEL) return;
  const file = path.join(root, ".env");
  if (!fs.existsSync(file)) return;
  let raw = fs.readFileSync(file, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
  }
}
loadEnv();

const publishableKey = () =>
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const secretKey = () =>
  (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  ).trim();

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(body));
}
function fail(res, status, message) {
  return send(res, status, { ok: false, message });
}

function jsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 2_000_000)
        reject(new Error("Requête trop volumineuse."));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

function urlEncodedBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 2_000_000)
        reject(new Error("Requête trop volumineuse."));
    });
    req.on("end", () => {
      try {
        const params = new URLSearchParams(body);
        resolve(parseMonetbilParameters(params.entries()));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function db(endpoint, options = {}, key = secretKey()) {
  if (!process.env.SUPABASE_URL || !key)
    throw new Error("Configuration Supabase absente.");
  const r = await fetch(`${process.env.SUPABASE_URL}${endpoint}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: ["Bearer", key].join(" "),
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!r.ok)
    throw new Error(data?.message || data?.hint || `Supabase HTTP ${r.status}`);
  return data;
}

async function notifyTelegram(lead) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    console.error("Telegram lead delivery is not configured.");
    return "rejected";
  }
  try {
    const quizDetails =
      lead.quiz && typeof lead.quiz === "object"
        ? Object.entries(lead.quiz)
            .map(
              ([k, v]) =>
                `• ${k} : ${typeof v === "object" ? JSON.stringify(v) : v}`,
            )
            .join("\n")
        : "";
    const message = [
      "🏗️ Nouveau projet — Laroche Construction",
      `👤 Nom : ${lead.first_name || ""} ${lead.last_name || ""}`,
      `📧 Email : ${lead.email || ""}`,
      `📞 Téléphone : ${lead.phone || ""}`,
      `💰 Budget indicatif : ${lead.budget ? lead.budget + " FCFA" : "Non précisé"}`,
      `📊 Estimation indicative : ${lead.estimate_amount ? lead.estimate_amount + " FCFA" : "Non précisée"}`,
      quizDetails ? `\n📋 Paramètres du quiz :\n${quizDetails}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const result = await response.json().catch(() => null);
    if (response.ok && result?.ok === true) return "sent";
    console.error(
      "Telegram lead delivery rejected.",
      `HTTP ${response.status}`,
      result?.error_code || "",
    );
    return "rejected";
  } catch (error) {
    console.error(
      "Telegram lead delivery was not confirmed.",
      error instanceof Error ? error.name : "UnknownError",
    );
    return "unknown";
  }
}

async function notifyTelegramPlanPurchase(order, plan) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID)
    return false;
  try {
    const message = [
      "🎉 Nouveau plan acheté !",
      `👤 Client : ${order.name || ""}`,
      `📞 Téléphone : ${order.phone || ""}`,
      `📧 Email : ${order.email || ""}`,
      `📐 Plan : ${plan?.name || order.plan_id}`,
      `💵 Montant : ${order.amount} FCFA`,
      `🆔 Réf Commande : ${order.id}`,
    ].join("\n");
    const response = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: message,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const result = await response.json().catch(() => null);
    return response.ok && result?.ok === true;
  } catch {
    console.error("Erreur Telegram achat plan: réponse non confirmée.");
    return false;
  }
}

async function sendPlanPdfByEmail(order, plan) {
  const rawPath = typeof plan?.pdf_path === "string" ? plan.pdf_path : "";
  const storagePath = rawPath.replace(/^plans-private\//, "");
  if (
    !storagePath ||
    storagePath.startsWith("/") ||
    storagePath.includes("\\") ||
    storagePath.split("/").includes("..")
  ) {
    throw new Error("PDF du plan introuvable ou chemin non valide.");
  }
  const { data, error } = await getServiceSupabaseClient()
    .storage.from("plans-private")
    .createSignedUrl(storagePath, 90);
  if (error || !data?.signedUrl)
    throw new Error("Lien temporaire du PDF indisponible.");
  const response = await fetch(data.signedUrl, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok)
    throw new Error(
      `Téléchargement du PDF impossible (HTTP ${response.status}).`,
    );
  const bytes = Buffer.from(await response.arrayBuffer());
  if (
    bytes.length < 8 ||
    bytes.length > 20 * 1024 * 1024 ||
    bytes.subarray(0, 5).toString() !== "%PDF-"
  ) {
    throw new Error(
      "Le fichier associé au plan n’est pas un PDF valide ou dépasse 20 Mo.",
    );
  }
  const safeName =
    String(plan.name || "plan")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "plan";
  await sendEmailViaGoogleAppsScript({
    to: order.email,
    subject: `Votre plan ${plan.name || ""} — Laroche Construction`,
    textBody: `Bonjour ${order.name || ""},\n\nVeuillez trouver ci-joint le plan ${plan.name || ""}.\n\nMerci pour votre confiance.\nLaroche Construction`,
    attachments: [
      {
        name: `${safeName}.pdf`,
        mimeType: "application/pdf",
        base64: bytes.toString("base64"),
      },
    ],
  });
  return true;
}

async function updateDeliveryStatus(orderId, deliveryStatus) {
  await db(`/rest/v1/plan_orders?id=eq.${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ delivery_status: deliveryStatus }),
  });
}

// In-memory 5-minute cache for YouTube API
let youtubeCache = { data: null, timestamp: 0 };
async function fetchYouTubeVideos() {
  const now = Date.now();
  if (youtubeCache.data && now - youtubeCache.timestamp < 5 * 60 * 1000)
    return youtubeCache.data;
  const key = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  if (!key || !channelId || !/^UC[A-Za-z0-9_-]{20,}$/.test(channelId))
    throw new Error("YouTube API credentials are not configured.");
  const uploadsPlaylistId = `UU${channelId.slice(2)}`;
  try {
    const playlistUrl = new URL(
      "https://www.googleapis.com/youtube/v3/playlistItems",
    );
    playlistUrl.search = new URLSearchParams({
      key,
      playlistId: uploadsPlaylistId,
      part: "snippet,contentDetails",
      maxResults: "50",
    }).toString();
    const playlistResponse = await fetch(playlistUrl, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!playlistResponse.ok)
      throw new Error(`YouTube playlist API HTTP ${playlistResponse.status}.`);
    const playlist = await playlistResponse.json();
    const ids = (playlist.items || [])
      .map(
        (item) =>
          item.contentDetails?.videoId || item.snippet?.resourceId?.videoId,
      )
      .filter(Boolean);
    if (!ids.length) {
      youtubeCache = { data: [], timestamp: now };
      return [];
    }
    const statsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    statsUrl.search = new URLSearchParams({
      key,
      id: ids.join(","),
      part: "statistics",
    }).toString();
    const statsResponse = await fetch(statsUrl, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!statsResponse.ok)
      throw new Error(`YouTube statistics API HTTP ${statsResponse.status}.`);
    const stats = await statsResponse.json();
    const viewsById = new Map(
      (stats.items || []).map((item) => [
        item.id,
        Number(item.statistics?.viewCount || 0),
      ]),
    );
    const items = (playlist.items || [])
      .map((item) => {
        const snippet = item.snippet || {};
        const id = item.contentDetails?.videoId || snippet.resourceId?.videoId;
        return {
          id,
          youtube_id: id,
          title: snippet.title || "",
          description: snippet.description || "",
          thumbnail:
            snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url,
          published_at: snippet.publishedAt,
          views: viewsById.get(id) || 0,
          status: "published",
        };
      })
      .filter((item) => item.id)
      .sort((a, b) =>
        String(b.published_at).localeCompare(String(a.published_at)),
      );
    youtubeCache = { data: items, timestamp: now };
    return items;
  } catch (error) {
    console.error(
      "YouTube API request failed.",
      error instanceof Error ? error.name : "UnknownError",
    );
    throw error;
  }
}

function cookie(req, name) {
  return (req.headers.cookie || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
function sessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim() || "";
  if (secret.length < 32)
    throw new Error(
      "Configuration de session administrateur absente ou invalide.",
    );
  return secret;
}
function encodeSession(session) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}
function decodeSession(value) {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = crypto
    .createHmac("sha256", sessionSecret())
    .update(payload)
    .digest();
  const actual = Buffer.from(signature, "base64url");
  if (
    actual.length !== expected.length ||
    !crypto.timingSafeEqual(actual, expected)
  )
    return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return parsed &&
      typeof parsed.userId === "string" &&
      Number.isFinite(parsed.expiresAt)
      ? parsed
      : null;
  } catch {
    return null;
  }
}
function session(req) {
  const s = decodeSession(cookie(req, "laroche_admin"));
  if (!s || s.expiresAt < Date.now()) return null;
  return s;
}
function admin(req, res) {
  const s = session(req);
  if (!s) {
    fail(res, 401, "Session absente.");
    return null;
  }
  return s;
}
function sameOriginMutation(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  try {
    const parsed = new URL(origin);
    if (
      parsed.host.toLowerCase() === host &&
      ["http:", "https:"].includes(parsed.protocol)
    )
      return true;
  } catch {}
  fail(res, 403, "Origine de requête refusée.");
  return false;
}
function clientAddress(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return forwarded || req.socket?.remoteAddress || "unknown";
}
function allowRate(map, key, limit, windowMs) {
  const now = Date.now();
  let entry = map.get(key);
  if (!entry || entry.until <= now) entry = { count: 0, until: now + windowMs };
  entry.count++;
  map.set(key, entry);
  return entry.count <= limit;
}
function normalizedNetworkUrl(network, value) {
  const domains = {
    facebook: ["facebook.com", "fb.com"],
    instagram: ["instagram.com"],
    linkedin: ["linkedin.com"],
    tiktok: ["tiktok.com"],
    youtube: ["youtube.com", "youtu.be"],
    x: ["x.com", "twitter.com"],
  };
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      !domains[network]?.some(
        (domain) => host === domain || host.endsWith(`.${domain}`),
      ) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return "";
    return url.toString();
  } catch {
    return "";
  }
}

const emailOk = (value) =>
  typeof value === "string" &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) &&
  value.length <= 254;
const text = (v, max) =>
  typeof v === "string" && v.length <= max ? v.trim() : "";
const idPath = (base, id) => `${base}/${encodeURIComponent(id)}`;
const safeFields =
  "id,slug,name,type,surface,surfaces,price,description,cover_path,characteristics,status,created_at,updated_at";
const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
const consentVersion = "newsletter-v1";

async function subscribeNewsletter(email, source) {
  await db("/rest/v1/newsletter_subscribers?on_conflict=email", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      email,
      source,
      status: "active",
      consented_at: new Date().toISOString(),
      consent_source: source,
      consent_version: consentVersion,
    }),
  });
}

function canonicalMonetbilValues(parameters) {
  return Object.keys(parameters)
    .filter((key) => key !== "sign")
    .sort()
    .map((key) => parameters[key])
    .join("");
}

function verifyMonetbilSignature(parameters, secret) {
  if (typeof parameters.sign !== "string" || !secret) return false;
  const expected = crypto
    .createHash("md5")
    .update(`${secret}${canonicalMonetbilValues(parameters)}`)
    .digest();
  const supplied = Buffer.from(parameters.sign, "hex");
  return (
    supplied.length === expected.length &&
    crypto.timingSafeEqual(supplied, expected)
  );
}

function parseMonetbilParameters(parameters) {
  const result = {};
  for (const [key, value] of parameters) {
    if (Object.hasOwn(result, key))
      throw new Error("Paramètre Monetbil dupliqué.");
    result[key] = value;
  }
  return result;
}

async function api(req, res, url) {
  const p = url.pathname.startsWith("/api/")
    ? url.pathname
    : `/api/${url.pathname.replace(/^\/+/, "")}`;

  // Public Health
  if (p === "/api/health" && req.method === "GET") {
    return send(res, 200, { ok: true, uptime: process.uptime() });
  }

  // Public Stats
  if (p === "/api/public/stats" && req.method === "GET") {
    try {
      const rows = await db(
        "/rest/v1/public_site_stats?select=projects,experience,collaborators,cities,clients&limit=1",
        {},
        publishableKey(),
      );
      return send(res, 200, rows?.[0] || {});
    } catch {
      return fail(
        res,
        503,
        "Les chiffres du site sont temporairement indisponibles.",
      );
    }
  }

  if (p === "/api/public/site-settings" && req.method === "GET") {
    try {
      const rows = await db(
        "/rest/v1/public_site_settings?select=key,value",
        {},
        publishableKey(),
      );
      return send(
        res,
        200,
        Object.fromEntries((rows || []).map((row) => [row.key, row.value])),
      );
    } catch {
      return send(res, 200, {});
    }
  }

  // Public Social Links
  if (p === "/api/public/social-links" && req.method === "GET") {
    try {
      const rows = await db(
        "/rest/v1/public_social_links?select=*",
        {},
        publishableKey(),
      );
      return send(res, 200, rows || []);
    } catch {
      return send(res, 200, []);
    }
  }

  // Public Plans
  if (p === "/api/public/plans" && req.method === "GET") {
    try {
      const rows = await db(
        `/rest/v1/public_plans?select=${safeFields}&order=price.asc,created_at.desc`,
        {},
        publishableKey(),
      );
      return send(res, 200, rows || []);
    } catch (error) {
      console.error(
        "Catalogue des plans indisponible.",
        error instanceof Error ? error.name : "UnknownError",
      );
      return fail(
        res,
        503,
        "Le catalogue des plans est temporairement indisponible.",
      );
    }
  }

  // Private plan downloads are restricted to authenticated administrators.
  if (p.startsWith("/api/plans/download")) {
    const sessionUser = admin(req, res);
    if (!sessionUser) return;
    const orderId = url.searchParams.get("order_id");
    if (!orderId) return fail(res, 400, "Référence de commande manquante.");

    const orders = await db(
      `/rest/v1/plan_orders?select=id,plan_id,status&id=eq.${encodeURIComponent(orderId)}&limit=1`,
    );
    const order = orders?.[0];
    if (!order || order.status !== "paid")
      return fail(res, 403, "Téléchargement non autorisé.");

    const plans = await db(
      `/rest/v1/plans?select=id,name,pdf_path&id=eq.${encodeURIComponent(order.plan_id)}&limit=1`,
    );
    const plan = plans?.[0];
    const storagePath =
      typeof plan?.pdf_path === "string"
        ? plan.pdf_path.replace(/^plans-private\//, "")
        : "";
    if (
      !storagePath ||
      storagePath.startsWith("/") ||
      storagePath.includes("\\") ||
      storagePath.split("/").includes("..")
    ) {
      return fail(res, 404, "Fichier PDF introuvable.");
    }

    const { data, error } = await getServiceSupabaseClient()
      .storage.from("plans-private")
      .createSignedUrl(storagePath, 60);
    if (error || !data?.signedUrl)
      throw new Error("Création du lien privé de téléchargement impossible.");
    res.writeHead(302, {
      Location: data.signedUrl,
      "Cache-Control": "no-store",
    });
    return res.end();
  }

  if (p === "/api/public/order-status" && req.method === "GET") {
    const orderId = url.searchParams.get("order_id") || "";
    if (!isUuid(orderId))
      return fail(res, 400, "Référence de commande invalide.");
    const orders = await db(
      `/rest/v1/plan_orders?select=id,status,delivery_status&id=eq.${encodeURIComponent(orderId)}&limit=1`,
    );
    const order = orders?.[0];
    return order
      ? send(res, 200, {
          status: order.status,
          delivery_status: order.delivery_status,
        })
      : fail(res, 404, "Commande introuvable.");
  }

  // Anonymous, non-identifying daily page/plan view counts (no IP or contact data stored).
  if (p === "/api/public/analytics" && req.method === "POST") {
    if (!allowRate(publicRateLimits, clientAddress(req), 90, 60 * 60 * 1000))
      return fail(res, 429, "Trop de statistiques envoyées.");
    const b = await jsonBody(req);
    const visitorId = String(b.visitor_id || "");
    const eventType = String(b.event_type || "");
    const pagePath = text(b.page_path, 180);
    const planId = b.plan_id || null;
    if (
      !isUuid(visitorId) ||
      !["page_view", "plan_view"].includes(eventType) ||
      !pagePath.startsWith("/") ||
      pagePath.includes("..") ||
      pagePath.length > 180 ||
      (eventType === "plan_view" && !isUuid(planId)) ||
      (eventType === "page_view" && planId !== null)
    ) {
      return fail(res, 400, "Événement de fréquentation invalide.");
    }
    try {
      if (eventType === "plan_view") {
        const plans = await db(
          `/rest/v1/plans?select=id&id=eq.${encodeURIComponent(planId)}&status=eq.published&limit=1`,
          {},
          publishableKey(),
        );
        if (!plans?.length) return send(res, 202, { ok: true });
      }
      await db("/rest/v1/rpc/record_site_analytics", {
        method: "POST",
        body: JSON.stringify({
          p_visitor_id: visitorId,
          p_event_type: eventType,
          p_page_path: pagePath,
          p_plan_id: planId,
        }),
      });
      return send(res, 202, { ok: true });
    } catch {
      return fail(res, 503, "Les statistiques ne sont pas disponibles.");
    }
  }

  // Public News
  if (p === "/api/public/news" && req.method === "GET") {
    try {
      const rows = await db(
        "/rest/v1/public_news?select=*&order=published_on.desc,created_at.desc",
        {},
        publishableKey(),
      );
      return send(res, 200, rows || []);
    } catch {
      return fail(res, 503, "Les actualités sont temporairement indisponibles.");
    }
  }
  if (p.match(/^\/api\/public\/news\/[^/]+$/) && req.method === "GET") {
    const id = p.split("/").pop();
    if (!isUuid(id)) return fail(res, 404, "Actualité introuvable.");
    try {
      const rows = await db(
        `/rest/v1/public_news?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
        {},
        publishableKey(),
      );
      return rows[0]
        ? send(res, 200, rows[0])
        : fail(res, 404, "Actualité introuvable.");
    } catch {
      return fail(res, 503, "Cette actualité est temporairement indisponible.");
    }
  }

  // Public YouTube Videos
  if (p === "/api/public/videos" && req.method === "GET") {
    if (!process.env.YOUTUBE_API_KEY || !process.env.YOUTUBE_CHANNEL_ID) {
      return fail(
        res,
        503,
        "Le catalogue vidéo YouTube est temporairement indisponible.",
      );
    }
    try {
      return send(res, 200, await fetchYouTubeVideos());
    } catch (error) {
      console.error(
        "Catalogue YouTube indisponible.",
        error instanceof Error ? error.name : "UnknownError",
      );
      return fail(
        res,
        503,
        "Le catalogue vidéo YouTube est temporairement indisponible.",
      );
    }
  }

  // Newsletter Subscribe
  if (p === "/api/newsletter/subscribe" && req.method === "POST") {
    const b = await jsonBody(req),
      e = String(b.email || "")
        .trim()
        .toLowerCase();
    if (!emailOk(e)) return fail(res, 400, "Adresse email invalide.");
    if (b.consent !== true)
      return fail(res, 400, "Le consentement explicite est requis.");
    const source = [
      "website",
      "project-quiz",
      "contact",
      "plan-order",
    ].includes(b.source)
      ? b.source
      : "website";
    try {
      await subscribeNewsletter(e, source);
    } catch (error) {
      console.error(
        "Newsletter: stockage du consentement indisponible.",
        error instanceof Error ? error.name : "UnknownError",
      );
      return fail(
        res,
        503,
        "L’inscription à la newsletter est temporairement indisponible. Réessayez plus tard.",
      );
    }
    return send(res, 200, { ok: true });
  }

  // Project Leads (from 7-step wizard quiz)
  if (p === "/api/project-leads" && req.method === "POST") {
    const b = await jsonBody(req);
    const contact = b.contact && typeof b.contact === "object" ? b.contact : b;
    const estimate =
      b.estimate && typeof b.estimate === "object" ? b.estimate : b;
    const firstName = text(contact.first_name || contact.firstName, 120);
    const lastName = text(contact.last_name || contact.lastName, 120);
    const email = String(contact.email || "")
      .trim()
      .toLowerCase();
    const phone = text(contact.phone, 40);

    if (!firstName || !lastName || !emailOk(email) || phone.length < 5) {
      return fail(res, 400, "Coordonnées invalides.");
    }

    const budget =
      contact.budget === "" || contact.budget === undefined
        ? null
        : Number(contact.budget);
    const estimateAmount =
      estimate.amount === "" || estimate.amount === undefined
        ? null
        : Number(estimate.amount);
    if (
      (budget !== null && (!Number.isSafeInteger(budget) || budget < 0)) ||
      (estimateAmount !== null &&
        (!Number.isSafeInteger(estimateAmount) || estimateAmount < 0))
    ) {
      return fail(res, 400, "Montant du projet invalide.");
    }

    const quiz =
      b.quiz && typeof b.quiz === "object" && !Array.isArray(b.quiz)
        ? Object.fromEntries(
            Object.entries(b.quiz)
              .filter(
                ([key, value]) =>
                  /^[a-z0-9-]{1,40}$/i.test(key) && typeof value === "string",
              )
              .slice(0, 12)
              .map(([key, value]) => [key, text(value, 120)]),
          )
        : {};
    const lead = {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      budget,
      estimate_amount: estimateAmount,
      quiz,
    };

    const requestHashSecret = process.env.ADMIN_SESSION_SECRET?.trim() || "";
    if (requestHashSecret.length < 32)
      return fail(
        res,
        503,
        "Le formulaire projet est temporairement indisponible. Réessayez plus tard.",
      );
    const requestHash = crypto
      .createHmac("sha256", requestHashSecret)
      .update(`project-quote-v1:${JSON.stringify(lead)}`)
      .digest("hex");
    let claim;
    try {
      claim = await db("/rest/v1/rpc/claim_project_request", {
        method: "POST",
        body: JSON.stringify({ p_request_hash: requestHash }),
      });
    } catch {
      return fail(
        res,
        503,
        "Le compteur de demandes est temporairement indisponible. Réessayez plus tard.",
      );
    }
    if (!claim?.claimed) {
      const priorStatus = claim?.status;
      if (priorStatus === "sent") {
        let newsletter = "not_requested";
        if (b.newsletter_consent === true) {
          try {
            await subscribeNewsletter(email, "project-quiz");
            newsletter = "subscribed";
          } catch {
            newsletter = "failed";
          }
        }
        return send(res, 200, {
          ok: true,
          quote: { status: "sent" },
          newsletter: { status: newsletter },
        });
      }
      if (priorStatus === "processing")
        return send(res, 202, {
          ok: false,
          quote: { status: "processing" },
          newsletter: { status: "not_requested" },
        });
    }

    const telegramStatus = await notifyTelegram(lead);
    const quoteStatus =
      telegramStatus === "sent"
        ? "sent"
        : telegramStatus === "unknown"
          ? "processing"
          : "failed";
    await db("/rest/v1/rpc/complete_project_request", {
      method: "POST",
      body: JSON.stringify({
        p_request_hash: requestHash,
        p_sent: quoteStatus === "sent",
      }),
    }).catch(() => {
      console.error("Finalisation du compteur de demandes impossible.");
    });

    let newsletterStatus = "not_requested";
    if (b.newsletter_consent === true) {
      try {
        await subscribeNewsletter(email, "project-quiz");
        newsletterStatus = "subscribed";
      } catch {
        console.error(
          "Inscription newsletter du formulaire projet impossible.",
        );
        newsletterStatus = "failed";
      }
    }

    const quote = { status: quoteStatus };
    const newsletter = { status: newsletterStatus };
    if (quoteStatus === "sent")
      return send(res, 201, { ok: true, quote, newsletter });
    if (quoteStatus === "processing")
      return send(res, 202, { ok: false, quote, newsletter });
    return send(res, 502, {
      ok: false,
      quote,
      newsletter,
      message:
        "La demande de devis n’a pas été transmise. Vous pouvez réessayer.",
    });
  }

  // Plan Orders + Monetbil Payment Integration
  if (p === "/api/plan-orders" && req.method === "POST") {
    const b = await jsonBody(req);
    const planId = b.plan_id || b.planId;
    const lastName = text(b.last_name || b.lastName, 100);
    const firstName = text(b.first_name || b.firstName, 100);
    const fullName = text(b.name || `${firstName} ${lastName}`.trim(), 180);
    const email = String(b.email || "")
      .trim()
      .toLowerCase();
    const phone = text(b.phone, 40);

    if (!isUuid(planId) || !fullName || !emailOk(email) || phone.length < 5) {
      return fail(res, 400, "Coordonnées de commande incomplètes.");
    }

    const plans = await db(
      `/rest/v1/plans?select=id,name,price,status,pdf_path&id=eq.${encodeURIComponent(planId)}`,
    );
    const plan = plans?.[0];
    if (!plan || plan.status !== "published")
      return fail(res, 400, "Plan indisponible.");
    if (!plan.pdf_path)
      return fail(res, 409, "Le fichier PDF privé de ce plan n’est pas prêt.");

    let newsletterStatus = "not_requested";
    if (b.newsletter_consent === true) {
      try {
        await subscribeNewsletter(email, "plan-order");
        newsletterStatus = "subscribed";
      } catch {
        console.error("Inscription newsletter de la commande impossible.");
        newsletterStatus = "failed";
      }
    }

    const amount = Number(plan.price || 0);
    if (!Number.isSafeInteger(amount) || amount < 0)
      return fail(res, 400, "Prix de plan invalide.");
    if (amount === 0) {
      if (!plan.pdf_path)
        return fail(
          res,
          409,
          "Le PDF de ce plan gratuit n’est pas encore disponible.",
        );
      const freeOrderRows = await db("/rest/v1/plan_orders", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          plan_id: plan.id,
          name: fullName,
          email,
          phone,
          amount: 0,
          currency: "XAF",
          status: "paid",
          paid_at: new Date().toISOString(),
          delivery_status: "pending",
        }),
      });
      const freeOrder = freeOrderRows?.[0];
      if (!freeOrder?.id)
        throw new Error("Création de commande gratuite sans identifiant.");
      let delivery = "failed";
      try {
        await sendPlanPdfByEmail(freeOrder, plan);
        delivery = "sent";
      } catch (error) {
        console.error(
          "Envoi du plan gratuit impossible.",
          error instanceof Error ? error.name : "UnknownError",
        );
      }
      await updateDeliveryStatus(freeOrder.id, delivery).catch(() => {});
      return send(res, 201, {
        ok: true,
        order: { id: freeOrder.id, status: "paid" },
        delivery: { status: delivery },
        newsletter: { status: newsletterStatus },
      });
    }

    const serviceKey = process.env.MONETBIL_SERVICE_KEY?.trim();
    const secretKey = process.env.MONETBIL_SECRET_KEY?.trim();
    let notifyUrl;
    try {
      notifyUrl = new URL(process.env.MONETBIL_NOTIFY_URL || "");
    } catch {
      return send(res, 503, {
        ok: false,
        message: "La configuration du paiement Monetbil est incomplète.",
        newsletter: { status: newsletterStatus },
      });
    }
    const localNotifyHost = ["localhost", "127.0.0.1"].includes(
      notifyUrl.hostname,
    );
    if (
      !serviceKey ||
      !secretKey ||
      notifyUrl.pathname !== "/api/monetbil/notify" ||
      notifyUrl.username ||
      notifyUrl.password ||
      notifyUrl.search ||
      notifyUrl.hash ||
      (notifyUrl.protocol !== "https:" &&
        !(localNotifyHost && notifyUrl.protocol === "http:"))
    ) {
      return send(res, 503, {
        ok: false,
        message: "La configuration du paiement Monetbil est incomplète.",
        newsletter: { status: newsletterStatus },
      });
    }

    // Create Order in DB
    const orderData = {
      plan_id: plan.id,
      name: fullName,
      email,
      phone,
      surface: text(b.surface, 80),
      requirements: text(b.requirements, 4000),
      amount,
      currency: "XAF",
      status: "pending",
    };

    const rows = await db("/rest/v1/plan_orders", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(orderData),
    });
    const order = rows?.[0];
    if (!order?.id) throw new Error("Création de commande sans identifiant.");

    const baseUrl = notifyUrl.origin;
    try {
      const monetbilPayload = {
        amount,
        currency: "XAF",
        country: "CM",
        phone,
        first_name: firstName || fullName.split(" ")[0],
        last_name: lastName || fullName.split(" ").slice(1).join(" "),
        email,
        return_url: `${baseUrl}/page/plans.html?order_id=${encodeURIComponent(order.id)}`,
        notify_url: notifyUrl.toString(),
        item_ref: plan.id,
        payment_ref: order.id,
      };

      const monetbilRes = await fetch(
        `https://api.monetbil.com/widget/v2.1/${serviceKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(monetbilPayload),
        },
      );
      const monetbilJson = await monetbilRes.json();
      let paymentUrl;
      try {
        paymentUrl = new URL(monetbilJson?.payment_url);
      } catch {
        paymentUrl = null;
      }

      if (
        monetbilRes.ok &&
        monetbilJson?.success === true &&
        paymentUrl?.protocol === "https:" &&
        paymentUrl.hostname === "api.monetbil.com"
      ) {
        return send(res, 201, {
          ok: true,
          order: { id: order.id, amount, status: "pending" },
          payment_url: paymentUrl.toString(),
          newsletter: { status: newsletterStatus },
        });
      }

      console.error("Monetbil: création du lien refusée.");
      await db(`/rest/v1/plan_orders?id=eq.${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "failed" }),
      });
      return send(res, 502, {
        ok: false,
        message: "Le paiement n’a pas pu être initialisé. Réessayez plus tard.",
        newsletter: { status: newsletterStatus },
      });
    } catch {
      console.error("Monetbil: création du lien non confirmée.");
      await db(`/rest/v1/plan_orders?id=eq.${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "failed" }),
      });
      return send(res, 502, {
        ok: false,
        message: "Le paiement n’a pas pu être initialisé. Réessayez plus tard.",
        newsletter: { status: newsletterStatus },
      });
    }
  }

  // Monetbil Webhook / Notification Callback
  if (p === "/api/monetbil/notify" && ["GET", "POST"].includes(req.method)) {
    let payload;
    try {
      if (req.method === "POST") {
        const contentType = String(req.headers["content-type"] || "");
        if (contentType.includes("application/json")) {
          const body = await jsonBody(req);
          if (!body || typeof body !== "object" || Array.isArray(body))
            return fail(res, 400, "Notification Monetbil invalide.");
          payload = Object.fromEntries(
            Object.entries(body).map(([key, value]) => {
              if (
                !["string", "number"].includes(typeof value) ||
                !Number.isFinite(typeof value === "number" ? value : 0)
              ) {
                throw new Error("Champ Monetbil invalide.");
              }
              return [key, String(value)];
            }),
          );
        } else {
          payload = await urlEncodedBody(req);
        }
      } else {
        payload = parseMonetbilParameters(url.searchParams.entries());
      }
    } catch {
      return fail(res, 400, "Notification Monetbil invalide.");
    }

    const serviceKey = process.env.MONETBIL_SERVICE_KEY?.trim();
    const secretKey = process.env.MONETBIL_SECRET_KEY?.trim();
    if (!serviceKey || !secretKey)
      return fail(res, 503, "Validation Monetbil indisponible.");
    if (!verifyMonetbilSignature(payload, secretKey))
      return fail(res, 403, "Signature Monetbil invalide.");
    if (payload.service !== serviceKey)
      return fail(res, 403, "Service Monetbil invalide.");

    const paymentRef = payload.payment_ref;
    const itemRef = payload.item_ref;
    const transactionId = payload.transaction_uuid || payload.transaction_id;
    const amount = Number(payload.amount);
    const currency = payload.currency;
    const status = payload.status;
    if (
      !isUuid(paymentRef) ||
      !isUuid(itemRef) ||
      !transactionId ||
      transactionId.length > 200 ||
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      currency !== "XAF" ||
      !["success", "failed", "cancelled"].includes(status)
    ) {
      return fail(res, 400, "Données de notification Monetbil invalides.");
    }

    const signedValues = canonicalMonetbilValues(payload);
    const payloadHash = crypto
      .createHash("sha256")
      .update(signedValues)
      .digest("hex");
    const result = await db("/rest/v1/rpc/apply_monetbil_payment", {
      method: "POST",
      body: JSON.stringify({
        p_payment_ref: paymentRef,
        p_item_ref: itemRef,
        p_provider_event_id: transactionId,
        p_transaction_id: payload.transaction_id || transactionId,
        p_amount: amount,
        p_currency: currency,
        p_status: status,
        p_payload_hash: payloadHash,
      }),
    });
    if (!result?.accepted)
      return fail(
        res,
        409,
        "La notification ne correspond pas à une commande en attente.",
      );
    if (result.changed && result.status === "paid") {
      try {
        const orders = await db(
          `/rest/v1/plan_orders?select=id,name,email,phone,plan_id,amount&id=eq.${encodeURIComponent(paymentRef)}&limit=1`,
        );
        const order = orders?.[0];
        if (order) {
          const plans = await db(
            `/rest/v1/plans?select=id,name,pdf_path&id=eq.${encodeURIComponent(itemRef)}&limit=1`,
          );
          const plan = plans?.[0];
          await notifyTelegramPlanPurchase(order, plan);
          try {
            await sendPlanPdfByEmail(order, plan);
            await updateDeliveryStatus(order.id, "sent");
          } catch (error) {
            await updateDeliveryStatus(order.id, "failed").catch(() => {});
            console.error(
              "Envoi du plan payé impossible.",
              error instanceof Error ? error.name : "UnknownError",
            );
          }
        }
      } catch {
        console.error("Notification Telegram du paiement indisponible.");
      }
    }

    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("received");
  }

  if (
    p.startsWith("/api/admin/") &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
    !sameOriginMutation(req, res)
  )
    return;

  // Admin Login & Session
  if (p === "/api/admin/login" && req.method === "POST") {
    const b = await jsonBody(req),
      e = String(b.email || "")
        .trim()
        .toLowerCase(),
      pin = String(b.pin || "");
    const a = attempts.get(e) || { count: 0, until: 0 };
    const ip = clientAddress(req);
    if (a.until > Date.now() || !allowRate(ipAttempts, ip, 20, 15 * 60 * 1000))
      return fail(res, 429, "Trop de tentatives. Réessayez plus tard.");
    if (!emailOk(e) || !b.password || !/^\d{6}$/.test(pin))
      return fail(
        res,
        400,
        "Email, mot de passe et PIN à six chiffres requis.",
      );

    const auth = await fetch(
      `${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: publishableKey(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: e, password: b.password }),
      },
    );
    if (!auth.ok) {
      a.count++;
      if (a.count >= 5) a.until = Date.now() + 15 * 60 * 1000;
      attempts.set(e, a);
      return fail(res, 401, "Identifiants incorrects.");
    }
    const token = await auth.json();
    const admins = await db(
      `/rest/v1/admin_users?select=user_id&user_id=eq.${encodeURIComponent(token.user.id)}`,
    );
    let verified = false;
    if (admins.length) {
      verified = await db("/rest/v1/rpc/verify_admin_pin_public", {
        method: "POST",
        body: JSON.stringify({
          requested_user_id: token.user.id,
          requested_pin: pin,
        }),
      }).catch(() => false);
    }
    if (!admins.length || verified !== true) {
      a.count++;
      if (a.count >= 5) a.until = Date.now() + 15 * 60 * 1000;
      attempts.set(e, a);
      return fail(res, 401, "PIN incorrect ou compte non autorisé.");
    }
    attempts.delete(e);
    const sessionValue = encodeSession({
      userId: token.user.id,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    });
    const secureCookie =
      process.env.NODE_ENV === "production" ? " Secure;" : "";
    return send(
      res,
      200,
      { ok: true },
      {
        "Set-Cookie": `laroche_admin=${sessionValue}; HttpOnly;${secureCookie} SameSite=Lax; Path=/; Max-Age=28800`,
      },
    );
  }

  if (p === "/api/admin/session" && req.method === "GET") {
    return session(req)
      ? send(res, 200, { authenticated: true })
      : fail(res, 401, "Session absente.");
  }
  if (p === "/api/admin/logout" && req.method === "POST") {
    const secureCookie =
      process.env.NODE_ENV === "production" ? " Secure;" : "";
    return send(
      res,
      200,
      { ok: true },
      {
        "Set-Cookie": `laroche_admin=; HttpOnly;${secureCookie} SameSite=Lax; Path=/; Max-Age=0`,
      },
    );
  }

  // Admin Protected Routes
  const s = p.startsWith("/api/admin/") ? admin(req, res) : null;
  if (p.startsWith("/api/admin/") && !s) return;

  if (p === "/api/admin/plans" && req.method === "GET")
    return send(
      res,
      200,
      await db(`/rest/v1/plans?select=*&order=created_at.desc`),
    );
  if (p === "/api/admin/news" && req.method === "GET")
    return send(
      res,
      200,
      await db("/rest/v1/news?select=*&order=created_at.desc"),
    );
  if (p === "/api/admin/stats" && req.method === "GET") {
    const { data, error } = await getServiceSupabaseClient()
      .from("site_stats")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Lecture stats : ${error.message}`);
    return send(res, 200, data || {});
  }
  if (p === "/api/admin/analytics" && req.method === "GET") {
    const data = await db("/rest/v1/rpc/get_admin_dashboard_stats", {
      method: "POST",
      body: JSON.stringify({}),
    });
    return send(res, 200, data || {});
  }
  if (p === "/api/admin/settings" && req.method === "GET")
    return send(res, 200, await db("/rest/v1/site_settings?select=*"));
  if (p === "/api/admin/social-links" && req.method === "GET")
    return send(res, 200, await db("/rest/v1/social_links?select=*"));
  if (p === "/api/admin/videos" && req.method === "GET")
    return send(res, 200, await fetchYouTubeVideos());
  if (p === "/api/admin/newsletter/subscribers" && req.method === "GET") {
    return send(
      res,
      200,
      await db(
        "/rest/v1/newsletter_subscribers?select=id,email,source,status,created_at&order=created_at.desc",
      ),
    );
  }
  const subscriberAction = p.match(
    /^\/api\/admin\/newsletter\/subscribers\/([^/]+)$/,
  );
  if (subscriberAction && req.method === "PATCH") {
    const id = subscriberAction[1];
    if (!isUuid(id)) return fail(res, 400, "Abonné invalide.");
    await db(
      `/rest/v1/newsletter_subscribers?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "unsubscribed" }),
      },
    );
    return send(res, 200, { ok: true });
  }
  if (p === "/api/admin/orders" && req.method === "GET") {
    const [orders, plans] = await Promise.all([
      db("/rest/v1/plan_orders?select=*&order=created_at.desc"),
      db("/rest/v1/plans?select=id,name"),
    ]);
    const names = new Map((plans || []).map((plan) => [plan.id, plan.name]));
    return send(
      res,
      200,
      (orders || []).map((order) => ({
        ...order,
        plan_name: names.get(order.plan_id) || "",
      })),
    );
  }
  if (p === "/api/admin/uploads/sign" && req.method === "POST") {
    const b = await jsonBody(req);
    const kinds = {
      "plan-pdf": {
        bucket: "plans-private",
        prefix: "plans",
        mime: "application/pdf",
        max: 20 * 1024 * 1024,
        ext: "pdf",
      },
      "plan-cover": {
        bucket: "site-media",
        prefix: "plans",
        mime: ["image/jpeg", "image/png", "image/webp"],
        max: 5 * 1024 * 1024,
      },
      "news-image": {
        bucket: "site-media",
        prefix: "news",
        mime: ["image/jpeg", "image/png", "image/webp"],
        max: 5 * 1024 * 1024,
      },
    };
    const rule = kinds[b.kind];
    const mime = String(b.mime_type || "");
    const size = Number(b.size);
    if (
      !rule ||
      !(Array.isArray(rule.mime)
        ? rule.mime.includes(mime)
        : mime === rule.mime) ||
      !Number.isSafeInteger(size) ||
      size <= 0 ||
      size > rule.max
    )
      return fail(res, 400, "Type ou taille de fichier non autorisé.");
    const extension =
      rule.ext ||
      { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[mime];
    const storagePath = `${rule.prefix}/${crypto.randomUUID()}.${extension}`;
    const { data, error } = await getServiceSupabaseClient()
      .storage.from(rule.bucket)
      .createSignedUploadUrl(storagePath, { upsert: false });
    if (error || !data?.token || !data?.signedUrl)
      throw new Error("Création du lien temporaire de dépôt impossible.");
    const publicUrl =
      rule.bucket === "site-media"
        ? getServiceSupabaseClient()
            .storage.from(rule.bucket)
            .getPublicUrl(storagePath).data.publicUrl
        : null;
    const signedUrl = new URL(
      data.signedUrl,
      process.env.SUPABASE_URL,
    ).toString();
    return send(res, 201, {
      bucket: rule.bucket,
      path: storagePath,
      token: data.token,
      signedUrl,
      publicUrl,
      apiKey: publishableKey(),
    });
  }
  const deliveryRetry = p.match(/^\/api\/admin\/orders\/([^/]+)\/deliver$/);
  if (deliveryRetry && req.method === "POST") {
    const orderId = deliveryRetry[1];
    if (!isUuid(orderId)) return fail(res, 400, "Commande invalide.");
    const rows = await db(
      `/rest/v1/plan_orders?select=id,name,email,phone,plan_id,amount,status&id=eq.${encodeURIComponent(orderId)}&limit=1`,
    );
    const order = rows?.[0];
    if (!order || order.status !== "paid")
      return fail(
        res,
        409,
        "Seules les commandes payées peuvent être envoyées.",
      );
    const plans = await db(
      `/rest/v1/plans?select=id,name,pdf_path&id=eq.${encodeURIComponent(order.plan_id)}&limit=1`,
    );
    try {
      await sendPlanPdfByEmail(order, plans?.[0]);
      await updateDeliveryStatus(order.id, "sent");
      return send(res, 200, { ok: true, delivery_status: "sent" });
    } catch {
      await updateDeliveryStatus(order.id, "failed").catch(() => {});
      return fail(
        res,
        502,
        "L’email n’a pas pu être envoyé. Vérifiez Google Apps Script et le PDF du plan.",
      );
    }
  }

  // Admin News and Plans Mutations
  const normalizeCharacteristics = (value) => {
    if (typeof value !== "string") return value;
    const parsed = {};
    for (const line of value.split(/\r?\n/).slice(0, 24)) {
      const index = line.indexOf("=");
      if (index > 0) {
        const key = line.slice(0, index).trim(),
          item = line.slice(index + 1).trim();
        if (/^[a-z][a-z0-9_]{0,39}$/.test(key) && item.length <= 120)
          parsed[key] = item;
      }
    }
    return parsed;
  };
  const match = p.match(/^\/api\/admin\/(plans|news)\/([^/]+)$/);
  if (match && ["PUT", "DELETE"].includes(req.method)) {
    const table = match[1],
      id = match[2];
    if (req.method === "DELETE") {
      await db(idPath(`/rest/v1/${table}`, id), { method: "DELETE" });
      return send(res, 204, null);
    }
    const b = await jsonBody(req);
    delete b.id;
    delete b.created_at;
    const allowed =
      table === "plans"
        ? [
            "slug",
            "name",
            "type",
            "surface",
            "surfaces",
            "price",
            "description",
            "cover_path",
            "pdf_path",
            "characteristics",
            "status",
          ]
        : [
            "title",
            "category",
            "summary",
            "content",
            "location",
            "image_path",
            "published_on",
            "status",
          ];
    const update = Object.fromEntries(
      allowed
        .filter((k) => b[k] !== undefined)
        .map((k) => [
          k,
          k === "characteristics" ? normalizeCharacteristics(b[k]) : b[k],
        ]),
    );
    if (table === "plans") {
      if (
        update.price !== undefined &&
        (!Number.isSafeInteger(Number(update.price)) ||
          Number(update.price) < 0)
      )
        return fail(res, 400, "Prix de plan invalide.");
      if (update.price !== undefined) update.price = Number(update.price);
      if (
        update.pdf_path !== undefined &&
        !/^plans\/[0-9a-f-]{36}\.pdf$/i.test(update.pdf_path)
      )
        return fail(res, 400, "Chemin de PDF privé invalide.");
    }
    await db(idPath(`/rest/v1/${table}`, id), {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(update),
    });
    return send(res, 200, { ok: true });
  }

  if (
    (p === "/api/admin/plans" || p === "/api/admin/news") &&
    req.method === "POST"
  ) {
    const b = await jsonBody(req),
      table = p.endsWith("plans") ? "plans" : "news";
    const allowed =
      table === "plans"
        ? [
            "slug",
            "name",
            "type",
            "surface",
            "surfaces",
            "price",
            "description",
            "cover_path",
            "pdf_path",
            "characteristics",
            "status",
          ]
        : [
            "title",
            "category",
            "summary",
            "content",
            "location",
            "image_path",
            "published_on",
            "date",
            "status",
          ];
    const value = Object.fromEntries(
      allowed
        .filter((k) => b[k] !== undefined)
        .map((k) => [
          k === "date" ? "published_on" : k,
          k === "characteristics" ? normalizeCharacteristics(b[k]) : b[k],
        ]),
    );

    if (table === "plans") {
      if (
        !text(value.name, 160) ||
        !["residential", "commercial", "industrial", "civil"].includes(
          value.type,
        ) ||
        !text(value.surface, 80) ||
        !Number.isSafeInteger(Number(value.price)) ||
        Number(value.price) < 0 ||
        !/^plans\/[0-9a-f-]{36}\.pdf$/i.test(String(value.pdf_path || "")) ||
        !["published", "hidden"].includes(value.status || "published")
      )
        return fail(
          res,
          400,
          "Nom, type, surface, prix ou PDF de plan invalide.",
        );
      value.price = Number(value.price);
      if (!value.slug && value.name)
        value.slug =
          String(value.name)
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") || `plan-${Date.now()}`;
      if (
        !value.characteristics ||
        typeof value.characteristics !== "object" ||
        Array.isArray(value.characteristics)
      )
        value.characteristics = {};
    } else {
      if (!text(value.title, 220) || !text(value.summary, 4000))
        return fail(res, 400, "Titre et résumé d’actualité requis.");
      if (value.status && !["published", "hidden"].includes(value.status))
        return fail(res, 400, "Statut d’actualité invalide.");
    }
    const rows = await db(`/rest/v1/${table}`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(value),
    });
    return send(res, 201, rows?.[0] || {});
  }

  // Update Stats
  if (p === "/api/admin/stats" && req.method === "PUT") {
    const b = await jsonBody(req);
    const value = Object.fromEntries(
      ["projects", "experience", "collaborators", "cities", "clients"]
        .filter(
          (key) => Number.isInteger(Number(b[key])) && Number(b[key]) >= 0,
        )
        .map((key) => [key, Number(b[key])]),
    );
    const { error } = await getServiceSupabaseClient()
      .from("site_stats")
      .update(value)
      .eq("id", true);
    if (error) throw new Error(`Mise à jour chiffres clés : ${error.message}`);
    return send(res, 200, { ok: true });
  }

  // Update Social Links
  if (p === "/api/admin/social-links" && req.method === "PUT") {
    const b = await jsonBody(req);
    const links = Array.isArray(b.links)
      ? b.links
      : Object.entries(b).map(([network, url]) => ({
          network,
          url,
          enabled: true,
        }));
    for (const item of links) {
      if (
        ![
          "facebook",
          "instagram",
          "linkedin",
          "tiktok",
          "youtube",
          "x",
        ].includes(item.network)
      )
        continue;
      const url = normalizedNetworkUrl(item.network, String(item.url || ""));
      if (!url) {
        await db(
          `/rest/v1/social_links?network=eq.${encodeURIComponent(item.network)}`,
          { method: "DELETE" },
        );
        continue;
      }
      const { error } = await getServiceSupabaseClient()
        .from("social_links")
        .upsert({
          network: item.network,
          url,
          enabled: item.enabled !== false,
          updated_by: s.userId,
        });
      if (error)
        throw new Error(`Enregistrement du lien ${item.network} impossible.`);
    }
    return send(res, 200, { ok: true });
  }

  // Update Settings
  if (p === "/api/admin/settings" && req.method === "PUT") {
    const b = await jsonBody(req);
    for (const [key, value] of Object.entries(b)) {
      if (
        !["email", "phone", "address", "whatsapp"].includes(key) ||
        typeof value !== "string"
      )
        continue;
      const normalized = value.trim();
      const valid =
        key === "email"
          ? emailOk(normalized)
          : key === "phone"
            ? /^[+()\d .-]{5,40}$/.test(normalized)
            : key === "address"
              ? normalized.length > 0 && normalized.length <= 240
              : /^https:\/\/wa\.me\/\d{8,16}\/?$/i.test(normalized);
      if (!valid)
        return fail(res, 400, `Valeur invalide pour le champ ${key}.`);
      await db("/rest/v1/site_settings?on_conflict=key", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ key, value: normalized, updated_by: s.userId }),
      });
    }
    return send(res, 200, { ok: true });
  }

  return fail(res, 404, "Route API introuvable.");
}

module.exports = { api, verifyMonetbilSignature };
