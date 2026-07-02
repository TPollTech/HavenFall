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
  const CRITICAL_BOOT_ASSETS = Object.freeze([
    'tile_grass', 'tile_dirt', 'tile_sand', 'tile_stone',
    'tree', 'bush', 'rock', 'logs', 'berry',
    'bed_single', 'crate_wood', 'campfire',
    'icon_food', 'icon_wood', 'icon_stone', 'icon_metal', 'icon_warn'
  ]);

  function fallbackImage(name, src) {
    const img = new Image();
    img.dataset.missingAsset = String(name || 'unknown');
    img.dataset.originalSrc = String(src || '');
    img.src = FALLBACK_PIXEL;
    return img;
  }

  function manifestEntry(name) {
    return window.HavenfallAssets?.assets?.[String(name || '')] || null;
  }

  function assetSource(name) {
    const entry = manifestEntry(name);
    if (entry?.path) return entry.path;
    if (typeof spriteSrc === 'function') return spriteSrc(name);
    return `assets/ui/${name}.png`;
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
    return new Promise(resolve => {
      if (!src) {
        images[targetKey] = fallbackImage(name, src);
        report.missing.push({ name, src, reason: 'empty-src' });
        resolve({ ok: false, name, src, reason: 'empty-src' });
        return;
      }

      const img = new Image();
      let settled = false;
      const finish = result => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const timer = setTimeout(() => {
        images[targetKey] = fallbackImage(name, src);
        report.missing.push({ name, src, reason: 'timeout' });
        finish({ ok: false, name, src, reason: 'timeout' });
      }, timeoutMs);

      img.onload = () => {
        clearTimeout(timer);
        images[targetKey] = img;
        report.loaded += 1;
        finish({ ok: true, name, src });
      };
      img.onerror = () => {
        clearTimeout(timer);
        images[targetKey] = fallbackImage(name, src);
        report.missing.push({ name, src, reason: 'error' });
        finish({ ok: false, name, src, reason: 'error' });
      };
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = src;
    });
  }

  function manifestAssetNames() {
    return Object.keys(window.HavenfallAssets?.assets || {});
  }

  function baseAssetNames() {
    const names = Array.isArray(window.assetNames) ? window.assetNames : (typeof assetNames !== 'undefined' ? assetNames : []);
    return unique(names).filter(name => !shouldSkipAsset(name));
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
      .map(name => ({ name, src: assetSource(name), key: name }));

    const manifestJobs = manifestAssetNames()
      .filter(name => !essential.has(name) && !shouldSkipAsset(name))
      .map(name => ({ name, src: assetSource(name), key: name }));

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
      version: 'asset-load-guard-farming-boot',
      startedAt: new Date().toISOString(),
      loaded: 0,
      missing: [],
      essentialTotal: 0,
      backgroundTotal: 0,
      backgroundLoaded: 0
    };

    const essentials = essentialAssetNames();
    report.essentialTotal = essentials.length;
    const essentialLoads = essentials.map(name => loadImageSafe(name, assetSource(name), name, report, ESSENTIAL_TIMEOUT_MS));

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

  window.HavenfallAssetLoadGuard = Object.freeze({
    version: 'asset-load-guard-farming-boot',
    guardedLoadImages,
    runBackgroundAssetLoad,
    essentialAssetNames,
    backgroundAssetJobs
  });
})();
