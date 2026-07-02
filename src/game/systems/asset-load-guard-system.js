'use strict';

(() => {
  if (window.HavenfallContext?.assetLoadGuardInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.assetLoadGuardInstalled = true;

  const FALLBACK_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  const ESSENTIAL_TIMEOUT_MS = 650;
  const BACKGROUND_TIMEOUT_MS = 1800;
  const BACKGROUND_BATCH_SIZE = 32;
  const BACKGROUND_BATCH_DELAY_MS = 24;

  const GROUND_TILE_ROOTS = Object.freeze([
    'assets/tiles/Tiles do chão',
    'assets/tiles/Tiles do chao',
    'assets/tiles/Tiles da natureza',
    'assets/tiles/Tiles da Natureza',
    'assets/tiles/Natureza',
    'assets/tiles/natureza'
  ]);

  const VEGETATION_TILE_ROOTS = Object.freeze([
    'assets/tiles/Arvores e arbustos',
    'assets/tiles/Arvores e Arbustos',
    'assets/tiles/arvores e arbustos',
    'assets/tiles/Árvores e arbustos',
    'assets/tiles/Árvores e Arbustos',
    'assets/tiles/Arvores',
    'assets/tiles/arvores',
    'assets/tiles/Arbustos',
    'assets/tiles/arbustos',
    'assets/tiles/Tiles da natureza',
    'assets/tiles/Tiles da Natureza',
    'assets/tiles/Natureza',
    'assets/tiles/natureza'
  ]);

  const MOUNTAIN_TILE_ROOTS = Object.freeze([
    'assets/tiles/Tiles do chão',
    'assets/tiles/Tiles do chao',
    'assets/tiles/Tiles da natureza',
    'assets/tiles/Tiles da Natureza',
    'assets/tiles/Montanhas',
    'assets/tiles/montanhas',
    'assets/tiles/Rochas',
    'assets/tiles/rochas',
    'assets/tiles/Rochas e montanhas',
    'assets/tiles/Rochas e Montanhas'
  ]);

  const CRITICAL_BOOT_ASSETS = Object.freeze([
    'tile_grass', 'tile_dirt', 'tile_sand', 'tile_stone',
    'bed_single', 'crate_wood', 'campfire',
    'icon_food', 'icon_wood', 'icon_stone', 'icon_metal', 'icon_warn'
  ]);

  function fileVariants(...bases) {
    const suffixes = ['.png', '_1.png', '_01.png', '-1.png', ' 1.png', '_2.png', '_02.png', '-2.png', ' 2.png'];
    const out = [];
    for (const base of bases.filter(Boolean)) {
      for (const suffix of suffixes) out.push(`${base}${suffix}`);
    }
    return [...new Set(out)];
  }

  const ORGANIZED_ASSETS = Object.freeze({
    tile_grass: { roots: GROUND_TILE_ROOTS, files: fileVariants('edificios_tile_grass', 'edificios_tile_grass_1', 'tile_grass', 'grass', 'grama') },
    tile_dirt: { roots: GROUND_TILE_ROOTS, files: fileVariants('edificios_tile_dirt', 'edificios_tile_dirt_1', 'tile_dirt', 'dirt', 'terra') },
    tile_sand: { roots: GROUND_TILE_ROOTS, files: fileVariants('edificios_tile_sand', 'edificios_tile_sand_1', 'tile_sand', 'sand', 'areia') },
    tile_stone: { roots: GROUND_TILE_ROOTS, files: fileVariants('edificios_tile_stone', 'edificios_tile_stone_1', 'edificios_tile_rocky', 'edificios_tile_rocky_1', 'tile_stone', 'stone', 'pedra') },
    tree: { roots: VEGETATION_TILE_ROOTS, files: fileVariants('arvore', 'árvore', 'arvores', 'árvores', 'carvalho', 'tree') },
    tree_oak: { roots: VEGETATION_TILE_ROOTS, files: fileVariants('carvalho', 'arvore_carvalho', 'árvore_carvalho', 'tree_oak', 'oak_tree', 'oak') },
    tree_birch: { roots: VEGETATION_TILE_ROOTS, files: fileVariants('betula', 'bétula', 'arvore_betula', 'árvore_bétula', 'tree_birch', 'birch_tree') },
    tree_pine: { roots: VEGETATION_TILE_ROOTS, files: fileVariants('pinheiro', 'arvore_pinheiro', 'árvore_pinheiro', 'tree_pine', 'pine_tree', 'conifer') },
    tree_palm: { roots: VEGETATION_TILE_ROOTS, files: fileVariants('palmeira', 'coqueiro', 'tree_palm', 'palm_tree') },
    tree_willow: { roots: VEGETATION_TILE_ROOTS, files: fileVariants('salgueiro', 'tree_willow', 'willow_tree') },
    tree_eucalyptus: { roots: VEGETATION_TILE_ROOTS, files: fileVariants('eucalipto', 'arvore_eucalipto', 'árvore_eucalipto', 'tree_eucalyptus', 'eucalyptus_tree', 'eucalyptus') },
    bush: { roots: VEGETATION_TILE_ROOTS, files: fileVariants('arbusto', 'arbustos', 'bush') },
    bush_dense: { roots: VEGETATION_TILE_ROOTS, files: fileVariants('arbusto_denso', 'arbusto', 'bush_dense', 'bush') },
    bush_dry: { roots: VEGETATION_TILE_ROOTS, files: fileVariants('arbusto_seco', 'dry_bush', 'bush_dry') },
    berry: { roots: VEGETATION_TILE_ROOTS, files: fileVariants('arbusto_frutas', 'frutas_silvestres', 'berry', 'berry_bush', 'res_berries') },
    rock: { roots: MOUNTAIN_TILE_ROOTS, files: [...fileVariants('rock', 'pedra', 'rocha', 'mountain_inner'), 'mountain_inner.svg'] },
    logs: { roots: VEGETATION_TILE_ROOTS, files: fileVariants('toras', 'madeira', 'logs') }
  });

  function organizedAssetNames() {
    return Object.keys(ORGANIZED_ASSETS);
  }

  function fallbackImage(name, src) {
    const img = new Image();
    img.dataset.missingAsset = String(name || 'unknown');
    img.dataset.originalSrc = Array.isArray(src) ? src.join(' | ') : String(src || '');
    img.src = FALLBACK_PIXEL;
    return img;
  }

  function manifestEntry(name) {
    return window.HavenfallAssets?.assets?.[String(name || '')] || null;
  }

  function organizedAssetSources(name) {
    const entry = ORGANIZED_ASSETS[String(name || '')];
    if (!entry) return [];
    const roots = Array.isArray(entry.roots) ? entry.roots : [];
    const files = Array.isArray(entry.files) ? entry.files : [];
    const paths = [];
    for (const root of roots) {
      for (const file of files) paths.push(`${root}/${file}`);
    }
    return paths;
  }

  function isOrganizedRuntimeAsset(name) {
    return !!ORGANIZED_ASSETS[String(name || '')];
  }

  function assetSources(name) {
    const key = String(name || '');
    const sources = [];

    if (isOrganizedRuntimeAsset(key)) {
      sources.push(...organizedAssetSources(key));
      return [...new Set(sources.filter(Boolean))];
    }

    const entry = manifestEntry(key);
    if (entry?.path) sources.push(entry.path);
    if (typeof spriteSrc === 'function') sources.push(spriteSrc(key));
    sources.push(`assets/ui/${key}.png`);
    return [...new Set(sources.filter(Boolean))];
  }

  function animationSource(animation) {
    return animation?.path || null;
  }

  function shouldSkipAsset(name) {
    return typeof isProceduralRuntimeAsset === 'function' && isProceduralRuntimeAsset(name);
  }

  function isCriticalBootAsset(name) {
    return CRITICAL_BOOT_ASSETS.includes(String(name || ''));
  }

  function unique(list) {
    return [...new Set((list || []).filter(Boolean).map(String))];
  }

  function loadImageSafe(name, src, targetKey, report, timeoutMs = ESSENTIAL_TIMEOUT_MS) {
    const sources = unique(Array.isArray(src) ? src : [src]);
    return new Promise(resolve => {
      if (!sources.length) {
        images[targetKey] = fallbackImage(name, sources);
        report.missing.push({ name, src: '', reason: 'empty-src' });
        resolve({ ok: false, name, src: '', reason: 'empty-src' });
        return;
      }

      let index = 0;
      const failed = [];
      const tryNext = () => {
        const currentSrc = sources[index++];
        if (!currentSrc) {
          images[targetKey] = fallbackImage(name, sources);
          report.missing.push({ name, src: sources.join(' | '), reason: 'all-candidates-failed', failed });
          resolve({ ok: false, name, src: sources[0], reason: 'all-candidates-failed' });
          return;
        }

        const img = new Image();
        let settled = false;
        const finishFailed = reason => {
          if (settled) return;
          settled = true;
          failed.push({ src: currentSrc, reason });
          tryNext();
        };
        const timer = setTimeout(() => finishFailed('timeout'), timeoutMs);

        img.onload = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          images[targetKey] = img;
          report.loaded += 1;
          if (index > 1) report.recovered = [...(report.recovered || []), { name, key: targetKey, src: currentSrc }];
          resolve({ ok: true, name, src: currentSrc });
        };
        img.onerror = () => {
          clearTimeout(timer);
          finishFailed('error');
        };
        img.decoding = 'async';
        img.loading = 'eager';
        img.src = currentSrc;
      };
      tryNext();
    });
  }

  function manifestAssetNames() {
    return Object.keys(window.HavenfallAssets?.assets || {});
  }

  function baseAssetNames() {
    const names = Array.isArray(window.assetNames) ? window.assetNames : (typeof assetNames !== 'undefined' ? assetNames : []);
    return unique([...names, ...organizedAssetNames()]).filter(name => !shouldSkipAsset(name));
  }

  function essentialAssetNames() {
    const base = baseAssetNames();
    const critical = manifestAssetNames().filter(name => isCriticalBootAsset(name) && !shouldSkipAsset(name));
    return unique([...base.filter(isCriticalBootAsset), ...critical]);
  }

  function backgroundAssetJobs(report) {
    const essential = new Set(essentialAssetNames());
    const baseJobs = baseAssetNames()
      .filter(name => !essential.has(name) && !shouldSkipAsset(name))
      .map(name => ({ name, src: assetSources(name), key: name }));

    const manifestJobs = manifestAssetNames()
      .filter(name => !essential.has(name) && !shouldSkipAsset(name) && !isOrganizedRuntimeAsset(name))
      .map(name => ({ name, src: assetSources(name), key: name }));

    const animationJobs = Object.entries(window.HavenfallAssets?.animations || {})
      .filter(([key, animation]) => !shouldSkipAsset(key) && !shouldSkipAsset(animation?.key))
      .map(([key, animation]) => ({ name: key, src: animationSource(animation), key: `vfx:${key}` }));

    const jobsByKey = new Map([...baseJobs, ...manifestJobs, ...animationJobs].map(job => [job.key, job]));
    const jobs = [...jobsByKey.values()];
    report.backgroundTotal = jobs.length;
    return jobs;
  }

  function scheduleBackgroundTick(callback, delay = BACKGROUND_BATCH_DELAY_MS) {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(callback, { timeout: Math.max(250, delay * 8) });
      return;
    }
    setTimeout(callback, delay);
  }

  function runBackgroundAssetLoad(report) {
    const jobs = backgroundAssetJobs(report);
    if (!jobs.length) {
      report.backgroundFinishedAt = new Date().toISOString();
      return;
    }

    let index = 0;
    const tick = () => {
      const slice = jobs.slice(index, index + BACKGROUND_BATCH_SIZE);
      index += BACKGROUND_BATCH_SIZE;
      Promise.all(slice.map(job => loadImageSafe(job.name, job.src, job.key, report, BACKGROUND_TIMEOUT_MS))).finally(() => {
        report.backgroundLoaded = Math.min(index, jobs.length);
        window.HavenfallAssetLoadReport = report;
        if (index < jobs.length) scheduleBackgroundTick(tick);
        else {
          report.backgroundFinishedAt = new Date().toISOString();
          if (report.missing.length) console.warn(`[Assets] ${report.missing.length} asset(s) ausente(s). O jogo continuou com placeholders.`, report.missing.slice(0, 40));
          else console.info(`[Assets] ${report.loaded} asset(s) carregado(s).`);
        }
      });
    };

    scheduleBackgroundTick(tick, 120);
  }

  function guardedLoadImages() {
    const report = {
      version: 'asset-load-guard-organized-assets',
      roots: {
        ground: GROUND_TILE_ROOTS,
        vegetation: VEGETATION_TILE_ROOTS,
        mountain: MOUNTAIN_TILE_ROOTS
      },
      startedAt: new Date().toISOString(),
      loaded: 0,
      missing: [],
      recovered: [],
      essentialTotal: 0,
      backgroundTotal: 0,
      backgroundLoaded: 0
    };

    const essentials = essentialAssetNames();
    report.essentialTotal = essentials.length;
    const essentialLoads = essentials.map(name => loadImageSafe(name, assetSources(name), name, report, ESSENTIAL_TIMEOUT_MS));

    return Promise.all(essentialLoads).then(() => {
      report.finishedAt = new Date().toISOString();
      window.HavenfallAssetLoadReport = report;
      const missingEssentials = report.missing.length;
      if (missingEssentials) console.warn(`[Assets] ${missingEssentials} asset(s) essencial(is) ausente(s). O jogo continuará com placeholders.`, report.missing.slice(0, 40));
      runBackgroundAssetLoad(report);
      return report;
    });
  }

  if (typeof loadImages === 'function') {
    window.HavenfallContext.originalLoadImages = loadImages;
    loadImages = guardedLoadImages;
  }

  window.HavenfallNatureAssets = Object.freeze({
    roots: { ground: GROUND_TILE_ROOTS, vegetation: VEGETATION_TILE_ROOTS, mountain: MOUNTAIN_TILE_ROOTS },
    names: organizedAssetNames,
    sourcesFor: assetSources,
    candidates: ORGANIZED_ASSETS
  });

  window.HavenfallAssetLoadGuard = Object.freeze({
    version: 'asset-load-guard-organized-assets',
    guardedLoadImages,
    runBackgroundAssetLoad,
    essentialAssetNames,
    backgroundAssetJobs,
    assetSources
  });
})();
