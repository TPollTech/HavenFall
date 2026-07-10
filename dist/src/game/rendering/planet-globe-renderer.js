'use strict';

(() => {
  if (window.HavenfallContext?.planetGlobeRendererInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.planetGlobeRendererInstalled = true;

  const SITE = Object.freeze({
    current: '#facc15',
    visited: '#22c55e',
    known: '#38bdf8',
    quest: '#c084fc',
    danger: '#ef4444',
    unknown: '#94a3b8',
    locked: '#475569'
  });

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function hashText(text) {
    if (typeof hashSeed === 'function') return hashSeed(String(text || 'havenfall'));
    let h = 2166136261;
    const str = String(text || 'havenfall');
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seeded(seed, salt) {
    return (hashText(`${seed}|${salt}`) % 100000) / 100000;
  }

  function sizeCanvas(canvas, options = {}) {
    const rect = canvas.parentElement?.getBoundingClientRect?.() || canvas.getBoundingClientRect?.() || {};
    const width = Math.max(options.minWidth || 420, Math.floor(rect.width || canvas.width || 420));
    const height = Math.max(options.minHeight || 420, Math.floor(rect.height || canvas.height || 420));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    return { width, height };
  }

  function siteType(site) {
    return site?.discoveryType || site?.labels?.siteTypeLabel || site?.archetype || site?.type || 'landing';
  }

  function siteTypeLabel(site) {
    const type = siteType(site);
    return ({
      landing: 'Pouso',
      mine: 'Mina',
      dungeon: 'Dungeon',
      outpost: 'Construção',
      grove: 'Bosque',
      water: 'Água',
      danger: 'Anomalia',
      ancient_ruins: 'Ruína',
      rocky_valley: 'Mineral',
      dense_forest: 'Bosque',
      riverbank: 'Água',
      safe: 'Seguro',
      extreme: 'Anomalia',
      geology: 'Geologia',
      fauna: 'Fauna',
      metal: 'Metal',
      weather: 'Clima',
      fertile: 'Fértil',
      ruin: 'Ruína'
    })[type] || site?.discoveryLabel || site?.labels?.siteTypeLabel || 'Setor';
  }

  function siteGlyph(site) {
    const type = siteType(site);
    return ({
      mine: 'M',
      dungeon: 'D',
      outpost: 'O',
      grove: 'B',
      water: 'A',
      danger: '!',
      ancient_ruins: 'R',
      rocky_valley: 'M',
      riverbank: 'A',
      extreme: '!',
      geology: 'G',
      fauna: 'F',
      metal: 'M',
      weather: '!',
      fertile: 'V',
      ruin: 'R'
    })[type] || '';
  }

  function siteTypeColor(site) {
    const type = siteType(site);
    return ({
      mine: '#f59e0b',
      dungeon: '#c084fc',
      outpost: '#eab308',
      grove: '#22c55e',
      water: '#38bdf8',
      danger: '#ef4444',
      ancient_ruins: '#c084fc',
      rocky_valley: '#f59e0b',
      riverbank: '#38bdf8',
      extreme: '#ef4444',
      geology: '#f59e0b',
      fauna: '#22c55e',
      metal: '#fbbf24',
      weather: '#ef4444',
      fertile: '#84cc16',
      ruin: '#c084fc'
    })[type] || (SITE[site?.state] || SITE.known);
  }

  function drawSpace(c, canvas, seed) {
    const bg = c.createRadialGradient(canvas.width * 0.5, canvas.height * 0.5, 20, canvas.width * 0.5, canvas.height * 0.5, Math.max(canvas.width, canvas.height) * 0.72);
    bg.addColorStop(0, '#0d1b32');
    bg.addColorStop(0.48, '#050a18');
    bg.addColorStop(1, '#020617');
    c.fillStyle = bg;
    c.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 120; i++) {
      const x = seeded(seed, `star-x-${i}`) * canvas.width;
      const y = seeded(seed, `star-y-${i}`) * canvas.height;
      const a = 0.18 + seeded(seed, `star-a-${i}`) * 0.55;
      const r = 0.55 + seeded(seed, `star-r-${i}`) * 1.25;
      c.fillStyle = `rgba(226,232,240,${a.toFixed(3)})`;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  }

  function drawPlanetBase(c, cx, cy, radius) {
    const planet = c.createRadialGradient(cx - radius * 0.30, cy - radius * 0.36, radius * 0.08, cx, cy, radius);
    planet.addColorStop(0, '#4cc9f0');
    planet.addColorStop(0.36, '#186b8f');
    planet.addColorStop(0.72, '#0f3b63');
    planet.addColorStop(1, '#07162b');
    c.fillStyle = planet;
    c.beginPath();
    c.arc(cx, cy, radius, 0, Math.PI * 2);
    c.fill();
  }

  function drawOrganicPatch(c, x, y, rx, ry, seed, salt, fillStyle, points = 16) {
    c.fillStyle = fillStyle;
    c.beginPath();
    for (let i = 0; i < points; i++) {
      const t = (i / points) * Math.PI * 2;
      const wobble = 0.74 + seeded(seed, `${salt}-w-${i}`) * 0.48;
      const px = x + Math.cos(t) * rx * wobble;
      const py = y + Math.sin(t) * ry * wobble;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
  }

  function siteLandPalette(site) {
    const type = siteType(site);
    if (type === 'mine' || type === 'rocky_valley' || type === 'geology' || type === 'metal') return { shore: 'rgba(194,158,91,.54)', body: 'rgba(123,116,83,.82)', detail: 'rgba(203,190,137,.22)' };
    if (type === 'dungeon' || type === 'outpost' || type === 'ancient_ruins' || type === 'ruin') return { shore: 'rgba(186,148,88,.54)', body: 'rgba(107,122,76,.82)', detail: 'rgba(205,180,116,.20)' };
    if (type === 'water' || type === 'riverbank') return { shore: 'rgba(203,177,103,.55)', body: 'rgba(74,139,83,.82)', detail: 'rgba(56,189,248,.28)' };
    if (type === 'danger' || type === 'extreme' || type === 'weather') return { shore: 'rgba(207,137,78,.55)', body: 'rgba(132,103,66,.84)', detail: 'rgba(239,68,68,.20)' };
    if (type === 'grove' || type === 'dense_forest' || type === 'fauna' || type === 'fertile') return { shore: 'rgba(177,165,86,.52)', body: 'rgba(66,142,74,.86)', detail: 'rgba(139,195,93,.24)' };
    return { shore: 'rgba(194,165,91,.50)', body: 'rgba(78,137,63,.84)', detail: 'rgba(211,230,169,.18)' };
  }

  function pointForSite(site, scale) {
    if (!scale) return { x: 0, y: 0, z: 0 };
    if (scale.sites?.has(site.id)) return scale.sites.get(site.id);

    const nx = (clamp(site.globe?.x ?? .5, .04, .96) - 0.5) * 2;
    const ny = (clamp(site.globe?.y ?? .5, .04, .96) - 0.5) * 2;
    let px = nx * 0.84;
    let py = ny * 0.74;
    const d = Math.hypot(px, py);
    if (d > 0.94) {
      px *= 0.94 / d;
      py *= 0.94 / d;
    }

    const point = {
      x: scale.cx + px * scale.radius,
      y: scale.cy + py * scale.radius,
      z: Math.sqrt(Math.max(0, 1 - px * px - py * py))
    };
    scale.sites?.set(site.id, point);
    return point;
  }

  function drawSiteLandAnchors(c, scale, sites) {
    sites.forEach((site, index) => {
      const p = pointForSite(site, scale);
      const type = siteType(site);
      const palette = siteLandPalette(site);
      const base = scale.radius * (type === 'water' ? 0.090 : type === 'danger' ? 0.078 : 0.074);
      const rx = base * (1.10 + seeded(scale.seed, `site-land-rx-${site.id}`) * 0.55);
      const ry = base * (0.82 + seeded(scale.seed, `site-land-ry-${site.id}`) * 0.42);
      const angle = seeded(scale.seed, `site-land-angle-${site.id}`) * Math.PI * 2;

      c.save();
      c.translate(p.x, p.y);
      c.rotate(angle);
      drawOrganicPatch(c, 0, 0, rx * 1.70, ry * 1.62, scale.seed, `shore-${site.id}`, palette.shore, 18);
      drawOrganicPatch(c, 0, 0, rx, ry, scale.seed, `land-${site.id}`, palette.body, 18);
      drawOrganicPatch(c, rx * 0.12, ry * 0.02, rx * 0.36, ry * 0.24, scale.seed, `detail-${site.id}`, palette.detail, 12);
      c.restore();

      if (index % 3 === 0) {
        c.fillStyle = 'rgba(80, 150, 84, .20)';
        c.beginPath();
        c.arc(p.x + rx * 0.45, p.y + ry * 0.35, Math.max(2, scale.radius * 0.010), 0, Math.PI * 2);
        c.fill();
      }
    });
  }

  function drawContinents(c, scale, sites = []) {
    const { cx, cy, radius, seed } = scale;
    for (let i = 0; i < 9; i++) {
      const angle = seeded(seed, `land-a-${i}`) * Math.PI * 2;
      const distFromCenter = radius * (0.12 + seeded(seed, `land-d-${i}`) * 0.54);
      const bx = cx + Math.cos(angle) * distFromCenter;
      const by = cy + Math.sin(angle) * distFromCenter * 0.78;
      const base = radius * (0.12 + seeded(seed, `land-r-${i}`) * 0.14);
      const hue = seeded(seed, `land-h-${i}`);
      c.fillStyle = hue > 0.72 ? 'rgba(154,130,73,.78)' : hue > 0.42 ? 'rgba(57,119,76,.82)' : 'rgba(78,137,63,.80)';
      c.beginPath();

      for (let p = 0; p < 18; p++) {
        const t = (p / 18) * Math.PI * 2;
        const wobble = 0.70 + seeded(seed, `land-${i}-${p}`) * 0.55;
        const rx = base * wobble * (1.25 + seeded(seed, `land-wide-${i}`) * 0.55);
        const ry = base * wobble * (0.72 + seeded(seed, `land-tall-${i}`) * 0.44);
        const x = bx + Math.cos(t) * rx;
        const y = by + Math.sin(t) * ry;
        if (p === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }

      c.closePath();
      c.fill();
    }

    drawSiteLandAnchors(c, scale, sites);

    c.fillStyle = 'rgba(211,230,169,.10)';
    for (let i = 0; i < 34; i++) {
      const x = scale.cx + (seeded(scale.seed, `speck-x-${i}`) - 0.5) * scale.radius * 1.55;
      const y = scale.cy + (seeded(scale.seed, `speck-y-${i}`) - 0.5) * scale.radius * 1.35;
      if (Math.hypot(x - scale.cx, y - scale.cy) > scale.radius * 0.92) continue;
      c.beginPath();
      c.arc(x, y, scale.radius * (0.006 + seeded(scale.seed, `speck-r-${i}`) * 0.010), 0, Math.PI * 2);
      c.fill();
    }
  }

  function drawGlobeGrid(c, cx, cy, radius) {
    c.strokeStyle = 'rgba(191,219,254,.16)';
    c.lineWidth = 1;

    for (let i = -3; i <= 3; i++) {
      const y = cy + i * radius * 0.22;
      const w = Math.sqrt(Math.max(0, 1 - Math.pow((y - cy) / radius, 2))) * radius;
      c.beginPath();
      c.ellipse(cx, y, w, radius * 0.06, 0, 0, Math.PI * 2);
      c.stroke();
    }

    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      c.ellipse(cx + i * radius * 0.12, cy, radius * (0.36 - Math.abs(i) * 0.035), radius * 0.96, 0, -Math.PI / 2, Math.PI / 2);
      c.stroke();
      c.beginPath();
      c.ellipse(cx - i * radius * 0.12, cy, radius * (0.36 - Math.abs(i) * 0.035), radius * 0.96, 0, Math.PI / 2, Math.PI * 1.5);
      c.stroke();
    }
  }

  function drawRoute(c, scale, a, b, route, selected) {
    if (!a || !b) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const midx = (a.x + b.x) / 2;
    const midy = (a.y + b.y) / 2;
    const bend = (seeded(scale.seed, `route-${route.from}-${route.to}`) - 0.5) * Math.min(72, len * 0.32);
    const ctrlX = midx - (dy / len) * bend + (midx - scale.cx) * 0.12;
    const ctrlY = midy + (dx / len) * bend + (midy - scale.cy) * 0.12;
    const active = selected && (route.from === selected.id || route.to === selected.id);

    c.save();
    c.strokeStyle = active ? 'rgba(250,204,21,.88)' : route.roadType === 'road' ? 'rgba(226,183,92,.55)' : route.roadType === 'hazard' ? 'rgba(248,113,113,.42)' : 'rgba(148,163,184,.34)';
    c.lineWidth = active ? 3 : route.roadType === 'road' ? 1.8 : 1.25;
    if (!route.known || route.roadType === 'long') c.setLineDash([7, 6]);
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.quadraticCurveTo(ctrlX, ctrlY, b.x, b.y);
    c.stroke();
    c.restore();
  }

  function drawWorldSite(c, wm, site, selected, scale, options = {}) {
    const p = pointForSite(site, scale);
    const isSel = site.id === selected?.id;
    const isCur = site.id === wm.currentSiteId;
    const stateColor = SITE[site.state] || SITE.known;
    const typeColor = siteTypeColor(site);
    const r = isCur ? 12 : isSel ? 11 : 7.5;
    const glow = isSel || isCur ? 0.32 : 0.10;

    c.fillStyle = `rgba(250,204,21,${glow})`;
    c.beginPath();
    c.arc(p.x, p.y, r + 8, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = typeColor;
    c.strokeStyle = isSel ? '#fff7ed' : stateColor;
    c.lineWidth = isSel ? 3 : 2;
    c.beginPath();
    c.arc(p.x, p.y, r, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    const glyph = options.showGlyphs === false ? '' : siteGlyph(site);
    if (glyph) {
      c.fillStyle = '#0f172a';
      c.font = '900 10px system-ui';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(glyph, p.x, p.y + 0.5);
    }

    if (options.showLabels === false) return;
    c.textBaseline = 'alphabetic';
    c.fillStyle = isSel || isCur ? '#fff7ed' : 'rgba(226,232,240,.78)';
    c.font = isSel || isCur ? '800 12px system-ui' : '700 9px system-ui';
    c.textAlign = 'center';
    const label = isSel || isCur || (wm.landingSites || []).length <= 18 ? site.name : siteTypeLabel(site);
    c.fillText(label, p.x, p.y + r + 15);
  }

  function drawPlanetRim(c, cx, cy, radius) {
    const shade = c.createRadialGradient(cx - radius * 0.2, cy - radius * 0.25, radius * 0.18, cx, cy, radius);
    shade.addColorStop(0, 'rgba(255,255,255,0)');
    shade.addColorStop(0.62, 'rgba(2,6,23,0)');
    shade.addColorStop(1, 'rgba(2,6,23,.64)');
    c.fillStyle = shade;
    c.beginPath();
    c.arc(cx, cy, radius, 0, Math.PI * 2);
    c.fill();

    c.strokeStyle = 'rgba(191,219,254,.38)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(cx, cy, radius, 0, Math.PI * 2);
    c.stroke();

    c.strokeStyle = 'rgba(125,211,252,.12)';
    c.lineWidth = 10;
    c.beginPath();
    c.arc(cx, cy, radius + 7, 0, Math.PI * 2);
    c.stroke();
  }

  function drawGlobe(canvas, worldMap = {}, selected = null, options = {}) {
    if (!canvas) return null;
    const { width, height } = sizeCanvas(canvas, options);
    const c = canvas.getContext('2d');
    if (!c) return null;

    c.clearRect(0, 0, width, height);
    const cx = width * (options.centerX ?? 0.50);
    const cy = height * (options.centerY ?? 0.50);
    const radius = Math.max(options.minRadius || 130, Math.min(width * (options.radiusWidthFactor ?? 0.42), height * (options.radiusHeightFactor ?? 0.44)));
    const scale = {
      cx,
      cy,
      radius,
      sites: new Map(),
      seed: worldMap.planetSeed || worldMap.seed || options.seed || 'havenfall'
    };

    const sites = Array.isArray(worldMap.landingSites) ? worldMap.landingSites : [];
    drawSpace(c, canvas, scale.seed);
    drawPlanetBase(c, cx, cy, radius);

    c.save();
    c.beginPath();
    c.arc(cx, cy, radius, 0, Math.PI * 2);
    c.clip();
    drawContinents(c, scale, sites);
    drawGlobeGrid(c, cx, cy, radius);

    if (options.showRoutes !== false) {
      for (const route of worldMap.routes || []) {
        const from = sites.find(site => site.id === route.from);
        const to = sites.find(site => site.id === route.to);
        if (!from || !to) continue;
        drawRoute(c, scale, pointForSite(from, scale), pointForSite(to, scale), route, selected);
      }
    }

    if (options.showSites !== false) {
      for (const site of sites) drawWorldSite(c, worldMap, site, selected, scale, options);
    }
    c.restore();

    drawPlanetRim(c, cx, cy, radius);
    return scale;
  }

  function signatureKindType(signature) {
    const kind = signature?.kind || signature?.type || signature?.biome || 'landing';
    return ({
      geology: 'geology',
      metal: 'metal',
      fauna: 'fauna',
      organic: 'fauna',
      water: 'water',
      humidity: 'water',
      weather: 'weather',
      heat: 'weather',
      cold: 'weather',
      dust: 'weather',
      fertile: 'fertile',
      safe: 'safe',
      ruin: 'ruin',
      collapse: 'danger'
    })[kind] || kind;
  }

  function riskState(signature) {
    const risk = String(signature?.risk || '').toLowerCase();
    if (risk.includes('elev') || risk.includes('alto')) return 'danger';
    if (risk.includes('baixo') || risk.includes('safe')) return 'visited';
    return 'known';
  }

  function createScanPreview(config = {}, profile = null) {
    const source = profile || config?.planetScan || {};
    const seed = source.seed || config.seed || 'havenfall-scan';
    const rawSignatures = Array.isArray(source.signatures) ? source.signatures : [];
    const signatures = rawSignatures.length ? rawSignatures : [
      { name: 'Clareira orbital', kind: 'safe', risk: 'baixo' },
      { name: 'Eco mineral', kind: 'metal', risk: 'moderado' },
      { name: 'Zona fértil', kind: 'fertile', risk: 'baixo' },
      { name: 'Frente climática', kind: 'weather', risk: 'moderado' }
    ];

    const landingSites = signatures.map((signature, index) => {
      const id = `scan-${index}-${hashText(`${seed}|${signature.name || signature.kind || index}`).toString(36)}`;
      const angle = seeded(seed, `scan-angle-${index}-${signature.kind || ''}`) * Math.PI * 2;
      const distance = 0.18 + seeded(seed, `scan-distance-${index}-${signature.name || ''}`) * 0.70;
      const x = signature.globe?.x ?? (0.5 + Math.cos(angle) * distance * 0.42);
      const y = signature.globe?.y ?? (0.5 + Math.sin(angle) * distance * 0.36);
      return {
        id,
        name: signature.name || signature.label || `Assinatura ${String(index + 1).padStart(2, '0')}`,
        archetype: signatureKindType(signature),
        discoveryType: signatureKindType(signature),
        state: riskState(signature),
        labels: {
          siteTypeLabel: signatureKindType(signature),
          subtitle: signature.positive || signature.negative || 'Assinatura detectada por reconhecimento orbital.'
        },
        difficulty: { label: signature.risk || 'Moderado' },
        globe: { x: clamp(x, .06, .94), y: clamp(y, .08, .92) },
        resources: {},
        risks: {}
      };
    });

    return {
      planetSeed: seed,
      currentSiteId: landingSites[0]?.id || null,
      landingSites,
      routes: []
    };
  }

  window.HavenfallPlanetGlobeRenderer = Object.freeze({
    drawGlobe,
    createScanPreview,
    pointForSite,
    colors: SITE
  });
})();
