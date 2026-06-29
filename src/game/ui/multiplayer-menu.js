'use strict';

(() => {
  if (window.HavenfallContext?.multiplayerMenuInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.multiplayerMenuInstalled = true;

  function esc(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  }

  function injectStyle() {
    if (document.getElementById('multiplayerMenuStyle')) return;
    const style = document.createElement('style');
    style.id = 'multiplayerMenuStyle';
    style.textContent = `
      .multiplayer-screen .menu-card { max-width: 980px; }
      .multiplayer-layout { display: grid; grid-template-columns: minmax(280px, 1fr) minmax(260px, .9fr); gap: 18px; align-items: start; }
      .multiplayer-panel { border: 1px solid rgba(224, 194, 138, .18); background: rgba(9, 13, 19, .62); border-radius: 18px; padding: 16px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.03); }
      .multiplayer-panel h2 { margin: 0 0 8px; font-size: 1.05rem; }
      .multiplayer-panel p { margin: 0 0 12px; color: rgba(235,229,214,.75); line-height: 1.45; }
      .multiplayer-status { border-radius: 14px; padding: 12px 14px; background: rgba(15,23,42,.86); border: 1px solid rgba(148,163,184,.25); color: #e5e7eb; margin: 12px 0; }
      .multiplayer-status.ok { border-color: rgba(74,222,128,.45); background: rgba(20,83,45,.32); }
      .multiplayer-status.warn { border-color: rgba(251,191,36,.45); background: rgba(113,63,18,.32); }
      .multiplayer-status.danger { border-color: rgba(248,113,113,.55); background: rgba(127,29,29,.35); }
      .multiplayer-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
      .multiplayer-actions button { min-width: 150px; }
      .multiplayer-player-list { display: grid; gap: 8px; margin-top: 10px; }
      .multiplayer-player-row { display: flex; justify-content: space-between; gap: 10px; padding: 9px 10px; border-radius: 12px; background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.07); }
      .multiplayer-player-row b { color: #f8e7b0; }
      .multiplayer-help-list { margin: 10px 0 0; padding-left: 18px; color: rgba(235,229,214,.78); line-height: 1.5; }
      .multiplayer-copy-row { display: flex; gap: 8px; align-items: center; }
      .multiplayer-copy-row input { flex: 1; }
      @media (max-width: 860px) { .multiplayer-layout { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(style);
  }

  function getInput(id) { return document.getElementById(id); }

  function defaultServerValue() {
    const saved = (() => {
      try { return JSON.parse(localStorage.getItem('havenfall-multiplayer-settings') || '{}').serverUrl || ''; }
      catch (_) { return ''; }
    })();
    if (saved) return saved;
    if (location.protocol.startsWith('http')) return location.origin;
    return 'http://localhost:5173';
  }

  function defaultNickValue() {
    try { return JSON.parse(localStorage.getItem('havenfall-multiplayer-settings') || '{}').nick || 'Jogador'; }
    catch (_) { return 'Jogador'; }
  }

  function playersHtml(players = []) {
    if (!players.length) return '<div class="subtle-box">Nenhum jogador online ainda.</div>';
    return players.map(player => `<div class="multiplayer-player-row">
      <span><b>${esc(player.nick || 'Jogador')}</b><br><small>${esc(player.role || 'visitante')}</small></span>
      <span><small>${player.chosenColonistId ? `Colono ${esc(player.chosenColonistId)}` : 'sem colono'}</small></span>
    </div>`).join('');
  }

  window.refreshMultiplayerMenu = function refreshMultiplayerMenu() {
    injectStyle();
    const inputServer = getInput('multiplayerServerInput');
    const inputNick = getInput('multiplayerNickInput');
    if (inputServer && !inputServer.value) inputServer.value = defaultServerValue();
    if (inputNick && !inputNick.value) inputNick.value = defaultNickValue();
    const session = window.HavenfallMultiplayer?.session;
    const status = getInput('multiplayerStatus');
    if (status && session) {
      status.className = `multiplayer-status ${session.mode === 'host' || session.mode === 'join' ? 'ok' : 'info'}`;
      status.textContent = session.statusText || 'Offline';
    }
    const players = getInput('multiplayerPlayers');
    if (players) players.innerHTML = playersHtml(session?.players || []);
    const hostAddress = getInput('multiplayerHostAddress');
    if (hostAddress) hostAddress.value = inputServer?.value || defaultServerValue();
  };

  window.openMultiplayerMenu = function openMultiplayerMenu() {
    refreshMultiplayerMenu();
    previousScreen = appScreen;
    appScreen = SCREEN.MULTIPLAYER;
    Object.entries(dom.screens).forEach(([key, el]) => {
      if (el) el.classList.toggle('active', key === 'multiplayer');
    });
    if (dom.pauseOverlay) dom.pauseOverlay.classList.remove('show');
    if (state) state.paused = true;
  };

  function bindOnce(el, eventName, handler) {
    if (!el || el.dataset.multiplayerBound === '1') return;
    el.dataset.multiplayerBound = '1';
    el.addEventListener(eventName, handler);
  }

  function bindButtons() {
    bindOnce(dom.buttons?.openMultiplayer, 'click', () => window.openMultiplayerMenu());
    bindOnce(dom.buttons?.multiplayerBack, 'click', () => setScreen(SCREEN.MAIN_MENU));
    bindOnce(dom.buttons?.multiplayerHostNewGame, 'click', async () => {
      try { await window.HavenfallMultiplayer?.hostCurrentGame?.({ openSetup: true }); }
      catch (error) { window.HavenfallMultiplayer?.session && (window.HavenfallMultiplayer.session.statusText = error.message); refreshMultiplayerMenu(); }
    });
    bindOnce(dom.buttons?.multiplayerHost, 'click', async () => {
      try { await window.HavenfallMultiplayer?.hostCurrentGame?.(); }
      catch (error) { window.HavenfallMultiplayer?.session && (window.HavenfallMultiplayer.session.statusText = error.message); refreshMultiplayerMenu(); }
    });
    bindOnce(dom.buttons?.multiplayerJoin, 'click', async () => {
      try { await window.HavenfallMultiplayer?.joinGame?.(); }
      catch (error) { window.HavenfallMultiplayer?.session && (window.HavenfallMultiplayer.session.statusText = error.message); refreshMultiplayerMenu(); }
    });
    bindOnce(dom.buttons?.multiplayerStop, 'click', () => window.HavenfallMultiplayer?.stopSession?.());
  }

  injectStyle();
  bindButtons();
})();