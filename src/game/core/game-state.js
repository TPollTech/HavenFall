'use strict';

(() => {
  function ensureResources() {
    state.resources = state.resources || {};
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

  function invalidateObjectIndexes() {
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    if (typeof wallIndexDirty !== 'undefined') wallIndexDirty = true;
  }

  function hasEntries(container, cost = {}) {
    return Object.entries(cost || {}).every(([key, value]) => (container[key] || 0) >= value);
  }

  function addEntries(container, gain = {}) {
    for (const [key, value] of Object.entries(gain || {})) {
      container[key] = (container[key] || 0) + value;
    }
    return container;
  }

  function payEntries(container, cost = {}, options = {}) {
    const hadEnough = hasEntries(container, cost);
    for (const [key, value] of Object.entries(cost || {})) {
      const next = (container[key] || 0) - value;
      container[key] = options.clamp === false ? next : Math.max(0, next);
    }
    return hadEnough;
  }

  function resources() {
    return ensureResources();
  }

  function hasResources(cost = {}) {
    return hasEntries(ensureResources(), cost);
  }

  function addResources(gain = {}) {
    return addEntries(ensureResources(), gain);
  }

  function payResources(cost = {}) {
    return payEntries(ensureResources(), cost, { clamp: false });
  }

  function items() {
    return ensureItems();
  }

  function hasItems(cost = {}) {
    return hasEntries(ensureItems(), cost);
  }

  function addItems(gain = {}) {
    return addEntries(ensureItems(), gain);
  }

  function payItems(cost = {}) {
    return payEntries(ensureItems(), cost);
  }

  function addRecipeOutput(output = {}) {
    if (output.resources) addResources(output.resources);
    if (output.items) addItems(output.items);
  }

  function objects() {
    return ensureObjects();
  }

  function addObject(obj) {
    ensureObjects().push(obj);
    invalidateObjectIndexes();
    return obj;
  }

  function getObjectById(id) {
    return ensureObjects().find(obj => obj?.id === id) || null;
  }

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

  window.GameState = {
    resources,
    hasResources,
    addResources,
    payResources,
    items,
    hasItems,
    addItems,
    payItems,
    addRecipeOutput,
    objects,
    addObject,
    getObjectById,
    removeObjectById,
    replaceObjects,
    invalidateObjectIndexes
  };
})();
