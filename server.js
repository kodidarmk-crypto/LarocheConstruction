/* Local backend. Static files are served here; API routes use the shared handler. */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { api } = require("./lib/shared");

const root = __dirname;
const publicRoot = path.join(root, "public");
const port = Number(process.env.PORT || 3000);

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; connect-src 'self' https:;",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...securityHeaders,
    ...headers,
  });
  res.end(JSON.stringify(body));
}
function fail(res, status, message) {
  return send(res, status, { message });
}
function staticFile(res, url) {
  let requested;
  try {
    requested = decodeURIComponent(url.pathname);
  } catch {
    return fail(res, 400, "Adresse de fichier invalide.");
  }
  if (requested === "/") requested = "/index.html";
  const resolveFile = (base) => {
    const candidate = path.resolve(base, `.${requested}`);
    const relative = path.relative(base, candidate);
    if (
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    )
      return null;
    return fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory()
      ? candidate
      : null;
  };
  const file = resolveFile(publicRoot) || resolveFile(root);
  if (!file) return fail(res, 404, "Fichier introuvable.");
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
  };
  res.writeHead(200, {
    "Content-Type":
      types[path.extname(file).toLowerCase()] || "application/octet-stream",
    ...securityHeaders,
  });
  fs.createReadStream(file).pipe(res);
}
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      if (url.pathname.startsWith("/api/")) return await api(req, res, url);
      if (url.pathname === "/pages" || url.pathname.startsWith("/pages/")) {
        url.pathname = url.pathname.replace(/^\/pages(?=\/|$)/, "/page");
        res.writeHead(308, {
          Location: `${url.pathname}${url.search}`,
          ...securityHeaders,
        });
        return res.end();
      }
      return staticFile(res, url);
    } catch (e) {
      console.error("Request error:", e.message);
      if (!res.headersSent) fail(res, 500, "Erreur serveur.");
    }
  })
  .listen(port, () =>
    console.log(`Laroche local server: http://localhost:${port}`),
  );
