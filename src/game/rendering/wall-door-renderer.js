'use strict';

(() => {
  let installed = false;
  let originalDrawObject = null;
  let originalDrawBuildPreview = null;
  const MASK = Object.freeze({ N: 1, E: 2, S: 4, W: 8 });

  function t() { return typeof getTileSize === 'function' ? getTileSize() : TILE; }
  function at(x, y) { return typeof getObjectAt === 'function' ? getObjectAt(x, y) : null; }
  function kind(o) { return o?.type === 'blueprint' ? buildDefs?.[o.buildType]?.type : o?.type; }
  function wall(o) { return kind(o) === 'wall'; }
  function door(o) { return kind(o) === 'door'; }
  function structure(o) { return wall(o) || door(o); }
  function material(o) { return o?.wallMaterial || buildDefs?.[o?.buildType]?.wallMaterial || 'wood'; }
  function matForBuild(key) { return buildDefs?.[key]?.wallMaterial || (key === 'wall_stone' ? 'stone' : key === 'wall_metal' ? 'metal' : 'wood'); }

  function mask(x, y) {
    let m = 0;
    if (structure(at(x, y - 1))) m |= MASK.N;
    if (structure(at(x + 1, y))) m |= MASK.E;
    if (structure(at(x, y + 1))) m |= MASK.S;
    if (structure(at(x - 1, y))) m |= MASK.W;
    return m;
  }

  function pal(mat) {
    if (mat === 'metal') return ['#647381', '#252f39', 'rgba(230,245,255,.24)', 'rgba(0,0,0,.42)', '#7d8792'];
    if (mat === 'stone') return ['#77726a', '#3d3933', 'rgba(255,244,220,.18)', 'rgba(0,0,0,.42)', '#898075'];
    return ['#8b5a33', '#432615', 'rgba(255,220,160,.24)', 'rgba(0,0,0,.38)', '#9a612f'];
  }

  function block(x, y, w, h, colors) {
    ctx.fillStyle = colors[0];
    ctx.strokeStyle = colors[1];
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
    ctx.fillStyle = colors[2];
    ctx.fillRect(x + 3, y + 3, Math.max(0, w - 6), Math.max(3, Math.min(6, h * .22)));
    ctx.fillStyle = colors[3];
    ctx.fillRect(x + 2, y + h - Math.max(4, h * .20), Math.max(0, w - 4), Math.max(4, h * .20));
    ctx.fillRect(x + w - Math.max(3, w * .12) - 2, y + 4, Math.max(3, w * .12), Math.max(0, h - 8));
  }

  function drawWall(o, alpha = 1) {
    const s = t();
    const x = o.x * s, y = o.y * s, cx = x + s / 2, cy = y + s / 2;
    const colors = pal(material(o));
    const thick = Math.max(18, Math.round(s * .40));
    const half = thick / 2;
    const m = mask(o.x, o.y);
    ctx.save();
    ctx.globalAlpha *= alpha;
    if (!m) {
      const h = (Number(o.rotation || 0) % 2) === 0;
      if (h) block(x + s * .08, cy - half, s * .84, thick, colors);
      else block(cx - half, y + s * .08, thick, s * .84, colors);
    } else {
      if (m & MASK.N) block(cx - half, y, thick, s / 2 + half, colors);
      if (m & MASK.S) block(cx - half, cy - half, thick, s / 2 + half, colors);
      if (m & MASK.W) block(x, cy - half, s / 2 + half, thick, colors);
      if (m & MASK.E) block(cx - half, cy - half, s / 2 + half, thick, colors);
      block(cx - half, cy - half, thick, thick, colors);
    }
    ctx.restore();
  }

  function doorMat(o) {
    if (o?.wallMaterial) return o.wallMaterial;
    for (const [dx, dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const n = at(o.x + dx, o.y + dy);
      if (wall(n)) return material(n);
    }
    return material(o);
  }

  function doorHorizontal(o) {
    const m = mask(o.x, o.y);
    if ((m & MASK.W) || (m & MASK.E)) return true;
    if ((m & MASK.N) || (m & MASK.S)) return false;
    return (Number(o.rotation || 0) % 2) === 0;
  }

  function drawDoor(o, alpha = 1) {
    const s = t();
    const x = o.x * s, y = o.y * s, cx = x + s / 2, cy = y + s / 2;
    const colors = pal(doorMat(o));
    const open = (o.state || window.DoorState?.CLOSED || 'closed') === (window.DoorState?.OPEN || 'open');
    const horiz = doorHorizontal(o);
    const thick = Math.max(18, Math.round(s * .40));
    const half = thick / 2;
    const leaf = Math.max(12, Math.round(s * .28));
    ctx.save();
    ctx.globalAlpha *= alpha;
    if (horiz) block(x + s * .06, cy - half, s * .88, thick, colors);
    else block(cx - half, y + s * .06, thick, s * .88, colors);
    const doorColors = [colors[4], colors[1], 'rgba(255,255,255,.12)', 'rgba(0,0,0,.34)', colors[4]];
    if (!open) {
      if (horiz) block(x + s * .18, cy - leaf / 2, s * .64, leaf, doorColors);
      else block(cx - leaf / 2, y + s * .18, leaf, s * .64, doorColors);
      ctx.fillStyle = '#ead495';
      ctx.beginPath();
      ctx.arc(horiz ? x + s * .66 : cx, horiz ? cy : y + s * .66, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.translate(cx, cy);
      ctx.rotate(horiz ? -Math.PI / 4 : Math.PI / 4);
      if (horiz) block(0, -leaf / 2, s * .44, leaf, doorColors);
      else block(-leaf / 2, 0, leaf, s * .44, doorColors);
    }
    ctx.restore();
  }

  function drawObj(o) {
    if (wall(o) || door(o)) {
      if (wall(o)) drawWall(o, o.type === 'blueprint' ? .48 : 1);
      else drawDoor(o, o.type === 'blueprint' ? .48 : 1);
      if (o.type === 'blueprint') {
        const def = buildDefs?.[o.buildType];
        if (def && typeof drawProgress === 'function') drawProgress(o.x * TILE + TILE / 2, o.y * TILE + 8, (o.progress || 0) / Math.max(1, def.work || 1), '#9bd36a');
      }
      return;
    }
    originalDrawObject?.(o);
  }

  function drawPreview() {
    const key = typeof currentBuild !== 'undefined' ? currentBuild : null;
    const type = key ? buildDefs?.[key]?.type : null;
    const tile = typeof mouseTile !== 'undefined' ? mouseTile : null;
    if (!key || !tile || (type !== 'wall' && type !== 'door')) { originalDrawBuildPreview?.(); return; }
    const ok = typeof canPlaceBuild === 'function' ? canPlaceBuild(key, tile.x, tile.y) : true;
    ctx.fillStyle = ok ? 'rgba(155,211,106,.18)' : 'rgba(230,120,102,.24)';
    ctx.strokeStyle = ok ? 'rgba(155,211,106,.86)' : 'rgba(230,120,102,.86)';
    ctx.fillRect(tile.x * TILE, tile.y * TILE, TILE, TILE);
    ctx.strokeRect(tile.x * TILE + .5, tile.y * TILE + .5, TILE - 1, TILE - 1);
    const ghost = { type, buildType: key, x: tile.x, y: tile.y, rotation: currentBuildRotation || 0, wallMaterial: type === 'wall' ? matForBuild(key) : null, state: window.DoorState?.CLOSED || 'closed' };
    type === 'wall' ? drawWall(ghost, .72) : drawDoor(ghost, .72);
  }

  function install() {
    if (installed) return;
    if (!window.HavenfallContext?.gameBooted || !window.HavenfallRenderCollisionSystem) { setTimeout(install, 120); return; }
    installed = true;
    originalDrawObject = typeof drawObject === 'function' ? drawObject : null;
    originalDrawBuildPreview = typeof drawBuildPreview === 'function' ? drawBuildPreview : null;
    try { drawObject = drawObj; } catch (_) {}
    try { drawBuildPreview = drawPreview; } catch (_) {}
    window.HavenfallWallDoorRenderer = true;
    console.info('[Wall Door Renderer] Paredes e portas sólidas carregadas.');
  }

  install();
})();
