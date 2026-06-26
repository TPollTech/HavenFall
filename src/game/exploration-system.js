'use strict';

function makeExplorationMatrix(cols, rows) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
}

function ensureExplorationState() {
  if (!state) return;
  state.world = state.world || {};
  state.world.cols = state.world.cols || state.terrain?.[0]?.length || MAP_SIZES.standard.cols;
  state.world.rows = state.world.rows || state.terrain?.length || MAP_SIZES.standard.rows;
  state.world.tileSize = state.world.tileSize || TILE;
  state.world.width = state.world.cols * state.world.tileSize;
  state.world.height = state.world.rows * state.world.tileSize;
  if (!Array.isArray(state.world.visibleTiles)) state.world.visibleTiles = [];
  if (!Array.isArray(state.world.exploration) || state.world.exploration.length !== state.world.rows || state.world.exploration[0]?.length !== state.world.cols) {
    state.world.exploration = makeExplorationMatrix(state.world.cols, state.world.rows);
    state.world.visibleTiles = [];
  }
}

function updateExploration(force = false) {
  if (!state?.colonists) return;
  ensureExplorationState();
  clearPreviousVisibleTiles(force);
  const visible = new Set();
  const baseRadius = force ? 10 : 8;
  for (const c of state.colonists) revealAround(c.x, c.y, baseRadius, visible);
  state.world.visibleTiles = Array.from(visible);
  updatePoiDiscovery();
}

function clearPreviousVisibleTiles(force = false) {
  const previous = Array.isArray(state?.world?.visibleTiles) ? state.world.visibleTiles : [];
  if (force && !previous.length) {
    for (const row of state.world.exploration) {
      for (let x = 0; x < row.length; x++) if (row[x] === 2) row[x] = 1;
    }
    return;
  }
  for (const key of previous) {
    const [x, y] = key.split(',').map(Number);
    if (state.world.exploration?.[y]?.[x] === 2) state.world.exploration[y][x] = 1;
  }
}

function revealAround(cx, cy, radius = 8, visible = null) {
  ensureExplorationState();
  const rows = getWorldRows();
  const cols = getWorldCols();
  const r2 = radius * radius;
  for (let y = Math.max(0, cy - radius); y <= Math.min(rows - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(cols - 1, cx + radius); x++) {
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d2 <= r2) {
        state.world.exploration[y][x] = 2;
        if (visible) visible.add(`${x},${y}`);
      }
    }
  }
}

function isTileDiscovered(x, y) { return !!state?.world?.exploration?.[y]?.[x]; }
function isTileVisible(x, y) { return state?.world?.exploration?.[y]?.[x] === 2; }

function updatePoiDiscovery() {
  if (!state?.world?.pointsOfInterest) return;
  for (const poi of state.world.pointsOfInterest) {
    if (!poi.discovered && isTileDiscovered(poi.x, poi.y)) {
      poi.discovered = true;
      log(`Ponto descoberto: ${poi.name}.`);
    }
  }
}
