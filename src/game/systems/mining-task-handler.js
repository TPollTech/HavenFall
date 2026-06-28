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

    const label = typeof geologyLabelAt === 'function' ? geologyLabelAt(task.mineX, task.mineY) : 'rocha';
    const rate = typeof workRate === 'function' ? workRate(c, 'gather') : 1;
    c.work += tick * rate;
    c.note = `Minerando ${label}`;

    const result = typeof mineRockAt === 'function'
      ? mineRockAt(task.mineX, task.mineY, tick * 12 * rate)
      : null;

    if (result?.removed) {
      const gainText = Object.entries(result.gain || {})
        .map(([k, v]) => `+${v} ${typeof resourceLabel === 'function' ? resourceLabel(k) : k}`)
        .join(', ');
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
