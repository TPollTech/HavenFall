'use strict';

(() => {
  if (window.HavenfallContext?.runtimeTasksInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.runtimeTasksInstalled = true;

  const STUCK_REPATH_SECONDS = 3.0;
  const STUCK_CANCEL_SECONDS = 8.0;
  const MIN_MOVE_DELTA_PX = 0.35;

  function cancel(c, reason) {
    if (window.HavenfallRuntime?.cancelColonistTask) return window.HavenfallRuntime.cancelColonistTask(c, reason);
    c.task = null;
    c.path = [];
    c.work = 0;
    c.note = reason || 'Ocioso';
    return true;
  }

  function objectById(id) {
    if (!id) return null;
    return (state?.objects || []).find(obj => String(obj.id) === String(id)) || null;
  }

  function mobById(id) {
    if (!id) return null;
    return [...(state?.mobs || []), ...(state?.wolves || [])].find(mob => String(mob.id) === String(id)) || null;
  }

  function poiById(id) {
    if (!id) return null;
    return (state?.world?.pointsOfInterest || []).find(poi => String(poi.id) === String(id)) || null;
  }

  function isAtTaskTile(c, task) {
    if (!task) return true;
    const tx = Number(task.x);
    const ty = Number(task.y);
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return true;
    return Math.round(c.x) === Math.round(tx) && Math.round(c.y) === Math.round(ty);
  }

  function canRepath(c, task, target = null) {
    if (!task || !Number.isFinite(Number(task.x)) || !Number.isFinite(Number(task.y))) return false;
    if (typeof findPath !== 'function') return false;
    const path = findPath(c.x, c.y, task.x, task.y, target || null);
    if (!Array.isArray(path) || !path.length) return false;
    c.path = path;
    return true;
  }

  function validateTarget(c, task) {
    if (!task) return { ok: true };

    if (task.type === 'move') {
      if (!Number.isFinite(Number(task.x)) || !Number.isFinite(Number(task.y))) return { ok: false, reason: 'Movimento sem destino.' };
      return { ok: true };
    }

    if (task.type === 'sleep') {
      if (task.bedId && !objectById(task.bedId)) return { ok: false, reason: 'Cama não existe mais.' };
      return { ok: true };
    }

    if (task.type === 'gather') {
      const obj = objectById(task.objId);
      if (!obj) return { ok: false, reason: 'Recurso não existe mais.' };
      if (typeof isGatherableReady === 'function' && !isGatherableReady(obj)) return { ok: false, reason: 'Recurso não está pronto para coleta.' };
      return { ok: true, target: obj };
    }

    if (task.type === 'build') {
      const bp = objectById(task.objId);
      if (!bp || bp.type !== 'blueprint') return { ok: false, reason: 'Projeto de construção não existe mais.' };
      return { ok: true, target: bp };
    }

    if (task.type === 'mine') {
      const rock = typeof getRockAt === 'function' ? getRockAt(task.mineX, task.mineY) : null;
      if (!rock?.solid || !rock?.mineable) return { ok: false, reason: 'Rocha não está mais minerável.' };
      return { ok: true, target: rock };
    }

    if (['forge', 'research', 'cook', 'heal', 'craft'].includes(task.type)) {
      const station = objectById(task.objId);
      if (!station) return { ok: false, reason: 'Estação de trabalho não existe mais.' };
      if (task.type === 'research' && !state?.research?.current) return { ok: false, reason: 'Nenhuma pesquisa ativa.' };
      if (task.type === 'craft' && !recipeDefs?.[task.recipeKey]) return { ok: false, reason: 'Receita não existe mais.' };
      return { ok: true, target: station };
    }

    if (task.type === 'inspect' || task.type === 'loot') {
      const obj = objectById(task.objId);
      if (!obj) return { ok: false, reason: 'Objeto investigável não existe mais.' };
      return { ok: true, target: obj };
    }

    if (task.type === 'inspectPoi') {
      const poi = poiById(task.poiId);
      if (!poi) return { ok: false, reason: 'Ponto de interesse não existe mais.' };
      return { ok: true, target: poi };
    }

    if (task.type === 'combat') {
      const target = mobById(task.wolfId || task.mobId || task.targetId);
      if (!target) return { ok: false, reason: 'Ameaça não existe mais.' };
      return { ok: true, target };
    }

    return { ok: true };
  }

  function preventRemoteExecution(c, task, target) {
    if (!task || isAtTaskTile(c, task)) return true;
    if (Array.isArray(c.path) && c.path.length) return true;
    if (canRepath(c, task, target)) return true;
    cancel(c, 'Tarefa cancelada: destino inacessível.');
    return false;
  }

  function beforeColonistUpdate(c) {
    if (!state || state.isPreview || !c?.task) return;
    const task = c.task;
    const validation = validateTarget(c, task);
    if (!validation.ok) {
      cancel(c, `Tarefa cancelada: ${validation.reason}`);
      return;
    }
    preventRemoteExecution(c, task, validation.target);
  }

  function afterColonistUpdate(c, dt = 0) {
    if (!state || state.isPreview || !c?.task) return;
    const last = c._lastRuntimeTaskPos || { px: c.px, py: c.py };
    const moved = Math.hypot(Number(c.px || 0) - Number(last.px || 0), Number(c.py || 0) - Number(last.py || 0));
    c._lastRuntimeTaskPos = { px: c.px, py: c.py };

    if (!Array.isArray(c.path) || !c.path.length) {
      c._runtimeStuckSeconds = 0;
      return;
    }

    if (moved <= MIN_MOVE_DELTA_PX) c._runtimeStuckSeconds = Number(c._runtimeStuckSeconds || 0) + Math.max(0, Number(dt || 0));
    else c._runtimeStuckSeconds = 0;

    if (c._runtimeStuckSeconds >= STUCK_CANCEL_SECONDS) {
      cancel(c, 'Tarefa cancelada: colono ficou preso.');
      return;
    }

    if (c._runtimeStuckSeconds >= STUCK_REPATH_SECONDS) {
      const validation = validateTarget(c, c.task);
      if (validation.ok && canRepath(c, c.task, validation.target)) {
        c._runtimeStuckSeconds = 0;
        c.note = 'Rota recalculada';
      }
    }
  }

  function clearAllForSectorTravel() {
    for (const c of state?.colonists || []) cancel(c, 'Tarefa limpa pela troca de setor');
  }

  window.GameSystems?.registerBeforeColonistUpdate?.('runtime-task-validation', beforeColonistUpdate, { order: 5 });
  window.GameSystems?.registerAfterColonistUpdate?.('runtime-stuck-detection', afterColonistUpdate, { order: 95 });

  window.HavenfallTasks = Object.freeze({
    validateTarget,
    preventRemoteExecution,
    clearAllForSectorTravel
  });
})();