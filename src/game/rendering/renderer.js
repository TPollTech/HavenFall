'use strict';

const rendererLayoutCache = {
  bottomReservedPx: 0,
  canvasCssWidth: 0,
  canvasCssHeight: 0,
  lastMeasure: 0
};

const rendererScratch = {
  renderList: []
};

function measureRendererLayout(force = false) {
  const now = performance.now();
  const forced = force === true || force?.type === 'resize';
  if (!forced && rendererLayoutCache.canvasCssWidth && now - rendererLayoutCache.lastMeasure < 200) return;

  rendererLayoutCache.lastMeasure = now;

  const rect = canvas.getBoundingClientRect();
  rendererLayoutCache.canvasCssWidth = Math.max(320, Math.floor(rect.width || window.innerWidth));
  rendererLayoutCache.canvasCssHeight = Math.max(240, Math.floor(rect.height || window.innerHeight));

  if (appScreen !== SCREEN.PLAYING) {
    rendererLayoutCache.bottomReservedPx = 0;
    return;
  }

  const hud = document.getElementById('hud');
  if (!hud || !canvas.width || !canvas.height) return;

  const hudRect = hud.getBoundingClientRect();
  if (!hudRect.height || !rect.height) return;

  const cssOverlap = Math.max(0, rect.bottom - hudRect.top);
  const cssToCanvas = canvas.height / Math.max(1, rect.height);
  const reserved = (cssOverlap + 18) * cssToCanvas;
  rendererLayoutCache.bottomReservedPx = clamp(Math.floor(reserved), 0, Math.floor(canvas.height * 0.45));
}

function cameraBottomUiSafePx() {
  measureRendererLayout();
  return rendererLayoutCache.bottomReservedPx;
}

function cameraSafeViewport() {
  const bottomReserved = rendererLayoutCache.bottomReservedPx;
  return {
    width: canvas.width,
    height: Math.max(160, canvas.height - bottomReserved),
    bottomReserved
  };
}

function resizeGameCanvas(force = false) {
  measureRendererLayout(force);

  const width = rendererLayoutCache.canvasCssWidth || Math.max(320, Math.floor(window.innerWidth));
  const height = rendererLayoutCache.canvasCssHeight || Math.max(240, Math.floor(window.innerHeight));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    measureRendererLayout(true);
  }

  viewTransform.scale = camera.zoom;
  clampCamera();
  const safe = cameraSafeViewport();
  viewTransform.offsetX = width / 2 - camera.x * viewTransform.scale;
  viewTransform.offsetY = safe.height / 2 - camera.y * viewTransform.scale;
}

function clampCamera() {
  if (!canvas.width || !canvas.height || !viewTransform.scale) return;

  const worldW = getWorldWidth();
  const worldH = getWorldHeight();
  const safe = cameraSafeViewport();
  const visibleWorldW = safe.width / viewTransform.scale;
  const visibleWorldH = safe.height / viewTransform.scale;
  const halfW = visibleWorldW / 2;
  const halfH = visibleWorldH / 2;

  if (worldW <= visibleWorldW) camera.x = worldW / 2;
  else camera.x = clamp(camera.x, halfW, worldW - halfW);

  if (worldH <= visibleWorldH) camera.y = worldH / 2;
  else camera.y = clamp(camera.y, halfH, worldH - halfH);
}

function updateCamera(dt) {
  if (appScreen !== SCREEN.PLAYING || !state) return;

  let dx = 0;
  let dy = 0;

  if (cameraInput.has('KeyW') || cameraInput.has('ArrowUp')) dy -= 1;
  if (cameraInput.has('KeyS') || cameraInput.has('ArrowDown')) dy += 1;
  if (cameraInput.has('KeyA') || cameraInput.has('ArrowLeft')) dx -= 1;
  if (cameraInput.has('KeyD') || cameraInput.has('ArrowRight')) dx += 1;

  if (dx === 0 && dy === 0) return;

  const len = Math.hypot(dx, dy) || 1;
  const boost = cameraInput.has('ShiftLeft') || cameraInput.has('ShiftRight') ? 1.7 : 1;
  camera.x += (dx / len) * camera.speed * boost * dt / Math.max(0.75, camera.zoom * 0.85);
  camera.y += (dy / len) * camera.speed * boost * dt / Math.max(0.75, camera.zoom * 0.85);
  clampCamera();
}

