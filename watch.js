const query = new URLSearchParams(location.search);
const video = { id: query.get('id') || 'video', title: query.get('title') || 'Vídeo no TunTubes', channel: query.get('channel') || 'TunTubes', channelId: query.get('channelId') || 'tuntubes', local: query.get('local') === '1' };
const recommendations = [
  { id: 'fim-de-tarde', title: 'Um fim de tarde que parecia filme', channel: 'Marina Campos', channelId: 'marina-campos', className: 'rec-sunset' },
  { id: 'programar-do-zero', title: 'Como comecei a programar do zero', channel: 'Lucas Dev', channelId: 'lucas-dev', className: 'rec-code' },
  { id: 'aventura-cooperativa', title: 'Aventura cooperativa com a galera', channel: 'Game Room', channelId: 'game-room', className: 'rec-game' },
  { id: 'rotina-criativa', title: 'Rotina criativa: sem pressa, sem filtro', channel: 'Ana Lins', channelId: 'ana-lins', className: 'rec-coffee' },
];
let user = null;

document.querySelector('#watch-title').textContent = video.title;
document.querySelector('#watch-channel-name').textContent = video.channel;
document.querySelector('#watch-channel-avatar').textContent = video.channel.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
document.title = `${video.title} — TunTubes`;

function formatCount(count, noun) { return `${count} ${count === 1 ? noun : `${noun}s`}`; }
function formatViews(count) { return `${count} ${count === 1 ? 'visualização' : 'visualizações'}`; }
function initials(name) { return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }
async function readApiJson(response) { const text = await response.text(); try { return JSON.parse(text); } catch { throw new Error('O servidor do TunTubes não respondeu. Abra o projeto pelo servidor da aplicação.'); } }

