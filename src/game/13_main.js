'use strict';

settings = loadSettings();
showDebugGrid = !!settings.showGrid;
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
