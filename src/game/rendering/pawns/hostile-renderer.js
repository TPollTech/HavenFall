'use strict';

(() => {
  const core = window.HavenfallPawnCore;
  const {
    dirVector,
    shade,
    drawEllipse,
    drawCircle,
    drawTriangle,
    drawMobHealth
  } = core;

  function drawHostilePawn(mob) {
    if (!mob) return false;
    if (mob.type === 'spider') return drawSpiderPawn(mob);
    if (mob.type === 'wolf' || mob.type === 'blood_wolf' || !mob.type) return drawWolfPawn(mob);
    return false;
  }

  function drawSpiderPawn(mob) {
    const x = mob.px;
    const y = mob.py + 13;
    drawEllipse(x, y + 8, 15, 7, 'rgba(0,0,0,.32)');
    ctx.save();
    ctx.strokeStyle = '#211b24';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i += 2) {
      for (const offset of [-6, -2, 2, 6]) {
        ctx.beginPath();
        ctx.moveTo(x + i * 5, y + offset * 0.35);
        ctx.lineTo(x + i * 14, y + offset);
        ctx.lineTo(x + i * 20, y + offset + (offset < 0 ? -3 : 3));
        ctx.stroke();
      }
    }
    drawEllipse(x, y, 11.5, 9.2, '#302936', '#120f15', 1.5);
    drawCircle(x + (mob.dir === 'right' ? 8 : -8), y - 1, 6.5, '#3b303e', '#120f15', 1.4);
    drawCircle(x - 3, y - 3, 1.5, '#e06b3f');
    drawCircle(x + 3, y - 3, 1.5, '#e06b3f');
    ctx.restore();
    drawMobHealth(mob, x, mob.py - 20, '#e67866');
    return true;
  }

  function drawWolfPawn(wolf) {
    const type = wolf.type || 'wolf';
    const x = wolf.px;
    const y = wolf.py + 11;
    const dir = wolf.dir === 'right' ? 'right' : 'left';
    const f = dirVector(dir);
    const blood = type === 'blood_wolf';
    const fur = blood ? '#4b1d1d' : '#5c5f5a';
    const light = blood ? '#8d2b2b' : '#8a8f86';
    drawEllipse(x, y + 11, 22, 8, 'rgba(0,0,0,.34)');
    drawEllipse(x, y, 17, 9.5, fur, '#20201f', 1.6);
    drawEllipse(x - f.x * 13, y - 1, 8, 5.2, shade(fur, -16), '#20201f', 1.2, f.x * 0.25);
    drawCircle(x + f.x * 18, y - 5, 8.4, light, '#20201f', 1.4);
    drawTriangle([
      { x: x + f.x * 16, y: y - 12 },
      { x: x + f.x * 12, y: y - 21 },
      { x: x + f.x * 21, y: y - 15 }
    ], light, '#20201f');
    drawTriangle([
      { x: x + f.x * 22, y: y - 11 },
      { x: x + f.x * 27, y: y - 19 },
      { x: x + f.x * 29, y: y - 9 }
    ], light, '#20201f');
    drawCircle(x + f.x * 22, y - 7, 1.4, '#0e0d0c');
    if (blood) drawEllipse(x, y + 1, 21, 12, 'rgba(185,28,28,.18)', '#ef4444', 1.5);
    drawMobHealth(wolf, x, wolf.py - 23, blood ? '#ef4444' : '#e67866');
    return true;
  }

  window.HavenfallHostileRenderer = Object.freeze({
    drawMob: drawHostilePawn,
    drawWolf: drawWolfPawn
  });
})();
