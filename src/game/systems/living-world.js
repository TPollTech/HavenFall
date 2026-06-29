'use strict';

(() => {
  if (window.HavenfallContext?.livingWorldInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.livingWorldInstalled = true;

  const WATER_VERSION = 'living-water-v1';
  const TICK_VERSION = 'living-world-v1';
  const WATER_TILE = 'water';
  const VISITOR_STAY_HOURS = 6;
  const WATER_RESEARCH = 'watercraft';

  const animalProfiles = Object.freeze({
    rabbit: { baseSpeed: 24, sprintSpeed: 70, alertRadius: 5.5, waterAffinity: 0.35, coverAffinity: 0.7, herd: 0.25, activity: 'day', restHours: [21, 5], radius: 5 },
    deer: { baseSpeed: 32, sprintSpeed: 82, alertRadius: 8, waterAffinity: 0.45, coverAffinity: 0.55, herd: 0.75, activity: 'day', restHours: [20, 5], radius: 8 },
    goat: { baseSpeed: 26, sprintSpeed: 58, alertRadius: 4.5, waterAffinity: 0.35, coverAffinity: 0.2, herd: 0.7, activity: 'day', restHours: [22, 5], radius: 6 },
    sheep: { baseSpeed: 20, sprintSpeed: 46, alertRadius: 4.2, waterAffinity: 0.4, coverAffinity: 0.25, herd: 0.86, activity: 'day', restHours: [21, 5], radius: 5 },
    pig: { baseSpeed: 23, sprintSpeed: 44, alertRadius: 3.8, waterAffinity: 0.55, coverAffinity: 0.35, herd: 0.55, activity: 'day', restHours: [22, 6], radius: 5 },
    cow: { baseSpeed: 17, sprintSpeed: 34, alertRadius: 3.6, waterAffinity: 0.5, coverAffinity: 0.15, herd: 0.8, activity: 'day', restHours: [21, 5], radius: 4 },
    chicken: { baseSpeed: 24, sprintSpeed: 56, alertRadius: 4.5, waterAffinity: 0.25, coverAffinity: 0.45, herd: 0.62, activity: 'day', restHours: [20, 5], radius: 4 },
    duck: { baseSpeed: 21, sprintSpeed: 48, alertRadius: 4.2, waterAffinity: 0.95, coverAffinity: 0.2, herd: 0.7, activity: 'day', restHours: [21, 5], radius: 4 },
    turkey: { baseSpeed: 21, sprintSpeed: 52, alertRadius: 4.8, waterAffinity: 0.25, coverAffinity: 0.5, herd: 0.5, activity: 'day', restHours: [20, 5], radius: 5 },
    squirrel: { baseSpeed: 36, sprintSpeed: 86, alertRadius: 5.8, waterAffinity: 0.25, coverAffinity: 1, herd: 0.15, activity: 'day', restHours: [20, 5], radius: 7 },
    turtle: { baseSpeed: 9, sprintSpeed: 18, alertRadius: 2.8, waterAffinity: 1, coverAffinity: 0.15, herd: 0.25, activity: 'day', restHours: [21, 6], radius: 3 }
  });

  const terrainColors = Object.freeze({
    grass: '#46683a',
    dirt: '#6a5942',
    sand: '#a48b54',
    stone: '#68707a',
    water: '#1f6d8f'
  });

  const visitorNames = Object.freeze([
    'Iara', 'Noah', 'Mika', 'Lena', 'Tomas', 'Ravi', 'Ayla', 'Nilo', 'Cora', 'Sami'
  ]);

  function patchWorldGenerator() {
    if (window.HavenfallContext.livingWorldGeneratorPatched || typeof generateWorldFromSeed !== 'function') return;
    const originalGenerateWorldFromSeed = generateWorldFromSeed;
    generateWorldFromSeed = function generateLivingWorldFromSeed(config) {
      const world = originalGenerateWorldFromSeed(config);
      ensureWorldWater(world, config || {});
      return world;
    };
    window.HavenfallContext.livingWorldGeneratorPatched = true;
  }

  function ensureWorldWater(world, config = {}) {
    if (!world?.terrain?.length) return world;
    const rows = world.rows || world.terrain.length;
    const cols = world.cols || world.terrain[0]?.length || 0;
    if (!Array.isArray(world.waterDepth) || world.waterDepth.length !== rows || world.waterDepth[0]?.length !== cols) {
      world.waterDepth = Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => world.terrain[y]?.[x] === WATER_TILE ? 1 : 0));
    }
    world.livingWorld = world.livingWorld || {};
    if (world.livingWorld.waterVersion === WATER_VERSION) return world;

    const rand = typeof seededRandom === 'function'
      ? seededRandom(`${world.seed || config.seed || 'world'}|${world.mapSize || config.mapSize}|${WATER_VERSION}`)
      : Math.random;
    generateWaterBodies(world, config, rand);
    world.livingWorld.waterVersion = WATER_VERSION;
    world.livingWorld.version = TICK_VERSION;
    return world;
  }

  function generateWaterBodies(world, config, rand) {
    const rows = world.rows;
    const cols = world.cols;
    const area = rows * cols;
    const objectKeys = new Set((world.objects || []).map(obj => `${obj.x},${obj.y}`));
    const waterBias = Number(config?.planetScan?.biomeStats?.water || world.planetScan?.biomeStats?.water || 8);
    const pondCount = Math.max(2, Math.min(9, Math.floor(area / 4200) + Math.floor(waterBias / 11)));

    for (let i = 0; i < pondCount; i++) {
      const cx = 8 + Math.floor(rand() * Math.max(1, cols - 16));
      const cy = 8 + Math.floor(rand() * Math.max(1, rows - 16));
      const rx = 3 + Math.floor(rand() * 5) + Math.floor(waterBias / 24);
      const ry = 2 + Math.floor(rand() * 4) + Math.floor(waterBias / 30);
      carvePond(world, cx, cy, rx, ry, objectKeys, rand);
    }

    const riverChance = Math.min(0.82, 0.28 + waterBias / 95);
    if (rand() < riverChance) carveRiver(world, objectKeys, rand);
  }

  function carvePond(world, cx, cy, rx, ry, objectKeys, rand) {
    for (let y = Math.max(1, cy - ry - 2); y <= Math.min(world.rows - 2, cy + ry + 2); y++) {
      for (let x = Math.max(1, cx - rx - 2); x <= Math.min(world.cols - 2, cx + rx + 2); x++) {
        const nx = (x - cx) / Math.max(1, rx);
        const ny = (y - cy) / Math.max(1, ry);
        const wobble = 0.82 + rand() * 0.36;
        const d = nx * nx + ny * ny;
        if (d > wobble) continue;
        setWaterTile(world, x, y, d < 0.42 ? 2 : 1, objectKeys);
      }
    }
  }

  function carveRiver(world, objectKeys, rand) {
    const horizontal = rand() < 0.5;
    const length = horizontal ? world.cols : world.rows;
    const cross = horizontal ? world.rows : world.cols;
    let center = Math.floor(cross * (0.25 + rand() * 0.5));
    const waveA = 4 + rand() * 7;
    const waveB = 1.8 + rand() * 4;
    for (let i = 1; i < length - 1; i++) {
      const t = i / Math.max(1, length - 1);
      center += (rand() - 0.5) * 0.55;
      const meander = Math.sin(t * Math.PI * 2.2 + waveB) * waveA + Math.sin(t * Math.PI * 6.1) * 2.4;
      const c = Math.round(center + meander);
      const radius = 1 + Math.floor(rand() * 2);
      for (let o = -radius - 1; o <= radius + 1; o++) {
        const x = horizontal ? i : c + o;
        const y = horizontal ? c + o : i;
        setWaterTile(world, x, y, Math.abs(o) <= radius ? 2 : 1, objectKeys);
      }
    }
  }

  function setWaterTile(world, x, y, depth, objectKeys) {
    if (!isWorldWaterCandidate(world, x, y, objectKeys)) return false;
    world.terrain[y][x] = WATER_TILE;
    world.waterDepth[y][x] = Math.max(world.waterDepth[y][x] || 0, depth);
    return true;
  }

  function isWorldWaterCandidate(world, x, y, objectKeys) {
    if (x <= 0 || y <= 0 || x >= world.cols - 1 || y >= world.rows - 1) return false;
    if (objectKeys?.has(`${x},${y}`)) return false;
    if (world.terrain?.[y]?.[x] === 'stone') return false;
    const spawn = world.spawn || { x: Math.floor(world.cols / 2), y: Math.floor(world.rows / 2) };
    if (Math.hypot(x - spawn.x, y - spawn.y) < 9) return false;
    return true;
  }

  function ensureRuntimeState() {
    if (!state?.world) return null;
    ensureWorldWater(state.world, state.config || {});
    state.terrain = state.world.terrain || state.terrain;
    state.livingWorld = state.livingWorld || {};
    state.visitors = Array.isArray(state.visitors) ? state.visitors : [];
    state.world.livingWorld = state.world.livingWorld || {};
    state.world.livingWorld.waypoints = Array.isArray(state.world.livingWorld.waypoints) ? state.world.livingWorld.waypoints : [];
    if (!Number.isFinite(state.livingWorld.nextVisitorDay)) state.livingWorld.nextVisitorDay = Math.max(2, Number(state.day || 1) + 1);
    if (!Number.isFinite(state.livingWorld.lastNatureDay)) state.livingWorld.lastNatureDay = Number(state.day || 1);
    return state.livingWorld;
  }

  function installLivingWorldDefinitions() {
    itemDefs.fish = itemDefs.fish || { label: 'Peixe', icon: 'res_raw_meat', kind: 'food', note: 'Pescado em rios e lagoas.' };
    itemDefs.fishingRod = itemDefs.fishingRod || { label: 'Vara de pesca', icon: 'tool_sickle', slot: 'tool', kind: 'tool', gatherBonus: { food: 0.25 }, note: 'Permite pescar em margens de água.' };
    itemDefs.fieldRations = itemDefs.fieldRations || { label: 'Ração de campo', icon: 'res_stew', kind: 'food', note: 'Comida compacta feita com carne processada.' };

    objectDefs.bridge = objectDefs.bridge || { name: 'ponte simples', img: 'logs', blocks: false, bridge: true, floor: true };
    objectDefs.loot = objectDefs.loot || { name: 'item solto', img: 'res_scrap', blocks: false, loose: true };
    objectDefs.butcher_table = objectDefs.butcher_table || { name: 'mesa de açougue', img: 'table_wood', blocks: true, craft: 1, work: 4.5 };
    if (objectDefs.crate) objectDefs.crate.storage = Math.max(8, Number(objectDefs.crate.storage || 1));
    buildDefs.bridge = buildDefs.bridge || { label: 'Ponte', type: 'bridge', cost: { wood: 8 }, work: 5, requires: WATER_RESEARCH };
    buildDefs.butcher_table = buildDefs.butcher_table || { label: 'Mesa de Açougue', type: 'butcher_table', cost: { wood: 14, stone: 4 }, itemCost: { leather: 1 }, work: 7, requires: 'butchery' };
    if (typeof stationLabels === 'object') stationLabels.butcher_table = stationLabels.butcher_table || 'Mesa de Açougue';

    recipeDefs.fishingRod = recipeDefs.fishingRod || {
      label: 'Vara de pesca',
      station: 'bench',
      cost: { wood: 3 },
      itemCost: { rope: 1 },
      duration: 5,
      output: { items: { fishingRod: 1 } },
      unlock: WATER_RESEARCH,
      desc: 'Ferramenta para pescar nas margens.'
    };
    recipeDefs.fishMeal = recipeDefs.fishMeal || {
      label: 'Peixe assado x3',
      station: 'stove',
      cost: { wood: 1 },
      itemCost: { fish: 2 },
      duration: 4,
      output: { resources: { food: 6 } },
      unlock: 'fishing',
      desc: 'Transforma peixe em comida segura.'
    };
    recipeDefs.fieldRations = recipeDefs.fieldRations || {
      label: 'Ração de campo x4',
      station: 'butcher_table',
      itemCost: { rawMeat: 3 },
      cost: { wood: 1 },
      duration: 6,
      output: { resources: { food: 8 }, items: { bones: 1 } },
      unlock: 'butchery',
      desc: 'Processa carne de caça em comida estável e sobras úteis.'
    };
  }

  function spawnLooseItem(itemKey, amount, x, y, label = null) {
    if (!state?.objects || !itemKey || amount <= 0) return null;
    const tile = nearestDropTile(x, y);
    if (!tile) return null;
    const item = itemDefs[itemKey] || {};
    const obj = {
      id: uid('loot'),
      type: 'loot',
      x: tile.x,
      y: tile.y,
      itemKey,
      amount: Math.max(1, Math.floor(amount)),
      lootLabel: label || item.label || itemKey,
      markedForHaul: true
    };
    state.objects.push(obj);
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    return obj;
  }

  function spawnLooseResource(resourceKey, amount, x, y, label = null) {
    if (!state?.objects || !resourceKey || amount <= 0) return null;
    if (resourceKey === 'wood') {
      const tile = nearestDropTile(x, y);
      if (!tile) return null;
      const obj = { id: uid('loot'), type: 'logs', x: tile.x, y: tile.y, amount: Math.max(1, Math.floor(amount)), lootLabel: label || 'Madeira solta', markedForHaul: true };
      state.objects.push(obj);
      if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
      return obj;
    }
    const itemMap = { food: 'rawMeat', stone: 'stoneChunk', metal: 'metalScrap', medicine: 'fieldMedicine' };
    ensureResourceProxyItemDefs();
    return spawnLooseItem(itemMap[resourceKey] || resourceKey, amount, x, y, label || resourceLabel?.(resourceKey) || resourceKey);
  }

  function ensureResourceProxyItemDefs() {
    itemDefs.stoneChunk = itemDefs.stoneChunk || { label: 'Pedra solta', icon: 'icon_stone', kind: 'resource', resourceKey: 'stone' };
    itemDefs.metalScrap = itemDefs.metalScrap || { label: 'Sucata metálica', icon: 'icon_metal', kind: 'resource', resourceKey: 'metal' };
    itemDefs.fieldMedicine = itemDefs.fieldMedicine || { label: 'Remédio encontrado', icon: 'res_herbs', kind: 'resource', resourceKey: 'medicine' };
  }

  function nearestDropTile(x, y) {
    const origin = { x: Math.round(x), y: Math.round(y) };
    const candidates = [origin];
    for (let r = 1; r <= 4; r++) {
      for (let yy = origin.y - r; yy <= origin.y + r; yy++) for (let xx = origin.x - r; xx <= origin.x + r; xx++) {
        if (Math.abs(xx - origin.x) !== r && Math.abs(yy - origin.y) !== r) continue;
        candidates.push({ x: xx, y: yy });
      }
    }
    return candidates.find(tile => {
      if (!tile || tile.x < 1 || tile.y < 1 || tile.x >= getWorldCols() - 1 || tile.y >= getWorldRows() - 1) return false;
      if (state.terrain?.[tile.y]?.[tile.x] === WATER_TILE && !isBridgeAt(tile.x, tile.y)) return false;
      if (typeof getObjectAt === 'function' && getObjectAt(tile.x, tile.y)) return false;
      if (typeof isMountainBlocked === 'function' && isMountainBlocked(tile.x, tile.y)) return false;
      return true;
    }) || null;
  }

  function patchPhysicalDrops() {
    if (window.HavenfallContext.livingPhysicalDropsPatched || typeof finishMobDeath !== 'function') return;
    finishMobDeath = function finishMobDeathWithLoot(mob, index, hunter = null) {
      const drops = typeof mobDrop === 'function' ? mobDrop(mob, hunter) : { items: {} };
      for (const [key, amount] of Object.entries(drops.items || {})) spawnLooseItem(key, amount, mob.x, mob.y);
      for (const [key, amount] of Object.entries(drops.resources || {})) spawnLooseResource(key, amount, mob.x, mob.y);
      if (index >= 0) state.mobs.splice(index, 1);
      const itemCount = Object.values(drops.items || {}).reduce((sum, n) => sum + Number(n || 0), 0);
      log(`${mobName?.(mob.type) || 'Animal'} abatido. ${itemCount ? 'Drops ficaram no chão para coleta.' : 'Nenhum drop útil.'}`);
    };
    window.HavenfallContext.livingPhysicalDropsPatched = true;
  }

  function installInteractionFixes() {
    if (window.HavenfallContext.livingInteractionFixesInstalled) return;
    if (typeof window.handleInteractionTask !== 'function') window.handleInteractionTask = handleInteractionTask;
    if (typeof handleInteractionTask === 'undefined') {
      try { handleInteractionTask = window.handleInteractionTask; } catch (_) {}
    }
    window.HavenfallContext.livingInteractionFixesInstalled = true;
  }

  function handleInteractionTask(c, task, tick) {
    if (!task) return false;
    if (task.type === 'inspectPoi') return handlePoiInspectTask(c, task, tick);
    const obj = state.objects.find(o => o.id === task.objId);
    if (!obj) { c.task = null; c.note = 'Ocioso'; c.work = 0; return true; }
    const def = objectDefs[obj.type] || {};
    const duration = Number(def.work || 2.5);
    c.work += tick * workRate(c, 'gather', obj);
    if (task.type === 'inspect') {
      c.note = `Investigando ${def.name || obj.type} ${Math.floor((c.work / duration) * 100)}%`;
      if (c.work < duration) return true;
      obj.inspected = true;
      obj.unknown = false;
      const poi = obj.poiId ? state.world?.pointsOfInterest?.find(p => p.id === obj.poiId) : null;
      if (poi) poi.inspected = true;
      log(obj.lore || poi?.lore || `${c.name} investigou ${def.name || 'o local'} e registrou sinais úteis.`);
      c.task = null; c.note = 'Ocioso'; c.work = 0;
      return true;
    }
    if (task.type === 'loot') {
      c.note = `Vasculhando ${def.name || obj.type} ${Math.floor((c.work / duration) * 100)}%`;
      if (c.work < duration) return true;
      if (obj.looted) {
        log(`${def.name || 'Local'} ja foi vasculhado.`);
      } else {
        const loot = lootForWorldObject(obj);
        dropLootNearObject(obj, loot);
        obj.looted = true;
        obj.inspected = true;
        obj.unknown = false;
        const poi = obj.poiId ? state.world?.pointsOfInterest?.find(p => p.id === obj.poiId) : null;
        if (poi) poi.looted = true;
        log(`${c.name} vasculhou ${def.name || 'o local'}. Os achados ficaram no chão para transporte.`);
      }
      c.task = null; c.note = 'Ocioso'; c.work = 0;
      return true;
    }
    return false;
  }

  function handlePoiInspectTask(c, task, tick) {
    const poi = state.world?.pointsOfInterest?.find(p => p.id === task.poiId);
    if (!poi) { c.task = null; c.note = 'Ocioso'; c.work = 0; return true; }
    c.work += tick * workRate(c, 'research');
    c.note = `Investigando ${poi.name} ${Math.floor((c.work / 3.5) * 100)}%`;
    if (c.work < 3.5) return true;
    poi.inspected = true;
    poi.discovered = true;
    log(poi.lore || `${c.name} mapeou ${poi.name}.`);
    c.task = null; c.note = 'Ocioso'; c.work = 0;
    return true;
  }

  function lootForWorldObject(obj) {
    const seed = typeof hashSeed === 'function' ? hashSeed(`${state.config?.seed}|loot|${obj.id}`) : Math.floor(Math.random() * 100000);
    const rich = obj.type === 'cache' || obj.type === 'supply_crate';
    return {
      resources: {
        wood: rich ? 2 + seed % 5 : seed % 3,
        medicine: seed % 5 === 0 ? 1 : 0
      },
      items: {
        rope: seed % 3 === 0 ? 1 : 0,
        nails: rich ? 1 + seed % 3 : seed % 2,
        cloth: seed % 4 === 0 ? 1 : 0,
        leather: seed % 6 === 0 ? 1 : 0
      }
    };
  }

  function dropLootNearObject(obj, loot) {
    for (const [key, amount] of Object.entries(loot.resources || {})) if (amount > 0) spawnLooseResource(key, amount, obj.x, obj.y);
    for (const [key, amount] of Object.entries(loot.items || {})) if (amount > 0) spawnLooseItem(key, amount, obj.x, obj.y);
  }

  function livingWorldTick(dt) {
    if (!state || appScreen !== SCREEN.PLAYING) return;
    const living = ensureRuntimeState();
    if (!living) return;
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
    if (typeof log === 'function') log(`${c.name} engoliu água tentando atravessar parte funda.`);
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
      spawned++;
    }
    if (spawned && typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    return spawned;
  }

  function naturalGrowthScore(x, y) {
    const terrain = state.terrain?.[y]?.[x];
    if (!['grass', 'dirt'].includes(terrain)) return 0;
    if (typeof getObjectAt === 'function' && getObjectAt(x, y)) return 0;
    if (typeof isBlocked === 'function' && isBlocked(x, y)) return 0;
    const spawn = state.world?.spawn || { x: 0, y: 0 };
    if (Math.hypot(x - spawn.x, y - spawn.y) < 14) return 0;
    if (nearbyConstructionCount(x, y, 5) > 1) return 0;
    const water = distanceToNearestWater(x, y, 7);
    const trees = nearbyObjectTypeCountForLiving(x, y, ['tree', 'oak_tree', 'birch_tree', 'pine_tree', 'willow_tree', 'bush', 'berry'], 5);
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

  function maybeSpawnVisitors() {
    if (!state?.livingWorld || state.visitors.length >= 6) return;
    if (state.day < state.livingWorld.nextVisitorDay || state.hour < 8 || state.hour > 17) return;
    const kind = Math.random() < 0.34 ? 'merchant' : 'visitor';
    const amount = kind === 'merchant' ? 1 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < amount; i++) spawnVisitor(kind, i);
    state.livingWorld.nextVisitorDay = state.day + 2 + Math.floor(Math.random() * 3);
    if (typeof log === 'function') log(kind === 'merchant' ? 'Um pequeno grupo mercante entrou no mapa.' : 'Visitantes foram avistados cruzando a regiao.');
  }

  function spawnVisitor(kind = 'visitor', index = 0) {
    const edge = randomLivingEdgeTile();
    if (!edge) return null;
    const base = state.world?.spawn || state.colonists?.[0] || { x: Math.floor(getWorldCols() / 2), y: Math.floor(getWorldRows() / 2) };
    const target = nearbyOpenTile(base.x, base.y, 5) || { x: base.x, y: base.y };
    const nameSeed = (state.day * 7 + index * 3 + state.visitors.length) % visitorNames.length;
    const visitor = {
      id: uid(kind),
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
      speed: kind === 'merchant' ? 20 : 24,
      leaveAt: state.day * 24 + state.hour + VISITOR_STAY_HOURS + Math.random() * 3,
      offer: kind === 'merchant' ? merchantOffer() : null,
      appearance: visitorAppearance(kind, nameSeed)
    };
    state.visitors.push(visitor);
    return visitor;
  }

  function merchantOffer() {
    const offers = [
      { gives: 'remedios', wants: 'comida' },
      { gives: 'tecido', wants: 'madeira' },
      { gives: 'pregos', wants: 'pedra' },
      { gives: 'corda', wants: 'comida' }
    ];
    return offers[Math.floor(Math.random() * offers.length)];
  }

  function visitorAppearance(kind, seed) {
    const clothes = kind === 'merchant'
      ? ['#76563b', '#6f5b34', '#594a38']
      : ['#536c72', '#5f6f4b', '#6b6478', '#745e4d'];
    const skins = ['#c98f65', '#b77a52', '#d3a072', '#8f5f43', '#e0b27f'];
    const hairs = ['#2c1b13', '#4b2f1e', '#6b4a2f', '#202022', '#7a5537'];
    return {
      skin: skins[seed % skins.length],
      hair: hairs[(seed + 2) % hairs.length],
      clothes: clothes[seed % clothes.length],
      accent: kind === 'merchant' ? '#d6a24a' : '#8fb8be'
    };
  }

  function updateVisitors(tick) {
    const now = state.day * 24 + state.hour;
    for (let i = state.visitors.length - 1; i >= 0; i--) {
      const visitor = state.visitors[i];
      if (visitor.stage !== 'leaving' && now >= visitor.leaveAt) {
        visitor.stage = 'leaving';
        visitor.target = visitor.exitTarget || randomLivingEdgeTile() || visitor.target;
        if (typeof log === 'function') log(`${visitor.name} esta deixando a regiao.`);
      }
      moveVisitor(visitor, tick);
      if (visitor.stage === 'leaving' && dist(visitor.x, visitor.y, visitor.target.x, visitor.target.y) <= 1) {
        state.visitors.splice(i, 1);
      }
    }
  }

  function moveVisitor(visitor, tick) {
    if (!visitor?.target) return;
    const tx = visitor.target.x * TILE + TILE / 2;
    const ty = visitor.target.y * TILE + TILE / 2;
    const d = Math.hypot(tx - visitor.px, ty - visitor.py);
    if (d < 5) {
      if (visitor.stage === 'arriving') {
        visitor.stage = 'idle';
        visitor.target = nearbyOpenTile(visitor.x, visitor.y, 4) || visitor.target;
      } else if (visitor.stage === 'idle' && Math.random() < 0.015 * Number(state.speed || 1)) {
        visitor.target = nearbyOpenTile(visitor.x, visitor.y, 4) || visitor.target;
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
      if (!isBlocked(x, y) && !getObjectAt(x, y)) return { x, y };
    }
    return null;
  }

  function nearbyOpenTile(cx, cy, radius = 5) {
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * radius;
      const x = clamp(Math.round(cx + Math.cos(angle) * r), 1, getWorldCols() - 2);
      const y = clamp(Math.round(cy + Math.sin(angle) * r), 1, getWorldRows() - 2);
      if (!isBlocked(x, y) && !getObjectAt(x, y)) return { x, y };
    }
    return null;
  }

  function patchAnimalBehavior() {
    if (window.HavenfallContext.livingAnimalBehaviorPatched || typeof updatePassiveMob !== 'function') return;
    const originalUpdatePassiveMob = updatePassiveMob;
    updatePassiveMob = function updateLivingPassiveMob(mob, tick) {
      if (!mob || !animalProfiles[mob.type] || !state?.world) return originalUpdatePassiveMob(mob, tick);
      ensureLivingAnimalState(mob);
      if (runLivingAnimalBehavior(mob, tick)) return;
      return originalUpdatePassiveMob(mob, tick);
    };
    window.HavenfallContext.livingAnimalBehaviorPatched = true;
  }

  function patchMobSpawning() {
    if (window.HavenfallContext.livingMobSpawningPatched) return;
    if (typeof isValidMobSpawnTile === 'function') {
      const originalIsValidMobSpawnTile = isValidMobSpawnTile;
      isValidMobSpawnTile = function isValidLivingMobSpawnTile(type, tile) {
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
        return mobs.filter(mob => world?.terrain?.[mob.y]?.[mob.x] !== WATER_TILE);
      };
      window.generateInitialMobs = generateInitialMobs;
    }
    window.HavenfallContext.livingMobSpawningPatched = true;
  }

  function dryTileNear(world, x, y, colonists = []) {
    for (let radius = 1; radius <= 8; radius++) {
      for (let yy = y - radius; yy <= y + radius; yy++) {
        for (let xx = x - radius; xx <= x + radius; xx++) {
          if (xx <= 0 || yy <= 0 || xx >= world.cols - 1 || yy >= world.rows - 1) continue;
          if (world.terrain?.[yy]?.[xx] === WATER_TILE || world.terrain?.[yy]?.[xx] === 'stone') continue;
          if ((world.objects || []).some(obj => obj.x === xx && obj.y === yy)) continue;
          if (colonists.some(c => Math.hypot(c.x - xx, c.y - yy) < 7)) continue;
          return { x: xx, y: yy };
        }
      }
    }
    return null;
  }

  function ensureLivingAnimalState(mob) {
    mob.living = mob.living || {};
    if (!Number.isFinite(mob.living.thirst)) mob.living.thirst = 35 + Math.random() * 80;
    if (!Number.isFinite(mob.living.restlessness)) mob.living.restlessness = Math.random() * 10;
    if (!mob.living.home) mob.living.home = { x: mob.x, y: mob.y };
  }

  function runLivingAnimalBehavior(mob, tick) {
    const profile = animalProfiles[mob.type];
    mob.anim = (mob.anim || 0) + tick;
    mob.living.thirst -= tick * (0.45 + profile.waterAffinity * 0.22);
    mob.living.restlessness -= tick;

    const threat = nearestColonistForLivingMob(mob, profile.alertRadius);
    if (threat && threat.task?.type !== 'huntMob') {
      mob.state = dist(mob.x, mob.y, threat.x, threat.y) <= Math.ceil(profile.alertRadius * 0.55) ? 'em fuga' : 'em alerta';
      moveActorVector(mob, mob.px - threat.px, mob.py - threat.py, profile.sprintSpeed * tick);
      return true;
    }

    if (isAnimalResting(profile)) {
      mob.state = 'repousando';
      mob.target = null;
      return true;
    }

    if (profile.waterAffinity > 0.5 && mob.living.thirst <= 0) {
      const water = nearestWaterTile(mob.x, mob.y, 10);
      if (water) {
        mob.state = 'bebendo agua';
        mob.target = water;
        if (dist(mob.x, mob.y, water.x, water.y) <= 1) {
          mob.living.thirst = 80 + Math.random() * 80;
          mob.target = null;
          return true;
        }
        moveLivingMobToTarget(mob, Math.max(8, profile.baseSpeed * 0.82) * tick);
        return true;
      }
    }

    const herdTarget = profile.herd > 0.5 ? herdFollowTarget(mob, 7) : null;
    if (herdTarget) {
      mob.state = 'acompanhando grupo';
      mob.target = herdTarget;
      moveLivingMobToTarget(mob, profile.baseSpeed * tick);
      return true;
    }

    if (!mob.target || mob.living.restlessness <= 0 || Math.random() < 0.004 * Number(state.speed || 1)) {
      mob.target = preferredAnimalTarget(mob, profile);
      mob.living.restlessness = 3 + Math.random() * 9;
    }

    mob.state = mob.target ? 'vagando' : 'pastando';
    if (mob.target) moveLivingMobToTarget(mob, profile.baseSpeed * tick);
    return true;
  }

  function isAnimalResting(profile) {
    const hour = Number(state?.hour || 12);
    const [start, end] = profile.restHours || [22, 5];
    return start > end ? (hour >= start || hour <= end) : (hour >= start && hour <= end);
  }

  function nearestColonistForLivingMob(mob, radius) {
    let best = null;
    let bestDist = Infinity;
    for (const c of state.colonists || []) {
      if (c.isUnconscious) continue;
      const d = Math.hypot((c.px || c.x * TILE) - mob.px, (c.py || c.y * TILE) - mob.py) / TILE;
      if (d < bestDist && d <= radius) { best = c; bestDist = d; }
    }
    return best;
  }

  function herdFollowTarget(mob, radius) {
    let best = null;
    let bestDist = Infinity;
    for (const other of state.mobs || []) {
      if (other === mob || other.type !== mob.type) continue;
      const d = dist(mob.x, mob.y, other.x, other.y);
      if (d >= 3 && d < bestDist && d <= radius) {
        bestDist = d;
        best = other;
      }
    }
    if (!best) return null;
    return { x: best.x, y: best.y };
  }

  function preferredAnimalTarget(mob, profile) {
    let best = null;
    let bestScore = -Infinity;
    for (let i = 0; i < 28; i++) {
      const radius = profile.radius || 5;
      const x = clamp(Math.round(mob.x + (Math.random() - 0.5) * radius * 2), 1, getWorldCols() - 2);
      const y = clamp(Math.round(mob.y + (Math.random() - 0.5) * radius * 2), 1, getWorldRows() - 2);
      if (isBlocked(x, y)) continue;
      const score = animalTilePreferenceScore(mob.type, x, y, profile);
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
    return best;
  }

  function animalTilePreferenceScore(type, x, y, profile) {
    const terrain = state.terrain?.[y]?.[x];
    let score = terrain === 'grass' ? 1 : terrain === 'dirt' ? 0.62 : terrain === 'sand' ? 0.22 : 0;
    if (terrain === WATER_TILE) return profile.waterAffinity > 0.8 ? 0.25 : -1;
    const waterDistance = distanceToNearestWater(x, y, 7);
    if (waterDistance < 7) score += (7 - waterDistance) * 0.055 * profile.waterAffinity;
    const cover = nearbyObjectTypeCountForLiving(x, y, ['tree', 'oak_tree', 'birch_tree', 'pine_tree', 'willow_tree', 'bush', 'berry'], 4);
    score += Math.min(0.6, cover * 0.05 * profile.coverAffinity);
    if (type === 'deer' || type === 'sheep' || type === 'cow') score -= Math.min(0.35, cover * 0.02);
    return score + Math.random() * 0.18;
  }

  function moveLivingMobToTarget(mob, step) {
    if (!mob.target) return;
    const tx = mob.target.x * TILE + TILE / 2;
    const ty = mob.target.y * TILE + TILE / 2;
    if (Math.hypot(tx - mob.px, ty - mob.py) < 6) { mob.target = null; return; }
    moveActorVector(mob, tx - mob.px, ty - mob.py, step);
  }

  function moveActorVector(actor, dx, dy, step) {
    const len = Math.hypot(dx, dy) || 1;
    const nextPx = actor.px + dx / len * step;
    const nextPy = actor.py + dy / len * step;
    const nextX = Math.round((nextPx - TILE / 2) / TILE);
    const nextY = Math.round((nextPy - TILE / 2) / TILE);
    actor.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    if (typeof isBlocked === 'function' && isBlocked(nextX, nextY)) {
      actor.target = null;
      return false;
    }
    actor.px = clamp(nextPx, TILE / 2, getWorldWidth() - TILE / 2);
    actor.py = clamp(nextPy, TILE / 2, getWorldHeight() - TILE / 2);
    actor.x = clamp(Math.round((actor.px - TILE / 2) / TILE), 0, getWorldCols() - 1);
    actor.y = clamp(Math.round((actor.py - TILE / 2) / TILE), 0, getWorldRows() - 1);
    return true;
  }

  function nearestWaterTile(x, y, radius) {
    let best = null;
    let bestDist = Infinity;
    for (let yy = Math.max(1, y - radius); yy <= Math.min(getWorldRows() - 2, y + radius); yy++) {
      for (let xx = Math.max(1, x - radius); xx <= Math.min(getWorldCols() - 2, x + radius); xx++) {
        if (state.terrain?.[yy]?.[xx] !== WATER_TILE) continue;
        const d = dist(x, y, xx, yy);
        if (d < bestDist) { bestDist = d; best = { x: xx, y: yy }; }
      }
    }
    return best;
  }

  function distanceToNearestWater(x, y, radius) {
    const tile = nearestWaterTile(x, y, radius);
    return tile ? dist(x, y, tile.x, tile.y) : Infinity;
  }

  function drawWaterTile(x, y, type) {
    if (type !== WATER_TILE) return;
    const depth = state?.world?.waterDepth?.[y]?.[x] || 1;
    const px = x * TILE;
    const py = y * TILE;
    const shimmer = Math.sin(performance.now() / 720 + x * 0.73 + y * 0.41) * 0.5 + 0.5;
    ctx.save();
    ctx.fillStyle = depth >= 2 ? '#15516f' : '#247c91';
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = `rgba(127, 211, 232, ${0.08 + shimmer * 0.06})`;
    ctx.beginPath();
    ctx.ellipse(px + TILE * 0.48, py + TILE * 0.45, TILE * 0.34, TILE * 0.16, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(193, 236, 240, .14)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(px + 8, py + 16 + shimmer * 5);
    ctx.quadraticCurveTo(px + 22, py + 10, px + 39, py + 18 + shimmer * 4);
    ctx.stroke();
    ctx.restore();
  }

  function waterCollisionProvider(x, y) {
    if (state?.terrain?.[y]?.[x] !== WATER_TILE) return null;
    if (isBridgeAt(x, y)) return null;
    const depth = state.world?.waterDepth?.[y]?.[x] || 1;
    return depth >= 2 ? { blocks: false, kind: 'deep-water' } : null;
  }

  function isBridgeAt(x, y) {
    const obj = typeof getObjectAt === 'function' ? getObjectAt(x, y) : null;
    return obj?.type === 'bridge';
  }

  function isWaterTile(x, y) {
    return state?.terrain?.[y]?.[x] === WATER_TILE;
  }

  function installWaterGameplayHooks() {
    if (window.HavenfallContext.livingWaterGameplayPatched) return;

    window.GameSystems?.registerMovementModifier('living-world.water-slow', (c, multiplier) => {
      if (!c || !isWaterTile(Math.round(c.x), Math.round(c.y)) || isBridgeAt(Math.round(c.x), Math.round(c.y))) return multiplier;
      const depth = state.world?.waterDepth?.[Math.round(c.y)]?.[Math.round(c.x)] || 1;
      return multiplier * (depth >= 2 ? 0.42 : 0.68);
    }, { order: 18 });

    window.GameSystems?.registerWorkRateModifier('living-world.wet-work', (rate, c) => {
      if (!c?.statuses?.includes('molhado')) return rate;
      return rate * (c.equipment?.offhand === 'thermalClothes' ? 0.96 : 0.88);
    }, { order: 22 });

    window.GameSystems?.registerAutoTaskProvider('living-world.fishing', c => {
      if (!isResearched?.('fishing') || c?.task || c?.energy < 20 || taskPriorityValue?.(c, 'gather') <= 0) return false;
      if ((state.items?.fishingRod || 0) <= 0 && c.equipment?.tool !== 'fishingRod') return false;
      const target = nearestFishingTile(c);
      return !!(target && assignFishingTask(c, target));
    }, { order: 34 });

    window.GameSystems?.registerTaskHandler('fish', 'living-world.fish', handleFishingTask, { order: 28 });
    window.HavenfallContext.livingWaterGameplayPatched = true;
  }

  function nearestFishingTile(c) {
    let best = null;
    let bestDist = Infinity;
    for (let y = Math.max(1, c.y - 12); y <= Math.min(getWorldRows() - 2, c.y + 12); y++) {
      for (let x = Math.max(1, c.x - 12); x <= Math.min(getWorldCols() - 2, c.x + 12); x++) {
        if (!isTileDiscovered(x, y) || isBlocked(x, y)) continue;
        if (distanceToNearestWater(x, y, 1) > 1) continue;
        const d = dist(c.x, c.y, x, y);
        if (d < bestDist) { bestDist = d; best = { x, y }; }
      }
    }
    return best;
  }

  function assignFishingTask(c, tile) {
    if (!c || !tile) return false;
    ensureEquipment(c);
    if (!c.equipment.tool && (state.items?.fishingRod || 0) > 0) equipItem?.(c, 'fishingRod');
    c.task = { type: 'fish', x: tile.x, y: tile.y };
    c.path = findPath(c.x, c.y, tile.x, tile.y);
    c.work = 0;
    c.note = 'Indo pescar';
    return true;
  }

  function handleFishingTask(c, task, tick) {
    if (task?.type !== 'fish') return false;
    if (distanceToNearestWater(task.x, task.y, 1) > 1) { c.task = null; c.note = 'Sem água para pescar'; c.work = 0; return true; }
    c.work += tick * workRate(c, 'gather');
    c.note = `Pescando ${Math.floor((c.work / 5.5) * 100)}%`;
    if (c.work < 5.5) return true;
    const amount = Math.random() < 0.22 ? 2 : 1;
    spawnLooseItem('fish', amount, task.x, task.y, 'Peixe pescado');
    log(`${c.name} pescou ${amount} peixe${amount > 1 ? 's' : ''}.`);
    c.task = null;
    c.note = 'Ocioso';
    c.work = 0;
    return true;
  }

  function drawVisitorsOverlay() {
    if (!state?.visitors?.length || appScreen !== SCREEN.PLAYING) return;
    ctx.save();
    ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
    ctx.scale(viewTransform.scale, viewTransform.scale);
    for (const visitor of state.visitors) {
      if (!isTileDiscovered(visitor.x, visitor.y)) continue;
      const actor = { ...visitor, appearance: visitor.appearance || {}, px: visitor.px, py: visitor.py };
      const drawn = window.HavenfallPawnRenderer?.drawNpc?.(actor);
      if (!drawn) {
        ctx.fillStyle = visitor.kind === 'merchant' ? '#d6a24a' : '#8fb8be';
        ctx.beginPath();
        ctx.arc(visitor.px, visitor.py, 12, 0, Math.PI * 2);
        ctx.fill();
        drawName?.(visitor.name, visitor.px, visitor.py - 38);
      }
    }
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
    if (!state?.world?.livingWorld?.waypoints?.length) return;
    ctx.save();
    for (const waypoint of state.world.livingWorld.waypoints) {
      if (!isTileDiscovered(waypoint.x, waypoint.y)) continue;
      const x = waypoint.x * TILE + TILE / 2;
      const y = waypoint.y * TILE + TILE / 2;
      ctx.fillStyle = 'rgba(247, 184, 74, .2)';
      ctx.strokeStyle = '#f7b84a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y - 12, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffe2a3';
      ctx.font = '900 13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(String(waypoint.index || '?'), x, y - 7);
    }
    ctx.restore();
  }

  function ensureGlobalMapUi() {
    if (document.getElementById('livingWorldMapOverlay')) return;
    const style = document.createElement('style');
    style.id = 'living-world-style';
    style.textContent = `
      #livingWorldMapOverlay{position:fixed;inset:0;z-index:140;display:none;align-items:center;justify-content:center;background:rgba(2,5,10,.78);backdrop-filter:blur(6px);padding:24px}
      #livingWorldMapOverlay.active{display:flex}
      .living-map-card{width:min(1120px,calc(100vw - 32px));height:min(760px,calc(100vh - 32px));display:grid;grid-template-columns:minmax(0,1fr)280px;gap:16px;padding:16px;border-radius:16px;background:#0d131d;border:1px solid rgba(247,184,74,.24);box-shadow:0 24px 70px rgba(0,0,0,.5)}
      .living-map-main{min-width:0;display:grid;grid-template-rows:auto minmax(0,1fr);gap:10px}
      .living-map-head{display:flex;justify-content:space-between;gap:14px;align-items:center;color:#f4efe4}
      .living-map-head b{font-size:18px}.living-map-head span{color:#bdb7ad;font-size:12px}
      #livingWorldMapCanvas{width:100%;height:100%;border-radius:10px;background:#060910;border:1px solid rgba(255,255,255,.09);image-rendering:pixelated;cursor:crosshair}
      .living-map-side{display:grid;align-content:start;gap:12px;color:#d8d0bd}
      .living-map-panel{border:1px solid rgba(255,255,255,.09);border-radius:10px;background:rgba(255,255,255,.04);padding:12px}
      .living-map-panel h3{margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#f7b84a}
      .living-map-panel p{margin:0 0 6px;font-size:12px;color:#c8c0b5}
      .living-map-close{height:36px;border-radius:9px}
      @media(max-width:760px){.living-map-card{grid-template-columns:1fr;height:calc(100vh - 24px)}.living-map-side{display:none}#livingWorldMapOverlay{padding:12px}}
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'livingWorldMapOverlay';
    overlay.innerHTML = `
      <div class="living-map-card">
        <section class="living-map-main">
          <div class="living-map-head"><div><b>Mapa global</b><br><span>M cria waypoints com clique. Shift + clique remove o mais proximo.</span></div><button class="living-map-close" type="button">Fechar</button></div>
          <canvas id="livingWorldMapCanvas"></canvas>
        </section>
        <aside class="living-map-side">
          <div class="living-map-panel" id="livingWorldMapStats"></div>
          <div class="living-map-panel"><h3>Legenda</h3><p>Verde: vegetacao</p><p>Azul: agua</p><p>Cinza: montanha/rocha</p><p>Dourado: waypoint</p><p>Ciano: visitantes</p></div>
        </aside>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.living-map-close')?.addEventListener('click', () => toggleGlobalMap(false));
    overlay.addEventListener('click', event => { if (event.target === overlay) toggleGlobalMap(false); });
    overlay.querySelector('#livingWorldMapCanvas')?.addEventListener('click', handleGlobalMapClick);
  }

  function isGlobalMapOpen() {
    return document.getElementById('livingWorldMapOverlay')?.classList.contains('active');
  }

  function toggleGlobalMap(force = null) {
    if (!state || (appScreen !== SCREEN.PLAYING && appScreen !== SCREEN.PAUSED)) return;
    ensureRuntimeState();
    ensureGlobalMapUi();
    const overlay = document.getElementById('livingWorldMapOverlay');
    const next = force == null ? !overlay.classList.contains('active') : !!force;
    overlay.classList.toggle('active', next);
    if (next) renderGlobalMap();
  }

  function handleGlobalMapClick(event) {
    if (!state?.world) return;
    const canvasEl = event.currentTarget;
    const rect = canvasEl.getBoundingClientRect();
    const x = clamp(Math.floor((event.clientX - rect.left) / rect.width * getWorldCols()), 0, getWorldCols() - 1);
    const y = clamp(Math.floor((event.clientY - rect.top) / rect.height * getWorldRows()), 0, getWorldRows() - 1);
    if (event.shiftKey) removeNearestWaypoint(x, y);
    else addWaypoint(x, y);
    renderGlobalMap();
  }

  function addWaypoint(x, y) {
    ensureRuntimeState();
    const waypoints = state.world.livingWorld.waypoints;
    const waypoint = { id: uid('waypoint'), x, y, index: waypoints.length + 1, createdDay: state.day };
    waypoints.push(waypoint);
    if (typeof log === 'function') log(`Waypoint ${waypoint.index} marcado em ${x},${y}.`);
  }

  function removeNearestWaypoint(x, y) {
    const waypoints = state?.world?.livingWorld?.waypoints || [];
    if (!waypoints.length) return;
    let bestIndex = -1;
    let bestDist = Infinity;
    for (let i = 0; i < waypoints.length; i++) {
      const d = dist(x, y, waypoints[i].x, waypoints[i].y);
      if (d < bestDist) { bestDist = d; bestIndex = i; }
    }
    if (bestIndex < 0 || bestDist > 8) return;
    const [removed] = waypoints.splice(bestIndex, 1);
    waypoints.forEach((wp, i) => { wp.index = i + 1; });
    if (typeof log === 'function') log(`Waypoint ${removed.index || ''} removido.`);
  }

  function renderGlobalMap() {
    const overlay = document.getElementById('livingWorldMapOverlay');
    const canvasEl = document.getElementById('livingWorldMapCanvas');
    if (!overlay?.classList.contains('active') || !canvasEl || !state?.world) return;
    const cols = getWorldCols();
    const rows = getWorldRows();
    canvasEl.width = cols;
    canvasEl.height = rows;
    const mapCtx = canvasEl.getContext('2d');
    const image = mapCtx.createImageData(cols, rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const color = hexToRgb(terrainColors[state.terrain?.[y]?.[x]] || '#46683a');
        const idx = (y * cols + x) * 4;
        const discovered = state.world.exploration?.[y]?.[x] || 0;
        const shade = discovered ? 1 : 0.22;
        image.data[idx] = Math.floor(color.r * shade);
        image.data[idx + 1] = Math.floor(color.g * shade);
        image.data[idx + 2] = Math.floor(color.b * shade);
        image.data[idx + 3] = 255;
      }
    }
    mapCtx.putImageData(image, 0, 0);
    drawGlobalMapPoints(mapCtx);
    updateGlobalMapStats();
  }

  function drawGlobalMapPoints(mapCtx) {
    for (const poi of state.world.pointsOfInterest || []) {
      if (!poi.discovered) continue;
      mapCtx.fillStyle = '#f7b84a';
      mapCtx.fillRect(poi.x - 1, poi.y - 1, 3, 3);
    }
    for (const c of state.colonists || []) {
      mapCtx.fillStyle = '#9bd36a';
      mapCtx.fillRect(Math.round(c.x) - 1, Math.round(c.y) - 1, 3, 3);
    }
    for (const visitor of state.visitors || []) {
      mapCtx.fillStyle = visitor.kind === 'merchant' ? '#ffd166' : '#79c7e8';
      mapCtx.fillRect(Math.round(visitor.x) - 1, Math.round(visitor.y) - 1, 3, 3);
    }
    for (const waypoint of state.world.livingWorld?.waypoints || []) {
      mapCtx.strokeStyle = '#ffe2a3';
      mapCtx.lineWidth = 1;
      mapCtx.strokeRect(waypoint.x - 2, waypoint.y - 2, 5, 5);
    }
  }

  function updateGlobalMapStats() {
    const el = document.getElementById('livingWorldMapStats');
    if (!el) return;
    const total = getWorldCols() * getWorldRows();
    let seen = 0;
    let water = 0;
    for (let y = 0; y < getWorldRows(); y++) {
      for (let x = 0; x < getWorldCols(); x++) {
        if (state.world.exploration?.[y]?.[x]) seen++;
        if (state.terrain?.[y]?.[x] === WATER_TILE) water++;
      }
    }
    el.innerHTML = `<h3>Setor</h3><p>Explorado: ${Math.round(seen / Math.max(1, total) * 100)}%</p><p>Agua mapeada: ${Math.round(water / Math.max(1, total) * 100)}%</p><p>Waypoints: ${(state.world.livingWorld?.waypoints || []).length}</p><p>Visitantes: ${(state.visitors || []).length}</p>`;
  }

  function hexToRgb(hex) {
    const value = String(hex || '#000').replace('#', '');
    return {
      r: parseInt(value.slice(0, 2), 16) || 0,
      g: parseInt(value.slice(2, 4), 16) || 0,
      b: parseInt(value.slice(4, 6), 16) || 0
    };
  }

  function installGlobalMapKeys() {
    window.addEventListener('keydown', event => {
      const target = event.target;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      if (event.code !== 'KeyM') return;
      if (!state || (appScreen !== SCREEN.PLAYING && appScreen !== SCREEN.PAUSED)) return;
      event.preventDefault();
      toggleGlobalMap();
    });
  }

  function installSystems() {
    installLivingWorldDefinitions();
    patchWorldGenerator();
    patchAnimalBehavior();
    patchMobSpawning();
    patchPhysicalDrops();
    installInteractionFixes();
    installWaterGameplayHooks();
    ensureGlobalMapUi();
    installGlobalMapKeys();
    window.GameSystems?.registerTick('living-world', livingWorldTick, { order: 82 });
    window.GameSystems?.registerTileRenderer('living-world.water', drawWaterTile, { order: 2 });
    window.GameSystems?.registerCollisionProvider('living-world.water', waterCollisionProvider, { order: 12 });
    window.GameSystems?.registerWorldOverlay('living-world.waypoints', drawLivingWorldMarkers, { order: 92 });
    window.GameSystems?.registerDrawOverlay('living-world.visitors', drawVisitorsOverlay, { order: 76 });
  }

  window.HavenfallLivingWorld = Object.freeze({
    ensureWorldWater,
    spawnLooseItem,
    spawnLooseResource,
    toggleGlobalMap,
    renderGlobalMap,
    addWaypoint,
    removeNearestWaypoint,
    animalProfiles
  });

  installSystems();
})();
