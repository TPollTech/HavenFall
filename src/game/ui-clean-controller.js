'use strict';

(() => {
  const MODALS = {
    build: 'Construção',
    research: 'Pesquisa',
    crafting: 'Crafting',
    zones: 'Zonas',
    colonists: 'Colonos',
    tasks: 'Tarefas',
    selected: 'Selecionado',
    events: 'Eventos'
  };

  function ensureShell() {
    document.getElementById('ui-clean-alpha-styles')?.remove();
    document.getElementById('floating-ui-remake-styles')?.remove();

    if (!document.getElementById('top-resource-bar')) {
      document.body.insertAdjacentHTML('afterbegin', `
        <div id="top-resource-bar">
          <div class="res-item"><img src="assets/sprites/icon_food.png" alt=""> Comida: <span id="txt-food">0</span></div>
          <div class="res-item"><img src="assets/sprites/icon_wood.png" alt=""> Madeira: <span id="txt-wood">0</span></div>
          <div class="res-item"><img src="assets/sprites/icon_stone.png" alt=""> Pedra: <span id="txt-stone">0</span></div>
          <div class="res-item"><img src="assets/sprites/icon_metal.png" alt=""> Metal: <span id="txt-metal">0</span></div>
          <div class="res-item"><img src="assets/sprites/icon_health.png" alt=""> Remédios: <span id="txt-meds">0</span></div>
        </div>
      `);
    }

    if (!document.getElementById('bottom-navigation-dock')) {
      document.body.insertAdjacentHTML('beforeend', `
        <nav id="bottom-navigation-dock" aria-label="Navegação de jogo">
          ${Object.entries(MODALS).map(([key, label]) => `<button type="button" data-ui-modal="${key}">${label}</button>`).join('')}
          <button type="button" data-speed="1">1x</button>
          <button type="button" data-speed="2">2x</button>
          <button type="button" data-speed="3">3x</button>
        </nav>
      `);
    }

    if (!document.getElementById('ui-modal-backdrop')) {
      const backdrop = document.createElement('div');
      backdrop.id = 'ui-modal-backdrop';
      document.body.appendChild(backdrop);
    }

    for (const [key, label] of Object.entries(MODALS)) {
      if (document.getElementById(`modal-${key}`)) continue;
      document.body.insertAdjacentHTML('beforeend', `
        <section id="modal-${key}" class="game-popup-modal" aria-hidden="true">
          <div class="modal-header"><h3>${label}</h3><button type="button" class="modal-close-btn" data-close-ui-modal>×</button></div>
          <div class="modal-body" data-modal-body="${key}"></div>
        </section>
      `);
    }
  }

  function movePanels() {
    for (const key of Object.keys(MODALS)) {
      const panel = document.querySelector(`[data-panel="${key}"]`);
      const target = document.querySelector(`[data-modal-body="${key}"]`);
      if (!panel || !target || panel.parentElement === target) continue;
      panel.classList.remove('active', 'is-active', 'is-popup-active', 'game-popup-modal');
      panel.hidden = false;
      panel.removeAttribute('data-panel');
      target.appendChild(panel);
    }
    const oldHud = document.getElementById('hud');
    if (oldHud) oldHud.hidden = true;
    const oldResources = document.getElementById('resourcePanel');
    if (oldResources) oldResources.hidden = true;
  }

  function syncResources() {
    if (!state?.resources) return;
    const map = {
      'txt-food': state.resources.food,
      'txt-wood': state.resources.wood,
      'txt-stone': state.resources.stone,
      'txt-metal': state.resources.metal,
      'txt-meds': state.resources.medicine
    };
    for (const [id, value] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el) el.textContent = Math.floor(value || 0);
    }
  }

  function setActiveDock(key) {
    document.querySelectorAll('#bottom-navigation-dock [data-ui-modal]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.uiModal === key);
    });
  }

  function openModal(key) {
    closeModal();
    const modal = document.getElementById(`modal-${key}`);
    if (!modal) return;
    modal.classList.add('is-active');
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('ui-modal-backdrop')?.classList.add('is-active');
    setActiveDock(key);
    activeHudTab = key;
  }

  function closeModal() {
    document.querySelectorAll('.game-popup-modal.is-active').forEach(modal => {
      modal.classList.remove('is-active');
      modal.setAttribute('aria-hidden', 'true');
    });
    document.getElementById('ui-modal-backdrop')?.classList.remove('is-active');
    setActiveDock(null);
  }

  function installEvents() {
    document.getElementById('bottom-navigation-dock')?.addEventListener('click', event => {
      const btn = event.target.closest('[data-ui-modal]');
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      const modal = document.getElementById(`modal-${btn.dataset.uiModal}`);
      if (modal?.classList.contains('is-active')) closeModal();
      else openModal(btn.dataset.uiModal);
    });

    document.addEventListener('click', event => {
      if (event.target.closest('[data-close-ui-modal]') || event.target.id === 'ui-modal-backdrop') {
        event.preventDefault();
        event.stopPropagation();
        closeModal();
      }
    }, true);
  }

  function patchUi() {
    if (typeof setHudTab === 'function') setHudTab = tab => { activeHudTab = tab || activeHudTab || 'build'; };
    if (typeof updateUI === 'function') {
      const originalUpdateUI = updateUI;
      updateUI = force => {
        originalUpdateUI(force);
        syncResources();
      };
    }
    if (typeof openCraftingForStation === 'function') {
      const originalOpenCrafting = openCraftingForStation;
      openCraftingForStation = station => {
        originalOpenCrafting(station);
        openModal('crafting');
      };
    }
  }

  window.uiManager = { openModal, closeCurrentModal: closeModal, toggleModal: key => document.getElementById(`modal-${key}`)?.classList.contains('is-active') ? closeModal() : openModal(key), syncResources };

  ensureShell();
  movePanels();
  installEvents();
  patchUi();
  closeModal();
  syncResources();
})();
