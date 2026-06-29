'use strict';

(() => {
  const ticks = new Map();
  const colonistUpdateGuards = new Map();
  const beforeColonistUpdate = new Map();
  const afterColonistUpdate = new Map();
  const autoTaskProviders = new Map();
  const taskHandlers = new Map();
  const tileRenderers = new Map();
  const objectRenderers = new Map();
  const worldOverlays = new Map();
  const drawOverlays = new Map();
  const collisionProviders = new Map();
  const movementModifiers = new Map();
  const workRateModifiers = new Map();
  const installedHooks = new Set();

  const registryVersions = new WeakMap();
  const registryOrderedCache = new WeakMap();

  function registryVersion(registry) {
    return registryVersions.get(registry) || 0;
  }

  function touchRegistry(registry) {
    registryVersions.set(registry, registryVersion(registry) + 1);
    registryOrderedCache.delete(registry);
  }

  function orderedEntries(registry) {
    const version = registryVersion(registry);
    const cached = registryOrderedCache.get(registry);
    if (cached && cached.version === version) return cached.entries;

    const entries = [];
    for (const item of registry.entries()) {
      if (item[1].enabled) entries.push(item);
    }
    entries.sort((a, b) => a[1].order - b[1].order || String(a[0]).localeCompare(String(b[0])));
    registryOrderedCache.set(registry, { version, entries });
    return entries;
  }

  function register(registry, id, fn, options = {}) {
    if (!id || typeof fn !== 'function') return false;
    registry.set(id, {
      fn,
      order: Number(options.order ?? 100),
      enabled: options.enabled !== false,
      type: options.type || null
    });
    touchRegistry(registry);
    return true;
  }

  function setEnabled(registry, id, enabled) {
    const entry = registry.get(id);
    if (!entry) return false;
    const next = !!enabled;
    if (entry.enabled === next) return false;
    entry.enabled = next;
    touchRegistry(registry);
    return true;
  }

  function setRegistryEnabled(registry, matcher, enabled) {
    let changed = 0;
    const next = !!enabled;
    const test = typeof matcher === 'function'
      ? matcher
      : (id, entry) => String(id) === String(matcher) || String(entry.type || '') === String(matcher);
    for (const [id, entry] of registry.entries()) {
      if (!test(id, entry) || entry.enabled === next) continue;
      entry.enabled = next;
      changed++;
    }
    if (changed) touchRegistry(registry);
    return changed;
  }

  function registerTick(id, fn, options = {}) {
    return register(ticks, id, fn, options);
  }

  function unregisterTick(id) {
    const removed = ticks.delete(id);
    if (removed) touchRegistry(ticks);
    return removed;
  }

  function hasTick(id) {
    return ticks.has(id);
  }

  function setTickEnabled(id, enabled) {
    return setEnabled(ticks, id, enabled);
  }

  function tick(dt, safeTick = null) {
    for (const [id, entry] of orderedEntries(ticks)) {
      if (typeof safeTick === 'function') safeTick(id, () => entry.fn(dt));
      else entry.fn(dt);
    }
  }

  function run(registry, ...args) {
    for (const [, entry] of orderedEntries(registry)) entry.fn(...args);
  }

  function runFirst(registry, ...args) {
    for (const [, entry] of orderedEntries(registry)) {
      if (entry.fn(...args)) return true;
    }
    return false;
  }

  function registerColonistUpdateGuard(id, fn, options = {}) {
    return register(colonistUpdateGuards, id, fn, options);
  }

  function runColonistUpdateGuards(c, dt) {
    return runFirst(colonistUpdateGuards, c, dt);
  }

  function registerBeforeColonistUpdate(id, fn, options = {}) {
    return register(beforeColonistUpdate, id, fn, options);
  }

  function runBeforeColonistUpdate(c, dt) {
    run(beforeColonistUpdate, c, dt);
  }

  function registerAfterColonistUpdate(id, fn, options = {}) {
    return register(afterColonistUpdate, id, fn, options);
  }

  function runAfterColonistUpdate(c, dt) {
    run(afterColonistUpdate, c, dt);
  }

  function registerAutoTaskProvider(id, fn, options = {}) {
    return register(autoTaskProviders, id, fn, options);
  }

  function assignAutoTask(c) {
    return runFirst(autoTaskProviders, c);
  }

  function registerTaskHandler(taskType, id, fn, options = {}) {
    return register(taskHandlers, id, fn, { ...options, type: taskType });
  }

  function handleTask(c, task, tickValue) {
    for (const [, entry] of orderedEntries(taskHandlers)) {
      if (entry.type === task?.type && entry.fn(c, task, tickValue)) return true;
    }
    return false;
  }

  function registerDrawOverlay(id, fn, options = {}) {
    return register(drawOverlays, id, fn, options);
  }

  function setDrawOverlayEnabled(id, enabled) {
    return setEnabled(drawOverlays, id, enabled);
  }

  function drawRegisteredOverlays() {
    run(drawOverlays);
  }

  function registerTileRenderer(id, fn, options = {}) {
    return register(tileRenderers, id, fn, options);
  }

  function setTileRendererEnabled(id, enabled) {
    return setEnabled(tileRenderers, id, enabled);
  }

  function drawTileRenderers(x, y, type) {
    run(tileRenderers, x, y, type);
  }

  function registerObjectRenderer(id, fn, options = {}) {
    return register(objectRenderers, id, fn, options);
  }

  function setObjectRendererEnabled(id, enabled) {
    return setEnabled(objectRenderers, id, enabled);
  }

  function drawObject(obj) {
    return runFirst(objectRenderers, obj);
  }

  function registerWorldOverlay(id, fn, options = {}) {
    return register(worldOverlays, id, fn, options);
  }

  function setWorldOverlayEnabled(id, enabled) {
    return setEnabled(worldOverlays, id, enabled);
  }

  function drawWorldOverlays(bounds = null) {
    run(worldOverlays, bounds);
  }

  function registerCollisionProvider(id, fn, options = {}) {
    return register(collisionProviders, id, fn, options);
  }

  function collisionAt(x, y, target = null) {
    for (const [, entry] of orderedEntries(collisionProviders)) {
      const result = entry.fn(x, y, target);
      if (result !== undefined && result !== null) return result;
    }
    return null;
  }

  function isCollisionBlocked(collision) {
    if (collision === null || collision === undefined) return false;
    if (typeof collision === 'object') return !!collision.blocks;
    return collision === 1 || collision === 3 || collision === 4 || collision === 5;
  }

  function pathBlocked(x, y, target = null) {
    const collision = collisionAt(x, y, target);
    return collision === null ? null : isCollisionBlocked(collision);
  }

  function registerMovementModifier(id, fn, options = {}) {
    return register(movementModifiers, id, fn, options);
  }

  function movementMultiplier(c) {
    let multiplier = 1;
    for (const [, entry] of orderedEntries(movementModifiers)) {
      const next = entry.fn(c, multiplier);
      if (Number.isFinite(next)) multiplier = next;
    }
    return multiplier;
  }

  function registerWorkRateModifier(id, fn, options = {}) {
    return register(workRateModifiers, id, fn, options);
  }

  function applyWorkRateModifiers(rate, c, kind, target = null) {
    let nextRate = rate;
    for (const [, entry] of orderedEntries(workRateModifiers)) {
      const next = entry.fn(nextRate, c, kind, target);
      if (Number.isFinite(next)) nextRate = next;
    }
    return nextRate;
  }

  function installHook(id, installer) {
    if (!id || installedHooks.has(id) || typeof installer !== 'function') return false;
    installer();
    installedHooks.add(id);
    return true;
  }

  window.GameSystems = {
    registerTick,
    unregisterTick,
    hasTick,
    setTickEnabled,
    tick,
    registerColonistUpdateGuard,
    runColonistUpdateGuards,
    registerBeforeColonistUpdate,
    runBeforeColonistUpdate,
    registerAfterColonistUpdate,
    runAfterColonistUpdate,
    registerAutoTaskProvider,
    assignAutoTask,
    registerTaskHandler,
    handleTask,
    registerDrawOverlay,
    setDrawOverlayEnabled,
    drawRegisteredOverlays,
    registerTileRenderer,
    setTileRendererEnabled,
    drawTileRenderers,
    registerObjectRenderer,
    setObjectRendererEnabled,
    drawObject,
    registerWorldOverlay,
    setWorldOverlayEnabled,
    drawWorldOverlays,
    registerCollisionProvider,
    collisionAt,
    isCollisionBlocked,
    pathBlocked,
    registerMovementModifier,
    movementMultiplier,
    registerWorkRateModifier,
    applyWorkRateModifiers,
    setRegistryEnabled,
    installHook,
    installedHooks
  };
})();