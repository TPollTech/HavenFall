'use strict';

(() => {
  if (window.HavenfallContext?.worldgenCohesionInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.worldgenCohesionInstalled = true;

  const VERSION = 'worldgen-cohesion-v2-ecosystem';
  const CAMP_TYPES = new Set(['campfire', 'crate', 'logs', 'stockpile']);
  const TREE_TYPES = new Set(['tree', 'oak_tree', 'birch_tree', 'pine_tree', 'palm_tree', 'willow_tree']);
  const SOFT_PLANT_TYPES = new Set(['bush', 'berry', 'herbs', 'mushrooms']);
  const VEGETATION_TYPES = new Set([...TREE_TYPES, ...SOFT_PLANT_TYPES, 'dry_twigs']);
  const GEOLOGY_TYPES = new Set(['rock', 'ore']);
  const RUIN_TYPES = new Set(['ruin', 'cache', 'supply_crate', 'rubble']);
  const RESOURCE_TYPES = new Set([...VEGETATION_TYPES, ...GEOLOGY_TYPES, 'logs']);
  const NATURAL_GROUND = new Set(['grass', 'dirt']);
  const DRY_GROUND = new Set(['grass', 'dirt', 'sand']);

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

  function key(x, y) { return `${x},${y}`; }
  function inside(world, x, y, margin = 1) { return !!world && x >= margin && y >= margin && x < world.cols - margin && y < world.rows - margin; }
  function terrain(world, x, y) { return world?.terrain?.[y]?.[x] || 'grass'; }
  function setTerrain(world, x, y, type) { if (inside(world, x, y, 1) && world.terrain?.[y]) world.terrain[y][x] = type; }
  function distanceToSpawn(world, x, y) { return world?.spawn ? Math.hypot(x - world.spawn.x, y - world.spawn.y) : Infinity; }

  function occupiedSet(world, ignore = null) {
    return new Set((world.objects || []).filter(obj => obj && obj !== ignore).map(obj => key(obj.x, obj.y)));
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

  function dominantGround(world, x, y, fallback = 'dirt') {
    const counts = { grass: 0, dirt: 0, sand: 0, stone: 0 };
    for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) {
      if (xx === x && yy === y) continue;
      const t = terrain(world, xx, yy);
      if (counts[t] !== undefined) counts[t]++;
    }
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || fallback;
    return best === 'stone' ? 'dirt' : best;
  }

  function terrainRatio(world, cx, cy, radius, type) {
    let total = 0;
    let count = 0;
    for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++) {
      if (!inside(world, x, y, 1)) continue;
      if (Math.hypot(x - cx, y - cy) > radius + 0.2) continue;
      total++;
      if (terrain(world, x, y) === type) count++;
    }
    return { count, total, ratio: total ? count / total : 0 };
  }

  function isMountainMass(world, x, y, radius = 4) {
    const stone = terrainRatio(world, x, y, radius, 'stone');
    return stone.ratio >= 0.32 || stone.count >= Math.max(8, Math.floor(stone.total * 0.28));
  }

  function objectAllowedOnTerrain(obj, tile) {
    if (!obj) return false;
    if (TREE_TYPES.has(obj.type)) return NATURAL_GROUND.has(tile);
    if (SOFT_PLANT_TYPES.has(obj.type)) return NATURAL_GROUND.has(tile);
    if (obj.type === 'dry_twigs' || obj.type === 'logs') return DRY_GROUND.has(tile);
    if (obj.type === 'rock') return tile === 'stone' || tile === 'dirt' || tile === 'grass';
    if (obj.type === 'ore') return tile === 'stone' || tile === 'dirt';
    if (RUIN_TYPES.has(obj.type)) return tile !== 'water' && !isMountainMass(currentWorld, obj.x, obj.y, 4);
    if (CAMP_TYPES.has(obj.type)) return DRY_GROUND.has(tile);
    return tile !== 'water';
  }

  let currentWorld = null;

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

    for (let y = spawn.y - Math.ceil(outer); y <= spawn.y + Math.ceil(outer); y++) for (let x = spawn.x - Math.ceil(outer); x <= spawn.x + Math.ceil(outer); x++) {
      if (!inside(world, x, y, 2)) continue;
      const d = Math.hypot(x - spawn.x, y - spawn.y);
      const wobble = (noise(seed, x, y, 'spawn-edge') - 0.5) * 1.7;
      if (d <= core + wobble) setTerrain(world, x, y, 'grass');
      else if (d <= ring + wobble) setTerrain(world, x, y, noise(seed, x, y, 'spawn-ring') > 0.58 ? 'grass' : 'dirt');
      else if (d <= outer && ['water', 'stone'].includes(terrain(world, x, y))) setTerrain(world, x, y, 'dirt');
    }

    clearBlockingResourcesAroundSpawn(world);
    world.objects = (world.objects || []).filter(obj => !(CAMP_TYPES.has(obj.type) && Math.hypot(obj.x - spawn.x, obj.y - spawn.y) <= 6.2));
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
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head];
      cluster.push(current);
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
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

    for (let y = 1; y < world.rows - 1; y++) for (let x = 1; x < world.cols - 1; x++) {
      if (terrain(world, x, y) !== 'water' || seen.has(key(x, y))) continue;
      const cluster = collectWaterCluster(world, x, y, seen);
      const touchesEdge = cluster.some(p => p.x <= 2 || p.y <= 2 || p.x >= world.cols - 3 || p.y >= world.rows - 3);
      const nearSpawn = cluster.some(p => distanceToSpawn(world, p.x, p.y) < 11);
      if (cluster.length < minCluster || nearSpawn) {
        for (const p of cluster) replacements.push({ x: p.x, y: p.y, type: dominantGround(world, p.x, p.y, touchesEdge ? 'sand' : 'dirt') });
      }
    }

    for (const rep of replacements) setTerrain(world, rep.x, rep.y, rep.type);
    const copy = world.terrain.map(row => row.slice());
    const occupied = occupiedSet(world);
    for (let y = 1; y < world.rows - 1; y++) for (let x = 1; x < world.cols - 1; x++) {
      if (occupied.has(key(x, y))) continue;
      const t = terrain(world, x, y);
      const waterN = neighborCount(world, x, y, 'water', 1);
      if (t === 'water' && waterN <= 1) copy[y][x] = dominantGround(world, x, y, 'dirt');
      if (t !== 'water' && waterN >= 6 && distanceToSpawn(world, x, y) > 12) copy[y][x] = 'water';
    }
    world.terrain = copy;
    addWaterBanks(world);
  }

  function addWaterBanks(world) {
    const copy = world.terrain.map(row => row.slice());
    const occupied = occupiedSet(world);
    for (let y = 1; y < world.rows - 1; y++) for (let x = 1; x < world.cols - 1; x++) {
      if (occupied.has(key(x, y))) continue;
      if (terrain(world, x, y) === 'water') continue;
      const waterN = neighborCount(world, x, y, 'water', 1);
      if (!waterN || distanceToSpawn(world, x, y) < 8) continue;
      if (terrain(world, x, y) === 'stone' && waterN < 4) continue;
      copy[y][x] = waterN >= 3 ? 'dirt' : (noise(world.seed, x, y, 'bank') > 0.72 ? 'sand' : 'dirt');
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
    const base = vertical
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
        if (!inside(world, x, y, 2) || distanceToSpawn(world, x, y) < 10) continue;
        if (Math.abs(w) <= width) setTerrain(world, x, y, 'water');
        else if (terrain(world, x, y) !== 'stone') setTerrain(world, x, y, 'dirt');
      }
    }
  }

  function smoothTerrainMasses(world) {
    for (let pass = 0; pass < 2; pass++) {
      const copy = world.terrain.map(row => row.slice());
      const occupied = occupiedSet(world);
      for (let y = 1; y < world.rows - 1; y++) for (let x = 1; x < world.cols - 1; x++) {
        if (distanceToSpawn(world, x, y) < 9 || occupied.has(key(x, y))) continue;
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
      world.terrain = copy;
    }
  }

  function findValidPoiTile(world, center, radius = 32) {
    const used = occupiedSet(world);
    const seed = `${world.seed}|poi-relocation|${center.id || center.name || ''}`;
    for (let r = 6; r <= radius; r++) for (let step = 0; step < 64; step++) {
      const a = noise(seed, r, step, 'angle') * Math.PI * 2;
      const d = r * (0.55 + noise(seed, step, r, 'dist') * 0.50);
      const x = Math.round(center.x + Math.cos(a) * d);
      const y = Math.round(center.y + Math.sin(a) * d);
      if (!inside(world, x, y, 6)) continue;
      if (used.has(key(x, y))) continue;
      if (distanceToSpawn(world, x, y) < 18) continue;
      if (terrain(world, x, y) === 'water') continue;
      if (isMountainMass(world, x, y, 5)) continue;
      if (!DRY_GROUND.has(terrain(world, x, y))) continue;
      return { x, y };
    }
    for (let tries = 0; tries < 1200; tries++) {
      const x = 6 + Math.floor(noise(seed, tries, 1, 'global-x') * Math.max(1, world.cols - 12));
      const y = 6 + Math.floor(noise(seed, 1, tries, 'global-y') * Math.max(1, world.rows - 12));
      if (used.has(key(x, y)) || distanceToSpawn(world, x, y) < 18 || terrain(world, x, y) === 'water' || isMountainMass(world, x, y, 5) || !DRY_GROUND.has(terrain(world, x, y))) continue;
      return { x, y };
    }
    return null;
  }

  function poiObjects(world, poiId) {
    return (world.objects || []).filter(obj => String(obj.poiId || '') === String(poiId));
  }

  function clearRuinFootprint(world, cx, cy, radius = 5) {
    for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++) {
      if (!inside(world, x, y, 2)) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d > radius + 0.15) continue;
      const t = terrain(world, x, y);
      if (d <= 3.2) {
        if (t === 'water' || t === 'stone') setTerrain(world, x, y, noise(world.seed, x, y, 'ruin-floor') > 0.76 ? 'stone' : 'dirt');
        else if (t === 'grass' && noise(world.seed, x, y, 'ruin-wear') > 0.54) setTerrain(world, x, y, 'dirt');
      } else if (t === 'water' || t === 'stone') {
        setTerrain(world, x, y, noise(world.seed, x, y, 'ruin-edge') > 0.74 ? 'grass' : 'dirt');
      }
    }
  }

  function normalizePoiLocations(world) {
    world.pointsOfInterest = Array.isArray(world.pointsOfInterest) ? world.pointsOfInterest : [];
    for (const poi of world.pointsOfInterest) {
      if (!poi || !Number.isFinite(Number(poi.x)) || !Number.isFinite(Number(poi.y))) continue;
      poi.x = Math.round(poi.x);
      poi.y = Math.round(poi.y);
      const invalid = distanceToSpawn(world, poi.x, poi.y) < 18 || terrain(world, poi.x, poi.y) === 'water' || isMountainMass(world, poi.x, poi.y, 5);
      if (invalid) {
        const next = findValidPoiTile(world, poi, 36);
        if (next) {
          const dx = next.x - poi.x;
          const dy = next.y - poi.y;
          for (const obj of poiObjects(world, poi.id)) {
            obj.x += dx;
            obj.y += dy;
          }
          poi.x = next.x;
          poi.y = next.y;
        }
      }
      clearRuinFootprint(world, poi.x, poi.y, 5);
    }
  }

  function poiCenters(world) {
    const centers = [];
    const used = new Set();
    for (const poi of world.pointsOfInterest || []) {
      if (!poi || !Number.isFinite(Number(poi.x)) || !Number.isFinite(Number(poi.y))) continue;
      if (distanceToSpawn(world, poi.x, poi.y) < 18 || terrain(world, poi.x, poi.y) === 'water' || isMountainMass(world, poi.x, poi.y, 5)) continue;
      centers.push({ id: poi.id || `poi_${centers.length}`, name: poi.name || 'Ponto de interesse', x: Math.round(poi.x), y: Math.round(poi.y), type: poi.type || 'ruin' });
      used.add(String(poi.id || ''));
    }
    for (const obj of world.objects || []) {
      if (!RUIN_TYPES.has(obj.type) || distanceToSpawn(world, obj.x, obj.y) < 18 || isMountainMass(world, obj.x, obj.y, 5)) continue;
      const id = String(obj.poiId || obj.id || '');
      if (used.has(id)) continue;
      centers.push({ id: id || `obj_poi_${centers.length}`, name: 'Estrutura detectada', x: Math.round(obj.x), y: Math.round(obj.y), type: obj.type });
      used.add(id);
    }
    return centers.slice(0, 14);
  }

  function buildRuinFloor(world, cx, cy, seed) {
    clearRuinFootprint(world, cx, cy, 5);
    for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 3; x <= cx + 3; x++) {
      if (!inside(world, x, y, 2)) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d <= 2.8 && noise(seed, x, y, 'floor-extra') > 0.30) setTerrain(world, x, y, 'dirt');
    }
  }

  function removeObjectsNear(world, cx, cy, radius, keep = () => false) {
    world.objects = (world.objects || []).filter(obj => keep(obj) || Math.hypot(obj.x - cx, obj.y - cy) > radius);
  }

  function rebuildRuinCluster(world, center, index) {
    if (!inside(world, center.x, center.y, 6) || isMountainMass(world, center.x, center.y, 5)) return;
    const seed = `${world.seed}|ruin-cohesion|${center.id}|${index}`;
    const cx = center.x;
    const cy = center.y;
    removeObjectsNear(world, cx, cy, 4.8, obj => CAMP_TYPES.has(obj.type) || distanceToSpawn(world, obj.x, obj.y) < 10);
    buildRuinFloor(world, cx, cy, seed);
    const occ = occupiedSet(world);
    const pattern = [[-2,-2,'ruin'],[-1,-2,'ruin'],[1,-2,'ruin'],[2,-2,'ruin'],[-2,-1,'ruin'],[2,-1,'ruin'],[-2,1,'ruin'],[2,1,'ruin'],[-2,2,'ruin'],[0,2,'ruin'],[2,2,'ruin'],[0,0,center.type === 'cache' ? 'cache' : 'supply_crate'],[1,0,'rubble'],[-1,1,'rubble']];
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
    normalizePoiLocations(world);
    const centers = poiCenters(world);
    for (let i = 0; i < centers.length; i++) rebuildRuinCluster(world, centers[i], i);
  }

  function sanitizeObjects(world) {
    const occupied = new Set();
    const spawn = world.spawn || { x: 0, y: 0 };
    world.objects = (world.objects || []).filter(obj => {
      if (!obj || !inside(world, obj.x, obj.y, 1)) return false;
      const k = key(obj.x, obj.y);
      if (occupied.has(k)) return false;
      const tile = terrain(world, obj.x, obj.y);
      if (TREE_TYPES.has(obj.type) && !NATURAL_GROUND.has(tile)) return false;
      if (SOFT_PLANT_TYPES.has(obj.type) && !NATURAL_GROUND.has(tile)) return false;
      if (obj.type === 'dry_twigs' && !DRY_GROUND.has(tile)) return false;
      if (GEOLOGY_TYPES.has(obj.type) && tile === 'water') return false;
      if (RUIN_TYPES.has(obj.type) && (tile === 'water' || isMountainMass(world, obj.x, obj.y, 4))) return false;
      if (RESOURCE_TYPES.has(obj.type) && Math.hypot(obj.x - spawn.x, obj.y - spawn.y) < 7.5 && !CAMP_TYPES.has(obj.type)) return false;
      occupied.add(k);
      return true;
    });
  }

  function protectObjectTiles(world) {
    for (const obj of world.objects || []) {
      if (!obj || !inside(world, obj.x, obj.y, 1)) continue;
      const t = terrain(world, obj.x, obj.y);
      if ((TREE_TYPES.has(obj.type) || SOFT_PLANT_TYPES.has(obj.type)) && !NATURAL_GROUND.has(t)) setTerrain(world, obj.x, obj.y, 'grass');
      else if ((obj.type === 'logs' || obj.type === 'dry_twigs' || CAMP_TYPES.has(obj.type)) && !DRY_GROUND.has(t)) setTerrain(world, obj.x, obj.y, 'dirt');
      else if (GEOLOGY_TYPES.has(obj.type) && t === 'water') setTerrain(world, obj.x, obj.y, 'stone');
      else if (RUIN_TYPES.has(obj.type) && t === 'water') setTerrain(world, obj.x, obj.y, 'dirt');
    }
  }

  function refreshWorldReferences(world) {
    if (!world) return;
    world.objects = Array.isArray(world.objects) ? world.objects : [];
    world.terrain = Array.isArray(world.terrain) ? world.terrain : [];
    world.width = world.cols * (world.tileSize || TILE || 48);
    world.height = world.rows * (world.tileSize || TILE || 48);
    if (typeof makeExplorationMatrix === 'function' && (!Array.isArray(world.exploration) || world.exploration.length !== world.rows || world.exploration[0]?.length !== world.cols)) world.exploration = makeExplorationMatrix(world.cols, world.rows);
    if (typeof makeSpawnPoints === 'function' && world.spawn) world.spawnPoints = makeSpawnPoints(world.spawn, world.cols, world.rows);
  }

  function applyToWorld(world, config = {}) {
    if (!world || !Array.isArray(world.terrain) || world.worldgenCohesionVersion === VERSION) return world;
    currentWorld = world;
    refreshWorldReferences(world);
    carveOrganicSpawn(world);
    cleanWaterTopology(world);
    carveNaturalRiverIfNeeded(world, config);
    cleanWaterTopology(world);
    smoothTerrainMasses(world);
    rebuildPointsOfInterest(world);
    protectObjectTiles(world);
    sanitizeObjects(world);
    normalizePoiLocations(world);
    protectObjectTiles(world);
    sanitizeObjects(world);
    refreshWorldReferences(world);
    world.worldgenCohesionVersion = VERSION;
    world.generationVersion = `${world.generationVersion || 'world'}+cohesion+ecosystem`;
    currentWorld = null;
    return world;
  }

  function installWorldgenPatch() {
    const original = window.generateWorldFromSeed;
    if (typeof original !== 'function' || original.__havenfallCohesionPatched) return;
    function generateWorldFromSeedWithCohesion(config) {
      return applyToWorld(original(config), config || {});
    }
    generateWorldFromSeedWithCohesion.__havenfallCohionPatched = true;
    generateWorldFromSeedWithCohesion.__havenfallCohesionPatched = true;
    window.generateWorldFromSeed = generateWorldFromSeedWithCohesion;
    try { generateWorldFromSeed = generateWorldFromSeedWithCohesion; } catch (_) {}
  }

  window.HavenfallWorldgenCohesion = Object.freeze({
    applyToWorld,
    cleanWaterTopology,
    carveOrganicSpawn,
    rebuildPointsOfInterest,
    isMountainMass,
    version: VERSION
  });

  installWorldgenPatch();
})();
