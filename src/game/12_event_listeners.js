'use strict';

function on(el, eventName, handler, options) {
  if (el) el.addEventListener(eventName, handler, options);
}

function syncSpeedButtons() {
  document.querySelectorAll('[data-speed]').forEach(btn => {
    const active = !!state && Number(btn.dataset.speed) === Number(state.speed || 1) && appScreen === SCREEN.PLAYING;
    btn.classList.toggle('active', active);
  });
}

function setupEventListeners() {
  if (dom.speedLabel) {
    dom.speedLabel.remove();
    dom.speedLabel = null;
  }

  on(dom.buttons.continue, 'click', continueFromMenu);
  on(dom.buttons.newGame, 'click', () => {
    writeNewGameConfig({ ...defaultNewGameConfig, seed: generateRandomSeed() });
    setScreen(SCREEN.NEW_GAME_SETUP);
  });
  on(dom.buttons.openLoad, 'click', () => setScreen(SCREEN.LOAD_GAME));
  on(dom.buttons.openSettings, 'click', () => setScreen(SCREEN.SETTINGS));
  on(dom.buttons.exit, 'click', () => refreshMenuSaveInfo());
  on(dom.buttons.setupBack, 'click', () => setScreen(SCREEN.MAIN_MENU));
  on(dom.buttons.setupNext, 'click', () => {
    newGameConfig = readNewGameConfig();
    generateColonistCandidates(newGameConfig);
    setScreen(SCREEN.COLONIST_SELECT);
  });
  on(dom.buttons.randomSeed, 'click', () => {
    if (dom.inputs.worldSeed) dom.inputs.worldSeed.value = generateRandomSeed();
    updateSetupSummary();
  });

  Object.values(dom.inputs)
    .filter(Boolean)
    .filter(el => ['colonyNameInput','worldSeedInput','difficultySelect','colonistCountSelect','resourcesPresetSelect','eventIntensitySelect','mapSizeSelect'].includes(el.id))
    .forEach(el => {
      on(el, 'input', updateSetupSummary);
      on(el, 'change', updateSetupSummary);
    });

  on(dom.buttons.colonistBack, 'click', () => setScreen(SCREEN.NEW_GAME_SETUP));
  on(dom.buttons.rerollAll, 'click', rerollUnlockedColonists);
  on(dom.buttons.startSelectedGame, 'click', () => {
    if (!newGameConfig) newGameConfig = readNewGameConfig();
    startNewGame(newGameConfig, colonistCandidates);
    syncSpeedButtons();
  });
  on(dom.buttons.loadBack, 'click', () => setScreen(SCREEN.MAIN_MENU));
  on(dom.buttons.loadSlot, 'click', () => { loadAndPlay(); syncSpeedButtons(); });
  on(dom.buttons.deleteSave, 'click', () => {
    if (confirm('Apagar o save local?')) {
      localStorage.removeItem(SAVE_KEY);
      activeSession = false;
      refreshMenuSaveInfo();
      refreshLoadScreen();
      syncSpeedButtons();
    }
  });
  on(dom.buttons.settingsBack, 'click', goBackFromSettings);
  if (dom.inputs.uiScale) dom.inputs.uiScale.value = settings.uiScale || 'normal';
  if (dom.inputs.autosave) dom.inputs.autosave.value = settings.autosave || 'on';
  on(dom.inputs.uiScale, 'change', e => { settings.uiScale = e.target.value; saveSettings(); });
  on(dom.inputs.autosave, 'change', e => { settings.autosave = e.target.value; saveSettings(); });

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
      return;
    }

    const craft = e.target.closest('[data-craft]');
    if (craft && state) {
      const c = selectedColonist();
      const station = selectedCraftStationId ? state.objects.find(o => o.id === selectedCraftStationId) : null;
      assignCraft(c, craft.dataset.craft, station);
      updateUI(true);
      return;
    }

    const equip = e.target.closest('[data-equip-item]');
    if (equip && state) {
      const c = selectedColonist();
      if (c) equipItem(c, equip.dataset.equipItem);
      return;
    }

    const unequip = e.target.closest('[data-unequip-slot]');
    if (unequip && state) {
      const c = selectedColonist();
      if (c) unequipSlot(c, unequip.dataset.unequipSlot);
      return;
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
    syncSpeedButtons();
  }));
  syncSpeedButtons();

  on(dom.buttons.cancelBuild, 'click', () => { currentBuild = null; updateUI(true); });
  on(dom.buttons.pause, 'click', () => { setScreen(appScreen === SCREEN.PLAYING ? SCREEN.PAUSED : SCREEN.PLAYING); syncSpeedButtons(); });
  on(dom.buttons.pauseMenu, 'click', () => { setScreen(SCREEN.PAUSED); syncSpeedButtons(); });
  on(dom.buttons.resume, 'click', () => { setScreen(SCREEN.PLAYING); syncSpeedButtons(); });
  on(dom.buttons.pauseSave, 'click', () => { saveGame(true); updateUI(true); });
  on(dom.buttons.pauseLoad, 'click', () => { loadAndPlay(); syncSpeedButtons(); });
  on(dom.buttons.pauseSettings, 'click', () => setScreen(SCREEN.SETTINGS));
  on(dom.buttons.pauseMainMenu, 'click', () => { setScreen(SCREEN.MAIN_MENU); syncSpeedButtons(); });
  on(dom.buttons.modalStart, 'click', () => { dom.modal.classList.remove('show'); setScreen(SCREEN.PLAYING); syncSpeedButtons(); });

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
      syncSpeedButtons();
    }
    if (e.key === 'Escape') {
      if (appScreen === SCREEN.PLAYING) setScreen(SCREEN.PAUSED);
      else if (appScreen === SCREEN.PAUSED) setScreen(SCREEN.PLAYING);
      else if (appScreen !== SCREEN.MAIN_MENU) setScreen(SCREEN.MAIN_MENU);
      currentBuild = null;
      hideContextMenu?.();
      syncSpeedButtons();
    }
    if (state && (appScreen === SCREEN.PLAYING || appScreen === SCREEN.PAUSED) && ['1','2','3'].includes(e.key)) {
      state.speed = Number(e.key);
      setScreen(SCREEN.PLAYING);
      syncSpeedButtons();
    }
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
