'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  if (window.HavenfallUI.pauseMenuReady) return;
  window.HavenfallUI.pauseMenuReady = true;

  function addStyle() {
    if (document.getElementById('hf-pause-menu-style')) return;
    const style = document.createElement('style');
    style.id = 'hf-pause-menu-style';
    style.textContent = [
      '#pauseOverlay,#pauseOverlay.game-popup-modal,#pauseOverlay.game-popup-modal.show,#pauseOverlay.game-popup-modal.is-active{display:none!important;visibility:hidden!important;pointer-events:none!important;overflow:hidden!important}',
      '.hf-pause-overlay{position:fixed;inset:0;width:100vw;height:100vh;z-index:9999;display:none;place-items:center;overflow:hidden;background:rgba(0,0,0,.80);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);pointer-events:auto}',
      '.hf-pause-overlay.is-active{display:grid}',
      '.hf-pause-card{width:min(520px,calc(100vw - 48px));max-height:calc(100vh - 64px);overflow:hidden;display:grid;gap:18px;padding:clamp(22px,4vh,34px);border-radius:26px;border:1px solid rgba(227,169,63,.40);background:linear-gradient(180deg,rgba(16,20,31,.98),rgba(7,10,17,.97));box-shadow:0 34px 120px rgba(0,0,0,.72);color:#fff4df}',
      '.hf-pause-kicker{color:#f7b84a;font-weight:900;letter-spacing:.18em;text-transform:uppercase;font-size:12px}',
      '.hf-pause-card h1{margin:0;font-size:clamp(48px,8vh,76px);line-height:.92}',
      '.hf-pause-card p{margin:0;color:rgba(255,244,223,.76);font-size:16px}',
      '.hf-pause-actions{display:grid;gap:10px}',
      '.hf-pause-actions button{min-height:46px;border-radius:13px;border:1px solid rgba(227,169,63,.32);background:linear-gradient(180deg,rgba(35,41,56,.98),rgba(21,25,35,.98));color:#fff4df;font-weight:900;font-size:15px;cursor:pointer}',
      '.hf-pause-actions button:hover{border-color:rgba(255,211,120,.72);transform:translateY(-1px)}',
      '.hf-pause-actions .warn{color:#ffd9d1;border-color:rgba(220,90,70,.42)}',
      'body.hf-pause-open{overflow:hidden!important}',
      'body.hf-pause-open #bottom-navigation-dock,body.hf-pause-open #anchored-ui-panel,body.hf-pause-open #research-tree-overlay,body.hf-pause-open #colonist-modal,body.hf-pause-open #ui-modal-backdrop,body.hf-pause-open [id^="modal-"]{display:none!important;visibility:hidden!important;pointer-events:none!important}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function neutralizeLegacyPauseOverlay() {
    const legacy = document.getElementById('pauseOverlay');
    if (!legacy) return;
    legacy.classList.remove('show', 'is-active', 'active');
    legacy.hidden = true;
    legacy.setAttribute('aria-hidden', 'true');
    legacy.style.display = 'none';
    legacy.style.overflow = 'hidden';
  }

  function closeAnchoredPanels() {
    const panel = document.getElementById('anchored-ui-panel');
    if (panel) {
      panel.classList.remove('is-active');
      panel.setAttribute('aria-hidden', 'true');
    }
    document.querySelectorAll('#bottom-navigation-dock .is-active').forEach(el => el.classList.remove('is-active'));
  }

  function forceCloseAll(options = {}) {
    const except = options.except || null;
    if (except !== 'pause') closePauseMenu();
    if (except !== 'panel') closeAnchoredPanels();
    if (except !== 'research') window.HavenfallUI.closeResearchOverlay?.();
    document.getElementById('colonist-modal')?.classList.remove('show');
    document.getElementById('ui-modal-backdrop')?.classList.remove('is-active', 'show');
    document.querySelectorAll('[id^="modal-"], .game-popup-modal:not(#eventModal)').forEach(el => {
      el.classList.remove('show', 'is-active', 'active');
      el.hidden = true;
      el.setAttribute('aria-hidden', 'true');
    });
    neutralizeLegacyPauseOverlay();
  }

  function makeButton(label, action, className = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.pauseAction = action;
    if (className) button.className = className;
    return button;
  }

  function ensurePauseMenu() {
    addStyle();
    neutralizeLegacyPauseOverlay();
    let overlay = document.getElementById('hf-pause-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('section');
    overlay.id = 'hf-pause-overlay';
    overlay.className = 'hf-pause-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    const card = document.createElement('article');
    card.className = 'hf-pause-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');

    const kicker = document.createElement('div');
    kicker.className = 'hf-pause-kicker';
    kicker.textContent = 'Pausado';

    const title = document.createElement('h1');
    title.textContent = 'Menu';

    const desc = document.createElement('p');
    desc.textContent = 'Salve, carregue ou ajuste a partida.';

    const actions = document.createElement('div');
    actions.className = 'hf-pause-actions';
    actions.append(
      makeButton('Continuar', 'resume'),
      makeButton('Salvar Agora', 'save'),
      makeButton('Carregar Save', 'load'),
      makeButton('Configurações', 'settings'),
      makeButton('Voltar ao Menu Principal', 'main', 'warn')
    );

    card.append(kicker, title, desc, actions);
    overlay.append(card);
    overlay.addEventListener('pointerdown', event => event.stopPropagation());
    overlay.addEventListener('wheel', event => { event.preventDefault(); event.stopPropagation(); }, { passive: false });
    overlay.addEventListener('click', onPauseMenuClick);
    document.body.appendChild(overlay);
    return overlay;
  }

  function onPauseMenuClick(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const action = event.target.closest('[data-pause-action]')?.dataset.pauseAction;
    if (!action) return;

    if (action === 'resume' && typeof setScreen === 'function') setScreen(SCREEN.PLAYING);
    if (action === 'save') {
      if (typeof saveGame === 'function') saveGame(true);
      if (typeof updateUI === 'function') updateUI(true);
    }
    if (action === 'load' && typeof loadAndPlay === 'function') loadAndPlay();
    if (action === 'settings' && typeof setScreen === 'function') setScreen(SCREEN.SETTINGS);
    if (action === 'main' && typeof setScreen === 'function') setScreen(SCREEN.MAIN_MENU);
  }

  function openPauseMenu() {
    forceCloseAll({ except: 'pause' });
    const overlay = ensurePauseMenu();
    neutralizeLegacyPauseOverlay();
    document.body.classList.add('hf-pause-open');
    overlay.classList.add('is-active');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function closePauseMenu() {
    neutralizeLegacyPauseOverlay();
    const overlay = document.getElementById('hf-pause-overlay');
    if (overlay) {
      overlay.classList.remove('is-active');
      overlay.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('hf-pause-open');
  }

  function handleScreenState(screen) {
    neutralizeLegacyPauseOverlay();
    if (screen === SCREEN.PAUSED) openPauseMenu();
    else closePauseMenu();
    if (screen !== SCREEN.PLAYING && screen !== SCREEN.PAUSED) forceCloseAll();
  }

  function patchSetScreenForPauseMenu() {
    if (typeof setScreen !== 'function' || window.HavenfallUI.pauseSetScreenHooked) return;
    const nativeSetScreen = setScreen;
    setScreen = function setScreenWithPauseMenu(screen) {
      nativeSetScreen(screen);
      handleScreenState(screen);
    };
    window.HavenfallUI.pauseSetScreenHooked = true;
  }

  ensurePauseMenu();
  patchSetScreenForPauseMenu();

  window.HavenfallUI.openPauseMenu = openPauseMenu;
  window.HavenfallUI.closePauseMenu = closePauseMenu;
  window.HavenfallUI.neutralizeLegacyPauseOverlay = neutralizeLegacyPauseOverlay;
  window.HavenfallUI.forceCloseAll = forceCloseAll;

  window.uiManager = window.uiManager || {};
  window.uiManager.forceCloseAll = forceCloseAll;
  window.uiManager.openPauseMenu = openPauseMenu;
  window.uiManager.closePauseMenu = closePauseMenu;
})();
