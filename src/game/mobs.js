'use strict';

const mobSpawnConfig = {
  wolf: { maxCount: 4, spawnChance: 0.02 },
  spider: { maxCount: 6, spawnChance: 0.04 },
  rabbit: { maxCount: 8, spawnChance: 0.08 }
};

window.mobSpawnConfig = mobSpawnConfig;

function ensureMobState() {
  if (!state) return [];
  state.mobs = Array.isArray(state.mobs) ? state.mobs : [];
  return state.mobs;
}

function countMob(type) {
  const mobs = ensureMobState();
  const normal = mobs.filter(m => m.type === type).length;
  const wolves = type === 'wolf' ? (state?.wolves?.length || 0) : 0;
  return normal + wolves;
}

function canSpawnMob(type) {
  const cfg = mobSpawnConfig[type];
  if (!cfg || !state) return false;
  return countMob(type) < cfg.maxCount;
}

function spawnMob(type, tile = null) {
  if (!canSpawnMob(type)) return null;
  const t = tile || mobSpawnTile(type);
  if (!t) return null;
  const mob = {
    id: uid(),
    type,
    x: t.x,
    y: t.y,
    px: t.x * TILE + TILE / 2,
    py: t.y * TILE + TILE / 2,
    dir: 'left',
    anim: 0,
    hp: type === 'spider' ? 70 : type === 'rabbit' ? 22 : 100,
    state: type === 'rabbit' ? 'wander' : type === 'spider' ? 'sleep' : 'hunting',
    target: null
  };
  ensureMobState().push(mob);
  return mob;
}

function mobSpawnTile(type) {
  const world = state?.world;
  if (!world) return freeRandomTile?.() || randomEdgeTile?.();
  for (let i = 0; i < 90; i++) {
    const edge = type === 'spider' || type === 'wolf';
    const t = edge ? randomEdgeTile() : freeRandomTile();
    if (!t || isBlocked(t.x, t.y)) continue;
    const biome = world.biomes?.[t.y]?.[t.x] || biomeAt?.(t.x, t.y, state.config?.seed);
    const allowed = biomeDefinitions?.[biome]?.spawnMobs?.includes(type) ?? true;
    if (allowed) return t;
  }
  return null;
}

function installMobSpawnPatches() {
  if (window.HavenfallContext?.mobSpawnPatched) return;
  window.HavenfallContext = window.HavenfallContext || {};

  if (typeof spawnWolf === 'function') {
    const nativeSpawnWolf = spawnWolf;
    spawnWolf = function spawnWolfWithCap() {
      if (!canSpawnMob('wolf')) return null;
      const wolf = nativeSpawnWolf();
      enforceWolfCap();
      return wolf;
    };
  }

  const nativeMoveAlongPath = moveAlongPath;
  moveAlongPath = function moveAlongPathWithSlow(c, tick) {
    const slow = c?.slowTimer > 0 ? 0.62 : 1;
    return nativeMoveAlongPath(c, tick * slow);
  };

  window.HavenfallContext.mobSpawnPatched = true;
}

function enforceWolfCap() {
  if (!state?.wolves) return;
  const cap = mobSpawnConfig.wolf.maxCount;
  while (state.wolves.length > cap) state.wolves.shift();
}

function updateMobsTick(dt) {
  installMobSpawnPatches();
  if (!state || appScreen !== SCREEN.PLAYING) return;
  const tick = dt * state.speed;
  const mobs = ensureMobState();
  enforceWolfCap();
  updateSlowTimers(tick);
  maybeSpawnMobs(dt);

  for (let i = mobs.length - 1; i >= 0; i--) {
    const mob = mobs[i];
    if (mob.type === 'rabbit') updateRabbit(mob, tick);
    else if (mob.type === 'spider') updateSpider(mob, tick);
    if ((mob.hp ?? 1) <= 0) finishMobDeath(mob, i);
  }

  updateWolfPackLogic(tick);
}

