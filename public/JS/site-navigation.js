const siteMenuButton = document.querySelector(".menu-toggle");
const siteNavigation = document.querySelector(".main-nav");
const siteBase = window.location.pathname.includes("/page/") ? "../" : "";
const pageBase = window.location.pathname.includes("/page/") ? "" : "page/";
let contactEmail = "larocheconstruction19@gmail.com";
let contactPhone = "+237 656 70 80 07";
let contactAddress = "Makepe, Douala, Cameroun";
let whatsappLink = "https://wa.me/237656708007";
const newsletterEndpoint =
  window.LAROCHE_CONFIG?.newsletterEndpoint || "/api/newsletter/subscribe";

const socialDefaults = {
  facebook: "",
  instagram: "",
  linkedin: "",
  tiktok: "",
  youtube: "https://www.youtube.com/channel/UCV-Jtu_zpf4S87n9GyTrcDw",
  x: "",
};
let socialSettings = { ...socialDefaults };
const socialIcons = {
  facebook:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true"><circle cx="256" cy="256" r="256" fill="#1877F2"/><path d="M355.6 151.6h-34.6c-27.8 0-33.1 13.2-33.1 32.6V227h64.8l-8.5 65.4h-56.3V460h-67.8V292.4h-56.5V227h56.5v-48.2c0-56 34.2-86.5 84.2-86.5 24 0 44.5 1.8 50.5 2.6v56.7Z" fill="#fff"/></svg>',
  instagram:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true"><rect x="32" y="32" width="448" height="448" rx="112" fill="none" stroke="#111" stroke-width="38"/><circle cx="256" cy="256" r="104" fill="none" stroke="#111" stroke-width="38"/><circle cx="390" cy="122" r="30" fill="#111"/></svg>',
  tiktok:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true"><path d="M448 209.91a210.06 210.06 0 0 1-122.77-39.25v178.72A162.55 162.55 0 1 1 185 188.31v89.89a72.69 72.69 0 1 0 40.3 65.4V0h88a109.37 109.37 0 0 0 109.31 109.32v100.59Z" fill="#111"/></svg>',
  youtube:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" aria-hidden="true"><path d="M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305ZM232.145 337.591V174.409L382.4 255.795l-150.255 81.796Z" fill="#ff0000"/></svg>',
  linkedin:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true"><path d="M416 32H31.9C14.3 32 0 46.5 0 64.3v383.4C0 465.5 14.3 480 31.9 480H416c17.6 0 32-14.5 32-32.3V64.3C448 46.5 433.6 32 416 32ZM135.4 416H69V202.2h66.5V416ZM102.2 173a38.5 38.5 0 1 1 0-77 38.5 38.5 0 0 1 0 77ZM384.3 416h-66.4V312c0-24.8-.5-56.7-34.5-56.7-34.6 0-39.9 27-39.9 54.9V416h-66.4V202.2h63.7v29.2h.9c8.9-16.8 30.6-34.5 62.9-34.5 67.2 0 79.7 44.3 79.7 101.9V416Z" fill="#0A66C2"/></svg>',
  x: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true"><path d="M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8L200.7 275.5 26.8 48H172.4L272.9 180.9 389.2 48ZM364.4 421.8h39.1L151.1 88h-42l255.3 333.8Z" fill="#111"/></svg>',
};
const socialLabels = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
};
const safeSocialUrl = (network, value) => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const domains = {
      facebook: ["facebook.com", "fb.com"],
      instagram: ["instagram.com"],
      linkedin: ["linkedin.com"],
      tiktok: ["tiktok.com"],
      youtube: ["youtube.com", "youtu.be"],
      x: ["x.com", "twitter.com"],
    };
    return url.protocol === "https:" &&
      domains[network]?.some(
        (domain) => host === domain || host.endsWith(`.${domain}`),
      )
      ? url.toString()
      : "";
  } catch {
    return "";
  }
};
const socialMarkup = (network, text = false) => {
  const href = safeSocialUrl(network, socialSettings[network]);
  if (!href) return "";
  return `<a href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${socialLabels[network]}" title="${socialLabels[network]}">${socialIcons[network]}${text ? socialLabels[network] : ""}${text ? "" : '<span class="sr-only">' + socialLabels[network] + "</span>"}</a>`;
};
const socialLinks = () =>
  Object.keys(socialDefaults)
    .map((network) => socialMarkup(network))
    .join("");
