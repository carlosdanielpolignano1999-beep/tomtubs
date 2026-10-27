const modal = document.querySelector('#upload-modal');
const fileInput = document.querySelector('#video-file');
const chooseFile = document.querySelector('#choose-file');
const dropArea = document.querySelector('#drop-area');
const previewBox = document.querySelector('#preview-box');
const publishButton = document.querySelector('#publish-button');
const titleInput = document.querySelector('#video-title');
const descriptionInput = document.querySelector('#video-description');
const tagsInput = document.querySelector('#video-tags');
const retentionInput = document.querySelector('#video-retention');
const visibilityInput = document.querySelector('#video-visibility');
const playerModal = document.querySelector('#player-modal');
const videoPlayer = document.querySelector('#video-player');
const playerTitle = document.querySelector('#player-title');
const closePlayer = document.querySelector('#close-player');
const playerPlaceholder = document.querySelector('#player-placeholder');
const subscribeChannelButton = document.querySelector('#subscribe-channel');
const subscriberCount = document.querySelector('#subscriber-count');
const commentCount = document.querySelector('#comment-count');
const videoCommentForm = document.querySelector('#video-comment-form');
const videoCommentText = document.querySelector('#video-comment-text');
const videoCommentList = document.querySelector('#video-comment-list');
const videoEditor = document.querySelector('#video-editor');
const filterStrength = document.querySelector('#filter-strength');
const profileModal = document.querySelector('#profile-modal');
const openProfile = document.querySelector('#open-profile');
const profileForm = document.querySelector('#profile-form');
const profileName = document.querySelector('#profile-name');
const profilePhoto = document.querySelector('#profile-photo');
const profileInitials = document.querySelector('#profile-initials');
const profilePhotoFile = document.querySelector('#profile-photo-file');
const coverFile = document.querySelector('#cover-file');
const profileCover = document.querySelector('#profile-cover');
const profileUpload = document.querySelector('#profile-upload');
const authModal = document.querySelector('#auth-modal');
const accountButton = document.querySelector('#account-button');
const logoutButton = document.querySelector('#logout-button');
const authMessage = document.querySelector('#auth-message');
const storageNote = document.querySelector('#storage-note');
let selectedFile = null;
let objectUrl = null;
let selectedDurationSeconds = 0;
let selectedFilter = 'normal';
let uploadedFilter = 'none';
let editingVideoId = null;
let activeLibraryVisibility = 'all';
let currentUser = null;
let cloudStorageEnabled = false;
let activeVideoSocial = null;
const videoDatabase = openVideoDatabase();
const searchInput = document.querySelector('#search-input');
const searchResults = document.querySelector('#search-results');
const searchSubmit = document.querySelector('#search-submit');
async function readApiJson(response) {
  const text = await response.text();
  try { return JSON.parse(text); }
  catch {
    throw new Error('O servidor do TunTubes não respondeu à solicitação. Abra o projeto pelo servidor da aplicação, não apenas por uma página estática.');
  }
}
function openSearchPage() { const query = searchInput.value.trim(); if (query) window.open(`search.html?${new URLSearchParams({ q: query })}`, '_blank', 'noopener'); }
searchSubmit.addEventListener('click', openSearchPage);
searchInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); openSearchPage(); } });