function setCameraZoom(nextZoom, anchor = null) {
  const previousScale = viewTransform.scale || 1;
  const oldZoom = camera.zoom;
  camera.zoom = clamp(Number(nextZoom) || camera.zoom, camera.minZoom, camera.maxZoom);

  if (anchor && canvas.width && canvas.height) {
    const beforeX = (anchor.x - viewTransform.offsetX) / previousScale;
    const beforeY = (anchor.y - viewTransform.offsetY) / previousScale;
    resizeGameCanvas(true);
    const afterScale = viewTransform.scale || previousScale;
    camera.x += beforeX - (anchor.x - viewTransform.offsetX) / afterScale;
    camera.y += beforeY - (anchor.y - viewTransform.offsetY) / afterScale;
  }

  clampCamera();
  if (oldZoom !== camera.zoom) updateUI(true);
}

function changeCameraZoom(delta, anchor = null) {
  setCameraZoom(camera.zoom + delta, anchor);
}

function resetCameraZoom() {
  setCameraZoom(1.12);
  centerCameraOnSelectedColonist();
}

function centerCameraOnSelectedColonist() {
  const c = selectedColonist?.();
  if (c) {
    camera.x = c.px || c.x * TILE + TILE / 2;
    camera.y = c.py || c.y * TILE + TILE / 2;
  } else {
    camera.x = getWorldWidth() / 2;
    camera.y = getWorldHeight() / 2;
  }
  clampCamera();
}

function visibleWorldBounds(padding = TILE * 2) {
  const scale = viewTransform.scale || 1;
  const safe = cameraSafeViewport();
  return {
    left: Math.max(0, (-viewTransform.offsetX / scale) - padding),
    top: Math.max(0, (-viewTransform.offsetY / scale) - padding),
    right: Math.min(getWorldWidth(), ((safe.width - viewTransform.offsetX) / scale) + padding),
    bottom: Math.min(getWorldHeight(), ((safe.height - viewTransform.offsetY) / scale) + padding)
  };
}

function visibleTileBounds(padding = 2) {
  const b = visibleWorldBounds(padding * TILE);
  return {
    startX: clamp(Math.floor(b.left / TILE), 0, getWorldCols() - 1),
    endX: clamp(Math.ceil(b.right / TILE), 0, getWorldCols() - 1),
    startY: clamp(Math.floor(b.top / TILE), 0, getWorldRows() - 1),
    endY: clamp(Math.ceil(b.bottom / TILE), 0, getWorldRows() - 1)
  };
}

function isWorldPointInView(px, py, margin = TILE * 3) {
  const b = visibleWorldBounds(margin);
  return px >= b.left && px <= b.right && py >= b.top && py <= b.bottom;
}

function draw() {
  resizeGameCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#070b11';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
  ctx.scale(viewTransform.scale, viewTransform.scale);

  const bounds = visibleTileBounds(2);
  for (let y = bounds.startY; y <= bounds.endY; y++) {
    const row = state.terrain[y];
    if (!row) continue;
    for (let x = bounds.startX; x <= bounds.endX; x++) drawTile(x, y, row[x] || 'grass');
  }

  if (showDebugGrid || settings?.showGrid) drawGrid(bounds);

  const renderList = rendererScratch.renderList;
  renderList.length = 0;

  const objects = state.objects || [];
  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    if (!isTileDiscovered(obj.x, obj.y)) continue;
    const cx = obj.x * TILE + TILE / 2;
    const cy = obj.y * TILE + TILE / 2;
    if (isWorldPointInView(cx, cy)) renderList.push({ kind: 'obj', y: obj.y, data: obj });
  }

  const wolves = state.wolves || [];
  for (let i = 0; i < wolves.length; i++) {
    const wolf = wolves[i];
    if (isWorldPointInView(wolf.px, wolf.py)) renderList.push({ kind: 'wolf', y: (wolf.py / TILE), data: wolf });
  }

  const colonists = state.colonists || [];
  for (let i = 0; i < colonists.length; i++) {
    const c = colonists[i];
    if (isWorldPointInView(c.px, c.py)) renderList.push({ kind: 'colonist', y: (c.py / TILE), data: c });
  }

  renderList.sort((a, b) => a.y - b.y);

  for (let i = 0; i < renderList.length; i++) {
    const item = renderList[i];
    if (item.kind === 'obj') drawObject(item.data);
    else if (item.kind === 'wolf') drawWolf(item.data);
    else if (item.kind === 'colonist') drawColonist(item.data);
  }

  drawPoiMarkers();
  drawBuildPreview();
  drawGatherSelection();
  drawNightOverlay();
  window.GameSystems?.drawWorldOverlays(bounds);
  drawFogOfWar(bounds);
  drawRain();
  ctx.restore();
  window.GameSystems?.drawRegisteredOverlays();
}

