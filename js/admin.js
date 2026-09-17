(() => {
  const api = window.LAROCHE_ADMIN_API || '/api/admin';
  const login = document.querySelector('#admin-login');
  const content = document.querySelector('#admin-content');
  const loginForm = document.querySelector('#admin-login-form');
  const loginStatus = document.querySelector('#admin-login-status');
  const logoutButton = document.querySelector('#admin-logout');
  const showAdmin = () => {
    login.classList.add('is-hidden');
    content.classList.remove('is-locked');
  };
  const checkSession = async () => {
    const response = await fetch(`${api}/session`, { credentials: 'include' });
    if (!response.ok) return false;
    showAdmin();
    return true;
  };
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!loginForm.checkValidity()) {
      loginForm.reportValidity();
      return;
    }
    const button = loginForm.querySelector('button[type="submit"]');
    button.disabled = true;
    loginStatus.textContent = 'Vérification…';
    try {
      const response = await fetch(`${api}/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(loginForm)))
      });
      if (!response.ok) throw new Error(response.status === 401 ? 'Mot de passe incorrect.' : 'Connexion impossible.');
      loginForm.reset();
      loginStatus.textContent = '';
      showAdmin();
    } catch (error) {
      loginStatus.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    try {
      await fetch(`${api}/logout`, { method: 'POST', credentials: 'include' });
    } finally {
      window.location.reload();
    }
  });
  checkSession().catch(() => {});
  const tabs = document.querySelectorAll('.admin-tab');
  const panels = document.querySelectorAll('.admin-panel');
  const request = async (path, options = {}) => {
    const endpoint = path.startsWith('/api/') ? path : `${api}${path}`;
    if (options.body instanceof FormData) {
      const data = {};
      for (const [key, value] of options.body.entries()) {
        if (typeof value === 'string') data[key] = value;
      }
      if (data.date && !data.published_on) data.published_on = data.date;
      delete data.date;
      options.body = JSON.stringify(data);
      options.headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    }
    if (options.method === 'POST' && (/\/(stats|settings|filter-settings)$/.test(path))) options.method = 'PUT';
    const response = await fetch(endpoint, { credentials: 'include', ...options });
    if (!response.ok) throw new Error(`Erreur serveur (${response.status})`);
    return response.status === 204 ? null : response.json();
  };
  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const status = (form, message, error = false) => { const node = form.querySelector('.admin-status'); if (node) { node.textContent = message; node.className = `admin-status${error ? ' is-error' : ' is-success'}`; } };

  tabs.forEach((tab) => tab.addEventListener('click', () => {
    tabs.forEach((item) => item.classList.toggle('is-active', item === tab));
    panels.forEach((panel) => panel.classList.toggle('is-active', panel.id === `panel-${tab.dataset.panel}`));
  }));
  document.querySelectorAll('.admin-add').forEach((button) => button.addEventListener('click', () => document.querySelector(`#${button.dataset.form}`).classList.remove('is-hidden')));
  document.querySelectorAll('.admin-cancel').forEach((button) => button.addEventListener('click', () => {
    const form = button.closest('form');
    delete form.dataset.editId;
    if (form.id === 'plan-form') form.querySelector('h3').textContent = 'Nouveau plan';
    form.classList.add('is-hidden');
  }));
  const videoDate = document.querySelector('#video-form input[name="date"]');
  if (videoDate) videoDate.value = new Date().toISOString().slice(0, 10);

  async function loadTable(endpoint, selector, render) {
    try {
      const items = await request(endpoint);
      document.querySelector(selector).innerHTML = (items || []).map(render).join('') || '<tr><td colspan="6">Aucun élément pour le moment.</td></tr>';
    } catch (error) { document.querySelector(selector).innerHTML = `<tr><td colspan="6">${escapeHtml(error.message)}</td></tr>`; }
  }
  loadTable('/plans', '#plans-table', (plan) => `<tr><td>${escapeHtml(plan.name)}</td><td>${escapeHtml(plan.type)}</td><td>${escapeHtml(plan.surface)}</td><td>${escapeHtml(plan.price)} FCFA</td><td>${escapeHtml(plan.status || 'Publié')}</td><td><button type="button" data-action="edit-plan" data-id="${escapeHtml(plan.id)}" data-name="${escapeHtml(plan.name)}" data-type="${escapeHtml(plan.type)}" data-surface="${escapeHtml(plan.surface)}" data-price="${escapeHtml(plan.price)}" data-description="${escapeHtml(plan.description)}">Modifier</button> <button type="button" data-action="delete-plan" data-id="${escapeHtml(plan.id)}">Supprimer</button></td></tr>`);
  loadTable('/news', '#news-table', (item) => `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.date)}</td><td>${escapeHtml(item.status)}</td><td><button type="button" data-action="toggle-news" data-id="${escapeHtml(item.id)}">Modifier</button></td></tr>`);
  loadTable('/videos', '#videos-table', (item) => `<tr><td>${escapeHtml(item.title || item.url)}</td><td>${escapeHtml(item.publishedAt || item.date || item.createdAt || '')}</td><td>${escapeHtml(item.views ?? item.viewCount ?? 0)}</td><td>${escapeHtml(item.status || 'Publié')}</td><td>Synchronisée depuis YouTube</td></tr>`);
  loadTable('/newsletter/subscribers', '#subscribers-table', (item) => `<tr><td>${escapeHtml(item.email)}</td><td>${escapeHtml(item.createdAt)}</td><td>${escapeHtml(item.status || 'Actif')}</td><td><button type="button" data-action="unsubscribe" data-id="${escapeHtml(item.id)}">Désinscrire</button></td></tr>`);

  document.querySelectorAll('.admin-form').forEach((form) => form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const endpoint = form.id === 'plan-form' && form.dataset.editId ? `/plans/${encodeURIComponent(form.dataset.editId)}` : (form.dataset.endpoint || (form.id === 'plan-form' ? '/plans' : form.id === 'news-form' ? '/news' : ''));
    if (!endpoint) return;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await request(endpoint, { method: form.id === 'plan-form' && form.dataset.editId ? 'PUT' : 'POST', body: new FormData(form) });
      status(form, 'Enregistrement effectué.');
      form.reset();
      if (form.id === 'plan-form' || form.id === 'news-form') { delete form.dataset.editId; form.classList.add('is-hidden'); }
    } catch (error) { status(form, error.message, true); } finally { button.disabled = false; }
  }));
  document.addEventListener('click', async (event) => {
    const editButton = event.target.closest('[data-action="edit-plan"]');
    if (editButton) {
      const form = document.querySelector('#plan-form');
      form.dataset.editId = editButton.dataset.id;
      form.classList.remove('is-hidden');
      form.querySelector('h3').textContent = 'Modifier le plan';
      ['name', 'type', 'surface', 'price', 'description'].forEach((name) => { form.elements[name].value = editButton.dataset[name] || ''; });
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const button = event.target.closest('[data-action="delete-plan"]');
    if (!button || !window.confirm('Supprimer définitivement ce plan ?')) return;
    button.disabled = true;
    try {
      await request(`/plans/${encodeURIComponent(button.dataset.id)}`, { method: 'DELETE' });
      button.closest('tr').remove();
    } catch (error) {
      window.alert(error.message);
      button.disabled = false;
    }
  });
})();
