'use strict';

function installMultiplayerLobbyPatch() {
  if (window.__havenfallMultiplayerLobbyInstalled) return;
  window.__havenfallMultiplayerLobbyInstalled = true;

  let statusTimer = null;
  let lastRevisionSeen = 0;

  function mpRole() {
    return sessionStorage.getItem('havenfall-online-mode') === 'join' || window.havenfallOnlineMode === 'join' ? 'visitante' : 'host';
  }

  function sessionUrl() {
    return `${window.location.origin}${window.location.pathname.replace(/\/?$/, '/')}`;
  }

  function statusBox() {
    return document.getElementById('onlineStatusClean') || document.getElementById('onlineStatusBox');
  }

  function setOnlineStatus(html) {
    const box = statusBox();
    if (box) box.innerHTML = html;
  }

  function worldLabel(data) {
    if (!data?.online) return 'Nenhum mundo publicado neste link';
    const age = Number.isFinite(data.ageSeconds) ? `${Math.round(data.ageSeconds)}s` : 'agora';
    return `${data.colonyName || 'Colônia'} · Dia ${data.day || '?'} · Seed ${data.seed || '?'} · rev ${data.revision || 0} · ${age}`;
  }

  function sameWorldHint(data) {
    if (!data?.online) return 'Peça para o host abrir o mundo e deixar a partida rodando.';
    return 'Se vocês estão vendo este mesmo nome, seed e revisão subindo, estão no mesmo mundo.';
  }

  async function fetchStatus() {
    const res = await fetch('/api/multiplayer/status', { cache: 'no-store' });
    if (!res.ok) throw new Error('status indisponível');
    return res.json();
  }

  async function refreshLobbyStatus() {
    const input = document.getElementById('onlineShareCleanInput') || document.getElementById('onlineShareLink');
    if (input) input.value = sessionUrl();

    try {
      const data = await fetchStatus();
      lastRevisionSeen = data.revision || lastRevisionSeen;
      setOnlineStatus(`
        <b>Status:</b> ${data.online ? 'mundo online disponível neste link.' : 'nenhum mundo ativo neste link.'}
        <br><span><b>Mundo:</b> ${escapeHtml(worldLabel(data))}</span>
        <br><span><b>Você está como:</b> ${escapeHtml(mpRole())}</span>
        <br><span>${escapeHtml(sameWorldHint(data))}</span>
      `);
      updateFloatingSessionBadge(data);
      return data;
    } catch (_) {
      setOnlineStatus('<b>Status:</b> este link não está respondendo como servidor multiplayer.');
      updateFloatingSessionBadge(null);
      return null;
    }
  }

  function ensureBadge() {
    let badge = document.getElementById('onlineWorldBadge');
    if (badge) return badge;
    badge = document.createElement('div');
    badge.id = 'onlineWorldBadge';
    badge.className = 'online-world-badge';
    document.body.appendChild(badge);
    return badge;
  }

  function updateFloatingSessionBadge(data) {
    const badge = ensureBadge();
    if (appScreen !== SCREEN.PLAYING) {
      badge.classList.remove('show');
      return;
    }
    badge.classList.add('show');
    if (!data?.online) {
      badge.innerHTML = `<b>${escapeHtml(mpRole().toUpperCase())}</b><span>sem mundo publicado neste link</span>`;
      return;
    }
    const role = mpRole() === 'visitante' ? 'VISITANTE' : 'HOST';
    badge.innerHTML = `<b>${role}</b><span>${escapeHtml(data.colonyName || 'Colônia')} · Dia ${escapeHtml(data.day || '?')} · rev ${escapeHtml(data.revision || 0)}</span>`;
  }

  async function joinOnlyIfHostExists(event) {
    const btn = event.target?.closest?.('#onlineJoinCleanBtn, #joinHostWorldBtn');
    if (!btn) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const data = await refreshLobbyStatus();
    if (!data?.online) {
      setOnlineStatus(`
        <b>Status:</b> não existe mundo publicado neste link agora.
        <br><span>Vocês precisam abrir exatamente o mesmo link de sessão. O host deve clicar em <b>Hostear / continuar</b> e ficar jogando.</span>
      `);
      return;
    }

    sessionStorage.setItem('havenfall-online-mode', 'join');
    window.havenfallOnlineMode = 'join';
    setOnlineStatus(`
      <b>Status:</b> entrando no mundo publicado.
      <br><span><b>Mundo:</b> ${escapeHtml(worldLabel(data))}</span>
    `);
    window.havenfallJoinOnline?.();
  }

  async function hostWithVisibleStatus(event) {
    const btn = event.target?.closest?.('#onlineHostCleanBtn, #hostCurrentWorldBtn');
    if (!btn) return;
    setTimeout(async () => {
      const data = await refreshLobbyStatus();
      if (!data?.online && appScreen === SCREEN.PLAYING) {
        setOnlineStatus('<b>Status:</b> host iniciado. O mundo aparece aqui assim que a primeira sincronização for publicada.');
      }
    }, 700);
  }

  function installStyles() {
    if (document.getElementById('multiplayerLobbyPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'multiplayerLobbyPatchStyles';
    style.textContent = `
      .online-world-badge {
        position: fixed;
        left: 14px;
        top: 14px;
        z-index: 85;
        display: none;
        max-width: min(440px, calc(100vw - 28px));
        padding: 8px 11px;
        border-radius: 14px;
        background: rgba(7, 11, 17, .78);
        border: 1px solid rgba(255,255,255,.12);
        color: #eaf6ff;
        font: 800 12px system-ui;
        box-shadow: 0 12px 28px rgba(0,0,0,.24);
      }
      .online-world-badge.show { display: flex; align-items: center; gap: 9px; }
      .online-world-badge b {
        color: #9bd36a;
        letter-spacing: .08em;
      }
      .online-world-badge span {
        color: rgba(232,241,255,.78);
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
    `;
    document.head.appendChild(style);
  }

  const previousSetup = setupEventListeners;
  setupEventListeners = function multiplayerLobbySetupListeners() {
    previousSetup();
    document.addEventListener('click', joinOnlyIfHostExists, true);
    document.addEventListener('click', hostWithVisibleStatus, true);
  };

  const previousSetScreen = setScreen;
  setScreen = function multiplayerLobbySetScreen(screen) {
    previousSetScreen(screen);
    if (screen === 'ONLINE') {
      refreshLobbyStatus();
      if (statusTimer) clearInterval(statusTimer);
      statusTimer = setInterval(refreshLobbyStatus, 1500);
    } else if (screen !== SCREEN.PLAYING) {
      if (statusTimer) clearInterval(statusTimer);
      statusTimer = null;
      document.getElementById('onlineWorldBadge')?.classList.remove('show');
    }
  };

  const previousUpdateUI = updateUI;
  updateUI = function multiplayerLobbyUpdateUI(force = false) {
    previousUpdateUI(force);
    if (appScreen === SCREEN.PLAYING && Date.now() % 1500 < 80) refreshLobbyStatus();
  };

  installStyles();
}

if (typeof window !== 'undefined' && typeof setupEventListeners === 'function') {
  installMultiplayerLobbyPatch();
}
