'use strict';

(() => {
  if (window.HavenfallContext?.lightingSystemInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.lightingSystemInstalled = true;

  const MIN_CAVE_LIGHT = 0.06;
  const MEMORY_LIGHT = 0.20;
  const DEFAULT_LIGHT = 1;
  const SUN_TRANSITION_SPEED = 2.2;
  const SUN_SHADOW_MAX_ALPHA = 0.22;
  const SUN_SHADOW_CASTER_TYPES = new Set([
    'tree', 'oak_tree', 'pine_tree', 'bush', 'rock', 'ore', 'wall', 'door',
    'ruin', 'cache', 'supply_crate', 'crate', 'bench', 'forge', 'stove',
    'med_station', 'research_desk', 'bed'
  ]);

  function clampLight(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }
  function clamp01(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }
  function lerp(a, b, t) { return Number(a || 0) + (Number(b || 0) - Number(a || 0)) * clamp01(t); }
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
    if (!Array.isArray(world.localLightLayer) || world.localLightLayer.length !== rows || world.localLightLayer[0]?.length !== cols) {
      world.localLightLayer = Array.from({ length: rows }, () => Array(cols).fill(0));
      world.lightVersion = Number(world.lightVersion || 0) + 1;
    }
    return world.lightLayer;
  }

  function localLightLayerFor(world = state?.world) {
    ensureLightLayer(world);
    return Array.isArray(world?.localLightLayer) ? world.localLightLayer : null;
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

  function weatherLightFactor(weather = state?.weather) {
    if (weather === 'tempestade') return 0.68;
    if (weather === 'chuva') return 0.82;
    return 1;
  }

  function smoothstep(edge0, edge1, value) {
    const t = clamp01((Number(value) - edge0) / Math.max(0.0001, edge1 - edge0));
    return t * t * (3 - 2 * t);
  }

  function sunElevationAtHour(hour = state?.hour || 12) {
    const h = ((Number(hour) % 24) + 24) % 24;
    const dayArc = Math.sin(((h - 6) / 12) * Math.PI);
    return clamp01(dayArc);
  }

  function sunStateAtHour(hour = state?.hour || 12, weather = state?.weather || 'limpo') {
    const h = ((Number(hour) % 24) + 24) % 24;
    const weatherFactor = weatherLightFactor(weather);
    const elevation = sunElevationAtHour(h);
    const morningWarmth = smoothstep(5.0, 6.8, h) * (1 - smoothstep(7.4, 9.2, h));
    const eveningWarmth = smoothstep(15.8, 18.0, h) * (1 - smoothstep(19.0, 20.6, h));
    const warmth = clamp01(Math.max(morningWarmth, eveningWarmth) * clamp01(daylightAtHour(h) + 0.15));
    const light = clampLight(daylightAtHour(h) * weatherFactor);
    const sunAngle = ((h - 6) / 12) * Math.PI;
    const shadowLength = light <= 0.22 ? 0 : lerp(1.0, 6.5, 1 - elevation) * weatherFactor;
    const shadowAlpha = light <= 0.22 ? 0 : clamp01((1 - elevation * 0.55) * light) * SUN_SHADOW_MAX_ALPHA;
    return {
      hour: h,
      light,
      elevation,
      angle: sunAngle,
      warmth,
      shadowLength,
      shadowAlpha,
      tint: {
        r: Math.round(lerp(10, 255, warmth)),
        g: Math.round(lerp(22, 162, warmth)),
        b: Math.round(lerp(42, 82, warmth)),
        alpha: clamp01(warmth * 0.12 + (1 - light) * 0.035)
      }
    };
  }

  function skyLight() { return sunStateAtHour().light; }

  function updateVisualSunState(world = state?.world, force = false) {
    const meta = ensureLightState(world);
    if (!meta) return sunStateAtHour();
    const target = sunStateAtHour();
    const now = perfNow();
    const previous = meta.visualSun;
    if (force || !previous || !Number.isFinite(previous.light)) {
      meta.visualSun = { ...target, targetLight: target.light, lastUpdateAt: now };
      return meta.visualSun;
    }
    const dt = Math.max(0, Math.min(1.5, (now - Number(previous.lastUpdateAt || now)) / 1000));
    const t = force ? 1 : clamp01(1 - Math.exp(-dt * SUN_TRANSITION_SPEED));
    const visual = {
      hour: target.hour,
      light: clampLight(lerp(previous.light, target.light, t)),
      elevation: clamp01(lerp(previous.elevation, target.elevation, t)),
      angle: lerp(previous.angle, target.angle, t),
      warmth: clamp01(lerp(previous.warmth, target.warmth, t)),
      shadowLength: Math.max(0, lerp(previous.shadowLength, target.shadowLength, t)),
      shadowAlpha: clamp01(lerp(previous.shadowAlpha, target.shadowAlpha, t)),
      tint: {
        r: Math.round(lerp(previous.tint?.r ?? target.tint.r, target.tint.r, t)),
        g: Math.round(lerp(previous.tint?.g ?? target.tint.g, target.tint.g, t)),
        b: Math.round(lerp(previous.tint?.b ?? target.tint.b, target.tint.b, t)),
        alpha: clamp01(lerp(previous.tint?.alpha ?? target.tint.alpha, target.tint.alpha, t))
      },
      targetLight: target.light,
      lastUpdateAt: now
    };
    meta.visualSun = visual;
    return visual;
  }

  function visualSkyLight(world = state?.world) {
    return clampLight(updateVisualSunState(world).light);
  }

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
  function ambientKey() { return `${Math.round(skyLight() * 1000)}|${state?.weather || 'limpo'}|${Math.floor(Number(state?.hour || 0) * 4)}`; }

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

  function tileLightAt(x, y, world = state?.world, sky = visualSkyLight(world)) {
    const localLayer = localLightLayerFor(world);
    const local = clampLight(localLayer?.[Math.round(y)]?.[Math.round(x)] || 0);
    return Math.max(baseTileLight(Math.round(x), Math.round(y), sky, world), local);
  }

  function applySource(layer, source, bounds = null, world = state?.world, localLayer = null) {
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
        if (localLayer && value > localLayer[y][x]) localLayer[y][x] = value;
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
    const localLayer = localLightLayerFor(world);
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
        if (localLayer) localLayer[y][x] = 0;
        layer[y][x] = baseTileLight(x, y, sky, world);
        tiles++;
      }
    }

    for (const source of sources) applySource(layer, source, { startX, startY, endX, endY }, world, localLayer);
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
    ensureLightLayer(world);
    const lightState = ensureLightState(world);
    if (world && (world.lightDirty || !Number(lightState?.lastRecomputeAt || 0))) {
      recomputeLighting(null, world, world.lightInvalidationReason || 'light-query');
      world.lightDirty = false;
    }
    return clampLight(tileLightAt(x, y, world));
  }

  function getDarknessAt(x, y, world = state?.world) { return clampLight(1 - getLightAt(x, y, world)); }

  function invalidate(reason = 'manual', world = state?.world) {
    if (!world) return;
    world.lightDirty = true;
    world.lightInvalidationReason = reason;
  }

  function objectCastsSunShadow(obj) {
    if (!obj || obj.type === 'blueprint' || obj.hidden || obj.removed) return false;
    if (SUN_SHADOW_CASTER_TYPES.has(obj.type)) return true;
    const def = objectDefs?.[obj.type];
    return !!(def?.blocks || def?.roofBoundary || def?.door);
  }

  function drawAmbientTint(bounds, sun) {
    const alpha = clamp01(sun?.tint?.alpha || 0);
    if (alpha <= 0.01) return;
    const x = bounds.startX * TILE;
    const y = bounds.startY * TILE;
    const width = (bounds.endX - bounds.startX + 1) * TILE;
    const height = (bounds.endY - bounds.startY + 1) * TILE;
    ctx.save();
    ctx.fillStyle = `rgba(${sun.tint.r}, ${sun.tint.g}, ${sun.tint.b}, ${alpha})`;
    ctx.fillRect(x, y, width, height);
    ctx.restore();
  }

  function drawSunShadows(bounds = null, world = state?.world, sun = updateVisualSunState(world)) {
    if (!ctx || !world || !sun || sun.shadowAlpha <= 0.012 || sun.light <= 0.23) return;
    const objects = world.objects || state?.objects || [];
    if (!objects.length) return;
    const dx = -Math.cos(sun.angle) * TILE * sun.shadowLength;
    const dy = Math.sin(sun.angle) * TILE * sun.shadowLength * 0.55;
    const minX = Math.max(0, Math.floor(bounds?.startX ?? 0) - 2);
    const maxX = Math.min(colsFor(world) - 1, Math.ceil(bounds?.endX ?? colsFor(world) - 1) + 2);
    const minY = Math.max(0, Math.floor(bounds?.startY ?? 0) - 2);
    const maxY = Math.min(rowsFor(world) - 1, Math.ceil(bounds?.endY ?? rowsFor(world) - 1) + 2);
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${sun.shadowAlpha})`;
    for (const obj of objects) {
      if (!objectCastsSunShadow(obj)) continue;
      if (obj.x < minX || obj.x > maxX || obj.y < minY || obj.y > maxY) continue;
      const cx = obj.x * TILE + TILE / 2;
      const cy = obj.y * TILE + TILE * 0.74;
      const heightFactor = objectDefs?.[obj.type]?.blocks ? 1 : 0.62;
      ctx.beginPath();
      ctx.ellipse(
        cx + dx * 0.5,
        cy + dy * 0.5,
        Math.max(8, Math.abs(dx) * 0.35 + TILE * 0.22) * heightFactor,
        Math.max(5, Math.abs(dy) * 0.22 + TILE * 0.10) * heightFactor,
        Math.atan2(dy, dx),
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.restore();
  }

  function cornerLight(x, y, layer, wRows, wCols) {
    const cx = Math.round(x), cy = Math.round(y);
    let sum = 0, count = 0;
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= wCols || ny >= wRows) {
          sum += DEFAULT_LIGHT; count++; continue;
        }
        const val = layer[ny]?.[nx];
        if (val !== undefined) { sum += val; count++; }
      }
    }
    return count > 0 ? sum / count : DEFAULT_LIGHT;
  }

  function drawLightingOverlay(bounds = null) {
    if (!ctx || !state?.world || appScreen !== SCREEN.PLAYING) return;
    const layer = ensureLightLayer(state.world);
    if (!layer) return;
    const startX = Math.max(0, Math.floor(bounds?.startX ?? 0));
    const endX = Math.min(getWorldCols() - 1, Math.ceil(bounds?.endX ?? getWorldCols() - 1));
    const startY = Math.max(0, Math.floor(bounds?.startY ?? 0));
    const endY = Math.min(getWorldRows() - 1, Math.ceil(bounds?.endY ?? getWorldRows() - 1));
    const drawBounds = { startX, startY, endX, endY };
    const lightState = ensureLightState(state.world);
    const sourceInfo = collectLightSources(state.world);
    const sourceChanged = lightState && lightState.lastSourceKey !== sourceInfo.signature;
    const boundsChanged = lightState && lightState.lastBoundsKey !== boundsKey(drawBounds, state.world);
    const sourceRefreshDue = lightState && lightState.lastSources > 0 && (perfNow() - Number(lightState.lastRecomputeAt || 0)) >= lightingIntervalMs();
    if (state.world.lightDirty || sourceChanged || boundsChanged || sourceRefreshDue || !Number(lightState?.lastRecomputeAt || 0)) {
      recomputeLighting(drawBounds, state.world, state.world.lightInvalidationReason || (sourceChanged ? 'light-source-change' : boundsChanged ? 'bounds-change' : sourceRefreshDue ? 'flicker-refresh' : 'dirty-overlay'));
      state.world.lightDirty = false;
    }
    const sun = updateVisualSunState(state.world);
    const explorationMaskActive = hasUsableExplorationMask(state.world);
    drawSunShadows(drawBounds, state.world, sun);
    drawAmbientTint(drawBounds, sun);

    const wRows = rowsFor(state.world), wCols = colsFor(state.world);
    const cRows = endY - startY + 2, cCols = endX - startX + 2;
    const corners = Array.from({ length: cRows }, () => new Float64Array(cCols));
    for (let cy = 0; cy < cRows; cy++) {
      for (let cx = 0; cx < cCols; cx++) {
        corners[cy][cx] = cornerLight(startX + cx - 1, startY + cy - 1, layer, wRows, wCols);
      }
    }

    ctx.save();
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const explored = explorationMaskActive ? Number(state.world.exploration?.[y]?.[x] || 0) : 2;
        const light = tileLightAt(x, y, state.world, sun.light);
        const darkness = explored ? Math.max(0, 1 - Math.max(light, MEMORY_LIGHT)) : 0.92;
        if (darkness <= 0.035) continue;

        const ci = y - startY, cj = x - startX;
        const d00 = 1 - corners[ci][cj];
        const d10 = 1 - corners[ci][cj + 1];
        const d01 = 1 - corners[ci + 1][cj];
        const d11 = 1 - corners[ci + 1][cj + 1];

        const px = x * TILE, py = y * TILE;
        const darkTop = Math.min(0.86, d00 * 0.82);
        const darkBot = Math.min(0.86, d01 * 0.82);
        const darkLeft = Math.min(0.86, d00 * 0.82);
        const darkRight = Math.min(0.86, d10 * 0.82);

        if (darkTop <= 0.035 && darkBot <= 0.035 && darkLeft <= 0.035 && darkRight <= 0.035) continue;

        const gx = ctx.createLinearGradient(px, py, px + TILE, py);
        gx.addColorStop(0, `rgba(1,5,14,${darkLeft})`);
        gx.addColorStop(1, `rgba(1,5,14,${darkRight})`);

        const gy = ctx.createLinearGradient(px, py, px, py + TILE);
        gy.addColorStop(0, `rgba(1,5,14,${darkTop})`);
        gy.addColorStop(1, `rgba(1,5,14,${darkBot})`);

        ctx.fillStyle = gx;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = gy;
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillRect(px, py, TILE, TILE);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  function tick() {
    if (!state?.world) return;
    ensureLightLayer(state.world);
    updateVisualSunState(state.world);
    const bounds = appScreen === SCREEN.PLAYING && typeof visibleTileBounds === 'function'
      ? visibleTileBounds(window.HavenfallSettings?.renderPadding?.() ?? 2)
      : null;
    const nextAmbientKey = ambientKey();
    const nextSourceKey = collectLightSources(state.world).signature;
    const lightState = ensureLightState(state.world);
    if (lightState && lightState.lastSourceKey !== nextSourceKey) {
      state.world.lightDirty = true;
      state.world.lightInvalidationReason = 'light-source-change';
    } else if (lightState && lightState.lastAmbientKey !== nextAmbientKey && !bounds) {
      state.world.lightDirty = true;
      state.world.lightInvalidationReason = 'ambient-change';
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
    const sun = updateVisualSunState(world);
    return {
      lastMs: round1(lightState?.lastMs || 0),
      tiles: Number(lightState?.lastTiles || 0),
      sources: Number(lightState?.lastSources || 0),
      reason: lightState?.lastReason || 'none',
      sun: round1(sun?.light || 0),
      targetSun: round1(sun?.targetLight || skyLight())
    };
  }

  function round1(value) { return Math.round((Number(value) || 0) * 10) / 10; }

  window.LightingSystem = Object.freeze({
    ensureLightLayer,
    invalidate,
    getLightAt,
    getDarknessAt,
    collectLightSources,
    recomputeLighting,
    drawLightingOverlay,
    drawSunShadows,
    hasRoofAt,
    hasUsableExplorationMask,
    sunStateAtHour,
    updateVisualSunState,
    visualSkyLight,
    skyLight,
    stats
  });
  window.GameSystems?.registerTick?.('lighting.ensure-layer', tick, { order: 12, intervalMs: 120, critical: false });
  window.GameSystems?.registerWorldOverlay?.('lighting.dynamic-overlay', drawLightingOverlay, { order: 70, critical: false });
})();
