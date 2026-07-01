'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.tabViews = window.HavenfallUI.tabViews || {};

  function zoneEntries() {
    return Object.entries(window.HavenfallZones?.getAllZoneDefs?.() || zoneDefs || {});
  }

  function activeTool() {
    return currentZoneTool || null;
  }

  function activateZoneTab() {
    document.body.classList.toggle('zone-brush-active', !!currentZoneTool);
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
    const total = zoneSystem?.count?.() || 0;
    const tool = activeTool();
    return `<div class="dock-tab-head"><div><h3>Zonas</h3><p>Escolha uma zona e clique/arraste no mapa para marcar uma área. Solte para confirmar.</p></div><button data-clear-zone-tool>Desativar ferramenta</button></div>
      <div class="dock-zone-status"><b>Ferramenta:</b> ${escapeHtml(tool ? zoneLabel(tool) : 'nenhuma ferramenta ativa')} · <b>Total:</b> ${total} tile${total === 1 ? '' : 's'}</div>
      <div class="dock-card-grid">${zoneEntries().map(([key, def]) => renderZoneButton(key, def)).join('')}<button class="dock-card zone-card ${currentZoneTool === 'none' ? 'is-active' : ''}" data-zone-tool="none"><strong>Apagar</strong><small>Remove zonas pintadas.</small><span class="dock-badge">borracha</span></button></div>
      ${total ? '' : '<div class="dock-empty"><b>Nenhuma zona definida.</b><span>Escolha um tipo de zona e marque uma área no mapa. As cores aparecem só durante o uso da ferramenta.</span></div>'}`;
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
  window.HavenfallUI.tabViews.zones = { render, onOpen: activateZoneTab };
})();
