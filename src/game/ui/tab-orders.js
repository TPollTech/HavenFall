'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.tabViews = window.HavenfallUI.tabViews || {};

  function selectedColonistName() {
    const c = typeof selectedColonist === 'function' ? selectedColonist() : null;
    return c?.name || 'nenhum colono selecionado';
  }

  function activeOrderTool() {
    return typeof getOrderTool === 'function' ? getOrderTool() : currentOrderTool;
  }

  function orderToolName() {
    return typeof orderToolLabel === 'function' ? orderToolLabel(activeOrderTool()) : 'Nenhuma';
  }

  function render() {
    if (!state) return '<div class="dock-empty">Inicie uma partida para usar ordens.</div>';
    const marked = typeof countMarkedMines === 'function' ? countMarkedMines() : 0;
    const markedDeconstruct = typeof countMarkedDeconstruct === 'function' ? countMarkedDeconstruct() : 0;
    const tool = activeOrderTool();
    const activeMine = tool === 'mine';
    const activeDeconstruct = tool === 'deconstruct';
    const activeCancel = tool === 'cancel';
    const cName = selectedColonistName();

    return `<div class="orders-panel">
      <div class="dock-tab-head">
        <div>
          <h3>Ordens</h3>
          <p>Escolha uma ordem e clique no mapa. Use Cancelar para blueprint/marcações e Desconstruir para estruturas prontas.</p>
        </div>
        <button type="button" data-clear-order-tool>Limpar ferramenta</button>
      </div>

      <div class="dock-chip-row">
        <button type="button" class="dock-chip ${activeMine ? 'is-active' : ''}" data-order-tool="mine">⛏️ Minerar</button>
        <button type="button" class="dock-chip ${activeDeconstruct ? 'is-active' : ''}" data-order-tool="deconstruct">⌫ Desconstruir</button>
        <button type="button" class="dock-chip ${activeCancel ? 'is-active' : ''}" data-order-tool="cancel">✕ Cancelar</button>
        <button type="button" class="dock-chip" data-auto-mine>Mineração automática</button>
        <button type="button" class="dock-chip" data-mark-nearby-mine>Marcar rochas próximas</button>
      </div>

      <div class="dock-card-grid">
        <div class="dock-card order-status-card">
          <strong>Ferramenta ativa</strong>
          <small>${escapeHtml(orderToolName())}</small>
          <span class="dock-badge">${tool ? 'clique no mapa' : 'sem pincel ativo'}</span>
        </div>
        <div class="dock-card order-status-card">
          <strong>Colono selecionado</strong>
          <small>${escapeHtml(cName)}</small>
          <span class="dock-badge">ordens manuais usam esse colono</span>
        </div>
        <div class="dock-card order-status-card">
          <strong>Rochas marcadas</strong>
          <small>${marked} tile${marked === 1 ? '' : 's'} na fila</small>
          <span class="dock-badge">prioridade Coleta executa</span>
        </div>
        <div class="dock-card order-status-card">
          <strong>Desconstruções</strong>
          <small>${markedDeconstruct} objeto${markedDeconstruct === 1 ? '' : 's'} marcado${markedDeconstruct === 1 ? '' : 's'}</small>
          <span class="dock-badge">prioridade Construção executa</span>
        </div>
      </div>

      <div class="dock-empty order-help">
        <b>Como usar:</b>
        <span>Minerar clica em montanhas. Desconstruir clica em estrutura pronta. Cancelar remove blueprint, coleta marcada, mineração marcada ou desconstrução pendente.</span>
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
      return;
    }

    const clear = event.target.closest?.('[data-clear-order-tool]');
    if (clear) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (typeof clearOrderTool === 'function') clearOrderTool('manual');
      window.HavenfallUI.refreshDockPanel?.('orders');
      return;
    }

    const autoMine = event.target.closest?.('[data-auto-mine]');
    if (autoMine) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (typeof assignNearestMine === 'function') assignNearestMine(null, { markedOnly: true });
      window.HavenfallUI.refreshDockPanel?.('orders');
      return;
    }

    const markNearby = event.target.closest?.('[data-mark-nearby-mine]');
    if (markNearby) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (typeof markVisibleMineableRocks === 'function') markVisibleMineableRocks(12);
      window.HavenfallUI.refreshDockPanel?.('orders');
    }
  }

  document.addEventListener('click', handleClick, true);
  window.HavenfallUI.tabViews.orders = { render, onOpen };
})();