function renderSearchResults(results) {
  const channels = results.channels || [];
  const videos = results.videos || [];
  searchResults.innerHTML = '';
  if (!channels.length && !videos.length) { searchResults.innerHTML = '<p>Nenhum canal ou vídeo encontrado.</p>'; searchResults.hidden = false; return; }
  if (videos.length) {
    const heading = document.createElement('p'); heading.className = 'search-group-title'; heading.textContent = 'Vídeos encontrados'; searchResults.append(heading);
    videos.slice(0, 4).forEach((video) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'search-result'; button.innerHTML = '<span>▶</span><strong></strong><small></small>'; button.querySelector('strong').textContent = video.title; button.querySelector('small').textContent = `${video.channelName} · Assistir ↗`; button.addEventListener('click', () => window.open(`watch.html?${new URLSearchParams({ id: video.id, title: video.title, channel: video.channelName, channelId: video.channelId || 'canal' })}`, '_blank', 'noopener')); searchResults.append(button); });
  }
  if (channels.length) { const heading = document.createElement('p'); heading.className = 'search-group-title'; heading.textContent = 'Canais encontrados'; searchResults.append(heading); }
  channels.forEach((channel) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'search-result'; button.innerHTML = `<span></span><strong></strong><small>Abrir canal ↗</small>`; button.querySelector('span').textContent = channel.initials; button.querySelector('strong').textContent = channel.name; button.addEventListener('click', () => window.open(`channel.html?${new URLSearchParams({ id: channel.id, name: channel.name })}`, '_blank', 'noopener')); searchResults.append(button); });
  searchResults.hidden = false;
}
let searchTimer;
searchInput.addEventListener('input', () => { clearTimeout(searchTimer); const query = searchInput.value.trim(); if (query.length < 2) { searchResults.hidden = true; return; } searchTimer = setTimeout(async () => { try { const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`); renderSearchResults(await readApiJson(response)); } catch { searchResults.innerHTML = '<p>Conecte o servidor do TunTubes para pesquisar vídeos e canais.</p>'; searchResults.hidden = false; } }, 180); });
document.addEventListener('click', (event) => { if (!event.target.closest('.search')) searchResults.hidden = true; });

async function loadSubscriptions() {
  const grid = document.querySelector('#subscriptions-grid');
  if (!currentUser) { grid.innerHTML = '<p class="empty-library">Entre para ver os canais que você acompanha.</p>'; return; }
  try { const response = await fetch('/api/subscriptions'); const data = await readApiJson(response); if (!response.ok) throw new Error(); grid.innerHTML = ''; if (!data.channels.length) { grid.innerHTML = '<p class="empty-library">Você ainda não se inscreveu em nenhum canal.</p>'; return; } data.channels.forEach((channel) => { const item = document.createElement('article'); item.className = 'subscription-card'; item.innerHTML = `<span></span><div><h3></h3><p>Canal inscrito</p></div><button type="button">Ver canal</button>`; item.querySelector('span').textContent = channel.initials; item.querySelector('h3').textContent = channel.name; item.querySelector('button').addEventListener('click', () => window.open(`watch.html?${new URLSearchParams({ id: `canal-${channel.id}`, title: channel.name, channel: channel.name, channelId: channel.id })}`, '_blank', 'noopener')); grid.append(item); }); } catch { grid.innerHTML = '<p class="empty-library">Não foi possível carregar suas inscrições agora.</p>'; }
}

document.querySelectorAll('[data-open-upload]').forEach((button) => {
  button.addEventListener('click', () => currentUser ? modal.showModal() : openAuth());
});

chooseFile.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

['dragenter', 'dragover'].forEach((eventName) => {
  dropArea.addEventListener(eventName, (event) => { event.preventDefault(); dropArea.style.borderColor = '#7755e8'; });
});
['dragleave', 'drop'].forEach((eventName) => {
  dropArea.addEventListener(eventName, (event) => { event.preventDefault(); dropArea.style.borderColor = ''; });
});
dropArea.addEventListener('drop', (event) => handleFile(event.dataTransfer.files[0]));

function getVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const probe = document.createElement('video');
    const url = URL.createObjectURL(file);
    const finish = (value, error) => { URL.revokeObjectURL(url); probe.remove(); error ? reject(error) : resolve(value); };
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => finish(probe.duration);
    probe.onerror = () => finish(0, new Error('Não foi possível verificar esse vídeo.'));
    probe.src = url;
  });
}

async function handleFile(file) {
  if (!file || !file.type.startsWith('video/')) { alert('Escolha um arquivo de vídeo, GIF ou animação.'); return; }
  if (file.size > 10 * 1024 * 1024) { alert('Escolha um vídeo de até 10 MB para publicar.'); return; }
  let duration;
  try { duration = await getVideoDuration(file); }
  catch (error) { alert(error.message); return; }
  if (!Number.isFinite(duration) || duration > 60.05) { alert('Para esta fase do TunTubes, publique vídeos de até 1 minuto.'); return; }
  selectedFile = file;
  selectedDurationSeconds = duration;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  previewBox.innerHTML = `<video controls src="${objectUrl}"></video>`;
  videoEditor.disabled = false;
  applyPreviewFilter();
  storageNote.textContent = `Vídeo pronto para publicar: ${duration.toFixed(1)} s · ${(file.size / 1024 / 1024).toFixed(1)} MB.`;
  if (!titleInput.value) titleInput.value = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  updatePublishState();
}

function updatePublishState() {
  publishButton.disabled = !(selectedFile && titleInput.value.trim());
}
titleInput.addEventListener('input', updatePublishState);

publishButton.addEventListener('click', async () => {
  if (!selectedFile) return;
  publishButton.disabled = true;
  const title = titleInput.value.trim();
  const retention = retentionInput.value;
  let cloudAsset = null;
  try {
    cloudAsset = await uploadToCloud(selectedFile);
  } catch (error) {
    alert(error.message);
    updatePublishState();
    return;
  }
  const entry = {
    id: editingVideoId || crypto.randomUUID(), title, description: descriptionInput.value.trim(), tags: tagsInput.value.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 12), ownerId: currentUser?.id || null, file: selectedFile,
    channelName: profileName.value.trim() || 'Seu canal', filter: uploadedFilter, visibility: visibilityInput.value,
    cloudUid: cloudAsset?.uid || null, durationSeconds: selectedDurationSeconds,
    savedAt: Date.now(), expiresAt: retention === 'infinite' ? null : Date.now() + Number(retention) * 86400000,
  };
  try {
    await saveVideo(entry);
    if (entry.visibility === 'public') fetch('/api/videos/metadata', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) }).catch(() => {});
    document.querySelector(`[data-video-id="${entry.id}"]`)?.remove();
    document.querySelector(`#channel-grid [data-video-id="${entry.id}"]`)?.remove();
    renderSavedVideo(entry, true);
  } catch {
    alert('Não foi possível salvar o vídeo neste navegador. Tente um arquivo menor.');
    updatePublishState();
    return;
  }
  modal.close();
  document.querySelector('#video-title').value = '';
  descriptionInput.value = '';
  tagsInput.value = '';
  previewBox.innerHTML = '<span>A prévia do seu vídeo aparecerá aqui</span>';
  selectedFile = null;
  selectedDurationSeconds = 0;
  objectUrl = null;
  editingVideoId = null;
  publishButton.textContent = 'Publicar no TunTubes';
  videoEditor.disabled = true;
  updatePublishState();
});

async function uploadToCloud(file) {
  if (!cloudStorageEnabled) return null;
  if (!currentUser) throw new Error('Entre na sua conta antes de enviar um vídeo para a nuvem.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Escolha um vídeo de até 10 MB para publicar.');
  const storage = window.tuntubesSupabase?.storage;
  if (!storage) throw new Error('A conexão com o armazenamento em nuvem não foi iniciada. Atualize a página e tente novamente.');
  const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${currentUser.id}/${crypto.randomUUID()}-${safeName}`;
  const { data, error } = await storage.from('videos').upload(path, file, { cacheControl: '3600', contentType: file.type || 'video/mp4', upsert: false });
  if (error) throw new Error(`Não foi possível enviar o vídeo para a nuvem: ${error.message}`);
  return { uid: data.path };
}

function renderSavedVideo(entry, addToTop = false) {
  const template = document.querySelector('#uploaded-video-template');
  const card = template.content.cloneNode(true);
  const thumbnail = card.querySelector('.uploaded-thumb');
  card.querySelector('.uploaded-card').dataset.videoId = entry.id;
  card.querySelector('.uploaded-card').dataset.channelId = currentUser?.id || 'seu-canal';
  const sourceUrl = URL.createObjectURL(entry.file);
  const video = document.createElement('video');
  video.src = sourceUrl;
  video.muted = true;
  video.preload = 'metadata';
  thumbnail.prepend(video);
  thumbnail.dataset.videoSrc = sourceUrl;
  thumbnail.dataset.videoTitle = entry.title;
  thumbnail.dataset.channelName = entry.channelName;
  thumbnail.dataset.videoId = entry.id;
  thumbnail.dataset.channelId = currentUser?.id || 'seu-canal';
  thumbnail.dataset.videoFilter = entry.filter || 'none';
  video.style.filter = entry.filter || 'none';
  card.querySelector('h3').textContent = entry.title;
  card.querySelector('.video-info p').textContent = entry.channelName;
  if ((entry.visibility || 'public') === 'public') {
    if (addToTop) document.querySelector('#video-grid').prepend(card);
    else document.querySelector('#video-grid').append(card);
  }
  renderChannelVideo(entry, addToTop);
}

function renderChannelVideo(entry, addToTop = false) {
  const template = document.querySelector('#channel-video-template');
  const card = template.content.cloneNode(true);
  const article = card.querySelector('.channel-video');
  const thumb = card.querySelector('.channel-thumb');
  const sourceUrl = URL.createObjectURL(entry.file);
  const labels = { public: 'Público', private: 'Privado', unlisted: 'Não listado' };
  article.dataset.videoId = entry.id;
  article.dataset.visibility = entry.visibility || 'public';
  thumb.dataset.videoSrc = sourceUrl;
  thumb.dataset.videoTitle = entry.title;
  thumb.dataset.channelName = entry.channelName;
  thumb.dataset.videoId = entry.id;
  thumb.dataset.channelId = currentUser?.id || 'seu-canal';
  thumb.dataset.videoFilter = entry.filter || 'none';
  thumb.style.filter = entry.filter || 'none';
  card.querySelector('h3').textContent = entry.title;
  const status = card.querySelector('.channel-status');
  status.textContent = labels[entry.visibility] || labels.public;
  status.classList.add(entry.visibility || 'public');
  card.querySelector('.channel-retention').textContent = entry.expiresAt ? `Salvo até ${new Date(entry.expiresAt).toLocaleDateString('pt-BR')}` : 'Sem prazo para expirar';
  const grid = document.querySelector('#channel-grid');
  if (addToTop) grid.prepend(card); else grid.append(card);
  refreshLibrary();
}

function refreshLibrary() {
  const cards = [...document.querySelectorAll('#channel-grid .channel-video')];
  cards.forEach((card) => { card.hidden = activeLibraryVisibility !== 'all' && card.dataset.visibility !== activeLibraryVisibility; });
  const visible = cards.filter((card) => !card.hidden).length;
  document.querySelector('#library-count').textContent = `${cards.length} ${cards.length === 1 ? 'vídeo' : 'vídeos'}`;
  document.querySelector('#empty-library').hidden = visible > 0;
  renderStudio();
}

function openVideoDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('tuntubes-library', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('videos', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveVideo(entry) {
  const database = await videoDatabase;
  return new Promise((resolve, reject) => {
    const request = database.transaction('videos', 'readwrite').objectStore('videos').put(entry);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function restoreSavedVideos() {
  try {
    const database = await videoDatabase;
    const entries = await new Promise((resolve, reject) => {
      const request = database.transaction('videos').objectStore('videos').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    entries.sort((a, b) => b.savedAt - a.savedAt).forEach((entry) => {
      if (entry.expiresAt && entry.expiresAt <= Date.now()) deleteSavedVideo(entry.id);
      else renderSavedVideo(entry);
    });
  } catch {
    // A interface continua funcionando mesmo se o navegador bloquear o armazenamento local.
  }
}

async function syncPublicVideosToSearch() {
  if (!currentUser) return;
  try {
    const database = await videoDatabase;
    const entries = await new Promise((resolve, reject) => {
      const request = database.transaction('videos').objectStore('videos').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    // Vídeos antigos não tinham ownerId. Na primeira sincronização da biblioteca local,
    // eles passam a pertencer à conta que está aberta neste navegador.
    const mine = entries.filter((entry) => (entry.visibility || 'public') === 'public' && (entry.ownerId === currentUser.id || !entry.ownerId));
    await Promise.all(mine.map((entry) => fetch('/api/videos/metadata', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) })));
  } catch {
    // A publicação e a pesquisa local continuam disponíveis se o navegador negar acesso à biblioteca.
  }
}

async function deleteSavedVideo(id) {
  const database = await videoDatabase;
  database.transaction('videos', 'readwrite').objectStore('videos').delete(id);
}

async function getSavedVideo(id) {
  const database = await videoDatabase;
  return new Promise((resolve, reject) => {
    const request = database.transaction('videos').objectStore('videos').get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

restoreSavedVideos();

document.querySelectorAll('.effect-button').forEach((button) => {
  button.addEventListener('click', () => {
    selectedFilter = button.dataset.filter;
    document.querySelector('.effect-button.active').classList.remove('active');
    button.classList.add('active');
    applyPreviewFilter();
  });
});

filterStrength.addEventListener('input', applyPreviewFilter);

function applyPreviewFilter() {
  const intensity = Number(filterStrength.value) / 100;
  const filters = {
    normal: 'none',
    cinema: `contrast(${1 + .18 * intensity}) saturate(${1 - .22 * intensity}) sepia(${.12 * intensity})`,
    vibrant: `saturate(${1 + .55 * intensity}) contrast(${1 + .08 * intensity})`,
    mono: `grayscale(${intensity}) contrast(${1 + .15 * intensity})`,
  };
  uploadedFilter = filters[selectedFilter];
  const preview = previewBox.querySelector('video');
  if (preview) preview.style.filter = uploadedFilter;
}

document.querySelector('#video-grid').addEventListener('click', (event) => {
  const editButton = event.target.closest('.edit-video');
  if (editButton) {
    editSavedVideo(editButton.closest('.uploaded-card').dataset.videoId);
    return;
  }
  const thumbnail = event.target.closest('.uploaded-thumb');
  if (thumbnail) openPlayer(thumbnail.dataset.videoSrc, thumbnail.dataset.videoTitle, thumbnail.dataset.videoId, thumbnail.dataset.channelId, thumbnail.dataset.channelName);
});

document.querySelector('#channel-grid').addEventListener('click', async (event) => {
  const card = event.target.closest('.channel-video');
  if (!card) return;
  if (event.target.closest('.edit-channel-video')) return editSavedVideo(card.dataset.videoId);
  if (event.target.closest('.download-video')) {
    const entry = await getSavedVideo(card.dataset.videoId);
    if (entry) downloadVideo(entry);
    return;
  }
  const thumb = event.target.closest('.channel-thumb');
  if (thumb) openPlayer(thumb.dataset.videoSrc, thumb.dataset.videoTitle, thumb.dataset.videoId, thumb.dataset.channelId, thumb.dataset.channelName);
});

function downloadVideo(entry) {
  const url = URL.createObjectURL(entry.file);
  const link = document.createElement('a');
  link.href = url;
  link.download = entry.file.name || `${entry.title}.mp4`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.querySelectorAll('.library-filter').forEach((button) => {
  button.addEventListener('click', () => {
    activeLibraryVisibility = button.dataset.visibility;
    document.querySelector('.library-filter.selected').classList.remove('selected');
    button.classList.add('selected');
    refreshLibrary();
  });
});

async function editSavedVideo(id) {
  try {
    const entry = await getSavedVideo(id);
    if (!entry) return;
    editingVideoId = id;
    titleInput.value = entry.title;
    descriptionInput.value = entry.description || '';
    tagsInput.value = (entry.tags || []).join(', ');
    visibilityInput.value = entry.visibility || 'public';
    retentionInput.value = entry.expiresAt ? String(Math.min(365, Math.max(30, Math.round((entry.expiresAt - Date.now()) / 86400000)))) : 'infinite';
    handleFile(entry.file);
    uploadedFilter = entry.filter || 'none';
    previewBox.querySelector('video').style.filter = uploadedFilter;
    publishButton.textContent = 'Salvar alterações';
    modal.showModal();
  } catch {
    alert('Não foi possível abrir este vídeo para edição.');
  }
}

function openPlayer(src, title, videoId, channelId, channelName) {
  const params = new URLSearchParams({ id: videoId || 'video', title: title || 'Vídeo no TunTubes', channel: channelName || channelFor(src), channelId: channelId || 'seu-canal' });
  if (videoId && src) params.set('local', '1');
  window.open(`watch.html?${params.toString()}`, '_blank', 'noopener');
  return;
  playerTitle.textContent = title || 'Vídeo enviado';
  document.querySelector('#player-meta').textContent = `${channelName || channelFor(src)} · enviado agora`;
  activeVideoSocial = { videoId: videoId || `video-${String(title || 'sem-titulo').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, channelId: channelId || 'seu-canal' };
  if (src) {
    playerPlaceholder.hidden = true;
    videoPlayer.hidden = false;
    videoPlayer.src = src;
    videoPlayer.style.filter = eventFilterFor(src);
  } else {
    videoPlayer.hidden = true;
    playerPlaceholder.hidden = false;
  }
  playerModal.showModal();
  if (src) videoPlayer.play().catch(() => {});
  loadVideoSocial();
}

function channelFor(src) {
  const thumbnail = document.querySelector(`[data-video-src="${CSS.escape(src)}"]`);
  return thumbnail?.dataset.channelName || 'Seu canal';
}

function eventFilterFor(src) {
  const thumbnail = document.querySelector(`[data-video-src="${CSS.escape(src)}"]`);
  return thumbnail?.dataset.videoFilter || 'none';
}

function closePlayerModal() {
  videoPlayer.pause();
  videoPlayer.removeAttribute('src');
  videoPlayer.load();
  activeVideoSocial = null;
  playerModal.close();
}

closePlayer.addEventListener('click', closePlayerModal);
playerModal.addEventListener('click', (event) => {
  if (event.target === playerModal) closePlayerModal();
});

document.querySelectorAll('#video-grid > .video-card:not(.uploaded-card) .thumbnail').forEach((thumbnail) => {
  thumbnail.addEventListener('click', () => {
    const card = thumbnail.closest('.video-card');
    openPlayer('', card.querySelector('h3')?.textContent, card.dataset.videoId, card.dataset.channelId, card.dataset.channelName);
  });
});

function formatCount(count) { return `${count} ${count === 1 ? 'inscrito' : 'inscritos'}`; }

function renderVideoComments(comments) {
  commentCount.textContent = comments.length;
  videoCommentList.innerHTML = '';
  if (!comments.length) { videoCommentList.innerHTML = '<p class="comments-empty">Seja a primeira pessoa a comentar.</p>'; return; }
  comments.forEach((comment) => {
    const item = document.createElement('article');
    item.className = 'video-comment';
    const author = document.createElement('strong');
    const text = document.createElement('p');
    const date = document.createElement('small');
    author.textContent = comment.authorName;
    text.textContent = comment.text;
    date.textContent = new Date(comment.createdAt).toLocaleString('pt-BR');
    item.append(author, text, date);
    videoCommentList.append(item);
  });
}

async function loadVideoSocial() {
  if (!activeVideoSocial) return;
  try {
    const [videoResponse, channelResponse] = await Promise.all([
      fetch(`/api/videos/${encodeURIComponent(activeVideoSocial.videoId)}/social`),
      fetch(`/api/channels/${encodeURIComponent(activeVideoSocial.channelId)}/social`),
    ]);
    const videoData = await readApiJson(videoResponse);
    const channelData = await readApiJson(channelResponse);
    renderVideoComments(videoData.comments || []);
    subscriberCount.textContent = formatCount(channelData.subscriberCount || 0);
    subscribeChannelButton.textContent = channelData.subscribed ? 'Inscrito' : 'Inscrever-se';
    subscribeChannelButton.classList.toggle('subscribed', Boolean(channelData.subscribed));
  } catch { videoCommentList.innerHTML = '<p class="comments-empty">Não foi possível carregar os comentários agora.</p>'; }
}

subscribeChannelButton.addEventListener('click', async () => {
  if (!currentUser) return openAuth();
  if (!activeVideoSocial) return;
  const response = await fetch(`/api/channels/${encodeURIComponent(activeVideoSocial.channelId)}/subscribe`, { method: 'POST' });
  const data = await readApiJson(response);
  if (!response.ok) return alert(data.error || 'Não foi possível alterar a inscrição.');
  subscriberCount.textContent = formatCount(data.subscriberCount);
  subscribeChannelButton.textContent = data.subscribed ? 'Inscrito' : 'Inscrever-se';
  subscribeChannelButton.classList.toggle('subscribed', data.subscribed);
});

videoCommentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser) return openAuth();
  if (!activeVideoSocial || !videoCommentText.value.trim()) return;
  const response = await fetch(`/api/videos/${encodeURIComponent(activeVideoSocial.videoId)}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: videoCommentText.value }) });
  const data = await readApiJson(response);
  if (!response.ok) return alert(data.error || 'Não foi possível publicar o comentário.');
  videoCommentText.value = '';
  loadVideoSocial();
});
playerModal.addEventListener('close', () => {
  videoPlayer.pause();
  videoPlayer.removeAttribute('src');
  videoPlayer.load();
});

openProfile.addEventListener('click', () => currentUser ? profileModal.showModal() : openAuth());
profileUpload.addEventListener('click', () => {
  profileModal.close();
  modal.showModal();
});

profilePhotoFile.addEventListener('change', () => setProfileImage(profilePhotoFile.files[0], profilePhoto));
coverFile.addEventListener('change', () => setProfileImage(coverFile.files[0], profileCover));

function setProfileImage(file, target) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    target.style.backgroundImage = `url("${reader.result}")`;
    if (target === profilePhoto) {
      profileInitials.hidden = true;
      openProfile.style.backgroundImage = `url("${reader.result}")`;
      openProfile.textContent = '';
    }
  });
  reader.readAsDataURL(file);
}

profileForm.addEventListener('submit', () => {
  const name = profileName.value.trim() || 'Seu canal';
  const initials = name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase();
  profileInitials.textContent = initials;
  if (!openProfile.style.backgroundImage) openProfile.textContent = initials;
  document.querySelector('#studio-channel-name').textContent = name;
  document.querySelector('#studio-channel-photo').textContent = initials;
  document.querySelector('#studio-profile').textContent = initials;
});

const studioView = document.querySelector('#studio-view');
const mainLayout = document.querySelector('.layout');
const topbar = document.querySelector('.topbar');

document.querySelectorAll('a[href="#meu-canal"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    openStudio();
  });
});

document.querySelector('#leave-studio').addEventListener('click', (event) => {
  event.preventDefault();
  studioView.hidden = true;
  mainLayout.hidden = false;
  topbar.hidden = false;
  document.body.classList.remove('studio-only');
  document.title = 'TunTubes';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

function openStudio() {
  topbar.hidden = true;
  mainLayout.hidden = true;
  studioView.hidden = false;
  document.body.classList.add('studio-only');
  document.title = 'Meu canal — TunStudio';
  renderStudio();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function renderStudio() {
  const entries = [...document.querySelectorAll('#channel-grid .channel-video')];
  const count = (visibility) => entries.filter((entry) => entry.dataset.visibility === visibility).length;
  const name = profileName.value.trim() || 'Seu canal';
  document.querySelector('#studio-channel-name').textContent = name;
  document.querySelector('#studio-video-total').textContent = entries.length;
  document.querySelector('#studio-public-total').textContent = count('public');
  document.querySelector('#studio-private-total').textContent = count('private');
  document.querySelector('#studio-unlisted-total').textContent = count('unlisted');
  const comments = getStudioComments();
  document.querySelector('#analytics-videos').textContent = entries.length;
  document.querySelector('#analytics-public').textContent = count('public');
  document.querySelector('#analytics-comments').textContent = comments.length;
  document.querySelector('#analytics-summary').textContent = entries.length ? `${entries.length} vídeos salvos: ${count('public')} público(s), ${count('private')} privado(s) e ${count('unlisted')} não listado(s).` : 'Ainda não existem vídeos salvos para analisar.';
  loadLiveAnalytics();
  const list = document.querySelector('#studio-content-list');
  list.innerHTML = '';
  if (!entries.length) {
    list.innerHTML = '<p class="studio-empty">Ainda não há vídeos no canal.</p>';
    return;
  }
  entries.forEach((entry) => {
    const row = document.createElement('article');
    row.className = 'studio-content-row';
    row.innerHTML = `<div class="studio-content-thumb"></div><div><h2></h2><p></p></div><button type="button">Editar</button>`;
    row.querySelector('h2').textContent = entry.querySelector('h3').textContent;
    row.querySelector('p').textContent = entry.querySelector('.channel-status').textContent;
    row.querySelector('button').addEventListener('click', () => { studioView.hidden = true; mainLayout.hidden = false; topbar.hidden = false; editSavedVideo(entry.dataset.videoId); });
    list.append(row);
  });
}

function updateChartValue(valueId, barId, value, maximum) {
  document.querySelector(valueId).textContent = value;
  document.querySelector(barId).style.height = `${Math.max(10, Math.round((value / Math.max(1, maximum)) * 100))}%`;
}

async function loadLiveAnalytics() {
  if (!currentUser || !document.querySelector('#studio-live-views')) return;
  try {
    const response = await fetch(`/api/analytics/channels/${encodeURIComponent(currentUser.id)}`);
    if (!response.ok) return;
    const data = await readApiJson(response);
    document.querySelector('#studio-live-views').textContent = data.totalViews;
    document.querySelector('#studio-live-subscribers').textContent = data.subscriberCount;
    document.querySelector('#studio-live-clicks').textContent = data.totalClicks;
    document.querySelector('#studio-live-likes').textContent = data.totalLikes;
    document.querySelector('#studio-live-comments').textContent = data.totalComments;
    const maximum = Math.max(data.totalViews, data.subscriberCount, data.totalClicks, 1);
    updateChartValue('#chart-views-value', '#chart-views-bar', data.totalViews, maximum);
    updateChartValue('#chart-subscribers-value', '#chart-subscribers-bar', data.subscriberCount, maximum);
    updateChartValue('#chart-clicks-value', '#chart-clicks-bar', data.totalClicks, maximum);
    document.querySelector('#analytics-updated').textContent = `Atualizado agora · likes: ${data.totalLikes} · comentários: ${data.totalComments}`;
  } catch { document.querySelector('#analytics-updated').textContent = 'Não foi possível atualizar as métricas agora.'; }
}

function getStudioComments() {
  try { return JSON.parse(localStorage.getItem('tuntubes-studio-comments') || '[]'); } catch { return []; }
}

function saveStudioComments(comments) {
  localStorage.setItem('tuntubes-studio-comments', JSON.stringify(comments));
}

function renderStudioComments() {
  const comments = getStudioComments();
  const list = document.querySelector('#studio-comment-list');
  list.innerHTML = '';
  if (!comments.length) {
    list.innerHTML = '<p class="studio-empty">Nenhum comentário para moderar.</p>';
    return;
  }
  comments.forEach((comment) => {
    const item = document.createElement('article');
    item.className = 'studio-comment';
    const text = document.createElement('div');
    const body = document.createElement('p');
    const date = document.createElement('small');
    body.textContent = comment.text;
    date.textContent = `Comentário de teste · ${new Date(comment.createdAt).toLocaleString('pt-BR')}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remover';
    remove.addEventListener('click', () => {
      const next = getStudioComments().filter((saved) => saved.id !== comment.id);
      saveStudioComments(next);
      renderStudioComments();
      renderStudio();
    });
    text.append(body, date);
    item.append(text, remove);
    list.append(item);
  });
}

