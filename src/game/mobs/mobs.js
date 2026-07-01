'use strict';

const MOB_SAFE_ZONE_RADIUS = 15;
const MOB_GLOBAL_DENSITY_CAP = 28;
const MOB_HOSTILE_DENSITY_CAP = 6;
const MOB_SEPARATION_DISTANCE_PX = 26;
const ATTACK_ANIM_DURATION = 0.18;

const mobSpawnConfig = {
  wolf: { maxCount: 3, spawnChance: 0.02, hostile: true },
  spider: { maxCount: 4, spawnChance: 0.035, hostile: true },
  rabbit: { maxCount: 8, spawnChance: 0.075, hostile: false },
  deer: { maxCount: 4, spawnChance: 0.026, hostile: false },
  goat: { maxCount: 4, spawnChance: 0.024, hostile: false },
  sheep: { maxCount: 5, spawnChance: 0.028, hostile: false },
  pig: { maxCount: 4, spawnChance: 0.020, hostile: false },
  cow: { maxCount: 3, spawnChance: 0.012, hostile: false },
  chicken: { maxCount: 6, spawnChance: 0.035, hostile: false },
  duck: { maxCount: 5, spawnChance: 0.026, hostile: false },
  turkey: { maxCount: 4, spawnChance: 0.020, hostile: false },
  squirrel: { maxCount: 6, spawnChance: 0.040, hostile: false },
  turtle: { maxCount: 4, spawnChance: 0.018, hostile: false }
};

const mobStatModifiers = Object.freeze({
  wolf: { hp: 100, huntWork: 3.8, damageTaken: 1 },
  spider: { hp: 70, huntWork: 3.8, damageTaken: 1 },
  rabbit: { hp: 42, huntWork: 2.6, damageTaken: 0.72 },
  deer: { hp: 74, huntWork: 3.4, damageTaken: 0.86 },
  goat: { hp: 64, huntWork: 3.1, damageTaken: 0.9 },
  sheep: { hp: 58, huntWork: 3.0, damageTaken: 0.92 },
  pig: { hp: 68, huntWork: 3.2, damageTaken: 0.88 },
  cow: { hp: 120, huntWork: 4.5, damageTaken: 0.78 },
  chicken: { hp: 28, huntWork: 1.8, damageTaken: 1.15 },
  duck: { hp: 32, huntWork: 2.0, damageTaken: 1.08 },
  turkey: { hp: 44, huntWork: 2.5, damageTaken: 0.98 },
  squirrel: { hp: 24, huntWork: 1.7, damageTaken: 1.25 },
  turtle: { hp: 80, huntWork: 3.6, damageTaken: 0.58 }
});

const passiveMobSpeeds = Object.freeze({
  rabbit: 26,
  deer: 34,
  goat: 28,
  sheep: 22,
  pig: 24,
  cow: 18,
  chicken: 25,
  duck: 22,
  turkey: 22,
  squirrel: 38,
  turtle: 10
});

const skittishMobTypes = Object.freeze(new Set(['rabbit', 'deer', 'chicken', 'duck', 'turkey', 'squirrel']));

const mobHabitatWeights = Object.freeze({
  rabbit: { grass: 1.25, dirt: 0.75, sand: 0.16 },
  deer: { grass: 1.35, dirt: 0.62, sand: 0.05 },
  goat: { grass: 0.62, dirt: 1.1, sand: 0.45 },
  sheep: { grass: 1.2, dirt: 0.72, sand: 0.08 },
  pig: { grass: 0.95, dirt: 0.95, sand: 0.02 },
  cow: { grass: 1.3, dirt: 0.42, sand: 0.01 },
  chicken: { grass: 1.05, dirt: 0.82, sand: 0.22 },
  duck: { grass: 0.86, dirt: 0.72, sand: 0.16 },
  turkey: { grass: 0.92, dirt: 0.78, sand: 0.20 },
  squirrel: { grass: 1.45, dirt: 0.52, sand: 0.02 },
  turtle: { grass: 0.56, dirt: 0.8, sand: 0.72 },
  spider: { grass: 0.45, dirt: 0.9, sand: 0.8 },
  wolf: { grass: 0.75, dirt: 0.95, sand: 0.38 },
  blood_wolf: { grass: 0.7, dirt: 1.0, sand: 0.4 }
});

const herdMobTypes = Object.freeze(new Set(['deer', 'goat', 'sheep', 'pig', 'cow', 'chicken', 'duck', 'turkey']));

window.mobSpawnConfig = mobSpawnConfig;
window.mobStatModifiers = mobStatModifiers;
window.bloodParticles = Array.isArray(window.bloodParticles) ? window.bloodParticles : [];

function ensureMobState() {
  if (!state) return [];
  state.mobs = Array.isArray(state.mobs) ? state.mobs : [];
  return state.mobs;
}

function allMobileEntities() {
  return [
    ...(Array.isArray(state?.mobs) ? state.mobs : []),
    ...(Array.isArray(state?.wolves) ? state.wolves : [])
  ].filter(Boolean);
}

function entityAtTile(list, x, y, predicate = null) {
  const tx = Math.round(Number(x) || 0);
  const ty = Math.round(Number(y) || 0);
  const matcher = typeof predicate === 'function' ? predicate : () => true;
  return (list || []).find(entity => matcher(entity) && Math.round(entity?.x) === tx && Math.round(entity?.y) === ty) || null;
}

function isHostileMobType(type) { return !!mobSpawnConfig[type]?.hostile; }

function getWolfAt(x, y) {
  return entityAtTile(state?.wolves, x, y);
}

function getPassiveMobAt(x, y) {
  return entityAtTile(ensureMobState(), x, y, mob => !isHostileMobType(mob?.type));
}

function getHostileMobAt(x, y) {
  return getWolfAt(x, y) || entityAtTile(ensureMobState(), x, y, mob => isHostileMobType(mob?.type));
}

function getCreatureAt(x, y) {
  return getWolfAt(x, y) || getHostileMobAt(x, y) || getPassiveMobAt(x, y);
}

function countMob(type) {
  const mobs = ensureMobState();
  const normal = mobs.filter(m => m.type === type).length;
  const wolves = type === 'wolf' ? (state?.wolves?.length || 0) : 0;
  return normal + wolves;
}

function countHostileMobs() {
  return (state?.wolves?.length || 0) + ensureMobState().filter(m => isHostileMobType(m.type)).length;
}

