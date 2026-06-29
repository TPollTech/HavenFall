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

  function closeContextMenuIfOpen() {
    const menu = document.getElementById('contextMenu');
    if (!menu?.classList.contains('show')) return false;
    if (typeof hideContextMenu === 'function') hideContextMenu();
    else menu.classList.remove('show');
    return true;
  }

  function closeResearchIfOpen() {
    const overlay = document.getElementById('research-tree-overlay');
    if (!overlay?.classList.contains('show')) return false;
    if (window.HavenfallUI?.closeResearchOverlay) window.HavenfallUI.closeResearchOverlay();
    else overlay.classList.remove('show');
    return true;
  }

  function closeDockPanelIfOpen() {
    const panel = document.getElementById('anchored-ui-panel');
    if (!panel?.classList.contains('is-active')) return false;
    if (window.uiManager?.closeCurrentPanel) window.uiManager.closeCurrentPanel();
    else {
      panel.classList.remove('is-active');
      panel.setAttribute('aria-hidden', 'true');
    }
    document.body.dataset.activeDockTab = '';
    document.querySelectorAll('#bottom-navigation-dock [data-ui-panel].is-active').forEach(button => button.classList.remove('is-active'));
    return true;
  }

  function cancelBuildTool() {
    if (typeof currentBuild === 'undefined' || !currentBuild) return false;
    const label = buildDefs?.[currentBuild]?.label || currentBuild;
    currentBuild = null;
    if (typeof updateUI === 'function') updateUI(true);
    if (typeof log === 'function') log(`Construção cancelada: ${label}.`);
    return true;
  }

  function cancelOrderTool() {
    if (typeof getOrderTool !== 'function' || typeof clearOrderTool !== 'function') return false;
    const active = getOrderTool();
    if (!active) return false;
    clearOrderTool('manual');
    return true;
  }

  function cancelZoneToolIfActive() {
    const activeButton = document.querySelector('[data-zone-tool].active, [data-clear-zone-tool].active');
    const bodyLooksActive = document.body.classList.contains('zone-tool-active');
    if (!activeButton && !bodyLooksActive) return false;
    if (typeof clearZoneTool === 'function') clearZoneTool('ESC');
    return true;
  }

  function cancelGatherDrag() {
    let cancelled = false;
    try {
      if (typeof gatherSelection !== 'undefined' && gatherSelection) {
        gatherSelection = null;
        cancelled = true;
      }
      if (typeof suppressNextClick !== 'undefined') suppressNextClick = false;
    } catch (_) {}
    return cancelled;
  }

  function cancelManualSelectedAction() {
    if (!state || state.controlMode !== 'manual' || typeof selectedColonist !== 'function') return false;
    const c = selectedColonist();
    if (!c || (!c.task && !c.path?.length && !c.manualAction)) return false;
    c.task = null;
    c.path = [];
    c.work = 0;
    c.manualAction = false;
    c.note = 'Ação manual cancelada';
    if (typeof updateUI === 'function') updateUI(true);
    return true;
  }

  function clearWorldSelection() {
    let changed = false;
    if (typeof selectedWorldObjectId !== 'undefined' && selectedWorldObjectId !== null) {
      selectedWorldObjectId = null;
      changed = true;
    }
    return changed;
  }

  function closeGameplayModalIfOpen() {
    const modal = document.getElementById('eventModal');
    if (!modal?.classList.contains('show')) return false;
    modal.classList.remove('show');
    if (typeof setScreen === 'function') setScreen(SCREEN.PLAYING);
    return true;
  }

  function cancelOneEscapeLayer() {
    if (closeContextMenuIfOpen()) return 'menu de contexto';
    if (cancelBuildTool()) return 'construção';
    if (cancelOrderTool()) return 'ordem';
    if (cancelZoneToolIfActive()) return 'zona';
    if (cancelGatherDrag()) return 'seleção de coleta';
    if (closeResearchIfOpen()) return 'pesquisa';
    if (closeDockPanelIfOpen()) return 'painel';
    if (cancelManualSelectedAction()) return 'ação manual';
    if (clearWorldSelection()) return 'seleção';
    if (closeGameplayModalIfOpen()) return 'evento';
    return null;
  }

  function onEscape(event) {
    if (event.key !== 'Escape' && event.code !== 'Escape') return;
    if (isTypingTarget()) return;
    if (typeof SCREEN !== 'undefined' && appScreen !== SCREEN.PLAYING) return;
    const layer = cancelOneEscapeLayer();
    if (!layer) return;
    consume(event);
    if (typeof log === 'function' && !['construção', 'ordem', 'zona'].includes(layer)) log(`ESC: ${layer} cancelado.`);
    if (typeof updateUI === 'function') updateUI(true);
  }

  window.addEventListener('keydown', onEscape, true);
  window.HavenfallEscapeRouter = { cancelOneEscapeLayer };
})();