'use strict';

settings = loadSettings();
showDebugGrid = !!settings.showGrid;

function bootGame() {
  loadImages().then(() => {
    setupEventListeners();
    writeNewGameConfig({ ...defaultNewGameConfig, seed: generateRandomSeed() });
    state = createInitialState({ ...defaultNewGameConfig, colonyName: 'First Haven', seed: 'preview-menu' });
    activeSession = false;
    ensureResearchState();
    refreshMenuSaveInfo();
    refreshLoadScreen();
    updateUI(true);
    setScreen(SCREEN.MAIN_MENU);
    resizeGameCanvas();
    window.addEventListener('resize', resizeGameCanvas);
    requestAnimationFrame(gameLoop);
  }).catch(err => {
    console.error(err);
    alert('Falha ao carregar assets do jogo. Veja o console.');
  });
}

function loadQolPatchThenBoot() {
  const script = document.createElement('script');
  script.src = 'src/game/14_qol_patch.js';
  script.onload = () => {
    if (typeof installQolPatch === 'function') installQolPatch();
    bootGame();
  };
  script.onerror = () => bootGame();
  document.body.appendChild(script);
}

loadQolPatchThenBoot();
