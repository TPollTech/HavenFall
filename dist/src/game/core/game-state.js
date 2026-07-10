'use strict';

(() => {
  function selectedColonist() {
    if (!state?.colonists?.length) return null;
    const selected = state.colonists.find(c => String(c.id) === String(selectedColonistId));
    return selected || state.colonists[0] || null;
  }

  function dist(x1, y1, x2, y2) {
    const ax = Number(x1) || 0;
    const ay = Number(y1) || 0;
    const bx = Number(x2) || 0;
    const by = Number(y2) || 0;
    return Math.hypot(ax - bx, ay - by);
  }

  function ensureResources() {
    state.resources = state.resources || {};
    for (const key of ['food', 'wood', 'stone', 'metal', 'medicine', 'water']) {
      state.resources[key] = Number.isFinite(Number(state.resources[key])) ? Number(state.resources[key]) : 0;
    }
    return state.resources;
  }

  function ensureItems() {
    state.items = state.items || {};
    return state.items;
  }

  function ensureObjects() {
    state.objects = state.objects || [];
    return state.objects;
  }

  function ensureEconomyLedger() {
    state.economy = state.economy || {};
    state.economy.ledger = Array.isArray(state.economy.ledger) ? state.economy.ledger : [];
    state.economy.version = Number(state.economy.version || 0);
    return state.economy;
  }

  function invalidateObjectIndexes() {
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    if (typeof wallIndexDirty !== 'undefined') wallIndexDirty = true;
  }

  function markEconomyDirty(reason = 'economy') {
    if (!state) return;
    const economy = ensureEconomyLedger();
    economy.version += 1;
    economy.lastReason = reason;
    economy.lastChangedAt = Date.now();
    state.uiDirty = state.uiDirty || {};
    state.uiDirty.resources = true;
  }

  function cleanEntries(entries = {}) {
    const out = {};
    for (const [key, value] of Object.entries(entries || {})) {
      const n = Number(value || 0);
      if (Number.isFinite(n) && n > 0) out[key] = n;
    }
    return out;
  }

  function hasEntries(container, cost = {}) {
    return Object.entries(cleanEntries(cost)).every(([key, value]) => Number(container[key] || 0) >= value);
  }

  function recordTransaction(kind, entries = {}, options = {}) {
    const economy = ensureEconomyLedger();
    const clean = cleanEntries(entries);
    if (!Object.keys(clean).length) return;
    economy.ledger.unshift({
      id: `eco_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      kind,
      entries: clean,
      reason: options.reason || kind,
      actorId: options.actorId || null,
      targetId: options.targetId || null,
      x: Number.isFinite(Number(options.x)) ? Number(options.x) : null,
      y: Number.isFinite(Number(options.y)) ? Number(options.y) : null,
      day: state?.day || 1,
      hour: state?.hour || 0,
      at: Date.now()
    });
    economy.ledger = economy.ledger.slice(0, 120);
  }

  function addEntries(container, gain = {}, options = {}) {
    const clean = cleanEntries(gain);
    for (const [key, value] of Object.entries(clean)) container[key] = Number(container[key] || 0) + value;
    if (Object.keys(clean).length) {
      recordTransaction(options.kind || 'gain', clean, options);
      markEconomyDirty(options.reason || 'gain');
    }
    return container;
  }

  function payEntries(container, cost = {}, options = {}) {
    const clean = cleanEntries(cost);
    const hadEnough = hasEntries(container, clean);
    if (!hadEnough && options.requireEnough !== false) return false;
    for (const [key, value] of Object.entries(clean)) {
      const next = Number(container[key] || 0) - value;
      container[key] = options.clamp === false ? next : Math.max(0, next);
    }
    if (Object.keys(clean).length) {
      recordTransaction(options.kind || 'spend', clean, options);
      markEconomyDirty(options.reason || 'spend');
    }
    return hadEnough;
  }

  function resources() { return ensureResources(); }
  function hasResources(cost = {}) { return hasEntries(ensureResources(), cost); }
  function addResources(gain = {}, options = {}) { return addEntries(ensureResources(), gain, { ...options, kind: options.kind || 'resource_gain' }); }
  function payResources(cost = {}, options = {}) { return payEntries(ensureResources(), cost, { clamp: true, ...options, kind: options.kind || 'resource_spend' }); }
  function consumeResources(cost = {}, options = {}) { return payResources(cost, { ...options, reason: options.reason || 'consume', kind: options.kind || 'resource_consume' }); }
  function reserveResources(cost = {}, options = {}) { return payResources(cost, { ...options, reason: options.reason || 'reserve', kind: options.kind || 'resource_reserve' }); }
  function refundResources(cost = {}, options = {}) { return addResources(cost, { ...options, reason: options.reason || 'refund', kind: options.kind || 'resource_refund' }); }

  function items() { return ensureItems(); }
  function hasItems(cost = {}) { return hasEntries(ensureItems(), cost); }
  function addItems(gain = {}, options = {}) { return addEntries(ensureItems(), gain, { ...options, kind: options.kind || 'item_gain' }); }
  function payItems(cost = {}, options = {}) { return payEntries(ensureItems(), cost, { ...options, kind: options.kind || 'item_spend' }); }
  function reserveItems(cost = {}, options = {}) { return payItems(cost, { ...options, reason: options.reason || 'reserve', kind: options.kind || 'item_reserve' }); }
  function refundItems(cost = {}, options = {}) { return addItems(cost, { ...options, reason: options.reason || 'refund', kind: options.kind || 'item_refund' }); }

  function addRecipeOutput(output = {}, options = {}) {
    if (output.resources) addResources(output.resources, { ...options, reason: options.reason || 'recipe-output' });
    if (output.items) addItems(output.items, { ...options, reason: options.reason || 'recipe-output' });
  }

  function objects() { return ensureObjects(); }

  function addObject(obj) {
    ensureObjects().push(obj);
    invalidateObjectIndexes();
    return obj;
  }

  function getObjectById(id) { return ensureObjects().find(obj => obj?.id === id) || null; }

  function removeObjectById(id) {
    const list = ensureObjects();
    const index = list.findIndex(obj => obj?.id === id);
    if (index < 0) return null;
    const [removed] = list.splice(index, 1);
    invalidateObjectIndexes();
    return removed || null;
  }

  function replaceObjects(nextObjects = []) {
    state.objects = Array.isArray(nextObjects) ? nextObjects : [];
    invalidateObjectIndexes();
    return state.objects;
  }

  window.selectedColonist = selectedColonist;
  window.dist = window.dist || dist;
  window.distanceBetween = window.distanceBetween || dist;

  window.GameState = {
    selectedColonist,
    dist,
    resources,
    hasResources,
    addResources,
    payResources,
    consumeResources,
    reserveResources,
    refundResources,
    items,
    hasItems,
    addItems,
    payItems,
    reserveItems,
    refundItems,
    addRecipeOutput,
    objects,
    addObject,
    getObjectById,
    removeObjectById,
    replaceObjects,
    invalidateObjectIndexes,
    ensureEconomyLedger,
    markEconomyDirty
  };
})();
