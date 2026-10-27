const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const dataDirectory = path.join(root, '.data');
const usersFile = path.join(dataDirectory, 'users.json');
const socialFile = path.join(dataDirectory, 'social.json');
const sessionsFile = path.join(dataDirectory, 'sessions.json');
const videosFile = path.join(dataDirectory, 'videos.json');
const port = Number(process.env.PORT || 4174);
const envFile = path.join(root, '.env');

if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach((line) => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  });
}
const cloudflareStream = {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  apiToken: process.env.CLOUDFLARE_STREAM_API_TOKEN,
};

if (!fs.existsSync(dataDirectory)) fs.mkdirSync(dataDirectory, { recursive: true });
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, '[]', 'utf8');
if (!fs.existsSync(socialFile)) fs.writeFileSync(socialFile, JSON.stringify({ comments: [], subscriptions: [], likes: [], videoMetrics: {}, videoChannels: {} }, null, 2), 'utf8');
if (!fs.existsSync(sessionsFile)) fs.writeFileSync(sessionsFile, '{}', 'utf8');
if (!fs.existsSync(videosFile)) fs.writeFileSync(videosFile, '[]', 'utf8');

function readUsers() { return JSON.parse(fs.readFileSync(usersFile, 'utf8')); }
function writeUsers(users) { fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf8'); }
function readSocial() { const social = JSON.parse(fs.readFileSync(socialFile, 'utf8')); social.likes ||= []; social.comments ||= []; social.subscriptions ||= []; social.videoMetrics ||= {}; social.videoChannels ||= {}; return social; }
function writeSocial(social) { fs.writeFileSync(socialFile, JSON.stringify(social, null, 2), 'utf8'); }
function readSessions() { try { return JSON.parse(fs.readFileSync(sessionsFile, 'utf8')); } catch { return {}; } }
function writeSessions(sessions) { fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2), 'utf8'); }
function readVideos() { try { return JSON.parse(fs.readFileSync(videosFile, 'utf8')); } catch { return []; } }
function writeVideos(videos) { fs.writeFileSync(videosFile, JSON.stringify(videos, null, 2), 'utf8'); }
function publicUser(user) { return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt }; }
function publicChannel(user) { return { id: user.id, name: user.name, initials: user.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() }; }
function normalizedText(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function matchesSearch(query, values) { const words = normalizedText(query).split(/\s+/).filter(Boolean); const text = normalizedText(values.join(' ')); return words.every((word) => text.includes(word)); }
function initials(name) { return String(name || '').split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) reject(error);
      else resolve({ salt, hash: derivedKey.toString('hex') });
    });
  });
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map((part) => {
    const [key, ...value] = part.trim().split('=');
    return [key, decodeURIComponent(value.join('='))];
  }));
}

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) request.destroy();
    });
    request.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Dados inválidos.')); }
    });
    request.on('error', reject);
  });
}

function getCurrentUser(request) {
  const token = parseCookies(request).tuntubes_session;
  if (!token) return null;
  const sessions = readSessions();
  const session = sessions[token];
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
    if (session) { delete sessions[token]; writeSessions(sessions); }
    return null;
  }
  return readUsers().find((user) => user.id === session.userId) || null;
}

