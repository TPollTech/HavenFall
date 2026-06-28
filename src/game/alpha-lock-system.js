'use strict';

(() => {
  let installed = false;
  let originalNearestBlueprint = null;
  let originalAssignBuild = null;

  function now() { return performance.now(); }
  function stamp() { return Math.round(now()); }
  function isAliveColonist(id) { return !!state?.colonists?.some(c => c.id === id); }
  function objById(id) { return state?.objects?.find(o => o.id === id) || null; }
  function reserve(obj, c, kind) {
    if (!obj || !c) return false;
    if (obj.reservedBy && obj.reservedBy !== c.id && isAliveColonist(obj.reservedBy)) return false;
    obj.reservedBy = c.id;
    obj.reservedKind = kind;
    obj.reservedAt = stamp();
    return true;
  }
  function release(obj, c = null) {
    if (!obj) return;
    if (!c || obj.reservedBy === c.id) {
      delete obj.reservedBy;
      delete obj.reservedKind;
      delete obj.reservedAt;
    }
  }
  function isReservedForOther(obj, c) {
    return !!(obj?.reservedBy && obj.reservedBy !== c?.id && isAliveColonist(obj.reservedBy));
  }

  function cleanupReservations() {
    if (!state?.objects) return;
    const active = new Set();
    for (const c of state.colonists || []) if (c.task?.objId) active.add(`${c.id}:${c.task.objId}`);
    for (const obj of state.objects) {
      if (!obj.reservedBy) continue;
      const stale = !isAliveColonist(obj.reservedBy) || !active.has(`${obj.reservedBy}:${obj.id}`) || (obj.reservedAt && stamp() - obj.reservedAt > 45000);
      if (stale) release(obj);
    }
  }

  function nearestBlueprintReserved(c) {
    cleanupReservations();
    const list = (state?.objects || [])
      .filter(o => o.type === 'blueprint' && !isReservedForOther(o, c))
      .sort((a, b) => dist(c.x, c.y, a.x, a.y) - dist(c.x, c.y, b.x, b.y));
    return list[0] || null;
  }

  function assignBuildReserved(c, bp) {
    if (!c || !bp) return false;
    if (isReservedForOther(bp, c)) return false;
    reserve(bp, c, 'build');
    if (originalAssignBuild) {
      originalAssignBuild(c, bp);
      return true;
    }
    return false;
  }

  function nearestDeconstructReserved(c) {
    cleanupReservations();
    return (state?.objects || [])
      .filter(o => o.markedForDeconstruct && !isReservedForOther(o, c) && (!isTileDiscovered || isTileDiscovered(o.x, o.y)))
      .sort((a, b) => dist(c.x, c.y, a.x, a.y) - dist(c.x, c.y, b.x, b.y))[0] || null;
  }

  function assignDeconstructReserved(c, obj) {
    if (!c || !obj || isReservedForOther(obj, c)) return false;
    const adj = nearestFreeAdjacent(obj.x, obj.y, c.x, c.y) || { x: obj.x, y: obj.y };
    reserve(obj, c, 'deconstruct');
    c.task = { type: 'deconstruct', objId: obj.id, x: adj.x, y: adj.y };
    c.path = findPath(c.x, c.y, adj.x, adj.y, obj);
    c.work = 0;
    c.note = `Desconstruindo ${objectDefs?.[obj.type]?.name || obj.type}`;
    return true;
  }

  function handleDeconstructReserved(c, task, tick) {
    if (task?.type !== 'deconstruct') return false;
    const obj = objById(task.objId);
    if (!obj || !obj.markedForDeconstruct) { c.task = null; c.work = 0; c.note = 'Ocioso'; return true; }
    reserve(obj, c, 'deconstruct');
    return false;
  }

  function taskStabilityTick(c, dt) {
    if (!c || !state) return;
    cleanupReservations();
    if (c.task?.objId) {
      const obj = objById(c.task.objId);
      if (obj) reserve(obj, c, c.task.type);
    }
    if (!c.task) {
      c._alphaStuckMs = 0;
      return;
    }
    const noPath = !c.path?.length;
    const hasTarget = Number.isFinite(c.task.x) && Number.isFinite(c.task.y);
    const atTarget = !hasTarget || (Math.round(c.x) === Math.round(c.task.x) && Math.round(c.y) === Math.round(c.task.y));
    if (!noPath || atTarget) { c._alphaStuckMs = 0; return; }
    c._alphaStuckMs = (c._alphaStuckMs || 0) + dt * 1000;
    if (c._alphaStuckMs > 3200) {
      const obj = objById(c.task.objId);
      release(obj, c);
      c.task = null;
      c.path = [];
      c.work = 0;
      c.note = 'Tarefa cancelada: sem caminho';
      c._alphaStuckMs = 0;
      if (typeof log === 'function') log(`${c.name} cancelou uma tarefa sem caminho.`);
    }
  }

  function alphaChecklist() {
    const checks = {
      boot: !!window.HavenfallContext?.gameBooted,
      construction: !!window.HavenfallAlphaConstruction,
      renderCollision: !!window.HavenfallRenderCollisionSystem,
      pathingDoors: !!window.HavenfallColonistPathingHotfix,
      solidWalls: !!window.HavenfallWallDoorSolidVisual,
      deconstruct: typeof handleOrderToolAtTile === 'function' && typeof countMarkedDeconstruct === 'function',
      saveLoad: typeof saveGame === 'function' && typeof loadGame === 'function',
      geology: typeof isMountainBlocked === 'function' && typeof mineRockAt === 'function',
      tasks: !!window.GameSystems?.registerTaskHandler
    };
    const passed = Object.values(checks).filter(Boolean).length;
    return { checks, passed, total: Object.keys(checks).length, ready: passed === Object.keys(checks).length };
  }

  function publishAlphaStatus() {
    const report = alphaChecklist();
    window.HavenfallAlphaChecklist = report;
    window.HavenfallAlphaReady = report.ready;
    return report;
  }

  function install() {
    if (installed) return;
    if (!window.HavenfallContext?.gameBooted || !window.GameSystems) { setTimeout(install, 150); return; }
    installed = true;
    originalNearestBlueprint = typeof nearestBlueprint === 'function' ? nearestBlueprint : null;
    originalAssignBuild = typeof assignBuild === 'function' ? assignBuild : null;
    try { nearestBlueprint = nearestBlueprintReserved; } catch (_) {}
    try { assignBuild = assignBuildReserved; } catch (_) {}
    window.GameSystems.registerBeforeColonistUpdate('alpha.lock.task-stability', taskStabilityTick, { order: 3 });
    window.GameSystems.registerAutoTaskProvider('alpha.lock.deconstruct-reserved', c => {
      if (!c || c.task || (typeof taskPriorityValue === 'function' && taskPriorityValue(c, 'build') <= 0)) return false;
      const target = nearestDeconstructReserved(c);
      return target ? assignDeconstructReserved(c, target) : false;
    }, { order: 27 });
    window.GameSystems.registerTaskHandler('deconstruct', 'alpha.lock.deconstruct-reservation', handleDeconstructReserved, { order: 20 });
    window.publishAlphaStatus = publishAlphaStatus;
    publishAlphaStatus();
    setInterval(publishAlphaStatus, 5000);
    console.info('[Alpha Lock] Reservas de tarefa, anti-travamento e checklist Alpha ativos.', window.HavenfallAlphaChecklist);
  }

  install();
})();
