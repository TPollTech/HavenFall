'use strict';

(() => {
  if (window.HavenfallContext?.runtimeStateInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.runtimeStateInstalled = true;

  function clampNumber(value, min, max, fallback = min) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function ensureObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function entityId(entity, prefix, index = 0) {
    if (!entity || typeof entity !== 'object') return null;
    if (typeof ensureEntityId === 'function') return ensureEntityId(entity, prefix);
    entity.id = entity.id || `${prefix}_${index}_${Date.now()}`;
    entity.uid = entity.uid || entity.id;
    return entity.id;
  }

  function normalizeEntityList(list, prefix) {
    const values = ensureArray(list);
    for (let i = 0; i < values.length; i++) entityId(values[i], prefix, i);
    return values;
  }

  function normalizePawnPosition(pawn) {
    if (!pawn || typeof pawn !== 'object') return pawn;
    pawn.x = Math.round(Number.isFinite(Number(pawn.x)) ? Number(pawn.x) : 0);
    pawn.y = Math.round(Number.isFinite(Number(pawn.y)) ? Number(pawn.y) : 0);
    pawn.px = Number.isFinite(Number(pawn.px)) ? Number(pawn.px) : pawn.x * TILE + TILE / 2;
    pawn.py = Number.isFinite(Number(pawn.py)) ? Number(pawn.py) : pawn.y * TILE + TILE / 2;
    pawn.path = ensureArray(pawn.path);
    pawn.work = Number.isFinite(Number(pawn.work)) ? Number(pawn.work) : 0;
    if (!pawn.note) pawn.note = pawn.task ? 'Executando tarefa' : 'Ocioso';
    return pawn;
  }

  function ensureResourceShape(target) {
    target.resources = ensureObject(target.resources);
    for (const key of ['food', 'wood', 'stone', 'metal', 'medicine', 'water']) {
      target.resources[key] = Number.isFinite(Number(target.resources[key])) ? Number(target.resources[key]) : 0;
    }
    target.items = ensureObject(target.items);
    for (const key of ['rope', 'nails', 'cloth', 'leather', 'arrows']) {
      target.items[key] = Number.isFinite(Number(target.items[key])) ? Number(target.items[key]) : 0;
    }
  }

  function syncWorldObjectRefs(target = state) {
    if (!target) return null;
    target.world = ensureObject(target.world);
    if (Array.isArray(target.objects)) {
      target.world.objects = target.objects;
    } else if (Array.isArray(target.world.objects)) {
      target.objects = target.world.objects;
    } else {
      target.objects = [];
      target.world.objects = target.objects;
    }
    if (Array.isArray(target.terrain)) {
      target.world.terrain = target.terrain;
    } else if (Array.isArray(target.world.terrain)) {
      target.terrain = target.world.terrain;
    }
    return target.objects;
  }

  function normalizeWorld(target = state) {
    if (!target) return null;
    target.config = { ...(typeof defaultNewGameConfig !== 'undefined' ? defaultNewGameConfig : {}), ...(target.config || {}) };
    target.world = ensureObject(target.world);
    const cols = target.world.cols || target.terrain?.[0]?.length || (typeof getMapSizeDef === 'function' ? getMapSizeDef(target.config.mapSize)?.cols : null) || MAP_SIZES.standard.cols;
    const rows = target.world.rows || target.terrain?.length || (typeof getMapSizeDef === 'function' ? getMapSizeDef(target.config.mapSize)?.rows : null) || MAP_SIZES.standard.rows;
    const terrain = Array.isArray(target.terrain) ? target.terrain : Array.isArray(target.world.terrain) ? target.world.terrain : Array.from({ length: rows }, () => Array.from({ length: cols }, () => 'grass'));

    target.world.seed = target.world.seed || target.config.seed || 'havenfall';
    target.world.mapSize = target.world.mapSize || target.config.mapSize || 'standard';
    target.world.difficulty = target.world.difficulty || target.config.difficulty || 'normal';
    target.world.cols = cols;
    target.world.rows = rows;
    target.world.tileSize = target.world.tileSize || TILE;
    target.world.width = cols * target.world.tileSize;
    target.world.height = rows * target.world.tileSize;
    target.world.terrain = terrain;
    target.terrain = terrain;
    target.world.spawn = target.world.spawn || { x: Math.floor(cols / 2), y: Math.floor(rows / 2) };
    target.world.spawnPoints = ensureArray(target.world.spawnPoints).length ? target.world.spawnPoints : [target.world.spawn];
    target.world.pointsOfInterest = ensureArray(target.world.pointsOfInterest);
    target.world.visibleTiles = ensureArray(target.world.visibleTiles);
    if (!Array.isArray(target.world.exploration) && typeof makeExplorationMatrix === 'function') {
      target.world.exploration = makeExplorationMatrix(cols, rows);
    }
    syncWorldObjectRefs(target);
    return target.world;
  }

  function normalizeRuntimeState(target = state, options = {}) {
    if (!target || typeof target !== 'object') return target;
    ensureResourceShape(target);
    normalizeWorld(target);
    target.objects = normalizeEntityList(target.objects, 'obj');
    if (target.world) target.world.objects = target.objects;
    target.colonists = normalizeEntityList(target.colonists, 'colonist').map(normalizePawnPosition);
    target.mobs = normalizeEntityList(target.mobs, 'mob').map(normalizePawnPosition);
    target.wolves = normalizeEntityList(target.wolves, 'wolf').map(normalizePawnPosition);
    target.visitors = normalizeEntityList(target.visitors, 'visitor').map(normalizePawnPosition);
    target.day = Math.max(1, Math.floor(Number(target.day || 1)));
    target.hour = clampNumber(target.hour, 0, 23.999, 8);
    target.speed = clampNumber(target.speed, 0, 3, 1) || 1;
    target.weather = target.weather || 'limpo';
    target.weatherTime = Math.max(0, Number(target.weatherTime || 0));
    target.taskPriorities = ensureObject(target.taskPriorities);
    target.ui = ensureObject(target.ui);
    target.uiDirty = ensureObject(target.uiDirty);
    target.pathVersion = Number.isFinite(Number(target.pathVersion)) ? Number(target.pathVersion) : 1;
    target.runtimeMode = options.preview ? 'menu-preview' : target.runtimeMode || 'gameplay';
    target.isPreview = options.preview === true ? true : target.runtimeMode === 'menu-preview' ? true : !!target.isPreview;

    if (typeof selectedColonistId !== 'undefined' && target.colonists?.length && !target.colonists.some(c => String(c.id) === String(selectedColonistId))) {
      selectedColonistId = target.colonists[0].id;
    }
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    if (typeof wallIndexDirty !== 'undefined') wallIndexDirty = true;
    return target;
  }

  function markPreviewState(target = state) {
    if (!target) return target;
    target.isPreview = true;
    target.runtimeMode = 'menu-preview';
    target.activeTravel = null;
    target.worldMap = null;
    target.sectors = null;
    normalizeRuntimeState(target, { preview: true });
    return target;
  }

  function markGameplayState(target = state) {
    if (!target) return target;
    target.isPreview = false;
    target.runtimeMode = 'gameplay';
    normalizeRuntimeState(target, { preview: false });
    return target;
  }

  function isGameplayState(target = state) {
    return !!target && target.runtimeMode === 'gameplay' && target.isPreview !== true;
  }

  function cancelColonistTask(colonist, reason = 'Ocioso') {
    if (!colonist) return false;
    colonist.task = null;
    colonist.path = [];
    colonist.work = 0;
    colonist.sleeping = false;
    colonist.reservedTargetId = null;
    colonist.reservationId = null;
    colonist.note = reason;
    return true;
  }

  function clearAllColonistTasks(reason = 'Tarefas reiniciadas') {
    for (const colonist of state?.colonists || []) cancelColonistTask(colonist, reason);
  }

  function bumpPathVersion(target = state, reason = 'world-change') {
    if (!target) return 0;
    target.pathVersion = (Number(target.pathVersion || 0) + 1) || 1;
    target.lastPathVersionReason = reason;
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    if (typeof wallIndexDirty !== 'undefined') wallIndexDirty = true;
    return target.pathVersion;
  }

  function installStartLifecycle() {
    if (typeof startNewGame !== 'function' || window.HavenfallContext.runtimeStartLifecycleInstalled) return;
    const nativeStartNewGame = startNewGame;
    startNewGame = function startNewGameWithRuntimeLifecycle(config, selectedColonists) {
      const result = nativeStartNewGame(config, selectedColonists);
      if (state) {
        markGameplayState(state);
        bumpPathVersion(state, 'new-game');
      }
      return result;
    };
    window.HavenfallContext.runtimeStartLifecycleInstalled = true;
  }

  window.HavenfallRuntime = Object.freeze({
    normalizeRuntimeState,
    normalizeState: normalizeRuntimeState,
    normalizeWorld,
    syncWorldObjectRefs,
    markPreviewState,
    markGameplayState,
    isGameplayState,
    cancelColonistTask,
    clearAllColonistTasks,
    bumpPathVersion,
    installStartLifecycle
  });

  window.cancelColonistTask = window.cancelColonistTask || cancelColonistTask;
  window.normalizeRuntimeState = window.normalizeRuntimeState || normalizeRuntimeState;
  installStartLifecycle();
})();