function canSpawnMob(type) {
  const cfg = mobSpawnConfig[type];
  if (!cfg || !state) return false;
  if (allMobileEntities().length >= MOB_GLOBAL_DENSITY_CAP) return false;
  if (isHostileMobType(type) && countHostileMobs() >= MOB_HOSTILE_DENSITY_CAP) return false;
  return countMob(type) < cfg.maxCount;
}

function distanceToNearestColonistTile(x, y) {
  let best = Infinity;
  for (const c of state?.colonists || []) best = Math.min(best, Math.hypot(x - c.x, y - c.y));
  return best;
}

function hasMobileEntityAtTile(x, y) {
  return allMobileEntities().some(entity => Math.round(entity.x) === x && Math.round(entity.y) === y);
}

function isValidMobSpawnTile(type, tile) {
  if (!tile) return false;
  if (typeof isInside === 'function' && !isInside(tile.x, tile.y)) return false;
  if ((state?.terrain?.[tile.y]?.[tile.x] || state?.world?.terrain?.[tile.y]?.[tile.x]) === 'stone') return false;
  if (typeof isBlocked === 'function' && isBlocked(tile.x, tile.y)) return false;
  if (typeof getObjectAt === 'function' && getObjectAt(tile.x, tile.y)) return false;
  if (hasMobileEntityAtTile(tile.x, tile.y)) return false;
  if (isHostileMobType(type) && distanceToNearestColonistTile(tile.x, tile.y) < MOB_SAFE_ZONE_RADIUS) return false;
  return true;
}

function randomSafeEdgeTile(type) {
  const cols = getWorldCols();
  const rows = getWorldRows();
  for (let i = 0; i < 160; i++) {
    const side = Math.floor(Math.random() * 4);
    let tile;
    if (side === 0) tile = { x: 1, y: 1 + Math.floor(Math.random() * Math.max(1, rows - 2)) };
    else if (side === 1) tile = { x: Math.max(1, cols - 2), y: 1 + Math.floor(Math.random() * Math.max(1, rows - 2)) };
    else if (side === 2) tile = { x: 1 + Math.floor(Math.random() * Math.max(1, cols - 2)), y: 1 };
    else tile = { x: 1 + Math.floor(Math.random() * Math.max(1, cols - 2)), y: Math.max(1, rows - 2) };
    if (isValidMobSpawnTile(type, tile)) return tile;
  }
  return null;
}

function randomSafeInteriorTile(type) {
  const cols = getWorldCols();
  const rows = getWorldRows();
  for (let i = 0; i < 180; i++) {
    const tile = { x: 2 + Math.floor(Math.random() * Math.max(1, cols - 4)), y: 2 + Math.floor(Math.random() * Math.max(1, rows - 4)) };
    if (isValidMobSpawnTile(type, tile)) return tile;
  }
  return null;
}

function spawnMob(type, tile = null) {
  if (!canSpawnMob(type)) return null;
  const t = tile && isValidMobSpawnTile(type, tile) ? tile : mobSpawnTile(type);
  if (!t) return null;
  const stats = mobStatModifiers[type] || mobStatModifiers.wolf;
  const mob = {
    id: uid(), type, x: t.x, y: t.y,
    px: t.x * TILE + TILE / 2, py: t.y * TILE + TILE / 2,
    dir: 'left', anim: 0, attackAnimTimer: 0, hitAnimTimer: 0,
    hp: stats.hp, maxHp: stats.hp,
    state: isPassiveMobType(type) ? 'wander' : type === 'spider' ? 'sleep' : 'hunting',
    target: null
  };
  ensureMobState().push(mob);
  return mob;
}

function mobSpawnTile(type) {
  const world = state?.world;
  const preferEdge = type === 'spider' || type === 'wolf';
  if (!world) return (preferEdge ? randomSafeEdgeTile(type) : randomSafeInteriorTile(type)) || randomSafeEdgeTile(type);
  const weighted = weightedMobSpawnTile(type, { preferEdge, tries: preferEdge ? 180 : 240 });
  if (weighted) return weighted;
  return (preferEdge ? randomSafeEdgeTile(type) : randomSafeInteriorTile(type)) || randomSafeEdgeTile(type);
}

function weightedMobSpawnTile(type, options = {}) {
  const world = state?.world;
  if (!world) return null;
  let best = null;
  let bestScore = 0;
  const tries = Number(options.tries || 180);
  for (let i = 0; i < tries; i++) {
    const tile = options.preferEdge ? edgeCandidateTile(world) : interiorCandidateTile(world);
    if (!isValidMobSpawnTile(type, tile)) continue;
    const score = mobSpawnTileScore(type, tile, world);
    if (score <= 0) continue;
    if (Math.random() < Math.min(0.72, score / 3.2)) return tile;
    if (score > bestScore) { bestScore = score; best = tile; }
  }
  return best;
}

function edgeCandidateTile(world) {
  const side = Math.floor(Math.random() * 4);
  if (side === 0) return { x: 1, y: 1 + Math.floor(Math.random() * Math.max(1, world.rows - 2)) };
  if (side === 1) return { x: Math.max(1, world.cols - 2), y: 1 + Math.floor(Math.random() * Math.max(1, world.rows - 2)) };
  if (side === 2) return { x: 1 + Math.floor(Math.random() * Math.max(1, world.cols - 2)), y: 1 };
  return { x: 1 + Math.floor(Math.random() * Math.max(1, world.cols - 2)), y: Math.max(1, world.rows - 2) };
}

function interiorCandidateTile(world) {
  return {
    x: 2 + Math.floor(Math.random() * Math.max(1, world.cols - 4)),
    y: 2 + Math.floor(Math.random() * Math.max(1, world.rows - 4))
  };
}

function mobSpawnTileScore(type, tile, world = state?.world) {
  if (!world || !tile) return 0;
  const terrain = world.terrain?.[tile.y]?.[tile.x];
  const terrainWeight = mobHabitatWeights[type]?.[terrain] ?? (terrain === 'stone' ? 0 : 0.35);
  if (terrainWeight <= 0) return 0;
  const biomeId = world.biomes?.[tile.y]?.[tile.x] || biomeAt?.(tile.x, tile.y, state?.config?.seed);
  const context = {
    hour: state?.hour ?? 12,
    difficulty: state?.config?.difficulty || 'normal',
    eventIntensity: state?.config?.eventIntensity || 'normal'
  };
  const biomeWeight = window.BiomeRegistry?.spawnWeightFor?.(type, biomeId, context) ?? 1;
  if (biomeWeight <= 0) return 0;
  const colonistDist = distanceToNearestColonistTile(tile.x, tile.y);
  const distanceWeight = isHostileMobType(type)
    ? (colonistDist < MOB_SAFE_ZONE_RADIUS ? 0 : Math.min(1.35, colonistDist / 26))
    : (colonistDist < 7 ? 0.2 : Math.min(1.18, colonistDist / 16));
  const coverWeight = nearbyObjectTypeCount(world, tile.x, tile.y, ['tree', 'oak_tree', 'birch_tree', 'pine_tree', 'palm_tree', 'willow_tree', 'cactus'], 4);
  const coverBonus = type === 'squirrel' || type === 'deer' || type === 'rabbit' ? Math.min(0.7, coverWeight * 0.09) : 0;
  const opennessPenalty = herdMobTypes.has(type) ? Math.min(0.35, coverWeight * 0.035) : 0;
  return biomeWeight * terrainWeight * distanceWeight + coverBonus - opennessPenalty;
}

