'use strict';

(() => {
  if (!canvas || canvas.dataset.orderCanvasInputReady === '1') return;
  canvas.dataset.orderCanvasInputReady = '1';

  const ORDER_TOOL_MODES = Object.freeze({
    mine: 'area',
    gather: 'area',
    deconstruct: 'area',
    cancel: 'area'
  });

  const nativeOrderDefinitions = typeof window.getOrderToolDefinitions === 'function'
    ? window.getOrderToolDefinitions
    : null;
  const nativeHandleOrderToolAtTile = typeof window.handleOrderToolAtTile === 'function'
    ? window.handleOrderToolAtTile
    : null;

  let orderDrag = null;
  let suppressNextOrderClick = false;

  function orderLog(message) {
    if (typeof log === 'function') log(message);
  }

  function orderToolMode(tool) {
    return ORDER_TOOL_MODES[tool] || 'target';
  }

  function orderToolSupportsArea(tool) {
    return orderToolMode(tool) === 'area';
  }

  function getOrderToolDefinitionsWithMode() {
    const tools = nativeOrderDefinitions ? nativeOrderDefinitions() : [];
    return tools.map(tool => ({ ...tool, mode: orderToolMode(tool.key) }));
  }

  window.orderToolMode = orderToolMode;
  window.orderToolSupportsArea = orderToolSupportsArea;
  window.getOrderToolDefinitions = getOrderToolDefinitionsWithMode;

  function discoveredTile(x, y) {
    return typeof isTileDiscovered !== 'function' || isTileDiscovered(x, y);
  }

  function isInsideSafe(x, y) {
    return typeof isInside !== 'function' || isInside(x, y);
  }

  function isGatherableOrderTarget(obj) {
    if (!obj) return false;
    if (typeof isGatherableReady === 'function') return !!isGatherableReady(obj);
    const def = objectDefs?.[obj.type];
    if (!def?.gather) return false;
    return obj.type !== 'crop' || (obj.growth || 0) >= 100;
  }

  function objectAtTile(tile) {
    return discoveredTile(tile.x, tile.y) && typeof getObjectAt === 'function' ? getObjectAt(tile.x, tile.y) : null;
  }

  function rockAtTile(tile) {
    return discoveredTile(tile.x, tile.y) && typeof getRockAt === 'function' ? getRockAt(tile.x, tile.y) : null;
  }

  function cancelObjectOrderQuiet(obj) {
    if (!obj) return false;
    if (obj.type === 'blueprint') {
      const def = buildDefs?.[obj.buildType];
      const reservedCost = obj.reservedCost || def?.cost || {};
      const reservedItemCost = obj.reservedItemCost || def?.itemCost || {};
      if (Object.keys(reservedCost).length) {
        if (typeof refundCost === 'function') refundCost(reservedCost, { reason: 'build-cancel', targetId: obj.id, x: obj.x, y: obj.y });
        else if (typeof addResources === 'function') addResources(reservedCost);
      }
      if (Object.keys(reservedItemCost).length) {
        if (typeof refundItems === 'function') refundItems(reservedItemCost, { reason: 'build-cancel', targetId: obj.id, x: obj.x, y: obj.y });
        else if (typeof addItems === 'function') addItems(reservedItemCost);
      }
      state.objects = (state.objects || []).filter(o => o.id !== obj.id);
      if (state.world) state.world.objects = state.objects;
      if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
      return true;
    }
    if (obj.markedForDeconstruct) { obj.markedForDeconstruct = false; return true; }
    if (obj.markedForGather) { obj.markedForGather = false; return true; }
    return false;
  }

  function selectedOrderColonist() {
    const c = typeof selectedColonist === 'function' ? selectedColonist() : null;
    if (!c) orderLog('Selecione um colono antes de dar essa ordem.');
    return c;
  }

  function handleGatherOrderAtTile(tile) {
    const c = selectedOrderColonist();
    if (!c) return true;

    const obj = objectAtTile(tile);
    if (obj && isGatherableOrderTarget(obj) && typeof assignGather === 'function') {
      assignGather(c, obj);
      if (c.task?.type !== 'gather') orderLog(`${c.name} não conseguiu chegar em ${objectDefs?.[obj.type]?.name || obj.type}.`);
      return true;
    }

    const rock = rockAtTile(tile);
    if (rock?.solid && rock.mineable && typeof assignMine === 'function') {
      if (!assignMine(c, tile.x, tile.y, true)) orderLog(`${c.name} não encontrou caminho até essa rocha/minério.`);
      return true;
    }

    orderLog('Coletar: clique em árvore, toras, rocha, minério, planta madura ou arraste uma área com recursos.');
    return true;
  }

  function handleOrderToolAtTileWithSemantics(tool, tile, event = null) {
    if (tool === 'gather') return handleGatherOrderAtTile(tile);
    return nativeHandleOrderToolAtTile ? nativeHandleOrderToolAtTile(tool, tile, event) : false;
  }

  window.handleOrderToolAtTile = handleOrderToolAtTileWithSemantics;

  function tileRect(a, b) {
    return {
      minX: Math.min(a.x, b.x),
      minY: Math.min(a.y, b.y),
      maxX: Math.max(a.x, b.x),
      maxY: Math.max(a.y, b.y)
    };
  }

  function markMiningRocks(rect) {
    if (typeof getRockAt !== 'function' || typeof markRockForMining !== 'function') return 0;
    let count = 0;
    for (let y = rect.minY; y <= rect.maxY; y++) {
      for (let x = rect.minX; x <= rect.maxX; x++) {
        if (!isInsideSafe(x, y) || !discoveredTile(x, y)) continue;
        const rock = getRockAt(x, y);
        if (rock?.solid && rock.mineable && !rock.markedForMining && markRockForMining(x, y, true)) count++;
      }
    }
    return count;
  }

  function markGatherObjects(rect) {
    let count = 0;
    for (const obj of state?.objects || []) {
      if (obj.x < rect.minX || obj.x > rect.maxX || obj.y < rect.minY || obj.y > rect.maxY) continue;
      if (!discoveredTile(obj.x, obj.y) || !isGatherableOrderTarget(obj) || obj.markedForGather) continue;
      obj.markedForGather = true;
      count++;
    }
    return count;
  }

  function markDeconstructObjects(rect) {
    let count = 0;
    for (const obj of state?.objects || []) {
      if (obj.x < rect.minX || obj.x > rect.maxX || obj.y < rect.minY || obj.y > rect.maxY) continue;
      if (!discoveredTile(obj.x, obj.y) || obj.type === 'blueprint' || obj.markedForDeconstruct) continue;
      if (typeof markObjectForDeconstruct === 'function' && markObjectForDeconstruct(obj, false)) count++;
    }
    if (count && typeof assignNearestDeconstruct === 'function') assignNearestDeconstruct();
    return count;
  }

  function cancelOrders(rect) {
    let count = 0;
    for (const obj of [...(state?.objects || [])]) {
      if (obj.x < rect.minX || obj.x > rect.maxX || obj.y < rect.minY || obj.y > rect.maxY) continue;
      if (discoveredTile(obj.x, obj.y) && cancelObjectOrderQuiet(obj)) count++;
    }
    if (typeof getRockAt === 'function' && typeof markRockForMining === 'function') {
      for (let y = rect.minY; y <= rect.maxY; y++) {
        for (let x = rect.minX; x <= rect.maxX; x++) {
          if (!isInsideSafe(x, y) || !discoveredTile(x, y)) continue;
          const rock = getRockAt(x, y);
          if (rock?.markedForMining) { markRockForMining(x, y, false); count++; }
        }
      }
    }
    return count;
  }

  function applyOrderToolToArea(tool, start, end) {
    if (!orderToolSupportsArea(tool) || !start || !end || !state) return false;
    const rect = tileRect(start, end);

    if (tool === 'mine') {
      const rocks = markMiningRocks(rect);
      if (typeof assignMarkedGatherTasks === 'function') assignMarkedGatherTasks();
      orderLog(rocks ? `${rocks} rocha${rocks === 1 ? '' : 's'} marcada${rocks === 1 ? '' : 's'} para mineração.` : 'Nenhuma rocha mineável encontrada nessa área.');
      return true;
    }

    if (tool === 'gather') {
      const resources = markGatherObjects(rect);
      const rocks = markMiningRocks(rect);
      if (typeof assignMarkedGatherTasks === 'function') assignMarkedGatherTasks();
      if (!resources && !rocks) orderLog('Nenhum recurso coletável encontrado nessa área.');
      else {
        const parts = [];
        if (resources) parts.push(`${resources} recurso${resources === 1 ? '' : 's'} coletável${resources === 1 ? '' : 'eis'}`);
        if (rocks) parts.push(`${rocks} rocha${rocks === 1 ? '' : 's'} mineável${rocks === 1 ? '' : 'eis'}`);
        orderLog(`Coleta marcada: ${parts.join(' e ')}.`);
      }
      return true;
    }

    if (tool === 'deconstruct') {
      const count = markDeconstructObjects(rect);
      orderLog(count ? `${count} objeto${count === 1 ? '' : 's'} marcado${count === 1 ? '' : 's'} para desconstrução.` : 'Nenhuma estrutura desconstruível encontrada nessa área.');
      return true;
    }

    if (tool === 'cancel') {
      const count = cancelOrders(rect);
      if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
      orderLog(count ? `${count} ${count === 1 ? 'ordem cancelada' : 'ordens canceladas'} nessa área.` : 'Nenhuma ordem pendente encontrada nessa área.');
      return true;
    }
    return false;
  }

  window.applyOrderToolToArea = applyOrderToolToArea;

  function ensureOrderCursorStyles() {
    if (document.getElementById('orders-canvas-cursor-style')) return;
    const style = document.createElement('style');
    style.id = 'orders-canvas-cursor-style';
    style.textContent = `body.order-move-active canvas,body.order-mine-active canvas,body.order-gather-active canvas,body.order-build-active canvas,body.order-haul-active canvas,body.order-inspect-active canvas,body.order-loot-active canvas,body.order-research-active canvas,body.order-forge-active canvas,body.order-cook-active canvas,body.order-heal-active canvas,body.order-fight-active canvas,body.order-sleep-active canvas,body.order-deconstruct-active canvas,body.order-cancel-active canvas{cursor:crosshair!important}`;
    document.head.appendChild(style);
  }

  function activeOrderTool() {
    return typeof getOrderTool === 'function' ? getOrderTool() : null;
  }

  ensureOrderCursorStyles();

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
    ctx.fillStyle = 'rgba(125,211,252,.12)';
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    ctx.fillStyle = '#dff6ff';
    ctx.font = '900 11px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(typeof orderToolLabel === 'function' ? orderToolLabel(orderDrag.tool).toLowerCase() : 'ordem', x + 6, y + 15);
    ctx.restore();
  }

  function handleOrderMouseDown(event) {
    const tool = activeOrderTool();
    if (!tool || event.button !== 0 || appScreen !== SCREEN.PLAYING || !state || typeof tileFromEvent !== 'function') return;
    const tile = tileFromEvent(event);
    if (!tile || !isInsideSafe(tile.x, tile.y)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    orderDrag = orderToolSupportsArea(tool) ? { tool, start: tile, current: tile, startClientX: event.clientX, startClientY: event.clientY, active: false } : null;
  }

  function handleOrderMouseMove(event) {
    if (!orderDrag || typeof tileFromEvent !== 'function') return;
    const tile = tileFromEvent(event);
    if (!tile || !isInsideSafe(tile.x, tile.y)) return;
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
    applyOrderToolToArea(drag.tool, drag.start, drag.current);
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
    const tool = activeOrderTool();
    if (!tool || appScreen !== SCREEN.PLAYING || !state || typeof tileFromEvent !== 'function') return;
    const tile = tileFromEvent(event);
    if (!tile || !isInsideSafe(tile.x, tile.y)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    window.handleOrderToolAtTile?.(tool, tile, event);
    if (typeof updateUI === 'function') updateUI(true);
    window.HavenfallUI?.refreshDockPanel?.('orders');
  }, true);

  canvas.addEventListener('mousedown', handleOrderMouseDown, true);
  canvas.addEventListener('mousemove', handleOrderMouseMove, true);
  canvas.addEventListener('mouseup', handleOrderMouseUp, true);
  canvas.addEventListener('mouseleave', () => { orderDrag = null; }, true);
  window.GameSystems?.registerDrawOverlay?.('orders.drag-select', drawOrderDragOverlay, { order: 46 });
})();
