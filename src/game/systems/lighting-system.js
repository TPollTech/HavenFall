'use strict';

(() => {
  if (window.HavenfallContext?.lightingSystemInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.lightingSystemInstalled = true;

  const MIN_CAVE_LIGHT = 0.06;
  const MEMORY_LIGHT = 0.20;
  const DEFAULT_LIGHT = 1;

  function clampLight(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }
  function rowsFor(world = state?.world) { return Number(world?.rows || state?.terrain?.length || 0); }
  function colsFor(world = state?.world) { return Number(world?.cols || state?.terrain?.[0]?.length || 0); }
  function perfNow() { return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now(); }

  function hasUsableExplorationMask(world = state?.world) {
    if (world?.explorationDisabled) return false;
    const rows = rowsFor(world);
    const cols = colsFor(world);
    if (!rows || !cols || !Array.isArray(world?.exploration) || world.exploration.length !== rows) return false;
    return world.exploration.every(row => Array.isArray(row) && row.length === cols);
  }

  function ensureLightState(world = state?.world) {
    if (!world) return null;
    world.lightState = world.lightState && typeof world.lightState === 'object' ? world.lightState : {};
    world.lightState.lastMs = Number(world.lightState.lastMs || 0);
    world.lightState.lastTiles = Number(world.lightState.lastTiles || 0);
    world.lightState.lastSources = Number(world.lightState.lastSources || 0);
    world.lightState.lastReason = world.lightState.lastReason || 'boot';
    world.lightState.lastBoundsKey = world.lightState.lastBoundsKey || '';
    world.lightState.lastAmbientKey = world.lightState.lastAmbientKey || '';
    world.lightState.lastSourceKey = world.lightState.lastSourceKey || '';
    world.lightState.lastRecomputeAt = Number(world.lightState.lastRecomputeAt || 0);
    return world.lightState;
  }

  function lightingIntervalMs() {
    return Math.max(120, Number(window.SimulationBudget?.current?.()?.lightingIntervalMs || 320));
  }

  function boundsKey(bounds = null, world = state?.world) {
    if (!bounds) return `full:${colsFor(world)}x${rowsFor(world)}`;
    return [
      Math.max(0, Math.floor(bounds.startX ?? 0)),
      Math.max(0, Math.floor(bounds.startY ?? 0)),
      Math.max(0, Math.ceil(bounds.endX ?? colsFor(world) - 1)),
      Math.max(0, Math.ceil(bounds.endY ?? rowsFor(world) - 1))
    ].join(':');
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
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (world?.builtRoofLayer?.[iy]?.[ix]) return true;
    const roofCell = world?.roofLayer?.[iy]?.[ix];
    if (roofCell === true) return true;
    if (roofCell && typeof roofCell === 'object' && roofCell.built) return true;
    if (world?.naturalRoofLayer?.[iy]?.[ix]) return true;
    if (world === state?.world && typeof hasNaturalRoofAt === 'function') return !!hasNaturalRoofAt(ix, iy);
    return false;
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

  function skyLight() { return clampLight(daylightAtHour() * weatherLightFactor()); }
  function workstationTaskType(type) {
    if (type === 'forge') return 'forge';
    if (type === 'stove') return 'cook';
    return null;
  }
  function workstationIsActive(obj) {
    const taskType = workstationTaskType(obj?.type);
    if (!taskType) return true;
    return (state?.colonists || []).some(c => c?.task?.objId === obj.id && c?.task?.type === taskType);
  }
  function objectLightDef(obj) {
    const light = obj ? objectDefs?.[obj.type]?.light || null : null;
    if (!light || !obj) return null;
    const fuelMax = Number(objectDefs?.torch?.fuelMax || 0);
    const fuel = Number(obj.fuel ?? fuelMax);
    if ((light.requiresLit || obj.type === 'torch') && (obj.lit === false || fuel <= 0)) return null;
    if (light.requiresActivity && !workstationIsActive(obj)) return null;
    return light;
  }
  function ambientKey() { return `${Math.round(skyLight() * 1000)}|${state?.weather || 'limpo'}|${Math.floor(Number(state?.hour || 0) * 2)}`; }

  function collectLightSources(world = state?.world) {
    const sources = [];
    const sky = skyLight();
    const signature = [];
    for (const obj of world?.objects || []) {
      const light = objectLightDef(obj);
      if (!light) continue;
      const source = { x: obj.x, y: obj.y, radius: Number(light.radius || 4), power: Number(light.power || 0.7), color: light.color || '#ffc16a', flicker: Number(light.flicker || 0) };
      sources.push(source);
      signature.push(`${obj.id || obj.type}:${source.x},${source.y}:${source.radius}:${source.power}:${source.color}`);
    }
    return { sky, sources, signature: signature.join('|') };
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

  function applySource(layer, source, bounds = null, world = state?.world) {
    const radius = Math.max(1, Number(source.radius || 1));
    const minX = Math.max(
      Math.max(0, Math.floor(bounds?.startX ?? 0)),
      Math.floor(source.x - radius)
    );
    const maxX = Math.min(
      Math.min(colsFor(world) - 1, Math.ceil(bounds?.endX ?? colsFor(world) - 1)),
      Math.ceil(source.x + radius)
    );
    const minY = Math.max(
      Math.max(0, Math.floor(bounds?.startY ?? 0)),
      Math.floor(source.y - radius)
    );
    const maxY = Math.min(
      Math.min(rowsFor(world) - 1, Math.ceil(bounds?.endY ?? rowsFor(world) - 1)),
      Math.ceil(source.y + radius)
    );
    if (minX > maxX || minY > maxY) return;
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

  function shouldRecompute(bounds = null, world = state?.world, sourceInfo = null) {
    const meta = ensureLightState(world);
    if (!meta) return true;
    const nextBoundsKey = boundsKey(bounds, world);
    const nextAmbientKey = ambientKey();
    const nextSourceKey = sourceInfo?.signature || '';
    const elapsed = perfNow() - Number(meta.lastRecomputeAt || 0);
    if (world?.lightDirty) return true;
    if (meta.lastBoundsKey !== nextBoundsKey) return true;
    if (meta.lastAmbientKey !== nextAmbientKey) return true;
    if (meta.lastSourceKey !== nextSourceKey) return true;
    return elapsed >= lightingIntervalMs();
  }

  function recomputeLighting(bounds = null, world = state?.world, reason = 'manual') {
    const layer = ensureLightLayer(world);
    if (!layer) return null;
    const lightState = ensureLightState(world);
    const sourceInfo = collectLightSources(world);
    if (!shouldRecompute(bounds, world, sourceInfo)) return layer;

    const startedAt = perfNow();
    const { sky, sources } = sourceInfo;
    const startX = Math.max(0, Math.floor(bounds?.startX ?? 0));
    const endX = Math.min(colsFor(world) - 1, Math.ceil(bounds?.endX ?? colsFor(world) - 1));
    const startY = Math.max(0, Math.floor(bounds?.startY ?? 0));
    const endY = Math.min(rowsFor(world) - 1, Math.ceil(bounds?.endY ?? rowsFor(world) - 1));
    let tiles = 0;

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        layer[y][x] = baseTileLight(x, y, sky, world);
        tiles++;
      }
    }

    for (const source of sources) applySource(layer, source, { startX, startY, endX, endY }, world);
    world.lightVersion = Number(world.lightVersion || 0) + 1;
    if (lightState) {
      lightState.lastMs = perfNow() - startedAt;
      lightState.lastTiles = tiles;
      lightState.lastSources = sources.length;
      lightState.lastReason = reason;
      lightState.lastBoundsKey = boundsKey({ startX, startY, endX, endY }, world);
      lightState.lastAmbientKey = ambientKey();
      lightState.lastSourceKey = sourceInfo.signature;
      lightState.lastRecomputeAt = perfNow();
    }
    return layer;
  }

  function getLightAt(x, y, world = state?.world) {
    const layer = ensureLightLayer(world);
    const lightState = ensureLightState(world);
    if (world && (world.lightDirty || !Number(lightState?.lastRecomputeAt || 0))) {
      recomputeLighting(null, world, world.lightInvalidationReason || 'light-query');
      world.lightDirty = false;
    }
    return clampLight(layer?.[Math.round(y)]?.[Math.round(x)] ?? DEFAULT_LIGHT);
  }

  function getDarknessAt(x, y, world = state?.world) { return clampLight(1 - getLightAt(x, y, world)); }

  function invalidate(reason = 'manual', world = state?.world) {
    if (!world) return;
    world.lightDirty = true;
    world.lightInvalidationReason = reason;
  }

  function drawLightingOverlay(bounds = null) {
    if (!ctx || !state?.world || appScreen !== SCREEN.PLAYING) return;
    if (state.world.lightDirty) {
      recomputeLighting(bounds, state.world, state.world.lightInvalidationReason || 'dirty-overlay');
      state.world.lightDirty = false;
    }
    const layer = state.world.lightLayer;
    if (!layer) return;
    const startX = Math.max(0, Math.floor(bounds?.startX ?? 0));
    const endX = Math.min(getWorldCols() - 1, Math.ceil(bounds?.endX ?? getWorldCols() - 1));
    const startY = Math.max(0, Math.floor(bounds?.startY ?? 0));
    const endY = Math.min(getWorldRows() - 1, Math.ceil(bounds?.endY ?? getWorldRows() - 1));
    const explorationMaskActive = hasUsableExplorationMask(state.world);
    ctx.save();
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const explored = explorationMaskActive ? Number(state.world.exploration?.[y]?.[x] || 0) : 2;
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
    const bounds = appScreen === SCREEN.PLAYING && typeof visibleTileBounds === 'function'
      ? visibleTileBounds(window.HavenfallSettings?.renderPadding?.() ?? 2)
      : null;
    const nextAmbientKey = ambientKey();
    const nextSourceKey = collectLightSources(state.world).signature;
    const lightState = ensureLightState(state.world);
    if (lightState && (lightState.lastAmbientKey !== nextAmbientKey || lightState.lastSourceKey !== nextSourceKey)) {
      state.world.lightDirty = true;
      state.world.lightInvalidationReason = lightState.lastAmbientKey !== nextAmbientKey ? 'ambient-change' : 'light-source-change';
    } else if (lightState && lightState.lastSources > 0 && (perfNow() - Number(lightState.lastRecomputeAt || 0)) >= lightingIntervalMs()) {
      state.world.lightDirty = true;
      state.world.lightInvalidationReason = 'flicker-refresh';
    }
    if (state.world.lightDirty) {
      recomputeLighting(bounds, state.world, state.world.lightInvalidationReason || 'dirty-tick');
      state.world.lightDirty = false;
    }
  }

  function stats(world = state?.world) {
    const lightState = ensureLightState(world);
    return {
      lastMs: round1(lightState?.lastMs || 0),
      tiles: Number(lightState?.lastTiles || 0),
      sources: Number(lightState?.lastSources || 0),
      reason: lightState?.lastReason || 'none'
    };
  }

  function round1(value) { return Math.round((Number(value) || 0) * 10) / 10; }

  window.LightingSystem = Object.freeze({ ensureLightLayer, invalidate, getLightAt, getDarknessAt, collectLightSources, recomputeLighting, drawLightingOverlay, hasRoofAt, hasUsableExplorationMask, skyLight, stats });
  window.GameSystems?.registerTick?.('lighting.ensure-layer', tick, { order: 12, intervalMs: 800, critical: false });
  window.GameSystems?.registerWorldOverlay?.('lighting.dynamic-overlay', drawLightingOverlay, { order: 70, critical: false });
})();