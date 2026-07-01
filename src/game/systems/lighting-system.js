'use strict';

(() => {
  if (window.HavenfallContext?.lightingSystemInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.lightingSystemInstalled = true;

  const MIN_CAVE_LIGHT = 0.06;
  const MEMORY_LIGHT = 0.20;
  const DEFAULT_LIGHT = 1;

  function clampLight(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  function rowsFor(world = state?.world) {
    return Number(world?.rows || state?.terrain?.length || 0);
  }

  function colsFor(world = state?.world) {
    return Number(world?.cols || state?.terrain?.[0]?.length || 0);
  }

  function ensureLightLayer(world = state?.world) {
    if (!world) return null;
    const rows = rowsFor(world);
    const cols = colsFor(world);
    if (!rows || !cols) return null;
    if (!Array.isArray(world.lightLayer) || world.lightLayer.length !== rows || world.lightLayer[0]?.length !== cols) {
      world.lightLayer = Array.from({ length: rows }, () => Array(cols).fill(1));
      world.lightVersion = Number(world.lightVersion || 0) + 1;
    }
    return world.lightLayer;
  }

  function hasRoofAt(x, y, world = state?.world) {
    if (typeof hasNaturalRoofAt === 'function') return !!hasNaturalRoofAt(x, y);
    return !!world?.naturalRoofLayer?.[y]?.[x];
  }

  function daylightAtHour(hour = state?.hour || 12) {
    const h = ((Number(hour) % 24) + 24) % 24;
    if (h >= 7 && h <= 17) return 1;
    if (h >= 5 && h < 7) return 0.35 + (h - 5) * 0.325;
    if (h > 17 && h <= 20) return 1 - (h - 17) * 0.24;
    return 0.18;
  }

  function weatherLightFactor() {
    if (state?.weather === 'tempestade') return 0.68;
    if (state?.weather === 'chuva') return 0.82;
    return 1;
  }

  function skyLight() {
    return clampLight(daylightAtHour() * weatherLightFactor());
  }

  function objectLightDef(obj) {
    if (!obj) return null;
    const def = objectDefs?.[obj.type];
    return def?.light || null;
  }

  function collectLightSources(world = state?.world) {
    const sources = [];
    const sky = skyLight();
    for (const obj of world?.objects || []) {
      const light = objectLightDef(obj);
      if (!light) continue;
      sources.push({ x: obj.x, y: obj.y, radius: Number(light.radius || 4), power: Number(light.power || 0.7), color: light.color || '#ffc16a', flicker: Number(light.flicker || 0) });
    }
    return { sky, sources };
  }

  function baseTileLight(x, y, sky, world = state?.world) {
    if (!hasRoofAt(x, y, world)) return sky;
    let leak = MIN_CAVE_LIGHT;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= colsFor(world) || ny >= rowsFor(world)) continue;
        if (!hasRoofAt(nx, ny, world)) {
          const d = Math.hypot(dx, dy);
          leak = Math.max(leak, sky * Math.max(0, 0.66 - d * 0.15));
        }
      }
    }
    return clampLight(leak);
  }

  function applySource(layer, source, world = state?.world) {
    const radius = Math.max(1, Number(source.radius || 1));
    const minX = Math.max(0, Math.floor(source.x - radius));
    const maxX = Math.min(colsFor(world) - 1, Math.ceil(source.x + radius));
    const minY = Math.max(0, Math.floor(source.y - radius));
    const maxY = Math.min(rowsFor(world) - 1, Math.ceil(source.y + radius));
    const flicker = source.flicker ? (Math.sin((performance.now?.() || Date.now()) / 180 + source.x * 1.7 + source.y) * source.flicker) : 0;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.hypot(x - source.x, y - source.y);
        if (d > radius) continue;
        const falloff = Math.pow(1 - d / radius, 1.35);
        const roofPenalty = hasRoofAt(x, y, world) ? 0.92 : 1;
        const value = clampLight((source.power + flicker) * falloff * roofPenalty);
        if (value > layer[y][x]) layer[y][x] = value;
      }
    }
  }

  function recomputeLighting(bounds = null, world = state?.world) {
    const layer = ensureLightLayer(world);
    if (!layer) return null;
    const { sky, sources } = collectLightSources(world);
    const startX = Math.max(0, Math.floor(bounds?.startX ?? 0));
    const endX = Math.min(colsFor(world) - 1, Math.ceil(bounds?.endX ?? colsFor(world) - 1));
    const startY = Math.max(0, Math.floor(bounds?.startY ?? 0));
    const endY = Math.min(rowsFor(world) - 1, Math.ceil(bounds?.endY ?? rowsFor(world) - 1));

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) layer[y][x] = baseTileLight(x, y, sky, world);
    }

    for (const source of sources) applySource(layer, source, world);
    world.lightVersion = Number(world.lightVersion || 0) + 1;
    return layer;
  }

  function getLightAt(x, y, world = state?.world) {
    const layer = ensureLightLayer(world);
    return clampLight(layer?.[Math.round(y)]?.[Math.round(x)] ?? DEFAULT_LIGHT);
  }

  function getDarknessAt(x, y, world = state?.world) {
    return clampLight(1 - getLightAt(x, y, world));
  }

  function invalidate(reason = 'manual', world = state?.world) {
    if (!world) return;
    world.lightDirty = true;
    world.lightInvalidationReason = reason;
  }

  function drawLightingOverlay(bounds = null) {
    if (!ctx || !state?.world || appScreen !== SCREEN.PLAYING) return;
    recomputeLighting(bounds, state.world);
    const layer = state.world.lightLayer;
    if (!layer) return;
    const startX = Math.max(0, Math.floor(bounds?.startX ?? 0));
    const endX = Math.min(getWorldCols() - 1, Math.ceil(bounds?.endX ?? getWorldCols() - 1));
    const startY = Math.max(0, Math.floor(bounds?.startY ?? 0));
    const endY = Math.min(getWorldRows() - 1, Math.ceil(bounds?.endY ?? getWorldRows() - 1));
    ctx.save();
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const explored = state.world.exploration?.[y]?.[x] || 0;
        const light = clampLight(layer[y]?.[x] ?? 1);
        const darkness = explored ? Math.max(0, 1 - Math.max(light, MEMORY_LIGHT)) : 0.92;
        if (darkness <= 0.035) continue;
        ctx.fillStyle = `rgba(1, 5, 14, ${Math.min(0.86, darkness * 0.82)})`;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    ctx.restore();
  }

  function tick() {
    if (!state?.world) return;
    ensureLightLayer(state.world);
    if (state.world.lightDirty) {
      recomputeLighting(null, state.world);
      state.world.lightDirty = false;
    }
  }

  window.LightingSystem = Object.freeze({ ensureLightLayer, invalidate, getLightAt, getDarknessAt, collectLightSources, recomputeLighting, drawLightingOverlay, hasRoofAt, skyLight });
  window.GameSystems?.registerTick?.('lighting.ensure-layer', tick, { order: 12, intervalMs: 800, critical: false });
})();
