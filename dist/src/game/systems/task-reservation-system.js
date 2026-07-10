'use strict';

(() => {
  let installed = false;
  let originalNearestBlueprint = null;
  let originalAssignBuild = null;

  function alive(id) { return !!state?.colonists?.some(c => c.id === id); }
  function getObj(id) { return state?.objects?.find(o => o.id === id) || null; }
  function otherReserved(obj, c) { return !!(obj?.reservedBy && obj.reservedBy !== c?.id && alive(obj.reservedBy)); }

  function reserve(obj, c, kind) {
    if (!obj || !c || otherReserved(obj, c)) return false;
    obj.reservedBy = c.id;
    obj.reservedKind = kind;
    obj.reservedAt = Date.now();
    return true;
  }

  function release(obj, c = null) {
    if (!obj || (c && obj.reservedBy !== c.id)) return;
    delete obj.reservedBy;
    delete obj.reservedKind;
    delete obj.reservedAt;
  }

  function cleanup() {
    if (!state?.objects) return;
    const active = new Set((state.colonists || []).filter(c => c.task?.objId).map(c => `${c.id}:${c.task.objId}`));
    for (const obj of state.objects) {
      if (!obj.reservedBy) continue;
      if (!alive(obj.reservedBy) || !active.has(`${obj.reservedBy}:${obj.id}`) || Date.now() - (obj.reservedAt || 0) > 45000) release(obj);
    }
  }

  function nearestBlueprintReserved(c) {
    cleanup();
    return (state?.objects || [])
      .filter(o => o.type === 'blueprint' && !otherReserved(o, c))
      .sort((a, b) => dist(c.x, c.y, a.x, a.y) - dist(c.x, c.y, b.x, b.y))[0] || null;
  }

  function assignBuildReserved(c, bp) {
    if (!reserve(bp, c, 'build')) return false;
    if (originalAssignBuild) originalAssignBuild(c, bp);
    return true;
  }

  function stabilityGuard(c, dt) {
    if (!c || !state) return;
    cleanup();
    if (c.task?.objId) reserve(getObj(c.task.objId), c, c.task.type);
    if (!c.task) { c._stuckTaskTime = 0; return; }
    const targetOk = !Number.isFinite(c.task.x) || !Number.isFinite(c.task.y) || (Math.round(c.x) === Math.round(c.task.x) && Math.round(c.y) === Math.round(c.task.y));
    if (c.path?.length || targetOk) { c._stuckTaskTime = 0; return; }
    c._stuckTaskTime = (c._stuckTaskTime || 0) + dt;
    if (c._stuckTaskTime < 3.2) return;
    release(getObj(c.task.objId), c);
    c.task = null;
    c.path = [];
    c.work = 0;
    c.note = 'Tarefa cancelada: sem caminho';
    c._stuckTaskTime = 0;
    if (typeof log === 'function') log(`${c.name} cancelou uma tarefa sem caminho.`);
  }

  function install() {
    if (installed) return;
    if (!window.HavenfallContext?.gameBooted || !window.GameSystems) { setTimeout(install, 150); return; }
    installed = true;
    originalNearestBlueprint = typeof nearestBlueprint === 'function' ? nearestBlueprint : null;
    originalAssignBuild = typeof assignBuild === 'function' ? assignBuild : null;
    try { nearestBlueprint = nearestBlueprintReserved; } catch (_) {}
    try { assignBuild = assignBuildReserved; } catch (_) {}
    window.GameSystems.registerBeforeColonistUpdate('task-reservation.stability', stabilityGuard, { order: 3 });
    window.HavenfallTaskReservationSystem = true;
    console.info('[Task Reservation] Reservas de tarefas carregadas.');
  }

  install();
})();
