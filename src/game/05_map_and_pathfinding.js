'use strict';

function log(message) {
  const hour = formatHour(state.hour);
  state.log.unshift(`[Dia ${state.day} ${hour}] ${message}`);
  state.log = state.log.slice(0, 60);
}

function formatHour(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour - Math.floor(hour)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function hasCost(cost) {
  return Object.entries(cost).every(([k, v]) => state.resources[k] >= v);
}

function payCost(cost) {
  for (const [k, v] of Object.entries(cost)) state.resources[k] -= v;
}

function addResources(gain) {
  for (const [k, v] of Object.entries(gain)) state.resources[k] = (state.resources[k] || 0) + v;
}

function getObjectAt(x, y) {
  return state.objects.find(o => o.x === x && o.y === y);
}

function getWolfAt(x, y) {
  return state.wolves.find(w => Math.round(w.x) === x && Math.round(w.y) === y);
}

function isInside(x, y) {
  return x >= 0 && y >= 0 && x < getWorldCols() && y < getWorldRows();
}

function isBlocked(x, y, target = null) {
  if (!isInside(x, y)) return true;
  if (target && target.x === x && target.y === y) return false;
  const obj = getObjectAt(x, y);
  if (obj && obj.type !== 'blueprint' && objectDefs[obj.type]?.blocks) return true;
  if (state.colonists.some(c => Math.round(c.x) === x && Math.round(c.y) === y && Math.abs(c.px - (x * TILE + TILE / 2)) < 5 && Math.abs(c.py - (y * TILE + TILE / 2)) < 5)) return false;
  return false;
}

function findPath(startX, startY, endX, endY, target = null) {
  startX = Math.round(startX); startY = Math.round(startY);
  endX = Math.round(endX); endY = Math.round(endY);
  if (!isInside(endX, endY)) return [];
  const key = (x, y) => `${x},${y}`;
  const queue = [[startX, startY]];
  const came = new Map([[key(startX, startY), null]]);
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

  while (queue.length) {
    const [x, y] = queue.shift();
    if (x === endX && y === endY) break;
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      const k = key(nx, ny);
      if (!came.has(k) && !isBlocked(nx, ny, target)) {
        came.set(k, [x, y]);
        queue.push([nx, ny]);
      }
    }
  }

  const endKey = key(endX, endY);
  if (!came.has(endKey)) return [];
  const path = [];
  let cur = [endX, endY];
  while (cur) {
    path.push({ x: cur[0], y: cur[1] });
    cur = came.get(key(cur[0], cur[1]));
  }
  path.reverse();
  path.shift();
  return path;
}

function nearestFreeAdjacent(x, y, fromX, fromY) {
  const candidates = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
    .filter(([cx, cy]) => !isBlocked(cx, cy))
    .sort((a, b) => dist(a[0], a[1], fromX, fromY) - dist(b[0], b[1], fromX, fromY));
  return candidates[0] ? { x: candidates[0][0], y: candidates[0][1] } : null;
}

function dist(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function selectedColonist() {
  return state.colonists.find(c => c.id === selectedColonistId) || state.colonists[0];
}
