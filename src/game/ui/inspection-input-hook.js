'use strict';

(() => {
  if (window.HavenfallContext?.inspectionInputHookInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.inspectionInputHookInstalled = true;

  function isTypingTarget(el = document.activeElement) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el.isContentEditable;
  }

  function shouldLetNativeCanvasClick(event) {
    if (event.button !== 0 || appScreen !== SCREEN.PLAYING || !state) return true;
    if (currentBuild) return true;
    if (suppressNextClick) return true;
    if (gatherSelection?.active) return true;
    if (event.shiftKey) return true;
    if (typeof isOrderToolActive === 'function' && isOrderToolActive('mine')) return true;
    return false;
  }

  function inspectCanvasClickCapture(event) {
    if (shouldLetNativeCanvasClick(event)) return;
    if (!window.InspectionPanel?.inspectCanvasEvent) return;
    const tile = typeof tileFromEvent === 'function' ? tileFromEvent(event) : null;
    if (!tile || (typeof isInside === 'function' && !isInside(tile.x, tile.y))) return;
    if (!window.InspectionPanel.inspectCanvasEvent(event, { tile })) return;
    hideContextMenu?.();
    event.preventDefault();
    event.stopImmediatePropagation();
    updateUI?.(true);
  }

  function openInspectionFromHudClick(event) {
    const select = event.target?.closest?.('[data-select-colonist]');
    if (!select || !state || !window.InspectionPanel?.selectById) return;
    const id = Number(select.dataset.selectColonist);
    if (!Number.isFinite(id)) return;
    setTimeout(() => {
      selectedColonistId = id;
      window.InspectionPanel.selectById('colonist', id);
      updateUI?.(true);
    }, 0);
  }

  function closeInspectionOnEsc(event) {
    if (isTypingTarget() || event.key !== 'Escape') return;
    if (currentBuild || appScreen !== SCREEN.PLAYING || !window.InspectionPanel?.isOpen?.()) return;
    window.InspectionPanel.clear();
    event.preventDefault();
    event.stopImmediatePropagation();
    updateUI?.(true);
  }

  canvas?.addEventListener?.('click', inspectCanvasClickCapture, true);
  document.addEventListener('click', openInspectionFromHudClick, true);
  window.addEventListener('keydown', closeInspectionOnEsc, true);
})();