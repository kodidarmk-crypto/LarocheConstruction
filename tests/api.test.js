const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const { Readable } = require("node:stream");
const { afterEach, beforeEach, test } = require("node:test");
const { Script } = require("node:vm");

process.env.VERCEL = "1";
process.env.SUPABASE_URL = "https://supabase.test";
process.env.ADMIN_SESSION_SECRET =
  "test-admin-session-secret-at-least-32-bytes";
process.env.SUPABASE_SECRET_KEY = "test-service-key";
process.env.SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
process.env.MONETBIL_SERVICE_KEY = "test-service";
process.env.MONETBIL_SECRET_KEY = "test-monetbil-secret";
process.env.MONETBIL_NOTIFY_URL = "https://site.test/api/monetbil/notify";
process.env.TELEGRAM_BOT_TOKEN = "test-telegram-token";
process.env.TELEGRAM_CHAT_ID = "test-chat";
process.env.GOOGLE_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/test-deployment/exec";
process.env.GOOGLE_APPS_SCRIPT_TOKEN =
  "test-google-apps-script-token-long-enough";

const { api, verifyMonetbilSignature } = require("../lib/shared");
const { sendEmailViaGoogleAppsScript } = require("../lib/email");

const PLAN_ID = "00000000-0000-4000-8000-000000000001";
const ORDER_ID = "00000000-0000-4000-8000-000000000002";
const PDF_PATH = "plans/00000000-0000-4000-8000-000000000003.pdf";
let fetchHandler;
let originalFetch;
let calls;

function jsonResponse(data, status = 200) {
  return new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  calls = [];
  originalFetch = global.fetch;
  fetchHandler = async (input, init = {}) => {
    const url = new URL(input);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, method: init.method || "GET", body, headers: init.headers || {} });

    if (url.hostname === "api.telegram.org") return jsonResponse({ ok: true });
    if (url.hostname === "script.google.com") return jsonResponse({ ok: true });
    if (url.pathname.endsWith("/rpc/claim_project_request")) {
      return jsonResponse({ claimed: true, status: "processing" });
    }
    if (url.pathname.endsWith("/rpc/complete_project_request")) {
      return jsonResponse({
        finalized: true,
        status: body.p_sent ? "sent" : "failed",
      });
    }
    if (url.pathname.endsWith("/rpc/apply_monetbil_payment")) {
      return jsonResponse({ accepted: true, changed: true, status: "paid" });
    }
    if (url.pathname.endsWith("/public_site_stats")) {
      return jsonResponse([{ projects: 12, experience: 8, collaborators: 5, cities: 3, clients: 20 }]);
    }
    if (url.pathname.endsWith("/newsletter_subscribers"))
      return jsonResponse(null, 201);
    if (url.pathname.endsWith("/plan_orders") && init.method === "POST") {
      return jsonResponse(
        [{ id: ORDER_ID, plan_id: PLAN_ID, amount: 5000, status: "pending" }],
        201,
      );
    }
    if (url.pathname.endsWith("/plans")) {
      return jsonResponse([
        {
          id: PLAN_ID,
          name: "Plan test",
          price: 5000,
          status: "published",
          pdf_path: PDF_PATH,
        },
      ]);
    }
    if (url.hostname === "api.monetbil.com") {
      return jsonResponse({ success: false, message: "Test failure" });
    }
    return jsonResponse([]);
  };
  global.fetch = (...args) => fetchHandler(...args);
});

afterEach(() => {
  global.fetch = originalFetch;
});

function makeRequest(method, path, body, contentType = "application/json") {
  const rawBody =
    body === undefined
      ? ""
      : typeof body === "string"
        ? body
        : JSON.stringify(body);
  const request = Readable.from(rawBody ? [Buffer.from(rawBody)] : []);
  request.method = method;
  request.url = path;
  request.headers = { "content-type": contentType, host: "site.test" };
  return request;
}

async function callApi(method, path, body, contentType) {
  const request = makeRequest(method, path, body, contentType);
  const response = {
    statusCode: 200,
    headers: {},
    headersSent: false,
    writeHead(status, headers = {}) {
      this.statusCode = status;
      this.headers = headers;
      this.headersSent = true;
      return this;
    },
    end(value = "") {
      this.body = String(value);
      this.headersSent = true;
    },
  };
  await api(request, response, new URL(`https://site.test${path}`));
  let parsedBody = null;
  try {
    parsedBody = response.body ? JSON.parse(response.body) : null;
  } catch {}
  return {
    status: response.statusCode,
    body: parsedBody,
    text: response.body,
  };
}

function signMonetbil(parameters) {
  const values = Object.keys(parameters)
    .sort()
    .map((key) => parameters[key])
    .join("");
  return crypto
    .createHash("md5")
    .update(`${process.env.MONETBIL_SECRET_KEY}${values}`)
    .digest("hex");
}

