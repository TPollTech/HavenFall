'use strict';

(() => {
  if (window.HavenfallContext?.livingWorldInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.livingWorldInstalled = true;

  const WATER_TILE = 'water';
  const VISITOR_STAY_HOURS = 10;
  const BRIDGE_TYPES = new Set(['bridge', 'wood_bridge', 'stone_bridge']);
  const SOCIAL_BOOTSTRAP_VERSION = 'living-world-social-v4';
  const RESOURCE_LABELS = Object.freeze({ food: 'comida', wood: 'madeira', stone: 'pedra', metal: 'metal', medicine: 'remedio', water: 'agua' });
  const ITEM_LABELS = Object.freeze({ rope: 'corda', nails: 'pregos', cloth: 'tecido', leather: 'couro', bandage: 'curativos', simpleMeal: 'refeicao', toolkit: 'kit', shield: 'escudo' });
  const VISITOR_STORIES = Object.freeze([
    Object.freeze({
      key: 'lost_traveler',
      label: 'Viajante perdido',
      intro: 'Um viajante coberto de poeira pede comida e uma noite segura antes de seguir.',
      recruitBase: 0.46,
      aidCost: Object.freeze({ resources: Object.freeze({ food: 6 }) }),
      aidLabel: 'Dar 6 comida',
      aidEffect: 'O viajante recupera as forcas e observa a base com mais calma.',
      rumorText: 'Ele fala de rastros e materiais esquecidos perto de uma rota quebrada.'
    }),
    Object.freeze({
      key: 'injured_refugee',
      label: 'Refugiado ferido',
      intro: 'Um refugiado chega machucado, com medo de voltar para a estrada durante a noite.',
      recruitBase: 0.68,
      aidCost: Object.freeze({ resources: Object.freeze({ medicine: 1, food: 3 }) }),
      aidLabel: 'Tratar e alimentar',
      aidEffect: 'O curativo e a refeicao mudam completamente a postura do visitante.',
      rumorText: 'Ele descreve um abrigo danificado onde outros sobreviventes passaram.'
    }),
    Object.freeze({
      key: 'wandering_scout',
      label: 'Batedor errante',
      intro: 'Uma pessoa acostumada a vagar pelas redondezas para e oferece informacoes em troca de conversa franca.',
      recruitBase: 0.38,
      aidCost: Object.freeze({ resources: Object.freeze({ food: 4 }) }),
      aidLabel: 'Partilhar provisoes',
      aidEffect: 'O batedor se acalma e passa a confiar mais no assentamento.',
      rumorText: 'Ele marca mentalmente trilhas de agua, ruinas e clareiras defensaveis.'
    })
  ]);
  const visitorNames = ['Ari', 'Nara', 'Téo', 'Mira', 'Luan', 'Iris', 'Noah', 'Bia'];

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

  let nativeGenerateWorldFromSeed = null;
  let nativeUpdatePassiveMob = null;
  let mapOverlay = null;
  let mapCanvas = null;
  let encounterModal = null;

  function install() {
    installDefinitions();
    patchWorldGeneration();
    patchAnimalBehavior();
    patchMobSpawning();
    window.GameSystems?.registerTick?.('living-world.ecology', livingWorldTick, { order: 34 });
    window.GameSystems?.registerTileRenderer?.('living-world.water', drawWaterTile, { order: 6, renderPass: 'dynamic' });
    window.GameSystems?.registerWorldOverlay?.('living-world.markers', drawLivingWorldMarkers, { order: 92 });
    window.GameSystems?.registerCollisionProvider?.('living-world.water-collision', waterCollisionAt, { order: 8 });
    installMapControls();
    window.HavenfallDebugRuntime?.registerProvider?.('living-world.events', livingWorldDebugProvider, { order: 40, flags: ['socialEvents'] });
    window.HavenfallLivingWorld = {
      version: 'living-world-v3',
      animalProfiles,
      openMap: openWorldMap,
      closeMap: closeWorldMap,
      ensureWorldWater: enhanceWorldWithWater,
      createWaypoint,
      generateExplorationQueue,
      spawnVisitor,
      triggerEncounter: visitorId => openVisitorEncounter(findVisitorById(visitorId)),
      resolveEncounter: chooseEncounterAction,
      recruitVisitor: visitorId => recruitVisitor(findVisitorById(visitorId)),
      openBriefing: maybeOpenIntroBriefing,
      debugScheduleSnapshot,
      scheduleNextVisitor
    };
  }

  function installDefinitions() {
    if (typeof buildDefs !== 'object' || typeof objectDefs !== 'object') return;
    buildDefs.bridge = {
      ...(buildDefs.bridge || {}),
      label: 'Ponte',
      type: 'bridge',
      cost: { wood: 8 },
      work: 4,
      placeOnWater: true,
      requires: buildDefs.bridge?.requires || 'watercraft'
    };
    buildDefs.fish_trap = {
      ...(buildDefs.fish_trap || {}),
      label: 'Armadilha de Peixe',
      type: 'fish_trap',
      cost: { wood: 10 },
      itemCost: { rope: 1 },
      work: 5,
      needsAdjacentWater: true,
      requires: buildDefs.fish_trap?.requires || 'watercraft'
    };
    buildDefs.water_collector = {
      ...(buildDefs.water_collector || {}),
      label: 'Coletor de Agua',
      type: 'water_collector',
      cost: { wood: 12, stone: 4 },
      work: 6,
      needsAdjacentWater: true,
      requires: buildDefs.water_collector?.requires || 'watercraft'
    };
    objectDefs.bridge = { ...(objectDefs.bridge || {}), name: 'ponte', img: objectDefs.bridge?.img || 'logs', blocks: false };
    objectDefs.fish_trap = { ...(objectDefs.fish_trap || {}), name: 'armadilha de peixe', img: objectDefs.fish_trap?.img || 'crate_wood', blocks: false, interactable: true };
    objectDefs.water_collector = { ...(objectDefs.water_collector || {}), name: 'coletor de agua', img: objectDefs.water_collector?.img || 'chest_large', blocks: false, interactable: true };
  }

  function patchWorldGeneration() {
    if (window.HavenfallContext.livingWorldGenerationPatched || typeof generateWorldFromSeed !== 'function') return;
    nativeGenerateWorldFromSeed = generateWorldFromSeed;
    generateWorldFromSeed = function generateLivingWorldFromSeed(config) {
      const world = nativeGenerateWorldFromSeed(config);
      enhanceWorldWithWater(world, config);
      return world;
    };
    window.HavenfallContext.livingWorldGenerationPatched = true;
  }

  function ensureRuntimeState() {
    if (!state?.world) return null;
    state.livingWorld = state.livingWorld || state.world.livingWorld || {};
    state.livingWorld.lastNatureDay = Number(state.livingWorld.lastNatureDay || 0);
    state.livingWorld.introShown = !!state.livingWorld.introShown;
    state.livingWorld.activeEncounter = state.livingWorld.activeEncounter || null;
    state.livingWorld.socialEventCount = Number(state.livingWorld.socialEventCount || 0);
    state.livingWorld.nextVisitorDay = Number(state.livingWorld.nextVisitorDay || 0);
    state.livingWorld.nextVisitorKind = state.livingWorld.nextVisitorKind || null;
    state.livingWorld.nextVisitorReason = state.livingWorld.nextVisitorReason || null;
    state.livingWorld.visitorSeen = !!state.livingWorld.visitorSeen;
    state.livingWorld.merchantSeen = !!state.livingWorld.merchantSeen;
    state.livingWorld.socialBootstrapVersion = state.livingWorld.socialBootstrapVersion || SOCIAL_BOOTSTRAP_VERSION;
    if (!Number.isFinite(Number(state.livingWorld.nextVisitorAt)) || Number(state.livingWorld.nextVisitorAt) <= 0) {
      const legacyDay = Number(state.livingWorld.nextVisitorDay || 0);
      state.livingWorld.nextVisitorAt = legacyDay > 0 ? legacyDay * 24 + 10 : null;
    }
    state.visitors = Array.isArray(state.visitors) ? state.visitors : [];
    if (!Number.isFinite(Number(state.livingWorld.nextVisitorAt)) || Number(state.livingWorld.nextVisitorAt) <= 0) scheduleNextVisitor(true, state.livingWorld);
    state.world.livingWorld = state.livingWorld;
    return state.livingWorld;
  }

  function enhanceWorldWithWater(world, config = {}) {
    if (!world?.terrain || world.livingWorld?.waterEnhanced) return world;
    const rand = typeof seededRandom === 'function' ? seededRandom(`${world.seed}|living-water-v2`) : Math.random;
    const cols = world.cols;
    const rows = world.rows;
    const waterTiles = normalizeWaterTileSet(world.waterTiles);
    const spawn = world.spawn || { x: Math.floor(cols / 2), y: Math.floor(rows / 2) };
    const waterBias = Number(world.planetScan?.biomeStats?.water || 0) / 100;
    const pondCount = Math.max(2, Math.min(8, Math.floor((cols * rows) / 4800) + Math.round(waterBias * 4)));

    for (let i = 0; i < pondCount; i++) {
      const cx = 4 + Math.floor(rand() * Math.max(1, cols - 8));
      const cy = 4 + Math.floor(rand() * Math.max(1, rows - 8));
      if (Math.hypot(cx - spawn.x, cy - spawn.y) < 9) continue;
      const rx = 2 + Math.floor(rand() * 5);
      const ry = 2 + Math.floor(rand() * 4);
      for (let y = cy - ry - 1; y <= cy + ry + 1; y++) {
        for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
          if (!insideWorld(world, x, y)) continue;
          const d = ((x - cx) / Math.max(1, rx)) ** 2 + ((y - cy) / Math.max(1, ry)) ** 2;
          if (d < 1 + rand() * 0.26) addWaterTile(world, x, y, waterTiles, d < 0.42 ? 2 : 1);
        }
      }
    }

    if (cols * rows >= 2600) carveRiver(world, waterTiles, rand, spawn);
    world.waterTiles = [...waterTiles];
    world.waterDepth = world.waterDepth || [];
    world.objects = (world.objects || []).filter(obj => !waterTiles.has(`${obj.x},${obj.y}`));
    world.livingWorld = { ...(world.livingWorld || {}), waterEnhanced: true, waterTiles: world.waterTiles, version: 'living-world-v3' };
    return world;
  }

  function normalizeWaterTileSet(tiles = []) {
    const set = new Set();
    for (const tile of tiles || []) {
      if (typeof tile === 'string') set.add(tile);
      else if (tile && Number.isFinite(Number(tile.x)) && Number.isFinite(Number(tile.y))) set.add(`${Math.round(tile.x)},${Math.round(tile.y)}`);
    }
    return set;
  }

  function insideWorld(world, x, y) {
    return x >= 0 && y >= 0 && x < world.cols && y < world.rows;
  }

  function addWaterTile(world, x, y, set, depth = 1) {
    const key = `${x},${y}`;
    set.add(key);
    world.terrain[y][x] = WATER_TILE;
    world.waterDepth = world.waterDepth || [];
    world.waterDepth[y] = world.waterDepth[y] || [];
    world.waterDepth[y][x] = depth;
  }

  function carveRiver(world, set, rand, spawn) {
    let x = Math.floor(rand() * world.cols);
    let y = 0;
    const targetX = Math.floor(rand() * world.cols);
    while (y < world.rows) {
      if (Math.hypot(x - spawn.x, y - spawn.y) > 6) {
        addWaterTile(world, x, y, set, 1);
        if (insideWorld(world, x + 1, y) && rand() > 0.55) addWaterTile(world, x + 1, y, set, 1);
      }
      x += Math.sign(targetX - x) * (rand() > 0.58 ? 1 : 0) + (rand() > 0.82 ? (rand() > 0.5 ? 1 : -1) : 0);
      x = clamp(x, 1, world.cols - 2);
      y++;
    }
  }

  function isWaterTile(x, y) {
    return state?.terrain?.[y]?.[x] === WATER_TILE || normalizeWaterTileSet(state?.world?.waterTiles || []).has(`${x},${y}`);
  }

  function isBridgeAt(x, y) {
    const obj = typeof getObjectAt === 'function' ? getObjectAt(x, y) : null;
    return obj && BRIDGE_TYPES.has(obj.type);
  }

  function waterCollisionAt(x, y) {
    if (!isWaterTile(x, y)) return null;
    if (isBridgeAt(x, y)) return { type: 'water_bridge', blocks: false, cost: 1 };
    return { type: 'water', blocks: true, cost: (state?.world?.waterDepth?.[y]?.[x] || 1) >= 2 ? 3 : 1.6 };
  }

  function drawWaterTile(x, y, type) {
    if (type !== WATER_TILE) return;
    const depth = state?.world?.waterDepth?.[y]?.[x] || 1;
    const t = typeof getTileSize === 'function' ? getTileSize() : TILE;
    const px = x * t, py = y * t;
    const pulse = Math.sin(performance.now() / 760 + x * 0.6 + y * 0.4) * 0.05;
    ctx.save();
    ctx.fillStyle = depth >= 2 ? `rgba(20, 85, 148, ${0.78 + pulse})` : `rgba(38, 139, 190, ${0.58 + pulse})`;
    ctx.fillRect(px, py, t, t);
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#c7f4ff';
    ctx.beginPath();
    ctx.moveTo(px + 8, py + 18 + pulse * 40);
    ctx.bezierCurveTo(px + 18, py + 10, px + 30, py + 26, px + t - 7, py + 15);
    ctx.stroke();
    ctx.restore();
  }

  function livingWorldTick(dt) {
    if (!state || appScreen !== SCREEN.PLAYING) return;
    const living = ensureRuntimeState();
    if (!living) return;
    maybeOpenIntroBriefing();
    const tick = dt * Number(state.speed || 1);
    updateWaterExposure(tick);
    updateVisitors(tick);
    maybeSpawnVisitors();
    maybeRegenerateNature();
    if (isGlobalMapOpen()) renderGlobalMap();
  }

  function updateWaterExposure(tick) {
    for (const c of state.colonists || []) {
      const x = Math.round(c.x);
      const y = Math.round(c.y);
      const inWater = isWaterTile(x, y) && !isBridgeAt(x, y);
      c.wetness = Math.max(0, Number(c.wetness || 0) - tick * (c.equipment?.offhand === 'thermalClothes' ? 0.18 : 0.08));
      if (inWater) {
        const depth = state.world?.waterDepth?.[y]?.[x] || 1;
        c.wetness = Math.min(100, c.wetness + tick * (depth >= 2 ? 16 : 7));
        c.statuses = Array.isArray(c.statuses) ? c.statuses : [];
        if (!c.statuses.includes('molhado')) c.statuses.push('molhado');
        c.note = depth >= 2 ? 'Atravessando água funda' : c.note;
        if (depth >= 2) applyDrowningRisk(c, tick);
      } else if (c.wetness <= 1 && Array.isArray(c.statuses)) {
        c.statuses = c.statuses.filter(status => status !== 'molhado');
      }
    }
  }

  function applyDrowningRisk(c, tick) {
    const swim = swimmingSkill(c);
    const risk = Math.max(0.003, 0.022 - swim * 0.0028);
    if (Math.random() >= risk * tick * Number(state.speed || 1)) return;
    const damage = Math.max(2, 9 - swim * 0.6);
    c.health = clamp((c.health || 100) - damage, 1, 100);
    c.energy = clamp((c.energy || 0) - 8, 0, 100);
    c.mood = clamp((c.mood || 0) - 6, 0, 100);
    c.statuses = Array.isArray(c.statuses) ? c.statuses : [];
    if (!c.statuses.includes('quase_afogou')) c.statuses.push('quase_afogou');
    if (typeof log === 'function') log(`${c.name} passou por apuro atravessando água funda.`);
    if (c.health <= 1 && typeof makeColonistUnconscious === 'function') makeColonistUnconscious(c, 'Quase afogamento');
  }

  function swimmingSkill(c) {
    let score = Number(c?.skills?.defesa || 0) * 0.55 + Number(c?.skills?.coleta || 0) * 0.25;
    if (c?.physicalTraitIds?.includes('agile')) score += 3;
    if (c?.physicalTraitIds?.includes('resilient')) score += 2;
    if (c?.physicalTraitIds?.includes('tires_fast')) score -= 2;
    if (c?.negativeTraitIds?.includes('fearful')) score -= 1;
    return Math.max(0, score);
  }

  function maybeRegenerateNature() {
    const living = state.livingWorld;
    if (!living || living.lastNatureDay === state.day) return;
    living.lastNatureDay = state.day;
    const spawned = regenerateNaturalGrowth();
    if (spawned > 0 && typeof log === 'function') log(`A mata reagiu ao novo dia: ${spawned} plantas surgiram longe da base.`);
  }

  function regenerateNaturalGrowth() {
    const world = state.world;
    const area = world.cols * world.rows;
    const attempts = Math.min(220, Math.max(70, Math.floor(area / 130)));
    const target = Math.max(2, Math.min(9, Math.floor(area / 5200)));
    let spawned = 0;
    for (let i = 0; i < attempts && spawned < target; i++) {
      const x = 2 + Math.floor(Math.random() * Math.max(1, world.cols - 4));
      const y = 2 + Math.floor(Math.random() * Math.max(1, world.rows - 4));
      const score = naturalGrowthScore(x, y);
      if (score <= 0 || Math.random() > Math.min(0.72, score)) continue;
      const type = pickNaturalGrowthType(x, y, score);
      state.objects.push({ id: uid('obj'), type, x, y, naturalGrowth: true });
      state.world.objects = state.objects;
      spawned++;
    }
    if (spawned && typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    return spawned;
  }

  function mountainFootprintBlockedForNature(x, y) {
    if (typeof getRockAt === 'function' && getRockAt(x, y)?.solid) return true;
    if (typeof hasNaturalRoofAt === 'function' && hasNaturalRoofAt(x, y)) return true;
    for (let yy = y - 1; yy <= y + 1; yy++) {
      for (let xx = x - 1; xx <= x + 1; xx++) {
        if (typeof getRockAt === 'function' && getRockAt(xx, yy)?.solid) return true;
      }
    }
    return false;
  }

  function naturalGrowthScore(x, y) {
    const terrain = state.terrain?.[y]?.[x];
    if (!['grass', 'dirt'].includes(terrain)) return 0;
    if (mountainFootprintBlockedForNature(x, y)) return 0;
    if (typeof getObjectAt === 'function' && getObjectAt(x, y)) return 0;
    if (typeof isBlocked === 'function' && isBlocked(x, y)) return 0;
    const spawn = state.world?.spawn || { x: 0, y: 0 };
    if (Math.hypot(x - spawn.x, y - spawn.y) < 14) return 0;
    if (nearbyConstructionCount(x, y, 5) > 1) return 0;
    const water = distanceToNearestWater(x, y, 7);
    const trees = nearbyObjectTypeCountForLiving(x, y, ['tree', 'oak_tree', 'birch_tree', 'pine_tree', 'palm_tree', 'willow_tree', 'cactus', 'bush', 'berry'], 5);
    return 0.12 + (water < 7 ? (7 - water) * 0.045 : 0) + Math.min(0.28, trees * 0.035);
  }

  function pickNaturalGrowthType(x, y, score) {
    const nearWater = distanceToNearestWater(x, y, 4) < 4;
    const roll = Math.random();
    if (nearWater && roll < 0.36) return 'bush';
    if (score > 0.32 && roll < 0.52) return 'berry';
    return roll < 0.62 ? 'bush' : 'tree';
  }

  function nearbyConstructionCount(x, y, radius) {
    let count = 0;
    for (const obj of state.objects || []) {
      if (!obj || !objectDefs?.[obj.type]?.blocks) continue;
      if (Math.abs(obj.x - x) <= radius && Math.abs(obj.y - y) <= radius) count++;
    }
    return count;
  }

  function nearbyObjectTypeCountForLiving(x, y, types, radius) {
    const allowed = new Set(types);
    let count = 0;
    for (const obj of state.objects || []) {
      if (!allowed.has(obj.type)) continue;
      if (Math.abs(obj.x - x) <= radius && Math.abs(obj.y - y) <= radius) count++;
    }
    return count;
  }

  function livingClockHours() {
    return Number(state?.day || 1) * 24 + Number(state?.hour || 0);
  }

  function stableHash(text = '') {
    let hash = 2166136261;
    for (const char of String(text)) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function stableUnit(seed = '') {
    return (stableHash(seed) % 10000) / 10000;
  }

  function socialSeed(label = '') {
    return `${state?.world?.seed || state?.config?.seed || 'havenfall'}|${state?.config?.difficulty || 'normal'}|${state?.config?.eventIntensity || 'normal'}|${label}`;
  }

  function absoluteDayHour(day = 1, hour = 0) {
    return Math.max(24, Number(day || 1) * 24 + Number(hour || 0));
  }

  function bootstrapContactProfile() {
    const intensity = state?.config?.eventIntensity || 'normal';
    if (intensity === 'low') return { visitorDay: 1, visitorMin: 10.0, visitorMax: 12.4, merchantDay: 2, merchantMin: 13.0, merchantMax: 17.4 };
    if (intensity === 'high') return { visitorDay: 1, visitorMin: 7.4, visitorMax: 10.2, merchantDay: 1, merchantMin: 15.0, merchantMax: 19.2 };
    return { visitorDay: 1, visitorMin: 8.2, visitorMax: 11.5, merchantDay: 2, merchantMin: 9.0, merchantMax: 14.8 };
  }

  function bootstrapContactTime(day, minHour, maxHour, salt) {
    const spread = Math.max(0.2, maxHour - minHour);
    return absoluteDayHour(day, minHour + stableUnit(socialSeed(salt)) * spread);
  }

  function setScheduledVisitor(living, at, kind, reason) {
    if (!living || !Number.isFinite(Number(at))) return null;
    living.nextVisitorAt = Number(at);
    living.nextVisitorDay = Math.max(1, Math.floor(Number(at) / 24));
    living.nextVisitorKind = kind || null;
    living.nextVisitorReason = reason || null;
    return living.nextVisitorAt;
  }

  function scheduleBootstrapSocialEvent(forceEarly = false, living = state?.livingWorld) {
    if (!living) return null;
    living.socialBootstrapVersion = SOCIAL_BOOTSTRAP_VERSION;
    const now = livingClockHours();
    const profile = bootstrapContactProfile();

    if (!living.visitorSeen && Number(state?.day || 1) <= 2) {
      const plannedVisitor = bootstrapContactTime(profile.visitorDay, profile.visitorMin, profile.visitorMax, 'first-visitor');
      if (forceEarly || Number(living.socialEventCount || 0) <= 0 || !Number.isFinite(Number(living.nextVisitorAt))) {
        return setScheduledVisitor(living, plannedVisitor <= now ? now + 0.35 : plannedVisitor, 'visitor', 'bootstrap-first-visitor');
      }
    }

    const merchantWindowClosesAt = absoluteDayHour(Math.max(2, profile.merchantDay), 21);
    if (!living.merchantSeen && Number(living.socialEventCount || 0) >= 1 && now <= merchantWindowClosesAt) {
      const plannedMerchant = bootstrapContactTime(profile.merchantDay, profile.merchantMin, profile.merchantMax, 'first-merchant');
      return setScheduledVisitor(living, plannedMerchant <= now ? now + 0.45 : plannedMerchant, 'merchant', 'bootstrap-first-merchant');
    }

    return null;
  }

  function livingUid(prefix = 'living') {
    return typeof uid === 'function'
      ? uid(prefix)
      : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function tileDistance(ax, ay, bx, by) {
    return Math.hypot((Number(ax) || 0) - (Number(bx) || 0), (Number(ay) || 0) - (Number(by) || 0));
  }

  function blockedTile(x, y) {
    return typeof isBlocked === 'function' ? isBlocked(x, y) : false;
  }

  function objectAtTile(x, y) {
    return typeof getObjectAt === 'function' ? getObjectAt(x, y) : null;
  }

  function currentBasePoint() {
    return state?.world?.spawn || state?.colonists?.[0] || { x: Math.floor(getWorldCols() / 2), y: Math.floor(getWorldRows() / 2) };
  }

  function socialIntensityProfile() {
    const intensity = state?.config?.eventIntensity || 'normal';
    if (intensity === 'low') return { firstMin: 5.5, firstMax: 8.0, revisitMin: 30, revisitMax: 42, merchantChance: 0.28 };
    if (intensity === 'high') return { firstMin: 3.0, firstMax: 5.0, revisitMin: 18, revisitMax: 28, merchantChance: 0.40 };
    return { firstMin: 4.0, firstMax: 6.5, revisitMin: 22, revisitMax: 34, merchantChance: 0.33 };
  }

  function scheduleNextVisitor(forceEarly = false, living = state?.livingWorld) {
    if (!living) return null;
    const bootstrapAt = scheduleBootstrapSocialEvent(forceEarly, living);
    if (Number.isFinite(Number(bootstrapAt))) return bootstrapAt;
    const profile = socialIntensityProfile();
    const min = forceEarly ? profile.firstMin : profile.revisitMin;
    const max = forceEarly ? profile.firstMax : profile.revisitMax;
    const next = livingClockHours() + min + Math.random() * Math.max(0.5, max - min);
    return setScheduledVisitor(living, next, null, forceEarly ? 'ambient-early' : 'ambient-repeat');
  }

  function livingRound1(value) {
    return Math.round((Number(value) || 0) * 10) / 10;
  }

  function debugScheduleSnapshot() {
    const living = ensureRuntimeState();
    if (!living) return null;
    const now = livingClockHours();
    const nextVisitorAt = Number(living.nextVisitorAt);
    return {
      now,
      day: Number(state?.day || 0),
      hour: livingRound1(state?.hour || 0),
      intensity: state?.config?.eventIntensity || 'normal',
      visitorCount: Array.isArray(state?.visitors) ? state.visitors.length : 0,
      socialEventCount: Number(living.socialEventCount || 0),
      nextVisitorAt: Number.isFinite(nextVisitorAt) ? nextVisitorAt : null,
      nextVisitorDay: Number(living.nextVisitorDay || 0),
      nextVisitorKind: living.nextVisitorKind || null,
      nextVisitorReason: living.nextVisitorReason || null,
      merchantSeen: !!living.merchantSeen,
      visitorSeen: !!living.visitorSeen,
      etaHours: Number.isFinite(nextVisitorAt) ? Math.max(0, livingRound1(nextVisitorAt - now)) : null,
      activeEncounterId: living.activeEncounter?.id || null,
      activeEncounterType: living.activeEncounter?.type || null
    };
  }

  function livingWorldDebugProvider(context = {}) {
    const schedule = debugScheduleSnapshot();
    if (!schedule) return null;

    const nextLine = Number.isFinite(schedule.nextVisitorAt)
      ? `proximo ${schedule.nextVisitorKind === 'merchant' ? 'mercador' : 'visitante'} D${schedule.nextVisitorDay} em ${livingRound1(schedule.etaHours)}h`
      : 'proximo visitante nao agendado';

    const sections = [
      {
        title: 'Eventos sociais',
        accent: '#67e8f9',
        lines: [
          `agora D${schedule.day} ${schedule.hour}h | intensidade ${schedule.intensity}`,
          nextLine,
          schedule.nextVisitorReason ? `agenda ${schedule.nextVisitorReason}` : 'agenda livre',
          `visitantes ativos ${schedule.visitorCount} | eventos ${schedule.socialEventCount}`,
          schedule.activeEncounterId ? `encontro ativo ${schedule.activeEncounterType || 'encounter'}:${schedule.activeEncounterId}` : 'nenhum encontro ativo'
        ]
      }
    ];

    const world = [];
    const bounds = context?.bounds || null;
    const inBounds = (x, y) => !bounds || (x >= bounds.startX && x <= bounds.endX && y >= bounds.startY && y <= bounds.endY);
    const base = currentBasePoint();

    if (inBounds(base.x, base.y)) {
      world.push({
        kind: 'label',
        x: base.x * TILE + TILE / 2,
        y: base.y * TILE + 10,
        text: Number.isFinite(schedule.etaHours) ? `evento em ${livingRound1(schedule.etaHours)}h` : 'sem evento agendado',
        color: '#67e8f9',
        bg: 'rgba(6,22,33,.88)'
      });
    }

    for (const visitor of state?.visitors || []) {
      if (!visitor || !inBounds(visitor.x, visitor.y)) continue;
      world.push({
        kind: 'point',
        x: Number(visitor.px || (visitor.x * TILE + TILE / 2)),
        y: Number(visitor.py || (visitor.y * TILE + TILE / 2)),
        radius: visitor.kind === 'merchant' ? 12 : 10,
        color: visitor.kind === 'merchant' ? '#f6c76a' : '#67e8f9',
        fill: visitor.kind === 'merchant' ? 'rgba(246,199,106,.16)' : 'rgba(103,232,249,.12)',
        label: `${visitor.kind === 'merchant' ? 'Mercador' : 'Visitante'} ${visitor.stage || 'idle'}`
      });
    }

    return { sections, world };
  }

  function findVisitorById(id) {
    return (state?.visitors || []).find(visitor => String(visitor?.id) === String(id)) || null;
  }

  function removeVisitorById(id) {
    const list = state?.visitors || [];
    const index = list.findIndex(visitor => String(visitor?.id) === String(id));
    if (index < 0) return null;
    const [removed] = list.splice(index, 1);
    return removed || null;
  }

  function visitorStory(seed = 0) {
    const story = VISITOR_STORIES[Math.abs(seed) % VISITOR_STORIES.length] || VISITOR_STORIES[0];
    return {
      key: story.key,
      label: story.label,
      intro: story.intro,
      recruitBase: story.recruitBase,
      aidLabel: story.aidLabel,
      aidEffect: story.aidEffect,
      rumorText: story.rumorText,
      aidCost: {
        resources: { ...(story.aidCost?.resources || {}) },
        items: { ...(story.aidCost?.items || {}) }
      }
    };
  }

  function nextColonistNumericId() {
    return (state?.colonists || []).reduce((max, colonist) => Math.max(max, Number(colonist?.id) || 0), 0) + 1;
  }

  function stripVisitorPrefix(name = '') {
    return String(name || '').replace(/^Mercador\s+/i, '').replace(/^Visitante\s+/i, '').trim() || 'Recem-chegado';
  }

  function ensureItemState() {
    state.items = state.items || {};
    return state.items;
  }

  function cleanEntryMap(entries = {}) {
    const out = {};
    for (const [key, value] of Object.entries(entries || {})) {
      const amount = Number(value || 0);
      if (Number.isFinite(amount) && amount > 0) out[key] = amount;
    }
    return out;
  }

  function entryBag(kind) {
    if (kind === 'items') return ensureItemState();
    state.resources = state.resources || {};
    return state.resources;
  }

  function hasEntryMap(kind, entries = {}) {
    const bag = entryBag(kind);
    return Object.entries(cleanEntryMap(entries)).every(([key, value]) => Number(bag[key] || 0) >= value);
  }

  function mutateEntryMap(kind, entries = {}, delta = 1) {
    const bag = entryBag(kind);
    for (const [key, value] of Object.entries(cleanEntryMap(entries))) {
      bag[key] = Math.max(0, Number(bag[key] || 0) + value * delta);
    }
    return bag;
  }

  function hasPayload(payload = null) {
    if (!payload) return true;
    return hasEntryMap('resources', payload.resources) && hasEntryMap('items', payload.items);
  }

  function payPayload(payload = null, reason = 'living-world') {
    if (!payload) return true;
    if (!hasPayload(payload)) return false;
    if (payload.resources) {
      if (typeof payResources === 'function') payResources(payload.resources, { reason, requireEnough: true });
      else mutateEntryMap('resources', payload.resources, -1);
    }
    if (payload.items) {
      if (typeof payItems === 'function') payItems(payload.items, { reason, requireEnough: true });
      else mutateEntryMap('items', payload.items, -1);
    }
    return true;
  }

  function givePayload(payload = null, reason = 'living-world') {
    if (!payload) return true;
    if (payload.resources) {
      if (typeof addResources === 'function') addResources(payload.resources, { reason });
      else mutateEntryMap('resources', payload.resources, 1);
    }
    if (payload.items) {
      if (typeof addItems === 'function') addItems(payload.items, { reason });
      else mutateEntryMap('items', payload.items, 1);
    }
    return true;
  }

  function labelEntry(key, kind = 'resources') {
    if (kind === 'items') return itemDefs?.[key]?.label || ITEM_LABELS[key] || key;
    return RESOURCE_LABELS[key] || key;
  }

  function payloadText(payload = null) {
    if (!payload) return 'nada';
    const parts = [];
    for (const [key, value] of Object.entries(cleanEntryMap(payload.resources))) parts.push(`${value} ${labelEntry(key, 'resources')}`);
    for (const [key, value] of Object.entries(cleanEntryMap(payload.items))) parts.push(`${value} ${labelEntry(key, 'items')}`);
    return parts.join(', ') || 'nada';
  }

  function escapeEncounterText(value = '') {
    return typeof escapeHtml === 'function'
      ? escapeHtml(value)
      : String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function ensureEncounterModal() {
    if (encounterModal?.isConnected) return encounterModal;
    if (typeof document?.createElement !== 'function' || !document.body) return null;

    if (!document.getElementById('living-world-event-style')) {
      const style = document.createElement('style');
      style.id = 'living-world-event-style';
      style.textContent = `
        #eventModal.living-world-event{position:fixed;inset:0;top:auto;left:auto;transform:none;width:100vw;max-width:none;max-height:none;overflow:visible;z-index:10001;display:none;place-items:center;padding:20px;background:rgba(3,7,13,.82);backdrop-filter:blur(10px)}
        #eventModal.living-world-event.show{display:grid}
        #eventModal .living-event-card{width:min(620px,calc(100vw - 32px));display:grid;gap:14px;padding:22px;border-radius:22px;border:1px solid rgba(214,162,74,.34);background:linear-gradient(180deg,rgba(18,24,34,.98),rgba(7,10,16,.98));box-shadow:0 30px 90px rgba(0,0,0,.62);color:#f6efe1}
        #eventModal .living-event-kicker{color:#d6a24a;font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}
        #eventModal h2{margin:0;color:#fff4dd;font-size:30px;line-height:1.02}
        #eventModal p{margin:0;color:#d6cfbf;line-height:1.5}
        #eventModal .living-event-actions{display:grid;gap:10px}
        #eventModal .living-event-actions button{display:grid;gap:3px;text-align:left;min-height:54px;padding:12px 14px;border-radius:14px;border:1px solid rgba(214,162,74,.22);background:rgba(18,25,36,.86);color:#f7f2e8;font-weight:800;cursor:pointer}
        #eventModal .living-event-actions button:hover:not(:disabled){border-color:rgba(214,162,74,.62);transform:translateY(-1px)}
        #eventModal .living-event-actions button:disabled{opacity:.52;cursor:not-allowed}
        #eventModal .living-event-actions small{color:#9fb0c2;font-weight:600}
      `;
      document.head?.appendChild(style);
    }

    encounterModal = document.getElementById('eventModal');
    if (!encounterModal) {
      encounterModal = document.createElement('section');
      encounterModal.id = 'eventModal';
      encounterModal.className = 'game-popup-modal living-world-event';
      encounterModal.hidden = true;
      encounterModal.setAttribute('aria-hidden', 'true');
      encounterModal.innerHTML = `
        <article class="living-event-card" role="dialog" aria-modal="true">
          <div class="living-event-kicker" data-encounter-kicker>Evento</div>
          <h2 data-encounter-title></h2>
          <p data-encounter-body></p>
          <div class="living-event-actions" data-encounter-actions></div>
        </article>
      `;
      document.body.appendChild(encounterModal);
    }

    if (encounterModal.dataset.boundLivingWorld !== '1') {
      encounterModal.dataset.boundLivingWorld = '1';
      encounterModal.addEventListener('click', handleEncounterClick);
      encounterModal.addEventListener('pointerdown', event => event.stopPropagation());
      encounterModal.addEventListener('wheel', event => { event.preventDefault(); event.stopPropagation(); }, { passive: false });
    }
    return encounterModal;
  }

  function renderEncounter(encounter) {
    const modal = ensureEncounterModal();
    if (!modal || !encounter) return false;
    const kicker = modal.querySelector('[data-encounter-kicker]');
    const title = modal.querySelector('[data-encounter-title]');
    const body = modal.querySelector('[data-encounter-body]');
    const actions = modal.querySelector('[data-encounter-actions]');
    if (kicker) kicker.textContent = encounter.kicker || 'Evento';
    if (title) title.textContent = encounter.title || 'Aconteceu algo';
    if (body) body.textContent = encounter.body || '';
    if (actions) {
      actions.innerHTML = (encounter.buttons || []).map(button => `
        <button type="button" data-encounter-action="${escapeEncounterText(button.action || 'close')}" ${button.disabled ? 'disabled' : ''}>
          <span>${escapeEncounterText(button.label || 'Continuar')}</span>
          ${button.hint ? `<small>${escapeEncounterText(button.hint)}</small>` : ''}
        </button>
      `).join('');
    }
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('show', 'is-active');
    return true;
  }

  function setActiveEncounter(encounter, options = {}) {
    const living = ensureRuntimeState();
    if (!living || !encounter) return false;
    living.activeEncounter = encounter;
    const rendered = renderEncounter(encounter);
    if (rendered && options.pause !== false) pauseForEncounter();
    return rendered;
  }

  function openEncounter(encounter) {
    return setActiveEncounter(encounter, { pause: true });
  }

  function replaceEncounter(encounter) {
    return setActiveEncounter(encounter, { pause: false });
  }

  function closeEncounter(resume = true) {
    if (state?.livingWorld) state.livingWorld.activeEncounter = null;
    const modal = ensureEncounterModal();
    modal?.classList.remove('show', 'is-active');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    }
    if (resume) resumeFromEncounter();
  }

  function pauseForEncounter() {
    const living = ensureRuntimeState();
    if (!living || living.pauseLock) return;
    living.pauseLock = true;
    living.resumeSpeed = Math.max(1, Number(state.speed || 1));
    state.speed = 0;
    if (typeof updateUI === 'function') updateUI(true);
  }

  function resumeFromEncounter() {
    const living = state?.livingWorld;
    if (!living?.pauseLock) return;
    living.pauseLock = false;
    if (appScreen === SCREEN.PLAYING) state.speed = Math.max(1, Number(living.resumeSpeed || 1));
    delete living.resumeSpeed;
    if (typeof updateUI === 'function') updateUI(true);
  }

  function handleEncounterClick(event) {
    const action = event.target.closest?.('[data-encounter-action]')?.dataset?.encounterAction;
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    chooseEncounterAction(action);
  }

  function focusTaskObjectives() {
    if (window.HavenfallUI?.openPanel) window.HavenfallUI.openPanel('tasks');
    else if (typeof setHudTab === 'function') setHudTab('tasks');
    if (typeof updateUI === 'function') updateUI(true);
  }

  function maybeOpenIntroBriefing() {
    const living = ensureRuntimeState();
    if (!living || living.introShown || living.activeEncounter) return false;
    const loadingOverlay = typeof document?.getElementById === 'function' ? document.getElementById('havenfallRuntimeLoadingOverlay') : null;
    if (loadingOverlay?.classList?.contains('show') || document?.body?.classList?.contains?.('runtime-loading-active')) return false;
    if ((state?.day || 1) > 2) {
      living.introShown = true;
      return false;
    }
    living.introShown = true;
    if (typeof log === 'function') log('Briefing inicial: monte 2 camas, 1 fogueira e uma mesa de pesquisa para estabilizar a colonia.');
    return openEncounter({
      key: 'intro',
      kicker: 'Primeiras horas',
      title: 'A colonia precisa de ritmo',
      body: 'Voce pousou, mas ainda nao existe rotina clara. Prioridades imediatas: construir 2 camas, 1 fogueira e 1 mesa de pesquisa. Depois organize comida e pelo menos 1 remedio.',
      buttons: [
        { action: 'intro_tasks', label: 'Abrir objetivos', hint: 'Foca o painel de tarefas e metas.' },
        { action: 'intro_close', label: 'Fechar briefing', hint: 'Continuar jogando.' }
      ]
    });
  }

  function createRumorWaypoint(label = 'Sinal de atividade') {
    const base = currentBasePoint();
    for (let i = 0; i < 90; i++) {
      const x = 2 + Math.floor(Math.random() * Math.max(1, getWorldCols() - 4));
      const y = 2 + Math.floor(Math.random() * Math.max(1, getWorldRows() - 4));
      if (tileDistance(x, y, base.x, base.y) < 12) continue;
      if (blockedTile(x, y) || isWaterTile(x, y)) continue;
      return createWaypoint(x, y, 'social_rumor', label);
    }
    return null;
  }

  function shareVisitorRumor(visitor, fromMerchant = false) {
    const label = fromMerchant ? 'Rastro comercial' : 'Sinal de sobreviventes';
    const waypoint = createRumorWaypoint(label);
    const detail = fromMerchant
      ? 'O mercador comenta sobre movimento recente alem da rota principal.'
      : (visitor?.story?.rumorText || 'O visitante descreve um ponto curioso nas redondezas.');
    if (typeof log === 'function') log(`${visitor?.name || 'Visitante'} compartilhou um rumor: ${detail}${waypoint ? ` Novo ponto marcado: ${waypoint.label}.` : ''}`);
    return waypoint;
  }

  function recruitChance(visitor) {
    const story = visitor?.story || VISITOR_STORIES[0];
    let chance = Number(story.recruitBase || 0.4);
    if (visitor?.helped) chance += 0.18;
    if ((state?.colonists?.length || 0) <= 3) chance += 0.07;
    if ((state?.resources?.food || 0) >= 40) chance += 0.06;
    if (state?.config?.difficulty === 'hard') chance -= 0.05;
    if (state?.config?.difficulty === 'hardcore') chance -= 0.10;
    return clamp(chance, 0.12, 0.92);
  }

  function defaultPrioritySet(workPreferenceId = 'gather') {
    const presets = {
      gather: { gather: 4, build: 2, research: 1, handle: 2 },
      build: { gather: 2, build: 4, research: 1, handle: 2 },
      defense: { gather: 1, build: 1, research: 1, handle: 1 },
      research: { gather: 1, build: 1, research: 4, handle: 2 },
      cooking: { gather: 1, build: 1, research: 2, handle: 3 },
      medicine: { gather: 1, build: 1, research: 2, handle: 3 }
    };
    return { ...(presets[workPreferenceId] || presets.gather) };
  }

  function visitorCandidate(visitor) {
    const config = state?.config || defaultNewGameConfig;
    const seed = `${config?.seed || 'havenfall'}|visitor|${visitor?.id || 'guest'}|${visitor?.story?.key || visitor?.kind || 'wanderer'}`;
    if (typeof createColonistCandidate === 'function') {
      const candidate = createColonistCandidate((state?.colonists?.length || 0) % 8, config, seed);
      candidate.name = stripVisitorPrefix(visitor?.name);
      return candidate;
    }
    return {
      name: stripVisitorPrefix(visitor?.name),
      sprite: 'colonist',
      role: 'Generalista',
      age: 24,
      skills: { coleta: 4, construcao: 4, defesa: 3, pesquisa: 2, medicina: 1 },
      needs: { hunger: 74, energy: 66, mood: 62, health: visitor?.story?.key === 'injured_refugee' ? 72 : 88 },
      workPreferenceId: 'gather',
      physicalTraitIds: [],
      positiveTraitIds: [],
      negativeTraitIds: []
    };
  }

  function recruitVisitor(visitor) {
    if (!visitor) return null;
    const candidate = visitorCandidate(visitor);
    const spawn = nearbyOpenTile(currentBasePoint().x, currentBasePoint().y, 4) || { x: visitor.x, y: visitor.y };
    const colonistId = nextColonistNumericId();
    let colonist = null;
    if (typeof candidateToColonist === 'function') colonist = candidateToColonist(candidate, colonistId, spawn.x, spawn.y);
    else if (typeof makeColonist === 'function') colonist = makeColonist(colonistId, candidate.name, candidate.sprite || 'colonist', spawn.x, spawn.y, candidate.role || 'Generalista');
    if (!colonist) return null;
    colonist.note = 'Recem-chegado';
    colonist.mood = clamp(Number(colonist.mood || 65), 0, 100);
    colonist.energy = clamp(Number(colonist.energy || 68), 0, 100);
    colonist.health = clamp(Number(colonist.health || (visitor?.story?.key === 'injured_refugee' ? 72 : 90)), 1, 100);
    state.colonists = Array.isArray(state.colonists) ? state.colonists : [];
    state.taskPriorities = state.taskPriorities || {};
    state.taskPriorities[colonist.id] = defaultPrioritySet(candidate.workPreferenceId || colonist.workPreferenceId || colonist.priority);
    state.colonists.push(colonist);
    removeVisitorById(visitor.id);
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    window.HavenfallRuntime?.bumpPathVersion?.(state, 'visitor-joined');
    if (typeof updateUI === 'function') updateUI(true);
    return colonist;
  }

  function sendVisitorAway(visitor, message = '') {
    if (!visitor) return false;
    visitor.stage = 'leaving';
    visitor.target = visitor.exitTarget || randomLivingEdgeTile() || visitor.target;
    visitor.pause = 0;
    if (message && typeof log === 'function') log(message);
    return true;
  }

  function buildMerchantEncounter(visitor) {
    const offerLabel = `${payloadText(visitor?.offer?.cost)} por ${payloadText(visitor?.offer?.gain)}`;
    const tradeHint = hasPayload(visitor?.offer?.cost) ? 'Fecha negocio imediato.' : `Falta ${payloadText(visitor?.offer?.cost)}.`;
    return {
      key: 'merchant',
      visitorId: visitor.id,
      kicker: 'Mercador itinerante',
      title: `${visitor.name} montou uma banca`,
      body: `${visitor.name} chegou com pouco peso e quer uma troca direta: ${offerLabel}.`,
      buttons: [
        { action: 'merchant_trade', label: `Trocar ${offerLabel}`, hint: tradeHint, disabled: !hasPayload(visitor?.offer?.cost) },
        { action: 'merchant_rumor', label: 'Pedir rumores', hint: 'Coleta pistas sobre o setor.' },
        { action: 'merchant_leave', label: 'Dispensar', hint: 'Ele segue viagem sem negociar.' }
      ]
    };
  }

  function buildVisitorEncounter(visitor, followup = '') {
    const story = visitor?.story || visitorStory(0);
    return {
      key: 'visitor',
      visitorId: visitor.id,
      kicker: story.label,
      title: `${visitor.name} pede audiencia`,
      body: followup || story.intro,
      buttons: [
        {
          action: 'visitor_aid',
          label: visitor?.helped ? 'Ajuda entregue' : story.aidLabel,
          hint: visitor?.helped ? 'O visitante ja recebeu apoio.' : `Custa ${payloadText(story.aidCost)}.`,
          disabled: !!visitor?.helped || !hasPayload(story.aidCost)
        },
        { action: 'visitor_rumor', label: 'Ouvir historia', hint: 'Pode gerar um novo ponto de interesse.' },
        { action: 'visitor_invite', label: 'Convidar para ficar', hint: `Chance aproximada: ${Math.round(recruitChance(visitor) * 100)}%.` },
        { action: 'visitor_leave', label: 'Mandar seguir viagem', hint: 'Sem assumir compromisso.' }
      ]
    };
  }

  function openVisitorEncounter(visitor) {
    if (!visitor || state?.livingWorld?.activeEncounter) return false;
    visitor.stage = 'interacting';
    visitor.pause = 0;
    visitor.encountered = true;
    const encounter = visitor.kind === 'merchant' ? buildMerchantEncounter(visitor) : buildVisitorEncounter(visitor);
    if (!openEncounter(encounter)) {
      visitor.stage = 'idle';
      visitor.encountered = false;
      return false;
    }
    return true;
  }

  function chooseEncounterAction(action = '') {
    const encounter = state?.livingWorld?.activeEncounter;
    if (!encounter) return false;
    const visitor = encounter.visitorId ? findVisitorById(encounter.visitorId) : null;

    if (action === 'intro_tasks') {
      focusTaskObjectives();
      closeEncounter(true);
      return true;
    }
    if (action === 'intro_close') {
      closeEncounter(true);
      return true;
    }
    if (action === 'merchant_trade') {
      if (visitor?.offer && payPayload(visitor.offer.cost, 'merchant-trade')) {
        givePayload(visitor.offer.gain, 'merchant-trade');
        if (typeof log === 'function') log(`${visitor.name} fechou negocio: ${payloadText(visitor.offer.cost)} por ${payloadText(visitor.offer.gain)}.`);
      } else if (typeof log === 'function') {
        log(`Recursos insuficientes para negociar com ${visitor?.name || 'o mercador'}.`);
      }
      sendVisitorAway(visitor, `${visitor?.name || 'O mercador'} recolheu a banca e seguiu estrada afora.`);
      closeEncounter(true);
      return true;
    }
    if (action === 'merchant_rumor') {
      shareVisitorRumor(visitor, true);
      sendVisitorAway(visitor, `${visitor?.name || 'O mercador'} seguiu viagem depois da conversa.`);
      closeEncounter(true);
      return true;
    }
    if (action === 'merchant_leave') {
      sendVisitorAway(visitor, `${visitor?.name || 'O mercador'} seguiu viagem sem negociar.`);
      closeEncounter(true);
      return true;
    }
    if (action === 'visitor_aid') {
      if (!visitor?.story?.aidCost || !payPayload(visitor.story.aidCost, 'visitor-aid')) {
        if (typeof log === 'function') log(`Faltam recursos para ajudar ${visitor?.name || 'o visitante'}.`);
        closeEncounter(true);
        return false;
      }
      visitor.helped = true;
      visitor.leaveAt += 6;
      for (const colonist of state?.colonists || []) colonist.mood = clamp(Number(colonist.mood || 0) + 2, 0, 100);
      if (typeof log === 'function') log(`${visitor.name} recebeu ajuda. ${visitor.story.aidEffect}`);
      replaceEncounter(buildVisitorEncounter(visitor, `${visitor.story.aidEffect} Agora ele considera melhor a ideia de ficar por perto.`));
      return true;
    }
    if (action === 'visitor_rumor') {
      shareVisitorRumor(visitor, false);
      sendVisitorAway(visitor, `${visitor?.name || 'O visitante'} seguiu viagem depois de compartilhar o que sabia.`);
      closeEncounter(true);
      return true;
    }
    if (action === 'visitor_invite') {
      if (Math.random() <= recruitChance(visitor)) {
        const colonist = recruitVisitor(visitor);
        if (typeof log === 'function') log(`${colonist?.name || stripVisitorPrefix(visitor?.name)} aceitou se juntar a colonia.`);
      } else {
        sendVisitorAway(visitor, `${visitor?.name || 'O visitante'} agradeceu, mas preferiu continuar na estrada.`);
      }
      closeEncounter(true);
      return true;
    }
    if (action === 'visitor_leave') {
      sendVisitorAway(visitor, `${visitor?.name || 'O visitante'} retomou a estrada em silencio.`);
      closeEncounter(true);
      return true;
    }
    closeEncounter(true);
    return false;
  }

  function maybeSpawnVisitors() {
    const living = state?.livingWorld;
    if (!living || state.visitors.length >= 4) return;
    const now = livingClockHours();
    if (living.activeEncounter || !Number.isFinite(Number(living.nextVisitorAt)) || now < living.nextVisitorAt) return;
    if (state.hour < 7 || state.hour > 19) return;
    const profile = socialIntensityProfile();
    const kind = living.nextVisitorKind || (Math.random() < profile.merchantChance ? 'merchant' : 'visitor');
    const visitor = spawnVisitor(kind, living.socialEventCount);
    if (!visitor) return;
    living.socialEventCount += 1;
    living.visitorSeen = living.visitorSeen || kind === 'visitor';
    living.merchantSeen = living.merchantSeen || kind === 'merchant';
    living.nextVisitorKind = null;
    living.nextVisitorReason = null;
    scheduleNextVisitor(false, living);
    if (typeof log === 'function') log(kind === 'merchant' ? 'Um mercador apareceu nos arredores da colonia.' : 'Uma figura foi avistada vindo pela estrada.');
  }

  function spawnVisitor(kind = 'visitor', index = 0) {
    const edge = randomLivingEdgeTile();
    if (!edge) return null;
    const base = currentBasePoint();
    const target = nearbyOpenTile(base.x, base.y, kind === 'merchant' ? 3 : 5) || { x: base.x, y: base.y };
    const nameSeed = (state.day * 7 + index * 3 + state.visitors.length) % visitorNames.length;
    const visitor = {
      id: livingUid(kind),
      type: kind,
      kind,
      name: `${kind === 'merchant' ? 'Mercador' : 'Visitante'} ${visitorNames[nameSeed]}`,
      x: edge.x,
      y: edge.y,
      px: edge.x * TILE + TILE / 2,
      py: edge.y * TILE + TILE / 2,
      dir: edge.x < target.x ? 'right' : 'left',
      target,
      exitTarget: edge,
      stage: 'arriving',
      speed: kind === 'merchant' ? 15 : 18,
      pause: 0,
      leaveAt: livingClockHours() + VISITOR_STAY_HOURS + Math.random() * 3,
      offer: kind === 'merchant' ? merchantOffer() : null,
      story: kind === 'merchant' ? null : visitorStory(nameSeed + state.day + index),
      appearance: visitorAppearance(kind, nameSeed),
      encountered: false,
      helped: false
    };
    state.visitors.push(visitor);
    return visitor;
  }

  function merchantOffer() {
    const offers = [
      { cost: { resources: { food: 4 } }, gain: { resources: { medicine: 1 } } },
      { cost: { resources: { wood: 14 } }, gain: { items: { cloth: 1 } } },
      { cost: { resources: { stone: 10 } }, gain: { items: { nails: 2 } } },
      { cost: { resources: { food: 5 } }, gain: { items: { rope: 1 } } }
    ];
    const picked = offers[Math.floor(Math.random() * offers.length)] || offers[0];
    return {
      cost: { resources: { ...(picked.cost?.resources || {}) }, items: { ...(picked.cost?.items || {}) } },
      gain: { resources: { ...(picked.gain?.resources || {}) }, items: { ...(picked.gain?.items || {}) } }
    };
  }

  function visitorAppearance(kind, seed) {
    const clothes = kind === 'merchant'
      ? ['#76563b', '#6f5b34', '#594a38']
      : ['#536c72', '#5f6f4b', '#6b6478', '#745e4d'];
    const skins = ['#c98f65', '#b77a52', '#d3a072', '#8f5f43', '#e0b27f'];
    const hairs = ['#2c1b13', '#4b2f1e', '#6b4a2f', '#202022', '#7a5537'];
    return { skin: skins[seed % skins.length], hair: hairs[(seed + 2) % hairs.length], clothes: clothes[seed % clothes.length], accent: kind === 'merchant' ? '#d6a24a' : '#8fb8be' };
  }

  function updateVisitors(tick) {
    const now = livingClockHours();
    for (let i = state.visitors.length - 1; i >= 0; i--) {
      const visitor = state.visitors[i];
      if (!visitor) continue;
      if (visitor.stage !== 'interacting' && visitor.stage !== 'leaving' && now >= visitor.leaveAt) {
        sendVisitorAway(visitor, `${visitor.name} esta deixando a regiao.`);
      }
      moveVisitor(visitor, tick);
      if (!visitor.encountered && !state?.livingWorld?.activeEncounter && visitor.stage === 'idle' && nearColonyCore(visitor, 7)) {
        openVisitorEncounter(visitor);
        continue;
      }
      if (visitor.stage === 'leaving' && visitor.target && tileDistance(visitor.x, visitor.y, visitor.target.x, visitor.target.y) <= 1) {
        state.visitors.splice(i, 1);
      }
    }
  }

  function moveVisitor(visitor, tick) {
    if (!visitor?.target || visitor.stage === 'interacting') return;
    if (visitor.pause > 0) {
      visitor.pause = Math.max(0, visitor.pause - tick);
      return;
    }
    const tx = visitor.target.x * TILE + TILE / 2;
    const ty = visitor.target.y * TILE + TILE / 2;
    const d = Math.hypot(tx - visitor.px, ty - visitor.py);
    if (d < 4) {
      snapActorToTile(visitor, visitor.target.x, visitor.target.y);
      if (visitor.stage === 'arriving') {
        visitor.stage = 'idle';
        visitor.pause = 0.8 + Math.random() * 1.8;
        visitor.target = nearbyOpenTile(visitor.x, visitor.y, visitor.kind === 'merchant' ? 2 : 4) || visitor.target;
      } else if (visitor.stage === 'idle') {
        visitor.pause = 0.6 + Math.random() * 2.4;
        if (Math.random() < 0.35) visitor.target = nearbyOpenTile(visitor.x, visitor.y, visitor.kind === 'merchant' ? 2 : 4) || visitor.target;
      }
      return;
    }
    moveActorVector(visitor, tx - visitor.px, ty - visitor.py, visitor.speed * tick);
  }

  function randomLivingEdgeTile() {
    for (let i = 0; i < 180; i++) {
      const side = Math.floor(Math.random() * 4);
      const x = side === 0 ? 1 : side === 1 ? getWorldCols() - 2 : 1 + Math.floor(Math.random() * Math.max(1, getWorldCols() - 2));
      const y = side === 2 ? 1 : side === 3 ? getWorldRows() - 2 : 1 + Math.floor(Math.random() * Math.max(1, getWorldRows() - 2));
      if (!blockedTile(x, y) && !objectAtTile(x, y)) return { x, y };
    }
    return null;
  }

  function nearbyOpenTile(cx, cy, radius = 5) {
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * radius;
      const x = clamp(Math.round(cx + Math.cos(angle) * r), 1, getWorldCols() - 2);
      const y = clamp(Math.round(cy + Math.sin(angle) * r), 1, getWorldRows() - 2);
      if (!blockedTile(x, y) && !objectAtTile(x, y)) return { x, y };
    }
    return null;
  }

  function nearColonyCore(actor, radius = 6) {
    const base = currentBasePoint();
    if (tileDistance(actor.x, actor.y, base.x, base.y) <= radius) return true;
    return (state?.colonists || []).some(colonist => tileDistance(actor.x, actor.y, colonist.x, colonist.y) <= 2.2);
  }

  function patchAnimalBehavior() {
    if (window.HavenfallContext.livingAnimalBehaviorPatched || typeof updatePassiveMob !== 'function') return;
    nativeUpdatePassiveMob = updatePassiveMob;
    updatePassiveMob = function updateLivingPassiveMob(mob, tick) {
      if (!mob || !animalProfiles[mob.type] || !state?.world) return nativeUpdatePassiveMob(mob, tick);
      const profile = animalProfiles[mob.type];
      mob.brain = mob.brain || { pause: 0, target: null, state: 'idle', anchor: { x: mob.x, y: mob.y }, retargetAt: 0 };
      if (!mob.brain.anchor) mob.brain.anchor = { x: mob.x, y: mob.y };
      if (mob.brain.pause > 0) {
        mob.brain.pause = Math.max(0, mob.brain.pause - tick);
        return;
      }
      const danger = nearestAwareColonist(mob, profile.alertRadius);
      if (danger) {
        const dx = mob.x - danger.x;
        const dy = mob.y - danger.y;
        moveActorVector(mob, dx, dy, Math.max(18, profile.burstSpeed * 0.82) * tick);
        mob.brain.state = 'fleeing';
        mob.brain.target = chooseAnimalTarget(mob, profile, { avoid: danger, multiplier: 1.25 });
        mob.brain.pause = 0.18 + Math.random() * 0.5;
        return;
      }
      mob.brain.retargetAt = Number(mob.brain.retargetAt || 0) - tick;
      if (!mob.brain.target || mob.brain.retargetAt <= 0) {
        mob.brain.target = chooseAnimalTarget(mob, profile);
        mob.brain.retargetAt = 2.4 + Math.random() * 5.6;
      }
      if (!mob.brain.target) {
        mob.brain.pause = 0.9 + Math.random() * 2.4;
        return;
      }
      const tx = mob.brain.target.x * TILE + TILE / 2;
      const ty = mob.brain.target.y * TILE + TILE / 2;
      const d = Math.hypot(tx - mob.px, ty - mob.py);
      if (d < 5) {
        snapActorToTile(mob, mob.brain.target.x, mob.brain.target.y);
        mob.brain.target = null;
        mob.brain.state = 'grazing';
        mob.brain.retargetAt = 0;
        mob.brain.pause = animalPauseDuration(profile);
        return;
      }
      moveActorVector(mob, tx - mob.px, ty - mob.py, Math.max(8, profile.baseSpeed * 0.62) * tick);
      if (Math.random() < profile.pauseChance * tick * 0.35) mob.brain.pause = 0.45 + Math.random() * 1.8;
    };
    window.HavenfallContext.livingAnimalBehaviorPatched = true;
  }

  function nearestAwareColonist(mob, radius) {
    let best = null;
    let bestD = Infinity;
    for (const c of state.colonists || []) {
      const d = Math.hypot(c.x - mob.x, c.y - mob.y);
      if (d < radius && d < bestD) { best = c; bestD = d; }
    }
    return best;
  }

  function animalPauseDuration(profile) {
    const base = profile.activity === 'crepuscular' ? 1.4 : 1.0;
    return base + profile.groupAffinity * 1.3 + Math.random() * 2.8;
  }

  function chooseAnimalTarget(mob, profile, options = {}) {
    const anchor = mob.brain?.anchor || mob;
    const focus = Math.random() < 0.7 ? anchor : mob;
    const wanderRadius = Math.max(2, profile.wanderRadius * (options.multiplier || 0.85));
    let best = null;
    let bestScore = -Infinity;
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * wanderRadius;
      const x = clamp(Math.round(focus.x + Math.cos(angle) * r), 1, getWorldCols() - 2);
      const y = clamp(Math.round(focus.y + Math.sin(angle) * r), 1, getWorldRows() - 2);
      if (!animalTileOpen(x, y) || tileDistance(x, y, mob.x, mob.y) < 1.1) continue;
      const cover = nearbyObjectTypeCountForLiving(x, y, ['tree', 'oak_tree', 'birch_tree', 'pine_tree', 'palm_tree', 'willow_tree', 'cactus', 'bush'], 2);
      const herd = nearbyMobCount(mob.type, x, y, 3, mob.id);
      const waterBias = distanceToNearestWater(x, y, 3) < 2 ? profile.waterAffinity * 0.55 : (1 - profile.waterAffinity) * 0.10;
      const awayBias = options.avoid ? Math.min(0.9, tileDistance(x, y, options.avoid.x, options.avoid.y) / Math.max(2, profile.alertRadius)) : 0;
      const score = waterBias + Math.min(0.7, cover * 0.18 * profile.coverAffinity) + Math.min(0.6, herd * 0.16 * profile.groupAffinity) + awayBias;
      if (score > bestScore || (!best && Math.random() < 0.3)) {
        best = { x, y };
        bestScore = score;
      }
    }
    return best;
  }

  function animalTileOpen(x, y) {
    if (mountainFootprintBlockedForNature(x, y)) return false;
    if (isWaterTile(x, y) && !isBridgeAt(x, y)) return false;
    if (typeof isBlocked === 'function' && isBlocked(x, y)) return false;
    return true;
  }

  function patchMobSpawning() {
    if (window.HavenfallContext.livingMobSpawningPatched) return;
    if (typeof isValidMobSpawnTile === 'function') {
      const originalIsValidMobSpawnTile = isValidMobSpawnTile;
      isValidMobSpawnTile = function isValidLivingMobSpawnTile(type, tile) {
        if (tile && mountainFootprintBlockedForNature(tile.x, tile.y)) return false;
        if (tile && state?.terrain?.[tile.y]?.[tile.x] === WATER_TILE) return false;
        return originalIsValidMobSpawnTile(type, tile);
      };
    }
    if (typeof generateInitialMobs === 'function') {
      const originalGenerateInitialMobs = generateInitialMobs;
      generateInitialMobs = function generateInitialLivingMobs(world, config = {}, colonists = []) {
        const mobs = originalGenerateInitialMobs(world, config, colonists) || [];
        for (const mob of mobs) {
          if (world?.terrain?.[mob.y]?.[mob.x] !== WATER_TILE) continue;
          const tile = dryTileNear(world, mob.x, mob.y, colonists);
          if (!tile) continue;
          mob.x = tile.x;
          mob.y = tile.y;
          mob.px = tile.x * TILE + TILE / 2;
          mob.py = tile.y * TILE + TILE / 2;
        }
        return mobs.filter(mob => !mountainFootprintBlockedForNature(mob.x, mob.y));
      };
    }
    window.HavenfallContext.livingMobSpawningPatched = true;
  }

  function dryTileNear(world, sx, sy, colonists = []) {
    for (let r = 1; r <= 8; r++) {
      for (let yy = sy - r; yy <= sy + r; yy++) for (let xx = sx - r; xx <= sx + r; xx++) {
        if (!insideWorld(world, xx, yy)) continue;
        if (world.terrain?.[yy]?.[xx] === WATER_TILE) continue;
        if (mountainFootprintBlockedForNature(xx, yy)) continue;
        if (colonists.some(c => Math.hypot(c.x - xx, c.y - yy) < 5)) continue;
        return { x: xx, y: yy };
      }
    }
    return null;
  }

  function nearbyMobCount(type, x, y, radius, ignoreId = null) {
    let count = 0;
    for (const mob of state?.mobs || []) {
      if (!mob || mob.type !== type || String(mob.id) === String(ignoreId)) continue;
      if (tileDistance(mob.x, mob.y, x, y) <= radius) count++;
    }
    return count;
  }

  function snapActorToTile(actor, x, y) {
    actor.x = x;
    actor.y = y;
    actor.px = x * TILE + TILE / 2;
    actor.py = y * TILE + TILE / 2;
  }

  function moveActorVector(actor, dx, dy, amount) {
    const len = Math.hypot(dx, dy) || 1;
    const step = Math.min(Math.max(0, Number(amount) || 0), len);
    const nx = actor.px + (dx / len) * step;
    const ny = actor.py + (dy / len) * step;
    const tileX = Math.round((nx - TILE / 2) / TILE);
    const tileY = Math.round((ny - TILE / 2) / TILE);
    if (blockedTile(tileX, tileY)) return;
    actor.px = nx;
    actor.py = ny;
    actor.x = tileX;
    actor.y = tileY;
    actor.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }

  function distanceToNearestWater(x, y, radius) {
    let best = radius + 1;
    for (let yy = y - radius; yy <= y + radius; yy++) {
      for (let xx = x - radius; xx <= x + radius; xx++) {
        if (isWaterTile(xx, yy)) best = Math.min(best, Math.hypot(xx - x, yy - y));
      }
    }
    return best;
  }

  function drawLivingWorldMarkers(bounds = null) {
    // reservado para waypoints/mapa global nas próximas fases
  }

  function ensureWaypointState() {
    const living = ensureRuntimeState() || (state.livingWorld = state.world.livingWorld = {});
    living.waypoints = Array.isArray(living.waypoints) ? living.waypoints : [];
    living.explorationQueue = Array.isArray(living.explorationQueue) ? living.explorationQueue : [];
    return living;
  }

  function createWaypoint(x, y, type = 'exploration', label = '') {
    if (!state?.world) return null;
    const living = ensureWaypointState();
    const waypoint = {
      id: typeof uid === 'function' ? uid('waypoint') : `waypoint_${living.waypoints.length + 1}`,
      x: clamp(Math.round(Number(x) || 0), 0, getWorldCols() - 1),
      y: clamp(Math.round(Number(y) || 0), 0, getWorldRows() - 1),
      type,
      label: String(label || type || 'Ponto de interesse'),
      createdAtDay: Number(state.day || 1)
    };
    living.waypoints.push(waypoint);
    return waypoint;
  }

  function generateExplorationQueue() {
    if (!state?.world) return [];
    const living = ensureWaypointState();
    const base = state.world.spawn || state.colonists?.[0] || { x: 0, y: 0 };
    living.explorationQueue = living.waypoints
      .filter(point => !point.completed)
      .map(point => ({ ...point, distance: Math.round(Math.hypot(point.x - base.x, point.y - base.y) * 10) / 10 }))
      .sort((a, b) => a.distance - b.distance || String(a.id).localeCompare(String(b.id)));
    return living.explorationQueue;
  }

  function installMapControls() {
    if (window.HavenfallContext.livingMapControlsInstalled) return;
    document.addEventListener('keydown', event => {
      if (event.code !== 'KeyM' || appScreen !== SCREEN.PLAYING || event.target?.tagName === 'INPUT') return;
      event.preventDefault();
      toggleWorldMap();
    });
    window.HavenfallContext.livingMapControlsInstalled = true;
  }

  function isGlobalMapOpen() { return !!mapOverlay?.classList.contains('is-active'); }
  function toggleWorldMap() { isGlobalMapOpen() ? closeWorldMap() : openWorldMap(); }

  function openWorldMap() {
    ensureMapOverlay();
    mapOverlay.classList.add('is-active');
    renderGlobalMap();
  }

  function closeWorldMap() {
    mapOverlay?.classList.remove('is-active');
  }

  function ensureMapOverlay() {
    if (mapOverlay) return;
    mapOverlay = document.createElement('div');
    mapOverlay.className = 'world-map-overlay';
    mapOverlay.innerHTML = '<div class="world-map-panel"><div class="world-map-head"><b>Mapa Global</b><button type="button" data-close-map>Fechar</button></div><canvas></canvas><p>Cinza: desconhecido · Verde: explorado · Azul: água · Dourado: base</p></div>';
    document.body.appendChild(mapOverlay);
    mapCanvas = mapOverlay.querySelector('canvas');
    mapOverlay.querySelector('[data-close-map]').addEventListener('click', closeWorldMap);
    mapCanvas.addEventListener('click', event => {
      const rect = mapCanvas.getBoundingClientRect();
      const x = Math.floor((event.clientX - rect.left) / rect.width * getWorldCols());
      const y = Math.floor((event.clientY - rect.top) / rect.height * getWorldRows());
      camera.x = x * TILE + TILE / 2;
      camera.y = y * TILE + TILE / 2;
      clampCamera?.();
      closeWorldMap();
    });
  }

  function renderGlobalMap() {
    if (!mapCanvas || !state?.world) return;
    mapCanvas.width = state.world.cols;
    mapCanvas.height = state.world.rows;
    const mctx = mapCanvas.getContext('2d');
    for (let y = 0; y < state.world.rows; y++) {
      for (let x = 0; x < state.world.cols; x++) {
        const visible = state.world.exploration?.[y]?.[x] || 0;
        const t = state.terrain?.[y]?.[x] || 'grass';
        mctx.fillStyle = visible ? (t === WATER_TILE ? '#2563eb' : t === 'stone' ? '#64748b' : t === 'sand' ? '#a16207' : '#166534') : '#020617';
        mctx.fillRect(x, y, 1, 1);
      }
    }
    const spawn = state.world.spawn;
    if (spawn) {
      mctx.fillStyle = '#fbbf24';
      mctx.fillRect(spawn.x - 1, spawn.y - 1, 3, 3);
    }
  }

  install();
})();
