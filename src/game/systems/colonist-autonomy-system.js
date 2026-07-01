'use strict';

(() => {
  if (window.HavenfallContext?.colonistAutonomyInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.colonistAutonomyInstalled = true;

  const SLEEP_SURFACE = Object.freeze({ BED: 'bed', FLOOR: 'floor', ROUGH: 'rough', OUTDOOR: 'outdoor' });
  const INTENT = Object.freeze({ WORK: 'work', SLEEP: 'sleep', EAT: 'eat', LEISURE: 'leisure', RECOVER: 'recover', IDLE: 'idle' });
  const ENERGY = Object.freeze({ EMERGENCY_SLEEP: 6, FORCE_SLEEP: 18, SOFT_SLEEP: 28, PREPARE_SLEEP: 45, WAKE_WORK: 45, WAKE_SLEEP_WINDOW: 88, FULL_REST: 96 });
  const DECISION = Object.freeze({ MIN_INTERVAL: 0.08, SHORT_BEFORE_SLEEP: 0.25, SOON_BEFORE_SLEEP: 0.75 });
  const original = { updateColonist: null, startSleep: null, handleTaskAtTarget: null };

  function clampValue(value, min, max) { if (typeof clamp === 'function') return clamp(value, min, max); return Math.max(min, Math.min(max, Number(value) || 0)); }
  function worldTime() { return (Number(state?.day || 0) * 24) + Number(state?.hour || 0); }
  function ensureBrain(c) { c.brain = c.brain || {}; c.brain.intent = c.brain.intent || INTENT.IDLE; c.brain.reason = c.brain.reason || 'initial'; c.brain.lockedUntil = Number(c.brain.lockedUntil || 0); c.brain.lastDecisionAt = Number(c.brain.lastDecisionAt || 0); return c.brain; }
  function ensureRestState(c) { c.rest = c.rest || {}; c.rest.sleptOnFloorHours = Number(c.rest.sleptOnFloorHours || 0); c.rest.lastSleepSurface = c.rest.lastSleepSurface || null; c.rest.sleepQuality = Number(c.rest.sleepQuality || 1); c.bodyPain = clampValue(Number(c.bodyPain || 0), 0, 100); return c.rest; }
  function rememberIntent(c, intent, reason, lockHours = 0.12) { const brain = ensureBrain(c); brain.intent = intent; brain.reason = reason; brain.lastDecisionAt = worldTime(); brain.lockedUntil = worldTime() + Math.max(0, Number(lockHours) || 0); c.intent = intent; c.intentReason = reason; return brain; }
  function scheduleState(c, hour = state?.hour || 0) { return window.ScheduleManager?.getScheduleState?.(c, hour) ?? window.ScheduleManager?.SCHEDULE?.WORK ?? 1; }
  function isSchedule(c, scheduleValue) { return scheduleState(c) === scheduleValue; }

  function hoursUntilSchedule(c, target) {
    const manager = window.ScheduleManager;
    if (!manager?.ensureColonistSchedule) return Infinity;
    const schedule = manager.ensureColonistSchedule(c);
    if (!Array.isArray(schedule) || schedule.length !== 24) return Infinity;
    const current = Number(state?.hour || 0);
    const currentHour = manager.normalizeHour ? manager.normalizeHour(current) : (((Math.floor(current) % 24) + 24) % 24);
    const fraction = current - Math.floor(current);
    for (let i = 0; i <= 24; i++) { const hour = (currentHour + i) % 24; if (schedule[hour] === target) return Math.max(0, i - fraction); }
    return Infinity;
  }

  function workExists() { return !!window.HavenfallWorkCoordinator?.workExists?.(); }
  function taskType(c) { return c?.task?.type || null; }
  function isCombatTask(type) { return type === 'combat' || type === 'scare'; }
  function isWorkTask(type) { return ['gather','mine','build','buildRoof','haul','deconstruct','research','craft','forge','cook','inspect','loot','inspectPoi','heal'].includes(type); }
  function isHeavyTask(type) { return ['mine','forge','build','combat','scare'].includes(type); }

  function shouldFinishCurrentTask(c) {
    const type = taskType(c);
    if (!type || type === 'sleep') return false;
    if (isCombatTask(type)) return true;
    if (type === 'haul' && (c.carrying || c.task?.phase === 'dropoff')) return true;
    if (Number(c.work || 0) > 0 && Number(c.energy ?? 100) > ENERGY.EMERGENCY_SLEEP + 3) return true;
    return false;
  }

  function interruptibleForNeed(c) {
    const type = taskType(c);
    if (!type) return true;
    if (type === 'sleep') return false;
    if (isCombatTask(type)) return false;
    if (type === 'haul' && (c.carrying || c.task?.phase === 'dropoff')) return false;
    if (type === 'move') return Number(c.energy ?? 100) <= ENERGY.EMERGENCY_SLEEP;
    return true;
  }

  function pathTo(c, x, y, target = null) { if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) return []; if (Math.round(c.x) === Math.round(x) && Math.round(c.y) === Math.round(y)) return []; return typeof findPath === 'function' ? (findPath(c.x, c.y, x, y, target) || []) : []; }

  function nearestReachableBed(c) {
    const beds = (state?.objects || []).filter(o => o.type === 'bed').sort((a, b) => dist(c.x, c.y, a.x, a.y) - dist(c.x, c.y, b.x, b.y));
    for (const bed of beds) {
      const adj = typeof nearestFreeAdjacent === 'function' ? nearestFreeAdjacent(bed.x, bed.y, c.x, c.y) : null;
      const tile = adj || { x: bed.x, y: bed.y };
      const alreadyThere = Math.round(c.x) === tile.x && Math.round(c.y) === tile.y;
      const path = alreadyThere ? [] : pathTo(c, tile.x, tile.y, bed);
      if (alreadyThere || path.length > 0) return { bed, tile, path };
    }
    return null;
  }

  function tileTerrain(x, y) { return state?.terrain?.[y]?.[x] || state?.world?.terrain?.[y]?.[x] || 'grass'; }
  function hasRoofAt(x, y) { return typeof hasNaturalRoofAt === 'function' ? !!hasNaturalRoofAt(x, y) : !!state?.world?.naturalRoofLayer?.[y]?.[x]; }

  function sleepSurfaceAt(x, y) {
    const roof = hasRoofAt(x, y);
    const floor = window.FloorSystem?.getFloorAt?.(x, y) || null;
    const floorDef = window.FloorSystem?.floorDef?.(floor) || null;
    if (floorDef?.sleepSurface === SLEEP_SURFACE.FLOOR) return SLEEP_SURFACE.FLOOR;
    if (floorDef?.sleepSurface === SLEEP_SURFACE.ROUGH) return SLEEP_SURFACE.ROUGH;
    if (state?.weather === 'chuva' && !roof && !floor) return SLEEP_SURFACE.OUTDOOR;
    const terrain = tileTerrain(x, y);
    if (terrain === 'stone' || terrain === 'dirt' || roof) return SLEEP_SURFACE.ROUGH;
    return SLEEP_SURFACE.FLOOR;
  }

  function sleepRecovery(surface) {
    if (surface === SLEEP_SURFACE.BED) return { quality: 1, energy: 4.8, mood: 0.55, pain: -1.20, health: 0 };
    if (surface === SLEEP_SURFACE.FLOOR) return { quality: 0.65, energy: 2.8, mood: 0.12, pain: 0.22, health: 0 };
    if (surface === SLEEP_SURFACE.OUTDOOR) return { quality: 0.30, energy: 1.4, mood: -0.10, pain: 0.85, health: -0.015 };
    return { quality: 0.45, energy: 2.1, mood: -0.04, pain: 0.52, health: 0 };
  }

  function surfaceLabel(surface) { if (surface === SLEEP_SURFACE.BED) return 'cama'; if (surface === SLEEP_SURFACE.FLOOR) return 'chão'; if (surface === SLEEP_SURFACE.OUTDOOR) return 'relento'; return 'chão duro'; }

  function chooseSleepSurface(c, reason = 'tired') {
    const bed = nearestReachableBed(c);
    if (bed) return { surface: SLEEP_SURFACE.BED, bedId: bed.bed.id, tile: bed.tile, path: bed.path, reason };
    const surface = sleepSurfaceAt(c.x, c.y);
    return { surface, bedId: null, tile: { x: c.x, y: c.y }, path: [], reason, floorRest: true, emergency: Number(c.energy ?? 100) <= ENERGY.EMERGENCY_SLEEP };
  }

  function startAutonomySleep(c, reason = 'tired') {
    if (!c) return false;
    const chosen = chooseSleepSurface(c, reason);
    const recovery = sleepRecovery(chosen.surface);
    c.task = { type: 'sleep', x: chosen.tile.x, y: chosen.tile.y, bedId: chosen.bedId, reason, floorRest: chosen.surface !== SLEEP_SURFACE.BED, sleepSurface: chosen.surface, sleepQuality: recovery.quality, emergency: !!chosen.emergency, startedAt: worldTime(), badSleepLogged: false };
    c.path = chosen.path || [];
    c.work = 0;
    c.note = chosen.surface === SLEEP_SURFACE.BED ? (c.path.length ? 'Indo dormir na cama' : 'Dormindo na cama') : `Dormindo no ${surfaceLabel(chosen.surface)}`;
    rememberIntent(c, INTENT.SLEEP, reason, 0.30);
    return true;
  }

  function wakeColonist(c, note = 'Descansado') {
    const task = c.task;
    if (task?.type === 'sleep' && task.sleepSurface && task.sleepSurface !== SLEEP_SURFACE.BED) {
      const slept = Math.max(0, worldTime() - Number(task.startedAt || worldTime()));
      if (slept >= 0.25 && typeof log === 'function') {
        const pain = Math.round(Number(c.bodyPain || 0));
        log(`${c.name} dormiu mal no ${surfaceLabel(task.sleepSurface)}${pain >= 20 ? ` e acordou com dor no corpo (${pain}%).` : '.'}`);
      }
    }
    c.task = null; c.path = []; c.work = 0; c.note = note; rememberIntent(c, INTENT.IDLE, 'rested', 0.08);
  }

  function handleSleep(c, task, tick) {
    const surface = task.sleepSurface || (task.bedId ? SLEEP_SURFACE.BED : SLEEP_SURFACE.FLOOR);
    const recovery = sleepRecovery(surface);
    const scheduledSleep = isSchedule(c, window.ScheduleManager?.SCHEDULE?.SLEEP);
    ensureRestState(c);
    c.rest.lastSleepSurface = surface;
    c.rest.sleepQuality = recovery.quality;
    c.energy = clampValue(Number(c.energy || 0) + tick * recovery.energy, 0, 100);
    c.mood = clampValue(Number(c.mood || 0) + tick * recovery.mood, 0, 100);
    c.bodyPain = clampValue(Number(c.bodyPain || 0) + tick * recovery.pain, 0, 100);
    if (recovery.health) c.health = clampValue(Number(c.health || 100) + tick * recovery.health, 1, 100);
    if (surface !== SLEEP_SURFACE.BED) c.rest.sleptOnFloorHours += tick / 60;
    c.note = surface === SLEEP_SURFACE.BED ? 'Dormindo na cama' : `Dormindo no ${surfaceLabel(surface)}`;
    const wakeTarget = scheduledSleep ? ENERGY.WAKE_SLEEP_WINDOW : ENERGY.WAKE_WORK;
    if (!scheduledSleep && c.energy >= wakeTarget) { wakeColonist(c, c.energy >= ENERGY.FULL_REST ? 'Totalmente descansado' : 'Descansado'); return true; }
    if (scheduledSleep && c.energy >= ENERGY.FULL_REST) { wakeColonist(c, 'Totalmente descansado'); return true; }
    return true;
  }

  function applyVitals(c, tick) {
    c.energy = clampValue(Number(c.energy ?? 100), 0, 100); c.hunger = clampValue(Number(c.hunger ?? 100), 0, 100); c.mood = clampValue(Number(c.mood ?? 70), 0, 100); c.health = clampValue(Number(c.health ?? 100), 1, 100); c.bodyPain = clampValue(Number(c.bodyPain || 0), 0, 100);
    c.hunger = clampValue(c.hunger - tick * 0.14, 0, 100);
    let drain = 0.010;
    const type = taskType(c);
    if (type === 'sleep') drain = 0; else if (type === 'leisure') drain = -0.09; else if (isCombatTask(type)) drain = 0.060; else if (isHeavyTask(type)) drain = 0.046; else if (isWorkTask(type)) drain = 0.032; else if (type === 'move' || (Array.isArray(c.path) && c.path.length)) drain = 0.018;
    c.energy = clampValue(c.energy - tick * drain, 0, 100);
    if (type === 'leisure') c.bodyPain = clampValue(c.bodyPain - tick * 0.18, 0, 100);
    if (type === 'sleep' && c.task?.sleepSurface === SLEEP_SURFACE.BED) c.bodyPain = clampValue(c.bodyPain - tick * 1.2, 0, 100);
    if (isHeavyTask(type) && c.bodyPain > 20) c.bodyPain = clampValue(c.bodyPain + tick * 0.06, 0, 100);
    const lowNeeds = c.hunger < 25 || c.energy < 24 || c.bodyPain > 45;
    c.mood = clampValue(c.mood - tick * (lowNeeds ? 0.085 : 0.024), 0, 100);
    if (c.hunger < 18) c.health = clampValue(c.health - tick * 0.055, 1, 100);
    if (c.health < 30) c.mood = clampValue(c.mood - tick * 0.08, 0, 100);
  }

  function maybeEat(c) { if (!state?.resources || c.hunger >= 32 || Number(state.resources.food || 0) <= 0 || c.task?.type === 'sleep') return false; state.resources.food -= 1; c.hunger = clampValue(c.hunger + 42, 0, 100); c.mood = clampValue(c.mood + 4, 0, 100); c.note = 'Comeu uma refeição rápida'; rememberIntent(c, INTENT.EAT, 'hungry', 0.08); if (typeof log === 'function') log(`${c.name} comeu uma refeição rápida.`); return true; }
  function shouldStartEmergencySleep(c) { if (c.task?.type === 'sleep') return false; if (Number(c.energy ?? 100) <= ENERGY.EMERGENCY_SLEEP) return !isCombatTask(taskType(c)); return false; }
  function shouldStartForcedSleep(c) { if (c.task?.type === 'sleep') return false; const energy = Number(c.energy ?? 100); if (energy > ENERGY.FORCE_SLEEP) return false; if (!interruptibleForNeed(c)) return false; if (shouldFinishCurrentTask(c) && energy > ENERGY.EMERGENCY_SLEEP + 3) return false; return true; }
  function shouldStartScheduledSleep(c) { if (c.task?.type === 'sleep') return false; const manager = window.ScheduleManager; if (!manager?.SCHEDULE || !isSchedule(c, manager.SCHEDULE.SLEEP)) return false; if (!interruptibleForNeed(c)) return false; if (shouldFinishCurrentTask(c) && Number(c.energy ?? 100) > 32) return false; return true; }
  function shouldAvoidNewLongWork(c) { const manager = window.ScheduleManager; if (!manager?.SCHEDULE) return false; const untilSleep = hoursUntilSchedule(c, manager.SCHEDULE.SLEEP); return untilSleep <= DECISION.SOON_BEFORE_SLEEP && Number(c.energy ?? 100) < 55; }
  function canWorkNow(c) { const manager = window.ScheduleManager; if (!manager?.SCHEDULE) return true; if (isSchedule(c, manager.SCHEDULE.WORK)) return true; if (isSchedule(c, manager.SCHEDULE.LEISURE)) return workExists() && Number(c.energy ?? 100) > 32 && Number(c.mood ?? 100) > 18; return false; }
  function assignLeisure(c) { if (window.ScheduleManager?.assignLeisure?.(c)) { rememberIntent(c, INTENT.LEISURE, 'schedule', 0.18); return true; } return false; }

  function applyDecision(c) {
    const manager = window.ScheduleManager;
    const schedule = manager?.SCHEDULE || { SLEEP: 0, WORK: 1, LEISURE: 2 };
    const brain = ensureBrain(c);
    c.scheduleMode = scheduleState(c);
    if (c.task?.type === 'sleep') { if (!isSchedule(c, schedule.SLEEP) && Number(c.energy ?? 100) >= ENERGY.WAKE_WORK) wakeColonist(c, 'Voltando ao trabalho'); return true; }
    if (shouldStartEmergencySleep(c)) return startAutonomySleep(c, 'emergency');
    if (c.hunger < 18 && maybeEat(c)) return true;
    if (shouldStartForcedSleep(c)) return startAutonomySleep(c, 'exhausted');
    if (shouldStartScheduledSleep(c)) return startAutonomySleep(c, 'scheduled');
    if (c.task) { if (isWorkTask(taskType(c))) rememberIntent(c, INTENT.WORK, 'current-task', 0.10); return false; }
    if (c.health < 18 && Number(c.energy ?? 100) < 35) return startAutonomySleep(c, 'injured');
    if (c.hunger < 32 && maybeEat(c)) return true;
    if (isSchedule(c, schedule.LEISURE)) { if (Number(c.energy ?? 100) <= ENERGY.FORCE_SLEEP) return startAutonomySleep(c, 'leisure-exhausted'); if (!workExists() || Number(c.mood ?? 100) < 35) return assignLeisure(c); }
    if (shouldAvoidNewLongWork(c)) { c.note = 'Preparando descanso'; rememberIntent(c, INTENT.IDLE, 'sleep-soon', 0.12); return true; }
    if (canWorkNow(c)) { rememberIntent(c, INTENT.WORK, 'available', 0.10); const assigned = typeof assignAutoTask === 'function' ? assignAutoTask(c) : false; if (assigned) return true; }
    if (Number(c.mood ?? 100) < 24 && Number(c.energy ?? 100) > 24) { if (assignLeisure(c)) return true; }
    if (brain.lockedUntil > worldTime()) return true;
    c.note = workExists() && !canWorkNow(c) ? 'Fora do horário de trabalho' : 'Aguardando no local';
    rememberIntent(c, INTENT.IDLE, workExists() ? 'waiting' : 'no-work', 0.18);
    return true;
  }

  function movementPainMultiplier(c) { const pain = Number(c?.bodyPain || 0); return 1 - Math.min(0.30, pain / 260); }
  function workPainMultiplier(rate, c, kind) { const pain = Number(c?.bodyPain || 0); let penalty = Math.min(0.30, pain / 240); if (isHeavyTask(kind)) penalty = Math.min(0.38, pain / 190); return rate * (1 - penalty); }

  function runBeforeHooksWithoutLegacySchedule(c, dt) {
    const manager = window.ScheduleManager;
    if (!window.GameSystems?.runBeforeColonistUpdate || !manager?.getScheduleState || !manager?.SCHEDULE) { window.GameSystems?.runBeforeColonistUpdate?.(c, dt); return; }
    const originalGetScheduleState = manager.getScheduleState;
    try {
      manager.getScheduleState = (colonist, hour) => {
        if (colonist === c) {
          const schedule = manager.ensureColonistSchedule?.(colonist);
          if (Array.isArray(schedule)) colonist.scheduleMode = schedule[manager.normalizeHour?.(hour ?? state?.hour ?? 0) ?? 0] ?? manager.SCHEDULE.WORK;
          return manager.SCHEDULE.WORK;
        }
        return originalGetScheduleState(colonist, hour);
      };
      window.GameSystems.runBeforeColonistUpdate(c, dt);
    } finally {
      manager.getScheduleState = originalGetScheduleState;
    }
  }

  function autonomyUpdateColonist(c, dt) {
    if (!state || !c) return;
    ensureBrain(c); ensureRestState(c);
    if (window.GameSystems?.runColonistUpdateGuards(c, dt)) return;
    runBeforeHooksWithoutLegacySchedule(c, dt);
    const speed = Number(state.speed || 1);
    const tick = Math.max(0, dt * speed);
    c.anim = Number(c.anim || 0) + tick;
    applyVitals(c, tick);
    applyDecision(c);
    if (c.task) {
      if (Array.isArray(c.path) && c.path.length) { if (typeof moveAlongPath === 'function') moveAlongPath(c, tick); }
      else if (c.task.type === 'sleep') handleSleep(c, c.task, tick);
      else if (typeof handleTaskAtTarget === 'function') handleTaskAtTarget(c, tick);
    }
    c.x = Math.round((c.px - TILE / 2) / TILE);
    c.y = Math.round((c.py - TILE / 2) / TILE);
    window.GameSystems?.runAfterColonistUpdate(c, dt);
  }

  function ownsDecision() { return true; }

  function install() {
    if (!window.HavenfallColonistVitals || typeof updateColonist !== 'function') { setTimeout(install, 120); return; }
    original.updateColonist = updateColonist;
    original.startSleep = typeof startSleep === 'function' ? startSleep : null;
    original.handleTaskAtTarget = typeof handleTaskAtTarget === 'function' ? handleTaskAtTarget : null;
    try { updateColonist = autonomyUpdateColonist; } catch (_) {}
    try { startSleep = (c, reason = 'scheduled') => startAutonomySleep(c, reason); } catch (_) {}
    window.GameSystems?.registerMovementModifier?.('colonist-autonomy.body-pain-move', (c, current) => current * movementPainMultiplier(c), { order: 30 });
    window.GameSystems?.registerWorkRateModifier?.('colonist-autonomy.body-pain-work', workPainMultiplier, { order: 30 });
    window.HavenfallColonistAutonomy = Object.freeze({ INTENT, SLEEP_SURFACE, ENERGY, ownsDecision, ensureBrain, ensureRestState, startSleep: startAutonomySleep, chooseSleepSurface, original, version: 'autonomy-ground-sleep-floor-aware-v1' });
    console.info('[Colonist Autonomy] Cérebro individual, sono no chão e pisos carregados.');
  }

  install();
})();
