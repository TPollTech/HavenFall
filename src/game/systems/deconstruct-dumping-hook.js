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

  function dominantMaterial(obj, def = null) {
    if (obj?.wallMaterial) return obj.wallMaterial;
    if (obj?.material) return obj.material;
    if (def?.wallMaterial) return def.wallMaterial;
    if (def?.material) return def.material;

    const cost = def?.cost || {};
    const wood = Number(cost.wood || 0);
    const stone = Number(cost.stone || 0);
    const metal = Number(cost.metal || 0);

    if (wood >= stone && wood >= metal && wood > 0) return 'wood';
    if (stone >= wood && stone >= metal && stone > 0) return 'stone';
    if (metal >= wood && metal >= stone && metal > 0) return 'metal';

    if (['wall', 'door', 'bed', 'crate'].includes(obj?.type)) return 'wood';
    return 'debris';
  }

  function looseResidueFromObject(obj, def = null) {
    const material = dominantMaterial(obj, def);
    const cost = def?.cost || {};

    if (material === 'wood') {
      return {
        id: uid('obj'),
        type: 'logs',
        x: obj.x,
        y: obj.y,
        amount: Math.max(1, Math.min(3, Math.floor(Number(cost.wood || 4) * 0.25))),
        sourceType: obj.type,
        sourceMaterial: 'wood',
        reservedBy: null
      };
    }

    if (material === 'stone' || material === 'metal') {
      return {
        id: uid('obj'),
        type: 'rubble',
        x: obj.x,
        y: obj.y,
        amount: 1,
        sourceType: obj.type,
        sourceMaterial: material,
        reservedBy: null
      };
    }

    return null;
  }

  function spawnResidueFromObject(obj, def = null) {
    if (!obj || obj.type === 'rubble' || obj.type === 'logs') return null;
    const residue = looseResidueFromObject(obj, def);
    if (!residue) return null;
    state.objects.push(residue);
    return residue;
  }

  function residueText(residue) {
    if (!residue) return 'Nenhum resíduo foi gerado.';
    if (residue.type === 'logs') return 'Sobras de madeira ficaram no local.';
    if (residue.sourceMaterial === 'metal') return 'Sucata metálica ficou para descarte.';
    return 'Entulho ficou para descarte.';
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
    window.HavenfallWorkFeedback?.notifyComplete?.('deconstruct', { objectType: obj.type, refund }, obj.x, obj.y);
    state.objects = state.objects.filter(o => o.id !== obj.id);
    const residue = spawnResidueFromObject(obj, def);
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    log(`${c.name} desmontou ${objectDisplayName(obj)}. ${refundText(refund)}. ${residueText(residue)}`);
    c.task = null;
    c.note = 'Ocioso';
    c.work = 0;
    return true;
  }

  window.GameSystems?.registerTaskHandler('deconstruct', 'zones.deconstruct-dumping', handleDeconstructToRubble, { order: 23 });
})();
