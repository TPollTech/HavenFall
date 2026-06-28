'use strict';

(() => {
  const CollisionType = Object.freeze({
    WALKABLE: 0,
    BLOCK_PATH: 1,
    DOOR_OPEN: 2,
    DOOR_CLOSED: 3,
    MOUNTAIN: 4,
    WALL: 5
  });

  const MASK = Object.freeze({ N: 1, E: 2, S: 4, W: 8 });
  const MOUNTAIN_COLORS = Object.freeze({ granite: '#4b5563', sandstone: '#a16207', slate: '#334155', iron: '#7f1d1d' });

  let installed = false;
  let originalDraw = null;
  let originalDrawTile = null;
  let originalDrawObject = null;
  let originalIsBlocked = null;

  function tileSize() { return typeof getTileSize === 'function' ? getTileSize() : TILE; }
  function inBounds(x, y) { return typeof isInside === 'function' ? isInside(x, y) : x >= 0 && y >= 0 && x < getWorldCols() && y < getWorldRows(); }
  function objAt(x, y) { return typeof getObjectAt === 'function' ? getObjectAt(x, y) : null; }
  function isRock(x, y) { return !!(typeof getRockAt === 'function' ? getRockAt(x, y) : null)?.solid || !!(typeof isMountainBlocked === 'function' && isMountainBlocked(x, y)); }
  function rockAt(x, y) { return typeof getRockAt === 'function' ? getRockAt(x, y) : null; }
  function isDoorObj(obj) { return obj?.type === 'door' || (obj?.type === 'blueprint' && buildDefs?.[obj.buildType]?.type === 'door'); }
  function isWallObj(obj) { return obj?.type === 'wall' || (obj?.type === 'blueprint' && buildDefs?.[obj.buildType]?.type === 'wall'); }
  function isStructureObj(obj) { return isWallObj(obj) || isDoorObj(obj); }
  function isClosedDoor(obj) { return obj?.type === 'door' && (obj.state || window.DoorState?.CLOSED || 'closed') !== (window.DoorState?.OPEN || 'open'); }
  function materialForWall(obj) { return obj?.wallMaterial || buildDefs?.[obj?.buildType]?.wallMaterial || 'wood'; }

  function neighborStructure(x, y) {
    const obj = objAt(x, y);
    return isStructureObj(obj) ? obj : null;
  }

  function wallMask(x, y) {
    let mask = 0;
    if (neighborStructure(x, y - 1)) mask |= MASK.N;
    if (neighborStructure(x + 1, y)) mask |= MASK.E;
    if (neighborStructure(x, y + 1)) mask |= MASK.S;
    if (neighborStructure(x - 1, y)) mask |= MASK.W;
    return mask;
  }

  function rockMask(x, y) {
    let mask = 0;
    if (isRock(x, y - 1)) mask |= MASK.N;
    if (isRock(x + 1, y)) mask |= MASK.E;
    if (isRock(x, y + 1)) mask |= MASK.S;
    if (isRock(x - 1, y)) mask |= MASK.W;
    return mask;
  }

  function doorMaterial(obj) {
    if (obj?.wallMaterial) return obj.wallMaterial;
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (const [dx, dy] of dirs) {
      const n = objAt(obj.x + dx, obj.y + dy);
      if (isWallObj(n)) return materialForWall(n);
    }
    return 'wood';
  }

  function wallPalette(material) {
    const cfg = window.WallConfig?.[material] || window.WallConfig?.wood || {};
    return {
      fill: cfg.fill || '#8a5a36',
      stroke: cfg.stroke || '#4f2f1d',
      highlight: cfg.highlight || 'rgba(255,226,174,.28)'
    };
  }

  function rect(x, y, w, h, r = 3) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.fill();
    ctx.stroke();
  }

  function drawAutoWall(obj, alpha = 1) {
    const t = tileSize();
    const x = obj.x * t;
    const y = obj.y * t;
    const cx = x + t / 2;
    const cy = y + t / 2;
    const m = wallMask(obj.x, obj.y);
    const pal = wallPalette(materialForWall(obj));
    const thickness = Math.max(11, Math.round(t * 0.24));
    const half = thickness / 2;

    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = pal.fill;
    ctx.strokeStyle = pal.stroke;
    ctx.lineWidth = 2;

    if (!m) {
      const horizontal = (Number(obj.rotation || 0) % 2) === 0;
      if (horizontal) rect(x + t * 0.16, cy - half, t * 0.68, thickness, 4);
      else rect(cx - half, y + t * 0.16, thickness, t * 0.68, 4);
    } else {
      if (m & MASK.N) rect(cx - half, y + 2, thickness, t / 2 + half, 3);
      if (m & MASK.S) rect(cx - half, cy - half, thickness, t / 2 + half - 2, 3);
      if (m & MASK.W) rect(x + 2, cy - half, t / 2 + half, thickness, 3);
      if (m & MASK.E) rect(cx - half, cy - half, t / 2 + half - 2, thickness, 3);
      rect(cx - half, cy - half, thickness, thickness, 4);
    }

    ctx.fillStyle = pal.highlight;
    ctx.fillRect(x + 8, y + 8, t - 16, 2);
    ctx.restore();
  }

  function doorOrientation(obj) {
    const m = wallMask(obj.x, obj.y);
    if ((m & MASK.W) || (m & MASK.E)) return 'horizontal';
    if ((m & MASK.N) || (m & MASK.S)) return 'vertical';
    return (Number(obj.rotation || 0) % 2) === 0 ? 'horizontal' : 'vertical';
  }

  function drawAutoDoor(obj, alpha = 1) {
    const openState = window.DoorState?.OPEN || 'open';
    const open = (obj.state || window.DoorState?.CLOSED || 'closed') === openState;
    const t = tileSize();
    const x = obj.x * t;
    const y = obj.y * t;
    const cx = x + t / 2;
    const cy = y + t / 2;
    const pal = wallPalette(doorMaterial(obj));
    const horizontal = doorOrientation(obj) === 'horizontal';
    const thickness = Math.max(9, Math.round(t * 0.20));
    const half = thickness / 2;

    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.lineWidth = 2;
    ctx.fillStyle = pal.fill;
    ctx.strokeStyle = pal.stroke;

    if (!open) {
      if (horizontal) rect(x + t * 0.14, cy - half, t * 0.72, thickness, 4);
      else rect(cx - half, y + t * 0.14, thickness, t * 0.72, 4);
      ctx.fillStyle = '#ffe2a3';
      ctx.beginPath();
      ctx.arc(horizontal ? x + t * 0.66 : cx + 3, horizontal ? cy - 1 : y + t * 0.66, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(255,226,163,.85)';
      ctx.beginPath();
      ctx.arc(cx, cy, t * 0.34, horizontal ? Math.PI : -Math.PI / 2, horizontal ? Math.PI * 1.5 : 0);
      ctx.stroke();
      ctx.fillStyle = pal.fill;
      ctx.strokeStyle = pal.stroke;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(horizontal ? -Math.PI / 4 : Math.PI / 4);
      if (horizontal) rect(0, -half, t * 0.38, thickness, 4);
      else rect(-half, 0, thickness, t * 0.38, 4);
      ctx.restore();
    }

    ctx.restore();
  }

  function drawStructureObject(obj) {
    const type = obj?.type === 'blueprint' ? buildDefs?.[obj.buildType]?.type : obj?.type;
    if (type === 'wall') { drawAutoWall(obj, obj.type === 'blueprint' ? 0.45 : 1); return true; }
    if (type === 'door') { drawAutoDoor(obj, obj.type === 'blueprint' ? 0.45 : 1); return true; }
    return false;
  }

  function drawObjectRoadmap(obj) {
    if (drawStructureObject(obj)) {
      if (obj.type === 'blueprint') {
        const def = buildDefs?.[obj.buildType];
        if (def && typeof drawProgress === 'function') drawProgress(obj.x * TILE + TILE / 2, obj.y * TILE + 8, (obj.progress || 0) / Math.max(1, def.work || 1), '#9bd36a');
      }
      return;
    }
    originalDrawObject?.(obj);
  }

  function rockColor(rock) { return MOUNTAIN_COLORS[rock?.type] || '#4b5563'; }

  function drawMountainTile(x, y) {
    const rock = rockAt(x, y);
    if (!rock?.solid) return;
    const t = tileSize();
    const px = x * t;
    const py = y * t;
    const m = rockMask(x, y);
    const seed = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    const jitter = n => ((seed >> n) & 7) - 3;

    ctx.save();
    ctx.fillStyle = rockColor(rock);
    ctx.strokeStyle = 'rgba(5,8,12,.72)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + (m & MASK.W ? 0 : 5 + jitter(0)), py + (m & MASK.N ? 0 : 6 + jitter(3)));
    ctx.lineTo(px + t - (m & MASK.E ? 0 : 6 + jitter(6)), py + (m & MASK.N ? 0 : 4 + jitter(9)));
    ctx.lineTo(px + t - (m & MASK.E ? 0 : 4 + jitter(12)), py + t - (m & MASK.S ? 0 : 6 + jitter(15)));
    ctx.lineTo(px + (m & MASK.W ? 0 : 5 + jitter(18)), py + t - (m & MASK.S ? 0 : 5 + jitter(21)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 0.26;
    ctx.fillStyle = '#000';
    ctx.fillRect(px + 3, py + t * 0.62, t - 6, t * 0.30);
    if (!(m & MASK.S)) {
      ctx.globalAlpha = 0.34;
      ctx.fillRect(px + 1, py + t - 7, t - 2, 9);
    }
    if (!(m & MASK.E)) {
      ctx.globalAlpha = 0.18;
      ctx.fillRect(px + t - 7, py + 5, 8, t - 10);
    }
    ctx.restore();
  }

  function drawTileRoadmap(x, y, type) {
    originalDrawTile?.(x, y, type);
    if (isRock(x, y)) drawMountainTile(x, y);
  }

  function drawEngineeringGrid(bounds = null) {
    if (!state || appScreen !== SCREEN.PLAYING) return;
    const b = bounds || (typeof visibleTileBounds === 'function' ? visibleTileBounds(1) : { startX: 0, startY: 0, endX: getWorldCols() - 1, endY: getWorldRows() - 1 });
    const t = tileSize();
    ctx.save();
    ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
    ctx.scale(viewTransform.scale, viewTransform.scale);
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = Math.max(0.5, 1 / Math.max(1, viewTransform.scale || 1));
    for (let x = b.startX; x <= b.endX + 1; x++) {
      ctx.beginPath(); ctx.moveTo(x * t + 0.5, b.startY * t); ctx.lineTo(x * t + 0.5, (b.endY + 1) * t); ctx.stroke();
    }
    for (let y = b.startY; y <= b.endY + 1; y++) {
      ctx.beginPath(); ctx.moveTo(b.startX * t, y * t + 0.5); ctx.lineTo((b.endX + 1) * t, y * t + 0.5); ctx.stroke();
    }
    ctx.restore();
  }

  function drawShadowOcclusion(bounds = null) {
    if (!state || appScreen !== SCREEN.PLAYING) return;
    const campfires = (state.objects || []).filter(o => o.type === 'campfire' && isTileDiscovered?.(o.x, o.y));
    if (!campfires.length) return;
    const b = bounds || (typeof visibleTileBounds === 'function' ? visibleTileBounds(1) : { startX: 0, startY: 0, endX: getWorldCols() - 1, endY: getWorldRows() - 1 });
    const t = tileSize();
    ctx.save();
    ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
    ctx.scale(viewTransform.scale, viewTransform.scale);
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    for (const fire of campfires) {
      for (let y = b.startY; y <= b.endY; y++) {
        for (let x = b.startX; x <= b.endX; x++) {
          if (Math.abs(x - fire.x) + Math.abs(y - fire.y) > 9) continue;
          if (!isShadowCasterBetween(fire.x, fire.y, x, y)) continue;
          ctx.fillRect(x * t, y * t, t, t);
        }
      }
    }
    ctx.restore();
  }

  function isShadowCaster(x, y) {
    if (isRock(x, y)) return true;
    const obj = objAt(x, y);
    if (isWallObj(obj)) return true;
    if (isClosedDoor(obj)) return true;
    return !!obj?.shadowCaster;
  }

  function isShadowCasterBetween(x0, y0, x1, y1) {
    let x = x0, y = y0;
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (!(x === x1 && y === y1)) {
      if (!(x === x0 && y === y0) && isShadowCaster(x, y)) return true;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
    return false;
  }

  function drawRoadmap() {
    originalDraw?.();
    const bounds = typeof visibleTileBounds === 'function' ? visibleTileBounds(1) : null;
    drawShadowOcclusion(bounds);
    drawEngineeringGrid(bounds);
  }

  function collisionAt(x, y, target = null) {
    if (!inBounds(x, y)) return CollisionType.BLOCK_PATH;
    if (target && target.x === x && target.y === y) return CollisionType.WALKABLE;
    if (isRock(x, y)) return CollisionType.MOUNTAIN;
    const obj = objAt(x, y);
    if (obj && obj.type !== 'blueprint') {
      if (obj.type === 'door') return (obj.state || 'closed') === (window.DoorState?.OPEN || 'open') ? CollisionType.DOOR_OPEN : CollisionType.DOOR_CLOSED;
      if (obj.type === 'wall') return CollisionType.WALL;
      if (objectDefs?.[obj.type]?.blocks) return CollisionType.BLOCK_PATH;
    }
    return CollisionType.WALKABLE;
  }

  function isBlockedRoadmap(x, y, target = null) {
    const c = collisionAt(x, y, target);
    return c === CollisionType.BLOCK_PATH || c === CollisionType.MOUNTAIN || c === CollisionType.WALL || c === CollisionType.DOOR_CLOSED;
  }

  function install() {
    if (installed) return;
    if (!window.HavenfallContext?.gameBooted || !window.HavenfallAlphaConstruction || window.HavenfallAlphaConstruction === 'pending') {
      setTimeout(install, 120);
      return;
    }
    installed = true;

    originalDraw = typeof draw === 'function' ? draw : null;
    originalDrawTile = typeof drawTile === 'function' ? drawTile : null;
    originalDrawObject = typeof drawObject === 'function' ? drawObject : null;
    originalIsBlocked = typeof isBlocked === 'function' ? isBlocked : null;

    try { draw = drawRoadmap; } catch (_) {}
    try { drawTile = drawTileRoadmap; } catch (_) {}
    try { drawObject = drawObjectRoadmap; } catch (_) {}
    try { isBlocked = isBlockedRoadmap; } catch (_) {}

    window.CollisionType = CollisionType;
    window.collisionAt = collisionAt;
    window.isShadowCaster = isShadowCaster;
    window.wallBitmaskAt = wallMask;
    window.rockBitmaskAt = rockMask;
    window.HavenfallRenderCollisionSystem = 'alpha-1.1-roadmap';
    console.info('[Alpha Render/Collision] Grid, bitmask, montanhas, colisão e sombra instalados.');
  }

  install();
})();
