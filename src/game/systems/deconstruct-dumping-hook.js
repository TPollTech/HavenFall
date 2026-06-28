'use strict';

(() => {
  if (window.HavenfallContext?.deconstructDumpingHookInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.deconstructDumpingHookInstalled = true;

  function buildDefForObject(obj) {
    if (!obj) return null;
    if (obj.type === 'blueprint') return buildDefs?.[obj.buildType] || null;
    return Object.values(buildDefs || {}).find(def => def.type === obj.type) || null;
  }

  function objectDisplayName(obj) {
    if (!obj) return 'Objeto';
    if (obj.type === 'blueprint') return buildDefs?.[obj.buildType]?.label || 'obra pendente';
    return objectDefs?.[obj.type]?.name || buildDefForObject(obj)?.label || obj.type;
  }

  function refundFromCost(cost = {}, ratio = 0.5) {
    const refund = {};
    for (const [key, value] of Object.entries(cost || {})) {
      const amount = Math.max(0, Math.floor(Number(value || 0) * ratio));
      if (amount > 0) refund[key] = amount;
    }
    return refund;
  }

  function refundText(refund = {}) {
    const entries = Object.entries(refund);
    if (!entries.length) return 'sem material recuperado';
    return entries.map(([key, value]) => `+${value} ${typeof resourceLabel === 'function' ? resourceLabel(key) : key}`).join(', ');
  }

  function spawnRubbleFromObject(obj) {
    if (!obj || obj.type === 'rubble') return;
    state.objects.push({
      id: uid('obj'),
      type: 'rubble',
      x: obj.x,
      y: obj.y,
      amount: 1,
      sourceType: obj.type,
      reservedBy: null
    });
  }

  function handleDeconstructToRubble(c, task, tick) {
    if (task?.type !== 'deconstruct') return false;
    const obj = state?.objects?.find(o => o.id === task.objId);
    if (!obj || !obj.markedForDeconstruct) {
      c.task = null;
      c.note = 'Ocioso';
      c.work = 0;
      return true;
    }

    const def = buildDefForObject(obj);
    const work = Math.max(2, Number(def?.work || objectDefs?.[obj.type]?.work || 4) * 0.65);
    c.work += tick * (typeof workRate === 'function' ? workRate(c, 'build') : 1);
    c.note = `Desconstruindo ${objectDisplayName(obj)} ${Math.floor((c.work / work) * 100)}%`;
    if (c.work < work) return true;

    const refund = refundFromCost(def?.cost || {}, 0.5);
    if (Object.keys(refund).length && typeof addResources === 'function') addResources(refund);
    state.objects = state.objects.filter(o => o.id !== obj.id);
    spawnRubbleFromObject(obj);
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    log(`${c.name} desmontou ${objectDisplayName(obj)}. ${refundText(refund)}. Entulho gerado para descarte.`);
    c.task = null;
    c.note = 'Ocioso';
    c.work = 0;
    return true;
  }

  window.GameSystems?.registerTaskHandler('deconstruct', 'zones.deconstruct-dumping', handleDeconstructToRubble, { order: 23 });
})();
