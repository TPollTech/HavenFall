'use strict';

(() => {
  function handleMiningTask(c, task, tick) {
    if (task?.type !== 'mine') return false;

    const rock = typeof getRockAt === 'function' ? getRockAt(task.mineX, task.mineY) : null;
    if (!rock?.solid) {
      c.task = null;
      c.note = 'Ocioso';
      c.work = 0;
      return true;
    }

    const atWorkTile = c.x === task.x && c.y === task.y;
    const adjacentToRock = Math.abs(c.x - task.mineX) + Math.abs(c.y - task.mineY) === 1;
    if (!atWorkTile || !adjacentToRock) {
      const route = typeof findPath === 'function' ? findPath(c.x, c.y, task.x, task.y, rock) : [];
      if (Array.isArray(route) && route.length) {
        c.path = route;
        c.note = `Indo minerar ${typeof geologyLabelAt === 'function' ? geologyLabelAt(task.mineX, task.mineY) : 'rocha'}`;
      } else {
        c.task = null;
        c.note = 'Sem caminho para mineração';
        c.work = 0;
      }
      return true;
    }

    const label = typeof geologyLabelAt === 'function' ? geologyLabelAt(task.mineX, task.mineY) : 'rocha';
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
      if (typeof log === 'function') log(`${c.name} minerou ${label}. ${gainText || 'Rocha removida'}.`);
      c.task = null;
      c.note = 'Ocioso';
      c.work = 0;
    }

    return true;
  }

  window.handleMiningTask = handleMiningTask;
  window.GameSystems?.registerTaskHandler('mine', 'geology:mining', handleMiningTask, { order: 20 });
})();
