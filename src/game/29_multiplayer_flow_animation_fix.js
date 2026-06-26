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

  function isHost() {
    return isOnlineActive() && !isVisitor();
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
    if (!screen || document.getElementById('onlineWorldSetupCard')) return;

    const card = document.createElement('div');
    card.id = 'onlineWorldSetupCard';
    card.className = 'online-players-card online-world-setup-card';
    card.innerHTML = `
      <h3>Mundo multiplayer</h3>
      <p>Use essa área para preparar o host ou entrar escolhendo teu sobrevivente.</p>
      <div class="online-flow-grid">
        <button id="mpCreateWorldBtn" type="button">Criar/Hostear mundo</button>
        <button id="mpJoinWorldBtn" type="button" class="secondary">Entrar no mundo ativo</button>
      </div>
      <div id="mpColonistPicker" class="mp-colonist-picker"><span class="empty">Entre em um mundo para escolher o colono.</span></div>
    `;

    const grid = screen.querySelector('.online-grid') || screen.querySelector('.menu-card');
    grid?.insertAdjacentElement('afterend', card);

    document.getElementById('mpCreateWorldBtn')?.addEventListener('click', () => {
      document.getElementById('onlineHostCleanBtn')?.click();
    });
    document.getElementById('mpJoinWorldBtn')?.addEventListener('click', () => {
      document.getElementById('onlineJoinCleanBtn')?.click();
      setTimeout(renderColonistPicker, 900);
    });
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
    }
  };

  const previousUpdateUI = updateUI;
  updateUI = function flowFixUpdateUI(force = false) {
    previousUpdateUI(force);
    ensureMultiplayerSetupUi();
    if (appScreen === 'ONLINE') renderColonistPicker();
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
      }
    } catch (_) {}
  }

  function installStyles() {
    if (document.getElementById('multiplayerFlowAnimationStyles')) return;
    const style = document.createElement('style');
    style.id = 'multiplayerFlowAnimationStyles';
    style.textContent = `
      .online-flow-grid { display:grid; grid-template-columns:repeat(2,minmax(180px,1fr)); gap:10px; margin-top:10px; }
      .mp-colonist-picker { margin-top:12px; }
      .mp-colonist-picker h4 { margin: 0 0 8px; }
      .mp-colonist-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:8px; }
      .mp-colonist-choice { text-align:left; min-height:62px; }
      .mp-colonist-choice.active { border-color:rgba(155,211,106,.72); box-shadow:0 0 0 2px rgba(155,211,106,.15) inset; }
      .mp-colonist-choice small { display:block; color:rgba(232,241,255,.65); margin-top:4px; }
      @media(max-width:720px){ .online-flow-grid{ grid-template-columns:1fr; } }
    `;
    document.head.appendChild(style);
  }

  installStyles();
  setInterval(syncPickerFromWorld, 1200);
}

if (typeof window !== 'undefined' && typeof drawColonist === 'function') {
  installMultiplayerFlowAnimationFixPatch();
}
