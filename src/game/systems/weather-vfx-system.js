'use strict';

(() => {
  if (window.HavenfallContext?.weatherVfxInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.weatherVfxInstalled = true;

  const VERSION = 'weather-vfx-layered-rain-v1';
  const drops = [];
  const flashes = [];
  let currentProfileKey = '';
  let windSeed = Math.random() * 1000;

  const profiles = Object.freeze({
    low: {
      key: 'low',
      mist: 0.018,
      layers: [
        { name: 'main', count: 46, speed: 620, length: 18, alpha: 0.22, width: 0.8, drift: 58 }
      ],
      ripples: false,
      splashChance: 0
    },
    medium: {
      key: 'medium',
      mist: 0.032,
      layers: [
        { name: 'far', count: 34, speed: 360, length: 11, alpha: 0.12, width: 0.7, drift: 34 },
        { name: 'main', count: 72, speed: 690, length: 22, alpha: 0.28, width: 0.95, drift: 74 },
        { name: 'near', count: 18, speed: 930, length: 31, alpha: 0.20, width: 1.15, drift: 104 }
      ],
      ripples: true,
      splashChance: 0.18
    },
    high: {
      key: 'high',
      mist: 0.048,
      layers: [
        { name: 'far', count: 54, speed: 390, length: 12, alpha: 0.14, width: 0.75, drift: 42 },
        { name: 'main', count: 116, speed: 760, length: 25, alpha: 0.34, width: 1.05, drift: 92 },
        { name: 'near', count: 42, speed: 1080, length: 38, alpha: 0.26, width: 1.35, drift: 132 }
      ],
      ripples: true,
      splashChance: 0.34
    }
  });

  function particleQuality() {
    return window.HavenfallSettings?.get?.('graphics.particles', 'medium') || settings?.graphics?.particles || 'medium';
  }

  function waterQuality() {
    return window.HavenfallSettings?.get?.('graphics.waterQuality', 'medium') || settings?.graphics?.waterQuality || 'medium';
  }

  function rainActive() {
    return !!state && state.weather === 'chuva';
  }

  function profileForQuality() {
    const quality = particleQuality();
    if (quality === 'off') return null;
    return profiles[quality] || profiles.medium;
  }

  function hash01(a, b, c = 0) {
    let n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  function makeDrop(layer, index) {
    return {
      layer: layer.name,
      x: hash01(index, layer.speed, 1),
      y: hash01(index, layer.speed, 2),
      phase: hash01(index, layer.speed, 3),
      wobble: hash01(index, layer.speed, 4),
      lengthJitter: 0.72 + hash01(index, layer.speed, 5) * 0.56,
      alphaJitter: 0.75 + hash01(index, layer.speed, 6) * 0.45,
      speedJitter: 0.82 + hash01(index, layer.speed, 7) * 0.38,
      layerDef: layer
    };
  }

  function rebuildDrops(profile) {
    drops.length = 0;
    currentProfileKey = profile?.key || 'off';
    if (!profile) return;
    for (const layer of profile.layers) {
      for (let i = 0; i < layer.count; i++) drops.push(makeDrop(layer, i + drops.length * 13));
    }
  }

  function ensureDrops(profile) {
    const key = profile?.key || 'off';
    if (currentProfileKey !== key) rebuildDrops(profile);
  }

  function screenRainBounds() {
    const safe = typeof cameraSafeViewport === 'function' ? cameraSafeViewport() : { width: canvas.width, height: canvas.height, bottomReserved: 0 };
    return {
      width: Math.max(320, canvas.width || safe.width || window.innerWidth),
      height: Math.max(180, safe.height || canvas.height || window.innerHeight),
      fullHeight: Math.max(240, canvas.height || window.innerHeight)
    };
  }

  function weatherWind(time) {
    const slow = Math.sin(time * 0.00017 + windSeed) * 0.5 + Math.sin(time * 0.000043 + windSeed * 0.37) * 0.5;
    return slow * 0.85;
  }

  function drawMist(profile, bounds, time, wind) {
    if (!profile?.mist) return;
    const pulse = 0.82 + Math.sin(time * 0.0012 + windSeed) * 0.18;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const gradient = ctx.createLinearGradient(0, 0, bounds.width, bounds.height);
    gradient.addColorStop(0, `rgba(93, 132, 160, ${profile.mist * 0.45 * pulse})`);
    gradient.addColorStop(0.5, `rgba(125, 168, 196, ${profile.mist * pulse})`);
    gradient.addColorStop(1, `rgba(58, 82, 108, ${profile.mist * 0.55 * pulse})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, bounds.width, bounds.height);

    ctx.globalAlpha = profile.mist * 1.35;
    ctx.fillStyle = 'rgba(210, 230, 245, .55)';
    const offset = ((time * 0.014) + wind * 90) % 160;
    for (let y = 34; y < bounds.height; y += 92) {
      ctx.fillRect(-160 + offset, y, bounds.width + 320, 1);
    }
    ctx.restore();
  }

  function drawRainDrops(profile, bounds, time, wind) {
    ensureDrops(profile);
    if (!drops.length) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineCap = 'round';

    for (const drop of drops) {
      const layer = drop.layerDef;
      const travelY = ((drop.y + drop.phase + (time * layer.speed * drop.speedJitter) / Math.max(1, bounds.height * 1000)) % 1);
      const windX = wind * layer.drift;
      const localWobble = Math.sin(time * 0.0011 + drop.wobble * Math.PI * 2) * 10 * (layer.width / 1.2);
      let x = (drop.x * (bounds.width + 220)) - 110 + windX * travelY + localWobble;
      let y = travelY * (bounds.height + 130) - 70;
      if (x < -120) x += bounds.width + 240;
      if (x > bounds.width + 120) x -= bounds.width + 240;

      const length = layer.length * drop.lengthJitter;
      const angleX = wind * (length * 0.72) - layer.drift * 0.055;
      const alpha = layer.alpha * drop.alphaJitter;
      ctx.strokeStyle = `rgba(184, 214, 236, ${alpha})`;
      ctx.lineWidth = layer.width;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - angleX, y + length);
      ctx.stroke();
    }

    ctx.restore();
  }

  function isWaterTile(x, y) {
    if (!state?.terrain?.[y]) return false;
    if (state.terrain[y][x] === 'water') return true;
    if (state.world?.waterTiles?.includes?.(`${x},${y}`)) return true;
    return false;
  }

  function rippleAlphaForTile(x, y, time) {
    const phase = hash01(x, y, 11);
    const cycle = (time * 0.0015 + phase) % 1;
    const pulse = Math.sin(cycle * Math.PI);
    return pulse > 0 ? pulse : 0;
  }

  function drawWaterRipples(profile, time) {
    if (!profile?.ripples || waterQuality() === 'low') return;
    if (typeof visibleTileBounds !== 'function') return;

    const bounds = visibleTileBounds(0);
    const high = particleQuality() === 'high';
    const stride = high ? 2 : 3;
    const maxRipples = high ? 34 : 16;
    let drawn = 0;

    ctx.save();
    ctx.lineWidth = 1 / Math.max(0.75, viewTransform?.scale || 1);
    for (let y = bounds.startY; y <= bounds.endY; y++) {
      for (let x = bounds.startX; x <= bounds.endX; x++) {
        if (((x * 17 + y * 31) % stride) !== 0) continue;
        if (!isWaterTile(x, y)) continue;
        const chance = hash01(x, y, Math.floor(time / 700));
        if (chance > profile.splashChance) continue;
        const alphaPulse = rippleAlphaForTile(x, y, time);
        if (alphaPulse <= 0.02) continue;

        const cx = x * TILE + TILE * (0.22 + hash01(x, y, 21) * 0.56);
        const cy = y * TILE + TILE * (0.24 + hash01(x, y, 22) * 0.52);
        const radius = 4 + alphaPulse * (high ? 13 : 9);
        ctx.strokeStyle = `rgba(214, 235, 250, ${0.10 + alphaPulse * 0.15})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius * 1.22, radius * 0.56, 0, 0, Math.PI * 2);
        ctx.stroke();
        drawn++;
        if (drawn >= maxRipples) {
          ctx.restore();
          return;
        }
      }
    }
    ctx.restore();
  }

  function drawGroundSplashes(profile, bounds, time, wind) {
    if (!profile?.ripples || particleQuality() !== 'high') return;
    const count = 16;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < count; i++) {
      const phase = hash01(i, 99, 2);
      const t = (time * 0.0024 + phase) % 1;
      if (t > 0.32) continue;
      const alpha = (1 - t / 0.32) * 0.14;
      const x = hash01(i, 17, 4) * bounds.width + wind * 25;
      const y = bounds.height * (0.42 + hash01(i, 17, 5) * 0.56);
      ctx.strokeStyle = `rgba(220, 238, 250, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, y, 3 + t * 11, 1.5 + t * 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRainVfx() {
    if (!rainActive()) {
      if (currentProfileKey !== 'clear') {
        drops.length = 0;
        currentProfileKey = 'clear';
      }
      return;
    }

    const profile = profileForQuality();
    if (!profile) return;

    const time = performance.now();
    const bounds = screenRainBounds();
    const wind = weatherWind(time);

    drawMist(profile, bounds, time, wind);
    drawWaterRipples(profile, time);
    drawGroundSplashes(profile, bounds, time, wind);
    drawRainDrops(profile, bounds, time, wind);
  }

  drawRain = drawRainVfx;

  window.HavenfallWeatherVfx = Object.freeze({
    version: VERSION,
    reset() {
      drops.length = 0;
      flashes.length = 0;
      currentProfileKey = '';
      windSeed = Math.random() * 1000;
    },
    quality: particleQuality
  });
})();