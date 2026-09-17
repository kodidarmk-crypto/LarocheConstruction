const siteMenuButton = document.querySelector('.menu-toggle');
const siteNavigation = document.querySelector('.main-nav');
const siteBase = window.location.pathname.includes('/pages/') ? '../' : '';
const pageBase = window.location.pathname.includes('/pages/') ? '' : 'pages/';
const contactEmail = 'larocheconstruction19@gmail.com';
const contactPhone = '+237 656 70 80 07';
const contactPhoneLink = '+237656708007';
const contactAddress = 'Makepe, Douala, Cameroun';
const whatsappLink = 'https://wa.me/237656708007';
const newsletterEndpoint = window.LAROCHE_CONFIG?.newsletterEndpoint || '/api/newsletter/subscribe';
const socialLinksLegacy = `
  <a href="https://www.facebook.com/" aria-label="Facebook" title="Facebook"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3c-3.3 0-5 1.9-5 5v3H6v4h3v4h4v-4h3l1-4h-4V9c0-.7.3-1 1-1Z"/></svg></a>
  <a href="https://www.tiktok.com/" aria-label="TikTok" title="TikTok"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h3c.2 1.7 1.2 2.8 3 3v3c-1.2 0-2.2-.3-3-1v6.2A5.8 5.8 0 1 1 13 9.7v3.1a2.8 2.8 0 1 0 2 2.7V4Z"/></svg></a>
  <a href="https://www.instagram.com/" aria-label="Instagram" title="Instagram"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="12" cy="12" r="3.5"/><circle cx="17.3" cy="6.8" r="1"/></svg></a>
  <a href="https://www.linkedin.com/" aria-label="LinkedIn" title="LinkedIn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8H2V21H5V8ZM3.5 3A1.8 1.8 0 1 0 3.5 6.6 1.8 1.8 0 0 0 3.5 3ZM8 8h3v1.8c.8-1.3 2-2.2 4-2.2 3.8 0 4.5 2.5 4.5 5.8V21h-3v-5c0-1.2 0-3.3-2-3.3s-2.3 1.6-2.3 3.2V21H8V8Z"/></svg></a>
  <a href="https://www.youtube.com/" aria-label="YouTube" title="YouTube"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.6 7.2a2.8 2.8 0 0 0-2-2C17.8 4.7 12 4.7 12 4.7s-5.8 0-7.6.5a2.8 2.8 0 0 0-2 2A29 29 0 0 0 2 12a29 29 0 0 0 .4 4.8 2.8 2.8 0 0 0 2 2c1.8.5 7.6.5 7.6.5s5.8 0 7.6-.5a2.8 2.8 0 0 0 2-2A29 29 0 0 0 22 12a29 29 0 0 0-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z"/></svg></a>
  <a href="https://x.com/" aria-label="X" title="X"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h3.7l3.2 4.7L15.7 4H19l-5.5 6.5L19.5 20h-3.7l-3.7-5.3L7.4 20H4l5.8-6.9L5 4Zm2.4 1.8 8.9 12.4h.9L8.3 5.8h-.9Z"/></svg></a>`;