function createSession(user, response) {
  const token = crypto.randomBytes(32).toString('hex');
  const sessions = readSessions();
  sessions[token] = { userId: user.id, expiresAt: new Date(Date.now() + 604800000).toISOString() };
  writeSessions(sessions);
  response.setHeader('Set-Cookie', `tuntubes_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
}

function cloudConfigured() {
  return Boolean(cloudflareStream.accountId && cloudflareStream.apiToken);
}

function serveStatic(request, response) {
  const requestedPath = request.url === '/' ? '/index.html' : request.url.split('?')[0];
  const filePath = path.normalize(path.join(root, requestedPath));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    response.writeHead(404); response.end('Not found'); return;
  }
  const extension = path.extname(filePath);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
  response.writeHead(200, { 'Content-Type': types[extension] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);
    if (request.method === 'GET' && request.url === '/api/auth/me') {
      const user = getCurrentUser(request);
      return sendJson(response, 200, { user: user ? publicUser(user) : null });
    }

    if (request.method === 'POST' && request.url === '/api/auth/register') {
      const { name, email, password } = await readBody(request);
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const normalizedName = String(name || '').trim();
      if (normalizedName.length < 2 || normalizedName.length > 50) return sendJson(response, 400, { error: 'Informe um nome entre 2 e 50 caracteres.' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return sendJson(response, 400, { error: 'Informe um e-mail válido.' });
      if (typeof password !== 'string' || password.length < 8) return sendJson(response, 400, { error: 'A senha deve ter pelo menos 8 caracteres.' });
      const users = readUsers();
      if (users.some((user) => user.email === normalizedEmail)) return sendJson(response, 409, { error: 'Este e-mail já está cadastrado.' });
      const passwordData = await hashPassword(password);
      const user = { id: crypto.randomUUID(), name: normalizedName, email: normalizedEmail, passwordHash: passwordData.hash, passwordSalt: passwordData.salt, createdAt: new Date().toISOString() };
      users.push(user); writeUsers(users); createSession(user, response);
      return sendJson(response, 201, { user: publicUser(user) });
    }

    if (request.method === 'POST' && request.url === '/api/auth/login') {
      const { email, password } = await readBody(request);
      const user = readUsers().find((item) => item.email === String(email || '').trim().toLowerCase());
      if (!user || typeof password !== 'string') return sendJson(response, 401, { error: 'E-mail ou senha incorretos.' });
      const passwordData = await hashPassword(password, user.passwordSalt);
      if (!crypto.timingSafeEqual(Buffer.from(passwordData.hash, 'hex'), Buffer.from(user.passwordHash, 'hex'))) return sendJson(response, 401, { error: 'E-mail ou senha incorretos.' });
      createSession(user, response);
      return sendJson(response, 200, { user: publicUser(user) });
    }

    if (request.method === 'POST' && request.url === '/api/auth/logout') {
      const token = parseCookies(request).tuntubes_session;
      if (token) { const sessions = readSessions(); delete sessions[token]; writeSessions(sessions); }
      return sendJson(response, 200, { ok: true }, { 'Set-Cookie': 'tuntubes_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/search') {
      const term = String(requestUrl.searchParams.get('q') || '').trim();
      if (term.length < 2) return sendJson(response, 200, { channels: [], videos: [] });
      const registered = readUsers().map(publicChannel);
      const channels = registered.filter((channel, index, list) => matchesSearch(term, [channel.name]) && list.findIndex((item) => normalizedText(item.name) === normalizedText(channel.name)) === index).slice(0, 8).map((channel) => ({ ...channel, initials: channel.initials || initials(channel.name) }));
      const searchText = normalizedText(term);
      const videos = readVideos().filter((video) => video.visibility === 'public').filter((video, index, list) => matchesSearch(term, [video.title, video.description, ...(video.tags || []), video.channelName]) && list.findIndex((item) => item.id === video.id && item.channelId === video.channelId) === index).sort((first, second) => {
        const firstTitle = normalizedText(first.title); const secondTitle = normalizedText(second.title);
        return Number(secondTitle === searchText) - Number(firstTitle === searchText) || Number(secondTitle.startsWith(searchText)) - Number(firstTitle.startsWith(searchText)) || firstTitle.localeCompare(secondTitle);
      }).slice(0, 16);
      return sendJson(response, 200, { channels, videos });
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/videos/metadata') {
      const user = getCurrentUser(request);
      if (!user) return sendJson(response, 401, { error: 'Faça login para publicar um vídeo.' });
      const { id, title, description, tags, visibility } = await readBody(request);
      const videoId = String(id || '').trim();
      const videoTitle = String(title || '').trim();
      if (!videoId || !videoTitle) return sendJson(response, 400, { error: 'O vídeo precisa de identificação e título.' });
      const cleanTags = (Array.isArray(tags) ? tags : String(tags || '').split(',')).map((tag) => String(tag).trim()).filter(Boolean).slice(0, 12).map((tag) => tag.slice(0, 40));
      const videos = readVideos();
      const metadata = { id: videoId, title: videoTitle.slice(0, 80), description: String(description || '').trim().slice(0, 300), tags: cleanTags, visibility: visibility || 'public', channelId: user.id, channelName: user.name, updatedAt: new Date().toISOString() };
      const index = videos.findIndex((video) => video.id === videoId && video.channelId === user.id);
      if (index >= 0) videos[index] = metadata; else videos.push(metadata);
      writeVideos(videos);
      return sendJson(response, 201, { video: metadata });
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/subscriptions') {
      const user = getCurrentUser(request);
      if (!user) return sendJson(response, 401, { error: 'Faça login para ver suas inscrições.' });
      const social = readSocial();
      return sendJson(response, 200, { channels: social.subscriptions.filter((subscription) => subscription.userId === user.id).map((subscription) => ({ id: subscription.channelId, name: subscription.channelName || subscription.channelId, initials: (subscription.channelName || subscription.channelId).split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() })) });
    }

    const socialMatch = requestUrl.pathname.match(/^\/api\/videos\/([^/]+)\/social$/);
    if (request.method === 'GET' && socialMatch) {
      const videoId = decodeURIComponent(socialMatch[1]);
      const social = readSocial();
      const comments = social.comments.filter((comment) => comment.videoId === videoId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const metrics = social.videoMetrics[videoId] || { views: 0, clicks: 0 };
      return sendJson(response, 200, { comments, commentCount: comments.length, viewCount: metrics.views, clickCount: metrics.clicks });
    }

    const viewMatch = requestUrl.pathname.match(/^\/api\/videos\/([^/]+)\/view$/);
    if (request.method === 'POST' && viewMatch) {
      const { channelId } = await readBody(request);
      const videoId = decodeURIComponent(viewMatch[1]);
      const social = readSocial();
      social.videoChannels[videoId] = String(channelId || social.videoChannels[videoId] || 'tuntubes');
      const metrics = social.videoMetrics[videoId] ||= { views: 0, clicks: 0 };
      metrics.views += 1;
      metrics.clicks += 1;
      metrics.updatedAt = new Date().toISOString();
      writeSocial(social);
      return sendJson(response, 200, { viewCount: metrics.views, clickCount: metrics.clicks });
    }

    const commentMatch = requestUrl.pathname.match(/^\/api\/videos\/([^/]+)\/comments$/);
    if (request.method === 'POST' && commentMatch) {
      const user = getCurrentUser(request);
      if (!user) return sendJson(response, 401, { error: 'Faça login para comentar.' });
      const { text } = await readBody(request);
      const message = String(text || '').trim();
      if (!message || message.length > 500) return sendJson(response, 400, { error: 'Escreva um comentário de até 500 caracteres.' });
      const social = readSocial();
      const comment = { id: crypto.randomUUID(), videoId: decodeURIComponent(commentMatch[1]), userId: user.id, authorName: user.name, text: message, createdAt: new Date().toISOString() };
      social.comments.push(comment);
      writeSocial(social);
      return sendJson(response, 201, { comment });
    }

    const commentItemMatch = requestUrl.pathname.match(/^\/api\/comments\/([^/]+)$/);
    if (request.method === 'PATCH' && commentItemMatch) {
      const user = getCurrentUser(request);
      if (!user) return sendJson(response, 401, { error: 'Faça login para editar seu comentário.' });
      const { text } = await readBody(request);
      const message = String(text || '').trim();
      if (!message || message.length > 500) return sendJson(response, 400, { error: 'Escreva um comentário de até 500 caracteres.' });
      const social = readSocial();
      const comment = social.comments.find((item) => item.id === decodeURIComponent(commentItemMatch[1]));
      if (!comment) return sendJson(response, 404, { error: 'Comentário não encontrado.' });
      if (comment.userId !== user.id) return sendJson(response, 403, { error: 'Você só pode editar seus próprios comentários.' });
      comment.text = message;
      comment.updatedAt = new Date().toISOString();
      writeSocial(social);
      return sendJson(response, 200, { comment });
    }

    const likesMatch = requestUrl.pathname.match(/^\/api\/videos\/([^/]+)\/likes$/);
    if (request.method === 'GET' && likesMatch) {
      const videoId = decodeURIComponent(likesMatch[1]);
      const social = readSocial();
      const user = getCurrentUser(request);
      const likes = social.likes.filter((like) => like.videoId === videoId);
      return sendJson(response, 200, { likeCount: likes.length, liked: Boolean(user && likes.some((like) => like.userId === user.id)) });
    }

    if (request.method === 'POST' && likesMatch) {
      const user = getCurrentUser(request);
      if (!user) return sendJson(response, 401, { error: 'Faça login para curtir.' });
      const videoId = decodeURIComponent(likesMatch[1]);
      const social = readSocial();
      const index = social.likes.findIndex((like) => like.videoId === videoId && like.userId === user.id);
      const liked = index < 0;
      if (liked) social.likes.push({ videoId, userId: user.id, createdAt: new Date().toISOString() });
      else social.likes.splice(index, 1);
      writeSocial(social);
      return sendJson(response, 200, { liked, likeCount: social.likes.filter((like) => like.videoId === videoId).length });
    }

    const subscribeMatch = requestUrl.pathname.match(/^\/api\/channels\/([^/]+)\/subscribe$/);
    if (request.method === 'POST' && subscribeMatch) {
      const user = getCurrentUser(request);
      if (!user) return sendJson(response, 401, { error: 'Faça login para se inscrever.' });
      const channelId = decodeURIComponent(subscribeMatch[1]);
      const { channelName } = await readBody(request);
      const social = readSocial();
      const index = social.subscriptions.findIndex((subscription) => subscription.channelId === channelId && subscription.userId === user.id);
      const subscribed = index < 0;
      if (subscribed) social.subscriptions.push({ channelId, channelName: String(channelName || channelId).slice(0, 50), userId: user.id, createdAt: new Date().toISOString() });
      else social.subscriptions.splice(index, 1);
      writeSocial(social);
      const subscriberCount = social.subscriptions.filter((subscription) => subscription.channelId === channelId).length;
      return sendJson(response, 200, { subscribed, subscriberCount });
    }

    const channelMatch = requestUrl.pathname.match(/^\/api\/channels\/([^/]+)\/social$/);
    if (request.method === 'GET' && channelMatch) {
      const channelId = decodeURIComponent(channelMatch[1]);
      const social = readSocial();
      const user = getCurrentUser(request);
      const subscriberCount = social.subscriptions.filter((subscription) => subscription.channelId === channelId).length;
      const subscribed = Boolean(user && social.subscriptions.some((subscription) => subscription.channelId === channelId && subscription.userId === user.id));
      return sendJson(response, 200, { subscriberCount, subscribed });
    }

    const analyticsMatch = requestUrl.pathname.match(/^\/api\/analytics\/channels\/([^/]+)$/);
    if (request.method === 'GET' && analyticsMatch) {
      const user = getCurrentUser(request);
      const channelId = decodeURIComponent(analyticsMatch[1]);
      if (!user || user.id !== channelId) return sendJson(response, 401, { error: 'Faça login para ver as métricas do canal.' });
      const social = readSocial();
      const videoIds = Object.keys(social.videoChannels).filter((videoId) => social.videoChannels[videoId] === channelId);
      const totalViews = videoIds.reduce((total, videoId) => total + (social.videoMetrics[videoId]?.views || 0), 0);
      const totalClicks = videoIds.reduce((total, videoId) => total + (social.videoMetrics[videoId]?.clicks || 0), 0);
      const totalLikes = social.likes.filter((like) => videoIds.includes(like.videoId)).length;
      const totalComments = social.comments.filter((comment) => videoIds.includes(comment.videoId)).length;
      const subscriberCount = social.subscriptions.filter((subscription) => subscription.channelId === channelId).length;
      return sendJson(response, 200, { totalViews, totalClicks, totalLikes, totalComments, subscriberCount, updatedAt: new Date().toISOString() });
    }

    if (request.method === 'GET' && request.url === '/api/cloud/status') {
      return sendJson(response, 200, { provider: 'cloudflare-stream', configured: cloudConfigured() });
    }

    if (request.method === 'POST' && request.url === '/api/cloud/direct-upload') {
      if (!getCurrentUser(request)) return sendJson(response, 401, { error: 'Faça login para enviar vídeos.' });
      if (!cloudConfigured()) return sendJson(response, 503, { error: 'O Cloudflare Stream ainda não foi configurado neste servidor.' });
      const cloudflareResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareStream.accountId}/stream/direct_upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cloudflareStream.apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiry: new Date(Date.now() + 60 * 60 * 1000).toISOString() }),
      });
      const cloudflareData = await cloudflareResponse.json();
      if (!cloudflareResponse.ok || !cloudflareData.success) return sendJson(response, 502, { error: 'O Cloudflare não criou um link de envio.', details: cloudflareData.errors });
      return sendJson(response, 200, { uploadURL: cloudflareData.result.uploadURL, uid: cloudflareData.result.uid });
    }

    serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, { error: error.message || 'Não foi possível concluir a operação.' });
  }
});

server.listen(port, () => console.log(`TunTubes disponível em http://127.0.0.1:${port}`));

