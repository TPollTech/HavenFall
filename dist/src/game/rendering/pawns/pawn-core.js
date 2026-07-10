'use strict';

(() => {
  function hashText(text) {
    let hash = 0;
    const value = String(text || '');
    for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    return Math.abs(hash);
  }

  function dirVector(dir = 'down') {
    if (dir === 'up') return { x: 0, y: -1 };
    if (dir === 'left') return { x: -1, y: 0 };
    if (dir === 'right') return { x: 1, y: 0 };
    return { x: 0, y: 1 };
  }

  function sideVector(dir = 'down') {
    const v = dirVector(dir);
    return { x: -v.y, y: v.x };
  }

  function shade(hex, amount) {
    const n = parseInt(String(hex || '#000000').replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
    const b = Math.max(0, Math.min(255, (n & 255) + amount));
    return `rgb(${r},${g},${b})`;
  }

  function drawEllipse(x, y, rx, ry, fill, stroke = null, lineWidth = 1.5, rotation = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  function drawCircle(x, y, r, fill, stroke = null, lineWidth = 1.5) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  function drawTriangle(points, fill, stroke = null) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
  }

  function drawLine(x1, y1, x2, y2, stroke, lineWidth = 2) {
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawPawnShadow(x, y, rx = 17, ry = 8) {
    drawEllipse(x, y + 18, rx, ry, 'rgba(0,0,0,.34)');
  }

  function drawMobHealth(mob, x, y, color) {
    if (mob?.hp === undefined) return;
    const max = mob.maxHp || (mob.type === 'blood_wolf' ? 135 : 100);
    drawProgress?.(x, y, (mob.hp || 0) / max, color);
  }

  window.HavenfallPawnCore = Object.freeze({
    hashText,
    dirVector,
    sideVector,
    shade,
    drawEllipse,
    drawCircle,
    drawTriangle,
    drawLine,
    drawPawnShadow,
    drawMobHealth
  });
})();
