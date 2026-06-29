'use strict';

(() => {
  const VERSION = '2.0.0-layered-worldgen';
  const TERRAIN = new Set(['grass', 'dirt', 'sand', 'stone']);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));
  const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const grid = (rows, cols, fill) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => fill));
  const edge = (x, y, cols, rows) => Math.min(x, y, cols - 1 - x, rows - 1 - y);

  function noise(seed, x, y, salt) {
    if (typeof worldNoise === 'function') return worldNoise(seed, x, y, salt);
    let h = 2166136261;
    const s = `${seed}|${salt}|${x}|${y}`;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967295;
  }

  function valueNoise(seed, x, y, scale, salt) {
    const gx = x / scale;
    const gy = y / scale;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = smooth(gx - x0);
    const ty = smooth(gy - y0);
    const a = noise(seed, x0, y0, salt);
    const b = noise(seed, x0 + 1, y0, salt);
    const c = noise(seed, x0, y0 + 1, salt);
    const d = noise(seed, x0 + 1, y0 + 1, salt);
    return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
  }

  function fbm(seed, x, y, salt, scales) {
    let v = 0;
    let w = 0;
    for (const [scale, weight] of scales) {
      v += valueNoise(seed, x, y, scale, `${salt}-${scale}`) * weight;
      w += weight;
    }
    return w ? v / w : noise(seed, x, y, salt);
  }

  function scanBias(config) {
    const hasScan = typeof planetScanProfile === 'function' && planetScanProfile(config);
    const stat = key => hasScan && typeof scanBiomeStat === 'function' ? clamp(scanBiomeStat(config, key) / 100) : 0;
    const dominant = hasScan && typeof scanDominantBiome === 'function' ? scanDominantBiome(config) : null;
    const profile = config?.sectorProfile || 'balanced';
    return {
      forest: stat('forest') + (dominant === 'forest' || profile === 'forest' ? 0.18 : 0),
      desert: stat('desert') + (dominant === 'desert' || profile === 'harsh' ? 0.18 : 0),
      rock: stat('rock') + (dominant === 'rock' || profile === 'rock' ? 0.18 : 0),
      snow: stat('snow') + (dominant === 'snow' ? 0.18 : 0),
      water: stat('water') + (profile === 'water' ? 0.20 : 0)
    };
  }

  function buildLayers(ctx) {
    const { seed, cols, rows, config } = ctx;
    const bias = scanBias(config);
    const height = grid(rows, cols, 0);
    const moisture = grid(rows, cols, 0);
    const temp = grid(rows, cols, 0);
    const fertility = grid(rows, cols, 0);
    const rock = grid(rows, cols, 0);
    const biome = grid(rows, cols, 'forest');
    const zone = grid(rows, cols, 'meadow');
    const hydro = grid(rows, cols, null);
    const stats = { mountain: 0, wetland: 0, desert: 0, snow: 0 };

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const e = clamp(edge(x, y, cols, rows) / Math.max(8, Math.min(cols, rows) * 0.13));
        const latitudeHeat = 1 - Math.abs((rows <= 1 ? 0.5 : y / (rows - 1)) - 0.5) * 0.55;
        const h = clamp(fbm(seed, x, y, 'height', [[72, .58], [34, .30], [15, .12]]) * .90 + e * .09 + bias.rock * .12 - bias.water * .06);
        const m = clamp(fbm(seed, x + 91, y - 37, 'moisture', [[64, .55], [28, .33], [11, .12]]) * .82 + bias.water * .24 + bias.forest * .11 - bias.desert * .24 - h * .08);
        const t = clamp(fbm(seed, x - 43, y + 71, 'temperature', [[86, .50], [38, .32], [16, .18]]) * .72 + latitudeHeat * .15 + bias.desert * .12 - bias.snow * .20 - h * .08);
        const r = clamp(fbm(seed, x + 19, y + 31, 'rock', [[54, .52], [22, .33], [9, .15]]) * .55 + h * .42 + bias.rock * .22);
        const f = clamp(m * .58 + (1 - Math.abs(h - .46)) * .25 + bias.forest * .13 - bias.desert * .18);
        height[y][x] = h; moisture[y][x] = m; temp[y][x] = t; fertility[y][x] = f; rock[y][x] = r;

        let b = 'forest';
        if ((t < .27 + bias.snow * .16 && h > .30) || bias.snow > .62) b = 'snow';
        else if ((m < .30 - bias.water * .08 && t > .46) || bias.desert > .58) b = 'desert';
        biome[y][x] = b;

        let z = 'meadow';
        if (r > .66 || h > .72) z = 'mountain';
        else if (m > .73 && h < .55) z = 'wetland';
        else if (b === 'desert') z = h > .58 ? 'dry_ridge' : 'dry_flat';
        else if (f > .66 && m > .48) z = 'forest_core';
        else if (f <= .54) z = 'rough_field';
        zone[y][x] = z;
        if (z === 'mountain') stats.mountain++;
        if (z === 'wetland') stats.wetland++;
        if (b === 'desert') stats.desert++;
        if (b === 'snow') stats.snow++;
      }
    }

    smoothGrid(zone, seed, 'zone');
    smoothGrid(biome, seed, 'biome');
    const area = Math.max(1, cols * rows);
    Object.keys(stats).forEach(k => { stats[k] = stats[k] / area; });
    const story = chooseStory(seed, bias, stats);
    return { seed, height, moisture, temperature: temp, fertility, rock, biome, zone, hydro, bias, stats, story };
  }

  function smoothGrid(map, seed, salt) {
    const rows = map.length;
    const cols = map[0]?.length || 0;
    const copy = map.map(row => row.slice());
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        if (noise(seed, x, y, `${salt}-skip`) < .24) continue;
        const counts = {};
        for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) counts[map[yy][xx]] = (counts[map[yy][xx]] || 0) + 1;
        const [best, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [map[y][x], 0];
        if (count >= 6) copy[y][x] = best;
      }
    }
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) map[y][x] = copy[y][x];
  }

  function chooseStory(seed, bias, stats) {
    const roll = noise(seed, 17, 29, 'story');
    if (bias.rock > .52 || stats.mountain > .20) return 'mining_scars';
    if (bias.water > .48 || stats.wetland > .16) return 'flooded_valley';
    if (bias.desert > .44 || stats.desert > .32) return 'dry_ashland';
    if (bias.snow > .42 || stats.snow > .24) return 'cold_ridge';
    if (roll > .77) return 'old_crash_site';
    if (roll > .55) return 'abandoned_outpost';
    if (roll > .34) return 'green_refuge';
    return 'broken_frontier';
  }

  function terrainFromLayers(ctx, layers) {
    const terrain = grid(ctx.rows, ctx.cols, 'grass');
    const rockBonus = typeof difficultyRockBonus === 'function' ? difficultyRockBonus(ctx.config.difficulty) : 0;
    for (let y = 0; y < ctx.rows; y++) {
      for (let x = 0; x < ctx.cols; x++) {
        const z = layers.zone[y][x];
        const b = layers.biome[y][x];
        const d = fbm(ctx.seed, x, y, 'terrain-detail', [[12, .55], [5, .45]]);
        const r = layers.rock[y][x] + rockBonus;
        const h = layers.height[y][x];
        let tile = 'grass';
        if (edge(x, y, ctx.cols, ctx.rows) <= 1) tile = 'sand';
        else if (z === 'mountain') tile = r > .62 || h > .73 || d > .46 ? 'stone' : 'dirt';
        else if (z === 'dry_ridge') tile = r > .68 ? 'stone' : d > .28 ? 'sand' : 'dirt';
        else if (z === 'dry_flat') tile = d > .16 ? 'sand' : 'dirt';
        else if (z === 'wetland') tile = layers.moisture[y][x] > .82 || d < .34 ? 'dirt' : 'grass';
        else if (b === 'snow') tile = r > .72 || h > .74 ? 'stone' : d > .68 ? 'dirt' : 'grass';
        else if (z === 'forest_core') tile = d < .14 ? 'dirt' : 'grass';
        else if (z === 'rough_field') tile = r > .76 ? 'stone' : d < .30 ? 'dirt' : 'grass';
        else tile = d < .13 ? 'dirt' : 'grass';
        if (edge(x, y, ctx.cols, ctx.rows) <= 4 && tile !== 'stone' && noise(ctx.seed, x, y, 'shoreline') < .55) tile = 'sand';
        terrain[y][x] = TERRAIN.has(tile) ? tile : 'grass';
      }
    }
    polish(terrain, ctx, layers, 2);
    return terrain;
  }

  function carveHydrology(ctx, layers, terrain) {
    const starts = findRiverStarts(ctx, layers);
    starts.forEach((start, river) => {
      let x = start.x, y = start.y, dir = ctx.rand() * Math.PI * 2;
      const path = [];
      const maxSteps = Math.floor((ctx.cols + ctx.rows) * (0.70 + ctx.rand() * .45));
      for (let i = 0; i < maxSteps; i++) {
        if (x <= 2 || y <= 2 || x >= ctx.cols - 3 || y >= ctx.rows - 3) break;
        path.push({ x, y });
        let best = null, bestScore = Infinity;
        for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) {
          if ((xx === x && yy === y) || !terrain[yy]?.[xx]) continue;
          const score = (layers.height[yy][xx] - layers.height[y][x]) * 1.9 + edge(xx, yy, ctx.cols, ctx.rows) * .010 + (1 - layers.moisture[yy][xx]) * .18 + Math.abs(Math.atan2(yy - y, xx - x) - dir) * .015 + noise(ctx.seed, xx + i, yy - i, `river-${river}`) * .08;
          if (score < bestScore) { bestScore = score; best = { x: xx, y: yy }; }
        }
        if (!best) break;
        dir = lerp(dir, Math.atan2(best.y - y, best.x - x), .18);
        x = best.x; y = best.y;
        if (path.length > 18 && layers.height[y][x] < .25 && noise(ctx.seed, x, y, `river-end-${river}`) > .42) break;
      }
      carveRiver(ctx, layers, terrain, path, river);
    });
    for (let y = 2; y < ctx.rows - 2; y++) for (let x = 2; x < ctx.cols - 2; x++) {
      if (layers.zone[y][x] === 'wetland' && (noise(ctx.seed, x, y, 'wet-basin') > .62 || layers.height[y][x] < .30)) {
        layers.hydro[y][x] = layers.hydro[y][x] || 'wetland';
        if (terrain[y][x] === 'stone') terrain[y][x] = 'dirt';
      }
    }
    polish(terrain, ctx, layers, 1);
  }

  function findRiverStarts(ctx, layers) {
    const count = Math.max(1, Math.min(5, Math.round(ctx.cols * ctx.rows / 6200 + layers.bias.water * 2.2)));
    const candidates = [];
    const step = Math.max(2, Math.floor(Math.min(ctx.cols, ctx.rows) / 36));
    for (let y = 4; y < ctx.rows - 4; y += step) for (let x = 4; x < ctx.cols - 4; x += step) {
      const h = layers.height[y][x], m = layers.moisture[y][x], ed = edge(x, y, ctx.cols, ctx.rows);
      if (h > .48 && m > .42 && ed > 8) candidates.push({ x, y, score: h * .58 + m * .34 + noise(ctx.seed, x, y, 'river-start') * .08 + ed * .002 });
    }
    candidates.sort((a, b) => b.score - a.score);
    const starts = [];
    for (const c of candidates) {
      if (starts.some(s => Math.hypot(s.x - c.x, s.y - c.y) < Math.min(ctx.cols, ctx.rows) * .22)) continue;
      starts.push(c);
      if (starts.length >= count) break;
    }
    return starts.length ? starts : [{ x: Math.floor(ctx.cols * .55), y: Math.floor(ctx.rows * .22), score: 1 }];
  }

  function carveRiver(ctx, layers, terrain, path, river) {
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      const width = 1 + (noise(ctx.seed, i, river, 'river-width') > .76 ? 1 : 0) + (i > path.length * .62 ? 1 : 0);
      for (let y = p.y - width - 1; y <= p.y + width + 1; y++) for (let x = p.x - width - 1; x <= p.x + width + 1; x++) {
        if (!terrain[y]?.[x]) continue;
        const d = Math.hypot(x - p.x, y - p.y);
        if (d <= width) { layers.hydro[y][x] = 'riverbed'; terrain[y][x] = layers.biome[y][x] === 'desert' ? 'sand' : 'dirt'; }
        else if (d <= width + 1.2 && layers.zone[y][x] !== 'mountain') { layers.hydro[y][x] = layers.hydro[y][x] || 'bank'; if (terrain[y][x] === 'stone') terrain[y][x] = 'dirt'; }
      }
    }
  }

  function polish(terrain, ctx, layers, passes) {
    for (let pass = 0; pass < passes; pass++) {
      const copy = terrain.map(row => row.slice());
      for (let y = 1; y < ctx.rows - 1; y++) for (let x = 1; x < ctx.cols - 1; x++) {
        if (layers?.hydro?.[y]?.[x] === 'riverbed') continue;
        const counts = {};
        for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (!(xx === x && yy === y)) counts[terrain[yy][xx]] = (counts[terrain[yy][xx]] || 0) + 1;
        const [major, amount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [terrain[y][x], 0];
        if (amount >= 6 && terrain[y][x] !== major && noise(ctx.seed, x, y, `polish-${pass}`) > .22 && !(terrain[y][x] === 'stone' && major === 'sand')) copy[y][x] = major;
        if (terrain[y][x] === 'stone' && (counts.stone || 0) <= 1 && layers?.zone?.[y]?.[x] !== 'mountain') copy[y][x] = 'dirt';
      }
      for (let y = 0; y < ctx.rows; y++) for (let x = 0; x < ctx.cols; x++) terrain[y][x] = copy[y][x];
    }
  }

  function chooseSpawn(terrain, ctx, layers) {
    const integrity = typeof scanModifier === 'function' ? scanModifier(ctx.config, 'landingIntegrity', 70) : 70;
    const offset = integrity >= 70 ? .10 : .18;
    const cx = Math.floor(ctx.cols * (.48 + (ctx.rand() - .5) * offset));
    const cy = Math.floor(ctx.rows * (.50 + (ctx.rand() - .5) * offset));
    const radius = Math.floor(Math.min(ctx.cols, ctx.rows) * .28);
    let best = { x: cx, y: cy, score: -Infinity };
    for (let y = Math.max(7, cy - radius); y < Math.min(ctx.rows - 7, cy + radius); y++) for (let x = Math.max(7, cx - radius); x < Math.min(ctx.cols - 7, cx + radius); x++) {
      const s = spawnScore(terrain, x, y, ctx, layers, cx, cy);
      if (s > best.score) best = { x, y, score: s };
    }
    return { x: best.x, y: best.y };
  }

  function spawnScore(terrain, x, y, ctx, layers, cx, cy) {
    const tile = terrain[y][x], priority = ctx.config?.landingPriority || 'safe';
    let score = tile === 'grass' ? 18 : tile === 'dirt' ? 10 : tile === 'sand' ? -7 : -18;
    let grass = 0, dirt = 0, stone = 0, sand = 0, wet = 0, mountain = 0;
    for (let yy = y - 6; yy <= y + 6; yy++) for (let xx = x - 6; xx <= x + 6; xx++) {
      const t = terrain[yy]?.[xx]; if (!t) continue;
      if (t === 'grass') grass++; else if (t === 'dirt') dirt++; else if (t === 'stone') stone++; else if (t === 'sand') sand++;
      if (layers.hydro[yy]?.[xx]) wet++;
      if (layers.zone[yy]?.[xx] === 'mountain') mountain++;
    }
    score += grass * .52 + dirt * .24 - stone * .78 - sand * .28 - wet * .36 - mountain * .50;
    score -= Math.hypot(x - cx, y - cy) * .16;
    score += edge(x, y, ctx.cols, ctx.rows) * .06 + (1 - Math.abs(layers.height[y][x] - .47)) * 12 + layers.fertility[y][x] * 6;
    if (priority === 'resources') score += layers.rock[y][x] * 8 + layers.moisture[y][x] * 2;
    if (priority === 'exploration') score += Math.abs(layers.fertility[y][x] - layers.rock[y][x]) * 6;
    if (priority === 'challenge') score += (sand + stone) * .18 - grass * .05;
    return score + noise(ctx.seed, x, y, 'spawn-v2') * 2.5;
  }

  function carveSpawn(terrain, spawn, ctx, layers) {
    for (let y = spawn.y - 9; y <= spawn.y + 9; y++) for (let x = spawn.x - 10; x <= spawn.x + 10; x++) {
      if (!terrain[y]?.[x]) continue;
      const d = Math.hypot((x - spawn.x) / 1.12, y - spawn.y);
      if (d <= 5.6) { terrain[y][x] = 'grass'; layers.hydro[y][x] = null; layers.zone[y][x] = 'landing_clearing'; }
      else if (d <= 8.8 && (terrain[y][x] === 'stone' || terrain[y][x] === 'sand')) terrain[y][x] = d > 7.2 ? 'dirt' : 'grass';
    }
  }

  function addResources(data) {
    const size = typeof getMapSizeDef === 'function' ? getMapSizeDef(data.ctx.config.mapSize) : { resourceMultiplier: 1 };
    const diff = typeof difficultyResourceFactor === 'function' ? difficultyResourceFactor(data.ctx.config.difficulty) : 1;
    const area = data.ctx.cols * data.ctx.rows, mult = (size.resourceMultiplier || 1) * diff;
    const counts = { tree: Math.floor(area * .0175 * mult), bush: Math.floor(area * .0068 * mult), berry: Math.floor(area * .0058 * mult), rock: Math.floor(area * .0105 * mult), ore: Math.floor(area * .0039 * mult), logs: Math.floor(area * .0024 * mult) };
    if (typeof applyPlanetScanResourceMultipliers === 'function') applyPlanetScanResourceMultipliers(counts, data.ctx.config);
    if (data.layers.story === 'mining_scars') { counts.rock = Math.floor(counts.rock * 1.25); counts.ore = Math.floor(counts.ore * 1.32); counts.tree = Math.floor(counts.tree * .88); }
    if (data.layers.story === 'green_refuge') { counts.tree = Math.floor(counts.tree * 1.18); counts.berry = Math.floor(counts.berry * 1.16); }
    spawnResourceRing(data);
    for (const [type, amount] of Object.entries(counts)) {
      const clusterSize = type === 'tree' ? 5 : type === 'rock' ? 4 : type === 'ore' ? 3 : 3;
      for (let i = 0; i < Math.max(1, Math.ceil(amount / clusterSize)); i++) {
        const c = resourceCenter(type, data, i);
        if (c) placeCluster(type, c, clusterSize, data, i);
      }
    }
  }

  function spawnResourceRing(data) {
    for (const [type, amount, minR, maxR] of [['tree', 8, 8, 13], ['berry', 4, 6, 10], ['rock', 4, 8, 14], ['logs', 2, 5, 9]]) for (let i = 0; i < amount; i++) {
      const a = data.ctx.rand() * Math.PI * 2, r = minR + data.ctx.rand() * (maxR - minR);
      const x = Math.round(data.spawn.x + Math.cos(a) * r), y = Math.round(data.spawn.y + Math.sin(a) * r);
      if (canPlace(type, x, y, data)) data.add(type, x, y);
    }
  }

  function canPlace(type, x, y, data) {
    const tile = data.terrain[y]?.[x]; if (!tile) return false;
    const d = Math.hypot(x - data.spawn.x, y - data.spawn.y);
    if (d < (type === 'ore' ? 14 : type === 'rock' ? 7 : 5)) return false;
    if (data.layers.hydro[y]?.[x] === 'riverbed') return false;
    if (type === 'tree') return ['grass', 'dirt'].includes(tile) && data.layers.zone[y][x] !== 'mountain';
    if (type === 'berry') return tile === 'grass' && data.layers.biome[y][x] !== 'desert';
    if (type === 'bush') return ['grass', 'dirt', 'sand'].includes(tile) && data.layers.zone[y][x] !== 'mountain';
    if (type === 'rock') return ['stone', 'dirt', 'grass'].includes(tile);
    if (type === 'ore') return tile === 'stone' || data.layers.zone[y][x] === 'mountain';
    return ['grass', 'dirt', 'sand'].includes(tile);
  }

  function resourceCenter(type, data, index) {
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < 120; i++) {
      const x = 2 + Math.floor(data.ctx.rand() * Math.max(1, data.ctx.cols - 4));
      const y = 2 + Math.floor(data.ctx.rand() * Math.max(1, data.ctx.rows - 4));
      if (!canPlace(type, x, y, data)) continue;
      const z = data.layers.zone[y][x], b = data.layers.biome[y][x];
      let s = noise(data.ctx.seed, x + index, y - index, `${type}-score`) * 2;
      if (type === 'tree') s += data.layers.fertility[y][x] * 9 + (z === 'forest_core' ? 7 : z === 'meadow' ? 3 : 0) - (b === 'desert' ? 8 : 0);
      if (type === 'berry') s += data.layers.fertility[y][x] * 8 + (z === 'meadow' ? 4 : 0) - (b === 'desert' ? 9 : 0);
      if (type === 'rock') s += data.layers.rock[y][x] * 9 + (z === 'mountain' ? 7 : 0);
      if (type === 'ore') s += data.layers.rock[y][x] * 12 + (z === 'mountain' ? 10 : 0) + (data.terrain[y][x] === 'stone' ? 6 : -4);
      if (type === 'bush') s += data.layers.fertility[y][x] * 5 + data.layers.moisture[y][x] * 3;
      if (type === 'logs') s += b === 'forest' ? 5 : 1;
      if (s > bestScore) { bestScore = s; best = { x, y }; }
    }
    return best;
  }

  function placeCluster(type, center, clusterSize, data, index) {
    const radius = type === 'tree' ? 4.2 : type === 'ore' ? 2.6 : type === 'rock' ? 3.4 : 2.8;
    for (let i = 0, placed = 0; i < clusterSize * 6 && placed < clusterSize; i++) {
      const a = data.ctx.rand() * Math.PI * 2, r = Math.sqrt(data.ctx.rand()) * radius;
      const x = Math.round(center.x + Math.cos(a) * r), y = Math.round(center.y + Math.sin(a) * r);
      if (canPlace(type, x, y, data) && noise(data.ctx.seed, x + index, y - index, `${type}-gap`) > .14 && data.add(type, x, y)) placed++;
    }
  }

  function addPois(data) {
    const size = typeof getMapSizeDef === 'function' ? getMapSizeDef(data.ctx.config.mapSize) : { poiCount: 5 };
    const total = Math.max(3, size.poiCount || 5);
    const points = [];
    for (let i = 0; i < total; i++) {
      const plan = i % 3 === 0 || data.layers.story === 'mining_scars' ? { obj: 'cache', name: 'Sinal mineral' } : i % 2 === 0 ? { obj: 'ruin', name: 'Ruína antiga' } : { obj: 'supply_crate', name: 'Caixa perdida' };
      const p = poiTile(data, plan);
      if (!p) continue;
      const obj = data.add(plan.obj, p.x, p.y, { poiId: `poi_${i}`, story: data.layers.story });
      if (!obj) continue;
      decoratePoi(data, obj, plan.obj);
      points.push({ id: `poi_${i}`, name: `${plan.name} ${i + 1}`, type: plan.obj, x: p.x, y: p.y, zone: data.layers.zone[p.y][p.x], biome: data.layers.biome[p.y][p.x], story: data.layers.story, discovered: false, inspected: false });
    }
    return points;
  }

  function poiTile(data, plan) {
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < 300; i++) {
      const x = 4 + Math.floor(data.ctx.rand() * Math.max(1, data.ctx.cols - 8)), y = 4 + Math.floor(data.ctx.rand() * Math.max(1, data.ctx.rows - 8));
      if (Math.hypot(x - data.spawn.x, y - data.spawn.y) < Math.min(data.ctx.cols, data.ctx.rows) * .18) continue;
      if (data.objects.some(o => Math.abs(o.x - x) <= 2 && Math.abs(o.y - y) <= 2)) continue;
      if (data.layers.hydro[y][x] === 'riverbed') continue;
      if (data.terrain[y][x] === 'stone' && plan.obj !== 'cache') continue;
      let score = noise(data.ctx.seed, x, y, `poi-${plan.obj}`) * 2 + Math.min(30, Math.hypot(x - data.spawn.x, y - data.spawn.y)) * .08;
      if (['meadow', 'rough_field', 'forest_core', 'mountain'].includes(data.layers.zone[y][x])) score += 4;
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
    return best;
  }

  function decoratePoi(data, obj, type) {
    const radius = type === 'ruin' ? 3 : 2;
    for (let y = obj.y - radius; y <= obj.y + radius; y++) for (let x = obj.x - radius; x <= obj.x + radius; x++) {
      if (!data.terrain[y]?.[x] || Math.hypot(x - obj.x, y - obj.y) > radius + .2) continue;
      if ((x !== obj.x || y !== obj.y) && data.ctx.rand() > .74) data.add(type === 'ruin' ? 'rubble' : type === 'cache' ? 'rock' : 'logs', x, y);
      if (data.terrain[y][x] === 'stone' && data.layers.hydro[y][x] !== 'riverbed') data.terrain[y][x] = 'dirt';
    }
  }

  function summarize(ctx, layers, terrain, objects, pois, spawn) {
    const counts = { terrain: {}, objects: {}, biomes: {}, zones: {}, hydrology: {} };
    for (let y = 0; y < ctx.rows; y++) for (let x = 0; x < ctx.cols; x++) {
      counts.terrain[terrain[y][x]] = (counts.terrain[terrain[y][x]] || 0) + 1;
      counts.biomes[layers.biome[y][x]] = (counts.biomes[layers.biome[y][x]] || 0) + 1;
      counts.zones[layers.zone[y][x]] = (counts.zones[layers.zone[y][x]] || 0) + 1;
      if (layers.hydro[y][x]) counts.hydrology[layers.hydro[y][x]] = (counts.hydrology[layers.hydro[y][x]] || 0) + 1;
    }
    for (const obj of objects || []) counts.objects[obj.type] = (counts.objects[obj.type] || 0) + 1;
    return { version: VERSION, seed: ctx.seed, story: layers.story, spawn: { ...spawn }, map: { cols: ctx.cols, rows: ctx.rows, size: ctx.config.mapSize }, ratios: Object.fromEntries(Object.entries(layers.stats).map(([k, v]) => [k, Number(v.toFixed(3))])), counts, poiCount: pois?.length || 0, layerModel: ['height', 'moisture', 'temperature', 'fertility', 'rock', 'biome', 'zone', 'hydrology'] };
  }

  function generateWorldFromSeedV2(config) {
    config = { ...defaultNewGameConfig, ...config };
    const size = typeof getMapSizeDef === 'function' ? getMapSizeDef(config.mapSize) : { cols: 64, rows: 46, resourceMultiplier: 1, poiCount: 5 };
    const seed = config.seed || 'HAVENFALL';
    const rand = typeof seededRandom === 'function' ? seededRandom(`${seed}|${config.mapSize}|${config.difficulty}|worldgen-v2`) : Math.random;
    const ctx = { seed, cols: size.cols, rows: size.rows, config, rand, size };
    const layers = buildLayers(ctx);
    const terrain = terrainFromLayers(ctx, layers);
    carveHydrology(ctx, layers, terrain);
    const spawn = chooseSpawn(terrain, ctx, layers);
    carveSpawn(terrain, spawn, ctx, layers);

    const objects = [], occupied = new Set();
    const add = (type, x, y, extra = {}) => {
      x = Math.round(x); y = Math.round(y);
      if (typeof isWorldCoordInside === 'function' && !isWorldCoordInside(x, y, ctx.cols, ctx.rows)) return null;
      if (!terrain[y]?.[x]) return null;
      const key = `${x},${y}`;
      if (occupied.has(key)) return null;
      const obj = { id: typeof worldUid === 'function' ? worldUid(type, objects.length, seed) : `${type}_${objects.length}`, type, x, y, ...extra };
      objects.push(obj); occupied.add(key); return obj;
    };

    const data = { ctx, terrain, layers, spawn, objects, add };
    addResources(data);
    const pointsOfInterest = addPois(data);
    add('campfire', spawn.x, spawn.y); add('crate', spawn.x + 2, spawn.y); add('logs', spawn.x - 2, spawn.y + 1);

    const tileSize = typeof TILE !== 'undefined' ? TILE : 48;
    let world = { seed, mapSize: config.mapSize, difficulty: config.difficulty, chunkMode: !!size.chunkMode, biomeIntent: size.biomeIntent || 'layered', planetScan: typeof compactPlanetScanForWorld === 'function' ? compactPlanetScanForWorld(config) : null, cols: ctx.cols, rows: ctx.rows, tileSize, width: ctx.cols * tileSize, height: ctx.rows * tileSize, terrain, objects, exploration: typeof makeExplorationMatrix === 'function' ? makeExplorationMatrix(ctx.cols, ctx.rows) : grid(ctx.rows, ctx.cols, false), visibleTiles: [], spawn, spawnPoints: typeof makeSpawnPoints === 'function' ? makeSpawnPoints(spawn, ctx.cols, ctx.rows) : [], pointsOfInterest, weatherPattern: typeof generateWeatherPattern === 'function' ? generateWeatherPattern(config, rand) : [], biomes: layers.biome.map(row => row.slice()), worldgenZones: layers.zone.map(row => row.slice()), worldgenHydrology: layers.hydro.map(row => row.slice()), worldStory: layers.story, generationVersion: VERSION };
    world.generation = summarize(ctx, layers, world.terrain, world.objects, world.pointsOfInterest, world.spawn);

    if (window.BiomeEngine?.applyToWorld) world = window.BiomeEngine.applyToWorld(world, config);
    carveSpawn(world.terrain, world.spawn, ctx, layers);
    for (let y = 0; y < world.rows; y++) for (let x = 0; x < world.cols; x++) {
      const h = layers.hydro[y][x];
      if (h === 'riverbed') world.terrain[y][x] = layers.biome[y][x] === 'desert' ? 'sand' : 'dirt';
      else if (h === 'bank' && world.terrain[y][x] === 'stone') world.terrain[y][x] = 'dirt';
    }
    world.biomes = layers.biome.map(row => row.slice());
    world.worldgenZones = layers.zone.map(row => row.slice());
    world.worldgenHydrology = layers.hydro.map(row => row.slice());
    world.generationVersion = `${VERSION}+biome-compatible`;
    world.generationDebug = { version: VERSION, story: layers.story, availableLayers: ['biomes', 'worldgenZones', 'worldgenHydrology'], note: 'Use HavenfallWorldGenV2.describeTile(x, y) para ler camadas invisíveis em runtime.' };
    world.generation = summarize(ctx, layers, world.terrain, world.objects || [], world.pointsOfInterest || [], world.spawn || spawn);
    window.HavenfallWorldGenV2.lastContext = { ctx, layers };
    return world;
  }

  function createTerrainMapV2(cols, rows, config, rand) {
    const ctx = { seed: config?.seed || 'HAVENFALL', cols, rows, config: config || {}, rand: rand || Math.random, size: typeof getMapSizeDef === 'function' ? getMapSizeDef(config?.mapSize) : {} };
    const layers = buildLayers(ctx);
    const terrain = terrainFromLayers(ctx, layers);
    carveHydrology(ctx, layers, terrain);
    return terrain;
  }

  function describeTile(x, y) {
    const layers = window.HavenfallWorldGenV2?.lastContext?.layers;
    const ix = Math.round(x), iy = Math.round(y);
    if (!layers || layers.height[iy]?.[ix] == null) return null;
    return { x: ix, y: iy, height: Number(layers.height[iy][ix].toFixed(3)), moisture: Number(layers.moisture[iy][ix].toFixed(3)), temperature: Number(layers.temperature[iy][ix].toFixed(3)), fertility: Number(layers.fertility[iy][ix].toFixed(3)), rock: Number(layers.rock[iy][ix].toFixed(3)), biome: layers.biome[iy][ix], zone: layers.zone[iy][ix], hydrology: layers.hydro[iy][ix] };
  }

  window.HavenfallWorldGenV2 = { version: VERSION, generateWorldFromSeed: generateWorldFromSeedV2, createTerrainMap: createTerrainMapV2, buildLayers, describeTile, lastContext: null };
  try { window.generateWorldFromSeed = generateWorldFromSeedV2; generateWorldFromSeed = generateWorldFromSeedV2; } catch (_) { window.generateWorldFromSeed = generateWorldFromSeedV2; }
  try { window.createTerrainMap = createTerrainMapV2; createTerrainMap = createTerrainMapV2; } catch (_) { window.createTerrainMap = createTerrainMapV2; }
})();
