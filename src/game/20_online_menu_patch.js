'use strict';

function installOnlineMenuPatch() {
  const ONLINE_SCREEN = 'ONLINE';
  let statusTimer = null;

  function ensureOnlineScreen() {
    let screen = document.getElementById('onlineScreen');
    if (screen) return screen;

    screen = document.createElement('section');
    screen.id = 'onlineScreen';
    screen.className = 'screen online-screen setup-screen';
    screen.dataset.screen = ONLINE_SCREEN;
    screen.innerHTML = `
      <div class="menu-card wide-card online-card">
        <div class="screen-title-row">
          <div>
            <div class="kicker">Online</div>
            <h1>Multiplayer</h1>
            <p>Hosteie teu mundo ou entre no mundo de alguém pelo link público do túnel.</p>
          </div>
          <button id="onlineBackBtn" class="secondary">Voltar</button>
        </div>

        <div class="online-status-box" id="onlineStatusBox">
          <b>Status:</b> verificando servidor...
        </div>

        <div class="online-grid">
          <div class="online-mode-card">
            <h2>Hostear meu mundo</h2>
            <p>Usa teu save/partida atual como mundo principal. Enquanto tu joga, o servidor publica o estado para quem entrar pelo link.</p>
            <button id="hostCurrentWorldBtn">Hostear / continuar mundo</button>
            <small>Para amigo fora da tua rede, use Cloudflare Tunnel ou outro túnel público.</small>
          </div>

          <div class="online-mode-card">
            <h2>Entrar no mundo do host</h2>
            <p>Se o host já está online, entra em modo join para acompanhar o mundo publicado.</p>
            <button id="joinHostWorldBtn">Entrar como visitante</button>
            <small>Quando estiver em outro PC/cidade, abra o link público com <b>?join=1</b>.</small>
          </div>
        </div>

        <div class="online-help-box">
          <h3>Como mandar para teu primo</h3>
          <ol>
            <li>No teu PC: <code>npm start</code></li>
            <li>Em outro terminal: <code>cloudflared tunnel --url http://localhost:5173</code></li>
            <li>Tu joga no link gerado.</li>
            <li>Teu primo entra no mesmo link com <code>/?join=1</code> no final.</li>
          </ol>
          <div class="inline-field">
            <input id="onlineShareLink" type="text" readonly value="Aguardando link público do túnel...">
            <button id="copyOnlineJoinBtn" type="button" class="secondary">Copiar modelo</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('app').appendChild(screen);
    return screen;
  }

  function ensureOnlineButton() {
    const menu = document.querySelector('.classic-menu-list');
    if (!menu || document.getElementById('openOnlineBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'openOnlineBtn';
    btn.className = 'classic-menu-item';
    btn.textContent = 'Online';
    const settings = document.getElementById('openSettingsBtn');
    menu.insertBefore(btn, settings || null);
  }

  function setOnlineScreen() {
    previousScreen = appScreen;
    appScreen = ONLINE_SCREEN;
    Object.values(dom.screens).forEach(el => el && el.classList.remove('active'));
    ensureOnlineScreen().classList.add('active');
    if (dom.pauseOverlay) dom.pauseOverlay.classList.remove('show');
    if (state) state.paused = true;
    started = false;
    refreshOnlineStatus();
    startOnlineStatusLoop();
  }

  const previousSetScreen = setScreen;
  setScreen = function onlineAwareSetScreen(screen) {
    if (screen === ONLINE_SCREEN) {
      setOnlineScreen();
      return;
    }
    stopOnlineStatusLoop();
    const online = document.getElementById('onlineScreen');
    if (online) online.classList.remove('active');
    previousSetScreen(screen);
  };

  function hostCurrentWorld() {
    const hasRealSession = activeSession && state && state.config?.seed !== 'preview-menu';
    if (hasRealSession) {
      setScreen(SCREEN.PLAYING);
      log('Host online: teu mundo está sendo publicado para visitantes.');
      return;
    }

    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const ok = loadGame();
      if (ok) {
        activeSession = true;
        setScreen(SCREEN.PLAYING);
        log('Host online: save carregado e publicado para visitantes.');
        return;
      }
    }

    writeNewGameConfig({ ...defaultNewGameConfig, seed: generateRandomSeed() });
    setScreen(SCREEN.NEW_GAME_SETUP);
  }

  function joinHostWorld() {
    const url = new URL(window.location.href);
    url.searchParams.set('join', '1');
    window.location.href = url.toString();
  }

  function publicBaseUrl() {
    return `${window.location.origin}${window.location.pathname.replace(/\/?$/, '/')}`;
  }

  function updateShareBox() {
    const input = document.getElementById('onlineShareLink');
    if (!input) return;
    input.value = `${publicBaseUrl()}?join=1`;
  }

  async function copyJoinModel() {
    const link = `${publicBaseUrl()}?join=1`;
    const text = `Entra no meu mundo do HavenFall por esse link: ${link}`;
    try {
      await navigator.clipboard.writeText(text);
      refreshOnlineStatus('Modelo copiado para a área de transferência.');
    } catch (_) {
      refreshOnlineStatus(`Copia esse modelo: ${text}`);
    }
  }

  async function fetchOnlineStatus() {
    const res = await fetch('/api/multiplayer/status', { cache: 'no-store' });
    if (!res.ok) throw new Error('status indisponível');
    return res.json();
  }

  function renderOnlineStatus(data, extra = '') {
    const box = document.getElementById('onlineStatusBox');
    if (!box) return;
    if (!data?.online) {
      box.innerHTML = `<b>Status:</b> nenhum host ativo agora. ${extra ? `<br><span>${escapeHtml(extra)}</span>` : ''}`;
      return;
    }
    const age = Number.isFinite(data.ageSeconds) ? `${Math.round(data.ageSeconds)}s atrás` : 'agora';
    box.innerHTML = `
      <b>Status:</b> host online agora.
      <br><span>Mundo: <b>${escapeHtml(data.colonyName || 'Colônia')}</b> · Dia ${escapeHtml(data.day || '?')} · Seed ${escapeHtml(data.seed || '?')}</span>
      <br><span>Último sinal: ${escapeHtml(age)} · Revisão ${escapeHtml(data.revision || 0)}</span>
      ${extra ? `<br><span>${escapeHtml(extra)}</span>` : ''}
    `;
  }

  async function refreshOnlineStatus(extra = '') {
    ensureOnlineScreen();
    updateShareBox();
    try {
      const data = await fetchOnlineStatus();
      renderOnlineStatus(data, extra);
    } catch (_) {
      const box = document.getElementById('onlineStatusBox');
      if (box) box.innerHTML = `<b>Status:</b> servidor sem módulo online ativo. Rode <code>npm start</code> atualizado.`;
    }
  }

  function startOnlineStatusLoop() {
    stopOnlineStatusLoop();
    statusTimer = setInterval(refreshOnlineStatus, 2000);
  }

  function stopOnlineStatusLoop() {
    if (statusTimer) clearInterval(statusTimer);
    statusTimer = null;
  }

  const previousSetupEventListeners = setupEventListeners;
  setupEventListeners = function onlineSetupEventListeners() {
    previousSetupEventListeners();
    ensureOnlineButton();
    ensureOnlineScreen();

    document.getElementById('openOnlineBtn')?.addEventListener('click', () => setScreen(ONLINE_SCREEN));
    document.getElementById('onlineBackBtn')?.addEventListener('click', () => setScreen(SCREEN.MAIN_MENU));
    document.getElementById('hostCurrentWorldBtn')?.addEventListener('click', hostCurrentWorld);
    document.getElementById('joinHostWorldBtn')?.addEventListener('click', joinHostWorld);
    document.getElementById('copyOnlineJoinBtn')?.addEventListener('click', copyJoinModel);
  };

  function installStyles() {
    if (document.getElementById('onlineMenuStyles')) return;
    const style = document.createElement('style');
    style.id = 'onlineMenuStyles';
    style.textContent = `
      .online-card { max-width: 980px; }
      .online-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(260px, 1fr));
        gap: 12px;
        margin: 14px 0;
      }
      .online-mode-card,
      .online-status-box,
      .online-help-box {
        background: rgba(18,22,31,.68);
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 14px;
        padding: 13px;
      }
      .online-mode-card h2,
      .online-help-box h3 { margin: 0 0 7px; }
      .online-mode-card p,
      .online-mode-card small,
      .online-help-box li,
      .online-status-box span {
        color: rgba(232,241,255,.74);
      }
      .online-mode-card button { width: 100%; margin: 10px 0 6px; }
      .online-help-box code {
        background: rgba(0,0,0,.28);
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 5px;
        padding: 1px 5px;
      }
      #onlineShareLink { min-width: 0; }
      @media (max-width: 760px) {
        .online-grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  installStyles();
  ensureOnlineButton();
  ensureOnlineScreen();
}
