'use strict';

let currentOrderTool = null;

function setOrderTool(tool = null) {
  currentOrderTool = tool || null;
  document.body.classList.toggle('order-mine-active', currentOrderTool === 'mine');
  if (currentOrderTool === 'mine') {
    if (typeof clearZoneTool === 'function') clearZoneTool('orders');
    log('Ordem de mineração ativa: clique nas rochas para marcar ou minerar.');
  }
  return currentOrderTool;
}

function clearOrderTool(reason = 'manual') {
  currentOrderTool = null;
  document.body.classList.remove('order-mine-active');
  if (reason === 'manual') log('Ferramenta de ordem desativada.');
}

function isOrderToolActive(tool) {
  return currentOrderTool === tool;
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
  for (const p of picked) markRockForMining?.(p.x, p.y, true);
  if (picked.length) {
    log(`${picked.length} rocha${picked.length > 1 ? 's' : ''} próxima${picked.length > 1 ? 's' : ''} marcada${picked.length > 1 ? 's' : ''} para mineração.`);
    if (typeof assignMarkedGatherTasks === 'function') assignMarkedGatherTasks();
  }
  return picked.length;
}

window.setOrderTool = setOrderTool;
window.clearOrderTool = clearOrderTool;
window.isOrderToolActive = isOrderToolActive;
window.countMarkedMines = countMarkedMines;
window.nearestMineableRock = nearestMineableRock;
window.assignNearestMine = assignNearestMine;
window.markVisibleMineableRocks = markVisibleMineableRocks;
