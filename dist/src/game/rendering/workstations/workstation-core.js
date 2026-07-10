'use strict';

(() => {
  function tileAnchor(obj) {
    return {
      x: obj.x * TILE + TILE / 2,
      y: obj.y * TILE + TILE / 2
    };
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

  function drawRoundRect(x, y, w, h, radius, fill, stroke = null, lineWidth = 1.5) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
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

  function drawTriangle(points, fill, stroke = null, lineWidth = 1.2) {
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
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  function drawShadow(x, y, rx = 24, ry = 9) {
    drawEllipse(x, y + 17, rx, ry, 'rgba(0,0,0,.32)');
  }

  function drawBoard(x, y, w, h, fill = '#7a5537', stroke = '#2c2118') {
    drawRoundRect(x - w / 2, y - h / 2, w, h, 3, fill, stroke, 1.4);
    drawLine(x - w / 2 + 5, y - 1, x + w / 2 - 5, y - 1, 'rgba(255,255,255,.12)', 1);
    drawLine(x - w / 2 + 6, y + 3, x + w / 2 - 6, y + 3, 'rgba(0,0,0,.16)', 1);
  }

  function drawLegs(x, y, w, h = 17, color = '#4b3424') {
    drawRoundRect(x - w / 2 + 5, y, 5, h, 2, color, '#201712', 1);
    drawRoundRect(x + w / 2 - 10, y, 5, h, 2, color, '#201712', 1);
  }

  window.HavenfallWorkstationCore = Object.freeze({
    tileAnchor,
    drawEllipse,
    drawRoundRect,
    drawLine,
    drawCircle,
    drawTriangle,
    drawShadow,
    drawBoard,
    drawLegs
  });
})();
