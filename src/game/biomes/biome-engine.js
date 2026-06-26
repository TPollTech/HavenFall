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
    if (cold > 0.72 - giantBias) return 'snow';
    if (dry > 0.70 - giantBias && cold < 0.68) return 'desert';
    if (forest > 0.22) return 'forest';
    return dry > 0.58 ? 'desert' : 'forest';
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
    decorateExistingObjects(world, seed);
    addBiomeForage(world, seed);
    world.generationVersion = `${world.generationVersion || 'world'}+biomes`;
    return world;
  }

  window.BiomeEngine = {
    createBiomeMap,
    applyToWorld,
    getBiomeIdAt,
    canSpawnMobAt,
    spawnWeightAt,
    installBiomeObjectDefs
  };

  window.biomeDefinitions = BiomeRegistry.all();
  window.biomeAt = (x, y, seed = state?.config?.seed || 'biome') => selectBiomeId(x, y, seed, state?.config || {});
})();
