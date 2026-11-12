(() => {
  const form = document.querySelector("#plans-filter-form");
  const grid = document.querySelector("#plans-grid");
  const status = document.querySelector("#plans-filter-status");
  const typeSelect = document.querySelector("#plan-type");
  const priceSelect = document.querySelector("#plan-price-range");
  const specificFields = document.querySelector("#plan-specific-fields");
  const order = document.querySelector("#plan-order");
  const orderForm = document.querySelector("#plan-order-form");
  const orderStatus = document.querySelector(".plans-order-status");
  const newsletterStatus = document.querySelector("#plan-newsletter-status");
  const empty = document.querySelector("#plans-empty");
  const pagination = document.querySelector("#plans-pagination");
  const preview = document.querySelector("#plan-preview");
  const previewFrame = document.querySelector("#plan-preview-frame");
  const previewTitle = document.querySelector("#plan-preview-title");
  const paymentLabel = document.querySelector("#plan-payment-label");
  const paymentReturnStatus = document.querySelector("#payment-return-status");

  if (!form || !grid) return;

  let plans = [];
  let filteredPlans = [];
  let currentPage = 1;
  let catalogueUnavailable = false;
  const trackedPlanViews = new Set();
  const pageSize = 20; // 4 * 5 per Modif.md

  const formatPrice = (price) => Number(price || 0).toLocaleString("fr-FR");
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

  const urlParams = new URLSearchParams(window.location.search);
  const returnedOrderId = urlParams.get("order_id");
  async function checkReturnedOrder(orderId) {
    if (
      !paymentReturnStatus ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        orderId,
      )
    )
      return;
    paymentReturnStatus.classList.remove("is-hidden");
    paymentReturnStatus.textContent =
      "Paiement en cours de vérification côté serveur. Le retour seul ne confirme pas le paiement.";
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const response = await fetch(
          `/api/public/order-status?order_id=${encodeURIComponent(orderId)}`,
          { cache: "no-store" },
        );
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.status === "paid") {
          paymentReturnStatus.textContent =
            data.delivery_status === "sent"
              ? "Paiement confirmé. Le plan a été envoyé à votre adresse email."
              : data.delivery_status === "failed"
                ? "Paiement confirmé. L’envoi email nécessite une vérification; contactez Laroche Construction."
                : "Paiement confirmé. Préparation de l’envoi du plan par email.";
          return;
        }
        if (response.ok && ["failed", "cancelled"].includes(data.status)) {
          paymentReturnStatus.textContent =
            "Le paiement n’a pas été confirmé. Aucun plan ne sera envoyé.";
          return;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    paymentReturnStatus.textContent =
      "La confirmation de paiement prend plus de temps que prévu. Ne payez pas une seconde fois; vérifiez votre email ou contactez-nous.";
  }
  if (returnedOrderId) checkReturnedOrder(returnedOrderId);

  function priceMatches(price, range) {
    const amount = Number(price || 0);
    return (
      !range ||
      (range === "free" && amount === 0) ||
      (range === "0-4990" && amount > 0 && amount <= 4990) ||
      (range === "4990-9990" && amount > 4990 && amount <= 9990) ||
      (range === "9990-plus" && amount > 9990)
    );
  }
  const featureOptions = {
    residential: [
      [
        "bedrooms",
        "Chambres",
        [
          ["1-2", "1 à 2"],
          ["3", "3"],
          ["4-plus", "4 ou plus"],
        ],
      ],
      [
        "bathrooms",
        "Douches / toilettes",
        [
          ["1-2", "1 à 2"],
          ["3", "3"],
          ["4-plus", "4 ou plus"],
        ],
      ],
      [
        "levels",
        "Niveaux",
        [
          ["one", "Plain-pied"],
          ["two", "R+1 / R+2"],
          ["three-plus", "R+3 ou plus"],
        ],
      ],
      [
        "parking",
        "Stationnement",
        [
          ["none", "Aucun"],
          ["standard", "Standard"],
          ["garage", "Garage"],
        ],
      ],
    ],
    commercial: [
      [
        "activity",
        "Activité",
        [
          ["office", "Bureaux"],
          ["retail", "Commerce"],
          ["hospitality", "Hôtellerie / restauration"],
        ],
      ],
      [
        "levels",
        "Niveaux",
        [
          ["one", "Un niveau"],
          ["two", "Deux niveaux"],
          ["three-plus", "Trois niveaux ou plus"],
        ],
      ],
      [
        "parking",
        "Stationnement",
        [
          ["none", "Aucun"],
          ["standard", "Standard"],
          ["large", "Important"],
        ],
      ],
    ],
    industrial: [
      [
        "industrial_use",
        "Type de bâtiment",
        [
          ["warehouse", "Entrepôt"],
          ["workshop", "Atelier"],
          ["technical", "Bâtiment technique"],
        ],
      ],
      [
        "levels",
        "Organisation",
        [
          ["single", "Plain-pied"],
          ["mixed", "Niveaux / mezzanine"],
        ],
      ],
      [
        "constraint",
        "Contrainte principale",
        [
          ["structure", "Structure"],
          ["logistics", "Logistique"],
          ["security", "Sécurité / normes"],
        ],
      ],
    ],
    civil: [
      [
        "work",
        "Type d’ouvrage",
        [
          ["foundation", "Fondations / terrassement"],
          ["road", "Route / voirie"],
          ["network", "Réseaux / assainissement"],
        ],
      ],
      [
        "terrain",
        "Terrain",
        [
          ["accessible", "Accessible"],
          ["difficult", "Difficile"],
        ],
      ],
      [
        "scale",
        "Échelle",
        [
          ["local", "Projet local"],
          ["large", "Projet d’envergure"],
        ],
      ],
    ],
  };
  function renderFeatureFilters(type) {
    if (!specificFields) return;
    const definitions = featureOptions[type] || [];
    specificFields.hidden = definitions.length === 0;
    specificFields.innerHTML = definitions
      .map(
        ([key, label, options]) =>
          `<label class="plan-filter-field"><span>${escapeHtml(label)}</span><select data-feature="${key}"><option value="">Tous</option>${options.map(([value, text]) => `<option value="${value}">${escapeHtml(text)}</option>`).join("")}</select></label>`,
      )
      .join("");
    specificFields
      .querySelectorAll("select")
      .forEach((select) => select.addEventListener("change", applyFilters));
  }
  function planMatchesFeatures(plan) {
    const attributes = plan.characteristics || plan.attributes || {};
    return [
      ...(specificFields?.querySelectorAll("select[data-feature]") || []),
    ].every(
      (select) =>
        !select.value ||
        String(attributes[select.dataset.feature] ?? "") === select.value,
    );
  }

  function renderPlans() {
    const totalPages = Math.ceil(filteredPlans.length / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * pageSize;
    const visible = filteredPlans.slice(start, start + pageSize);

    if (visible.length === 0) {
      grid.innerHTML = "";
      empty.classList.remove("is-hidden");
      pagination.innerHTML = "";
      return;
    }

    empty.classList.add("is-hidden");
    grid.innerHTML = visible
      .map((plan) => {
        const price = Number(plan.price || 0);
        const isFree = price === 0;
        const priceBtnLabel = isFree
          ? "Recevoir gratuitement"
          : `${formatPrice(price)} FCFA`;
        const cover =
          plan.cover_path || plan.coverUrl || "../image/residential-pinned.jpg";
        const previewImage = cover;

        return `<article class="service-card" data-plan-id="${escapeHtml(plan.id)}" data-plan-name="${escapeHtml(plan.name)}" data-price="${price}">
        <div>
          <button class="plan-image-button" type="button" data-preview="${escapeHtml(previewImage)}" data-title="${escapeHtml(plan.name)}">
            <img class="plan-image" src="${escapeHtml(cover)}" alt="Aperçu de ${escapeHtml(plan.name)}">
          </button>
          <p class="eyebrow plan-type">${escapeHtml(plan.type || "PLAN")}</p>
          <h2 class="plan-card-title">${escapeHtml(plan.name)}</h2>
          <p class="plan-card-description">${escapeHtml(plan.description || "")}</p>
        </div>
        <div class="plan-card-actions">
          ${
            isFree
              ? `<button class="button button-gold plan-buy-btn" type="button" data-plan-id="${escapeHtml(plan.id)}" data-plan-name="${escapeHtml(plan.name)}" data-price="0">Recevoir gratuitement <span>↗</span></button>`
              : `<button class="button button-gold plan-buy-btn" type="button" data-plan-id="${escapeHtml(plan.id)}" data-plan-name="${escapeHtml(plan.name)}" data-price="${price}">${priceBtnLabel} <span>↗</span></button>`
          }
        </div>
      </article>`;
      })
      .join("");

    // Pagination: < 1 2 3 ... 99 >
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
            renderPlans();
            window.scrollTo({ top: grid.offsetTop - 100, behavior: "smooth" });
          }
        });
      });
    }

    // Attach Buy listener
    grid.querySelectorAll(".plan-buy-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const viewedPlanId = btn.getAttribute("data-plan-id");
        if (!trackedPlanViews.has(viewedPlanId)) {
          trackedPlanViews.add(viewedPlanId);
          window.larocheTrack?.("plan_view", viewedPlanId);
        }
        const planId = btn.getAttribute("data-plan-id");
        const planName = btn.getAttribute("data-plan-name");
        const price = Number(btn.getAttribute("data-price"));

        document.querySelector("#order-plan-id").value = planId;
        document.querySelector("#order-plan-name").value = planName;
        document.querySelector("#order-plan-price").value = price;
        paymentLabel.textContent =
          price === 0 ? "Gratuit" : `${formatPrice(price)} FCFA`;
        document.querySelector("#plan-order-title").textContent =
          `Commander : ${planName}`;

        orderStatus.textContent = "";
        order.classList.remove("is-hidden");
        document.querySelector("#order-last-name").focus();
      });
    });

    // Preview
    grid.querySelectorAll(".plan-image-button").forEach((button) => {
      button.addEventListener("click", () => {
        if (!button.dataset.preview) return;
        previewTitle.textContent = button.dataset.title;
        previewFrame.src = `${button.dataset.preview}#toolbar=0&navpanes=0&scrollbar=0`;
        preview.classList.remove("is-hidden");
        document.body.classList.add("plan-preview-open");
      });
    });
  }

  async function loadPlans() {
    try {
      const response = await fetch("/api/public/plans");
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(
          result.message ||
            `Impossible de charger les plans (${response.status}).`,
        );
      }
      const data = await response.json();
      const list = Array.isArray(data) ? data : data.plans || [];
      catalogueUnavailable = false;
      plans = list.filter((plan) => plan.status !== "hidden");
      if (empty) empty.textContent = "Aucun plan publié pour le moment.";
      applyFilters();
    } catch (error) {
      catalogueUnavailable = true;
      plans = [];
      if (empty)
        empty.textContent =
          "Le catalogue est temporairement indisponible. Actualisez la page pour réessayer.";
      if (status) status.textContent = "Impossible de charger le catalogue.";
      renderPlans();
      console.error("Chargement du catalogue des plans impossible.");
    }
  }

  function applyFilters() {
    filteredPlans = plans.filter(
      (plan) =>
        (!typeSelect.value || plan.type === typeSelect.value) &&
        priceMatches(plan.price, priceSelect.value) &&
        planMatchesFeatures(plan),
    );
    currentPage = 1;
    renderPlans();
    if (status) {
      status.textContent = catalogueUnavailable
        ? "Impossible de charger le catalogue."
        : filteredPlans.length === 0
          ? plans.length === 0
            ? "Aucun plan publié pour le moment."
            : "Aucun plan ne correspond encore à ces critères."
          : `${filteredPlans.length} plan${filteredPlans.length > 1 ? "s" : ""} disponible${filteredPlans.length > 1 ? "s" : ""}.`;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    applyFilters();
  });
  priceSelect.addEventListener("change", applyFilters);
  typeSelect.addEventListener("change", () => {
    renderFeatureFilters(typeSelect.value);
    applyFilters();
  });
  renderFeatureFilters(typeSelect.value);

  // Close modals
  document
    .querySelector("#plan-order-close")
    ?.addEventListener("click", () => order.classList.add("is-hidden"));
  order?.addEventListener("click", (e) => {
    if (e.target === order) order.classList.add("is-hidden");
  });
  document
    .querySelector("#plan-preview-close")
    ?.addEventListener("click", closePreview);
  preview
    ?.querySelector(".plan-preview-backdrop")
    ?.addEventListener("click", closePreview);
  function closePreview() {
    preview.classList.add("is-hidden");
    previewFrame.src = "about:blank";
    document.body.classList.remove("plan-preview-open");
  }

  // Handle Order Submit via Monetbil Widget / API
  orderForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!orderForm.checkValidity()) {
      orderForm.reportValidity();
      return;
    }
    const button = document.querySelector("#plan-submit-btn");
    button.disabled = true;
    button.classList.add("is-loading");
    orderStatus.textContent = "Initialisation du paiement sécurisé Monetbil…";

    const payload = {
      plan_id: document.querySelector("#order-plan-id").value,
      plan_name: document.querySelector("#order-plan-name").value,
      last_name: document.querySelector("#order-last-name").value,
      first_name: document.querySelector("#order-first-name").value,
      name: `${document.querySelector("#order-first-name").value} ${document.querySelector("#order-last-name").value}`.trim(),
      email: document.querySelector("#order-email").value,
      phone: document.querySelector("#order-phone").value,
      price: document.querySelector("#order-plan-price").value,
    };
    const newsletterConsent = document.querySelector(
      "#plan-newsletter-consent",
    ).checked;

    try {
      const newsletterRequest = newsletterConsent
        ? fetch("/api/newsletter/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: payload.email,
              source: "plan-order",
              consent: true,
            }),
          })
            .then(async (newsletterResponse) => {
              const newsletterResult = await newsletterResponse
                .json()
                .catch(() => ({}));
              if (!newsletterResponse.ok || newsletterResult.ok !== true)
                throw new Error("Newsletter subscription was not confirmed.");
              newsletterStatus.textContent =
                "Votre inscription à la newsletter est confirmée.";
            })
            .catch(() => {
              newsletterStatus.textContent =
                "Votre commande est indépendante de la newsletter ; votre inscription n’a pas pu être confirmée. Vous pourrez réessayer plus tard.";
            })
        : Promise.resolve().then(() => {
            newsletterStatus.textContent =
              "Vous n’avez pas demandé l’inscription à la newsletter.";
          });
      const [response] = await Promise.all([
        fetch("/api/plan-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
        newsletterRequest,
      ]);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          result.message || `Erreur serveur (${response.status})`,
        );
      }
      const paymentUrl = result.payment_url || result.paymentUrl;
      if (result.order?.status === "paid" && !paymentUrl) {
        orderStatus.textContent =
          result.delivery?.status === "sent"
            ? "Le plan gratuit a été envoyé à votre adresse email."
            : "La demande est enregistrée, mais l’envoi email est en attente. Contactez Laroche Construction si le message n’arrive pas.";
        return;
      }
      if (!paymentUrl)
        throw new Error(
          "Le paiement n’a pas été initialisé. Aucun paiement n’est confirmé.",
        );
      orderStatus.textContent =
        "Redirection vers le paiement sécurisé Monetbil…";
      window.location.href = paymentUrl;
    } catch (error) {
      orderStatus.textContent = error.message;
    } finally {
      button.disabled = false;
      button.classList.remove("is-loading");
    }
  });

  loadPlans();
})();