document.querySelector('#studio-comment-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = document.querySelector('#studio-comment-text');
  const text = input.value.trim();
  if (!text) return;
  const comments = getStudioComments();
  comments.unshift({ id: crypto.randomUUID(), text, createdAt: Date.now() });
  saveStudioComments(comments);
  input.value = '';
  renderStudioComments();
  renderStudio();
});

document.querySelectorAll('#studio-upload, #studio-upload-top, #studio-upload-card, #studio-upload-content').forEach((button) => {
  button.addEventListener('click', () => {
    if (!currentUser) return openAuth();
    studioView.hidden = true; mainLayout.hidden = false; topbar.hidden = false; modal.showModal();
  });
});
document.querySelectorAll('#studio-profile, #studio-edit-profile, #studio-customize-profile').forEach((button) => {
  button.addEventListener('click', () => {
    if (!currentUser) return openAuth();
    studioView.hidden = true; mainLayout.hidden = false; topbar.hidden = false; profileModal.showModal();
  });
});
document.querySelectorAll('.studio-nav-item').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelector('.studio-nav-item.active').classList.remove('active');
    button.classList.add('active');
    document.querySelector('.studio-page.active').classList.remove('active');
    document.querySelector(`[data-studio-panel="${button.dataset.studioPage}"]`).classList.add('active');
    if (button.dataset.studioPage === 'comments') renderStudioComments();
  });
});

