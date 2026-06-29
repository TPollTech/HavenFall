'use strict';

let currentOrderTool = null;

const ORDER_TOOL_CLASSES = ['order-mine-active', 'order-deconstruct-active', 'order-cancel-active'];

function setOrderTool(tool = null) {
  currentOrderTool = tool || null;
  document.body.classList.remove(...ORDER_TOOL_CLASSES);
  document.body.classList.toggle('order-mine-active', currentOrderTool === 'mine');
  document.body.classList.toggle('order-deconstruct-active', currentOrderTool === 'deconstruct');
  document.body.classList.toggle('order-cancel-active', currentOrderTool === 'cancel');

  if (currentOrderTool) {
    if (typeof clearZoneTool === 'function') clearZoneTool('orders');
    const label = orderToolLabel(currentOrderTool);
    log(`Ordem ${label} ativa: clique no mapa para aplicar.`);
  }
  return currentOrderTool;
}

function clearOrderTool(reason = 'manual') {
  currentOrderTool = null;
  document.body.classList.remove(...ORDER_TOOL_CLASSES);
  if (reason === 'manual') log('Ferramenta de ordem desativada.');
}

function getOrderTool() {
  return currentOrderTool;
}

function isOrderToolActive(tool) {
  return currentOrderTool === tool;
}

function orderToolLabel(tool = currentOrderTool) {
  return ({ mine: 'Minerar', deconstruct: 'Desconstruir', cancel: 'Cancelar' })[tool] || 'Nenhuma';
}

function countMarkedMines() {
  if (!state?.world || typeof ensureGeologyState !== 'function') return 0;
  ensureGeologyState();
  let total = 0;
  for (const row of state.world.geologyLayer || []) {
    for (const rock of row || []) if (rock?.solid && rock.markedForMining) total++;
  }
  return total;
}

function countMarkedDeconstruct() {
  return (state?.objects || []).filter(o => o.markedForDeconstruct).length;
}

function nearestMineableRock(c, markedOnly = false) {
  if (!c || !state?.world || typeof ensureGeologyState !== 'function') return null;
  ensureGeologyState();
  let best = null;
  let bestDist = Infinity;
  const layer = state.world.geologyLayer || [];
  for (let y = 0; y < layer.length; y++) {
    for (let x = 0; x < (layer[y]?.length || 0); x++) {
      const rock = layer[y][x];
      if (!rock?.solid || !rock.mineable) continue;
      if (markedOnly && !rock.markedForMining) continue;
      if (typeof isTileDiscovered === 'function' && !isTileDiscovered(x, y)) continue;
      const adj = typeof nearestFreeAdjacent === 'function' ? nearestFreeAdjacent(x, y, c.x, c.y) : null;
      if (!adj) continue;
      const d = Math.abs(c.x - x) + Math.abs(c.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = { x, y, rock, adj, distance: d };
      }
    }
  }
  return best;
}

function assignNearestMine(c = null, options = {}) {
  const colonist = c || (typeof selectedColonist === 'function' ? selectedColonist() : null);
  if (!colonist) {
    log('Selecione um colono para iniciar mineração automática.');
    return false;
  }
  const target = nearestMineableRock(colonist, !!options.markedOnly) || nearestMineableRock(colonist, false);
  if (!target) {
    log('Nenhuma rocha mineável acessível foi encontrada.');
    return false;
  }
  if (typeof markRockForMining === 'function') markRockForMining(target.x, target.y, true);
  if (typeof assignMine === 'function') {
    const ok = assignMine(colonist, target.x, target.y, true);
    if (ok) log(`${colonist.name} recebeu ordem de mineração automática.`);
    return ok;
  }
  return false;
}

function markVisibleMineableRocks(limit = 12) {
  if (!state?.world || typeof ensureGeologyState !== 'function') return 0;
  const c = typeof selectedColonist === 'function' ? selectedColonist() : null;
  if (!c) return 0;
  ensureGeologyState();
  const candidates = [];
  const layer = state.world.geologyLayer || [];
  for (let y = 0; y < layer.length; y++) {
    for (let x = 0; x < (layer[y]?.length || 0); x++) {
      const rock = layer[y][x];
      if (!rock?.solid || !rock.mineable || rock.markedForMining) continue;
      if (typeof isTileDiscovered === 'function' && !isTileDiscovered(x, y)) continue;
      const adj = typeof nearestFreeAdjacent === 'function' ? nearestFreeAdjacent(x, y, c.x, c.y) : null;
      if (!adj) continue;
      candidates.push({ x, y, d: Math.abs(c.x - x) + Math.abs(c.y - y) });
    }
  }
  candidates.sort((a, b) => a.d - b.d);
  const picked = candidates.slice(0, Math.max(1, Number(limit) || 12));
  if (typeof markRockForMining === 'function') {
    for (const p of picked) markRockForMining(p.x, p.y, true);
  }
  if (picked.length) {
    log(`${picked.length} rocha${picked.length > 1 ? 's' : ''} próxima${picked.length > 1 ? 's' : ''} marcada${picked.length > 1 ? 's' : ''} para mineração.`);
  }
  return picked.length;
}

