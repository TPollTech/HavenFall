'use strict';

(() => {
  if (window.HavenfallContext?.zoneInputSystemInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.zoneInputSystemInstalled = true;

  function canvasTarget(event) {
    return typeof canvas !== 'undefined' && event?.target === canvas;
  }

  function stopZoneEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  function allZoneDefs() {
    const base = typeof zoneDefs !== 'undefined' ? zoneDefs : {};
    const registered = window.HavenfallZones?.getAllZoneDefs?.() || {};
    const defs = { ...base, ...registered };
    if (!defs.growing && (window.cropDefs || window.HavenfallFarming)) {
      defs.growing = {
        label: 'Zona de cultivo',
        short: 'Cultivo',
        hint: 'Pinte a área do talhão agrícola.',
        fill: 'rgba(74,222,128,.16)',
        stroke: 'rgba(74,222,128,.82)'
      };
    }
    return defs;
  }

  function zoneDef(type) {
    return window.HavenfallZones?.getZoneDef?.(type) || allZoneDefs()[type] || null;
  }

  function toolValid(tool) {
    return tool === 'none' || !!zoneDef(tool);
  }

  function explorationMaskActive() {
    const exploration = state?.world?.exploration;
    return Array.isArray(exploration) && exploration.length > 0;
  }

  function canEditTile(x, y) {
    if (typeof isInside === 'function' && !isInside(x, y)) return false;
    if (!explorationMaskActive()) return true;
    if (typeof isTileDiscovered !== 'function') return true;
    return isTileDiscovered(x, y);
  }

  function tileFromZonePointer(event) {
    if (!canvasTarget(event) || typeof tileFromEvent !== 'function') return null;
    const tile = tileFromEvent(event);
    if (!tile || !canEditTile(tile.x, tile.y)) return null;
    return { x: tile.x, y: tile.y };
  }

  function syncSelection(active, start = null, end = null) {
    zoneDragActive = !!active;
    zoneDragStart = start ? { x: start.x, y: start.y } : null;
    zoneDragEnd = end ? { x: end.x, y: end.y } : null;
  }

  function clearSelection() {
    syncSelection(false);
  }

  function hideZonesPanelForPainting() {
    const panel = document.getElementById('anchored-ui-panel');
    if (panel?.dataset.activeDockTab !== 'zones') return;
    panel.classList.remove('is-active');
    panel.setAttribute('aria-hidden', 'true');
    panel.hidden = true;
  }

  function restoreZonesPanel() {
    if (window.HavenfallUI?.renderDockPanel) window.HavenfallUI.renderDockPanel('zones');
    else window.HavenfallUI?.refreshDockPanel?.('zones');
  }

  function setTool(tool) {
    if (!toolValid(tool)) {
      if (typeof log === 'function') log(`Ferramenta de zona inválida: ${tool || 'vazia'}.`);
      return false;
    }
    currentZoneTool = tool;
    currentBuild = null;
    if (typeof clearOrderTool === 'function') clearOrderTool('zones');
    clearSelection();
    document.body.classList.toggle('zone-brush-active', !!currentZoneTool);
    hideZonesPanelForPainting();
    return true;
  }

  function installZoneWriter() {
    if (!zoneSystem || zoneSystem.zoneInputWriterInstalled) return;
    zoneSystem.zoneInputWriterInstalled = true;
    zoneSystem.setZone = function setZoneFromUnifiedInput(x, y, zoneType) {
      const zones = this.ensureState();
      if (!zones || !canEditTile(x, y)) return false;
      const key = this.key(x, y);
      if (!zoneType || zoneType === 'none') delete zones.grid[key];
      else if (zoneDef(zoneType)) zones.grid[key] = zoneType;
      else return false;
      return true;
    };
  }

  function begin(event) {
    if (!currentZoneTool || appScreen !== SCREEN.PLAYING || !state) return false;
    const tile = tileFromZonePointer(event);
    if (!tile) return false;
    syncSelection(true, tile, tile);
    if (typeof updateUI === 'function') updateUI(true);
    return true;
  }

  function update(event) {
    if (!zoneDragActive || !currentZoneTool) return false;
    const tile = tileFromZonePointer(event);
    if (!tile) return false;
    zoneDragEnd = tile;
    if (typeof updateUI === 'function') updateUI(true);
    return true;
  }

  function bounds() {
    if (!zoneDragStart || !zoneDragEnd) return null;
    return {
      minX: Math.min(zoneDragStart.x, zoneDragEnd.x),
      maxX: Math.max(zoneDragStart.x, zoneDragEnd.x),
      minY: Math.min(zoneDragStart.y, zoneDragEnd.y),
      maxY: Math.max(zoneDragStart.y, zoneDragEnd.y)
    };
  }

  function finish(event = null) {
    if (!zoneDragActive || !currentZoneTool) return false;
    if (event && canvasTarget(event)) update(event);
    const tool = currentZoneTool;
    const area = bounds();
    clearSelection();
    suppressNextZoneClick = true;
    currentZoneTool = null;
    document.body.classList.remove('zone-brush-active');
    const changed = area ? zoneSystem.setZoneRect(area.minX, area.minY, area.maxX, area.maxY, tool) : 0;
    if (typeof updateZonePanel === 'function') updateZonePanel();
    if (typeof updateZonesModal === 'function') updateZonesModal();
    if (typeof updateUI === 'function') updateUI(true);
    restoreZonesPanel();
    if (typeof log === 'function') {
      const label = tool === 'none' ? 'Zonas apagadas' : `${zoneDef(tool)?.label || tool} marcado`;
      log(changed ? `${label}: ${changed} tile${changed === 1 ? '' : 's'}.` : 'Nenhum tile válido foi alterado.');
    }
    return changed > 0;
  }

  function showOverlay() {
    return !!(zoneDragActive || currentZoneTool || document.getElementById('zones-modal')?.classList.contains('show'));
  }

  function installInput() {
    if (document.body.dataset.zoneInputSystemReady === '1') return;
    document.body.dataset.zoneInputSystemReady = '1';

    document.addEventListener('mousedown', event => {
      if (event.button !== 0 || !currentZoneTool) return;
      if (begin(event)) stopZoneEvent(event);
    }, true);

    document.addEventListener('mousemove', event => {
      if (!zoneDragActive || !currentZoneTool) return;
      if (update(event)) stopZoneEvent(event);
    }, true);

    document.addEventListener('mouseup', event => {
      if (!zoneDragActive) return;
      finish(event);
      stopZoneEvent(event);
    }, true);

    document.addEventListener('click', event => {
      if (suppressNextZoneClick) {
        suppressNextZoneClick = false;
        stopZoneEvent(event);
        return;
      }
      if (currentZoneTool && canvasTarget(event)) stopZoneEvent(event);
    }, true);
  }

  function installGlobals() {
    try { setZoneTool = setTool; } catch (_) {}
    try { beginZoneSelectionFromEvent = begin; } catch (_) {}
    try { updateZoneDragFromEvent = update; } catch (_) {}
    try { finishZoneSelectionFromEvent = finish; } catch (_) {}
    try { clearZoneSelection = clearSelection; } catch (_) {}
    try { shouldShowZonesOverlay = showOverlay; } catch (_) {}
    window.setZoneTool = setTool;
    window.HavenfallZoneInput = Object.freeze({ setTool, begin, update, finish, clearSelection, canEditTile });
  }

  installZoneWriter();
  installGlobals();
  installInput();
})();