function nearbyObjectTypeCount(world, x, y, types, radius) {
  const allowed = new Set(types);
  let count = 0;
  for (const obj of world?.objects || []) {
    if (!allowed.has(obj.type)) continue;
    if (Math.abs(obj.x - x) <= radius && Math.abs(obj.y - y) <= radius) count++;
  }
  return count;
}

function generateInitialMobs(world, config = {}, colonists = []) {
  if (!world?.terrain || !world.biomes) return [];
  const rand = typeof seededRandom === 'function' ? seededRandom(`${world.seed || config.seed}|initial-fauna-v2`) : Math.random;
  const area = world.cols * world.rows;
  const target = Math.max(8, Math.min(34, Math.floor(area / 620)));
  const mobs = [];
  const occupied = new Set((world.objects || []).map(o => `${o.x},${o.y}`));
  const counts = {};
  const passiveTypes = Object.keys(mobSpawnConfig).filter(type => mobSpawnConfig[type]?.hostile === false);
  const quotas = initialBiomeMobQuotas(world, target);
  for (const [biomeId, quota] of Object.entries(quotas)) {
    let biomeAttempts = 0;
    while ((mobs.filter(m => world.biomes?.[m.y]?.[m.x] === biomeId).length) < quota && mobs.length < target && biomeAttempts++ < quota * 90) {
      const availableTypes = passiveTypes.filter(type => (counts[type] || 0) < mobSpawnConfig[type].maxCount);
      if (!availableTypes.length) break;
      const anchor = initialFaunaAnchor(world, availableTypes, config, colonists, occupied, rand, biomeId);
      if (!anchor) break;
      const groupSize = initialGroupSize(anchor.type, rand);
      for (let i = 0; i < groupSize && mobs.length < target; i++) {
        if ((counts[anchor.type] || 0) >= mobSpawnConfig[anchor.type].maxCount) break;
        const tile = nearbyInitialFaunaTile(world, anchor, colonists, occupied, rand, biomeId);
        if (!tile) continue;
        occupied.add(`${tile.x},${tile.y}`);
        counts[anchor.type] = (counts[anchor.type] || 0) + 1;
        mobs.push(createInitialMob(anchor.type, tile, mobs.length, world.seed || config.seed));
      }
    }
  }

  let attempts = 0;
  while (mobs.length < target && attempts++ < target * 80) {
    const availableTypes = passiveTypes.filter(type => (counts[type] || 0) < mobSpawnConfig[type].maxCount);
    if (!availableTypes.length) break;
    const anchor = initialFaunaAnchor(world, availableTypes, config, colonists, occupied, rand);
    if (!anchor) continue;
    const groupSize = initialGroupSize(anchor.type, rand);
    for (let i = 0; i < groupSize && mobs.length < target; i++) {
      if ((counts[anchor.type] || 0) >= mobSpawnConfig[anchor.type].maxCount) break;
      const tile = nearbyInitialFaunaTile(world, anchor, colonists, occupied, rand);
      if (!tile) continue;
      occupied.add(`${tile.x},${tile.y}`);
      counts[anchor.type] = (counts[anchor.type] || 0) + 1;
      mobs.push(createInitialMob(anchor.type, tile, mobs.length, world.seed || config.seed));
    }
  }
  return mobs;
}

function initialBiomeMobQuotas(world, target) {
  const counts = {};
  for (const row of world.biomes || []) for (const biome of row || []) counts[biome] = (counts[biome] || 0) + 1;
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0) || 1;
  const quotas = {};
  let assigned = 0;
  for (const [biome, count] of Object.entries(counts)) {
    if (count / total < 0.08) continue;
    const quota = Math.max(2, Math.floor(target * count / total));
    quotas[biome] = quota;
    assigned += quota;
  }
  if (assigned < target && !quotas.forest) quotas.forest = target - assigned;
  return quotas;
}

function initialFaunaAnchor(world, types, config, colonists, occupied, rand, biomeFilter = null) {
  let best = null;
  let bestScore = 0;
  for (let i = 0; i < 120; i++) {
    const tile = {
      x: 3 + Math.floor(rand() * Math.max(1, world.cols - 6)),
      y: 3 + Math.floor(rand() * Math.max(1, world.rows - 6))
    };
    if (biomeFilter && world.biomes?.[tile.y]?.[tile.x] !== biomeFilter) continue;
    if (!isInitialFaunaTileOpen(world, tile, colonists, occupied)) continue;
    const type = pickInitialFaunaType(world, tile, types, config, rand);
    if (!type) continue;
    const score = initialFaunaTileScore(type, tile, world, config, colonists);
    if (score > bestScore) { bestScore = score; best = { ...tile, type }; }
    if (score > 1.3 && rand() < 0.45) return { ...tile, type };
  }
  return best;
}

function pickInitialFaunaType(world, tile, types, config, rand) {
  const biomeId = world.biomes?.[tile.y]?.[tile.x] || 'forest';
  const weighted = [];
  for (const type of types) {
    const weight = window.BiomeRegistry?.spawnWeightFor?.(type, biomeId, { hour: 8, difficulty: config.difficulty, eventIntensity: config.eventIntensity }) ?? 1;
    const terrain = mobHabitatWeights[type]?.[world.terrain?.[tile.y]?.[tile.x]] ?? 0;
    if (weight > 0 && terrain > 0) weighted.push([type, weight * terrain]);
  }
  const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return null;
  let roll = rand() * total;
  for (const [type, weight] of weighted) {
    roll -= weight;
    if (roll <= 0) return type;
  }
  return weighted[0]?.[0] || null;
}

