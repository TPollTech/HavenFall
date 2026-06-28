'use strict';

(() => {
  const BIOME_COLORS = Object.freeze({
    forest: [34, 151, 118],
    desert: [205, 141, 47],
    snow: [160, 215, 232],
    rock: [117, 132, 148],
    water: [24, 88, 122]
  });

  const BIOME_LABELS = Object.freeze({
    forest: 'Floresta temperada',
    desert: 'Deserto seco',
    snow: 'Neve profunda',
    rock: 'Cordilheira rochosa',
    water: 'Bacia hídrica'
  });

  function injectPlanetScanStyle() {
    if (document.getElementById('planet-scan-ui-style')) return;
    const style = document.createElement('style');
    style.id = 'planet-scan-ui-style';
    style.textContent = `
      .planet-scan-screen {
        background:
          radial-gradient(circle at 72% 28%, rgba(245, 158, 11, .14), transparent 30%),
          radial-gradient(circle at 18% 18%, rgba(56, 189, 248, .13), transparent 28%),
          linear-gradient(135deg, #050812 0%, #080d17 48%, #03050a 100%);
        color: #e5eefc;
        overflow: hidden;
      }

      .planet-scan-screen::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background-image:
          linear-gradient(rgba(148, 163, 184, .045) 1px, transparent 1px),
          linear-gradient(90deg, rgba(148, 163, 184, .045) 1px, transparent 1px);
        background-size: 38px 38px;
        mask-image: radial-gradient(circle at center, black 0%, transparent 78%);
      }

      .planet-scan-shell {
        position: relative;
        z-index: 1;
        width: min(1180px, calc(100vw - 40px));
        max-height: calc(100vh - 44px);
        margin: 22px auto;
        display: grid;
        grid-template-columns: minmax(300px, 420px) minmax(420px, 1fr);
        gap: 18px;
        align-items: stretch;
      }

      .scan-panel {
        border: 1px solid rgba(125, 211, 252, .22);
        border-radius: 22px;
        background: linear-gradient(180deg, rgba(15, 23, 42, .86), rgba(3, 7, 18, .86));
        box-shadow: 0 26px 80px rgba(0,0,0,.48), inset 0 1px 0 rgba(255,255,255,.06);
        padding: 18px;
        overflow: hidden;
      }

      .scan-title-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
        margin-bottom: 14px;
      }

      .scan-title-row h1 {
        margin: 0;
        font-size: clamp(28px, 4vw, 46px);
        letter-spacing: .04em;
        color: #f8fafc;
      }

      .scan-title-row p {
        margin: 6px 0 0;
        color: rgba(203, 213, 225, .78);
        max-width: 58ch;
      }

      .scan-status-pill {
        flex: 0 0 auto;
        border: 1px solid rgba(251, 191, 36, .38);
        color: #fde68a;
        background: rgba(120, 53, 15, .18);
        border-radius: 999px;
        padding: 7px 10px;
        font-size: 11px;
        letter-spacing: .14em;
        text-transform: uppercase;
      }

      .scan-grid {
        display: grid;
        gap: 14px;
      }

      .scan-hologram-panel {
        min-height: 520px;
        display: grid;
        place-items: center;
        position: relative;
      }

      .scan-hologram-panel::after {
        content: '';
        position: absolute;
        inset: 16px;
        pointer-events: none;
        border-radius: 18px;
        background: linear-gradient(transparent 48%, rgba(125, 211, 252, .055) 50%, transparent 52%);
        background-size: 100% 7px;
        opacity: .65;
        mix-blend-mode: screen;
      }

      .scan-radar {
        --scan-a: 52%;
        --scan-b: 38%;
        --scan-c: 66%;
        width: min(430px, 56vw);
        aspect-ratio: 1;
        position: relative;
        isolation: isolate;
        border-radius: 50%;
        background:
          radial-gradient(circle at 50% 50%, rgba(34, 211, 238, .18) 0 28%, rgba(15, 23, 42, .42) 42%, rgba(3,7,18,.88) 70%),
          conic-gradient(from 140deg, rgba(56,189,248,.20), rgba(251,191,36,.16), rgba(56,189,248,.10), rgba(14,165,233,.24));
        box-shadow:
          0 0 0 1px rgba(125,211,252,.35),
          0 0 36px rgba(56,189,248,.28),
          inset 0 0 40px rgba(14,165,233,.16);
        overflow: hidden;
      }

      .scan-planet-canvas {
        position: absolute;
        inset: 0;
        z-index: 0;
        width: 100%;
        height: 100%;
        opacity: .95;
        filter: saturate(1.18) contrast(1.08);
      }

      .scan-radar::before {
        content: '';
        position: absolute;
        inset: 7%;
        z-index: 2;
        border-radius: 50%;
        border: 1px solid rgba(125,211,252,.28);
        background:
          linear-gradient(90deg, transparent 49%, rgba(125,211,252,.30) 50%, transparent 51%),
          linear-gradient(transparent 49%, rgba(125,211,252,.24) 50%, transparent 51%),
          repeating-radial-gradient(circle, transparent 0 37px, rgba(125,211,252,.18) 38px 39px);
        animation: scanPulse 2.8s ease-in-out infinite;
      }

      .scan-radar::after {
        content: '';
        position: absolute;
        inset: -30%;
        z-index: 3;
        background: conic-gradient(from 0deg, transparent 0deg, rgba(125,211,252,.36) 22deg, transparent 48deg);
        animation: scanSweep 5.2s linear infinite;
        mix-blend-mode: screen;
      }

      .scan-sector-label {
        position: absolute;
        z-index: 4;
        left: 18px;
        bottom: 16px;
        display: grid;
        gap: 2px;
        color: rgba(226,232,240,.78);
        font-size: 12px;
        letter-spacing: .14em;
        text-transform: uppercase;
      }

      .scan-sector-label b {
        color: #e0f2fe;
      }

      .scan-biome-legend {
        position: absolute;
        left: 24px;
        right: 24px;
        bottom: 22px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
        gap: 7px;
        z-index: 2;
      }

      .scan-biome-chip {
        border: 1px solid rgba(125, 211, 252, .15);
        background: rgba(2, 6, 23, .48);
        border-radius: 999px;
        padding: 5px 8px;
        display: flex;
        gap: 6px;
        align-items: center;
        color: rgba(226, 232, 240, .78);
        font-size: 10px;
        white-space: nowrap;
      }

      .scan-biome-chip i {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        box-shadow: 0 0 10px currentColor;
      }

      .scan-data-list,
      .scan-log-list,
      .scan-signature-list {
        display: grid;
        gap: 10px;
      }

      .scan-data-row {
        display: grid;
        grid-template-columns: 128px 1fr 42px;
        gap: 10px;
        align-items: center;
      }

      .scan-data-row span,
      .scan-signature-card small,
      .scan-log-list span {
        color: rgba(203,213,225,.74);
        font-size: 11px;
      }

      .scan-data-row b {
        color: #e0f2fe;
        font-size: 12px;
        text-align: right;
      }

      .scan-segments {
        display: grid;
        grid-template-columns: repeat(10, 1fr);
        gap: 4px;
      }

      .scan-segments i {
        height: 12px;
        border-radius: 4px;
        background: rgba(51,65,85,.75);
        border: 1px solid rgba(255,255,255,.04);
      }

      .scan-segments i.on {
        background: linear-gradient(180deg, rgba(125,211,252,.95), rgba(14,165,233,.70));
        box-shadow: 0 0 10px rgba(56,189,248,.35);
      }

      .scan-segments.amber i.on {
        background: linear-gradient(180deg, rgba(251,191,36,.95), rgba(217,119,6,.70));
        box-shadow: 0 0 10px rgba(251,191,36,.28);
      }

      .scan-signature-card {
        border: 1px solid rgba(125,211,252,.14);
        background: rgba(15,23,42,.58);
        border-radius: 14px;
        padding: 11px;
        display: grid;
        gap: 4px;
      }

      .scan-signature-card b {
        color: #f8fafc;
      }

      .scan-log-list span {
        border-left: 2px solid rgba(251,191,36,.55);
        padding-left: 9px;
      }

      .scan-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        flex-wrap: wrap;
        margin-top: 14px;
      }

      .scan-actions button,
      .scan-panel button {
        border: 1px solid rgba(125,211,252,.24);
        background: rgba(15,23,42,.72);
        color: #e5eefc;
        border-radius: 13px;
        padding: 10px 14px;
        cursor: pointer;
      }

      .scan-actions button.primary {
        border-color: rgba(251,191,36,.62);
        background: linear-gradient(180deg, rgba(251,191,36,.28), rgba(120,53,15,.32));
        color: #fff7ed;
      }

      @keyframes scanSweep { to { transform: rotate(360deg); } }
      @keyframes scanPulse { 50% { opacity: .62; transform: scale(.986); } }

      @media (max-width: 900px) {
        .planet-scan-shell {
          grid-template-columns: 1fr;
          overflow-y: auto;
        }
        .scan-hologram-panel {
          min-height: 390px;
        }
        .scan-radar {
          width: min(330px, 78vw);
        }
        .scan-biome-legend {
          position: relative;
          left: auto;
          right: auto;
          bottom: auto;
          margin-top: 12px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function stableHash(text) {
    if (typeof hashSeed === 'function') return hashSeed(String(text));
    let h = 2166136261;
    const str = String(text || 'scan');
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seededUnit(seed, x, y, salt = 'n') {
    return (stableHash(`${seed}|${salt}|${x}|${y}`) % 100000) / 100000;
  }

  function scanRandom(config, salt = 'sector-preview-v2') {
    const seed = `${config?.seed || 'scan'}|${config?.difficulty || 'normal'}|${config?.mapSize || 'giant'}|${salt}`;
    return typeof seededRandom === 'function' ? seededRandom(seed) : (() => seededUnit(seed, 1, 1));
  }

  function smooth(t) {
    return t * t * (3 - 2 * t);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function valueNoise(x, y, seed, scale, salt) {
    const gx = Math.floor(x / scale);
    const gy = Math.floor(y / scale);
    const tx = smooth((x / scale) - gx);
    const ty = smooth((y / scale) - gy);
    const a = seededUnit(seed, gx, gy, salt);
    const b = seededUnit(seed, gx + 1, gy, salt);
    const c = seededUnit(seed, gx, gy + 1, salt);
    const d = seededUnit(seed, gx + 1, gy + 1, salt);
    return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
  }

  function fractalNoise(x, y, seed, baseScale, salt) {
    let value = 0;
    let amp = 0.5;
    let total = 0;
    for (let octave = 0; octave < 4; octave++) {
      value += valueNoise(x, y, seed, Math.max(2, baseScale / (2 ** octave)), `${salt}-${octave}`) * amp;
      total += amp;
      amp *= 0.5;
    }
    return value / total;
  }

  function classifyBiome(nx, ny, height, moisture, temp, config) {
    const mapBias = ({ large: -0.04, huge: 0.01, giant: 0.05, infinite_chunks: 0.08 })[config.mapSize] || 0;
    if (height < 0.26) return 'water';
    if (height > 0.72 - mapBias) return 'rock';
    if (temp < 0.34 && moisture > 0.28) return 'snow';
    if (moisture < 0.35 && temp > 0.42) return 'desert';
    if (Math.abs(ny) > 0.68 && temp < 0.48) return 'snow';
    return 'forest';
  }

  function buildScanModel(config) {
    const seed = `${config?.seed || 'scan'}|planet-preview`;
    const rand = scanRandom(config, 'signatures');
    const size = 120;
    const counts = { forest: 0, desert: 0, snow: 0, rock: 0, water: 0 };
    const samples = [];

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nx = (x / (size - 1)) * 2 - 1;
        const ny = (y / (size - 1)) * 2 - 1;
        const radius = Math.sqrt(nx * nx + ny * ny);
        if (radius > 1) continue;
        const warp = fractalNoise(x + 100, y + 100, seed, 36, 'warp') - 0.5;
        const height = fractalNoise(x + warp * 18, y - warp * 18, seed, 42, 'height');
        const moisture = fractalNoise(x + 300, y + 40, seed, 58, 'moisture');
        const temp = Math.max(0, Math.min(1, 1 - Math.abs(ny) * 0.82 + (fractalNoise(x, y + 450, seed, 70, 'temp') - 0.5) * 0.34));
        const biome = classifyBiome(nx, ny, height, moisture, temp, config);
        counts[biome] += 1;
        samples.push({ x, y, nx, ny, height, moisture, temp, biome });
      }
    }

    const total = Math.max(1, samples.length);
    const biomeStats = Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Math.round((value / total) * 100)]));
    const dominantBiome = Object.entries(biomeStats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'forest';
    const eventCount = ({ low: 2, normal: 3, high: 4 })[config.eventIntensity] || 3;
    const difficultyBonus = ({ easy: -1, normal: 0, hard: 1, hardcore: 2 })[config.difficulty] || 0;
    const signatureCount = Math.max(2, eventCount + difficultyBonus);
    const signatures = [];
    const namesByBiome = {
      forest: ['Movimento orgânico', 'Agrupamento de fauna', 'Eco de vegetação densa'],
      desert: ['Eco térmico irregular', 'Poeira eletrostática', 'Baixa umidade crítica'],
      snow: ['Frente fria anômala', 'Gelo estrutural', 'Baixa assinatura térmica'],
      rock: ['Sinal metálico soterrado', 'Anomalia de teto natural', 'Falha geológica'],
      water: ['Bacia hídrica detectada', 'Reflexo orbital', 'Condensação instável']
    };

    for (let i = 0; i < signatureCount; i++) {
      const sample = samples[Math.floor(rand() * samples.length)] || samples[0];
      const pool = namesByBiome[sample?.biome || dominantBiome] || namesByBiome.forest;
      const name = pool[Math.floor(rand() * pool.length)] || pool[0];
      const range = Math.floor(12 + rand() * 78);
      const riskRoll = rand() + difficultyBonus * 0.12;
      const risk = riskRoll > 0.78 ? 'elevado' : riskRoll > 0.42 ? 'moderado' : 'baixo';
      signatures.push({
        name,
        range,
        risk,
        biome: sample?.biome || dominantBiome,
        nx: sample?.nx || 0,
        ny: sample?.ny || 0
      });
    }

    const geology = Math.min(98, Math.max(4, biomeStats.rock + biomeStats.desert * 0.45 + biomeStats.snow * 0.25 + 24));
    const biology = Math.min(98, Math.max(4, biomeStats.forest * 0.9 + biomeStats.water * 0.25 + 18));
    const climate = Math.min(98, Math.max(4, biomeStats.snow * 0.75 + biomeStats.desert * 0.65 + (({ low: 8, normal: 18, high: 32 })[config.eventIntensity] || 18)));
    const noise = Math.min(98, Math.max(4, 22 + difficultyBonus * 11 + signatureCount * 5 + rand() * 16));
    const landing = Math.min(98, Math.max(4, 86 - climate * 0.24 - noise * 0.18 - difficultyBonus * 5));

    return {
      seed,
      samples,
      biomeStats,
      dominantBiome,
      signatures,
      metrics: { geology, biology, climate, noise, landing }
    };
  }

  function scanSignatureName(signature, index) {
    const labels = {
      organic: 'Movimento orgânico',
      fauna: 'Agrupamento de fauna',
      ruin: 'Estrutura antiga',
      heat: 'Eco térmico',
      dust: 'Frente de poeira',
      cold: 'Frente fria',
      geology: 'Falha geológica',
      metal: 'Sinal metálico',
      collapse: 'Teto instável',
      water: 'Bacia hídrica',
      humidity: 'Condensação instável'
    };
    return `${labels[signature?.kind] || 'Assinatura orbital'} ${String(index + 1).padStart(2, '0')}`;
  }

  function biomeForSignature(signature, dominantBiome) {
    const map = {
      organic: 'forest',
      fauna: 'forest',
      ruin: dominantBiome,
      heat: 'desert',
      dust: 'desert',
      cold: 'snow',
      geology: 'rock',
      metal: 'rock',
      collapse: 'rock',
      water: 'water',
      humidity: 'water'
    };
    return map[signature?.kind] || dominantBiome || 'forest';
  }

  function modelFromWorldgenProfile(config, profile) {
    const model = buildScanModel(config);
    if (!profile) return model;
    const rand = scanRandom(config, 'profile-signature-placement');
    return {
      ...model,
      biomeStats: { ...(profile.biomeStats || model.biomeStats) },
      dominantBiome: profile.dominantBiome || model.dominantBiome,
      metrics: { ...(profile.metrics || model.metrics) },
      signatures: (profile.signatures || []).map((signature, index) => {
        const biome = biomeForSignature(signature, profile.dominantBiome || model.dominantBiome);
        const angle = rand() * Math.PI * 2;
        const radius = 0.18 + rand() * 0.68;
        return {
          ...signature,
          name: scanSignatureName(signature, index),
          range: Math.floor(14 + rand() * 76),
          risk: signature.risk || 'moderado',
          biome,
          nx: Math.cos(angle) * radius,
          ny: Math.sin(angle) * radius
        };
      })
    };
  }

  function segmentBar(value, amber = false) {
    const lit = Math.max(0, Math.min(10, Math.round(value / 10)));
    return `<div class="scan-segments ${amber ? 'amber' : ''}">${Array.from({ length: 10 }, (_, i) => `<i class="${i < lit ? 'on' : ''}"></i>`).join('')}</div>`;
  }

  function metricRows(model) {
    const rows = [
      ['Densidade geológica', model.metrics.geology, false],
      ['Atividade biológica', model.metrics.biology, false],
      ['Instabilidade climática', model.metrics.climate, true],
      ['Ruído atmosférico', model.metrics.noise, true],
      ['Integridade do pouso', model.metrics.landing, false]
    ];
    return rows.map(([label, value, amber]) => {
      const clamped = Math.max(4, Math.min(98, Math.round(value)));
      return `<div class="scan-data-row"><span>${escapeHtml(label)}</span>${segmentBar(clamped, amber)}<b>${clamped}%</b></div>`;
    }).join('');
  }

  function signatureCards(model) {
    return model.signatures.map((sig, i) => {
      const biome = BIOME_LABELS[sig.biome] || sig.biome;
      return `<div class="scan-signature-card"><b>${escapeHtml(sig.name)}</b><small>Assinatura ${String(i + 1).padStart(2, '0')} · ${escapeHtml(biome)} · ${sig.range}km · risco ${sig.risk}</small></div>`;
    }).join('');
  }

  function biomeLegend(model) {
    return Object.entries(model.biomeStats)
      .filter(([, pct]) => pct > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([key, pct]) => {
        const rgb = BIOME_COLORS[key] || [125, 211, 252];
        return `<span class="scan-biome-chip" style="color:rgb(${rgb.join(',')})"><i style="background:currentColor"></i>${escapeHtml(BIOME_LABELS[key] || key)} ${pct}%</span>`;
      }).join('');
  }

  function ensurePlanetCanvas() {
    const radar = document.querySelector('.scan-radar');
    if (!radar) return null;
    let canvas = document.getElementById('scanPlanetCanvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'scanPlanetCanvas';
      canvas.className = 'scan-planet-canvas';
      canvas.width = 420;
      canvas.height = 420;
      radar.prepend(canvas);
    }
    return canvas;
  }

  function ensureBiomeLegend() {
    const panel = document.querySelector('.scan-hologram-panel');
    if (!panel) return null;
    let legend = document.getElementById('scanBiomeLegend');
    if (!legend) {
      legend = document.createElement('div');
      legend.id = 'scanBiomeLegend';
      legend.className = 'scan-biome-legend';
      panel.appendChild(legend);
    }
    return legend;
  }

  function renderPlanetPreview(model) {
    const canvas = ensurePlanetCanvas();
    if (!canvas) return;
    const ctx2 = canvas.getContext('2d');
    const size = canvas.width;
    const center = size / 2;
    const radius = size * 0.43;
    ctx2.clearRect(0, 0, size, size);

    const imageSize = 180;
    const offscreen = document.createElement('canvas');
    offscreen.width = imageSize;
    offscreen.height = imageSize;
    const off = offscreen.getContext('2d');
    const img = off.createImageData(imageSize, imageSize);
    const seed = model.seed;

    for (let y = 0; y < imageSize; y++) {
      for (let x = 0; x < imageSize; x++) {
        const nx = (x / (imageSize - 1)) * 2 - 1;
        const ny = (y / (imageSize - 1)) * 2 - 1;
        const r = Math.sqrt(nx * nx + ny * ny);
        const idx = (y * imageSize + x) * 4;
        if (r > 1) {
          img.data[idx + 3] = 0;
          continue;
        }
        const warp = fractalNoise(x + 100, y + 100, seed, 54, 'warp') - 0.5;
        const height = fractalNoise(x + warp * 18, y - warp * 18, seed, 64, 'height');
        const moisture = fractalNoise(x + 300, y + 40, seed, 88, 'moisture');
        const temp = Math.max(0, Math.min(1, 1 - Math.abs(ny) * 0.82 + (fractalNoise(x, y + 450, seed, 90, 'temp') - 0.5) * 0.34));
        const biome = classifyBiome(nx, ny, height, moisture, temp, readNewGameConfigSafe?.() || defaultNewGameConfig);
        const rgb = BIOME_COLORS[biome] || BIOME_COLORS.forest;
        const light = 0.68 + height * 0.45 + (1 - r) * 0.16;
        const edge = Math.max(0, Math.min(1, (1 - r) * 5));
        img.data[idx] = Math.min(255, rgb[0] * light);
        img.data[idx + 1] = Math.min(255, rgb[1] * light);
        img.data[idx + 2] = Math.min(255, rgb[2] * light + 16);
        img.data[idx + 3] = Math.round(235 * edge);
      }
    }
    off.putImageData(img, 0, 0);

    ctx2.save();
    ctx2.beginPath();
    ctx2.arc(center, center, radius, 0, Math.PI * 2);
    ctx2.clip();
    ctx2.drawImage(offscreen, center - radius, center - radius, radius * 2, radius * 2);

    const glow = ctx2.createRadialGradient(center * 0.82, center * 0.72, radius * 0.04, center, center, radius);
    glow.addColorStop(0, 'rgba(255,255,255,.22)');
    glow.addColorStop(0.42, 'rgba(125,211,252,.06)');
    glow.addColorStop(1, 'rgba(2,6,23,.62)');
    ctx2.fillStyle = glow;
    ctx2.fillRect(center - radius, center - radius, radius * 2, radius * 2);
    ctx2.restore();

    ctx2.save();
    ctx2.strokeStyle = 'rgba(125,211,252,.32)';
    ctx2.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      const y = center + i * radius * 0.24;
      ctx2.beginPath();
      ctx2.ellipse(center, y, radius * Math.sqrt(Math.max(0.04, 1 - (i * 0.24) ** 2)), radius * 0.06, 0, 0, Math.PI * 2);
      ctx2.stroke();
    }
    for (let i = 0; i < 6; i++) {
      ctx2.beginPath();
      ctx2.ellipse(center, center, radius * Math.cos(i * Math.PI / 12), radius, 0, 0, Math.PI * 2);
      ctx2.stroke();
    }

    model.signatures.forEach((sig, i) => {
      const x = center + sig.nx * radius;
      const y = center + sig.ny * radius;
      const color = sig.risk === 'elevado' ? 'rgba(251,191,36,.95)' : sig.risk === 'moderado' ? 'rgba(125,211,252,.85)' : 'rgba(134,239,172,.75)';
      ctx2.strokeStyle = color;
      ctx2.fillStyle = color;
      ctx2.lineWidth = 1.5;
      ctx2.beginPath();
      ctx2.arc(x, y, 4 + (i % 3), 0, Math.PI * 2);
      ctx2.stroke();
      ctx2.beginPath();
      ctx2.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx2.fill();
    });

    ctx2.beginPath();
    ctx2.arc(center, center, radius, 0, Math.PI * 2);
    ctx2.strokeStyle = 'rgba(224,242,254,.42)';
    ctx2.lineWidth = 2;
    ctx2.stroke();
    ctx2.restore();
  }

  function safeLabelMapSize(value) {
    return typeof labelMapSize === 'function' ? labelMapSize(value) : value;
  }

  function safeLabelEventIntensity(value) {
    return typeof labelEventIntensity === 'function' ? labelEventIntensity(value) : value;
  }

  function refreshPlanetScan(config = null) {
    injectPlanetScanStyle();
    const baseConfig = config || (typeof newGameConfig !== 'undefined' && newGameConfig) || (typeof readNewGameConfigSafe === 'function' ? readNewGameConfigSafe() : defaultNewGameConfig);
    const activeConfig = typeof ensurePlanetScanOnConfig === 'function'
      ? ensurePlanetScanOnConfig(baseConfig)
      : { ...baseConfig, planetScan: typeof buildPlanetScanWorldgenProfile === 'function' ? buildPlanetScanWorldgenProfile(baseConfig) : null };
    if (typeof newGameConfig !== 'undefined') newGameConfig = activeConfig;
    const profile = activeConfig.planetScan || null;
    const model = modelFromWorldgenProfile(activeConfig, profile);
    const sector = profile?.sectorId || `HV-${String(stableHash(activeConfig.seed || 'scan')).slice(0, 5).toUpperCase()}`;

    const title = document.getElementById('scanSectorTitle');
    const meta = document.getElementById('scanSectorMeta');
    const metrics = document.getElementById('scanMetrics');
    const signatures = document.getElementById('scanSignatures');
    const log = document.getElementById('scanProcessingLog');
    const label = document.getElementById('scanRadarLabel');
    const legend = ensureBiomeLegend();

    renderPlanetPreview(model);

    if (title) title.textContent = activeConfig.colonyName || 'Primeiro Refúgio';
    if (meta) {
      const dominant = BIOME_LABELS[model.dominantBiome] || model.dominantBiome;
      meta.textContent = `Seed ${activeConfig.seed || 'sem seed'} · ${safeLabelMapSize(activeConfig.mapSize || 'giant')} · eventos ${safeLabelEventIntensity(activeConfig.eventIntensity || 'normal')} · dominante: ${dominant}`;
    }
    if (metrics) metrics.innerHTML = metricRows(model);
    if (signatures) signatures.innerHTML = signatureCards(model);
    if (label) label.innerHTML = `<span>SETOR</span><b>${escapeHtml(sector)}</b>`;
    if (legend) legend.innerHTML = biomeLegend(model);
    if (log) {
      log.innerHTML = [
        'Sincronizando telemetria orbital...',
        `Seed confirmado: ${activeConfig.seed || 'sem seed'}`,
        `Bioma dominante: ${BIOME_LABELS[model.dominantBiome] || model.dominantBiome}`,
        `${model.signatures.length} assinatura${model.signatures.length === 1 ? '' : 's'} detectada${model.signatures.length === 1 ? '' : 's'}.`,
        'Perfil confirmado. Este setor será usado pelo gerador do mundo.'
      ].map(line => `<span>${escapeHtml(line)}</span>`).join('');
    }
  }

  injectPlanetScanStyle();
  window.refreshPlanetScan = refreshPlanetScan;
})();
