'use strict';

(() => {
  if (window.BiomeEngine?.installBiomeObjectDefs) window.BiomeEngine.installBiomeObjectDefs();

  function buildCompatDefinitions() {
    const source = window.BiomeRegistry?.all?.() || {};
    const compat = {};
    for (const [id, def] of Object.entries(source)) {
      const spawnMobs = Object.entries(def.spawnRules || {})
        .filter(([, rule]) => rule !== false && rule?.allowed !== false && Number(rule?.weight ?? 1) > 0)
        .map(([type]) => type);
      compat[id] = { ...def, spawnMobs };
    }
    return compat;
  }

  window.biomeDefinitions = buildCompatDefinitions();

  window.getBiomeAt = function getBiomeAt(x, y) {
    return window.BiomeEngine?.getBiomeIdAt?.(x, y) || 'forest';
  };

  window.canSpawnMobInCurrentBiome = function canSpawnMobInCurrentBiome(type, x, y, context = {}) {
    return window.BiomeEngine?.canSpawnMobAt?.(type, x, y, context) ?? true;
  };
})();
