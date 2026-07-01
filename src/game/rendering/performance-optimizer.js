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
    drawRain: typeof drawRain === 'function' ? drawRain : null,
    invalidateSpatialGrid: typeof invalidateSpatialGrid === 'function' ? invalidateSpatialGrid : null
  };

  const ROCK_RENDER_PALETTE = Object.freeze({
    granite: Object.freeze({ base: '#4b5563', light: '#7b8491', shadow: '#222832', stroke: '#111827', vein: '#9ca3af' }),
    sandstone: Object.freeze({ base: '#a16207', light: '#d6a044', shadow: '#5f3705', stroke: '#3f2605', vein: '#f3cf7a' }),
    slate: Object.freeze({ base: '#334155', light: '#66758a', shadow: '#172033', stroke: '#0f172a', vein: '#94a3b8' }),
    iron: Object.freeze({ base: '#7f1d1d', light: '#b45309', shadow: '#3f1111', stroke: '#260707', vein: '#ef4444' })
  });

  function perfNow() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
  function setting(path, fallback = null) { return window.HavenfallSettings?.get?.(path, fallback) ?? fallback; }

  function quality() {
    const zoom = Number(camera?.zoom || 1);
    const renderDistance = setting('performance.renderDistance', 'medium');
    const particles = setting('graphics.particles', 'medium');
    const fog = setting('graphics.fogQuality', 'medium');
    const water = setting('graphics.waterQuality', 'medium');
    const targetFPS = setting('video.targetFPS', 60);
    return {
      zoom,
      renderDistance,
      renderPadding: Number(window.HavenfallSettings?.renderPadding?.() ?? ({ short: 0, medium: 2, long: 4, very_long: 7 }[renderDistance] ?? 2)),
      targetFPS,
      drawTerrainBlends: zoom >= 0.86 && renderDistance !== 'short',
      drawTileHooks: zoom >= 0.9 && renderDistance !== 'short',
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
    if (!lastOptimizedDrawAt) { lastOptimizedDrawAt = now; return false; }
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

  function chunkKey(cx, cy) { return `${cx},${cy}`; }
  function chunkKeyForTile(x, y) { return chunkKey(Math.floor(x / CHUNK_TILES), Math.floor(y / CHUNK_TILES)); }

  function visibleChunks(bounds) {
    const startCx = Math.floor(bounds.startX / CHUNK_TILES);
    const endCx = Math.floor(bounds.endX / CHUNK_TILES);
    const startCy = Math.floor(bounds.startY / CHUNK_TILES);
    const endCy = Math.floor(bounds.endY / CHUNK_TILES);
    const chunks = [];
    for (let cy = startCy; cy <= endCy; cy++) for (let cx = startCx; cx <= endCx; cx++) chunks.push({ cx, cy });
    return chunks;
  }

  function terrainColor(type) {
    return ({ grass: '#586d2d', dirt: '#7a5738', sand: '#aa914f', stone: '#626966', water: '#1f6f88' })[type] || '#586d2d';
  }

  function rgba(hex, alpha) {
    const value = String(hex || '').replace('#', '');
    if (value.length !== 6) return `rgba(88, 109, 45, ${alpha})`;
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function tileTypeAt(x, y) { return state?.terrain?.[y]?.[x] || null; }

  function rockAtTile(x, y) {
    const world = state?.world;
    if (!world) return null;
    let layer = Array.isArray(world.geologyLayer) ? world.geologyLayer : null;
    if (!layer && typeof window.ensureGeologyState === 'function') layer = window.ensureGeologyState(world);
    return layer?.[y]?.[x] || null;
  }

  function floorAtTile(x, y) {
    return window.FloorSystem?.getFloorAt?.(x, y) || null;
  }

  function drawFloorBackdropTo(targetCtx, x, y, q = quality()) {
    const floor = floorAtTile(x, y);
    if (!floor) return false;
    return !!window.FloorSystem?.drawFloorTile?.(targetCtx, x, y, floor, q);
  }

  function rockPalette(rock) { return ROCK_RENDER_PALETTE[rock?.type] || ROCK_RENDER_PALETTE.granite; }
  function rockNoise(x, y, salt = 0) { const n = Math.sin((x + 17.31) * 12.9898 + (y - 9.17) * 78.233 + salt * 37.719) * 43758.5453; return n - Math.floor(n); }

  function drawRockPolygon(targetCtx, points, fillStyle, strokeStyle, lineWidth = 1.5) {
    if (!points.length) return;
    targetCtx.beginPath();
    targetCtx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) targetCtx.lineTo(points[i][0], points[i][1]);
    targetCtx.closePath();
    targetCtx.fillStyle = fillStyle;
    targetCtx.fill();
    targetCtx.strokeStyle = strokeStyle;
    targetCtx.lineWidth = lineWidth;
    targetCtx.stroke();
  }

  function drawRockBackdropTo(targetCtx, x, y, q = quality()) {
    const rock = rockAtTile(x, y);
    if (!rock?.solid) return false;
    const p = rockPalette(rock);
    const px = x * TILE;
    const py = y * TILE;
    const inset = q.renderDistance === 'short' ? 3 : 2;
    const n0 = rockNoise(x, y, 0);
    const n1 = rockNoise(x, y, 1);
    const n2 = rockNoise(x, y, 2);
    const n3 = rockNoise(x, y, 3);
    targetCtx.save();
    targetCtx.fillStyle = 'rgba(0,0,0,.24)';
    targetCtx.fillRect(px + 5, py + TILE * 0.70, TILE - 10, TILE * 0.22);
    const body = [
      [px + inset + n0 * 5, py + 7 + n1 * 4],
      [px + TILE - 8 - n1 * 4, py + inset + n2 * 6],
      [px + TILE - inset - n2 * 4, py + TILE - 12 - n3 * 4],
      [px + TILE * 0.58 + n3 * 5, py + TILE - inset - n0 * 4],
      [px + 7 + n2 * 4, py + TILE - 9 - n1 * 3],
      [px + inset, py + TILE * 0.42 + n0 * 6]
    ];
    drawRockPolygon(targetCtx, body, p.base, p.stroke, q.renderDistance === 'short' ? 1.25 : 1.75);
    targetCtx.globalAlpha = 0.34;
    drawRockPolygon(targetCtx, [[px + 9, py + 10], [px + TILE * 0.50, py + 6 + n1 * 5], [px + TILE * 0.39, py + TILE * 0.36], [px + 12, py + TILE * 0.42]], p.light, p.light, 0.5);
    targetCtx.globalAlpha = 0.32;
    drawRockPolygon(targetCtx, [[px + TILE * 0.52, py + TILE * 0.56], [px + TILE - 7, py + TILE * 0.46], [px + TILE - 8, py + TILE - 10], [px + TILE * 0.42, py + TILE - 6]], p.shadow, p.shadow, 0.5);
    targetCtx.globalAlpha = rock.type === 'iron' ? 0.95 : 0.48;
    targetCtx.strokeStyle = p.vein;
    targetCtx.lineWidth = rock.type === 'iron' ? 2.3 : 1.35;
    targetCtx.beginPath();
    targetCtx.moveTo(px + 13 + n0 * 4, py + 17 + n2 * 3);
    targetCtx.lineTo(px + TILE * 0.42 + n1 * 5, py + TILE * 0.43);
    targetCtx.lineTo(px + TILE - 14 - n2 * 4, py + TILE - 16 - n3 * 4);
    targetCtx.stroke();
    if (rock.type === 'iron') {
      targetCtx.globalAlpha = 0.62;
      targetCtx.strokeStyle = '#fecaca';
      targetCtx.lineWidth = 1;
      targetCtx.beginPath();
      targetCtx.moveTo(px + TILE * 0.30, py + TILE * 0.22);
      targetCtx.lineTo(px + TILE * 0.66, py + TILE * 0.31);
      targetCtx.stroke();
    }
    if (q.renderDistance !== 'short') {
      targetCtx.globalAlpha = 0.34;
      targetCtx.strokeStyle = 'rgba(255,255,255,.28)';
      targetCtx.lineWidth = 1;
      targetCtx.beginPath();
      targetCtx.moveTo(px + 11, py + 12);
      targetCtx.lineTo(px + TILE * 0.42, py + 9);
      targetCtx.stroke();
      targetCtx.globalAlpha = 0.42;
      targetCtx.fillStyle = rgba(p.stroke, 0.55);
      targetCtx.fillRect(px + 7, py + TILE - 8, TILE - 14, 2);
    }
    targetCtx.restore();
    return true;
  }

  function drawTerrainTextureTo(targetCtx, img, x, y) {
    if (!img) return;
    const sw = img.naturalWidth || img.width || TILE;
    const sh = img.naturalHeight || img.height || TILE;
    const crop = Math.max(0, Math.min(14, Math.floor(Math.min(sw, sh) * 0.055)));
    targetCtx.drawImage(img, crop, crop, Math.max(1, sw - crop * 2), Math.max(1, sh - crop * 2), x * TILE - 1.4, y * TILE - 1.4, TILE + 2.8, TILE + 2.8);
  }

  function drawBlendStripTo(targetCtx, x, y, side, neighborType) {
    if (!neighborType) return;
    const px = x * TILE;
    const py = y * TILE;
    const w = 9;
    const color = terrainColor(neighborType);
    let gradient;
    if (side === 'left') { gradient = targetCtx.createLinearGradient(px, 0, px + w, 0); gradient.addColorStop(0, rgba(color, 0.5)); gradient.addColorStop(1, rgba(color, 0)); targetCtx.fillStyle = gradient; targetCtx.fillRect(px - 0.5, py - 1.4, w, TILE + 2.8); }
    else if (side === 'right') { gradient = targetCtx.createLinearGradient(px + TILE, 0, px + TILE - w, 0); gradient.addColorStop(0, rgba(color, 0.5)); gradient.addColorStop(1, rgba(color, 0)); targetCtx.fillStyle = gradient; targetCtx.fillRect(px + TILE - w + 0.5, py - 1.4, w, TILE + 2.8); }
    else if (side === 'top') { gradient = targetCtx.createLinearGradient(0, py, 0, py + w); gradient.addColorStop(0, rgba(color, 0.5)); gradient.addColorStop(1, rgba(color, 0)); targetCtx.fillStyle = gradient; targetCtx.fillRect(px - 1.4, py - 0.5, TILE + 2.8, w); }
    else if (side === 'bottom') { gradient = targetCtx.createLinearGradient(0, py + TILE, 0, py + TILE - w); gradient.addColorStop(0, rgba(color, 0.5)); gradient.addColorStop(1, rgba(color, 0)); targetCtx.fillStyle = gradient; targetCtx.fillRect(px - 1.4, py + TILE - w + 0.5, TILE + 2.8, w); }
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

  function resetTerrainCacheIfNeeded(q) {
    const geology = state?.world?.geologyLayer;
    const signature = [
      state?.world?.seed || '',
      state?.world?.cols || getWorldCols(),
      state?.world?.rows || getWorldRows(),
      q.drawTerrainBlends ? 'blend' : 'flat',
      q.water,
      q.renderDistance,
      state?.world?.geologyVersion || '',
      state?.world?.floorVersion || 0,
      Array.isArray(geology) ? 'geology-on' : 'geology-pending',
      Array.isArray(state?.world?.floorLayer) ? 'floor-on' : 'floor-pending'
    ].join('|');
    if (terrainCacheWorldRef === state?.world && terrainCacheTerrainRef === state?.terrain && terrainCacheSignature === signature) return;
    terrainCache.clear();
    terrainCacheWorldRef = state?.world;
    terrainCacheTerrainRef = state?.terrain;
    terrainCacheSignature = signature;
    terrainCacheVersion++;
  }

  function invalidateTerrainChunks() { terrainCache.clear(); terrainCacheVersion++; }

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
      for (let x = originX; x <= maxX; x++) {
        drawTerrainTileTo(cctx, x, y, row[x] || 'grass', q);
        drawFloorBackdropTo(cctx, x, y, q);
        drawRockBackdropTo(cctx, x, y, q);
      }
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
      for (let x = bounds.startX; x <= bounds.endX; x++) { window.GameSystems.drawTileRenderers(x, y, row[x] || 'grass'); calls++; }
    }
    return calls;
  }

  function objectsSignature(objects) { if (!objects?.length) return '0'; const first = objects[0]?.id || ''; const last = objects[objects.length - 1]?.id || ''; return `${objects.length}|${first}|${last}`; }

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

  function ensureObjectIndex() { const objects = state?.objects || []; const signature = objectsSignature(objects); if (objects === indexedObjectsRef && objects.length === indexedObjectsLength && signature === indexedObjectsSignature) return; rebuildObjectIndex(); }
  function visibleObjects(bounds) { ensureObjectIndex(); const chunks = visibleChunks(bounds); const result = []; for (let i = 0; i < chunks.length; i++) { const { cx, cy } = chunks[i]; const items = objectChunkIndex.get(chunkKey(cx, cy)); if (items?.length) result.push(...items); } return result; }
  function invalidateObjectIndex() { indexedObjectsRef = null; indexedObjectsLength = -1; indexedObjectsSignature = ''; objectChunkIndex.clear(); }
  function ensureBucketCount(count) { while (renderBuckets.length < count) renderBuckets.push([]); for (let i = 0; i < renderBuckets.length; i++) renderBuckets[i].length = 0; }
  function makeBucketState(bounds) { const startY = bounds.startY - 4; const count = Math.max(1, bounds.endY - bounds.startY + 10); ensureBucketCount(count); return { startY, count, buckets: renderBuckets }; }
  function pushBucket(bucketState, y, item) { const index = Math.floor(Number(y) || 0) - bucketState.startY; if (index < 0 || index >= bucketState.count) return false; bucketState.buckets[index].push(item); return true; }
  function actorWorldX(actor) { return Number.isFinite(Number(actor?.px)) ? Number(actor.px) : Number(actor?.x || 0) * TILE + TILE / 2; }
  function actorWorldY(actor) { return Number.isFinite(Number(actor?.py)) ? Number(actor.py) : Number(actor?.y || 0) * TILE + TILE / 2; }
  function actorDepth(actor) { return actorWorldY(actor) / TILE; }

  function addActors(bucketState, list, kind, seen) {
    if (!Array.isArray(list)) return 0;
    let added = 0;
    for (let i = 0; i < list.length; i++) {
      const actor = list[i];
      if (!actor) continue;
      const key = actor.id ? `${kind}:${actor.id}` : actor;
      if (seen.has(key)) continue;
      seen.add(key);
      const px = actorWorldX(actor);
      const py = actorWorldY(actor);
      if (!isWorldPointInView(px, py)) continue;
      if (pushBucket(bucketState, actorDepth(actor), { kind, data: actor })) added++;
    }
    return added;
  }

  function drawGenericActor(actor, label = '') {
    const x = actorWorldX(actor);
    const y = actorWorldY(actor);
    const appearance = actor?.appearance || {};
    const body = appearance.clothes || appearance.cloth || actor?.cloth || '#735c3f';
    const skin = appearance.skin || '#c98f65';
    const hair = appearance.hair || '#2c1b13';
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath();
    ctx.ellipse(x, y + 20, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.fillRect(x - 8, y - 2, 16, 23);
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(x, y - 10, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hair;
    ctx.fillRect(x - 7, y - 17, 14, 6);
    ctx.restore();
    if (actor?.name && typeof drawName === 'function') drawName(actor.name, x, y - 38);
    else if (label && typeof drawName === 'function') drawName(label, x, y - 38);
  }

  function drawActor(item) {
    const actor = item?.data;
    if (!actor) return;
    if (item.kind === 'colonist') { if (typeof drawColonist === 'function') drawColonist(actor); else drawGenericActor(actor, actor.name || 'Colono'); return; }
    if (item.kind === 'wolf') { if (typeof drawWolf === 'function') drawWolf(actor); else if (window.HavenfallPawnRenderer?.drawWolf?.(actor)) return; else drawGenericActor(actor, 'Lobo'); return; }
    if (item.kind === 'mob') { if (typeof drawMob === 'function' && drawMob(actor)) return; if (window.HavenfallPawnRenderer?.drawMob?.(actor)) return; if (window.HavenfallAnimalRenderer?.drawMob?.(actor)) return; if (window.HavenfallHostileRenderer?.drawMob?.(actor)) return; drawGenericActor(actor, actor.name || actor.type || 'Mob'); return; }
    if (item.kind === 'npc') { if (window.HavenfallPawnRenderer?.drawNpc?.(actor)) return; if (window.HavenfallNpcRenderer?.drawNpc?.(actor)) return; drawGenericActor(actor, actor.name || actor.kind || 'NPC'); }
  }

  function optimizedResizeGameCanvas(force = false) {
    measureRendererLayout(force);
    const cssWidth = rendererLayoutCache.canvasCssWidth || Math.max(320, Math.floor(window.innerWidth));
    const cssHeight = rendererLayoutCache.canvasCssHeight || Math.max(240, Math.floor(window.innerHeight));
    const internal = window.HavenfallSettings?.resolutionSize ? window.HavenfallSettings.resolutionSize(cssWidth, cssHeight) : { width: cssWidth, height: cssHeight, scale: 1 };
    const width = Math.max(320, Math.floor(internal.width || cssWidth));
    const height = Math.max(240, Math.floor(internal.height || cssHeight));
    const renderScale = Math.max(0.45, Number(internal.scale || 1));
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; measureRendererLayout(true); invalidateTerrainChunks(); }
    ctx.imageSmoothingEnabled = renderScale >= 0.75;
    viewTransform.scale = camera.zoom * renderScale;
    clampCamera();
    const safe = cameraSafeViewport();
    viewTransform.offsetX = width / 2 - camera.x * viewTransform.scale;
    viewTransform.offsetY = safe.height / 2 - camera.y * viewTransform.scale;
  }

  function optimizedDrawTile(x, y, type) { const q = quality(); drawTerrainTileTo(ctx, x, y, type, q); drawFloorBackdropTo(ctx, x, y, q); drawRockBackdropTo(ctx, x, y, q); if (q.drawTileHooks) window.GameSystems?.drawTileRenderers?.(x, y, type); }
  function optimizedDrawRain() { const q = quality(); if (!q.drawRain) return; if (original.drawRain) original.drawRain(); }

  function optimizedDraw() {
    const q = quality();
    const now = perfNow();
    if (shouldSkipOptimizedDraw(now, q)) { window.HavenfallPerf = window.HavenfallPerf || {}; window.HavenfallPerf.skippedRender = true; return; }
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
    const seenActors = new Set();
    entitiesDrawn += addActors(bucketState, state?.wolves, 'wolf', seenActors);
    entitiesDrawn += addActors(bucketState, state?.mobs, 'mob', seenActors);
    entitiesDrawn += addActors(bucketState, state?.visitors, 'npc', seenActors);
    entitiesDrawn += addActors(bucketState, state?.npcs, 'npc', seenActors);
    entitiesDrawn += addActors(bucketState, state?.colonists, 'colonist', seenActors);
    for (let b = 0; b < bucketState.count; b++) {
      const bucket = bucketState.buckets[b];
      for (let i = 0; i < bucket.length; i++) {
        const item = bucket[i];
        if (item.kind === 'obj') drawObject(item.data);
        else drawActor(item);
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
      systemsMs: window.HavenfallPerf?.systemsMs || 0,
      renderMs: Math.round((perfNow() - started) * 10) / 10,
      uiMs: window.HavenfallPerf?.uiMs || 0
    });
    const elapsed = perfNow() - started;
    if (elapsed > 34 && now - lastReportedSlowRenderAt > 2500) { lastReportedSlowRenderAt = now; console.warn('[HavenFall Render]', `Frame pesado: ${Math.round(elapsed)}ms`, renderStats); }
  }

  if (original.invalidateSpatialGrid) {
    invalidateSpatialGrid = function optimizedInvalidateSpatialGrid() {
      original.invalidateSpatialGrid();
      invalidateTerrainChunks();
      invalidateObjectIndex();
    };
  }

  window.HavenfallRenderOptimization = {
    invalidateTerrainChunks,
    invalidateObjectIndex,
    clearCaches() { invalidateTerrainChunks(); invalidateObjectIndex(); },
    stats() {
      return {
        terrainChunks: terrainCache.size,
        indexedObjectChunks: objectChunkIndex.size,
        chunkTiles: CHUNK_TILES,
        signature: terrainCacheSignature,
        visitors: state?.visitors?.length || 0,
        mobs: state?.mobs?.length || 0,
        wolves: state?.wolves?.length || 0,
        colonists: state?.colonists?.length || 0
      };
    },
    original
  };

  resizeGameCanvas = optimizedResizeGameCanvas;
  drawTile = optimizedDrawTile;
  drawRain = optimizedDrawRain;
  draw = optimizedDraw;
})();