function initialFaunaTileScore(type, tile, world, config, colonists) {
  const terrain = world.terrain?.[tile.y]?.[tile.x];
  const terrainWeight = mobHabitatWeights[type]?.[terrain] || 0;
  const biomeId = world.biomes?.[tile.y]?.[tile.x] || 'forest';
  const biomeWeight = window.BiomeRegistry?.spawnWeightFor?.(type, biomeId, { hour: 8, difficulty: config.difficulty, eventIntensity: config.eventIntensity }) ?? 1;
  const dist = distanceToColonists(tile.x, tile.y, colonists);
  const distanceWeight = dist < 9 ? 0 : Math.min(1.3, dist / 20);
  return terrainWeight * biomeWeight * distanceWeight;
}

function nearbyInitialFaunaTile(world, anchor, colonists, occupied, rand, biomeFilter = null) {
  for (let i = 0; i < 48; i++) {
    const radius = herdMobTypes.has(anchor.type) ? 1 + Math.floor(rand() * 4) : Math.floor(rand() * 3);
    const angle = rand() * Math.PI * 2;
    const tile = {
      x: Math.round(anchor.x + Math.cos(angle) * radius),
      y: Math.round(anchor.y + Math.sin(angle) * radius)
    };
    if (biomeFilter && world.biomes?.[tile.y]?.[tile.x] !== biomeFilter) continue;
    if (!isInitialFaunaTileOpen(world, tile, colonists, occupied)) continue;
    if ((mobHabitatWeights[anchor.type]?.[world.terrain?.[tile.y]?.[tile.x]] || 0) <= 0) continue;
    return tile;
  }
  return null;
}

function isInitialFaunaTileOpen(world, tile, colonists, occupied) {
  if (!tile || tile.x < 1 || tile.y < 1 || tile.x >= world.cols - 1 || tile.y >= world.rows - 1) return false;
  if (world.terrain?.[tile.y]?.[tile.x] === 'stone') return false;
  if (occupied.has(`${tile.x},${tile.y}`)) return false;
  if (distanceToColonists(tile.x, tile.y, colonists) < 7) return false;
  return true;
}

function distanceToColonists(x, y, colonists = []) {
  let best = Infinity;
  for (const c of colonists || []) best = Math.min(best, Math.hypot(x - c.x, y - c.y));
  return best;
}

function initialGroupSize(type, rand) {
  if (type === 'cow') return 1 + Math.floor(rand() * 2);
  if (type === 'deer' || type === 'goat' || type === 'sheep') return 2 + Math.floor(rand() * 3);
  if (type === 'chicken' || type === 'duck' || type === 'turkey') return 2 + Math.floor(rand() * 4);
  if (type === 'squirrel' || type === 'rabbit') return 1 + Math.floor(rand() * 3);
  return 1 + Math.floor(rand() * 2);
}

function createInitialMob(type, tile, index, seed) {
  const stats = mobStatModifiers[type] || mobStatModifiers.rabbit;
  return {
    id: `mob_${type}_${index}_${hashSeed(`${seed}|${type}|${tile.x}|${tile.y}|${index}`).toString(36)}`,
    type,
    x: tile.x,
    y: tile.y,
    px: tile.x * TILE + TILE / 2,
    py: tile.y * TILE + TILE / 2,
    dir: worldNoise(seed, tile.x, tile.y, 'mob-dir') > 0.5 ? 'right' : 'left',
    anim: 0,
    attackAnimTimer: 0,
    hitAnimTimer: 0,
    hp: stats.hp,
    maxHp: stats.hp,
    state: 'wander',
    target: null
  };
}

window.generateInitialMobs = generateInitialMobs;

