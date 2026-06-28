'use strict';

(() => {
  const core = window.HavenfallPawnCore;
  const styleApi = window.HavenfallPawnStyle;
  const {
    dirVector,
    drawEllipse,
    drawCircle,
    drawTriangle,
    drawLine,
    drawMobHealth
  } = core;

  function drawAnimalPawn(mob) {
    if (!mob) return false;
    if (mob.type === 'rabbit') return drawRabbitPawn(mob);
    if (mob.type === 'rat' || mob.type === 'mouse') return drawRodentPawn(mob);
    if (mob.type === 'deer') return drawDeerPawn(mob);
    if (mob.type === 'squirrel') return drawSquirrelPawn(mob);
    if (mob.type === 'turtle') return drawTurtlePawn(mob);
    if (mob.type === 'chicken' || mob.type === 'duck' || mob.type === 'turkey') return drawBirdPawn(mob, styleApi.animalProfile(mob.type, mob));
    if (styleApi.hasAnimalProfile?.(mob.type)) return drawHerdPawn(mob, styleApi.animalProfile(mob.type, mob));
    return false;
  }

  function drawRabbitPawn(mob) {
    const x = mob.px;
    const y = mob.py + 14;
    const f = dirVector(mob.dir === 'right' ? 'right' : 'left');
    drawEllipse(x, y + 8, 13, 6, 'rgba(0,0,0,.28)');
    drawEllipse(x, y, 10.5, 7.5, '#b8aa93', '#4f463a', 1.4);
    drawCircle(x + f.x * 8, y - 4, 6.2, '#d3c9b8', '#4f463a', 1.3);
    drawEllipse(x + f.x * 10, y - 13, 2.4, 8, '#d3c9b8', '#4f463a', 1.1, f.x * 0.25);
    drawEllipse(x + f.x * 5, y - 12, 2.3, 7, '#c9bba6', '#4f463a', 1.1, f.x * -0.35);
    drawCircle(x - f.x * 11, y - 1, 3.4, '#eee7d9');
    drawMobHealth(mob, x, mob.py - 18, '#d8d0bd');
    return true;
  }

  function drawRodentPawn(mob) {
    const x = mob.px;
    const y = mob.py + 16;
    const scale = mob.type === 'mouse' ? 0.72 : 0.88;
    const f = dirVector(mob.dir === 'right' ? 'right' : 'left');
    drawEllipse(x, y + 6 * scale, 9 * scale, 4.5 * scale, 'rgba(0,0,0,.26)');
    drawEllipse(x, y, 10 * scale, 5.8 * scale, '#7b746c', '#2f2a25', 1.1);
    drawCircle(x + f.x * 8 * scale, y - 3 * scale, 4.8 * scale, '#91887e', '#2f2a25', 1);
    drawCircle(x + f.x * 7 * scale, y - 8 * scale, 2.2 * scale, '#91887e', '#2f2a25', 0.8);
    drawCircle(x + f.x * 10 * scale, y - 4 * scale, 0.9 * scale, '#11100e');
    drawLine(x - f.x * 10 * scale, y + 1 * scale, x - f.x * 18 * scale, y + 5 * scale, '#7b746c', 1.4 * scale);
    drawMobHealth(mob, x, mob.py - 14, '#a8a096');
    return true;
  }

  function drawDeerPawn(mob) {
    const x = mob.px;
    const y = mob.py + 12;
    const f = dirVector(mob.dir === 'right' ? 'right' : 'left');
    drawEllipse(x, y + 11, 20, 7, 'rgba(0,0,0,.31)');
    drawEllipse(x, y, 15.5, 8.5, '#9a7244', '#2f2519', 1.5);
    drawEllipse(x - f.x * 11, y + 1, 8, 5, '#7a5635', '#2f2519', 1.1, f.x * 0.25);
    drawCircle(x + f.x * 17, y - 6, 7.3, '#b88b54', '#2f2519', 1.3);
    drawEllipse(x + f.x * 22, y - 6, 5, 2.8, '#b88b54', '#2f2519', 1.1);
    drawAntlers(x + f.x * 16, y - 12, f.x, '#4b3524');
    drawCircle(x + f.x * 19, y - 7, 1.2, '#120f0c');
    drawMobHealth(mob, x, mob.py - 20, '#d6a24a');
    return true;
  }

  function drawAntlers(x, y, dir, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + dir * 2, y);
      ctx.lineTo(x + dir * 4, y - 8);
      ctx.lineTo(x + dir * 8, y - 11 + side);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + dir * 5, y - 7);
      ctx.lineTo(x + dir * 2, y - 12);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHerdPawn(mob, profile) {
    const x = mob.px;
    const y = mob.py + 13;
    const scale = profile.scale || 1;
    const f = dirVector(mob.dir === 'right' ? 'right' : 'left');
    drawEllipse(x, y + 10 * scale, 17 * scale, 7 * scale, 'rgba(0,0,0,.30)');
    drawEllipse(x, y, 15 * scale, 9 * scale, profile.body, '#2b241d', 1.5);
    if (profile.tail) drawEllipse(x - f.x * 16 * scale, y - 1 * scale, 4.5 * scale, 11 * scale, profile.light || profile.body, '#2b241d', 1, f.x * 0.45);
    if (profile.longNeck) drawEllipse(x + f.x * 12 * scale, y - 11 * scale, 4.8 * scale, 13 * scale, profile.body, '#2b241d', 1.1, f.x * -0.08);
    if (profile.wool) {
      for (const ox of [-9, -4, 1, 6]) drawCircle(x + ox * scale, y - 2 * scale, 5.8 * scale, profile.light, '#6c665c', 0.8);
    }
    if (profile.spots) {
      drawEllipse(x - 4 * scale, y - 2 * scale, 4.8 * scale, 3.5 * scale, profile.light);
      drawEllipse(x + 6 * scale, y + 2 * scale, 4.4 * scale, 3.2 * scale, profile.light);
    }
    if (profile.stripes) {
      for (const ox of [-8, -2, 4, 10]) drawLine(x + ox * scale, y - 7 * scale, x + (ox - 3) * scale, y + 6 * scale, '#1f1f1f', 1.2 * scale);
    }
    drawCircle(x + f.x * 17 * scale, y - 5 * scale, 7 * scale, profile.light || profile.body, '#2b241d', 1.4);
    if (profile.mane) drawCircle(x + f.x * 15 * scale, y - 6 * scale, 9 * scale, '#5a3824', '#2b241d', 1);
    if (profile.panda) {
      drawCircle(x + f.x * 14 * scale, y - 7 * scale, 2.3 * scale, profile.light);
      drawCircle(x + f.x * 20 * scale, y - 7 * scale, 2.3 * scale, profile.light);
    }
    if (profile.roundEars) {
      drawCircle(x + f.x * 12 * scale, y - 12 * scale, 3.5 * scale, profile.light || profile.body, '#2b241d', 0.9);
      drawCircle(x + f.x * 20 * scale, y - 12 * scale, 3.5 * scale, profile.light || profile.body, '#2b241d', 0.9);
    }
    if (profile.earTufts) {
      drawTriangle([
        { x: x + f.x * 13 * scale, y: y - 10 * scale },
        { x: x + f.x * 10 * scale, y: y - 17 * scale },
        { x: x + f.x * 17 * scale, y: y - 12 * scale }
      ], profile.light || profile.body, '#2b241d');
    }
    if (profile.snout) drawEllipse(x + f.x * 23 * scale, y - 4 * scale, 4.8 * scale, 3.2 * scale, '#e4a49b', '#5f3934', 1);
    if (profile.trunk) {
      drawEllipse(x + f.x * 24 * scale, y + 1 * scale, 3.4 * scale, 10 * scale, profile.body, '#2b241d', 1, f.x * 0.28);
    }
    if (profile.horn) {
      drawTriangle([
        { x: x + f.x * 14 * scale, y: y - 10 * scale },
        { x: x + f.x * 10 * scale, y: y - 17 * scale },
        { x: x + f.x * 18 * scale, y: y - 12 * scale }
      ], '#d8c7a0', '#2b241d');
      drawTriangle([
        { x: x + f.x * 20 * scale, y: y - 10 * scale },
        { x: x + f.x * 24 * scale, y: y - 17 * scale },
        { x: x + f.x * 23 * scale, y: y - 9 * scale }
      ], '#d8c7a0', '#2b241d');
    }
    if (profile.tusk) {
      drawTriangle([
        { x: x + f.x * 21 * scale, y: y - 2 * scale },
        { x: x + f.x * 29 * scale, y: y + 1 * scale },
        { x: x + f.x * 22 * scale, y: y + 3 * scale }
      ], '#efe2c3', '#2b241d');
    }
    if (profile.beard) drawEllipse(x + f.x * 19 * scale, y + 2 * scale, 2.4 * scale, 4.8 * scale, '#3a3026');
    drawCircle(x + f.x * 18 * scale, y - 6 * scale, 1.2 * scale, '#11100e');
    drawMobHealth(mob, x, mob.py - 19 * scale, '#d6a24a');
    return true;
  }

  function drawBirdPawn(mob, profile) {
    const x = mob.px;
    const y = mob.py + 16;
    const scale = profile.scale || 1;
    const f = dirVector(mob.dir === 'right' ? 'right' : 'left');
    drawEllipse(x, y + 7 * scale, 10 * scale, 5 * scale, 'rgba(0,0,0,.28)');
    if (profile.fan) {
      for (let i = -2; i <= 2; i++) {
        drawEllipse(x - f.x * 10 * scale, y - 4 * scale + i * 2, 4.2 * scale, 9 * scale, '#6b3f2e', '#2b1b15', 0.7, i * 0.22);
      }
    }
    drawEllipse(x, y, 8.5 * scale, 10 * scale, profile.body, '#211914', 1.4);
    drawEllipse(x - f.x * 2 * scale, y + 1 * scale, 5.4 * scale, 7 * scale, profile.wing, '#211914', 1);
    drawCircle(x + f.x * 7 * scale, y - 9 * scale, 5.2 * scale, profile.body, '#211914', 1.2);
    drawTriangle([
      { x: x + f.x * 11 * scale, y: y - 9 * scale },
      { x: x + f.x * 17 * scale, y: y - 7 * scale },
      { x: x + f.x * 11 * scale, y: y - 5 * scale }
    ], profile.beak || '#e8a236', '#211914');
    if (profile.comb) drawCircle(x + f.x * 5 * scale, y - 15 * scale, 2.4 * scale, profile.comb);
    drawMobHealth(mob, x, mob.py - 16 * scale, '#d8c59b');
    return true;
  }

  function drawSquirrelPawn(mob) {
    const x = mob.px;
    const y = mob.py + 16;
    const f = dirVector(mob.dir === 'right' ? 'right' : 'left');
    drawEllipse(x, y + 7, 10, 5, 'rgba(0,0,0,.28)');
    drawEllipse(x - f.x * 8, y - 8, 5.5, 14, '#8a5d36', '#2f2118', 1.2, f.x * 0.35);
    drawEllipse(x, y, 9, 6.5, '#9b6b3f', '#2f2118', 1.3);
    drawCircle(x + f.x * 8, y - 4, 5, '#b07a48', '#2f2118', 1.2);
    drawCircle(x + f.x * 10, y - 11, 2.5, '#b07a48', '#2f2118', 0.8);
    drawCircle(x + f.x * 10, y - 5, 1, '#11100e');
    drawMobHealth(mob, x, mob.py - 16, '#c8945c');
    return true;
  }

  function drawTurtlePawn(mob) {
    const x = mob.px;
    const y = mob.py + 15;
    const f = dirVector(mob.dir === 'right' ? 'right' : 'left');
    drawEllipse(x, y + 8, 13, 5, 'rgba(0,0,0,.28)');
    drawEllipse(x, y, 12, 8.5, '#556b3d', '#1f2a19', 1.5);
    drawEllipse(x, y, 8, 5.5, '#6f8750', 'rgba(31,42,25,.45)', 0.9);
    drawCircle(x + f.x * 13, y - 1, 4.6, '#6f8750', '#1f2a19', 1.1);
    drawCircle(x - f.x * 11, y - 1, 3.6, '#4b5f38', '#1f2a19', 0.9);
    for (const lx of [-7, 7]) {
      drawCircle(x + lx, y + 7, 2.4, '#4b5f38', '#1f2a19', 0.7);
      drawCircle(x + lx, y - 7, 2.4, '#4b5f38', '#1f2a19', 0.7);
    }
    drawMobHealth(mob, x, mob.py - 17, '#83a15f');
    return true;
  }

  window.HavenfallAnimalRenderer = Object.freeze({
    drawMob: drawAnimalPawn
  });
})();
