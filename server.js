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

const server = http.createServer(async (req, res) => {
  const safeUrl = decodeURIComponent(req.url.split('?')[0]);

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (safeUrl === '/api/multiplayer/state' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      revision: multiplayerRevision,
      updatedAt: multiplayerUpdatedAt,
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
      sendJson(res, 200, { ok: true, revision: multiplayerRevision, updatedAt: multiplayerUpdatedAt });
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
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fallback);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`HavenFall rodando em http://localhost:${PORT}`);
  console.log(`LAN: abra http://SEU-IP-LOCAL:${PORT} no outro PC. Espectador: http://SEU-IP-LOCAL:${PORT}/?join=1`);
});
