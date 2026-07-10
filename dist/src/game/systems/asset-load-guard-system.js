'use strict';

(() => {
  if (window.HavenfallContext?.assetLoadGuardInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.assetLoadGuardInstalled = true;

  const TIMEOUT_MS = 900;
  const BATCH_SIZE = 32;

  const ROOTS = Object.freeze({
    ground: Object.freeze(['assets/tiles/Tiles do chão', 'assets/tiles']),
    vegetation: Object.freeze(['assets/tiles/Arvores e arbustos', 'assets/tiles/Arvores e Arbustos', 'assets/tiles/arvores e arbustos'])
  });

  const BLOCKED_KEYS = new Set([
    'tile_water', 'mountain_inner', 'mountain_corner_ne', 'mountain_corner_nw',
    'mountain_corner_se', 'mountain_corner_sw', 'mountain_edge_e', 'mountain_edge_n',
    'mountain_edge_s', 'mountain_edge_w'
  ]);

  function variants(...names) {
    const suffixes = ['.png', '_1.png', '_01.png', '-1.png', '_2.png', '_02.png', '-2.png'];
    return [...new Set(names.filter(Boolean).flatMap(name => suffixes.map(suffix => `${name}${suffix}`)))];
  }

  const ASSETS = Object.freeze({
    tile_grass: { roots: ROOTS.ground, files: variants('grama', 'grama2', '2d_rpg_sprite_sheet_and_assets_cut_005', 'tile_grass') },
    tile_dirt: { roots: ROOTS.ground, files: variants('terra', 'terra2', 'terra3', 'caminho de terra', '2d_rpg_sprite_sheet_and_assets_cut_006', 'tile_dirt') },
    tile_sand: { roots: ROOTS.ground, files: variants('areia', 'areia2', '2d_rpg_sprite_sheet_and_assets_cut_011', 'tile_sand') },
    tile_stone: { roots: ROOTS.ground, files: variants('pedregulho', 'pedregulho2', 'pedregulho3', '2d_rpg_sprite_sheet_and_assets_cut_012', 'tile_stone') },
    tree: { roots: ROOTS.vegetation, files: variants('nature_and_survival_resource_icons_1_cut_001', 'tree', 'arvore') },
    tree_oak: { roots: ROOTS.vegetation, files: variants('nature_and_survival_resource_icons_1_cut_001', 'tree_oak', 'carvalho') },
    tree_birch: { roots: ROOTS.vegetation, files: variants('nature_and_survival_resource_icons_1_cut_002', 'tree_birch', 'bétula') },
    tree_pine: { roots: ROOTS.vegetation, files: variants('nature_and_survival_resource_icons_1_cut_003', 'tree_pine', 'pinheiro') },
    tree_palm: { roots: ROOTS.vegetation, files: variants('nature_and_survival_resource_icons_1_cut_004', 'tree_palm', 'palmeira') },
    tree_willow: { roots: ROOTS.vegetation, files: variants('nature_and_survival_resource_icons_1_cut_005', 'tree_willow', 'salgueiro') },
    tree_eucalyptus: { roots: ROOTS.vegetation, files: variants('nature_and_survival_resource_icons_1_cut_006', 'tree_eucalyptus', 'eucalipto') },
    bush: { roots: ROOTS.vegetation, files: variants('nature_and_survival_resource_icons_1_cut_007', 'bush', 'arbusto') },
    bush_dense: { roots: ROOTS.vegetation, files: variants('nature_and_survival_resource_icons_1_cut_007', 'bush_dense', 'arbusto_denso') },
    bush_dry: { roots: ROOTS.vegetation, files: variants('nature_and_survival_resource_icons_1_cut_008', 'bush_dry', 'arbusto_seco') },
    berry: { roots: ROOTS.vegetation, files: variants('nature_and_survival_resource_icons_1_cut_008', 'berry', 'arbusto_frutas') },
    rock: { roots: ROOTS.ground, files: variants('rock', 'pedra', 'rocha') },
    logs: { roots: ROOTS.vegetation, files: variants('nature_and_survival_resource_icons_1_cut_005', 'logs', 'toras') }
  });

  function isMappedAsset(name) { return !!ASSETS[String(name || '')]; }
  function isBlockedKey(name) { return BLOCKED_KEYS.has(String(name || '')); }

  function configuredAssetNames() {
    return Array.isArray(window.assetNames) ? window.assetNames : (typeof assetNames !== 'undefined' ? assetNames : []);
  }

  function miningManifestAssetNames() {
    return Object.keys(window.HavenfallAssets?.assets || {}).filter(name => String(name || '').startsWith('mining_'));
  }

  function collectReferencedAssetNames() {
    const names = new Set([...configuredAssetNames(), ...Object.keys(ASSETS), ...miningManifestAssetNames()]);
    const push = value => {
      if (typeof value === 'string' && value) names.add(value);
    };
    const objectEntries = typeof objectDefs !== 'undefined' ? Object.values(objectDefs || {}) : [];
    const itemEntries = typeof itemDefs !== 'undefined' ? Object.values(itemDefs || {}) : [];
    for (const entry of objectEntries) {
      push(entry?.img);
      push(entry?.icon);
    }
    for (const entry of itemEntries) {
      push(entry?.img);
      push(entry?.icon);
    }
    return [...names].filter(name => !isBlockedKey(name)
      && !(typeof isProceduralRuntimeAsset === 'function' && isProceduralRuntimeAsset(name)));
  }

  function mappedAssetNames() {
    return collectReferencedAssetNames().filter(isMappedAsset);
  }

  function genericAssetNames() {
    return collectReferencedAssetNames().filter(name => !isMappedAsset(name));
  }

  function animationEntriesToLoad() {
    return Object.entries(window.HavenfallAssets?.animations || {}).filter(([key, animation]) => {
      if (isBlockedKey(key)) return false;
      if (typeof isProceduralRuntimeAsset === 'function' && (isProceduralRuntimeAsset(key) || isProceduralRuntimeAsset(animation?.key))) return false;
      return !!animation?.path;
    });
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

  function markGenericMissing(name, src, report) {
    const img = new Image();
    img.dataset.missingAsset = String(name || 'unknown');
    img.dataset.originalSrc = src;
    images[name] = img;
    report.missing.push({ name, src });
  }

  function loadGenericImage(name, report) {
    const src = typeof spriteSrc === 'function' ? spriteSrc(name) : `assets/ui/${name}.png`;
    return new Promise(resolve => {
      const img = new Image();
      let settled = false;
      const fail = () => {
        if (settled) return;
        settled = true;
        markGenericMissing(name, src, report);
        resolve(false);
      };
      const timer = setTimeout(fail, TIMEOUT_MS);
      img.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        images[name] = img;
        report.loaded += 1;
        resolve(true);
      };
      img.onerror = () => {
        clearTimeout(timer);
        fail();
      };
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = src;
    });
  }

  function loadAnimationAsset(key, animation, report) {
    const src = animation?.path || '';
    return new Promise(resolve => {
      if (!src) {
        report.missing.push({ name: `vfx:${key}`, src: 'missing-animation-path' });
        resolve(false);
        return;
      }
      const img = new Image();
      let settled = false;
      const fail = () => {
        if (settled) return;
        settled = true;
        report.missing.push({ name: `vfx:${key}`, src });
        resolve(false);
      };
      const timer = setTimeout(fail, TIMEOUT_MS);
      img.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        images[`vfx:${key}`] = img;
        report.loaded += 1;
        resolve(true);
      };
      img.onerror = () => {
        clearTimeout(timer);
        fail();
      };
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = src;
    });
  }

  function loadInBatches(names, loader, report, batchDelay = 24, batchSize = BATCH_SIZE) {
    let index = 0;
    const tick = () => {
      const slice = names.slice(index, index + batchSize);
      index += batchSize;
      Promise.all(slice.map(name => loader(name, report))).finally(() => {
        window.HavenfallAssetLoadReport = report;
        if (index < names.length) setTimeout(tick, batchDelay);
        else report.backgroundFinishedAt = new Date().toISOString();
      });
    };
    if (names.length) setTimeout(tick, 40);
  }

  function guardedLoadImages() {
    const report = {
      version: 'asset-load-guard-natural-png-v5',
      roots: ROOTS,
      loaded: 0,
      missing: [],
      recovered: [],
      startedAt: new Date().toISOString()
    };
    const mapped = mappedAssetNames();
    const generic = genericAssetNames();
    const animations = animationEntriesToLoad();
    const essentials = mapped.filter(name => name.startsWith('tile_'));
    const backgroundMapped = mapped.filter(name => !essentials.includes(name));
    return Promise.all(essentials.map(name => loadMappedImage(name, report))).then(() => {
      report.finishedAt = new Date().toISOString();
      window.HavenfallAssetLoadReport = report;
      loadInBatches(backgroundMapped, loadMappedImage, report);
      loadInBatches(generic, loadGenericImage, report, 24, 18);
      if (animations.length) {
        let index = 0;
        const tick = () => {
          const slice = animations.slice(index, index + 8);
          index += 8;
          Promise.all(slice.map(([key, animation]) => loadAnimationAsset(key, animation, report))).finally(() => {
            window.HavenfallAssetLoadReport = report;
            if (index < animations.length) setTimeout(tick, 36);
          });
        };
        setTimeout(tick, 80);
      }
      return report;
    });
  }

  if (typeof loadImages === 'function') {
    window.HavenfallContext.originalLoadImages = loadImages;
    loadImages = guardedLoadImages;
  }

  window.HavenfallNatureAssets = Object.freeze({ roots: ROOTS, names: () => Object.keys(ASSETS), sourcesFor: assetSources, candidates: ASSETS });
  window.HavenfallAssetLoadGuard = Object.freeze({ version: 'asset-load-guard-natural-png-v5', guardedLoadImages, assetSources });
})();
