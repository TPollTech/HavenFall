'use strict';

(() => {
  const core = window.HavenfallPawnCore;
  const styleApi = window.HavenfallPawnStyle;
  const {
    hashText,
    dirVector,
    shade,
    drawEllipse,
    drawCircle,
    drawTriangle,
    drawLine,
    drawMobHealth
  } = core;

  const ANIMAL_DRAWERS = Object.freeze({
    rabbit: drawRabbitPawn,
    rat: drawRodentPawn,
    mouse: drawRodentPawn,
    deer: drawDeerPawn,
    goat: drawGoatPawn,
    sheep: drawSheepPawn,
    pig: drawPigPawn,
    cow: drawCowPawn,
    chicken: drawChickenPawn,
    duck: drawDuckPawn,
    turkey: drawTurkeyPawn,
    squirrel: drawSquirrelPawn,
    turtle: drawTurtlePawn
  });

  function drawAnimalPawn(mob) {
    if (!mob) return false;
    const drawer = ANIMAL_DRAWERS[mob.type];
    return drawer ? drawer(mob) : false;
  }

  function animalProfile(mob) {
    return styleApi.animalProfile?.(mob.type, mob) || {
      scale: 1,
      outline: '#2b241d',
      healthColor: '#d6a24a',
      palette: {},
      anatomy: {},
      variation: {}
    };
  }

  function animalFacing(mob) {
    return dirVector(mob.dir === 'right' ? 'right' : 'left');
  }

  function seedUnit(seed, salt) {
    return (hashText(`${seed}|${salt}`) % 1000) / 999;
  }

  function seedRange(seed, salt, min, max) {
    return min + (max - min) * seedUnit(seed, salt);
  }

  function withTransform(x, y, rotation, drawFn) {
    ctx.save();
    ctx.translate(x, y);
    if (rotation) ctx.rotate(rotation);
    drawFn();
    ctx.restore();
  }

  function fillAndStroke(fill, stroke = null, lineWidth = 1.4) {
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

  function drawAnimalShadow(x, y, rx, ry, alpha = 0.3) {
    drawEllipse(x, y, rx, ry, `rgba(0,0,0,${alpha})`);
  }

  function drawOrganicBlob(x, y, rx, ry, fill, stroke = null, lineWidth = 1.4, options = {}) {
    const {
      rotation = 0,
      wobble = Math.max(1, Math.min(rx, ry) * 0.18),
      lobes = 5,
      seed = 0,
      steps = Math.max(14, lobes * 4),
      flatBottom = 1
    } = options;

    withTransform(x, y, rotation, () => {
      const points = [];
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const noiseA = Math.sin(angle * lobes + seed * 0.011);
        const noiseB = Math.cos(angle * (lobes * 0.5 + 1) + seed * 0.017);
        let px = Math.cos(angle) * (rx + noiseA * wobble * 0.55 + noiseB * wobble * 0.3);
        let py = Math.sin(angle) * (ry + noiseB * wobble * 0.35 + noiseA * wobble * 0.12);
        if (py > 0) py *= flatBottom;
        points.push({ x: px, y: py });
      }

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + curr.x) * 0.5, (prev.y + curr.y) * 0.5);
      }
      ctx.closePath();
      fillAndStroke(fill, stroke, lineWidth);
    });
  }

  function drawAnimalEye(x, y, size = 1.1, pupil = '#11100e') {
    drawCircle(x, y, size, pupil);
    if (size >= 1) drawCircle(x - size * 0.35, y - size * 0.35, size * 0.3, 'rgba(255,255,255,.85)');
  }

  function drawTailStroke(x1, y1, x2, y2, color, lineWidth = 1.8, curve = 0) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) * 0.5, (y1 + y2) * 0.5 + curve, x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawHoofLeg(x, y, height, color, hoofColor, thickness = 2, bendX = 0, kneeRatio = 0.58) {
    const kneeY = y + height * kneeRatio;
    const footX = x + bendX;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + bendX * 0.35, kneeY);
    ctx.lineTo(footX, y + height);
    ctx.stroke();
    ctx.restore();

    drawLine(
      footX - thickness * 0.5,
      y + height,
      footX + thickness * 0.45,
      y + height,
      hoofColor,
      Math.max(1, thickness * 0.8)
    );
  }

  function drawBirdLeg(x, y, height, color, dir, thickness = 1.5, spread = 2.2) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dir * 0.6, y + height * 0.55);
    ctx.lineTo(x + dir * 0.2, y + height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + dir * 0.2, y + height);
    ctx.lineTo(x + dir * (spread * 0.9), y + height + 0.6);
    ctx.moveTo(x + dir * 0.2, y + height);
    ctx.lineTo(x - dir * (spread * 0.45), y + height + 0.3);
    ctx.stroke();
    ctx.restore();
  }

  function drawGoatHorn(x, y, dir, hornColor, scale = 1, tilt = 0) {
    ctx.save();
    ctx.strokeStyle = hornColor;
    ctx.lineWidth = 2.1 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + dir * 1.6 * scale,
      y - 7.2 * scale + tilt * 2.2,
      x + dir * 5.1 * scale,
      y - 10.4 * scale + tilt * 1.6
    );
    ctx.stroke();
    ctx.restore();
  }

  function drawCowHorn(x, y, dir, hornColor, scale = 1, tilt = 0) {
    ctx.save();
    ctx.strokeStyle = hornColor;
    ctx.lineWidth = 1.9 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + dir * 3.1 * scale,
      y - 4.2 * scale + tilt * 1.2,
      x + dir * 6.3 * scale,
      y - 2.8 * scale
    );
    ctx.stroke();
    ctx.restore();
  }

  function drawAntlers(x, y, dir, color, scale = 1, spread = 0) {
    const back = -dir;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 * scale;
    ctx.lineCap = 'round';
    for (let index = 0; index < 2; index++) {
      const depth = index * 1.1 * scale;
      const lift = index * 0.7 * scale;
      const reach = 6.2 + spread * 1.5 + index * 0.55;
      const topReach = 8.4 + spread * 1.4 + index * 0.5;

      ctx.beginPath();
      ctx.moveTo(x + back * depth * 0.4, y + lift * 0.2);
      ctx.quadraticCurveTo(
        x + back * 2.6 * scale,
        y - 5.8 * scale + lift * 0.1,
        x + back * reach * scale,
        y - 11.4 * scale - lift * 0.35
      );
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + back * 2.2 * scale, y - 4.9 * scale);
      ctx.lineTo(x + back * 4.6 * scale, y - 6.8 * scale - lift * 0.1);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + back * 4.5 * scale, y - 7.6 * scale - lift * 0.15);
      ctx.lineTo(x + back * 6.9 * scale, y - 9.6 * scale - lift * 0.2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + back * 5.9 * scale, y - 10.4 * scale - lift * 0.2);
      ctx.lineTo(x + back * topReach * scale, y - 13.4 * scale - lift * 0.3);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSnout(x, y, rx, ry, fill, stroke, nostrilColor = '#5f3934') {
    drawEllipse(x, y, rx, ry, fill, stroke, 1);
    drawCircle(x - rx * 0.35, y + ry * 0.05, Math.max(0.55, rx * 0.12), nostrilColor);
    drawCircle(x + rx * 0.2, y + ry * 0.1, Math.max(0.55, rx * 0.12), nostrilColor);
  }

  function drawWingPatch(x, y, rx, ry, fill, outline, rotation = 0) {
    drawEllipse(x, y, rx, ry, fill, outline, 1, rotation);
    drawLine(x - rx * 0.2, y - ry * 0.55, x + rx * 0.45, y + ry * 0.45, shade(fill, -18), 1);
  }

  function drawCowSpots(x, y, scale, seed, outline, fill, positions) {
    positions.forEach((spot, index) => {
      drawOrganicBlob(
        x + spot.x * scale,
        y + spot.y * scale,
        spot.rx * scale,
        spot.ry * scale,
        fill,
        outline,
        0.8 * scale,
        {
          seed: seed + index * 17,
          lobes: 4 + (index % 2),
          wobble: 1.2 * scale,
          rotation: spot.rotation || 0
        }
      );
    });
  }

  function drawRabbitPawn(mob) {
    const profile = animalProfile(mob);
    const p = profile.palette;
    const v = profile.variation;
    const s = profile.scale || 1;
    const f = animalFacing(mob);
    const x = mob.px;
    const y = mob.py + 14;
    const bodyStretch = v.bodyStretch || 1;
    const bodyTall = v.bodyTall || 1;
    const headLift = v.headLift || 0;

    drawAnimalShadow(x, y + 8 * s, (profile.anatomy.shadowRx || 13) * s, (profile.anatomy.shadowRy || 6) * s, 0.28);
    drawCircle(x - f.x * 9.8 * s, y + 2.2 * s, 3.5 * s, p.tail);
    drawEllipse(x - f.x * 7 * s, y + 4.6 * s, 4.2 * s, 6.6 * s, shade(p.body, -6), profile.outline, 1, f.x * -0.22);
    drawEllipse(x, y, 10.8 * s * bodyStretch, 7.4 * s * bodyTall, p.body, profile.outline, 1.4);
    drawEllipse(x - f.x * 1.4 * s, y + 1.4 * s, 6.2 * s, 4.1 * s, p.belly, null, 0, f.x * -0.15);
    drawLine(x + f.x * 3.4 * s, y + 3.2 * s, x + f.x * 5.7 * s, y + 9.6 * s, p.leg, 1.4 * s);
    drawLine(x - f.x * 1.6 * s, y + 3.6 * s, x - f.x * 0.2 * s, y + 10.2 * s, p.leg, 1.35 * s);
    drawCircle(x + f.x * 8.7 * s, y - 3.6 * s + headLift * 0.4 * s, 6.3 * s, p.bodyLight, profile.outline, 1.3);
    drawEllipse(x + f.x * 10.7 * s, y - 14.3 * s + headLift * 0.8 * s, 2.6 * s, 8.8 * s, p.ear, profile.outline, 1, f.x * (0.12 + v.earTilt * 0.45));
    drawEllipse(x + f.x * 5.7 * s, y - 13.1 * s + headLift * 0.7 * s, 2.4 * s, 7.8 * s, p.ear, profile.outline, 1, f.x * (-0.25 + v.earTilt * 0.22));
    drawEllipse(x + f.x * 10.7 * s, y - 13.8 * s + headLift * 0.8 * s, 1.1 * s, 5 * s, p.earInner, null, 0, f.x * (0.12 + v.earTilt * 0.45));
    drawEllipse(x + f.x * 5.7 * s, y - 12.6 * s + headLift * 0.7 * s, 1 * s, 4.5 * s, p.earInner, null, 0, f.x * (-0.25 + v.earTilt * 0.22));
    drawAnimalEye(x + f.x * 10.5 * s, y - 4.8 * s + headLift * 0.3 * s, 1.05 * s, p.eye);
    drawCircle(x + f.x * 13.4 * s, y - 2.3 * s + headLift * 0.15 * s, 0.9 * s, p.nose);
    drawMobHealth(mob, x, mob.py - 18, profile.healthColor);
    return true;
  }

  function drawRodentPawn(mob) {
    const x = mob.px;
    const y = mob.py + 16;
    const scale = mob.type === 'mouse' ? 0.72 : 0.88;
    const f = animalFacing(mob);
    drawAnimalShadow(x, y + 6 * scale, 9 * scale, 4.5 * scale, 0.26);
    drawEllipse(x, y, 10 * scale, 5.8 * scale, '#7b746c', '#2f2a25', 1.1);
    drawEllipse(x - f.x * 8.4 * scale, y + 1.8 * scale, 3.6 * scale, 4.8 * scale, '#6f675f', '#2f2a25', 0.9, f.x * -0.18);
    drawCircle(x + f.x * 8 * scale, y - 3 * scale, 4.8 * scale, '#91887e', '#2f2a25', 1);
    drawCircle(x + f.x * 7 * scale, y - 8 * scale, 2.2 * scale, '#91887e', '#2f2a25', 0.8);
    drawCircle(x + f.x * 10 * scale, y - 4 * scale, 0.9 * scale, '#11100e');
    drawTailStroke(x - f.x * 10 * scale, y + 1 * scale, x - f.x * 19 * scale, y + 5 * scale, '#7b746c', 1.4 * scale, f.x * 2.5 * scale);
    drawMobHealth(mob, x, mob.py - 14, '#a8a096');
    return true;
  }

  function drawDeerPawn(mob) {
    const profile = animalProfile(mob);
    const p = profile.palette;
    const v = profile.variation;
    const s = profile.scale || 1;
    const f = animalFacing(mob);
    const x = mob.px;
    const y = mob.py + 12;
    const headLift = v.headLift || 0;
    const stretch = v.bodyStretch || 1;
    const bodyTall = v.bodyTall || 1;
    const neckX = x + f.x * 11.4 * s;
    const neckY = y - 7 * s + headLift * 0.26 * s;
    const headX = x + f.x * 18.8 * s;
    const headY = y - 6.5 * s + headLift * 0.38 * s;
    const muzzleX = x + f.x * 23.8 * s;
    const rumpX = x - f.x * 8.8 * s;

    drawAnimalShadow(x, y + 11 * s, (profile.anatomy.shadowRx || 20) * s, (profile.anatomy.shadowRy || 7) * s, 0.31);
    drawHoofLeg(rumpX - f.x * 2.7 * s, y + 1.6 * s, 12.8 * s, shade(p.leg, -6), '#2d221b', 1.85 * s, -f.x * 0.85 * s);
    drawHoofLeg(x - f.x * 1.6 * s, y + 1.2 * s, 13.2 * s, p.leg, '#2d221b', 1.9 * s, f.x * 0.25 * s);
    drawEllipse(x - f.x * 10.7 * s, y + 1.2 * s, 7.3 * s, 4.8 * s, shade(p.body, -16), profile.outline, 1.05, f.x * 0.16);
    drawEllipse(x, y, 15.9 * s * stretch, 7.9 * s * bodyTall, p.body, profile.outline, 1.45);
    drawEllipse(x - f.x * 0.8 * s, y + 0.9 * s, 8 * s, 4.6 * s, p.flank, null, 0, f.x * -0.08);
    drawEllipse(x + f.x * 5.2 * s, y + 0.1 * s, 6.1 * s, 2.8 * s, p.chest, null, 0, f.x * 0.14);
    drawEllipse(rumpX, y + 1.6 * s, 5.3 * s, 2.5 * s, p.rump || p.chest, null, 0, f.x * -0.12);
    drawEllipse(x - f.x * 13 * s, y - 1.7 * s + v.tailLift * 0.85 * s, 2.3 * s, 1.8 * s, p.tail, profile.outline, 0.8, f.x * (-0.18 + v.tailLift * 0.12));
    drawHoofLeg(x + f.x * 4.9 * s, y + 0.95 * s, 13.7 * s, p.leg, '#2d221b', 1.9 * s, -f.x * 0.32 * s);
    drawHoofLeg(x + f.x * 10 * s, y + 0.55 * s, 13.9 * s, shade(p.leg, -6), '#2d221b', 1.8 * s, f.x * 0.92 * s);
    drawOrganicBlob(neckX, neckY, 2.9 * s, 8.8 * s, p.neck || p.bodyLight, profile.outline, 1.05, {
      seed: profile.seed + 23,
      lobes: 4,
      wobble: 0.55 * s,
      rotation: f.x * -0.28,
      flatBottom: 0.92
    });
    drawOrganicBlob(headX, headY, 4.5 * s, 3.4 * s, p.head || p.bodyLight, profile.outline, 1.2, {
      seed: profile.seed + 41,
      lobes: 4,
      wobble: 0.7 * s,
      rotation: f.x * -0.08,
      flatBottom: 0.94
    });
    drawSnout(muzzleX, headY + 0.28 * s, 3 * s, 1.55 * s, p.snout || p.chest, profile.outline, p.nose);
    drawEllipse(muzzleX - f.x * 1.1 * s, headY + 1.15 * s, 2.2 * s, 0.9 * s, p.chest, null, 0, f.x * 0.05);
    drawTriangle([
      { x: headX + f.x * 0.2 * s, y: headY - 2.6 * s },
      { x: headX - f.x * 2.7 * s, y: headY - 6.8 * s + v.earTilt * 0.8 * s },
      { x: headX - f.x * 1.1 * s, y: headY - 3.2 * s }
    ], p.ear || p.head || p.bodyLight, profile.outline);
    drawTriangle([
      { x: headX - f.x * 0.9 * s, y: headY - 2.4 * s },
      { x: headX - f.x * 3.8 * s, y: headY - 6.2 * s + v.earTilt * 0.65 * s },
      { x: headX - f.x * 2.4 * s, y: headY - 3 * s }
    ], shade(p.ear || p.head || p.bodyLight, -10), profile.outline);
    drawAntlers(headX - f.x * 2.6 * s, headY - 4.7 * s, f.x, p.antler, s, v.earSpread || 0);
    drawAnimalEye(headX + f.x * 0.8 * s, headY - 0.55 * s, 1 * s, p.eye);
    drawCircle(muzzleX + f.x * 1.65 * s, headY + 0.4 * s, 0.85 * s, p.nose);
    drawMobHealth(mob, x, mob.py - 20, profile.healthColor);
    return true;
  }

  function drawGoatPawn(mob) {
    const profile = animalProfile(mob);
    const p = profile.palette;
    const v = profile.variation;
    const s = profile.scale || 1;
    const f = animalFacing(mob);
    const x = mob.px;
    const y = mob.py + 13;
    const stretch = v.bodyStretch || 1;
    const tall = v.bodyTall || 1;
    const headLift = v.headLift || 0;
    const neckX = x + f.x * 11.2 * s;
    const neckY = y - 4.7 * s + headLift * 0.24 * s;
    const headX = x + f.x * 17.1 * s;
    const headY = y - 4.5 * s + headLift * 0.3 * s;
    const snoutX = x + f.x * 21.3 * s;

    drawAnimalShadow(x, y + 10 * s, (profile.anatomy.shadowRx || 17) * s, (profile.anatomy.shadowRy || 6.6) * s, 0.3);
    drawHoofLeg(x - 7.6 * s, y + 1.9 * s, 10.4 * s, shade(p.leg, -4), p.hoof, 1.75 * s, -f.x * 0.72 * s);
    drawHoofLeg(x - 1.7 * s, y + 1.3 * s, 10.8 * s, p.leg, p.hoof, 1.8 * s, f.x * 0.32 * s);
    drawTailStroke(
      x - f.x * 13.8 * s,
      y - 1.8 * s,
      x - f.x * 15.8 * s,
      y - 5 * s + v.tailLift * 1.7 * s,
      p.tail,
      1.6 * s,
      -f.x * 1.6 * s
    );
    drawEllipse(x, y + 0.1 * s, 14.2 * s * stretch, 7.8 * s * tall, p.body, profile.outline, 1.45);
    drawEllipse(x - f.x * 1.5 * s, y + 0.9 * s, 6.8 * s, 3.9 * s, p.flank, null, 0, f.x * -0.08);
    drawEllipse(x + f.x * 4.9 * s, y + 0.8 * s, 5.8 * s, 2.8 * s, p.bodyLight, null, 0, f.x * 0.1);
    drawHoofLeg(x + 4.9 * s, y + 1.2 * s, 10.9 * s, p.leg, p.hoof, 1.8 * s, -f.x * 0.26 * s);
    drawHoofLeg(x + 9.8 * s, y + 0.7 * s, 10.6 * s, shade(p.leg, -8), p.hoof, 1.7 * s, f.x * 0.82 * s);
    drawOrganicBlob(neckX, neckY, 2.7 * s, 6.4 * s, p.neck || p.bodyLight, profile.outline, 1 * s, {
      seed: profile.seed + 11,
      lobes: 4,
      wobble: 0.5 * s,
      rotation: f.x * -0.25,
      flatBottom: 0.92
    });
    drawOrganicBlob(headX, headY, 4.8 * s, 3.5 * s, p.head, profile.outline, 1.2 * s, {
      seed: profile.seed + 19,
      lobes: 4,
      wobble: 0.58 * s,
      rotation: f.x * -0.06,
      flatBottom: 0.94
    });
    drawSnout(snoutX, headY + 0.35 * s, 2.35 * s, 1.35 * s, p.snout || p.bodyLight, profile.outline, shade(p.headDark || p.head, -18));
    drawTriangle([
      { x: headX - f.x * 0.6 * s, y: headY - 2.1 * s },
      { x: headX - f.x * 3.9 * s, y: headY - 3.8 * s + v.earTilt * 0.5 * s },
      { x: headX - f.x * 2.2 * s, y: headY - 0.4 * s }
    ], p.ear || p.head, profile.outline);
    drawTriangle([
      { x: headX + f.x * 0.7 * s, y: headY - 1.8 * s },
      { x: headX - f.x * 1.7 * s, y: headY - 4.4 * s + v.earTilt * 0.35 * s },
      { x: headX + f.x * 0.2 * s, y: headY - 0.2 * s }
    ], shade(p.ear || p.head, -8), profile.outline);
    drawGoatHorn(headX - f.x * 2.6 * s, headY - 4.2 * s, f.x, p.horn, s, v.hornTilt || 0);
    drawGoatHorn(headX - f.x * 0.9 * s, headY - 4.5 * s, f.x, p.horn, s, -(v.hornTilt || 0) * 0.55);
    drawOrganicBlob(headX - f.x * 0.6 * s, headY + 4.1 * s, 1.25 * s, 2.8 * s, p.beard, profile.outline, 0.8 * s, {
      seed: profile.seed + 29,
      lobes: 4,
      wobble: 0.38 * s,
      rotation: f.x * 0.12,
      flatBottom: 0.86
    });
    drawAnimalEye(headX + f.x * 0.8 * s, headY - 0.45 * s, 1 * s, p.eye);
    drawCircle(snoutX + f.x * 1.2 * s, headY + 0.4 * s, 0.82 * s, shade(p.headDark || p.head, -18));
    drawMobHealth(mob, x, mob.py - 19 * s, profile.healthColor);
    return true;
  }

  function drawSheepPawn(mob) {
    const profile = animalProfile(mob);
    const p = profile.palette;
    const v = profile.variation;
    const s = profile.scale || 1;
    const f = animalFacing(mob);
    const x = mob.px;
    const y = mob.py + 13;
    const stretch = v.bodyStretch || 1;
    const tall = v.bodyTall || 1;
    const fluff = v.fluff || 1;

    drawAnimalShadow(x, y + 10 * s, (profile.anatomy.shadowRx || 18) * s, (profile.anatomy.shadowRy || 7.1) * s, 0.3);
    drawHoofLeg(x - 7.8 * s, y + 2.8 * s, 9.8 * s, shade(p.leg, -6), p.hoof, 1.45 * s, -f.x * 0.45 * s, 0.6);
    drawHoofLeg(x - 2 * s, y + 2.4 * s, 10.1 * s, p.leg, p.hoof, 1.55 * s, f.x * 0.2 * s, 0.6);
    drawOrganicBlob(x - f.x * 13.5 * s, y - 0.8 * s + v.tailLift * 0.8 * s, 3.3 * s, 2.8 * s, p.tail, profile.outline, 0.9 * s, {
      seed: profile.seed + 91,
      lobes: 4,
      wobble: 0.8 * s,
      flatBottom: 0.82
    });
    drawEllipse(x, y + 0.8 * s, 13.2 * s * stretch, 8 * s * tall, p.body, profile.outline, 1.2);
    drawOrganicBlob(x, y - 0.4 * s, 15.8 * s * stretch, 10.4 * s * tall * fluff, p.wool, profile.outline, 1.5 * s, {
      seed: profile.seed,
      lobes: 7,
      wobble: 2.1 * s * fluff,
      flatBottom: 0.84
    });
    drawOrganicBlob(x - f.x * 1.5 * s, y - 2 * s, 10.4 * s * stretch, 6.5 * s * tall, 'rgba(255,255,255,.34)', null, 0, {
      seed: profile.seed + 33,
      lobes: 6,
      wobble: 1.1 * s,
      flatBottom: 0.82
    });
    drawHoofLeg(x + 4.6 * s, y + 2.2 * s, 10.1 * s, p.leg, p.hoof, 1.55 * s, -f.x * 0.25 * s, 0.6);
    drawHoofLeg(x + 9.4 * s, y + 1.8 * s, 9.9 * s, shade(p.leg, -10), p.hoof, 1.45 * s, f.x * 0.45 * s, 0.6);
    drawEllipse(x + f.x * 16.7 * s, y - 3.6 * s + v.headLift * 0.25 * s, 5.9 * s, 5.5 * s, p.face, profile.outline, 1.25);
    drawEllipse(x + f.x * 19.9 * s, y - 2.4 * s + v.headLift * 0.18 * s, 3.3 * s, 2.1 * s, p.faceDark, profile.outline, 0.95);
    drawEllipse(x + f.x * 14 * s, y - 7.2 * s + v.headLift * 0.2 * s, 1.7 * s, 3.5 * s, p.ear, profile.outline, 0.8, f.x * (-0.75 + v.earTilt * 0.32));
    drawEllipse(x + f.x * 19.1 * s, y - 7 * s + v.headLift * 0.2 * s, 1.8 * s, 3.4 * s, p.ear, profile.outline, 0.8, f.x * (0.48 + v.earTilt * 0.22));
    drawAnimalEye(x + f.x * 18 * s, y - 4.6 * s + v.headLift * 0.12 * s, 0.95 * s, p.eye);
    drawCircle(x + f.x * 21.3 * s, y - 2.3 * s + v.headLift * 0.1 * s, 0.75 * s, shade(p.faceDark, -18));
    drawMobHealth(mob, x, mob.py - 19 * s, profile.healthColor);
    return true;
  }

  function drawPigPawn(mob) {
    const profile = animalProfile(mob);
    const p = profile.palette;
    const v = profile.variation;
    const s = profile.scale || 1;
    const f = animalFacing(mob);
    const x = mob.px;
    const y = mob.py + 14;
    const stretch = v.bodyStretch || 1;
    const tall = v.bodyTall || 1;
    const headLift = v.headLift || 0;
    const headX = x + f.x * 15.6 * s;
    const headY = y - 2.2 * s + headLift * 0.18 * s;
    const snoutX = x + f.x * 20.6 * s;

    drawAnimalShadow(x, y + 9.8 * s, (profile.anatomy.shadowRx || 17) * s, (profile.anatomy.shadowRy || 6.8) * s, 0.29);
    drawHoofLeg(x - 7.6 * s, y + 2.5 * s, 8.3 * s, shade(p.leg, -4), p.hoof, 1.65 * s, -f.x * 0.12 * s, 0.64);
    drawHoofLeg(x - 2.5 * s, y + 2.7 * s, 8.1 * s, p.leg, p.hoof, 1.7 * s, f.x * 0.22 * s, 0.64);
    drawEllipse(x, y + 0.5 * s, 16.3 * s * stretch, 8.5 * s * tall, p.body, profile.outline, 1.45);
    drawEllipse(x - f.x * 1 * s, y + 2 * s, 8.4 * s, 4.2 * s, p.belly || p.bodyLight, null, 0, f.x * -0.05);
    drawEllipse(x - f.x * 0.9 * s, y + 0.9 * s, 7.8 * s, 4.2 * s, p.flank, null, 0, f.x * -0.08);
    drawEllipse(x - f.x * 13 * s, y - 3.4 * s + v.tailLift * 1.1 * s, 1.2 * s, 1.2 * s, p.tail, profile.outline, 0.8);
    drawTailStroke(
      x - f.x * 13.9 * s,
      y - 3.6 * s + v.tailLift * 1.1 * s,
      x - f.x * 16 * s,
      y - 5.2 * s + v.tailLift * 1.35 * s,
      p.tail,
      1.25 * s,
      f.x * 2.1 * s
    );
    drawHoofLeg(x + 4.7 * s, y + 2.6 * s, 8.2 * s, p.leg, p.hoof, 1.7 * s, -f.x * 0.08 * s, 0.64);
    drawHoofLeg(x + 9.9 * s, y + 2.3 * s, 8 * s, shade(p.leg, -8), p.hoof, 1.6 * s, f.x * 0.28 * s, 0.64);
    drawOrganicBlob(headX, headY, 5.4 * s, 4.4 * s, p.head || p.bodyLight, profile.outline, 1.2 * s, {
      seed: profile.seed + 7,
      lobes: 4,
      wobble: 0.7 * s,
      rotation: f.x * -0.02,
      flatBottom: 0.92
    });
    drawTriangle([
      { x: headX - f.x * 1.4 * s, y: headY - 1.8 * s },
      { x: headX - f.x * 4.8 * s, y: headY - 3.2 * s + v.earTilt * 0.4 * s },
      { x: headX - f.x * 2.5 * s, y: headY + 0.6 * s }
    ], p.ear, profile.outline);
    drawTriangle([
      { x: headX + f.x * 0.6 * s, y: headY - 1.7 * s },
      { x: headX - f.x * 2.4 * s, y: headY - 3.4 * s + v.earTilt * 0.35 * s },
      { x: headX - f.x * 0.4 * s, y: headY + 0.7 * s }
    ], shade(p.ear, -8), profile.outline);
    drawSnout(snoutX, headY + 1 * s, 3.6 * s, 2.45 * s, p.snout, profile.outline, p.snoutDark || '#7f4c44');
    drawEllipse(snoutX - f.x * 1.1 * s, headY + 2 * s, 2.3 * s, 0.9 * s, p.belly || p.bodyLight, null, 0, f.x * 0.05);
    drawAnimalEye(headX + f.x * 1 * s, headY - 0.7 * s, 0.95 * s, p.eye);
    drawMobHealth(mob, x, mob.py - 18 * s, profile.healthColor);
    return true;
  }

  function drawCowPawn(mob) {
    const profile = animalProfile(mob);
    const p = profile.palette;
    const v = profile.variation;
    const s = profile.scale || 1;
    const f = animalFacing(mob);
    const x = mob.px;
    const y = mob.py + 12.5;

    drawAnimalShadow(x, y + 11 * s, (profile.anatomy.shadowRx || 20) * s, (profile.anatomy.shadowRy || 7.4) * s, 0.31);
    drawHoofLeg(x - 9.8 * s, y + 2.3 * s, 12 * s, shade(p.leg, -4), p.hoof, 2.1 * s, -f.x * 0.7 * s, 0.58);
    drawHoofLeg(x - 3.1 * s, y + 2.1 * s, 12.2 * s, p.leg, p.hoof, 2.15 * s, f.x * 0.25 * s, 0.58);
    drawTailStroke(
      x - f.x * 17 * s,
      y - 3.8 * s,
      x - f.x * 19.5 * s,
      y + 8 * s + v.tailLift * 0.7 * s,
      p.tail,
      1.8 * s,
      -f.x * 2.4 * s
    );
    drawOrganicBlob(x - f.x * 19.8 * s, y + 8.3 * s + v.tailLift * 0.5 * s, 2.2 * s, 2.9 * s, p.spot, profile.outline, 0.7 * s, {
      seed: profile.seed + 81,
      wobble: 0.7 * s,
      lobes: 4
    });
    drawEllipse(x + f.x * 2 * s, y - 0.6 * s, 16.3 * s * (v.bodyStretch || 1), 9.7 * s * (v.bodyTall || 1), p.body, profile.outline, 1.55);
    drawEllipse(x - f.x * 4.6 * s, y + 0.8 * s, 8.2 * s, 4.8 * s, p.flank, null, 0, f.x * -0.08);
    drawEllipse(x + f.x * 4.9 * s, y + 1.2 * s, 8.2 * s, 4.2 * s, p.bodyLight, null, 0, f.x * 0.12);
    drawCowSpots(x, y, s * (v.markScale || 1), profile.seed + Math.floor((v.patternShift || 0) * 10), profile.outline, p.spot, [
      { x: -6.5, y: -1.6, rx: 4.3, ry: 3.2, rotation: -0.1 },
      { x: 2.1, y: 1.8, rx: 3.4, ry: 2.7, rotation: 0.3 },
      { x: 8.3 + (v.patternShift || 0) * 0.5, y: -2.4, rx: 4.1, ry: 3.1, rotation: -0.25 }
    ]);
    drawHoofLeg(x + 5.6 * s, y + 2 * s, 12.3 * s, p.leg, p.hoof, 2.15 * s, -f.x * 0.2 * s, 0.58);
    drawHoofLeg(x + 12.2 * s, y + 1.7 * s, 12.5 * s, shade(p.leg, -8), p.hoof, 2.05 * s, f.x * 0.65 * s, 0.58);
    drawEllipse(x + f.x * 15.8 * s, y - 5.8 * s + v.headLift * 0.3 * s, 6.7 * s, 7.1 * s, p.head, profile.outline, 1.3);
    drawEllipse(x + f.x * 21.2 * s, y - 3.4 * s + v.headLift * 0.18 * s, 4.7 * s, 2.8 * s, p.bodyLight, profile.outline, 1);
    drawEllipse(x + f.x * 13 * s, y - 7.8 * s + v.headLift * 0.24 * s, 2.3 * s, 4.2 * s, p.bodyLight, profile.outline, 0.9, f.x * (-0.48 + v.earTilt * 0.24));
    drawEllipse(x + f.x * 18.6 * s, y - 8.2 * s + v.headLift * 0.26 * s, 2.1 * s, 4 * s, p.bodyLight, profile.outline, 0.9, f.x * (0.32 + v.earTilt * 0.18));
    drawCowHorn(x + f.x * 13.7 * s, y - 10.3 * s + v.headLift * 0.16 * s, -f.x, p.horn, s, v.hornTilt || 0);
    drawCowHorn(x + f.x * 18.1 * s, y - 10.2 * s + v.headLift * 0.16 * s, f.x, p.horn, s, -(v.hornTilt || 0) * 0.7);
    drawAnimalEye(x + f.x * 18.1 * s, y - 5.9 * s + v.headLift * 0.15 * s, 1.1 * s, p.eye);
    drawCircle(x + f.x * 22.8 * s, y - 2.8 * s + v.headLift * 0.1 * s, 0.95 * s, shade(p.head, -24));
    drawMobHealth(mob, x, mob.py - 20 * s, profile.healthColor);
    return true;
  }

  function drawChickenPawn(mob) {
    const profile = animalProfile(mob);
    const p = profile.palette;
    const v = profile.variation;
    const s = profile.scale || 1;
    const f = animalFacing(mob);
    const x = mob.px;
    const y = mob.py + 16;

    drawAnimalShadow(x, y + 7 * s, (profile.anatomy.shadowRx || 10) * s, (profile.anatomy.shadowRy || 5) * s, 0.28);
    drawEllipse(x - f.x * 8.4 * s, y - 3.9 * s + v.tailLift * 0.5 * s, 3.7 * s, 8.7 * s, p.tail, profile.outline, 0.8, -f.x * 0.4);
    drawEllipse(x - f.x * 6.4 * s, y - 5.2 * s + v.tailLift * 0.6 * s, 3.3 * s, 7.9 * s, shade(p.tail, 8), profile.outline, 0.7, -f.x * 0.22);
    drawBirdLeg(x - 1.5 * s, y + 5.5 * s, 6.6 * s, p.leg, f.x, 1.3 * s, 2.3 * s);
    drawBirdLeg(x + 2.1 * s, y + 5.2 * s, 6.4 * s, shade(p.leg, -8), f.x, 1.25 * s, 2.1 * s);
    drawEllipse(x, y, 9.2 * s * (v.bodyStretch || 1), 10.3 * s * (v.bodyTall || 1), p.body, profile.outline, 1.4);
    drawEllipse(x - f.x * 0.4 * s, y + 2.3 * s, 5.3 * s, 4.6 * s, p.bodyLight, null, 0, f.x * 0.08);
    drawWingPatch(x - f.x * 2.4 * s, y + 1 * s, 5.4 * s, 6.8 * s, p.wing, profile.outline, f.x * -0.1);
    drawCircle(x + f.x * 7.3 * s, y - 8.9 * s + v.headLift * 0.3 * s, 5.1 * s, p.body, profile.outline, 1.2);
    drawTriangle([
      { x: x + f.x * 10.8 * s, y: y - 8.8 * s + v.headLift * 0.28 * s },
      { x: x + f.x * 17 * s, y: y - 7.2 * s + v.headLift * 0.12 * s },
      { x: x + f.x * 10.7 * s, y: y - 5.6 * s + v.headLift * 0.18 * s }
    ], p.beak, profile.outline);
    drawOrganicBlob(x + f.x * 4.7 * s, y - 14.7 * s + v.headLift * 0.18 * s, 2.8 * s, 2.2 * s, p.comb, profile.outline, 0.75 * s, {
      seed: profile.seed + 12,
      lobes: 4,
      wobble: 0.8 * s,
      flatBottom: 0.8
    });
    drawAnimalEye(x + f.x * 8.2 * s, y - 9.3 * s + v.headLift * 0.18 * s, 0.92 * s, p.eye);
    drawMobHealth(mob, x, mob.py - 16 * s, profile.healthColor);
    return true;
  }

  function drawDuckPawn(mob) {
    const profile = animalProfile(mob);
    const p = profile.palette;
    const v = profile.variation;
    const s = profile.scale || 1;
    const f = animalFacing(mob);
    const x = mob.px;
    const y = mob.py + 16;

    drawAnimalShadow(x, y + 7 * s, (profile.anatomy.shadowRx || 11) * s, (profile.anatomy.shadowRy || 5.1) * s, 0.28);
    drawBirdLeg(x - 1.2 * s, y + 4.8 * s, 5.8 * s, p.leg, f.x, 1.2 * s, 2 * s);
    drawBirdLeg(x + 2.2 * s, y + 4.5 * s, 5.5 * s, shade(p.leg, -8), f.x, 1.15 * s, 1.9 * s);
    drawEllipse(x - f.x * 7.9 * s, y - 1.8 * s + v.tailLift * 0.35 * s, 3.6 * s, 3 * s, p.tail, profile.outline, 0.8, f.x * -0.5);
    drawEllipse(x, y, 9.8 * s * (v.bodyStretch || 1), 8.1 * s * (v.bodyTall || 1), p.body, profile.outline, 1.35);
    drawEllipse(x - f.x * 0.8 * s, y + 0.5 * s, 6.2 * s, 4.2 * s, p.bodyLight, null, 0, f.x * 0.1);
    drawWingPatch(x - f.x * 1.8 * s, y + 0.9 * s, 5.7 * s, 4.3 * s, p.wing, profile.outline, f.x * -0.08);
    drawEllipse(x + f.x * 7.4 * s, y - 7.2 * s + v.headLift * 0.25 * s, 3.2 * s, 6.2 * s, p.head, profile.outline, 1);
    drawCircle(x + f.x * 9.3 * s, y - 10.2 * s + v.headLift * 0.35 * s, 4.8 * s, p.head, profile.outline, 1.1);
    drawEllipse(x + f.x * 14.2 * s, y - 8.7 * s + v.headLift * 0.26 * s, 5.4 * s, 2.3 * s, p.beak, profile.outline, 1);
    drawAnimalEye(x + f.x * 10.1 * s, y - 11.2 * s + v.headLift * 0.18 * s, 0.9 * s, p.eye);
    drawMobHealth(mob, x, mob.py - 16 * s, profile.healthColor);
    return true;
  }

  function drawTurkeyPawn(mob) {
    const profile = animalProfile(mob);
    const p = profile.palette;
    const v = profile.variation;
    const s = profile.scale || 1;
    const f = animalFacing(mob);
    const x = mob.px;
    const y = mob.py + 16;

    drawAnimalShadow(x, y + 7 * s, (profile.anatomy.shadowRx || 12) * s, (profile.anatomy.shadowRy || 5.6) * s, 0.29);
    for (let i = -2; i <= 2; i++) {
      drawEllipse(
        x - f.x * 9.5 * s,
        y - 4.4 * s + i * 2.1 * s + v.tailLift * 0.2 * s,
        4.4 * s,
        9.4 * s,
        i === 0 ? shade(p.tail, 10) : p.tail,
        profile.outline,
        0.7 * s,
        i * 0.2
      );
    }
    drawBirdLeg(x - 1.3 * s, y + 5.8 * s, 7 * s, p.leg, f.x, 1.35 * s, 2.3 * s);
    drawBirdLeg(x + 2.3 * s, y + 5.6 * s, 6.7 * s, shade(p.leg, -10), f.x, 1.3 * s, 2.2 * s);
    drawEllipse(x, y, 9.4 * s * (v.bodyStretch || 1), 10.8 * s * (v.bodyTall || 1), p.body, profile.outline, 1.4);
    drawEllipse(x - f.x * 0.8 * s, y + 1.5 * s, 5.8 * s, 5 * s, p.bodyLight, null, 0, f.x * 0.1);
    drawWingPatch(x - f.x * 1.7 * s, y + 1.2 * s, 5.8 * s, 6.4 * s, p.wing, profile.outline, f.x * -0.1);
    drawEllipse(x + f.x * 6.4 * s, y - 6.3 * s + v.headLift * 0.18 * s, 2.3 * s, 6.7 * s, p.head, profile.outline, 1, f.x * -0.08);
    drawCircle(x + f.x * 8.6 * s, y - 9.7 * s + v.headLift * 0.3 * s, 3.9 * s, p.head, profile.outline, 1.05);
    drawTriangle([
      { x: x + f.x * 11.6 * s, y: y - 9.8 * s + v.headLift * 0.22 * s },
      { x: x + f.x * 16 * s, y: y - 8.5 * s + v.headLift * 0.12 * s },
      { x: x + f.x * 11.7 * s, y: y - 7.1 * s + v.headLift * 0.18 * s }
    ], p.beak, profile.outline);
    drawTailStroke(x + f.x * 8.1 * s, y - 8.8 * s, x + f.x * 9.8 * s, y - 5.4 * s, p.comb, 1.5 * s, 1 * s);
    drawOrganicBlob(x + f.x * 7.4 * s, y - 12.8 * s + v.headLift * 0.12 * s, 1.9 * s, 1.8 * s, p.comb, profile.outline, 0.7 * s, {
      seed: profile.seed + 7,
      lobes: 4,
      wobble: 0.5 * s,
      flatBottom: 0.84
    });
    drawAnimalEye(x + f.x * 9.1 * s, y - 10.5 * s + v.headLift * 0.18 * s, 0.86 * s, p.eye);
    drawMobHealth(mob, x, mob.py - 17 * s, profile.healthColor);
    return true;
  }

  function drawSquirrelPawn(mob) {
    const profile = animalProfile(mob);
    const p = profile.palette;
    const v = profile.variation;
    const s = profile.scale || 1;
    const f = animalFacing(mob);
    const x = mob.px;
    const y = mob.py + 16;

    drawAnimalShadow(x, y + 7 * s, (profile.anatomy.shadowRx || 10) * s, (profile.anatomy.shadowRy || 5) * s, 0.28);
    drawOrganicBlob(x - f.x * 8.2 * s, y - 9 * s + v.tailLift * 0.7 * s, 5.6 * s, 14.2 * s * (v.fluff || 1), p.tail, profile.outline, 1.2 * s, {
      seed: profile.seed + 18,
      lobes: 5,
      wobble: 1.6 * s,
      rotation: f.x * 0.32,
      flatBottom: 0.9
    });
    drawOrganicBlob(x - f.x * 9.8 * s, y - 10.7 * s + v.tailLift * 0.9 * s, 3.4 * s, 9.5 * s, p.tailLight, null, 0, {
      seed: profile.seed + 32,
      lobes: 4,
      wobble: 1.1 * s,
      rotation: f.x * 0.28,
      flatBottom: 0.94
    });
    drawEllipse(x, y, 9.4 * s * (v.bodyStretch || 1), 6.8 * s * (v.bodyTall || 1), p.body, profile.outline, 1.3);
    drawEllipse(x - f.x * 1.1 * s, y + 1.4 * s, 5.4 * s, 3.7 * s, p.belly, null, 0, f.x * -0.08);
    drawCircle(x + f.x * 8.3 * s, y - 4.3 * s + v.headLift * 0.15 * s, 5.2 * s, p.bodyLight, profile.outline, 1.2);
    drawTriangle([
      { x: x + f.x * 7.1 * s, y: y - 9.2 * s + v.headLift * 0.12 * s },
      { x: x + f.x * 8.2 * s, y: y - 14.1 * s + v.headLift * 0.18 * s },
      { x: x + f.x * 10.7 * s, y: y - 10 * s + v.headLift * 0.1 * s }
    ], p.bodyLight, profile.outline);
    drawTriangle([
      { x: x + f.x * 10.5 * s, y: y - 8.8 * s + v.headLift * 0.12 * s },
      { x: x + f.x * 12.4 * s, y: y - 13 * s + v.headLift * 0.18 * s },
      { x: x + f.x * 13.1 * s, y: y - 8.9 * s + v.headLift * 0.1 * s }
    ], p.bodyLight, profile.outline);
    drawLine(x + f.x * 2.8 * s, y + 2.2 * s, x + f.x * 4.8 * s, y + 8.2 * s, p.leg, 1.3 * s);
    drawLine(x - f.x * 1.8 * s, y + 2.5 * s, x - f.x * 0.5 * s, y + 8.4 * s, shade(p.leg, -6), 1.25 * s);
    drawAnimalEye(x + f.x * 10.5 * s, y - 4.8 * s + v.headLift * 0.08 * s, 0.95 * s, p.eye);
    drawCircle(x + f.x * 12.9 * s, y - 2.8 * s + v.headLift * 0.05 * s, 0.8 * s, shade(p.bodyLight, -34));
    drawMobHealth(mob, x, mob.py - 16, profile.healthColor);
    return true;
  }

  function drawTurtlePawn(mob) {
    const profile = animalProfile(mob);
    const p = profile.palette;
    const v = profile.variation;
    const s = profile.scale || 1;
    const f = animalFacing(mob);
    const x = mob.px;
    const y = mob.py + 15;

    drawAnimalShadow(x, y + 8 * s, (profile.anatomy.shadowRx || 13) * s, (profile.anatomy.shadowRy || 5) * s, 0.28);
    drawEllipse(x - 7.8 * s, y + 6.8 * s, 2.8 * s, 2.2 * s, p.skinDark, profile.outline, 0.7, -0.25);
    drawEllipse(x + 7.4 * s, y + 6.8 * s, 2.8 * s, 2.2 * s, p.skinDark, profile.outline, 0.7, 0.25);
    drawEllipse(x - 7.4 * s, y - 6.2 * s, 2.7 * s, 2.1 * s, p.skinDark, profile.outline, 0.7, -0.2);
    drawEllipse(x + 7 * s, y - 6.1 * s, 2.7 * s, 2.1 * s, p.skinDark, profile.outline, 0.7, 0.2);
    drawEllipse(x, y, 12.4 * s * (v.bodyStretch || 1), 8.8 * s * (v.bodyTall || 1), p.shell, profile.outline, 1.5);
    drawEllipse(x, y - 0.4 * s, 8.6 * s, 5.8 * s, p.shellLight, 'rgba(31,42,25,.45)', 0.9);
    drawEllipse(x + f.x * 12.6 * s, y - 0.7 * s + v.headLift * 0.12 * s, 4.8 * s, 4.2 * s, p.skin, profile.outline, 1.1);
    drawEllipse(x - f.x * 10.9 * s, y + 0.1 * s, 3.3 * s, 2.7 * s, p.skinDark, profile.outline, 0.8);
    drawLine(x - 4.2 * s, y - 4.3 * s, x, y - 0.4 * s, p.shellDark, 1 * s);
    drawLine(x + 4.2 * s, y - 4.3 * s, x, y - 0.4 * s, p.shellDark, 1 * s);
    drawLine(x - 5.2 * s, y + 1 * s, x + 5.2 * s, y + 1 * s, p.shellDark, 1 * s);
    drawLine(x, y - 5.2 * s, x, y + 5 * s, p.shellDark, 1 * s);
    drawAnimalEye(x + f.x * 13.8 * s, y - 1.3 * s + v.headLift * 0.08 * s, 0.9 * s, p.eye);
    drawMobHealth(mob, x, mob.py - 17, profile.healthColor);
    return true;
  }

  window.HavenfallAnimalRenderer = Object.freeze({
    drawMob: drawAnimalPawn
  });
})();
