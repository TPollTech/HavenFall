'use strict';

const MOB_SAFE_ZONE_RADIUS = 15;
const MOB_GLOBAL_DENSITY_CAP = 18;
const MOB_HOSTILE_DENSITY_CAP = 6;
const MOB_SEPARATION_DISTANCE_PX = 26;
const ATTACK_ANIM_DURATION = 0.18;

const mobSpawnConfig = {
  wolf: { maxCount: 3, spawnChance: 0.02, hostile: true },
  spider: { maxCount: 4, spawnChance: 0.035, hostile: true },
  rabbit: { maxCount: 8, spawnChance: 0.075, hostile: false }
};

const mobStatModifiers = Object.freeze({
  wolf: { hp: 100, huntWork: 3.8, damageTaken: 1 },
  spider: { hp: 70, huntWork: 3.8, damageTaken: 1 },
  rabbit: { hp: 42, huntWork: 2.6, damageTaken: 0.72 }
});

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

function isHostileMobType(type) {
  return !!mobSpawnConfig[type]?.hostile;
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
    const tile = {
      x: 2 + Math.floor(Math.random() * Math.max(1, cols - 4)),
      y: 2 + Math.floor(Math.random() * Math.max(1, rows - 4))
    };
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
    id: uid(),
    type,
    x: t.x,
    y: t.y,
    px: t.x * TILE + TILE / 2,
    py: t.y * TILE + TILE / 2,
    dir: 'left',
    anim: 0,
    attackAnimTimer: 0,
    hitAnimTimer: 0,
    hp: stats.hp,
    maxHp: stats.hp,
    state: type === 'rabbit' ? 'wander' : type === 'spider' ? 'sleep' : 'hunting',
    target: null
  };
  ensureMobState().push(mob);
  return mob;
}

function mobSpawnTile(type) {
  const world = state?.world;
  const preferEdge = type === 'spider' || type === 'wolf';
  if (!world) return (preferEdge ? randomSafeEdgeTile(type) : randomSafeInteriorTile(type)) || randomSafeEdgeTile(type);

  for (let i = 0; i < 120; i++) {
    const tile = preferEdge ? (typeof randomEdgeTile === 'function' ? randomEdgeTile() : randomSafeEdgeTile(type)) : (typeof freeRandomTile === 'function' ? freeRandomTile() : randomSafeInteriorTile(type));
    if (!isValidMobSpawnTile(type, tile)) continue;
    const biome = world.biomes?.[tile.y]?.[tile.x] || biomeAt?.(tile.x, tile.y, state.config?.seed);
    const allowed = biomeDefinitions?.[biome]?.spawnMobs?.includes(type) ?? true;
    if (allowed) return tile;
  }

  return (preferEdge ? randomSafeEdgeTile(type) : randomSafeInteriorTile(type)) || randomSafeEdgeTile(type);
}

