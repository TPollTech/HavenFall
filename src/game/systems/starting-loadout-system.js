'use strict';

(() => {
  window.HavenfallContext = window.HavenfallContext || {};
  if (window.HavenfallContext.startingLoadoutSystemInstalled) return;
  window.HavenfallContext.startingLoadoutSystemInstalled = true;

  const STARTING_LOADOUT = Object.freeze({
    COLONISTS_ONLY: 'colonists_only'
  });

  const LEGACY_STARTING_TYPES = new Set(['campfire', 'crate', 'logs']);
  const STARTING_LOGS_CLEANUP_RADIUS = 3.25;

  function loadoutMode(config = null) {
    return config?.startingLoadout || window.HavenfallStartingLoadout?.mode || STARTING_LOADOUT.COLONISTS_ONLY;
  }

  function shouldSkipStartingCamp(config = null) {
    return loadoutMode(config) === STARTING_LOADOUT.COLONISTS_ONLY;
  }

  function sameTile(obj, x, y) {
    return Math.round(Number(obj?.x) || 0) === Math.round(Number(x) || 0)
      && Math.round(Number(obj?.y) || 0) === Math.round(Number(y) || 0);
  }

  function distanceToSpawn(obj, spawn) {
    if (!obj || !spawn) return Infinity;
    return Math.hypot((Number(obj.x) || 0) - (Number(spawn.x) || 0), (Number(obj.y) || 0) - (Number(spawn.y) || 0));
  }

  function isLegacyStartingCampObject(obj, spawn) {
    if (!obj || !spawn || !LEGACY_STARTING_TYPES.has(obj.type)) return false;
    if (obj.startingCamp === true || obj.systemSpawnedStartingCamp === true) return true;
    if (obj.type === 'campfire') return sameTile(obj, spawn.x, spawn.y);
    if (obj.type === 'crate') return sameTile(obj, spawn.x + 2, spawn.y);
    if (obj.type === 'logs') return distanceToSpawn(obj, spawn) <= STARTING_LOGS_CLEANUP_RADIUS;
    return false;
  }

  function syncStateObjects(gameState, objects) {
    if (!gameState || !Array.isArray(objects)) return;
    gameState.objects = objects;
    if (gameState.world) gameState.world.objects = objects;
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
  }

  function clearTasksForRemovedObjects(gameState, removedIds) {
    if (!gameState || !(removedIds instanceof Set) || !removedIds.size) return;
    for (const colonist of gameState.colonists || []) {
      if (!colonist?.task?.objId || !removedIds.has(colonist.task.objId)) continue;
      colonist.task = null;
      colonist.path = [];
      colonist.work = 0;
      colonist.note = 'Ocioso';
    }
  }

  function sanitizeWorld(world, config = null) {
    if (!world || !Array.isArray(world.objects) || !shouldSkipStartingCamp(config)) {
      return { removedCount: 0, removedIds: new Set() };
    }

    if (world.startingLoadoutCleanupApplied === true) {
      return { removedCount: 0, removedIds: new Set() };
    }

    const spawn = world.spawn;
    const removedIds = new Set();
    const nextObjects = world.objects.filter(obj => {
      const remove = isLegacyStartingCampObject(obj, spawn);
      if (remove && obj?.id) removedIds.add(obj.id);
      return !remove;
    });

    const removedCount = world.objects.length - nextObjects.length;
    world.objects = nextObjects;
    world.startingLoadoutCleanupApplied = true;
    world.startingLoadoutMode = STARTING_LOADOUT.COLONISTS_ONLY;

    if (removedCount > 0) {
      world.validationReport = {
        ...(world.validationReport || {}),
        fixes: [
          ...((world.validationReport?.fixes || []).slice(0, 36)),
          `Carga inicial colonists_only removeu ${removedCount} objeto(s) legado(s) do acampamento inicial.`
        ]
      };
      if (typeof console?.log === 'function') {
        console.log(`[StartingLoadout] ${removedCount} objeto(s) legado(s) do acampamento inicial removido(s).`);
      }
    }

    return { removedCount, removedIds };
  }

  function sanitizeState(gameState = null, config = null) {
    const targetState = gameState || (typeof state !== 'undefined' ? state : null);
    if (!targetState?.world) return 0;

    const result = sanitizeWorld(targetState.world, config || targetState.config || null);
    if (result.removedCount > 0) {
      syncStateObjects(targetState, targetState.world.objects);
      clearTasksForRemovedObjects(targetState, result.removedIds);
    } else if (Array.isArray(targetState.world.objects) && targetState.objects !== targetState.world.objects) {
      syncStateObjects(targetState, targetState.world.objects);
    }
    return result.removedCount;
  }

  function applyStartingLoadoutPolicy() {
    const originalPlaceStartingCamp = typeof placeStartingCamp === 'function' ? placeStartingCamp : null;
    const originalGenerateWorldFromSeed = typeof generateWorldFromSeed === 'function' ? generateWorldFromSeed : null;
    const originalCreateInitialState = typeof createInitialState === 'function' ? createInitialState : null;
    const originalLoadGame = typeof loadGame === 'function' ? loadGame : null;

    window.HavenfallStartingLoadout = Object.freeze({
      STARTING_LOADOUT,
      mode: STARTING_LOADOUT.COLONISTS_ONLY,
      version: 'starting-loadout-colonists-only-cleanup-v2',
      shouldSkipStartingCamp,
      sanitizeWorld,
      sanitizeState,
      originalPlaceStartingCamp,
      originalGenerateWorldFromSeed,
      originalCreateInitialState,
      originalLoadGame
    });

    if (originalPlaceStartingCamp) {
      placeStartingCamp = function placeStartingCampColonistsOnly(ctx = {}) {
        if (shouldSkipStartingCamp(ctx.config)) return [];
        return originalPlaceStartingCamp(ctx);
      };
      window.placeStartingCamp = placeStartingCamp;
    }

    if (originalGenerateWorldFromSeed && !window.HavenfallContext.startingLoadoutWorldgenPatched) {
      generateWorldFromSeed = function generateWorldFromSeedWithStartingLoadoutPolicy(config = {}) {
        const world = originalGenerateWorldFromSeed(config);
        sanitizeWorld(world, config);
        return world;
      };
      window.generateWorldFromSeed = generateWorldFromSeed;
      window.HavenfallContext.startingLoadoutWorldgenPatched = true;
    }

    if (originalCreateInitialState && !window.HavenfallContext.startingLoadoutStatePatched) {
      createInitialState = function createInitialStateWithStartingLoadoutPolicy(config = defaultNewGameConfig, selectedColonists = null) {
        const nextState = originalCreateInitialState(config, selectedColonists);
        sanitizeState(nextState, config);
        return nextState;
      };
      window.createInitialState = createInitialState;
      window.HavenfallContext.startingLoadoutStatePatched = true;
    }

    if (originalLoadGame && !window.HavenfallContext.startingLoadoutLoadPatched) {
      loadGame = function loadGameWithStartingLoadoutPolicy(...args) {
        const loaded = originalLoadGame.apply(this, args);
        if (loaded) sanitizeState(typeof state !== 'undefined' ? state : null);
        return loaded;
      };
      window.loadGame = loadGame;
      window.HavenfallContext.startingLoadoutLoadPatched = true;
    }
  }

  applyStartingLoadoutPolicy();
})();
