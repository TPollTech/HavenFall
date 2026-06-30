'use strict';

window.HavenfallContext = window.HavenfallContext || {};

function bootStatus(text, progress, detail) {
  window.HavenfallBootProgress?.set?.(text, progress, detail);
}

function bootReady(gate, detail) {
  window.HavenfallBootProgress?.mark?.(gate, detail);
}

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

  bootStatus('Preparando sistema de colonos', 84, 'Carregando vitais e rotina inicial');
  loadCoreExtension('src/game/systems/colonist-vitals-system.js', 'colonist_vitals')
    .then(() => {
      bootStatus('Carregando assets', 86, 'Lendo imagens, sprites e placeholders');
      return loadImages();
    })
    .then(() => {
      bootReady('assets-loaded', 'Assets carregados ou substituídos por placeholders seguros');
      window.HavenfallContext.gameBooted = true;

      bootStatus('Registrando controles', 89, 'Ativando botões, teclado e mouse');
      if (typeof setupEventListeners === 'function') setupEventListeners();
      bootReady('listeners-ready', 'Controles e botões registrados');

      bootStatus('Preparando configuração inicial', 91, 'Criando seed padrão do menu');
      if (typeof writeNewGameConfig === 'function') writeNewGameConfig({ ...defaultNewGameConfig, seed: generateRandomSeed() });

      bootStatus('Criando prévia do menu', 92, 'Gerando estado visual sem gameplay ativa');
      state = createInitialState({
        ...defaultNewGameConfig,
        colonyName: defaultNewGameConfig.colonyName,
        seed: 'preview-menu',
        mapSize: 'large',
        eventIntensity: 'low',
        resourcesPreset: 'standard'
      });
      if (window.HavenfallRuntime?.markPreviewState) window.HavenfallRuntime.markPreviewState(state);
      else {
        state.isPreview = true;
        state.runtimeMode = 'menu-preview';
      }
      activeSession = false;

      bootStatus('Verificando save', 94, 'Consultando save local e arquivo desktop');
      if (typeof ensureResearchState === 'function') ensureResearchState();
      if (typeof refreshMenuSaveInfo === 'function') refreshMenuSaveInfo();
      if (typeof refreshLoadScreen === 'function') refreshLoadScreen();
      bootReady('save-checked', 'Save verificado');

      bootStatus('Montando menu principal', 96, 'Atualizando interface inicial');
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

      bootReady('menu-ready', 'Menu principal interativo');
    })
    .catch(handleBootError);
}

function handleBootError(err) {
  window.HavenfallContext.gameBooted = false;
  console.error('[Engine Boot Error]:', err);
  window.HavenfallRuntimeErrors?.unshift?.({ kind: 'boot', message: err?.message || String(err), stack: err?.stack || null, at: new Date().toISOString() });
  window.HavenfallBootProgress?.set?.('Falha ao iniciar o jogo', 100, err?.message || String(err));
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
