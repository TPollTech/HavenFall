'use strict';

(() => {
  if (window.BiomeEngine?.installBiomeObjectDefs) window.BiomeEngine.installBiomeObjectDefs();

  window.biomeDefinitions = window.BiomeRegistry?.all?.() || window.biomeDefinitions || {};

  window.getBiomeAt = function getBiomeAt(x, y) {
    return window.BiomeEngine?.getBiomeIdAt?.(x, y) || 'forest';
  };

  window.canSpawnMobInCurrentBiome = function canSpawnMobInCurrentBiome(type, x, y, context = {}) {
    return window.BiomeEngine?.canSpawnMobAt?.(type, x, y, context) ?? true;
  };
})();
