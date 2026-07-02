'use strict';

(() => {
  if (!canvas || canvas.dataset.orderCanvasInputReady === '1') return;
  canvas.dataset.orderCanvasInputReady = '1';
  let orderDrag = null;
  let suppressNextOrderClick = false;

  function ensureOrderCursorStyles() {
    if (document.getElementById('orders-canvas-cursor-style')) return;
    const style = document.createElement('style');
    style.id = 'orders-canvas-cursor-style';
    style.textContent = `
      body.order-move-active canvas,
      body.order-mine-active canvas,
      body.order-gather-active canvas,
      body.order-build-active canvas,
      body.order-haul-active canvas,
      body.order-inspect-active canvas,
      body.order-loot-active canvas,
      body.order-research-active canvas,
      body.order-forge-active canvas,
      body.order-cook-active canvas,
      body.order-heal-active canvas,
      body.order-fight-active canvas,
      body.order-sleep-active canvas,
      body.order-deconstruct-active canvas,
      body.order-cancel-active canvas { cursor: crosshair !important; }
    `;
    document.head.appendChild(style);
  }

  function activeArchitectOrderTool() {
    const tool = typeof getOrderTool === 'function' ? getOrderTool() : null;
    return tool || null;
  }

  ensureOrderCursorStyles();

  function tileRect(a, b) {
    return {
      minX: Math.min(a.x, b.x),
      minY: Math.min(a.y, b.y),
      maxX: Math.max(a.x, b.x),
      maxY: Math.max(a.y, b.y)
    };
  }

  function orderDragLabel(tool) {
    return typeof orderToolLabel === 'function' ? orderToolLabel(tool).toLowerCase() : 'ordem';
  }

  function applyMineDrag(start, end, event = null) {
    if (!state?.world || typeof getRockAt !== 'function') return 0;
    const rect = tileRect(start, end);
    let count = 0;
    for (let y = rect.minY; y <= rect.maxY; y++) {
      for (let x = rect.minX; x <= rect.maxX; x++) {
        if (!isInside(x, y) || (typeof isTileDiscovered === 'function' && !isTileDiscovered(x, y))) continue;
        const rock = getRockAt(x, y);
        if (!rock?.solid || !rock.mineable) continue;
        if (typeof markRockForMining === 'function' && markRockForMining(x, y, true)) count++;
      }
    }
    if (count) {
      if (typeof log === 'function') log(`${count} tile${count === 1 ? '' : 's'} de rocha marcado${count === 1 ? '' : 's'} para mineração.`);
    } else if (typeof log === 'function') {
      log('Nenhuma rocha mineável encontrada nessa seleção.');
    }
    return count;
  }

  function drawOrderDragOverlay() {
    if (!orderDrag?.active || appScreen !== SCREEN.PLAYING || !state) return;
    const rect = tileRect(orderDrag.start, orderDrag.current);
    ctx.save();
    ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
    ctx.scale(viewTransform.scale, viewTransform.scale);
    const x = rect.minX * TILE;
    const y = rect.minY * TILE;
    const w = (rect.maxX - rect.minX + 1) * TILE;
    const h = (rect.maxY - rect.minY + 1) * TILE;
    const mine = orderDrag.tool === 'mine';
    ctx.fillStyle = mine ? 'rgba(251, 191, 36, .14)' : 'rgba(125, 211, 252, .12)';
    ctx.strokeStyle = mine ? '#fbbf24' : '#7dd3fc';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    ctx.fillStyle = mine ? '#fde68a' : '#dff6ff';
    ctx.font = '900 11px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(orderDragLabel(orderDrag.tool), x + 6, y + 15);
    ctx.restore();
  }

  function handleOrderMouseDown(event) {
    const tool = activeArchitectOrderTool();
    if (!tool || event.button !== 0 || appScreen !== SCREEN.PLAYING || !state) return;
    if (typeof tileFromEvent !== 'function') return;
    const tile = tileFromEvent(event);
    if (!tile || !isInside(tile.x, tile.y)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    orderDrag = {
      tool,
      start: tile,
      current: tile,
      startClientX: event.clientX,
      startClientY: event.clientY,
      active: false
    };
  }

  function handleOrderMouseMove(event) {
    if (!orderDrag || typeof tileFromEvent !== 'function') return;
    const tile = tileFromEvent(event);
    if (!tile || !isInside(tile.x, tile.y)) return;
    orderDrag.current = tile;
    const moved = Math.hypot(event.clientX - orderDrag.startClientX, event.clientY - orderDrag.startClientY);
    if (moved > 8) orderDrag.active = true;
    if (orderDrag.active) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }
  }

  function handleOrderMouseUp(event) {
    if (!orderDrag || event.button !== 0) return;
    const drag = orderDrag;
    orderDrag = null;
    if (!drag.active) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    suppressNextOrderClick = true;

    if (drag.tool === 'mine') applyMineDrag(drag.start, drag.current, event);
    else if (typeof handleOrderToolAtTile === 'function') handleOrderToolAtTile(drag.tool, drag.current, event);

    if (typeof updateUI === 'function') updateUI(true);
    window.HavenfallUI?.refreshDockPanel?.('orders');
  }

  canvas.addEventListener('click', event => {
    if (suppressNextOrderClick) {
      suppressNextOrderClick = false;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      return;
    }
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

  canvas.addEventListener('mousedown', handleOrderMouseDown, true);
  canvas.addEventListener('mousemove', handleOrderMouseMove, true);
  canvas.addEventListener('mouseup', handleOrderMouseUp, true);
  canvas.addEventListener('mouseleave', () => { orderDrag = null; }, true);
  window.GameSystems?.registerDrawOverlay?.('orders.drag-select', drawOrderDragOverlay, { order: 46 });
})();
