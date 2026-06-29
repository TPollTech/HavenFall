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
    looseTargetCacheMs: 220,
    pathCacheMs: 120,
    maxPathCacheEntries: 220
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

  function installFastDrawAsset() {
    if (typeof drawAsset !== 'function' || window.HavenfallContext?.fastDrawAssetInstalled) return;
    window.HavenfallContext.fastDrawAssetInstalled = true;

    drawAsset = function drawAssetFast(img, x, y, scale = 1, ax = 0.5, ay = 0.5, flip = false, rotationTurns = 0) {
      if (!img) return;
      const w = img.width * scale;
      const h = img.height * scale;
      const rotation = ((Number(rotationTurns) || 0) % 4 + 4) % 4;

      if (!rotation && !flip) {
        ctx.drawImage(img, x - w * ax, y - h * ay, w, h);
        return;
      }

      ctx.save();
      ctx.translate(x, y);
      if (rotation) ctx.rotate(rotation * Math.PI / 2);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(img, -w * ax, -h * ay, w, h);
      ctx.restore();
    };
  }

  function installObjectScaleCache() {
    if (typeof objectScale !== 'function' || window.HavenfallContext?.objectScaleCacheInstalled) return;
    const nativeObjectScale = objectScale;
    const scaleCache = new Map();
    window.HavenfallContext.objectScaleCacheInstalled = true;

    objectScale = function objectScaleCached(type, img) {
      const width = img?.naturalWidth || img?.width || 0;
      const height = img?.naturalHeight || img?.height || 0;
      const key = `${type}|${width}|${height}`;
      if (scaleCache.has(key)) return scaleCache.get(key);
      const value = nativeObjectScale(type, img);
      scaleCache.set(key, value);
      return value;
    };
  }

  function installNameMeasureCache() {
    if (typeof drawName !== 'function' || window.HavenfallContext?.nameMeasureCacheInstalled) return;
    const widthCache = new Map();
    window.HavenfallContext.nameMeasureCacheInstalled = true;

    drawName = function drawNameCached(name, x, y) {
      const label = String(name ?? '');
      const font = 'bold 12px system-ui';
      let w = widthCache.get(label);
      ctx.save();
      ctx.font = font;
      if (w === undefined) {
        w = ctx.measureText(label).width + 10;
        widthCache.set(label, w);
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      roundRect(x - w / 2, y - 13, w, 18, 8, true, false);
      ctx.fillStyle = '#f2fff0';
      ctx.fillText(label, x, y);
      ctx.restore();
    };
  }

  function installTerrainTileCache() {
    if (typeof drawTile !== 'function' || window.HavenfallContext?.terrainTileCacheInstalled) return;
    if (typeof document === 'undefined') return;
    const tileCache = new Map();
    window.HavenfallContext.terrainTileCacheInstalled = true;

    function baseColor(type) {
      if (typeof terrainBaseColor === 'function') return terrainBaseColor(type);
      return (typeof TERRAIN_BASE_COLORS !== 'undefined' && TERRAIN_BASE_COLORS[type]) || '#586d2d';
    }

    function rgba(hex, alpha) {
      if (typeof rgbaFromHex === 'function') return rgbaFromHex(hex, alpha);
      const value = String(hex || '').replace('#', '');
      if (value.length !== 6) return `rgba(88, 109, 45, ${alpha})`;
      const r = parseInt(value.slice(0, 2), 16);
      const g = parseInt(value.slice(2, 4), 16);
      const b = parseInt(value.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function neighborType(x, y, fallback) {
      return typeof terrainAtTile === 'function' ? terrainAtTile(x, y) : fallback;
    }

    function normalizedNeighbor(value, type) {
      return value && value !== type ? value : '';
    }

    function cacheKey(type, left, right, top, bottom, img) {
      const imgKey = img?.src || img?.dataset?.src || img?.width || 'none';
      return `${TILE}|${type}|${normalizedNeighbor(left, type)}|${normalizedNeighbor(right, type)}|${normalizedNeighbor(top, type)}|${normalizedNeighbor(bottom, type)}|${imgKey}`;
    }

    function drawCachedBlend(localCtx, side, neighbor) {
      if (!neighbor) return;
      const overdraw = Number(typeof TILE_OVERDRAW !== 'undefined' ? TILE_OVERDRAW : 1.4);
      const blendWidth = Number(typeof TILE_BLEND_WIDTH !== 'undefined' ? TILE_BLEND_WIDTH : 9);
      const full = TILE + overdraw * 2;
      const color = baseColor(neighbor);
      let gradient;

      if (side === 'left') {
        gradient = localCtx.createLinearGradient(overdraw, 0, overdraw + blendWidth, 0);
        gradient.addColorStop(0, rgba(color, 0.5));
        gradient.addColorStop(1, rgba(color, 0));
        localCtx.fillStyle = gradient;
        localCtx.fillRect(overdraw - 0.5, 0, blendWidth, full);
      } else if (side === 'right') {
        gradient = localCtx.createLinearGradient(overdraw + TILE, 0, overdraw + TILE - blendWidth, 0);
        gradient.addColorStop(0, rgba(color, 0.5));
        gradient.addColorStop(1, rgba(color, 0));
        localCtx.fillStyle = gradient;
        localCtx.fillRect(overdraw + TILE - blendWidth + 0.5, 0, blendWidth, full);
      } else if (side === 'top') {
        gradient = localCtx.createLinearGradient(0, overdraw, 0, overdraw + blendWidth);
        gradient.addColorStop(0, rgba(color, 0.5));
        gradient.addColorStop(1, rgba(color, 0));
        localCtx.fillStyle = gradient;
        localCtx.fillRect(0, overdraw - 0.5, full, blendWidth);
      } else if (side === 'bottom') {
        gradient = localCtx.createLinearGradient(0, overdraw + TILE, 0, overdraw + TILE - blendWidth);
        gradient.addColorStop(0, rgba(color, 0.5));
        gradient.addColorStop(1, rgba(color, 0));
        localCtx.fillStyle = gradient;
        localCtx.fillRect(0, overdraw + TILE - blendWidth + 0.5, full, blendWidth);
      }
    }

    function buildTileBitmap(type, left, right, top, bottom, img) {
      const overdraw = Number(typeof TILE_OVERDRAW !== 'undefined' ? TILE_OVERDRAW : 1.4);
      const cropRatio = Number(typeof TILE_SOURCE_CROP_RATIO !== 'undefined' ? TILE_SOURCE_CROP_RATIO : 0.055);
      const size = Math.ceil(TILE + overdraw * 2);
      const tileCanvas = document.createElement('canvas');
      tileCanvas.width = size;
      tileCanvas.height = size;
      const localCtx = tileCanvas.getContext('2d');

      localCtx.fillStyle = baseColor(type);
      localCtx.fillRect(0, 0, size, size);

      if (img) {
        const sw = img.naturalWidth || img.width || TILE;
        const sh = img.naturalHeight || img.height || TILE;
        const crop = Math.max(0, Math.min(14, Math.floor(Math.min(sw, sh) * cropRatio)));
        localCtx.drawImage(
          img,
          crop,
          crop,
          Math.max(1, sw - crop * 2),
          Math.max(1, sh - crop * 2),
          0,
          0,
          size,
          size
        );
      }

      drawCachedBlend(localCtx, 'left', normalizedNeighbor(left, type));
      drawCachedBlend(localCtx, 'right', normalizedNeighbor(right, type));
      drawCachedBlend(localCtx, 'top', normalizedNeighbor(top, type));
      drawCachedBlend(localCtx, 'bottom', normalizedNeighbor(bottom, type));
      return tileCanvas;
    }

    drawTile = function drawTileCached(x, y, type) {
      const img = images?.[`tile_${type}`] || (type === 'water' ? null : images?.tile_grass);
      const left = neighborType(x - 1, y, type);
      const right = neighborType(x + 1, y, type);
      const top = neighborType(x, y - 1, type);
      const bottom = neighborType(x, y + 1, type);
      const key = cacheKey(type, left, right, top, bottom, img);
      let tileCanvas = tileCache.get(key);
      if (!tileCanvas) {
        tileCanvas = buildTileBitmap(type, left, right, top, bottom, img);
        tileCache.set(key, tileCanvas);
      }

      const overdraw = Number(typeof TILE_OVERDRAW !== 'undefined' ? TILE_OVERDRAW : 1.4);
      ctx.drawImage(tileCanvas, x * TILE - overdraw, y * TILE - overdraw);
      window.GameSystems?.drawTileRenderers(x, y, type);
    };
  }

  function installFastFindPath() {
    if (typeof findPath !== 'function' || window.HavenfallContext?.fastFindPathInstalled) return;
    const pathCache = new Map();
    window.HavenfallContext.fastFindPathInstalled = true;

    function makeKey(sx, sy, ex, ey, target) {
      const targetKey = target?.id || target?.type || '';
      return `${sx},${sy}>${ex},${ey}|${targetKey}|${state?.objects?.length || 0}`;
    }

    function clonePath(path) {
      return path.map(step => ({ x: step.x, y: step.y }));
    }

    function rememberPath(key, path) {
      if (pathCache.size > PERF.maxPathCacheEntries) pathCache.clear();
      pathCache.set(key, { at: nowMs(), path: clonePath(path) });
    }

    findPath = function findPathFast(startX, startY, endX, endY, target = null) {
      startX = Math.round(startX);
      startY = Math.round(startY);
      endX = Math.round(endX);
      endY = Math.round(endY);

      const cols = typeof getWorldCols === 'function' ? getWorldCols() : 0;
      const rows = typeof getWorldRows === 'function' ? getWorldRows() : 0;
      if (endX < 0 || endY < 0 || endX >= cols || endY >= rows) return [];
      if (startX === endX && startY === endY) return [];

      const key = makeKey(startX, startY, endX, endY, target);
      const cached = pathCache.get(key);
      const now = nowMs();
      if (cached && now - cached.at < PERF.pathCacheMs) return clonePath(cached.path);

      const queueX = [startX];
      const queueY = [startY];
      let head = 0;
      const came = new Map();
      const startKey = tileKey(startX, startY);
      const endKey = tileKey(endX, endY);
      const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
      const maxIterations = Math.min(cols * rows, 4000);
      let found = false;
      let iterations = 0;

      came.set(startKey, -1);

      while (head < queueX.length && iterations++ < maxIterations) {
        const cx = queueX[head];
        const cy = queueY[head++];
        const currKey = tileKey(cx, cy);
        if (currKey === endKey) {
          found = true;
          break;
        }

        for (let i = 0; i < dirs.length; i++) {
          const dx = dirs[i][0];
          const dy = dirs[i][1];
          const nx = cx + dx;
          const ny = cy + dy;
          const nKey = tileKey(nx, ny);
          const diagonal = dx !== 0 && dy !== 0;
          if (diagonal && (isBlocked(cx + dx, cy, target) || isBlocked(cx, cy + dy, target))) continue;
          if (!came.has(nKey) && !isBlocked(nx, ny, target)) {
            came.set(nKey, currKey);
            queueX.push(nx);
            queueY.push(ny);
          }
        }
      }

      if (!found || !came.has(endKey)) {
        rememberPath(key, []);
        return [];
      }

      const path = [];
      let currentKey = endKey;
      while (currentKey !== startKey && currentKey !== -1) {
        path.push({ x: currentKey >> 16, y: currentKey & 0xFFFF });
        currentKey = came.get(currentKey);
      }
      path.reverse();
      rememberPath(key, path);
      return path;
    };
  }

  installZoneTickHotfix();
  installZoneOverlayHotfix();
  installAutoTaskCooldown();
  installLooseHaulTargetCache();
  installNearestObjectOptimizations();
  installFastDrawAsset();
  installObjectScaleCache();
  installNameMeasureCache();
  installTerrainTileCache();
  installFastFindPath();

  console.info('[Performance] Hotfixes de renderer, terreno, pathfinding, zonas e IA carregados.');
})();