const socialTextLinks = () =>
  Object.keys(socialDefaults)
    .map((network) => socialMarkup(network, true))
    .join(" ");

// Brand logo link brings user directly to home without hash anchor issues
document.querySelectorAll(".brand").forEach((brand) => {
  brand.href = `${siteBase}index.html`;
  brand.addEventListener("click", (e) => {
    const isHomePage = !window.location.pathname.includes("/page/");
    if (isHomePage) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      history.replaceState(null, "", `${siteBase}index.html`);
    }
  });
});

// Mobile menu toggle & ensure "Commencer un projet" is in mobile navigation
if (siteNavigation) {
  if (!siteNavigation.querySelector(".mobile-menu-cta")) {
    const cta = document.createElement("a");
    cta.className = "mobile-menu-cta";
    cta.href = `${pageBase}project.html`;
    cta.innerHTML = "Commencer un projet ↗";
    siteNavigation.appendChild(cta);
  }
}

if (siteMenuButton && siteNavigation) {
  siteMenuButton.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = siteNavigation.classList.toggle("open");
    siteMenuButton.classList.toggle("is-active", open);
    siteMenuButton.setAttribute("aria-expanded", String(open));
    siteMenuButton.setAttribute(
      "aria-label",
      open ? "Fermer le menu" : "Ouvrir le menu",
    );
  });

  siteNavigation.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      siteNavigation.classList.remove("open");
      siteMenuButton.classList.remove("is-active");
      siteMenuButton.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("click", (e) => {
    if (
      siteNavigation.classList.contains("open") &&
      !siteNavigation.contains(e.target) &&
      !siteMenuButton.contains(e.target)
    ) {
      siteNavigation.classList.remove("open");
      siteMenuButton.classList.remove("is-active");
      siteMenuButton.setAttribute("aria-expanded", "false");
    }
  });
}

// Harmonize buttons and links
document.querySelectorAll('a[href*="#contact"]').forEach((link) => {
  if (
    link.closest("nav") ||
    link.closest(".footer-column") ||
    link.classList.contains("button") ||
    link.classList.contains("text-link")
  ) {
    link.setAttribute("href", `${pageBase}contact.html`);
  }
});
document.querySelectorAll('a[href*="#book"]').forEach((link) => {
  link.setAttribute("href", `${pageBase}project.html`);
});
document.querySelectorAll(".footer-bottom a").forEach((link) => {
  if (link.textContent.includes("Politique"))
    link.href = `${pageBase}politique-confidentialite.html`;
  if (link.textContent.includes("Conditions"))
    link.href = `${pageBase}conditions-generales.html`;
  if (link.textContent.includes("Cookies"))
    link.href = `${pageBase}cookies.html`;
});

// Ensure Cookies link is present in all footer legal spans
document.querySelectorAll(".footer-bottom").forEach((bottom) => {
  const legalSpan = bottom.querySelector(":scope > span:nth-child(2)");
  if (legalSpan && !legalSpan.querySelector('a[href*="cookies"]')) {
    const cookiesLink = document.createElement("a");
    cookiesLink.href = `${pageBase}cookies.html`;
    cookiesLink.textContent = "Cookies";
    legalSpan.appendChild(cookiesLink);
  }
});

// Render footer socials and newsletter
function renderSocialLinks() {
  document.querySelectorAll(".footer-socials > div").forEach((container) => {
    container.innerHTML = socialLinks();
  });
  document.querySelectorAll(".realizations-socials").forEach((container) => {
    container.innerHTML = socialLinks();
  });
  document.querySelectorAll(".footer-bottom").forEach((bottom) => {
    const socialColumn = bottom.querySelector(":scope > span:last-child");
    if (socialColumn) socialColumn.innerHTML = socialTextLinks();
  });
  const contactGrid = document.querySelector("#contact-social-grid");
  if (contactGrid)
    contactGrid.innerHTML = Object.keys(socialDefaults)
      .map((network) => socialMarkup(network, true))
      .join("");
}