function installMobRuntimeHooks() {
  if (window.HavenfallContext?.mobRuntimeHooksInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};

  if (typeof spawnWolf === 'function') {
    spawnWolf = function spawnWolfSafe() {
      if (!state || !Array.isArray(state.wolves) || !canSpawnMob('wolf')) return null;
      const tile = mobSpawnTile('wolf');
      if (!tile) return null;
      const wolf = {
        id: uid(),
        x: tile.x,
        y: tile.y,
        px: tile.x * TILE + TILE / 2,
        py: tile.y * TILE + TILE / 2,
        anim: 0,
        dir: 'left',
        hp: mobStatModifiers.wolf.hp,
        maxHp: mobStatModifiers.wolf.hp,
        morale: 100,
        aggression: 1 + Math.random() * 0.25,
        state: 'hunting',
        attackAnimTimer: 0,
        hitAnimTimer: 0
      };
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
    c.task = null;
    c.path = [];
    c.work = 0;
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
      ctx.save();
      ctx.translate(off.x, off.y);
      nativeDrawColonist(c);
      ctx.restore();
    };
  }

  if (typeof drawWolf === 'function') {
    const nativeDrawWolf = drawWolf;
    drawWolf = function drawWolfWithImpact(wolf) {
      const off = combatRenderOffset(wolf);
      if (!off.x && !off.y) return nativeDrawWolf(wolf);
      ctx.save();
      ctx.translate(off.x, off.y);
      nativeDrawWolf(wolf);
      ctx.restore();
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
    if (mob.type === 'rabbit') updateRabbit(mob, tick);
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

function updateRabbit(mob, tick) {
  mob.anim += tick;
  const threat = nearestColonistToMob(mob, 4);
  if (threat && threat.task?.type !== 'huntMob') {
    mob.state = 'flee';
    moveMobVector(mob, mob.px - threat.px, mob.py - threat.py, 72 * tick);
    return;
  }
  if (!mob.target || Math.random() < 0.006 * state.speed) mob.target = nearbyFreeTarget(mob, 5);
  moveMobToTarget(mob, 26 * tick);
}

function updateSpider(mob, tick) {
  mob.anim += tick;
  const night = state.hour < 6 || state.hour > 20;
  if (!night) {
    mob.state = 'sleep';
    return;
  }
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

function getMobAt(x, y) {
  return ensureMobState().find(m => Math.round(m.x) === x && Math.round(m.y) === y) || null;
}

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
    c.task.x = adj.x;
    c.task.y = adj.y;
    c.path = findPath(c.x, c.y, adj.x, adj.y);
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
    c.task = null;
    c.note = 'Caça concluída';
    c.mood = clamp(c.mood + (mob.type === 'rabbit' ? 2 : 4), 0, 100);
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
  mob.px = nextPx;
  mob.py = nextPy;
  mob.x = nextX;
  mob.y = nextY;
}

function resolveMobOverlap() {
  const list = allMobileEntities();
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      let dx = (a.px || 0) - (b.px || 0);
      let dy = (a.py || 0) - (b.py || 0);
      let len = Math.hypot(dx, dy);
      if (len >= MOB_SEPARATION_DISTANCE_PX) continue;
      if (len < 0.001) {
        const angle = ((i + 1) * 1.917 + (j + 1) * 0.731) % (Math.PI * 2);
        dx = Math.cos(angle);
        dy = Math.sin(angle);
        len = 1;
      }
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
  attacker.attackAnimTimer = ATTACK_ANIM_DURATION;
  attacker.attackOffsetX = dx / len * amount;
  attacker.attackOffsetY = dy / len * amount;
  target.hitAnimTimer = ATTACK_ANIM_DURATION;
  target.hitOffsetX = -dx / len * amount * 0.45;
  target.hitOffsetY = -dy / len * amount * 0.45;
}

function decayImpactTimers(entity, tick) {
  if (!entity) return;
  if (entity.attackAnimTimer > 0) entity.attackAnimTimer = Math.max(0, entity.attackAnimTimer - tick);
  if (entity.hitAnimTimer > 0) entity.hitAnimTimer = Math.max(0, entity.hitAnimTimer - tick);
}

function combatRenderOffset(entity) {
  const attackT = Math.max(0, entity?.attackAnimTimer || 0) / ATTACK_ANIM_DURATION;
  const hitT = Math.max(0, entity?.hitAnimTimer || 0) / ATTACK_ANIM_DURATION;
  return {
    x: (entity?.attackOffsetX || 0) * attackT + (entity?.hitOffsetX || 0) * hitT,
    y: (entity?.attackOffsetY || 0) * attackT + (entity?.hitOffsetY || 0) * hitT
  };
}

function emitBloodParticles(x, y, amount = 6) {
  const now = performance.now() / 1000;
  window.bloodParticles = Array.isArray(window.bloodParticles) ? window.bloodParticles : [];
  for (let i = 0; i < amount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 18 + Math.random() * 48;
    window.bloodParticles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      bornAt: now,
      age: 0,
      life: 0.42 + Math.random() * 0.28,
      size: 1.4 + Math.random() * 2.2
    });
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
  ctx.save();
  ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
  ctx.scale(viewTransform.scale, viewTransform.scale);
  for (const p of list) {
    const alpha = Math.max(0, 1 - p.age / p.life);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function finishMobDeath(mob, index, killer = null) {
  if (index >= 0) state.mobs.splice(index, 1);
  emitBloodParticles(mob.px, mob.py, mob.type === 'rabbit' ? 4 : 8);
  const gain = mob.type === 'rabbit' ? { food: 4 } : mob.type === 'spider' ? { food: 2 } : { food: 6 };
  addResources(gain);
  log(`${killer?.name || 'A colônia'} abateu ${mobName(mob.type)}. +${gain.food} comida.`);
}

function mobName(type) {
  if (type === 'wolf') return 'lobo';
  if (type === 'spider') return 'aranha';
  if (type === 'rabbit') return 'coelho';
  return type;
}

installMobRuntimeHooks();
window.updateMobsTick = updateMobsTick;
window.spawnMob = spawnMob;
window.getMobAt = getMobAt;
window.assignHuntMob = assignHuntMob;