function showAuth(view = 'login') { authMessage(location.protocol === 'file:' ? 'Abra esta página pelo TunTubes em http://127.0.0.1:4174 para entrar e participar.' : ''); document.querySelector('#watch-auth-modal').showModal(); setAuthView(view); }
function setAuthView(view) { document.querySelectorAll('[data-watch-auth-view]').forEach((button) => button.classList.toggle('active', button.dataset.watchAuthView === view)); document.querySelector('#watch-login-form').classList.toggle('active', view === 'login'); document.querySelector('#watch-register-form').classList.toggle('active', view === 'register'); }
function authMessage(message = '') { document.querySelector('#watch-auth-message').textContent = message; }
async function authRequest(url, payload) { if (location.protocol === 'file:') throw new Error('O login precisa do servidor local. Abra o TunTubes em http://127.0.0.1:4174.'); const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const data = await readApiJson(response); if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.'); return data; }
async function refreshUser() { if (location.protocol === 'file:') return null; try { const response = await fetch('/api/auth/me'); const data = response.ok ? await readApiJson(response) : null; user = data?.user || null; return user; } catch { user = null; return null; } }
async function requireUser() { if (user || await refreshUser()) return true; showAuth(); return false; }

async function loadSocial() {
  const [commentsResponse, channelResponse, likesResponse] = await Promise.all([fetch(`/api/videos/${encodeURIComponent(video.id)}/social`), fetch(`/api/channels/${encodeURIComponent(video.channelId)}/social`), fetch(`/api/videos/${encodeURIComponent(video.id)}/likes`)]);
  const [comments, channel, likes] = await Promise.all([readApiJson(commentsResponse), readApiJson(channelResponse), readApiJson(likesResponse)]);
  document.querySelector('#watch-comment-count').textContent = comments.commentCount || 0;
  document.querySelector('#watch-views').textContent = formatViews(comments.viewCount || 0);
  document.querySelector('#watch-subscribers').textContent = formatCount(channel.subscriberCount || 0, 'inscrito');
  const subscribe = document.querySelector('#watch-subscribe'); subscribe.textContent = channel.subscribed ? 'Inscrito' : 'Inscrever-se'; subscribe.classList.toggle('subscribed', Boolean(channel.subscribed));
  const like = document.querySelector('#like-button'); like.innerHTML = `${likes.liked ? '♥' : '♡'} <span>${likes.liked ? 'Curtido' : 'Curtir'} · ${likes.likeCount || 0}</span>`; like.classList.toggle('liked', Boolean(likes.liked));
  const list = document.querySelector('#watch-comment-list'); list.innerHTML = '';
  if (!comments.comments?.length) { list.innerHTML = '<p class="comments-empty">Seja a primeira pessoa a comentar.</p>'; return; }
  comments.comments.forEach((comment) => list.append(createCommentElement(comment)));
}

function createCommentElement(comment) {
  const item = document.createElement('article');
  item.className = 'video-comment';
  const header = document.createElement('div');
  header.className = 'comment-header';
  const author = document.createElement('strong');
  const date = document.createElement('small');
  author.textContent = comment.authorName;
  date.textContent = `${new Date(comment.createdAt).toLocaleString('pt-BR')}${comment.updatedAt ? ' · editado' : ''}`;
  header.append(author, date);
  const text = document.createElement('p');
  text.textContent = comment.text;
  item.append(header, text);
  if (user?.id === comment.userId) {
    const actions = document.createElement('div');
    actions.className = 'comment-actions';
    const edit = document.createElement('button');
    edit.type = 'button'; edit.textContent = 'Editar';
    edit.addEventListener('click', () => startCommentEdit(item, comment, text, actions));
    actions.append(edit); item.append(actions);
  }
  return item;
}

function startCommentEdit(item, comment, text, actions) {
  const editor = document.createElement('textarea');
  editor.className = 'comment-editor'; editor.maxLength = 500; editor.value = comment.text;
  const save = document.createElement('button'); save.type = 'button'; save.textContent = 'Salvar';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancelar';
  text.replaceWith(editor); actions.replaceChildren(save, cancel);
  cancel.addEventListener('click', () => loadSocial());
  save.addEventListener('click', async () => {
    const value = editor.value.trim(); if (!value) return;
    const response = await fetch(`/api/comments/${encodeURIComponent(comment.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: value }) });
    const data = await readApiJson(response);
    if (!response.ok) return alert(data.error || 'Não foi possível editar o comentário.');
    loadSocial();
  });
}

async function loadLocalVideo() { if (!video.local) return; const request = indexedDB.open('tuntubes-library', 1); request.onsuccess = () => { const get = request.result.transaction('videos').objectStore('videos').get(video.id); get.onsuccess = () => { if (!get.result?.file) return; const player = document.querySelector('#watch-video'); player.src = URL.createObjectURL(get.result.file); player.hidden = false; document.querySelector('#watch-placeholder').hidden = true; }; }; }
async function recordView() { try { const response = await fetch(`/api/videos/${encodeURIComponent(video.id)}/view`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channelId: video.channelId }) }); const data = await readApiJson(response); if (response.ok) document.querySelector('#watch-views').textContent = formatViews(data.viewCount); } catch {} }
function renderRecommendations() { const list = document.querySelector('#recommendation-list'); recommendations.filter((item) => item.id !== video.id).forEach((item) => { const card = document.createElement('a'); card.className = 'recommendation-card'; card.href = `watch.html?${new URLSearchParams({ id: item.id, title: item.title, channel: item.channel, channelId: item.channelId })}`; card.target = '_blank'; card.rel = 'noopener'; card.innerHTML = `<div class="recommendation-thumb ${item.className}">▶</div><div><h3></h3><p></p><small>Recomendado para você</small></div>`; card.querySelector('h3').textContent = item.title; card.querySelector('p').textContent = item.channel; list.append(card); }); }

document.querySelector('#watch-subscribe').addEventListener('click', async () => { if (!await requireUser()) return; const response = await fetch(`/api/channels/${encodeURIComponent(video.channelId)}/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channelName: video.channel }) }); if (!response.ok) { user = null; return requireUser(); } loadSocial(); });
document.querySelector('#like-button').addEventListener('click', async () => { if (!await requireUser()) return; const response = await fetch(`/api/videos/${encodeURIComponent(video.id)}/likes`, { method: 'POST' }); if (!response.ok) { user = null; return requireUser(); } loadSocial(); });
document.querySelector('#watch-comment-form').addEventListener('submit', async (event) => { event.preventDefault(); if (!await requireUser()) return; const input = document.querySelector('#watch-comment-text'); const text = input.value.trim(); if (!text) return; try { const response = await fetch(`/api/videos/${encodeURIComponent(video.id)}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }); const data = await readApiJson(response); if (!response.ok) { user = null; return requireUser(); } input.value = ''; const list = document.querySelector('#watch-comment-list'); list.querySelector('.comments-empty')?.remove(); list.prepend(createCommentElement(data.comment)); document.querySelector('#watch-comment-count').textContent = Number(document.querySelector('#watch-comment-count').textContent || 0) + 1; } catch (error) { authMessage(error.message); } });
document.querySelector('#share-button').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); document.querySelector('#share-button').textContent = '✓ Link copiado'; } catch { document.querySelector('#share-button').textContent = 'Copie o endereço da página'; } });
document.querySelector('#watch-close-auth').addEventListener('click', () => document.querySelector('#watch-auth-modal').close());
document.querySelectorAll('[data-watch-auth-view]').forEach((button) => button.addEventListener('click', () => { authMessage(); setAuthView(button.dataset.watchAuthView); }));
document.querySelector('#watch-login-form').addEventListener('submit', async (event) => { event.preventDefault(); try { const data = await authRequest('/api/auth/login', { email: document.querySelector('#watch-login-email').value, password: document.querySelector('#watch-login-password').value }); user = data.user; document.querySelector('#watch-auth-modal').close(); loadSocial(); } catch (error) { authMessage(error.message); } });
document.querySelector('#watch-register-form').addEventListener('submit', async (event) => { event.preventDefault(); const password = document.querySelector('#watch-register-password').value; if (password !== document.querySelector('#watch-register-confirm').value) return authMessage('As senhas não coincidem.'); try { const data = await authRequest('/api/auth/register', { name: document.querySelector('#watch-register-name').value, email: document.querySelector('#watch-register-email').value, password }); user = data.user; document.querySelector('#watch-auth-modal').close(); loadSocial(); } catch (error) { authMessage(error.message); } });
refreshUser().then(() => { recordView(); loadSocial(); });
loadLocalVideo(); renderRecommendations();