document.querySelectorAll(".site-footer").forEach((footer) => {
  const contactColumn = footer.querySelector(".contact-column");
  if (contactColumn) {
    contactColumn.innerHTML = `<p class="footer-label">Nous contacter</p><p>${contactAddress}</p><a href="tel:${contactPhoneLink}">${contactPhone}</a><a href="mailto:${contactEmail}">${contactEmail}</a>`;
  }
  const whatsapp = footer.querySelector('a[href*="wa.me"]');
  if (whatsapp) {
    whatsapp.href = whatsappLink;
  }
  if (!footer.querySelector(".footer-socials")) {
    const socials = document.createElement("div");
    socials.className = "footer-socials";
    socials.innerHTML = `<p class="footer-label">Réseaux sociaux</p><div>${socialLinks()}</div>`;
    footer.querySelector(".footer-top")?.appendChild(socials);
  }
  addNewsletter(footer);
});

renderSocialLinks();

// Load social links from database
fetch("/api/public/social-links")
  .then((res) => {
    if (!res.ok) return [];
    return res.json();
  })
  .then((data) => {
    if (Array.isArray(data)) {
      data.forEach((item) => {
        if (
          item.network &&
          item.url &&
          socialSettings[item.network] !== undefined
        ) {
          socialSettings[item.network] =
            safeSocialUrl(item.network, item.url) ||
            socialSettings[item.network];
        }
      });
    } else if (data && typeof data === "object") {
      const settings = data.settings || data;
      Object.keys(socialDefaults).forEach((network) => {
        if (typeof settings[network] === "string" && settings[network].trim()) {
          socialSettings[network] =
            safeSocialUrl(network, settings[network]) ||
            socialSettings[network];
        }
      });
    }
    renderSocialLinks();
  })
  .catch((err) => console.warn("Social links fetch error:", err));

function applyPublicContact(settings) {
  if (!settings || typeof settings !== "object") return;
  if (
    typeof settings.email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)
  )
    contactEmail = settings.email;
  if (typeof settings.phone === "string" && settings.phone.length <= 40)
    contactPhone = settings.phone;
  if (typeof settings.address === "string" && settings.address.length <= 240)
    contactAddress = settings.address;
  if (typeof settings.whatsapp === "string") {
    try {
      const value = new URL(settings.whatsapp);
      if (
        value.protocol === "https:" &&
        value.hostname === "wa.me" &&
        /^\/\d{8,16}\/?$/.test(value.pathname)
      )
        whatsappLink = value.toString();
    } catch {}
  }
  document
    .querySelectorAll(".site-footer .contact-column")
    .forEach((column) => {
      column.replaceChildren();
      const label = document.createElement("p");
      label.className = "footer-label";
      label.textContent = "Nous contacter";
      const address = document.createElement("p");
      address.textContent = contactAddress;
      const phone = document.createElement("a");
      phone.href = `tel:${contactPhone.replace(/[^+\d]/g, "")}`;
      phone.textContent = contactPhone;
      const email = document.createElement("a");
      email.href = `mailto:${contactEmail}`;
      email.textContent = contactEmail;
      column.append(label, address, phone, email);
    });
  document.querySelectorAll('.site-footer a[href*="wa.me"]').forEach((link) => {
    link.href = whatsappLink;
  });
}
fetch("/api/public/site-settings")
  .then((r) => (r.ok ? r.json() : {}))
  .then(applyPublicContact)
  .catch(() => {});