function installMobRuntimeHooks() {
  if (window.HavenfallContext?.mobRuntimeHooksInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  if (typeof spawnWolf === 'function') {
    spawnWolf = function spawnWolfSafe() {
      if (!state || !Array.isArray(state.wolves) || !canSpawnMob('wolf')) return null;
      const tile = mobSpawnTile('wolf');
      if (!tile) return null;
      const wolf = { id: uid(), x: tile.x, y: tile.y, px: tile.x * TILE + TILE / 2, py: tile.y * TILE + TILE / 2, anim: 0, dir: 'left', hp: mobStatModifiers.wolf.hp, maxHp: mobStatModifiers.wolf.hp, morale: 100, aggression: 1 + Math.random() * 0.25, state: 'hunting', attackAnimTimer: 0, hitAnimTimer: 0 };
      state.wolves.push(wolf);
      enforceWolfCap();
      return wolf;
    };
    window.spawnWolf = spawnWolf;
  }
  window.GameSystems?.registerMovementModifier('mobs.slow', (c, multiplier) => multiplier * (c?.slowTimer > 0 ? 0.62 : 1), { order: 20 });
  window.GameSystems?.registerTaskHandler('huntMob', 'mobs.hunt', handleHuntMobTask, { order: 20 });
  window.GameSystems?.registerTaskHandler('rescueAlly', 'mobs.rescue', handleRescueAllyTask, { order: 20 });
  window.GameSystems?.registerAutoTaskProvider('mobs.medicalRescue', c => {
    if (!c || c.isUnconscious) return false;
    const patient = nearestUnconsciousColonist(c);
    return !!(patient && assignRescueAlly(c, patient));
  }, { order: 20 });
  window.GameSystems?.registerColonistUpdateGuard('mobs.unconscious', (c, dt) => {
    if (!c?.isUnconscious) return false;
    c.task = null; c.path = []; c.work = 0;
    c.note = c.note || 'Inconsciente - aguardando resgate';
    c.x = Math.round((c.px - TILE / 2) / TILE);
    c.y = Math.round((c.py - TILE / 2) / TILE);
    decayImpactTimers(c, dt * (state?.speed || 1));
    return true;
  }, { order: 20 });
  window.GameSystems?.registerAfterColonistUpdate('mobs.downing', c => {
    if ((c?.health || 0) <= 1) makeColonistUnconscious(c, 'Ferimento grave');
  }, { order: 20 });
  if (typeof updateWolves === 'function') {
    const nativeUpdateWolves = updateWolves;
    updateWolves = function updateWolvesWithImpactFeedback(dt) {
      const before = new Map((state?.colonists || []).map(c => [c.id, c.health]));
      nativeUpdateWolves(dt);
      const tick = dt * (state?.speed || 1);
      for (const wolf of state?.wolves || []) decayImpactTimers(wolf, tick);
      for (const c of state?.colonists || []) {
        const previousHealth = before.get(c.id);
        if (previousHealth !== undefined && (c.health || 0) < previousHealth) {
          emitBloodParticles(c.px, c.py, 3);
          c.hitAnimTimer = ATTACK_ANIM_DURATION;
          if ((c.health || 0) <= 1) makeColonistUnconscious(c, 'Ataque recebido');
        }
      }
    };
  }
  window.GameSystems?.registerDrawOverlay('mobs.bloodParticles', drawBloodParticlesOverlay, { order: 80 });
  if (typeof drawColonist === 'function') {
    const nativeDrawColonist = drawColonist;
    drawColonist = function drawColonistWithDownedState(c) {
      if (c?.isUnconscious) return drawUnconsciousColonist(c);
      const off = combatRenderOffset(c);
      if (!off.x && !off.y) return nativeDrawColonist(c);
      ctx.save(); ctx.translate(off.x, off.y); nativeDrawColonist(c); ctx.restore();
    };
  }
  if (typeof drawWolf === 'function') {
    const nativeDrawWolf = drawWolf;
    drawWolf = function drawWolfWithImpact(wolf) {
      const off = combatRenderOffset(wolf);
      if (!off.x && !off.y) return nativeDrawWolf(wolf);
      ctx.save(); ctx.translate(off.x, off.y); nativeDrawWolf(wolf); ctx.restore();
    };
  }
  window.HavenfallContext.mobRuntimeHooksInstalled = true;
}

function enforceWolfCap() {
  if (!state?.wolves) return;
  const cap = mobSpawnConfig.wolf.maxCount;
  while (state.wolves.length > cap) state.wolves.shift();
}

function updateMobsTick(dt) {
  installMobRuntimeHooks();
  if (!state || appScreen !== SCREEN.PLAYING) return;
  const tick = dt * state.speed;
  const mobs = ensureMobState();
  enforceWolfCap();
  updateSlowTimers(tick);
  maybeSpawnMobs(dt);
  for (let i = mobs.length - 1; i >= 0; i--) {
    const mob = mobs[i];
    decayImpactTimers(mob, tick);
    if (isPassiveMobType(mob.type)) updatePassiveMob(mob, tick);
    else if (mob.type === 'spider') updateSpider(mob, tick);
    if ((mob.hp ?? 1) <= 0) finishMobDeath(mob, i);
  }
  updateWolfPackLogic(tick);
  resolveMobOverlap();
  updateBloodParticles(tick);
}

function updateSlowTimers(tick) {
  for (const c of state.colonists || []) {
    decayImpactTimers(c, tick);
    if (c.slowTimer > 0) {
      c.slowTimer = Math.max(0, c.slowTimer - tick);
      if (c.slowTimer <= 0 && Array.isArray(c.statuses)) c.statuses = c.statuses.filter(s => s !== 'lento');
    }
  }
}

function maybeSpawnMobs(dt) {
  for (const [type, cfg] of Object.entries(mobSpawnConfig)) {
    if (type === 'wolf') continue;
    if (!canSpawnMob(type)) continue;
    if (Math.random() < cfg.spawnChance * dt * state.speed) spawnMob(type);
  }
}

function isPassiveMobType(type) {
  return !!mobSpawnConfig[type] && mobSpawnConfig[type].hostile === false;
}

function updatePassiveMob(mob, tick) {
  mob.anim += tick;
  const fleeRadius = skittishMobTypes.has(mob.type) ? 4 : 2;
  const threat = nearestColonistToMob(mob, fleeRadius);
  if (threat && threat.task?.type !== 'huntMob') {
    mob.state = 'flee';
    moveMobVector(mob, mob.px - threat.px, mob.py - threat.py, passiveFleeSpeed(mob) * tick);
    return;
  }
  mob.state = 'wander';
  if (!mob.target || Math.random() < 0.006 * state.speed) mob.target = nearbyFreeTarget(mob, passiveWanderRadius(mob));
  moveMobToTarget(mob, passiveMobSpeeds[mob.type] * tick || 22 * tick);
}

function passiveFleeSpeed(mob) {
  return Math.max(36, (passiveMobSpeeds[mob.type] || 22) * 2.4);
}

function passiveWanderRadius(mob) {
  if (mob.type === 'cow' || mob.type === 'turtle') return 3;
  if (mob.type === 'deer' || mob.type === 'squirrel') return 7;
  return 5;
}

function updateSpider(mob, tick) {
  mob.anim += tick;
  const night = state.hour < 6 || state.hour > 20;
  if (!night) { mob.state = 'sleep'; return; }
  const target = nearestColonistToMob(mob, 8);
  if (target && !target.isUnconscious) {
    mob.state = 'hunt';
    moveMobVector(mob, target.px - mob.px, target.py - mob.py, 44 * tick);
    const d = Math.hypot(target.px - mob.px, target.py - mob.py);
    if (d < 34) applySpiderSlow(target, tick, mob);
    return;
  }
  mob.state = 'wander';
  if (!mob.target || Math.random() < 0.008 * state.speed) mob.target = nearbyFreeTarget(mob, 6);
  moveMobToTarget(mob, 24 * tick);
}

function updateWolfPackLogic() {
  for (const wolf of state.wolves || []) {
    const allies = (state.wolves || []).filter(other => other.id !== wolf.id && dist(wolf.x, wolf.y, other.x, other.y) <= 3).length;
    wolf.packAllies = allies;
    wolf.aggression = clamp(0.75 + allies * 0.35, 0.65, 1.7);
    const rabbit = nearestMobOfType(wolf, 'rabbit', 5);
    if (rabbit && Math.random() < 0.015 * state.speed) wolf.target = { x: rabbit.x, y: rabbit.y };
  }
}

function applySpiderSlow(c, tick, spider = null) {
  c.slowTimer = Math.max(c.slowTimer || 0, 7);
  c.statuses = Array.isArray(c.statuses) ? c.statuses : [];
  if (!c.statuses.includes('lento')) c.statuses.push('lento');
  const previousHealth = c.health;
  c.health = clamp(c.health - tick * 0.22, 1, 100);
  c.note = 'Lento por picada de aranha';
  if (c.health < previousHealth && spider) {
    spider.attackAnimTimer = ATTACK_ANIM_DURATION;
    c.hitAnimTimer = ATTACK_ANIM_DURATION;
    emitBloodParticles(c.px, c.py, 2);
  }
  if (c.health <= 1) makeColonistUnconscious(c, 'Picada grave');
}

function getMobAt(x, y) { return ensureMobState().find(m => Math.round(m.x) === x && Math.round(m.y) === y) || null; }

function assignHuntMob(c, mob) {
  if (!c || !mob || c.isUnconscious) return false;
  const adj = nearestFreeAdjacent(mob.x, mob.y, c.x, c.y) || { x: mob.x, y: mob.y };
  c.task = { type: 'huntMob', mobId: mob.id, x: adj.x, y: adj.y };
  c.path = findPath(c.x, c.y, adj.x, adj.y);
  c.work = 0;
  c.note = `Caçando ${mobName(mob.type)}`;
  return true;
}

function handleHuntMobTask(c, task, tick) {
  const mob = ensureMobState().find(m => m.id === task.mobId);
  if (!mob) { c.task = null; c.note = 'Ocioso'; c.work = 0; return; }
  const close = dist(c.x, c.y, mob.x, mob.y) <= 1;
  if (!close) {
    const adj = nearestFreeAdjacent(mob.x, mob.y, c.x, c.y) || { x: mob.x, y: mob.y };
    c.task.x = adj.x; c.task.y = adj.y; c.path = findPath(c.x, c.y, adj.x, adj.y);
    return;
  }
  ensureEquipment(c);
  const hasKnife = c.equipment?.weapon === 'knife' || c.equipment?.tool === 'knife';
  const weapon = itemDefs[c.equipment?.weapon] || itemDefs[c.equipment?.tool];
  const stats = mobStatModifiers[mob.type] || mobStatModifiers.wolf;
  const speed = stats.huntWork || 3.8;
  c.work += tick * workRate(c, 'defense');
  c.note = `Caçando ${mobName(mob.type)} ${Math.floor((c.work / speed) * 100)}%`;
  if (c.work < speed) return;
  const damage = (weapon?.combat || 1.0) * (hasKnife ? 18 : 12) * (stats.damageTaken || 1);
  mob.hp = clamp((mob.hp || 1) - damage, 0, Math.max(100, mob.maxHp || 100));
  c.work = 0;
  applyAttackImpact(c, mob, 12);
  emitBloodParticles(mob.px, mob.py, mob.type === 'rabbit' ? 3 : 7);
  if (mob.hp <= 0) {
    const idx = state.mobs.findIndex(m => m.id === mob.id);
    if (idx >= 0) finishMobDeath(mob, idx, c);
    c.task = null; c.note = 'Caça concluída'; c.mood = clamp(c.mood + (mob.type === 'rabbit' ? 2 : 4), 0, 100);
  }
}

function nearestColonistToMob(mob, radius) {
  let best = null;
  let bestDist = Infinity;
  for (const c of state.colonists || []) {
    if (c.isUnconscious) continue;
    const d = dist(mob.x, mob.y, c.x, c.y);
    if (d < bestDist && d <= radius) { best = c; bestDist = d; }
  }
  return best;
}

function nearestMobOfType(origin, type, radius) {
  let best = null;
  let bestDist = Infinity;
  for (const mob of state.mobs || []) {
    if (mob.type !== type) continue;
    const d = dist(origin.x, origin.y, mob.x, mob.y);
    if (d < bestDist && d <= radius) { best = mob; bestDist = d; }
  }
  return best;
}

function nearbyFreeTarget(mob, radius) {
  for (let i = 0; i < 20; i++) {
    const x = clamp(Math.round(mob.x + (Math.random() - 0.5) * radius * 2), 1, getWorldCols() - 2);
    const y = clamp(Math.round(mob.y + (Math.random() - 0.5) * radius * 2), 1, getWorldRows() - 2);
    if (!isBlocked(x, y) && !hasMobileEntityAtTile(x, y)) return { x, y };
  }
  return null;
}

function moveMobToTarget(mob, step) {
  if (!mob.target) return;
  const tx = mob.target.x * TILE + TILE / 2;
  const ty = mob.target.y * TILE + TILE / 2;
  if (Math.hypot(tx - mob.px, ty - mob.py) < 5) { mob.target = null; return; }
  moveMobVector(mob, tx - mob.px, ty - mob.py, step);
}

function moveMobVector(mob, dx, dy, step) {
  const len = Math.hypot(dx, dy) || 1;
  const nextPx = mob.px + dx / len * step;
  const nextPy = mob.py + dy / len * step;
  const nextX = Math.round((nextPx - TILE / 2) / TILE);
  const nextY = Math.round((nextPy - TILE / 2) / TILE);
  mob.dir = dx > 0 ? 'right' : 'left';
  if (isBlocked(nextX, nextY)) { mob.target = null; return; }
  mob.px = nextPx; mob.py = nextPy; mob.x = nextX; mob.y = nextY;
}

function resolveMobOverlap() {
  const list = allMobileEntities();
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]; const b = list[j];
      let dx = (a.px || 0) - (b.px || 0);
      let dy = (a.py || 0) - (b.py || 0);
      let len = Math.hypot(dx, dy);
      if (len >= MOB_SEPARATION_DISTANCE_PX) continue;
      if (len < 0.001) { const angle = ((i + 1) * 1.917 + (j + 1) * 0.731) % (Math.PI * 2); dx = Math.cos(angle); dy = Math.sin(angle); len = 1; }
      const push = (MOB_SEPARATION_DISTANCE_PX - len) * 0.5;
      pushMobileEntity(a, dx, dy, push);
      pushMobileEntity(b, -dx, -dy, push);
    }
  }
}

