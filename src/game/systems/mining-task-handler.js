'use strict';

(() => {
  function resetMiningTask(c, note = 'Ocioso') {
    if (!c) return;
    c.task = null;
    c.path = [];
    c.work = 0;
    c.note = note;
  }

  function miningLabel(x, y) {
    return typeof geologyLabelAt === 'function' ? geologyLabelAt(x, y) : 'rocha';
  }

  function routeToMine(c, x, y, options = {}) {
    if (typeof findReachableMiningAdjacent === 'function') {
      return findReachableMiningAdjacent(c, x, y, options);
    }

    const rock = typeof getRockAt === 'function' ? getRockAt(x, y) : null;
    const adj = typeof nearestFreeAdjacent === 'function' ? nearestFreeAdjacent(x, y, c.x, c.y) : null;
    if (!rock?.solid || !adj || typeof findPath !== 'function') return null;
    const alreadyAtWorkTile = Math.round(c.x) === Math.round(adj.x) && Math.round(c.y) === Math.round(adj.y);
    const path = alreadyAtWorkTile ? [] : findPath(c.x, c.y, adj.x, adj.y, null, { maxVisited: 6200 });
    if (!alreadyAtWorkTile && (!Array.isArray(path) || path.length === 0)) return null;
    return { rock, adj, path, alreadyAtWorkTile };
  }

  function installRouteSafeAssignMine() {
    if (window.HavenfallContext?.routeSafeAssignMineInstalled || typeof assignMine !== 'function') return;
    const nativeAssignMine = assignMine;
    assignMine = function assignMineRouteSafe(c, x, y, mark = false) {
      if (!c || typeof getRockAt !== 'function') return false;
      const rock = getRockAt(x, y);
      if (!rock?.mineable || !rock.solid) {
        if (typeof log === 'function') log('Não há rocha mineável nesse tile.');
        return false;
      }

      const access = routeToMine(c, x, y, { rememberFailure: true, ignoreCooldown: false });
      if (!access) {
        if (typeof rememberMiningTargetBlocked === 'function') rememberMiningTargetBlocked(c, x, y, 'sem caminho para mineração');
        if (typeof log === 'function' && Number(c._nextMiningPathLogAt || 0) <= (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
          c._nextMiningPathLogAt = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 4500;
          log(`${c.name} não encontrou caminho até ${miningLabel(x, y)}.`);
        }
        return false;
      }

      if (mark && typeof markRockForMining === 'function') markRockForMining(x, y, true);
      c.task = { type: 'mine', mineX: x, mineY: y, x: access.adj.x, y: access.adj.y };
      c.path = access.path || [];
      c.work = 0;
      c.note = access.alreadyAtWorkTile ? `Minerando ${miningLabel(x, y)}` : `Indo minerar ${miningLabel(x, y)}`;
      return true;
    };
    window.assignMine = assignMine;
    window.HavenfallContext.routeSafeAssignMineInstalled = true;
    window.HavenfallContext.nativeAssignMine = nativeAssignMine;
  }

  function handleMiningTask(c, task, tick) {
    if (task?.type !== 'mine') return false;

    const rock = typeof getRockAt === 'function' ? getRockAt(task.mineX, task.mineY) : null;
    if (!rock?.solid) {
      resetMiningTask(c, 'Ocioso');
      return true;
    }

    const atWorkTile = Math.round(c.x) === Math.round(task.x) && Math.round(c.y) === Math.round(task.y);
    const adjacentToRock = Math.abs(Math.round(c.x) - Math.round(task.mineX)) + Math.abs(Math.round(c.y) - Math.round(task.mineY)) === 1;
    if (!atWorkTile || !adjacentToRock) {
      const access = routeToMine(c, task.mineX, task.mineY, { rememberFailure: true, ignoreCooldown: true });
      if (access) {
        task.x = access.adj.x;
        task.y = access.adj.y;
        c.path = access.path || [];
        c.note = access.alreadyAtWorkTile ? `Minerando ${miningLabel(task.mineX, task.mineY)}` : `Indo minerar ${miningLabel(task.mineX, task.mineY)}`;
      } else {
        if (typeof rememberMiningTargetBlocked === 'function') rememberMiningTargetBlocked(c, task.mineX, task.mineY, 'sem caminho para mineração');
        resetMiningTask(c, 'Sem caminho para mineração');
      }
      return true;
    }

    const label = miningLabel(task.mineX, task.mineY);
    const rate = typeof workRate === 'function' ? workRate(c, 'gather') : 1;
    c.work += tick * rate;
    c.note = `Minerando ${label}`;

    const rockBeforeHit = { type: rock.type, resource: rock.resource, maxHp: rock.maxHp };
    const result = typeof mineRockAt === 'function'
      ? mineRockAt(task.mineX, task.mineY, tick * 12 * rate)
      : null;

    if (result?.removed) {
      const gainText = Object.entries(result.gain || {})
        .map(([k, v]) => `+${v} ${typeof resourceLabel === 'function' ? resourceLabel(k) : k}`)
        .join(', ');
      window.HavenfallWorkFeedback?.notifyComplete?.(
        rockBeforeHit.resource === 'metal' ? 'ore' : 'mine',
        { ...rockBeforeHit, gain: result.gain },
        task.mineX,
        task.mineY
      );
      if (typeof clearMiningTargetBlocked === 'function') clearMiningTargetBlocked(c, task.mineX, task.mineY);
      if (typeof log === 'function') log(`${c.name} minerou ${label}. ${gainText || 'Rocha removida'}.`);
      resetMiningTask(c, 'Ocioso');
    }

    return true;
  }

  installRouteSafeAssignMine();
  window.handleMiningTask = handleMiningTask;
  window.GameSystems?.registerTaskHandler('mine', 'geology:mining', handleMiningTask, { order: 20 });
})();
