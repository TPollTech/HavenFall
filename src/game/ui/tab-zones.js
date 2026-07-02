'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.tabViews = window.HavenfallUI.tabViews || {};

  let reliableZoneDrag = null;
  let suppressReliableZoneClick = false;

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

  function stopEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  function isCanvasEvent(event) {
    return typeof canvas !== 'undefined' && event.target === canvas;
  }

  function tileFromZoneEvent(event) {
    if (typeof tileFromEvent !== 'function') return null;
    const tile = tileFromEvent(event);
    if (!tile) return null;
    if (typeof isInside === 'function' && !isInside(tile.x, tile.y)) return null;
    if (typeof isTileDiscovered === 'function' && !isTileDiscovered(tile.x, tile.y)) return null;
    return tile;
  }

  function syncLegacySelection(active, start = null, end = null) {
    zoneDragActive = !!active;
    zoneDragStart = start ? { x: start.x, y: start.y } : null;
    zoneDragEnd = end ? { x: end.x, y: end.y } : null;
  }

  function clearReliableSelection() {
    reliableZoneDrag = null;
    syncLegacySelection(false);
  }

  function setZoneBrush(tool) {
    if (!zoneToolIsValid(tool)) return false;
    currentZoneTool = tool;
    currentBuild = null;
    if (typeof clearOrderTool === 'function') clearOrderTool('zones');
    clearReliableSelection();
    document.body.classList.add('zone-brush-active');
    collapsePanelForPainting();
    if (typeof updateUI === 'function') updateUI(true);
    return true;
  }

  function selectionBounds(start, end) {
    if (!start || !end) return null;
    return {
      minX: Math.min(start.x, end.x),
      maxX: Math.max(start.x, end.x),
      minY: Math.min(start.y, end.y),
      maxY: Math.max(start.y, end.y)
    };
  }

  function applyZoneBrush(tool, start, end) {
    const bounds = selectionBounds(start, end);
    if (!bounds || !zoneSystem?.setZoneRect) return 0;
    return zoneSystem.setZoneRect(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY, tool);
  }

  function finishZoneBrush(event = null) {
    if (!reliableZoneDrag && (!zoneDragActive || !currentZoneTool)) return false;
    const tool = reliableZoneDrag?.tool || currentZoneTool;
    if (event && reliableZoneDrag) {
      const tile = tileFromZoneEvent(event);
      if (tile) reliableZoneDrag.end = tile;
    }

    const start = reliableZoneDrag?.start || zoneDragStart;
    const end = reliableZoneDrag?.end || zoneDragEnd || start;
    const changed = applyZoneBrush(tool, start, end);

    currentZoneTool = null;
    clearReliableSelection();
    suppressReliableZoneClick = true;
    suppressNextZoneClick = true;
    document.body.classList.remove('zone-brush-active');

    if (typeof updateUI === 'function') updateUI(true);
    restorePanelAfterPainting();

    if (typeof log === 'function') {
      const label = tool === 'none' ? 'Zonas apagadas' : (typeof zoneLabel === 'function' ? zoneLabel(tool) : tool);
      log(changed ? `${label}: ${changed} tile${changed === 1 ? '' : 's'}.` : 'Nenhum tile válido foi alterado.');
    }
    return changed > 0;
  }

  function beginReliableZoneDrag(event) {
    if (!currentZoneTool || appScreen !== SCREEN.PLAYING || !state || !isCanvasEvent(event)) return false;
    const tile = tileFromZoneEvent(event);
    if (!tile) return false;
    reliableZoneDrag = { tool: currentZoneTool, start: tile, end: tile };
    syncLegacySelection(true, tile, tile);
    if (typeof updateUI === 'function') updateUI(true);
    return true;
  }

  function updateReliableZoneDrag(event) {
    if (!reliableZoneDrag || !isCanvasEvent(event)) return false;
    const tile = tileFromZoneEvent(event);
    if (!tile) return false;
    reliableZoneDrag.end = tile;
    syncLegacySelection(true, reliableZoneDrag.start, reliableZoneDrag.end);
    if (typeof updateUI === 'function') updateUI(true);
    return true;
  }

  function installReliableZoneGlobals() {
    window.setZoneTool = setZoneBrush;
    if (typeof setZoneTool === 'function') setZoneTool = setZoneBrush;
    beginZoneSelectionFromEvent = beginReliableZoneDrag;
    updateZoneDragFromEvent = updateReliableZoneDrag;
    finishZoneSelectionFromEvent = finishZoneBrush;
    clearZoneSelection = clearReliableSelection;
    shouldShowZonesOverlay = function shouldShowReliableZonesOverlay() {
      return !!reliableZoneDrag || zoneDragActive || !!currentZoneTool || zonesPanelVisible() || document.getElementById('zones-modal')?.classList.contains('show') === true;
    };
  }

  function installReliableCanvasInput() {
    if (document.body.dataset.reliableZonesInputReady === '1') return;
    document.body.dataset.reliableZonesInputReady = '1';

    document.addEventListener('mousedown', event => {
      if (event.button !== 0 || !currentZoneTool) return;
      if (beginReliableZoneDrag(event)) stopEvent(event);
    }, true);

    document.addEventListener('mousemove', event => {
      if (!reliableZoneDrag) return;
      if (updateReliableZoneDrag(event)) stopEvent(event);
    }, true);

    document.addEventListener('mouseup', event => {
      if (!reliableZoneDrag) return;
      finishZoneBrush(event);
      stopEvent(event);
    }, true);

    document.addEventListener('click', event => {
      if (suppressReliableZoneClick || suppressNextZoneClick) {
        suppressReliableZoneClick = false;
        suppressNextZoneClick = false;
        stopEvent(event);
        return;
      }
      if (currentZoneTool && isCanvasEvent(event)) stopEvent(event);
    }, true);
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
      stopEvent(event);
      setZoneBrush(zoneTool.dataset.zoneTool);
      return;
    }

    if (!event.target.closest?.('[data-clear-zone-tool]')) return;
    stopEvent(event);
    currentZoneTool = null;
    clearReliableSelection();
    document.body.classList.remove('zone-brush-active');
    window.HavenfallUI.refreshDockPanel?.('zones');
  }

  installReliableZoneGlobals();
  installReliableCanvasInput();
  document.addEventListener('click', handleClick, true);
  window.HavenfallUI.tabViews.zones = { render, onOpen: activateZoneTab };
})();