function pushMobileEntity(entity, dx, dy, push) {
  const len = Math.hypot(dx, dy) || 1;
  const worldW = getWorldWidth();
  const worldH = getWorldHeight();
  entity.px = clamp((entity.px || entity.x * TILE + TILE / 2) + dx / len * push, TILE / 2, worldW - TILE / 2);
  entity.py = clamp((entity.py || entity.y * TILE + TILE / 2) + dy / len * push, TILE / 2, worldH - TILE / 2);
  entity.x = Math.round((entity.px - TILE / 2) / TILE);
  entity.y = Math.round((entity.py - TILE / 2) / TILE);
}

function applyAttackImpact(attacker, target, amount = 12) {
  if (!attacker || !target) return;
  const dx = (target.px || target.x * TILE) - (attacker.px || attacker.x * TILE);
  const dy = (target.py || target.y * TILE) - (attacker.py || attacker.y * TILE);
  const len = Math.hypot(dx, dy) || 1;
  attacker.attackAnimTimer = ATTACK_ANIM_DURATION; attacker.attackOffsetX = dx / len * amount; attacker.attackOffsetY = dy / len * amount;
  target.hitAnimTimer = ATTACK_ANIM_DURATION; target.hitOffsetX = -dx / len * amount * 0.45; target.hitOffsetY = -dy / len * amount * 0.45;
}

