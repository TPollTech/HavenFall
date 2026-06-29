'use strict';

(() => {
  if (window.HavenfallContext?.workCoordinationInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.workCoordinationInstalled = true;

  const VERSION = 'work-coordination-v1';
  const reservations = new Map();
  const unreachable = new Map();
  let assignmentPulse = 0;

  function objKey(obj) {
    return obj?.id || `${obj?.type || 'obj'}:${obj?.x},${obj?.y}`;
  }

  function nowTick() {
    return (state?.day || 0) * 24000 + Math.floor((state?.hour || 0) * 1000);
  }

  function scheduleAllowsWork(c) {
    if (!c || c.isUnconscious) return false;
    if (typeof ScheduleManager?.getScheduleState === 'function') {
      const mode = ScheduleManager.getScheduleState(c, state?.hour || 0);
      if (mode === ScheduleManager.SCHEDULE?.SLEEP) return false;
      if (mode === ScheduleManager.SCHEDULE?.LEISURE) return false;
    }
    return true;
  }

  function canTakeWork(c, priorityKey = 'gather') {
    if (!state || !c || c.task || c.health <= 15 || c.energy <= 14) return false;
    if (!scheduleAllowsWork(c)) return false;
    if (typeof taskPriorityValue === 'function' && taskPriorityValue(c, priorityKey) <= 0) return false;
    return true;
  }

  function cleanupReservations() {
    if (!state?.objects) return;
    const ids = new Set(state.objects.map(o => o.id));
    for (const key of [...reservations.keys()]) {
      if (!ids.has(key)) reservations.delete(key);
    }
    const t = nowTick();
    for (const [key, entry] of [...unreachable.entries()]) {
      if (!entry || entry.until <= t) unreachable.delete(key);
    }
  }

  function isReservedByOther(obj, c) {
    const key = objKey(obj);
    const owner = reservations.get(key);
    return owner !== undefined && owner !== c.id;
  }

  function reserveFor(obj, c) {
    if (!obj || !c) return;
    reservations.set(objKey(obj), c.id);
  }

  function releaseReservation(objOrId) {
    const key = typeof objOrId === 'string' ? objOrId : objKey(objOrId);
    reservations.delete(key);
  }

  function markUnreachable(obj) {
    if (!obj) return;
    unreachable.set(objKey(obj), { until: nowTick() + 850 });
  }

  function isTemporarilyUnreachable(obj) {
    const entry = unreachable.get(objKey(obj));
    return !!entry && entry.until > nowTick();
  }

  function validGatherTarget(obj, c = null) {
    if (!obj || !obj.markedForGather) return false;
    if (typeof isGatherableReady === 'function' && !isGatherableReady(obj)) return false;
    else if (!objectDefs?.[obj.type]?.gather) return false;
    if (typeof isTileDiscovered === 'function' && !isTileDiscovered(obj.x, obj.y)) return false;
    if (window.HavenfallGeologyObjectRenderGuard?.objectInvalidatedByMountain?.(obj)) return false;
    if (isTemporarilyUnreachable(obj)) return false;
    if (c && isReservedByOther(obj, c)) return false;
    return true;
  }

  function pathToAdjacent(c, obj) {
    const adj = typeof nearestFreeAdjacent === 'function' ? nearestFreeAdjacent(obj.x, obj.y, c.x, c.y) : null;
    if (!adj) return null;
    const alreadyThere = c.x === adj.x && c.y === adj.y;
    const path = alreadyThere ? [] : (typeof findPath === 'function' ? findPath(c.x, c.y, adj.x, adj.y, obj) : []);
    if (!alreadyThere && (!Array.isArray(path) || path.length === 0)) return null;
    return { adj, path };
  }

  function nearestReservedGatherTarget(c) {
    let best = null;
    let bestPath = null;
    let bestScore = Infinity;
    for (const obj of state.objects || []) {
      if (!validGatherTarget(obj, c)) continue;
      const route = pathToAdjacent(c, obj);
      if (!route) { markUnreachable(obj); continue; }
      const d = Math.abs(c.x - obj.x) + Math.abs(c.y - obj.y);
      const markedBoost = obj.markedForGather ? -1000 : 0;
      const score = d + markedBoost;
      if (score < bestScore) {
        best = obj;
        bestPath = route;
        bestScore = score;
      }
    }
    return best ? { obj: best, route: bestPath } : null;
  }

  function assignGatherCoordinated(c, obj, route = null) {
    if (!c || !obj || !validGatherTarget(obj, c)) return false;
    const resolved = route || pathToAdjacent(c, obj);
    if (!resolved) { markUnreachable(obj); return false; }
    reserveFor(obj, c);
    c.task = { type: 'gather', objId: obj.id, x: resolved.adj.x, y: resolved.adj.y, reserved: true };
    c.path = resolved.path;
    c.work = 0;
    c.note = `Coletando ${objectDefs?.[obj.type]?.name || obj.type}`;
    return true;
  }

  function syncObjects(nextObjects) {
    state.objects = nextObjects;
    if (state.world) state.world.objects = nextObjects;
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
  }

  function completeGather(c, obj, def) {
    addResources(def.gather);
    const next = (state.objects || []).filter(o => o.id !== obj.id);
    if (obj.type === 'tree') next.push({ id: uid('obj'), type: 'logs', x: obj.x, y: obj.y });
    if (obj.type === 'crop') next.push({ id: uid('obj'), type: 'crop', x: obj.x, y: obj.y, growth: 0 });
    syncObjects(next);
    releaseReservation(obj);
    log(`${c.name} coletou ${def.name}.`);
    c.task = null;
    c.note = 'Ocioso';
    c.work = 0;
  }

  function handleGatherTask(c, task, tick) {
    const obj = state?.objects?.find(o => o.id === task?.objId);
    if (!obj) {
      releaseReservation(task?.objId);
      c.task = null; c.note = 'Ocioso'; c.work = 0;
      return true;
    }
    if (!validGatherTarget(obj, c) && !objectDefs?.[obj.type]?.gather) {
      releaseReservation(obj);
      c.task = null; c.note = 'Ocioso'; c.work = 0;
      return true;
    }
    reserveFor(obj, c);
    const def = objectDefs[obj.type];
    const workNeeded = Math.max(0.25, Number(def.work || 1));
    c.work += tick * workRate(c, 'gather', obj);
    c.note = `Coletando ${def.name} ${Math.floor((c.work / workNeeded) * 100)}%`;
    if (c.work >= workNeeded) completeGather(c, obj, def);
    return true;
  }

  function assignMarkedGatherTasksCoordinated() {
    if (!state?.colonists?.length) return 0;
    cleanupReservations();
    let assigned = 0;
    const workers = state.colonists
      .filter(c => canTakeWork(c, 'gather'))
      .sort((a, b) => (taskPriorityValue?.(b, 'gather') || 0) - (taskPriorityValue?.(a, 'gather') || 0));
    for (const c of workers) {
      const target = nearestReservedGatherTarget(c);
      if (!target) continue;
      if (assignGatherCoordinated(c, target.obj, target.route)) assigned++;
    }
    return assigned;
  }

  function assignCoordinatorAutoTask(c) {
    cleanupReservations();
    if (!canTakeWork(c, 'gather')) return false;
    const target = nearestReservedGatherTarget(c);
    if (target && assignGatherCoordinated(c, target.obj, target.route)) return true;
    return false;
  }

  function hasAvailableWork() {
    if (!state) return false;
    if ((state.objects || []).some(o => o.markedForGather && objectDefs?.[o.type]?.gather)) return true;
    if ((state.objects || []).some(o => o.type === 'blueprint')) return true;
    if (typeof nearestMarkedMine === 'function' && state.colonists?.some(c => nearestMarkedMine(c))) return true;
    if (window.HavenfallRoofSystem?.hasPendingJobs?.()) return true;
    return false;
  }

  function controlledIdle(c) {
    if (!c || c.task || appScreen !== SCREEN.PLAYING) return false;
    if (hasAvailableWork()) {
      c.note = 'Aguardando designação lógica';
      return true;
    }
    c.idlePulse = (c.idlePulse || 0) + 1;
    if (c.idlePulse % 240 !== 0) {
      c.note = 'Aguardando na base';
      return true;
    }
    const anchors = (state.objects || []).filter(o => ['campfire', 'crate', 'bed', 'research_desk'].includes(o.type));
    const anchor = anchors.sort((a, b) => dist(c.x, c.y, a.x, a.y) - dist(c.x, c.y, b.x, b.y))[0] || state.world?.spawn;
    if (!anchor) return true;
    const target = typeof nearestFreeAdjacent === 'function' ? nearestFreeAdjacent(anchor.x, anchor.y, c.x, c.y) : null;
    if (target && !isBlocked(target.x, target.y)) {
      assignMove(c, target.x, target.y);
      c.note = 'Reposicionando perto da base';
    } else {
      c.note = 'Aguardando na base';
    }
    return true;
  }

  function patchWander() {
    if (window.HavenfallContext.workCoordinationWanderPatched || typeof randomWander !== 'function') return;
    randomWander = function coordinatedIdleInsteadOfRandomWander(c) {
      controlledIdle(c);
    };
    window.HavenfallContext.workCoordinationWanderPatched = true;
  }

  function installGlobalOverrides() {
    if (!window.HavenfallContext.workCoordinationGatherPatched) {
      window.assignMarkedGatherTasks = assignMarkedGatherTasksCoordinated;
      window.HavenfallContext.workCoordinationGatherPatched = true;
    }
    patchWander();
  }

  function updateWorkCoordinator(dt) {
    if (!state || appScreen !== SCREEN.PLAYING) return;
    installGlobalOverrides();
    cleanupReservations();
    assignmentPulse += dt * Number(state.speed || 1);
    if (assignmentPulse < 0.35) return;
    assignmentPulse = 0;
    assignMarkedGatherTasksCoordinated();
  }

  window.HavenfallWorkCoordinator = {
    version: VERSION,
    reservations,
    assignMarkedGatherTasks: assignMarkedGatherTasksCoordinated,
    assignGatherCoordinated,
    hasAvailableWork,
    controlledIdle
  };

  window.GameSystems?.registerTaskHandler?.('gather', 'work-coordination.gather', handleGatherTask, { order: 1 });
  window.GameSystems?.registerAutoTaskProvider?.('work-coordination.marked-gather', assignCoordinatorAutoTask, { order: 1 });
  window.GameSystems?.registerTick?.('work-coordination', updateWorkCoordinator, { order: 21 });
  installGlobalOverrides();
})();