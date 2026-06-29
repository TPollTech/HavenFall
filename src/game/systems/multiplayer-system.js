'use strict';

(() => {
  if (window.HavenfallContext?.multiplayerSystemInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.multiplayerSystemInstalled = true;

  const STORE_KEY = 'havenfall-multiplayer-settings';
  const PLAYER_ID_KEY = 'havenfall-multiplayer-player-id';
  const DEFAULT_SERVER = 'http://localhost:5173';
  const PUBLISH_INTERVAL_MS = 650;
  const JOIN_POLL_INTERVAL_MS = 550;
  const PLAYER_HEARTBEAT_MS = 1200;
  const INPUT_SEND_INTERVAL_MS = 90;
  const HOST_INPUT_POLL_MS = 100;

  const session = {
    active: false,
    mode: 'offline',
    serverUrl: '',
    playerId: '',
    nick: '',
    lastRevision: 0,
    lastPublishAt: 0,
    lastPollAt: 0,
    lastHeartbeatAt: 0,
    lastInputAt: 0,
    lastHostInputPollAt: 0,
    statusText: 'Offline',
    players: [],
    inputs: [],
    pendingHostAfterSetup: false,
    keys: { up: false, down: false, left: false, right: false, action: false },
    playerColonistMap: {}
  };

  function now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
  function escapeText(value) { return String(value ?? '').trim(); }
  function randomId() {
    return `p_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
  }

  function settings() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function saveSettings(next) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...settings(), ...next })); }
    catch (_) {}
  }

  function playerId() {
    let id = '';
    try { id = localStorage.getItem(PLAYER_ID_KEY) || ''; } catch (_) {}
    if (!id) {
      id = randomId();
      try { localStorage.setItem(PLAYER_ID_KEY, id); } catch (_) {}
    }
    return id;
  }

  function normalizeServerUrl(raw) {
    let value = escapeText(raw);
    if (!value && location.protocol.startsWith('http')) value = location.origin;
    if (!value || location.protocol === 'file:') value = DEFAULT_SERVER;
    if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
    return value.replace(/\/+$/, '');
  }

  function endpoint(path) {
    return `${session.serverUrl}${path}`;
  }

  async function apiGet(path) {
    const res = await fetch(endpoint(path), { cache: 'no-store' });
    if (!res.ok) throw new Error(`Servidor respondeu ${res.status}`);
    return res.json();
  }

  async function apiPost(path, payload) {
    const res = await fetch(endpoint(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Servidor respondeu ${res.status}`);
    }
    return res.json();
  }

  function currentNick() {
    const input = document.getElementById('multiplayerNickInput');
    return escapeText(input?.value || session.nick || settings().nick || 'Jogador').slice(0, 22) || 'Jogador';
  }

  function currentServerUrl() {
    const input = document.getElementById('multiplayerServerInput');
    return normalizeServerUrl(input?.value || session.serverUrl || settings().serverUrl || '');
  }

  function setStatus(text, kind = 'info') {
    session.statusText = text;
    const box = document.getElementById('multiplayerStatus');
    if (box) {
      box.className = `multiplayer-status ${kind}`;
      box.textContent = text;
    }
    refreshMenu?.();
  }

  function compactClone(value) {
    try { return structuredClone(value); }
    catch (_) { return JSON.parse(JSON.stringify(value)); }
  }

  function compactStateSnapshot() {
    if (!state || state.isPreview || state.runtimeMode === 'menu-preview') return null;
    const snapshot = compactClone(state);
    snapshot.activeTravel = null;
    snapshot.worldMap = null;
    snapshot.sectors = null;
    snapshot.ui = null;
    snapshot.uiDirty = null;
    snapshot.runtimeMode = 'multiplayer-snapshot';
    snapshot.isPreview = false;
    return snapshot;
  }

  function applySnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') throw new Error('Snapshot ausente ou inválido.');
    state = compactClone(snapshot);
    state.isPreview = false;
    state.runtimeMode = 'gameplay';
    activeSession = true;
    selectedColonistId = state.colonists?.[0]?.id || selectedColonistId;
    window.HavenfallRuntime?.markGameplayState?.(state);
    window.HavenfallRuntime?.bumpPathVersion?.(state, 'multiplayer-sync');
    if (typeof ensureExplorationState === 'function') ensureExplorationState();
    if (typeof updateExploration === 'function') updateExploration(true);
    if (typeof centerCameraOnSelectedColonist === 'function') centerCameraOnSelectedColonist();
    if (typeof updateUI === 'function') updateUI(true);
    if (typeof setScreen === 'function') setScreen(SCREEN.PLAYING);
  }

  async function heartbeat(role) {
    const nick = currentNick();
    session.nick = nick;
    const chosen = selectedColonistId || state?.colonists?.[0]?.id || 0;
    const response = await apiPost('/api/multiplayer/players', {
      id: session.playerId,
      nick,
      role,
      chosenColonistId: chosen,
      worldSeed: state?.config?.seed || '',
      colonyName: state?.config?.colonyName || ''
    });
    session.players = response.players || response.status?.players || [];
    saveSettings({ nick, serverUrl: session.serverUrl });
    refreshMenu?.();
    return response;
  }

  async function hostCurrentGame(options = {}) {
    session.serverUrl = currentServerUrl();
    session.playerId = playerId();
    session.nick = currentNick();
    saveSettings({ nick: session.nick, serverUrl: session.serverUrl });
    const snapshot = compactStateSnapshot();
    if (!snapshot) {
      if (options.openSetup) {
        session.pendingHostAfterSetup = true;
        setStatus('Host preparado. Configure a colônia e inicie a partida para publicar o mundo.', 'warn');
        setScreen(SCREEN.NEW_GAME_SETUP);
        return { ok: true, pending: true };
      }
      throw new Error('Inicie uma partida antes de hospedar, ou use “Hospedar novo mundo”.');
    }
    await apiPost('/api/multiplayer/state', { snapshot });
    await heartbeat('host');
    session.active = true;
    session.mode = 'host';
    session.pendingHostAfterSetup = false;
    setStatus(`Hospedando em ${session.serverUrl}. Passe esse endereço para teu amigo.`, 'ok');
    return { ok: true };
  }

  async function hostAfterSetupIfPending() {
    if (!session.pendingHostAfterSetup) return false;
    try {
      await hostCurrentGame({ openSetup: false });
      return true;
    } catch (error) {
      setStatus(`Não consegui iniciar host: ${error.message}`, 'danger');
      return false;
    }
  }

  async function joinGame() {
    session.serverUrl = currentServerUrl();
    session.playerId = playerId();
    session.nick = currentNick();
    saveSettings({ nick: session.nick, serverUrl: session.serverUrl });
    await heartbeat('visitante');
    const payload = await apiGet('/api/multiplayer/state');
    if (!payload?.snapshot) throw new Error('Servidor online, mas sem mundo publicado pelo host.');
    session.active = true;
    session.mode = 'join';
    session.lastRevision = Number(payload.revision || 0);
    session.players = payload.status?.players || [];
    applySnapshot(payload.snapshot);
    setStatus(`Conectado em ${session.serverUrl}.`, 'ok');
    return { ok: true };
  }

  async function stopSession() {
    session.active = false;
    session.mode = 'offline';
    session.pendingHostAfterSetup = false;
    session.inputs = [];
    session.playerColonistMap = {};
    setStatus('Multiplayer parado.', 'info');
  }

  function keyFromEvent(event) {
    const key = event.code || event.key;
    if (key === 'KeyW' || key === 'ArrowUp') return 'up';
    if (key === 'KeyS' || key === 'ArrowDown') return 'down';
    if (key === 'KeyA' || key === 'ArrowLeft') return 'left';
    if (key === 'KeyD' || key === 'ArrowRight') return 'right';
    if (key === 'Space') return 'action';
    return null;
  }

  function handleInputEvent(event, pressed) {
    if (!session.active || session.mode !== 'join') return;
    const key = keyFromEvent(event);
    if (!key) return;
    event.preventDefault();
    event.stopPropagation();
    session.keys[key] = pressed;
  }

  function colonistForPlayer(playerIdValue) {
    const colonists = state?.colonists || [];
    if (!colonists.length) return null;
    const player = session.players.find(p => p.id === playerIdValue);
    if (player?.chosenColonistId) {
      const chosen = colonists.find(c => String(c.id) === String(player.chosenColonistId));
      if (chosen) return chosen;
    }
    if (session.playerColonistMap[playerIdValue]) {
      const mapped = colonists.find(c => String(c.id) === String(session.playerColonistMap[playerIdValue]));
      if (mapped) return mapped;
    }
    const used = new Set(Object.values(session.playerColonistMap).map(String));
    const free = colonists.find(c => !used.has(String(c.id))) || colonists[0];
    session.playerColonistMap[playerIdValue] = free.id;
    return free;
  }

  function applyRemoteInputs(dt = 0.016) {
    if (session.mode !== 'host' || !state) return;
    const tile = typeof TILE !== 'undefined' ? TILE : 48;
    const speed = tile * 4.2;
    for (const input of session.inputs || []) {
      if (!input?.id || input.id === session.playerId) continue;
      const keys = input.keys || {};
      const dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      if (!dx && !dy) continue;
      const c = colonistForPlayer(input.id);
      if (!c) continue;
      const len = Math.hypot(dx, dy) || 1;
      const nextPx = Number(c.px || c.x * tile + tile / 2) + (dx / len) * speed * dt;
      const nextPy = Number(c.py || c.y * tile + tile / 2) + (dy / len) * speed * dt;
      const nextX = Math.round((nextPx - tile / 2) / tile);
      const nextY = Math.round((nextPy - tile / 2) / tile);
      if (typeof isBlocked === 'function' && isBlocked(nextX, nextY, c)) continue;
      window.HavenfallRuntime?.cancelColonistTask?.(c, 'Controlado por jogador online');
      c.px = nextPx;
      c.py = nextPy;
      c.x = nextX;
      c.y = nextY;
      c.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
      c.anim = (Number(c.anim || 0) + dt * 6) % 10;
      c.note = 'Jogador online';
    }
  }

  async function tick() {
    if (!session.active) return;
    const t = now();
    try {
      if (t - session.lastHeartbeatAt > PLAYER_HEARTBEAT_MS) {
        session.lastHeartbeatAt = t;
        await heartbeat(session.mode === 'host' ? 'host' : 'visitante');
      }
      if (session.mode === 'host') {
        if (t - session.lastHostInputPollAt > HOST_INPUT_POLL_MS) {
          session.lastHostInputPollAt = t;
          const payload = await apiGet('/api/multiplayer/inputs');
          session.inputs = payload.inputs || [];
          session.players = payload.players || session.players;
        }
        applyRemoteInputs(0.1);
        if (t - session.lastPublishAt > PUBLISH_INTERVAL_MS) {
          session.lastPublishAt = t;
          const snapshot = compactStateSnapshot();
          if (snapshot) await apiPost('/api/multiplayer/state', { snapshot });
        }
      } else if (session.mode === 'join') {
        if (t - session.lastInputAt > INPUT_SEND_INTERVAL_MS) {
          session.lastInputAt = t;
          await apiPost('/api/multiplayer/inputs', { id: session.playerId, keys: session.keys });
        }
        if (t - session.lastPollAt > JOIN_POLL_INTERVAL_MS) {
          session.lastPollAt = t;
          const payload = await apiGet('/api/multiplayer/state');
          if (payload?.snapshot && Number(payload.revision || 0) !== session.lastRevision) {
            session.lastRevision = Number(payload.revision || 0);
            session.players = payload.status?.players || session.players;
            applySnapshot(payload.snapshot);
          }
        }
      }
    } catch (error) {
      setStatus(`Multiplayer: ${error.message}`, 'danger');
    }
  }

  function refreshMenu() {
    if (typeof window.refreshMultiplayerMenu === 'function') window.refreshMultiplayerMenu();
  }

  window.addEventListener('keydown', event => handleInputEvent(event, true), true);
  window.addEventListener('keyup', event => handleInputEvent(event, false), true);
  window.GameSystems?.registerTick?.('multiplayer', tick, { order: 8, intervalMs: 80 });

  window.HavenfallMultiplayer = Object.freeze({
    session,
    normalizeServerUrl,
    hostCurrentGame,
    hostAfterSetupIfPending,
    joinGame,
    stopSession,
    refreshMenu
  });
})();