'use strict';

function setupEventListeners() {
  document.getElementById('continueBtn').addEventListener('click', continueFromMenu);
  document.getElementById('newGameBtn').addEventListener('click', () => {
    writeNewGameConfig({ ...defaultNewGameConfig, seed: generateRandomSeed() });
    setScreen(SCREEN.NEW_GAME_SETUP);
  });
  document.getElementById('openLoadBtn').addEventListener('click', () => setScreen(SCREEN.LOAD_GAME));
  document.getElementById('openSettingsBtn').addEventListener('click', () => setScreen(SCREEN.SETTINGS));
  document.getElementById('exitBtn').addEventListener('click', () => refreshMenuSaveInfo());
  document.getElementById('setupBackBtn').addEventListener('click', () => setScreen(SCREEN.MAIN_MENU));
  document.getElementById('setupNextBtn').addEventListener('click', () => {
    newGameConfig = readNewGameConfig();
    generateColonistCandidates(newGameConfig);
    setScreen(SCREEN.COLONIST_SELECT);
  });
  document.getElementById('randomSeedBtn').addEventListener('click', () => {
    document.getElementById('worldSeedInput').value = generateRandomSeed();
    updateSetupSummary();
  });
  ['colonyNameInput','worldSeedInput','difficultySelect','colonistCountSelect','resourcesPresetSelect','eventIntensitySelect','mapSizeSelect'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateSetupSummary);
    document.getElementById(id).addEventListener('change', updateSetupSummary);
  });
  document.getElementById('colonistBackBtn').addEventListener('click', () => setScreen(SCREEN.NEW_GAME_SETUP));
  document.getElementById('rerollAllBtn').addEventListener('click', () => {
    colonistCandidates = colonistCandidates.map((c, i) => c.locked ? c : createColonistCandidate(i, newGameConfig, `${newGameConfig.seed}-reroll-all-${Date.now()}-${i}-${Math.random()}`));
    renderColonistSelection();
  });
  document.getElementById('startSelectedGameBtn').addEventListener('click', () => {
    if (!newGameConfig) newGameConfig = readNewGameConfig();
    startNewGame(newGameConfig, colonistCandidates);
  });
  document.getElementById('loadBackBtn').addEventListener('click', () => setScreen(SCREEN.MAIN_MENU));
  document.getElementById('loadSlotBtn').addEventListener('click', loadAndPlay);
  document.getElementById('deleteSaveBtn').addEventListener('click', () => {
    if (confirm('Apagar o save local?')) {
      localStorage.removeItem(SAVE_KEY);
      activeSession = false;
      refreshMenuSaveInfo();
      refreshLoadScreen();
    }
  });
  document.getElementById('settingsBackBtn').addEventListener('click', goBackFromSettings);
  document.getElementById('uiScaleSelect').value = settings.uiScale || 'normal';
  document.getElementById('autosaveSelect').value = settings.autosave || 'on';
  document.getElementById('uiScaleSelect').addEventListener('change', e => { settings.uiScale = e.target.value; saveSettings(); });
  document.getElementById('autosaveSelect').addEventListener('change', e => { settings.autosave = e.target.value; saveSettings(); });

  document.addEventListener('click', e => {
    const reroll = e.target.closest('[data-reroll-colonist]');
    if (reroll) { rerollColonist(Number(reroll.dataset.rerollColonist)); return; }
    const lock = e.target.closest('[data-lock-colonist]');
    if (lock) {
      const idx = Number(lock.dataset.lockColonist);
      if (colonistCandidates[idx]) colonistCandidates[idx].locked = !colonistCandidates[idx].locked;
      renderColonistSelection();
      return;
    }
    const select = e.target.closest('[data-select-colonist]');
    if (select && state) {
      selectedColonistId = Number(select.dataset.selectColonist);
      updateUI(true);
      return;
    }
    const btn = e.target.closest('[data-priority]');
    if (btn && state) {
      const c = selectedColonist();
      if (!c) return;
      const key = btn.dataset.priority;
      if (!priorityDefs[key]) return;
      c.priority = key;
      c.note = c.task ? c.note : `Prioridade: ${priorityDefs[key].label}`;
      log(`${c.name} agora prioriza ${priorityDefs[key].label.toLowerCase()}.`);
      updateUI(true);
    }
  });

  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => setHudTab(btn.dataset.tab));
  });
  setHudTab(activeHudTab);

  document.querySelectorAll('[data-build]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!state) return;
      if (!isBuildUnlocked(btn.dataset.build)) {
        const req = buildDefs[btn.dataset.build]?.requires;
        log(`Bloqueado: pesquise ${researchDefs[req]?.label || 'tecnologia'} primeiro.`);
        updateUI(true);
        return;
      }
      currentBuild = btn.dataset.build;
      setHudTab('build');
      updateUI(true);
    });
  });
  document.querySelectorAll('[data-speed]').forEach(btn => btn.addEventListener('click', () => {
    if (!state) return;
    state.speed = Number(btn.dataset.speed);
    setScreen(SCREEN.PLAYING);
  }));
  document.getElementById('cancelBuild').addEventListener('click', () => { currentBuild = null; updateUI(true); });
  document.getElementById('pauseBtn').addEventListener('click', () => setScreen(appScreen === SCREEN.PLAYING ? SCREEN.PAUSED : SCREEN.PLAYING));
  document.getElementById('menuPauseBtn').addEventListener('click', () => setScreen(SCREEN.PAUSED));
  document.getElementById('resumeBtn').addEventListener('click', () => setScreen(SCREEN.PLAYING));
  document.getElementById('pauseSaveBtn').addEventListener('click', () => { saveGame(true); updateUI(true); });
  document.getElementById('pauseLoadBtn').addEventListener('click', loadAndPlay);
  document.getElementById('pauseSettingsBtn').addEventListener('click', () => setScreen(SCREEN.SETTINGS));
  document.getElementById('pauseMainMenuBtn').addEventListener('click', () => setScreen(SCREEN.MAIN_MENU));
  document.getElementById('startBtn').addEventListener('click', () => { dom.modal.classList.remove('show'); setScreen(SCREEN.PLAYING); });

  canvas.addEventListener('wheel', e => {
    if (appScreen !== SCREEN.PLAYING) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const anchor = {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
    changeCameraZoom(e.deltaY < 0 ? camera.zoomStep : -camera.zoomStep, anchor);
  }, { passive: false });

  window.addEventListener('keydown', e => {
    const cameraMoveKeys = ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','ShiftLeft','ShiftRight'];
    if (cameraMoveKeys.includes(e.code) && appScreen === SCREEN.PLAYING) {
      e.preventDefault();
      cameraInput.add(e.code);
    }

    const zoomInKeys = ['Equal','NumpadAdd'];
    const zoomOutKeys = ['Minus','NumpadSubtract'];
    const resetZoomKeys = ['Digit0','Numpad0'];
    if (state && appScreen === SCREEN.PLAYING && e.code === 'KeyG') {
      e.preventDefault();
      showDebugGrid = !showDebugGrid;
      if (settings) { settings.showGrid = showDebugGrid; saveSettings(); }
      log(showDebugGrid ? 'Grade de debug ligada.' : 'Grade de debug desligada.');
      updateUI(true);
      return;
    }
    if (state && appScreen === SCREEN.PLAYING && zoomInKeys.includes(e.code)) {
      e.preventDefault();
      changeCameraZoom(camera.zoomStep);
    }
    if (state && appScreen === SCREEN.PLAYING && zoomOutKeys.includes(e.code)) {
      e.preventDefault();
      changeCameraZoom(-camera.zoomStep);
    }
    if (state && appScreen === SCREEN.PLAYING && resetZoomKeys.includes(e.code)) {
      e.preventDefault();
      resetCameraZoom();
    }
    if (e.code === 'Space' && (appScreen === SCREEN.PLAYING || appScreen === SCREEN.PAUSED)) {
      e.preventDefault();
      setScreen(appScreen === SCREEN.PLAYING ? SCREEN.PAUSED : SCREEN.PLAYING);
    }
    if (e.key === 'Escape') {
      if (appScreen === SCREEN.PLAYING) setScreen(SCREEN.PAUSED);
      else if (appScreen === SCREEN.PAUSED) setScreen(SCREEN.PLAYING);
      else if (appScreen !== SCREEN.MAIN_MENU) setScreen(SCREEN.MAIN_MENU);
      currentBuild = null;
      hideContextMenu?.();
    }
    if (state && (appScreen === SCREEN.PLAYING || appScreen === SCREEN.PAUSED) && ['1','2','3'].includes(e.key)) { state.speed = Number(e.key); setScreen(SCREEN.PLAYING); }
  });

  window.addEventListener('keyup', e => {
    cameraInput.delete(e.code);
  });

  document.addEventListener('pointerdown', e => {
    if (!e.target.closest?.('#contextMenu') && e.target !== canvas) hideContextMenu?.();
  });

  window.addEventListener('blur', () => {
    cameraInput.clear();
    hideContextMenu?.();
  });
}
