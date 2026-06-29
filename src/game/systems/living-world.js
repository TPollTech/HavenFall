'use strict';

(() => {
  if (window.HavenfallContext?.livingWorldInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.livingWorldInstalled = true;

  const WATER_TILE = 'water';
  const VISITOR_STAY_HOURS = 10;
  const BRIDGE_TYPES = new Set(['bridge', 'wood_bridge', 'stone_bridge']);
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

  function install() {
    installDefinitions();
    patchWorldGeneration();
    patchAnimalBehavior();
    patchMobSpawning();
    window.GameSystems?.registerTick?.('living-world.ecology', livingWorldTick, { order: 34 });
    window.GameSystems?.registerTileRenderer?.('living-world.water', drawWaterTile, { order: 6 });
    window.GameSystems?.registerWorldOverlay?.('living-world.markers', drawLivingWorldMarkers, { order: 92 });
    window.GameSystems?.registerCollisionProvider?.('living-world.water-collision', waterCollisionAt, { order: 8 });
    installMapControls();
    window.HavenfallLivingWorld = {
      version: 'living-world-v2',
      animalProfiles,
      openMap: openWorldMap,
      closeMap: closeWorldMap,
      ensureWorldWater: enhanceWorldWithWater,
      createWaypoint,
      generateExplorationQueue
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
    state.livingWorld.nextVisitorDay = Number(state.livingWorld.nextVisitorDay || 2);
    state.visitors = Array.isArray(state.visitors) ? state.visitors : [];
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
    world.livingWorld = { ...(world.livingWorld || {}), waterEnhanced: true, waterTiles: world.waterTiles, version: 'living-world-v2' };
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
    return { skin: skins[seed % skins.length], hair: hairs[(seed + 2) % hairs.length], clothes: clothes[seed % clothes.length], accent: kind === 'merchant' ? '#d6a24a' : '#8fb8be' };
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
    nativeUpdatePassiveMob = updatePassiveMob;
    updatePassiveMob = function updateLivingPassiveMob(mob, tick) {
      if (!mob || !animalProfiles[mob.type] || !state?.world) return nativeUpdatePassiveMob(mob, tick);
      const profile = animalProfiles[mob.type];
      mob.brain = mob.brain || { pause: 0, target: null, state: 'idle' };
      if (mob.brain.pause > 0) { mob.brain.pause -= tick; return; }
      const danger = nearestAwareColonist(mob, profile.alertRadius);
      if (danger) {
        const dx = mob.x - danger.x;
        const dy = mob.y - danger.y;
        const len = Math.hypot(dx, dy) || 1;
        moveActorVector(mob, dx / len, dy / len, profile.burstSpeed * tick);
        mob.brain.state = 'fleeing';
        return;
      }
      if (!mob.brain.target || Math.random() < 0.018 * tick) mob.brain.target = chooseAnimalTarget(mob, profile);
      if (mob.brain.target) {
        const tx = mob.brain.target.x * TILE + TILE / 2;
        const ty = mob.brain.target.y * TILE + TILE / 2;
        const d = Math.hypot(tx - mob.px, ty - mob.py);
        if (d < 7) { mob.brain.pause = 0.3 + Math.random() * 1.5; mob.brain.target = null; return; }
        moveActorVector(mob, tx - mob.px, ty - mob.py, profile.baseSpeed * tick);
      }
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

  function chooseAnimalTarget(mob, profile) {
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * profile.wanderRadius;
      const x = clamp(Math.round(mob.x + Math.cos(angle) * r), 1, getWorldCols() - 2);
      const y = clamp(Math.round(mob.y + Math.sin(angle) * r), 1, getWorldRows() - 2);
      if (animalTileOpen(x, y)) return { x, y };
    }
    return null;
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

  function moveActorVector(actor, dx, dy, amount) {
    const len = Math.hypot(dx, dy) || 1;
    const nx = actor.px + (dx / len) * amount;
    const ny = actor.py + (dy / len) * amount;
    const tileX = Math.round((nx - TILE / 2) / TILE);
    const tileY = Math.round((ny - TILE / 2) / TILE);
    if (typeof isBlocked === 'function' && isBlocked(tileX, tileY)) return;
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
