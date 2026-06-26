'use strict';

function installAlphaCleanAssetPack() {
  if (window.__havenfallAlphaCleanAssetPackInstalled) return;
  window.__havenfallAlphaCleanAssetPackInstalled = true;

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

  function loadOptionalImage(key, src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        images[key] = img;
        resolve(true);
      };
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }

  function applyCleanObjectMappings() {
    if (images.stone_wall_clean && objectDefs.wall) objectDefs.wall.img = 'stone_wall_clean';
    if (images.bed_single_clean && objectDefs.bed) objectDefs.bed.img = 'bed_single_clean';
    if (images.campfire_clean && objectDefs.campfire) objectDefs.campfire.img = 'campfire_clean';
    if (images.crate_wood_clean && objectDefs.crate) objectDefs.crate.img = 'crate_wood_clean';
    if (images.crate_wood_clean && objectDefs.supply_crate) objectDefs.supply_crate.img = 'crate_wood_clean';
    if (images.chest_large_clean && objectDefs.cache) objectDefs.cache.img = 'chest_large_clean';
    if (images.crafting_bench_clean && objectDefs.bench) objectDefs.bench.img = 'crafting_bench_clean';
    if (images.research_desk_clean && objectDefs.research_desk) objectDefs.research_desk.img = 'research_desk_clean';
    if (images.stove_clean && objectDefs.stove) objectDefs.stove.img = 'stove_clean';
    if (images.forge_clean && objectDefs.forge) objectDefs.forge.img = 'forge_clean';
    if (images.tool_cabinet_clean && objectDefs.med_station) objectDefs.med_station.img = 'tool_cabinet_clean';
  }

  function injectCleanAssets() {
    if (typeof images !== 'object') return Promise.resolve(false);
    return Promise.all(Object.entries(CLEAN_ASSETS).map(([key, src]) => loadOptionalImage(key, src)))
      .then(results => {
        const loaded = results.filter(Boolean).length;
        applyCleanObjectMappings();
        window.havenfallCleanAssetsLoaded = loaded;
        if (loaded > 0 && typeof log === 'function' && state?.log) log(`${loaded} assets limpos carregados.`);
        return loaded > 0;
      });
  }

  const previousLoadImages = loadImages;
  loadImages = function alphaCleanAssetLoadImages() {
    return previousLoadImages().then(() => injectCleanAssets());
  };

  window.havenfallInjectCleanAssets = injectCleanAssets;
  window.havenfallCleanAssetPaths = CLEAN_ASSETS;
}

if (typeof window !== 'undefined' && typeof loadImages === 'function') {
  installAlphaCleanAssetPack();
}
