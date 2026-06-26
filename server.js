const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5173;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

let multiplayerSnapshot = null;
let multiplayerRevision = 0;
let multiplayerUpdatedAt = null;
const multiplayerPlayers = new Map();
const multiplayerInputs = new Map();

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

function staticHeaders(contentType) {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };
}

function readJsonBody(req, limit = 2_500_000) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error('Payload muito grande'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function cleanPlayerId(raw) {
  return String(raw || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
}

function activePlayers() {
  const now = Date.now();
  const players = [];
  for (const [id, player] of multiplayerPlayers.entries()) {
    const ageSeconds = Math.max(0, (now - player.lastSeen) / 1000);
    if (ageSeconds > 12) {
      multiplayerPlayers.delete(id);
      multiplayerInputs.delete(id);
      continue;
    }
    players.push({
      id,
      nick: player.nick,
      role: player.role,
      chosenColonistId: Number(player.chosenColonistId || 0),
      worldSeed: player.worldSeed,
      colonyName: player.colonyName,
      joinedAt: player.joinedAt,
      lastSeen: new Date(player.lastSeen).toISOString(),
      ageSeconds
    });
  }
  return players.sort((a, b) => (a.role === 'host' ? -1 : 1) - (b.role === 'host' ? -1 : 1) || a.nick.localeCompare(b.nick));
}

function activeInputs() {
  const now = Date.now();
  const inputs = [];
  for (const [id, input] of multiplayerInputs.entries()) {
    const ageSeconds = Math.max(0, (now - input.lastSeen) / 1000);
    if (ageSeconds > 2) {
      multiplayerInputs.delete(id);
      continue;
    }
    inputs.push({ id, keys: input.keys || {}, lastSeen: new Date(input.lastSeen).toISOString(), ageSeconds });
  }
  return inputs;
}

function multiplayerStatus() {
  const updated = multiplayerUpdatedAt ? new Date(multiplayerUpdatedAt).getTime() : 0;
  const ageSeconds = updated ? Math.max(0, (Date.now() - updated) / 1000) : null;
  const online = !!multiplayerSnapshot && ageSeconds !== null && ageSeconds < 8;
  const cfg = multiplayerSnapshot?.config || {};
  const players = activePlayers();
  return {
    ok: true,
    online,
    revision: multiplayerRevision,
    updatedAt: multiplayerUpdatedAt,
    ageSeconds,
    colonyName: cfg.colonyName || null,
    seed: cfg.seed || null,
    day: multiplayerSnapshot?.day || null,
    hour: multiplayerSnapshot?.hour || null,
    colonists: Array.isArray(multiplayerSnapshot?.colonists) ? multiplayerSnapshot.colonists.length : 0,
    wolves: Array.isArray(multiplayerSnapshot?.wolves) ? multiplayerSnapshot.wolves.length : 0,
    players,
    playerCount: players.length
  };
}

function cleanKeys(keys = {}) {
  return {
    up: !!keys.up,
    down: !!keys.down,
    left: !!keys.left,
    right: !!keys.right,
    action: !!keys.action
  };
}

const server = http.createServer(async (req, res) => {
  const safeUrl = decodeURIComponent(req.url.split('?')[0]);

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (safeUrl === '/api/multiplayer/status' && req.method === 'GET') {
    sendJson(res, 200, multiplayerStatus());
    return;
  }

  if (safeUrl === '/api/multiplayer/players' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, players: activePlayers(), status: multiplayerStatus() });
    return;
  }

  if (safeUrl === '/api/multiplayer/players' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req, 32_000);
      const id = cleanPlayerId(body.id);
      if (!id) {
        sendJson(res, 400, { ok: false, error: 'player id ausente' });
        return;
      }
      const nick = String(body.nick || 'Jogador').trim().slice(0, 22) || 'Jogador';
      const role = body.role === 'host' ? 'host' : 'visitante';
      const current = multiplayerPlayers.get(id);
      multiplayerPlayers.set(id, {
        nick,
        role,
        chosenColonistId: Number(body.chosenColonistId || current?.chosenColonistId || 0),
        worldSeed: String(body.worldSeed || multiplayerSnapshot?.config?.seed || '').slice(0, 64),
        colonyName: String(body.colonyName || multiplayerSnapshot?.config?.colonyName || '').slice(0, 64),
        joinedAt: current?.joinedAt || new Date().toISOString(),
        lastSeen: Date.now()
      });
      sendJson(res, 200, { ok: true, players: activePlayers(), status: multiplayerStatus() });
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err.message || 'json inválido' });
    }
    return;
  }

  if (safeUrl === '/api/multiplayer/inputs' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, inputs: activeInputs(), players: activePlayers() });
    return;
  }

  if (safeUrl === '/api/multiplayer/inputs' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req, 32_000);
      const id = cleanPlayerId(body.id);
      if (!id) {
        sendJson(res, 400, { ok: false, error: 'player id ausente' });
        return;
      }
      multiplayerInputs.set(id, { keys: cleanKeys(body.keys), lastSeen: Date.now() });
      sendJson(res, 200, { ok: true, inputs: activeInputs() });
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err.message || 'json inválido' });
    }
    return;
  }

  if (safeUrl === '/api/multiplayer/state' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      revision: multiplayerRevision,
      updatedAt: multiplayerUpdatedAt,
      status: multiplayerStatus(),
      snapshot: multiplayerSnapshot
    });
    return;
  }

  if (safeUrl === '/api/multiplayer/state' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      if (!body || typeof body !== 'object' || !body.snapshot) {
        sendJson(res, 400, { ok: false, error: 'snapshot ausente' });
        return;
      }
      multiplayerSnapshot = body.snapshot;
      multiplayerRevision += 1;
      multiplayerUpdatedAt = new Date().toISOString();
      sendJson(res, 200, { ok: true, revision: multiplayerRevision, updatedAt: multiplayerUpdatedAt, status: multiplayerStatus() });
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err.message || 'json inválido' });
    }
    return;
  }

  let filePath = path.join(ROOT, safeUrl === '/' ? 'index.html' : safeUrl);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(ROOT, 'index.html'), (fallbackErr, fallback) => {
        if (fallbackErr) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, staticHeaders('text/html; charset=utf-8'));
        res.end(fallback);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, staticHeaders(MIME[ext] || 'application/octet-stream'));
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`HavenFall online em http://localhost:${PORT}`);
  console.log('Abra o mesmo endereço público nos dois navegadores e use o menu Online para Hostear ou Entrar.');
});
