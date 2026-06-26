'use strict';

(() => {
  window.HavenfallContext = window.HavenfallContext || {};

  function on(el, eventName, handler, options) {
    if (el) el.addEventListener(eventName, handler, options);
  }

  function eventTargetElement(event) {
    const target = event.target;
    if (!target) return null;
    return target.closest ? target : target.parentElement || null;
  }

  function isTypingTarget(el = document.activeElement) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el.isContentEditable;
  }

  function syncSpeedButtons() {
    document.querySelectorAll('[data-speed]').forEach(btn => {
      const active = !!state && Number(btn.dataset.speed) === Number(state.speed || 1) && appScreen === SCREEN.PLAYING;
      btn.classList.toggle('active', active);
    });
  }

  function toggleColonistLock(idx) {
    if (!colonistCandidates || !colonistCandidates[idx]) return;
    colonistCandidates[idx].locked = !colonistCandidates[idx].locked;
    if (typeof renderColonistSelection === 'function') renderColonistSelection();
  }

  function changeColonistPriority(key) {
    if (!state || typeof selectedColonist !== 'function') return;
    const c = selectedColonist();
    if (!c || !priorityDefs?.[key]) return;

    c.priority = key;
    c.note = c.task ? c.note : `Prioridade: ${priorityDefs[key].label}`;
    if (typeof log === 'function') log(`${c.name} agora prioriza ${priorityDefs[key].label.toLowerCase()}.`);
    if (typeof updateUI === 'function') updateUI(true);
  }

  function selectBuildTool(buildKey) {
    if (!state || !buildKey) return;
    if (typeof isBuildUnlocked === 'function' && !isBuildUnlocked(buildKey)) {
      const req = buildDefs?.[buildKey]?.requires;
      if (typeof log === 'function') log(`Bloqueado: pesquise ${researchDefs?.[req]?.label || 'tecnologia'} primeiro.`);
      if (typeof updateUI === 'function') updateUI(true);
      return;
    }

    currentBuild = buildKey;
    if (typeof setHudTab === 'function') setHudTab('build');
    if (typeof updateUI === 'function') updateUI(true);
  }

  function setGameSpeed(speed) {
    if (!state) return;
    state.speed = Number(speed) || 1;
    if (typeof setScreen === 'function') setScreen(SCREEN.PLAYING);
    syncSpeedButtons();
  }

  function closeEventModalAndPlay() {
    const modal = dom.modal || document.getElementById('eventModal');
    modal?.classList.remove('show');
    if (typeof setScreen === 'function') setScreen(SCREEN.PLAYING);
    syncSpeedButtons();
  }

  function handleDelegatedClick(event) {
    const target = eventTargetElement(event);
    if (!target) return;

    const reroll = target.closest('[data-reroll-colonist]');
    if (reroll) {
      rerollColonist(Number(reroll.dataset.rerollColonist));
      return;
    }

    const lock = target.closest('[data-lock-colonist]');
    if (lock) {
      toggleColonistLock(Number(lock.dataset.lockColonist));
      return;
    }

    const select = target.closest('[data-select-colonist]');
    if (select && state) {
      selectedColonistId = Number(select.dataset.selectColonist);
      updateUI(true);
      return;
    }

    const priority = target.closest('[data-priority]');
    if (priority) {
      changeColonistPriority(priority.dataset.priority);
      return;
    }

    const craft = target.closest('[data-craft]');
    if (craft && state && typeof selectedColonist === 'function') {
      const c = selectedColonist();
      const station = selectedCraftStationId ? state.objects.find(o => o.id === selectedCraftStationId) : null;
      if (c) assignCraft(c, craft.dataset.craft, station);
      updateUI(true);
      return;
    }

    const equip = target.closest('[data-equip-item]');
    if (equip && state && typeof selectedColonist === 'function') {
      const c = selectedColonist();
      if (c) equipItem(c, equip.dataset.equipItem);
      return;
    }

    const unequip = target.closest('[data-unequip-slot]');
    if (unequip && state && typeof selectedColonist === 'function') {
      const c = selectedColonist();
      if (c) unequipSlot(c, unequip.dataset.unequipSlot);
      return;
    }

    const tab = target.closest('[data-tab]');
    if (tab) {
      setHudTab(tab.dataset.tab);
      return;
    }

    const build = target.closest('[data-build]');
    if (build) {
      selectBuildTool(build.dataset.build);
      return;
    }

    const speed = target.closest('[data-speed]');
    if (speed) {
      setGameSpeed(speed.dataset.speed);
    }
  }

  function handleCanvasWheel(event) {
    if (appScreen !== SCREEN.PLAYING) return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const anchor = {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
    changeCameraZoom(event.deltaY < 0 ? camera.zoomStep : -camera.zoomStep, anchor);
  }

  function handleKeyDown(event) {
    if (isTypingTarget()) return;

    const cameraMoveKeys = ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','ShiftLeft','ShiftRight'];
    if (cameraMoveKeys.includes(event.code) && appScreen === SCREEN.PLAYING) {
      event.preventDefault();
      cameraInput.add(event.code);
      return;
    }

    const zoomInKeys = ['Equal','NumpadAdd'];
    const zoomOutKeys = ['Minus','NumpadSubtract'];
    const resetZoomKeys = ['Digit0','Numpad0'];

    if (state && appScreen === SCREEN.PLAYING && event.code === 'KeyG') {
      event.preventDefault();
      showDebugGrid = !showDebugGrid;
      if (settings) {
        settings.showGrid = showDebugGrid;
        saveSettings();
      }
      if (typeof log === 'function') log(showDebugGrid ? 'Grade de debug ligada.' : 'Grade de debug desligada.');
      if (typeof updateUI === 'function') updateUI(true);
      return;
    }

    if (state && appScreen === SCREEN.PLAYING && zoomInKeys.includes(event.code)) {
      event.preventDefault();
      changeCameraZoom(camera.zoomStep);
      return;
    }

    if (state && appScreen === SCREEN.PLAYING && zoomOutKeys.includes(event.code)) {
      event.preventDefault();
      changeCameraZoom(-camera.zoomStep);
      return;
    }

    if (state && appScreen === SCREEN.PLAYING && resetZoomKeys.includes(event.code)) {
      event.preventDefault();
      resetCameraZoom();
      return;
    }

    if (event.code === 'Space' && (appScreen === SCREEN.PLAYING || appScreen === SCREEN.PAUSED)) {
      event.preventDefault();
      setScreen(appScreen === SCREEN.PLAYING ? SCREEN.PAUSED : SCREEN.PLAYING);
      syncSpeedButtons();
      return;
    }

    if (event.key === 'Escape') {
      if (appScreen === SCREEN.PLAYING) setScreen(SCREEN.PAUSED);
      else if (appScreen === SCREEN.PAUSED) setScreen(SCREEN.PLAYING);
      else if (appScreen !== SCREEN.MAIN_MENU) setScreen(SCREEN.MAIN_MENU);
      currentBuild = null;
      hideContextMenu?.();
      syncSpeedButtons();
      return;
    }

    if (state && (appScreen === SCREEN.PLAYING || appScreen === SCREEN.PAUSED) && ['1','2','3'].includes(event.key)) {
      setGameSpeed(event.key);
    }
  }

  function handleKeyUp(event) {
    cameraInput?.delete?.(event.code);
  }

  function handleDocumentPointerDown(event) {
    const target = eventTargetElement(event);
    if (!target?.closest?.('#contextMenu') && target !== canvas) hideContextMenu?.();
  }

  function handleWindowBlur() {
    cameraInput?.clear?.();
    hideContextMenu?.();
  }

  window.setupEventListeners = function setupEventListeners() {
    if (window.HavenfallContext.listenersSetupActive) {
      console.log('[Events Engine] Escutadores já ativos. Re-registro ignorado.');
      return;
    }

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

    document.addEventListener('click', handleDelegatedClick);

    on(dom.buttons.cancelBuild, 'click', () => { currentBuild = null; updateUI(true); });
    on(dom.buttons.pause, 'click', () => { setScreen(appScreen === SCREEN.PLAYING ? SCREEN.PAUSED : SCREEN.PLAYING); syncSpeedButtons(); });
    on(dom.buttons.pauseMenu, 'click', () => { setScreen(SCREEN.PAUSED); syncSpeedButtons(); });
    on(dom.buttons.resume, 'click', () => { setScreen(SCREEN.PLAYING); syncSpeedButtons(); });
    on(dom.buttons.pauseSave, 'click', () => { saveGame(true); updateUI(true); });
    on(dom.buttons.pauseLoad, 'click', () => { loadAndPlay(); syncSpeedButtons(); });
    on(dom.buttons.pauseSettings, 'click', () => setScreen(SCREEN.SETTINGS));
    on(dom.buttons.pauseMainMenu, 'click', () => { setScreen(SCREEN.MAIN_MENU); syncSpeedButtons(); });
    on(dom.buttons.modalStart || document.getElementById('modalStartBtn'), 'click', closeEventModalAndPlay);

    on(canvas, 'wheel', handleCanvasWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('pointerdown', handleDocumentPointerDown);
    window.addEventListener('blur', handleWindowBlur);

    if (typeof setHudTab === 'function') setHudTab(activeHudTab || 'build');
    syncSpeedButtons();
    window.HavenfallContext.listenersSetupActive = true;
  };
})();
