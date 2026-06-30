'use strict';

(() => {
  if (window.HavenfallContext?.runtimeTasksInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.runtimeTasksInstalled = true;

  const STUCK_REPATH_SECONDS = 3.0;
  const STUCK_CANCEL_SECONDS = 8.0;
  const MIN_MOVE_DELTA_PX = 0.35;
  const TASK_VALIDATION_MS = 420;
  const TASK_REPATH_MS = 850;
  const FAILED_TASK_COOLDOWN_MS = 18000;
  const MAX_FAILED_TASK_MEMORY = 24;

  function nowMs() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  function taskSignature(task) {
    if (!task) return '';
    return [task.type, task.objId, task.poiId, task.wolfId, task.mobId, task.targetId, task.recipeKey, task.x, task.y, task.mineX, task.mineY].join('|');
  }

  function ensureFailedTaskMemory(c) {
    if (!c._failedRuntimeTasks || typeof c._failedRuntimeTasks !== 'object') c._failedRuntimeTasks = {};
    const keys = Object.keys(c._failedRuntimeTasks);
    if (keys.length > MAX_FAILED_TASK_MEMORY) {
      keys
        .sort((a, b) => Number(c._failedRuntimeTasks[a]?.until || 0) - Number(c._failedRuntimeTasks[b]?.until || 0))
        .slice(0, keys.length - MAX_FAILED_TASK_MEMORY)
        .forEach(key => delete c._failedRuntimeTasks[key]);
    }
    return c._failedRuntimeTasks;
  }

  function rememberFailedTask(c, task, reason) {
    if (!c || !task) return;
    const signature = taskSignature(task);
    if (!signature) return;
    const memory = ensureFailedTaskMemory(c);
    memory[signature] = {
      until: nowMs() + FAILED_TASK_COOLDOWN_MS,
      reason: reason || 'falha de tarefa'
    };
  }

  function isTaskTemporarilyBlocked(c, task) {
    if (!c || !task) return false;
    const memory = ensureFailedTaskMemory(c);
    const signature = taskSignature(task);
    const entry = memory[signature];
    if (!entry) return false;
    if (Number(entry.until || 0) <= nowMs()) {
      delete memory[signature];
      return false;
    }
    return entry;
  }

  function cancel(c, reason, task = c?.task) {
    if (task && reason) rememberFailedTask(c, task, reason);
    if (window.HavenfallRuntime?.cancelColonistTask) return window.HavenfallRuntime.cancelColonistTask(c, reason);
    c.task = null;
    c.path = [];
    c.work = 0;
    c.note = reason || 'Ocioso';
    return true;
  }

  function shortFailureReason(reason) {
    return String(reason || 'Tarefa falhou.')
      .replace(/^Tarefa cancelada:\s*/i, '')
      .replace(/\.$/, '');
  }

  function logTaskFailure(c, reason) {
    const now = nowMs();
    const mayLog = Number(c._nextTaskFailureLogAt || 0) <= now;
    if (mayLog) {
      c._nextTaskFailureLogAt = now + 4500;
      if (typeof log === 'function') log(`${c.name || 'Colono'}: ${reason}`);
    }
    window.HavenfallWorkFeedback?.notifyProblem?.(shortFailureReason(reason), c, { kind: 'warning' });
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

  function canRepath(c, task, target = null, force = false) {
    if (!task || !Number.isFinite(Number(task.x)) || !Number.isFinite(Number(task.y))) return false;
    if (typeof findPath !== 'function') return false;
    const now = nowMs();
    if (!force && Number(c._nextRuntimeRepathAt || 0) > now) return false;
    c._nextRuntimeRepathAt = now + TASK_REPATH_MS;
    const path = findPath(c.x, c.y, task.x, task.y, target || null);
    if (!Array.isArray(path) || !path.length) return false;
    c.path = path;
    return true;
  }

  function validateTarget(c, task) {
    if (!task) return { ok: true };

    const blocked = isTaskTemporarilyBlocked(c, task);
    if (blocked) return { ok: false, reason: blocked.reason || 'Tarefa pausada temporariamente após falha.' };

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
    if (Number(c._runtimeNoPathSince || 0) <= 0) c._runtimeNoPathSince = nowMs();
    if (nowMs() - c._runtimeNoPathSince > 2400) {
      const reason = 'Tarefa cancelada: destino inacessível.';
      logTaskFailure(c, reason);
      cancel(c, reason, task);
      return false;
    }
    return true;
  }

  function shouldValidateTask(c, task) {
    const now = nowMs();
    const signature = taskSignature(task);
    if (c._runtimeTaskSignature !== signature) {
      c._runtimeTaskSignature = signature;
      c._nextRuntimeValidationAt = now + TASK_VALIDATION_MS;
      c._runtimeNoPathSince = 0;
      return true;
    }
    if (Number(c._nextRuntimeValidationAt || 0) > now) return false;
    c._nextRuntimeValidationAt = now + TASK_VALIDATION_MS;
    return true;
  }

  function beforeColonistUpdate(c) {
    if (!state || state.isPreview || !c?.task) return;
    const task = c.task;
    if (!shouldValidateTask(c, task)) return;
    const validation = validateTarget(c, task);
    if (!validation.ok) {
      const reason = `Tarefa cancelada: ${validation.reason}`;
      logTaskFailure(c, reason);
      cancel(c, reason, task);
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
      const reason = 'Tarefa cancelada: colono ficou preso.';
      logTaskFailure(c, reason);
      cancel(c, reason, c.task);
      return;
    }

    if (c._runtimeStuckSeconds >= STUCK_REPATH_SECONDS) {
      const validation = validateTarget(c, c.task);
      if (validation.ok && canRepath(c, c.task, validation.target, true)) {
        c._runtimeStuckSeconds = 0;
        c.note = 'Rota recalculada';
      }
    }
  }

  function clearAllForSectorTravel() {
    for (const c of state?.colonists || []) cancel(c, 'Tarefa limpa pela troca de setor', c.task);
  }

  window.GameSystems?.registerBeforeColonistUpdate?.('runtime-task-validation', beforeColonistUpdate, { order: 5 });
  window.GameSystems?.registerAfterColonistUpdate?.('runtime-stuck-detection', afterColonistUpdate, { order: 95 });

  window.HavenfallTasks = Object.freeze({
    validateTarget,
    preventRemoteExecution,
    rememberFailedTask,
    isTaskTemporarilyBlocked,
    clearAllForSectorTravel
  });
})();