document.querySelector('#studio-back-home').addEventListener('click', () => document.querySelector('#leave-studio').click());
document.querySelector('#studio-back-main').addEventListener('click', () => document.querySelector('#leave-studio').click());
document.querySelector('#studio-return-home').addEventListener('click', () => { window.location.href = 'index.html'; });

function openAuth(view = 'login') {
  authMessage.textContent = location.protocol === 'file:' ? 'Para usar login e cadastro, abra o TunTubes pelo endereço http://127.0.0.1:4174 — não pelo arquivo local.' : '';
  setAuthView(view);
  authModal.showModal();
}

function setAuthView(view) {
  document.querySelectorAll('.auth-tab').forEach((button) => button.classList.toggle('active', button.dataset.authView === view));
  document.querySelector('#login-form').classList.toggle('active', view === 'login');
  document.querySelector('#register-form').classList.toggle('active', view === 'register');
}

function setCurrentUser(user) {
  currentUser = user;
  const signedIn = Boolean(user);
  accountButton.hidden = signedIn;
  openProfile.hidden = !signedIn;
  logoutButton.hidden = !signedIn;
  if (!user) return;
  const initials = user.name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase();
  openProfile.textContent = initials;
  profileInitials.textContent = initials;
  profileName.value = user.name;
  document.querySelector('#studio-profile').textContent = initials;
  document.querySelector('#studio-channel-photo').textContent = initials;
  document.querySelector('#studio-channel-name').textContent = user.name;
  loadSubscriptions();
  syncPublicVideosToSearch();
}

