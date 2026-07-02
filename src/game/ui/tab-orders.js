'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.tabViews = window.HavenfallUI.tabViews || {};

  const FALLBACK_ORDER_TOOLS = [
    { key: 'move', label: 'Mover', mode: 'tile' },
    { key: 'mine', label: 'Minerar', mode: 'area' },
    { key: 'gather', label: 'Coletar', mode: 'area' },
    { key: 'build', label: 'Construir', mode: 'target' },
    { key: 'haul', label: 'Estocar', mode: 'target' },
    { key: 'inspect', label: 'Investigar', mode: 'target' },
    { key: 'loot', label: 'Vasculhar', mode: 'target' },
    { key: 'research', label: 'Pesquisar', mode: 'target' },
    { key: 'forge', label: 'Forjar', mode: 'target' },
    { key: 'cook', label: 'Cozinhar', mode: 'target' },
    { key: 'heal', label: 'Tratar', mode: 'target' },
    { key: 'fight', label: 'Combater', mode: 'target' },
    { key: 'sleep', label: 'Dormir', mode: 'target' },
    { key: 'deconstruct', label: 'Desconstruir', mode: 'area' },
    { key: 'cancel', label: 'Cancelar', mode: 'area' }
  ];

  const ORDER_TOOL_MARKS = {
    move: 'MOV',
    mine: 'MIN',
    gather: 'COL',
    build: 'CON',
    haul: 'EST',
    inspect: 'INV',
    loot: 'VAS',
    research: 'PES',
    forge: 'FOR',
    cook: 'COZ',
    heal: 'MED',
    fight: 'COM',
    sleep: 'DOR',
    deconstruct: 'DES',
    cancel: 'CAN'
  };

  function activeOrderTool() {
    return typeof getOrderTool === 'function' ? getOrderTool() : currentOrderTool;
  }

  function orderTools() {
    return typeof getOrderToolDefinitions === 'function' ? getOrderToolDefinitions() : FALLBACK_ORDER_TOOLS;
  }

  function toolMode(tool) {
    return tool.mode || (typeof orderToolMode === 'function' ? orderToolMode(tool.key) : 'target');
  }

  function renderOrderButton(tool, activeTool) {
    const mark = ORDER_TOOL_MARKS[tool.key] || tool.label.slice(0, 3).toUpperCase();
    const mode = toolMode(tool);
    return `<button type="button" class="dock-chip order-chip ${activeTool === tool.key ? 'is-active' : ''}" data-order-tool="${escapeHtml(tool.key)}" data-order-mode="${escapeHtml(mode)}"><span>${escapeHtml(mark)}</span>${escapeHtml(tool.label)}</button>`;
  }

  function renderGroup(title, tools, activeTool) {
    if (!tools.length) return '';
    return `<section class="dock-order-group">
      <strong>${escapeHtml(title)}</strong>
      <div class="dock-chip-row" aria-label="${escapeHtml(title)}">
        ${tools.map(orderTool => renderOrderButton(orderTool, activeTool)).join('')}
      </div>
    </section>`;
  }

  function render() {
    if (!state) return '<div class="dock-empty">Inicie uma partida para usar ordens.</div>';
    const tool = activeOrderTool();
    const tools = orderTools();
    const areaTools = tools.filter(orderTool => toolMode(orderTool) === 'area');
    const targetTools = tools.filter(orderTool => toolMode(orderTool) !== 'area');

    return `<div class="orders-panel">
      <div class="dock-tab-head">
        <div>
          <h3>Ordens</h3>
        </div>
      </div>

      <div class="dock-order-groups" aria-label="Ordens do colono">
        ${renderGroup('Arrastar área', areaTools, tool)}
        ${renderGroup('Clicar em alvo', targetTools, tool)}
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
