'use strict';

(() => {
  const ticks = new Map();
  const colonistUpdateGuards = new Map();
  const beforeColonistUpdate = new Map();
  const afterColonistUpdate = new Map();
  const autoTaskProviders = new Map();
  const taskHandlers = new Map();
  const drawOverlays = new Map();
  const movementModifiers = new Map();
  const workRateModifiers = new Map();
  const installedHooks = new Set();

  function orderedEntries(registry) {
    return [...registry.entries()]
      .filter(([, entry]) => entry.enabled)
      .sort((a, b) => a[1].order - b[1].order || String(a[0]).localeCompare(String(b[0])));
  }

  function register(registry, id, fn, options = {}) {
    if (!id || typeof fn !== 'function') return false;
    registry.set(id, {
      fn,
      order: Number(options.order ?? 100),
      enabled: options.enabled !== false,
      type: options.type || null
    });
    return true;
  }

  function registerTick(id, fn, options = {}) {
    return register(ticks, id, fn, options);
  }

  function unregisterTick(id) {
    return ticks.delete(id);
  }

  function hasTick(id) {
    return ticks.has(id);
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

  function drawRegisteredOverlays() {
    run(drawOverlays);
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
    drawRegisteredOverlays,
    registerMovementModifier,
    movementMultiplier,
    registerWorkRateModifier,
    applyWorkRateModifiers,
    installHook,
    installedHooks
  };
})();
