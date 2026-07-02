'use strict';

(() => {
  if (window.HavenfallContext?.floorSystemInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.floorSystemInstalled = true;

  const MAX_PENDING_FLOOR_BLUEPRINTS = 96;
  const FLOOR_DEFS = Object.freeze({
    packed_dirt: Object.freeze({ key: 'packed_dirt', label: 'Chão Batido', buildKey: 'floor_dirt', moveSpeed: 1.00, comfort: 0.05, cleanliness: 0.05, sleepSurface: 'rough', base: '#6d4d31', line: '#3e2a1b', light: '#8a6844' }),
    wood_floor: Object.freeze({ key: 'wood_floor', label: 'Piso de Madeira', buildKey: 'floor_wood', moveSpeed: 1.06, comfort: 0.35, cleanliness: 0.20, sleepSurface: 'floor', base: '#8a5a36', line: '#4f2f1d', light: '#b7834f' }),
    stone_floor: Object.freeze({ key: 'stone_floor', label: 'Piso de Pedra', buildKey: 'floor_stone', moveSpeed: 1.04, comfort: 0.22, cleanliness: 0.36, sleepSurface: 'floor', base: '#667079', line: '#343c44', light: '#8a949e' })
  });

  const BLEND_PROFILES = Object.freeze({
    packed_dirt: Object.freeze({ inset: 5, fade: 11, edgeAlpha: 0.42, coreAlpha: 0.82, roughness: 1.00, corner: 9 }),
    wood_floor: Object.freeze({ inset: 3, fade: 7, edgeAlpha: 0.30, coreAlpha: 0.93, roughness: 0.28, corner: 5 }),
    stone_floor: Object.freeze({ inset: 3, fade: 8, edgeAlpha: 0.35, coreAlpha: 0.91, roughness: 0.50, corner: 6 })
  });

  function rowsFor(world = state?.world) { return Number(world?.rows || world?.terrain?.length || state?.terrain?.length || 0); }
  function colsFor(world = state?.world) { return Number(world?.cols || world?.terrain?.[0]?.length || state?.terrain?.[0]?.length || 0); }
  function emptyFloorLayer(rows, cols) { return Array.from({ length: rows }, () => Array(cols).fill(null)); }

  function ensureFloorLayer(world = state?.world) {
    if (!world) return null;
    const rows = rowsFor(world);
    const cols = colsFor(world);
    if (!rows || !cols) return null;
    if (!Array.isArray(world.floorLayer) || world.floorLayer.length !== rows || world.floorLayer[0]?.length !== cols) {
      const previous = Array.isArray(world.floorLayer) ? world.floorLayer : [];
      const next = emptyFloorLayer(rows, cols);
      for (let y = 0; y < Math.min(rows, previous.length); y++) {
        for (let x = 0; x < Math.min(cols, previous[y]?.length || 0); x++) next[y][x] = floorDef(previous[y][x]) ? previous[y][x] : null;
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

  function floorDef(type) { return FLOOR_DEFS[type] || null; }
  function floorLabel(type) { return floorDef(type)?.label || 'Sem piso'; }
  function blendProfile(type) { return BLEND_PROFILES[type] || BLEND_PROFILES.packed_dirt; }
  function patternDirectionForFloor(floorType, x = 0, y = 0) {
    if (floorType === 'wood_floor') return 'horizontal';
    if (floorType === 'stone_floor') return 'masonry';
    if (floorType === 'packed_dirt') return 'organic';
    return noise(x, y, 300) > 0.5 ? 'horizontal' : 'vertical';
  }
  function getFloorAt(x, y, world = state?.world) { const layer = ensureFloorLayer(world); return layer?.[Math.round(y)]?.[Math.round(x)] || null; }
  function sameFloorAt(x, y, floorType) { return getFloorAt(x, y) === floorType; }

  function getFloorNeighborMask(x, y, floorType) {
    const tx = Math.round(Number(x) || 0);
    const ty = Math.round(Number(y) || 0);
    return {
      n: sameFloorAt(tx, ty - 1, floorType),
      e: sameFloorAt(tx + 1, ty, floorType),
      s: sameFloorAt(tx, ty + 1, floorType),
      w: sameFloorAt(tx - 1, ty, floorType),
      ne: sameFloorAt(tx + 1, ty - 1, floorType),
      nw: sameFloorAt(tx - 1, ty - 1, floorType),
      se: sameFloorAt(tx + 1, ty + 1, floorType),
      sw: sameFloorAt(tx - 1, ty + 1, floorType)
    };
  }

  function isFloorBlueprint(obj, floorType = null) {
    if (!obj || obj.type !== 'blueprint') return false;
    const def = buildDefs?.[obj.buildType];
    if (def?.type !== 'floor') return false;
    return !floorType || def.floorType === floorType;
  }

  function countFloorBlueprints() { return (state?.objects || []).reduce((total, obj) => total + (isFloorBlueprint(obj) ? 1 : 0), 0); }

  function hasFloorBlueprintAt(x, y, floorType = null) {
    const tx = Math.round(Number(x) || 0);
    const ty = Math.round(Number(y) || 0);
    return !!(state?.objects || []).some(obj => Math.round(obj?.x) === tx && Math.round(obj?.y) === ty && isFloorBlueprint(obj, floorType));
  }

  function isWaterTerrain(x, y) { return state?.terrain?.[y]?.[x] === 'water' || state?.world?.terrain?.[y]?.[x] === 'water'; }
  function insideWorld(x, y) { if (typeof isInside === 'function') return isInside(x, y); return x >= 0 && y >= 0 && x < colsFor() && y < rowsFor(); }

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
    if (hasFloorBlueprintAt(tx, ty)) return false;
    if (!options.ignorePendingLimit && countFloorBlueprints() >= MAX_PENDING_FLOOR_BLUEPRINTS) return false;
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

  function noise(x, y, salt = 0) { const n = Math.sin((x + 31.17) * 12.9898 + (y - 14.33) * 78.233 + salt * 41.719) * 43758.5453; return n - Math.floor(n); }
  function rgba(hex, alpha) { const value = String(hex || '').replace('#', ''); if (value.length !== 6) return `rgba(120, 90, 60, ${alpha})`; const r = parseInt(value.slice(0, 2), 16); const g = parseInt(value.slice(2, 4), 16); const b = parseInt(value.slice(4, 6), 16); return `rgba(${r}, ${g}, ${b}, ${alpha})`; }

  function drawDirectionalFade(targetCtx, px, py, def, mask, profile) {
    const f = profile.fade;
    const color = def.base;
    let gradient;
    targetCtx.save();
    targetCtx.globalCompositeOperation = 'source-over';
    if (!mask.n) {
      gradient = targetCtx.createLinearGradient(0, py, 0, py + f);
      gradient.addColorStop(0, rgba(color, 0.02));
      gradient.addColorStop(1, rgba(color, profile.edgeAlpha));
      targetCtx.fillStyle = gradient;
      targetCtx.fillRect(px + (mask.w ? 0 : profile.corner), py, TILE - (mask.w ? 0 : profile.corner) - (mask.e ? 0 : profile.corner), f);
    }
    if (!mask.s) {
      gradient = targetCtx.createLinearGradient(0, py + TILE, 0, py + TILE - f);
      gradient.addColorStop(0, rgba(color, 0.02));
      gradient.addColorStop(1, rgba(color, profile.edgeAlpha));
      targetCtx.fillStyle = gradient;
      targetCtx.fillRect(px + (mask.w ? 0 : profile.corner), py + TILE - f, TILE - (mask.w ? 0 : profile.corner) - (mask.e ? 0 : profile.corner), f);
    }
    if (!mask.w) {
      gradient = targetCtx.createLinearGradient(px, 0, px + f, 0);
      gradient.addColorStop(0, rgba(color, 0.02));
      gradient.addColorStop(1, rgba(color, profile.edgeAlpha));
      targetCtx.fillStyle = gradient;
      targetCtx.fillRect(px, py + (mask.n ? 0 : profile.corner), f, TILE - (mask.n ? 0 : profile.corner) - (mask.s ? 0 : profile.corner));
    }
    if (!mask.e) {
      gradient = targetCtx.createLinearGradient(px + TILE, 0, px + TILE - f, 0);
      gradient.addColorStop(0, rgba(color, 0.02));
      gradient.addColorStop(1, rgba(color, profile.edgeAlpha));
      targetCtx.fillStyle = gradient;
      targetCtx.fillRect(px + TILE - f, py + (mask.n ? 0 : profile.corner), f, TILE - (mask.n ? 0 : profile.corner) - (mask.s ? 0 : profile.corner));
    }
    targetCtx.restore();
  }

  function drawCornerFade(targetCtx, px, py, def, mask, profile) {
    const radius = Math.max(profile.corner + 2, profile.fade * 1.15);
    const alpha = Math.max(0.08, profile.edgeAlpha * 0.72);
    const fillCorner = (cx, cy, left, top) => {
      const gradient = targetCtx.createRadialGradient(cx, cy, 1, cx, cy, radius);
      gradient.addColorStop(0, rgba(def.base, alpha));
      gradient.addColorStop(1, rgba(def.base, 0.01));
      targetCtx.fillStyle = gradient;
      targetCtx.fillRect(left, top, radius, radius);
    };
    targetCtx.save();
    targetCtx.globalCompositeOperation = 'source-over';
    if (!mask.n && !mask.w) fillCorner(px + radius * 0.26, py + radius * 0.26, px, py);
    if (!mask.n && !mask.e) fillCorner(px + TILE - radius * 0.26, py + radius * 0.26, px + TILE - radius, py);
    if (!mask.s && !mask.w) fillCorner(px + radius * 0.26, py + TILE - radius * 0.26, px, py + TILE - radius);
    if (!mask.s && !mask.e) fillCorner(px + TILE - radius * 0.26, py + TILE - radius * 0.26, px + TILE - radius, py + TILE - radius);
    targetCtx.restore();
  }

  function floorCoreRect(px, py, mask, profile) {
    const left = px + (mask.w ? 0 : profile.inset);
    const top = py + (mask.n ? 0 : profile.inset);
    const right = px + TILE - (mask.e ? 0 : profile.inset);
    const bottom = py + TILE - (mask.s ? 0 : profile.inset);
    return { left, top, right, bottom, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
  }

  function drawFloorBaseShape(targetCtx, x, y, floorType, def, mask, profile) {
    const px = x * TILE;
    const py = y * TILE;
    drawDirectionalFade(targetCtx, px, py, def, mask, profile);
    drawCornerFade(targetCtx, px, py, def, mask, profile);
    const core = floorCoreRect(px, py, mask, profile);
    targetCtx.save();
    targetCtx.globalAlpha = profile.coreAlpha;
    targetCtx.fillStyle = def.base;
    targetCtx.fillRect(core.left, core.top, core.width, core.height);
    if (mask.n && mask.e && mask.ne) targetCtx.fillRect(px + TILE - profile.inset, py, profile.inset, profile.inset);
    if (mask.n && mask.w && mask.nw) targetCtx.fillRect(px, py, profile.inset, profile.inset);
    if (mask.s && mask.e && mask.se) targetCtx.fillRect(px + TILE - profile.inset, py + TILE - profile.inset, profile.inset, profile.inset);
    if (mask.s && mask.w && mask.sw) targetCtx.fillRect(px, py + TILE - profile.inset, profile.inset, profile.inset);
    targetCtx.restore();
    return core;
  }

  function clipToFloorShape(targetCtx, x, y, mask, profile) {
    const px = x * TILE;
    const py = y * TILE;
    const core = floorCoreRect(px, py, mask, profile);
    targetCtx.beginPath();
    targetCtx.rect(core.left, core.top, core.width, core.height);
    if (mask.n) targetCtx.rect(core.left, py, core.width, Math.max(profile.inset, profile.fade * 0.55));
    if (mask.s) targetCtx.rect(core.left, py + TILE - Math.max(profile.inset, profile.fade * 0.55), core.width, Math.max(profile.inset, profile.fade * 0.55));
    if (mask.w) targetCtx.rect(px, core.top, Math.max(profile.inset, profile.fade * 0.55), core.height);
    if (mask.e) targetCtx.rect(px + TILE - Math.max(profile.inset, profile.fade * 0.55), core.top, Math.max(profile.inset, profile.fade * 0.55), core.height);
    targetCtx.clip();
  }

  function drawPackedDirtPattern(targetCtx, x, y, def) {
    const px = x * TILE, py = y * TILE;
    targetCtx.globalAlpha = 0.20;
    targetCtx.fillStyle = def.light;
    for (let i = 0; i < 9; i++) targetCtx.fillRect(px + 5 + noise(x, y, i) * (TILE - 12), py + 5 + noise(x, y, i + 20) * (TILE - 12), 2 + noise(x, y, i + 40) * 5, 1.2);
    targetCtx.globalAlpha = 0.18;
    targetCtx.strokeStyle = def.line;
    for (let i = 0; i < 3; i++) {
      targetCtx.beginPath();
      targetCtx.moveTo(px + 6 + noise(x, y, i + 60) * 8, py + 9 + i * 12);
      targetCtx.lineTo(px + TILE - 8 - noise(x, y, i + 70) * 7, py + 10 + i * 12 + (noise(x, y, i + 80) - 0.5) * 4);
      targetCtx.stroke();
    }
  }

  function drawWoodPattern(targetCtx, x, y, def) {
    const px = x * TILE, py = y * TILE;
    const direction = patternDirectionForFloor(def?.key || 'wood_floor', x, y);
    const boardSize = 12;
    targetCtx.strokeStyle = rgba(def.line, 0.70);
    targetCtx.lineWidth = 1;
    if (direction === 'horizontal') {
      const firstLine = Math.floor(py / boardSize) * boardSize;
      for (let worldY = firstLine; worldY <= py + TILE + boardSize; worldY += boardSize) {
        const yy = worldY - py;
        if (yy <= 1 || yy >= TILE - 1) continue;
        const wobble = (noise(x, worldY / boardSize, 3) - 0.5) * 1.1;
        targetCtx.beginPath();
        targetCtx.moveTo(px + 2, py + yy + wobble);
        targetCtx.lineTo(px + TILE - 2, py + yy - wobble * 0.22);
        targetCtx.stroke();
      }
    } else {
      const firstLine = Math.floor(px / boardSize) * boardSize;
      for (let worldX = firstLine; worldX <= px + TILE + boardSize; worldX += boardSize) {
        const xx = worldX - px;
        if (xx <= 1 || xx >= TILE - 1) continue;
        const wobble = (noise(worldX / boardSize, y, 3) - 0.5) * 1.1;
        targetCtx.beginPath();
        targetCtx.moveTo(px + xx + wobble, py + 2);
        targetCtx.lineTo(px + xx - wobble * 0.22, py + TILE - 2);
        targetCtx.stroke();
      }
    }
    targetCtx.globalAlpha = 0.20;
    targetCtx.fillStyle = def.light;
    if (direction === 'horizontal') targetCtx.fillRect(px + 5, py + 5, TILE - 10, 3);
    else targetCtx.fillRect(px + 5, py + 5, 3, TILE - 10);
  }

  function drawStonePattern(targetCtx, x, y, def) {
    const px = x * TILE, py = y * TILE;
    targetCtx.strokeStyle = rgba(def.line, 0.68);
    targetCtx.lineWidth = 1;
    const splitX = 20 + noise(x, y, 9) * 8;
    const splitY = 18 + noise(x, y, 10) * 10;
    targetCtx.beginPath();
    targetCtx.moveTo(px + splitX, py + 3);
    targetCtx.lineTo(px + splitX + noise(x, y, 11) * 6 - 3, py + TILE - 3);
    targetCtx.moveTo(px + 3, py + splitY);
    targetCtx.lineTo(px + TILE - 3, py + splitY + noise(x, y, 12) * 6 - 3);
    targetCtx.stroke();
    targetCtx.globalAlpha = 0.20;
    targetCtx.fillStyle = def.light;
    targetCtx.fillRect(px + 6, py + 6, TILE * 0.36, 3);
  }

  function drawFloorEdgeOutline(targetCtx, x, y, def, mask, profile) {
    const px = x * TILE;
    const py = y * TILE;
    targetCtx.save();
    targetCtx.globalAlpha = 0.18;
    targetCtx.strokeStyle = def.line;
    targetCtx.lineWidth = 1;
    if (!mask.n) { targetCtx.beginPath(); targetCtx.moveTo(px + profile.corner, py + profile.fade); targetCtx.lineTo(px + TILE - profile.corner, py + profile.fade); targetCtx.stroke(); }
    if (!mask.s) { targetCtx.beginPath(); targetCtx.moveTo(px + profile.corner, py + TILE - profile.fade); targetCtx.lineTo(px + TILE - profile.corner, py + TILE - profile.fade); targetCtx.stroke(); }
    if (!mask.w) { targetCtx.beginPath(); targetCtx.moveTo(px + profile.fade, py + profile.corner); targetCtx.lineTo(px + profile.fade, py + TILE - profile.corner); targetCtx.stroke(); }
    if (!mask.e) { targetCtx.beginPath(); targetCtx.moveTo(px + TILE - profile.fade, py + profile.corner); targetCtx.lineTo(px + TILE - profile.fade, py + TILE - profile.corner); targetCtx.stroke(); }
    targetCtx.restore();
  }

  function drawFloorTile(targetCtx, x, y, floorType = getFloorAt(x, y), q = null) {
    const def = floorDef(floorType);
    if (!targetCtx || !def) return false;
    const tx = Math.round(Number(x) || 0);
    const ty = Math.round(Number(y) || 0);
    const mask = getFloorNeighborMask(tx, ty, floorType);
    const profile = blendProfile(floorType);
    targetCtx.save();
    targetCtx.globalAlpha = q?.renderDistance === 'short' ? 0.92 : 0.98;
    drawFloorBaseShape(targetCtx, tx, ty, floorType, def, mask, profile);
    targetCtx.save();
    clipToFloorShape(targetCtx, tx, ty, mask, profile);
    if (floorType === 'wood_floor') drawWoodPattern(targetCtx, tx, ty, def);
    else if (floorType === 'stone_floor') drawStonePattern(targetCtx, tx, ty, def);
    else drawPackedDirtPattern(targetCtx, tx, ty, def);
    targetCtx.restore();
    drawFloorEdgeOutline(targetCtx, tx, ty, def, mask, profile);
    targetCtx.restore();
    return true;
  }

  function drawFloorTileRenderer(x, y, _type = null, options = null) {
    const targetCtx = options?.targetCtx || ctx;
    if (!targetCtx) return false;
    if (!options?.targetCtx && appScreen !== SCREEN.PLAYING) return false;
    return drawFloorTile(targetCtx, x, y, getFloorAt(x, y), options?.quality || null);
  }

  function drawFloorBlueprintObject(obj) {
    if (!isFloorBlueprint(obj)) return false;
    const def = buildDefs?.[obj.buildType];
    if (!ctx || appScreen !== SCREEN.PLAYING) return true;
    const x = Math.round(Number(obj.x) || 0);
    const y = Math.round(Number(obj.y) || 0);
    ctx.save();
    ctx.globalAlpha = 0.42;
    drawFloorTile(ctx, x, y, def.floorType);
    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = 'rgba(155,211,106,.82)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(x * TILE + 5, y * TILE + 5, TILE - 10, TILE - 10);
    const progress = Math.max(0, Math.min(1, Number(obj.progress || 0) / Math.max(0.01, Number(def.work || 1))));
    ctx.fillStyle = 'rgba(7, 17, 31, .72)';
    ctx.fillRect(x * TILE + 9, y * TILE + 9, TILE - 18, 5);
    ctx.fillStyle = '#9bd36a';
    ctx.fillRect(x * TILE + 9, y * TILE + 9, (TILE - 18) * progress, 5);
    ctx.restore();
    return true;
  }

  function movementModifier(c, current) { const floor = getFloorAt(c?.x, c?.y); const def = floorDef(floor); return Number(current || 1) * Number(def?.moveSpeed || 1); }
  function tick() { ensureFloorLayer(); }

  window.FloorSystem = Object.freeze({ FLOOR_DEFS, BLEND_PROFILES, MAX_PENDING_FLOOR_BLUEPRINTS, ensureFloorLayer, getFloorAt, setFloorAt, clearFloorAt, canPlaceFloor, hasFloorBlueprintAt, countFloorBlueprints, floorDef, floorLabel, blendProfile, patternDirectionForFloor, getFloorNeighborMask, drawFloorTile, drawFloorBlueprintObject, bumpFloorVersion });
  window.ensureFloorLayer = ensureFloorLayer;
  window.getFloorAt = getFloorAt;
  window.setFloorAt = setFloorAt;
  window.clearFloorAt = clearFloorAt;
  window.canPlaceFloor = canPlaceFloor;
  window.GameSystems?.registerTick?.('floor-system.ensure-layer', tick, { order: 9, intervalMs: 600, critical: true });
  window.GameSystems?.registerTileRenderer?.('floor.layer', drawFloorTileRenderer, { order: 3, critical: true, renderPass: 'static' });
  window.GameSystems?.registerObjectRenderer?.('floor.blueprint-renderer', drawFloorBlueprintObject, { order: 1, critical: true });
  window.GameSystems?.registerMovementModifier?.('floor.speed', movementModifier, { order: 18 });
})();