async function authRequest(url, payload) {
  if (location.protocol === 'file:') throw new Error('O login precisa do servidor local. Abra http://127.0.0.1:4174 no navegador.');
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await readApiJson(response);
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
}

accountButton.addEventListener('click', () => openAuth());
document.querySelector('#close-auth').addEventListener('click', () => authModal.close());
document.querySelectorAll('.auth-tab').forEach((button) => button.addEventListener('click', () => { authMessage.textContent = ''; setAuthView(button.dataset.authView); }));

document.querySelector('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  authMessage.textContent = '';
  try {
    const data = await authRequest('/api/auth/login', { email: document.querySelector('#login-email').value, password: document.querySelector('#login-password').value });
    setCurrentUser(data.user); authModal.close(); event.target.reset();
  } catch (error) { authMessage.textContent = error.message; }
});

document.querySelector('#register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  authMessage.textContent = '';
  const password = document.querySelector('#register-password').value;
  if (password !== document.querySelector('#register-confirm-password').value) { authMessage.textContent = 'As senhas não coincidem.'; return; }
  try {
    const data = await authRequest('/api/auth/register', { name: document.querySelector('#register-name').value, email: document.querySelector('#register-email').value, password });
    setCurrentUser(data.user); authModal.close(); event.target.reset();
  } catch (error) { authMessage.textContent = error.message; }
});

logoutButton.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  setCurrentUser(null);
});

fetch('/api/auth/me').then((response) => response.ok ? readApiJson(response) : null).then((data) => setCurrentUser(data?.user || null)).catch(() => setCurrentUser(null));
setInterval(() => { if (!studioView.hidden) loadLiveAnalytics(); }, 3000);
fetch('/api/cloud/status').then((response) => readApiJson(response)).then((data) => {
  cloudStorageEnabled = Boolean(data.configured);
  storageNote.textContent = cloudStorageEnabled
    ? 'Este vídeo será enviado com segurança para sua biblioteca na nuvem e também ficará disponível neste navegador.'
    : 'Seu vídeo será salvo neste navegador até o prazo escolhido. Conecte o armazenamento em nuvem para ativar o backup.';
}).catch(() => { storageNote.textContent = 'Seu vídeo será salvo neste navegador até o prazo escolhido.'; });
renderStudioComments();
if (new URLSearchParams(window.location.search).get('studio') === '1' || window.location.hash === '#studio=1') openStudio();

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelector('.chip.selected').classList.remove('selected');
    chip.classList.add('selected');
  });
});

