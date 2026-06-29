'use strict';

(() => {
  if (window.HavenfallContext?.livingWorldInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};

  const VERSION = 'living-world-v1';
  const waterSetCache = { key: '', set: new Set() };
  let nativeGenerateWorldFromSeed = null;
  let nativeUpdatePassiveMob = null;
  let mapOverlay = null;
  let mapCanvas = null;

  const animalProfiles = Object.freeze({
    rabbit: { label: 'Coelho', baseSpeed: 30, burstSpeed: 82, alertRadius: 5, wanderRadius: 4, pauseChance: 0.018, waterAffinity: 0.25, coverAffinity: 0.55, groupAffinity: 0.15, activity: 'crepuscular' },
    deer: { label: 'Cervo', baseSpeed: 42, burstSpeed: 104, alertRadius: 8, wanderRadius: 8, pauseChance: 0.012, waterAffinity: 0.35, coverAffinity: 0.30, groupAffinity: 0.75, activity: 'diurnal' },
    goat: { label: 'Cabra', baseSpeed: 31, burstSpeed: 64, alertRadius: 4, wanderRadius: 6, pauseChance: 0.014, waterAffinity: 0.22, coverAffinity: 0.10, groupAffinity: 0.70, activity: 'diurnal' },
    sheep: { label: 'Ovelha', baseSpeed: 25, burstSpeed: 54, alertRadius: 4, wanderRadius: 5, pauseChance: 0.020, waterAffinity: 0.25, coverAffinity: 0.16, groupAffinity: 0.86, activity: 'diurnal' },
    pig: { label: 'Porco selvagem', baseSpeed: 28, burstSpeed: 70, alertRadius: 5, wanderRadius: 6, pauseChance: 0.016, waterAffinity: 0.58, coverAffinity: 0.50, groupAffinity: 0.55, activity: 'crepuscular' },
    cow: { label: 'Bovino', baseSpeed: 18, burstSpeed: 42, alertRadius: 3, wanderRadius: 4, pauseChance: 0.026, waterAffinity: 0.34, coverAffinity: 0.08, groupAffinity: 0.80, activity: 'diurnal' },
    chicken: { label: 'Galinha', baseSpeed: 25, burstSpeed: 58, alertRadius: 4, wanderRadius: 3, pauseChance: 0.028, waterAffinity: 0.18, coverAffinity: 0.24, groupAffinity: 0.65, activity: 'diurnal' },
    duck: { label: 'Pato', baseSpeed: 23, burstSpeed: 46, alertRadius: 3, wanderRadius: 5, pauseChance: 0.018, waterAffinity: 1.00, coverAffinity: 0.15, groupAffinity: 0.55, activity: 'diurnal' },
    turkey: { label: 'Peru', baseSpeed: 24, burstSpeed: 52, alertRadius: 4, wanderRadius: 4, pauseChance: 0.020, waterAffinity: 0.18, coverAffinity: 0.28, groupAffinity: 0.62, activity: 'diurnal' },
    squirrel: { label: 'Esquilo', baseSpeed: 42, burstSpeed: 92, alertRadius: 5, wanderRadius: 5, pauseChance: 0.020, waterAffinity: 0.12, coverAffinity: 1.00, groupAffinity: 0.20, activity: 'diurnal' },
    turtle: { label: 'Tartaruga', baseSpeed: 9, burstSpeed: 18, alertRadius: 2, wanderRadius: 3, pauseChance: 0.040, waterAffinity: 1.00, coverAffinity: 0.18, groupAffinity: 0.15, activity: 'diurnal' },
  });

  const waypointTypes = Object.freeze({
    general: { label: 'Geral', color: '#f8d78a' },
    exploration: { label: 'Exploração', color: '#7dd3fc' },
    resource: { label: 'Recurso', color: '#86efac' },
    danger: { label: 'Perigo', color: '#fb7185' },
    water: { label: 'Água', color: '#38bdf8' }
  });
  const seasons = Object.freeze([
    { key: 'spring', label: 'Primavera', growth: 1.32, water: 1.08 },
    { key: 'summer', label: 'Verão', growth: 0.82, water: 0.72 },
    { key: 'autumn', label: 'Outono', growth: 0.96, water: 0.92 },
    { key: 'winter', label: 'Inverno', growth: 0.48, water: 1.0 }
  ]);
  const waterBuildTypes = Object.freeze(new Set(['bridge', 'fish_trap']));
  const waterEdgeBuildTypes = Object.freeze(new Set(['water_collector', 'irrigation_channel']));
  let selectedWaypointId = null;
  let selectedAnimalId = null;

  function installLivingWorldDefinitions() {
    if (window.HavenfallContext?.livingWorldDefinitionsInstalled) return;
    if (typeof objectDefs === 'object') {
      objectDefs.bridge = { ...(objectDefs.bridge || {}), name: 'ponte simples', img: 'bridge', blocks: false, bridge: true };
      objectDefs.fish_trap = { ...(objectDefs.fish_trap || {}), name: 'armadilha de pesca', img: 'fish_trap', blocks: false, fishing: true };
      objectDefs.water_collector = { ...(objectDefs.water_collector || {}), name: 'coletor de água', img: 'water_collector', blocks: true, waterCollector: true };
      objectDefs.irrigation_channel = { ...(objectDefs.irrigation_channel || {}), name: 'canal de irrigação', img: 'irrigation_channel', blocks: false, irrigation: true };
      objectDefs.sapling = { ...(objectDefs.sapling || {}), name: 'muda', img: 'sapling', blocks: false, work: 0.8 };
      objectDefs.invasive_weed = { ...(objectDefs.invasive_weed || {}), name: 'erva invasora', img: 'bush', blocks: false, work: 1.0 };
      objectDefs.environmental_fire = { ...(objectDefs.environmental_fire || {}), name: 'incêndio ambiental', img: 'campfire', blocks: true, hazard: true };
    }
    if (typeof buildDefs === 'object') {
      buildDefs.bridge = { ...(buildDefs.bridge || {}), label: 'Ponte', type: 'bridge', cost: { wood: 8 }, work: 4, placeOnWater: true };
      buildDefs.fish_trap = { ...(buildDefs.fish_trap || {}), label: 'Armadilha de Pesca', type: 'fish_trap', cost: { wood: 6, stone: 2 }, work: 4, placeOnWater: true };
      buildDefs.water_collector = { ...(buildDefs.water_collector || {}), label: 'Coletor de Água', type: 'water_collector', cost: { wood: 8, stone: 4 }, work: 5, needsAdjacentWater: true };
      buildDefs.irrigation_channel = { ...(buildDefs.irrigation_channel || {}), label: 'Canal de Irrigação', type: 'irrigation_channel', cost: { stone: 3 }, work: 3, needsAdjacentWater: true };
    }
    window.HavenfallContext.livingWorldDefinitionsInstalled = true;
  }

  function install() {
    if (window.HavenfallContext.livingWorldInstalled) return;
    window.HavenfallContext.livingWorldInstalled = true;
    installLivingWorldDefinitions();
    wrapWorldGeneration();
    wrapAnimalMovement();
    installMapControls();
    window.GameSystems?.registerTick?.('living-world.ecology', livingWorldTick, { order: 34 });
    window.GameSystems?.registerTileRenderer?.('living-world.water', drawWaterTile, { order: 6 });
    window.GameSystems?.registerObjectRenderer?.('living-world.objects', drawLivingWorldObject, { order: 28 });
    window.GameSystems?.registerWorldOverlay?.('living-world.markers', drawLivingWorldMarkers, { order: 92 });
    window.GameSystems?.registerCollisionProvider?.('living-world.water-collision', waterCollisionAt, { order: 8 });
    window.HavenfallLivingWorld = {
      version: VERSION,
      animalProfiles,
      waypointTypes,
      seasons,
      openMap: openWorldMap,
      closeMap: closeWorldMap,
      ensureState: ensureLivingState,
      seasonForDay,
      isWaterTile,
      createWaypoint,
      generateExplorationQueue,
      inspectAnimal
    };
  }

  function wrapWorldGeneration() {
    if (typeof generateWorldFromSeed !== 'function' || nativeGenerateWorldFromSeed) return;
    nativeGenerateWorldFromSeed = generateWorldFromSeed;
    generateWorldFromSeed = function generateWorldWithLivingSystems(config) {
      const world = nativeGenerateWorldFromSeed(config);
      return enhanceWorldWithWater(world, config);
    };
  }

  function wrapAnimalMovement() {
    if (typeof updatePassiveMob !== 'function' || nativeUpdatePassiveMob) return;
    nativeUpdatePassiveMob = updatePassiveMob;
    updatePassiveMob = function updatePassiveMobWithLivingBehavior(mob, tick) {
      const profile = animalProfiles[mob?.type];
      if (!profile) return nativeUpdatePassiveMob(mob, tick);
      ensureAnimalBrain(mob, profile);
      updateAnimalBrain(mob, profile, tick);
    };
  }

  function ensureAnimalBrain(mob, profile) {
    mob.id = mob.id || uid('mob');
    mob.brain = mob.brain || {
      homeX: mob.x,
      homeY: mob.y,
      stateTimer: 0,
      waterNeed: 0.2 + Math.random() * 0.45,
      restNeed: Math.random() * 0.35,
      routeSeed: Math.random(),
      safeX: mob.x,
      safeY: mob.y,
      route: [],
      trackTimer: 0,
    };
    if (!mob.brain.route.length) mob.brain.route = preferredAnimalRoute(mob, profile);
    if (!mob.target) mob.target = chooseAnimalTarget(mob, profile);
  }

  function updateAnimalBrain(mob, profile, tick) {
    mob.anim = (mob.anim || 0) + tick;
    mob.brain.stateTimer = Math.max(0, (mob.brain.stateTimer || 0) - tick);
    mob.brain.waterNeed = Math.min(1, (mob.brain.waterNeed || 0) + tick * 0.0025 * (profile.waterAffinity || 0.2));
    mob.brain.restNeed = Math.min(1, (mob.brain.restNeed || 0) + tick * 0.0016);

    const alert = nearestAwareColonist(mob, profile.alertRadius);
    if (alert) {
      mob.state = 'alert';
      mob.target = null;
      mob.brain.safeX = mob.x;
      mob.brain.safeY = mob.y;
      moveAnimalVector(mob, mob.px - alert.px, mob.py - alert.py, profile.burstSpeed * tick);
      return;
    }

    if (state?.weather === 'chuva' && profile.coverAffinity > 0.25 && Math.random() < 0.018) {
      const cover = nearestCoverTile(mob.x, mob.y, 8);
      if (cover) {
        mob.state = 'seeking_cover';
        mob.target = { ...cover, kind: 'cover' };
      }
    }

    if (mob.brain.restNeed > 0.82 && Math.random() < profile.pauseChance * 1.7) {
      mob.state = 'rest';
      mob.brain.restNeed = Math.max(0, mob.brain.restNeed - tick * 0.020);
      return;
    }

    if (!mob.target || reachedTarget(mob, mob.target) || mob.brain.stateTimer <= 0 || Math.random() < profile.pauseChance * 0.38) {
      mob.target = chooseAnimalTarget(mob, profile);
      mob.brain.stateTimer = 2.5 + Math.random() * 7;
    }

    const speed = profile.baseSpeed * activityFactor(profile, state?.hour ?? 12) * terrainSpeedFactor(mob.x, mob.y);
    mob.state = animalStateForTarget(mob, profile);
    moveAnimalToward(mob, mob.target, speed * tick);
  }

  function nearestAwareColonist(mob, radius) {
    let best = null;
    let bestDist = Infinity;
    for (const c of state?.colonists || []) {
      if (c?.isUnconscious) continue;
      const d = Math.hypot((c.x || 0) - mob.x, (c.y || 0) - mob.y);
      if (d < bestDist && d <= radius) { best = c; bestDist = d; }
    }
    return best;
  }

  function activityFactor(profile, hour) {
    if (profile.activity === 'crepuscular') return (hour >= 5 && hour <= 8) || (hour >= 17 && hour <= 21) ? 1.18 : 0.78;
    if (profile.activity === 'nocturnal') return hour >= 19 || hour <= 6 ? 1.18 : 0.55;
    return hour >= 6 && hour <= 19 ? 1 : 0.62;
  }

  function terrainSpeedFactor(x, y) {
    const terrain = state?.terrain?.[Math.round(y)]?.[Math.round(x)];
    if (terrain === 'sand') return 0.84;
    if (terrain === 'dirt') return 0.94;
    if (terrain === 'water') return 0.58;
    return 1;
  }

  function chooseAnimalTarget(mob, profile) {
    const waterTarget = profile.waterAffinity > 0.45 && mob.brain?.waterNeed > 0.55 ? nearestWaterTile(mob.x, mob.y, 12) : null;
    if (waterTarget) return { ...waterTarget, kind: 'water' };

    const groupTarget = profile.groupAffinity > 0.5 && Math.random() < profile.groupAffinity ? nearbyGroupCenter(mob, 8) : null;
    if (groupTarget) return groupTarget;

    if (mob.brain?.route?.length && Math.random() < 0.36) {
      mob.brain.routeIndex = ((mob.brain.routeIndex || 0) + 1) % mob.brain.route.length;
      return { ...mob.brain.route[mob.brain.routeIndex], kind: 'route' };
    }

    let best = null;
    let bestScore = -Infinity;
    const radius = profile.wanderRadius || 5;
    for (let i = 0; i < 36; i++) {
      const tile = {
        x: clamp(Math.round(mob.brain.homeX + (Math.random() - 0.5) * radius * 3), 1, getWorldCols() - 2),
        y: clamp(Math.round(mob.brain.homeY + (Math.random() - 0.5) * radius * 3), 1, getWorldRows() - 2),
      };
      if (!animalTileOpen(tile.x, tile.y, profile)) continue;
      const score = animalTileScore(tile.x, tile.y, profile) - Math.hypot(tile.x - mob.x, tile.y - mob.y) * 0.035 + Math.random() * 0.18;
      if (score > bestScore) { bestScore = score; best = tile; }
    }
    return best || { x: mob.brain.homeX, y: mob.brain.homeY };
  }

  function preferredAnimalRoute(mob, profile) {
    const route = [];
    const water = nearestWaterTile(mob.x, mob.y, 14);
    if (water && profile.waterAffinity > 0.25) route.push(water);
    const cover = nearestCoverTile(mob.x, mob.y, 10);
    if (cover && profile.coverAffinity > 0.2) route.push(cover);
    for (let i = 0; i < 3; i++) {
      const tile = {
        x: clamp(Math.round(mob.x + (Math.random() - 0.5) * (profile.wanderRadius || 5) * 3), 1, getWorldCols() - 2),
        y: clamp(Math.round(mob.y + (Math.random() - 0.5) * (profile.wanderRadius || 5) * 3), 1, getWorldRows() - 2)
      };
      if (animalTileOpen(tile.x, tile.y, profile)) route.push(tile);
    }
    return route;
  }

  function animalTileOpen(x, y, profile) {
    if (x < 1 || y < 1 || x >= getWorldCols() - 1 || y >= getWorldRows() - 1) return false;
    const terrain = state?.terrain?.[y]?.[x];
    if (terrain === 'stone') return false;
    if (terrain === 'water' && profile.waterAffinity < 0.85) return false;
    if (typeof getObjectAt === 'function' && getObjectAt(x, y)) return false;
    if (typeof isBlocked === 'function' && terrain !== 'water' && isBlocked(x, y)) return false;
    return true;
  }

  function animalTileScore(x, y, profile) {
    const terrain = state?.terrain?.[y]?.[x];
    let score = terrain === 'grass' ? 1 : terrain === 'dirt' ? 0.72 : terrain === 'sand' ? 0.28 : terrain === 'water' ? profile.waterAffinity : 0.12;
    score += nearbyWaterCount(x, y, 5) * 0.055 * (profile.waterAffinity || 0);
    score += nearbyPlantCount(x, y, 4) * 0.045 * (profile.coverAffinity || 0);
    return score;
  }

  function nearbyGroupCenter(mob, radius) {
    const friends = (state?.mobs || []).filter(other => other !== mob && other.type === mob.type && Math.hypot(other.x - mob.x, other.y - mob.y) <= radius);
    if (!friends.length) return null;
    const avg = friends.reduce((acc, other) => ({ x: acc.x + other.x, y: acc.y + other.y }), { x: mob.x, y: mob.y });
    return { x: Math.round(avg.x / (friends.length + 1)), y: Math.round(avg.y / (friends.length + 1)), kind: 'group' };
  }

  function animalStateForTarget(mob) {
    if (mob.target?.kind === 'water') {
      if (reachedTarget(mob, mob.target, 0.75)) mob.brain.waterNeed = Math.max(0, (mob.brain.waterNeed || 0) - 0.35);
      return 'drinking';
    }
    if (mob.target?.kind === 'group') return 'following';
    if (mob.target?.kind === 'cover') return 'sheltering';
    return Math.random() < 0.35 ? 'grazing' : 'wander';
  }

  function reachedTarget(mob, target, range = 0.55) {
    if (!target) return true;
    return Math.hypot((target.x || 0) - mob.x, (target.y || 0) - mob.y) <= range;
  }

  function moveAnimalToward(mob, target, amount) {
    if (!target) return;
    moveAnimalVector(mob, target.x * TILE + TILE / 2 - mob.px, target.y * TILE + TILE / 2 - mob.py, amount);
  }

  function moveAnimalVector(mob, dx, dy, amount) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    if (typeof moveMobVector === 'function') return moveMobVector(mob, dx, dy, amount);
    const len = Math.hypot(dx, dy) || 1;
    mob.px += dx / len * amount;
    mob.py += dy / len * amount;
    mob.x = Math.round((mob.px - TILE / 2) / TILE);
    mob.y = Math.round((mob.py - TILE / 2) / TILE);
    mob.dir = dx >= 0 ? 'right' : 'left';
  }

  function nearestCoverTile(x, y, radius) {
    let best = null, bestDist = Infinity;
    for (const obj of state?.objects || []) {
      if (!['tree', 'bush', 'sapling'].includes(obj.type)) continue;
      if (Math.abs(obj.x - x) > radius || Math.abs(obj.y - y) > radius) continue;
      const d = Math.hypot(obj.x - x, obj.y - y);
      if (d < bestDist) { bestDist = d; best = { x: obj.x, y: obj.y }; }
    }
    return best;
  }

  function enhanceWorldWithWater(world, config = {}) {
    if (!world?.terrain || world.livingWorld?.version === VERSION) return world;
    const rand = typeof seededRandom === 'function' ? seededRandom(`${world.seed || config.seed}|${VERSION}|water`) : Math.random;
    const waterTiles = [];
    const markWater = (x, y) => {
      if (x < 2 || y < 2 || x >= world.cols - 2 || y >= world.rows - 2) return;
      if (Math.hypot(x - world.spawn.x, y - world.spawn.y) < 8) return;
      if (world.terrain[y]?.[x] === 'stone') return;
      world.terrain[y][x] = 'water';
      waterTiles.push({ x, y });
    };

    const pondCount = Math.max(3, Math.min(9, Math.floor((world.cols * world.rows) / 2600)));
    for (let i = 0; i < pondCount; i++) {
      const cx = 6 + Math.floor(rand() * Math.max(1, world.cols - 12));
      const cy = 6 + Math.floor(rand() * Math.max(1, world.rows - 12));
      const rx = 2 + Math.floor(rand() * 4);
      const ry = 2 + Math.floor(rand() * 3);
      for (let y = cy - ry - 1; y <= cy + ry + 1; y++) {
        for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
          const d = ((x - cx) ** 2) / Math.max(1, rx ** 2) + ((y - cy) ** 2) / Math.max(1, ry ** 2);
          if (d <= 1 + rand() * 0.34) markWater(x, y);
        }
      }
    }

    if (world.cols >= 90 && world.rows >= 60) {
      const horizontal = rand() > 0.45;
      const drift = 8 + Math.floor(rand() * 18);
      for (let i = 2; i < (horizontal ? world.cols - 2 : world.rows - 2); i++) {
        const wave = Math.sin(i / drift + rand() * 4) * 5;
        const x = horizontal ? i : Math.round(world.cols * (0.28 + rand() * 0.42) + wave);
        const y = horizontal ? Math.round(world.rows * (0.25 + rand() * 0.5) + wave) : i;
        markWater(x, y); markWater(x + 1, y); if (i % 3 === 0) markWater(x, y + 1);
      }
    }

    const waterKey = new Set(waterTiles.map(t => `${t.x},${t.y}`));
    world.objects = (world.objects || []).filter(obj => !waterKey.has(`${obj.x},${obj.y}`));
    world.waterTiles = waterTiles;
    world.livingWorld = {
      version: VERSION,
      waterTiles,
      waypoints: [],
      visitors: [],
      tracks: [],
      reputation: 0,
      missions: [],
      eventHistory: [],
      explorationQueue: [],
      animalSightings: [],
      fireRisk: 0,
      waterQuality: 72,
      mapFilters: { water: true, fauna: true, resources: true, structures: true, visitors: true },
      lastGrowthDay: 0,
      lastVisitorDay: 0,
      lastContextEventDay: 0,
      lastEcosystemDay: 0
    };
    return world;
  }

  function ensureLivingState() {
    if (!state) return null;
    state.livingWorld = state.livingWorld || state.world?.livingWorld || { version: VERSION };
    state.livingWorld.version = state.livingWorld.version || VERSION;
    state.livingWorld.waypoints = Array.isArray(state.livingWorld.waypoints) ? state.livingWorld.waypoints : [];
    state.livingWorld.visitors = Array.isArray(state.livingWorld.visitors) ? state.livingWorld.visitors : [];
    state.livingWorld.tracks = Array.isArray(state.livingWorld.tracks) ? state.livingWorld.tracks : [];
    state.livingWorld.missions = Array.isArray(state.livingWorld.missions) ? state.livingWorld.missions : [];
    state.livingWorld.eventHistory = Array.isArray(state.livingWorld.eventHistory) ? state.livingWorld.eventHistory : [];
    state.livingWorld.explorationQueue = Array.isArray(state.livingWorld.explorationQueue) ? state.livingWorld.explorationQueue : [];
    state.livingWorld.animalSightings = Array.isArray(state.livingWorld.animalSightings) ? state.livingWorld.animalSightings : [];
    state.livingWorld.mapFilters = state.livingWorld.mapFilters || { water: true, fauna: true, resources: true, structures: true, visitors: true };
    state.livingWorld.reputation = Number(state.livingWorld.reputation || 0);
    state.livingWorld.fireRisk = clamp(Number(state.livingWorld.fireRisk || 0), 0, 100);
    state.livingWorld.waterQuality = clamp(Number(state.livingWorld.waterQuality || 72), 0, 100);
    const season = seasonForDay(state.day || 1);
    state.livingWorld.season = season.key;
    state.livingWorld.seasonLabel = season.label;
    state.livingWorld.drought = isDroughtDay(state.day || 1, season);
    if (state.world) state.world.livingWorld = state.livingWorld;
    return state.livingWorld;
  }

  function seasonForDay(day = 1) {
    const index = Math.floor((Math.max(1, Number(day) || 1) - 1) / 8) % seasons.length;
    return seasons[index] || seasons[0];
  }

  function isDroughtDay(day, season = seasonForDay(day)) {
    return season.key === 'summer' && day > 2 && day % 5 <= 1 && state?.weather !== 'chuva';
  }

  function livingEvent(type, message) {
    const living = ensureLivingState();
    if (!living || !message) return;
    living.eventHistory.unshift({ type, message, day: state?.day || 1, hour: state?.hour || 0 });
    living.eventHistory = living.eventHistory.slice(0, 40);
    if (typeof gameLog === 'function') gameLog(message, type === 'danger' ? 'danger' : type === 'warn' ? 'warn' : 'info');
    else if (typeof log === 'function') log(message);
  }

  function adjacentWaterCount(x, y) {
    return [[1,0],[-1,0],[0,1],[0,-1]].filter(([dx, dy]) => isWaterTile(x + dx, y + dy)).length;
  }

  function isBridgeAt(x, y) {
    const obj = typeof getObjectAt === 'function' ? getObjectAt(x, y) : null;
    return obj?.type === 'bridge';
  }

  function isWaterInfrastructure(type) {
    return type === 'bridge' || type === 'fish_trap' || type === 'water_collector' || type === 'irrigation_channel';
  }

  function livingWorldTick(dt) {
    if (!state || appScreen !== SCREEN.PLAYING) return;
    const living = ensureLivingState();
    if (!living) return;
    const tick = dt * (state.speed || 1);
    if (living.lastGrowthDay !== state.day) {
      living.lastGrowthDay = state.day;
      updateSeasonState();
      updateWaterInfrastructure();
      applyWaterNeeds();
      updatePlantLifecycle();
      updateEnvironmentalFire();
      growNaturePass();
      ecosystemPass();
      updateAnimalSocialPass();
      maybeContextEvent();
      maybeCreateVisitorGroup();
    }
    updateTracks(tick);
    updateVisitors(tick);
    if (mapOverlay?.classList.contains('show')) drawWorldMap(false);
  }

  function updateSeasonState() {
    const living = ensureLivingState();
    const season = seasonForDay(state.day || 1);
    const previous = living.season;
    living.season = season.key;
    living.seasonLabel = season.label;
    living.drought = isDroughtDay(state.day || 1, season);
    if (previous && previous !== season.key) livingEvent('info', `A estação virou para ${season.label}.`);
    if (living.drought) livingEvent('warn', 'Período de seca: crescimento natural e qualidade da água foram reduzidos.');
  }

  function updateWaterInfrastructure() {
    const living = ensureLivingState();
    const season = seasonForDay(state.day || 1);
    let waterGain = 0;
    let foodGain = 0;
    let qualityDelta = state.weather === 'chuva' ? 4 : -1;
    if (living.drought) qualityDelta -= 8;
    for (const obj of state.objects || []) {
      if (obj.type === 'water_collector') {
        const adjacent = adjacentWaterCount(obj.x, obj.y);
        const gain = adjacent ? 2 + adjacent : state.weather === 'chuva' ? 3 : 0;
        if (gain) { obj.storedWater = (obj.storedWater || 0) + gain; waterGain += gain; }
      }
      if (obj.type === 'fish_trap' && isWaterTile(obj.x, obj.y) && Math.random() < (living.drought ? 0.18 : 0.34) * season.water) {
        obj.catchCount = (obj.catchCount || 0) + 1;
        foodGain += 2;
      }
      if (obj.type === 'irrigation_channel' && adjacentWaterCount(obj.x, obj.y)) qualityDelta += 0.6;
    }
    living.waterQuality = clamp((living.waterQuality || 72) + qualityDelta, 8, 100);
    if (waterGain && typeof addResources === 'function') addResources({ water: waterGain });
    if (foodGain && typeof addResources === 'function') addResources({ food: foodGain });
    if (foodGain || waterGain) livingEvent('info', `Infraestrutura hídrica gerou ${foodGain ? `+${foodGain} comida` : ''}${foodGain && waterGain ? ' e ' : ''}${waterGain ? `+${waterGain} água` : ''}.`);
  }

  function applyWaterNeeds() {
    const living = ensureLivingState();
    if (!state?.colonists?.length) return;
    state.resources.water = Math.max(0, Number(state.resources.water || 0));
    for (const c of state.colonists) {
      c.thirst = clamp(Number(c.thirst ?? 100) - (living.drought ? 18 : 10), 0, 100);
      if (c.thirst < 72 && state.resources.water > 0) {
        state.resources.water -= 1;
        const quality = clamp((living.waterQuality || 70) / 100, 0.2, 1);
        c.thirst = clamp(c.thirst + 36 * quality, 0, 100);
        if (quality < 0.45) c.health = clamp((c.health || 100) - 3, 0, 100);
      }
      if (c.thirst < 22) {
        c.health = clamp((c.health || 100) - 8, 0, 100);
        c.mood = clamp((c.mood || 50) - 6, 0, 100);
        c.note = c.task ? c.note : 'Com sede';
      }
    }
    if (state.colonists.some(c => c.thirst < 22)) livingEvent('warn', 'Colonos estão sofrendo com sede. Construa coletores perto de água.');
  }

  function updatePlantLifecycle() {
    const living = ensureLivingState();
    const season = seasonForDay(state.day || 1);
    for (const obj of state.objects || []) {
      if (obj.type === 'sapling') {
        const water = nearbyWaterCount(obj.x, obj.y, 5);
        const irrigated = nearbyIrrigationCount(obj.x, obj.y, 3);
        const growth = (0.7 + water * 0.08 + irrigated * 0.22) * season.growth * (living.drought ? 0.42 : 1);
        obj.age = (obj.age || 0) + growth;
        obj.stage = saplingStage(obj);
        obj.watered = irrigated > 0 || water > 0;
        if (obj.age >= (obj.matureDays || 4)) {
          obj.type = obj.matureType || 'tree';
          obj.wild = true;
          delete obj.matureType;
          delete obj.matureDays;
          delete obj.stage;
          delete obj.watered;
        }
      }
      if (obj.type === 'crop') {
        const irrigated = nearbyIrrigationCount(obj.x, obj.y, 3);
        if (irrigated) obj.growth = clamp((obj.growth || 0) + irrigated * 5, 0, 100);
        if (living.drought && !irrigated) obj.growth = clamp((obj.growth || 0) - 6, 0, 100);
      }
    }
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
  }

  function saplingStage(obj) {
    const progress = clamp((obj.age || 0) / Math.max(1, obj.matureDays || 4), 0, 0.99);
    if (progress < 0.34) return 'sprout';
    if (progress < 0.72) return 'young';
    return 'almost';
  }

  function growNaturePass() {
    const living = ensureLivingState();
    const season = seasonForDay(state.day || 1);
    const attempts = Math.max(4, Math.floor(Math.floor((getWorldCols() * getWorldRows()) / 1900) * season.growth * (living.drought ? 0.45 : 1)));
    let added = 0;
    for (let i = 0; i < attempts; i++) {
      const tile = naturalGrowthTile();
      if (!tile) continue;
      const matureType = Math.random() < 0.62 ? 'tree' : Math.random() < 0.72 ? 'bush' : 'berry';
      state.objects.push({ id: uid('obj'), type: 'sapling', matureType, x: tile.x, y: tile.y, wild: true, age: 0, matureDays: matureType === 'tree' ? 4.5 : 2.5 });
      added++;
    }
    if (added && typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    if (added && typeof log === 'function' && Math.random() < 0.35) log(`${added} novo${added > 1 ? 's' : ''} ponto${added > 1 ? 's' : ''} de vegetação surgiu${added > 1 ? 'ram' : ''} naturalmente.`);
  }

  function naturalGrowthTile() {
    for (let i = 0; i < 90; i++) {
      const x = 2 + Math.floor(Math.random() * Math.max(1, getWorldCols() - 4));
      const y = 2 + Math.floor(Math.random() * Math.max(1, getWorldRows() - 4));
      const terrain = state.terrain?.[y]?.[x];
      if (!['grass', 'dirt'].includes(terrain)) continue;
      if (Math.hypot(x - state.world.spawn.x, y - state.world.spawn.y) < 10) continue;
      if (typeof getObjectAt === 'function' && getObjectAt(x, y)) continue;
      if (nearbyStructureCount(x, y, 5) > 4 && Math.random() < 0.84) continue;
      const plants = nearbyPlantCount(x, y, 5);
      const water = nearbyWaterCount(x, y, 6);
      if (plants + water <= 0 && Math.random() < 0.78) continue;
      if (Math.random() < Math.min(0.85, 0.16 + plants * 0.05 + water * 0.08)) return { x, y };
    }
    return null;
  }

  function nearbyIrrigationCount(x, y, radius) {
    let count = 0;
    for (const obj of state?.objects || []) {
      if (obj.type !== 'irrigation_channel' && obj.type !== 'water_collector') continue;
      if (Math.abs(obj.x - x) <= radius && Math.abs(obj.y - y) <= radius) count++;
    }
    return count;
  }

  function nearbyStructureCount(x, y, radius) {
    let count = 0;
    for (const obj of state?.objects || []) {
      if (!obj || ['tree', 'bush', 'berry', 'sapling', 'logs', 'crop', 'invasive_weed'].includes(obj.type)) continue;
      if (Math.abs(obj.x - x) <= radius && Math.abs(obj.y - y) <= radius) count++;
    }
    return count;
  }

  function ecosystemPass() {
    const living = ensureLivingState();
    if (living.lastEcosystemDay === state.day) return;
    living.lastEcosystemDay = state.day;
    spreadSeedsFromFauna();
    predatorPreyPass();
    invasivePlantPass();
  }

  function updateAnimalSocialPass() {
    const living = ensureLivingState();
    const groups = new Map();
    for (const mob of state?.mobs || []) {
      const profile = animalProfiles[mob.type];
      if (!profile) continue;
      ensureAnimalBrain(mob, profile);
      const key = mob.type;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(mob);
    }
    for (const [type, mobs] of groups) {
      if (!mobs.length) continue;
      const leader = mobs.find(m => m.brain?.isLeader) || mobs[0];
      leader.brain.isLeader = true;
      const groupId = leader.brain.groupId || `${type}_${leader.id}`;
      leader.brain.groupId = groupId;
      for (const mob of mobs) {
        mob.brain.groupId = groupId;
        mob.brain.leaderId = leader.id;
        seasonalAnimalMigration(mob);
      }
      if (mobs.length >= 2 && mobs.length < 9 && Math.random() < reproductionChance(type)) {
        const parent = mobs[Math.floor(Math.random() * mobs.length)];
        const young = {
          id: uid('mob'),
          type,
          x: parent.x,
          y: parent.y,
          px: parent.px,
          py: parent.py,
          ageStage: 'young',
          brain: { homeX: parent.brain.homeX, homeY: parent.brain.homeY, groupId, leaderId: leader.id, stateTimer: 0, waterNeed: 0.2, restNeed: 0.2, routeSeed: Math.random(), route: parent.brain.route || [] }
        };
        state.mobs.push(young);
        livingEvent('info', `${animalProfiles[type]?.label || type}: filhote avistado perto da colônia.`);
      }
      living.animalSightings.unshift({ type, count: mobs.length, leaderId: leader.id, day: state.day, x: Math.round(leader.x), y: Math.round(leader.y) });
    }
    living.animalSightings = (living.animalSightings || []).slice(0, 12);
  }

  function seasonalAnimalMigration(mob) {
    const season = seasonForDay(state.day || 1);
    if (mob.brain.lastMigrationSeason === season.key) return;
    mob.brain.lastMigrationSeason = season.key;
    const dx = season.key === 'winter' ? -8 : season.key === 'summer' ? 7 : Math.round((Math.random() - 0.5) * 6);
    const dy = season.key === 'winter' ? 5 : season.key === 'summer' ? -4 : Math.round((Math.random() - 0.5) * 6);
    mob.brain.homeX = clamp(Math.round((mob.brain.homeX || mob.x) + dx), 2, getWorldCols() - 3);
    mob.brain.homeY = clamp(Math.round((mob.brain.homeY || mob.y) + dy), 2, getWorldRows() - 3);
    mob.brain.route = preferredAnimalRoute(mob, animalProfiles[mob.type] || animalProfiles.rabbit);
  }

  function reproductionChance(type) {
    const season = seasonForDay(state.day || 1);
    const base = ['rabbit', 'chicken', 'duck'].includes(type) ? 0.11 : ['deer', 'goat', 'sheep', 'pig'].includes(type) ? 0.045 : 0.018;
    return season.key === 'spring' ? base * 1.9 : season.key === 'winter' ? base * 0.25 : base;
  }

  function spreadSeedsFromFauna() {
    let added = 0;
    for (const mob of state?.mobs || []) {
      if (!['deer', 'rabbit', 'goat', 'sheep', 'cow', 'squirrel'].includes(mob.type)) continue;
      if (Math.random() > 0.12) continue;
      const tile = naturalGrowthTileNear(Math.round(mob.x), Math.round(mob.y), 4);
      if (!tile) continue;
      state.objects.push({ id: uid('obj'), type: 'sapling', matureType: Math.random() < 0.72 ? 'bush' : 'tree', x: tile.x, y: tile.y, wild: true, age: 0, matureDays: 3 });
      added++;
    }
    if (added && typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
  }

  function naturalGrowthTileNear(cx, cy, radius) {
    for (let i = 0; i < 24; i++) {
      const x = clamp(cx + Math.floor((Math.random() - 0.5) * radius * 2), 2, getWorldCols() - 3);
      const y = clamp(cy + Math.floor((Math.random() - 0.5) * radius * 2), 2, getWorldRows() - 3);
      if (!['grass', 'dirt'].includes(state.terrain?.[y]?.[x])) continue;
      if (typeof getObjectAt === 'function' && getObjectAt(x, y)) continue;
      return { x, y };
    }
    return null;
  }

  function predatorPreyPass() {
    const predators = [...(state?.wolves || []), ...(state?.mobs || []).filter(m => ['wolf', 'spider', 'blood_wolf'].includes(m.type))];
    if (!predators.length || !state?.mobs?.length) return;
    for (const predator of predators) {
      const prey = state.mobs.find(m => !['wolf', 'spider', 'blood_wolf'].includes(m.type) && Math.hypot(m.x - predator.x, m.y - predator.y) < 5);
      if (prey && Math.random() < 0.12) {
        state.mobs = state.mobs.filter(m => m !== prey);
        predator.brain = predator.brain || {};
        predator.brain.lastMealDay = state.day;
        livingEvent('info', `${animalProfiles[prey.type]?.label || prey.type} virou presa perto da borda da colônia.`);
        return;
      }
    }
  }

  function invasivePlantPass() {
    const living = ensureLivingState();
    if (!living.drought && Math.random() > 0.18) return;
    const tile = naturalGrowthTile();
    if (!tile) return;
    state.objects.push({ id: uid('obj'), type: 'invasive_weed', x: tile.x, y: tile.y, age: 0 });
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
  }

  function updateEnvironmentalFire() {
    const living = ensureLivingState();
    const fires = (state.objects || []).filter(obj => obj.type === 'environmental_fire');
    const season = seasonForDay(state.day || 1);
    const dryFactor = living.drought || season.key === 'summer' ? 1.4 : season.key === 'winter' ? 0.55 : 1;
    living.fireRisk = clamp((living.fireRisk || 0) + (living.drought ? 10 : -5) + nearbyPlantCount(state.world?.spawn?.x || 0, state.world?.spawn?.y || 0, 20) * 0.05, 0, 100);
    let changed = false;
    for (const fire of fires) {
      fire.age = (fire.age || 0) + 1;
      fire.life = Math.max(0, Number(fire.life ?? 4) - (state.weather === 'chuva' ? 2.2 : 1));
      burnNearbyVegetation(fire.x, fire.y, 1);
      if (state.weather !== 'chuva' && Math.random() < 0.20 * dryFactor) {
        const target = nearestFlammableTile(fire.x, fire.y, 2);
        if (target) {
          state.objects = state.objects.filter(obj => !(isFlammableObject(obj) && obj.x === target.x && obj.y === target.y));
          state.objects.push({ id: uid('obj'), type: 'environmental_fire', x: target.x, y: target.y, age: 0, life: 3 + Math.random() * 3 });
          changed = true;
        }
      }
      if (fire.life <= 0) {
        fire.remove = true;
        state.terrain[fire.y][fire.x] = state.terrain?.[fire.y]?.[fire.x] === 'grass' ? 'dirt' : state.terrain?.[fire.y]?.[fire.x];
        changed = true;
      }
    }
    if (fires.some(f => f.remove)) state.objects = state.objects.filter(obj => !obj.remove);
    if (changed && typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
  }

  function createEnvironmentalFire(x, y, reason = 'seca') {
    const tile = nearestFlammableTile(x, y, 8) || naturalGrowthTile();
    if (!tile) return false;
    const existing = getObjectAt(tile.x, tile.y);
    if (existing && !isFlammableObject(existing)) return false;
    state.objects = state.objects.filter(obj => !(isFlammableObject(obj) && obj.x === tile.x && obj.y === tile.y));
    state.objects.push({ id: uid('obj'), type: 'environmental_fire', x: tile.x, y: tile.y, age: 0, life: 4 + Math.random() * 3, reason });
    ensureLivingState().fireRisk = 100;
    livingEvent('danger', `Incêndio ambiental começou por ${reason} em ${tile.x},${tile.y}.`);
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    return true;
  }

  function burnNearbyVegetation(x, y, radius) {
    for (const obj of state.objects || []) {
      if (!isFlammableObject(obj) || Math.abs(obj.x - x) > radius || Math.abs(obj.y - y) > radius) continue;
      if (Math.random() < 0.42) obj.remove = true;
    }
    if ((state.objects || []).some(obj => obj.remove)) state.objects = state.objects.filter(obj => !obj.remove);
  }

  function nearestFlammableTile(cx, cy, radius) {
    let best = null, bestDist = Infinity;
    for (const obj of state.objects || []) {
      if (!isFlammableObject(obj)) continue;
      if (Math.abs(obj.x - cx) > radius || Math.abs(obj.y - cy) > radius) continue;
      const d = Math.hypot(obj.x - cx, obj.y - cy);
      if (d < bestDist) { bestDist = d; best = { x: obj.x, y: obj.y }; }
    }
    return best;
  }

  function isFlammableObject(obj) {
    return !!obj && ['tree', 'bush', 'berry', 'sapling', 'invasive_weed'].includes(obj.type);
  }

  function maybeContextEvent() {
    const living = ensureLivingState();
    if (living.lastContextEventDay === state.day || state.day < 2) return;
    const explored = explorationRatio();
    const forest = nearbyPlantCount(state.world?.spawn?.x || 0, state.world?.spawn?.y || 0, 18);
    const food = state.resources?.food || 0;
    const waterQuality = living.waterQuality || 70;
    const candidates = [];
    if (food > 30) candidates.push(() => livingEvent('warn', 'Cheiro de comida exposta atraiu fauna curiosa para perto da base.'));
    if (state.weather === 'chuva' && waterQuality < 45) candidates.push(() => livingEvent('warn', 'A chuva lavou impurezas para a água. Qualidade hídrica em alerta.'));
    if (explored > 0.22) candidates.push(() => livingEvent('info', 'Áreas exploradas aumentaram rumores de encontros fora da base.'));
    if (forest > 18 && living.drought) candidates.push(() => createEnvironmentalFire(state.world?.spawn?.x || 0, state.world?.spawn?.y || 0, 'mata seca') || livingEvent('danger', 'A mata seca elevou risco de incêndio ambiental.'));
    if (!candidates.length || Math.random() > 0.45) return;
    living.lastContextEventDay = state.day;
    candidates[Math.floor(Math.random() * candidates.length)]();
  }

  function explorationRatio() {
    const rows = state?.world?.exploration || [];
    let seen = 0, total = 0;
    for (const row of rows) for (const cell of row || []) { total++; if (cell) seen++; }
    return total ? seen / total : 0;
  }

  function maybeCreateVisitorGroup() {
    const living = ensureLivingState();
    if (!living || living.lastVisitorDay === state.day) return;
    if (state.day < 2 || state.hour > 10) return;
    const chance = state.day % 3 === 0 ? 0.52 : 0.16;
    if (Math.random() > chance) return;
    living.lastVisitorDay = state.day;
    const kind = Math.random() < 0.38 ? 'merchant' : 'visitor';
    const label = kind === 'merchant' ? 'Mercador' : 'Visitante';
    const faction = visitorFaction();
    const offer = kind === 'merchant' ? visitorOffer() : null;
    const mission = kind !== 'merchant' || Math.random() < 0.35 ? visitorMission(kind, faction) : null;
    const groupSize = kind === 'merchant' ? 1 : 1 + Math.floor(Math.random() * 2);
    const entry = edgeTileForVisitor();
    for (let i = 0; i < groupSize; i++) {
      living.visitors.push({ id: `visitor_${Date.now()}_${i}`, kind, label, faction, offer, mission, wantsShelter: kind !== 'merchant' && Math.random() < 0.38, x: entry.x, y: entry.y + i, px: entry.x * TILE + TILE / 2, py: (entry.y + i) * TILE + TILE / 2, targetX: state.world.spawn.x + 3, targetY: state.world.spawn.y + 3 + i, phase: 'arriving', ageHours: 0 });
    }
    livingEvent('info', `${label}${groupSize > 1 ? 's' : ''} de ${faction} avistado${groupSize > 1 ? 's' : ''} vindo pela borda do mapa.`);
  }

  function visitorFaction() {
    return ['Caravaneiros do Vale', 'Liga dos Poços', 'Guardas da Estrada', 'Errantes da Serra'][Math.floor(Math.random() * 4)];
  }

  function visitorOffer() {
    const offers = [
      { label: 'Trocar madeira por comida', cost: { wood: 4 }, gain: { food: 8 }, reputation: 1 },
      { label: 'Comprar remédios com comida', cost: { food: 5 }, gain: { medicine: 2 }, reputation: 1 },
      { label: 'Vender metal leve', cost: { wood: 6, food: 2 }, gain: { metal: 3 }, reputation: 2 }
    ];
    return offers[Math.floor(Math.random() * offers.length)];
  }

  function visitorMission(kind, faction) {
    const missions = [
      { label: 'Pedido de abrigo', desc: `${faction} quer descansar até o tempo abrir.`, reward: { reputation: 2, food: 2 } },
      { label: 'Boato de água', desc: 'Marcaram um possível ponto de água no mapa.', reward: { waypoint: 'water', reputation: 1 } },
      { label: 'Rota segura', desc: 'Compartilharam uma rota curta de exploração.', reward: { waypoint: 'exploration', reputation: 1 } }
    ];
    return missions[Math.floor(Math.random() * missions.length)];
  }

  function edgeTileForVisitor() {
    const side = Math.floor(Math.random() * 4);
    if (side === 0) return { x: 2, y: 2 + Math.floor(Math.random() * Math.max(1, getWorldRows() - 4)) };
    if (side === 1) return { x: getWorldCols() - 3, y: 2 + Math.floor(Math.random() * Math.max(1, getWorldRows() - 4)) };
    if (side === 2) return { x: 2 + Math.floor(Math.random() * Math.max(1, getWorldCols() - 4)), y: 2 };
    return { x: 2 + Math.floor(Math.random() * Math.max(1, getWorldCols() - 4)), y: getWorldRows() - 3 };
  }

  function updateVisitors(tick) {
    const living = ensureLivingState();
    if (!living) return;
    const hourGain = tick * (window.TIME_SPEED || 0.025);
    for (const v of living.visitors) {
      v.ageHours = (v.ageHours || 0) + hourGain;
      if (v.phase === 'arriving' && Math.hypot(v.x - v.targetX, v.y - v.targetY) < 1.2) {
        v.phase = 'staying';
        v.stayHours = v.kind === 'merchant' ? 4 : 2.5;
        if (!v.arrivalLogged) {
          v.arrivalLogged = true;
          livingEvent('info', `${v.label} de ${v.faction || 'grupo neutro'} chegou à base${v.offer ? ` com oferta: ${v.offer.label}` : ''}.`);
        }
      }
      if (v.phase === 'staying' && v.ageHours > (v.stayHours || 2.5)) {
        const exit = edgeTileForVisitor();
        v.targetX = exit.x; v.targetY = exit.y; v.phase = 'leaving';
      }
      moveVisitor(v, tick * 34);
    }
    living.visitors = living.visitors.filter(v => !(v.phase === 'leaving' && (v.x <= 1 || v.y <= 1 || v.x >= getWorldCols() - 2 || v.y >= getWorldRows() - 2)));
  }

  function updateTracks(tick) {
    const living = ensureLivingState();
    living.tracks = (living.tracks || []).map(t => ({ ...t, life: t.life - tick })).filter(t => t.life > 0).slice(-80);
    for (const mob of state?.mobs || []) {
      mob.brain = mob.brain || {};
      mob.brain.trackTimer = (mob.brain.trackTimer || 0) - tick;
      if (mob.brain.trackTimer > 0 || !animalProfiles[mob.type]) continue;
      mob.brain.trackTimer = 4 + Math.random() * 5;
      living.tracks.push({ x: mob.x, y: mob.y, type: mob.type, life: 28 });
    }
  }

  function moveVisitor(v, amount) {
    const dx = v.targetX * TILE + TILE / 2 - v.px;
    const dy = v.targetY * TILE + TILE / 2 - v.py;
    const len = Math.hypot(dx, dy) || 1;
    v.px += dx / len * Math.min(amount, len);
    v.py += dy / len * Math.min(amount, len);
    v.x = Math.round((v.px - TILE / 2) / TILE);
    v.y = Math.round((v.py - TILE / 2) / TILE);
  }

  function waterTileSet() {
    const key = `${state?.world?.seed || ''}|${state?.world?.waterTiles?.length || 0}|${state?.day || 0}`;
    if (waterSetCache.key === key) return waterSetCache.set;
    const set = new Set();
    for (let y = 0; y < getWorldRows(); y++) for (let x = 0; x < getWorldCols(); x++) if (state?.terrain?.[y]?.[x] === 'water') set.add(`${x},${y}`);
    waterSetCache.key = key; waterSetCache.set = set;
    return set;
  }

  function isWaterTile(x, y) { return state?.terrain?.[y]?.[x] === 'water' || waterTileSet().has(`${x},${y}`); }
  function waterCollisionAt(x, y) {
    if (!isWaterTile(x, y)) return null;
    if (isBridgeAt(x, y)) return { blocks: false, kind: 'bridge' };
    const obj = typeof getObjectAt === 'function' ? getObjectAt(x, y) : null;
    if (obj?.type === 'fish_trap') return { blocks: false, kind: 'fish_trap' };
    return { blocks: true, kind: 'water' };
  }
  function nearbyWaterCount(x, y, radius) {
    let count = 0;
    for (let yy = y - radius; yy <= y + radius; yy++) for (let xx = x - radius; xx <= x + radius; xx++) if (isWaterTile(xx, yy)) count++;
    return count;
  }
  function nearestWaterTile(x, y, radius) {
    let best = null, bestDist = Infinity;
    for (let yy = y - radius; yy <= y + radius; yy++) for (let xx = x - radius; xx <= x + radius; xx++) {
      if (!isWaterTile(xx, yy)) continue;
      const d = Math.hypot(xx - x, yy - y);
      if (d < bestDist) { bestDist = d; best = { x: xx, y: yy }; }
    }
    return best;
  }
  function nearbyPlantCount(x, y, radius) {
    let count = 0;
    for (const obj of state?.objects || []) {
      if (!['tree', 'bush', 'berry'].includes(obj.type)) continue;
      if (Math.abs(obj.x - x) <= radius && Math.abs(obj.y - y) <= radius) count++;
    }
    return count;
  }

  function drawWaterTile(x, y, type) {
    if (type !== 'water') return;
    const t = typeof getTileSize === 'function' ? getTileSize() : TILE;
    const px = x * t, py = y * t;
    const pulse = Math.sin((performance.now() / 900) + x * 0.7 + y * 0.4) * 0.08;
    ctx.save();
    ctx.fillStyle = `rgba(28, 112, 168, ${0.78 + pulse})`;
    ctx.fillRect(px, py, t, t);
    ctx.fillStyle = 'rgba(148, 215, 255, .14)';
    ctx.fillRect(px + 4, py + 8 + (x + y) % 9, t - 8, 3);
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.fillRect(px + t * .18, py + t * .62 + Math.sin(performance.now() / 700 + x) * 2, t * .42, 2);
    ctx.strokeStyle = 'rgba(3, 7, 18, .32)';
    ctx.strokeRect(px + 0.5, py + 0.5, t - 1, t - 1);
    ctx.restore();
  }

  function drawLivingWorldObject(obj) {
    if (!obj) return false;
    const type = obj.type === 'blueprint' ? buildDefs?.[obj.buildType]?.type : obj.type;
    if (!['bridge', 'fish_trap', 'water_collector', 'irrigation_channel', 'sapling', 'invasive_weed', 'environmental_fire'].includes(type)) return false;
    const s = typeof getTileSize === 'function' ? getTileSize() : TILE;
    const x = obj.x * s + s / 2;
    const y = obj.y * s + s / 2;
    ctx.save();
    if (obj.type === 'blueprint') ctx.globalAlpha *= 0.48;
    if (type === 'bridge') {
      ctx.fillStyle = '#7a5537';
      ctx.fillRect(obj.x * s + 4, obj.y * s + s * .33, s - 8, s * .34);
      ctx.strokeStyle = '#3a2416';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const xx = obj.x * s + 8 + i * ((s - 16) / 3);
        ctx.beginPath(); ctx.moveTo(xx, obj.y * s + s * .3); ctx.lineTo(xx, obj.y * s + s * .7); ctx.stroke();
      }
    } else if (type === 'fish_trap') {
      ctx.strokeStyle = '#d8b76a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, s * .28, s * .16, -0.4, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(216,183,106,.22)';
      ctx.fill();
    } else if (type === 'water_collector') {
      ctx.fillStyle = '#6b4f34';
      ctx.fillRect(x - 14, y - 13, 28, 26);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(x - 10, y - 9, 20, 8);
      ctx.strokeStyle = '#2b1a10';
      ctx.strokeRect(x - 14, y - 13, 28, 26);
    } else if (type === 'irrigation_channel') {
      ctx.fillStyle = '#334155';
      ctx.fillRect(obj.x * s + 6, y - 5, s - 12, 10);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(obj.x * s + 8, y - 2, s - 16, 4);
    } else if (type === 'sapling') {
      const stage = obj.stage || saplingStage(obj);
      const scale = stage === 'sprout' ? 0.62 : stage === 'young' ? 0.82 : 1.08;
      ctx.strokeStyle = '#22543d';
      ctx.lineWidth = 2 + scale;
      ctx.beginPath(); ctx.moveTo(x, y + 12 * scale); ctx.lineTo(x, y - 9 * scale); ctx.stroke();
      ctx.fillStyle = obj.watered ? '#86efac' : '#65a30d';
      ctx.beginPath(); ctx.ellipse(x - 6 * scale, y - 5 * scale, 8 * scale, 5 * scale, -0.5, 0, Math.PI * 2); ctx.fill();
      if (stage !== 'sprout') { ctx.beginPath(); ctx.ellipse(x + 6 * scale, y - 8 * scale, 8 * scale, 5 * scale, 0.5, 0, Math.PI * 2); ctx.fill(); }
      if (stage === 'almost') { ctx.fillStyle = 'rgba(34,84,61,.45)'; ctx.beginPath(); ctx.arc(x, y - 8, 10, 0, Math.PI * 2); ctx.fill(); }
    } else if (type === 'invasive_weed') {
      ctx.strokeStyle = '#84cc16';
      ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(x, y + 12); ctx.lineTo(x + i * 5, y - 8 + Math.abs(i) * 2); ctx.stroke();
      }
    } else if (type === 'environmental_fire') {
      const flicker = Math.sin(performance.now() / 90 + obj.x * 3 + obj.y) * 3;
      ctx.fillStyle = 'rgba(88,28,28,.42)';
      ctx.beginPath(); ctx.arc(x, y + 4, s * .38, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.ellipse(x - 3, y + 1, 8, 15 + flicker, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f97316';
      ctx.beginPath(); ctx.ellipse(x + 4, y, 7, 13 - flicker, 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fde68a';
      ctx.beginPath(); ctx.ellipse(x, y + 4, 4, 8, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    return true;
  }

  function drawLivingWorldMarkers() {
    if (!state) return;
    const living = ensureLivingState();
    if (!living) return;
    const filters = living.mapFilters || {};
    ctx.save();
    if (filters.fauna !== false) for (const track of living.tracks || []) drawTrackMarker(track);
    for (const wp of living.waypoints || []) drawWaypointMarker(wp);
    if (filters.visitors !== false) for (const v of living.visitors || []) drawVisitorMarker(v);
    ctx.restore();
  }

  function drawWaypointMarker(wp) {
    const px = wp.x * TILE + TILE / 2;
    const py = wp.y * TILE + TILE / 2;
    const color = wp.color || waypointTypes[wp.type || 'general']?.color || '#f8d78a';
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(2, 6, 23, .85)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#020617'; ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(String(wp.index || ''), 0, 4);
    ctx.restore();
  }

  function drawTrackMarker(track) {
    const alpha = clamp((track.life || 0) / 28, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha * 0.45;
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.ellipse(track.x * TILE + TILE / 2, track.y * TILE + TILE / 2, 5, 2.5, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawVisitorMarker(v) {
    ctx.save();
    ctx.translate(v.px, v.py);
    ctx.fillStyle = v.kind === 'merchant' ? 'rgba(250, 204, 21, .92)' : 'rgba(125, 211, 252, .92)';
    ctx.strokeStyle = 'rgba(2, 6, 23, .88)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#020617'; ctx.font = '900 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(v.kind === 'merchant' ? '$' : 'V', 0, 4);
    ctx.restore();
  }

  function installMapControls() {
    document.addEventListener('keydown', event => {
      if (isTypingTarget() || !state || appScreen !== SCREEN.PLAYING) return;
      if (event.code === 'KeyM') { event.preventDefault(); toggleWorldMap(); }
    }, true);
  }

  function isTypingTarget(el = document.activeElement) {
    if (!el) return false;
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || !!el.isContentEditable;
  }

  function ensureMapOverlay() {
    if (mapOverlay) return mapOverlay;
    mapOverlay = document.createElement('section');
    mapOverlay.id = 'living-world-map-overlay';
    mapOverlay.innerHTML = `<div class="living-map-card"><header><div><div class="kicker">Mapa Global</div><h2>Mapa da Colônia</h2><p>Clique para criar waypoint. Shift + clique remove o waypoint mais próximo. Pressione M para fechar.</p></div><button type="button" data-close-living-map>Fechar</button></header><canvas id="living-world-map-canvas"></canvas><footer><span>Água</span><span>Vegetação</span><span>Área lembrada</span><span>Waypoints</span><span>Visitantes</span></footer></div>`;
    mapOverlay.setAttribute('aria-hidden', 'true');
    mapOverlay.className = 'living-world-map-overlay';
    const style = document.createElement('style');
    style.textContent = `.living-world-map-overlay{position:fixed;inset:0;z-index:8400;display:none;place-items:center;background:rgba(2,6,23,.84);backdrop-filter:blur(8px);color:#e5edf8}.living-world-map-overlay.show{display:grid}.living-map-card{width:min(94vw,1040px);height:min(88vh,760px);display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:12px;border:1px solid rgba(148,163,184,.22);border-radius:22px;background:linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.98));padding:16px;box-shadow:0 28px 80px rgba(0,0,0,.55)}.living-map-card header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.living-map-card h2{margin:0;font-size:26px}.living-map-card p{margin:6px 0 0;color:rgba(203,213,225,.78)}.living-map-card button{border:1px solid rgba(248,215,138,.42);border-radius:12px;background:rgba(248,215,138,.10);color:#f8d78a;font-weight:900;padding:9px 12px;cursor:pointer}.living-map-card canvas{width:100%;height:100%;border-radius:16px;background:#020617;border:1px solid rgba(148,163,184,.18);image-rendering:pixelated}.living-map-card footer{display:flex;flex-wrap:wrap;gap:8px}.living-map-card footer span{border:1px solid rgba(148,163,184,.18);border-radius:999px;padding:5px 8px;background:rgba(15,23,42,.72);font-size:11px;font-weight:850}`;
    document.head.appendChild(style);
    document.body.appendChild(mapOverlay);
    mapCanvas = mapOverlay.querySelector('#living-world-map-canvas');
    enhanceMapOverlayLayout();
    mapOverlay.addEventListener('click', event => { if (event.target === mapOverlay || event.target.closest('[data-close-living-map]')) closeWorldMap(); });
    mapOverlay.addEventListener('click', onMapOverlayClick);
    mapOverlay.addEventListener('input', onMapOverlayInput);
    mapOverlay.addEventListener('change', onMapOverlayInput);
    mapCanvas.addEventListener('click', onMapClick);
    return mapOverlay;
  }

  function enhanceMapOverlayLayout() {
    if (!mapOverlay || !mapCanvas || mapOverlay.querySelector('.living-map-layout')) return;
    const layout = document.createElement('div');
    layout.className = 'living-map-layout';
    const side = document.createElement('aside');
    side.id = 'living-map-side';
    side.className = 'living-map-side';
    mapCanvas.parentElement.insertBefore(layout, mapCanvas);
    layout.appendChild(mapCanvas);
    layout.appendChild(side);
    const style = document.createElement('style');
    style.textContent = `.living-map-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:12px;min-height:0}.living-map-side{display:grid;align-content:start;gap:9px;overflow:auto;border:1px solid rgba(148,163,184,.16);border-radius:16px;background:rgba(2,6,23,.46);padding:10px}.living-map-side label{display:grid;gap:4px;font-size:11px;color:#b8c3d6}.living-map-side input,.living-map-side select{width:100%;box-sizing:border-box;border:1px solid rgba(148,163,184,.22);border-radius:10px;background:#020617;color:#e5edf8;padding:8px}.living-map-side .map-check{display:flex;align-items:center;gap:6px}.living-map-side .map-check input{width:auto}.living-map-side .map-filter-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}.living-map-side .map-row{display:grid;gap:5px;border:1px solid rgba(148,163,184,.14);border-radius:12px;padding:8px;background:rgba(255,255,255,.04)}@media(max-width:820px){.living-map-layout{grid-template-columns:1fr}.living-map-side{max-height:220px}}`;
    document.head.appendChild(style);
  }

  function toggleWorldMap() { ensureMapOverlay().classList.contains('show') ? closeWorldMap() : openWorldMap(); }
  function openWorldMap() { ensureMapOverlay(); drawWorldMap(); mapOverlay.classList.add('show'); mapOverlay.setAttribute('aria-hidden', 'false'); }
  function closeWorldMap() { if (!mapOverlay) return; mapOverlay.classList.remove('show'); mapOverlay.setAttribute('aria-hidden', 'true'); }

  function drawWorldMap(renderSide = true) {
    if (!mapCanvas || !state?.terrain) return;
    const cols = getWorldCols(), rows = getWorldRows();
    const rect = mapCanvas.getBoundingClientRect();
    const scale = Math.max(2, Math.floor(Math.min(rect.width / cols, rect.height / rows)));
    mapCanvas.width = cols * scale;
    mapCanvas.height = rows * scale;
    const mctx = mapCanvas.getContext('2d');
    const living = ensureLivingState();
    const filters = living?.mapFilters || {};
    mctx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const terrain = state.terrain[y]?.[x] || 'grass';
      const seen = state.world?.exploration?.[y]?.[x] || 0;
      mctx.fillStyle = mapColor(terrain === 'water' && filters.water === false ? 'hidden_water' : terrain, seen);
      mctx.fillRect(x * scale, y * scale, scale, scale);
    }
    const selectedWp = living?.waypoints?.find(wp => wp.id === selectedWaypointId);
    if (living?.explorationQueue?.length) drawMapQueue(mctx, living.explorationQueue, scale);
    if (selectedWp) drawMapRoute(mctx, selectedWp, scale);
    if (filters.resources !== false) for (const obj of state.objects || []) if (objectDefs?.[obj.type]?.gather) drawMapDot(mctx, obj.x, obj.y, scale, '#86efac', Math.max(1.5, scale * 0.8));
    if (filters.structures !== false) for (const obj of state.objects || []) if (!objectDefs?.[obj.type]?.gather && !['tree', 'bush', 'berry', 'sapling'].includes(obj.type)) drawMapDot(mctx, obj.x, obj.y, scale, obj.type === 'environmental_fire' ? '#ef4444' : '#94a3b8', Math.max(1.5, scale * 0.75));
    if (filters.fauna !== false) for (const mob of state.mobs || []) drawMapDot(mctx, mob.x, mob.y, scale, '#fbbf24', Math.max(1.5, scale * 0.9));
    for (const wp of living?.waypoints || []) drawMapDot(mctx, wp.x, wp.y, scale, wp.color || waypointTypes[wp.type || 'general']?.color || '#f8d78a', Math.max(2, scale * 1.5));
    for (const c of state.colonists || []) drawMapDot(mctx, c.x, c.y, scale, '#e5edf8', Math.max(2, scale * 1.4));
    if (filters.visitors !== false) for (const v of living?.visitors || []) drawMapDot(mctx, v.x, v.y, scale, v.kind === 'merchant' ? '#facc15' : '#7dd3fc', Math.max(2, scale * 1.4));
    if (renderSide) renderMapSidePanel();
  }

  function drawMapQueue(mctx, queue, scale) {
    const points = queue.map(id => ensureLivingState().waypoints.find(wp => wp.id === id)).filter(Boolean);
    if (!points.length) return;
    const start = state?.colonists?.[0] || state?.world?.spawn || points[0];
    mctx.save();
    mctx.strokeStyle = 'rgba(125,211,252,.72)';
    mctx.lineWidth = Math.max(1, scale * 0.55);
    mctx.beginPath();
    mctx.moveTo(start.x * scale + scale / 2, start.y * scale + scale / 2);
    for (const wp of points) mctx.lineTo(wp.x * scale + scale / 2, wp.y * scale + scale / 2);
    mctx.stroke();
    mctx.restore();
  }

  function drawMapRoute(mctx, wp, scale) {
    const start = state?.colonists?.[0] || state?.world?.spawn || { x: 0, y: 0 };
    mctx.save();
    mctx.strokeStyle = 'rgba(248,215,138,.82)';
    mctx.lineWidth = Math.max(1, scale * 0.45);
    mctx.setLineDash([Math.max(3, scale), Math.max(3, scale)]);
    mctx.beginPath();
    mctx.moveTo(start.x * scale + scale / 2, start.y * scale + scale / 2);
    mctx.lineTo(wp.x * scale + scale / 2, wp.y * scale + scale / 2);
    mctx.stroke();
    mctx.restore();
  }

  function mapColor(terrain, seen) {
    const base = terrain === 'hidden_water' ? [18, 32, 48] : terrain === 'water' ? [34, 116, 174] : terrain === 'stone' ? [82, 91, 107] : terrain === 'sand' ? [137, 109, 61] : terrain === 'dirt' ? [103, 73, 46] : [48, 112, 67];
    const factor = seen === 2 ? 1 : seen === 1 ? 0.52 : 0.22;
    return `rgb(${Math.floor(base[0] * factor)},${Math.floor(base[1] * factor)},${Math.floor(base[2] * factor)})`;
  }

  function drawMapDot(mctx, x, y, scale, color, radius) {
    mctx.fillStyle = color;
    mctx.beginPath();
    mctx.arc(x * scale + scale / 2, y * scale + scale / 2, radius, 0, Math.PI * 2);
    mctx.fill();
  }

  function renderMapSidePanel() {
    const side = document.getElementById('living-map-side');
    const living = ensureLivingState();
    if (!side || !living) return;
    const wp = living.waypoints.find(item => item.id === selectedWaypointId) || living.waypoints[0] || null;
    if (wp && !selectedWaypointId) selectedWaypointId = wp.id;
    const filterRows = Object.entries({ water: 'Água', fauna: 'Fauna', resources: 'Recursos', structures: 'Estruturas', visitors: 'Visitantes' })
      .map(([key, label]) => `<label class="map-check"><input type="checkbox" data-map-filter="${key}" ${living.mapFilters?.[key] !== false ? 'checked' : ''}> ${label}</label>`).join('');
    const queueRows = (living.explorationQueue || []).map((id, index) => {
      const item = living.waypoints.find(w => w.id === id);
      return item ? `<small>${index + 1}. ${escapeHtml(item.label)} (${item.x},${item.y})</small>` : '';
    }).join('');
    const visitorRows = (living.visitors || []).slice(0, 5).map(v => {
      const cost = formatResourceBundle(v.offer?.cost);
      const gain = formatResourceBundle(v.offer?.gain);
      return `<div class="map-row"><b>${escapeHtml(v.label)} · ${escapeHtml(v.faction || 'sem facção')}</b><small>${escapeHtml(v.phase || 'passando')}${v.offer ? ` · ${escapeHtml(v.offer.label)}` : ''}</small>${v.offer ? `<small>Custa: ${escapeHtml(cost || 'nada')} · Recebe: ${escapeHtml(gain || 'nada')}</small>` : ''}${v.mission ? `<small>Missão: ${escapeHtml(v.mission.label)}</small>` : ''}<button data-visitor-trade="${v.id}" ${v.offer && !v.traded ? '' : 'disabled'}>${v.traded ? 'Troca feita' : 'Trocar'}</button><button data-visitor-rumor="${v.id}" ${v.rumorGiven ? 'disabled' : ''}>Pedir boato</button><button data-visitor-shelter="${v.id}" ${v.wantsShelter && !v.sheltered ? '' : 'disabled'}>${v.sheltered ? 'Abrigado' : 'Abrigar'}</button></div>`;
    }).join('');
    const sightingRows = (living.animalSightings || []).slice(0, 4).map(s => `<small>Dia ${s.day}: ${animalProfiles[s.type]?.label || s.type} x${s.count} em ${s.x},${s.y}</small>`).join('');
    side.innerHTML = `<div class="map-row"><b>${living.seasonLabel || 'Estação'}</b><small>Água ${Math.round(living.waterQuality || 0)}% · reputação ${living.reputation || 0} · fogo ${Math.round(living.fireRisk || 0)}%</small></div>
      <div class="map-row"><b>Filtros</b><div class="map-filter-grid">${filterRows}</div></div>
      ${wp ? `<div class="map-row"><b>Waypoint ativo</b><label>Nome<input data-waypoint-field="label" value="${escapeHtml(wp.label || '')}"></label><label>Tipo<select data-waypoint-field="type">${Object.entries(waypointTypes).map(([key, def]) => `<option value="${key}" ${wp.type === key ? 'selected' : ''}>${def.label}</option>`).join('')}</select></label><label>Cor<input data-waypoint-field="color" type="color" value="${wp.color || waypointTypes[wp.type || 'general']?.color || '#f8d78a'}"></label><button data-waypoint-route="${wp.id}">Rota sugerida</button></div>` : '<div class="map-row">Nenhum waypoint criado.</div>'}
      <div class="map-row"><b>Ordem de exploração</b><button data-generate-exploration>Gerar rota automática</button><button data-clear-exploration ${living.explorationQueue?.length ? '' : 'disabled'}>Limpar rota</button>${queueRows || '<small>Crie waypoints e gere uma ordem.</small>'}</div>
      <div class="map-row"><b>Visitantes e mercadores</b>${visitorRows || '<small>Nenhum visitante no mapa.</small>'}</div>
      <div class="map-row"><b>Avistamentos</b>${sightingRows || '<small>Nenhum animal rastreado ainda.</small>'}</div>
      <div class="map-row"><b>Eventos recentes</b>${(living.eventHistory || []).slice(0, 4).map(e => `<small>Dia ${e.day}: ${escapeHtml(e.message)}</small>`).join('') || '<small>Sem eventos contextuais.</small>'}</div>`;
  }

  function formatResourceBundle(bundle = {}) {
    return Object.entries(bundle || {}).filter(([, value]) => value > 0).map(([key, value]) => `${value} ${typeof resourceLabel === 'function' ? resourceLabel(key) : key}`).join(', ');
  }

  function onMapClick(event) {
    if (!state || !mapCanvas) return;
    const rect = mapCanvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / rect.width * getWorldCols());
    const y = Math.floor((event.clientY - rect.top) / rect.height * getWorldRows());
    const living = ensureLivingState();
    if (!living) return;
    if (event.shiftKey) {
      const nearest = [...living.waypoints].sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
      if (nearest && Math.hypot(nearest.x - x, nearest.y - y) < 8) {
        living.waypoints = living.waypoints.filter(wp => wp.id !== nearest.id);
        if (selectedWaypointId === nearest.id) selectedWaypointId = null;
      }
    } else {
      const nearest = [...living.waypoints].sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
      if (nearest && Math.hypot(nearest.x - x, nearest.y - y) < 5) selectedWaypointId = nearest.id;
      else selectedWaypointId = createWaypoint(x, y, 'general')?.id || selectedWaypointId;
    }
    drawWorldMap();
    if (typeof updateUI === 'function') updateUI(true);
  }

  function createWaypoint(x, y, type = 'general', label = null) {
    const living = ensureLivingState();
    if (!living) return null;
    const index = living.waypoints.length + 1;
    const def = waypointTypes[type] || waypointTypes.general;
    const wp = { id: `wp_${Date.now()}_${index}`, index, x: clamp(x, 0, getWorldCols() - 1), y: clamp(y, 0, getWorldRows() - 1), type, color: def.color, label: label || `${def.label} ${index}` };
    living.waypoints.push(wp);
    livingEvent('info', `${wp.label} marcado em ${wp.x},${wp.y}.`);
    return wp;
  }

  function onMapOverlayInput(event) {
    const filter = event.target.closest?.('[data-map-filter]');
    if (filter) {
      const living = ensureLivingState();
      living.mapFilters = living.mapFilters || {};
      living.mapFilters[filter.dataset.mapFilter] = !!filter.checked;
      drawWorldMap();
      return;
    }
    const field = event.target.closest?.('[data-waypoint-field]');
    if (!field) return;
    const living = ensureLivingState();
    const wp = living?.waypoints?.find(item => item.id === selectedWaypointId);
    if (!wp) return;
    const key = field.dataset.waypointField;
    if (key === 'label') wp.label = field.value.slice(0, 40) || `Waypoint ${wp.index || ''}`;
    if (key === 'type') {
      wp.type = field.value;
      wp.color = waypointTypes[wp.type]?.color || wp.color;
    }
    if (key === 'color') wp.color = field.value;
    drawWorldMap();
  }

  function onMapOverlayClick(event) {
    if (event.target === mapOverlay || event.target.closest?.('[data-close-living-map]')) { closeWorldMap(); return; }
    const route = event.target.closest?.('[data-waypoint-route]');
    if (route) { selectedWaypointId = route.dataset.waypointRoute; drawWorldMap(); return; }
    if (event.target.closest?.('[data-generate-exploration]')) { generateExplorationQueue(); drawWorldMap(); return; }
    if (event.target.closest?.('[data-clear-exploration]')) { ensureLivingState().explorationQueue = []; drawWorldMap(); return; }
    const trade = event.target.closest?.('[data-visitor-trade]');
    if (trade) { tradeWithVisitor(trade.dataset.visitorTrade); drawWorldMap(); return; }
    const rumor = event.target.closest?.('[data-visitor-rumor]');
    if (rumor) { acceptVisitorRumor(rumor.dataset.visitorRumor); drawWorldMap(); return; }
    const shelter = event.target.closest?.('[data-visitor-shelter]');
    if (shelter) { shelterVisitor(shelter.dataset.visitorShelter); drawWorldMap(); }
  }

  function generateExplorationQueue() {
    const living = ensureLivingState();
    const remaining = [...(living?.waypoints || [])].filter(wp => wp.type === 'exploration' || wp.type === 'resource' || wp.type === 'water' || wp.type === 'danger' || wp.type === 'general');
    const ordered = [];
    let cursor = state?.colonists?.[0] || state?.world?.spawn || { x: 0, y: 0 };
    while (remaining.length) {
      remaining.sort((a, b) => Math.hypot(a.x - cursor.x, a.y - cursor.y) - Math.hypot(b.x - cursor.x, b.y - cursor.y));
      const next = remaining.shift();
      ordered.push(next);
      cursor = next;
    }
    living.explorationQueue = ordered.map(wp => wp.id);
    selectedWaypointId = living.explorationQueue[0] || selectedWaypointId;
    if (ordered.length) livingEvent('info', `Rota automática de exploração criada com ${ordered.length} ponto${ordered.length > 1 ? 's' : ''}.`);
    return living.explorationQueue;
  }

  function tradeWithVisitor(id) {
    const living = ensureLivingState();
    const visitor = living?.visitors?.find(v => v.id === id);
    const offer = visitor?.offer;
    if (!offer || visitor.traded) return;
    if (typeof hasCost === 'function' && !hasCost(offer.cost || {})) { livingEvent('warn', `Faltam recursos para negociar: ${offer.label}.`); return; }
    if (typeof payCost === 'function') payCost(offer.cost || {});
    if (typeof addResources === 'function') addResources(offer.gain || {});
    visitor.traded = true;
    living.reputation += offer.reputation || 1;
    livingEvent('info', `Troca concluída com ${visitor.faction}: ${offer.label}.`);
  }

  function acceptVisitorRumor(id) {
    const living = ensureLivingState();
    const visitor = living?.visitors?.find(v => v.id === id);
    if (!visitor || visitor.rumorGiven) return;
    visitor.rumorGiven = true;
    const type = visitor.mission?.reward?.waypoint || (Math.random() < 0.5 ? 'water' : 'exploration');
    const base = state.world?.spawn || { x: 8, y: 8 };
    const x = clamp(base.x + 10 + Math.floor(Math.random() * 18), 1, getWorldCols() - 2);
    const y = clamp(base.y + 8 + Math.floor(Math.random() * 18), 1, getWorldRows() - 2);
    selectedWaypointId = createWaypoint(x, y, type, type === 'water' ? 'Boato de água' : 'Rota sugerida')?.id || selectedWaypointId;
    living.reputation += 1;
  }

  function shelterVisitor(id) {
    const living = ensureLivingState();
    const visitor = living?.visitors?.find(v => v.id === id);
    if (!visitor || visitor.sheltered || !visitor.wantsShelter) return;
    visitor.sheltered = true;
    visitor.stayHours = Math.max(visitor.stayHours || 2.5, 6);
    living.reputation += 2;
    if (typeof addResources === 'function') addResources({ food: 2 });
    livingEvent('info', `${visitor.faction} agradeceu o abrigo e deixou comida em troca.`);
  }

  function inspectAnimal(mobOrId) {
    const mob = typeof mobOrId === 'object' ? mobOrId : (state?.mobs || []).find(item => String(item.id) === String(mobOrId));
    if (!mob) return false;
    const profile = animalProfiles[mob.type] || {};
    ensureAnimalBrain(mob, profile);
    selectedAnimalId = mob.id;
    const panel = ensureAnimalInspector();
    const leader = mob.brain?.isLeader ? 'líder do grupo' : mob.brain?.leaderId ? `segue ${mob.brain.leaderId}` : 'sem grupo';
    panel.querySelector('[data-animal-body]').innerHTML = `<div class="animal-inspect-head"><b>${escapeHtml(profile.label || mob.type)}</b><button type="button" data-close-animal-inspector>Fechar</button></div>
      <div class="animal-stat"><span>Estado</span><b>${escapeHtml(mob.state || 'observando')}</b></div>
      <div class="animal-stat"><span>Grupo</span><b>${escapeHtml(leader)}</b></div>
      <div class="animal-stat"><span>Memória segura</span><b>${Math.round(mob.brain.safeX ?? mob.x)}, ${Math.round(mob.brain.safeY ?? mob.y)}</b></div>
      <div class="animal-stat"><span>Rota preferida</span><b>${(mob.brain.route || []).length} ponto(s)</b></div>
      <div class="animal-stat"><span>Sede / descanso</span><b>${Math.round((mob.brain.waterNeed || 0) * 100)}% / ${Math.round((mob.brain.restNeed || 0) * 100)}%</b></div>
      <div class="animal-stat"><span>Posição</span><b>${Math.round(mob.x)}, ${Math.round(mob.y)}</b></div>`;
    panel.classList.add('show');
    panel.setAttribute('aria-hidden', 'false');
    return true;
  }

  function ensureAnimalInspector() {
    let panel = document.getElementById('animal-inspector-panel');
    if (panel) return panel;
    panel = document.createElement('aside');
    panel.id = 'animal-inspector-panel';
    panel.className = 'animal-inspector-panel';
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = '<div data-animal-body></div>';
    const style = document.createElement('style');
    style.textContent = `.animal-inspector-panel{position:fixed;right:18px;top:82px;z-index:6200;width:min(320px,calc(100vw - 28px));display:none;color:#e5edf8;border:1px solid rgba(148,163,184,.22);border-radius:16px;background:rgba(2,6,23,.91);box-shadow:0 20px 60px rgba(0,0,0,.45);padding:12px}.animal-inspector-panel.show{display:block}.animal-inspect-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}.animal-inspector-panel button{border:1px solid rgba(125,211,252,.35);border-radius:10px;background:rgba(14,165,233,.12);color:#bae6fd;font-weight:850;padding:6px 8px;cursor:pointer}.animal-stat{display:flex;justify-content:space-between;gap:10px;border-top:1px solid rgba(148,163,184,.12);padding:8px 0;font-size:12px}.animal-stat span{color:#94a3b8}.animal-stat b{text-align:right;color:#f8fafc}`;
    document.head.appendChild(style);
    document.body.appendChild(panel);
    panel.addEventListener('click', event => {
      if (!event.target.closest?.('[data-close-animal-inspector]')) return;
      panel.classList.remove('show');
      panel.setAttribute('aria-hidden', 'true');
      selectedAnimalId = null;
    });
    return panel;
  }

  install();
})();
