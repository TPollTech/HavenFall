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

  function install() {
    if (window.HavenfallContext.livingWorldInstalled) return;
    window.HavenfallContext.livingWorldInstalled = true;
    wrapWorldGeneration();
    wrapAnimalMovement();
    installMapControls();
    window.GameSystems?.registerTick?.('living-world.ecology', livingWorldTick, { order: 34 });
    window.GameSystems?.registerTileRenderer?.('living-world.water', drawWaterTile, { order: 6 });
    window.GameSystems?.registerWorldOverlay?.('living-world.markers', drawLivingWorldMarkers, { order: 92 });
    window.GameSystems?.registerCollisionProvider?.('living-world.water-collision', waterCollisionAt, { order: 8 });
    window.HavenfallLivingWorld = { version: VERSION, animalProfiles, openMap: openWorldMap, closeMap: closeWorldMap };
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
    mob.brain = mob.brain || {
      homeX: mob.x,
      homeY: mob.y,
      stateTimer: 0,
      waterNeed: 0.2 + Math.random() * 0.45,
      restNeed: Math.random() * 0.35,
      routeSeed: Math.random(),
    };
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
      moveAnimalVector(mob, mob.px - alert.px, mob.py - alert.py, profile.burstSpeed * tick);
      return;
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
    world.livingWorld = { version: VERSION, waterTiles, waypoints: [], visitors: [], lastGrowthDay: 0, lastVisitorDay: 0 };
    return world;
  }

  function ensureLivingState() {
    if (!state) return null;
    state.livingWorld = state.livingWorld || state.world?.livingWorld || { version: VERSION };
    state.livingWorld.version = state.livingWorld.version || VERSION;
    state.livingWorld.waypoints = Array.isArray(state.livingWorld.waypoints) ? state.livingWorld.waypoints : [];
    state.livingWorld.visitors = Array.isArray(state.livingWorld.visitors) ? state.livingWorld.visitors : [];
    if (state.world) state.world.livingWorld = state.livingWorld;
    return state.livingWorld;
  }

  function livingWorldTick(dt) {
    if (!state || appScreen !== SCREEN.PLAYING) return;
    const living = ensureLivingState();
    if (!living) return;
    const tick = dt * (state.speed || 1);
    if (living.lastGrowthDay !== state.day) {
      living.lastGrowthDay = state.day;
      growNaturePass();
      maybeCreateVisitorGroup();
    }
    updateVisitors(tick);
    if (mapOverlay?.classList.contains('show')) drawWorldMap();
  }

  function growNaturePass() {
    const attempts = Math.max(5, Math.floor((getWorldCols() * getWorldRows()) / 1800));
    let added = 0;
    for (let i = 0; i < attempts; i++) {
      const tile = naturalGrowthTile();
      if (!tile) continue;
      const type = Math.random() < 0.68 ? 'tree' : Math.random() < 0.72 ? 'bush' : 'berry';
      state.objects.push({ id: uid('obj'), type, x: tile.x, y: tile.y, wild: true, age: 0 });
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
      const plants = nearbyPlantCount(x, y, 5);
      const water = nearbyWaterCount(x, y, 6);
      if (plants + water <= 0 && Math.random() < 0.78) continue;
      if (Math.random() < Math.min(0.85, 0.16 + plants * 0.05 + water * 0.08)) return { x, y };
    }
    return null;
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
    const groupSize = kind === 'merchant' ? 1 : 1 + Math.floor(Math.random() * 2);
    const entry = edgeTileForVisitor();
    for (let i = 0; i < groupSize; i++) {
      living.visitors.push({ id: `visitor_${Date.now()}_${i}`, kind, label, x: entry.x, y: entry.y + i, px: entry.x * TILE + TILE / 2, py: (entry.y + i) * TILE + TILE / 2, targetX: state.world.spawn.x + 3, targetY: state.world.spawn.y + 3 + i, phase: 'arriving', ageHours: 0 });
    }
    if (typeof log === 'function') log(`${label}${groupSize > 1 ? 's' : ''} avistado${groupSize > 1 ? 's' : ''} vindo pela borda do mapa.`);
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
        if (v.kind === 'merchant' && typeof addResources === 'function') {
          addResources({ food: 2, wood: 2 });
          if (typeof log === 'function') log('Mercador compartilhou uma pequena oferta de passagem: +2 comida, +2 madeira.');
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
  function waterCollisionAt(x, y) { return isWaterTile(x, y) ? { blocks: true, kind: 'water' } : null; }
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
    ctx.strokeStyle = 'rgba(3, 7, 18, .32)';
    ctx.strokeRect(px + 0.5, py + 0.5, t - 1, t - 1);
    ctx.restore();
  }

  function drawLivingWorldMarkers() {
    if (!state) return;
    const living = ensureLivingState();
    if (!living) return;
    ctx.save();
    for (const wp of living.waypoints || []) drawWaypointMarker(wp);
    for (const v of living.visitors || []) drawVisitorMarker(v);
    ctx.restore();
  }

  function drawWaypointMarker(wp) {
    const px = wp.x * TILE + TILE / 2;
    const py = wp.y * TILE + TILE / 2;
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = 'rgba(248, 215, 138, .92)';
    ctx.strokeStyle = 'rgba(2, 6, 23, .85)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#020617'; ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(String(wp.index || ''), 0, 4);
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
    mapOverlay.addEventListener('click', event => { if (event.target === mapOverlay || event.target.closest('[data-close-living-map]')) closeWorldMap(); });
    mapCanvas.addEventListener('click', onMapClick);
    return mapOverlay;
  }

  function toggleWorldMap() { ensureMapOverlay().classList.contains('show') ? closeWorldMap() : openWorldMap(); }
  function openWorldMap() { ensureMapOverlay(); drawWorldMap(); mapOverlay.classList.add('show'); mapOverlay.setAttribute('aria-hidden', 'false'); }
  function closeWorldMap() { if (!mapOverlay) return; mapOverlay.classList.remove('show'); mapOverlay.setAttribute('aria-hidden', 'true'); }

  function drawWorldMap() {
    if (!mapCanvas || !state?.terrain) return;
    const cols = getWorldCols(), rows = getWorldRows();
    const rect = mapCanvas.getBoundingClientRect();
    const scale = Math.max(2, Math.floor(Math.min(rect.width / cols, rect.height / rows)));
    mapCanvas.width = cols * scale;
    mapCanvas.height = rows * scale;
    const mctx = mapCanvas.getContext('2d');
    mctx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const terrain = state.terrain[y]?.[x] || 'grass';
      const seen = state.world?.exploration?.[y]?.[x] || 0;
      mctx.fillStyle = mapColor(terrain, seen);
      mctx.fillRect(x * scale, y * scale, scale, scale);
    }
    for (const wp of ensureLivingState()?.waypoints || []) drawMapDot(mctx, wp.x, wp.y, scale, '#f8d78a', Math.max(2, scale * 1.5));
    for (const c of state.colonists || []) drawMapDot(mctx, c.x, c.y, scale, '#e5edf8', Math.max(2, scale * 1.4));
    for (const v of ensureLivingState()?.visitors || []) drawMapDot(mctx, v.x, v.y, scale, v.kind === 'merchant' ? '#facc15' : '#7dd3fc', Math.max(2, scale * 1.4));
  }

  function mapColor(terrain, seen) {
    const base = terrain === 'water' ? [34, 116, 174] : terrain === 'stone' ? [82, 91, 107] : terrain === 'sand' ? [137, 109, 61] : terrain === 'dirt' ? [103, 73, 46] : [48, 112, 67];
    const factor = seen === 2 ? 1 : seen === 1 ? 0.52 : 0.22;
    return `rgb(${Math.floor(base[0] * factor)},${Math.floor(base[1] * factor)},${Math.floor(base[2] * factor)})`;
  }

  function drawMapDot(mctx, x, y, scale, color, radius) {
    mctx.fillStyle = color;
    mctx.beginPath();
    mctx.arc(x * scale + scale / 2, y * scale + scale / 2, radius, 0, Math.PI * 2);
    mctx.fill();
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
      if (nearest && Math.hypot(nearest.x - x, nearest.y - y) < 8) living.waypoints = living.waypoints.filter(wp => wp.id !== nearest.id);
    } else {
      const index = living.waypoints.length + 1;
      living.waypoints.push({ id: `wp_${Date.now()}_${index}`, index, x: clamp(x, 0, getWorldCols() - 1), y: clamp(y, 0, getWorldRows() - 1), label: `Waypoint ${index}` });
      if (typeof log === 'function') log(`Waypoint ${index} marcado em ${x},${y}.`);
    }
    drawWorldMap();
    if (typeof updateUI === 'function') updateUI(true);
  }

  install();
})();
