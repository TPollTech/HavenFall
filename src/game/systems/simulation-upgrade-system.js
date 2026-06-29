'use strict';

(() => {
  if (window.HavenfallContext?.simulationUpgradeInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.simulationUpgradeInstalled = true;

  const VERSION = 'simulation-upgrade-1.0.0';
  const BED_TYPES = new Set(['bed']);
  const LIGHT_DEFS = Object.freeze({
    campfire: { radius: 7, intensity: 0.86, flicker: true, warm: true },
    torch: { radius: 6, intensity: 0.72, flicker: true, warm: true },
    wall_torch: { radius: 6, intensity: 0.72, flicker: true, warm: true },
    forge: { radius: 6, intensity: 0.78, flicker: true, warm: true },
    stove: { radius: 4, intensity: 0.48, flicker: true, warm: true }
  });
  const HOSTILE_TYPES = new Set(['wolf', 'blood_wolf', 'spider', 'raider', 'hostile']);
  const PASSIVE_SPEED = { rabbit: 24, deer: 32, goat: 26, sheep: 21, pig: 23, cow: 16, chicken: 23, duck: 21, turkey: 21, squirrel: 34, turtle: 9 };
  const WANDER_RADIUS = { rabbit: 4, deer: 7, goat: 5, sheep: 5, pig: 5, cow: 3, chicken: 3, duck: 4, turkey: 4, squirrel: 6, turtle: 3 };

  let drawColonistPatched = false;
  let mobPatchInstalled = false;
  let lastFlickerUpdate = 0;
  let roofPulse = 0;
  let lightingPulse = 999;
  let roofEnsureTick = 0;

  function num(v, fallback = 0) { v = Number(v); return Number.isFinite(v) ? v : fallback; }
  function clamp01(v) { return Math.max(0, Math.min(1, num(v))); }
  function key(x, y) { return `${Math.round(x)},${Math.round(y)}`; }
  function hasFn(name) { return typeof window[name] === 'function'; }
  function isHostileType(type) { return HOSTILE_TYPES.has(type) || !!mobSpawnConfig?.[type]?.hostile; }
  function worldRows() { return Number(state?.world?.rows || state?.terrain?.length || 0); }
  function worldCols() { return Number(state?.world?.cols || state?.terrain?.[0]?.length || 0); }
  function inWorld(x, y) { return x >= 0 && y >= 0 && x < worldCols() && y < worldRows(); }
  function isNightHour(hour = state?.hour || 12) { return hour >= 21 || hour < 6; }
  function tileBlocked(x, y, target = null) { return !inWorld(x, y) || (typeof isBlocked === 'function' ? isBlocked(x, y, target) : false); }
  function nowTime() { return (state?.day || 1) * 24 + (state?.hour || 0); }
  function currentSchedule(c) { return window.ScheduleManager?.getScheduleState?.(c, state?.hour || 0); }
  function scheduleSleepValue() { return window.ScheduleManager?.SCHEDULE?.SLEEP ?? 0; }
  function safeLog(text, id, cooldownHours = 0.4) {
    if (typeof log !== 'function' || !state) return;
    state.simulationMessages = state.simulationMessages || {};
    const t = nowTime();
    if (id && state.simulationMessages[id] && t - state.simulationMessages[id] < cooldownHours) return;
    if (id) state.simulationMessages[id] = t;
    log(text);
  }

  function ensureColonyBrain() {
    if (!state) return null;
    state.ai = state.ai || {};
    state.ai.reservations = state.ai.reservations || { jobs: {}, objects: {}, beds: {}, roof: {} };
    state.ai.debug = state.ai.debug || {};
    state.ai.lastAutoSpeedNotice = state.ai.lastAutoSpeedNotice || null;
    return state.ai;
  }

  function ensureColonistBrain(c) {
    if (!c) return c;
    c.ai = c.ai || {};
    c.ai.state = c.ai.state || (c.task?.type || 'idle');
    c.ai.idleTimer = Number(c.ai.idleTimer || 0);
    c.ai.jobSearchTimer = Number(c.ai.jobSearchTimer || 0);
    c.ai.stuckTimer = Number(c.ai.stuckTimer || 0);
    c.ai.lastPos = c.ai.lastPos || { x: c.x, y: c.y, px: c.px, py: c.py };
    c.ai.debug = c.ai.debug || {};
    c.needs = c.needs || {};
    c.needs.sleep = clamp01(c.needs.sleep ?? (c.energy ?? 80) / 100);
    c.needs.hunger = clamp01(c.needs.hunger ?? (c.hunger ?? 78) / 100);
    c.needs.comfort = clamp01(c.needs.comfort ?? 0.5);
    return c;
  }

  function releaseObjectReservations(c, includeBed = false) {
    const ai = ensureColonyBrain();
    if (!ai || !c) return;
    for (const obj of state.objects || []) {
      if (obj.reservedBy === c.id && (!BED_TYPES.has(obj.type) || includeBed)) obj.reservedBy = null;
      if (obj.occupiedBy === c.id && includeBed) obj.occupiedBy = null;
    }
    for (const table of [ai.reservations.objects, ai.reservations.jobs, ai.reservations.roof]) {
      for (const [k, v] of Object.entries(table || {})) if (String(v) === String(c.id)) delete table[k];
    }
    if (includeBed) {
      for (const [k, v] of Object.entries(ai.reservations.beds || {})) if (String(v) === String(c.id)) delete ai.reservations.beds[k];
    }
  }

  function releaseBed(c) {
    if (!c || !state?.objects) return;
    const ai = ensureColonyBrain();
    for (const bed of state.objects) {
      if (!BED_TYPES.has(bed.type)) continue;
      if (String(bed.reservedBy) === String(c.id)) bed.reservedBy = null;
      if (String(bed.occupiedBy) === String(c.id)) bed.occupiedBy = null;
      if (ai?.reservations?.beds?.[bed.id] && String(ai.reservations.beds[bed.id]) === String(c.id)) delete ai.reservations.beds[bed.id];
    }
  }

  function isBedAvailableFor(bed, c) {
    if (!bed || !BED_TYPES.has(bed.type)) return false;
    if (bed.occupiedBy && String(bed.occupiedBy) !== String(c.id)) return false;
    if (bed.reservedBy && String(bed.reservedBy) !== String(c.id)) return false;
    if (bed.ownerId && String(bed.ownerId) !== String(c.id)) return false;
    return true;
  }

  function reserveBedFor(c, bed) {
    if (!c || !bed) return false;
    const ai = ensureColonyBrain();
    releaseBed(c);
    bed.reservedBy = c.id;
    ai.reservations.beds[bed.id] = c.id;
    c.ai.reservedBedId = bed.id;
    return true;
  }

  function findAvailableBed(c) {
    if (!state?.objects?.length) return null;
    let best = null;
    let bestScore = Infinity;
    for (const bed of state.objects) {
      if (!isBedAvailableFor(bed, c)) continue;
      const ownerBias = bed.ownerId && String(bed.ownerId) === String(c.id) ? -100 : 0;
      const score = ownerBias + Math.hypot(c.x - bed.x, c.y - bed.y);
      if (score < bestScore) { bestScore = score; best = bed; }
    }
    return best;
  }

  function shouldSleep(c) {
    ensureColonistBrain(c);
    if (!c || c.isUnconscious || c.task?.type === 'sleep') return false;
    if (c.hunger < 18 || c.health < 12) return false;
    const sleepNeed = 1 - clamp01((c.energy ?? 75) / 100);
    const scheduleSleep = currentSchedule(c) === scheduleSleepValue();
    if ((c.energy ?? 100) < 16) return true;
    if (scheduleSleep && (c.energy ?? 100) < 94) return true;
    if (isNightHour() && (c.energy ?? 100) < 52 && !hasImmediateThreat()) return true;
    return sleepNeed > 0.82;
  }

  function startSleepUpgraded(c) {
    if (!state || !c || c.isUnconscious) return false;
    ensureColonistBrain(c);
    releaseObjectReservations(c, false);
    const bed = findAvailableBed(c);
    if (bed && reserveBedFor(c, bed)) {
      const adj = typeof nearestFreeAdjacent === 'function' ? nearestFreeAdjacent(bed.x, bed.y, c.x, c.y) : null;
      const target = adj || { x: bed.x, y: bed.y };
      const already = c.x === target.x && c.y === target.y;
      c.task = { type: 'sleep', x: target.x, y: target.y, bedId: bed.id, bedX: bed.x, bedY: bed.y };
      c.path = already ? [] : (typeof findPath === 'function' ? findPath(c.x, c.y, target.x, target.y, bed) : []);
      c.work = 0;
      c.ai.state = 'moving_to_bed';
      c.ai.currentJob = 'sleep';
      c.ai.debug.lastJob = 'sleep';
      c.note = 'Indo dormir';
      return true;
    }
    c.task = { type: 'sleep', x: c.x, y: c.y, floor: true };
    c.path = [];
    c.work = 0;
    c.ai.state = 'sleeping';
    c.ai.currentJob = 'sleep_on_floor';
    c.ai.debug.lastJob = 'sleep_on_floor';
    c.note = 'Dormindo no chão';
    safeLog(`${c.name} não encontrou cama livre e dormiu no chão.`, `no-bed-${c.id}`, 2);
    return true;
  }

  function wakeColonist(c, reason = 'routine') {
    if (!c) return;
    releaseBed(c);
    c.task = null;
    c.path = [];
    c.work = 0;
    c.sleeping = false;
    c.animation = 'idle';
    c.ai.state = 'waking';
    c.ai.currentJob = null;
    c.note = reason === 'danger' ? 'Acordou em alerta' : 'Acordou descansado';
  }

  function shouldWake(c) {
    if (hasImmediateThreat()) return 'danger';
    if ((c.hunger ?? 100) < 24) return 'hunger';
    const scheduleSleep = currentSchedule(c) === scheduleSleepValue();
    if (!scheduleSleep && (c.energy ?? 100) > 58) return 'schedule';
    if ((c.energy ?? 100) >= 97) return 'rested';
    return null;
  }

  function handleSleepGuard(c, dt) {
    if (!c?.task || c.task.type !== 'sleep') return false;
    ensureColonistBrain(c);
    const tick = dt * Number(state?.speed || 1);
    c.anim = (c.anim || 0) + tick;
    if (Array.isArray(c.path) && c.path.length && typeof moveAlongPath === 'function') {
      c.ai.state = 'moving_to_bed';
      c.note = 'Indo dormir';
      moveAlongPath(c, tick);
      c.x = Math.round((c.px - TILE / 2) / TILE);
      c.y = Math.round((c.py - TILE / 2) / TILE);
      return true;
    }

    const bed = c.task.bedId ? state.objects?.find(o => o.id === c.task.bedId && BED_TYPES.has(o.type)) : null;
    if (bed) {
      bed.occupiedBy = c.id;
      bed.reservedBy = c.id;
      c.px = bed.x * TILE + TILE / 2;
      c.py = bed.y * TILE + TILE / 2;
      c.x = bed.x;
      c.y = bed.y;
    }
    c.sleeping = true;
    c.animation = 'sleep';
    c.ai.state = 'sleeping';
    c.ai.debug.currentJob = bed ? `sleep:${bed.id}` : 'sleep_floor';
    c.energy = clamp((c.energy || 0) + tick * (bed ? 3.2 : 1.65), 0, 100);
    c.mood = clamp((c.mood || 0) + tick * (bed ? 0.38 : 0.08), 0, 100);
    c.hunger = clamp((c.hunger || 100) - tick * 0.08, 0, 100);
    c.needs.sleep = clamp01(c.energy / 100);
    c.needs.hunger = clamp01(c.hunger / 100);
    c.note = bed ? 'Dormindo na cama' : 'Dormindo no chão';
    const wake = shouldWake(c);
    if (wake) wakeColonist(c, wake === 'danger' ? 'danger' : 'routine');
    return true;
  }

  function hasImmediateThreat() {
    if (!state) return false;
    if ((state.wolves || []).length > 0) return true;
    return (state.mobs || []).some(m => isHostileType(m.type) && (typeof isTileDiscovered !== 'function' || isTileDiscovered(Math.round(m.x), Math.round(m.y))));
  }

  function hasCriticalHunger() {
    return (state?.colonists || []).some(c => (c.hunger || 0) < 14 || c.isUnconscious || (c.health || 100) < 18);
  }

  function allColonistsSleeping() {
    const list = (state?.colonists || []).filter(c => !c.isUnconscious);
    return list.length > 0 && list.every(c => c.task?.type === 'sleep' && (c.sleeping || c.ai?.state === 'sleeping'));
  }

  function updateAutoSleepSpeed() {
    if (!state || appScreen !== SCREEN.PLAYING) return;
    const canFastForward = allColonistsSleeping() && !hasImmediateThreat() && !hasCriticalHunger();
    if (canFastForward && state.speed < 3) {
      state.speed = 3;
      safeLog('Todos dormem. O tempo acelera automaticamente até alguém acordar.', 'autospeed-sleep', 8);
    } else if (!canFastForward && state.ai?.lastAutoSpeedNotice === 'sleep' && state.speed > 1) {
      state.speed = 1;
    }
    if (canFastForward) ensureColonyBrain().lastAutoSpeedNotice = 'sleep';
  }

  function updateBrainBefore(c, dt) {
    if (!state || !c) return;
    ensureColonistBrain(c);
    const tick = dt * Number(state.speed || 1);
    c.ai.idleTimer = c.task ? 0 : c.ai.idleTimer + tick;
    c.ai.jobSearchTimer += tick;
    const moved = Math.hypot((c.px || 0) - (c.ai.lastPos?.px || 0), (c.py || 0) - (c.ai.lastPos?.py || 0));
    c.ai.stuckTimer = c.task && moved < 0.2 ? c.ai.stuckTimer + tick : 0;
    c.ai.lastPos = { x: c.x, y: c.y, px: c.px, py: c.py };
    c.ai.state = c.task?.type || 'idle';
  }

  function sleepAutoTask(c) {
    if (!c || c.task) return false;
    if (!shouldSleep(c)) return false;
    return startSleepUpgraded(c);
  }

  function patchStartSleep() {
    if (window.HavenfallContext?.startSleepUpgraded || typeof startSleep !== 'function') return;
    startSleep = startSleepUpgraded;
    window.HavenfallContext.startSleepUpgraded = true;
  }

  function patchSleepingDraw() {
    if (drawColonistPatched || typeof drawColonist !== 'function') return;
    const nativeDrawColonist = drawColonist;
    drawColonist = function drawColonistSimulation(c) {
      if (c?.sleeping || c?.animation === 'sleep') {
        ctx.save();
        ctx.fillStyle = 'rgba(8, 12, 18, .55)';
        ctx.beginPath(); ctx.ellipse(c.px, c.py + 20, 19, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c7d2fe';
        ctx.font = '900 18px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Z', c.px + 16, c.py - 24);
        ctx.restore();
      }
      nativeDrawColonist(c);
    };
    drawColonistPatched = true;
  }

  function patchReservations() {
    if (window.HavenfallContext?.reservationCleanupInstalled) return;
    window.HavenfallContext.reservationCleanupInstalled = true;
    window.releaseColonistReservations = releaseObjectReservations;
  }

  function installMobPatch() {
    if (mobPatchInstalled || typeof updatePassiveMob !== 'function') return;
    const nativeUpdatePassiveMob = updatePassiveMob;
    updatePassiveMob = function updatePassiveMobSimulation(mob, dt) {
      if (!mob) return;
      mob.ai = mob.ai || {};
      mob.ai.timer = Number(mob.ai.timer || 0) + dt;
      if (mob.ai.timer > 1.2 && Math.random() < 0.06) {
        mob.ai.timer = 0;
        const radius = WANDER_RADIUS[mob.type] || 4;
        mob.ai.targetX = clamp(Math.round(mob.x + (Math.random() - 0.5) * radius * 2), 0, worldCols() - 1);
        mob.ai.targetY = clamp(Math.round(mob.y + (Math.random() - 0.5) * radius * 2), 0, worldRows() - 1);
      }
      if (mob.ai.targetX !== undefined && !tileBlocked(mob.ai.targetX, mob.ai.targetY, mob)) {
        const dx = mob.ai.targetX - mob.x;
        const dy = mob.ai.targetY - mob.y;
        const d = Math.hypot(dx, dy);
        const speed = PASSIVE_SPEED[mob.type] || mob.speed || 22;
        if (d > 0.08) {
          mob.x += dx / d * speed * dt / TILE;
          mob.y += dy / d * speed * dt / TILE;
          mob.px = mob.x * TILE + TILE / 2;
          mob.py = mob.y * TILE + TILE / 2;
          mob.dir = dx < 0 ? 'left' : 'right';
          mob.anim = (mob.anim || 0) + dt;
          return;
        }
      }
      nativeUpdatePassiveMob(mob, dt);
    };
    mobPatchInstalled = true;
  }

  function ensureRoofState() {
    if (!state?.world) return null;
    const world = state.world;
    const rows = worldRows(), cols = worldCols();
    const now = performance.now();
    const alreadyReady = Array.isArray(world.roofLayer) && Array.isArray(world.builtRoofLayer);
    if (alreadyReady && now - roofEnsureTick < 500) return world;
    roofEnsureTick = now;

    if (!Array.isArray(world.roofLayer)) world.roofLayer = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
    if (!Array.isArray(world.builtRoofLayer)) world.builtRoofLayer = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
    if (!Array.isArray(world.pendingRoofJobs)) world.pendingRoofJobs = [];

    for (const job of world.pendingRoofJobs) {
      if (!inWorld(job.x, job.y)) continue;
      const cell = world.roofLayer[job.y][job.x] || { planned: true, built: false, progress: 0, flashTimer: 0 };
      cell.planned = true;
      cell.built = !!world.builtRoofLayer[job.y][job.x];
      cell.progress = Math.max(cell.progress || 0, Number(job.progress || 0));
      cell.reservedBy = cell.reservedBy || job.reservedBy || null;
      world.roofLayer[job.y][job.x] = cell;
    }

    if (!world.roofLayerHydratedFromBuilt) {
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        if (world.builtRoofLayer[y][x]) world.roofLayer[y][x] = { ...(world.roofLayer[y][x] || {}), planned: true, built: true, progress: 1, flashTimer: world.roofLayer[y][x]?.flashTimer || 0 };
      }
      world.roofLayerHydratedFromBuilt = true;
    }
    return world;
  }

  function roofAt(x, y) { return ensureRoofState()?.roofLayer?.[y]?.[x] || null; }
  function roofBuiltAt(x, y) { return !!roofAt(x, y)?.built; }

  function nearestRoofJobFor(c) {
    const world = ensureRoofState();
    if (!world) return null;
    let best = null;
    let bestScore = Infinity;
    for (const job of world.pendingRoofJobs || []) {
      if (!inWorld(job.x, job.y) || roofBuiltAt(job.x, job.y)) continue;
      if (job.reservedBy && String(job.reservedBy) !== String(c.id)) continue;
      const adj = typeof nearestFreeAdjacent === 'function' ? nearestFreeAdjacent(job.x, job.y, c.x, c.y) : { x: job.x, y: job.y };
      if (!adj) continue;
      const path = c.x === adj.x && c.y === adj.y ? [] : (typeof findPath === 'function' ? findPath(c.x, c.y, adj.x, adj.y) : []);
      if (c.x !== adj.x || c.y !== adj.y) if (!Array.isArray(path) || !path.length) continue;
      const score = Math.hypot(c.x - job.x, c.y - job.y);
      if (score < bestScore) { bestScore = score; best = { job, adj, path, score }; }
    }
    return best;
  }

  function assignRoofJobReserved(c) {
    if (!state || !c || c.task || (c.energy || 0) <= 14 || (c.health || 0) <= 15) return false;
    if (typeof taskPriorityValue === 'function' && taskPriorityValue(c, 'build') <= 0) return false;
    const target = nearestRoofJobFor(c);
    if (!target) return false;
    const cell = roofAt(target.job.x, target.job.y) || { planned: true, built: false, progress: 0, flashTimer: 0 };
    target.job.reservedBy = c.id;
    cell.reservedBy = c.id;
    state.world.roofLayer[target.job.y][target.job.x] = cell;
    c.task = { type: 'buildRoof', roofX: target.job.x, roofY: target.job.y, x: target.adj.x, y: target.adj.y };
    c.path = target.path;
    c.work = 0;
    c.ai.currentJob = `build_roof:${target.job.x},${target.job.y}`;
    c.ai.debug.lastJob = 'build_roof';
    c.note = 'Indo construir telhado';
    return true;
  }

  function handleRoofBuildTaskReserved(c, task, tick) {
    const world = ensureRoofState();
    if (!world) return true;
    const job = world.pendingRoofJobs.find(j => j.x === task.roofX && j.y === task.roofY);
    const cell = roofAt(task.roofX, task.roofY) || { planned: true, built: false, progress: 0, flashTimer: 0 };
    if (!job || cell.built) { c.task = null; c.work = 0; c.note = 'Ocioso'; return true; }
    job.reservedBy = c.id; cell.reservedBy = c.id;
    const workNeeded = 80;
    const deltaWork = tick * 28 * (typeof workRate === 'function' ? workRate(c, 'build') : 1);
    job.workDone = Math.min(workNeeded, Number(job.workDone || job.progress * workNeeded || 0) + deltaWork);
    job.progress = job.workDone / workNeeded;
    cell.progress = job.progress;
    c.work = job.progress;
    c.note = `Construindo telhado ${Math.floor(job.progress * 100)}%`;
    if (job.progress >= 1) {
      cell.built = true; cell.planned = true; cell.progress = 1; cell.reservedBy = null; cell.flashTimer = 1.0;
      world.builtRoofLayer[task.roofY][task.roofX] = true;
      world.roofLayerHydratedFromBuilt = false;
      world.pendingRoofJobs = world.pendingRoofJobs.filter(j => j !== job);
      safeLog(`${c.name} concluiu um telhado.`, `roof-built-${task.roofX}-${task.roofY}`, 0.1);
      c.task = null; c.note = 'Telhado concluído'; c.work = 0;
    }
    world.roofLayer[task.roofY][task.roofX] = cell;
    return true;
  }

  function roofTick(dt) {
    const speed = Number(state?.speed || 1);
    const tick = dt * speed;
    roofPulse += tick;
    lightingPulse += tick;

    if (roofPulse < 0.16 && lightingPulse < 0.35) return;
    const world = ensureRoofState();
    if (!world) return;

    if (roofPulse >= 0.16) {
      const elapsed = roofPulse;
      roofPulse = 0;
      for (const row of world.roofLayer || []) for (const cell of row || []) if (cell?.flashTimer) cell.flashTimer = Math.max(0, cell.flashTimer - elapsed);
    }

    if (lightingPulse >= 0.35 || !world.lightMap) {
      lightingPulse = 0;
      computeLighting();
    }
  }

  function ambientLight() {
    const hour = Number(state?.hour || 12);
    if (hour >= 7 && hour <= 17) return 0.86;
    if (hour >= 5 && hour < 7) return 0.34 + (hour - 5) * 0.26;
    if (hour > 17 && hour <= 20) return 0.86 - (hour - 17) * 0.22;
    return 0.18;
  }

  function activeLightSources() {
    const t = performance.now();
    if (t - lastFlickerUpdate > 120) lastFlickerUpdate = t;
    const result = [];
    for (const obj of state?.objects || []) {
      const def = LIGHT_DEFS[obj.type];
      if (!def) continue;
      const active = obj.type === 'forge' || obj.type === 'stove' ? !!(state?.colonists || []).some(c => c.task?.objId === obj.id) : true;
      if (!active && obj.type !== 'campfire' && obj.type !== 'torch') continue;
      const flicker = def.flicker ? 0.92 + (Math.sin(lastFlickerUpdate / 160 + obj.x * 1.7 + obj.y) + 1) * 0.08 : 1;
      result.push({ ...def, x: obj.x, y: obj.y, intensity: def.intensity * flicker, id: obj.id });
    }
    return result;
  }

  function computeLighting() {
    if (!state?.world) return;
    const rows = worldRows(), cols = worldCols();
    const sources = activeLightSources();
    const base = ambientLight();
    const world = state.world;
    const map = world.lightMap && world.lightMap.length === rows ? world.lightMap : Array.from({ length: rows }, () => Array.from({ length: cols }, () => base));
    for (let y = 0; y < rows; y++) {
      if (!map[y] || map[y].length !== cols) map[y] = Array.from({ length: cols }, () => base);
      for (let x = 0; x < cols; x++) {
        let light = base * (roofBuiltAt(x, y) ? 0.46 : 1);
        for (const src of sources) {
          const d = Math.hypot(x - src.x, y - src.y);
          if (d <= src.radius) light += src.intensity * (1 - d / src.radius);
        }
        map[y][x] = clamp(light, 0, 1);
      }
    }
    world.lightMap = map;
  }

  function drawRoofAndLightOverlay(bounds = null) {
    if (!state?.world) return;
    const world = state.world.roofLayer ? state.world : ensureRoofState();
    if (!world) return;
    const b = bounds || (typeof visibleTileBounds === 'function' ? visibleTileBounds(2) : { startX: 0, startY: 0, endX: worldCols() - 1, endY: worldRows() - 1 });
    const t = typeof getTileSize === 'function' ? getTileSize() : TILE;

    ctx.save();
    for (let y = b.startY; y <= b.endY; y++) for (let x = b.startX; x <= b.endX; x++) {
      const cell = world.roofLayer?.[y]?.[x];
      if (!cell) continue;
      const showBuilt = cell.built && (cell.flashTimer > 0 || currentBuild || showDebugGrid);
      const showPending = !cell.built && cell.planned;
      if (!showBuilt && !showPending) continue;
      const progress = clamp01(cell.progress || 0);
      ctx.globalAlpha = showBuilt ? Math.max(0.12, (cell.flashTimer || 0) * 0.38) : 0.18 + progress * 0.34;
      ctx.fillStyle = '#9b6a3c';
      ctx.fillRect(x * t + 4, y * t + 4, t - 8, t - 8);
      ctx.globalAlpha = showBuilt ? 0.22 : 0.48;
      ctx.strokeStyle = showBuilt ? '#f4c46b' : '#fbbf24';
      if (!showBuilt) ctx.setLineDash([5, 4]);
      ctx.strokeRect(x * t + 7, y * t + 7, t - 14, t - 14);
      ctx.setLineDash([]);
    }
    ctx.restore();

    const lightMap = world.lightMap;
    if (!lightMap) return;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    for (let y = b.startY; y <= b.endY; y++) for (let x = b.startX; x <= b.endX; x++) {
      const light = clamp01(lightMap[y]?.[x] ?? ambientLight());
      const roofed = !!world.roofLayer?.[y]?.[x]?.built;
      const alpha = clamp((1 - light) * (roofed ? 0.78 : 0.55), 0, 0.72);
      if (alpha <= 0.03) continue;
      ctx.fillStyle = `rgba(4, 8, 15, ${alpha.toFixed(3)})`;
      ctx.fillRect(x * t, y * t, t, t);
    }
    for (const src of activeLightSources()) {
      const px = src.x * t + t / 2, py = src.y * t + t / 2, r = src.radius * t;
      const gradient = ctx.createRadialGradient(px, py, 0, px, py, r);
      gradient.addColorStop(0, `rgba(255, 188, 82, ${Math.min(0.35, src.intensity * 0.25)})`);
      gradient.addColorStop(1, 'rgba(255, 188, 82, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  function patchInspectionDebug() {
    if (!state?.colonists) return;
    for (const c of state.colonists) {
      ensureColonistBrain(c);
      c.ai.debug.state = c.ai.state;
      c.ai.debug.currentJob = c.task?.type || c.ai.currentJob || 'nenhum';
      c.ai.debug.path = Array.isArray(c.path) ? c.path.length : 0;
      c.ai.debug.stuckTimer = Number(c.ai.stuckTimer || 0).toFixed(1);
      c.ai.debug.schedule = currentSchedule(c);
    }
  }

  function simulationTick(dt) {
    if (!state || appScreen !== SCREEN.PLAYING) return;
    patchStartSleep();
    patchReservations();
    patchSleepingDraw();
    installMobPatch();
    updateAutoSleepSpeed();
    roofTick(dt);
    if (!state._simulationDebugPulse) state._simulationDebugPulse = 0;
    state._simulationDebugPulse += dt;
    if (state._simulationDebugPulse > 0.35) {
      state._simulationDebugPulse = 0;
      patchInspectionDebug();
    }
  }

  window.HavenfallSimulationUpgrade = Object.freeze({
    version: VERSION,
    ensureRoofState,
    roofBuiltAt,
    startSleep: startSleepUpgraded,
    wakeColonist,
    allColonistsSleeping,
    activeLightSources,
    computeLighting
  });

  window.GameSystems?.registerColonistUpdateGuard?.('simulation.sleep', handleSleepGuard, { order: 0 });
  window.GameSystems?.registerBeforeColonistUpdate?.('simulation.brain', updateBrainBefore, { order: 0 });
  window.GameSystems?.registerAutoTaskProvider?.('simulation.sleep-job', sleepAutoTask, { order: 0 });
  window.GameSystems?.registerAutoTaskProvider?.('simulation.roof-reserved', assignRoofJobReserved, { order: 1 });
  window.GameSystems?.registerTaskHandler?.('buildRoof', 'simulation.roof-build', handleRoofBuildTaskReserved, { order: 0 });
  window.GameSystems?.registerTick?.('simulation.upgrade', simulationTick, { order: 5 });
  window.GameSystems?.registerWorldOverlay?.('simulation.roof-light', drawRoofAndLightOverlay, { order: 88 });
  window.GameSystems?.setTileRendererEnabled?.('auto-roof.overlay', false);
})();