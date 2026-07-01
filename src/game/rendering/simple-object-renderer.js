'use strict';

(() => {
  function anchor(obj) {
    const s = typeof getTileSize === 'function' ? getTileSize() : TILE;
    return { x: obj.x * s + s / 2, y: obj.y * s + s / 2, tile: s };
  }

  function ellipse(x, y, rx, ry, fill, stroke = null, width = 1.5) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }

  function roundRect(x, y, w, h, r, fill, stroke = null, width = 1.5) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }

  function line(x1, y1, x2, y2, stroke, width = 2) {
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function shadow(x, y, rx = 23, ry = 8) {
    ellipse(x, y + 17, rx, ry, 'rgba(0,0,0,.30)');
  }

  function drawBed(x, y) {
    shadow(x, y, 26, 9);
    roundRect(x - 24, y - 12, 48, 25, 5, '#5b3a25', '#21160f', 1.5);
    roundRect(x - 21, y - 16, 42, 18, 5, '#8c6f56', '#2d2118', 1.3);
    roundRect(x - 18, y - 14, 15, 12, 4, '#d8d0bd', '#5b4a38', 1);
    roundRect(x - 1, y - 13, 20, 14, 4, '#6d7f8d', '#2d3b44', 1);
    for (const ox of [-19, 19]) line(x + ox, y + 7, x + ox, y + 18, '#2b1b12', 2.2);
  }

  function drawCrate(x, y, label = false) {
    shadow(x, y, 22, 8);
    roundRect(x - 19, y - 16, 38, 31, 4, '#8a5a33', '#2b1b12', 1.7);
    ctx.fillStyle = 'rgba(255,220,160,.16)';
    ctx.fillRect(x - 16, y - 13, 32, 5);
    line(x - 17, y - 3, x + 17, y - 3, '#4a2c17', 1.7);
    line(x - 8, y - 15, x - 8, y + 14, '#4a2c17', 1.5);
    line(x + 8, y - 15, x + 8, y + 14, '#4a2c17', 1.5);
    if (label) {
      roundRect(x - 9, y - 8, 18, 10, 2, '#c9b37a', '#4a2c17', 1);
      line(x - 5, y - 3, x + 5, y - 3, '#4a2c17', 1);
    }
  }

  function drawCampfire(x, y) {
    shadow(x, y, 20, 7);
    line(x - 15, y + 8, x + 14, y - 4, '#4a2c17', 5);
    line(x - 13, y - 5, x + 16, y + 8, '#5c371d', 5);
    for (const ox of [-12, 0, 12]) ellipse(x + ox, y + 10, 5, 4, '#5c5f5a', '#24251f', 1.1);
    ctx.beginPath();
    ctx.moveTo(x, y - 21);
    ctx.quadraticCurveTo(x + 15, y - 5, x + 3, y + 5);
    ctx.quadraticCurveTo(x - 8, y - 3, x, y - 21);
    ctx.closePath();
    ctx.fillStyle = '#f97316';
    ctx.fill();
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 1, y - 13);
    ctx.quadraticCurveTo(x + 8, y - 3, x + 1, y + 2);
    ctx.quadraticCurveTo(x - 4, y - 3, x + 1, y - 13);
    ctx.closePath();
    ctx.fillStyle = '#facc15';
    ctx.fill();
  }

  function drawCactus(x, y) {
    shadow(x, y, 18, 6);
    roundRect(x - 8, y - 24, 16, 38, 7, '#3f8f4d', '#1f4f2b', 1.4);
    roundRect(x - 18, y - 10, 10, 20, 5, '#4aa35b', '#1f4f2b', 1.2);
    roundRect(x + 8, y - 16, 10, 18, 5, '#4aa35b', '#1f4f2b', 1.2);
    line(x - 10, y - 4, x - 10, y + 7, '#1f4f2b', 1.6);
    line(x + 10, y - 8, x + 10, y + 1, '#1f4f2b', 1.6);
    line(x, y - 18, x, y + 9, '#74c476', 1.2);
  }

  function drawRuin(x, y) {
    shadow(x, y, 25, 8);
    roundRect(x - 23, y - 18, 18, 34, 2, '#68625a', '#2f2c27', 1.5);
    roundRect(x + 2, y - 9, 20, 25, 2, '#777067', '#2f2c27', 1.5);
    line(x - 20, y - 2, x - 8, y - 2, 'rgba(255,255,255,.12)', 1.2);
    line(x + 5, y + 4, x + 18, y + 4, 'rgba(255,255,255,.12)', 1.2);
    ellipse(x, y + 10, 11, 5, '#4a4640', '#25231f', 1);
  }

  function drawOre(x, y) {
    shadow(x, y, 22, 8);
    roundRect(x - 18, y - 18, 35, 33, 7, '#4c5663', '#1f2933', 1.5);
    ellipse(x - 5, y - 6, 5, 8, '#8f1d1d', '#401212', 1.1);
    ellipse(x + 7, y + 2, 4, 7, '#b45309', '#3a1d07', 1);
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.fillRect(x - 12, y - 12, 14, 3);
  }

  function drawBridge(x, y) {
    shadow(x, y, 23, 6);
    for (const oy of [-9, 1, 11]) {
      roundRect(x - 24, y + oy, 48, 7, 2, '#8a5a33', '#2b1b12', 1.1);
      line(x - 18, y + oy + 2, x + 18, y + oy + 2, 'rgba(255,220,160,.12)', 1);
    }
    line(x - 19, y - 13, x - 19, y + 17, '#4a2c17', 2);
    line(x + 19, y - 13, x + 19, y + 17, '#4a2c17', 2);
  }

  function drawLoot(x, y, obj) {
    shadow(x, y, 14, 5);
    const item = itemDefs?.[obj.itemKey] || {};
    const color = item.kind === 'food' ? '#b45309' : item.kind === 'medical' ? '#e5e7eb' : item.kind === 'resource' ? '#7c8794' : '#c8a35a';
    roundRect(x - 13, y - 12, 26, 22, 6, color, '#2b2118', 1.4);
    ctx.fillStyle = 'rgba(255,255,255,.20)';
    ctx.fillRect(x - 8, y - 8, 15, 3);
    if (obj.amount > 1) {
      ctx.fillStyle = '#fff3df';
      ctx.font = '900 10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(String(obj.amount), x, y + 4);
    }
  }

  function drawStockpile(x, y, obj) {
    shadow(x, y, 20, 7);
    const color = obj.resource === 'wood' ? '#8a5a33'
      : obj.resource === 'stone' ? '#737b82'
        : obj.resource === 'metal' ? '#7f1d1d'
          : obj.resource === 'food' ? '#9a5f18'
            : obj.itemKey ? '#9b7b45'
              : '#6b7280';
    roundRect(x - 18, y - 12, 36, 23, 5, color, '#241812', 1.5);
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(x - 14, y - 8, 28, 4);
    line(x - 13, y + 1, x + 13, y + 1, 'rgba(0,0,0,.25)', 1.4);
    ctx.fillStyle = '#fff3df';
    ctx.font = '900 10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.max(1, Number(obj.amount || 1))), x, y + 7);
  }

  function drawSimpleObject(obj) {
    if (!obj) return false;
    const isBlueprint = obj.type === 'blueprint';
    const type = isBlueprint ? buildDefs?.[obj.buildType]?.type : obj.type;
    const supported = ['bed', 'crate', 'campfire', 'cactus', 'supply_crate', 'cache', 'ruin', 'ore', 'bridge', 'loot', 'stockpile'].includes(type);
    if (!supported) return false;

    const p = anchor(obj);
    ctx.save();
    if (isBlueprint) ctx.globalAlpha *= 0.48;
    if (type === 'bed') drawBed(p.x, p.y);
    else if (type === 'crate') drawCrate(p.x, p.y, true);
    else if (type === 'supply_crate' || type === 'cache') drawCrate(p.x, p.y, true);
    else if (type === 'campfire') drawCampfire(p.x, p.y);
    else if (type === 'cactus') drawCactus(p.x, p.y);
    else if (type === 'ruin') drawRuin(p.x, p.y);
    else if (type === 'ore') drawOre(p.x, p.y);
    else if (type === 'bridge') drawBridge(p.x, p.y);
    else if (type === 'loot') drawLoot(p.x, p.y, obj);
    else if (type === 'stockpile') drawStockpile(p.x, p.y, obj);
    ctx.restore();

    if (isBlueprint) {
      const def = buildDefs?.[obj.buildType];
      if (def && typeof drawProgress === 'function') drawProgress(p.x, obj.y * TILE + 8, (obj.progress || 0) / Math.max(1, def.work || 1), '#9bd36a');
    }
    if (!isBlueprint && obj.markedForGather && typeof drawMarkedForGather === 'function') drawMarkedForGather(p.x, p.y);
    if (!isBlueprint && objectDefs?.[type]?.interactable && typeof drawInteractionHint === 'function') drawInteractionHint(obj, p.x, p.y);
    return true;
  }

  function install() {
    if (window.HavenfallContext?.simpleObjectRendererInstalled) return;
    window.HavenfallContext = window.HavenfallContext || {};
    window.GameSystems?.registerObjectRenderer?.('objects.simple-procedural', drawSimpleObject, { order: 35 });
    window.HavenfallSimpleObjectRenderer = Object.freeze({ drawObject: drawSimpleObject });
    window.HavenfallContext.simpleObjectRendererInstalled = true;
    console.info('[Simple Object Renderer] Objetos simples em JS carregados.');
  }

  install();
})();
