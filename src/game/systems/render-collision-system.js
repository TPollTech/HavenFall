'use strict';

(() => {
  const CollisionType = Object.freeze({ WALKABLE: 0, BLOCK_PATH: 1, DOOR_OPEN: 2, DOOR_CLOSED: 3, MOUNTAIN: 4, WALL: 5 });
  const MASK = Object.freeze({ N: 1, E: 2, S: 4, W: 8 });
  const MOUNTAIN_COLORS = Object.freeze({ granite: '#4b5563', sandstone: '#a16207', slate: '#334155', iron: '#7f1d1d' });
  let installed = false;

  function tileSize() { return typeof getTileSize === 'function' ? getTileSize() : TILE; }
  function inBounds(x, y) { return typeof isInside === 'function' ? isInside(x, y) : x >= 0 && y >= 0 && x < getWorldCols() && y < getWorldRows(); }
  function objAt(x, y) { return typeof getObjectAt === 'function' ? getObjectAt(x, y) : null; }
  function rockAt(x, y) { return typeof getRockAt === 'function' ? getRockAt(x, y) : null; }
  function isRock(x, y) { return !!rockAt(x, y)?.solid || !!(typeof isMountainBlocked === 'function' && isMountainBlocked(x, y)); }
  function isDoor(obj) { return obj?.type === 'door' || (obj?.type === 'blueprint' && buildDefs?.[obj.buildType]?.type === 'door'); }
  function isWall(obj) { return obj?.type === 'wall' || (obj?.type === 'blueprint' && buildDefs?.[obj.buildType]?.type === 'wall'); }
  function isStructure(obj) { return isWall(obj) || isDoor(obj); }
  function isClosedDoor(obj) { return obj?.type === 'door' && (obj.state || window.DoorState?.CLOSED || 'closed') !== (window.DoorState?.OPEN || 'open'); }

  function wallMask(x, y) {
    let mask = 0;
    if (isStructure(objAt(x, y - 1))) mask |= MASK.N;
    if (isStructure(objAt(x + 1, y))) mask |= MASK.E;
    if (isStructure(objAt(x, y + 1))) mask |= MASK.S;
    if (isStructure(objAt(x - 1, y))) mask |= MASK.W;
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
    ctx.fillStyle = MOUNTAIN_COLORS[rock.type] || '#4b5563';
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
    if (!(m & MASK.S)) { ctx.globalAlpha = 0.34; ctx.fillRect(px + 1, py + t - 7, t - 2, 9); }
    if (!(m & MASK.E)) { ctx.globalAlpha = 0.18; ctx.fillRect(px + t - 7, py + 5, 8, t - 10); }
    ctx.restore();
  }

  function drawTileLayer(x, y) { if (isRock(x, y)) drawMountainTile(x, y); }

  function drawGrid(bounds = null) {
    if (!state || appScreen !== SCREEN.PLAYING) return;
    if (!showDebugGrid && !settings?.showGrid && !currentBuild) return;
    const b = bounds || (typeof visibleTileBounds === 'function' ? visibleTileBounds(1) : { startX: 0, startY: 0, endX: getWorldCols() - 1, endY: getWorldRows() - 1 });
    const t = tileSize();
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.lineWidth = Math.max(0.5, 1 / Math.max(1, viewTransform.scale || 1));
    for (let x = b.startX; x <= b.endX + 1; x++) { ctx.beginPath(); ctx.moveTo(x * t + 0.5, b.startY * t); ctx.lineTo(x * t + 0.5, (b.endY + 1) * t); ctx.stroke(); }
    for (let y = b.startY; y <= b.endY + 1; y++) { ctx.beginPath(); ctx.moveTo(b.startX * t, y * t + 0.5); ctx.lineTo((b.endX + 1) * t, y * t + 0.5); ctx.stroke(); }
    ctx.restore();
  }

  function isShadowCaster(x, y) {
    if (isRock(x, y)) return true;
    const obj = objAt(x, y);
    if (isWall(obj) || isClosedDoor(obj)) return true;
    return !!obj?.shadowCaster;
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

  function isBlockedForPath(x, y, target = null) {
    const c = collisionAt(x, y, target);
    return c === CollisionType.BLOCK_PATH || c === CollisionType.MOUNTAIN || c === CollisionType.WALL || c === CollisionType.DOOR_CLOSED;
  }

  function install() {
    if (installed) return;
    if (!window.HavenfallContext?.gameBooted || !window.GameSystems) { setTimeout(install, 120); return; }
    installed = true;
    window.GameSystems.registerTileRenderer?.('terrain.mountains', drawTileLayer, { order: 20 });
    window.GameSystems.registerWorldOverlay?.('grid.overlay', drawGrid, { order: 95 });
    window.GameSystems.registerCollisionProvider?.('terrain-structures.collision', collisionAt, { order: 10 });
    window.CollisionType = CollisionType;
    window.collisionAt = collisionAt;
    window.isBlockedForPath = isBlockedForPath;
    window.isShadowCaster = isShadowCaster;
    window.wallBitmaskAt = wallMask;
    window.rockBitmaskAt = rockMask;
    window.HavenfallRenderCollisionSystem = 'terrain-structures-collision-fast';
    console.info('[Render Collision System] Terreno, colisão e grid carregados em modo rápido.');
  }

  install();
})();
