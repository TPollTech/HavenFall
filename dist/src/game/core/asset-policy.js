'use strict';

(() => {
  const TERRAIN_KEYS = new Set(['tile_grass', 'tile_dirt', 'tile_sand', 'tile_stone']);
  const NATURE_KEYS = new Set([
    'tree', 'tree_oak', 'tree_birch', 'tree_pine', 'tree_palm', 'tree_willow', 'tree_eucalyptus',
    'bush', 'bush_dense', 'bush_dry', 'rock', 'logs', 'berry'
  ]);

  function assetPath(key) {
    return String(window.HavenfallAssets?.assets?.[key]?.path || '');
  }

  function isTerrainTextureAsset(name) {
    const key = String(name || '');
    const path = assetPath(key);
    return TERRAIN_KEYS.has(key)
      || key.startsWith('edificios_tile_')
      || path.includes('Tiles do chão')
      || path.includes('Tiles do chao');
  }

  function isNatureRuntimeAsset(name) {
    const key = String(name || '');
    const path = assetPath(key);
    return NATURE_KEYS.has(key)
      || key.startsWith('tree_')
      || key.startsWith('bush_')
      || path.includes('Arvores e arbustos')
      || path.includes('arvores e arbustos')
      || path.includes('Natureza');
  }

  function isPngRuntimeAsset(name) {
    return isTerrainTextureAsset(name) || isNatureRuntimeAsset(name);
  }

  function isProceduralRuntimeAssetPolicy(name) {
    const key = String(name || '');
    if (!key) return true;
    if (key === 'tile_water') return true;
    if (key === 'mountain_inner' || key.startsWith('mountain_')) return true;
    if (isPngRuntimeAsset(key)) return false;
    const asset = window.HavenfallAssets?.assets?.[key];
    const path = String(asset?.path || '');
    return /^colonist[A-Z]+_/.test(key)
      || /^wolf_\d+$/.test(key)
      || key.startsWith('creature_sprite_sheet_with_various_animals_cut_')
      || path.includes('/mobs/')
      || key === 'crafting_bench'
      || key === 'research_desk'
      || key === 'stove'
      || key === 'edificios_stove'
      || key === 'med_station'
      || key === 'edificios_forge'
      || key === 'edificios_sewing_table'
      || key.startsWith('station_')
      || key.startsWith('stations_raw_v19b_cut_');
  }

  function shouldLoadRuntimeSprite(name) {
    const key = String(name || '');
    return !!key && !isProceduralRuntimeAssetPolicy(key) && isPngRuntimeAsset(key);
  }

  function classify(name) {
    const key = String(name || '');
    return {
      key,
      path: assetPath(key),
      mode: shouldLoadRuntimeSprite(key) ? 'PNG_RUNTIME' : 'JS_OR_EXISTING_RUNTIME',
      keepPngRuntime: shouldLoadRuntimeSprite(key)
    };
  }

  function report() {
    return Object.keys(window.HavenfallAssets?.assets || {}).map(classify);
  }

  function installGlobalBindings() {
    try { window.isProceduralRuntimeAsset = isProceduralRuntimeAssetPolicy; } catch (_) {}
    window.HavenfallContext = window.HavenfallContext || {};
    window.HavenfallContext.assetPolicy = {
      rule: 'Carregar PNG apenas para chão natural, natureza, árvores, arbustos e pedras/rochas naturais. Água e montanha ficam no sistema já existente.',
      pngRuntimeKeys: [...TERRAIN_KEYS, ...NATURE_KEYS],
      excludedRuntimePngKeys: ['tile_water', 'mountain_inner', 'mountain_*']
    };
  }

  window.HavenfallAssetPolicy = Object.freeze({
    isTerrainTextureAsset,
    isNatureRuntimeAsset,
    isPngRuntimeAsset,
    isProceduralRuntimeAsset: isProceduralRuntimeAssetPolicy,
    shouldLoadRuntimeSprite,
    classify,
    report,
    installGlobalBindings,
    terrainTextureKeys: [...TERRAIN_KEYS],
    natureKeys: [...NATURE_KEYS]
  });

  installGlobalBindings();
})();