function getVisitorId() {
  try {
    const existing = localStorage.getItem("laroche_visitor_id");
    if (
      existing &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        existing,
      )
    )
      return existing;
    const id = crypto.randomUUID();
    localStorage.setItem("laroche_visitor_id", id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
const anonymousVisitorId = getVisitorId();
window.larocheTrack = (eventType, planId = null) => {
  const payload = {
    visitor_id: anonymousVisitorId,
    event_type: eventType,
    page_path: location.pathname.slice(0, 180) || "/",
    plan_id: planId,
  };
  return fetch("/api/public/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
};
window.larocheTrack("page_view");

function addNewsletter(footer) {
  const footerTop = footer.querySelector(".footer-top");
  if (!footerTop || footerTop.querySelector(".footer-newsletter")) return;
  const newsletter = document.createElement("div");
  newsletter.className = "footer-newsletter";
  newsletter.innerHTML = `
    <p class="footer-label">Newsletter</p>
    <p>Recevez nos nouvelles, événements et projets directement par email.</p>
    <form class="newsletter-form" novalidate>
      <label class="sr-only" for="newsletter-email">Votre adresse email</label>
      <div><input id="newsletter-email" name="email" type="email" autocomplete="email" placeholder="Votre email" required><button type="submit" aria-label="S'inscrire à la newsletter">↗</button></div>
      <label class="newsletter-consent"><input name="consent" type="checkbox" required><span>Je souhaite recevoir la newsletter. Inscription facultative. <a href="/page/politique-confidentialite.html">Confidentialité</a>.</span></label>
      <small class="newsletter-status" role="status" aria-live="polite"></small>
    </form>
  `;
  footerTop.appendChild(newsletter);
  const form = newsletter.querySelector("form");
  const status = newsletter.querySelector(".newsletter-status");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const button = form.querySelector("button");
    button.disabled = true;
    status.className = "newsletter-status";
    status.textContent = "Inscription…";
    button.classList.add("is-loading");
    button.setAttribute("aria-busy", "true");
    try {
      const response = await fetch(newsletterEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: new FormData(form).get("email"),
          source: "website",
          consent: true,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          result.message || `Erreur serveur (${response.status})`,
        );
      status.classList.add("is-success");
      status.textContent = "Merci, votre inscription est confirmée.";
      form.reset();
    } catch (error) {
      status.classList.add("is-error");
      status.textContent =
        error instanceof Error
          ? error.message
          : "Inscription impossible pour le moment. Réessayez plus tard.";
      console.error("Inscription newsletter impossible.");
    } finally {
      button.disabled = false;
      button.classList.remove("is-loading");
      button.removeAttribute("aria-busy");
    }
  });
}

// ============================================================
//  TRANSITIONS DE PAGE (fade rapide entre les pages)
// ============================================================
(function initPageTransitions() {
  // Créer l'overlay de transition
  const overlay = document.createElement("div");
  overlay.id = "page-transition-overlay";
  document.body.prepend(overlay);

  // Intercepter les clics sur les liens internes
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a[href]");
    if (!link) return;

    const href = link.getAttribute("href");
    if (!href) return;

    // Ignorer : ancres, liens externes, téléchargements, target=_blank, javascript:
    const isExternal = link.hostname && link.hostname !== location.hostname;
    const isAnchor = href.startsWith("#");
    const isJavascript = href.startsWith("javascript");
    const isDownload = link.hasAttribute("download");
    const isBlank = link.target === "_blank";
    const isMailOrTel =
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("wa.me") ||
      href.includes("wa.me");

    if (
      isExternal ||
      isAnchor ||
      isJavascript ||
      isDownload ||
      isBlank ||
      isMailOrTel
    )
      return;

    e.preventDefault();
    const destination = link.href;

    // Déclencher le fade-out
    overlay.classList.add("is-leaving");

    // Naviguer après le fade-out (120ms)
    setTimeout(() => {
      window.location.href = destination;
    }, 130);
  });

  // Vérifier si View Transitions API est disponible (Chrome 111+)
  if (document.startViewTransition) {
    document.addEventListener("click", (e) => {
      const link = e.target.closest("a[href]");
      if (link && !link.target && !link.hasAttribute("download")) {
        // La navigation se fait via le listener ci-dessus
        // View Transitions améliore l'animation quand disponible
      }
    });
  }
})();

// ============================================================
//  ANIMATIONS DE CHARGEMENT (utilitaire global)
// ============================================================

/**
 * Active le spinner sur un bouton et le désactive après la promesse.
 * Usage: withLoading(button, () => fetch(...))
 */
window.withLoading = async function withLoading(button, asyncFn) {
  if (!button) return asyncFn();
  button.classList.add("is-loading");
  button.disabled = true;
  try {
    return await asyncFn();
  } finally {
    button.classList.remove("is-loading");
    button.disabled = false;
  }
};

// Câbler automatiquement les boutons CTA "Commencer un projet"
document
  .querySelectorAll('a.button[href*="project"], a.button[href*="project.html"]')
  .forEach((link) => {
    link.addEventListener("click", () => {
      link.classList.add("is-loading");
      // La transition de page enlèvera la classe au rechargement
      setTimeout(() => link.classList.remove("is-loading"), 1500);
    });
  });

// Scroll reveal : observer les éléments .reveal
(function initScrollReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;
  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 },
  );
  items.forEach((el) => observer.observe(el));
})();
