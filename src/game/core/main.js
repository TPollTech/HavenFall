'use strict';

window.HavenfallContext = window.HavenfallContext || {};

function loadCoreExtension(file, id) {
  if (!file || document.querySelector(`script[data-blueprint-id="${id}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = file;
    el.dataset.blueprintId = id;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Falha ao carregar ${id}`));
    document.body.appendChild(el);
  });
}

function bootGame() {
  if (window.HavenfallContext.gameBooted) {
    console.warn('[Engine] Boot já executado. Chamada redundante ignorada.');
    return;
  }

  loadCoreExtension('src/game/systems/colonist-vitals-system.js', 'colonist_vitals')
    .then(() => loadImages())
    .then(() => {
      window.HavenfallContext.gameBooted = true;

      if (typeof setupEventListeners === 'function') setupEventListeners();
      if (typeof writeNewGameConfig === 'function') writeNewGameConfig({ ...defaultNewGameConfig, seed: generateRandomSeed() });

      state = createInitialState({ ...defaultNewGameConfig, colonyName: defaultNewGameConfig.colonyName, seed: 'preview-menu' });
      if (window.HavenfallRuntime?.markPreviewState) window.HavenfallRuntime.markPreviewState(state);
      else {
        state.isPreview = true;
        state.runtimeMode = 'menu-preview';
      }
      activeSession = false;

      if (typeof ensureResearchState === 'function') ensureResearchState();
      if (typeof refreshMenuSaveInfo === 'function') refreshMenuSaveInfo();
      if (typeof refreshLoadScreen === 'function') refreshLoadScreen();
      if (typeof updateUI === 'function') updateUI(true);
      if (typeof setScreen === 'function') setScreen(SCREEN.MAIN_MENU);

      if (typeof resizeGameCanvas === 'function') {
        resizeGameCanvas();
        window.removeEventListener('resize', resizeGameCanvas);
        window.addEventListener('resize', resizeGameCanvas);
      }

      if (typeof gameLoop === 'function' && !window.HavenfallContext.animationLoopStarted) {
        window.HavenfallContext.animationLoopStarted = true;
        requestAnimationFrame(gameLoop);
      }
    })
    .catch(handleBootError);
}

function handleBootError(err) {
  window.HavenfallContext.gameBooted = false;
  console.error('[Engine Boot Error]:', err);
  window.HavenfallRuntimeErrors?.unshift?.({ kind: 'boot', message: err?.message || String(err), stack: err?.stack || null, at: new Date().toISOString() });
  const message = 'Falha ao iniciar o jogo. Verifique se os assets e módulos principais foram carregados corretamente.';
  const modal = typeof dom !== 'undefined' ? dom.modal : null;
  const modalText = modal?.querySelector('p');

  if (modalText) {
    modalText.textContent = message;
    modal.classList.add('show');
  } else {
    alert(message);
  }
}

(() => {
  settings = typeof loadSettings === 'function' ? loadSettings() : {};
  showDebugGrid = !!settings?.showGrid;
  bootGame();
})();
