'use strict';

(() => {
  if (window.HavenfallContext?.escapeActionRouterInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.escapeActionRouterInstalled = true;

  function isTypingTarget(el = document.activeElement) {
    if (!el) return false;
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || !!el.isContentEditable;
  }

  function consume(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    return true;
  }

  function cancelBuild() {
    if (typeof currentBuild === 'undefined' || !currentBuild) return false;
    const label = buildDefs?.[currentBuild]?.label || currentBuild;
    currentBuild = null;
    try { suppressNextClick = false; } catch (_) {}
    if (typeof updateUI === 'function') updateUI(true);
    if (typeof log === 'function') log(`Construção cancelada: ${label}.`);
    return true;
  }

  function cancelOrder() {
    if (typeof getOrderTool !== 'function' || typeof clearOrderTool !== 'function') return false;
    if (!getOrderTool()) return false;
    clearOrderTool('manual');
    return true;
  }

  function cancelZone() {
    const zoneActive = !!document.querySelector('[data-zone-tool].active');
    if (!zoneActive) return false;
    if (typeof clearZoneTool === 'function') clearZoneTool('ESC');
    return true;
  }

  function cancelGatherSelection() {
    let changed = false;
    try {
      if (gatherSelection) { gatherSelection = null; changed = true; }
      suppressNextClick = false;
    } catch (_) {}
    return changed;
  }

  function closeContextMenu() {
    const menu = document.getElementById('contextMenu');
    if (!menu?.classList.contains('show')) return false;
    if (typeof hideContextMenu === 'function') hideContextMenu();
    else menu.classList.remove('show');
    return true;
  }

  function closeResearch() {
    const overlay = document.getElementById('research-tree-overlay');
    if (!overlay?.classList.contains('show')) return false;
    if (window.HavenfallUI?.closeResearchOverlay) window.HavenfallUI.closeResearchOverlay();
    else overlay.classList.remove('show');
    return true;
  }

  function closeDockPanel() {
    const panel = document.getElementById('anchored-ui-panel');
    if (!panel?.classList.contains('is-active')) return false;
    if (window.uiManager?.closeCurrentPanel) window.uiManager.closeCurrentPanel();
    else {
      panel.classList.remove('is-active');
      panel.setAttribute('aria-hidden', 'true');
    }
    return true;
  }

  function cancelManualMode() {
    if (window.HavenfallManualControl?.isManualActive?.()) {
      window.HavenfallManualControl.setManualMode(false);
      return true;
    }
    if (state?.controlMode === 'manual' && window.HavenfallManualControl?.setControlMode) {
      window.HavenfallManualControl.setControlMode('auto');
      return true;
    }
    return false;
  }

  function clearSelection() {
    try {
      if (selectedWorldObjectId !== null) {
        selectedWorldObjectId = null;
        if (typeof updateUI === 'function') updateUI(true);
        return true;
      }
    } catch (_) {}
    return false;
  }

  function cancelOneLayer() {
    if (closeContextMenu()) return 'menu';
    if (cancelBuild()) return 'construção';
    if (cancelOrder()) return 'ordem';
    if (cancelZone()) return 'zona';
    if (cancelGatherSelection()) return 'seleção de coleta';
    if (closeResearch()) return 'pesquisa';
    if (closeDockPanel()) return 'painel';
    if (cancelManualMode()) return 'controle manual';
    if (clearSelection()) return 'seleção';
    return null;
  }

  function onEscape(event) {
    if (event.key !== 'Escape' && event.code !== 'Escape') return;
    if (isTypingTarget()) return;
    if (typeof SCREEN !== 'undefined' && appScreen !== SCREEN.PLAYING) return;
    const cancelled = cancelOneLayer();
    if (!cancelled) return;
    consume(event);
  }

  window.addEventListener('keydown', onEscape, true);
  document.addEventListener('keydown', onEscape, true);
  window.HavenfallEscapeRouter = { cancelOneLayer };
})();