function decayImpactTimers(entity, tick) {
  if (!entity) return;
  if (entity.attackAnimTimer > 0) entity.attackAnimTimer = Math.max(0, entity.attackAnimTimer - tick);
  if (entity.hitAnimTimer > 0) entity.hitAnimTimer = Math.max(0, entity.hitAnimTimer - tick);
}

function combatRenderOffset(entity) {
  const attackT = Math.max(0, entity?.attackAnimTimer || 0) / ATTACK_ANIM_DURATION;
  const hitT = Math.max(0, entity?.hitAnimTimer || 0) / ATTACK_ANIM_DURATION;
  return { x: (entity?.attackOffsetX || 0) * attackT + (entity?.hitOffsetX || 0) * hitT, y: (entity?.attackOffsetY || 0) * attackT + (entity?.hitOffsetY || 0) * hitT };
}

function emitBloodParticles(x, y, amount = 6) {
  const now = performance.now() / 1000;
  window.bloodParticles = Array.isArray(window.bloodParticles) ? window.bloodParticles : [];
  for (let i = 0; i < amount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 18 + Math.random() * 48;
    window.bloodParticles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, bornAt: now, age: 0, life: 0.42 + Math.random() * 0.28, size: 1.4 + Math.random() * 2.2 });
  }
  if (window.bloodParticles.length > 120) window.bloodParticles.splice(0, window.bloodParticles.length - 120);
}

function updateBloodParticles(tick) {
  const list = window.bloodParticles || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.age += tick;
    p.x += p.vx * tick;
    p.y += p.vy * tick;
    p.vx *= 0.88;
    p.vy = p.vy * 0.88 + 35 * tick;
    if (p.age >= p.life) list.splice(i, 1);
  }
}

