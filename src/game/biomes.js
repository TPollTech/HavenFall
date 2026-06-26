'use strict';

const biomeDefinitions = Object.freeze({
  forest: {
    label: 'Floresta',
    tileFloor: 'grass',
    trees: ['oak_tree', 'birch_tree'],
    spawnMobs: ['rabbit', 'wolf'],
    forageables: ['berry', 'herbs']
  },
  swamp: {
    label: 'Pântano',
    tileFloor: 'dirt',
    trees: ['willow_tree'],
    spawnMobs: ['spider'],
    forageables: ['mushrooms', 'herbs']
  },
  tundra: {
    label: 'Tundra fria',
    tileFloor: 'stone',
    trees: ['pine_tree'],
    spawnMobs: ['wolf'],
    forageables: ['dry_twigs']
  },
  meadow: {
    label: 'Pradaria',
    tileFloor: 'grass',
    trees: ['tree'],
    spawnMobs: ['rabbit'],
    forageables: ['berry']
  }
});

function biomeAt(x, y, seed = state?.config?.seed || 'biome') {
  const moisture = worldNoise(seed, Math.floor(x / 6), Math.floor(y / 6), 'biome-moisture');
  const cold = worldNoise(seed, Math.floor(x / 8), Math.floor(y / 8), 'biome-cold');
  const forest = worldNoise(seed, Math.floor(x / 5), Math.floor(y / 5), 'biome-forest');
  if (cold > 0.78) return 'tundra';
  if (moisture > 0.72) return 'swamp';
  if (forest > 0.42) return 'forest';
  return 'meadow';
}

function createBiomeMap(cols, rows, seed) {
  const map = Array.from({ length: rows }, () => Array(cols).fill('meadow'));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) map[y][x] = biomeAt(x, y, seed);
  }
  return map;
}

function applyBiomeTerrain(world) {
  if (!world?.terrain || !world.biomes) return;
  for (let y = 0; y < world.rows; y++) {
    for (let x = 0; x < world.cols; x++) {
      const biome = biomeDefinitions[world.biomes[y]?.[x]] || biomeDefinitions.meadow;
      if (world.terrain[y][x] !== 'stone' || biome.tileFloor === 'stone') {
        if (world.terrain[y][x] !== 'sand') world.terrain[y][x] = biome.tileFloor;
      }
    }
  }
}

function installBiomeObjectDefs() {
  if (window.HavenfallContext?.biomeObjectDefsInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  for (const key of ['oak_tree', 'birch_tree', 'pine_tree', 'palm_tree', 'willow_tree']) {
    objectDefs[key] = {
      name: ({ oak_tree: 'carvalho', birch_tree: 'bétula', pine_tree: 'pinheiro', palm_tree: 'palmeira', willow_tree: 'salgueiro' })[key],
      img: assetAudit?.vegetation?.(key) || 'tree',
      blocks: true,
      gather: { wood: key === 'pine_tree' ? 10 : 8 },
      work: key === 'pine_tree' ? 3.8 : 3.2,
      respawn: false
    };
  }
  objectDefs.herbs = { name: 'ervas medicinais', img: 'res_herbs', blocks: false, gather: { medicine: 1 }, work: 2.0 };
  objectDefs.mushrooms = { name: 'cogumelos', img: 'res_berries', blocks: false, gather: { food: 4 }, work: 2.2 };
  objectDefs.dry_twigs = { name: 'gravetos secos', img: 'logs', blocks: false, gather: { wood: 3 }, work: 1.2 };
  window.HavenfallContext.biomeObjectDefsInstalled = true;
}

function installBiomeGenerationPatch() {
  if (window.HavenfallContext?.biomeGenerationPatched || typeof generateWorldFromSeed !== 'function') return;
  const nativeGenerateWorldFromSeed = generateWorldFromSeed;
  generateWorldFromSeed = function generateWorldFromSeedWithBiomes(config) {
    const world = nativeGenerateWorldFromSeed(config);
    world.biomes = createBiomeMap(world.cols, world.rows, config?.seed || world.seed || 'biome');
    applyBiomeTerrain(world);
    decorateBiomeObjects(world, config?.seed || world.seed || 'biome');
    world.generationVersion = '1.10-biomes';
    return world;
  };
  window.HavenfallContext.biomeGenerationPatched = true;
}

function decorateBiomeObjects(world, seed) {
  if (!world?.objects || !world.biomes) return;
  for (const obj of world.objects) {
    if (obj.type !== 'tree') continue;
    const biome = world.biomes[obj.y]?.[obj.x] || 'forest';
    const def = biomeDefinitions[biome] || biomeDefinitions.forest;
    const variants = def.trees || ['tree'];
    const n = worldNoise(seed, obj.x, obj.y, 'tree-variant');
    const next = variants[Math.floor(n * variants.length)] || 'tree';
    if (objectDefs[next]) obj.type = next;
  }

  const addForage = (type, chanceTag) => {
    const amount = Math.max(6, Math.floor((world.cols * world.rows) * 0.0015));
    for (let i = 0; i < amount; i++) {
      const x = 2 + Math.floor(worldNoise(seed, i, 1, `${chanceTag}-x`) * (world.cols - 4));
      const y = 2 + Math.floor(worldNoise(seed, i, 2, `${chanceTag}-y`) * (world.rows - 4));
      const biome = world.biomes[y]?.[x];
      const allowed = biomeDefinitions[biome]?.forageables?.includes(type);
      if (!allowed || getWorldObjectAtList(world.objects, x, y)) continue;
      world.objects.push({ id: worldUid(type, world.objects.length, seed), type, x, y });
    }
  };
  addForage('herbs', 'herbs');
  addForage('mushrooms', 'mushrooms');
  addForage('dry_twigs', 'twigs');
}

function getWorldObjectAtList(objects, x, y) {
  return objects.find(o => o.x === x && o.y === y) || null;
}

window.biomeDefinitions = biomeDefinitions;
window.biomeAt = biomeAt;

installBiomeObjectDefs();
installBiomeGenerationPatch();
