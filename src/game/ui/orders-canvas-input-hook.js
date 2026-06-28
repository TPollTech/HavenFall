'use strict';

(() => {
  if (!canvas || canvas.dataset.orderCanvasInputReady === '1') return;
  canvas.dataset.orderCanvasInputReady = '1';

  function ensureOrderCursorStyles() {
    if (document.getElementById('orders-canvas-cursor-style')) return;
    const style = document.createElement('style');
    style.id = 'orders-canvas-cursor-style';
    style.textContent = `
      body.order-deconstruct-active canvas,
      body.order-cancel-active canvas { cursor: crosshair !important; }
    `;
    document.head.appendChild(style);
  }

  function activeArchitectOrderTool() {
    const tool = typeof getOrderTool === 'function' ? getOrderTool() : null;
    return tool && tool !== 'mine' ? tool : null;
  }

  ensureOrderCursorStyles();

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
