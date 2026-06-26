'use strict';

(() => {
  if (window.HavenfallContext?.assetPackInstalled) return;

  const CLEAN_ASSETS = Object.freeze({
    stone_wall_clean: 'assets/clean/edificios/stone_wall.png',
    bed_single_clean: 'assets/clean/edificios/bed.png',
    campfire_clean: 'assets/clean/edificios/campfire.png',
    crate_wood_clean: 'assets/clean/edificios/crate.png',
    chest_large_clean: 'assets/clean/edificios/chest_metal.png',
    crafting_bench_clean: 'assets/clean/edificios/workbench.png',
    research_desk_clean: 'assets/clean/edificios/desk_research.png',
    stove_clean: 'assets/clean/edificios/stove.png',
    forge_clean: 'assets/clean/edificios/forge.png',
    tool_cabinet_clean: 'assets/clean/edificios/tool_cabinet.png'
  });

  const ASSET_MAPPINGS = Object.freeze({
    stone_wall_clean: ['wall'],
    bed_single_clean: ['bed'],
    campfire_clean: ['campfire'],
    crate_wood_clean: ['crate', 'supply_crate'],
    chest_large_clean: ['cache'],
    crafting_bench_clean: ['bench'],
    research_desk_clean: ['research_desk'],
    stove_clean: ['stove'],
    forge_clean: ['forge'],
    tool_cabinet_clean: ['med_station']
  });

  function loadOptionalImage(key, src, targetImages) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        targetImages[key] = img;
        resolve(true);
      };
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }

  function applyCleanObjectMappings(targetImages, targetDefs) {
    if (!targetImages || !targetDefs) return;

    Object.entries(ASSET_MAPPINGS).forEach(([assetKey, objectKeys]) => {
      if (!targetImages[assetKey]) return;

      objectKeys.forEach(objKey => {
        if (targetDefs[objKey]) {
          targetDefs[objKey].img = assetKey;
        }
      });
    });
  }

  function injectCleanAssets() {
    const activeImages = typeof images !== 'undefined' ? images : null;
    const activeDefs = typeof objectDefs !== 'undefined' ? objectDefs : null;

    if (!activeImages || typeof activeImages !== 'object') {
      return Promise.resolve(false);
    }

    return Promise.all(
      Object.entries(CLEAN_ASSETS).map(([key, src]) => loadOptionalImage(key, src, activeImages))
    ).then(results => {
      const loadedCount = results.filter(Boolean).length;

      applyCleanObjectMappings(activeImages, activeDefs);

      window.HavenfallContext = window.HavenfallContext || {};
      window.HavenfallContext.cleanAssetsLoaded = loadedCount;

      if (loadedCount > 0 && typeof log === 'function' && typeof state !== 'undefined' && state?.log) {
        log(`${loadedCount} assets limpos aplicados dinamicamente.`);
      }

      return loadedCount > 0;
    });
  }

  if (typeof window !== 'undefined' && typeof loadImages === 'function') {
    const originalLoadImages = loadImages;
    loadImages = function alphaCleanAssetLoadImages() {
      return originalLoadImages().then(() => injectCleanAssets());
    };
  }

  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.assetPackInstalled = true;
  window.HavenfallContext.injectCleanAssets = injectCleanAssets;
  window.HavenfallContext.cleanAssetPaths = CLEAN_ASSETS;
})();
