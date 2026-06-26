'use strict';

(() => {
  window.HavenfallContext = window.HavenfallContext || {};

  const PANEL_TITLES = Object.freeze({
    build: 'Construção',
    resources: 'Recursos',
    tasks: 'Tarefas',
    research: 'Pesquisa',
    crafting: 'Crafting',
    zones: 'Zonas',
    colonists: 'Colonos',
    selected: 'Selecionado',
    events: 'Eventos'
  });

  const TOP_RESOURCE_HTML = `
    <div id="top-resource-bar" class="ui-top-bar" aria-label="Recursos da colônia">
      <div class="res-item"><img src="assets/sprites/icon_food.png" alt=""> Comida: <span id="txt-food">0</span></div>
      <div class="res-item"><img src="assets/sprites/icon_wood.png" alt=""> Madeira: <span id="txt-wood">0</span></div>
      <div class="res-item"><img src="assets/sprites/icon_stone.png" alt=""> Pedra: <span id="txt-stone">0</span></div>
      <div class="res-item"><img src="assets/sprites/icon_metal.png" alt=""> Metal: <span id="txt-metal">0</span></div>
      <div class="res-item"><img src="assets/sprites/icon_health.png" alt=""> Remédios: <span id="txt-meds">0</span></div>
    </div>
  `;

  function injectFloatingUiStyles() {
    if (document.getElementById('floating-ui-remake-styles')) return;
    const style = document.createElement('style');
    style.id = 'floating-ui-remake-styles';
    style.textContent = `
      body.ui-modal-open #game { cursor: default; }
      .ui-top-bar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 42px;
        z-index: 900;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: clamp(10px, 2vw, 28px);
        padding: 6px 16px;
        pointer-events: auto;
        background: linear-gradient(180deg, rgba(0,0,0,.80), rgba(0,0,0,.28) 72%, transparent);
        color: #fff6e6;
        text-shadow: 0 2px 10px rgba(0,0,0,.75);
      }
      .ui-top-bar .res-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        white-space: nowrap;
        font-size: 13px;
        font-weight: 850;
        padding: 4px 9px;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 999px;
        background: rgba(7,11,17,.38);
        backdrop-filter: blur(10px);
      }
      .ui-top-bar .res-item img { width: 20px; height: 20px; object-fit: contain; }
      .ui-top-bar .res-item span { color: #f5d15c; font-weight: 950; }

      .topbar.component-topbar {
        top: 48px;
        left: 14px;
        right: 14px;
        min-height: 44px;
        padding: 8px 10px;
        background: linear-gradient(180deg, rgba(12,15,22,.52), rgba(12,15,22,.22));
        border-color: rgba(255,255,255,.08);
        box-shadow: 0 10px 30px rgba(0,0,0,.18);
      }
      .topbar.component-topbar .top-left-info strong { font-size: 16px; }
      .topbar.component-topbar .muted { max-width: 45vw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .topbar.component-topbar .clock span { padding: 5px 8px; background: rgba(5,8,13,.44); }

      .bottom-command-panel.component-hud {
        position: fixed;
        z-index: 920;
        left: 50%;
        right: auto;
        bottom: 18px;
        transform: translateX(-50%);
        width: auto;
        min-height: 0;
        max-height: none;
        display: block;
        padding: 0;
        background: transparent;
        border: 0;
        box-shadow: none;
        pointer-events: none;
        backdrop-filter: none;
      }
      .bottom-command-panel.component-hud .bottom-action-bar {
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(15, 23, 42, .82);
        border: 1px solid rgba(255,255,255,.10);
        box-shadow: 0 18px 48px rgba(0,0,0,.45);
        backdrop-filter: blur(16px) saturate(1.15);
      }
      .bottom-command-panel.component-hud .bottom-tabs {
        display: flex;
        align-items: center;
        gap: 7px;
      }
      .bottom-command-panel.component-hud .bottom-tabs button,
      .bottom-command-panel.component-hud .speed-inline button {
        min-height: 36px;
        border-radius: 999px;
        padding: 8px 12px;
        white-space: nowrap;
        background: rgba(255,255,255,.07);
      }
      .bottom-command-panel.component-hud .bottom-tabs button.active {
        background: linear-gradient(180deg, rgba(227,169,63,.42), rgba(136,88,26,.46));
      }
      .bottom-command-panel.component-hud .speed-inline {
        display: flex;
        align-items: center;
        gap: 6px;
        border-left: 1px solid rgba(255,255,255,.10);
        padding-left: 10px;
      }
      .bottom-command-panel.component-hud .bottom-panel-content {
        display: contents;
      }
      .bottom-command-panel.component-hud .bottom-tab-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        width: min(760px, calc(100vw - 32px));
        max-height: min(76vh, 720px);
        transform: translate(-50%, -50%) scale(.98);
        z-index: 1000;
        display: none;
        overflow: auto;
        padding: 18px;
        border-radius: 20px;
        background: rgba(20, 28, 47, .94);
        border: 1px solid rgba(121, 152, 215, .36);
        box-shadow: 0 28px 90px rgba(0,0,0,.72);
        backdrop-filter: blur(18px) saturate(1.15);
      }
      .bottom-command-panel.component-hud .bottom-tab-panel.is-popup-active {
        display: block;
        transform: translate(-50%, -50%) scale(1);
      }
      .bottom-command-panel.component-hud .bottom-tab-panel::before {
        content: attr(data-modal-title);
        display: block;
        color: #f5d15c;
        font-size: 12px;
        font-weight: 950;
        letter-spacing: .15em;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      .bottom-command-panel.component-hud .bottom-tab-panel .ui-popup-close {
        position: sticky;
        top: 0;
        float: right;
        z-index: 2;
        margin: -4px -4px 8px 10px;
      }
      .bottom-command-panel.component-hud .bottom-tab-panel[data-panel="resources"] { display: none !important; }
      .bottom-command-panel.component-hud .bottom-tabs [data-tab="resources"] { display: none; }
      .bottom-command-panel.component-hud .build-grid { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); }
      .bottom-command-panel.component-hud #log { height: auto; max-height: 48vh; overflow: auto; column-count: 1; }
      .bottom-command-panel.component-hud .selected-info-inline { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); }
      .bottom-command-panel.component-hud .goals ul { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }

      .ui-modal-scrim {
        position: fixed;
        inset: 0;
        z-index: 990;
        display: none;
        background: rgba(0,0,0,.18);
        pointer-events: auto;
      }
      .ui-modal-scrim.is-active { display: block; }

      @media (max-width: 860px) {
        .ui-top-bar { height: auto; min-height: 42px; flex-wrap: wrap; gap: 5px; padding: 5px 8px 10px; }
        .ui-top-bar .res-item { font-size: 11px; padding: 4px 7px; }
        .topbar.component-topbar { top: 68px; grid-template-columns: 1fr; }
        .bottom-command-panel.component-hud { bottom: 10px; width: calc(100vw - 16px); }
        .bottom-command-panel.component-hud .bottom-action-bar { border-radius: 18px; overflow-x: auto; justify-content: flex-start; }
        .bottom-command-panel.component-hud .bottom-tabs { min-width: max-content; }
        .bottom-command-panel.component-hud .bottom-tab-panel { width: calc(100vw - 18px); max-height: 78vh; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureResourceBar() {
    if (document.getElementById('top-resource-bar')) return;
    const gameScreen = document.getElementById('gameScreen');
    const host = gameScreen?.querySelector('.hud-remake-layout') || gameScreen || document.body;
    host.insertAdjacentHTML('afterbegin', TOP_RESOURCE_HTML);
  }

  function ensureScrim() {
    let scrim = document.getElementById('ui-modal-scrim');
    if (scrim) return scrim;
    scrim = document.createElement('div');
    scrim.id = 'ui-modal-scrim';
    scrim.className = 'ui-modal-scrim';
    scrim.addEventListener('mousedown', event => {
      event.preventDefault();
      event.stopPropagation();
      window.uiManager.closeCurrentModal();
    });
    document.body.appendChild(scrim);
    return scrim;
  }

  function panelFor(tab) {
    return document.querySelector(`[data-panel="${CSS.escape(tab)}"]`);
  }

  function buttonFor(tab) {
    return document.querySelector(`[data-tab="${CSS.escape(tab)}"]`);
  }

  function closeButtons() {
    document.querySelectorAll('.bottom-tab-panel').forEach(panel => {
      if (panel.querySelector('.ui-popup-close')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary ui-popup-close';
      button.textContent = 'Fechar';
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        window.uiManager.closeCurrentModal();
      });
      panel.prepend(button);
    });
  }

  function preventUiLeak() {
    if (window.HavenfallContext.uiLeakPrevented) return;
    const block = event => {
      if (event.target.closest?.('#hud, #topBar, #top-resource-bar, .bottom-tab-panel, .game-popup-modal, .game-modal-backdrop')) {
        event.stopPropagation();
      }
    };
    ['mousedown', 'mouseup', 'click', 'contextmenu', 'pointerdown'].forEach(type => document.addEventListener(type, block, true));
    window.HavenfallContext.uiLeakPrevented = true;
  }

  function syncTopResources() {
    if (!state?.resources) return;
    const pairs = [
      ['txt-food', state.resources.food],
      ['txt-wood', state.resources.wood],
      ['txt-stone', state.resources.stone],
      ['txt-metal', state.resources.metal],
      ['txt-meds', state.resources.medicine]
    ];
    for (const [id, value] of pairs) {
      const el = document.getElementById(id);
      if (el) el.textContent = Math.floor(value || 0);
    }
  }

  function markPanels() {
    document.querySelectorAll('[data-panel]').forEach(panel => {
      const tab = panel.dataset.panel;
      panel.dataset.modalTitle = PANEL_TITLES[tab] || tab;
      panel.classList.add('game-popup-modal');
    });
  }

  function setTabButtonState(tab) {
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.classList.toggle('active', !!tab && btn.dataset.tab === tab);
    });
  }

  window.uiManager = {
    currentModalId: null,

    init() {
      injectFloatingUiStyles();
      ensureResourceBar();
      ensureScrim();
      markPanels();
      closeButtons();
      preventUiLeak();
      this.patchHudTab();
      this.patchUpdateUI();
      syncTopResources();
    },

    patchHudTab() {
      if (window.HavenfallContext.uiManagerHudPatched || typeof setHudTab !== 'function') return;
      const nativeSetHudTab = setHudTab;
      setHudTab = tab => {
        const requested = tab || 'build';
        if (requested === 'resources') {
          this.closeCurrentModal();
          setTabButtonState(null);
          return;
        }
        nativeSetHudTab(requested);
        const panel = panelFor(activeHudTab || requested);
        if (panel) this.openModal(activeHudTab || requested, { syncTab: false });
      };
      window.HavenfallContext.uiManagerHudPatched = true;
    },

    patchUpdateUI() {
      if (window.HavenfallContext.uiManagerUpdatePatched || typeof updateUI !== 'function') return;
      const nativeUpdateUI = updateUI;
      updateUI = function updateUIWithFloatingResources(force = false) {
        nativeUpdateUI(force);
        window.uiManager.syncResources();
        window.uiManager.refreshOpenModal();
      };
      window.HavenfallContext.uiManagerUpdatePatched = true;
    },

    syncResources() {
      ensureResourceBar();
      syncTopResources();
    },

    toggleModal(tab) {
      if (this.currentModalId === tab) this.closeCurrentModal();
      else this.openModal(tab);
    },

    openModal(tab, options = {}) {
      if (!tab || tab === 'resources') return;
      const panel = panelFor(tab);
      if (!panel || panel.hidden) return;
      this.closeCurrentModal({ silent: true });
      panel.classList.add('is-popup-active');
      panel.classList.add('active');
      this.currentModalId = tab;
      activeHudTab = tab;
      if (options.syncTab !== false) setTabButtonState(tab);
      const scrim = ensureScrim();
      scrim.classList.add('is-active');
      document.body.classList.add('ui-modal-open');
    },

    closeCurrentModal(options = {}) {
      if (!this.currentModalId) return;
      const panel = panelFor(this.currentModalId);
      if (panel) panel.classList.remove('is-popup-active', 'active');
      const btn = buttonFor(this.currentModalId);
      if (btn) btn.classList.remove('active');
      this.currentModalId = null;
      ensureScrim().classList.remove('is-active');
      document.body.classList.remove('ui-modal-open');
      if (!options.silent) activeHudTab = null;
    },

    refreshOpenModal() {
      if (!this.currentModalId) return;
      const panel = panelFor(this.currentModalId);
      if (!panel || panel.hidden) this.closeCurrentModal({ silent: true });
    }
  };

  window.uiManager.init();
})();
