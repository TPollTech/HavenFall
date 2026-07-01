'use strict';

(() => {
  if (window.HavenfallContext?.floorSystemInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.floorSystemInstalled = true;

  const FLOOR_DEFS = Object.freeze({
    packed_dirt: Object.freeze({
      key: 'packed_dirt',
      label: 'Chão Batido',
      buildKey: 'floor_dirt',
      moveSpeed: 1.00,
      comfort: 0.05,
      cleanliness: 0.05,
      sleepSurface: 'rough',
      base: '#6d4d31',
      line: '#3e2a1b',
      light: '#8a6844'
    }),
    wood_floor: Object.freeze({
      key: 'wood_floor',
      label: 'Piso de Madeira',
      buildKey: 'floor_wood',
      moveSpeed: 1.06,
      comfort: 0.35,
      cleanliness: 0.20,
      sleepSurface: 'floor',
      base: '#8a5a36',
      line: '#4f2f1d',
      light: '#b7834f'
    }),
    stone_floor: Object.freeze({
      key: 'stone_floor',
      label: 'Piso de Pedra',
      buildKey: 'floor_stone',
      moveSpeed: 1.04,
      comfort: 0.22,
      cleanliness: 0.36,
      sleepSurface: 'floor',
      base: '#667079',
      line: '#343c44',
      light: '#8a949e'
    })
  });

  function clampValue(value, min, max) {
    if (typeof clamp === 'function') return clamp(value, min, max);
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function rowsFor(world = state?.world) {
    return Number(world?.rows || world?.terrain?.length || state?.terrain?.length || 0);
  }

  function colsFor(world = state?.world) {
    return Number(world?.cols || world?.terrain?.[0]?.length || state?.terrain?.[0]?.length || 0);
  }

  function emptyFloorLayer(rows, cols) {
    return Array.from({ length: rows }, () => Array(cols).fill(null));
  }

  function ensureFloorLayer(world = state?.world) {
    if (!world) return null;
    const rows = rowsFor(world);
    const cols = colsFor(world);
    if (!rows || !cols) return null;
    if (!Array.isArray(world.floorLayer) || world.floorLayer.length !== rows || world.floorLayer[0]?.length !== cols) {
      const previous = Array.isArray(world.floorLayer) ? world.floorLayer : [];
      const next = emptyFloorLayer(rows, cols);
      for (let y = 0; y < Math.min(rows, previous.length); y++) {
        for (let x = 0; x < Math.min(cols, previous[y]?.length || 0); x++) {
          next[y][x] = floorDef(previous[y][x]) ? previous[y][x] : null;
        }
      }
      world.floorLayer = next;
      world.floorVersion = Number(world.floorVersion || 0) + 1;
    }
    return world.floorLayer;
  }

  function bumpFloorVersion(world = state?.world) {
    if (!world) return;
    world.floorVersion = Number(world.floorVersion || 0) + 1;
    window.HavenfallRenderOptimization?.invalidateTerrainChunks?.();
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
  }

  function floorDef(type) {
    return FLOOR_DEFS[type] || null;
  }

  function floorLabel(type) {
    return floorDef(type)?.label || 'Sem piso';
  }

  function getFloorAt(x, y, world = state?.world) {
    const layer = ensureFloorLayer(world);
    return layer?.[Math.round(y)]?.[Math.round(x)] || null;
  }

  function hasFloorBlueprintAt(x, y, floorType = null) {
    const tx = Math.round(Number(x) || 0);
    const ty = Math.round(Number(y) || 0);
    return !!(state?.objects || []).some(obj => {
      if (!obj || obj.type !== 'blueprint' || Math.round(obj.x) !== tx || Math.round(obj.y) !== ty) return false;
      const def = buildDefs?.[obj.buildType];
      if (def?.type !== 'floor') return false;
      return !floorType || def.floorType === floorType;
    });
  }

  function isWaterTerrain(x, y) {
    return state?.terrain?.[y]?.[x] === 'water' || state?.world?.terrain?.[y]?.[x] === 'water';
  }

  function insideWorld(x, y) {
    if (typeof isInside === 'function') return isInside(x, y);
    return x >= 0 && y >= 0 && x < colsFor() && y < rowsFor();
  }

  function canPlaceFloor(x, y, floorType, options = {}) {
    const tx = Math.round(Number(x) || 0);
    const ty = Math.round(Number(y) || 0);
    if (!state || !floorDef(floorType)) return false;
    if (!insideWorld(tx, ty)) return false;
    if (tx < 0 || ty < 0 || tx >= colsFor() || ty >= rowsFor()) return false;
    if (typeof isTileDiscovered === 'function' && !isTileDiscovered(tx, ty)) return false;
    if (typeof isMountainBlocked === 'function' && isMountainBlocked(tx, ty)) return false;
    if (isWaterTerrain(tx, ty)) return false;
    if (!options.allowSame && getFloorAt(tx, ty) === floorType) return false;
    if (hasFloorBlueprintAt(tx, ty, floorType)) return false;
    return true;
  }

  function setFloorAt(x, y, floorType, world = state?.world) {
    const tx = Math.round(Number(x) || 0);
    const ty = Math.round(Number(y) || 0);
    if (!floorDef(floorType)) return false;
    const layer = ensureFloorLayer(world);
    if (!layer?.[ty] || tx < 0 || tx >= layer[ty].length) return false;
    if (layer[ty][tx] === floorType) return true;
    layer[ty][tx] = floorType;
    bumpFloorVersion(world);
    return true;
  }

  function clearFloorAt(x, y, world = state?.world) {
    const tx = Math.round(Number(x) || 0);
    const ty = Math.round(Number(y) || 0);
    const layer = ensureFloorLayer(world);
    if (!layer?.[ty] || tx < 0 || tx >= layer[ty].length) return false;
    if (!layer[ty][tx]) return true;
    layer[ty][tx] = null;
    bumpFloorVersion(world);
    return true;
  }

  function noise(x, y, salt = 0) {
    const n = Math.sin((x + 31.17) * 12.9898 + (y - 14.33) * 78.233 + salt * 41.719) * 43758.5453;
    return n - Math.floor(n);
  }

  function rgba(hex, alpha) {
    const value = String(hex || '').replace('#', '');
    if (value.length !== 6) return `rgba(120, 90, 60, ${alpha})`;
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function drawPackedDirt(targetCtx, x, y, def) {
    const px = x * TILE;
    const py = y * TILE;
    targetCtx.fillStyle = def.base;
    targetCtx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
    targetCtx.globalAlpha = 0.18;
    targetCtx.fillStyle = def.light;
    for (let i = 0; i < 6; i++) {
      const nx = px + 5 + noise(x, y, i) * (TILE - 12);
      const ny = py + 5 + noise(x, y, i + 20) * (TILE - 12);
      targetCtx.fillRect(nx, ny, 2 + noise(x, y, i + 40) * 5, 1.2);
    }
    targetCtx.globalAlpha = 0.20;
    targetCtx.strokeStyle = def.line;
    targetCtx.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
  }

  function drawWoodFloor(targetCtx, x, y, def) {
    const px = x * TILE;
    const py = y * TILE;
    targetCtx.fillStyle = def.base;
    targetCtx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
    const horizontal = noise(x, y, 3) > 0.5;
    targetCtx.strokeStyle = rgba(def.line, 0.72);
    targetCtx.lineWidth = 1;
    if (horizontal) {
      for (let yy = 9; yy < TILE; yy += 11) {
        targetCtx.beginPath();
        targetCtx.moveTo(px + 3, py + yy);
        targetCtx.lineTo(px + TILE - 3, py + yy + (noise(x, y, yy) - 0.5) * 1.6);
        targetCtx.stroke();
      }
    } else {
      for (let xx = 9; xx < TILE; xx += 11) {
        targetCtx.beginPath();
        targetCtx.moveTo(px + xx, py + 3);
        targetCtx.lineTo(px + xx + (noise(x, y, xx) - 0.5) * 1.6, py + TILE - 3);
        targetCtx.stroke();
      }
    }
    targetCtx.globalAlpha = 0.22;
    targetCtx.fillStyle = def.light;
    targetCtx.fillRect(px + 4, py + 5, TILE - 8, 3);
    targetCtx.globalAlpha = 0.24;
    targetCtx.strokeStyle = def.line;
    targetCtx.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
  }

  function drawStoneFloor(targetCtx, x, y, def) {
    const px = x * TILE;
    const py = y * TILE;
    targetCtx.fillStyle = def.base;
    targetCtx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
    targetCtx.strokeStyle = rgba(def.line, 0.72);
    targetCtx.lineWidth = 1;
    const splitX = 20 + noise(x, y, 9) * 8;
    const splitY = 18 + noise(x, y, 10) * 10;
    targetCtx.beginPath();
    targetCtx.moveTo(px + splitX, py + 4);
    targetCtx.lineTo(px + splitX + noise(x, y, 11) * 6 - 3, py + TILE - 4);
    targetCtx.moveTo(px + 4, py + splitY);
    targetCtx.lineTo(px + TILE - 4, py + splitY + noise(x, y, 12) * 6 - 3);
    targetCtx.stroke();
    targetCtx.globalAlpha = 0.24;
    targetCtx.fillStyle = def.light;
    targetCtx.fillRect(px + 6, py + 6, TILE * 0.36, 3);
    targetCtx.globalAlpha = 0.32;
    targetCtx.strokeStyle = def.line;
    targetCtx.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
  }

  function drawFloorTile(targetCtx, x, y, floorType = getFloorAt(x, y), q = null) {
    const def = floorDef(floorType);
    if (!targetCtx || !def) return false;
    targetCtx.save();
    targetCtx.globalAlpha = q?.renderDistance === 'short' ? 0.94 : 0.98;
    if (floorType === 'wood_floor') drawWoodFloor(targetCtx, x, y, def);
    else if (floorType === 'stone_floor') drawStoneFloor(targetCtx, x, y, def);
    else drawPackedDirt(targetCtx, x, y, def);
    targetCtx.restore();
    return true;
  }

  function drawFloorTileRenderer(x, y) {
    if (!ctx || appScreen !== SCREEN.PLAYING) return false;
    return drawFloorTile(ctx, x, y, getFloorAt(x, y));
  }

  function movementModifier(c, current) {
    const floor = getFloorAt(c?.x, c?.y);
    const def = floorDef(floor);
    return Number(current || 1) * Number(def?.moveSpeed || 1);
  }

  function tick() {
    ensureFloorLayer();
  }

  window.FloorSystem = Object.freeze({
    FLOOR_DEFS,
    ensureFloorLayer,
    getFloorAt,
    setFloorAt,
    clearFloorAt,
    canPlaceFloor,
    hasFloorBlueprintAt,
    floorDef,
    floorLabel,
    drawFloorTile,
    bumpFloorVersion
  });

  window.ensureFloorLayer = ensureFloorLayer;
  window.getFloorAt = getFloorAt;
  window.setFloorAt = setFloorAt;
  window.clearFloorAt = clearFloorAt;
  window.canPlaceFloor = canPlaceFloor;

  window.GameSystems?.registerTick?.('floor-system.ensure-layer', tick, { order: 9, intervalMs: 600, critical: true });
  window.GameSystems?.registerTileRenderer?.('floor.layer', drawFloorTileRenderer, { order: 3, critical: true });
  window.GameSystems?.registerMovementModifier?.('floor.speed', movementModifier, { order: 18 });
})();
