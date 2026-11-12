(() => {
  const root = document.querySelector("#news-detail");
  if (!root) return;
  const escapeHtml = (value = "") =>
    String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[char],
    );
  const dateLabel = (value) => {
    if (!value) return "";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? ""
      : new Intl.DateTimeFormat("fr-FR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }).format(parsed);
  };
  const id = new URLSearchParams(window.location.search).get("id");
  const renderError = (message) => {
    root.innerHTML = `<div class="news-detail-error"><p class="eyebrow">ACTUALITÉ</p><h1>${escapeHtml(message)}</h1><a class="button button-gold" href="news.html">Retour aux actualités <span>↗</span></a></div>`;
  };
  const render = (item) => {
    if (!item || item.status === "hidden" || item.status === "draft") {
      renderError("Cette actualité est indisponible.");
      return;
    }
    const date = dateLabel(
      item.published_on || item.publishedAt || item.created_at,
    );
    const image =
      item.image_path ||
      item.image ||
      item.imageUrl ||
      "../image/Screenshot_20260904_142806_Drive.jpg";
    const body = item.content || item.summary || "";
    root.innerHTML = `<article><div class="news-detail-hero"><img src="${escapeHtml(image)}" alt="${escapeHtml(item.title || "Actualité Laroche Construction")}"><div><p class="eyebrow light">${escapeHtml(item.category || "ACTUALITÉS")}${date ? ` <span>—</span> <time datetime="${escapeHtml(item.published_on || item.publishedAt || "")}">${escapeHtml(date)}</time>` : ""}</p><h1>${escapeHtml(item.title || "")}</h1></div></div><div class="news-detail-body">${item.summary ? `<p class="news-detail-lead">${escapeHtml(item.summary)}</p>` : ""}<div class="news-detail-content">${escapeHtml(body)}</div><a class="text-link dark" href="news.html">Toutes les actualités <span>↗</span></a></div></article>`;
  };
  if (!id || id.length > 80) {
    renderError("Cette actualité est indisponible.");
    return;
  }
  root.textContent = "Chargement de l’actualité…";
  fetch(`/api/public/news/${encodeURIComponent(id)}`, { cache: "no-store" })
    .then(async (response) => {
      const item = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          response.status === 404
            ? "Cette actualité est indisponible."
            : "Le contenu est momentanément indisponible.",
        );
      return item;
    })
    .then(render)
    .catch((error) =>
      renderError(
        error.message || "Le contenu est momentanément indisponible.",
      ),
    );
})();
