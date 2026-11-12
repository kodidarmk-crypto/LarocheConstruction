(() => {
  const isPagesDir = window.location.pathname.includes("/page/");
  const detailBase = isPagesDir ? "news-detail.html" : "page/news-detail.html";
  const defaultImage = isPagesDir
    ? "../image/Screenshot_20260904_142806_Drive.jpg"
    : "image/Screenshot_20260904_142806_Drive.jpg";

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
  const formatDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? escapeHtml(value)
      : new Intl.DateTimeFormat("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).format(date);
  };
  const getDateValue = (item) =>
    new Date(
      item.published_on ||
        item.publishedAt ||
        item.created_at ||
        item.createdAt ||
        0,
    ).getTime() || 0;

  // 1. Home page news section (3 latest news)
  const homeGrid = document.querySelector("#home-news-grid");
  const homeEmpty = document.querySelector("#home-news-empty");
  if (homeGrid) {
    fetch("/api/public/news")
      .then((res) => {
        if (!res.ok) throw new Error("Les actualités sont temporairement indisponibles.");
        return res.json();
      })
      .then((data) => {
        const items = (Array.isArray(data) ? data : data.news) || [];
        const published = items
          .filter(
            (item) =>
              item.status === "published" || (!item.status && item.title),
          )
          .sort((a, b) => getDateValue(b) - getDateValue(a))
          .slice(0, 3);

        if (published.length > 0) {
          homeGrid.innerHTML = published
            .map((item) => {
              const img =
                item.image_path || item.image || item.imageUrl || defaultImage;
              const dateStr = formatDate(
                item.published_on || item.publishedAt || item.created_at,
              );
              return `<article class="news-card">
              <img src="${escapeHtml(img)}" alt="${escapeHtml(item.title || "Actualité")}">
              <div>
                <p class="news-meta">${escapeHtml(item.category || "ACTUALITÉS")} ${dateStr ? `<span>—</span> ${dateStr}` : ""}</p>
                <h3>${escapeHtml(item.title || "")}</h3>
                <a class="button button-gold news-read-link" href="${detailBase}?id=${encodeURIComponent(item.id || "")}">Lire <span>↗</span></a>
              </div>
            </article>`;
            })
            .join("");
          if (homeEmpty) homeEmpty.classList.add("is-hidden");
        } else {
          homeGrid.innerHTML = "";
          if (homeEmpty) homeEmpty.classList.remove("is-hidden");
        }
      })
      .catch(() => {
        if (homeEmpty) {
          homeEmpty.textContent = "Les actualités sont temporairement indisponibles.";
          homeEmpty.classList.remove("is-hidden");
        }
      });
  }

  // 2. News archive page (page/news.html - max 30 per page, 3x10 grid, pagination < 1 2 3 ... 99 >)
  const grid = document.querySelector("#news-archive-grid");
  const count = document.querySelector("#news-count");
  const empty = document.querySelector("#news-empty");
  const pagination =
    document.querySelector("#news-pagination") ||
    (() => {
      if (!grid) return null;
      let pag = document.querySelector(".news-pagination");
      if (!pag) {
        pag = document.createElement("nav");
        pag.className = "plans-pagination news-pagination";
        pag.id = "news-pagination";
        grid.parentNode.insertBefore(pag, grid.nextSibling);
      }
      return pag;
    })();

  if (!grid) return;

  const pageSize = 30; // 3 * 10
  let currentPage = 1;
  let allNews = [];

  function renderArchive() {
    const totalPages = Math.ceil(allNews.length / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * pageSize;
    const pageItems = allNews.slice(start, start + pageSize);

    if (count) {
      count.textContent = allNews.length
        ? `${allNews.length} actualité${allNews.length > 1 ? "s" : ""}`
        : "";
    }

    if (pageItems.length === 0) {
      grid.innerHTML = "";
      if (empty) empty.classList.remove("is-hidden");
      if (pagination) pagination.innerHTML = "";
      return;
    }

    if (empty) empty.classList.add("is-hidden");
    grid.innerHTML = pageItems
      .map((item) => {
        const img =
          item.image_path || item.image || item.imageUrl || defaultImage;
        const dateStr = formatDate(
          item.published_on || item.publishedAt || item.created_at,
        );
        const excerpt =
          item.summary ||
          (item.content ? item.content.slice(0, 140) + "..." : "");
        return `<article class="news-card">
        <img src="${escapeHtml(img)}" alt="${escapeHtml(item.title || "Actualité Laroche Construction")}">
        <div>
          <p class="news-meta">${escapeHtml(item.category || "ACTUALITÉS")} ${dateStr ? `<span>—</span> ${dateStr}` : ""}</p>
          <h3>${escapeHtml(item.title || "")}</h3>
          ${excerpt ? `<p class="news-summary">${escapeHtml(excerpt)}</p>` : ""}
          <a class="button button-gold news-read-link" href="news-detail.html?id=${encodeURIComponent(item.id || "")}">Lire <span>↗</span></a>
        </div>
      </article>`;
      })
      .join("");

    // Pagination controls: < 1 2 3 ... 99 >
    if (pagination) {
      if (totalPages <= 1) {
        pagination.innerHTML = "";
        return;
      }
      let html = "";
      html += `<button type="button" class="page-prev" ${currentPage === 1 ? "disabled" : ""} data-page="${currentPage - 1}">&lt;</button>`;

      for (let i = 1; i <= totalPages; i++) {
        if (
          i === 1 ||
          i === totalPages ||
          (i >= currentPage - 2 && i <= currentPage + 2)
        ) {
          html += `<button type="button" class="${i === currentPage ? "is-active" : ""}" data-page="${i}">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
          html += `<span class="pagination-ellipsis">&hellip;</span>`;
        }
      }
      html += `<button type="button" class="page-next" ${currentPage === totalPages ? "disabled" : ""} data-page="${currentPage + 1}">&gt;</button>`;
      pagination.innerHTML = html;

      pagination.querySelectorAll("button[data-page]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const p = Number(btn.getAttribute("data-page"));
          if (p >= 1 && p <= totalPages && p !== currentPage) {
            currentPage = p;
            renderArchive();
            window.scrollTo({ top: grid.offsetTop - 100, behavior: "smooth" });
          }
        });
      });
    }
  }

  fetch("/api/public/news")
    .then((res) => {
      if (!res.ok) throw new Error("Les actualités sont temporairement indisponibles.");
      return res.json();
    })
    .then((data) => {
      const items = (Array.isArray(data) ? data : data.news) || [];
      allNews = items
        .filter(
          (item) => item.status === "published" || (!item.status && item.title),
        )
        .sort((a, b) => getDateValue(b) - getDateValue(a));
      renderArchive();
    })
    .catch(() => {
      if (empty) {
        empty.textContent = "Les actualités sont temporairement indisponibles. Réessayez plus tard.";
        empty.classList.remove("is-hidden");
      }
    });
})();
