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

function loadScript(src) {
  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

async function loadQolPatchesThenBoot() {
  await loadScript('src/game/14_qol_patch.js');
  if (typeof installQolPatch === 'function') installQolPatch();

  await loadScript('src/game/15_crafting_wall_fix.js');
  if (typeof installCraftingWallFixPatch === 'function') installCraftingWallFixPatch();

  await loadScript('src/game/16_building_roof_ai_fix.js');
  if (typeof installBuildingRoofAiFixPatch === 'function') installBuildingRoofAiFixPatch();

  bootGame();
}

loadQolPatchesThenBoot();
