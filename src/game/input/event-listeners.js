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

  function isLegacyHudClick(target) {
    if (!target?.closest) return false;
    if (target.closest('#anchored-ui-panel, #bottom-navigation-dock, .research-tree-overlay, #eventModal, #pauseOverlay')) return false;
    return !!target.closest('#hud, #bottomActionBar, #ui-modal-backdrop, [id^="modal-"], [data-ui-modal]');
  }

  function isTypingTarget(el = document.activeElement) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el.isContentEditable;
  }

  function ensureRuntimeLoadingStyle() {
    if (document.getElementById('havenfallRuntimeLoadingStyle')) return;
    const style = document.createElement('style');
    style.id = 'havenfallRuntimeLoadingStyle';
    style.textContent = `
      #havenfallRuntimeLoadingOverlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: grid;
        place-items: center;
        padding: 24px;
        color: #f4efe4;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at 50% 34%, rgba(86, 215, 208, .16), transparent 34%),
          linear-gradient(180deg, rgba(2, 5, 10, .70), rgba(2, 5, 10, .88));
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity .18s ease, visibility .18s ease;
      }
      #havenfallRuntimeLoadingOverlay.show {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }
      #havenfallRuntimeLoadingOverlay .runtime-loading-card {
        width: min(560px, calc(100vw - 40px));
        padding: 22px;
        border: 1px solid rgba(227, 169, 63, .28);
        border-radius: 12px;
        background: linear-gradient(180deg, rgba(12, 17, 25, .96), rgba(5, 8, 14, .96));
        box-shadow: 0 28px 86px rgba(0, 0, 0, .62), inset 0 0 0 1px rgba(255, 255, 255, .045);
        backdrop-filter: blur(10px);
      }
      #havenfallRuntimeLoadingOverlay .runtime-loading-kicker {
        margin-bottom: 7px;
        color: #e3a93f;
        font-size: 11px;
        font-weight: 950;
        letter-spacing: .22em;
        text-transform: uppercase;
      }
      #havenfallRuntimeLoadingOverlay .runtime-loading-title {
        margin: 0 0 10px;
        color: #fff4d9;
        font-size: clamp(30px, 5vw, 48px);
        font-weight: 950;
        line-height: .95;
        text-transform: uppercase;
        text-shadow: 0 4px 0 rgba(0, 0, 0, .38);
      }
      #havenfallRuntimeLoadingOverlay .runtime-loading-status {
        min-height: 22px;
        margin-bottom: 15px;
        color: #dce7ee;
        font-size: 14px;
        font-weight: 760;
      }
      #havenfallRuntimeLoadingOverlay .runtime-loading-bar {
        height: 11px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, .10);
        border-radius: 999px;
        background: rgba(0, 0, 0, .42);
        box-shadow: inset 0 0 16px rgba(0, 0, 0, .55);
      }
      #havenfallRuntimeLoadingOverlay .runtime-loading-fill {
        width: 0%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #56d7d0, #e3a93f 62%, #fff4d9);
        box-shadow: 0 0 18px rgba(86, 215, 208, .26);
        transition: width .16s ease;
      }
      #havenfallRuntimeLoadingOverlay .runtime-loading-meta {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin-top: 10px;
        color: #9da9bd;
        font-size: 12px;
        font-weight: 760;
      }
      #havenfallRuntimeLoadingOverlay .runtime-loading-detail {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      @media (max-width: 560px) {
        #havenfallRuntimeLoadingOverlay { padding: 16px; }
        #havenfallRuntimeLoadingOverlay .runtime-loading-card { width: 100%; padding: 18px; }
        #havenfallRuntimeLoadingOverlay .runtime-loading-title { font-size: 32px; }
        #havenfallRuntimeLoadingOverlay .runtime-loading-meta { flex-direction: column; gap: 4px; }
        #havenfallRuntimeLoadingOverlay .runtime-loading-detail { white-space: normal; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureRuntimeLoadingOverlay() {
    ensureRuntimeLoadingStyle();
    let overlay = document.getElementById('havenfallRuntimeLoadingOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'havenfallRuntimeLoadingOverlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.setAttribute('aria-label', 'Carregando HavenFall');
    overlay.innerHTML = `
      <div class="runtime-loading-card">
        <div class="runtime-loading-kicker">HavenFall</div>
        <h2 id="runtimeLoadingTitle" class="runtime-loading-title">Carregando</h2>
        <div id="runtimeLoadingStatus" class="runtime-loading-status">Preparando...</div>
        <div class="runtime-loading-bar" aria-hidden="true"><div id="runtimeLoadingFill" class="runtime-loading-fill"></div></div>
        <div class="runtime-loading-meta"><span id="runtimeLoadingDetail" class="runtime-loading-detail">Preparando sistemas</span><span id="runtimeLoadingPercent">0%</span></div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function setRuntimeLoading(label, progress, detail = '') {
    const overlay = ensureRuntimeLoadingOverlay();
    const pct = Math.max(0, Math.min(100, Math.round(Number(progress || 0))));
    const title = document.getElementById('runtimeLoadingTitle');
    const status = document.getElementById('runtimeLoadingStatus');
    const fill = document.getElementById('runtimeLoadingFill');
    const meta = document.getElementById('runtimeLoadingDetail');
    const percent = document.getElementById('runtimeLoadingPercent');
    if (title) title.textContent = label || 'Carregando';
    if (status) status.textContent = detail || 'Preparando...';
    if (fill) fill.style.width = `${pct}%`;
    if (meta) meta.textContent = detail || 'Preparando sistemas';
    if (percent) percent.textContent = `${pct}%`;
    overlay.classList.add('show');
    document.body.classList.add('runtime-loading-active');
  }

  function hideRuntimeLoading(delay = 240) {
    const overlay = document.getElementById('havenfallRuntimeLoadingOverlay');
    if (!overlay) return;
    setTimeout(() => {
      overlay.classList.remove('show');
      document.body.classList.remove('runtime-loading-active');
    }, Math.max(0, Number(delay) || 0));
  }

  function withLoading(label, detail, work, options = {}) {
    const start = Number(options.start ?? 10);
    const middle = Number(options.middle ?? 58);
    const delay = Number(options.delay ?? 70);
    const hideDelay = Number(options.hideDelay ?? 240);
    setRuntimeLoading(label || 'Carregando', start, detail || 'Preparando');

    setTimeout(() => {
      try {
        setRuntimeLoading(label || 'Carregando', middle, options.middleDetail || detail || 'Processando');
        const result = typeof work === 'function' ? work() : null;
        const finish = () => {
          setRuntimeLoading(options.doneLabel || 'Concluído', 100, options.doneDetail || 'Pronto');
          hideRuntimeLoading(hideDelay);
        };
        if (result && typeof result.then === 'function') result.then(finish).catch(error => {
          setRuntimeLoading('Falha no carregamento', 100, error?.message || String(error));
          console.error(error);
        });
        else finish();
      } catch (error) {
        setRuntimeLoading('Falha no carregamento', 100, error?.message || String(error));
        console.error(error);
        throw error;
      }
    }, Math.max(0, delay));
  }

  function syncSpeedButtons() {
    document.querySelectorAll('[data-speed]').forEach(btn => {
      const active = !!state && Number(btn.dataset.speed) === Number(state.speed || 1) && appScreen === SCREEN.PLAYING;
      btn.classList.toggle('active', active);
    });
  }

  function cancelZoneToolForAction(reason = 'outra ação selecionada') {
    if (typeof clearZoneTool === 'function') clearZoneTool(reason);
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
    if (!state || !buildKey) return false;
    if (typeof isBuildUnlocked === 'function' && !isBuildUnlocked(buildKey)) {
      const req = buildDefs?.[buildKey]?.requires;
      if (typeof log === 'function') log(`Bloqueado: pesquise ${researchDefs?.[req]?.label || 'tecnologia'} primeiro.`);
      if (typeof updateUI === 'function') updateUI(true);
      return false;
    }

    cancelZoneToolForAction('construcao selecionada');
    currentBuild = buildKey;
    if (typeof resetBuildRotationIfNeeded === 'function') resetBuildRotationIfNeeded(buildKey);
    if (typeof log === 'function') log(`Construcao selecionada: ${buildDefs?.[buildKey]?.label || buildKey}. Clique no mapa para posicionar.`);
    if (typeof updateUI === 'function') updateUI(true);
    return true;
  }

  window.selectBuildTool = selectBuildTool;

  function setGameSpeed(speed) {
    if (!state || state.isPreview) return;
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

  function openPlanetScanFromSetup() {
    withLoading('Calculando setor', 'Lendo seed, dificuldade e recursos iniciais', () => {
      newGameConfig = typeof ensurePlanetScanOnConfig === 'function' ? ensurePlanetScanOnConfig(readNewGameConfig()) : readNewGameConfig();
      writeNewGameConfig(newGameConfig);
      if (typeof refreshPlanetScan === 'function') refreshPlanetScan(newGameConfig);
      setScreen(SCREEN.PLANET_SCAN);
    }, { middleDetail: 'Gerando varredura planetária', doneLabel: 'Varredura pronta', doneDetail: 'Setor preparado' });
  }

  function continueFromPlanetScan() {
    withLoading('Preparando colonos', 'Gerando fichas da expedição', () => {
      newGameConfig = typeof ensurePlanetScanOnConfig === 'function'
        ? ensurePlanetScanOnConfig(newGameConfig || readNewGameConfig())
        : { ...(newGameConfig || readNewGameConfig()), planetScan: typeof buildPlanetScanWorldgenProfile === 'function' ? buildPlanetScanWorldgenProfile(newGameConfig || readNewGameConfig()) : null };
      generateColonistCandidates(newGameConfig);
      if (typeof activeRecruitmentCandidateIndex === 'number') activeRecruitmentCandidateIndex = 0;
      setScreen(SCREEN.COLONIST_SELECT);
    }, { middleDetail: 'Calculando perfis, habilidades e cobertura', doneLabel: 'Colonos prontos', doneDetail: 'Seleção preparada' });
  }

  function worldMapOverlayOpen() {
    return !!document.getElementById('worldMapOverlay')?.classList.contains('open');
  }

  function requestGameExit() {
    if (window.HavenfallDesktop?.quit) {
      window.HavenfallDesktop.quit();
      return;
    }
    if (typeof refreshMenuSaveInfo === 'function') refreshMenuSaveInfo();
    alert('Para sair no navegador, feche a aba do jogo.');
  }

  function requestDeleteSave() {
    if (!confirm('Apagar o save atual? Isso remove o save do navegador e, no desktop, também remove o arquivo de save.')) return;
    const result = typeof deleteGameSave === 'function'
      ? deleteGameSave()
      : (() => {
          localStorage.removeItem(SAVE_KEY);
          activeSession = false;
          refreshMenuSaveInfo?.();
          refreshLoadScreen?.();
          return { ok: true };
        })();
    if (typeof log === 'function') log(result?.ok ? 'Save apagado.' : 'Falha ao apagar o save.');
    syncSpeedButtons();
  }

  function handleDelegatedClick(event) {
    const target = eventTargetElement(event);
    if (!target) return;

    if (isLegacyHudClick(target)) {
      event.preventDefault();
      event.stopPropagation();
      window.uiManager?.closeAllOldModals?.();
      return;
    }

    const personnelFile = target.closest('[data-recruitment-candidate]');
    if (personnelFile && typeof selectRecruitmentCandidate === 'function') {
      event.preventDefault();
      selectRecruitmentCandidate(Number(personnelFile.dataset.recruitmentCandidate));
      return;
    }

    const skill = target.closest('[data-builder-skill][data-builder-index][data-builder-delta]');
    if (skill) {
      event.preventDefault();
      updateColonistBuilderSkill(Number(skill.dataset.builderIndex), skill.dataset.builderSkill, Number(skill.dataset.builderDelta));
      return;
    }

    const reroll = target.closest('[data-reroll-colonist]');
    if (reroll) {
      event.preventDefault();
      applyColonistBuilderPreset(Number(reroll.dataset.rerollColonist), 'balanced');
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
      cancelZoneToolForAction();
      const c = selectedColonist();
      const station = selectedCraftStationId ? state.objects.find(o => String(o.id) === String(selectedCraftStationId)) : null;
      if (c) assignCraft(c, craft.dataset.craft, station);
      updateUI(true);
      return;
    }

    const equip = target.closest('[data-equip-item]');
    if (equip && state && typeof selectedColonist === 'function') {
      cancelZoneToolForAction();
      const c = selectedColonist();
      if (c) equipItem(c, equip.dataset.equipItem);
      return;
    }

    const unequip = target.closest('[data-unequip-slot]');
    if (unequip && state && typeof selectedColonist === 'function') {
      cancelZoneToolForAction();
      const c = selectedColonist();
      if (c) unequipSlot(c, unequip.dataset.unequipSlot);
      return;
    }

    const tab = target.closest('[data-tab]');
    if (tab && !target.closest('#bottomActionBar, #hud')) {
      if (tab.dataset.tab !== 'zones') cancelZoneToolForAction('aba trocada');
      setHudTab(tab.dataset.tab);
      return;
    }

    const build = target.closest('[data-build]');
    if (build && !target.closest('#hud, #bottomActionBar')) {
      selectBuildTool(build.dataset.build);
      return;
    }

    const speed = target.closest('[data-speed]');
    if (speed) {
      setGameSpeed(speed.dataset.speed);
    }
  }

  function handleDelegatedChange(event) {
    const preset = event.target.closest?.('[data-builder-preset]');
    if (preset) {
      applyColonistBuilderPreset(Number(preset.dataset.builderPreset), preset.value);
      return;
    }

    const field = event.target.closest?.('[data-builder-field][data-builder-index]');
    if (field) {
      updateColonistBuilderField(Number(field.dataset.builderIndex), field.dataset.builderField, field.value);
    }
  }

  function handleDelegatedInput(event) {
    const field = event.target.closest?.('[data-builder-field][data-builder-index]');
    if (!field || field.dataset.builderField !== 'name') return;
    updateColonistBuilderField(Number(field.dataset.builderIndex), 'name', field.value);
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

    if (state && appScreen === SCREEN.PLAYING && event.code === 'KeyR' && currentBuild) {
      if (typeof rotateCurrentBuild === 'function' && rotateCurrentBuild()) {
        event.preventDefault();
        return;
      }
    }

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
      if (worldMapOverlayOpen()) {
        event.preventDefault();
        window.HavenfallWorldMapUI?.close?.();
        return;
      }
      if (window.uiManager?.closeCurrentPanel) window.uiManager.closeCurrentPanel();
      if (appScreen === SCREEN.PLAYING) setScreen(SCREEN.PAUSED);
      else if (appScreen === SCREEN.PAUSED) setScreen(SCREEN.PLAYING);
      else if (appScreen === SCREEN.COLONIST_SELECT) setScreen(SCREEN.PLANET_SCAN);
      else if (appScreen === SCREEN.PLANET_SCAN) setScreen(SCREEN.NEW_GAME_SETUP);
      else if (appScreen !== SCREEN.MAIN_MENU) setScreen(SCREEN.MAIN_MENU);
      currentBuild = null;
      cancelZoneToolForAction('ESC');
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

    on(dom.buttons.continue, 'click', () => withLoading('Carregando continuação', 'Verificando sessão ou save local', () => { continueFromMenu(); syncSpeedButtons(); }, { middleDetail: 'Restaurando estado da colônia', doneLabel: 'Partida pronta', doneDetail: 'Entrando no jogo' }));
    on(dom.buttons.newGame, 'click', () => {
      writeNewGameConfig({ ...defaultNewGameConfig, seed: generateRandomSeed() });
      setScreen(SCREEN.NEW_GAME_SETUP);
    });
    on(dom.buttons.openLoad, 'click', () => { refreshLoadScreen?.(); setScreen(SCREEN.LOAD_GAME); });
    on(dom.buttons.openSettings, 'click', () => setScreen(SCREEN.SETTINGS));
    on(dom.buttons.exit, 'click', requestGameExit);
    on(dom.buttons.setupBack, 'click', () => setScreen(SCREEN.MAIN_MENU));
    on(dom.buttons.setupNext, 'click', openPlanetScanFromSetup);
    on(dom.buttons.scanBack, 'click', () => setScreen(SCREEN.NEW_GAME_SETUP));
    on(dom.buttons.scanRefresh, 'click', () => withLoading('Gerando novo setor', 'Atualizando seed e varredura', () => {
      if (dom.inputs.worldSeed) dom.inputs.worldSeed.value = generateRandomSeed();
      newGameConfig = typeof ensurePlanetScanOnConfig === 'function' ? ensurePlanetScanOnConfig(readNewGameConfig()) : readNewGameConfig();
      if (typeof refreshPlanetScan === 'function') refreshPlanetScan(newGameConfig);
      updateSetupSummary();
    }, { middleDetail: 'Recalculando assinaturas planetárias', doneLabel: 'Novo setor pronto', doneDetail: 'Leitura atualizada' }));
    on(dom.buttons.scanProceed, 'click', continueFromPlanetScan);
    on(dom.buttons.randomSeed, 'click', () => {
      if (dom.inputs.worldSeed) dom.inputs.worldSeed.value = generateRandomSeed();
      newGameConfig = null;
      updateSetupSummary();
    });

    Object.values(dom.inputs)
      .filter(Boolean)
      .filter(el => ['colonyNameInput','worldSeedInput','difficultySelect','colonist-count','colonistCountSelect','resourcesPresetSelect','eventIntensitySelect','mapSizeSelect'].includes(el.id))
      .forEach(el => {
        on(el, 'input', updateSetupSummary);
        on(el, 'change', updateSetupSummary);
      });

    on(dom.buttons.colonistBack, 'click', () => setScreen(SCREEN.PLANET_SCAN));
    if (dom.buttons.rerollAll) dom.buttons.rerollAll.hidden = true;
    on(dom.buttons.startSelectedGame, 'click', () => {
      const validation = typeof validateColonistBuilders === 'function' ? validateColonistBuilders() : { ok: true };
      if (!validation.ok) {
        renderColonistSelection?.();
        return;
      }
      withLoading('Gerando mundo', 'Criando terreno, biomas e recursos', () => {
        newGameConfig = typeof ensurePlanetScanOnConfig === 'function'
          ? ensurePlanetScanOnConfig(newGameConfig || readNewGameConfig())
          : (newGameConfig || readNewGameConfig());
        setRuntimeLoading('Validando seed', 72, 'Aplicando ecossistema, spawn e POIs');
        startNewGame(newGameConfig, colonistCandidates);
        window.HavenfallRuntime?.markGameplayState?.(state);
        syncSpeedButtons();
      }, { middle: 46, middleDetail: 'Preparando colonos e ponto de pouso', doneLabel: 'Mundo pronto', doneDetail: 'Entrando na colônia', hideDelay: 360 });
    });
    on(dom.buttons.loadBack, 'click', () => setScreen(SCREEN.MAIN_MENU));
    on(dom.buttons.loadSlot, 'click', () => withLoading('Carregando save', 'Lendo save local', () => { loadAndPlay(); syncSpeedButtons(); }, { middleDetail: 'Restaurando mundo, colonos e tarefas', doneLabel: 'Save carregado', doneDetail: 'Entrando na colônia' }));
    on(dom.buttons.deleteSave, 'click', requestDeleteSave);

    on(dom.buttons.settingsBack, 'click', goBackFromSettings);
    if (dom.inputs.uiScale) dom.inputs.uiScale.value = settings.uiScale || 'normal';
    if (dom.inputs.autosave) dom.inputs.autosave.value = settings.autosave || 'on';
    on(dom.inputs.uiScale, 'change', e => { settings.uiScale = e.target.value; saveSettings(); });
    on(dom.inputs.autosave, 'change', e => { settings.autosave = e.target.value; saveSettings(); });

    document.addEventListener('click', handleDelegatedClick);
    document.addEventListener('change', handleDelegatedChange);
    document.addEventListener('input', handleDelegatedInput);

    on(dom.buttons.cancelBuild, 'click', () => { currentBuild = null; updateUI(true); });
    on(dom.buttons.pause, 'click', () => { setScreen(appScreen === SCREEN.PLAYING ? SCREEN.PAUSED : SCREEN.PLAYING); syncSpeedButtons(); });
    on(dom.buttons.pauseMenu, 'click', () => { setScreen(SCREEN.PAUSED); syncSpeedButtons(); });
    on(dom.buttons.resume, 'click', () => { setScreen(SCREEN.PLAYING); syncSpeedButtons(); });
    on(dom.buttons.pauseSave, 'click', () => withLoading('Salvando partida', 'Gravando estado da colônia', () => { saveGame(true); updateUI(true); }, { middleDetail: 'Escrevendo save local', doneLabel: 'Partida salva', doneDetail: 'Save atualizado', hideDelay: 220 }));
    on(dom.buttons.pauseLoad, 'click', () => withLoading('Carregando save', 'Lendo save local', () => { loadAndPlay(); syncSpeedButtons(); }, { middleDetail: 'Restaurando mundo, colonos e tarefas', doneLabel: 'Save carregado', doneDetail: 'Entrando na colônia' }));
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
