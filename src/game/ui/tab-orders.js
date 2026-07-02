'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.tabViews = window.HavenfallUI.tabViews || {};

  function activeOrderTool() {
    return typeof getOrderTool === 'function' ? getOrderTool() : currentOrderTool;
  }

  function render() {
    if (!state) return '<div class="dock-empty">Inicie uma partida para usar ordens.</div>';
    const tool = activeOrderTool();
    const activeMine = tool === 'mine';
    const activeDeconstruct = tool === 'deconstruct';
    const activeCancel = tool === 'cancel';

    return `<div class="orders-panel">
      <div class="dock-tab-head">
        <div>
          <h3>Ordens</h3>
        </div>
      </div>

      <div class="dock-chip-row" aria-label="Ordens do colono">
        <button type="button" class="dock-chip ${activeMine ? 'is-active' : ''}" data-order-tool="mine">⛏️ Minerar</button>
        <button type="button" class="dock-chip ${activeDeconstruct ? 'is-active' : ''}" data-order-tool="deconstruct">⌫ Desconstruir</button>
        <button type="button" class="dock-chip ${activeCancel ? 'is-active' : ''}" data-order-tool="cancel">✕ Cancelar</button>
      </div>
    </div>`;
  }

  function onOpen() {
    const tool = activeOrderTool();
    document.body.classList.toggle('order-mine-active', tool === 'mine');
    document.body.classList.toggle('order-deconstruct-active', tool === 'deconstruct');
    document.body.classList.toggle('order-cancel-active', tool === 'cancel');
  }

  function handleClick(event) {
    if (!event.target.closest?.('#anchored-ui-panel')) return;

    const orderTool = event.target.closest?.('[data-order-tool]');
    if (orderTool) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const tool = orderTool.dataset.orderTool;
      if (typeof setOrderTool === 'function') setOrderTool(activeOrderTool() === tool ? null : tool);
      window.HavenfallUI.refreshDockPanel?.('orders');
    }
  }

  document.addEventListener('click', handleClick, true);
  window.HavenfallUI.tabViews.orders = { render, onOpen };
})();
