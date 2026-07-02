'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.tabViews = window.HavenfallUI.tabViews || {};

  function zoneEntries() {
    return Object.entries(window.HavenfallZones?.getAllZoneDefs?.() || zoneDefs || {});
  }

  function activateZoneTab() {
    document.body.classList.toggle('zone-brush-active', !!currentZoneTool);
  }

  function collapsePanelForPainting() {
    const panel = document.getElementById('anchored-ui-panel');
    if (!panel || panel.dataset.activeDockTab !== 'zones') return;
    panel.classList.remove('is-active');
    panel.setAttribute('aria-hidden', 'true');
  }

  function renderZoneButton(key, def) {
    return `<button class="dock-card zone-card ${currentZoneTool === key ? 'is-active' : ''}" data-zone-tool="${escapeHtml(key)}">
      <strong>${escapeHtml(def.short || def.label)}</strong>
      <small>${escapeHtml(def.hint || '')}</small>
    </button>`;
  }

  function render() {
    if (!state) return '<div class="dock-empty">Inicie uma partida para marcar zonas.</div>';
    return `<div class="zones-panel">
      <div class="dock-tab-head"><div><h3>Zonas</h3></div></div>
      <div class="dock-card-grid">
        ${zoneEntries().map(([key, def]) => renderZoneButton(key, def)).join('')}
        <button class="dock-card zone-card ${currentZoneTool === 'none' ? 'is-active' : ''}" data-zone-tool="none"><strong>Apagar</strong><small>Remove zonas pintadas.</small></button>
      </div>
    </div>`;
  }

  function handleClick(event) {
    const zoneTool = event.target.closest?.('[data-zone-tool]');
    if (zoneTool && zoneTool.closest('#anchored-ui-panel')) {
      window.requestAnimationFrame?.(() => {
        document.body.classList.toggle('zone-brush-active', !!currentZoneTool);
        collapsePanelForPainting();
      });
      return;
    }

    if (!event.target.closest?.('[data-clear-zone-tool]')) return;
    window.requestAnimationFrame?.(() => {
      document.body.classList.toggle('zone-brush-active', !!currentZoneTool);
      window.HavenfallUI.refreshDockPanel?.('zones');
    });
  }

  document.addEventListener('click', handleClick);
  window.HavenfallUI.tabViews.zones = { render, onOpen: activateZoneTab };
})();
