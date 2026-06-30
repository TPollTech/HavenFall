'use strict';

const VISIBILITY_MASK_ENABLED = false;
let lastExplorationVisionSignature = '';
let poiDiscoveryInitialized = false;

function makeExplorationMatrix(cols, rows) {
  if (!VISIBILITY_MASK_ENABLED) return [];
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

  if (!VISIBILITY_MASK_ENABLED) {
    state.world.explorationDisabled = true;
    state.world.visibleTiles = [];
    state.world.exploration = [];
    lastExplorationVisionSignature = 'visibility-disabled';
    return;
  }

  if (!Array.isArray(state.world.visibleTiles)) state.world.visibleTiles = [];
  if (!Array.isArray(state.world.exploration) || state.world.exploration.length !== state.world.rows || state.world.exploration[0]?.length !== state.world.cols) {
    state.world.exploration = makeExplorationMatrix(state.world.cols, state.world.rows);
    state.world.visibleTiles = [];
    lastExplorationVisionSignature = '';
  }
}

function visionRangeForColonist(c, force = false) {
  const base = Number(c?.visionRange || c?.vision || 8);
  return clamp(Math.round(force ? Math.max(base, 10) : base), 3, 18);
}

function explorationVisionSignature() {
  if (!VISIBILITY_MASK_ENABLED) return 'visibility-disabled';
  if (!state?.colonists?.length) return '';
  return state.colonists
    .map(c => `${c.id}:${Math.round(c.x)},${Math.round(c.y)}:${visionRangeForColonist(c)}`)
    .join('|');
}

function updateExploration(force = false) {
  if (!state?.colonists) return;
  ensureExplorationState();
  if (!VISIBILITY_MASK_ENABLED) {
    updatePoiDiscovery();
    return;
  }
  clearPreviousVisibleTiles(force);
  const visible = new Set();
  for (const c of state.colonists) {
    const cx = Math.round(c.x);
    const cy = Math.round(c.y);
    const radius = visionRangeForColonist(c, force);
    c.visionRange = c.visionRange || radius;
    revealAround(cx, cy, radius, visible);
  }
  state.world.visibleTiles = Array.from(visible);
  lastExplorationVisionSignature = explorationVisionSignature();
  updatePoiDiscovery();
}

function updateExplorationIfNeeded() {
  if (!state || appScreen !== SCREEN.PLAYING) return;
  if (!VISIBILITY_MASK_ENABLED) {
    if (!poiDiscoveryInitialized) {
      poiDiscoveryInitialized = true;
      ensureExplorationState();
      updatePoiDiscovery();
    }
    return;
  }
  ensureExplorationState();
  const signature = explorationVisionSignature();
  if (!signature) return;
  if (signature !== lastExplorationVisionSignature) updateExploration(false);
}

function clearPreviousVisibleTiles(force = false) {
  if (!VISIBILITY_MASK_ENABLED) return;
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
  if (!VISIBILITY_MASK_ENABLED) return;
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

function isTileDiscovered(x, y) { return true; }
function isTileVisible(x, y) { return true; }

function updatePoiDiscovery() {
  if (!state?.world?.pointsOfInterest) return;
  for (const poi of state.world.pointsOfInterest) {
    if (!poi.discovered) poi.discovered = true;
  }
}

window.makeExplorationMatrix = makeExplorationMatrix;
window.ensureExplorationState = ensureExplorationState;
window.updateExploration = updateExploration;
window.updateExplorationIfNeeded = updateExplorationIfNeeded;
window.revealAround = revealAround;
window.isTileDiscovered = isTileDiscovered;
window.isTileVisible = isTileVisible;
window.GameSystems?.registerTick('exploration', updateExplorationIfNeeded, { order: 35 });