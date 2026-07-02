'use strict';

(() => {
  if (window.HavenfallContext?.assetLoadGuardInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.assetLoadGuardInstalled = true;

  const TIMEOUT_MS = 900;
  const BATCH_SIZE = 32;

  const ROOTS = Object.freeze({
    ground: Object.freeze(['assets/tiles/Tiles do chão', 'assets/tiles/Tiles do chao', 'assets/tiles/Tiles da natureza', 'assets/tiles/Tiles da Natureza', 'assets/tiles/Natureza', 'assets/tiles/natureza']),
    vegetation: Object.freeze(['assets/tiles/Arvores e arbustos', 'assets/tiles/Arvores e Arbustos', 'assets/tiles/arvores e arbustos', 'assets/tiles/Árvores e arbustos', 'assets/tiles/Árvores e Arbustos', 'assets/tiles/Tiles da natureza', 'assets/tiles/Tiles da Natureza', 'assets/tiles/Natureza', 'assets/tiles/natureza']),
    naturalRock: Object.freeze(['assets/tiles/Tiles do chão', 'assets/tiles/Tiles do chao', 'assets/tiles/Tiles da natureza', 'assets/tiles/Tiles da Natureza', 'assets/tiles/Natureza', 'assets/tiles/natureza', 'assets/tiles/Arvores e arbustos', 'assets/tiles/Arvores e Arbustos'])
  });

  function variants(...names) {
    const suffixes = ['.png', '_1.png', '_01.png', '-1.png', ' 1.png', '_2.png', '_02.png', '-2.png', ' 2.png'];
    return [...new Set(names.filter(Boolean).flatMap(name => suffixes.map(suffix => `${name}${suffix}`)))];
  }

  const ASSETS = Object.freeze({
    tile_grass: { roots: ROOTS.ground, files: variants('edificios_tile_grass', 'edificios_tile_grass_1', 'tile_grass', 'grass', 'grama', 'chao_grama', 'chão_grama') },
    tile_dirt: { roots: ROOTS.ground, files: variants('edificios_tile_dirt', 'edificios_tile_dirt_1', 'tile_dirt', 'dirt', 'terra', 'chao_terra', 'chão_terra') },
    tile_sand: { roots: ROOTS.ground, files: variants('edificios_tile_sand', 'edificios_tile_sand_1', 'tile_sand', 'sand', 'areia', 'chao_areia', 'chão_areia') },
    tile_stone: { roots: ROOTS.ground, files: variants('edificios_tile_stone', 'edificios_tile_stone_1', 'edificios_tile_rocky', 'edificios_tile_rocky_1', 'tile_stone', 'stone', 'pedra', 'chao_pedra', 'chão_pedra') },
    tree: { roots: ROOTS.vegetation, files: variants('arvore', 'árvore', 'arvores', 'árvores', 'carvalho', 'tree') },
    tree_oak: { roots: ROOTS.vegetation, files: variants('carvalho', 'arvore_carvalho', 'árvore_carvalho', 'tree_oak', 'oak_tree', 'oak') },
    tree_birch: { roots: ROOTS.vegetation, files: variants('betula', 'bétula', 'arvore_betula', 'árvore_bétula', 'tree_birch', 'birch_tree') },
    tree_pine: { roots: ROOTS.vegetation, files: variants('pinheiro', 'arvore_pinheiro', 'árvore_pinheiro', 'tree_pine', 'pine_tree', 'conifer') },
    tree_palm: { roots: ROOTS.vegetation, files: variants('palmeira', 'coqueiro', 'tree_palm', 'palm_tree') },
    tree_willow: { roots: ROOTS.vegetation, files: variants('salgueiro', 'tree_willow', 'willow_tree') },
    tree_eucalyptus: { roots: ROOTS.vegetation, files: variants('eucalipto', 'arvore_eucalipto', 'árvore_eucalipto', 'tree_eucalyptus', 'eucalyptus_tree', 'eucalyptus') },
    bush: { roots: ROOTS.vegetation, files: variants('arbusto', 'arbustos', 'bush') },
    bush_dense: { roots: ROOTS.vegetation, files: variants('arbusto_denso', 'arbusto', 'bush_dense', 'bush') },
    bush_dry: { roots: ROOTS.vegetation, files: variants('arbusto_seco', 'dry_bush', 'bush_dry') },
    berry: { roots: ROOTS.vegetation, files: variants('arbusto_frutas', 'frutas_silvestres', 'berry', 'berry_bush', 'res_berries') },
    rock: { roots: ROOTS.naturalRock, files: variants('rock', 'pedra', 'rocha', 'pedra_natural', 'rocha_natural') },
    logs: { roots: ROOTS.vegetation, files: variants('toras', 'madeira', 'logs') }
  });

  function isMappedAsset(name) { return !!ASSETS[String(name || '')]; }
  function assetNamesToLoad() {
    const configured = Array.isArray(window.assetNames) ? window.assetNames : (typeof assetNames !== 'undefined' ? assetNames : []);
    return [...new Set([...configured, ...Object.keys(ASSETS)])].filter(name => isMappedAsset(name) && !(typeof isProceduralRuntimeAsset === 'function' && isProceduralRuntimeAsset(name)));
  }

  function assetSources(name) {
    const entry = ASSETS[String(name || '')];
    if (!entry) return [];
    return [...new Set(entry.roots.flatMap(root => entry.files.map(file => `${root}/${file}`)))];
  }

  function markMissing(name, sources, report) {
    const img = new Image();
    img.dataset.missingAsset = String(name || 'unknown');
    img.dataset.originalSrc = sources.join(' | ');
    images[name] = img;
    report.missing.push({ name, src: img.dataset.originalSrc });
  }

  function loadMappedImage(name, report) {
    const sources = assetSources(name);
    return new Promise(resolve => {
      let index = 0;
      const next = () => {
        const src = sources[index++];
        if (!src) { markMissing(name, sources, report); resolve(false); return; }
        const img = new Image();
        let settled = false;
        const fail = () => { if (!settled) { settled = true; next(); } };
        const timer = setTimeout(fail, TIMEOUT_MS);
        img.onload = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          images[name] = img;
          report.loaded += 1;
          if (index > 1) report.recovered.push({ name, src });
          resolve(true);
        };
        img.onerror = () => { clearTimeout(timer); fail(); };
        img.decoding = 'async';
        img.loading = 'eager';
        img.src = src;
      };
      next();
    });
  }

  function guardedLoadImages() {
    const report = { version: 'asset-load-guard-natural-png-v3', roots: ROOTS, loaded: 0, missing: [], recovered: [], startedAt: new Date().toISOString() };
    const names = assetNamesToLoad();
    const essentials = names.filter(name => name.startsWith('tile_'));
    const background = names.filter(name => !essentials.includes(name));
    return Promise.all(essentials.map(name => loadMappedImage(name, report))).then(() => {
      report.finishedAt = new Date().toISOString();
      window.HavenfallAssetLoadReport = report;
      let index = 0;
      const tick = () => {
        const slice = background.slice(index, index + BATCH_SIZE);
        index += BATCH_SIZE;
        Promise.all(slice.map(name => loadMappedImage(name, report))).finally(() => {
          window.HavenfallAssetLoadReport = report;
          if (index < background.length) setTimeout(tick, 24);
          else report.backgroundFinishedAt = new Date().toISOString();
        });
      };
      if (background.length) setTimeout(tick, 120);
      return report;
    });
  }

  if (typeof loadImages === 'function') {
    window.HavenfallContext.originalLoadImages = loadImages;
    loadImages = guardedLoadImages;
  }

  window.HavenfallNatureAssets = Object.freeze({ roots: ROOTS, names: () => Object.keys(ASSETS), sourcesFor: assetSources, candidates: ASSETS });
  window.HavenfallAssetLoadGuard = Object.freeze({ version: 'asset-load-guard-natural-png-v3', guardedLoadImages, assetSources });
})();
