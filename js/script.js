const dashboardConfig = { stats: [{ value: 0, suffix: '+', label: 'Projets réalisés' }, { value: 0, suffix: '+', label: "Années d'expérience" }, { value: 0, suffix: '+', label: 'Collaborateurs' }, { value: 0, suffix: '+', label: 'Villes couvertes' }, { value: 0, suffix: '+', label: 'Clients accompagnés' }] };
const header = document.querySelector('#site-header');
const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');
const statsContainer = document.querySelector('#stats-grid');
document.querySelectorAll('.nav-book, .header-cta, .hero-actions .button-gold, .footer-column a[href="#book"]').forEach(link => { link.childNodes[0].textContent = 'Commencer un projet '; });
const residentialImage = document.querySelector('.service-card img[alt="Projet de construction résidentielle"]');
if (residentialImage) residentialImage.src = 'image/472802580_584514390999531_1094879200921065619_n.jpg';
document.querySelectorAll('.eyebrow').forEach(label => { label.textContent = label.textContent.replace(/^\d+\s*[—-]\s*/, ''); });

function renderStats(stats) {
  statsContainer.innerHTML = stats.map(stat => `<div class="stat"><span class="stat-number" data-target="${Number(stat.value) || 0}">0<small>${stat.suffix || '+'}</small></span><span class="stat-label">${stat.label}</span></div>`).join('');
}
renderStats(dashboardConfig.stats);
fetch('/api/public/stats').then(response => {
  if (!response.ok) throw new Error(`Erreur serveur (${response.status})`);
  return response.json();
}).then(data => {
  if (Array.isArray(data.stats) && data.stats.length) renderStats(data.stats);
}).catch(() => {});

window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 24), { passive: true });
menuToggle.addEventListener('click', () => { const open = mainNav.classList.toggle('open'); menuToggle.setAttribute('aria-expanded', String(open)); menuToggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu'); });
mainNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { mainNav.classList.remove('open'); menuToggle.setAttribute('aria-expanded', 'false'); }));

const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); revealObserver.unobserve(entry.target); } }), { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach(element => revealObserver.observe(element));

const statsObserver = new IntersectionObserver(entries => entries.forEach(entry => { if (!entry.isIntersecting) return; entry.target.querySelectorAll('.stat-number').forEach(number => { const target = Number(number.dataset.target); const start = performance.now(); const tick = now => { const progress = Math.min((now - start) / 900, 1); number.firstChild.textContent = Math.floor(progress * target); if (progress < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }); statsObserver.unobserve(entry.target); }), { threshold: 0.45 });
statsObserver.observe(document.querySelector('.stats'));
