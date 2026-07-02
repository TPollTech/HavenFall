'use strict';

(() => {
  if (window.HavenfallContext?.workCoordinationInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.workCoordinationInstalled = true;

  const reservations = new Map();
  const blockedUntil = new Map();
  const IDLE_USEFUL_TYPES = new Set(['logs', 'berry', 'herbs', 'mushrooms', 'dry_twigs', 'cactus']);
  let pulse = 0;

  function keyOf(obj) { return obj?.id || `${obj?.type}:${obj?.x},${obj?.y}`; }
  function timeKey() { return (state?.day || 0) * 24000 + Math.floor((state?.hour || 0) * 1000); }
  function priority(c, key) { return typeof taskPriorityValue === 'function' ? taskPriorityValue(c, key) : 2; }
  function clampValue(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }

  function workHour(c) {
    const manager = window.ScheduleManager;
    if (!manager?.getScheduleState) return true;
    return manager.getScheduleState(c, state?.hour || 0) === manager.SCHEDULE?.WORK;
  }

  function canWork(c, key = 'gather') {
    if (!state || !c || c.task || c.health <= 15 || c.energy <= 14 || c.hunger <= 16 || c.mood <= 8 || priority(c, key) <= 0) return false;
    if (workHour(c)) return true;
    return key === 'gather' && workExists() && c.energy > 28 && c.mood > 16;
  }

  function cleanup() {
    const ids = new Set((state?.objects || []).map(o => o.id));
    for (const id of [...reservations.keys()]) if (!ids.has(id)) reservations.delete(id);
    const now = timeKey();
    for (const [id, until] of [...blockedUntil.entries()]) if (until <= now) blockedUntil.delete(id);
  }

  function isBadMountainObject(obj) {
    return !!window.HavenfallGeologyObjectRenderGuard?.objectInvalidatedByMountain?.(obj);
  }

  function validGatherResource(obj, c, options = {}) {
    if (!obj) return false;
    if (options.requireMarked && !obj.markedForGather) return false;
    if (typeof isGatherableReady === 'function' ? !isGatherableReady(obj) : !objectDefs?.[obj.type]?.gather) return false;
    if (typeof isTileDiscovered === 'function' && !isTileDiscovered(obj.x, obj.y)) return false;
    if (isBadMountainObject(obj)) return false;
    const id = keyOf(obj);
    if (blockedUntil.has(id)) return false;
    const owner = reservations.get(id);
    return owner === undefined || owner === c.id;
  }

  function validMarkedResource(obj, c) {
    return validGatherResource(obj, c, { requireMarked: true });
  }

  function routeToObject(c, obj) {
    const adj = typeof nearestFreeAdjacent === 'function' ? nearestFreeAdjacent(obj.x, obj.y, c.x, c.y) : null;
    if (!adj) return null;
    const already = c.x === adj.x && c.y === adj.y;
    const path = already ? [] : (typeof findPath === 'function' ? findPath(c.x, c.y, adj.x, adj.y, obj) : []);
    if (!already && (!Array.isArray(path) || path.length === 0)) return null;
    return { adj, path };
  }

  function gatherTaskFor(obj, route, extra = {}) {
    return { type: 'gather', objId: obj.id, x: route.adj.x, y: route.adj.y, coordinated: true, ...extra };
  }

  function taskBlockedFor(c, task) {
    return !!window.HavenfallTasks?.isTaskTemporarilyBlocked?.(c, task);
  }

  function nearestMarkedResource(c) {
    let best = null;
    let bestRoute = null;
    let bestTask = null;
    let bestScore = Infinity;
    for (const obj of state.objects || []) {
      if (!validMarkedResource(obj, c)) continue;
      const route = routeToObject(c, obj);
      if (!route) { blockedUntil.set(keyOf(obj), timeKey() + 850); continue; }
      const task = gatherTaskFor(obj, route);
      if (taskBlockedFor(c, task)) continue;
      const score = Math.abs(c.x - obj.x) + Math.abs(c.y - obj.y);
      if (score < bestScore) { best = obj; bestRoute = route; bestTask = task; bestScore = score; }
    }
    return best ? { obj: best, route: bestRoute, task: bestTask } : null;
  }

  function assignMarkedResource(c) {
    if (!canWork(c, 'gather')) return false;
    const target = nearestMarkedResource(c);
    if (!target) return false;
    reservations.set(keyOf(target.obj), c.id);
    c.task = target.task;
    c.path = target.route.path;
    c.work = 0;
    c.note = `Coletando ${objectDefs?.[target.obj.type]?.name || target.obj.type}`;
    return true;
  }

  function syncObjects(next) {
    state.objects = next;
    if (state.world) state.world.objects = next;
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
  }

  function gatherFeedbackKind(obj, def) {
    const gather = def?.gather || {};
    if (obj?.type === 'tree' || obj?.type === 'logs' || gather.wood) return 'wood';
    return 'gather';
  }

  function finishGather(c, obj, def) {
    addResources(def.gather);
    window.HavenfallWorkFeedback?.notifyComplete?.(gatherFeedbackKind(obj, def), { objectType: obj.type, gain: def.gather }, obj.x, obj.y);
    const next = (state.objects || []).filter(o => o.id !== obj.id);
    if (obj.type === 'tree') next.push({ id: uid('obj'), type: 'logs', x: obj.x, y: obj.y });
    if (obj.type === 'crop') next.push({ id: uid('obj'), type: 'crop', x: obj.x, y: obj.y, growth: 0 });
    syncObjects(next);
    reservations.delete(keyOf(obj));
    log(`${c.name} coletou ${def.name}.`);
    c.task = null; c.note = 'Ocioso'; c.work = 0;
  }

  function handleGather(c, task, tick) {
    const obj = state?.objects?.find(o => o.id === task?.objId);
    if (!obj) { reservations.delete(task?.objId); c.task = null; c.note = 'Ocioso'; c.work = 0; return true; }
    const def = objectDefs?.[obj.type];
    if (!def?.gather) { reservations.delete(keyOf(obj)); c.task = null; c.note = 'Ocioso'; c.work = 0; return true; }
    reservations.set(keyOf(obj), c.id);
    const needed = Math.max(0.25, Number(def.work || 1));
    c.work += tick * workRate(c, 'gather', obj);
    c.note = `Coletando ${def.name} ${Math.floor((c.work / needed) * 100)}%`;
    if (c.work >= needed) finishGather(c, obj, def);
    return true;
  }

  function assignAllMarked() {
    cleanup();
    let count = 0;
    for (const c of (state?.colonists || []).filter(c => canWork(c, 'gather')).sort((a, b) => priority(b, 'gather') - priority(a, 'gather'))) {
      if (assignMarkedResource(c)) count++;
    }
    return count;
  }

  function workExists() {
    if ((state?.objects || []).some(o => o.markedForGather && objectDefs?.[o.type]?.gather)) return true;
    if ((state?.objects || []).some(o => o.type === 'blueprint')) return true;
    if (window.HavenfallRoofSystem?.hasPendingJobs?.()) return true;
    return false;
  }

  function needsRecovery(c) {
    return Number(c?.energy ?? 100) < 22 || Number(c?.mood ?? 100) < 10 || Number(c?.hunger ?? 100) < 24 || Number(c?.health ?? 100) < 25;
  }

  function consumeEmergencyFood(c) {
    if (!state?.resources || Number(c?.hunger ?? 100) >= 24 || Number(state.resources.food || 0) <= 0) return false;
    const spent = typeof consumeCost === 'function'
      ? consumeCost({ food: 1 }, { reason: 'colonist-emergency-eat', actorId: c.id })
      : window.GameState?.consumeResources?.({ food: 1 }, { reason: 'colonist-emergency-eat', actorId: c.id });
    if (!spent) return false;
    c.hunger = clampValue((c.hunger ?? 0) + 44, 0, 100);
    c.mood = clampValue((c.mood ?? 0) + 4, 0, 100);
    c.note = 'Comeu uma refeição rápida';
    if (typeof log === 'function') log(`${c.name} comeu uma refeição rápida.`);
    return true;
  }

  function nearestObjectOfType(type, c) {
    return (state?.objects || [])
      .filter(obj => obj.type === type)
      .sort((a, b) => dist(c.x, c.y, a.x, a.y) - dist(c.x, c.y, b.x, b.y))[0] || null;
  }

  function assignRecoveryHeal(c) {
    if (Number(c?.health ?? 100) >= 25 || Number(state?.resources?.medicine || 0) <= 0 || typeof assignHeal !== 'function') return false;
    const station = nearestObjectOfType('med_station', c);
    if (!station) return false;
    assignHeal(c, station);
    return c.task?.type === 'heal';
  }

  function safeStartSleep(c, reason = 'Indo dormir') {
    if (!c || c.task) return false;
    const bed = nearestObjectOfType('bed', c);
    if (bed) {
      const route = routeToObject(c, bed);
      if (route) {
        c.task = { type: 'sleep', x: route.adj.x, y: route.adj.y, bedId: bed.id, bedX: bed.x, bedY: bed.y };
        c.path = route.path;
        c.work = 0;
        c.note = reason;
        return true;
      }
      blockedUntil.set(keyOf(bed), timeKey() + 900);
    }
    c.task = { type: 'sleep', x: c.x, y: c.y, recovery: true, noReachableBed: !!bed };
    c.path = [];
    c.work = 0;
    c.note = bed ? 'Descansando no chão (cama inacessível)' : 'Descansando no chão';
    return true;
  }

  function assignRecoverySleep(c, reason = 'Recuperando energia') {
    if (!c || c.task) return false;
    if (safeStartSleep(c, reason)) return true;
    return false;
  }

  function assignRecoveryLeisure(c, reason = 'Recuperando humor') {
    if (!c || c.task) return false;
    const target = nearestObjectOfType('campfire', c);
    if (!target) {
      c.mood = clampValue((c.mood ?? 0) + 0.04, 0, 100);
      c.note = 'Respirando para recuperar humor';
      return localIdleMove(c);
    }
    const adj = typeof nearestFreeAdjacent === 'function' ? nearestFreeAdjacent(target.x, target.y, c.x, c.y) : null;
    if (!adj) return baseAnchorMove(c);
    const already = c.x === adj.x && c.y === adj.y;
    const path = already ? [] : (typeof findPath === 'function' ? findPath(c.x, c.y, adj.x, adj.y, target) : []);
    if (!already && (!Array.isArray(path) || path.length === 0)) return baseAnchorMove(c);
    c.task = { type: 'leisure', x: adj.x, y: adj.y, objId: target.id, recovery: true };
    c.path = path;
    c.work = 0;
    c.note = reason;
    return true;
  }

  function handleRecoveryNeed(c, options = {}) {
    if (!c || c.task) return false;
    const allowSoft = !!options.allowSoft;
    const energy = Number(c.energy ?? 100);
    const mood = Number(c.mood ?? 100);
    const hunger = Number(c.hunger ?? 100);
    const health = Number(c.health ?? 100);

    if (hunger < 24 && consumeEmergencyFood(c)) return true;
    if (health < 25 && assignRecoveryHeal(c)) return true;
    if (health < 18) return assignRecoverySleep(c, 'Recuperando ferimentos');
    if (energy < 22) return assignRecoverySleep(c, 'Recuperando energia crítica');
    if (mood < 10) return assignRecoveryLeisure(c, 'Recuperando humor crítico');

    if (!allowSoft) return false;
    if (energy < 34) return assignRecoverySleep(c, 'Recuperando energia');
    if (mood < 28) return assignRecoveryLeisure(c, 'Recuperando humor');
    return false;
  }

  function occupiedByOtherColonist(x, y, colonist) {
    return (state?.colonists || []).some(other => other !== colonist && other.x === x && other.y === y);
  }

  function localIdleMove(c) {
    const tries = [[1,0],[-1,0],[0,1],[0,-1], [1,1], [-1,1], [1,-1], [-1,-1]].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of tries) {
      const nx = c.x + dx;
      const ny = c.y + dy;
      if (isBlocked(nx, ny) || occupiedByOtherColonist(nx, ny, c)) continue;
      assignMove(c, nx, ny);
      c.note = 'Caminhando por perto';
      return true;
    }
    c.note = 'Aguardando no local';
    return true;
  }

  function baseAnchorMove(c) {
    const anchors = (state.objects || []).filter(o => ['campfire', 'crate', 'bed', 'research_desk'].includes(o.type));
    if (!anchors.length) return localIdleMove(c);
    const sorted = anchors.sort((a, b) => dist(c.x, c.y, a.x, a.y) - dist(c.x, c.y, b.x, b.y));
    for (const anchor of sorted.slice(0, 4)) {
      const adj = typeof nearestFreeAdjacent === 'function' ? nearestFreeAdjacent(anchor.x, anchor.y, c.x, c.y) : null;
      if (!adj || isBlocked(adj.x, adj.y) || occupiedByOtherColonist(adj.x, adj.y, c)) continue;
      assignMove(c, adj.x, adj.y);
      c.note = 'Reposicionando perto da base';
      return true;
    }
    return localIdleMove(c);
  }

  function nearestUsefulIdleResource(c) {
    let best = null;
    let bestRoute = null;
    let bestTask = null;
    let bestScore = Infinity;
    for (const obj of state.objects || []) {
      if (!IDLE_USEFUL_TYPES.has(obj.type)) continue;
      if (!validGatherResource(obj, c, { requireMarked: false })) continue;
      if (Math.abs(c.x - obj.x) + Math.abs(c.y - obj.y) > 10) continue;
      const route = routeToObject(c, obj);
      if (!route) { blockedUntil.set(keyOf(obj), timeKey() + 600); continue; }
      const task = gatherTaskFor(obj, route, { idleUseful: true });
      if (taskBlockedFor(c, task)) continue;
      const score = Math.abs(c.x - obj.x) + Math.abs(c.y - obj.y);
      if (score < bestScore) { best = obj; bestRoute = route; bestTask = task; bestScore = score; }
    }
    return best ? { obj: best, route: bestRoute, task: bestTask } : null;
  }

  function assignUsefulIdleGather(c) {
    if (!canWork(c, 'gather') || !workHour(c)) return false;
    const target = nearestUsefulIdleResource(c);
    if (!target) return false;
    reservations.set(keyOf(target.obj), c.id);
    c.task = target.task;
    c.path = target.route.path;
    c.work = 0;
    c.note = `Coletando recurso próximo (${objectDefs?.[target.obj.type]?.name || target.obj.type})`;
    return true;
  }

  function calmIdle(c) {
    if (!c || c.task || appScreen !== SCREEN.PLAYING) return false;
    if (handleRecoveryNeed(c, { allowSoft: false })) return true;
    const hasWork = workExists();
    if (hasWork && workHour(c) && c.energy > 22 && c.mood > 10) { c.note = 'Aguardando designação lógica'; return true; }
    if (handleRecoveryNeed(c, { allowSoft: true })) return true;
    if (!hasWork && assignUsefulIdleGather(c)) return true;
    if (hasWork) { c.note = workHour(c) ? 'Aguardando designação lógica' : 'Fora do horário de trabalho'; return true; }
    c.idlePulse = (c.idlePulse || 0) + 1;
    if (c.idlePulse % 240 !== 0) { c.note = 'Aguardando no local'; return true; }
    return baseAnchorMove(c);
  }

  function installOverrides() {
    window.assignMarkedGatherTasks = assignAllMarked;
    if (!window.HavenfallContext.workCoordinationSleepPatched && typeof startSleep === 'function') {
      startSleep = c => safeStartSleep(c);
      window.HavenfallContext.workCoordinationSleepPatched = true;
    }
    if (!window.HavenfallContext.workCoordinationWanderPatched && typeof randomWander === 'function') {
      randomWander = c => calmIdle(c);
      window.HavenfallContext.workCoordinationWanderPatched = true;
    }
  }

  function tick(dt) {
    if (!state || appScreen !== SCREEN.PLAYING) return;
    installOverrides();
    cleanup();
    pulse += dt * Number(state.speed || 1);
    if (pulse < 0.35) return;
    pulse = 0;
    assignAllMarked();
  }

  window.HavenfallWorkCoordinator = { assignMarkedGatherTasks: assignAllMarked, assignMarkedResource, assignUsefulIdleGather, safeStartSleep, calmIdle, workExists, needsRecovery, handleRecoveryNeed, reservations };
  window.GameSystems?.registerTaskHandler?.('gather', 'work-coordination.gather', handleGather, { order: 1 });
  window.GameSystems?.registerAutoTaskProvider?.('work-coordination.marked-gather', assignMarkedResource, { order: 1 });
  window.GameSystems?.registerTick?.('work-coordination', tick, { order: 21 });
  installOverrides();
})();