const TERRAIN_BASE_COLORS = Object.freeze({
  grass: '#586d2d',
  dirt: '#7a5738',
  sand: '#aa914f',
  stone: '#626966',
  water: '#1f6f88'
});
const TILE_OVERDRAW = 2.0;
const TILE_BLEND_WIDTH = 14;
const TILE_SOURCE_CROP_RATIO = 0.055;
const EDGE_FEATHER_WIDTH = 4;

function terrainBaseColor(type) {
  return TERRAIN_BASE_COLORS[type] || TERRAIN_BASE_COLORS.grass;
}

function terrainAtTile(x, y) {
  return state?.terrain?.[y]?.[x] || null;
}

function rgbaFromHex(hex, alpha) {
  const value = String(hex || '').replace('#', '');
  if (value.length !== 6) return `rgba(88, 109, 45, ${alpha})`;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawTerrainGroundFill(x, y, type) {
  ctx.fillStyle = terrainBaseColor(type);
  ctx.fillRect(
    x * TILE - TILE_OVERDRAW,
    y * TILE - TILE_OVERDRAW,
    TILE + TILE_OVERDRAW * 2,
    TILE + TILE_OVERDRAW * 2
  );
}

function drawTerrainTexture(img, x, y) {
  if (!img) return;

  const sw = img.naturalWidth || img.width || TILE;
  const sh = img.naturalHeight || img.height || TILE;
  const crop = Math.max(0, Math.min(14, Math.floor(Math.min(sw, sh) * TILE_SOURCE_CROP_RATIO)));
  const sx = crop;
  const sy = crop;
  const sWidth = Math.max(1, sw - crop * 2);
  const sHeight = Math.max(1, sh - crop * 2);

  ctx.drawImage(
    img,
    sx,
    sy,
    sWidth,
    sHeight,
    x * TILE - TILE_OVERDRAW,
    y * TILE - TILE_OVERDRAW,
    TILE + TILE_OVERDRAW * 2,
    TILE + TILE_OVERDRAW * 2
  );

  const type = state?.terrain?.[y]?.[x];
  if (!type) return;
  const color = terrainBaseColor(type);
  const px = x * TILE;
  const py = y * TILE;
  const fw = EDGE_FEATHER_WIDTH;
  let g;

  g = ctx.createLinearGradient(px, py, px, py + fw);
  g.addColorStop(0, rgbaFromHex(color, 0.45));
  g.addColorStop(1, rgbaFromHex(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(px - TILE_OVERDRAW, py - TILE_OVERDRAW, TILE + TILE_OVERDRAW * 2, fw);

  g = ctx.createLinearGradient(px, py + TILE, px, py + TILE - fw);
  g.addColorStop(0, rgbaFromHex(color, 0.45));
  g.addColorStop(1, rgbaFromHex(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(px - TILE_OVERDRAW, py + TILE - fw, TILE + TILE_OVERDRAW * 2, fw);

  g = ctx.createLinearGradient(px, py, px + fw, py);
  g.addColorStop(0, rgbaFromHex(color, 0.45));
  g.addColorStop(1, rgbaFromHex(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(px - TILE_OVERDRAW, py - TILE_OVERDRAW, fw, TILE + TILE_OVERDRAW * 2);

  g = ctx.createLinearGradient(px + TILE, py, px + TILE - fw, py);
  g.addColorStop(0, rgbaFromHex(color, 0.45));
  g.addColorStop(1, rgbaFromHex(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(px + TILE - fw, py - TILE_OVERDRAW, fw, TILE + TILE_OVERDRAW * 2);
}

function drawTerrainBlendStrip(x, y, side, neighborType) {
  if (!neighborType) return;

  const px = x * TILE;
  const py = y * TILE;
  const w = TILE_BLEND_WIDTH;
  const color = terrainBaseColor(neighborType);
  let gradient;

  if (side === 'left') {
    gradient = ctx.createLinearGradient(px, 0, px + w, 0);
    gradient.addColorStop(0, rgbaFromHex(color, 0.72));
    gradient.addColorStop(0.6, rgbaFromHex(color, 0.28));
    gradient.addColorStop(1, rgbaFromHex(color, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(px - 0.5, py - TILE_OVERDRAW, w, TILE + TILE_OVERDRAW * 2);
  } else if (side === 'right') {
    gradient = ctx.createLinearGradient(px + TILE, 0, px + TILE - w, 0);
    gradient.addColorStop(0, rgbaFromHex(color, 0.72));
    gradient.addColorStop(0.6, rgbaFromHex(color, 0.28));
    gradient.addColorStop(1, rgbaFromHex(color, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(px + TILE - w + 0.5, py - TILE_OVERDRAW, w, TILE + TILE_OVERDRAW * 2);
  } else if (side === 'top') {
    gradient = ctx.createLinearGradient(0, py, 0, py + w);
    gradient.addColorStop(0, rgbaFromHex(color, 0.72));
    gradient.addColorStop(0.6, rgbaFromHex(color, 0.28));
    gradient.addColorStop(1, rgbaFromHex(color, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(px - TILE_OVERDRAW, py - 0.5, TILE + TILE_OVERDRAW * 2, w);
  } else if (side === 'bottom') {
    gradient = ctx.createLinearGradient(0, py + TILE, 0, py + TILE - w, 0);
    gradient.addColorStop(0, rgbaFromHex(color, 0.72));
    gradient.addColorStop(0.6, rgbaFromHex(color, 0.28));
    gradient.addColorStop(1, rgbaFromHex(color, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(px - TILE_OVERDRAW, py + TILE - w + 0.5, TILE + TILE_OVERDRAW * 2, w);
  }
}

function drawTerrainBlends(x, y, type) {
  const left = terrainAtTile(x - 1, y);
  const right = terrainAtTile(x + 1, y);
  const top = terrainAtTile(x, y - 1);
  const bottom = terrainAtTile(x, y + 1);

  if (left && left !== type) drawTerrainBlendStrip(x, y, 'left', left);
  if (right && right !== type) drawTerrainBlendStrip(x, y, 'right', right);
  if (top && top !== type) drawTerrainBlendStrip(x, y, 'top', top);
  if (bottom && bottom !== type) drawTerrainBlendStrip(x, y, 'bottom', bottom);

  const tl = terrainAtTile(x - 1, y - 1);
  const tr = terrainAtTile(x + 1, y - 1);
  const bl = terrainAtTile(x - 1, y + 1);
  const br = terrainAtTile(x + 1, y + 1);
  if (tl && tl !== type && tl !== left && tl !== top) drawTerrainBlendCorner(x, y, 'tl', tl);
  if (tr && tr !== type && tr !== right && tr !== top) drawTerrainBlendCorner(x, y, 'tr', tr);
  if (bl && bl !== type && bl !== left && bl !== bottom) drawTerrainBlendCorner(x, y, 'bl', bl);
  if (br && br !== type && br !== right && br !== bottom) drawTerrainBlendCorner(x, y, 'br', br);
}

function drawTerrainBlendCorner(x, y, corner, neighborType) {
  if (!neighborType) return;
  const px = x * TILE;
  const py = y * TILE;
  const r = TILE_BLEND_WIDTH * 1.2;
  const color = terrainBaseColor(neighborType);
  let cx, cy;
  if (corner === 'tl') { cx = px; cy = py; }
  else if (corner === 'tr') { cx = px + TILE; cy = py; }
  else if (corner === 'bl') { cx = px; cy = py + TILE; }
  else { cx = px + TILE; cy = py + TILE; }
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, rgbaFromHex(color, 0.6));
  grad.addColorStop(0.5, rgbaFromHex(color, 0.22));
  grad.addColorStop(1, rgbaFromHex(color, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

function drawTile(x, y, type) {
  const img = images[`tile_${type}`] || (type === 'water' ? null : images.tile_grass);
  drawTerrainGroundFill(x, y, type);
  drawTerrainTexture(img, x, y);
  drawTerrainBlends(x, y, type);
  window.GameSystems?.drawTileRenderers(x, y, type);
}

function drawGrid(bounds = visibleTileBounds(2)) {
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,.13)';
  ctx.lineWidth = 1;
  for (let x = bounds.startX; x <= bounds.endX + 1; x++) {
    ctx.beginPath(); ctx.moveTo(x * TILE, bounds.startY * TILE); ctx.lineTo(x * TILE, (bounds.endY + 1) * TILE); ctx.stroke();
  }
  for (let y = bounds.startY; y <= bounds.endY + 1; y++) {
    ctx.beginPath(); ctx.moveTo(bounds.startX * TILE, y * TILE); ctx.lineTo((bounds.endX + 1) * TILE, y * TILE); ctx.stroke();
  }
  ctx.restore();
}

function objectRotationTurns(obj, type) {
  if (type !== 'wall' && type !== 'door') return 0;
  return ((Number(obj?.rotation) || 0) % 4 + 4) % 4;
}

function drawObject(obj) {
  if (window.GameSystems?.drawObject(obj)) return;
  const cx = obj.x * TILE + TILE / 2;
  const cy = obj.y * TILE + TILE / 2;
  if (obj.type === 'blueprint') {
    const type = buildDefs[obj.buildType].type;
    const img = images[objectDefs[type].img];
    ctx.save();
    ctx.globalAlpha = 0.42;
    if (!window.HavenfallWorkstationRenderer?.drawObject?.({ ...obj, type })) {
      drawAsset(img, cx, (obj.y + 1) * TILE, objectScale(type, img), 0.5, 1, false, objectRotationTurns(obj, type));
    }
    ctx.restore();
    drawProgress(cx, obj.y * TILE + 8, (obj.progress || 0) / buildDefs[obj.buildType].work, '#9bd36a');
    return;
  }

  const def = objectDefs[obj.type];
  if (!def) return;
  const _img = images[def.img];
  const animation = typeof vfxAnimation === 'function' ? (vfxAnimation(obj.type) || vfxAnimation(def.img)) : null;
  if (animation && images[`vfx:${animation.key}`]) {
    drawAnimatedAsset(animation, cx, (obj.y + 1) * TILE, objectScaleFromHeight(obj.type, animation.frameHeight), 0.5, 1, objectRotationTurns(obj, obj.type));
  } else {
    drawAsset(_img, cx, (obj.y + 1) * TILE, objectScale(obj.type, _img), 0.5, 1, false, objectRotationTurns(obj, obj.type));
  }
  if (obj.type === 'crop') {
    drawProgress(cx, obj.y * TILE + 7, (obj.growth || 0) / 100, '#80c96c');
  }
  if (obj.markedForGather) drawMarkedForGather(cx, cy);
  if (def.interactable) drawInteractionHint(obj, cx, cy);
}

function drawMarkedForGather(cx, cy) {
  ctx.save();
  ctx.strokeStyle = '#f4b350';
  ctx.fillStyle = 'rgba(244, 179, 80, .16)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 17, 19, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f8d78a';
  ctx.font = '900 12px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('coleta', cx, cy - 29);
  ctx.restore();
}

function drawInteractionHint(obj, cx, cy) {
  const unknown = obj.unknown !== false && (!obj.inspected || !obj.looted);
  const mark = unknown ? '?' : obj.looted ? '✓' : '⋯';
  ctx.save();
  ctx.fillStyle = unknown ? 'rgba(227, 169, 63, .30)' : 'rgba(121, 199, 232, .22)';
  ctx.strokeStyle = unknown ? '#f4c46b' : '#79c7e8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy - 17, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = unknown ? '#fff0c5' : '#dff5ff';
  ctx.font = '900 15px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(mark, cx, cy - 17);
  ctx.restore();
}

const OBJECT_TARGET_H = {
  tree: TILE * 2.0,  bush: TILE * 1.4,  rock: TILE * 1.2,  ore: TILE * 1.0,
  logs: TILE * 0.9,  berry: TILE * 1.4,  crop: TILE * 0.7,
  bed: TILE * 1.2,   campfire: TILE * 1.2, forge: TILE * 1.1,
  stove: TILE * 1.0, med_station: TILE * 1.0, research_desk: TILE * 1.0,
  crate: TILE * 1.1, ruin: TILE * 1.0,  cache: TILE * 1.1,
  supply_crate: TILE * 1.1, wall: TILE * 1.5, door: TILE * 1.35, bench: TILE * 1.0, stool: TILE * 1.0,
  sewing_table: TILE * 1.0, smokehouse: TILE * 1.0
};

const OBJECT_TARGET_W = {
  bench: TILE * 0.90,
  sewing_table: TILE * 0.95,
  smokehouse: TILE * 0.95
};

function objectScale(type, img) {
  const imgH = img?.naturalHeight || img?.height || 0;
  const imgW = img?.naturalWidth || img?.width || 0;
  if (imgH > 0) return objectScaleForBounds(type, imgW, imgH);
  return ({ tree:0.54, bush:0.42, rock:0.38, ore:0.34, logs:0.35, berry:0.42, crop:0.22, bed:0.28, campfire:0.30, forge:0.22, stove:0.24, med_station:0.24, research_desk:0.22, crate:0.34, ruin:0.30, cache:0.32, supply_crate:0.32, wall:0.29, door:0.31, bench:0.20, stool:0.45 })[type] || 0.35;
}

function objectScaleForBounds(type, imgW, imgH) {
  const heightScale = objectScaleFromHeight(type, imgH);
  const targetW = OBJECT_TARGET_W[type];
  if (!targetW || !imgW) return heightScale;
  return Math.min(heightScale, targetW / imgW);
}

function objectScaleFromHeight(type, imgH) {
  const targetH = OBJECT_TARGET_H[type] || TILE;
  return imgH > 0 ? targetH / imgH : 1;
}

function drawAsset(img, x, y, scale = 1, ax = 0.5, ay = 0.5, flip = false, rotationTurns = 0) {
  if (!img) return;
  const w = img.width * scale;
  const h = img.height * scale;
  const rotation = ((Number(rotationTurns) || 0) % 4 + 4) % 4;
  ctx.save();
  if (rotation || flip) {
    ctx.translate(x, y);
    if (rotation) ctx.rotate(rotation * Math.PI / 2);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -w * ax, -h * ay, w, h);
  } else {
    ctx.drawImage(img, x - w * ax, y - h * ay, w, h);
  }
  ctx.restore();
}

function drawAnimatedAsset(animation, x, y, scale = 1, ax = 0.5, ay = 0.5, rotationTurns = 0) {
  const img = images[`vfx:${animation.key}`];
  if (!img || !animation.frames || !animation.frameWidth || !animation.frameHeight) return;
  const frameMs = animation.frameDelaysMs?.length ? animation.frameDelaysMs[0] : 120;
  const frame = Math.floor(performance.now() / Math.max(40, frameMs)) % animation.frames;
  const sx = frame * animation.frameWidth;
  const sw = animation.frameWidth;
  const sh = animation.frameHeight;
  const w = sw * scale;
  const h = sh * scale;
  const rotation = ((Number(rotationTurns) || 0) % 4 + 4) % 4;

  ctx.save();
  if (rotation) {
    ctx.translate(x, y);
    ctx.rotate(rotation * Math.PI / 2);
    ctx.drawImage(img, sx, 0, sw, sh, -w * ax, -h * ay, w, h);
  } else {
    ctx.drawImage(img, sx, 0, sw, sh, x - w * ax, y - h * ay, w, h);
  }
  ctx.restore();
}


function drawColonist(c) {
  const selected = c.id === selectedColonistId;
  if (selected) {
    ctx.save();
    ctx.fillStyle = 'rgba(155, 211, 106, .28)';
    ctx.strokeStyle = '#9bd36a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(c.px, c.py + 19, 18, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  const moving = c.path && c.path.length;
  const frame = moving ? Math.floor(c.anim * 8) % 4 : 0;
  let dir = c.dir;
  let flip = false;
  if ((c.sprite === 'colonistB' || c.sprite === 'colonistC') && dir === 'left') { dir = 'right'; flip = true; }
  const img = images[`${c.sprite}_${dir}_${frame}`] || images[`${c.sprite}_down_0`];
  drawAsset(img, c.px, c.py + 24, 0.48, 0.5, 1, flip);
  drawEquipmentBadge(c);

  drawTinyBars(c);
  drawName(c.name, c.px, c.py - 38);
}

function drawEquipmentBadge(c) {
  ensureEquipment(c);
  const key = c.equipment.weapon || c.equipment.tool || c.equipment.offhand;
  const item = itemDefs[key];
  if (!item?.icon || !images[item.icon]) return;
  ctx.save();
  ctx.fillStyle = 'rgba(7, 11, 17, .72)';
  ctx.strokeStyle = '#d6a24a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(c.px + 19, c.py - 17, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawAsset(images[item.icon], c.px + 19, c.py - 17, 0.095, 0.5, 0.5);
  ctx.restore();
}

function drawTinyBars(c) {
  const x = c.px - 18;
  const y = c.py - 31;
  ctx.fillStyle = 'rgba(0,0,0,.6)';
  ctx.fillRect(x, y, 36, 4);
  ctx.fillStyle = c.health < 35 ? '#e67866' : '#9bd36a';
  ctx.fillRect(x, y, 36 * (c.health / 100), 4);
}

function drawName(name, x, y) {
  ctx.save();
  ctx.font = 'bold 12px system-ui';
  ctx.textAlign = 'center';
  const w = ctx.measureText(name).width + 10;
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  roundRect(x - w / 2, y - 13, w, 18, 8, true, false);
  ctx.fillStyle = '#f2fff0';
  ctx.fillText(name, x, y);
  ctx.restore();
}

function drawWolf(w) {
  ctx.save();
  ctx.fillStyle = 'rgba(230, 120, 102, .22)';
  ctx.strokeStyle = '#e67866';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(w.px, w.py + 16, 25, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
  const frame = Math.floor(w.anim * 6) % 5;
  drawAsset(images[`wolf_${frame}`], w.px, w.py + 20, 0.36, 0.5, 1, w.dir === 'left');
  if (w.hp !== undefined) drawProgress(w.px, w.py - 23, (w.hp || 0) / 100, '#e67866');
}

function drawProgress(cx, y, value, color) {
  value = clamp(value, 0, 1);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(cx - 18, y, 36, 5);
  ctx.fillStyle = color;
  ctx.fillRect(cx - 18, y, 36 * value, 5);
  ctx.restore();
}

function drawNightOverlay() {
  if (window.LightingSystem) return;
  const hour = state.hour;
  let alpha = 0;
  if (hour < 5) alpha = 0.45;
  else if (hour < 7) alpha = (7 - hour) * 0.18;
  else if (hour > 20) alpha = Math.min(0.45, (hour - 20) * 0.13);
  if (alpha > 0) {
    const b = visibleWorldBounds(TILE);
    ctx.fillStyle = `rgba(7, 17, 31, ${alpha})`;
    ctx.fillRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
  }
}

function drawRain() {
  if (state.weather !== 'chuva') return;
  ctx.save();
  ctx.strokeStyle = 'rgba(170, 210, 255, .45)';
  ctx.lineWidth = 1;
  const b = visibleWorldBounds(TILE * 2);
  const offset = (performance.now() / 14) % 18;
  for (let x = b.left - 20; x < b.right + 30; x += 38) {
    for (let y = b.top - 20; y < b.bottom + 30; y += 62) {
      ctx.beginPath();
      ctx.moveTo(x + offset, y + offset);
      ctx.lineTo(x + offset - 10, y + offset + 18);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawFogOfWar(bounds = visibleTileBounds(1)) {
  if (!state?.world?.exploration) return;
  ctx.save();
  for (let y = bounds.startY; y <= bounds.endY; y++) {
    for (let x = bounds.startX; x <= bounds.endX; x++) {
      const v = state.world.exploration[y]?.[x] || 0;
      if (v === 2) continue;
      ctx.fillStyle = v === 1 ? 'rgba(4, 8, 13, .42)' : 'rgba(2, 4, 8, .88)';
      ctx.fillRect(x * TILE, y * TILE, TILE + 1, TILE + 1);
    }
  }
  ctx.restore();
}

function drawPoiMarkers() {
  if (!state?.world?.pointsOfInterest) return;
  ctx.save();
  for (const poi of state.world.pointsOfInterest) {
    if (!poi.discovered || poi.inspected || !isTileDiscovered(poi.x, poi.y)) continue;
    if (getObjectAt(poi.x, poi.y)) continue;
    const x = poi.x * TILE + TILE / 2;
    const y = poi.y * TILE + TILE / 2;
    if (!isWorldPointInView(x, y)) continue;
    ctx.fillStyle = 'rgba(244, 179, 80, .22)';
    ctx.strokeStyle = '#f4b350';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y - 7, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f8d78a';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('?', x, y - 2);
  }
  ctx.restore();
}

function drawGatherSelection() {
  if (!gatherSelection?.active || !gatherSelection.start || !gatherSelection.current) return;
  const minX = Math.min(gatherSelection.start.x, gatherSelection.current.x);
  const minY = Math.min(gatherSelection.start.y, gatherSelection.current.y);
  const maxX = Math.max(gatherSelection.start.x, gatherSelection.current.x);
  const maxY = Math.max(gatherSelection.start.y, gatherSelection.current.y);
  ctx.save();
  ctx.fillStyle = 'rgba(244, 179, 80, .12)';
  ctx.strokeStyle = '#f4b350';
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 5]);
  ctx.strokeRect(minX * TILE, minY * TILE, (maxX - minX + 1) * TILE, (maxY - minY + 1) * TILE);
  ctx.fillRect(minX * TILE, minY * TILE, (maxX - minX + 1) * TILE, (maxY - minY + 1) * TILE);
  ctx.restore();
}

function drawBuildPreview() {
  if (!currentBuild || !mouseTile) return;
  const def = buildDefs?.[currentBuild];
  if (!def) return;
  const type = def.type;
  const canAfford = (!def.cost || hasCost(def.cost)) && (!def.itemCost || hasItems(def.itemCost));
  const canPlaceTile = type === 'floor'
    ? (
      typeof canPlaceBuild === 'function'
        ? canPlaceBuild(currentBuild, mouseTile.x, mouseTile.y)
        : window.FloorSystem?.canPlaceFloor?.(mouseTile.x, mouseTile.y, def.floorType)
    )
    : (
      typeof canPlaceBuild === 'function'
        ? canPlaceBuild(currentBuild, mouseTile.x, mouseTile.y)
        : canPlace(type, mouseTile.x, mouseTile.y)
    );
  const can = !!canPlaceTile && canAfford;
  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = can ? 'rgba(155, 211, 106, .22)' : 'rgba(230, 120, 102, .28)';
  ctx.fillRect(mouseTile.x * TILE, mouseTile.y * TILE, TILE, TILE);
  if (type === 'floor') {
    ctx.save();
    ctx.globalAlpha = can ? 0.54 : 0.3;
    window.FloorSystem?.drawFloorTile?.(ctx, mouseTile.x, mouseTile.y, def.floorType);
    ctx.restore();
    ctx.strokeStyle = can ? 'rgba(155, 211, 106, .82)' : 'rgba(230, 120, 102, .9)';
    ctx.lineWidth = 2;
    ctx.setLineDash(can ? [] : [6, 4]);
    ctx.strokeRect(mouseTile.x * TILE + 1.5, mouseTile.y * TILE + 1.5, TILE - 3, TILE - 3);
    ctx.restore();
    return;
  }
  const objectDef = objectDefs?.[type];
  const img = objectDef?.img ? images[objectDef.img] : null;
  const rotation = (type === 'wall' || type === 'door') && typeof currentBuildRotation !== 'undefined' ? currentBuildRotation : 0;
  if (!window.HavenfallWorkstationRenderer?.drawObject?.({ type, x: mouseTile.x, y: mouseTile.y }) && img) {
    drawAsset(img, mouseTile.x * TILE + TILE / 2, (mouseTile.y + 1) * TILE, objectScale(type, img), 0.5, 1, false, rotation);
  }
  if (rotation) {
    ctx.fillStyle = 'rgba(0,0,0,.62)';
    ctx.fillRect(mouseTile.x * TILE + 5, mouseTile.y * TILE + 5, 34, 16);
    ctx.fillStyle = '#ffe2a3';
    ctx.font = '900 10px system-ui';
    ctx.fillText(`R ${rotation * 90}°`, mouseTile.x * TILE + 9, mouseTile.y * TILE + 17);
  }
  ctx.restore();
}
