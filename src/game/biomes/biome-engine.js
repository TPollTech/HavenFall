'use strict';

(() => {
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

  function selectBiomeId(x, y, seed, config = {}) {
    const macroX = Math.floor(x / 18);
    const macroY = Math.floor(y / 18);
    const cold = worldNoise(seed, macroX, macroY, 'biome-cold');
    const dry = worldNoise(seed, macroX, macroY, 'biome-dry');
    const forest = worldNoise(seed, Math.floor(x / 11), Math.floor(y / 11), 'biome-forest');
    const giantBias = config.mapSize === 'giant' || config.mapSize === 'infinite_chunks' ? 0.06 : 0;
    if (cold > 0.70 - giantBias) return 'snow';
    if (dry > 0.64 - giantBias && cold < 0.68) return 'desert';
    if (forest > 0.42) return 'forest';
    return dry > 0.54 ? 'desert' : 'forest';
  }

  function createBiomeMap(cols, rows, seed, config = {}) {
    const map = Array.from({ length: rows }, () => Array(cols).fill('forest'));
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) map[y][x] = selectBiomeId(x, y, seed, config);
    }
    return smoothBiomeMap(map, seed);
  }

  function smoothBiomeMap(map, seed) {
    const rows = map.length;
    const cols = map[0]?.length || 0;
    const copy = map.map(row => row.slice());
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        if (worldNoise(seed, x, y, 'biome-smooth') < 0.34) continue;
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

  function applyBiomeTerrain(world, config = {}) {
    if (!world?.terrain || !world.biomes) return world;
    const seed = config.seed || world.seed || 'biome';
    const spawn = world.spawn || { x: 0, y: 0 };
    for (let y = 0; y < world.rows; y++) {
      for (let x = 0; x < world.cols; x++) {
        const biome = BiomeRegistry.get(world.biomes[y]?.[x]);
        if (!biome) continue;
        const distanceToSpawn = Math.hypot(x - spawn.x, y - spawn.y);
        if (distanceToSpawn < 6) continue;
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
    const sizeBias = config.mapSize === 'giant' || config.mapSize === 'infinite_chunks' ? 1.25 : config.mapSize === 'huge' ? 1.12 : 1;
    const scanBias = dominant === 'rock' ? 1.55 : 0.85 + Math.max(0, Math.min(70, rock)) / 70;
    return Math.max(0.75, Math.min(2.0, sizeBias * scanBias));
  }

  function createMountainRanges(world, config = {}) {
    if (!world?.terrain) return world;
    const seed = config.seed || world.seed || 'mountains';
    const rand = typeof seededRandom === 'function' ? seededRandom(`${seed}|mountain-ranges|v2`) : Math.random;
    const density = mountainDensity(config);
    const area = world.cols * world.rows;
    const rangeCount = Math.max(2, Math.round(area / 3600 * density));
    const spawn = world.spawn || { x: Math.floor(world.cols / 2), y: Math.floor(world.rows / 2) };
    const occupied = new Set((world.objects || []).map(obj => `${obj.x},${obj.y}`));

    for (let i = 0; i < rangeCount; i++) {
      const start = mountainRangeStart(world, spawn, rand);
      if (!start) continue;
      const angle = rand() * Math.PI * 2;
      const length = Math.max(18, Math.floor((Math.min(world.cols, world.rows) * (0.28 + rand() * 0.30)) * density));
      const width = 2.4 + rand() * 3.2 + density * 0.8;
      carveMountainRidge(world, seed, start, angle, length, width, spawn, occupied, i);
    }

    smoothMountainTerrain(world, seed, occupied);
    world.mountainGenerationVersion = '2.0-ridges';
    return world;
  }

  function mountainRangeStart(world, spawn, rand) {
    for (let tries = 0; tries < 80; tries++) {
      const x = 4 + Math.floor(rand() * Math.max(1, world.cols - 8));
      const y = 4 + Math.floor(rand() * Math.max(1, world.rows - 8));
      if (Math.hypot(x - spawn.x, y - spawn.y) < 18) continue;
      return { x, y };
    }
    return null;
  }

  function carveMountainRidge(world, seed, start, angle, length, width, spawn, occupied, index) {
    let cx = start.x;
    let cy = start.y;
    let dir = angle;
    for (let step = 0; step < length; step++) {
      const turn = (worldNoise(seed, step, index, 'mountain-turn') - 0.5) * 0.42;
      dir += turn;
      cx += Math.cos(dir) * 0.92;
      cy += Math.sin(dir) * 0.92;
      if (cx < 3 || cy < 3 || cx >= world.cols - 3 || cy >= world.rows - 3) break;

      const localWidth = width * (0.72 + worldNoise(seed, step, index, 'mountain-width') * 0.72);
      const minX = Math.max(1, Math.floor(cx - localWidth - 2));
      const maxX = Math.min(world.cols - 2, Math.ceil(cx + localWidth + 2));
      const minY = Math.max(1, Math.floor(cy - localWidth - 2));
      const maxY = Math.min(world.rows - 2, Math.ceil(cy + localWidth + 2));
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (occupied.has(`${x},${y}`)) continue;
          const spawnDist = Math.hypot(x - spawn.x, y - spawn.y);
          if (spawnDist < 13) continue;
          const d = Math.hypot(x - cx, y - cy);
          const rough = worldNoise(seed, x, y, `mountain-rough-${index}`);
          const score = 1 - d / localWidth + (rough - 0.5) * 0.34;
          if (score > 0.02) world.terrain[y][x] = 'stone';
          else if (score > -0.14 && world.terrain[y][x] !== 'sand') world.terrain[y][x] = 'dirt';
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
        if (current === 'stone' && stones <= 1 && worldNoise(seed, x, y, 'mountain-erosion') > 0.22) copy[y][x] = 'dirt';
        if (current !== 'stone' && stones >= 6 && worldNoise(seed, x, y, 'mountain-fill') > 0.18) copy[y][x] = 'stone';
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

  function installBiomeObjectDefs() {
    if (window.HavenfallContext?.biomeObjectDefsInstalled) return;
    window.HavenfallContext = window.HavenfallContext || {};
    const treeNames = { oak_tree: 'carvalho', birch_tree: 'bétula', pine_tree: 'pinheiro', palm_tree: 'palmeira', willow_tree: 'salgueiro' };
    for (const [key, name] of Object.entries(treeNames)) {
      objectDefs[key] = {
        name,
        img: assetAudit?.vegetation?.(key) || 'tree',
        blocks: true,
        gather: { wood: key === 'pine_tree' ? 10 : key === 'palm_tree' ? 6 : 8 },
        work: key === 'pine_tree' ? 3.8 : 3.2,
        respawn: false
      };
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
    world.biomeDefinitionsVersion = '1.0';
    applyBiomeTerrain(world, config);
    createMountainRanges(world, config);
    decorateExistingObjects(world, seed);
    addBiomeForage(world, seed);
    world.generationVersion = `${world.generationVersion || 'world'}+biomes`;
    return world;
  }

  window.BiomeEngine = {
    createBiomeMap,
    applyToWorld,
    createMountainRanges,
    getBiomeIdAt,
    canSpawnMobAt,
    spawnWeightAt,
    installBiomeObjectDefs
  };

  window.biomeDefinitions = BiomeRegistry.all();
  window.biomeAt = (x, y, seed = state?.config?.seed || 'biome') => selectBiomeId(x, y, seed, state?.config || {});
})();