test("newsletter subscription requires explicit consent", async () => {
  const rejected = await callApi("POST", "/api/newsletter/subscribe", {
    email: "person@example.com",
  });
  assert.equal(rejected.status, 400);
  assert.equal(calls.length, 0);

  const accepted = await callApi("POST", "/api/newsletter/subscribe", {
    email: "person@example.com",
    source: "website",
    consent: true,
  });
  assert.equal(accepted.status, 200);
  assert.deepEqual(calls[0].body, {
    email: "person@example.com",
    source: "website",
    status: "active",
    consented_at: calls[0].body.consented_at,
    consent_source: "website",
    consent_version: "newsletter-v1",
  });
});

test("newsletter storage schema failure returns an actionable service error", async () => {
  fetchHandler = async (input, init = {}) => {
    const url = new URL(input);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, method: init.method || "GET", body });
    return jsonResponse(
      { code: "42703", message: "column does not exist" },
      400,
    );
  };

  const result = await callApi("POST", "/api/newsletter/subscribe", {
    email: "person@example.com",
    source: "website",
    consent: true,
  });
  assert.equal(result.status, 503);
  assert.equal(result.body.ok, false);
  assert.match(result.body.message, /temporairement indisponible/);
  assert.equal(result.body.message.includes("42703"), false);
});

test("Google Apps Script sends email directly without a Supabase request", async () => {
  const result = await sendEmailViaGoogleAppsScript({
    to: "buyer@example.com",
    subject: "Votre plan",
    textBody: "Votre plan est joint.",
    attachments: [
      {
        name: "plan.pdf",
        mimeType: "application/pdf",
        base64: Buffer.from("%PDF-test").toString("base64"),
      },
    ],
  });

  assert.deepEqual(result, { sent: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.hostname, "script.google.com");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].body.token, process.env.GOOGLE_APPS_SCRIPT_TOKEN);
  assert.equal(calls[0].body.message.to, "buyer@example.com");
  assert.equal(calls[0].body.message.attachments[0].name, "plan.pdf");
  assert.equal(
    calls.some(({ url }) => url.hostname === "supabase.test"),
    false,
  );
});

test("Google Apps Script transport rejects an unconfirmed send", async () => {
  fetchHandler = async (input, init = {}) => {
    const url = new URL(input);
    calls.push({ url, method: init.method || "GET" });
    return jsonResponse({ ok: false, error: "email_delivery_failed" });
  };

  await assert.rejects(
    sendEmailViaGoogleAppsScript({
      to: "buyer@example.com",
      subject: "Test",
      textBody: "Test",
    }),
    /n’a pas confirmé l’envoi/,
  );
});

test("Google Apps Script deployment source is valid JavaScript", () => {
  const source = fs.readFileSync(
    require.resolve("../google-apps-script/Code.gs"),
    "utf8",
  );
  assert.doesNotThrow(() => new Script(source));
});

test("project quote is sent without persisting personal details", async () => {
  const quiz = { type: "Construction résidentielle", surface: "100 à 200 m²" };
  const result = await callApi("POST", "/api/project-leads", {
    contact: {
      firstName: "Ada",
      lastName: "Test",
      email: "ada@example.com",
      phone: "237600000000",
      budget: 1000000,
    },
    estimate: { amount: 18000000 },
    quiz,
    newsletter_consent: false,
  });

  const telegramCall = calls.find(
    ({ url }) => url.hostname === "api.telegram.org",
  );
  assert.equal(result.status, 201);
  assert.equal(result.body.quote.status, "sent");
  assert.equal(result.body.newsletter.status, "not_requested");
  assert.equal(telegramCall.url.pathname.endsWith("/sendMessage"), true);
  assert.equal(telegramCall.body.chat_id, process.env.TELEGRAM_CHAT_ID);
  assert.match(telegramCall.body.text, /Nouveau projet/);
  assert.match(telegramCall.body.text, /Ada Test/);
  assert.match(telegramCall.body.text, /ada@example\.com/);
  assert.match(telegramCall.body.text, /237600000000/);
  assert.match(telegramCall.body.text, /1000000 FCFA/);
  assert.match(telegramCall.body.text, /18000000 FCFA/);
  assert.match(telegramCall.body.text, /Construction résidentielle/);
  assert.match(telegramCall.body.text, /100 à 200 m²/);
  assert.equal(telegramCall.body.disable_web_page_preview, true);
  assert.equal(Object.hasOwn(telegramCall.body, "parse_mode"), false);
  assert.equal(
    calls.some(({ url }) => url.pathname.endsWith("/project_leads")),
    false,
  );
  const claimCall = calls.find(({ url }) =>
    url.pathname.endsWith("/rpc/claim_project_request"),
  );
  assert.ok(claimCall);
  assert.equal(Object.keys(claimCall.body).join(","), "p_request_hash");
  assert.equal(
    JSON.stringify(claimCall.body).includes("ada@example.com"),
    false,
  );
});

