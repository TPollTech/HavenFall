'use strict';

(() => {
  function drawDeerPawnOverride(mob) {
    const core = window.HavenfallPawnCore;
    if (!mob || !core || typeof ctx === 'undefined') return false;

    const {
      dirVector,
      shade,
      drawEllipse,
      drawCircle,
      drawTriangle,
      drawLine,
      drawMobHealth
    } = core;

    const profile = window.HavenfallPawnStyle?.animalProfile?.('deer', mob) || {};
    const p = profile.palette || {};
    const f = dirVector(mob.dir === 'right' ? 'right' : 'left');
    const s = profile.scale || 0.9;
    const x = mob.px;
    const y = mob.py + 13;
    const outline = profile.outline || '#2f2519';
    const body = p.body || '#9a7244';
    const bodyLight = p.bodyLight || '#a77745';
    const flank = p.flank || '#c49a67';
    const chest = p.chest || '#d9bf98';
    const head = p.head || bodyLight;
    const neck = p.neck || shade(body, -10);
    const leg = p.leg || '#714c31';
    const hoof = '#2d221b';
    const tail = p.tail || '#e7dac7';
    const ear = p.ear || '#c38f5e';
    const snout = p.snout || chest;
    const antler = p.antler || '#4b3524';

    function drawHoofLeg(baseX, baseY, height, color, bend = 0, width = 1.55) {
      const kneeY = baseY + height * 0.58;
      const footX = baseX + bend;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(baseX + bend * 0.35, kneeY);
      ctx.lineTo(footX, baseY + height);
      ctx.stroke();
      ctx.restore();
      drawLine(footX - 1.2 * s, baseY + height, footX + 1.1 * s, baseY + height, hoof, 1.05 * s);
    }

    function drawNeck() {
      ctx.save();
      ctx.fillStyle = neck;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1.15 * s;
      ctx.beginPath();
      ctx.moveTo(x + f.x * 8.4 * s, y - 5.8 * s);
      ctx.quadraticCurveTo(x + f.x * 12.8 * s, y - 10.3 * s, x + f.x * 17.1 * s, y - 10.1 * s);
      ctx.lineTo(x + f.x * 16.3 * s, y - 6.2 * s);
      ctx.quadraticCurveTo(x + f.x * 11.8 * s, y - 4.4 * s, x + f.x * 7.6 * s, y - 2.8 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    function drawSmallAntlers(baseX, baseY) {
      ctx.save();
      ctx.strokeStyle = antler;
      ctx.lineWidth = 1.25 * s;
      ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        const rootX = baseX - f.x * side * 1.1 * s;
        const rootY = baseY + side * 0.15 * s;
        ctx.beginPath();
        ctx.moveTo(rootX, rootY);
        ctx.lineTo(rootX - f.x * 1.2 * s, rootY - 5.2 * s);
        ctx.lineTo(rootX + f.x * 2.2 * s, rootY - 8.2 * s);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(rootX - f.x * 0.9 * s, rootY - 4.8 * s);
        ctx.lineTo(rootX - f.x * 3.3 * s, rootY - 6.9 * s);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawEllipse(x, y + 10.6 * s, 18.2 * s, 6.1 * s, 'rgba(0,0,0,.29)');

    drawHoofLeg(x - f.x * 9.2 * s, y + 2.2 * s, 12.2 * s, shade(leg, -8), -f.x * 0.7 * s, 1.45);
    drawHoofLeg(x - f.x * 3.3 * s, y + 2.4 * s, 12.7 * s, shade(leg, -3), f.x * 0.35 * s, 1.5);
    drawHoofLeg(x + f.x * 4.6 * s, y + 2.3 * s, 12.8 * s, leg, -f.x * 0.25 * s, 1.55);
    drawHoofLeg(x + f.x * 9.8 * s, y + 1.8 * s, 13.1 * s, shade(leg, -5), f.x * 0.65 * s, 1.48);

    drawEllipse(x - f.x * 15.9 * s, y - 1.6 * s, 3.2 * s, 2.1 * s, tail, outline, 0.75 * s, -f.x * 0.2);
    drawEllipse(x, y, 17.7 * s, 7.4 * s, body, outline, 1.35 * s);
    drawEllipse(x - f.x * 2.6 * s, y + 1 * s, 8.8 * s, 4.1 * s, flank, null, 0, -f.x * 0.06);
    drawEllipse(x + f.x * 6.5 * s, y - 0.4 * s, 6.2 * s, 3.1 * s, bodyLight, null, 0, f.x * 0.1);
    drawEllipse(x - f.x * 11.2 * s, y + 0.1 * s, 5.1 * s, 4.6 * s, shade(body, -12), outline, 0.95 * s, f.x * 0.18);

    drawNeck();

    drawEllipse(x + f.x * 19 * s, y - 9.2 * s, 6.1 * s, 4.35 * s, head, outline, 1.12 * s, f.x * -0.05);
    drawEllipse(x + f.x * 24.3 * s, y - 8.5 * s, 3.5 * s, 2.25 * s, snout, outline, 0.9 * s, f.x * -0.04);

    drawTriangle([
      { x: x + f.x * 15.5 * s, y: y - 12.1 * s },
      { x: x + f.x * 13.9 * s, y: y - 17.2 * s },
      { x: x + f.x * 18.4 * s, y: y - 13.7 * s }
    ], ear, outline);
    drawTriangle([
      { x: x + f.x * 19.3 * s, y: y - 12.2 * s },
      { x: x + f.x * 21.9 * s, y: y - 16.5 * s },
      { x: x + f.x * 21.5 * s, y: y - 11.8 * s }
    ], ear, outline);

    drawSmallAntlers(x + f.x * 17.4 * s, y - 14.1 * s);
    drawEllipse(x + f.x * 19.9 * s, y - 9.8 * s, 1.05 * s, 1.25 * s, p.eye || '#120f0c');
    drawCircle(x + f.x * 26.3 * s, y - 8.1 * s, 0.8 * s, p.nose || '#382a20');
    drawMobHealth(mob, x, mob.py - 18 * s, profile.healthColor || '#d6a24a');
    return true;
  }

  function drawMobPawn(mob) {
    if (mob?.type === 'deer' && drawDeerPawnOverride(mob)) return true;
    return window.HavenfallAnimalRenderer?.drawMob?.(mob) || window.HavenfallHostileRenderer?.drawMob?.(mob) || false;
  }

  function installPawnRenderer() {
    if (window.HavenfallContext?.pawnRendererInstalled) return;
    window.HavenfallContext = window.HavenfallContext || {};

    if (typeof drawColonist === 'function') {
      drawColonist = window.HavenfallColonistRenderer.drawColonist;
    }
    if (typeof drawUnconsciousColonist === 'function') {
      drawUnconsciousColonist = window.HavenfallColonistRenderer.drawUnconsciousColonist;
    }
    if (typeof drawWolf === 'function') {
      drawWolf = window.HavenfallHostileRenderer.drawWolf;
    }
    if (typeof drawMob === 'function') {
      drawMob = drawMobPawn;
    }

    window.HavenfallPawnRenderer = Object.freeze({
      core: window.HavenfallPawnCore,
      style: window.HavenfallPawnStyle,
      colonists: window.HavenfallColonistRenderer,
      npcs: window.HavenfallNpcRenderer,
      animals: window.HavenfallAnimalRenderer,
      hostiles: window.HavenfallHostileRenderer,
      drawColonist: window.HavenfallColonistRenderer.drawColonist,
      drawUnconsciousColonist: window.HavenfallColonistRenderer.drawUnconsciousColonist,
      drawNpc: window.HavenfallNpcRenderer.drawNpc,
      drawMob: drawMobPawn,
      drawWolf: window.HavenfallHostileRenderer.drawWolf
    });
    window.HavenfallContext.pawnRendererInstalled = true;
    window.HavenfallContext.simulationUpgradeDisabledForAlpha = true;
  }

  installPawnRenderer();
})();