const socialDefaults = { facebook: 'https://www.facebook.com/', instagram: 'https://www.instagram.com/', linkedin: 'https://www.linkedin.com/', tiktok: 'https://www.tiktok.com/', youtube: 'https://www.youtube.com/', x: 'https://x.com/' };
let socialSettings = { ...socialDefaults };
const socialLabels = { facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', tiktok: 'TikTok', youtube: 'YouTube', x: 'X' };
const socialIcons = {
  facebook: '<path d="M14 8h3V4h-3c-3.3 0-5 1.9-5 5v3H6v4h3v4h4v-4h3l1-4h-4V9c0-.7.3-1 1-1Z"/>',
  instagram: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="12" cy="12" r="3.5"/><circle cx="17.3" cy="6.8" r="1"/>',
  linkedin: '<path d="M5 8H2V21H5V8ZM3.5 3A1.8 1.8 0 1 0 3.5 6.6 1.8 1.8 0 0 0 3.5 3ZM8 8h3v1.8c.8-1.3 2-2.2 4-2.2 3.8 0 4.5 2.5 4.5 5.8V21h-3v-5c0-1.2 0-3.3-2-3.3s-2.3 1.6-2.3 3.2V21H8V8Z"/>',
  tiktok: '<path d="M15 4h3c.2 1.7 1.2 2.8 3 3v3c-1.2 0-2.2-.3-3-1v6.2A5.8 5.8 0 1 1 13 9.7v3.1a2.8 2.8 0 1 0 2 2V4Z"/>',
  youtube: '<path d="M21.6 7.2a2.8 2.8 0 0 0-2-2C17.8 4.7 12 4.7 12 4.7s-5.8 0-7.6.5a2.8 2.8 0 0 0-2 2A29 29 0 0 0 2 12a29 29 0 0 0 .4 4.8 2.8 2.8 0 0 0 2 2c1.8.5 7.6.5 7.6.5s5.8 0 7.6-.5a2.8 2.8 0 0 0 2-2A29 29 0 0 0 22 12a29 29 0 0 0-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z"/>',
  x: '<path d="M5 4h3.7l3.2 4.7L15.7 4H19l-5.5 6.5L19.5 20h-3.7l-3.7-5.3L7.4 20H4l5.8-6.9L5 4Zm2.4 1.8 8.9 12.4h.9L8.3 5.8h-.9Z"/>'
};
const socialLinks = () => Object.keys(socialDefaults).map((network) => `<a href="${socialSettings[network]}" target="_blank" rel="noopener noreferrer" aria-label="${socialLabels[network]}" title="${socialLabels[network]}"><svg viewBox="0 0 24 24" aria-hidden="true">${socialIcons[network]}</svg></a>`).join('');
const socialTextLinks = () => Object.keys(socialDefaults).map((network) => `<a href="${socialSettings[network]}" target="_blank" rel="noopener noreferrer">${socialLabels[network]}</a>`).join(' ');

document.querySelectorAll('.service-detail-card').forEach((card) => {
  if (card.querySelector('.service-start')) return;
  const action = document.createElement('a');
  action.className = 'button button-gold service-start';
  action.href = 'project.html';
  action.innerHTML = 'Réaliser ce service <span>↗</span>';
  const serviceLink = card.querySelector('.service-detail-copy .text-link');
  serviceLink?.parentElement?.insertBefore(action, serviceLink);
});
document.querySelectorAll('.service-single-hero > div').forEach((hero) => {
  if (hero.querySelector('.service-start')) return;
  const action = document.createElement('a');
  action.className = 'button button-gold service-start';
  action.href = 'project.html';
  action.innerHTML = 'Réaliser ce service <span>↗</span>';
  hero.appendChild(action);
});

if (siteMenuButton && siteNavigation) {
  siteMenuButton.addEventListener('click', () => {
    const open = siteNavigation.classList.toggle('open');
    siteMenuButton.setAttribute('aria-expanded', String(open));
    siteMenuButton.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  });

  siteNavigation.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => siteNavigation.classList.remove('open'));
  });
}

document.querySelectorAll('a[href="index.html#contact"], a[href="#contact"]').forEach((link) => {
  link.setAttribute('href', `${pageBase}contact.html`);
});
document.querySelectorAll('a[href="index.html#book"], a[href="#book"]').forEach((link) => {
  link.setAttribute('href', `${pageBase}project.html`);
});
document.querySelectorAll('.footer-bottom a').forEach((link) => {
  if (link.textContent.includes('Politique')) link.href = `${pageBase}politique-confidentialite.html`;
  if (link.textContent.includes('Conditions')) link.href = `${pageBase}conditions-generales.html`;
});

document.querySelectorAll('.site-footer').forEach((footer) => {
  const contactColumn = footer.querySelector('.contact-column');
  if (contactColumn) {
    contactColumn.innerHTML = `<p class="footer-label">Nous contacter</p><p>${contactAddress}</p><a href="tel:${contactPhoneLink}">${contactPhone}</a><a href="mailto:${contactEmail}">${contactEmail}</a>`;
  }
  const whatsapp = footer.querySelector('a[href*="wa.me"]');
  if (whatsapp) {
    whatsapp.href = whatsappLink;
  }
  if (!footer.querySelector('.footer-socials')) {
    const socials = document.createElement('div');
    socials.className = 'footer-socials';
    socials.innerHTML = `<p class="footer-label">Réseaux sociaux</p><div>${socialLinks()}</div>`;
    footer.querySelector('.footer-top')?.appendChild(socials);
  }
  addNewsletter(footer);
});

