'use strict';

(() => {
  window.HavenfallContext = window.HavenfallContext || {};

  const PANEL_TITLES = Object.freeze({
    build: 'Construção',
    tasks: 'Tarefas',
    research: 'Pesquisa',
    crafting: 'Crafting',
    zones: 'Zonas',
    colonists: 'Colonos',
    selected: 'Selecionado',
    events: 'Eventos'
  });

  const RESOURCE_BAR_HTML = `
    <div id="top-resource-bar" class="ui-clean-top-bar" aria-label="Recursos da colônia">
      <div class="ui-clean-res"><img src="assets/sprites/icon_food.png" alt="">Comida <b id="txt-food">0</b></div>
      <div class="ui-clean-res"><img src="assets/sprites/icon_wood.png" alt="">Madeira <b id="txt-wood">0</b></div>
      <div class="ui-clean-res"><img src="assets/sprites/icon_stone.png" alt="">Pedra <b id="txt-stone">0</b></div>
      <div class="ui-clean-res"><img src="assets/sprites/icon_metal.png" alt="">Metal <b id="txt-metal">0</b></div>
      <div class="ui-clean-res"><img src="assets/sprites/icon_health.png" alt="">Remédios <b id="txt-meds">0</b></div>
    </div>
  `;

  const DOCK_HTML = `
    <nav id="bottom-navigation-dock" class="ui-clean-bottom-dock" aria-label="Navegação da interface">
      <button type="button" data-open-ui-modal="build">Construir</button>
      <button type="button" data-open-ui-modal="research">Pesquisa</button>
      <button type="button" data-open-ui-modal="crafting">Crafting</button>
      <button type="button" data-open-ui-modal="zones">Zonas</button>
      <button type="button" data-open-ui-modal="colonists">Colonos</button>
      <button type="button" data-open-ui-modal="tasks">Tarefas</button>
      <button type="button" data-open-ui-modal="selected">Selecionado</button>
      <button type="button" data-open-ui-modal="events">Eventos</button>
      <span class="ui-clean-speed" aria-label="Velocidade do jogo">
        <button type="button" data-speed="1">1x</button>
        <button type="button" data-speed="2">2x</button>
        <button type="button" data-speed="3">3x</button>
      </span>
    </nav>
  `;

  const CLEAN_CSS = `
    /* ALFA 1.0 UI CLEAN RESET — camada independente do HUD antigo */
    #hud,
    .bottom-command-panel,
    .component-hud,
    .bottom-action-bar,
    .component-bottomactionbar {
      all: unset !important;
      display: contents !important;
      pointer-events: none !important;
    }

    #hud .bottom-tabs,
    #hud .speed-inline,
    #hud #bottomActionBar,
    #hud [data-tab="resources"],
    #resourcePanel {
      display: none !important;
    }

    body.ui-clean-modal-open #game { cursor: default; }

    .ui-clean-top-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 2000;
      min-height: 42px;
      padding: 6px 14px 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: clamp(8px, 1.8vw, 24px);
      color: #fff7e8;
      background: linear-gradient(180deg, rgba(0,0,0,.86), rgba(0,0,0,.42) 70%, transparent);
      font: 800 13px Inter, system-ui, sans-serif;
      text-shadow: 0 2px 10px rgba(0,0,0,.75);
      pointer-events: auto;
    }

    .ui-clean-res {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      white-space: nowrap;
      padding: 5px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.10);
      background: rgba(8, 13, 21, .52);
      backdrop-filter: blur(12px) saturate(1.15);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
    }

    .ui-clean-res img {
      width: 20px;
      height: 20px;
      object-fit: contain;
      filter: drop-shadow(0 2px 5px rgba(0,0,0,.45));
    }

    .ui-clean-res b {
      color: #f4c95d;
      font-weight: 950;
      min-width: 22px;
      text-align: right;
    }

    .ui-clean-bottom-dock {
      position: fixed;
      left: 50%;
      bottom: 18px;
      transform: translateX(-50%);
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      max-width: calc(100vw - 24px);
      padding: 10px 14px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(13, 20, 33, .86);
      box-shadow: 0 22px 70px rgba(0,0,0,.58), inset 0 1px 0 rgba(255,255,255,.08);
      backdrop-filter: blur(18px) saturate(1.2);
      pointer-events: auto;
    }

    .ui-clean-bottom-dock button {
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 999px;
      padding: 9px 13px;
      min-height: 38px;
      background: rgba(255,255,255,.075);
      color: #f8efe0;
      font-weight: 900;
      font-size: 12px;
      letter-spacing: -.01em;
      cursor: pointer;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
      transition: transform .08s ease, background .08s ease, border-color .08s ease;
      white-space: nowrap;
    }

    .ui-clean-bottom-dock button:hover {
      transform: translateY(-1px);
      background: rgba(255,255,255,.12);
      border-color: rgba(244,201,93,.55);
    }

    .ui-clean-bottom-dock button.is-active,
    .ui-clean-bottom-dock button.active {
      background: linear-gradient(180deg, rgba(227,169,63,.44), rgba(120,78,24,.55));
      border-color: rgba(255,220,130,.72);
      color: #fff8e9;
    }

    .ui-clean-speed {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      margin-left: 4px;
      padding-left: 10px;
      border-left: 1px solid rgba(255,255,255,.12);
    }

    .ui-clean-scrim {
      position: fixed;
      inset: 0;
      z-index: 2100;
      display: none;
      background: rgba(0,0,0,.20);
      pointer-events: auto;
    }

    .ui-clean-scrim.is-active { display: block; }

    .game-popup-modal {
      position: fixed !important;
      top: 50% !important;
      left: 50% !important;
      z-index: 2200 !important;
      display: none !important;
      width: min(820px, calc(100vw - 28px)) !important;
      max-height: min(78vh, 760px) !important;
      overflow: auto !important;
      transform: translate(-50%, -50%) scale(.98) !important;
      padding: 20px !important;
      border-radius: 22px !important;
      border: 1px solid rgba(134, 165, 225, .38) !important;
      background: linear-gradient(180deg, rgba(21, 30, 49, .96), rgba(13, 19, 32, .96)) !important;
      color: #f8efe0 !important;
      box-shadow: 0 30px 100px rgba(0,0,0,.74), inset 0 1px 0 rgba(255,255,255,.08) !important;
      backdrop-filter: blur(18px) saturate(1.18) !important;
      pointer-events: auto !important;
    }

    .game-popup-modal.is-active {
      display: block !important;
      transform: translate(-50%, -50%) scale(1) !important;
    }

    .game-popup-modal::before {
      content: attr(data-modal-title);
      display: block;
      margin: 0 88px 10px 0;
      color: #f4c95d;
      font-size: 12px;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: .16em;
    }

    .game-popup-modal .ui-clean-close {
      position: sticky;
      top: 0;
      float: right;
      z-index: 2;
      margin: -6px -6px 10px 12px;
      border-radius: 999px;
      padding: 8px 11px;
    }

    .game-popup-modal .build-grid,
    .game-popup-modal .recipe-grid {
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)) !important;
    }

    .game-popup-modal #log {
      height: auto !important;
      max-height: 48vh !important;
      overflow: auto !important;
      column-count: 1 !important;
    }

    .game-popup-modal .selected-info-inline,
    .game-popup-modal .goals ul,
    .game-popup-modal .zone-placeholder-grid {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)) !important;
    }

    .topbar.component-topbar {
      top: 50px !important;
      left: 14px !important;
      right: 14px !important;
      min-height: 42px !important;
      padding: 8px 10px !important;
      background: linear-gradient(180deg, rgba(12,15,22,.48), rgba(12,15,22,.20)) !important;
      border-color: rgba(255,255,255,.08) !important;
      box-shadow: 0 10px 30px rgba(0,0,0,.16) !important;
    }

    .topbar.component-topbar .top-left-info strong { font-size: 16px !important; }
    .topbar.component-topbar .muted { max-width: 42vw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .topbar.component-topbar .clock span { padding: 5px 8px !important; background: rgba(5,8,13,.42) !important; }

    @media (max-width: 900px) {
      .ui-clean-top-bar { flex-wrap: wrap; justify-content: flex-start; gap: 5px; padding: 5px 8px 10px; }
      .ui-clean-res { font-size: 11px; padding: 4px 7px; }
      .ui-clean-bottom-dock { justify-content: flex-start; overflow-x: auto; border-radius: 18px; bottom: 10px; }
      .ui-clean-bottom-dock button { font-size: 11px; padding: 8px 10px; }
      .game-popup-modal { width: calc(100vw - 18px) !important; max-height: 78vh !important; padding: 16px !important; }
      .topbar.component-topbar { top: 72px !important; grid-template-columns: 1fr !important; }
    }
  `;

  const modalSelector = tab => `[data-panel="${String(tab || '').replace(/"/g, '\\"')}"]`;

  function injectCleanStyles() {
    document.getElementById('floating-ui-remake-styles')?.remove();
    document.getElementById('ui-clean-alpha-styles')?.remove();
    const style = document.createElement('style');
    style.id = 'ui-clean-alpha-styles';
    style.textContent = CLEAN_CSS;
    document.head.appendChild(style);
  }

  function ensureBodyLayer() {
    if (!document.getElementById('top-resource-bar')) document.body.insertAdjacentHTML('beforeend', RESOURCE_BAR_HTML);
    if (!document.getElementById('bottom-navigation-dock')) document.body.insertAdjacentHTML('beforeend', DOCK_HTML);
    if (!document.getElementById('ui-clean-scrim')) {
      const scrim = document.createElement('div');
      scrim.id = 'ui-clean-scrim';
      scrim.className = 'ui-clean-scrim';
      scrim.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        window.uiManager.closeCurrentModal();
      });
      document.body.appendChild(scrim);
    }
  }

  function movePanelsToBody() {
    document.querySelectorAll('[data-panel]').forEach(panel => {
      if (panel.dataset.panel === 'resources') {
        panel.hidden = true;
        return;
      }
      panel.classList.add('game-popup-modal');
      panel.classList.remove('active', 'is-popup-active');
      panel.dataset.modalTitle = PANEL_TITLES[panel.dataset.panel] || panel.dataset.panel;
      panel.hidden = false;
      if (panel.parentElement !== document.body) document.body.appendChild(panel);
      if (!panel.querySelector(':scope > .ui-clean-close')) {
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'secondary ui-clean-close';
        close.textContent = 'Fechar';
        close.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          window.uiManager.closeCurrentModal();
        });
        panel.prepend(close);
      }
    });
  }

  function clearLegacyDockState() {
    const hud = document.getElementById('hud');
    if (hud) {
      hud.classList.add('legacy-hud-disabled');
      hud.style.pointerEvents = 'none';
    }
    document.querySelectorAll('#hud [data-tab], #hud .bottom-tab-panel').forEach(el => el.classList.remove('active', 'is-popup-active'));
  }

  function setDockActive(tab) {
    document.querySelectorAll('#bottom-navigation-dock [data-open-ui-modal]').forEach(btn => {
      btn.classList.toggle('is-active', !!tab && btn.dataset.openUiModal === tab);
    });
  }

  function panelFor(tab) {
    return document.querySelector(modalSelector(tab));
  }

  function syncResources() {
    if (!state?.resources) return;
    const values = {
      'txt-food': state.resources.food,
      'txt-wood': state.resources.wood,
      'txt-stone': state.resources.stone,
      'txt-metal': state.resources.metal,
      'txt-meds': state.resources.medicine
    };
    Object.entries(values).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = Math.floor(value || 0);
    });
  }

  function installEventGuards() {
    if (window.HavenfallContext.uiCleanGuardsInstalled) return;
    const stop = event => {
      if (event.target.closest?.('#top-resource-bar, #bottom-navigation-dock, .game-popup-modal, #ui-clean-scrim')) {
        event.stopPropagation();
      }
    };
    ['pointerdown', 'mousedown', 'mouseup', 'click', 'contextmenu', 'wheel'].forEach(type => {
      document.addEventListener(type, stop, true);
    });
    window.HavenfallContext.uiCleanGuardsInstalled = true;
  }

  function installDockEvents() {
    const dock = document.getElementById('bottom-navigation-dock');
    if (!dock || dock.dataset.ready === '1') return;
    dock.dataset.ready = '1';
    dock.addEventListener('click', event => {
      const modalBtn = event.target.closest('[data-open-ui-modal]');
      if (!modalBtn) return;
      event.preventDefault();
      event.stopPropagation();
      window.uiManager.toggleModal(modalBtn.dataset.openUiModal);
    });
  }

  window.uiManager = {
    currentModalId: null,
    nativeSetHudTab: null,

    init() {
      injectCleanStyles();
      ensureBodyLayer();
      movePanelsToBody();
      clearLegacyDockState();
      installDockEvents();
      installEventGuards();
      this.patchHudTab();
      this.patchCraftingOpen();
      this.patchUpdateUI();
      this.closeCurrentModal({ silent: true });
      this.syncResources();
    },

    patchHudTab() {
      if (window.HavenfallContext.uiCleanHudPatched || typeof setHudTab !== 'function') return;
      this.nativeSetHudTab = setHudTab;
      setHudTab = tab => {
        const requested = tab || 'build';
        this.nativeSetHudTab(requested === 'resources' ? 'build' : requested);
        clearLegacyDockState();
        if (this.currentModalId) setDockActive(this.currentModalId);
      };
      window.HavenfallContext.uiCleanHudPatched = true;
    },

    patchCraftingOpen() {
      if (window.HavenfallContext.uiCleanCraftingPatched || typeof openCraftingForStation !== 'function') return;
      const nativeOpenCraftingForStation = openCraftingForStation;
      openCraftingForStation = obj => {
        nativeOpenCraftingForStation(obj);
        this.openModal('crafting');
      };
      window.HavenfallContext.uiCleanCraftingPatched = true;
    },

    patchUpdateUI() {
      if (window.HavenfallContext.uiCleanUpdatePatched || typeof updateUI !== 'function') return;
      const nativeUpdateUI = updateUI;
      updateUI = function updateUICleanOverlay(force = false) {
        nativeUpdateUI(force);
        window.uiManager.syncResources();
        window.uiManager.refreshOpenModal();
      };
      window.HavenfallContext.uiCleanUpdatePatched = true;
    },

    syncResources,

    toggleModal(tab) {
      if (!tab) return;
      if (this.currentModalId === tab) this.closeCurrentModal();
      else this.openModal(tab);
    },

    openModal(tab) {
      if (!tab || tab === 'resources') return;
      const panel = panelFor(tab);
      if (!panel) return;
      this.closeCurrentModal({ silent: true });
      if (this.nativeSetHudTab) this.nativeSetHudTab(tab);
      panel.hidden = false;
      panel.classList.add('is-active');
      this.currentModalId = tab;
      activeHudTab = tab;
      document.body.classList.add('ui-clean-modal-open');
      document.getElementById('ui-clean-scrim')?.classList.add('is-active');
      setDockActive(tab);
      clearLegacyDockState();
    },

    closeCurrentModal(options = {}) {
      document.querySelectorAll('.game-popup-modal.is-active').forEach(panel => panel.classList.remove('is-active'));
      this.currentModalId = null;
      document.body.classList.remove('ui-clean-modal-open');
      document.getElementById('ui-clean-scrim')?.classList.remove('is-active');
      setDockActive(null);
      clearLegacyDockState();
      if (!options.silent) activeHudTab = null;
    },

    refreshOpenModal() {
      if (!this.currentModalId) return;
      const panel = panelFor(this.currentModalId);
      if (!panel) this.closeCurrentModal({ silent: true });
      else panel.classList.add('is-active');
    }
  };

  window.uiManager.init();
})();
