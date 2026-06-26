'use strict';

(() => {
  let runtimeIdCounter = 0;

  function uid(prefix = 'ent') {
    runtimeIdCounter += 1;
    const seed = state?.config?.seed || 'runtime';
    const day = state?.day || 0;
    const hour = Math.floor(Number(state?.hour || 0) * 100);
    const randomPart = Math.random().toString(36).slice(2, 7);
    return `${prefix}_${day}_${hour}_${runtimeIdCounter}_${randomPart}_${hashSeed(`${seed}|${runtimeIdCounter}|${randomPart}`).toString(36)}`;
  }

  function ensureEntityId(entity, prefix = 'ent') {
    if (!entity || typeof entity !== 'object') return null;
    if (!entity.id) entity.id = uid(prefix);
    if (!entity.uid) entity.uid = entity.id;
    return entity.id;
  }

  window.uid = uid;
  window.ensureEntityId = ensureEntityId;
})();
