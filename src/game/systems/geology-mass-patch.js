'use strict';

(() => {
  if (window.HavenfallContext?.geologyMassPatchInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.geologyMassPatchInstalled = true;

  const VERSION = 'dense-mountains-v2';
  const ROCK_TYPES = Object.freeze({
    granite: { hp: 190, resource: 'stone', yield: 9, mineSpeed: 0.82, insulation: 0.72 },
    slate: { hp: 150, resource: 'stone', yield: 7, mineSpeed: 1.0, insulation: 0.55 },
    sandstone: { hp: 112, resource: 'stone', yield: 5, mineSpeed: 1.2, insulation: 0.38 },
    iron: { hp: 170, resource: 'metal', yield: 5, mineSpeed: 0.9, insulation: 0.48 }
  });
  const PLANT_TYPES = new Set(['tree', 'bush', 'berry', 'sapling', 'invasive_weed']);
  const LOOSE_RESOURCE_TYPES = new Set(['tree', 'bush', 'berry', 'sapling', 'invasive_weed', 'logs', 'rock', 'ore']);
  const TALL_RESOURCE_TYPES = new Set(['tree', 'bush', 'berry', 'sapling', 'invasive_weed', 'logs']);

  function noise(seed, x, y, salt) {
    if (typeof worldNoise === 'function') return worldNoise(seed, x, y, salt);
    if (typeof hashSeed === 'function') return hashSeed(`${seed}|${salt}|${x}|${y}`) / 4294967295;
    return Math.random();
  }

  function biomeId(world, x, y) {
    return world?.biomes?.[y]?.[x] || window.BiomeEngine?.getBiomeIdAt?.(world, x, y) || 'forest';
  }

  function rockType(world, x, y, seed) {
    const biome = biomeId(world, x, y);
    const n = noise(seed, x, y, 'dense-rock-type');
    if (biome === 'desert') return n > 0.78 ? 'slate' : 'sandstone';
    if (biome === 'snow') return n > 0.70 ? 'iron' : 'granite';
    if (n > 0.86) return 'iron';
    if (n > 0.58) return 'slate';
    return 'granite';
  }

  function rockTile(world, x, y, seed) {
    const type = rockType(world, x, y, seed);
    const def = ROCK_TYPES[type] || ROCK_TYPES.granite;
    const biome = biomeId(world, x, y);
    const hpMult = biome === 'desert' ? 0.78 : biome === 'snow' ? 1.18 : 1;
    const maxHp = Math.max(55, Math.round(def.hp * hpMult));
    return { type, hp: maxHp, maxHp, isRoof: true, mineable: true, solid: true, markedForMining: false, resource: def.resource, yield: def.yield, biomeId: biome, insulation: def.insulation, collapseRisk: 0 };
  }

  function centerCount(world) {
    const area = Math.max(1, Number(world.cols || 0) * Number(world.rows || 0));
    return Math.max(3, Math.min(13, Math.floor(area / 2300)));
  }

  function mountainCenters(world, seed) {
    const cols = Number(world.cols || world.terrain?.[0]?.length || 0);
    const rows = Number(world.rows || world.terrain?.length || 0);
    const count = centerCount(world);
    const centers = [];
    for (let i = 0; i < count; i++) {
      const cx = 5 + Math.floor(noise(seed, i, 11, 'mountain-center-x') * Math.max(1, cols - 10));
      const cy = 5 + Math.floor(noise(seed, i, 23, 'mountain-center-y') * Math.max(1, rows - 10));
      if (world.spawn && Math.hypot(cx - world.spawn.x, cy - world.spawn.y) < 15) continue;
      centers.push({
        x: cx,
        y: cy,
        rx: 7 + Math.floor(noise(seed, i, 31, 'mountain-radius-x') * 13),
        ry: 6 + Math.floor(noise(seed, i, 43, 'mountain-radius-y') * 12),
        power: 0.72 + noise(seed, i, 57, 'mountain-power') * 0.38
      });
    }
    return centers;
  }

  function mountainScore(world, x, y, centers) {
    let best = 0;
    for (const c of centers) {
      const dx = (x - c.x) / Math.max(1, c.rx);
      const dy = (y - c.y) / Math.max(1, c.ry);
      const score = Math.max(0, 1 - dx * dx - dy * dy) * c.power;
      if (score > best) best = score;
    }
    return best;
  }

  function nearSpawn(world, x, y, radius = 12) {
    return !!world.spawn && Math.hypot(x - world.spawn.x, y - world.spawn.y) < radius;
  }

  function makeDenseLayer(world) {
    const rows = Number(world.rows || world.terrain?.length || 0);
    const cols = Number(world.cols || world.terrain?.[0]?.length || 0);
    const seed = world.seed || state?.config?.seed || 'dense-geology';
    const centers = mountainCenters(world, seed);
    const layer = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (x < 2 || y < 2 || x >= cols - 2 || y >= rows - 2) continue;
        if (nearSpawn(world, x, y)) continue;
        const terrain = world.terrain?.[y]?.[x] || 'grass';
        if (terrain === 'water' || terrain === 'sand') continue;
        const score = mountainScore(world, x, y, centers);
        const oldStoneBias = terrain === 'stone' ? 0.18 : 0;
        const local = noise(seed, x, y, 'mountain-local-fill');
        const threshold = 0.20 - score * 0.26 - oldStoneBias;
        if (score > 0.09 && local > threshold) layer[y][x] = rockTile(world, x, y, seed);
        else if (terrain === 'stone' && score > 0.03 && local > 0.22) layer[y][x] = rockTile(world, x, y, seed);
      }
    }

    fillSmallGaps(layer, world, seed);
    pruneWeakEdges(layer);
    pruneSmallClusters(layer, 18);
    carveSpawn(layer, world);
    return layer;
  }

  function countSolid(layer, x, y, radius = 1) {
    let count = 0;
    for (let yy = y - radius; yy <= y + radius; yy++) {
      for (let xx = x - radius; xx <= x + radius; xx++) {
        if (xx === x && yy === y) continue;
        if (layer[yy]?.[xx]?.solid) count++;
      }
    }
    return count;
  }

  function fillSmallGaps(layer, world, seed) {
    const rows = layer.length;
    const cols = layer[0]?.length || 0;
    for (let pass = 0; pass < 2; pass++) {
      const fill = [];
      for (let y = 2; y < rows - 2; y++) {
        for (let x = 2; x < cols - 2; x++) {
          if (layer[y][x] || nearSpawn(world, x, y) || world.terrain?.[y]?.[x] === 'water') continue;
          if (countSolid(layer, x, y, 1) >= 5) fill.push([x, y]);
        }
      }
      for (const [x, y] of fill) layer[y][x] = rockTile(world, x, y, seed);
    }
  }

  function pruneWeakEdges(layer) {
    const rows = layer.length;
    const cols = layer[0]?.length || 0;
    const remove = [];
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        if (!layer[y][x]?.solid) continue;
        if (countSolid(layer, x, y, 1) <= 1) remove.push([x, y]);
      }
    }
    for (const [x, y] of remove) layer[y][x] = null;
  }

  function pruneSmallClusters(layer, minSize) {
    const rows = layer.length;
    const cols = layer[0]?.length || 0;
    const seen = new Set();
    const key = (x, y) => `${x},${y}`;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!layer[y]?.[x]?.solid || seen.has(key(x, y))) continue;
        const stack = [[x, y]];
        const cells = [];
        seen.add(key(x, y));
        while (stack.length) {
          const [cx, cy] = stack.pop();
          cells.push([cx, cy]);
          for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = cx + dx;
            const ny = cy + dy;
            const k = key(nx, ny);
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || seen.has(k) || !layer[ny]?.[nx]?.solid) continue;
            seen.add(k);
            stack.push([nx, ny]);
          }
        }
        if (cells.length < minSize) for (const [cx, cy] of cells) layer[cy][cx] = null;
      }
    }
  }

  function carveSpawn(layer, world) {
    if (!world.spawn) return;
    for (let y = world.spawn.y - 8; y <= world.spawn.y + 8; y++) {
      for (let x = world.spawn.x - 8; x <= world.spawn.x + 8; x++) {
        if (Math.hypot(x - world.spawn.x, y - world.spawn.y) <= 8) {
          if (layer[y]?.[x]) layer[y][x] = null;
        }
      }
    }
  }

  function hasSolidRock(layer, x, y) {
    return !!layer?.[Math.round(y)]?.[Math.round(x)]?.solid;
  }

  function hasSolidNear(layer, x, y, radius = 1) {
    for (let yy = y - radius; yy <= y + radius; yy++) {
      for (let xx = x - radius; xx <= x + radius; xx++) {
        if (hasSolidRock(layer, xx, yy)) return true;
      }
    }
    return false;
  }

  function objectInvalidForLayer(obj, layer, roofLayer = null) {
    if (!obj || !LOOSE_RESOURCE_TYPES.has(obj.type)) return false;
    const x = Math.round(obj.x);
    const y = Math.round(obj.y);
    if (hasSolidRock(layer, x, y)) return true;
    if (roofLayer?.[y]?.[x]) return true;
    if (TALL_RESOURCE_TYPES.has(obj.type) && (hasSolidNear(layer, x, y - 1, 1) || hasSolidNear(layer, x, y, 1))) return true;
    return false;
  }

  function syncObjectArrays(filtered) {
    if (!state?.world) return;
    state.world.objects = filtered;
    state.objects = filtered;
  }

  function purgeLooseResourcesOnGeology(layer = state?.world?.geologyLayer, roofLayer = state?.world?.naturalRoofLayer) {
    if (!state?.world) return 0;
    const source = Array.isArray(state.objects) ? state.objects : state.world.objects || [];
    const filtered = source.filter(obj => !objectInvalidForLayer(obj, layer, roofLayer));
    const removed = source.length - filtered.length;
    if (removed > 0 || state.world.objects !== filtered || state.objects !== filtered) syncObjectArrays(filtered);
    if (removed > 0 && typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    return removed;
  }

  function applyDenseGeology(world = state?.world) {
    if (!world?.terrain) return false;
    const firstApply = world.geologyMassVersion !== VERSION;
    if (!firstApply) {
      purgeLooseResourcesOnGeology(world.geologyLayer, world.naturalRoofLayer);
      return false;
    }
    const layer = makeDenseLayer(world);
    world.geologyLayer = layer;
    world.naturalRoofLayer = layer.map(row => row.map(rock => !!rock?.solid));
    for (let y = 0; y < layer.length; y++) {
      for (let x = 0; x < (layer[y]?.length || 0); x++) {
        if (layer[y][x]?.solid && world.terrain[y]?.[x] !== 'water') world.terrain[y][x] = 'stone';
      }
    }
    world.geologyMassVersion = VERSION;
    purgeLooseResourcesOnGeology(layer, world.naturalRoofLayer);
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    return true;
  }

  function cleanupVegetationOnGeology() {
    purgeLooseResourcesOnGeology(state?.world?.geologyLayer, state?.world?.naturalRoofLayer);
  }

  function updateGeologyMassPatch() {
    if (!state?.world || appScreen !== SCREEN.PLAYING) return;
    applyDenseGeology(state.world);
    cleanupVegetationOnGeology();
  }

  window.HavenfallGeologyMassPatch = { applyDenseGeology, cleanupVegetationOnGeology, purgeLooseResourcesOnGeology, objectInvalidForLayer };
  window.GameSystems?.registerTick?.('geology.mass-patch', updateGeologyMassPatch, { order: 11 });
})();
