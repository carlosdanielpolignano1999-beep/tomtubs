const feed = document.querySelector('#shorts-feed');
const demoShorts = [
  { title: 'Uma ideia em 30 segundos', channelName: 'TunTubes Criadores', description: 'Seu feed de vídeos rápidos começa aqui.', theme: 'sunset' },
  { title: 'Pausa criativa', channelName: 'Comunidade TunTubes', description: 'Conte histórias curtas, simples e originais.', theme: 'violet' },
  { title: 'Seu próximo short', channelName: 'Seu canal', description: 'Publique vídeos de até 1 minuto e 10 MB.', theme: 'mint' }
];

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('tuntubes-library', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function localShorts() {
  try {
    const db = await database();
    const entries = await new Promise((resolve, reject) => {
      const request = db.transaction('videos').objectStore('videos').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return entries
      .filter((entry) => !entry.expiresAt || entry.expiresAt > Date.now())
      .filter((entry) => !entry.durationSeconds || entry.durationSeconds <= 60.05)
      .sort((a, b) => b.savedAt - a.savedAt)
      .map((entry) => ({ ...entry, local: true }));
  } catch { return []; }
}

function initials(name) { return String(name || 'TT').split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase(); }

function createShort(item, index) {
  const article = document.createElement('article');
  article.className = `short-card short-${item.theme || ['sunset', 'violet', 'mint'][index % 3]}`;
  const media = document.createElement('div');
  media.className = 'short-media';
  if (item.file instanceof Blob) {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(item.file);
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'metadata';
    media.append(video);
  } else {
    media.innerHTML = '<span class="short-play">▶</span><span class="short-glow"></span>';
  }
  const info = document.createElement('div');
  info.className = 'short-info';
  info.innerHTML = '<div class="short-author"><span></span><div><strong></strong><p></p></div></div><h1></h1><p class="short-description"></p>';
  info.querySelector('.short-author span').textContent = initials(item.channelName || 'Seu canal');
  info.querySelector('.short-author strong').textContent = item.channelName || 'Seu canal';
  info.querySelector('.short-author p').textContent = item.local ? 'Short publicado agora' : 'Vídeo curto';
  info.querySelector('h1').textContent = item.title || 'Vídeo sem título';
  info.querySelector('.short-description').textContent = item.description || 'Seu vídeo curto no TunTubes.';
  const actions = document.createElement('div');
  actions.className = 'short-actions';
  actions.innerHTML = '<button type="button" aria-label="Curtir">♡<small>0</small></button><button type="button" aria-label="Comentar">▢<small>0</small></button><button type="button" aria-label="Compartilhar">↗</button>';
  actions.querySelector('button').addEventListener('click', (event) => { const button = event.currentTarget; const liked = button.classList.toggle('liked'); button.firstChild.textContent = liked ? '♥' : '♡'; button.querySelector('small').textContent = liked ? '1' : '0'; });
  actions.querySelectorAll('button')[2].addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); } catch {} });
  article.append(media, info, actions);
  return article;
}

async function start() {
  const items = [...await localShorts(), ...demoShorts];
  items.forEach((item, index) => feed.append(createShort(item, index)));
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    const video = entry.target.querySelector('video');
    if (!video) return;
    if (entry.isIntersecting) video.play().catch(() => {}); else video.pause();
  }), { threshold: .72 });
  document.querySelectorAll('.short-card').forEach((card) => observer.observe(card));
}

document.addEventListener('keydown', (event) => {
  if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
  event.preventDefault();
  const cards = [...document.querySelectorAll('.short-card')];
  const active = cards.findIndex((card) => Math.abs(card.getBoundingClientRect().top) < innerHeight / 2);
  cards[Math.max(0, Math.min(cards.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1)))]?.scrollIntoView({ behavior: 'smooth' });
});

start();