function buildDefForObject(obj) {
  if (!obj) return null;
  if (obj.type === 'blueprint') return buildDefs?.[obj.buildType] || null;
  return Object.values(buildDefs || {}).find(def => def.type === obj.type) || null;
}

function objectDisplayName(obj) {
  if (!obj) return 'Objeto';
  if (obj.type === 'blueprint') return buildDefs?.[obj.buildType]?.label || 'obra pendente';
  return objectDefs?.[obj.type]?.name || buildDefForObject(obj)?.label || obj.type;
}

function refundFromCost(cost = {}, ratio = 0.5) {
  const refund = {};
  for (const [key, value] of Object.entries(cost || {})) {
    const amount = Math.max(0, Math.floor(Number(value || 0) * ratio));
    if (amount > 0) refund[key] = amount;
  }
  return refund;
}

function refundText(refund = {}) {
  const entries = Object.entries(refund);
  if (!entries.length) return 'sem material recuperado';
  return entries.map(([key, value]) => `+${value} ${typeof resourceLabel === 'function' ? resourceLabel(key) : key}`).join(', ');
}

function cancelObjectOrder(obj) {
  if (!obj) return false;
  if (obj.type === 'blueprint') {
    const def = buildDefForObject(obj);
    if (def?.cost && typeof addResources === 'function') addResources(def.cost);
    state.objects = (state.objects || []).filter(o => o.id !== obj.id);
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    log(`Construção cancelada: ${objectDisplayName(obj)}. Materiais devolvidos.`);
    return true;
  }
  if (obj.markedForDeconstruct) {
    obj.markedForDeconstruct = false;
    log(`Desconstrução cancelada: ${objectDisplayName(obj)}.`);
    return true;
  }
  if (obj.markedForGather) {
    obj.markedForGather = false;
    log(`Coleta cancelada: ${objectDisplayName(obj)}.`);
    return true;
  }
  log('Nada pendente para cancelar nesse objeto.');
  return false;
}

function markObjectForDeconstruct(obj, assignNow = true) {
  if (!obj || obj.type === 'blueprint') return false;
  if (!buildDefForObject(obj) && !objectDefs?.[obj.type]) {
    log('Esse objeto não pode ser desconstruído ainda.');
    return false;
  }
  obj.markedForDeconstruct = true;
  log(`${objectDisplayName(obj)} marcado para desconstrução.`);
  if (assignNow) assignNearestDeconstruct();
  return true;
}

function nearestDeconstructTarget(c) {
  if (!c || !state?.objects) return null;
  return state.objects
    .filter(o => o.markedForDeconstruct && isTileDiscovered(o.x, o.y))
    .map(o => ({ obj: o, d: dist(c.x, c.y, o.x, o.y) }))
    .sort((a, b) => a.d - b.d)[0]?.obj || null;
}

function assignDeconstruct(c, obj) {
  if (!c || !obj || !obj.markedForDeconstruct) return false;
  const adj = nearestFreeAdjacent(obj.x, obj.y, c.x, c.y) || { x: obj.x, y: obj.y };
  c.task = { type: 'deconstruct', objId: obj.id, x: adj.x, y: adj.y };
  c.path = findPath(c.x, c.y, adj.x, adj.y, obj);
  c.work = 0;
  c.note = `Desconstruindo ${objectDisplayName(obj)}`;
  return true;
}

function assignNearestDeconstruct(c = null) {
  const colonist = c || (typeof selectedColonist === 'function' ? selectedColonist() : null);
  if (!colonist) return false;
  const target = nearestDeconstructTarget(colonist);
  return target ? assignDeconstruct(colonist, target) : false;
}

