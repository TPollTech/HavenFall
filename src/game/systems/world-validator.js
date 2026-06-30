'use strict';

(() => {
  if (window.HavenfallContext?.worldValidatorInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.worldValidatorInstalled = true;

  const VERSION = 'world-validator-v2-playable-seed';
  const NATURAL_TILES = new Set(['grass', 'dirt']);
  const DRY_TILES = new Set(['grass', 'dirt', 'sand']);
  const TREE_TYPES = new Set(['tree', 'oak_tree', 'birch_tree', 'pine_tree', 'palm_tree', 'willow_tree']);
  const PLANT_TYPES = new Set(['tree', 'oak_tree', 'birch_tree', 'pine_tree', 'palm_tree', 'willow_tree', 'bush', 'berry', 'herbs', 'mushrooms']);
  const DRY_RESOURCE_TYPES = new Set(['logs', 'dry_twigs']);
  const STONE_RESOURCE_TYPES = new Set(['rock', 'ore']);
  const POI_TYPES = new Set(['ruin', 'cache', 'supply_crate', 'rubble']);
  const CAMP_TYPES = new Set(['campfire', 'crate', 'stockpile']);

  function inside(world, x, y, margin = 1) {
    return !!world && x >= margin && y >= margin && x < world.cols - margin && y < world.rows - margin;
  }

  function tileAt(world, x, y) {
    return world?.terrain?.[y]?.[x] || null;
  }

  function setTile(world, x, y, type) {
    if (inside(world, x, y, 0) && world.terrain?.[y]) world.terrain[y][x] = type;
  }

  function distance(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  function objectBlocks(obj) {
    return !!(window.objectDefs?.[obj?.type]?.blocks);
  }

  function objectAt(world, x, y, ignoreId = null) {
    return (world.objects || []).find(obj => obj && obj.id !== ignoreId && obj.x === x && obj.y === y) || null;
  }

  function isMountainMass(world, cx, cy, radius = 4) {
    let total = 0;
    let stone = 0;
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (!inside(world, x, y, 0)) continue;
        if (distance(x, y, cx, cy) > radius + 0.2) continue;
        total++;
        if (tileAt(world, x, y) === 'stone') stone++;
      }
    }
    return total > 0 && (stone / total >= 0.32 || stone >= 8);
  }

  function canObjectExistOn(world, type, x, y) {
    const tile = tileAt(world, x, y);
    if (!tile || tile === 'water') return false;
    if (PLANT_TYPES.has(type)) return NATURAL_TILES.has(tile) && !isMountainMass(world, x, y, 3);
    if (DRY_RESOURCE_TYPES.has(type)) return DRY_TILES.has(tile) && !isMountainMass(world, x, y, 3);
    if (type === 'rock') return tile === 'stone' || tile === 'dirt' || tile === 'grass';
    if (type === 'ore') return tile === 'stone' || tile === 'dirt';
    if (POI_TYPES.has(type)) return DRY_TILES.has(tile) && !isMountainMass(world, x, y, 5);
    if (CAMP_TYPES.has(type)) return DRY_TILES.has(tile);
    return tile !== 'water';
  }

  function terrainPreference(type, tile) {
    if (TREE_TYPES.has(type)) return tile === 'grass' ? 1.5 : tile === 'dirt' ? 1 : 0.2;
    if (type === 'berry') return tile === 'grass' ? 1.4 : tile === 'dirt' ? 1 : 0.2;
    if (type === 'rock') return tile === 'dirt' ? 1.35 : tile === 'stone' ? 1 : 0.6;
    if (POI_TYPES.has(type)) return tile === 'dirt' ? 1.5 : tile === 'sand' ? 1.1 : 0.7;
    if (CAMP_TYPES.has(type)) return tile === 'grass' ? 1.2 : tile === 'dirt' ? 1 : 0.7;
    return 1;
  }

  function respectsSpacing(world, type, x, y, ignoreId = null) {
    for (const obj of world.objects || []) {
      if (!obj || obj.id === ignoreId) continue;
      const d = distance(obj.x, obj.y, x, y);
      if (TREE_TYPES.has(type) && TREE_TYPES.has(obj.type) && d < 2) return false;
      if (POI_TYPES.has(type) && POI_TYPES.has(obj.type) && d < 6) return false;
      if (type === 'rock' && obj.type === 'rock' && d < 2) return false;
      if (PLANT_TYPES.has(type) && POI_TYPES.has(obj.type) && d < 4) return false;
    }
    return true;
  }

  function findBestTile(world, type, nearX, nearY, radius = 20, options = {}) {
    let best = null;
    let bestScore = -Infinity;
    const minSpawnDistance = Number(options.minSpawnDistance || 0);
    const ignoreId = options.ignoreId || null;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = Math.round(nearX + dx);
        const y = Math.round(nearY + dy);
        if (!inside(world, x, y, 2)) continue;
        if (objectAt(world, x, y, ignoreId)) continue;
        if (minSpawnDistance && world.spawn && distance(x, y, world.spawn.x, world.spawn.y) < minSpawnDistance) continue;
        if (!canObjectExistOn(world, type, x, y)) continue;
        if (!respectsSpacing(world, type, x, y, ignoreId)) continue;
        const tile = tileAt(world, x, y);
        const score = terrainPreference(type, tile) * 12 - distance(x, y, nearX, nearY) * 0.35 - (isMountainMass(world, x, y, 4) ? 20 : 0);
        if (score > bestScore) {
          bestScore = score;
          best = { x, y };
        }
      }
    }
    return best;
  }

  function clearSpawnArea(world, fixes) {
    if (!world.spawn) return;
    const sx = world.spawn.x;
    const sy = world.spawn.y;
    let changed = 0;
    for (let y = sy - 5; y <= sy + 5; y++) {
      for (let x = sx - 5; x <= sx + 5; x++) {
        if (!inside(world, x, y, 2)) continue;
        const d = distance(x, y, sx, sy);
        if (d > 5.4) continue;
        const tile = tileAt(world, x, y);
        if (tile === 'water' || tile === 'stone') {
          setTile(world, x, y, d < 3.2 ? 'grass' : 'dirt');
          changed++;
        }
      }
    }
    world.objects = (world.objects || []).filter(obj => {
      if (!obj) return false;
      const d = distance(obj.x, obj.y, sx, sy);
      if (d > 5.2) return true;
      return obj.type === 'campfire' || obj.type === 'crate' || obj.type === 'stockpile';
    });
    if (changed) fixes.push(`${changed} tile(s) do spawn foram limpos para terreno jogável.`);
  }

  function spawnIsValid(world) {
    if (!world.spawn) return false;
    const sx = world.spawn.x;
    const sy = world.spawn.y;
    if (!NATURAL_TILES.has(tileAt(world, sx, sy))) return false;
    if (isMountainMass(world, sx, sy, 5)) return false;
    let walkable = 0;
    for (let y = sy - 3; y <= sy + 3; y++) {
      for (let x = sx - 3; x <= sx + 3; x++) {
        const tile = tileAt(world, x, y);
        if (!tile || tile === 'water' || tile === 'stone') continue;
        const obj = objectAt(world, x, y);
        if (obj && objectBlocks(obj)) continue;
        walkable++;
      }
    }
    return walkable >= 28;
  }

  function findBestSpawn(world) {
    const centerX = Math.floor(world.cols / 2);
    const centerY = Math.floor(world.rows / 2);
    let best = null;
    let bestScore = -Infinity;
    for (let y = 6; y < world.rows - 6; y++) {
      for (let x = 6; x < world.cols - 6; x++) {
        if (!NATURAL_TILES.has(tileAt(world, x, y))) continue;
        if (isMountainMass(world, x, y, 5)) continue;
        let bad = false;
        let open = 0;
        for (let yy = y - 3; yy <= y + 3; yy++) {
          for (let xx = x - 3; xx <= x + 3; xx++) {
            const tile = tileAt(world, xx, yy);
            if (tile === 'water' || tile === 'stone') bad = true;
            if (tile && tile !== 'water' && tile !== 'stone' && !objectAt(world, xx, yy)) open++;
          }
        }
        if (bad || open < 28) continue;
        const centerPenalty = distance(x, y, centerX, centerY) * 0.12;
        const score = open - centerPenalty;
        if (score > bestScore) {
          bestScore = score;
          best = { x, y };
        }
      }
    }
    return best;
  }

  function ensureSpawn(world, fixes, errors) {
    if (!spawnIsValid(world)) {
      const next = findBestSpawn(world);
      if (next) {
        world.spawn = next;
        world.spawnPoints = makeSpawnPointsSimple(next, world.cols, world.rows);
        fixes.push(`Spawn realocado para (${next.x}, ${next.y}).`);
      } else {
        errors.push('Não foi possível encontrar spawn jogável.');
      }
    }
    clearSpawnArea(world, fixes);
  }

  function ensureObjectNear(world, type, required, radius, fixes, label) {
    if (!world.spawn) return;
    const count = (world.objects || []).filter(obj => obj?.type === type && distance(obj.x, obj.y, world.spawn.x, world.spawn.y) <= radius).length;
    let added = 0;
    for (let i = count; i < required; i++) {
      const pos = findBestTile(world, type, world.spawn.x, world.spawn.y, radius, { minSpawnDistance: 4 });
      if (!pos) break;
      world.objects.push({ id: generateObjId(type, world.objects.length, world.seed), type, x: pos.x, y: pos.y, starterGuaranteed: true });
      added++;
    }
    if (added) fixes.push(`${added}x ${label} garantido(s) perto do spawn.`);
  }

  function ensureStarterCamp(world, fixes) {
    if (!world.spawn) return;
    for (const spec of [
      { type: 'campfire', dx: 0, dy: 0, label: 'fogueira inicial' },
      { type: 'crate', dx: 2, dy: 0, label: 'depósito inicial' },
      { type: 'logs', dx: -2, dy: 1, label: 'toras iniciais' }
    ]) {
      let obj = (world.objects || []).find(o => o.type === spec.type && distance(o.x, o.y, world.spawn.x, world.spawn.y) <= 6);
      if (!obj) {
        const pos = findBestTile(world, spec.type, world.spawn.x + spec.dx, world.spawn.y + spec.dy, 6, { ignoreId: null });
        if (pos) {
          world.objects.push({ id: generateObjId(spec.type, world.objects.length, world.seed), type: spec.type, x: pos.x, y: pos.y, starterCamp: true });
          fixes.push(`${spec.label} criada perto do spawn.`);
        }
      } else if (!canObjectExistOn(world, obj.type, obj.x, obj.y) || distance(obj.x, obj.y, world.spawn.x, world.spawn.y) > 6) {
        const pos = findBestTile(world, obj.type, world.spawn.x + spec.dx, world.spawn.y + spec.dy, 6, { ignoreId: obj.id });
        if (pos) {
          obj.x = pos.x;
          obj.y = pos.y;
          fixes.push(`${spec.label} realocada para área válida.`);
        }
      }
    }
  }

  function clearPoiFootprint(world, cx, cy) {
    for (let y = cy - 5; y <= cy + 5; y++) {
      for (let x = cx - 5; x <= cx + 5; x++) {
        if (!inside(world, x, y, 2)) continue;
        const d = distance(x, y, cx, cy);
        if (d > 5.2) continue;
        const tile = tileAt(world, x, y);
        if (d <= 3.2) {
          if (tile === 'water' || tile === 'stone') setTile(world, x, y, 'dirt');
          else if (tile === 'grass') setTile(world, x, y, 'dirt');
        } else if (tile === 'water' || tile === 'stone') {
          setTile(world, x, y, 'dirt');
        }
      }
    }
  }

  function objectsForPoi(world, poi) {
    const id = String(poi?.id || '');
    if (!id) return [];
    return (world.objects || []).filter(obj => String(obj.poiId || '') === id);
  }

  function ensurePoiLocations(world, fixes) {
    world.pointsOfInterest = Array.isArray(world.pointsOfInterest) ? world.pointsOfInterest : [];
    for (let i = world.pointsOfInterest.length - 1; i >= 0; i--) {
      const poi = world.pointsOfInterest[i];
      if (!poi || !inside(world, poi.x, poi.y, 4)) {
        world.pointsOfInterest.splice(i, 1);
        fixes.push('POI inválido removido por estar fora do mapa.');
        continue;
      }
      poi.x = Math.round(poi.x);
      poi.y = Math.round(poi.y);
      const type = poi.type || poi.archetype || 'ruin';
      const invalid = distance(poi.x, poi.y, world.spawn?.x || poi.x, world.spawn?.y || poi.y) < 16 || !canObjectExistOn(world, type, poi.x, poi.y);
      if (invalid) {
        const next = findBestTile(world, type, world.spawn?.x || poi.x, world.spawn?.y || poi.y, 40, { minSpawnDistance: 16 });
        if (!next) {
          world.pointsOfInterest.splice(i, 1);
          fixes.push(`POI ${poi.name || type} removido por não encontrar terreno válido.`);
          continue;
        }
        const dx = next.x - poi.x;
        const dy = next.y - poi.y;
        for (const obj of objectsForPoi(world, poi)) {
          obj.x += dx;
          obj.y += dy;
        }
        poi.x = next.x;
        poi.y = next.y;
        fixes.push(`POI ${poi.name || type} realocado para fora de montanha/água.`);
      }
      clearPoiFootprint(world, poi.x, poi.y);
    }
  }

  function sanitizeObjects(world, fixes) {
    const next = [];
    const occupied = new Set();
    let removed = 0;
    let moved = 0;
    for (const obj of world.objects || []) {
      if (!obj || !inside(world, obj.x, obj.y, 1)) {
        removed++;
        continue;
      }
      const k = `${obj.x},${obj.y}`;
      if (occupied.has(k)) {
        const pos = findBestTile(world, obj.type, obj.x, obj.y, 10, { ignoreId: obj.id });
        if (pos) {
          obj.x = pos.x;
          obj.y = pos.y;
          moved++;
        } else {
          removed++;
          continue;
        }
      }
      if (!canObjectExistOn(world, obj.type, obj.x, obj.y)) {
        const pos = findBestTile(world, obj.type, obj.x, obj.y, POI_TYPES.has(obj.type) ? 30 : 15, { ignoreId: obj.id, minSpawnDistance: POI_TYPES.has(obj.type) ? 16 : 0 });
        if (pos) {
          obj.x = pos.x;
          obj.y = pos.y;
          moved++;
        } else {
          removed++;
          continue;
        }
      }
      occupied.add(`${obj.x},${obj.y}`);
      next.push(obj);
    }
    world.objects = next;
    if (moved) fixes.push(`${moved} objeto(s) realocado(s) para terreno válido.`);
    if (removed) fixes.push(`${removed} objeto(s) inválido(s) removido(s).`);
  }

  function refreshWorldReferences(world) {
    world.objects = Array.isArray(world.objects) ? world.objects : [];
    world.pointsOfInterest = Array.isArray(world.pointsOfInterest) ? world.pointsOfInterest : [];
    world.width = world.cols * (world.tileSize || TILE || 48);
    world.height = world.rows * (world.tileSize || TILE || 48);
    if (typeof makeSpawnPoints === 'function' && world.spawn) world.spawnPoints = makeSpawnPoints(world.spawn, world.cols, world.rows);
    else if (world.spawn) world.spawnPoints = makeSpawnPointsSimple(world.spawn, world.cols, world.rows);
  }

  function validateWorld(world, config = {}) {
    const fixes = [];
    const errors = [];
    if (!world?.terrain || !world.cols || !world.rows) return { world, fixes, errors, playable: true, valid: true, fixCount: 0, errorCount: 0 };
    world.objects = Array.isArray(world.objects) ? world.objects : [];
    world.pointsOfInterest = Array.isArray(world.pointsOfInterest) ? world.pointsOfInterest : [];

    ensureSpawn(world, fixes, errors);
    ensureStarterCamp(world, fixes);
    ensurePoiLocations(world, fixes);
    sanitizeObjects(world, fixes);
    ensureObjectNear(world, 'tree', 8, 20, fixes, 'árvore/madeira');
    ensureObjectNear(world, 'rock', 4, 20, fixes, 'rocha/pedra');
    ensureObjectNear(world, 'berry', 3, 20, fixes, 'fruta/comida');
    sanitizeObjects(world, fixes);
    refreshWorldReferences(world);

    world.validationVersion = VERSION;
    world.validated = errors.length === 0;
    world.validationReport = {
      version: VERSION,
      seed: config?.seed || world.seed || 'unknown',
      fixes: fixes.slice(0, 40),
      errors: errors.slice(0, 20),
      fixCount: fixes.length,
      errorCount: errors.length
    };

    return {
      world,
      fixes,
      errors,
      playable: errors.length === 0,
      valid: errors.length === 0,
      seed: config?.seed || world.seed || 'unknown',
      fixCount: fixes.length,
      errorCount: errors.length
    };
  }

  function makeSpawnPointsSimple(spawn, cols, rows) {
    const points = [];
    for (let y = Math.max(0, spawn.y - 2); y <= Math.min(rows - 1, spawn.y + 2); y++) {
      for (let x = Math.max(0, spawn.x - 2); x <= Math.min(cols - 1, spawn.x + 2); x++) points.push({ x, y });
    }
    return points;
  }

  let idCounter = 100000;
  function generateObjId(type, index, seed) {
    idCounter += 1;
    return `validated-${type}-${String(seed || 'seed')}-${idCounter}`;
  }

  window.HavenfallWorldValidator = Object.freeze({ validateWorld, findBestSpawn, isMountainMass, canObjectExistOn, findBestTile });
  window.validateWorld = (world, config) => validateWorld(world, config);
})();
