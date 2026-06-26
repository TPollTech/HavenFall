'use strict';

function installMultiplayerLobbyPatch() {
  if (window.__havenfallMultiplayerLobbyInstalled) return;
  window.__havenfallMultiplayerLobbyInstalled = true;

  let statusTimer = null;
  let craftToastTimer = null;
  let lastStatusHtml = '';
  let lastBadgeHtml = '';

  function playerId() {
    let id = localStorage.getItem('havenfall-player-id');
    if (!id) {
      id = `p_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
      localStorage.setItem('havenfall-player-id', id);
    }
    return id;
  }

  function currentNick() {
    return (localStorage.getItem('havenfall-player-nick') || `Jogador ${playerId().slice(-4).toUpperCase()}`).trim().slice(0, 22) || 'Jogador';
  }

  function saveNick(value) {
    const cleaned = String(value || '').trim().slice(0, 22) || `Jogador ${playerId().slice(-4).toUpperCase()}`;
    localStorage.setItem('havenfall-player-nick', cleaned);
    const online = document.getElementById('onlineNickInput');
    const setup = document.getElementById('mpSetupNickInput');
    if (online && online.value !== cleaned) online.value = cleaned;
    if (setup && setup.value !== cleaned) setup.value = cleaned;
    return cleaned;
  }

  function setMpFlow(mode = null) {
    window.havenfallMultiplayerSetupFlow = mode;
    if (mode) sessionStorage.setItem('havenfall-mp-flow', mode);
    else sessionStorage.removeItem('havenfall-mp-flow');
  }

  function mpFlow() {
    return window.havenfallMultiplayerSetupFlow || sessionStorage.getItem('havenfall-mp-flow') || null;
  }

  function isMpHostSetup() {
    return mpFlow() === 'host-setup';
  }

  function mpRole() {
    return window.havenfallOnlineSessionActive === true && (sessionStorage.getItem('havenfall-online-mode') === 'join' || window.havenfallOnlineMode === 'join') ? 'visitante' : 'host';
  }

  function sessionUrl() {
    return `${window.location.origin}${window.location.pathname.replace(/\/?$/, '/')}`;
  }

  function statusBox() {
    return document.getElementById('onlineStatusClean') || document.getElementById('onlineStatusBox');
  }

  function setOnlineStatus(html) {
    const box = statusBox();
    if (!box || lastStatusHtml === html) return;
    lastStatusHtml = html;
    box.innerHTML = html;
  }

  function worldLabel(data) {
    if (!data?.online) return 'Nenhum mundo publicado neste link';
    const age = Number.isFinite(data.ageSeconds) ? `${Math.round(data.ageSeconds)}s` : 'agora';
    return `${data.colonyName || 'Colônia'} · Dia ${data.day || '?'} · Seed ${data.seed || '?'} · rev ${data.revision || 0} · ${age}`;
  }

  function sameWorldHint(data) {
    if (!data?.online) return 'Crie um mundo multiplayer primeiro ou peça para o host publicar a sessão.';
    return 'Cada jogador ativo vira um colono próprio dentro desse mesmo mundo.';
  }

  async function fetchStatus() {
    const res = await fetch('/api/multiplayer/status', { cache: 'no-store' });
    if (!res.ok) throw new Error('status indisponível');
    return res.json();
  }

  async function refreshLobbyStatus() {
    const input = document.getElementById('onlineShareCleanInput') || document.getElementById('onlineShareLink');
    const url = sessionUrl();
    if (input && input.value !== url) input.value = url;

    try {
      const data = await fetchStatus();
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
    const role = mpRole() === 'visitante' ? 'VISITANTE' : 'HOST';
    const html = data?.online
      ? `<b>${role}</b><span>${escapeHtml(data.colonyName || 'Colônia')} · Dia ${escapeHtml(data.day || '?')} · rev ${escapeHtml(data.revision || 0)}</span>`
      : `<b>${role}</b><span>publicando mundo...</span>`;
    if (lastBadgeHtml !== html) {
      lastBadgeHtml = html;
      badge.innerHTML = html;
    }
  }

  function setTitleText(screenId, data) {
    const screen = document.getElementById(screenId);
    if (!screen) return;
    const kicker = screen.querySelector('.kicker');
    const h1 = screen.querySelector('h1');
    const p = screen.querySelector('.screen-title-row p');
    if (kicker && data.kicker) kicker.textContent = data.kicker;
    if (h1 && data.title) h1.textContent = data.title;
    if (p && data.text) p.textContent = data.text;
  }

  function colonistCountLabel() {
    return document.getElementById('colonistCountSelect')?.closest('label') || null;
  }

  function ensureMpSetupNickBox() {
    const setupScreen = document.getElementById('newGameSetupScreen');
    const form = setupScreen?.querySelector('.form-grid');
    if (!setupScreen || !form) return;

    let box = document.getElementById('mpSetupNickBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'mpSetupNickBox';
      box.className = 'mp-setup-box';
      box.innerHTML = `
        <div>
          <b>Identidade online</b>
          <span>No multiplayer, cada jogador entra como um colono independente. O host começa com este nick e visitantes criam o próprio colono ao entrar.</span>
        </div>
        <label>Teu nick
          <input id="mpSetupNickInput" type="text" maxlength="22" placeholder="Teu nick">
        </label>
      `;
      form.insertAdjacentElement('afterend', box);
      box.querySelector('#mpSetupNickInput')?.addEventListener('input', e => saveNick(e.target.value));
      box.querySelector('#mpSetupNickInput')?.addEventListener('change', e => saveNick(e.target.value));
    }
    const input = box.querySelector('#mpSetupNickInput');
    if (input && !input.value) input.value = currentNick();
  }

  function applySetupMode() {
    const setupScreen = document.getElementById('newGameSetupScreen');
    if (!setupScreen) return;
    const next = document.getElementById('setupNextBtn');
    const back = document.getElementById('setupBackBtn');
    const box = document.getElementById('mpSetupNickBox');
    const countLabel = colonistCountLabel();

    if (!isMpHostSetup()) {
      setupScreen.classList.remove('multiplayer-setup-mode');
      setTitleText('newGameSetupScreen', {
        kicker: 'Novo jogo',
        title: 'Configuração da Colônia',
        text: 'Configure a partida. A geração procedural real por seed fica preparada estruturalmente para as próximas versões.'
      });
      if (next) next.textContent = 'Continuar para Seleção de Colonos';
      if (back) back.textContent = 'Voltar';
      if (box) box.hidden = true;
      if (countLabel) countLabel.hidden = false;
      updateSetupSummaryBase();
      return;
    }

    setupScreen.classList.add('multiplayer-setup-mode');
    ensureMpSetupNickBox();
    document.getElementById('mpSetupNickBox')?.removeAttribute('hidden');
    if (countLabel) countLabel.hidden = true;
    document.getElementById('colonistCountSelect').value = '1';
    setTitleText('newGameSetupScreen', {
      kicker: 'Multiplayer',
      title: 'Criar Mundo Online',
      text: 'Configure o mundo online. A quantidade de colonos não é fixa: cada jogador que entrar terá seu próprio colono controlável.'
    });
    if (next) next.textContent = 'Criar Mundo e Hostear';
    if (back) back.textContent = 'Voltar ao Online';
    updateSetupSummaryBase();
  }

  function applyColonistMode() {
    if (isMpHostSetup()) return;
    const start = document.getElementById('startSelectedGameBtn');
    const back = document.getElementById('colonistBackBtn');
    setTitleText('colonistSelectScreen', {
      kicker: 'Seleção de colonos',
      title: 'Escolha quem vai começar',
      text: 'Rerole colonos individuais, trave os que gostar e inicie a partida com a configuração escolhida.'
    });
    if (start) start.textContent = 'Iniciar Partida';
    if (back) back.textContent = 'Voltar';
    document.getElementById('colonistSelectScreen')?.classList.remove('multiplayer-setup-mode');
  }

  const previousUpdateSetupSummary = updateSetupSummary;
  function updateSetupSummaryBase() {
    previousUpdateSetupSummary();
    if (!isMpHostSetup() || !dom.setupSummary) return;
    const cfg = readNewGameConfigSafe();
    dom.setupSummary.innerHTML = `
      <b>Resumo multiplayer:</b> ${escapeHtml(cfg.colonyName)} · Seed <b>${escapeHtml(cfg.seed || 'será gerada')}</b> · mapa ${labelMapSize(cfg.mapSize)} · eventos ${labelEventIntensity(cfg.eventIntensity)}.
      <br><span class="muted-inline">Host: <b>${escapeHtml(currentNick())}</b>. Ao iniciar, você vira o primeiro colono. Cada visitante que entrar pelo mesmo link cria/assume um colono próprio.</span>
    `;
  }
  updateSetupSummary = updateSetupSummaryBase;

  function makePlayerCandidate(config, nick, id) {
    const candidate = createColonistCandidate(0, config, `${config.seed}-player-${id}`);
    candidate.name = nick;
    candidate.role = 'Faz-tudo';
    candidate.workPreference = 'Coleta';
    return candidate;
  }

  function bindHostColonist() {
    if (!state?.colonists?.length) return;
    const c = state.colonists[0];
    c.name = currentNick();
    c.playerId = playerId();
    c.playerNick = currentNick();
    c.onlineControlled = true;
    selectedColonistId = c.id;
    localStorage.setItem(`havenfall-colonist-choice-${playerId()}`, String(c.id));
    sessionStorage.setItem(`havenfall-colonist-choice-${playerId()}`, String(c.id));
  }

  function beginMultiplayerHostSetup() {
    setMpFlow('host-setup');
    sessionStorage.removeItem('havenfall-online-mode');
    window.havenfallOnlineMode = 'host';
    window.havenfallOnlineSessionActive = false;
    saveNick(currentNick());
    writeNewGameConfig({ ...defaultNewGameConfig, colonyName: 'First Haven Online', seed: generateRandomSeed(), colonistCount: 1 });
    setScreen(SCREEN.NEW_GAME_SETUP);
    setTimeout(applySetupMode, 0);
  }

  function handleSetupNext(event) {
    if (!isMpHostSetup()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const nick = saveNick(document.getElementById('mpSetupNickInput')?.value || currentNick());
    const config = { ...readNewGameConfig(), colonistCount: 1, multiplayer: true, onlineRole: 'host', hostNick: nick };
    const hostCandidate = makePlayerCandidate(config, nick, playerId());
    startNewGame(config, [hostCandidate]);
    state.config.multiplayer = true;
    state.config.onlineRole = 'host';
    state.config.hostNick = nick;
    bindHostColonist();
    window.havenfallOnlineSessionActive = true;
    window.havenfallOnlineMode = 'host';
    sessionStorage.setItem('havenfall-online-mode', 'host');
    window.havenfallAllowManualHostStart?.();
    window.havenfallHostOnline?.();
    setMpFlow(null);
    setTimeout(() => window.havenfallForcePublishWorld?.('multiplayer-host-start'), 250);
    setTimeout(() => window.havenfallForcePublishWorld?.('multiplayer-host-start'), 900);
    updateUI(true);
  }

  function handleStartMultiplayer(event) {
    if (!isMpHostSetup()) return;
    handleSetupNext(event);
  }

  function handleSetupBack(event) {
    if (!isMpHostSetup()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setMpFlow(null);
    applySetupMode();
    setScreen('ONLINE');
  }

  function handleNormalNewGame() {
    setMpFlow(null);
    window.havenfallOnlineSessionActive = false;
    applySetupMode();
    applyColonistMode();
  }

  function showCraftToast(message) {
    const overlay = document.getElementById('stationOverlayClean');
    if (!overlay || !overlay.classList.contains('show')) return;
    let toast = document.getElementById('stationCraftToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'stationCraftToast';
      toast.className = 'station-craft-toast';
      overlay.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    if (craftToastTimer) clearTimeout(craftToastTimer);
    craftToastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function stationCraftFeedback(event) {
    const btn = event.target?.closest?.('[data-station-craft]');
    if (!btn || btn.disabled) return;
    const label = btn.querySelector('b')?.textContent?.trim() || 'Receita';
    setTimeout(() => showCraftToast(`Pedido enviado: ${label}`), 0);
  }

  function loadPlayersPatch() {
    if (window.__havenfallPlayersPatchInstalled) return;
    if (document.querySelector('script[src="src/game/24_multiplayer_players_patch.js"]')) return;
    const script = document.createElement('script');
    script.src = 'src/game/24_multiplayer_players_patch.js';
    document.body.appendChild(script);
  }

  async function joinOnlyIfHostExists(event) {
    const btn = event.target?.closest?.('#onlineJoinCleanBtn, #joinHostWorldBtn, #mpJoinWorldBtn');
    if (!btn) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const data = await refreshLobbyStatus();
    if (!data?.online) {
      setOnlineStatus(`
        <b>Status:</b> não existe mundo publicado neste link agora.
        <br><span>O host precisa criar o mundo em <b>Criar / Hostear mundo</b> e manter a partida aberta.</span>
      `);
      return;
    }

    setMpFlow(null);
    sessionStorage.setItem('havenfall-online-mode', 'join');
    window.havenfallOnlineMode = 'join';
    window.havenfallOnlineSessionActive = true;
    setOnlineStatus(`
      <b>Status:</b> entrando no mundo publicado.
      <br><span><b>Mundo:</b> ${escapeHtml(worldLabel(data))}</span>
      <br><span>Seu colono será criado automaticamente com o nick escolhido.</span>
    `);
    window.havenfallJoinOnline?.();
  }

  function hostSetupClick(event) {
    const btn = event.target?.closest?.('#onlineHostCleanBtn, #hostCurrentWorldBtn, #mpCreateWorldBtn');
    if (!btn) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    beginMultiplayerHostSetup();
  }

  function installStyles() {
    if (document.getElementById('multiplayerLobbyPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'multiplayerLobbyPatchStyles';
    style.textContent = `
      .online-world-badge { position: fixed; left: 14px; top: 14px; z-index: 85; display: none; max-width: min(440px, calc(100vw - 28px)); padding: 8px 11px; border-radius: 14px; background: rgba(7, 11, 17, .78); border: 1px solid rgba(255,255,255,.12); color: #eaf6ff; font: 800 12px system-ui; box-shadow: 0 12px 28px rgba(0,0,0,.24); }
      .online-world-badge.show { display: flex; align-items: center; gap: 9px; }
      .online-world-badge b { color: #9bd36a; letter-spacing: .08em; }
      .online-world-badge span { color: rgba(232,241,255,.78); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
      .mp-setup-box { display: grid; grid-template-columns: 1fr minmax(240px, 360px); gap: 14px; align-items: end; margin: 16px 0 0; padding: 13px; border: 1px solid rgba(155, 211, 106, .22); border-radius: 16px; background: rgba(155, 211, 106, .055); }
      .mp-setup-box b { display:block; margin-bottom: 4px; color:#eaffd8; }
      .mp-setup-box span { color: rgba(232,241,255,.68); }
      .multiplayer-setup-mode .menu-card { border-color: rgba(155, 211, 106, .28); }
      .station-craft-toast { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%) translateY(16px); z-index: 170; opacity: 0; pointer-events: none; padding: 10px 14px; border-radius: 999px; background: rgba(12, 18, 24, .94); border: 1px solid rgba(155, 211, 106, .44); color: #eaffd8; font: 900 13px system-ui; box-shadow: 0 12px 32px rgba(0,0,0,.38); transition: opacity .16s ease, transform .16s ease; }
      .station-craft-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
      @media(max-width:720px){ .mp-setup-box{ grid-template-columns:1fr; } }
    `;
    document.head.appendChild(style);
  }

  const previousSetup = setupEventListeners;
  setupEventListeners = function multiplayerLobbySetupListeners() {
    previousSetup();
    document.addEventListener('click', hostSetupClick, true);
    document.addEventListener('click', joinOnlyIfHostExists, true);
    document.addEventListener('click', stationCraftFeedback, false);
    document.getElementById('newGameBtn')?.addEventListener('click', handleNormalNewGame, true);
    document.getElementById('setupBackBtn')?.addEventListener('click', handleSetupBack, true);
    document.getElementById('setupNextBtn')?.addEventListener('click', handleSetupNext, true);
    document.getElementById('startSelectedGameBtn')?.addEventListener('click', handleStartMultiplayer, true);
  };

  const previousSetScreen = setScreen;
  setScreen = function multiplayerLobbySetScreen(screen) {
    previousSetScreen(screen);
    if (screen === 'ONLINE') {
      refreshLobbyStatus();
      if (statusTimer) clearInterval(statusTimer);
      statusTimer = setInterval(refreshLobbyStatus, 2500);
    } else if (screen !== SCREEN.PLAYING) {
      if (statusTimer) clearInterval(statusTimer);
      statusTimer = null;
      document.getElementById('onlineWorldBadge')?.classList.remove('show');
    }
    if (screen === SCREEN.NEW_GAME_SETUP) applySetupMode();
    if (screen === SCREEN.COLONIST_SELECT) applyColonistMode();
  };

  const previousUpdateUI = updateUI;
  updateUI = function multiplayerLobbyUpdateUI(force = false) {
    const stationOverlay = document.getElementById('stationOverlayClean');
    const shouldGuardStationModal = !!stationOverlay?.classList.contains('show');
    const originalStationOverlayId = stationOverlay?.id;
    if (shouldGuardStationModal) stationOverlay.id = 'stationOverlayCleanStable';
    try { previousUpdateUI(force); }
    finally { if (shouldGuardStationModal && stationOverlay) stationOverlay.id = originalStationOverlayId; }
    if (appScreen === SCREEN.NEW_GAME_SETUP) applySetupMode();
    if (appScreen === SCREEN.COLONIST_SELECT) applyColonistMode();
  };

  installStyles();
  loadPlayersPatch();
}

if (typeof window !== 'undefined' && typeof setupEventListeners === 'function') {
  installMultiplayerLobbyPatch();
}
