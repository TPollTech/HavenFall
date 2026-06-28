'use strict';

(() => {
  if (!canvas || canvas.dataset.orderCanvasInputReady === '1') return;
  canvas.dataset.orderCanvasInputReady = '1';

  function activeArchitectOrderTool() {
    const tool = typeof getOrderTool === 'function' ? getOrderTool() : null;
    return tool && tool !== 'mine' ? tool : null;
  }

  canvas.addEventListener('click', event => {
    const tool = activeArchitectOrderTool();
    if (!tool || appScreen !== SCREEN.PLAYING || !state) return;
    if (typeof tileFromEvent !== 'function' || typeof handleOrderToolAtTile !== 'function') return;
    const tile = tileFromEvent(event);
    if (!tile || !isInside(tile.x, tile.y)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    handleOrderToolAtTile(tool, tile, event);
    if (typeof updateUI === 'function') updateUI(true);
    window.HavenfallUI?.refreshDockPanel?.('orders');
  }, true);
})();
