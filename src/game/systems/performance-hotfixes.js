'use strict';

(() => {
  if (window.HavenfallContext?.performanceHotfixesInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.performanceHotfixesInstalled = true;

  const PERF = {
    zoneUiInterval: 0.35,
    zoneBehaviorInterval: 0.25,
    autoTaskMinMs: 240,
    autoTaskJitterMs: 210,
    looseTargetCacheMs: 220
  };

  function nowMs() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  function inVisibleTileBounds(tile, padding = 1) {
    if (!tile || typeof visibleTileBounds !== 'function') return true;
    const bounds = visibleTileBounds(padding);
    return tile.x >= bounds.startX && tile.x <= bounds.endX && tile.y >= bounds.startY && tile.y <= bounds.endY;
  }

  function zoneStyle(type) {
    const base = typeof zoneDefs !== 'undefined' ? zoneDefs?.[type] : null;
    if (base) return base;
    return ({
      growing: { fill: 'rgba(74, 222, 128, .16)', stroke: 'rgba(74, 222, 128, .82)' },
      allowed: { fill: 'rgba(56, 189, 248, .12)', stroke: 'rgba(56, 189, 248, .72)' },
      storage: { fill: 'rgba(99, 164, 255, .18)', stroke: 'rgba(99, 164, 255, .72)' },
      dumping: { fill: 'rgba(155, 128, 98, .20)', stroke: 'rgba(210, 160, 95, .76)' },
      home: { fill: 'rgba(112, 212, 146, .18)', stroke: 'rgba(112, 212, 146, .78)' },
      safe: { fill: 'rgba(184, 138, 255, .18)', stroke: 'rgba(184, 138, 255, .78)' },
      priority: { fill: 'rgba(245, 209, 92, .18)', stroke: 'rgba(245, 209, 92, .82)' }
    })[type] || { fill: 'rgba(99, 164, 255, .14)', stroke: 'rgba(99, 164, 255, .58)' };
  }

  function decodeZoneKey(key) {
    if (window.zoneSystem?.decode) return window.zoneSystem.decode(key);
    const raw = Number(key);
    return { x: raw >> 16, y: raw & 0xFFFF };
  }

  function drawZonesOverlayOptimized() {
    if (!state?.zones?.grid || !window.zoneSystem || !ctx || !viewTransform) return;
    const grid = state.zones.grid || {};
    const keys = Object.keys(grid);
    if (!keys.length) return;
    const bounds = typeof visibleTileBounds === 'function' ? visibleTileBounds(1) : null;

    ctx.save();
    ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
    ctx.scale(viewTransform.scale, viewTransform.scale);

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const type = grid[key];
      const tile = decodeZoneKey(key);
      if (bounds && (tile.x < bounds.startX || tile.x > bounds.endX || tile.y < bounds.startY || tile.y > bounds.endY)) continue;
      if (typeof isTileDiscovered === 'function' && !isTileDiscovered(tile.x, tile.y)) continue;

      const def = zoneStyle(type);
      ctx.fillStyle = def.fill;
      ctx.strokeStyle = def.stroke;
      ctx.lineWidth = type === 'allowed' ? 1 : 2;
      ctx.setLineDash(type === 'home' ? [] : [5, 5]);
      ctx.fillRect(tile.x * TILE, tile.y * TILE, TILE, TILE);
      ctx.strokeRect(tile.x * TILE + 2, tile.y * TILE + 2, TILE - 4, TILE - 4);

      if (type === 'growing') {
        ctx.fillStyle = 'rgba(187,247,208,.78)';
        ctx.font = '900 10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('🌱', tile.x * TILE + TILE / 2, tile.y * TILE + TILE / 2 + 4);
      }
    }

    ctx.restore();
  }

  function installZoneTickHotfix() {
    if (!window.GameSystems?.registerTick) return;
    let uiTimer = PERF.zoneUiInterval;
    let behaviorTimer = PERF.zoneBehaviorInterval;

    window.GameSystems.registerTick('zones', function updateZonesTickOptimized(dt = 0) {
      if (!state) return;
      const step = Math.max(0.016, Number(dt) || 0.016);

      uiTimer += step;
      behaviorTimer += step;

      if (uiTimer >= PERF.zoneUiInterval) {
        uiTimer = 0;
        if (typeof installZonePanel === 'function') installZonePanel();
        if (typeof updateZonePanel === 'function') updateZonePanel();
        if (typeof updateZonesModal === 'function') updateZonesModal();
      }

      if (appScreen === SCREEN.PLAYING && behaviorTimer >= PERF.zoneBehaviorInterval) {
        behaviorTimer = 0;
        if (typeof updateZoneBehaviors === 'function') updateZoneBehaviors();
      }
    }, { order: 90 });
  }

  function installZoneOverlayHotfix() {
    if (!window.GameSystems?.registerDrawOverlay) return;
    try { drawZonesOverlay = drawZonesOverlayOptimized; } catch (_) {}
    window.GameSystems.registerDrawOverlay('zones', drawZonesOverlayOptimized, { order: 20 });
  }

  function installAutoTaskCooldown() {
    if (typeof assignAutoTask !== 'function' || window.HavenfallContext?.autoTaskCooldownInstalled) return;
    const nativeAssignAutoTask = assignAutoTask;
    window.HavenfallContext.autoTaskCooldownInstalled = true;

    assignAutoTask = function assignAutoTaskWithCooldown(c) {
      if (!c) return false;
      const now = nowMs();
      if (Number(c._nextAutoTaskAt || 0) > now) return false;
      c._nextAutoTaskAt = now + PERF.autoTaskMinMs + Math.random() * PERF.autoTaskJitterMs;
      return nativeAssignAutoTask(c);
    };
  }

  function installLooseHaulTargetCache() {
    if (typeof findLooseHaulTarget !== 'function' || window.HavenfallContext?.looseHaulTargetCacheInstalled) return;
    const nativeFindLooseHaulTarget = findLooseHaulTarget;
    let cachedAt = 0;
    let cachedTarget = null;
    window.HavenfallContext.looseHaulTargetCacheInstalled = true;

    findLooseHaulTarget = function findLooseHaulTargetCached() {
      const now = nowMs();
      if (
        cachedTarget &&
        now - cachedAt < PERF.looseTargetCacheMs &&
        !cachedTarget.reservedBy &&
        state?.objects?.includes?.(cachedTarget)
      ) {
        return cachedTarget;
      }

      cachedTarget = nativeFindLooseHaulTarget();
      cachedAt = now;
      return cachedTarget;
    };
  }

  function installNearestObjectOptimizations() {
    if (typeof nearestBlueprint === 'function') {
      nearestBlueprint = function nearestBlueprintSinglePass(c) {
        let best = null;
        let bestDist = Infinity;
        const objects = state?.objects || [];
        for (let i = 0; i < objects.length; i++) {
          const obj = objects[i];
          if (obj?.type !== 'blueprint') continue;
          const d = dist(c.x, c.y, obj.x, obj.y);
          if (d < bestDist) { bestDist = d; best = obj; }
        }
        return best;
      };
    }

    if (typeof nearestBed === 'function') {
      nearestBed = function nearestBedSinglePass(c) {
        let best = null;
        let bestDist = Infinity;
        const objects = state?.objects || [];
        for (let i = 0; i < objects.length; i++) {
          const obj = objects[i];
          if (obj?.type !== 'bed') continue;
          const d = dist(c.x, c.y, obj.x, obj.y);
          if (d < bestDist) { bestDist = d; best = obj; }
        }
        return best;
      };
    }

    if (typeof nearestThreat === 'function') {
      nearestThreat = function nearestThreatSinglePass(c) {
        let best = null;
        let bestDist = Infinity;
        const wolves = state?.wolves || [];
        for (let i = 0; i < wolves.length; i++) {
          const wolf = wolves[i];
          const wx = Math.round(wolf.x);
          const wy = Math.round(wolf.y);
          const d = dist(c.x, c.y, wx, wy);
          if (d >= 14 && typeof isTileDiscovered === 'function' && !isTileDiscovered(wx, wy)) continue;
          if (d < bestDist) { bestDist = d; best = wolf; }
        }
        return best;
      };
    }

    if (typeof nearestGatherable === 'function') {
      nearestGatherable = function nearestGatherableSinglePass(c, markedOnly = false) {
        let best = null;
        let bestDist = Infinity;
        let bestMarked = false;
        const objects = state?.objects || [];
        for (let i = 0; i < objects.length; i++) {
          const obj = objects[i];
          if (typeof isGatherableReady === 'function' && !isGatherableReady(obj)) continue;
          if (typeof isTileDiscovered === 'function' && !isTileDiscovered(obj.x, obj.y)) continue;
          const marked = !!obj.markedForGather;
          if (markedOnly && !marked) continue;
          const d = dist(c.x, c.y, obj.x, obj.y);
          if (!best || (marked && !bestMarked) || (marked === bestMarked && d < bestDist)) {
            best = obj;
            bestDist = d;
            bestMarked = marked;
          }
        }
        return best;
      };
    }
  }

  installZoneTickHotfix();
  installZoneOverlayHotfix();
  installAutoTaskCooldown();
  installLooseHaulTargetCache();
  installNearestObjectOptimizations();

  console.info('[Performance] Hotfixes de renderer, zonas e IA carregados.');
})();