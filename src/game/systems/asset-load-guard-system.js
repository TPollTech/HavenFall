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
  const ORGANIZED_TILE_ROOT = 'assets/tiles/Tiles do chão';
  const LEGACY_TILE_ROOT = 'assets/tiles';
  const CRITICAL_BOOT_ASSETS = Object.freeze([
    'tile_grass', 'tile_dirt', 'tile_sand', 'tile_stone',
    'tree', 'bush', 'rock', 'logs', 'berry',
    'bed_single', 'crate_wood', 'campfire',
    'icon_food', 'icon_wood', 'icon_stone', 'icon_metal', 'icon_warn'
  ]);

  const NATURE_ASSET_CANDIDATES = Object.freeze({
    tile_grass: ['tile_grass.png', 'grass.png', 'grama.png', 'tile_grama.png', 'edificios_tile_grass_1.png', 'edificios_tile_grass_2.png'],
    tile_dirt: ['tile_dirt.png', 'dirt.png', 'terra.png', 'chao_batido.png', 'chão_batido.png', 'edificios_tile_dirt_1.png', 'edificios_tile_dirt_2.png'],
    tile_sand: ['tile_sand.png', 'sand.png', 'areia.png', 'edificios_tile_sand_1.png', 'edificios_tile_sand_2.png'],
    tile_stone: ['tile_stone.png', 'stone.png', 'pedra.png', 'rocky.png', 'edificios_tile_stone_1.png', 'edificios_tile_stone_2.png', 'edificios_tile_rocky_1.png', 'edificios_tile_rocky_2.png'],
    tree: ['tree.png', 'arvore.png', 'árvore.png', 'carvalho.png', 'oak.png', 'tree_oak.png', 'oak_tree.png'],
    tree_oak: ['tree_oak.png', 'oak_tree.png', 'carvalho.png', 'arvore_carvalho.png', 'árvore_carvalho.png', 'oak.png'],
    tree_birch: ['tree_birch.png', 'birch_tree.png', 'betula.png', 'bétula.png', 'arvore_betula.png'],
    tree_pine: ['tree_pine.png', 'pine_tree.png', 'pinheiro.png', 'arvore_pinheiro.png', 'conifer.png'],
    tree_palm: ['tree_palm.png', 'palm_tree.png', 'palmeira.png', 'coqueiro.png'],
    tree_willow: ['tree_willow.png', 'willow_tree.png', 'salgueiro.png'],
    tree_eucalyptus: ['tree_eucalyptus.png', 'eucalyptus_tree.png', 'eucalipto.png', 'eucalyptus.png', 'arvore_eucalipto.png'],
    bush: ['bush.png', 'arbusto.png', 'bush_dense.png', 'arbusto_denso.png'],
    bush_dense: ['bush_dense.png', 'arbusto_denso.png', 'bush.png', 'arbusto.png'],
    bush_dry: ['bush_dry.png', 'arbusto_seco.png', 'dry_bush.png', 'bush.png'],
    berry: ['berry.png', 'berry_bush.png', 'frutas_silvestres.png', 'arbusto_frutas.png', 'res_berries.png'],
    rock: ['rock.png', 'pedra.png', 'rocha.png', 'mountain_inner.svg'],
    logs: ['logs.png', 'toras.png', 'madeira.png']
  });

  function natureAssetNames() {
    return Object.keys(NATURE_ASSET_CANDIDATES);
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

  function prefixedCandidate(path) {
    if (!path) return null;
    if (/^(https?:|data:|assets\/)/.test(path)) return path;
    return `${ORGANIZED_TILE_ROOT}/${path}`;
  }

  function organizedTileCandidates(name) {
    const key = String(name || '');
    const candidates = NATURE_ASSET_CANDIDATES[key];
    if (!candidates?.length) return [];
    const direct = candidates.map(prefixedCandidate).filter(Boolean);
    const legacy = candidates.map(item => /^(https?:|data:|assets\/)/.test(item) ? item : `${LEGACY_TILE_ROOT}/${item}`).filter(Boolean);
    return [...direct, ...legacy];
  }

  function assetSources(name) {
    const key = String(name || '');
    const sources = [];
    const entry = manifestEntry(key);
    if (entry?.path) sources.push(entry.path);
    sources.push(...organizedTileCandidates(key));
    if (typeof spriteSrc === 'function') sources.push(spriteSrc(key));
    sources.push(`assets/ui/${key}.png`);
    return [...new Set(sources.filter(Boolean))];
  }

  function assetSource(name) {
    return assetSources(name)[0] || null;
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
    return unique([...names, ...natureAssetNames()]).filter(name => !shouldSkipAsset(name));
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
      .filter(name => !essential.has(name) && !shouldSkipAsset(name))
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
      version: 'asset-load-guard-organized-tiles-v1',
      organizedTileRoot: ORGANIZED_TILE_ROOT,
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
    root: ORGANIZED_TILE_ROOT,
    names: natureAssetNames,
    sourcesFor: assetSources,
    candidates: NATURE_ASSET_CANDIDATES
  });

  window.HavenfallAssetLoadGuard = Object.freeze({
    version: 'asset-load-guard-organized-tiles-v1',
    guardedLoadImages,
    runBackgroundAssetLoad,
    essentialAssetNames,
    backgroundAssetJobs,
    assetSources
  });
})();
