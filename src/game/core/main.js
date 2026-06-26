'use strict';

settings = loadSettings();
showDebugGrid = !!settings.showGrid;

function bootGame() {
  loadImages()
    .then(() => {
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
    })
    .catch(handleBootError);
}

function handleBootError(err) {
  console.error(err);
  const message = 'Falha ao iniciar o jogo. Verifique se os assets e módulos principais foram carregados corretamente.';
  const modalText = dom.modal?.querySelector('p');
  if (modalText) {
    modalText.textContent = message;
    dom.modal.classList.add('show');
  } else {
    alert(message);
  }
}

bootGame();
