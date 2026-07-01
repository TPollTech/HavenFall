'use strict';

(() => {
  const VEGETATION_OBJECT_TYPES = new Set(['tree', 'oak_tree', 'birch_tree', 'pine_tree', 'palm_tree', 'willow_tree', 'bush', 'berry', 'herbs', 'mushrooms', 'dry_twigs']);
  const DEFAULT_CHUNK_SIZE = 32;

  function pickWeightedTerrain(weights, seed, x, y, fallback = 'grass') {
    const entries = Object.entries(weights || {});
    if (!entries.length) return fallback;
    const total = entries.reduce((sum, [, weight]) => sum + Math.max(0, Number(weight || 0)), 0);
    if (total <= 0) return fallback;
    let n = worldNoise(seed, x, y, 'biome-terrain') * total;
    for (const [terrain, weight] of entries) {
      n -= Math.max(0, Number(weight || 0));
      if (n <= 0) return terrain;
    }
    return fallback;
  }

  function mapSizeDef(config = {}) {
    return typeof getMapSizeDef === 'function' ? getMapSizeDef(config.mapSize) : {};
  }

  function biomeChunkSize(config = {}) {
    const size = mapSizeDef(config);
    return Math.max(16, Number(size.chunkSize || DEFAULT_CHUNK_SIZE));
  }

  function biomePatchChunks(config = {}) {
    const size = mapSizeDef(config);
    return Math.max(2, Math.min(5, Number(size.macroBiomeChunks || (config.mapSize === 'large' ? 2 : 3))));
  }

  function macroBiomeCell(x, y, config = {}) {
    const chunkSize = biomeChunkSize(config);
    const patch = biomePatchChunks(config);
    return {
      x: Math.floor(x / (chunkSize * patch)),
      y: Math.floor(y / (chunkSize * patch))
    };
  }

  function biomeBias(config = {}) {
    const dominant = typeof scanDominantBiome === 'function' ? scanDominantBiome(config) : null;
    const forest = typeof scanBiomeStat === 'function' ? scanBiomeStat(config, 'forest') : 35;
    const desert = typeof scanBiomeStat === 'function' ? scanBiomeStat(config, 'desert') : 20;
    const snow = typeof scanBiomeStat === 'function' ? scanBiomeStat(config, 'snow') : 14;
    const rock = typeof scanBiomeStat === 'function' ? scanBiomeStat(config, 'rock') : 24;
    return { dominant, forest, desert, snow, rock };
  }

  function weightedBiomePick(seed, cellX, cellY, config = {}) {
    const bias = biomeBias(config);
    const weights = {
      forest: 44 + Math.max(0, bias.forest - 34) * 0.8,
      desert: 17 + Math.max(0, bias.desert - 22) * 1.1,
      snow: 10 + Math.max(0, bias.snow - 22) * 1.0,
      rock: 14 + Math.max(0, bias.rock - 24) * 1.05
    };

    if (bias.dominant === 'forest') weights.forest += 24;
    if (bias.dominant === 'desert') weights.desert += 26;
    if (bias.dominant === 'snow') weights.snow += 24;
    if (bias.dominant === 'rock') weights.rock += 22;
    if (config.mapSize === 'giant' || config.mapSize === 'infinite_chunks') {
      weights.desert += 6;
      weights.snow += 5;
      weights.rock += 7;
    }

    const entries = Object.entries(weights).map(([key, value]) => [key, Math.max(0, Number(value || 0))]);
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    let roll = worldNoise(seed, cellX, cellY, 'macro-biome-pick-v1') * Math.max(1, total);
    for (const [key, value] of entries) {
      roll -= value;
      if (roll <= 0) return key;
    }
    return 'forest';
  }

  function selectMacroBiomeId(x, y, seed, config = {}) {
    const cell = macroBiomeCell(x, y, config);
    const localX = x / biomeChunkSize(config);
    const localY = y / biomeChunkSize(config);
    const candidates = [];

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = cell.x + dx;
        const cy = cell.y + dy;
        const biome = weightedBiomePick(seed, cx, cy, config);
        const patch = biomePatchChunks(config);
        const centerX = (cx + 0.5) * patch + (worldNoise(seed, cx, cy, 'macro-biome-center-x') - 0.5) * patch * 0.45;
        const centerY = (cy + 0.5) * patch + (worldNoise(seed, cx, cy, 'macro-biome-center-y') - 0.5) * patch * 0.45;
        const d = Math.hypot(localX - centerX, localY - centerY);
        const weight = d - worldNoise(seed, cx, cy, 'macro-biome-border') * patch * 0.35;
        candidates.push({ biome, weight });
      }
    }

    candidates.sort((a, b) => a.weight - b.weight);
    const primary = candidates[0]?.biome || 'forest';
    const secondary = candidates.find(item => item.biome !== primary)?.biome || primary;
    const edgeBlend = Math.abs((candidates[1]?.weight ?? 999) - (candidates[0]?.weight ?? 0));
    if (edgeBlend < 0.34 && worldNoise(seed, x, y, 'macro-biome-edge-mix') > 0.72) return secondary;
    return primary;
  }

  function selectBiomeId(x, y, seed, config = {}) {
    return selectMacroBiomeId(x, y, seed, config);
  }

  function createBiomeMap(cols, rows, seed, config = {}) {
    const map = Array.from({ length: rows }, () => Array(cols).fill('forest'));
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) map[y][x] = selectBiomeId(x, y, seed, config);
    }
    const passCount = config.mapSize === 'large' ? 1 : 2;
    let next = map;
    for (let i = 0; i < passCount; i++) next = smoothBiomeMap(next, seed, i);
    return next;
  }

  function smoothBiomeMap(map, seed, pass = 0) {
    const rows = map.length;
    const cols = map[0]?.length || 0;
    const copy = map.map(row => row.slice());
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        if (worldNoise(seed, x, y, `biome-smooth-${pass}`) < 0.26) continue;
        const counts = {};
        for (let yy = y - 1; yy <= y + 1; yy++) {
          for (let xx = x - 1; xx <= x + 1; xx++) counts[map[yy][xx]] = (counts[map[yy][xx]] || 0) + 1;
        }
        const [best, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [map[y][x], 0];
        if (count >= 5) copy[y][x] = best;
      }
    }
    return copy;
  }

  function objectMap(world) {
    const map = new Map();
    for (const obj of world?.objects || []) {
      if (!obj) continue;
      map.set(`${obj.x},${obj.y}`, obj);
    }
    return map;
  }

  function applyBiomeTerrain(world, config = {}) {
    if (!world?.terrain || !world.biomes) return world;
    const seed = config.seed || world.seed || 'biome';
    const spawn = world.spawn || { x: 0, y: 0 };
    const occupied = objectMap(world);
    for (let y = 0; y < world.rows; y++) {
      for (let x = 0; x < world.cols; x++) {
        const biome = BiomeRegistry.get(world.biomes[y]?.[x]);
        if (!biome) continue;
        const distanceToSpawn = Math.hypot(x - spawn.x, y - spawn.y);
        if (distanceToSpawn < 6) continue;

        const obj = occupied.get(`${x},${y}`);
        if (obj && VEGETATION_OBJECT_TYPES.has(obj.type)) continue;

        const current = world.terrain[y][x];
        if (current === 'stone' && biome.id !== 'snow' && worldNoise(seed, x, y, 'preserve-stone') > 0.42) continue;
        if (current === 'sand' && biome.id !== 'desert' && worldNoise(seed, x, y, 'preserve-sand') > 0.55) continue;
        world.terrain[y][x] = pickWeightedTerrain(biome.terrainWeights, seed, x, y, biome.tileFloor);
      }
    }
    return world;
  }

  function mountainDensity(config = {}) {
    const rock = typeof scanBiomeStat === 'function' ? scanBiomeStat(config, 'rock') : 24;
    const dominant = typeof scanDominantBiome === 'function' ? scanDominantBiome(config) : null;
    const sizeBias = config.mapSize === 'giant' || config.mapSize === 'infinite_chunks' ? 0.92 : config.mapSize === 'huge' ? 0.86 : 0.78;
    const scanBias = dominant === 'rock' ? 1.18 : 0.54 + Math.max(0, Math.min(70, rock)) / 150;
    return Math.max(0.35, Math.min(1.12, sizeBias * scanBias));
  }

  function createMountainRanges(world, config = {}) {
    if (!world?.terrain) return world;
    const seed = config.seed || world.seed || 'mountains';
    const rand = typeof seededRandom === 'function' ? seededRandom(`${seed}|mountain-ranges|v3-controlled`) : Math.random;
    const density = mountainDensity(config);
    const area = world.cols * world.rows;
    const baseCount = Math.round(area / 9800 * density);
    const rangeCount = Math.max(1, Math.min(config.mapSize === 'infinite_chunks' ? 5 : 4, baseCount));
    const spawn = world.spawn || { x: Math.floor(world.cols / 2), y: Math.floor(world.rows / 2) };
    const occupied = new Set((world.objects || []).map(obj => `${obj.x},${obj.y}`));

    for (let i = 0; i < rangeCount; i++) {
      const start = mountainRangeStart(world, spawn, rand);
      if (!start) continue;
      const angle = rand() * Math.PI * 2;
      const length = Math.max(14, Math.floor((Math.min(world.cols, world.rows) * (0.12 + rand() * 0.16)) * density));
      const width = 1.15 + rand() * 1.15 + density * 0.52;
      carveMountainRidge(world, seed, start, angle, length, width, spawn, occupied, i);
    }

    smoothMountainTerrain(world, seed, occupied);
    erodeOversizedStoneCoverage(world, seed, config, occupied);
    removeVegetationFromInvalidMountainTiles(world);
    world.mountainGenerationVersion = '3.1-controlled-ridges-clean-objects';
    return world;
  }

  function mountainRangeStart(world, spawn, rand) {
    for (let tries = 0; tries < 100; tries++) {
      const x = 4 + Math.floor(rand() * Math.max(1, world.cols - 8));
      const y = 4 + Math.floor(rand() * Math.max(1, world.rows - 8));
      if (Math.hypot(x - spawn.x, y - spawn.y) < 30) continue;
      if (world.terrain?.[y]?.[x] === 'water') continue;
      return { x, y };
    }
    return null;
  }

  function carveMountainRidge(world, seed, start, angle, length, width, spawn, occupied, index) {
    let cx = start.x;
    let cy = start.y;
    let dir = angle;
    for (let step = 0; step < length; step++) {
      const turn = (worldNoise(seed, step, index, 'mountain-turn') - 0.5) * 0.34;
      dir += turn;
      cx += Math.cos(dir) * 0.86;
      cy += Math.sin(dir) * 0.86;
      if (cx < 4 || cy < 4 || cx >= world.cols - 4 || cy >= world.rows - 4) break;

      const localWidth = width * (0.55 + worldNoise(seed, step, index, 'mountain-width') * 0.46);
      const minX = Math.max(1, Math.floor(cx - localWidth - 2));
      const maxX = Math.min(world.cols - 2, Math.ceil(cx + localWidth + 2));
      const minY = Math.max(1, Math.floor(cy - localWidth - 2));
      const maxY = Math.min(world.rows - 2, Math.ceil(cy + localWidth + 2));
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (occupied.has(`${x},${y}`)) continue;
          if (world.terrain?.[y]?.[x] === 'water') continue;
          const spawnDist = Math.hypot(x - spawn.x, y - spawn.y);
          if (spawnDist < 22) continue;
          const d = Math.hypot(x - cx, y - cy);
          const rough = worldNoise(seed, x, y, `mountain-rough-${index}`);
          const score = 1 - d / Math.max(0.01, localWidth) + (rough - 0.5) * 0.22;
          if (score > 0.32) world.terrain[y][x] = 'stone';
          else if (score > 0.02 && world.terrain[y][x] !== 'sand') world.terrain[y][x] = 'dirt';
        }
      }
    }
  }

  function smoothMountainTerrain(world, seed, occupied) {
    const copy = world.terrain.map(row => row.slice());
    for (let y = 1; y < world.rows - 1; y++) {
      for (let x = 1; x < world.cols - 1; x++) {
        if (occupied.has(`${x},${y}`)) continue;
        const stones = countNeighborTerrain(world.terrain, x, y, 'stone', 1);
        const current = world.terrain[y][x];
        if (current === 'stone' && stones <= 2 && worldNoise(seed, x, y, 'mountain-erosion') > 0.10) copy[y][x] = 'dirt';
        if (current !== 'stone' && stones >= 7 && worldNoise(seed, x, y, 'mountain-fill') > 0.70) copy[y][x] = 'stone';
      }
    }
    world.terrain = copy;
    return world;
  }

  function stoneCoverage(world) {
    let stones = 0;
    for (let y = 0; y < world.rows; y++) for (let x = 0; x < world.cols; x++) if (world.terrain[y][x] === 'stone') stones++;
    return stones / Math.max(1, world.cols * world.rows);
  }

  function maxStoneCoverage(config = {}) {
    const rock = typeof scanBiomeStat === 'function' ? scanBiomeStat(config, 'rock') : 24;
    const dominant = typeof scanDominantBiome === 'function' ? scanDominantBiome(config) : null;
    return Math.max(0.055, Math.min(0.135, 0.060 + (rock / 1000) + (dominant === 'rock' ? 0.026 : 0)));
  }

  function erodeOversizedStoneCoverage(world, seed, config = {}, occupied = new Set()) {
    const maxCoverage = maxStoneCoverage(config);
    let coverage = stoneCoverage(world);
    if (coverage <= maxCoverage) return world;

    const copy = world.terrain.map(row => row.slice());
    const targetRemovalChance = Math.min(0.72, (coverage - maxCoverage) / Math.max(0.01, coverage) + 0.18);
    const spawn = world.spawn || { x: 0, y: 0 };

    for (let y = 1; y < world.rows - 1; y++) {
      for (let x = 1; x < world.cols - 1; x++) {
        if (copy[y][x] !== 'stone') continue;
        if (occupied.has(`${x},${y}`)) continue;
        if (Math.hypot(x - spawn.x, y - spawn.y) < 26) {
          copy[y][x] = 'dirt';
          continue;
        }
        const stones = countNeighborTerrain(world.terrain, x, y, 'stone', 1);
        const roll = worldNoise(seed, x, y, 'stone-coverage-erosion');
        if (stones <= 3 || roll < targetRemovalChance * (stones >= 7 ? 0.38 : 1)) {
          copy[y][x] = roll > 0.64 ? 'grass' : 'dirt';
        }
      }
    }

    world.terrain = copy;
    return world;
  }

  function countNeighborTerrain(terrain, x, y, type, radius) {
    let count = 0;
    for (let yy = y - radius; yy <= y + radius; yy++) {
      for (let xx = x - radius; xx <= x + radius; xx++) {
        if (xx === x && yy === y) continue;
        if (terrain[yy]?.[xx] === type) count++;
      }
    }
    return count;
  }

  function removeVegetationFromInvalidMountainTiles(world) {
    if (!Array.isArray(world?.objects)) return world;
    world.objects = world.objects.filter(obj => {
      if (!obj || !VEGETATION_OBJECT_TYPES.has(obj.type)) return true;
      const tile = world.terrain?.[obj.y]?.[obj.x];
      return tile !== 'stone' && tile !== 'water';
    });
    return world;
  }

  function installBiomeObjectDefs() {
    if (window.HavenfallContext?.biomeObjectDefsInstalled) return;
    window.HavenfallContext = window.HavenfallContext || {};
    const treeNames = { oak_tree: 'carvalho', birch_tree: 'bétula', pine_tree: 'pinheiro', palm_tree: 'palmeira', willow_tree: 'salgueiro' };
    for (const [key, name] of Object.entries(treeNames)) {
      objectDefs[key] = { name, img: assetAudit?.vegetation?.(key) || 'tree', blocks: true, gather: { wood: key === 'pine_tree' ? 10 : key === 'palm_tree' ? 6 : 8 }, work: key === 'pine_tree' ? 3.8 : 3.2, respawn: false };
    }
    objectDefs.herbs = { name: 'ervas medicinais', img: 'res_herbs', blocks: false, gather: { medicine: 1 }, work: 2.0 };
    objectDefs.mushrooms = { name: 'cogumelos', img: 'res_berries', blocks: false, gather: { food: 4 }, work: 2.2 };
    objectDefs.dry_twigs = { name: 'gravetos secos', img: 'logs', blocks: false, gather: { wood: 3 }, work: 1.2 };
    window.HavenfallContext.biomeObjectDefsInstalled = true;
  }

  function decorateExistingObjects(world, seed) {
    if (!world?.objects || !world.biomes) return;
    for (const obj of world.objects) {
      const biomeId = getBiomeIdAt(world, obj.x, obj.y);
      const biome = BiomeRegistry.get(biomeId);
      if (!biome) continue;
      if (obj.type === 'tree') {
        const variants = biome.trees || ['tree'];
        const pick = variants[Math.floor(worldNoise(seed, obj.x, obj.y, 'tree-variant') * variants.length)] || 'tree';
        if (objectDefs[pick]) obj.type = pick;
      }
      if (obj.type === 'berry' && biome.id === 'desert' && worldNoise(seed, obj.x, obj.y, 'desert-berry') > 0.12) obj.type = 'dry_twigs';
    }
  }

  function addBiomeForage(world, seed) {
    if (!world?.objects || !world.biomes) return;
    const occupied = new Set(world.objects.map(o => `${o.x},${o.y}`));
    for (const biome of Object.values(BiomeRegistry.all())) {
      const density = Math.max(0, Number(biome.objects?.herbDensity ?? 0.25));
      const amount = Math.max(3, Math.floor(world.cols * world.rows * 0.00042 * density));
      for (let i = 0; i < amount; i++) {
        const type = biome.forageables[Math.floor(worldNoise(seed, i, biome.id.length, `${biome.id}-forage-type`) * biome.forageables.length)] || null;
        if (!type || !objectDefs[type]) continue;
        const tile = randomBiomeTile(world, biome.id, seed, i, `${biome.id}-${type}`);
        if (!tile) continue;
        const key = `${tile.x},${tile.y}`;
        if (occupied.has(key)) continue;
        occupied.add(key);
        world.objects.push({ id: worldUid(type, world.objects.length, seed), type, x: tile.x, y: tile.y });
      }
    }
  }

  function randomBiomeTile(world, biomeId, seed, index, salt) {
    for (let tries = 0; tries < 60; tries++) {
      const x = 2 + Math.floor(worldNoise(seed, index, tries, `${salt}-x`) * Math.max(1, world.cols - 4));
      const y = 2 + Math.floor(worldNoise(seed, tries, index, `${salt}-y`) * Math.max(1, world.rows - 4));
      if (world.biomes[y]?.[x] !== biomeId) continue;
      if (world.terrain[y]?.[x] === 'stone' && biomeId !== 'snow') continue;
      return { x, y };
    }
    return null;
  }

  function getBiomeIdAt(worldOrX, xOrY, maybeY) {
    if (typeof worldOrX === 'object') {
      const world = worldOrX;
      const x = Math.round(xOrY);
      const y = Math.round(maybeY);
      return world?.biomes?.[y]?.[x] || 'forest';
    }
    const x = Math.round(worldOrX);
    const y = Math.round(xOrY);
    return state?.world?.biomes?.[y]?.[x] || selectBiomeId(x, y, state?.config?.seed || 'biome', state?.config || {});
  }

  function canSpawnMobAt(mobType, x, y, context = {}) {
    const biomeId = getBiomeIdAt(x, y);
    return BiomeRegistry.canSpawnMobInBiome(mobType, biomeId, context);
  }

  function spawnWeightAt(mobType, x, y, context = {}) {
    const biomeId = getBiomeIdAt(x, y);
    return BiomeRegistry.spawnWeightFor(mobType, biomeId, context);
  }

  function applyToWorld(world, config = {}) {
    if (!world) return world;
    installBiomeObjectDefs();
    const seed = config.seed || world.seed || 'biome';
    world.biomes = createBiomeMap(world.cols, world.rows, seed, config);
    world.biomeDefinitionsVersion = '2.0-macro-chunks';
    world.biomeChunkSize = biomeChunkSize(config);
    world.biomePatchChunks = biomePatchChunks(config);
    applyBiomeTerrain(world, config);
    createMountainRanges(world, config);
    removeVegetationFromInvalidMountainTiles(world);
    decorateExistingObjects(world, seed);
    addBiomeForage(world, seed);
    removeVegetationFromInvalidMountainTiles(world);
    world.generationVersion = `${world.generationVersion || 'world'}+macro-biomes`;
    return world;
  }

  window.BiomeEngine = { createBiomeMap, applyToWorld, createMountainRanges, getBiomeIdAt, canSpawnMobAt, spawnWeightAt, installBiomeObjectDefs };
  window.biomeDefinitions = BiomeRegistry.all();
  window.biomeAt = (x, y, seed = state?.config?.seed || 'biome') => selectBiomeId(x, y, seed, state?.config || {});
})();
