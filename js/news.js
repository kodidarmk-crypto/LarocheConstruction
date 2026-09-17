(() => {
  const homeGrid = document.querySelector('#home-news-grid');
  const homeEmpty = document.querySelector('#home-news-empty');
  if (homeGrid) {
    fetch('/api/public/news')
      .then((response) => { if (!response.ok) throw new Error(`Erreur serveur (${response.status})`); return response.json(); })
      .then((data) => {
        const items = (Array.isArray(data) ? data : data.news) || [];
        const published = items.filter((item) => item.status !== 'hidden' && item.status !== 'draft').slice(0, 4);
        homeGrid.innerHTML = published.map((item) => `<article class="news-card"><img src="${item.image || item.imageUrl || 'image/fond.jpg'}" alt="${item.title || 'Actualité Laroche Construction'}"><div><p class="news-meta">${item.category || 'ACTUALITÉS'} <span>—</span> ${item.date || ''}</p><h3>${item.title || ''}</h3><a href="pages/news-detail.html?id=${encodeURIComponent(item.id || '')}">Lire la suite <span>↗</span></a></div></article>`).join('');
        homeEmpty.classList.toggle('is-hidden', published.length > 0);
      })
      .catch(() => {});
  }
  const grid = document.querySelector('#news-archive-grid');
  const count = document.querySelector('#news-count');
  const empty = document.querySelector('#news-empty');
  if (!grid) return;

  const fallbackNews = [];

  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? escapeHtml(value) : new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  };
  const getDateValue = (item) => new Date(item.date || item.publishedAt || item.createdAt || 0).getTime() || 0;
  const render = (items) => {
    const published = items.filter((item) => item.status !== 'hidden' && item.status !== 'draft').sort((a, b) => getDateValue(b) - getDateValue(a));
    grid.innerHTML = published.map((item) => {
      const image = item.image || item.imageUrl || '../image/fond.jpg';
      const detailUrl = item.url || `news-detail.html?id=${encodeURIComponent(item.id || '')}`;
      return `<article class="news-card"><img src="${escapeHtml(image)}" alt="${escapeHtml(item.title || 'Actualité Laroche Construction')}"><div><p class="news-meta">${escapeHtml(item.category || 'ACTUALITÉS')} <span>—</span> ${formatDate(item.date || item.publishedAt || item.createdAt)}</p><h3>${escapeHtml(item.title || '')}</h3>${item.summary ? `<p class="news-summary">${escapeHtml(item.summary)}</p>` : ''}<a href="${escapeHtml(detailUrl)}">Lire la suite <span>↗</span></a></div></article>`;
    }).join('');
    empty.classList.toggle('is-hidden', published.length > 0);
    count.textContent = published.length ? `${published.length} actualité${published.length > 1 ? 's' : ''}` : '';
  };

  render(fallbackNews);
  fetch('/api/public/news')
    .then((response) => {
      if (!response.ok) throw new Error(`Erreur serveur (${response.status})`);
      return response.json();
    })
    .then((data) => {
      const items = Array.isArray(data) ? data : data.news;
      if (Array.isArray(items)) render(items);
    })
    .catch(() => {});
})();
