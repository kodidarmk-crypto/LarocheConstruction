(() => {
  const grid = document.querySelector("#realizations-grid");
  const empty = document.querySelector("#realizations-empty");
  const pagination = document.querySelector("#reels-pagination");
  const modalContainer = document.querySelector("#video-modal-container");

  if (!grid) return;

  const pageSize = 21; // 3 * 7 per Modif.md
  let videos = [];
  let currentPage = 1;
  let currentPlayingIndex = -1;

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

  function renderVideos() {
    const totalPages = Math.ceil(videos.length / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * pageSize;
    const pageItems = videos.slice(start, start + pageSize);

    if (pageItems.length === 0) {
      grid.innerHTML = "";
      if (empty) empty.classList.remove("is-hidden");
      if (pagination) pagination.innerHTML = "";
      return;
    }

    if (empty) empty.classList.add("is-hidden");
    grid.innerHTML = pageItems
      .map((video, idx) => {
        const globalIdx = start + idx;
        const thumb =
          video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
        return `<article class="service-card video-card" data-index="${globalIdx}">
        <div class="video-card-media">
          <img src="${escapeHtml(thumb)}" alt="${escapeHtml(video.title || "Vidéo")}" class="video-card-image">
          <div class="video-card-overlay">
            <div class="video-play-button">▶</div>
          </div>
        </div>
        <div class="video-card-info">
          <p class="eyebrow video-card-eyebrow">LAROCHE VIDÉO</p>
          <h3 class="video-card-title">${escapeHtml(video.title || "Réalisation Laroche Construction")}</h3>
          <span class="text-link dark video-card-link">Visionner <span>↗</span></span>
        </div>
      </article>`;
      })
      .join("");

    // Pagination: < 1 2 3 ... 99 >
    if (pagination) {
      if (totalPages <= 1) {
        pagination.innerHTML = "";
      } else {
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
          btn.addEventListener("click", () => {
            const p = Number(btn.getAttribute("data-page"));
            if (p >= 1 && p <= totalPages && p !== currentPage) {
              currentPage = p;
              renderVideos();
              window.scrollTo({
                top: grid.offsetTop - 100,
                behavior: "smooth",
              });
            }
          });
        });
      }
    }

    // Attach click events
    grid.querySelectorAll("article[data-index]").forEach((card) => {
      card.addEventListener("click", () => {
        const idx = Number(card.getAttribute("data-index"));
        openVideo(idx);
      });
    });
  }

  function openVideo(index) {
    if (index < 0 || index >= videos.length) return;
    currentPlayingIndex = index;
    const video = videos[index];

    closeModal();
    const modal = document.createElement("div");
    modal.className = "plan-preview";
    modal.id = "active-video-modal";

    let originParam = "";
    const isHttp = window.location.protocol.startsWith("http");
    try {
      if (
        isHttp &&
        window.location.origin &&
        window.location.origin !== "null"
      ) {
        originParam = `&origin=${encodeURIComponent(window.location.origin)}`;
      }
    } catch (_) {}

    const embedUrl = `https://www.youtube.com/embed/${encodeURIComponent(video.id)}?autoplay=1&rel=0&playsinline=1&enablejsapi=1${originParam}`;
    const ytWatchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`;

    modal.innerHTML = `
      <div class="plan-preview-backdrop"></div>
      <div class="plan-preview-dialog video-dialog">
        <button class="plan-preview-close video-dialog-close" type="button" aria-label="Fermer">×</button>
        <div class="video-dialog-header">
          <h2 class="video-dialog-title">${escapeHtml(video.title || "Vidéo Laroche Construction")}</h2>
          <a href="${ytWatchUrl}" target="_blank" rel="noopener noreferrer" class="video-dialog-external">Ouvrir sur YouTube ↗</a>
        </div>
        ${
          !isHttp
            ? `
        <div class="video-local-note">
          <strong>Note :</strong> YouTube bloque parfois la lecture en mode fichier local (file://). Ouvrez le site via le serveur local (http://localhost:3000) ou cliquez sur "Regarder sur YouTube".
        </div>
        `
            : ""
        }
        <div class="video-dialog-frame">
          <iframe 
            src="${embedUrl}" 
            title="${escapeHtml(video.title || "Vidéo Laroche Construction")}"
            class="video-iframe"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen>
          </iframe>
        </div>
        <div class="video-dialog-actions">
          <button type="button" class="button button-outline dark-outline btn-video-prev" ${index === 0 ? "disabled" : ""}>← Précédente</button>
          <div class="video-dialog-secondary-actions">
            <span class="video-dialog-count">${index + 1} / ${videos.length}</span>
            <a href="${ytWatchUrl}" target="_blank" rel="noopener noreferrer" class="button button-outline video-dialog-youtube">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="#ff0000" aria-hidden="true"><path d="M21.6 7.2a2.8 2.8 0 0 0-2-2C17.8 4.7 12 4.7 12 4.7s-5.8 0-7.6.5a2.8 2.8 0 0 0-2 2A29 29 0 0 0 2 12a29 29 0 0 0 .4 4.8 2.8 2.8 0 0 0 2 2c1.8.5 7.6.5 7.6.5s5.8 0 7.6-.5a2.8 2.8 0 0 0 2-2A29 29 0 0 0 22 12a29 29 0 0 0-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z"/></svg>
              Regarder sur YouTube ↗
            </a>
          </div>
          <button type="button" class="button button-gold btn-video-next" ${index === videos.length - 1 ? "disabled" : ""}>Suivante (Next) →</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.classList.add("plan-preview-open");

    modal
      .querySelector(".plan-preview-close")
      .addEventListener("click", closeModal);
    modal
      .querySelector(".plan-preview-backdrop")
      .addEventListener("click", closeModal);

    const prevBtn = modal.querySelector(".btn-video-prev");
    const nextBtn = modal.querySelector(".btn-video-next");
    if (prevBtn && index > 0) {
      prevBtn.addEventListener("click", () => openVideo(index - 1));
    }
    if (nextBtn && index < videos.length - 1) {
      nextBtn.addEventListener("click", () => openVideo(index + 1));
    }
  }

  function closeModal() {
    const modal = document.querySelector("#active-video-modal");
    if (modal) {
      modal.remove();
      document.body.classList.remove("plan-preview-open");
    }
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
    if (
      e.key === "ArrowRight" &&
      currentPlayingIndex >= 0 &&
      currentPlayingIndex < videos.length - 1
    ) {
      openVideo(currentPlayingIndex + 1);
    }
    if (e.key === "ArrowLeft" && currentPlayingIndex > 0) {
      openVideo(currentPlayingIndex - 1);
    }
  });

  async function fetchVideos() {
    try {
      const response = await fetch("/api/public/videos");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const list = Array.isArray(data) ? data : data.videos || data.items || [];

      const parsed = list
        .map((item) => {
          let vid = item.id || item.youtube_id || item.videoId;
          if (typeof vid === "object" && vid.videoId) vid = vid.videoId;
          return {
            id: vid,
            title:
              item.title ||
              item.snippet?.title ||
              "Réalisation Laroche Construction",
            thumbnail:
              item.thumbnail ||
              item.snippet?.thumbnails?.high?.url ||
              item.snippet?.thumbnails?.medium?.url ||
              `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
            publishedAt:
              item.published_at ||
              item.publishedAt ||
              item.snippet?.publishedAt ||
              0,
          };
        })
        .filter((v) => v.id);

      videos = parsed;
      if (empty) empty.textContent = "Aucune vidéo disponible pour le moment.";
      renderVideos();
    } catch (e) {
      if (!videos.length) {
        if (empty)
          empty.textContent =
            "Les vidéos ne peuvent pas être chargées pour le moment. Actualisez la page pour réessayer.";
        renderVideos();
      }
      console.error("Chargement des vidéos YouTube impossible.");
    }
  }

  fetchVideos();

  // Refresh every 5 minutes per Modif.md ("l'api va refresh chaque 5 mins pour voir si une nouvelle vidéo est disponible")
  setInterval(fetchVideos, 5 * 60 * 1000);
})();
