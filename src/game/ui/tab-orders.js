'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.tabViews = window.HavenfallUI.tabViews || {};

  const FALLBACK_ORDER_TOOLS = [
    { key: 'move', label: 'Mover' },
    { key: 'mine', label: 'Minerar' },
    { key: 'gather', label: 'Coletar' },
    { key: 'build', label: 'Construir' },
    { key: 'haul', label: 'Estocar' },
    { key: 'inspect', label: 'Investigar' },
    { key: 'loot', label: 'Vasculhar' },
    { key: 'research', label: 'Pesquisar' },
    { key: 'forge', label: 'Forjar' },
    { key: 'cook', label: 'Cozinhar' },
    { key: 'heal', label: 'Tratar' },
    { key: 'fight', label: 'Combater' },
    { key: 'sleep', label: 'Dormir' },
    { key: 'deconstruct', label: 'Desconstruir' },
    { key: 'cancel', label: 'Cancelar' }
  ];

  const ORDER_TOOL_ICONS = {
    move: '➜',
    mine: '⛏️',
    gather: '☘️',
    build: '🔨',
    haul: '📦',
    inspect: '🔎',
    loot: '🎒',
    research: '📖',
    forge: '🔥',
    cook: '🍲',
    heal: '✚',
    fight: '⚔️',
    sleep: '☾',
    deconstruct: '⌫',
    cancel: '✕'
  };

  function activeOrderTool() {
    return typeof getOrderTool === 'function' ? getOrderTool() : currentOrderTool;
  }

  function orderTools() {
    return typeof getOrderToolDefinitions === 'function' ? getOrderToolDefinitions() : FALLBACK_ORDER_TOOLS;
  }

  function renderOrderButton(tool, activeTool) {
    const icon = ORDER_TOOL_ICONS[tool.key] || '•';
    return `<button type="button" class="dock-chip ${activeTool === tool.key ? 'is-active' : ''}" data-order-tool="${escapeHtml(tool.key)}">${icon} ${escapeHtml(tool.label)}</button>`;
  }

  function render() {
    if (!state) return '<div class="dock-empty">Inicie uma partida para usar ordens.</div>';
    const tool = activeOrderTool();

    return `<div class="orders-panel">
      <div class="dock-tab-head">
        <div>
          <h3>Ordens</h3>
        </div>
      </div>

      <div class="dock-chip-row" aria-label="Ordens do colono">
        ${orderTools().map(orderTool => renderOrderButton(orderTool, tool)).join('')}
      </div>
    </div>`;
  }

  function onOpen() {
    if (typeof syncOrderToolBodyClasses === 'function') syncOrderToolBodyClasses(activeOrderTool());
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
