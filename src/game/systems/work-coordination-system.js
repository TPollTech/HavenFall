'use strict';

(() => {
  if (window.HavenfallContext?.workCoordinationInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.workCoordinationInstalled = true;

  const reservations = new Map();
  const blockedUntil = new Map();
  let pulse = 0;

  function keyOf(obj) { return obj?.id || `${obj?.type}:${obj?.x},${obj?.y}`; }
  function timeKey() { return (state?.day || 0) * 24000 + Math.floor((state?.hour || 0) * 1000); }
  function priority(c, key) { return typeof taskPriorityValue === 'function' ? taskPriorityValue(c, key) : 2; }

  function workHour(c) {
    const manager = window.ScheduleManager;
    if (!manager?.getScheduleState) return true;
    return manager.getScheduleState(c, state?.hour || 0) === manager.SCHEDULE?.WORK;
  }

  function canWork(c, key = 'gather') {
    return !!state && !!c && !c.task && c.health > 15 && c.energy > 14 && workHour(c) && priority(c, key) > 0;
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

  function validMarkedResource(obj, c) {
    if (!obj?.markedForGather) return false;
    if (typeof isGatherableReady === 'function' ? !isGatherableReady(obj) : !objectDefs?.[obj.type]?.gather) return false;
    if (typeof isTileDiscovered === 'function' && !isTileDiscovered(obj.x, obj.y)) return false;
    if (isBadMountainObject(obj)) return false;
    const id = keyOf(obj);
    if (blockedUntil.has(id)) return false;
    const owner = reservations.get(id);
    return owner === undefined || owner === c.id;
  }

  function routeToObject(c, obj) {
    const adj = typeof nearestFreeAdjacent === 'function' ? nearestFreeAdjacent(obj.x, obj.y, c.x, c.y) : null;
    if (!adj) return null;
    const already = c.x === adj.x && c.y === adj.y;
    const path = already ? [] : (typeof findPath === 'function' ? findPath(c.x, c.y, adj.x, adj.y, obj) : []);
    if (!already && (!Array.isArray(path) || path.length === 0)) return null;
    return { adj, path };
  }

  function nearestMarkedResource(c) {
    let best = null;
    let bestRoute = null;
    let bestScore = Infinity;
    for (const obj of state.objects || []) {
      if (!validMarkedResource(obj, c)) continue;
      const route = routeToObject(c, obj);
      if (!route) { blockedUntil.set(keyOf(obj), timeKey() + 850); continue; }
      const score = Math.abs(c.x - obj.x) + Math.abs(c.y - obj.y);
      if (score < bestScore) { best = obj; bestRoute = route; bestScore = score; }
    }
    return best ? { obj: best, route: bestRoute } : null;
  }

  function assignMarkedResource(c) {
    if (!canWork(c, 'gather')) return false;
    const target = nearestMarkedResource(c);
    if (!target) return false;
    reservations.set(keyOf(target.obj), c.id);
    c.task = { type: 'gather', objId: target.obj.id, x: target.route.adj.x, y: target.route.adj.y, coordinated: true };
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

  function finishGather(c, obj, def) {
    addResources(def.gather);
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

  function calmIdle(c) {
    if (!c || c.task || appScreen !== SCREEN.PLAYING) return false;
    if (workExists()) { c.note = 'Aguardando designação lógica'; return true; }
    c.idlePulse = (c.idlePulse || 0) + 1;
    if (c.idlePulse % 240 !== 0) { c.note = 'Aguardando na base'; return true; }
    const anchors = (state.objects || []).filter(o => ['campfire', 'crate', 'bed', 'research_desk'].includes(o.type));
    const anchor = anchors.sort((a, b) => dist(c.x, c.y, a.x, a.y) - dist(c.x, c.y, b.x, b.y))[0] || state.world?.spawn;
    const adj = anchor && typeof nearestFreeAdjacent === 'function' ? nearestFreeAdjacent(anchor.x, anchor.y, c.x, c.y) : null;
    if (adj && !isBlocked(adj.x, adj.y)) { assignMove(c, adj.x, adj.y); c.note = 'Reposicionando perto da base'; }
    else c.note = 'Aguardando na base';
    return true;
  }

  function installOverrides() {
    window.assignMarkedGatherTasks = assignAllMarked;
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

  window.HavenfallWorkCoordinator = { assignMarkedGatherTasks: assignAllMarked, assignMarkedResource, calmIdle, workExists, reservations };
  window.GameSystems?.registerTaskHandler?.('gather', 'work-coordination.gather', handleGather, { order: 1 });
  window.GameSystems?.registerAutoTaskProvider?.('work-coordination.marked-gather', assignMarkedResource, { order: 1 });
  window.GameSystems?.registerTick?.('work-coordination', tick, { order: 21 });
  installOverrides();
})();