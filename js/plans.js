(() => {
  const form = document.querySelector('#plans-filter-form');
  const grid = document.querySelector('#plans-grid');
  const status = document.querySelector('#plans-filter-status');
  const typeSelect = document.querySelector('#plan-type');
  const priceSelect = document.querySelector('#plan-price-range');
  const specificFields = document.querySelector('#plan-specific-fields');
  const order = document.querySelector('#plan-order');
  const orderForm = document.querySelector('#plan-order-form');
  const orderStatus = document.querySelector('.plans-order-status');
  const empty = document.querySelector('#plans-empty');
  const pagination = document.querySelector('#plans-pagination');
  const preview = document.querySelector('#plan-preview');
  const previewFrame = document.querySelector('#plan-preview-frame');
  const previewTitle = document.querySelector('#plan-preview-title');
  const paymentLabel = document.querySelector('#plan-payment-label');
  if (!form || !grid || !status) return;
  let plans = [];
  let filteredPlans = [];
  let currentPage = 1;
  const pageSize = 25;
  const formatPrice = (price) => Number(price || 0).toLocaleString('fr-FR');
  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

  function priceMatches(price, range) {
    const amount = Number(price || 0);
    return !range || (range === 'free' && amount === 0) || (range === '0-5000' && amount > 0 && amount <= 5000) || (range === '5000-plus' && amount > 5000);
  }
  function renderPlans() {
    const start = (currentPage - 1) * pageSize;
    const visible = filteredPlans.slice(start, start + pageSize);
    grid.innerHTML = visible.map((plan) => `<article data-plan-id="${escapeHtml(plan.id)}" data-plan-name="${escapeHtml(plan.name)}">
      <button class="plan-image-button" type="button" data-preview="${escapeHtml(plan.pdfUrl || '')}" data-title="${escapeHtml(plan.name)}"><img class="plan-image" src="${escapeHtml(plan.coverUrl || '../Screenshot_20260904_142806_Drive.jpg')}" alt="Aperçu de ${escapeHtml(plan.name)}"></button>
      <p class="eyebrow">${escapeHtml(plan.category || plan.type || 'PLAN')}</p><h2>${escapeHtml(plan.name)}</h2><p>${escapeHtml(plan.description || '')}</p>
      <button class="text-link dark plan-buy" type="button" data-price="${Number(plan.price || 0)}" data-pdf="${escapeHtml(plan.pdfUrl || '')}">Demander ce plan <span>↗</span></button></article>`).join('');
    empty.classList.toggle('is-hidden', filteredPlans.length > 0);
    pagination.innerHTML = filteredPlans.length <= pageSize ? '' : Array.from({ length: Math.ceil(filteredPlans.length / pageSize) }, (_, index) => `<button type="button" class="${index + 1 === currentPage ? 'is-active' : ''}" data-page="${index + 1}">${index + 1}</button>`).join('');
    grid.querySelectorAll('.plan-image-button').forEach((button) => button.addEventListener('click', () => {
      if (!button.dataset.preview) return;
      previewTitle.textContent = button.dataset.title;
      previewFrame.src = `${button.dataset.preview}#toolbar=0&navpanes=0&scrollbar=0`;
      preview.classList.remove('is-hidden');
      document.body.classList.add('plan-preview-open');
    }));
    grid.querySelectorAll('.plan-buy').forEach((button) => button.addEventListener('click', () => {
      const card = button.closest('[data-plan-id]');
      orderForm.elements.planId.value = card.dataset.planId;
      orderForm.elements.planName.value = card.dataset.planName;
      orderForm.elements.pdfUrl.value = button.dataset.pdf;
      paymentLabel.textContent = `${formatPrice(button.dataset.price)} FCFA`;
      order.classList.remove('is-hidden');
      orderForm.elements.name.focus();
    }));
  }
  async function loadPlans() {
    try {
      const response = await fetch('/api/public/plans');
      if (!response.ok) throw new Error(`Impossible de charger les plans (${response.status}).`);
      plans = (await response.json()).filter((plan) => plan.status !== 'hidden').sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } catch (error) {
      plans = [];
      status.textContent = 'Aucun plan disponible.';
      console.error('Chargement des plans impossible :', error);
    }
    applyFilters();
  }
  function applyFilters() {
    filteredPlans = plans.filter((plan) => (!typeSelect.value || plan.type === typeSelect.value) && priceMatches(plan.price, priceSelect.value));
    currentPage = 1;
    renderPlans();
  }

  const fieldTemplates = {
    residential: [
      ['surface', 'Surface souhaitée', [['under-100', 'Moins de 100 m²'], ['100-200', '100 à 200 m²'], ['200-300', '200 à 300 m²'], ['over-300', '300 m² ou plus']]],
      ['bedrooms', 'Nombre de chambres', [['1-2', '1 à 2 chambres'], ['3', '3 chambres'], ['4-plus', '4 chambres ou plus']]],
      ['bathrooms', 'Nombre de douches / toilettes', [['1-2', '1 à 2'], ['3', '3'], ['4-plus', '4 ou plus']]],
      ['main-room', 'Pièce principale', [['living', 'Séjour / salon'], ['living-dining', 'Séjour et salle à manger'], ['open-plan', 'Grande pièce ouverte']]],
      ['accessories', 'Accessoires souhaités', [['pool', 'Piscine'], ['boukarou', 'Boukarou'], ['green-space', 'Espace vert'], ['terrace', 'Terrasse']]]
    ],
    commercial: [
      ['surface', 'Surface souhaitée', [['under-100', 'Moins de 100 m²'], ['100-200', '100 à 200 m²'], ['200-300', '200 à 300 m²'], ['over-300', '300 m² ou plus']]],
      ['activity', 'Type d’activité', [['office', 'Bureaux'], ['retail', 'Commerce / boutique'], ['hospitality', 'Restaurant / hôtellerie']]],
      ['levels', 'Nombre de niveaux', [['one', 'Un niveau'], ['two', 'Deux niveaux'], ['multi', 'Trois niveaux ou plus']]],
      ['parking', 'Stationnement', [['none', 'Sans parking dédié'], ['standard', 'Parking standard'], ['large', 'Parking important']]]
    ],
    industrial: [
      ['surface', 'Surface souhaitée', [['under-100', 'Moins de 100 m²'], ['100-200', '100 à 200 m²'], ['200-300', '200 à 300 m²'], ['over-300', '300 m² ou plus']]],
      ['building', 'Type de bâtiment', [['warehouse', 'Entrepôt / stockage'], ['workshop', 'Atelier / production'], ['technical', 'Bâtiment technique']]],
      ['organization', 'Organisation du bâtiment', [['single', 'Plain-pied'], ['mixed', 'Niveaux ou mezzanine']]],
      ['constraint', 'Contrainte principale', [['structure', 'Structure et portée'], ['logistics', 'Flux et logistique'], ['security', 'Sécurité et normes']]]
    ],
    civil: [
      ['surface', 'Surface souhaitée', [['under-100', 'Moins de 100 m²'], ['100-200', '100 à 200 m²'], ['200-300', '200 à 300 m²'], ['over-300', '300 m² ou plus']]],
      ['work', 'Type d’ouvrage', [['foundation', 'Fondations / terrassement'], ['road', 'Route / voirie'], ['network', 'Réseaux / assainissement']]],
      ['terrain', 'Nature du terrain', [['accessible', 'Terrain accessible'], ['difficult', 'Terrain difficile']]],
      ['scale', 'Échelle du projet', [['local', 'Projet local'], ['large', 'Projet d’envergure']]]
    ]
  };

  function renderSpecificFields(type) {
    const fields = fieldTemplates[type] || [];
    specificFields.innerHTML = fields.map(([name, label, options]) => `<label><span>${label}</span><select name="${name}" required><option value="">Choisissez</option>${options.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select></label>`).join('');
  }

  typeSelect.addEventListener('change', () => {
    renderSpecificFields(typeSelect.value);
    status.textContent = '';
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const values = Object.fromEntries(new FormData(form).entries());
    applyFilters();
    status.textContent = filteredPlans.length === 0 ? 'Aucun plan ne correspond encore à ces critères.' : `${filteredPlans.length} plan${filteredPlans.length > 1 ? 's' : ''} disponible${filteredPlans.length > 1 ? 's' : ''}.`;
  });
  priceSelect.addEventListener('change', applyFilters);
  pagination.addEventListener('click', (event) => { if (event.target.dataset.page) { currentPage = Number(event.target.dataset.page); renderPlans(); } });
  document.querySelector('#plan-order-close').addEventListener('click', () => order.classList.add('is-hidden'));
  order.addEventListener('click', (event) => { if (event.target === order) order.classList.add('is-hidden'); });
  document.querySelector('#plan-preview-close').addEventListener('click', closePreview);
  preview.querySelector('.plan-preview-backdrop').addEventListener('click', closePreview);
  function closePreview() { preview.classList.add('is-hidden'); previewFrame.src = 'about:blank'; document.body.classList.remove('plan-preview-open'); }
  orderForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!orderForm.checkValidity()) { orderForm.reportValidity(); return; }
    const button = orderForm.querySelector('button[type="submit"]');
    button.disabled = true;
    orderStatus.textContent = 'Préparation de votre commande…';
    try {
      const response = await fetch('/api/plan-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(orderForm))) });
      if (!response.ok) throw new Error(`Impossible de préparer la commande (${response.status}).`);
      const result = await response.json();
      if (result.paymentUrl) window.location.href = result.paymentUrl;
      else {
        await fetch('/api/newsletter/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: orderForm.elements.email.value, source: 'plan-order' }) }).catch(() => {});
        orderStatus.textContent = 'Demande enregistrée. Vous recevrez la confirmation de paiement par email.';
        orderForm.reset();
      }
    } catch (error) {
      orderStatus.textContent = error.message;
    } finally { button.disabled = false; }
  });
  loadPlans();
})();
