'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.tabViews = window.HavenfallUI.tabViews || {};

  function zoneEntries() {
    return Object.entries(zoneDefs || {});
  }

  function activeTool() {
    return currentZoneTool || 'storage';
  }

  function activateDefaultBrush() {
    if (!currentZoneTool && typeof setZoneTool === 'function') setZoneTool('storage');
    document.body.classList.add('zone-brush-active');
  }

  function renderZoneButton(key, def) {
    const count = zoneSystem?.count?.(key) || 0;
    return `<button class="dock-card zone-card ${currentZoneTool === key ? 'is-active' : ''}" data-zone-tool="${key}">
      <strong>${escapeHtml(def.short || def.label)}</strong>
      <small>${escapeHtml(def.hint || '')}</small>
      <span class="dock-badge">${count} tiles</span>
    </button>`;
  }

  function render() {
    if (!state) return '<div class="dock-empty">Inicie uma partida para marcar zonas.</div>';
    activateDefaultBrush();
    const total = zoneSystem?.count?.() || 0;
    return `<div class="dock-tab-head"><div><h3>Zonas</h3><p>Pincel de zona ativo. Clique e arraste no mapa para pintar tiles.</p></div><button data-clear-zone-tool>Desativar pincel</button></div>
      <div class="dock-zone-status"><b>Ferramenta:</b> ${escapeHtml(zoneLabel(activeTool()))} · <b>Total:</b> ${total} tile${total === 1 ? '' : 's'}</div>
      <div class="dock-card-grid">${zoneEntries().map(([key, def]) => renderZoneButton(key, def)).join('')}<button class="dock-card zone-card ${currentZoneTool === 'none' ? 'is-active' : ''}" data-zone-tool="none"><strong>Apagar</strong><small>Remove zonas pintadas.</small><span class="dock-badge">borracha</span></button></div>
      ${total ? '' : '<div class="dock-empty"><b>Nenhuma zona definida.</b><span>Escolha um tipo e pinte no mapa. O overlay translúcido aparece sobre os tiles marcados.</span></div>'}`;
  }

  function handleClick(event) {
    const clear = event.target.closest?.('[data-clear-zone-tool]');
    if (clear) {
      clearZoneTool?.('manual');
      document.body.classList.remove('zone-brush-active');
      window.HavenfallUI.refreshDockPanel?.('zones');
      return;
    }
    const tool = event.target.closest?.('[data-zone-tool]');
    if (!tool) return;
    if (typeof setZoneTool === 'function') setZoneTool(tool.dataset.zoneTool);
    document.body.classList.toggle('zone-brush-active', !!currentZoneTool);
    window.HavenfallUI.refreshDockPanel?.('zones');
  }

  document.addEventListener('click', handleClick);
  window.HavenfallUI.tabViews.zones = { render, onOpen: activateDefaultBrush };
})();
