'use strict';

(() => {
  if (window.HavenfallContext?.worldRegionSystemInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.worldRegionSystemInstalled = true;

  const REGION_SIZE = 64;
  const ACTIVE_RADIUS = 1;

  function regionKey(rx, ry) { return `${Math.round(Number(rx) || 0)},${Math.round(Number(ry) || 0)}`; }
  function parseRegionKey(key) { const parts = String(key || '0,0').split(','); return { x: Math.round(Number(parts[0]) || 0), y: Math.round(Number(parts[1]) || 0) }; }
  function regionForTile(x, y, size = REGION_SIZE) { return { x: Math.floor(Math.round(Number(x) || 0) / size), y: Math.floor(Math.round(Number(y) || 0) / size) }; }

  function ensureRegionState(world = state?.world) {
    if (!world) return null;
    world.regionSize = Number(world.regionSize || REGION_SIZE);
    world.regionMode = !!world.regionMode || !!getMapSizeDef?.(world.mapSize)?.chunkMode;
    world.regions = world.regions && typeof world.regions === 'object' ? world.regions : {};
    world.activeRegions = Array.isArray(world.activeRegions) ? world.activeRegions : [];
    world.regionSaveVersion = world.regionSaveVersion || 'region-save-v1';
    if (!Object.keys(world.regions).length) indexExistingRegions(world);
    return world.regions;
  }

  function regionBounds(rx, ry, world = state?.world) {
    const size = Number(world?.regionSize || REGION_SIZE);
    const minX = rx * size;
    const minY = ry * size;
    return { minX, minY, maxX: Math.min((world?.cols || 0) - 1, minX + size - 1), maxY: Math.min((world?.rows || 0) - 1, minY + size - 1) };
  }

  function sliceRows(layer, bounds) {
    if (!Array.isArray(layer)) return [];
    const out = [];
    for (let y = bounds.minY; y <= bounds.maxY; y++) out.push((layer[y] || []).slice(bounds.minX, bounds.maxX + 1));
    return out;
  }

  function objectsInRegion(world, bounds) {
    return (world?.objects || []).filter(obj => obj && obj.x >= bounds.minX && obj.x <= bounds.maxX && obj.y >= bounds.minY && obj.y <= bounds.maxY).map(obj => ({ ...obj }));
  }

  function snapshotRegion(rx, ry, world = state?.world) {
    if (!world) return null;
    ensureRegionState(world);
    const key = regionKey(rx, ry);
    const bounds = regionBounds(rx, ry, world);
    const snapshot = {
      key,
      x: rx,
      y: ry,
      bounds,
      seed: `${world.seed || 'seed'}|region|${key}`,
      loaded: true,
      generated: true,
      dirty: false,
      terrain: sliceRows(world.terrain, bounds),
      biomes: sliceRows(world.biomes, bounds),
      exploration: sliceRows(world.exploration, bounds),
      floorLayer: sliceRows(world.floorLayer, bounds),
      lightLayer: sliceRows(world.lightLayer, bounds),
      objects: objectsInRegion(world, bounds),
      updatedAt: Date.now()
    };
    world.regions[key] = snapshot;
    return snapshot;
  }

  function indexExistingRegions(world = state?.world) {
    if (!world) return null;
    const size = Number(world.regionSize || REGION_SIZE);
    const maxRx = Math.floor(Math.max(0, Number(world.cols || 0) - 1) / size);
    const maxRy = Math.floor(Math.max(0, Number(world.rows || 0) - 1) / size);
    world.regions = world.regions || {};
    for (let ry = 0; ry <= maxRy; ry++) for (let rx = 0; rx <= maxRx; rx++) snapshotRegion(rx, ry, world);
    world.activeRegions = Object.keys(world.regions);
    world.regionSnapshotAt = Date.now();
    return world.regions;
  }

  function activeRegionForCamera(world = state?.world) {
    const tileX = Number(camera?.x || 0) / TILE;
    const tileY = Number(camera?.y || 0) / TILE;
    return regionForTile(tileX, tileY, Number(world?.regionSize || REGION_SIZE));
  }

  function updateActiveRegions(world = state?.world) {
    if (!world) return [];
    ensureRegionState(world);
    const center = activeRegionForCamera(world);
    const keys = [];
    for (let y = center.y - ACTIVE_RADIUS; y <= center.y + ACTIVE_RADIUS; y++) {
      for (let x = center.x - ACTIVE_RADIUS; x <= center.x + ACTIVE_RADIUS; x++) {
        const bounds = regionBounds(x, y, world);
        if (bounds.maxX < 0 || bounds.maxY < 0 || bounds.minX >= world.cols || bounds.minY >= world.rows) continue;
        keys.push(regionKey(x, y));
      }
    }
    world.activeRegion = center;
    world.activeRegions = keys;
    return keys;
  }

  function snapshotActiveRegions(world = state?.world) {
    if (!world) return [];
    const keys = updateActiveRegions(world);
    return keys.map(parseRegionKey).map(region => snapshotRegion(region.x, region.y, world)).filter(Boolean);
  }

  function installSaveHook() {
    if (window.HavenfallContext.worldRegionSaveHookInstalled || typeof saveGame !== 'function') return;
    const originalSaveGame = saveGame;
    saveGame = function saveGameWithRegionSnapshots(manual = false) {
      try { snapshotActiveRegions(state?.world); }
      catch (err) { console.warn('[WorldRegionSystem] Falha ao atualizar snapshots antes do save.', err); }
      return originalSaveGame(manual);
    };
    window.HavenfallContext.worldRegionSaveHookInstalled = true;
  }

  function tick() {
    if (!state?.world || appScreen !== SCREEN.PLAYING) return;
    updateActiveRegions(state.world);
    installSaveHook();
  }

  window.WorldRegionSystem = Object.freeze({ REGION_SIZE, regionKey, parseRegionKey, regionForTile, ensureRegionState, regionBounds, indexExistingRegions, snapshotRegion, snapshotActiveRegions, activeRegionForCamera, updateActiveRegions, installSaveHook });
  installSaveHook();
  window.GameSystems?.registerTick?.('world-region-system.active-regions', tick, { order: 11, intervalMs: 900, critical: false });
})();
