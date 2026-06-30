'use strict';

(() => {
  if (window.HavenfallContext?.ecosystemRulesInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.ecosystemRulesInstalled = true;

  const VERSION = 'ecosystem-rules-v1';
  const NATURAL_SOIL = new Set(['grass', 'dirt']);
  const DRY_SOIL = new Set(['grass', 'dirt', 'sand']);
  const GEOLOGY_SOIL = new Set(['stone', 'dirt']);
  const CAMP_TYPES = new Set(['campfire', 'crate', 'logs', 'stockpile']);
  const VEGETATION_TYPES = new Set(['tree', 'oak_tree', 'birch_tree', 'pine_tree', 'palm_tree', 'willow_tree', 'bush', 'berry', 'herbs', 'mushrooms', 'dry_twigs']);
  const TREE_TYPES = new Set(['tree', 'oak_tree', 'birch_tree', 'pine_tree', 'palm_tree', 'willow_tree']);
  const GEOLOGY_TYPES = new Set(['rock', 'ore']);
  const RUIN_TYPES = new Set(['ruin', 'cache', 'supply_crate', 'rubble']);
  const RESOURCE_TYPES = new Set([...VEGETATION_TYPES, ...GEOLOGY_TYPES, 'logs']);

  function key(x, y) { return `${x},${y}`; }
  function inside(world, x, y, margin = 1) {
    return !!world && x >= margin && y >= margin && x < world.cols - margin && y < world.rows - margin;
  }
  function terrain(world, x, y) { return world?.terrain?.[y]?.[x] || 'grass'; }
  function setTerrain(world, x, y, type) { if (inside(world, x, y, 1) && world.terrain?.[y]) world.terrain[y][x] = type; }
  function distance(a, b, c, d) { return Math.hypot(a - c, b - d); }
  function distanceToSpawn(world, x, y) { return world?.spawn ? distance(x, y, world.spawn.x, world.spawn.y) : Infinity; }
  function isNaturalSoil(type) { return NATURAL_SOIL.has(type); }
  function isDrySoil(type) { return DRY_SOIL.has(type); }
  function isGeologySoil(type) { return GEOLOGY_SOIL.has(type); }
  function isMountainTile(type) { return type === 'stone'; }

  function hash(text) {
    if (typeof hashSeed === 'function') return hashSeed(String(text));
    let h = 2166136261;
    const str = String(text || 'ecosystem');
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function noise(seed, x, y, salt = 'n') {
    return (hash(`${seed}|${salt}|${x}|${y}`) % 100000) / 100000;
  }

  function occupiedSet(world, ignore = null) {
    const used = new Set();
    for (const obj of world?.objects || []) {
      if (!obj || obj === ignore) continue;
      used.add(key(obj.x, obj.y));
    }
    return used;
  }

  function tileRuleForObject(type) {
    if (TREE_TYPES.has(type)) return 'tree';
    if (['bush', 'berry', 'herbs', 'mushrooms'].includes(type)) return 'soft_vegetation';
    if (type === 'dry_twigs' || type === 'logs') return 'dry_resource';
    if (type === 'rock' || type === 'ore') return 'geology';
    if (RUIN_TYPES.has(type)) return 'ruin';
    if (CAMP_TYPES.has(type)) return 'camp';
    return 'neutral';
  }

  function canObjectExistOn(type, tile) {
    const rule = tileRuleForObject(type);
    if (rule === 'tree') return isNaturalSoil(tile);
    if (rule === 'soft_vegetation') return isNaturalSoil(tile);
    if (rule === 'dry_resource') return isDrySoil(tile);
    if (rule === 'geology') return isGeologySoil(tile);
    if (rule === 'ruin') return isDrySoil(tile) || tile === 'stone';
    if (rule === 'camp') return isDrySoil(tile);
    return tile !== 'water';
  }

  function countTerrain(world, cx, cy, radius, type) {
    let count = 0;
    let total = 0;
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (!inside(world, x, y, 1)) continue;
        if (distance(x, y, cx, cy) > radius + 0.2) continue;
        total++;
        if (terrain(world, x, y) === type) count++;
      }
    }
    return { count, total, ratio: total ? count / total : 0 };
  }

  function isInsideMountainMass(world, x, y, radius = 3) {
    const stone = countTerrain(world, x, y, radius, 'stone');
    return stone.ratio >= 0.36 || stone.count >= Math.max(8, Math.floor(stone.total * 0.30));
  }

  function objectIsInvalid(world, obj) {
    if (!obj || !inside(world, obj.x, obj.y, 1)) return true;
    const tile = terrain(world, obj.x, obj.y);
    if (!canObjectExistOn(obj.type, tile)) return true;
    if (VEGETATION_TYPES.has(obj.type) && tile === 'stone') return true;
    if (RUIN_TYPES.has(obj.type) && isInsideMountainMass(world, obj.x, obj.y, 4)) return true;
    if (RESOURCE_TYPES.has(obj.type) && distanceToSpawn(world, obj.x, obj.y) < 7.5 && !CAMP_TYPES.has(obj.type)) return true;
    return false;
  }

  function findValidTileForObject(world, obj, maxRadius = 12) {
    const used = occupiedSet(world, obj);
    const seed = `${world.seed}|ecosystem-relocate|${obj.type}|${obj.id || ''}`;
    for (let radius = 2; radius <= maxRadius; radius++) {
      for (let step = 0; step < 40; step++) {
        const angle = noise(seed, radius, step, 'angle') * Math.PI * 2;
        const d = radius * (0.55 + noise(seed, step, radius, 'distance') * 0.48);
        const x = Math.round(obj.x + Math.cos(angle) * d);
        const y = Math.round(obj.y + Math.sin(angle) * d);
        if (!inside(world, x, y, 2)) continue;
        if (used.has(key(x, y))) continue;
        const tile = terrain(world, x, y);
        if (!canObjectExistOn(obj.type, tile)) continue;
        if (RUIN_TYPES.has(obj.type) && isInsideMountainMass(world, x, y, 4)) continue;
        if (RESOURCE_TYPES.has(obj.type) && distanceToSpawn(world, x, y) < 7.5 && !CAMP_TYPES.has(obj.type)) continue;
        return { x, y };
      }
    }
    return null;
  }

  function relocateOrRemoveInvalidObjects(world) {
    const next = [];
    const used = new Set();
    for (const obj of world.objects || []) {
      if (!obj || !inside(world, obj.x, obj.y, 1)) continue;
      const originalKey = key(obj.x, obj.y);
      if (used.has(originalKey)) continue;

      if (objectIsInvalid(world, obj)) {
        const tile = findValidTileForObject(world, obj, RUIN_TYPES.has(obj.type) ? 20 : 12);
        if (!tile) continue;
        obj.x = tile.x;
        obj.y = tile.y;
      }

      const k = key(obj.x, obj.y);
      if (used.has(k)) continue;
      used.add(k);
      next.push(obj);
    }
    world.objects = next;
  }

  function poiObjects(world, poiId) {
    return (world.objects || []).filter(obj => String(obj.poiId || '') === String(poiId));
  }

  function clearRuinFootprint(world, cx, cy, radius = 5) {
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (!inside(world, x, y, 2)) continue;
        const d = distance(x, y, cx, cy);
        if (d > radius + 0.15) continue;
        const current = terrain(world, x, y);
        if (d <= 3.2) {
          if (current === 'water' || current === 'stone') setTerrain(world, x, y, noise(world.seed, x, y, 'ruin-floor') > 0.70 ? 'stone' : 'dirt');
          else if (current === 'grass' && noise(world.seed, x, y, 'ruin-wear') > 0.56) setTerrain(world, x, y, 'dirt');
        } else if (current === 'water' || current === 'stone') {
          setTerrain(world, x, y, noise(world.seed, x, y, 'ruin-edge') > 0.74 ? 'grass' : 'dirt');
        }
      }
    }
  }

  function relocatePoiCluster(world, center, radius = 20) {
    const fake = { type: 'ruin', x: center.x, y: center.y, id: center.id || 'poi' };
    const tile = findValidTileForObject(world, fake, radius);
    if (!tile) return null;
    return tile;
  }

  function enforcePoiRules(world) {
    world.pointsOfInterest = Array.isArray(world.pointsOfInterest) ? world.pointsOfInterest : [];

    for (const poi of world.pointsOfInterest) {
      if (!poi || !Number.isFinite(Number(poi.x)) || !Number.isFinite(Number(poi.y))) continue;
      poi.x = Math.round(poi.x);
      poi.y = Math.round(poi.y);
      if (distanceToSpawn(world, poi.x, poi.y) < 16 || isInsideMountainMass(world, poi.x, poi.y, 5) || terrain(world, poi.x, poi.y) === 'water') {
        const next = relocatePoiCluster(world, poi, 26);
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

    for (const obj of world.objects || []) {
      if (!RUIN_TYPES.has(obj.type)) continue;
      if (isInsideMountainMass(world, obj.x, obj.y, 4) || terrain(world, obj.x, obj.y) === 'water') {
        const tile = findValidTileForObject(world, obj, 20);
        if (tile) {
          obj.x = tile.x;
          obj.y = tile.y;
        }
      }
      clearRuinFootprint(world, obj.x, obj.y, obj.type === 'rubble' ? 3 : 4);
    }
  }

  function protectObjectsFromTerrain(world) {
    for (const obj of world.objects || []) {
      if (!obj || !inside(world, obj.x, obj.y, 1)) continue;
      const tile = terrain(world, obj.x, obj.y);
      if (VEGETATION_TYPES.has(obj.type) && !isNaturalSoil(tile)) setTerrain(world, obj.x, obj.y, 'grass');
      else if (obj.type === 'logs' && !isDrySoil(tile)) setTerrain(world, obj.x, obj.y, 'dirt');
      else if (CAMP_TYPES.has(obj.type) && !isDrySoil(tile)) setTerrain(world, obj.x, obj.y, 'dirt');
      else if (GEOLOGY_TYPES.has(obj.type) && tile === 'water') setTerrain(world, obj.x, obj.y, 'stone');
      else if (RUIN_TYPES.has(obj.type) && tile === 'water') setTerrain(world, obj.x, obj.y, 'dirt');
    }
  }

  function enforceTerrainLimits(world) {
    if (!world?.spawn) return;
    for (let y = world.spawn.y - 10; y <= world.spawn.y + 10; y++) {
      for (let x = world.spawn.x - 10; x <= world.spawn.x + 10; x++) {
        if (!inside(world, x, y, 2)) continue;
        if (distanceToSpawn(world, x, y) <= 9 && (terrain(world, x, y) === 'stone' || terrain(world, x, y) === 'water')) {
          setTerrain(world, x, y, distanceToSpawn(world, x, y) < 5 ? 'grass' : 'dirt');
        }
      }
    }
  }

  function applyToWorld(world, config = {}) {
    if (!world || !Array.isArray(world.terrain) || world.ecosystemRulesVersion === VERSION) return world;
    world.objects = Array.isArray(world.objects) ? world.objects : [];
    enforceTerrainLimits(world);
    enforcePoiRules(world);
    protectObjectsFromTerrain(world);
    relocateOrRemoveInvalidObjects(world);
    enforcePoiRules(world);
    protectObjectsFromTerrain(world);
    world.ecosystemRulesVersion = VERSION;
    world.generationVersion = `${world.generationVersion || 'world'}+ecosystem`;
    return world;
  }

  function installWorldgenPatch() {
    const original = window.generateWorldFromSeed;
    if (typeof original !== 'function' || original.__havenfallEcosystemPatched) return;
    function generateWorldFromSeedWithEcosystem(config) {
      return applyToWorld(original(config), config || {});
    }
    generateWorldFromSeedWithEcosystem.__havenfallEcosystemPatched = true;
    window.generateWorldFromSeed = generateWorldFromSeedWithEcosystem;
    try { generateWorldFromSeed = generateWorldFromSeedWithEcosystem; } catch (_) {}
  }

  window.HavenfallEcosystemRules = Object.freeze({
    version: VERSION,
    applyToWorld,
    canObjectExistOn,
    isInsideMountainMass,
    tileRuleForObject
  });

  installWorldgenPatch();
})();