function drawBloodParticlesOverlay() {
  const list = window.bloodParticles || [];
  if (!list.length || appScreen !== SCREEN.PLAYING) return;
  ctx.save(); ctx.translate(viewTransform.offsetX, viewTransform.offsetY); ctx.scale(viewTransform.scale, viewTransform.scale);
  for (const p of list) {
    const alpha = Math.max(0, 1 - p.age / p.life);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore(); ctx.globalAlpha = 1;
}

function makeColonistUnconscious(c, reason = 'Ferimento grave') {
  if (!c || c.isUnconscious) return;
  c.isUnconscious = true;
  c.health = Math.max(1, c.health || 1);
  c.energy = Math.min(c.energy || 0, 4);
  c.task = null; c.path = []; c.work = 0;
  c.note = `${reason} — aguardando resgate`;
  c.statuses = Array.isArray(c.statuses) ? c.statuses : [];
  if (!c.statuses.includes('inconsciente')) c.statuses.push('inconsciente');
  log(`${c.name} caiu inconsciente e precisa de resgate.`);
}

function nearestUnconsciousColonist(rescuer) {
  const colonists = state?.colonists || [];
  return colonists
    .filter(c => c.id !== rescuer.id && c.isUnconscious)
    .filter(c => !colonists.some(other => other.task?.type === 'rescueAlly' && other.task.patientId === c.id))
    .sort((a, b) => dist(rescuer.x, rescuer.y, a.x, a.y) - dist(rescuer.x, rescuer.y, b.x, b.y))[0] || null;
}

function nearestMedicalDestination(c) {
  return (state?.objects || [])
    .filter(o => o.type === 'med_station' || o.type === 'bed')
    .sort((a, b) => {
      const rank = (a.type === 'med_station' ? 0 : 1) - (b.type === 'med_station' ? 0 : 1);
      if (rank) return rank;
      return dist(c.x, c.y, a.x, a.y) - dist(c.x, c.y, b.x, b.y);
    })[0] || null;
}

function assignRescueAlly(c, patient) {
  const destination = nearestMedicalDestination(patient);
  if (!destination) return false;
  const adj = nearestFreeAdjacent(destination.x, destination.y, c.x, c.y) || { x: destination.x, y: destination.y };
  c.task = { type: 'rescueAlly', patientId: patient.id, stationId: destination.id, x: adj.x, y: adj.y };
  c.path = findPath(c.x, c.y, adj.x, adj.y, destination);
  c.work = 0;
  c.note = `Resgatando ${patient.name}`;
  return true;
}

function handleRescueAllyTask(c, task, tick) {
  const patient = state?.colonists?.find(item => item.id === task.patientId);
  const destination = state?.objects?.find(obj => obj.id === task.stationId);
  if (!patient || !patient.isUnconscious || !destination) { c.task = null; c.note = 'Ocioso'; c.work = 0; return; }
  c.work += tick * 1.15;
  c.note = `Carregando ${patient.name} ${Math.floor((c.work / 2.2) * 100)}%`;
  if (c.work < 2.2) return;
  patient.x = task.x; patient.y = task.y; patient.px = task.x * TILE + TILE / 2; patient.py = task.y * TILE + TILE / 2;
  patient.isUnconscious = false;
  patient.statuses = (patient.statuses || []).filter(s => s !== 'inconsciente');
  if (destination.type === 'med_station' && state.resources.medicine > 0) {
    const spent = typeof consumeCost === 'function'
      ? consumeCost({ medicine: 1 }, { reason: 'rescue-heal', actorId: c.id, targetId: patient.id, x: destination.x, y: destination.y })
      : window.GameState?.consumeResources?.({ medicine: 1 }, { reason: 'rescue-heal', actorId: c.id, targetId: patient.id, x: destination.x, y: destination.y });
    if (spent) {
      patient.health = Math.max(patient.health, 32);
      patient.energy = Math.max(patient.energy, 16);
      patient.note = 'Recebendo tratamento';
      log(`${c.name} levou ${patient.name} até a estação médica e usou 1 remédio.`);
    } else {
      patient.health = Math.max(patient.health, 18);
      patient.energy = Math.max(patient.energy, 12);
      patient.note = 'Resgatado, recuperando';
      log(`${c.name} levou ${patient.name} até a estação médica, mas não havia remédio disponível.`);
    }
  } else {
    patient.health = Math.max(patient.health, 18);
    patient.energy = Math.max(patient.energy, 12);
    patient.note = destination.type === 'bed' ? 'Deitado na cama, recuperando' : 'Resgatado, recuperando';
    log(`${c.name} levou ${patient.name} para um local seguro.`);
  }
  c.task = null; c.note = 'Resgate concluído'; c.work = 0;
}

function drawUnconsciousColonist(c) {
  const img = images[`${c.sprite || 'colonistA'}_${c.dir || 'down'}_0`] || images[`${c.sprite || 'colonistA'}_down_0`];
  ctx.save();
  ctx.fillStyle = 'rgba(231, 189, 88, .22)'; ctx.strokeStyle = '#e7bd58'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(c.px, c.py + 19, 22, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.translate(c.px, c.py + 24); ctx.rotate(Math.PI / 2);
  if (img?.width && img?.height) { const scale = 0.48; const w = img.width * scale; const h = img.height * scale; ctx.drawImage(img, -w / 2, -h, w, h); }
  else { ctx.fillStyle = '#d8c59b'; ctx.fillRect(-16, -30, 32, 44); }
  ctx.restore();
  drawTinyBars?.(c);
  drawName?.(`${c.name} · inconsciente`, c.px, c.py - 38);
}

function finishMobDeath(mob, index, hunter = null) {
  const drops = mobDrop(mob, hunter);
  if (typeof addItems === 'function') addItems(drops.items || {});
  if (typeof addResources === 'function') addResources(drops.resources || {});
  if (index >= 0) state.mobs.splice(index, 1);
  log(`${mobName(mob.type)} abatido. Recursos adicionados ao estoque.`);
}

function mobDrop(mob, hunter = null) {
  const hunterHasKnife = hunter ? (hunter.equipment?.weapon === 'knife' || hunter.equipment?.tool === 'knife') : state.colonists?.some(c => c.equipment?.weapon === 'knife' || c.equipment?.tool === 'knife');
  const bonus = hunterHasKnife ? 1.5 : 1;
  if (mob.type === 'rabbit') return { items: { rawMeat: Math.ceil(2 * bonus), leather: Math.ceil(1 * bonus) } };
  if (mob.type === 'deer') return { items: { rawMeat: Math.ceil(5 * bonus), leather: Math.ceil(2 * bonus), bones: 1 } };
  if (mob.type === 'goat') return { items: { rawMeat: Math.ceil(3 * bonus), leather: Math.ceil(1 * bonus) } };
  if (mob.type === 'sheep') return { items: { rawMeat: Math.ceil(3 * bonus), leather: Math.ceil(1 * bonus), cloth: 1 } };
  if (mob.type === 'pig') return { items: { rawMeat: Math.ceil(4 * bonus), leather: Math.ceil(1 * bonus) } };
  if (mob.type === 'cow') return { items: { rawMeat: Math.ceil(8 * bonus), leather: Math.ceil(3 * bonus), bones: 2 } };
  if (mob.type === 'chicken') return { items: { rawMeat: Math.ceil(1 * bonus), feathers: 1 } };
  if (mob.type === 'duck') return { items: { rawMeat: Math.ceil(2 * bonus), feathers: 1 } };
  if (mob.type === 'turkey') return { items: { rawMeat: Math.ceil(3 * bonus), feathers: 2 } };
  if (mob.type === 'squirrel') return { items: { rawMeat: Math.ceil(1 * bonus) } };
  if (mob.type === 'turtle') return { items: { rawMeat: Math.ceil(2 * bonus), bones: 1 } };
  if (mob.type === 'spider') return { items: { rope: 1, venom: 1 } };
  if (mob.type === 'wolf') return { items: { rawMeat: Math.ceil(4 * bonus), leather: Math.ceil(2 * bonus), bones: 1 } };
  return { items: {} };
}

function mobName(type) {
  return ({
    rabbit: 'Coelho',
    deer: 'Cervo',
    goat: 'Cabra',
    sheep: 'Ovelha',
    pig: 'Porco',
    cow: 'Vaca',
    chicken: 'Galinha',
    duck: 'Pato',
    turkey: 'Peru',
    squirrel: 'Esquilo',
    turtle: 'Tartaruga',
    spider: 'Aranha',
    wolf: 'Lobo',
    blood_wolf: 'Lobo de Sangue'
  })[type] || type;
}

function installMobRendererHook() {
  if (window.HavenfallContext?.mobRendererHooked) return;
  window.GameSystems?.registerDrawOverlay('mobs.entities', drawMobsOverlay, { order: 70 });
  window.HavenfallContext.mobRendererHooked = true;
}

function drawMobsOverlay() {
  if (!state?.mobs?.length || appScreen !== SCREEN.PLAYING) return;
  ctx.save(); ctx.translate(viewTransform.offsetX, viewTransform.offsetY); ctx.scale(viewTransform.scale, viewTransform.scale);
  for (const mob of state.mobs) drawMob(mob);
  ctx.restore();
}

function drawMob(mob) {
  const offset = combatRenderOffset(mob);
  const x = mob.px + offset.x;
  const y = mob.py + offset.y;
  if (window.HavenfallPawnRenderer?.drawMob?.({ ...mob, px: x, py: y })) return;
  ctx.save();
  if (mob.type === 'rabbit') {
    ctx.fillStyle = '#d8d0bd'; ctx.beginPath(); ctx.ellipse(x, y + 12, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eee7d9'; ctx.beginPath(); ctx.ellipse(x + 8, y + 4, 5, 9, 0, 0, Math.PI * 2); ctx.fill();
  } else if (mob.type === 'spider') {
    ctx.fillStyle = '#3b303e'; ctx.beginPath(); ctx.ellipse(x, y + 10, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3b303e';
    for (let i = -3; i <= 3; i += 2) {
      ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.lineTo(x + i * 7, y + 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.lineTo(x + i * 7, y + 19); ctx.stroke();
    }
  }
  ctx.restore();
  if (mob.hp !== undefined && mob.maxHp) drawProgress?.(x, y - 21, (mob.hp || 0) / mob.maxHp, mob.type === 'rabbit' ? '#d8d0bd' : '#e67866');
}

window.canSpawnMob = canSpawnMob;
window.spawnMob = spawnMob;
window.updateMobsTick = updateMobsTick;
window.mobDrop = mobDrop;
window.getWolfAt = getWolfAt;
window.getMobAt = getMobAt;
window.getAnimalAt = getPassiveMobAt;
window.getHostileAt = getHostileMobAt;
window.HavenfallEntityQuery = Object.freeze({
  getWolfAt,
  getMobAt,
  getAnimalAt: getPassiveMobAt,
  getHostileAt: getHostileMobAt,
  getCreatureAt
});
window.assignHuntMob = assignHuntMob;
window.makeColonistUnconscious = makeColonistUnconscious;

installMobRuntimeHooks();
installMobRendererHook();
window.GameSystems?.registerTick('mobs', updateMobsTick, { order: 80 });
