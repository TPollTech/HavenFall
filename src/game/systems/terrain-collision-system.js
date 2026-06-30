'use strict';

(() => {
  if (window.HavenfallContext?.terrainCollisionInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.terrainCollisionInstalled = true;

  function terrainAt(x, y) {
    const world = state?.world;
    return world?.terrain?.[Math.round(y)]?.[Math.round(x)] || null;
  }

  function terrainBlocksPath(x, y, target = null) {
    x = Math.round(x);
    y = Math.round(y);
    if (target && Math.round(target.x) === x && Math.round(target.y) === y) return null;
    const tile = terrainAt(x, y);
    if (!tile) return null;
    if (tile === 'water') return { blocks: true, reason: 'water' };
    return null;
  }

  if (window.GameSystems?.registerCollisionProvider) {
    window.GameSystems.registerCollisionProvider('terrain-collision', terrainBlocksPath, { order: 5 });
  }

  window.HavenfallTerrainCollision = Object.freeze({ terrainBlocksPath });
})();
