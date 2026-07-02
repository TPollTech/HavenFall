'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.tabViews = window.HavenfallUI.tabViews || {};

  function zoneEntries() {
    return Object.entries(window.HavenfallZones?.getAllZoneDefs?.() || zoneDefs || {});
  }

  function zoneToolIsValid(tool) {
    return tool === 'none' || !!(window.HavenfallZones?.getZoneDef?.(tool) || zoneDefs?.[tool] || window.HavenfallZones?.getAllZoneDefs?.()?.[tool]);
  }

  function activeZonesPanel() {
    const panel = document.getElementById('anchored-ui-panel');
    return panel?.dataset.activeDockTab === 'zones' ? panel : null;
  }

  function zonesPanelVisible() {
    const panel = activeZonesPanel();
    return !!(panel && !panel.hidden && panel.classList.contains('is-active'));
  }

  function collapsePanelForPainting() {
    const panel = activeZonesPanel();
    if (!panel) return;
    panel.classList.remove('is-active');
    panel.setAttribute('aria-hidden', 'true');
    panel.hidden = true;
  }

  function restorePanelAfterPainting() {
    window.HavenfallUI.renderDockPanel?.('zones');
  }

  function tileFromZoneEvent(event) {
    if (typeof tileFromEvent !== 'function') return null;
    const tile = tileFromEvent(event);
    if (!tile || typeof isInside === 'function' && !isInside(tile.x, tile.y)) return null;
    if (typeof isTileDiscovered === 'function' && !isTileDiscovered(tile.x, tile.y)) return null;
    return tile;
  }

  function setZoneBrush(tool) {
    if (!zoneToolIsValid(tool)) return false;
    currentZoneTool = tool;
    currentBuild = null;
    if (typeof clearOrderTool === 'function') clearOrderTool('zones');
    if (typeof clearZoneSelection === 'function') clearZoneSelection();
    else {
      zoneDragActive = false;
      zoneDragStart = null;
      zoneDragEnd = null;
    }
    document.body.classList.add('zone-brush-active');
    collapsePanelForPainting();
    if (typeof updateUI === 'function') updateUI(true);
    return true;
  }

  function finishZoneBrush(event = null) {
    if (!zoneDragActive || !currentZoneTool) return false;
    const tool = currentZoneTool;
    if (event && typeof updateZoneDragFromEvent === 'function') updateZoneDragFromEvent(event);
    const bounds = typeof zoneSelectionBounds === 'function' ? zoneSelectionBounds() : null;
    currentZoneTool = null;
    zoneDragActive = false;
    zoneDragStart = null;
    zoneDragEnd = null;
    suppressNextZoneClick = true;
    document.body.classList.remove('zone-brush-active');

    const changed = bounds && zoneSystem?.setZoneRect
      ? zoneSystem.setZoneRect(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY, tool)
      : 0;

    if (typeof updateUI === 'function') updateUI(true);
    restorePanelAfterPainting();
    if (typeof log === 'function') {
      const label = tool === 'none' ? 'Zonas apagadas' : (typeof zoneLabel === 'function' ? zoneLabel(tool) : tool);
      log(changed ? `${label}: ${changed} tile${changed === 1 ? '' : 's'}.` : 'Nenhum tile válido foi alterado.');
    }
    return changed > 0;
  }

  function installReliableZoneGlobals() {
    window.setZoneTool = setZoneBrush;
    if (typeof setZoneTool === 'function') setZoneTool = setZoneBrush;

    beginZoneSelectionFromEvent = function beginReliableZoneSelection(event) {
      if (!currentZoneTool || appScreen !== SCREEN.PLAYING || !state) return false;
      const tile = tileFromZoneEvent(event);
      if (!tile) return false;
      zoneDragActive = true;
      zoneDragStart = { x: tile.x, y: tile.y };
      zoneDragEnd = { x: tile.x, y: tile.y };
      if (typeof updateUI === 'function') updateUI(true);
      return true;
    };

    updateZoneDragFromEvent = function updateReliableZoneDrag(event) {
      const tile = tileFromZoneEvent(event);
      if (!tile) return false;
      zoneDragEnd = { x: tile.x, y: tile.y };
      if (typeof updateUI === 'function') updateUI(true);
      return true;
    };

    finishZoneSelectionFromEvent = finishZoneBrush;
    shouldShowZonesOverlay = function shouldShowReliableZonesOverlay() {
      return zoneDragActive || !!currentZoneTool || zonesPanelVisible() || document.getElementById('zones-modal')?.classList.contains('show') === true;
    };
  }

  function activateZoneTab() {
    document.body.classList.toggle('zone-brush-active', !!currentZoneTool);
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
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      setZoneBrush(zoneTool.dataset.zoneTool);
      return;
    }

    if (!event.target.closest?.('[data-clear-zone-tool]')) return;
    event.preventDefault();
    event.stopPropagation();
    currentZoneTool = null;
    document.body.classList.remove('zone-brush-active');
    window.HavenfallUI.refreshDockPanel?.('zones');
  }

  installReliableZoneGlobals();
  document.addEventListener('click', handleClick, true);
  window.HavenfallUI.tabViews.zones = { render, onOpen: activateZoneTab };
})();
