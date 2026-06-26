'use strict';

function installMultiplayerPlayersPatch() {
  if (window.__havenfallPlayersPatchInstalled) return;
  window.__havenfallPlayersPatchInstalled = true;

  let heartbeatTimer = null;
  let listTimer = null;

  function playerId() {
    let id = localStorage.getItem('havenfall-player-id');
    if (!id) {
      id = `p_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
      localStorage.setItem('havenfall-player-id', id);
    }
    return id;
  }

  function defaultNick() {
    return `Jogador ${playerId().slice(-4).toUpperCase()}`;
  }

  function nick() {
    return (localStorage.getItem('havenfall-player-nick') || defaultNick()).trim().slice(0, 22) || defaultNick();
  }

  function chosenColonistId() {
    const id = playerId();
    return Number(localStorage.getItem(`havenfall-colonist-choice-${id}`) || sessionStorage.getItem(`havenfall-colonist-choice-${id}`) || 0);
  }

  function setNick(value) {
    const cleaned = String(value || '').trim().slice(0, 22) || defaultNick();
    localStorage.setItem('havenfall-player-nick', cleaned);
    const input = document.getElementById('onlineNickInput');
    if (input && input.value !== cleaned) input.value = cleaned;
    sendHeartbeat();
  }

  function role() {
    return sessionStorage.getItem('havenfall-online-mode') === 'join' || window.havenfallOnlineMode === 'join' ? 'visitante' : 'host';
  }

  function ensurePlayersUi() {
    const screen = document.getElementById('onlineScreenClean') || document.getElementById('onlineScreen');
    if (!screen) return;

    if (!document.getElementById('onlineNickCard')) {
      const card = document.createElement('div');
      card.id = 'onlineNickCard';
      card.className = 'online-players-card';
      card.innerHTML = `
        <h3>Identidade online</h3>
        <p>Escolha o nome que vai aparecer para quem está neste mundo.</p>
        <div class="inline-field">
          <input id="onlineNickInput" type="text" maxlength="22" placeholder="Teu nick">
          <button id="saveOnlineNickBtn" class="secondary" type="button">Salvar</button>
        </div>
      `;
      const statusBox = document.getElementById('onlineStatusClean') || document.getElementById('onlineStatusBox');
      statusBox?.insertAdjacentElement('afterend', card);
      document.getElementById('onlineNickInput').value = nick();
      document.getElementById('saveOnlineNickBtn').addEventListener('click', () => setNick(document.getElementById('onlineNickInput').value));
      document.getElementById('onlineNickInput').addEventListener('change', event => setNick(event.target.value));
    }

    if (!document.getElementById('onlinePlayersCard')) {
      const card = document.createElement('div');
      card.id = 'onlinePlayersCard';
      card.className = 'online-players-card';
      card.innerHTML = `
        <h3>Jogadores neste mundo</h3>
        <div id="onlinePlayersList" class="online-players-list"><span class="empty">Verificando jogadores...</span></div>
      `;
      const grid = screen.querySelector('.online-grid') || screen.querySelector('.menu-card');
      grid?.insertAdjacentElement('afterend', card);
    }
  }

  async function sendHeartbeat() {
    try {
      const payload = {
        id: playerId(),
        nick: nick(),
        role: role(),
        chosenColonistId: chosenColonistId(),
        worldSeed: state?.config?.seed || '',
        colonyName: state?.config?.colonyName || ''
      };
      const res = await fetch('/api/multiplayer/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        renderPlayers(data.players || []);
      }
    } catch (_) {
      renderPlayers(null);
    }
  }

  async function refreshPlayers() {
    ensurePlayersUi();
    try {
      const res = await fetch('/api/multiplayer/players', { cache: 'no-store' });
      if (!res.ok) throw new Error('players');
      const data = await res.json();
      renderPlayers(data.players || []);
    } catch (_) {
      renderPlayers(null);
    }
  }

  function renderPlayers(players) {
    const list = document.getElementById('onlinePlayersList');
    if (!list) return;

    if (!players) {
      list.innerHTML = '<span class="empty">Lista de jogadores indisponível neste servidor.</span>';
      return;
    }

    if (!players.length) {
      list.innerHTML = '<span class="empty">Nenhum jogador reconhecido ainda.</span>';
      return;
    }

    const myId = playerId();
    list.innerHTML = players.map(p => {
      const me = p.id === myId;
      const age = Number.isFinite(p.ageSeconds) ? `${Math.round(p.ageSeconds)}s` : 'agora';
      const colono = p.chosenColonistId ? ` · colono #${p.chosenColonistId}` : '';
      return `
        <div class="online-player-row ${me ? 'me' : ''}">
          <b>${escapeHtml(p.nick || 'Jogador')}</b>
          <span>${escapeHtml(p.role || 'visitante')}${me ? ' · você' : ''}${escapeHtml(colono)}</span>
          <small>${escapeHtml(p.colonyName || p.worldSeed || 'sem mundo')} · ${escapeHtml(age)}</small>
        </div>
      `;
    }).join('');
  }

  function ensureFloatingPlayers(players) {
    let panel = document.getElementById('onlinePlayersFloating');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'onlinePlayersFloating';
      panel.className = 'online-players-floating';
      document.body.appendChild(panel);
    }
    if (appScreen !== SCREEN.PLAYING || !players?.length) {
      panel.classList.remove('show');
      return;
    }
    panel.classList.add('show');
    panel.innerHTML = `<b>Online</b>${players.slice(0, 4).map(p => `<span>${escapeHtml(p.nick || 'Jogador')}</span>`).join('')}`;
  }

  function loadPatch(src, marker) {
    if (window[marker]) return;
    if (document.querySelector(`script[src="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    document.body.appendChild(script);
  }

  function installStyles() {
    if (document.getElementById('multiplayerPlayersStyles')) return;
    const style = document.createElement('style');
    style.id = 'multiplayerPlayersStyles';
    style.textContent = `
      .online-players-card {
        background: rgba(18,22,31,.68);
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 14px;
        padding: 13px;
        margin: 12px 0;
      }
      .online-players-card h3 { margin: 0 0 6px; }
      .online-players-card p { color: rgba(232,241,255,.72); margin: 0 0 10px; }
      .online-players-list { display: grid; gap: 8px; }
      .online-player-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 2px 8px;
        align-items: center;
        border: 1px solid rgba(255,255,255,.09);
        background: rgba(255,255,255,.04);
        border-radius: 12px;
        padding: 9px 10px;
      }
      .online-player-row.me {
        border-color: rgba(155,211,106,.46);
        box-shadow: 0 0 0 2px rgba(155,211,106,.09) inset;
      }
      .online-player-row span { color: #9bd36a; font-size: 12px; font-weight: 900; }
      .online-player-row small { grid-column: 1 / -1; color: rgba(232,241,255,.62); }
      .online-players-floating {
        position: fixed;
        left: 14px;
        top: 54px;
        z-index: 84;
        display: none;
        gap: 6px;
        align-items: center;
        max-width: min(520px, calc(100vw - 28px));
        padding: 7px 10px;
        border-radius: 999px;
        background: rgba(7,11,17,.72);
        border: 1px solid rgba(255,255,255,.10);
        color: rgba(232,241,255,.82);
        font: 800 12px system-ui;
      }
      .online-players-floating.show { display: flex; }
      .online-players-floating b { color: #9bd36a; }
      .online-players-floating span {
        max-width: 110px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  const previousSetScreen = setScreen;
  setScreen = function playersSetScreen(screen) {
    previousSetScreen(screen);
    if (screen === 'ONLINE') {
      ensurePlayersUi();
      refreshPlayers();
      if (listTimer) clearInterval(listTimer);
      listTimer = setInterval(refreshPlayers, 2000);
    } else if (screen !== SCREEN.PLAYING) {
      if (listTimer) clearInterval(listTimer);
      listTimer = null;
    }
  };

  const previousUpdateUI = updateUI;
  updateUI = function playersUpdateUI(force = false) {
    previousUpdateUI(force);
    if (appScreen === SCREEN.PLAYING && Date.now() % 1800 < 80) {
      fetch('/api/multiplayer/players', { cache: 'no-store' })
        .then(res => res.ok ? res.json() : null)
        .then(data => ensureFloatingPlayers(data?.players || []))
        .catch(() => ensureFloatingPlayers(null));
    }
  };

  installStyles();
  loadPatch('src/game/26_multiplayer_host_publish_fix.js', '__havenfallHostPublishFixInstalled');
  loadPatch('src/game/27_multiplayer_control_patch.js', '__havenfallMultiplayerControlInstalled');
  setNick(nick());
  sendHeartbeat();
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(sendHeartbeat, 1800);
}

if (typeof window !== 'undefined' && typeof setupEventListeners === 'function') {
  installMultiplayerPlayersPatch();
}
