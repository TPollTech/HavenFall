'use strict';

function installMultiplayerControlPatch() {
  if (window.__havenfallMultiplayerControlInstalled) return;
  window.__havenfallMultiplayerControlInstalled = true;

  const localKeys = new Set();
  let remoteInputs = new Map();
  let playersCache = [];
  let inputTimer = null;
  let commandTimer = null;

  function playerId() {
    let id = localStorage.getItem('havenfall-player-id');
    if (!id) {
      id = `p_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
      localStorage.setItem('havenfall-player-id', id);
    }
    return id;
  }

  function isVisitor() {
    return window.havenfallOnlineSessionActive === true && (sessionStorage.getItem('havenfall-online-mode') === 'join' || window.havenfallOnlineMode === 'join');
  }

  function isHost() {
    return window.havenfallOnlineSessionActive === true && !isVisitor();
  }

  function isOnlineActive() {
    return window.havenfallOnlineSessionActive === true;
  }

  function keyStateFromSet(set) {
    return {
      up: set.has('KeyW') || set.has('ArrowUp'),
      down: set.has('KeyS') || set.has('ArrowDown'),
      left: set.has('KeyA') || set.has('ArrowLeft'),
      right: set.has('KeyD') || set.has('ArrowRight'),
      action: set.has('Space')
    };
  }

  function activePlayers() {
    return (playersCache || []).filter(p => p?.id).sort((a, b) => {
      const ar = a.role === 'host' ? -1 : 1;
      const br = b.role === 'host' ? -1 : 1;
      return ar - br || String(a.nick || '').localeCompare(String(b.nick || ''));
    });
  }

  function aliveColonists() {
    return (state?.colonists || []).filter(c => !c.dead && !c.downed && (c.health ?? 100) > 0);
  }

  function chosenColonistIdFor(id) {
    const saved = sessionStorage.getItem(`havenfall-colonist-choice-${id}`) || localStorage.getItem(`havenfall-colonist-choice-${id}`);
    const numeric = Number(saved);
    if (numeric && state?.colonists?.some(c => c.id === numeric && !c.dead && !c.downed)) return numeric;
    return 0;
  }

  function assignmentMap() {
    const players = activePlayers();
    const colonists = aliveColonists();
    const used = new Set();
    const map = new Map();

    for (const p of players) {
      const chosen = chosenColonistIdFor(p.id);
      if (chosen && !used.has(chosen)) {
        map.set(p.id, chosen);
        used.add(chosen);
      }
    }

    for (const p of players) {
      if (map.has(p.id)) continue;
      const free = colonists.find(c => !used.has(c.id));
      if (free) {
        map.set(p.id, free.id);
        used.add(free.id);
      }
    }
    return map;
  }

  function myColonist() {
    const map = assignmentMap();
    const id = map.get(playerId()) || chosenColonistIdFor(playerId());
    return state?.colonists?.find(c => c.id === id) || null;
  }

  function inputForPlayer(id) {
    if (id === playerId()) return keyStateFromSet(localKeys);
    return remoteInputs.get(id)?.keys || {};
  }

  function moveControlledColonist(c, keys, tick, label) {
    if (!c || c.dead || c.downed) return;

    let dx = 0;
    let dy = 0;
    if (keys.up) dy -= 1;
    if (keys.down) dy += 1;
    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;

    c.task = null;
    c.path = [];
    c.work = 0;
    c.note = label ? `Controlado por ${label}` : 'Controle online';

    if (!dx && !dy) return;

    const len = Math.hypot(dx, dy) || 1;
    const speed = 88 * (c.energy < 20 ? 0.72 : 1) * (c.mood < 20 ? 0.84 : 1);
    const nextPx = c.px + (dx / len) * speed * tick;
    const nextPy = c.py + (dy / len) * speed * tick;
    const nextX = Math.round((nextPx - TILE / 2) / TILE);
    const nextY = Math.round((nextPy - TILE / 2) / TILE);
    const oldX = Math.round((c.px - TILE / 2) / TILE);
    const oldY = Math.round((c.py - TILE / 2) / TILE);

    if ((nextX === oldX && nextY === oldY) || !isBlocked(nextX, nextY)) {
      c.px = nextPx;
      c.py = nextPy;
    }

    if (Math.abs(dx) > Math.abs(dy)) c.dir = dx > 0 ? 'right' : 'left';
    else c.dir = dy > 0 ? 'down' : 'up';

    c.x = Math.round((c.px - TILE / 2) / TILE);
    c.y = Math.round((c.py - TILE / 2) / TILE);
  }

  async function sendInput() {
    if (!isOnlineActive()) return;
    try {
      await fetch('/api/multiplayer/inputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: playerId(), keys: keyStateFromSet(localKeys) })
      });
    } catch (_) {}
  }

  async function fetchRemoteInputs() {
    if (!isHost()) return;
    try {
      const res = await fetch('/api/multiplayer/inputs', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      playersCache = data.players || playersCache;
      remoteInputs = new Map((data.inputs || []).map(input => [input.id, input]));
    } catch (_) {}
  }

  async function refreshPlayersCache() {
    try {
      const res = await fetch('/api/multiplayer/players', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      playersCache = data.players || playersCache;
    } catch (_) {}
  }

  function updateControlBadge() {
    let badge = document.getElementById('onlineControlBadge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'onlineControlBadge';
      badge.className = 'online-control-badge';
      document.body.appendChild(badge);
    }

    if (appScreen !== SCREEN.PLAYING || !isOnlineActive()) {
      badge.classList.remove('show');
      return;
    }

    const c = myColonist();
    badge.classList.add('show');
    badge.innerHTML = `<b>${isVisitor() ? 'VISITANTE' : 'HOST'}</b><span>Teu colono: ${escapeHtml(c?.name || 'aguardando escolha')}</span>`;
  }

  function installStyles() {
    if (document.getElementById('multiplayerControlStyles')) return;
    const style = document.createElement('style');
    style.id = 'multiplayerControlStyles';
    style.textContent = `
      .online-control-badge {
        position: fixed;
        right: 14px;
        top: 54px;
        z-index: 86;
        display: none;
        align-items: center;
        gap: 8px;
        max-width: min(420px, calc(100vw - 28px));
        padding: 8px 11px;
        border-radius: 999px;
        background: rgba(7,11,17,.76);
        border: 1px solid rgba(255,255,255,.12);
        color: rgba(232,241,255,.86);
        font: 900 12px system-ui;
        box-shadow: 0 12px 28px rgba(0,0,0,.24);
      }
      .online-control-badge.show { display: flex; }
      .online-control-badge b { color: #9bd36a; letter-spacing: .08em; }
      .online-control-badge span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    `;
    document.head.appendChild(style);
  }

  const previousUpdateColonist = updateColonist;
  updateColonist = function multiplayerControlledUpdateColonist(c, dt) {
    if (!state || state.gameOver || !isOnlineActive() || !activeSession) return previousUpdateColonist(c, dt);

    const players = activePlayers();
    const map = assignmentMap();
    const owner = players.find(p => map.get(p.id) === c.id);

    if (!owner) {
      c.anim += dt * state.speed;
      c.note = 'Sem jogador online';
      c.task = null;
      c.path = [];
      c.work = 0;
      c.x = Math.round((c.px - TILE / 2) / TILE);
      c.y = Math.round((c.py - TILE / 2) / TILE);
      return;
    }

    if (isHost()) {
      const tick = dt * state.speed;
      c.anim += tick;
      c.hunger = clamp(c.hunger - tick * 0.12, 0, 100);
      c.energy = clamp(c.energy - tick * 0.06, 0, 100);
      c.mood = clamp(c.mood - tick * 0.015, 0, 100);
      moveControlledColonist(c, inputForPlayer(owner.id), tick, owner.nick);
      return;
    }

    c.note = owner.id === playerId() ? 'Teu colono online' : `Controlado por ${owner.nick || 'jogador'}`;
    c.x = Math.round((c.px - TILE / 2) / TILE);
    c.y = Math.round((c.py - TILE / 2) / TILE);
  };

  const previousUpdateCamera = updateCamera;
  updateCamera = function multiplayerControlCamera(dt) {
    const c = myColonist();
    if (appScreen === SCREEN.PLAYING && isOnlineActive() && c) {
      camera.x += ((c.px || c.x * TILE) - camera.x) * Math.min(1, dt * 8);
      camera.y += ((c.py || c.y * TILE) - camera.y) * Math.min(1, dt * 8);
      clampCamera();
      return;
    }
    previousUpdateCamera(dt);
  };

  const previousUpdateUI = updateUI;
  updateUI = function multiplayerControlUpdateUI(force = false) {
    previousUpdateUI(force);
    updateControlBadge();
  };

  window.addEventListener('keydown', event => {
    if (!['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','Space'].includes(event.code)) return;
    if (appScreen !== SCREEN.PLAYING || !isOnlineActive()) return;
    localKeys.add(event.code);
    event.preventDefault();
  }, true);

  window.addEventListener('keyup', event => {
    localKeys.delete(event.code);
  }, true);

  const previousHostOnline = window.havenfallHostOnline;
  window.havenfallHostOnline = function multiplayerControlHostOnline() {
    window.havenfallOnlineSessionActive = true;
    window.havenfallOnlineMode = 'host';
    sessionStorage.setItem('havenfall-online-mode', 'host');
    const result = previousHostOnline?.apply(this, arguments);
    refreshPlayersCache();
    return result;
  };

  const previousJoinOnline = window.havenfallJoinOnline;
  window.havenfallJoinOnline = function multiplayerControlJoinOnline() {
    window.havenfallOnlineSessionActive = true;
    window.havenfallOnlineMode = 'join';
    sessionStorage.setItem('havenfall-online-mode', 'join');
    const result = previousJoinOnline?.apply(this, arguments);
    sendInput();
    refreshPlayersCache();
    return result;
  };

  installStyles();
  refreshPlayersCache();
  if (inputTimer) clearInterval(inputTimer);
  inputTimer = setInterval(sendInput, 90);
  if (commandTimer) clearInterval(commandTimer);
  commandTimer = setInterval(() => { fetchRemoteInputs(); refreshPlayersCache(); }, 180);
}

if (typeof window !== 'undefined' && typeof updateColonist === 'function') {
  installMultiplayerControlPatch();
}
