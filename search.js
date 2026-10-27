const params = new URLSearchParams(location.search);
const query = params.get('q') || '';
const input = document.querySelector('#results-query');
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const matches = (video) => normalize(query).split(/\s+/).filter(Boolean).every((word) => normalize([video.title, video.description, video.channelName, ...(video.tags || [])].join(' ')).includes(word));
input.value = query;
document.querySelector('#results-heading').textContent = `Resultados para “${query}”`;
document.querySelector('#results-submit').onclick = () => { if (input.value.trim()) location.href = `search.html?${new URLSearchParams({ q: input.value.trim() })}`; };
input.onkeydown = (event) => { if (event.key === 'Enter') document.querySelector('#results-submit').click(); };

function renderChannels(channels) {
  const out = document.querySelector('#result-channels'); out.innerHTML = '';
  if (!channels.length) { out.innerHTML = '<p class="empty-library">Nenhum canal encontrado por esse termo.</p>'; return; }
  channels.forEach((channel) => { const a = document.createElement('a'); a.className = 'result-channel'; a.target = '_blank'; a.rel = 'noopener'; a.href = `channel.html?${new URLSearchParams({ id: channel.id, name: channel.name })}`; a.innerHTML = '<span></span><div><h3></h3><p>Canal no TunTubes · Abrir canal</p></div><b>↗</b>'; a.querySelector('span').textContent = channel.initials; a.querySelector('h3').textContent = channel.name; out.append(a); });
}

function renderVideos(videos) {
  const out = document.querySelector('#result-videos'); out.innerHTML = '';
  if (!videos.length) { out.innerHTML = '<p class="empty-library">Nenhum vídeo público encontrado por título, descrição ou palavra-chave.</p>'; return; }
  videos.forEach((video) => { const a = document.createElement('a'); a.className = 'result-video'; a.target = '_blank'; a.rel = 'noopener'; a.href = `watch.html?${new URLSearchParams({ id: video.id, title: video.title, channel: video.channelName, channelId: video.channelId || 'canal' })}`; a.innerHTML = '<div>▶</div><section><h3></h3><p></p><small></small></section>'; a.querySelector('h3').textContent = video.title; a.querySelector('p').textContent = video.channelName; a.querySelector('small').textContent = video.tags?.length ? `Palavras-chave: ${video.tags.join(' · ')}` : 'Vídeo publicado · Assistir'; out.append(a); });
}

async function localVideos() {
  return new Promise((resolve) => {
    const request = indexedDB.open('tuntubes-library', 1);
    request.onerror = () => resolve([]);
    request.onsuccess = () => {
      const get = request.result.transaction('videos').objectStore('videos').getAll();
      get.onerror = () => resolve([]);
      get.onsuccess = () => resolve(get.result.filter((video) => (video.visibility || 'public') === 'public' && matches(video)));
    };
  });
}

async function load() {
  try {
    const data = await fetch(`/api/search?q=${encodeURIComponent(query)}`).then((response) => response.json());
    renderChannels(data.channels || []);
    const local = await localVideos();
    const combined = [...(data.videos || []), ...local].filter((video, index, list) => list.findIndex((item) => item.id === video.id && item.channelName === video.channelName) === index);
    renderVideos(combined);
  } catch { renderChannels([]); renderVideos([]); }
}

load();
