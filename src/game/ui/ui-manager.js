'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};

  const PANELS = {
    build: 'Construção',
    research: 'Pesquisa',
    crafting: 'Crafting',
    zones: 'Zonas',
    colonists: 'Colonos',
    tasks: 'Tarefas',
    selected: 'Selecionado',
    events: 'Eventos'
  };

  const BUILD_GROUPS = {
    structure: { label: 'Estrutura', items: ['wall', 'door', 'crate'] },
    furniture: { label: 'Mobília', items: ['bed', 'campfire', 'bench', 'research_desk'] },
    production: { label: 'Produção', items: ['forge', 'stove', 'med_station'] },
    agriculture: { label: 'Agricultura', items: ['crop'] }
  };

  function isGameplayScreen() {
    return typeof SCREEN !== 'undefined' && (appScreen === SCREEN.PLAYING || appScreen === SCREEN.PAUSED);
  }

  function closeAllOldModals() {
    document.getElementById('ui-modal-backdrop')?.classList.remove('is-active', 'show');
    document.querySelectorAll('[id^="modal-"]').forEach(modal => {
      modal.classList.remove('is-active', 'show', 'active');
      modal.setAttribute('aria-hidden', 'true');
      modal.hidden = true;
    });
    document.querySelectorAll('.game-popup-modal:not(#eventModal):not(#pauseOverlay)').forEach(modal => {
      modal.classList.remove('is-active', 'show', 'active');
      modal.setAttribute('aria-hidden', 'true');
      modal.hidden = true;
    });
    document.querySelectorAll('#bottomActionBar .active, #hud .active, [data-tab].active, [data-ui-modal].is-active').forEach(el => {
      el.classList.remove('active', 'is-active');
    });
  }

  function disableLegacyHud() {
    document.body.classList.add('ui-modern-panels');
    ['hud', 'bottomActionBar'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.hidden = true;
      el.setAttribute('aria-hidden', 'true');
      el.classList.remove('active', 'is-active', 'show');
    });
    document.querySelectorAll('#hud [data-panel], #bottomActionBar [data-tab]').forEach(el => {
      el.classList.remove('active', 'is-active', 'show');
      el.setAttribute('aria-hidden', 'true');
    });
    closeAllOldModals();
  }

  function ensureResourceBar() {
    let bar = document.getElementById('top-resource-bar');
    const topBar = document.getElementById('topBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'top-resource-bar';
      bar.className = 'top-resource-bar';
      if (topBar) {
        const actions = topBar.querySelector('.top-actions');
        topBar.insertBefore(bar, actions || null);
      } else {
        document.body.prepend(bar);
      }
    }
    bar.classList.add('top-resource-bar');
    bar.innerHTML = [
      '<div class="res-item" title="Comida"><span class="res-icon">🥩</span> Comida <b id="resFood">0</b><span id="txt-food" hidden>0</span></div>',
      '<div class="res-item" title="Madeira"><span class="res-icon">🪵</span> Madeira <b id="resWood">0</b><span id="txt-wood" hidden>0</span></div>',
      '<div class="res-item" title="Pedra"><span class="res-icon">🪨</span> Pedra <b id="resStone">0</b><span id="txt-stone" hidden>0</span></div>',
      '<div class="res-item" title="Metal"><span class="res-icon">🪙</span> Metal <b id="resMetal">0</b><span id="txt-metal" hidden>0</span></div>',
      '<div class="res-item" title="Remédios"><span class="res-icon">💊</span> Remédios <b id="resMedicine">0</b><span id="txt-meds" hidden>0</span></div>'
    ].join('');
  }

  function ensureDock() {
    if (!document.getElementById('bottom-navigation-dock')) {
      const dock = document.createElement('nav');
      dock.id = 'bottom-navigation-dock';
      dock.setAttribute('aria-label', 'Navegação de jogo');
      dock.innerHTML = [
        ...Object.entries(PANELS).map(([key, label]) => `<button type="button" data-ui-panel="${key}">${label}</button>`),
        '<button type="button" data-speed="1">1x</button>',
        '<button type="button" data-speed="2">2x</button>',
        '<button type="button" data-speed="3">3x</button>'
      ].join('');
      document.body.appendChild(dock);
    }

    if (!document.getElementById('anchored-ui-panel')) {
      const panel = document.createElement('section');
      panel.id = 'anchored-ui-panel';
      panel.className = 'anchored-ui-panel';
      panel.setAttribute('aria-hidden', 'true');
      panel.innerHTML = '<header class="anchored-ui-header"><h3 id="anchoredPanelTitle">Painel</h3><button type="button" data-close-ui-panel>Fechar</button></header><div id="anchoredPanelBody" class="anchored-ui-body"></div>';
      document.body.appendChild(panel);
    }
  }

  function stopUiPointerPropagation() {
    ['bottom-navigation-dock', 'anchored-ui-panel', 'topBar', 'top-resource-bar', 'research-tree-overlay'].forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.dataset.uiStopPropagation === '1') return;
      el.dataset.uiStopPropagation = '1';
      ['pointerdown', 'mousedown', 'click', 'contextmenu', 'wheel'].forEach(type => {
        el.addEventListener(type, event => event.stopPropagation(), { passive: type === 'wheel' ? false : true });
      });
    });
  }

  function syncResources() {
    if (!state?.resources) return;
    const pairs = [
      ['resFood', 'txt-food', state.resources.food],
      ['resWood', 'txt-wood', state.resources.wood],
      ['resStone', 'txt-stone', state.resources.stone],
      ['resMetal', 'txt-metal', state.resources.metal],
      ['resMedicine', 'txt-meds', state.resources.medicine]
    ];
    pairs.forEach(([visibleId, hiddenId, value]) => {
      const text = Math.floor(value || 0);
      const visible = document.getElementById(visibleId);
      const hidden = document.getElementById(hiddenId);
      if (visible) visible.textContent = text;
      if (hidden) hidden.textContent = text;
    });
  }

  function updateVisibility() {
    const visible = isGameplayScreen();
    document.body.classList.toggle('ui-gameplay-active', visible);
    document.body.classList.add('ui-modern-panels');
    const dock = document.getElementById('bottom-navigation-dock');
    const panel = document.getElementById('anchored-ui-panel');
    const top = document.getElementById('top-resource-bar');
    if (dock) dock.hidden = !visible;
    if (top) top.hidden = !visible;
    disableLegacyHud();
    if (!visible && panel) closePanel();
  }

  function activeButton(key) {
    document.querySelectorAll('#bottom-navigation-dock [data-ui-panel]').forEach(button => {
      button.classList.toggle('is-active', button.dataset.uiPanel === key);
    });
  }

  function resourceName(resource) {
    if (typeof resourceLabel === 'function') return resourceLabel(resource);
    return ({ food: 'comida', wood: 'madeira', stone: 'pedra', metal: 'metal', medicine: 'remédio' })[resource] || resource;
  }

  function resourceIcon(resource) {
    return ({ food: '🥩', wood: '🪵', stone: '🪨', metal: '🪙', medicine: '💊' })[resource] || '';
  }

  function buildDescription(key) {
    return ({
      wall: 'Define defesa e layout da base.',
      door: 'Cria passagem controlada.',
      crate: 'Organiza recursos e loot.',
      bed: 'Recuperação e descanso.',
      campfire: 'Fogo, calor e sobrevivência inicial.',
      bench: 'Base de ferramentas e armas.',
      research_desk: 'Desbloqueia progresso tecnológico.',
      forge: 'Produção metálica.',
      stove: 'Preparo de refeições.',
      med_station: 'Tratamento e resgate.',
      crop: 'Produção agrícola.'
    })[key] || 'Construção disponível para a colônia.';
  }

  function renderBuildPanel() {
    const activeGroup = window.HavenfallUI.activeBuildGroup || 'structure';
    const tabs = Object.entries(BUILD_GROUPS).map(([key, group]) => `<button type="button" class="${key === activeGroup ? 'is-active' : ''}" data-build-group="${key}">${group.label}</button>`).join('');
    const group = BUILD_GROUPS[activeGroup] || BUILD_GROUPS.structure;
    const cards = (group.items || []).map(key => {
      const def = buildDefs?.[key];
      if (!def) return '';
      const cost = Object.entries(def.cost || {}).map(([resource, value]) => `<span class="cost-badge">${resourceIcon(resource)} ${resourceName(resource)} x${value}</span>`).join('') || '<span class="cost-badge">sem custo</span>';
      const locked = typeof isBuildUnlocked === 'function' && !isBuildUnlocked(key);
      return `<button type="button" class="anchored-build-card ${locked ? 'locked' : ''}" data-build="${key}"><strong>${escapeHtml(def.label || key)}</strong><small>${escapeHtml(buildDescription(key))}</small><span>${cost}</span></button>`;
    }).join('');
    return `<div class="anchored-subtabs">${tabs}</div><div class="anchored-build-grid">${cards}</div>`;
  }

  function sanitizeLegacyPanelForAnchor(key) {
    const legacy = document.querySelector(`#hud [data-panel="${key}"], .bottom-panel-content [data-panel="${key}"]`);
    if (!legacy) return null;
    legacy.classList.remove('active', 'is-active', 'game-popup-modal', 'modal', 'modal-box');
    legacy.hidden = false;
    legacy.removeAttribute('aria-hidden');
    return legacy;
  }

  function panelHtml(key) {
    if (key === 'build') return renderBuildPanel();
    const legacy = sanitizeLegacyPanelForAnchor(key);
    if (legacy) return legacy;
    return `<p class="empty">Painel ${escapeHtml(PANELS[key] || key)} em preparação.</p>`;
  }

  function openPanel(key) {
    closeAllOldModals();
    disableLegacyHud();
    if (key === 'research') {
      closePanel();
      if (window.HavenfallUI?.openResearchOverlay) window.HavenfallUI.openResearchOverlay();
      return;
    }
    updateVisibility();
    if (!isGameplayScreen()) return;
    const panel = document.getElementById('anchored-ui-panel');
    const title = document.getElementById('anchoredPanelTitle');
    const body = document.getElementById('anchoredPanelBody');
    if (!panel || !title || !body) return;
    title.textContent = PANELS[key] || key;
    const content = panelHtml(key);
    body.innerHTML = '';
    if (typeof content === 'string') body.innerHTML = content;
    else body.appendChild(content);
    closeAllOldModals();
    panel.classList.add('is-active');
    panel.setAttribute('aria-hidden', 'false');
    activeHudTab = key;
    activeButton(key);
    stopUiPointerPropagation();
  }

  function closePanel() {
    const panel = document.getElementById('anchored-ui-panel');
    if (panel) {
      panel.classList.remove('is-active');
      panel.setAttribute('aria-hidden', 'true');
    }
    closeAllOldModals();
    activeButton(null);
  }

  function handleDockClick(event) {
    const button = event.target.closest('[data-ui-panel]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const key = button.dataset.uiPanel;
    const panel = document.getElementById('anchored-ui-panel');
    if (key !== 'research' && panel?.classList.contains('is-active') && activeHudTab === key) closePanel();
    else openPanel(key);
  }

  function handlePanelClick(event) {
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (event.target.closest('[data-close-ui-panel]')) {
      event.preventDefault();
      closePanel();
      return;
    }
    const tab = event.target.closest('[data-build-group]');
    if (tab) {
      event.preventDefault();
      window.HavenfallUI.activeBuildGroup = tab.dataset.buildGroup;
      openPanel('build');
      return;
    }
    const build = event.target.closest('[data-build]');
    if (build) {
      event.preventDefault();
      const key = build.dataset.build;
      if (typeof isBuildUnlocked === 'function' && !isBuildUnlocked(key)) {
        const req = buildDefs?.[key]?.requires;
        if (typeof log === 'function') log(`Bloqueado: pesquise ${researchDefs?.[req]?.label || 'tecnologia'} primeiro.`);
        return;
      }
      currentBuild = key;
      if (typeof clearZoneTool === 'function') clearZoneTool('construção selecionada');
      if (typeof log === 'function') log(`Construção selecionada: ${buildDefs?.[key]?.label || key}. Clique no mapa para posicionar.`);
      closePanel();
      if (typeof updateUI === 'function') updateUI(true);
    }
  }

  function blockLegacyUiEvents(event) {
    const target = event.target?.closest?.('[data-ui-modal], #ui-modal-backdrop, [id^="modal-"], #bottomActionBar [data-tab], #hud [data-tab], #hud [data-build]');
    if (!target) return;
    if (target.closest('#eventModal, #pauseOverlay, #anchored-ui-panel, #bottom-navigation-dock, .research-tree-overlay')) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    closeAllOldModals();
  }

  function installEvents() {
    const dock = document.getElementById('bottom-navigation-dock');
    const panel = document.getElementById('anchored-ui-panel');
    if (dock && dock.dataset.uiManagerEvents !== '1') {
      dock.dataset.uiManagerEvents = '1';
      dock.addEventListener('click', handleDockClick);
    }
    if (panel && panel.dataset.uiManagerEvents !== '1') {
      panel.dataset.uiManagerEvents = '1';
      panel.addEventListener('click', handlePanelClick);
    }
    if (!window.HavenfallUI.legacyEventBlockerInstalled) {
      document.addEventListener('click', blockLegacyUiEvents, true);
      document.addEventListener('pointerdown', blockLegacyUiEvents, true);
      window.HavenfallUI.legacyEventBlockerInstalled = true;
    }
  }

  function patchGameUiHooks() {
    if (typeof setHudTab === 'function') setHudTab = tab => { activeHudTab = tab || activeHudTab || 'build'; };
    if (typeof setScreen === 'function' && !window.HavenfallUI.screenHooked) {
      const originalSetScreen = setScreen;
      setScreen = screen => {
        originalSetScreen(screen);
        updateVisibility();
      };
      window.HavenfallUI.screenHooked = true;
    }
    if (typeof updateUI === 'function' && !window.HavenfallUI.updateHooked) {
      const originalUpdateUI = updateUI;
      updateUI = force => {
        originalUpdateUI(force);
        ensureResourceBar();
        syncResources();
        updateVisibility();
        stopUiPointerPropagation();
        closeAllOldModals();
      };
      window.HavenfallUI.updateHooked = true;
    }
    if (typeof openCraftingForStation === 'function' && !window.HavenfallUI.craftingHooked) {
      const originalOpenCrafting = openCraftingForStation;
      openCraftingForStation = station => {
        originalOpenCrafting(station);
        openPanel('crafting');
      };
      window.HavenfallUI.craftingHooked = true;
    }
  }

  function initUiManager() {
    ensureResourceBar();
    ensureDock();
    disableLegacyHud();
    installEvents();
    patchGameUiHooks();
    syncResources();
    updateVisibility();
    stopUiPointerPropagation();
  }

  window.uiManager = {
    openPanel,
    closeCurrentPanel: closePanel,
    closeCurrentModal: closePanel,
    closeAllOldModals,
    togglePanel: key => document.getElementById('anchored-ui-panel')?.classList.contains('is-active') && activeHudTab === key ? closePanel() : openPanel(key),
    syncResources,
    refreshVisibility: updateVisibility,
    refreshOpenModal: updateVisibility
  };

  initUiManager();
})();