function handleDeconstructTask(c, task, tick) {
  if (task?.type !== 'deconstruct') return false;
  const obj = state?.objects?.find(o => o.id === task.objId);
  if (!obj || !obj.markedForDeconstruct) {
    c.task = null;
    c.note = 'Ocioso';
    c.work = 0;
    return true;
  }
  const def = buildDefForObject(obj);
  const work = Math.max(2, Number(def?.work || objectDefs?.[obj.type]?.work || 4) * 0.65);
  c.work += tick * (typeof workRate === 'function' ? workRate(c, 'build') : 1);
  c.note = `Desconstruindo ${objectDisplayName(obj)} ${Math.floor((c.work / work) * 100)}%`;
  if (c.work < work) return true;

  const refund = refundFromCost(def?.cost || {}, 0.5);
  if (Object.keys(refund).length && typeof addResources === 'function') addResources(refund);
  state.objects = state.objects.filter(o => o.id !== obj.id);
  if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
  log(`${c.name} desmontou ${objectDisplayName(obj)}. ${refundText(refund)}.`);
  c.task = null;
  c.note = 'Ocioso';
  c.work = 0;
  return true;
}

function handleOrderToolAtTile(tool, tile, event = null) {
  if (!tool || !tile || appScreen !== SCREEN.PLAYING || !state) return false;
  const obj = isTileDiscovered(tile.x, tile.y) && typeof getObjectAt === 'function' ? getObjectAt(tile.x, tile.y) : null;

  if (tool === 'mine') {
    const rock = isTileDiscovered(tile.x, tile.y) && typeof getRockAt === 'function' ? getRockAt(tile.x, tile.y) : null;
    if (!rock?.solid) {
      log('Minerar: clique em uma rocha ou montanha mineável.');
      return true;
    }
    const label = typeof geologyLabelAt === 'function' ? geologyLabelAt(tile.x, tile.y) : 'Rocha';
    if (typeof markRockForMining === 'function' && markRockForMining(tile.x, tile.y, true)) log(`${label} marcada para mineração.`);
    return true;
  }

  if (tool === 'cancel') {
    let changed = false;
    if (obj) changed = cancelObjectOrder(obj);
    const rock = typeof getRockAt === 'function' ? getRockAt(tile.x, tile.y) : null;
    if (rock?.markedForMining && typeof markRockForMining === 'function') {
      markRockForMining(tile.x, tile.y, false);
      log('Ordem de mineração cancelada nesse tile.');
      changed = true;
    }
    if (!changed) log('Nenhuma ordem pendente encontrada nesse tile.');
    return true;
  }

  if (tool === 'deconstruct') {
    if (!obj) {
      log('Desconstruir: clique em uma estrutura ou mobília construída.');
      return true;
    }
    if (obj.type === 'blueprint') {
      log('Blueprint encontrado. Use Cancelar para remover construção pendente.');
      return true;
    }
    markObjectForDeconstruct(obj, true);
    return true;
  }

  return false;
}

function drawOrderMarksOverlay() {
  if (!state?.objects?.length || appScreen !== SCREEN.PLAYING) return;
  ctx.save();
  ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
  ctx.scale(viewTransform.scale, viewTransform.scale);
  for (const obj of state.objects) {
    if (!obj.markedForDeconstruct || !isTileDiscovered(obj.x, obj.y)) continue;
    const cx = obj.x * TILE + TILE / 2;
    const cy = obj.y * TILE + TILE / 2;
    ctx.strokeStyle = '#ef4444';
    ctx.fillStyle = 'rgba(239,68,68,.14)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.ellipse(cx, cy + 17, 22, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fecaca';
    ctx.font = '900 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('desmontar', cx, cy - 28);
  }
  ctx.restore();
}

window.setOrderTool = setOrderTool;
window.clearOrderTool = clearOrderTool;
window.getOrderTool = getOrderTool;
window.isOrderToolActive = isOrderToolActive;
window.orderToolLabel = orderToolLabel;
window.countMarkedMines = countMarkedMines;
window.countMarkedDeconstruct = countMarkedDeconstruct;
window.nearestMineableRock = nearestMineableRock;
window.assignNearestMine = assignNearestMine;
window.markVisibleMineableRocks = markVisibleMineableRocks;
window.handleOrderToolAtTile = handleOrderToolAtTile;
window.markObjectForDeconstruct = markObjectForDeconstruct;
window.assignNearestDeconstruct = assignNearestDeconstruct;

window.GameSystems?.registerTaskHandler('deconstruct', 'orders.deconstruct', handleDeconstructTask, { order: 24 });
window.GameSystems?.registerAutoTaskProvider('orders.deconstruct', c => {
  if (!c || c.task || (typeof getColonistTaskPriority === 'function' && getColonistTaskPriority(c, 'build') <= 0)) return false;
  return assignNearestDeconstruct(c);
}, { order: 28 });
window.GameSystems?.registerDrawOverlay('orders.marks', drawOrderMarksOverlay, { order: 45 });
