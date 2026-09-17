(() => {
  const track = document.querySelector('#reels-track');
  const empty = document.querySelector('#realizations-empty');
  const pagination = document.querySelector('#reels-pagination');
  if (!track) return;
  const pageSize = 9;
  const youtubeChannelId = 'UCV-Jtu_zpf4S87n9GyTrcDw';
  let videos = [];
  let page = 1;
  let modal;
  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const videoId = (video) => {
    if (video.id && /^[\w-]{11}$/.test(video.id)) return video.id;
    const match = String(video.url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/);
    return match ? match[1] : '';
  };
  const closeModal = () => { modal?.remove(); modal = null; document.body.classList.remove('video-modal-open'); };
  const openVideo = (index) => {
    const video = videos[(page - 1) * pageSize + index];
    if (!video) return;
    closeModal();
    modal = document.createElement('div');
    modal.className = 'video-modal';
    modal.innerHTML = `<div class="video-modal-backdrop"></div><div class="video-modal-dialog" role="dialog" aria-modal="true" aria-label="Vidéo de réalisation"><button class="video-modal-close" type="button" aria-label="Fermer">×</button><button class="video-modal-prev" type="button" aria-label="Vidéo précédente">‹</button><iframe src="https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&playsinline=1" title="${escapeHtml(video.title || 'Réalisation Laroche Construction')}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe><button class="video-modal-next" type="button" aria-label="Vidéo suivante">›</button></div>`;
    document.body.appendChild(modal);
    document.body.classList.add('video-modal-open');
    modal.querySelector('.video-modal-close').addEventListener('click', closeModal);
    modal.querySelector('.video-modal-backdrop').addEventListener('click', closeModal);
    modal.querySelector('.video-modal-prev').addEventListener('click', () => openVideo(index > 0 ? index - 1 : index));
    modal.querySelector('.video-modal-next').addEventListener('click', () => openVideo(index < Math.min(pageSize, videos.length - (page - 1) * pageSize) - 1 ? index + 1 : index));
  };
  const render = () => {
    const start = (page - 1) * pageSize;
    const visible = videos.slice(start, start + pageSize);
    empty.classList.toggle('is-hidden', videos.length > 0);
    track.innerHTML = visible.map((video, index) => `<article class="reel-slide"><button class="reel-launch" type="button" aria-label="Lire ${escapeHtml(video.title || 'la vidéo')}"><img src="https://i.ytimg.com/vi/${video.id}/hqdefault.jpg" alt="" loading="lazy"><span class="reel-play">▶</span></button><div class="reel-caption"><p class="eyebrow light">RÉALISATION LAROCHE</p><h3>${escapeHtml(video.title || 'Une réalisation Laroche Construction')}</h3></div></article>`).join('');
    track.querySelectorAll('.reel-launch').forEach((button, index) => button.addEventListener('click', () => openVideo(index)));
    const pages = Math.ceil(videos.length / pageSize);
    pagination.innerHTML = pages > 1 ? Array.from({ length: pages }, (_, index) => `<button class="${index + 1 === page ? 'is-active' : ''}" type="button" data-page="${index + 1}">${index + 1}</button>`).join('') : '';
    pagination.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => { page = Number(button.dataset.page); render(); }));
  };
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });
  fetch(`/api/public/videos?channelId=${encodeURIComponent(youtubeChannelId)}`)
    .then((response) => { if (!response.ok) throw new Error(`Erreur serveur (${response.status})`); return response.json(); })
    .then((data) => {
      const source = Array.isArray(data) ? data : data.videos;
      videos = (source || []).map((video) => ({ ...video, id: videoId(video) })).filter((video) => video.id).sort((a, b) => new Date(b.publishedAt || b.createdAt || b.date || 0) - new Date(a.publishedAt || a.createdAt || a.date || 0));
      render();
    })
    .catch(() => { videos = []; render(); });
})();
