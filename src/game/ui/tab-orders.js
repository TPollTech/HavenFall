'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.tabViews = window.HavenfallUI.tabViews || {};

  function selectedColonistName() {
    const c = typeof selectedColonist === 'function' ? selectedColonist() : null;
    return c?.name || 'nenhum colono selecionado';
  }

  function orderToolName() {
    return currentOrderTool === 'mine' ? 'Minerar' : 'Nenhuma';
  }

  function render() {
    if (!state) return '<div class="dock-empty">Inicie uma partida para usar ordens.</div>';
    const marked = typeof countMarkedMines === 'function' ? countMarkedMines() : 0;
    const activeMine = currentOrderTool === 'mine';
    const cName = selectedColonistName();

    return `<div class="orders-panel">
      <div class="dock-tab-head">
        <div>
          <h3>Ordens</h3>
          <p>Escolha uma ordem e clique no mapa. Para mineração, clique em rochas/montanhas.</p>
        </div>
        <button type="button" data-clear-order-tool>Cancelar ordem</button>
      </div>

      <div class="dock-chip-row">
        <button type="button" class="dock-chip ${activeMine ? 'is-active' : ''}" data-order-tool="mine">⛏️ Minerar</button>
        <button type="button" class="dock-chip" data-auto-mine>Mineração automática</button>
        <button type="button" class="dock-chip" data-mark-nearby-mine>Marcar rochas próximas</button>
      </div>

      <div class="dock-card-grid">
        <div class="dock-card order-status-card">
          <strong>Ferramenta ativa</strong>
          <small>${escapeHtml(orderToolName())}</small>
          <span class="dock-badge">${activeMine ? 'clique em rochas' : 'sem pincel ativo'}</span>
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
      </div>

      <div class="dock-empty order-help">
        <b>Como usar:</b>
        <span>Ative Minerar e clique em uma montanha. Shift + clique também marca mineração. Botão direito na rocha abre ações contextuais.</span>
      </div>
    </div>`;
  }

  function onOpen() {
    document.body.classList.toggle('order-mine-active', currentOrderTool === 'mine');
  }

  function handleClick(event) {
    const orderTool = event.target.closest?.('[data-order-tool]');
    if (orderTool) {
      const tool = orderTool.dataset.orderTool;
      if (typeof setOrderTool === 'function') setOrderTool(currentOrderTool === tool ? null : tool);
      window.HavenfallUI.refreshDockPanel?.('orders');
      return;
    }

    const clear = event.target.closest?.('[data-clear-order-tool]');
    if (clear) {
      if (typeof clearOrderTool === 'function') clearOrderTool('manual');
      window.HavenfallUI.refreshDockPanel?.('orders');
      return;
    }

    const autoMine = event.target.closest?.('[data-auto-mine]');
    if (autoMine) {
      if (typeof assignNearestMine === 'function') assignNearestMine(null, { markedOnly: true });
      window.HavenfallUI.refreshDockPanel?.('orders');
      return;
    }

    const markNearby = event.target.closest?.('[data-mark-nearby-mine]');
    if (markNearby) {
      if (typeof markVisibleMineableRocks === 'function') markVisibleMineableRocks(12);
      window.HavenfallUI.refreshDockPanel?.('orders');
    }
  }

  document.addEventListener('click', handleClick);
  window.HavenfallUI.tabViews.orders = { render, onOpen };
})();
