'use strict';

(() => {
  const TERRAIN_KEYS = new Set(['tile_grass', 'tile_dirt', 'tile_sand', 'tile_stone', 'tile_water']);
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
    return TERRAIN_KEYS.has(key) || key.startsWith('edificios_tile_') || path.includes('Tiles do chão') || path.includes('Tiles do chao');
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
    return !isPngRuntimeAsset(key);
  }

  function shouldLoadRuntimeSprite(name) {
    const key = String(name || '');
    return !!key && isPngRuntimeAsset(key);
  }

  function classify(name) {
    const key = String(name || '');
    return {
      key,
      path: assetPath(key),
      mode: shouldLoadRuntimeSprite(key) ? 'PNG_RUNTIME' : 'JS_OR_UNUSED',
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
      rule: 'Carregar PNG apenas para chão, natureza, árvores, arbustos, rochas e água.',
      pngRuntimeKeys: [...TERRAIN_KEYS, ...NATURE_KEYS]
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
