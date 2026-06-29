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
    const beds = state.objects
      .filter(bed => isBedAvailableFor(bed, c))
      .sort((a, b) => {
        const ownerBiasA = a.ownerId && String(a.ownerId) === String(c.id) ? -100 : 0;
        const ownerBiasB = b.ownerId && String(b.ownerId) === String(c.id) ? -100 : 0;
        return ownerBiasA + Math.hypot(c.x - a.x, c.y - a.y) - (ownerBiasB + Math.hypot(c.x - b.x, c.y - b.y));
      });
    return beds[0] || null;
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
    state.timeControl = state.timeControl || { manualSpeed: Number(state.speed || 1), autoSleepActive: false };
    const manual = state.timeControl.manualSpeed || 1;
    const sleeping = allColonistsSleeping();
    const can = sleeping && !hasImmediateThreat() && !hasCriticalHunger() && state.weather !== 'tempestade';
    const expected = Math.max(1, manual * 6);

    if (can) {
      if (!state.timeControl.autoSleepActive) {
        state.timeControl.manualSpeed = Math.max(1, Number(state.speed || 1));
        state.timeControl.autoSleepActive = true;
        safeLog('Todos estão dormindo. O tempo foi acelerado automaticamente.', 'auto-sleep-start', 0.1);
      }
      state.speed = Math.max(1, (state.timeControl.manualSpeed || 1) * 6);
      return;
    }

    if (state.timeControl.autoSleepActive) {
      state.speed = state.timeControl.manualSpeed || 1;
      state.timeControl.autoSleepActive = false;
      safeLog('Alguém acordou ou surgiu risco. Velocidade normal restaurada.', 'auto-sleep-stop', 0.1);
    } else if (Number(state.speed || 1) <= 4) {
      state.timeControl.manualSpeed = Number(state.speed || 1);
    }
  }

  function reserveObjectFor(c, obj, taskType) {
    if (!c || !obj?.id) return true;
    if (obj.reservedBy && String(obj.reservedBy) !== String(c.id)) return false;
    obj.reservedBy = c.id;
    const ai = ensureColonyBrain();
    ai.reservations.objects[obj.id] = c.id;
    c.ai.currentJob = `${taskType}:${obj.id}`;
    return true;
  }

  function patchReservations() {
    if (window.HavenfallContext?.jobReservationsPatched) return;
    if (typeof assignBuild === 'function') {
      const native = assignBuild;
      assignBuild = function assignBuildReserved(c, bp) {
        ensureColonistBrain(c);
        if (!reserveObjectFor(c, bp, 'build')) { c.note = 'Obra já reservada'; return false; }
        const r = native(c, bp);
        if (!c.task) { if (bp) bp.reservedBy = null; return false; }
        c.task.reservedObjId = bp.id;
        return true;
      };
    }
    if (typeof assignGather === 'function') {
      const native = assignGather;
      assignGather = function assignGatherReserved(c, obj) {
        ensureColonistBrain(c);
        if (!reserveObjectFor(c, obj, 'gather')) { c.note = 'Recurso já reservado'; return false; }
        const r = native(c, obj);
        if (!c.task) { if (obj) obj.reservedBy = null; return false; }
        c.task.reservedObjId = obj.id;
        return true;
      };
    }
    if (typeof nearestBlueprint === 'function') {
      const native = nearestBlueprint;
      nearestBlueprint = function nearestBlueprintReserved(c) {
        const list = (state?.objects || [])
          .filter(o => o.type === 'blueprint' && (!o.reservedBy || String(o.reservedBy) === String(c.id)))
          .filter(o => {
            const adj = typeof nearestFreeAdjacent === 'function' ? nearestFreeAdjacent(o.x, o.y, c.x, c.y) : { x: o.x, y: o.y };
            if (!adj) return false;
            if (c.x === adj.x && c.y === adj.y) return true;
            const path = typeof findPath === 'function' ? findPath(c.x, c.y, adj.x, adj.y, o) : [];
            return Array.isArray(path) && path.length > 0;
          })
          .sort((a, b) => Math.hypot(c.x - a.x, c.y - a.y) - Math.hypot(c.x - b.x, c.y - b.y));
        return list[0] || native(c);
      };
    }
    window.HavenfallContext.jobReservationsPatched = true;
  }

  function updateBrainBefore(c, dt) {
    if (!state || !c) return;
    patchReservations();
    ensureColonistBrain(c);
    c.needs.sleep = clamp01((c.energy ?? 80) / 100);
    c.needs.hunger = clamp01((c.hunger ?? 78) / 100);
    c.ai.state = c.task?.type === 'sleep' ? (c.sleeping ? 'sleeping' : 'moving_to_bed') : c.task?.type || 'idle';
    if (!c.task) releaseObjectReservations(c, false);
    const last = c.ai.lastPos || { px: c.px, py: c.py, x: c.x, y: c.y };
    const movingTask = !!(c.task && (c.path?.length || ['move', 'build', 'gather', 'mine', 'haul', 'sleep'].includes(c.task.type)));
    const moved = Math.hypot((c.px || 0) - (last.px || 0), (c.py || 0) - (last.py || 0));
    if (movingTask && moved < 0.5) c.ai.stuckTimer += dt * Number(state.speed || 1); else c.ai.stuckTimer = 0;
    c.ai.lastPos = { x: c.x, y: c.y, px: c.px, py: c.py };
    if (c.ai.stuckTimer > 3.2 && c.task) {
      releaseObjectReservations(c, c.task.type === 'sleep');
      c.ai.debug.lastIdleReason = 'stuck_repath';
      c.note = 'Travado — recalculando trabalho';
      c.task = null;
      c.path = [];
      c.work = 0;
      c.ai.stuckTimer = 0;
    }
  }

  function sleepAutoTask(c) {
    if (shouldSleep(c)) return startSleepUpgraded(c);
    return false;
  }

  function patchStartSleep() {
    if (window.HavenfallContext?.sleepPatched) return;
    if (typeof startSleep === 'function') {
      startSleep = startSleepUpgraded;
      window.startSleep = startSleepUpgraded;
    }
    window.HavenfallContext.sleepPatched = true;
  }

  function patchSleepingDraw() {
    if (drawColonistPatched || typeof drawColonist !== 'function') return;
    const native = drawColonist;
    drawColonist = function drawColonistWithSleep(c) {
      if (c?.task?.type === 'sleep' && (c.sleeping || c.ai?.state === 'sleeping')) {
        const x = c.px;
        const y = c.py + 16;
        ctx.save();
        ctx.fillStyle = c.isUnconscious ? 'rgba(120,60,60,.78)' : 'rgba(121,199,232,.78)';
        ctx.strokeStyle = '#162033';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, y, 19, 8, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f4efe4';
        ctx.font = '900 12px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Zzz', x, y - 18);
        ctx.restore();
        return;
      }
      native(c);
    };
    window.drawColonist = drawColonist;
    drawColonistPatched = true;
  }

  function installMobPatch() {
    if (mobPatchInstalled) return;
    if (typeof updatePassiveMob === 'function') updatePassiveMob = updatePassiveStable;
    if (typeof updateSpider === 'function') updateSpider = updateSpiderStable;
    mobPatchInstalled = true;
  }

  function ensureMobBrain(mob) {
    mob.aiTimer = Number(mob.aiTimer ?? (0.3 + Math.random() * 0.8));
    mob.intentLock = Number(mob.intentLock || 0);
    mob.stuckTimer = Number(mob.stuckTimer || 0);
    mob.lastMove = mob.lastMove || { px: mob.px, py: mob.py };
    mob.home = mob.home || { x: Math.round(mob.x), y: Math.round(mob.y) };
    return mob;
  }

  function nearestColonistTo(mob, radius) {
    let best = null, bestD = Infinity;
    for (const c of state?.colonists || []) {
      if (c.isUnconscious) continue;
      const d = Math.hypot((c.px || c.x * TILE) - mob.px, (c.py || c.y * TILE) - mob.py) / TILE;
      if (d < bestD && d <= radius) { bestD = d; best = c; }
    }
    return best;
  }

  function freeMobTile(x, y, mob) {
    if (!inWorld(x, y) || tileBlocked(x, y, mob)) return false;
    return !(state?.mobs || []).some(other => other !== mob && Math.round(other.x) === x && Math.round(other.y) === y);
  }

  function chooseStepToward(mob, tx, ty, avoid = false) {
    const cx = Math.round(mob.x), cy = Math.round(mob.y);
    const candidates = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
      .map(([dx, dy]) => ({ x: cx + dx, y: cy + dy, score: Math.hypot(cx + dx - tx, cy + dy - ty) + Math.random() * 0.08 }))
      .filter(p => freeMobTile(p.x, p.y, mob));
    if (!candidates.length) return null;
    candidates.sort((a, b) => avoid ? b.score - a.score : a.score - b.score);
    return candidates[0];
  }

  function chooseWanderTile(mob, radius = 4) {
    const cx = Math.round(mob.x), cy = Math.round(mob.y);
    for (let i = 0; i < 16; i++) {
      const x = clamp(Math.round((mob.home?.x ?? cx) + (Math.random() * 2 - 1) * radius), 1, worldCols() - 2);
      const y = clamp(Math.round((mob.home?.y ?? cy) + (Math.random() * 2 - 1) * radius), 1, worldRows() - 2);
      const step = chooseStepToward(mob, x, y, false);
      if (step) return step;
    }
    return null;
  }

  function setNextTile(mob, tile) {
    if (!tile) return false;
    mob.nextTile = { x: tile.x, y: tile.y };
    mob.moveFrom = { x: Math.round(mob.x), y: Math.round(mob.y), px: mob.px, py: mob.py };
    mob.moveProgress = 0;
    return true;
  }

  function continueMobMove(mob, tick, speed) {
    if (!mob.nextTile) return false;
    const tx = mob.nextTile.x * TILE + TILE / 2;
    const ty = mob.nextTile.y * TILE + TILE / 2;
    const dx = tx - mob.px;
    const dy = ty - mob.py;
    const len = Math.hypot(dx, dy) || 1;
    if (Math.abs(dx) > Math.abs(dy)) mob.dir = dx > 0 ? 'right' : 'left'; else if (Math.abs(dy) > 1) mob.dir = dy > 0 ? 'down' : 'up';
    const step = Math.max(2, speed) * tick;
    if (len <= step) {
      mob.px = tx; mob.py = ty; mob.x = mob.nextTile.x; mob.y = mob.nextTile.y; mob.nextTile = null; mob.moveProgress = 1;
    } else {
      mob.px += dx / len * step;
      mob.py += dy / len * step;
      mob.moveProgress = clamp01((mob.moveProgress || 0) + step / TILE);
    }
    return true;
  }

  function updatePassiveStable(mob, tick) {
    ensureMobBrain(mob);
    mob.anim = (mob.anim || 0) + tick;
    if (continueMobMove(mob, tick, PASSIVE_SPEED[mob.type] || 22)) return;
    mob.aiTimer -= tick;
    mob.intentLock -= tick;
    if (mob.aiTimer > 0 && mob.intentLock > 0) return;
    mob.aiTimer = 0.55 + Math.random() * 0.95;
    const fleeRadius = ['rabbit','deer','chicken','duck','turkey','squirrel'].includes(mob.type) ? 5 : 2.6;
    const threat = nearestColonistTo(mob, fleeRadius);
    if (threat) {
      mob.state = 'flee';
      mob.intentLock = 0.7;
      setNextTile(mob, chooseStepToward(mob, Math.round(threat.x), Math.round(threat.y), true));
      return;
    }
    mob.state = 'wander';
    mob.intentLock = 0.9 + Math.random() * 0.9;
    setNextTile(mob, chooseWanderTile(mob, WANDER_RADIUS[mob.type] || 4));
  }

  function updateSpiderStable(mob, tick) {
    ensureMobBrain(mob);
    mob.anim = (mob.anim || 0) + tick;
    if (continueMobMove(mob, tick, 31)) return;
    mob.aiTimer -= tick;
    const night = state.hour < 6 || state.hour > 20;
    if (!night) { mob.state = 'sleep'; mob.nextTile = null; return; }
    if (mob.aiTimer > 0 && mob.intentLock > 0) { mob.intentLock -= tick; return; }
    mob.aiTimer = 0.45 + Math.random() * 0.7;
    const target = nearestColonistTo(mob, 8);
    if (target) {
      mob.state = 'hunt'; mob.intentLock = 0.8;
      const d = Math.hypot(target.px - mob.px, target.py - mob.py);
      if (d < 34 && typeof applySpiderSlow === 'function') applySpiderSlow(target, tick, mob);
      else setNextTile(mob, chooseStepToward(mob, Math.round(target.x), Math.round(target.y), false));
      return;
    }
    mob.state = 'wander'; mob.intentLock = 0.8;
    setNextTile(mob, chooseWanderTile(mob, 6));
  }

  function ensureRoofState() {
    if (!state?.world) return null;
    const rows = worldRows(), cols = worldCols();
    const world = state.world;
    const make = fill => Array.from({ length: rows }, () => Array.from({ length: cols }, () => fill));
    if (!Array.isArray(world.roofLayer) || world.roofLayer.length !== rows || world.roofLayer[0]?.length !== cols) {
      world.roofLayer = make(null);
    }
    if (!Array.isArray(world.builtRoofLayer) || world.builtRoofLayer.length !== rows || world.builtRoofLayer[0]?.length !== cols) {
      world.builtRoofLayer = make(false);
    }
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
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (world.builtRoofLayer[y][x]) world.roofLayer[y][x] = { ...(world.roofLayer[y][x] || {}), planned: true, built: true, progress: 1, flashTimer: world.roofLayer[y][x]?.flashTimer || 0 };
    }
    return world;
  }

  function roofAt(x, y) { return ensureRoofState()?.roofLayer?.[y]?.[x] || null; }
  function roofBuiltAt(x, y) { return !!roofAt(x, y)?.built; }

  function nearestRoofJobFor(c) {
    const world = ensureRoofState();
    if (!world) return null;
    const candidates = (world.pendingRoofJobs || []).filter(job => inWorld(job.x, job.y) && !roofBuiltAt(job.x, job.y) && (!job.reservedBy || String(job.reservedBy) === String(c.id)));
    let best = null;
    for (const job of candidates) {
      const adj = typeof nearestFreeAdjacent === 'function' ? nearestFreeAdjacent(job.x, job.y, c.x, c.y) : { x: job.x, y: job.y };
      if (!adj) continue;
      const path = c.x === adj.x && c.y === adj.y ? [] : (typeof findPath === 'function' ? findPath(c.x, c.y, adj.x, adj.y) : []);
      if (c.x !== adj.x || c.y !== adj.y) if (!Array.isArray(path) || !path.length) continue;
      const score = Math.hypot(c.x - job.x, c.y - job.y);
      if (!best || score < best.score) best = { job, adj, path, score };
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
      world.pendingRoofJobs = world.pendingRoofJobs.filter(j => j !== job);
      safeLog(`${c.name} concluiu um telhado.`, `roof-built-${task.roofX}-${task.roofY}`, 0.1);
      c.task = null; c.note = 'Telhado concluído'; c.work = 0;
    }
    world.roofLayer[task.roofY][task.roofX] = cell;
    return true;
  }

  function roofTick(dt) {
    const world = ensureRoofState();
    if (!world) return;
    const tick = dt * Number(state?.speed || 1);
    for (const row of world.roofLayer || []) for (const cell of row || []) if (cell?.flashTimer) cell.flashTimer = Math.max(0, cell.flashTimer - tick);
    computeLighting();
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
    return (state?.objects || []).map(obj => {
      const def = LIGHT_DEFS[obj.type];
      if (!def) return null;
      const active = obj.type === 'forge' || obj.type === 'stove' ? !!(state?.colonists || []).some(c => c.task?.objId === obj.id) : true;
      if (!active && obj.type !== 'campfire' && obj.type !== 'torch') return null;
      const flicker = def.flicker ? 0.92 + (Math.sin(lastFlickerUpdate / 160 + obj.x * 1.7 + obj.y) + 1) * 0.08 : 1;
      return { ...def, x: obj.x, y: obj.y, intensity: def.intensity * flicker, id: obj.id };
    }).filter(Boolean);
  }

  function computeLighting() {
    if (!state?.world) return;
    const rows = worldRows(), cols = worldCols();
    const sources = activeLightSources();
    const base = ambientLight();
    const map = Array.from({ length: rows }, () => Array.from({ length: cols }, () => base));
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      let light = base * (roofBuiltAt(x, y) ? 0.46 : 1);
      for (const src of sources) {
        const d = Math.hypot(x - src.x, y - src.y);
        if (d <= src.radius) light += src.intensity * (1 - d / src.radius);
      }
      map[y][x] = clamp(light, 0, 1);
    }
    state.world.lightMap = map;
  }

  function drawRoofAndLightOverlay(bounds = null) {
    if (!state?.world) return;
    const world = ensureRoofState();
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
      const roofed = roofBuiltAt(x, y);
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
    // O painel de inspeção lê os campos abaixo automaticamente em atualizações futuras; os dados já ficam no colono para debug.
    for (const c of state?.colonists || []) {
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
    patchInspectionDebug();
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