test("newsletter result is independent when Telegram rejects a quote", async () => {
  fetchHandler = async (input, init = {}) => {
    const url = new URL(input);
    const body =
      init.body && init.headers?.["Content-Type"] === "application/json"
        ? JSON.parse(init.body)
        : null;
    calls.push({ url, method: init.method || "GET", body });
    if (url.pathname.endsWith("/rpc/claim_project_request"))
      return jsonResponse({ claimed: true, status: "processing" });
    if (url.pathname.endsWith("/rpc/complete_project_request"))
      return jsonResponse({ finalized: true, status: "failed" });
    if (url.hostname === "api.telegram.org") return jsonResponse({ ok: false });
    if (url.pathname.endsWith("/newsletter_subscribers"))
      return jsonResponse(null, 201);
    return jsonResponse([]);
  };

  const result = await callApi("POST", "/api/project-leads", {
    contact: {
      firstName: "Ada",
      lastName: "Test",
      email: "ada@example.com",
      phone: "237600000000",
      budget: 1000000,
    },
    estimate: { amount: 18000000 },
    quiz: {},
    newsletter_consent: true,
  });

  assert.equal(result.status, 502);
  assert.equal(result.body.quote.status, "failed");
  assert.equal(result.body.newsletter.status, "subscribed");
  assert.equal(
    calls.some(({ url }) =>
      url.pathname.endsWith("/rpc/claim_project_request"),
    ),
    true,
  );
  assert.equal(
    calls.some(({ url }) => url.pathname.endsWith("/project_leads")),
    false,
  );
});

test("project quote fails safely when the idempotency store is unavailable", async () => {
  fetchHandler = async (input, init = {}) => {
    const url = new URL(input);
    calls.push({ url, method: init.method || "GET" });
    throw new Error("Supabase unavailable");
  };

  const result = await callApi("POST", "/api/project-leads", {
    contact: {
      firstName: "Ada",
      lastName: "Test",
      email: "ada@example.com",
      phone: "237600000000",
      budget: 1000000,
    },
    estimate: { amount: 18000000 },
    quiz: {},
    newsletter_consent: false,
  });

  assert.equal(result.status, 503);
  assert.equal(result.body.ok, false);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url.pathname.endsWith("/rpc/claim_project_request"),
    true,
  );
});

test("Monetbil signature verification matches the provider canonicalization", () => {
  const parameters = {
    service: "test-service",
    status: "success",
    amount: "5000",
    currency: "XAF",
  };
  const signed = { ...parameters, sign: signMonetbil(parameters) };
  assert.equal(
    verifyMonetbilSignature(signed, process.env.MONETBIL_SECRET_KEY),
    true,
  );
  assert.equal(
    verifyMonetbilSignature(
      { ...signed, amount: "5001" },
      process.env.MONETBIL_SECRET_KEY,
    ),
    false,
  );
});

test("invalid Monetbil signature cannot update a payment", async () => {
  const payload = new URLSearchParams({
    service: process.env.MONETBIL_SERVICE_KEY,
    transaction_id: "tx-test-1",
    amount: "5000",
    currency: "XAF",
    status: "success",
    item_ref: PLAN_ID,
    payment_ref: ORDER_ID,
    sign: "00000000000000000000000000000000",
  });

  const result = await callApi(
    "POST",
    "/api/monetbil/notify",
    payload.toString(),
    "application/x-www-form-urlencoded",
  );
  assert.equal(result.status, 403);
  assert.equal(calls.length, 0);
});

test("valid Monetbil signature reaches the atomic payment transition", async () => {
  const payload = {
    service: process.env.MONETBIL_SERVICE_KEY,
    transaction_id: "tx-test-2",
    transaction_uuid: "uuid-test-2",
    amount: "5000",
    currency: "XAF",
    status: "success",
    item_ref: PLAN_ID,
    payment_ref: ORDER_ID,
  };
  payload.sign = signMonetbil(payload);

  const result = await callApi(
    "POST",
    "/api/monetbil/notify",
    new URLSearchParams(payload).toString(),
    "application/x-www-form-urlencoded",
  );
  const paymentCall = calls.find(({ url }) =>
    url.pathname.endsWith("/rpc/apply_monetbil_payment"),
  );
  assert.equal(result.status, 200);
  assert.equal(result.text, "received");
  assert.equal(paymentCall.body.p_payment_ref, ORDER_ID);
  assert.equal(paymentCall.body.p_item_ref, PLAN_ID);
  assert.equal(paymentCall.body.p_provider_event_id, "uuid-test-2");
  assert.match(paymentCall.body.p_payload_hash, /^[a-f0-9]{64}$/);
});

