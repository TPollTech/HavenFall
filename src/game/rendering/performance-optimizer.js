'use strict';

(() => {
  if (window.HavenfallContext?.performanceOptimizerInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.performanceOptimizerInstalled = true;

  const CHUNK_TILES = 16;
  const CHUNK_PX = () => CHUNK_TILES * TILE;
  const terrainCache = new Map();
  const objectChunkIndex = new Map();
  const renderBuckets = [];
  let terrainCacheWorldRef = null;
  let terrainCacheTerrainRef = null;
  let terrainCacheSignature = '';
  let terrainCacheVersion = 1;
  let indexedObjectsRef = null;
  let indexedObjectsLength = -1;
  let indexedObjectsSignature = '';
  let lastOptimizedDrawAt = 0;
  let lastReportedSlowRenderAt = 0;

  const original = {
    draw: typeof draw === 'function' ? draw : null,
    resizeGameCanvas: typeof resizeGameCanvas === 'function' ? resizeGameCanvas : null,
    drawTile: typeof drawTile === 'function' ? drawTile : null,
    drawColonist: typeof drawColonist === 'function' ? drawColonist : null,
    drawRain: typeof drawRain === 'function' ? drawRain : null,
    invalidateSpatialGrid: typeof invalidateSpatialGrid === 'function' ? invalidateSpatialGrid : null
  };

  function perfNow() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  function setting(path, fallback = null) {
    return window.HavenfallSettings?.get?.(path, fallback) ?? fallback;
  }

  function quality() {
    const zoom = Number(camera?.zoom || 1);
    const renderDistance = setting('performance.renderDistance', 'medium');
    const particles = setting('graphics.particles', 'medium');
    const fog = setting('graphics.fogQuality', 'medium');
    const water = setting('graphics.waterQuality', 'medium');
    const targetFPS = setting('video.targetFPS', 60);
    const renderScale = Number(window.HavenfallSettings?.renderScale?.() || setting('video.renderScale', 1) || 1);
    const farZoom = zoom < 0.82;
    const strategicZoom = zoom < 0.62;

    return {
      zoom,
      renderDistance,
      renderPadding: Number(window.HavenfallSettings?.renderPadding?.() ?? ({ short: 0, medium: 2, long: 4, very_long: 7 }[renderDistance] ?? 2)),
      renderScale,
      targetFPS,
      farZoom,
      strategicZoom,
      drawTerrainBlends: zoom >= 0.86 && renderDistance !== 'short',
      drawTileHooks: zoom >= 0.9 && renderDistance !== 'short',
      drawNames: zoom >= 1.0,
      drawTinyBars: zoom >= 0.92,
      drawEquipment: zoom >= 0.92,
      drawRain: particles !== 'off' && zoom >= 0.62,
      drawFog: fog !== 'low' || zoom >= 0.72,
      water,
      particles
    };
  }

  function targetFrameIntervalMs(q = quality()) {
    if (appScreen === SCREEN.PAUSED) return 1000 / 15;
    if (q.targetFPS === 'unlimited') return 0;
    const fps = Math.max(20, Math.min(144, Number(q.targetFPS) || 60));
    return 1000 / fps;
  }

  function shouldSkipOptimizedDraw(now, q) {
    const interval = targetFrameIntervalMs(q);
    if (interval <= 0) return false;
    if (!lastOptimizedDrawAt) {
      lastOptimizedDrawAt = now;
      return false;
    }
    if (now - lastOptimizedDrawAt + 0.5 < interval) return true;
    lastOptimizedDrawAt = now;
    return false;
  }

  function makeCanvas(width, height) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  }

  function chunkKey(cx, cy) {
    return `${cx},${cy}`;
  }

  function chunkKeyForTile(x, y) {
    return chunkKey(Math.floor(x / CHUNK_TILES), Math.floor(y / CHUNK_TILES));
  }

  function visibleChunks(bounds) {
    const startCx = Math.floor(bounds.startX / CHUNK_TILES);
    const endCx = Math.floor(bounds.endX / CHUNK_TILES);
    const startCy = Math.floor(bounds.startY / CHUNK_TILES);
    const endCy = Math.floor(bounds.endY / CHUNK_TILES);
    const chunks = [];
    for (let cy = startCy; cy <= endCy; cy++) {
      for (let cx = startCx; cx <= endCx; cx++) chunks.push({ cx, cy });
    }
    return chunks;
  }

  function resetTerrainCacheIfNeeded(q) {
    const signature = [
      state?.world?.seed || '',
      state?.world?.cols || getWorldCols(),
      state?.world?.rows || getWorldRows(),
      q.drawTerrainBlends ? 'blend' : 'flat',
      q.water,
      q.renderDistance
    ].join('|');

    if (terrainCacheWorldRef === state?.world && terrainCacheTerrainRef === state?.terrain && terrainCacheSignature === signature) return;
    terrainCache.clear();
    terrainCacheWorldRef = state?.world;
    terrainCacheTerrainRef = state?.terrain;
    terrainCacheSignature = signature;
    terrainCacheVersion++;
  }

  function invalidateTerrainChunks() {
    terrainCache.clear();
    terrainCacheVersion++;
  }

  function terrainColor(type) {
    return ({
      grass: '#586d2d',
      dirt: '#7a5738',
      sand: '#aa914f',
      stone: '#626966',
      water: '#1f6f88'
    })[type] || '#586d2d';
  }

  function rgba(hex, alpha) {
    const value = String(hex || '').replace('#', '');
    if (value.length !== 6) return `rgba(88, 109, 45, ${alpha})`;
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function tileTypeAt(x, y) {
    return state?.terrain?.[y]?.[x] || null;
  }

  function drawTerrainTextureTo(targetCtx, img, x, y) {
    if (!img) return;
    const sw = img.naturalWidth || img.width || TILE;
    const sh = img.naturalHeight || img.height || TILE;
    const crop = Math.max(0, Math.min(14, Math.floor(Math.min(sw, sh) * 0.055)));
    const size = TILE + 2.8;
    targetCtx.drawImage(
      img,
      crop,
      crop,
      Math.max(1, sw - crop * 2),
      Math.max(1, sh - crop * 2),
      x * TILE - 1.4,
      y * TILE - 1.4,
      size,
      size
    );
  }

  function drawBlendStripTo(targetCtx, x, y, side, neighborType) {
    if (!neighborType) return;
    const px = x * TILE;
    const py = y * TILE;
    const w = 9;
    const color = terrainColor(neighborType);
    let gradient;

    if (side === 'left') {
      gradient = targetCtx.createLinearGradient(px, 0, px + w, 0);
      gradient.addColorStop(0, rgba(color, 0.5));
      gradient.addColorStop(1, rgba(color, 0));
      targetCtx.fillStyle = gradient;
      targetCtx.fillRect(px - 0.5, py - 1.4, w, TILE + 2.8);
    } else if (side === 'right') {
      gradient = targetCtx.createLinearGradient(px + TILE, 0, px + TILE - w, 0);
      gradient.addColorStop(0, rgba(color, 0.5));
      gradient.addColorStop(1, rgba(color, 0));
      targetCtx.fillStyle = gradient;
      targetCtx.fillRect(px + TILE - w + 0.5, py - 1.4, w, TILE + 2.8);
    } else if (side === 'top') {
      gradient = targetCtx.createLinearGradient(0, py, 0, py + w);
      gradient.addColorStop(0, rgba(color, 0.5));
      gradient.addColorStop(1, rgba(color, 0));
      targetCtx.fillStyle = gradient;
      targetCtx.fillRect(px - 1.4, py - 0.5, TILE + 2.8, w);
    } else if (side === 'bottom') {
      gradient = targetCtx.createLinearGradient(0, py + TILE, 0, py + TILE - w);
      gradient.addColorStop(0, rgba(color, 0.5));
      gradient.addColorStop(1, rgba(color, 0));
      targetCtx.fillStyle = gradient;
      targetCtx.fillRect(px - 1.4, py + TILE - w + 0.5, TILE + 2.8, w);
    }
  }

  function drawTerrainTileTo(targetCtx, x, y, type, q) {
    targetCtx.fillStyle = terrainColor(type);
    targetCtx.fillRect(x * TILE - 1.4, y * TILE - 1.4, TILE + 2.8, TILE + 2.8);

    const img = images[`tile_${type}`] || (type === 'water' ? null : images.tile_grass);
    drawTerrainTextureTo(targetCtx, img, x, y);

    if (!q.drawTerrainBlends) return;
    const left = tileTypeAt(x - 1, y);
    const right = tileTypeAt(x + 1, y);
    const top = tileTypeAt(x, y - 1);
    const bottom = tileTypeAt(x, y + 1);
    if (left && left !== type) drawBlendStripTo(targetCtx, x, y, 'left', left);
    if (right && right !== type) drawBlendStripTo(targetCtx, x, y, 'right', right);
    if (top && top !== type) drawBlendStripTo(targetCtx, x, y, 'top', top);
    if (bottom && bottom !== type) drawBlendStripTo(targetCtx, x, y, 'bottom', bottom);
  }

  function renderTerrainChunk(cx, cy, q) {
    const key = chunkKey(cx, cy);
    const sizePx = CHUNK_PX();
    const originX = cx * CHUNK_TILES;
    const originY = cy * CHUNK_TILES;
    let entry = terrainCache.get(key);

    if (!entry || entry.version !== terrainCacheVersion) {
      const canvasRef = makeCanvas(sizePx, sizePx);
      entry = { canvas: canvasRef, ctx: canvasRef.getContext('2d'), version: terrainCacheVersion, dirty: true };
      terrainCache.set(key, entry);
    }

    if (!entry.dirty) return entry;

    const cctx = entry.ctx;
    cctx.clearRect(0, 0, sizePx, sizePx);
    cctx.save();
    cctx.translate(-originX * TILE, -originY * TILE);

    const maxX = Math.min(getWorldCols() - 1, originX + CHUNK_TILES - 1);
    const maxY = Math.min(getWorldRows() - 1, originY + CHUNK_TILES - 1);
    for (let y = originY; y <= maxY; y++) {
      const row = state?.terrain?.[y];
      if (!row) continue;
      for (let x = originX; x <= maxX; x++) drawTerrainTileTo(cctx, x, y, row[x] || 'grass', q);
    }

    cctx.restore();
    entry.dirty = false;
    return entry;
  }

  function drawTerrainChunks(bounds, q) {
    resetTerrainCacheIfNeeded(q);
    const chunks = visibleChunks(bounds);
    for (const { cx, cy } of chunks) {
      const entry = renderTerrainChunk(cx, cy, q);
      ctx.drawImage(entry.canvas, cx * CHUNK_TILES * TILE, cy * CHUNK_TILES * TILE);
    }
    return { chunksDrawn: chunks.length, tilesDrawn: chunks.length * CHUNK_TILES * CHUNK_TILES };
  }

  function drawTileHooks(bounds, q) {
    if (!q.drawTileHooks || !window.GameSystems?.drawTileRenderers) return 0;
    let calls = 0;
    for (let y = bounds.startY; y <= bounds.endY; y++) {
      const row = state?.terrain?.[y];
      if (!row) continue;
      for (let x = bounds.startX; x <= bounds.endX; x++) {
        window.GameSystems.drawTileRenderers(x, y, row[x] || 'grass');
        calls++;
      }
    }
    return calls;
  }

  function objectsSignature(objects) {
    if (!objects?.length) return '0';
    const first = objects[0]?.id || '';
    const last = objects[objects.length - 1]?.id || '';
    return `${objects.length}|${first}|${last}`;
  }

  function rebuildObjectIndex() {
    objectChunkIndex.clear();
    const objects = state?.objects || [];
    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      if (!obj || !Number.isFinite(Number(obj.x)) || !Number.isFinite(Number(obj.y))) continue;
      const key = chunkKeyForTile(obj.x, obj.y);
      if (!objectChunkIndex.has(key)) objectChunkIndex.set(key, []);
      objectChunkIndex.get(key).push(obj);
    }
    indexedObjectsRef = objects;
    indexedObjectsLength = objects.length;
    indexedObjectsSignature = objectsSignature(objects);
  }

  function ensureObjectIndex() {
    const objects = state?.objects || [];
    const signature = objectsSignature(objects);
    if (objects === indexedObjectsRef && objects.length === indexedObjectsLength && signature === indexedObjectsSignature) return;
    rebuildObjectIndex();
  }

  function visibleObjects(bounds) {
    ensureObjectIndex();
    const chunks = visibleChunks(bounds);
    const result = [];
    for (let i = 0; i < chunks.length; i++) {
      const { cx, cy } = chunks[i];
      const items = objectChunkIndex.get(chunkKey(cx, cy));
      if (items?.length) result.push(...items);
    }
    return result;
  }

  function invalidateObjectIndex() {
    indexedObjectsRef = null;
    indexedObjectsLength = -1;
    indexedObjectsSignature = '';
    objectChunkIndex.clear();
  }

  function ensureBucketCount(count) {
    while (renderBuckets.length < count) renderBuckets.push([]);
    for (let i = 0; i < renderBuckets.length; i++) renderBuckets[i].length = 0;
  }

  function makeBucketState(bounds) {
    const startY = bounds.startY - 4;
    const count = Math.max(1, bounds.endY - bounds.startY + 10);
    ensureBucketCount(count);
    return { startY, count, buckets: renderBuckets };
  }

  function pushBucket(bucketState, y, item) {
    const index = Math.floor(Number(y) || 0) - bucketState.startY;
    if (index < 0 || index >= bucketState.count) return false;
    bucketState.buckets[index].push(item);
    return true;
  }

  function optimizedResizeGameCanvas(force = false) {
    measureRendererLayout(force);

    const cssWidth = rendererLayoutCache.canvasCssWidth || Math.max(320, Math.floor(window.innerWidth));
    const cssHeight = rendererLayoutCache.canvasCssHeight || Math.max(240, Math.floor(window.innerHeight));
    const internal = window.HavenfallSettings?.resolutionSize
      ? window.HavenfallSettings.resolutionSize(cssWidth, cssHeight)
      : { width: cssWidth, height: cssHeight, scale: 1 };

    const width = Math.max(320, Math.floor(internal.width || cssWidth));
    const height = Math.max(240, Math.floor(internal.height || cssHeight));

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      measureRendererLayout(true);
      invalidateTerrainChunks();
    }

    viewTransform.scale = camera.zoom;
    clampCamera();
    const safe = cameraSafeViewport();
    viewTransform.offsetX = width / 2 - camera.x * viewTransform.scale;
    viewTransform.offsetY = safe.height / 2 - camera.y * viewTransform.scale;
  }

  function optimizedDrawTile(x, y, type) {
    const q = quality();
    drawTerrainTileTo(ctx, x, y, type, q);
    if (q.drawTileHooks) window.GameSystems?.drawTileRenderers?.(x, y, type);
  }

  function optimizedDrawColonist(c) {
    if (!c) return;
    const q = quality();
    const selected = c.id === selectedColonistId;

    if (selected) {
      ctx.save();
      ctx.fillStyle = 'rgba(155, 211, 106, .28)';
      ctx.strokeStyle = '#9bd36a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(c.px, c.py + 19, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    const moving = c.path && c.path.length;
    const frame = moving ? Math.floor(c.anim * 8) % 4 : 0;
    let dir = c.dir;
    let flip = false;
    if ((c.sprite === 'colonistB' || c.sprite === 'colonistC') && dir === 'left') { dir = 'right'; flip = true; }
    const img = images[`${c.sprite}_${dir}_${frame}`] || images[`${c.sprite}_down_0`];
    drawAsset(img, c.px, c.py + 24, 0.48, 0.5, 1, flip);

    if ((selected || q.drawEquipment) && typeof drawEquipmentBadge === 'function') drawEquipmentBadge(c);
    if (selected || q.drawTinyBars) drawTinyBars(c);
    if (selected || q.drawNames) drawName(c.name, c.px, c.py - 38);
  }

  function optimizedDrawRain() {
    const q = quality();
    if (!q.drawRain) return;
    if (original.drawRain) original.drawRain();
  }

  function optimizedDraw() {
    const q = quality();
    const now = perfNow();
    if (shouldSkipOptimizedDraw(now, q)) {
      window.HavenfallPerf = window.HavenfallPerf || {};
      window.HavenfallPerf.skippedRender = true;
      return;
    }

    const started = perfNow();
    optimizedResizeGameCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#070b11';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
    ctx.scale(viewTransform.scale, viewTransform.scale);

    const bounds = visibleTileBounds(q.renderPadding);
    const renderStats = drawTerrainChunks(bounds, q);
    renderStats.tileHookCalls = drawTileHooks(bounds, q);

    if (showDebugGrid || settings?.showGrid) drawGrid(bounds);

    const bucketState = makeBucketState(bounds);
    let entitiesDrawn = 0;
    const objects = visibleObjects(bounds);

    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      if (!obj || !isTileDiscovered(obj.x, obj.y)) continue;
      const cx = obj.x * TILE + TILE / 2;
      const cy = obj.y * TILE + TILE / 2;
      if (isWorldPointInView(cx, cy)) pushBucket(bucketState, obj.y, { kind: 'obj', data: obj });
    }

    const wolves = state.wolves || [];
    for (let i = 0; i < wolves.length; i++) {
      const wolf = wolves[i];
      if (isWorldPointInView(wolf.px, wolf.py)) pushBucket(bucketState, wolf.py / TILE, { kind: 'wolf', data: wolf });
    }

    const colonists = state.colonists || [];
    for (let i = 0; i < colonists.length; i++) {
      const c = colonists[i];
      if (isWorldPointInView(c.px, c.py)) pushBucket(bucketState, c.py / TILE, { kind: 'colonist', data: c });
    }

    for (let b = 0; b < bucketState.count; b++) {
      const bucket = bucketState.buckets[b];
      for (let i = 0; i < bucket.length; i++) {
        const item = bucket[i];
        if (item.kind === 'obj') drawObject(item.data);
        else if (item.kind === 'wolf') drawWolf(item.data);
        else if (item.kind === 'colonist') optimizedDrawColonist(item.data);
        entitiesDrawn++;
      }
    }

    drawPoiMarkers();
    drawBuildPreview();
    drawGatherSelection();
    drawNightOverlay();
    window.GameSystems?.drawWorldOverlays(bounds);
    if (q.drawFog) drawFogOfWar(bounds);
    optimizedDrawRain();
    ctx.restore();
    window.GameSystems?.drawRegisteredOverlays();

    renderStats.entitiesDrawn = entitiesDrawn;
    window.HavenfallSettings?.recordRenderStats?.(renderStats);
    window.HavenfallSettings?.recordFrame?.({
      frameMs: Math.round((perfNow() - started) * 10) / 10,
      updateMs: window.HavenfallPerf?.updateMs || 0,
      renderMs: Math.round((perfNow() - started) * 10) / 10
    });

    const elapsed = perfNow() - started;
    if (elapsed > 34 && now - lastReportedSlowRenderAt > 2500) {
      lastReportedSlowRenderAt = now;
      console.warn('[HavenFall Render]', `Frame pesado: ${Math.round(elapsed)}ms`, renderStats);
    }
  }

  if (original.invalidateSpatialGrid) {
    invalidateSpatialGrid = function optimizedInvalidateSpatialGrid() {
      original.invalidateSpatialGrid();
      invalidateObjectIndex();
    };
  }

  window.HavenfallRenderOptimization = {
    invalidateTerrainChunks,
    invalidateObjectIndex,
    clearCaches() {
      invalidateTerrainChunks();
      invalidateObjectIndex();
    },
    stats() {
      return {
        terrainChunks: terrainCache.size,
        indexedObjectChunks: objectChunkIndex.size,
        chunkTiles: CHUNK_TILES,
        signature: terrainCacheSignature
      };
    },
    original
  };

  resizeGameCanvas = optimizedResizeGameCanvas;
  drawTile = optimizedDrawTile;
  drawColonist = optimizedDrawColonist;
  drawRain = optimizedDrawRain;
  draw = optimizedDraw;
})();
