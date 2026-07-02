'use strict';

(() => {
  if (window.HavenfallContext?.colonistVitalsInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.colonistVitalsInstalled = true;

  const ENERGY = Object.freeze({
    LOW: 24,
    SLEEP_AT: 16,
    EMERGENCY: 6,
    MIN_WAKE_MOOD: 14,
    WAKE_AT: 78,
    FULLY_RESTED: 92,
    DRAIN_IDLE: 0.010,
    DRAIN_MOVE: 0.018,
    DRAIN_WORK: 0.032,
    DRAIN_HEAVY: 0.046,
    DRAIN_COMBAT: 0.060,
    SLEEP_BED: 4.8,
    SLEEP_FLOOR: 2.7,
    LEISURE_RECOVERY: 0.10
  });

  const original = {
    updateColonist: typeof updateColonist === 'function' ? updateColonist : null,
    startSleep: typeof startSleep === 'function' ? startSleep : null,
    moveAlongPath: typeof moveAlongPath === 'function' ? moveAlongPath : null,
    handleTaskAtTarget: typeof handleTaskAtTarget === 'function' ? handleTaskAtTarget : null
  };

  function safeClamp(value, min, max) {
    return typeof clamp === 'function' ? clamp(value, min, max) : Math.max(min, Math.min(max, value));
  }

  function taskType(c) {
    return c?.task?.type || 'idle';
  }

  function taskInterruptibleForRest(c) {
    const type = taskType(c);
    if (!type || type === 'idle') return true;
    if (type === 'sleep') return false;
    if (type === 'move') return false;
    if (type === 'combat' || type === 'scare') return false;
    return ['gather', 'build', 'buildRoof', 'research', 'craft', 'haul', 'inspect', 'loot', 'inspectPoi', 'forge', 'cook', 'heal', 'leisure', 'mine'].includes(type);
  }

  function isWorkingTask(type) {
    return ['gather', 'build', 'research', 'craft', 'haul', 'inspect', 'loot', 'inspectPoi', 'forge', 'cook', 'heal', 'mine'].includes(type);
  }

  function isHeavyTask(type) {
    return ['mine', 'forge', 'build', 'combat', 'scare'].includes(type);
  }

  function energyDrainFor(c) {
    const type = taskType(c);
    if (type === 'sleep') return 0;
    if (type === 'leisure') return -ENERGY.LEISURE_RECOVERY;
    if (type === 'combat' || type === 'scare') return ENERGY.DRAIN_COMBAT;
    if (isHeavyTask(type)) return ENERGY.DRAIN_HEAVY;
    if (isWorkingTask(type)) return ENERGY.DRAIN_WORK;
    if (type === 'move' || (Array.isArray(c?.path) && c.path.length)) return ENERGY.DRAIN_MOVE;
    return ENERGY.DRAIN_IDLE;
  }

  function applyVitalsDrain(c, tick) {
    c.energy = safeClamp(Number(c.energy ?? 100), 0, 100);
    c.hunger = safeClamp(Number(c.hunger ?? 100), 0, 100);
    c.mood = safeClamp(Number(c.mood ?? 70), 0, 100);
    c.health = safeClamp(Number(c.health ?? 100), 1, 100);

    c.hunger = safeClamp(c.hunger - tick * 0.14, 0, 100);

    const drain = energyDrainFor(c);
    c.energy = safeClamp(c.energy - tick * drain, 0, 100);

    const lowNeeds = c.hunger < 25 || c.energy < ENERGY.LOW;
    c.mood = safeClamp(c.mood - tick * (lowNeeds ? 0.09 : 0.024), 0, 100);

    if (c.hunger < 18) c.health = safeClamp(c.health - tick * 0.055, 1, 100);
    if (c.health < 30) c.mood = safeClamp(c.mood - tick * 0.08, 0, 100);
  }

  function maybeEat(c) {
    if (!state?.resources || c.hunger >= 32 || state.resources.food <= 0 || c.task?.type === 'sleep') return;
    const spent = typeof consumeCost === 'function'
      ? consumeCost({ food: 1 }, { reason: 'colonist-eat', actorId: c.id })
      : window.GameState?.consumeResources?.({ food: 1 }, { reason: 'colonist-eat', actorId: c.id });
    if (!spent) return;
    c.hunger = safeClamp(c.hunger + 42, 0, 100);
    c.mood = safeClamp(c.mood + 4, 0, 100);
    if (typeof log === 'function') log(`${c.name} comeu uma refeição rápida.`);
  }

  function restTileForBed(c, bed) {
    if (!bed) return null;
    const adj = typeof nearestFreeAdjacent === 'function' ? nearestFreeAdjacent(bed.x, bed.y, c.x, c.y) : null;
    return adj || { x: bed.x, y: bed.y };
  }

  function pathToRestTile(c, tile, bed = null) {
    if (!tile) return [];
    const already = c.x === tile.x && c.y === tile.y;
    if (already) return [];
    return typeof findPath === 'function' ? (findPath(c.x, c.y, tile.x, tile.y, bed) || []) : [];
  }

  function startRest(c, reason = 'tired') {
    if (!c) return false;
    const bed = typeof nearestBed === 'function' ? nearestBed(c) : null;
    const tile = restTileForBed(c, bed);
    const path = pathToRestTile(c, tile, bed);
    const alreadyThere = tile && c.x === tile.x && c.y === tile.y;

    if (bed && tile && (alreadyThere || path.length > 0)) {
      c.task = { type: 'sleep', x: tile.x, y: tile.y, bedId: bed.id, bedX: bed.x, bedY: bed.y, reason };
      c.path = path;
      c.work = 0;
      c.note = alreadyThere ? 'Dormindo na cama' : 'Indo dormir';
      return true;
    }

    c.task = { type: 'sleep', x: c.x, y: c.y, reason, floorRest: true };
    c.path = [];
    c.work = 0;
    c.note = 'Descansando onde está';
    return true;
  }

  function shouldForceRest(c) {
    if (!c || c.isUnconscious || c.task?.type === 'sleep') return false;
    if (c.energy <= ENERGY.EMERGENCY) return !['combat', 'scare'].includes(c.task?.type);
    if (c.task?.type === 'move') return false;
    if (!c.task && c.energy < ENERGY.SLEEP_AT) return true;
    if (c.energy < ENERGY.SLEEP_AT && taskInterruptibleForRest(c)) return true;
    return false;
  }

  function wakeIfRested(c) {
    if (c.task?.type !== 'sleep') return false;
    const scheduledSleep = window.ScheduleManager?.getScheduleState?.(c, state?.hour || 0) === window.ScheduleManager?.SCHEDULE?.SLEEP;
    const wakeTarget = scheduledSleep ? ENERGY.FULLY_RESTED : ENERGY.WAKE_AT;
    if (c.energy < wakeTarget) return false;
    if (c.mood < ENERGY.MIN_WAKE_MOOD && c.energy < ENERGY.FULLY_RESTED) return false;
    c.task = null;
    c.path = [];
    c.work = 0;
    c.note = c.energy >= ENERGY.FULLY_RESTED ? 'Totalmente descansado' : 'Descansado';
    return true;
  }

  function handleSleep(c, task, tick) {
    const bed = task?.bedId ? state?.objects?.find(o => o.id === task.bedId && o.type === 'bed') : null;
    const hasBed = !!bed;
    if (bed) {
      c.px = (Number(task.bedX ?? bed.x) * TILE) + TILE / 2;
      c.py = (Number(task.bedY ?? bed.y) * TILE) + TILE / 2;
      c.x = Number(task.bedX ?? bed.x);
      c.y = Number(task.bedY ?? bed.y);
    }
    const rate = hasBed ? ENERGY.SLEEP_BED : ENERGY.SLEEP_FLOOR;
    c.energy = safeClamp(Number(c.energy || 0) + tick * rate, 0, 100);
    c.mood = safeClamp(Number(c.mood || 0) + tick * (hasBed ? 0.55 : 0.24), 0, 100);
    c.note = hasBed ? 'Dormindo na cama' : 'Descansando onde está';
    wakeIfRested(c);
    return true;
  }

  function movementEnergyMultiplier(c) {
    const e = Number(c?.energy ?? 100);
    if (c?.task?.type === 'sleep') return e < 4 ? 0.45 : e < 12 ? 0.55 : 0.7;
    if (e < 8) return 0.42;
    if (e < 18) return 0.58;
    if (e < 32) return 0.78;
    return 1;
  }

  function patchedStartSleep(c) {
    return startRest(c, 'scheduled');
  }

  function patchedMoveAlongPath(c, tick) {
    if (!c?.path?.length) return;
    const next = c.path[0];
    const tx = next.x * TILE + TILE / 2;
    const ty = next.y * TILE + TILE / 2;
    const dx = tx - c.px;
    const dy = ty - c.py;
    const len = Math.hypot(dx, dy) || 1;
    const moodMult = c.mood < 20 ? 0.82 : 1;
    const movementMultiplier = window.GameSystems?.movementMultiplier(c) ?? 1;
    const speed = 62 * movementEnergyMultiplier(c) * moodMult;
    const step = Math.max(2.4, speed * movementMultiplier * tick);

    if (Math.abs(dx) > Math.abs(dy)) c.dir = dx > 0 ? 'right' : 'left';
    else if (Math.abs(dy) > 1) c.dir = dy > 0 ? 'down' : 'up';

    if (len <= step) {
      c.px = tx;
      c.py = ty;
      c.path.shift();
    } else {
      c.px += dx / len * step;
      c.py += dy / len * step;
    }
  }

  function patchedHandleTaskAtTarget(c, tick) {
    if (c?.task?.type === 'sleep') return handleSleep(c, c.task, tick);
    return original.handleTaskAtTarget?.(c, tick);
  }

  function patchedUpdateColonist(c, dt) {
    if (!state || !c) return;
    if (window.GameSystems?.runColonistUpdateGuards(c, dt)) return;
    window.GameSystems?.runBeforeColonistUpdate(c, dt);

    const speed = Number(state.speed || 1);
    const tick = Math.max(0, dt * speed);
    c.anim = Number(c.anim || 0) + tick;

    applyVitalsDrain(c, tick);
    maybeEat(c);

    if (shouldForceRest(c)) startRest(c, c.energy <= ENERGY.EMERGENCY ? 'emergency' : 'tired');

    if (!c.task) {
      if (c.energy < ENERGY.SLEEP_AT) {
        startRest(c, 'tired');
      } else {
        const assigned = typeof assignAutoTask === 'function' ? assignAutoTask(c) : false;
        if (!assigned && c.priority !== 'defense') c.note = c.note || 'Aguardando tarefa prioritária';
      }
    }

    if (c.task) {
      if (Array.isArray(c.path) && c.path.length) patchedMoveAlongPath(c, tick);
      else patchedHandleTaskAtTarget(c, tick);
    }

    c.x = Math.round((c.px - TILE / 2) / TILE);
    c.y = Math.round((c.py - TILE / 2) / TILE);
    window.GameSystems?.runAfterColonistUpdate(c, dt);
  }

  startSleep = patchedStartSleep;
  moveAlongPath = patchedMoveAlongPath;
  handleTaskAtTarget = patchedHandleTaskAtTarget;
  updateColonist = patchedUpdateColonist;

  window.HavenfallColonistVitals = Object.freeze({
    ENERGY,
    startRest,
    original,
    version: 'main-energy-balance-no-spawn-lock'
  });
})();
