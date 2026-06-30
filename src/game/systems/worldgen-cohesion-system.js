'use strict';

(() => {
  if (window.HavenfallContext?.worldgenCohesionInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.worldgenCohesionInstalled = true;

  const VERSION = 'worldgen-cohesion-v1';
  const CAMP_TYPES = new Set(['campfire', 'crate', 'logs', 'stockpile']);
  const RESOURCE_TYPES = new Set(['tree', 'oak_tree', 'birch_tree', 'pine_tree', 'palm_tree', 'willow_tree', 'bush', 'berry', 'herbs', 'mushrooms', 'dry_twigs', 'logs', 'rock', 'ore']);
  const VEGETATION_TYPES = new Set(['tree', 'oak_tree', 'birch_tree', 'pine_tree', 'palm_tree', 'willow_tree', 'bush', 'berry', 'herbs', 'mushrooms', 'dry_twigs']);
  const POI_TYPES = new Set(['ruin', 'cache', 'supply_crate']);
  const NATURAL_GROUND = ['grass', 'dirt', 'sand'];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function hash(text) {
    if (typeof hashSeed === 'function') return hashSeed(String(text));
    let h = 2166136261;
    const str = String(text || 'worldgen');
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function noise(seed, x, y, salt = 'n') {
    return (hash(`${seed}|${salt}|${x}|${y}`) % 100000) / 100000;
  }

  function key(x, y) {
    return `${x},${y}`;
  }

  function inside(world, x, y, margin = 1) {
    return !!world && x >= margin && y >= margin && x < world.cols - margin && y < world.rows - margin;
  }

  function terrain(world, x, y) {
    return world?.terrain?.[y]?.[x] || 'grass';
  }

  function setTerrain(world, x, y, type) {
    if (inside(world, x, y, 1) && world.terrain?.[y]) world.terrain[y][x] = type;
  }

  function distanceToSpawn(world, x, y) {
    return Math.hypot(x - world.spawn.x, y - world.spawn.y);
  }

  function neighborCount(world, x, y, type, radius = 1) {
    let count = 0;
    for (let yy = y - radius; yy <= y + radius; yy++) {
      for (let xx = x - radius; xx <= x + radius; xx++) {
        if (xx === x && yy === y) continue;
        if (terrain(world, xx, yy) === type) count++;
      }
    }
    return count;
  }

  function dominantNeighborGround(world, x, y, fallback = 'dirt') {
    const counts = { grass: 0, dirt: 0, sand: 0, stone: 0 };
    for (let yy = y - 1; yy <= y + 1; yy++) {
      for (let xx = x - 1; xx <= x + 1; xx++) {
        if (xx === x && yy === y) continue;
        const t = terrain(world, xx, yy);
        if (counts[t] !== undefined) counts[t]++;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || fallback;
  }

  function occupiedSet(world) {
    return new Set((world.objects || []).map(obj => key(obj.x, obj.y)));
  }

  function addObject(world, type, x, y, extra = {}, occupied = occupiedSet(world)) {
    if (!inside(world, x, y, 1)) return null;
    const k = key(x, y);
    if (occupied.has(k)) return null;
    if (terrain(world, x, y) === 'water') setTerrain(world, x, y, 'dirt');
    const obj = {
      id: `${type}_${hash(`${world.seed}|cohesion|${type}|${x}|${y}|${world.objects?.length || 0}`).toString(36)}`,
      type,
      x,
      y,
      ...extra
    };
    world.objects = Array.isArray(world.objects) ? world.objects : [];
    world.objects.push(obj);
    occupied.add(k);
    return obj;
  }

  function removeObjectsNear(world, cx, cy, radius, keep = () => false) {
    world.objects = (world.objects || []).filter(obj => keep(obj) || Math.hypot(obj.x - cx, obj.y - cy) > radius);
  }

  function clearBlockingResourcesAroundSpawn(world) {
    const spawn = world.spawn;
    if (!spawn) return;
    world.objects = (world.objects || []).filter(obj => {
      const d = Math.hypot(obj.x - spawn.x, obj.y - spawn.y);
      if (d > 7.5) return true;
      if (CAMP_TYPES.has(obj.type)) return true;
      return !RESOURCE_TYPES.has(obj.type);
    });
  }

  function carveOrganicSpawn(world) {
    const spawn = world.spawn;
    if (!spawn) return;
    const seed = `${world.seed}|spawn-cohesion`;
    const core = 5.4;
    const ring = 8.4;
    const outer = 12.2;

    for (let y = spawn.y - Math.ceil(outer); y <= spawn.y + Math.ceil(outer); y++) {
      for (let x = spawn.x - Math.ceil(outer); x <= spawn.x + Math.ceil(outer); x++) {
        if (!inside(world, x, y, 2)) continue;
        const d = Math.hypot(x - spawn.x, y - spawn.y);
        const wobble = (noise(seed, x, y, 'spawn-edge') - 0.5) * 1.7;
        if (d <= core + wobble) setTerrain(world, x, y, 'grass');
        else if (d <= ring + wobble) setTerrain(world, x, y, noise(seed, x, y, 'spawn-ring') > 0.58 ? 'grass' : 'dirt');
        else if (d <= outer && ['water', 'stone'].includes(terrain(world, x, y))) setTerrain(world, x, y, 'dirt');
      }
    }

    clearBlockingResourcesAroundSpawn(world);
    const keepFarOrNonCamp = obj => !(CAMP_TYPES.has(obj.type) && Math.hypot(obj.x - spawn.x, obj.y - spawn.y) <= 6.2);
    world.objects = (world.objects || []).filter(keepFarOrNonCamp);

    const occ = occupiedSet(world);
    addObject(world, 'campfire', spawn.x, spawn.y, { starterCamp: true }, occ);
    addObject(world, 'crate', spawn.x + 2, spawn.y, { starterCamp: true }, occ);
    addObject(world, 'logs', spawn.x - 2, spawn.y + 1, { starterCamp: true }, occ);
    addObject(world, 'logs', spawn.x - 1, spawn.y + 3, { starterCamp: true }, occ);
  }

  function collectWaterCluster(world, sx, sy, seen) {
    const queue = [{ x: sx, y: sy }];
    const cluster = [];
    seen.add(key(sx, sy));
    let head = 0;
    while (head < queue.length) {
      const current = queue[head++];
      cluster.push(current);
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of dirs) {
        const x = current.x + dx;
        const y = current.y + dy;
        const k = key(x, y);
        if (seen.has(k) || terrain(world, x, y) !== 'water') continue;
        seen.add(k);
        queue.push({ x, y });
      }
    }
    return cluster;
  }

  function cleanWaterTopology(world) {
    const seen = new Set();
    const minCluster = Math.max(10, Math.floor(world.cols * world.rows * 0.00055));
    const replacements = [];

    for (let y = 1; y < world.rows - 1; y++) {
      for (let x = 1; x < world.cols - 1; x++) {
        if (terrain(world, x, y) !== 'water' || seen.has(key(x, y))) continue;
        const cluster = collectWaterCluster(world, x, y, seen);
        const touchesEdge = cluster.some(p => p.x <= 2 || p.y <= 2 || p.x >= world.cols - 3 || p.y >= world.rows - 3);
        const nearSpawn = cluster.some(p => distanceToSpawn(world, p.x, p.y) < 11);
        if (cluster.length < minCluster || nearSpawn) {
          for (const p of cluster) replacements.push({ x: p.x, y: p.y, type: dominantNeighborGround(world, p.x, p.y, touchesEdge ? 'sand' : 'dirt') });
        }
      }
    }

    for (const rep of replacements) setTerrain(world, rep.x, rep.y, rep.type === 'stone' ? 'dirt' : rep.type);

    const copy = world.terrain.map(row => row.slice());
    const occupied = occupiedSet(world);
    for (let y = 1; y < world.rows - 1; y++) {
      for (let x = 1; x < world.cols - 1; x++) {
        if (occupied.has(key(x, y))) continue;
        const t = terrain(world, x, y);
        const waterN = neighborCount(world, x, y, 'water', 1);
        if (t === 'water' && waterN <= 1) copy[y][x] = dominantNeighborGround(world, x, y, 'dirt') === 'stone' ? 'dirt' : dominantNeighborGround(world, x, y, 'dirt');
        if (t !== 'water' && waterN >= 6 && distanceToSpawn(world, x, y) > 12) copy[y][x] = 'water';
      }
    }
    world.terrain = copy;

    addWaterBanks(world);
  }

  function addWaterBanks(world) {
    const copy = world.terrain.map(row => row.slice());
    const occupied = occupiedSet(world);
    for (let y = 1; y < world.rows - 1; y++) {
      for (let x = 1; x < world.cols - 1; x++) {
        if (occupied.has(key(x, y))) continue;
        if (terrain(world, x, y) === 'water') continue;
        const waterN = neighborCount(world, x, y, 'water', 1);
        if (!waterN) continue;
        if (distanceToSpawn(world, x, y) < 8) continue;
        if (terrain(world, x, y) === 'stone' && waterN < 4) continue;
        copy[y][x] = waterN >= 3 ? 'dirt' : (noise(world.seed, x, y, 'bank') > 0.72 ? 'sand' : 'dirt');
      }
    }
    world.terrain = copy;
  }

  function waterCoverage(world) {
    let water = 0;
    for (let y = 0; y < world.rows; y++) for (let x = 0; x < world.cols; x++) if (world.terrain[y][x] === 'water') water++;
    return water / Math.max(1, world.cols * world.rows);
  }

  function activeWaterScore(config, world) {
    const siteWater = Number(config?.selectedLandingSite?.resources?.water || world?.landingSite?.resources?.water || 0);
    const profileWater = Number(config?.planetScan?.biomeStats?.water || world?.planetScan?.biomeStats?.water || 0);
    return Math.max(siteWater, profileWater * 1.25);
  }

  function carveNaturalRiverIfNeeded(world, config = {}) {
    if (waterCoverage(world) > 0.012 || activeWaterScore(config, world) < 58) return;
    const seed = `${world.seed}|cohesion-river`;
    const vertical = noise(seed, 0, 0, 'axis') > 0.45;
    let base = vertical
      ? clamp(world.spawn.x + Math.round((noise(seed, 1, 0, 'offset') - 0.5) * 34), 8, world.cols - 9)
      : clamp(world.spawn.y + Math.round((noise(seed, 0, 1, 'offset') - 0.5) * 26), 8, world.rows - 9);
    const length = vertical ? world.rows : world.cols;
    const width = 1 + Math.round(noise(seed, 2, 2, 'width') * 1.6);

    for (let i = 2; i < length - 2; i++) {
      const curve = Math.sin(i * 0.075 + noise(seed, i, 3, 'phase') * 2.6) * 4.2 + Math.sin(i * 0.021) * 5.5;
      const center = Math.round(base + curve);
      for (let w = -width - 1; w <= width + 1; w++) {
        const x = vertical ? center + w : i;
        const y = vertical ? i : center + w;
        if (!inside(world, x, y, 2)) continue;
        if (distanceToSpawn(world, x, y) < 10) continue;
        if (Math.abs(w) <= width) setTerrain(world, x, y, 'water');
        else if (terrain(world, x, y) !== 'stone') setTerrain(world, x, y, 'dirt');
      }
    }
  }

  function smoothTerrainMasses(world) {
    for (let pass = 0; pass < 2; pass++) {
      const copy = world.terrain.map(row => row.slice());
      const occupied = occupiedSet(world);
      for (let y = 1; y < world.rows - 1; y++) {
        for (let x = 1; x < world.cols - 1; x++) {
          if (distanceToSpawn(world, x, y) < 9) continue;
          if (occupied.has(key(x, y))) continue;
          const t = terrain(world, x, y);
          const stoneN = neighborCount(world, x, y, 'stone', 1);
          const sandN = neighborCount(world, x, y, 'sand', 1);
          const grassN = neighborCount(world, x, y, 'grass', 1);
          const dirtN = neighborCount(world, x, y, 'dirt', 1);

          if (t === 'stone' && stoneN <= 1) copy[y][x] = dirtN >= grassN ? 'dirt' : 'grass';
          else if (t === 'sand' && sandN <= 1 && x > 3 && y > 3 && x < world.cols - 4 && y < world.rows - 4) copy[y][x] = dirtN >= grassN ? 'dirt' : 'grass';
          else if (t !== 'stone' && stoneN >= 6 && noise(world.seed, x, y, `stone-fill-${pass}`) > 0.18) copy[y][x] = 'stone';
          else if (t === 'dirt' && grassN >= 6 && noise(world.seed, x, y, `grass-fill-${pass}`) > 0.20) copy[y][x] = 'grass';
        }
      }
      world.terrain = copy;
    }
  }

  function sanitizeObjects(world) {
    const occupied = new Set();
    const spawn = world.spawn || { x: 0, y: 0 };
    world.objects = (world.objects || []).filter(obj => {
      if (!obj || !inside(world, obj.x, obj.y, 1)) return false;
      const k = key(obj.x, obj.y);
      if (occupied.has(k)) return false;
      const tile = terrain(world, obj.x, obj.y);
      if (VEGETATION_TYPES.has(obj.type) && !NATURAL_GROUND.includes(tile)) return false;
      if (tile === 'water' && !POI_TYPES.has(obj.type)) return false;
      if (RESOURCE_TYPES.has(obj.type) && Math.hypot(obj.x - spawn.x, obj.y - spawn.y) < 7.5 && !CAMP_TYPES.has(obj.type)) return false;
      occupied.add(k);
      return true;
    });
  }

  function poiCenters(world) {
    const centers = [];
    const used = new Set();
    for (const poi of world.pointsOfInterest || []) {
      if (!poi || !Number.isFinite(Number(poi.x)) || !Number.isFinite(Number(poi.y))) continue;
      if (distanceToSpawn(world, poi.x, poi.y) < 18) continue;
      centers.push({ id: poi.id || `poi_${centers.length}`, name: poi.name || 'Ponto de interesse', x: Math.round(poi.x), y: Math.round(poi.y), type: poi.type || 'ruin' });
      used.add(String(poi.id || ''));
    }

    for (const obj of world.objects || []) {
      if (!POI_TYPES.has(obj.type) || distanceToSpawn(world, obj.x, obj.y) < 18) continue;
      const id = String(obj.poiId || obj.id || '');
      if (used.has(id)) continue;
      centers.push({ id: id || `obj_poi_${centers.length}`, name: 'Estrutura detectada', x: Math.round(obj.x), y: Math.round(obj.y), type: obj.type });
      used.add(id);
    }

    return centers.slice(0, 14);
  }

  function buildRuinFloor(world, cx, cy, seed) {
    for (let y = cy - 5; y <= cy + 5; y++) {
      for (let x = cx - 5; x <= cx + 5; x++) {
        if (!inside(world, x, y, 2)) continue;
        const d = Math.hypot(x - cx, y - cy);
        if (d > 5.2) continue;
        if (d <= 3.3) setTerrain(world, x, y, noise(seed, x, y, 'floor') > 0.62 ? 'dirt' : 'stone');
        else if (terrain(world, x, y) === 'water') setTerrain(world, x, y, 'dirt');
        else if (noise(seed, x, y, 'edge') > 0.58) setTerrain(world, x, y, 'dirt');
      }
    }
  }

  function rebuildRuinCluster(world, center, index) {
    if (!inside(world, center.x, center.y, 6)) return;
    const seed = `${world.seed}|ruin-cohesion|${center.id}|${index}`;
    const cx = center.x;
    const cy = center.y;
    removeObjectsNear(world, cx, cy, 4.8, obj => CAMP_TYPES.has(obj.type) || distanceToSpawn(world, obj.x, obj.y) < 10);
    buildRuinFloor(world, cx, cy, seed);

    const occ = occupiedSet(world);
    const pattern = [
      [-2, -2, 'ruin'], [-1, -2, 'ruin'], [1, -2, 'ruin'], [2, -2, 'ruin'],
      [-2, -1, 'ruin'], [2, -1, 'ruin'],
      [-2, 1, 'ruin'], [2, 1, 'ruin'],
      [-2, 2, 'ruin'], [0, 2, 'ruin'], [2, 2, 'ruin'],
      [0, 0, center.type === 'cache' ? 'cache' : 'supply_crate'],
      [1, 0, 'rubble'], [-1, 1, 'rubble']
    ];

    for (const [dx, dy, type] of pattern) {
      if (noise(seed, dx + 8, dy + 8, 'broken-wall') < 0.18 && type === 'ruin') continue;
      addObject(world, type, cx + dx, cy + dy, { poiId: center.id, cohesiveRuin: true }, occ);
    }

    const poi = (world.pointsOfInterest || []).find(p => String(p.id) === String(center.id));
    if (poi) {
      poi.x = cx;
      poi.y = cy;
      poi.type = poi.type || 'ruin';
      poi.cohesionVersion = VERSION;
    }
  }

  function rebuildPointsOfInterest(world) {
    const centers = poiCenters(world);
    for (let i = 0; i < centers.length; i++) rebuildRuinCluster(world, centers[i], i);
  }

  function refreshWorldReferences(world) {
    if (!world) return;
    world.objects = Array.isArray(world.objects) ? world.objects : [];
    world.terrain = Array.isArray(world.terrain) ? world.terrain : [];
    world.width = world.cols * (world.tileSize || TILE || 48);
    world.height = world.rows * (world.tileSize || TILE || 48);
    if (typeof makeExplorationMatrix === 'function' && (!Array.isArray(world.exploration) || world.exploration.length !== world.rows || world.exploration[0]?.length !== world.cols)) {
      world.exploration = makeExplorationMatrix(world.cols, world.rows);
    }
    if (typeof makeSpawnPoints === 'function' && world.spawn) world.spawnPoints = makeSpawnPoints(world.spawn, world.cols, world.rows);
  }

  function applyToWorld(world, config = {}) {
    if (!world || !Array.isArray(world.terrain) || world.worldgenCohesionVersion === VERSION) return world;
    refreshWorldReferences(world);
    carveOrganicSpawn(world);
    cleanWaterTopology(world);
    carveNaturalRiverIfNeeded(world, config);
    cleanWaterTopology(world);
    smoothTerrainMasses(world);
    rebuildPointsOfInterest(world);
    sanitizeObjects(world);
    refreshWorldReferences(world);
    world.worldgenCohesionVersion = VERSION;
    world.generationVersion = `${world.generationVersion || 'world'}+cohesion`;
    return world;
  }

  function installWorldgenPatch() {
    const original = window.generateWorldFromSeed;
    if (typeof original !== 'function' || original.__havenfallCohesionPatched) return;
    function generateWorldFromSeedWithCohesion(config) {
      return applyToWorld(original(config), config || {});
    }
    generateWorldFromSeedWithCohesion.__havenfallCohesionPatched = true;
    window.generateWorldFromSeed = generateWorldFromSeedWithCohesion;
    try { generateWorldFromSeed = generateWorldFromSeedWithCohesion; } catch (_) {}
  }

  window.HavenfallWorldgenCohesion = Object.freeze({
    applyToWorld,
    cleanWaterTopology,
    carveOrganicSpawn,
    rebuildPointsOfInterest,
    version: VERSION
  });

  installWorldgenPatch();
})();