test("failed Monetbil link creation is not reported as a successful order", async () => {
  const result = await callApi("POST", "/api/plan-orders", {
    plan_id: PLAN_ID,
    first_name: "Ada",
    last_name: "Test",
    email: "ada@example.com",
    phone: "237600000000",
  });
  assert.equal(result.status, 502);
  assert.equal(result.body.ok, false);
  assert.equal(Object.hasOwn(result.body, "payment_url"), false);
  assert.equal(
    calls.some(({ url }) => url.pathname.endsWith("/newsletter_subscribers")),
    false,
  );
});

test("fabricated plan identifiers cannot create an order or initiate a payment", async () => {
  const result = await callApi("POST", "/api/plan-orders", {
    plan_id: "plan-2",
    first_name: "Ada",
    last_name: "Test",
    email: "ada@example.com",
    phone: "237600000000",
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.ok, false);
  assert.equal(calls.length, 0);
});

test("plan order newsletter consent is optional and independent from payment failure", async () => {
  const result = await callApi("POST", "/api/plan-orders", {
    plan_id: PLAN_ID,
    first_name: "Ada",
    last_name: "Test",
    email: "ada@example.com",
    phone: "237600000000",
    newsletter_consent: true,
  });

  const subscription = calls.find(({ url }) =>
    url.pathname.endsWith("/newsletter_subscribers"),
  );
  assert.equal(result.status, 502);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.newsletter.status, "subscribed");
  assert.equal(subscription.body.email, "ada@example.com");
  assert.equal(subscription.body.source, "plan-order");
  assert.equal(subscription.body.consent_source, "plan-order");
  assert.equal(
    calls.some(({ url }) => url.pathname.endsWith("/project_leads")),
    false,
  );
});

test("newsletter API accepts consent from a plan order as an independent request", async () => {
  const result = await callApi("POST", "/api/newsletter/subscribe", {
    email: "buyer@example.com",
    source: "plan-order",
    consent: true,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(calls[0].body.source, "plan-order");
  assert.equal(calls[0].body.consent_source, "plan-order");
});

test("public site stats read only the approved projection with the publishable key", async () => {
  const result = await callApi("GET", "/api/public/stats");

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    projects: 12,
    experience: 8,
    collaborators: 5,
    cities: 3,
    clients: 20,
  });
  assert.match(calls[0].url.pathname, /public_site_stats$/);
  assert.equal(calls[0].headers.apikey, "test-publishable-key");
  assert.equal(calls[0].url.searchParams.has("project_requests"), false);
});

test("plan catalogue failure is not disguised as an empty catalogue", async () => {
  fetchHandler = async (input, init = {}) => {
    const url = new URL(input);
    calls.push({ url, method: init.method || "GET" });
    return jsonResponse({ message: "database unavailable" }, 404);
  };

  const result = await callApi("GET", "/api/public/plans");
  assert.equal(result.status, 503);
  assert.equal(result.body.ok, false);
  assert.match(result.body.message, /catalogue.*indisponible/i);
});

test("YouTube API failure is visible and does not fall back to database videos", async () => {
  process.env.YOUTUBE_API_KEY = "test-youtube-key";
  process.env.YOUTUBE_CHANNEL_ID = "UC1234567890123456789012";
  fetchHandler = async (input, init = {}) => {
    const url = new URL(input);
    calls.push({ url, method: init.method || "GET" });
    return jsonResponse({ error: "unavailable" }, 500);
  };

  const result = await callApi("GET", "/api/public/videos");
  assert.equal(result.status, 503);
  assert.equal(result.body.ok, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.hostname, "www.googleapis.com");
});

test("empty YouTube response remains empty instead of showing fabricated videos", async () => {
  process.env.YOUTUBE_API_KEY = "test-youtube-key";
  process.env.YOUTUBE_CHANNEL_ID = "UC1234567890123456789012";
  fetchHandler = async (input, init = {}) => {
    const url = new URL(input);
    calls.push({ url, method: init.method || "GET" });
    return jsonResponse({ items: [] });
  };

  const result = await callApi("GET", "/api/public/videos");
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, []);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.hostname, "www.googleapis.com");
});

test("public plan and realization scripts contain no fabricated catalog entries", () => {
  const sources = [
    fs.readFileSync(require.resolve("../public/JS/plans.js"), "utf8"),
    fs.readFileSync(require.resolve("../public/JS/realisations.js"), "utf8"),
  ];
  for (const source of sources) {
    assert.doesNotMatch(
      source,
      /samplePlans|sampleVideos|Duplex Prestige R\+1 Yaoundé/,
    );
  }
});