if (!document.querySelector('.site-footer')) {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <div class="footer-top">
      <div class="footer-brand"><img src="${siteBase}Screenshot_20260904_142806_Drive.jpg" alt="Logo Laroche Construction"><p>Construire aujourd'hui.<br>Façonner demain.</p></div>
      <div class="footer-column"><p class="footer-label">Explorer</p><a href="${siteBase}index.html#home">Accueil</a><a href="${pageBase}services.html">Services</a><a href="${pageBase}process.html">Méthode</a><a href="${pageBase}realisations.html">Réalisations</a></div>
      <div class="footer-column"><p class="footer-label">Commencer</p><a href="${pageBase}plans.html">Trouver un plan</a><a href="${pageBase}project.html">Commencer un projet</a><a href="${pageBase}contact.html">Contact</a><a href="${whatsappLink}">WhatsApp ↗</a></div>
      <div class="footer-column contact-column"><p class="footer-label">Nous contacter</p><p>${contactAddress}</p><a href="tel:${contactPhoneLink}">${contactPhone}</a><a href="mailto:${contactEmail}">${contactEmail}</a></div>
      <div class="footer-socials"><p class="footer-label">Réseaux sociaux</p><div>${socialLinks()}</div></div>
    </div>
    <div class="footer-bottom"><span>© Laroche Construction. Tous droits réservés.</span><span><a href="${pageBase}politique-confidentialite.html">Politique de confidentialité</a><a href="${pageBase}conditions-generales.html">Conditions générales</a></span><span>Instagram &nbsp; LinkedIn &nbsp; YouTube &nbsp; X</span></div>
  `;
  document.body.appendChild(footer);
  addNewsletter(footer);
}

function renderSocialLinks() {
  document.querySelectorAll('.footer-socials > div').forEach((container) => {
    container.innerHTML = socialLinks();
  });
  document.querySelectorAll('.realizations-socials').forEach((container) => {
    container.innerHTML = socialLinks();
  });
  document.querySelectorAll('.footer-bottom').forEach((bottom) => {
    const socialColumn = bottom.querySelector(':scope > span:last-child');
    if (socialColumn) socialColumn.innerHTML = socialTextLinks();
  });
}

renderSocialLinks();

fetch('/api/public/settings')
  .then((response) => {
    if (!response.ok) throw new Error(`Erreur serveur (${response.status})`);
    return response.json();
  })
  .then((data) => {
    const settings = data.settings || data;
    Object.keys(socialDefaults).forEach((network) => {
      if (typeof settings[network] === 'string' && settings[network].trim()) socialSettings[network] = settings[network].trim();
    });
    renderSocialLinks();
  })
  .catch((error) => console.warn('Paramètres des réseaux sociaux indisponibles :', error));

function addNewsletter(footer) {
  const footerTop = footer.querySelector('.footer-top');
  if (!footerTop || footerTop.querySelector('.footer-newsletter')) return;
  const newsletter = document.createElement('div');
  newsletter.className = 'footer-newsletter';
  newsletter.innerHTML = `
    <p class="footer-label">Newsletter</p>
    <p>Recevez nos nouvelles, événements et projets directement par email.</p>
    <form class="newsletter-form" novalidate>
      <label class="sr-only" for="newsletter-email">Votre adresse email</label>
      <div><input id="newsletter-email" name="email" type="email" autocomplete="email" placeholder="Votre email" required><button type="submit" aria-label="S'inscrire à la newsletter">↗</button></div>
      <small class="newsletter-status" role="status" aria-live="polite"></small>
    </form>
  `;
  footerTop.appendChild(newsletter);
  const form = newsletter.querySelector('form');
  const status = newsletter.querySelector('.newsletter-status');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const button = form.querySelector('button');
    button.disabled = true;
    status.className = 'newsletter-status';
    status.textContent = 'Inscription…';
    try {
      const response = await fetch(newsletterEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: new FormData(form).get('email'), source: window.location.pathname })
      });
      if (!response.ok) throw new Error(`Erreur serveur (${response.status})`);
      status.classList.add('is-success');
      status.textContent = 'Merci, votre inscription est confirmée.';
      form.reset();
    } catch (error) {
      status.classList.add('is-error');
      status.textContent = 'Inscription impossible pour le moment. Réessayez plus tard.';
      console.error('Inscription newsletter impossible :', error);
    } finally {
      button.disabled = false;
    }
  });
}
