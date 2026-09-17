(() => {
  const root = document.querySelector('#news-detail');
  if (!root) return;
  const news = [
    { id: 'news-1', image: '../image/674114276_936184019165898_4583739317440869145_n.jpg', category: 'Sur le terrain', date: '2026-06-12', title: "Construire le prochain repère, un détail après l'autre.", summary: "Nos équipes avancent avec la même exigence : bâtir des espaces solides, utiles et pensés pour durer.", content: "Sur chaque chantier, la qualité se construit dans les détails. De la préparation du terrain aux dernières finitions, nos équipes coordonnent les savoir-faire et gardent le même objectif : livrer un lieu fiable, fonctionnel et durable." },
    { id: 'news-2', image: '../image/744393707_1008988125218820_8780422793840262853_n.jpg', category: 'Réalisations', date: '2026-05-28', title: "Dans les coulisses d'une nouvelle génération de maisons Laroche.", summary: "Découvrez les choix et les gestes qui donnent vie à nos projets résidentiels.", content: "Une maison Laroche est pensée autour des usages, de la lumière et du climat local. Chaque choix de conception est étudié avec nos équipes afin de créer un cadre de vie confortable, solide et cohérent avec son environnement." },
    { id: 'news-3', image: '../image/771998360_1032219502895682_3587179150862190081_n.jpg', category: 'Communauté', date: '2026-04-04', title: "Les personnes, le progrès et les lieux que nous partageons.", summary: "Laroche Construction grandit avec ses équipes, ses partenaires et les communautés qui l'accueillent.", content: "Construire, c'est aussi créer des liens. Nous avançons avec nos collaborateurs, nos partenaires et les communautés qui accueillent nos projets, dans une démarche fondée sur l'écoute et la responsabilité." }
  ];
  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const formatDate = (value) => new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
  const id = new URLSearchParams(window.location.search).get('id');
  const render = (item) => {
    if (!item || item.status === 'hidden' || item.status === 'draft') {
      root.innerHTML = '<div class="news-detail-error"><p class="eyebrow">ACTUALITÉ</p><h1>Cette actualité est indisponible.</h1><a class="button button-gold" href="news.html">Retour aux actualités <span>↗</span></a></div>';
      return;
    }
    root.innerHTML = `<div class="news-detail-hero"><img src="${escapeHtml(item.image || item.imageUrl || '../image/fond.jpg')}" alt="${escapeHtml(item.title)}"><div><p class="eyebrow light">${escapeHtml(item.category || 'ACTUALITÉS')} <span>—</span> ${formatDate(item.date || item.publishedAt || item.createdAt)}</p><h1>${escapeHtml(item.title)}</h1></div></div><div class="news-detail-body"><p class="news-detail-lead">${escapeHtml(item.summary || '')}</p><p>${escapeHtml(item.content || item.summary || '')}</p><a class="text-link dark" href="news.html">Toutes les actualités <span>↗</span></a></div>`;
  };
  render(news.find((item) => item.id === id) || news[0]);
  fetch('/api/public/news')
    .then((response) => { if (!response.ok) throw new Error(`Erreur serveur (${response.status})`); return response.json(); })
    .then((data) => {
      const items = Array.isArray(data) ? data : data.news;
      if (Array.isArray(items)) render(items.find((item) => String(item.id) === id));
    })
    .catch(() => {});
})();
