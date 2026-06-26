'use strict';

function installMultiplayerFlowAnimationFixPatch() {
  if (window.__havenfallFlowAnimationFixInstalled) return;
  window.__havenfallFlowAnimationFixInstalled = true;

  const lastPos = new Map();
  let lastWorldRev = 0;

  function playerId() {
    let id = localStorage.getItem('havenfall-player-id');
    if (!id) {
      id = `p_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
      localStorage.setItem('havenfall-player-id', id);
    }
    return id;
  }

  function isOnlineActive() {
    return window.havenfallOnlineSessionActive === true;
  }

  function isVisitor() {
    return isOnlineActive() && (window.havenfallOnlineMode === 'join' || sessionStorage.getItem('havenfall-online-mode') === 'join');
  }

  function currentNick() {
    return (localStorage.getItem('havenfall-player-nick') || 'Jogador').trim().slice(0, 22) || 'Jogador';
  }

  function aliveColonists() {
    return (state?.colonists || []).filter(c => !c.dead && !c.downed && (c.health ?? 100) > 0);
  }

  function activePlayers() {
    const rows = Array.from(document.querySelectorAll('.online-player-row'));
    return rows.map((row, index) => ({
      index,
      label: row.querySelector('b')?.textContent?.trim() || `Jogador ${index + 1}`,
      role: row.querySelector('span')?.textContent?.includes('host') ? 'host' : 'visitante'
    }));
  }

  function chosenColonistId() {
    const id = Number(localStorage.getItem(`havenfall-colonist-choice-${playerId()}`) || sessionStorage.getItem(`havenfall-colonist-choice-${playerId()}`));
    if (id && state?.colonists?.some(c => c.id === id && !c.dead && !c.downed)) return id;
    return aliveColonists()[0]?.id || 0;
  }

  function setChosenColonist(id) {
    if (!id) return;
    localStorage.setItem(`havenfall-colonist-choice-${playerId()}`, String(id));
    sessionStorage.setItem(`havenfall-colonist-choice-${playerId()}`, String(id));
    selectedColonistId = Number(id);
    updateUI(true);
    renderColonistPicker();
  }

  function ensureMultiplayerSetupUi() {
    const screen = document.getElementById('onlineScreenClean') || document.getElementById('onlineScreen');
    if (!screen) return;

    let card = document.getElementById('onlineWorldSetupCard');
    if (!card) {
      card = document.createElement('div');
      card.id = 'onlineWorldSetupCard';
      card.className = 'online-players-card online-world-setup-card';
      card.innerHTML = `
        <h3>Mundo multiplayer</h3>
        <p>Prepare a sessão, escolha o nick e selecione o colono que você vai controlar.</p>
        <div class="online-flow-grid">
          <button id="mpCreateWorldBtn" type="button">Criar / Hostear mundo</button>
          <button id="mpJoinWorldBtn" type="button" class="secondary">Entrar no mundo ativo</button>
        </div>
        <div id="mpColonistPicker" class="mp-colonist-picker"><span class="empty">Entre em um mundo para escolher o colono.</span></div>
      `;

      const status = document.getElementById('onlineStatusClean') || document.getElementById('onlineStatusBox');
      status?.insertAdjacentElement('afterend', card);

      document.getElementById('mpCreateWorldBtn')?.addEventListener('click', () => {
        document.getElementById('onlineHostCleanBtn')?.click();
      });
      document.getElementById('mpJoinWorldBtn')?.addEventListener('click', () => {
        document.getElementById('onlineJoinCleanBtn')?.click();
        setTimeout(renderColonistPicker, 900);
      });
    }

    normalizeOnlineLayout();
  }

  function normalizeOnlineLayout() {
    const screen = document.getElementById('onlineScreenClean') || document.getElementById('onlineScreen');
    const card = screen?.querySelector('.online-card, .menu-card');
    if (!screen || !card) return;

    screen.classList.add('online-compact-screen');
    card.classList.add('online-compact-card');

    const oldGrid = screen.querySelector('.online-grid');
    if (oldGrid) oldGrid.classList.add('online-hidden-legacy-actions');

    const status = document.getElementById('onlineStatusClean') || document.getElementById('onlineStatusBox');
    const world = document.getElementById('onlineWorldSetupCard');
    const nick = document.getElementById('onlineNickCard');
    const players = document.getElementById('onlinePlayersCard');
    const share = screen.querySelector('.online-share-box');

    if (status && world && world.previousElementSibling !== status) status.insertAdjacentElement('afterend', world);
    if (world && nick && nick.previousElementSibling !== world) world.insertAdjacentElement('afterend', nick);
    if (nick && players && players.previousElementSibling !== nick) nick.insertAdjacentElement('afterend', players);
    if (players && share && share.previousElementSibling !== players) players.insertAdjacentElement('afterend', share);

    const nickTitle = nick?.querySelector('h3');
    const playersTitle = players?.querySelector('h3');
    if (nickTitle) nickTitle.textContent = 'Nick';
    if (playersTitle) playersTitle.textContent = 'Jogadores';

    const nickText = nick?.querySelector('p');
    if (nickText) nickText.textContent = 'Nome que aparece acima do teu colono.';
  }

  function renderColonistPicker() {
    const holder = document.getElementById('mpColonistPicker');
    if (!holder) return;

    const colonists = aliveColonists();
    if (!colonists.length) {
      holder.innerHTML = '<span class="empty">Nenhum colono vivo disponível neste mundo.</span>';
      return;
    }

    const chosen = chosenColonistId();
    holder.innerHTML = `
      <h4>Escolher teu colono</h4>
      <div class="mp-colonist-grid">
        ${colonists.map(c => `
          <button class="mp-colonist-choice ${c.id === chosen ? 'active' : ''}" data-choose-colonist="${c.id}">
            <b>${escapeHtml(c.name)}</b>
            <small>Vida ${Math.round(c.health || 0)} · Humor ${Math.round(c.mood || 0)}</small>
          </button>
        `).join('')}
      </div>
    `;
  }

  document.addEventListener('click', event => {
    const btn = event.target?.closest?.('[data-choose-colonist]');
    if (!btn) return;
    setChosenColonist(Number(btn.dataset.chooseColonist));
  }, true);

  function nickForColonist(c) {
    if (!isOnlineActive() || !c) return '';
    if (c.id === chosenColonistId()) return currentNick();
    const players = activePlayers();
    const colonists = aliveColonists();
    const index = colonists.findIndex(row => row.id === c.id);
    return players[index]?.label || '';
  }

  function drawNicknameTag(text, x, y) {
    if (!text) return;
    ctx.save();
    ctx.font = '900 11px system-ui';
    ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 12;
    ctx.fillStyle = 'rgba(7,11,17,.74)';
    roundRect(x - w / 2, y - 14, w, 17, 8, true, false);
    ctx.fillStyle = '#9bd36a';
    ctx.fillText(text, x, y - 2);
    ctx.restore();
  }

  const previousDrawColonist = drawColonist;
  drawColonist = function animatedNickDrawColonist(c) {
    const pos = lastPos.get(c.id);
    const moved = pos ? Math.hypot((c.px || 0) - pos.x, (c.py || 0) - pos.y) > 0.35 : false;
    lastPos.set(c.id, { x: c.px || 0, y: c.py || 0 });

    const oldPath = c.path;
    if (moved && (!c.path || !c.path.length)) c.path = [{ x: c.x, y: c.y }];
    previousDrawColonist(c);
    c.path = oldPath;

    drawNicknameTag(nickForColonist(c), c.px, c.py - 56);
  };

  const previousSetScreen = setScreen;
  setScreen = function flowFixSetScreen(screen) {
    previousSetScreen(screen);
    if (screen === 'ONLINE') {
      ensureMultiplayerSetupUi();
      renderColonistPicker();
      normalizeOnlineLayout();
    }
  };

  const previousUpdateUI = updateUI;
  updateUI = function flowFixUpdateUI(force = false) {
    previousUpdateUI(force);
    ensureMultiplayerSetupUi();
    if (appScreen === 'ONLINE') {
      renderColonistPicker();
      normalizeOnlineLayout();
    }
  };

  async function syncPickerFromWorld() {
    if (!isOnlineActive()) return;
    try {
      const res = await fetch('/api/multiplayer/state', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if ((data.revision || 0) !== lastWorldRev) {
        lastWorldRev = data.revision || 0;
        renderColonistPicker();
        normalizeOnlineLayout();
      }
    } catch (_) {}
  }

  function installStyles() {
    if (document.getElementById('multiplayerFlowAnimationStyles')) return;
    const style = document.createElement('style');
    style.id = 'multiplayerFlowAnimationStyles';
    style.textContent = `
      .online-compact-screen {
        overflow: hidden !important;
        padding: 12px !important;
      }
      .online-compact-card {
        width: min(980px, 96vw) !important;
        max-height: 88vh !important;
        overflow: auto !important;
        padding: 16px !important;
        scrollbar-gutter: stable;
      }
      .online-compact-card .screen-title-row {
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 10px;
      }
      .online-compact-card h1 { margin: 2px 0 4px !important; font-size: clamp(26px, 4vw, 42px) !important; }
      .online-compact-card h2,
      .online-compact-card h3,
      .online-compact-card h4 { margin: 0 0 7px !important; }
      .online-compact-card p { margin: 0 0 8px !important; line-height: 1.35 !important; }
      .online-hidden-legacy-actions { display: none !important; }
      .online-players-card,
      .online-status-box,
      .online-share-box {
        margin: 9px 0 !important;
        padding: 11px !important;
      }
      .online-share-box p { display: none !important; }
      .online-flow-grid { display:grid; grid-template-columns:repeat(2,minmax(180px,1fr)); gap:10px; margin-top:8px; }
      .mp-colonist-picker { margin-top:10px; }
      .mp-colonist-picker h4 { margin: 0 0 8px; }
      .mp-colonist-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:8px; max-height: 178px; overflow:auto; padding-right: 3px; }
      .mp-colonist-choice { text-align:left; min-height:56px; padding: 9px !important; }
      .mp-colonist-choice.active { border-color:rgba(155,211,106,.72); box-shadow:0 0 0 2px rgba(155,211,106,.15) inset; }
      .mp-colonist-choice small { display:block; color:rgba(232,241,255,.65); margin-top:4px; }
      #onlinePlayersList.online-players-list,
      .online-players-list { max-height: 150px; overflow:auto; padding-right: 3px; }
      .online-player-row { padding: 7px 9px !important; }
      .online-player-row small { display: none !important; }
      #onlineNickCard .inline-field,
      .online-share-box .inline-field { gap: 8px; }
      #onlineNickInput,
      #onlineShareCleanInput,
      #onlineShareLink { min-height: 36px !important; }
      @media(max-width:720px){
        .online-flow-grid{ grid-template-columns:1fr; }
        .online-compact-card { max-height: 90vh !important; padding: 12px !important; }
        .online-compact-card .screen-title-row { flex-direction: column; }
        .online-compact-card .screen-title-row button { width: 100%; }
      }
    `;
    document.head.appendChild(style);
  }

  installStyles();
  setInterval(syncPickerFromWorld, 1200);
}

if (typeof window !== 'undefined' && typeof drawColonist === 'function') {
  installMultiplayerFlowAnimationFixPatch();
}
