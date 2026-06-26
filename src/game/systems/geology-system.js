'use strict';

(() => {
  const ROCK_DEFS = Object.freeze({
    granite: { label: 'Granito', hp: 180, resource: 'stone', yield: 9, mineSpeed: 0.82, insulation: 0.72 },
    sandstone: { label: 'Arenito', hp: 105, resource: 'stone', yield: 5, mineSpeed: 1.2, insulation: 0.38 },
    slate: { label: 'Ardósia', hp: 145, resource: 'stone', yield: 7, mineSpeed: 1.0, insulation: 0.55 },
    iron: { label: 'Veio de ferro', hp: 165, resource: 'metal', yield: 5, mineSpeed: 0.9, insulation: 0.48 }
  });

  function rockTypeForBiome(biomeId, x, y, seed) {
    const n = typeof worldNoise === 'function' ? worldNoise(seed, x, y, 'rock-type') : Math.random();
    if (biomeId === 'desert') return n > 0.78 ? 'slate' : 'sandstone';
    if (biomeId === 'snow') return n > 0.70 ? 'iron' : 'granite';
    if (n > 0.86) return 'iron';
    if (n > 0.58) return 'slate';
    return 'granite';
  }

  function shouldBecomeMountain(world, x, y, seed) {
    const terrain = world?.terrain?.[y]?.[x];
    if (terrain !== 'stone') return false;
    const spawn = world.spawn || { x: 0, y: 0 };
    if (Math.hypot(x - spawn.x, y - spawn.y) < 8) return false;
    const biomeId = getBiomeIdForWorld(world, x, y);
    const ridge = typeof worldNoise === 'function' ? worldNoise(seed, Math.floor(x / 3), Math.floor(y / 3), 'mountain-ridge') : Math.random();
    const core = typeof worldNoise === 'function' ? worldNoise(seed, x, y, 'mountain-core') : Math.random();
    const threshold = biomeId === 'snow' ? 0.50 : biomeId === 'desert' ? 0.64 : 0.56;
    return ridge > threshold || core > 0.82;
  }

  function getBiomeIdForWorld(world, x, y) {
    return world?.biomes?.[y]?.[x] || (window.BiomeEngine?.getBiomeIdAt?.(world, x, y)) || 'forest';
  }

  function makeEmptyLayer(rows, cols, valueFactory) {
    return Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => valueFactory(x, y)));
  }

  function createRockTile(world, x, y, seed) {
    const biomeId = getBiomeIdForWorld(world, x, y);
    const type = rockTypeForBiome(biomeId, x, y, seed);
    const def = ROCK_DEFS[type] || ROCK_DEFS.granite;
    const hpMultiplier = biomeId === 'desert' ? 0.78 : biomeId === 'snow' ? 1.18 : 1;
    const resourceMultiplier = biomeId === 'desert' ? 0.72 : biomeId === 'snow' ? 1.05 : 1;
    const maxHp = Math.max(40, Math.round(def.hp * hpMultiplier));
    return {
      type,
      hp: maxHp,
      maxHp,
      isRoof: true,
      mineable: true,
      solid: true,
      resource: def.resource,
      yield: Math.max(1, Math.round(def.yield * resourceMultiplier)),
      biomeId,
      insulation: def.insulation,
      collapseRisk: 0
    };
  }

  function createGeologyLayer(world) {
    const rows = Number(world?.rows || world?.terrain?.length || 0);
    const cols = Number(world?.cols || world?.terrain?.[0]?.length || 0);
    const seed = world?.seed || state?.config?.seed || 'geology';
    return makeEmptyLayer(rows, cols, (x, y) => shouldBecomeMountain(world, x, y, seed) ? createRockTile(world, x, y, seed) : null);
  }

  function createRoofLayer(world) {
    const rows = Number(world?.rows || world?.terrain?.length || 0);
    const cols = Number(world?.cols || world?.terrain?.[0]?.length || 0);
    const geology = world?.geologyLayer || [];
    return makeEmptyLayer(rows, cols, (x, y) => !!geology[y]?.[x]?.solid);
  }

  function ensureGeologyState(world = state?.world) {
    if (!world) return null;
    const rows = Number(world.rows || world.terrain?.length || state?.terrain?.length || 0);
    const cols = Number(world.cols || world.terrain?.[0]?.length || state?.terrain?.[0]?.length || 0);
    world.rows = world.rows || rows;
    world.cols = world.cols || cols;
    if (!world.terrain && state?.terrain) world.terrain = state.terrain;
    if (!Array.isArray(world.geologyLayer) || world.geologyLayer.length !== rows || world.geologyLayer[0]?.length !== cols) {
      world.geologyLayer = createGeologyLayer(world);
    }
    if (!Array.isArray(world.roofLayer) || world.roofLayer.length !== rows || world.roofLayer[0]?.length !== cols) {
      world.roofLayer = createRoofLayer(world);
    }
    world.geologyVersion = '1.0';
    return world.geologyLayer;
  }

  function getRockAt(x, y, world = state?.world) {
    ensureGeologyState(world);
    return world?.geologyLayer?.[Math.round(y)]?.[Math.round(x)] || null;
  }

  function hasNaturalRoofAt(x, y, world = state?.world) {
    ensureGeologyState(world);
    return !!world?.roofLayer?.[Math.round(y)]?.[Math.round(x)];
  }

  function isMountainBlocked(x, y) {
    const rock = getRockAt(x, y);
    return !!rock?.solid;
  }

  function recalculateRoofLayer(world = state?.world, center = null, radius = 7) {
    if (!world) return null;
    ensureGeologyState(world);
    const rows = world.rows;
    const cols = world.cols;
    const startX = center ? Math.max(0, Math.floor(center.x - radius)) : 0;
    const endX = center ? Math.min(cols - 1, Math.ceil(center.x + radius)) : cols - 1;
    const startY = center ? Math.max(0, Math.floor(center.y - radius)) : 0;
    const endY = center ? Math.min(rows - 1, Math.ceil(center.y + radius)) : rows - 1;

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const rock = world.geologyLayer[y]?.[x];
        if (rock?.solid) {
          world.roofLayer[y][x] = true;
          rock.isRoof = true;
          rock.collapseRisk = 0;
          continue;
        }
        const supported = countNearbySolidRock(world, x, y, 2) >= 2;
        const deep = countNearbySolidRock(world, x, y, 4) >= 7;
        world.roofLayer[y][x] = !!(supported && deep);
      }
    }
    return world.roofLayer;
  }

  function countNearbySolidRock(world, x, y, radius) {
    let count = 0;
    for (let yy = y - radius; yy <= y + radius; yy++) {
      for (let xx = x - radius; xx <= x + radius; xx++) {
        if (xx === x && yy === y) continue;
        if (world.geologyLayer?.[yy]?.[xx]?.solid) count++;
      }
    }
    return count;
  }

  function mineRockAt(x, y, power = 1, world = state?.world) {
    const rock = getRockAt(x, y, world);
    if (!rock?.mineable || !rock.solid) return { done: false, removed: false, reason: 'not-mineable' };
    const def = ROCK_DEFS[rock.type] || ROCK_DEFS.granite;
    rock.hp = Math.max(0, Number(rock.hp || 0) - Math.max(1, Number(power || 1)) * def.mineSpeed);
    if (rock.hp > 0) return { done: true, removed: false, hp: rock.hp, maxHp: rock.maxHp };

    const gain = { [rock.resource || 'stone']: rock.yield || 1 };
    if (typeof addResources === 'function') addResources(gain);
    world.geologyLayer[y][x] = null;
    if (world.terrain?.[y]?.[x] === 'stone') world.terrain[y][x] = rock.biomeId === 'desert' ? 'sand' : 'dirt';
    recalculateRoofLayer(world, { x, y }, 8);
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    return { done: true, removed: true, gain, roof: !!world.roofLayer?.[y]?.[x] };
  }

  function geologyLabelAt(x, y) {
    const rock = getRockAt(x, y);
    if (!rock) return hasNaturalRoofAt(x, y) ? 'Teto natural' : 'Sem rocha';
    const def = ROCK_DEFS[rock.type] || ROCK_DEFS.granite;
    return `${def.label} ${Math.ceil(rock.hp)}/${rock.maxHp}`;
  }

  function updateGeologyTick() {
    ensureGeologyState();
  }

  window.GeologySystem = {
    ROCK_DEFS,
    ensureGeologyState,
    getRockAt,
    hasNaturalRoofAt,
    isMountainBlocked,
    mineRockAt,
    recalculateRoofLayer,
    geologyLabelAt,
    createGeologyLayer,
    createRoofLayer
  };

  window.ensureGeologyState = ensureGeologyState;
  window.getRockAt = getRockAt;
  window.hasNaturalRoofAt = hasNaturalRoofAt;
  window.isMountainBlocked = isMountainBlocked;
  window.mineRockAt = mineRockAt;
  window.updateGeologyTick = updateGeologyTick;
})();
