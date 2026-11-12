(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s),
    $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const loginForm = $("#admin-login-form");
  if (!loginForm) return;
  const loginBox = $("#admin-login"),
    content = $("#admin-content");
  const state = { plans: [], news: [] },
    typeNames = {
      residential: "Résidentiel",
      commercial: "Commercial",
      industrial: "Industriel",
      civil: "Génie civil",
    };
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const num = (v) => Number(v || 0).toLocaleString("fr-FR"),
    date = (v) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");
  async function api(path, { method = "GET", body } = {}) {
    const opts = {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: {},
    };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const r = await fetch(`/api/admin${path}`, opts),
      data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || `Erreur ${r.status}`);
    return data;
  }
  function msg(node, text, error = false) {
    if (!node) return;
    node.textContent = text;
    node.classList.toggle("is-error", error);
  }
  function formMsg(form, text, error = false) {
    msg($(".admin-status", form), text, error);
  }
  function renderError(sel, cols, error) {
    const n = $(sel);
    if (n)
      n.innerHTML = `<tr><td colspan="${cols}">${esc(error.message)}</td></tr>`;
  }
  function lock(authenticated) {
    loginBox.classList.toggle("is-hidden", authenticated);
    content.classList.toggle("is-locked", !authenticated);
  }
  async function upload(file, kind) {
    if (!file) return null;
    const sign = await api("/uploads/sign", {
      method: "POST",
      body: { kind, mime_type: file.type, size: file.size },
    });
    const r = await fetch(sign.signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
        apikey: sign.apiKey,
        Authorization: `Bearer ${sign.apiKey}`,
        "x-upsert": "false",
      },
      body: file,
    });
    if (!r.ok) throw new Error(`Échec du dépôt du fichier (${r.status}).`);
    return { path: sign.path, url: sign.publicUrl };
  }
  function obj(form) {
    const out = {};
    for (const [k, v] of new FormData(form))
      if (!(v instanceof File) && v !== "") out[k] = v;
    return out;
  }
  function busy(form, on) {
    const b = $('button[type="submit"]', form);
    if (!b) return;
    if (!b.dataset.label) b.dataset.label = b.textContent;
    b.disabled = on;
    b.textContent = on ? "Enregistrement…" : b.dataset.label;
  }
  function reset(form) {
    form.reset();
    delete form.dataset.id;
    const h = $("h3", form);
    if (h)
      h.textContent =
        form.id === "plan-form" ? "Nouveau plan" : "Publier une actualité";
    formMsg(form, "");
  }
  function showRows(sel, columns, rows, empty, render) {
    const n = $(sel);
    if (n)
      n.innerHTML = rows.length
        ? rows.map(render).join("")
        : `<tr><td colspan="${columns}">${empty}</td></tr>`;
  }

  function renderPlans() {
    showRows(
      "#plans-table",
      7,
      state.plans,
      "Aucun plan enregistré.",
      (p) =>
        `<tr><td>${esc(p.name)}</td><td>${esc(typeNames[p.type] || p.type)}</td><td>${esc(p.surface || "—")}</td><td>${num(p.price)} FCFA</td><td>${esc(p.status)}</td><td>${p.pdf_path ? "Associé" : "Manquant"}</td><td class="admin-actions"><button data-action="edit-plan" data-id="${esc(p.id)}">Modifier</button><button data-action="toggle-plan" data-id="${esc(p.id)}">${p.status === "published" ? "Masquer" : "Publier"}</button><button data-action="delete-plan" data-id="${esc(p.id)}">Supprimer</button></td></tr>`,
    );
  }
  function renderNews() {
    showRows(
      "#news-table",
      5,
      state.news,
      "Aucune actualité.",
      (p) =>
        `<tr><td>${esc(p.title)}</td><td>${esc(p.category || "—")}</td><td>${date(p.published_on)}</td><td>${esc(p.status)}</td><td class="admin-actions"><button data-action="edit-news" data-id="${esc(p.id)}">Modifier</button><button data-action="toggle-news" data-id="${esc(p.id)}">${p.status === "published" ? "Masquer" : "Publier"}</button><button data-action="delete-news" data-id="${esc(p.id)}">Supprimer</button></td></tr>`,
    );
  }
  function renderAnalytics(a) {
    const v = a.visitors || {};
    for (const [k, x] of Object.entries({
      "visitors-day": v.today,
      "visitors-week": v.week,
      "visitors-month": v.month,
      "visitors-year": v.year,
      "paid-orders": a.paid_orders,
      "project-requests": a.project_requests,
    }))
      $$(`[data-stat="${k}"]`).forEach((n) => (n.textContent = num(x)));
    showRows(
      "#analytics-views",
      3,
      a.plan_views || [],
      "Aucune vue de plan enregistrée.",
      (x) =>
        `<tr><td>${esc(x.name || x.plan_id)}</td><td>${esc(typeNames[x.type] || x.type || "—")}</td><td>${num(x.views)}</td></tr>`,
    );
    showRows(
      "#analytics-purchases",
      3,
      a.purchases_by_type || [],
      "Aucun achat sur 12 mois.",
      (x) =>
        `<tr><td>${esc(typeNames[x.type] || x.type)}</td><td>${num(x.purchases)}</td><td>${num(x.amount)}</td></tr>`,
    );
  }
  function renderSettings(rows, links) {
    const values = Object.fromEntries(
      (rows || []).map((x) => [
        x.key,
        typeof x.value === "string" ? x.value : String(x.value ?? ""),
      ]),
    );
    const form = $("#settings-form");
    for (const input of $$("input[name],textarea[name]", form)) {
      if (
        ![
          "facebook",
          "instagram",
          "linkedin",
          "tiktok",
          "youtube",
          "x",
        ].includes(input.name) &&
        values[input.name] !== undefined
      )
        input.value = values[input.name];
    }
    for (const link of links || []) {
      const input = $(`[name="${link.network}"]`, form);
      if (input) input.value = link.url || "";
    }
  }
  async function load() {
    const paths = [
      "/plans",
      "/news",
      "/videos",
      "/orders",
      "/newsletter/subscribers",
      "/analytics",
      "/stats",
      "/settings",
      "/social-links",
    ];
    const result = await Promise.allSettled(paths.map((p) => api(p)));
    const val = (i, d = []) =>
      result[i].status === "fulfilled" ? result[i].value : d;
    state.plans = val(0);
    state.news = val(1);
    renderPlans();
    renderNews();
    if (result[0].status === "rejected")
      renderError("#plans-table", 7, result[0].reason);
    if (result[1].status === "rejected")
      renderError("#news-table", 5, result[1].reason);
    const videos = val(2);
    showRows(
      "#videos-table",
      4,
      videos,
      "Aucune vidéo publiée ou YouTube indisponible.",
      (x) => {
        const id = /^[\w-]{6,20}$/.test(x.youtube_id || x.id)
          ? x.youtube_id || x.id
          : "";
        return `<tr><td>${id ? `<a href="https://www.youtube.com/watch?v=${encodeURIComponent(id)}" target="_blank" rel="noopener">${esc(x.title || "YouTube")}</a>` : esc(x.title)}</td><td>${date(x.published_at)}</td><td>${num(x.views)}</td><td>YouTube</td></tr>`;
      },
    );
    if (result[2].status === "rejected")
      renderError("#videos-table", 4, result[2].reason);
    const orders = val(3);
    showRows(
      "#orders-table",
      7,
      orders,
      "Aucune commande.",
      (o) =>
        `<tr><td>${esc(String(o.id).slice(0, 8))}</td><td>${esc(o.plan_name || "—")}</td><td>${esc(o.name)}<br><small>${esc(o.email)}</small></td><td>${num(o.amount)} ${esc(o.currency || "XAF")}</td><td>${esc(o.status)}</td><td>${esc(o.delivery_status || "—")}</td><td>${o.status === "paid" ? `<button data-action="deliver-order" data-id="${esc(o.id)}">Renvoyer le PDF</button>` : "—"}</td></tr>`,
    );
    if (result[3].status === "rejected")
      renderError("#orders-table", 7, result[3].reason);
    const subs = val(4);
    showRows(
      "#subscribers-table",
      4,
      subs,
      "Aucun abonné.",
      (x) =>
        `<tr><td>${esc(x.email)}</td><td>${date(x.created_at)}</td><td>${esc(x.status)}</td><td>${x.status === "active" ? `<button data-action="unsubscribe" data-id="${esc(x.id)}">Désinscrire</button>` : "—"}</td></tr>`,
    );
    if (result[4].status === "rejected")
      renderError("#subscribers-table", 4, result[4].reason);
    if (result[5].status === "fulfilled") renderAnalytics(val(5, {}));
    else {
      renderError("#analytics-views", 3, result[5].reason);
      renderError("#analytics-purchases", 3, result[5].reason);
    }
    const a = val(5, {});
    for (const [k, x] of Object.entries({
      "visitors-day": a.visitors?.today,
      "visitors-month": a.visitors?.month,
      "paid-orders": a.paid_orders,
      "project-requests": a.project_requests,
    }))
      $$(`[data-stat="${k}"]`).forEach((n) => (n.textContent = num(x)));
    $$('[data-stat="plans"]').forEach(
      (n) =>
        (n.textContent = num(
          state.plans.filter((x) => x.status === "published").length,
        )),
    );
    $$('[data-stat="news"]').forEach(
      (n) =>
        (n.textContent = num(
          state.news.filter((x) => x.status === "published").length,
        )),
    );
    $$('[data-stat="subscribers"]').forEach(
      (n) =>
        (n.textContent = num(subs.filter((x) => x.status === "active").length)),
    );
    if (result[6].status === "fulfilled")
      for (const key of [
        "projects",
        "experience",
        "collaborators",
        "cities",
        "clients",
      ]) {
        const field = $(`#stats-form [name=\"${key}\"]`);
        if (field) field.value = val(6, {})[key] ?? 0;
      }
    if (result[7].status === "fulfilled") renderSettings(val(7), val(8));
  }
  function editPlan(id) {
    const p = state.plans.find((x) => x.id === id);
    if (!p) return;
    const f = $("#plan-form");
    f.dataset.id = id;
    f.classList.remove("is-hidden");
    for (const k of [
      "name",
      "type",
      "surface",
      "price",
      "description",
      "status",
    ])
      $(`[name="${k}"]`, f).value = p[k] ?? "";
    $('[name="characteristics"]', f).value = Object.entries(
      p.characteristics || {},
    )
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    $("h3", f).textContent = "Modifier le plan (PDF optionnel)";
    formMsg(f, "PDF et couverture existants conservés sans nouvel upload.");
    f.scrollIntoView({ behavior: "smooth" });
  }
  function editNews(id) {
    const p = state.news.find((x) => x.id === id);
    if (!p) return;
    const f = $("#news-form");
    f.dataset.id = id;
    f.classList.remove("is-hidden");
    for (const k of [
      "title",
      "category",
      "published_on",
      "location",
      "summary",
      "content",
      "status",
    ])
      $(`[name="${k}"]`, f).value = p[k] ?? "";
    $("h3", f).textContent = "Modifier une actualité";
    formMsg(
      f,
      "Image existante conservée si aucun nouveau fichier n’est choisi.",
    );
    f.scrollIntoView({ behavior: "smooth" });
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!loginForm.reportValidity()) return;
    const status = $("#admin-login-status");
    msg(status, "Vérification…");
    try {
      const r = await fetch("/api/admin/login", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.fromEntries(new FormData(loginForm))),
        }),
        d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || "Connexion refusée.");
      lock(true);
      loginForm.reset();
      msg(status, "");
      await load();
    } catch (err) {
      msg(status, err.message, true);
    }
  });
  $("#admin-logout")?.addEventListener("click", async () => {
    await fetch("/api/admin/logout", {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => {});
    lock(false);
    loginForm.reset();
  });
  $$(".admin-tab").forEach((b) =>
    b.addEventListener("click", () => {
      $$(".admin-tab").forEach((x) => x.classList.toggle("is-active", x === b));
      $$(".admin-panel").forEach((x) =>
        x.classList.toggle("is-active", x.id === `panel-${b.dataset.panel}`),
      );
      $(".admin-sidebar")?.classList.remove("is-open");
    }),
  );
  $(".admin-menu")?.addEventListener("click", () =>
    $(".admin-sidebar")?.classList.toggle("is-open"),
  );
  $$(".admin-add").forEach((b) =>
    b.addEventListener("click", () => {
      const f = $(`#${b.dataset.form}`);
      f.reset();
      delete f.dataset.id;
      f.classList.remove("is-hidden");
      f.scrollIntoView({ behavior: "smooth" });
    }),
  );
  $$(".admin-cancel").forEach((b) =>
    b.addEventListener("click", () => {
      const f = b.closest("form");
      reset(f);
      f.classList.add("is-hidden");
    }),
  );
  $("#plan-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    busy(f, true);
    formMsg(f, "Enregistrement…");
    try {
      const p = obj(f),
        id = f.dataset.id,
        cover = $('[name="cover"]', f).files[0],
        pdf = $('[name="pdf"]', f).files[0];
      if (cover) p.cover_path = (await upload(cover, "plan-cover")).url;
      if (pdf) p.pdf_path = (await upload(pdf, "plan-pdf")).path;
      if (!id && !pdf)
        throw new Error("Ajoutez le PDF du plan avant sa publication.");
      p.price = Number(p.price);
      if (!Number.isSafeInteger(p.price) || p.price < 0)
        throw new Error("Prix invalide.");
      await api(id ? `/plans/${encodeURIComponent(id)}` : "/plans", {
        method: id ? "PUT" : "POST",
        body: p,
      });
      reset(f);
      f.classList.add("is-hidden");
      await load();
    } catch (err) {
      formMsg(f, err.message, true);
    } finally {
      busy(f, false);
    }
  });
  $("#news-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    busy(f, true);
    formMsg(f, "Enregistrement…");
    try {
      const p = obj(f),
        id = f.dataset.id,
        image = $('[name="image"]', f).files[0];
      if (image) p.image_path = (await upload(image, "news-image")).url;
      await api(id ? `/news/${encodeURIComponent(id)}` : "/news", {
        method: id ? "PUT" : "POST",
        body: p,
      });
      reset(f);
      f.classList.add("is-hidden");
      await load();
    } catch (err) {
      formMsg(f, err.message, true);
    } finally {
      busy(f, false);
    }
  });
  $("#stats-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const values = Object.fromEntries(new FormData(f));
    for (const key of Object.keys(values)) values[key] = Number(values[key]);
    formMsg(f, "Enregistrement…");
    try {
      await api("/stats", { method: "PUT", body: values });
      formMsg(f, "Chiffres clés mis à jour.");
    } catch (err) {
      formMsg(f, err.message, true);
    }
  });
  $("#settings-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget,
      p = obj(f),
      networks = [
        "facebook",
        "instagram",
        "linkedin",
        "tiktok",
        "youtube",
        "x",
      ];
    formMsg(f, "Enregistrement…");
    try {
      await api("/settings", {
        method: "PUT",
        body: Object.fromEntries(
          Object.entries(p).filter(([k]) => !networks.includes(k)),
        ),
      });
      await api("/social-links", {
        method: "PUT",
        body: {
          links: networks.map((network) => ({
            network,
            url: p[network] || "",
          })),
        },
      });
      formMsg(f, "Coordonnées et réseaux enregistrés.");
    } catch (err) {
      formMsg(f, err.message, true);
    }
  });
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-action]");
    if (!b) return;
    const { action, id } = b.dataset;
    b.disabled = true;
    try {
      if (action === "edit-plan") editPlan(id);
      if (action === "edit-news") editNews(id);
      if (action === "toggle-plan") {
        const p = state.plans.find((x) => x.id === id);
        await api(`/plans/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: { status: p.status === "published" ? "hidden" : "published" },
        });
        await load();
      }
      if (action === "toggle-news") {
        const p = state.news.find((x) => x.id === id);
        await api(`/news/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: { status: p.status === "published" ? "hidden" : "published" },
        });
        await load();
      }
      if (action === "delete-plan" || action === "delete-news") {
        if (!confirm("Confirmer la suppression ?")) return;
        await api(
          `/${action === "delete-plan" ? "plans" : "news"}/${encodeURIComponent(id)}`,
          { method: "DELETE" },
        );
        await load();
      }
      if (action === "deliver-order") {
        await api(`/orders/${encodeURIComponent(id)}/deliver`, {
          method: "POST",
          body: {},
        });
        await load();
      }
      if (action === "unsubscribe") {
        await api(`/newsletter/subscribers/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: { status: "unsubscribed" },
        });
        await load();
      }
    } catch (err) {
      alert(err.message || "Action impossible.");
    } finally {
      b.disabled = false;
    }
  });
  (async () => {
    try {
      const r = await fetch("/api/admin/session", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (r.ok) {
        lock(true);
        await load();
      }
    } catch {}
  })();
})();
