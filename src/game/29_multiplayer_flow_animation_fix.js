'use strict';

function installMultiplayerFlowAnimationFixPatch() {
  if (window.__havenfallFlowAnimationFixInstalled) return;
  window.__havenfallFlowAnimationFixInstalled = true;

  const lastPos = new Map();
  let layoutNormalized = false;
  let lastNormalizeAt = 0;

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

  function currentNick() {
    return (localStorage.getItem('havenfall-player-nick') || 'Jogador').trim().slice(0, 22) || 'Jogador';
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
        <p>Cada jogador entra como um colono próprio. O nick escolhido vira o nome exibido em cima do personagem.</p>
        <div class="online-flow-grid">
          <button id="mpCreateWorldBtn" type="button">Criar / Hostear mundo</button>
          <button id="mpJoinWorldBtn" type="button" class="secondary">Entrar no mundo ativo</button>
        </div>
        <div class="mp-auto-colonist-note">Seu colono é criado automaticamente ao entrar no mundo.</div>
      `;

      const status = document.getElementById('onlineStatusClean') || document.getElementById('onlineStatusBox');
      status?.insertAdjacentElement('afterend', card);

      document.getElementById('mpCreateWorldBtn')?.addEventListener('click', () => {
        document.getElementById('onlineHostCleanBtn')?.click();
      });
      document.getElementById('mpJoinWorldBtn')?.addEventListener('click', () => {
        document.getElementById('onlineJoinCleanBtn')?.click();
      });
      layoutNormalized = false;
    }

    const picker = document.getElementById('mpColonistPicker');
    if (picker) picker.remove();
    normalizeOnlineLayout();
  }

  function normalizeOnlineLayout(force = false) {
    const now = Date.now();
    if (!force && layoutNormalized && now - lastNormalizeAt < 1000) return;
    lastNormalizeAt = now;

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
    if (nickTitle && nickTitle.textContent !== 'Nick') nickTitle.textContent = 'Nick';
    if (playersTitle && playersTitle.textContent !== 'Jogadores') playersTitle.textContent = 'Jogadores';

    const nickText = nick?.querySelector('p');
    if (nickText && nickText.textContent !== 'Nome que aparece acima do teu colono.') nickText.textContent = 'Nome que aparece acima do teu colono.';

    layoutNormalized = true;
  }

  function nickForColonist(c) {
    if (!isOnlineActive() || !c) return '';
    if (c.playerNick) return c.playerNick;
    if (c.playerId === playerId()) return currentNick();
    return '';
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
      layoutNormalized = false;
      ensureMultiplayerSetupUi();
      normalizeOnlineLayout(true);
    }
  };

  const previousUpdateUI = updateUI;
  updateUI = function flowFixUpdateUI(force = false) {
    previousUpdateUI(force);
    if (appScreen !== 'ONLINE') return;
    ensureMultiplayerSetupUi();
    normalizeOnlineLayout(false);
  };

  function installStyles() {
    if (document.getElementById('multiplayerFlowAnimationStyles')) return;
    const style = document.createElement('style');
    style.id = 'multiplayerFlowAnimationStyles';
    style.textContent = `
      .online-compact-screen { overflow: hidden !important; padding: 12px !important; }
      .online-compact-card { width: min(980px, 96vw) !important; max-height: 88vh !important; overflow: auto !important; padding: 16px !important; scrollbar-gutter: stable; }
      .online-compact-card .screen-title-row { align-items: flex-start; gap: 12px; margin-bottom: 10px; }
      .online-compact-card h1 { margin: 2px 0 4px !important; font-size: clamp(26px, 4vw, 42px) !important; }
      .online-compact-card h2, .online-compact-card h3, .online-compact-card h4 { margin: 0 0 7px !important; }
      .online-compact-card p { margin: 0 0 8px !important; line-height: 1.35 !important; }
      .online-hidden-legacy-actions { display: none !important; }
      .online-players-card, .online-status-box, .online-share-box { margin: 9px 0 !important; padding: 11px !important; }
      .online-share-box p { display: none !important; }
      .online-flow-grid { display:grid; grid-template-columns:repeat(2,minmax(180px,1fr)); gap:10px; margin-top:8px; }
      .mp-auto-colonist-note { margin-top: 9px; padding: 9px 10px; border-radius: 12px; background: rgba(155,211,106,.08); border: 1px solid rgba(155,211,106,.18); color: rgba(232,241,255,.72); font-size: 12px; font-weight: 800; }
      #onlinePlayersList.online-players-list, .online-players-list { max-height: 150px; overflow:auto; padding-right: 3px; }
      .online-player-row { padding: 7px 9px !important; }
      .online-player-row small { display: none !important; }
      #onlineNickCard .inline-field, .online-share-box .inline-field { gap: 8px; }
      #onlineNickInput, #onlineShareCleanInput, #onlineShareLink { min-height: 36px !important; }
      @media(max-width:720px){ .online-flow-grid{ grid-template-columns:1fr; } .online-compact-card { max-height: 90vh !important; padding: 12px !important; } .online-compact-card .screen-title-row { flex-direction: column; } .online-compact-card .screen-title-row button { width: 100%; } }
    `;
    document.head.appendChild(style);
  }

  installStyles();
}

if (typeof window !== 'undefined' && typeof drawColonist === 'function') {
  installMultiplayerFlowAnimationFixPatch();
}