function updateSlowTimers(tick) {
  for (const c of state.colonists || []) {
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
  if (threat) {
    mob.state = 'flee';
    const dx = mob.px - threat.px;
    const dy = mob.py - threat.py;
    moveMobVector(mob, dx, dy, 72 * tick);
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
  if (target) {
    mob.state = 'hunt';
    moveMobVector(mob, target.px - mob.px, target.py - mob.py, 44 * tick);
    const d = Math.hypot(target.px - mob.px, target.py - mob.py);
    if (d < 34) applySpiderSlow(target, tick);
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
    if (rabbit && Math.random() < 0.015 * state.speed) {
      wolf.target = { x: rabbit.x, y: rabbit.y };
    }
  }
}

function applySpiderSlow(c, tick) {
  c.slowTimer = Math.max(c.slowTimer || 0, 7);
  c.statuses = Array.isArray(c.statuses) ? c.statuses : [];
  if (!c.statuses.includes('lento')) c.statuses.push('lento');
  c.health = clamp(c.health - tick * 0.22, 1, 100);
  c.note = 'Lento por picada de aranha';
}

function nearestColonistToMob(mob, radius) {
  let best = null;
  let bestDist = Infinity;
  for (const c of state.colonists || []) {
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
    if (!isBlocked(x, y)) return { x, y };
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
  mob.px += dx / len * step;
  mob.py += dy / len * step;
  mob.dir = dx > 0 ? 'right' : 'left';
  mob.x = Math.round((mob.px - TILE / 2) / TILE);
  mob.y = Math.round((mob.py - TILE / 2) / TILE);
  if (isBlocked(mob.x, mob.y)) mob.target = null;
}

function finishMobDeath(mob, index) {
  const drops = mobDrop(mob);
  addItems(drops.items || {});
  addResources(drops.resources || {});
  state.mobs.splice(index, 1);
  log(`${mobName(mob.type)} abatido. Recursos adicionados ao estoque.`);
}

function mobDrop(mob) {
  const hunterHasKnife = state.colonists?.some(c => c.equipment?.weapon === 'knife' || c.equipment?.tool === 'knife');
  const bonus = hunterHasKnife ? 1.5 : 1;
  if (mob.type === 'rabbit') return { items: { rawMeat: Math.ceil(2 * bonus), leather: Math.ceil(1 * bonus) } };
  if (mob.type === 'spider') return { items: { rope: 1, venom: 1 } };
  if (mob.type === 'wolf') return { items: { rawMeat: Math.ceil(4 * bonus), leather: Math.ceil(2 * bonus), bones: 1 } };
  return { items: {} };
}

function mobName(type) {
  return ({ rabbit: 'Coelho', spider: 'Aranha', wolf: 'Lobo' })[type] || type;
}

function installMobRendererHook() {
  if (window.HavenfallContext?.mobRendererHooked || typeof draw !== 'function') return;
  const nativeDraw = draw;
  draw = function drawWithMobs() {
    nativeDraw();
    drawMobsOverlay();
  };
  window.HavenfallContext.mobRendererHooked = true;
}

function drawMobsOverlay() {
  if (!state?.mobs?.length || appScreen !== SCREEN.PLAYING) return;
  ctx.save();
  ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
  ctx.scale(viewTransform.scale, viewTransform.scale);
  for (const mob of state.mobs) drawMob(mob);
  ctx.restore();
}

function drawMob(mob) {
  const x = mob.px;
  const y = mob.py;
  ctx.save();
  if (mob.type === 'rabbit') {
    ctx.fillStyle = '#d8d0bd';
    ctx.beginPath(); ctx.ellipse(x, y + 12, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eee7d9';
    ctx.beginPath(); ctx.ellipse(x + 8, y + 4, 5, 9, 0, 0, Math.PI * 2); ctx.fill();
  } else if (mob.type === 'spider') {
    ctx.fillStyle = '#3b303e';
    ctx.beginPath(); ctx.ellipse(x, y + 10, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3b303e';
    for (let i = -3; i <= 3; i += 2) {
      ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.lineTo(x + i * 7, y + 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.lineTo(x + i * 7, y + 19); ctx.stroke();
    }
  }
  ctx.restore();
}

window.canSpawnMob = canSpawnMob;
window.spawnMob = spawnMob;
window.updateMobsTick = updateMobsTick;
window.mobDrop = mobDrop;

installMobSpawnPatches();
installMobRendererHook();
