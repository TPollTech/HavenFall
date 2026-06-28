'use strict';

(() => {
  const core = window.HavenfallPawnCore;
  const styleApi = window.HavenfallPawnStyle;
  const {
    dirVector,
    sideVector,
    shade,
    drawEllipse,
    drawCircle,
    drawTriangle,
    drawPawnShadow
  } = core;

  function drawSelection(c) {
    if (c?.id !== selectedColonistId) return;
    ctx.save();
    drawEllipse(c.px, c.py + 19, 18, 8, 'rgba(155, 211, 106, .28)', '#9bd36a', 2);
    ctx.restore();
  }

  function bodyScale(style) {
    if (style.body === 'stocky') return { x: 1.12, y: 1.02 };
    if (style.body === 'thin') return { x: 0.88, y: 1.04 };
    if (style.body === 'short') return { x: 0.96, y: 0.92 };
    return { x: 1, y: 1 };
  }

  function drawHair(style, headX, headY, forward) {
    if (style.hairStyle === 'bald') return;
    if (style.hairStyle === 'long') {
      drawEllipse(headX - forward.x * 1.2, headY - 2, 9.2, 7.4, style.hair, null, 1, forward.x * 0.2);
      return;
    }
    drawEllipse(headX - forward.x * 1.2, headY - 4, 8.8, 4.6, style.hair, null, 1, forward.x * 0.2);
  }

  function drawHumanoidPawn(c, options = {}) {
    const x = c.px;
    const y = c.py + 10;
    const dir = c.dir || 'down';
    const forward = dirVector(dir);
    const side = sideVector(dir);
    const style = styleApi.colonistStyle(c);
    const scale = bodyScale(style);
    const downed = !!options.downed;
    const bodyY = y + 5;
    const bodyRotation = dir === 'left' || dir === 'right' ? 0.12 * forward.x : 0;

    ctx.save();
    if (downed) {
      drawPawnShadow(x, y + 4, 20, 8);
      ctx.translate(x, y + 11);
      ctx.rotate(Math.PI / 2);
      drawEllipse(0, 0, 11 * scale.x, 17 * scale.y, '#151a21', 'rgba(255,255,255,.16)', 1.1);
      drawEllipse(0, -1, 8 * scale.x, 14 * scale.y, style.cloth, '#1b1714', 1.5);
      drawCircle(0, -18, style.head === 'narrow' ? 7.8 : 8.5, style.skin, '#2b211b', 1.4);
      drawHair(style, 0, -18, { x: 0, y: -1 });
      ctx.restore();
      return;
    }

    drawPawnShadow(x, y, 17 * scale.x, 8);
    drawEllipse(x, bodyY, 11.5 * scale.x, 15.5 * scale.y, '#151a21', 'rgba(255,255,255,.12)', 1.1, bodyRotation);
    drawEllipse(x, bodyY - 1, 8.5 * scale.x, 12.8 * scale.y, style.cloth, '#201a14', 1.5, bodyRotation);
    drawEllipse(x - side.x * 5, bodyY + 2, 3.7, 7, shade(style.cloth, -22), '#201a14', 1);
    drawEllipse(x + side.x * 5, bodyY + 2, 3.7, 7, shade(style.cloth, -22), '#201a14', 1);
    drawEquipment(c, x, y, forward, side);

    const headRadius = style.head === 'narrow' ? 8.2 : style.head === 'square' ? 9.6 : 9.2;
    const headX = x + forward.x * 3;
    const headY = y - 10 + forward.y * 2;
    drawCircle(headX, headY, headRadius, style.skin, '#2b211b', 1.5);
    drawHair(style, headX, headY, forward);
    if (dir !== 'up') {
      drawCircle(headX - side.x * 3.1 + forward.x * 2.3, headY - 0.4, 1.3, '#1b1512');
      drawCircle(headX + side.x * 3.1 + forward.x * 2.3, headY - 0.4, 1.3, '#1b1512');
    }
    ctx.restore();
  }

  function drawEquipment(c, x, y, forward, side) {
    ensureEquipment?.(c);
    const key = c?.equipment?.weapon || c?.equipment?.tool || c?.equipment?.offhand;
    if (!key) return;
    const item = itemDefs?.[key] || {};
    const sx = x + side.x * 12 + forward.x * 1;
    const sy = y + 6 + side.y * 12 + forward.y * 1;
    ctx.save();
    ctx.strokeStyle = '#2a2017';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    if (key.includes('bow')) {
      ctx.beginPath();
      ctx.arc(sx, sy, 8, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#d8c7a0';
      ctx.beginPath(); ctx.moveTo(sx, sy - 8); ctx.lineTo(sx, sy + 8); ctx.stroke();
    } else if (key.includes('spear') || key.includes('pickaxe') || key.includes('axe') || key.includes('hammer') || key.includes('sickle')) {
      ctx.beginPath();
      ctx.moveTo(sx - side.x * 7 - forward.x * 3, sy - side.y * 7 - forward.y * 3);
      ctx.lineTo(sx + side.x * 7 + forward.x * 3, sy + side.y * 7 + forward.y * 3);
      ctx.stroke();
      drawCircle(sx + side.x * 8 + forward.x * 3, sy + side.y * 8 + forward.y * 3, 3.2, '#aeb7b8', '#342820', 1);
    } else if (key.includes('shield')) {
      drawEllipse(sx, sy, 6.5, 8.5, '#7f6a45', '#2a2017', 1.6);
    } else if (key.includes('torch')) {
      ctx.beginPath(); ctx.moveTo(sx - 4, sy + 8); ctx.lineTo(sx + 4, sy - 6); ctx.stroke();
      drawCircle(sx + 5, sy - 8, 4.4, '#f97316', '#7c2d12', 1.1);
    } else if (item.slot === 'offhand') {
      drawCircle(sx, sy, 5.5, '#8f7a56', '#2a2017', 1.4);
    } else {
      drawTriangle([{ x: sx - 4, y: sy + 7 }, { x: sx + 5, y: sy - 7 }, { x: sx + 8, y: sy - 3 }], '#b7bec4', '#2a2017');
    }
    ctx.restore();
  }

  function drawColonistPawn(c) {
    if (c?.isUnconscious) return drawUnconsciousPawn(c);
    drawSelection(c);
    drawHumanoidPawn(c);
    drawTinyBars?.(c);
    drawName?.(c.name, c.px, c.py - 38);
  }

  function drawUnconsciousPawn(c) {
    drawSelection(c);
    ctx.save();
    drawEllipse(c.px, c.py + 19, 22, 10, 'rgba(231, 189, 88, .22)', '#e7bd58', 2);
    ctx.restore();
    drawHumanoidPawn(c, { downed: true });
    drawTinyBars?.(c);
    drawName?.(`${c.name} - inconsciente`, c.px, c.py - 38);
  }

  window.HavenfallColonistRenderer = Object.freeze({
    drawColonist: drawColonistPawn,
    drawUnconsciousColonist: drawUnconsciousPawn,
    drawHumanoid: drawHumanoidPawn
  });
})();
