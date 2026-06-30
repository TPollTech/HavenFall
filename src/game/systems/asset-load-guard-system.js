'use strict';

(() => {
  if (window.HavenfallContext?.assetLoadGuardInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.assetLoadGuardInstalled = true;

  const FALLBACK_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  const TIMEOUT_MS = 7000;

  function fallbackImage(name, src) {
    const img = new Image();
    img.dataset.missingAsset = String(name || 'unknown');
    img.dataset.originalSrc = String(src || '');
    img.src = FALLBACK_PIXEL;
    return img;
  }

  function assetSource(name) {
    if (typeof spriteSrc === 'function') return spriteSrc(name);
    return `assets/ui/${name}.png`;
  }

  function shouldSkipAsset(name) {
    return typeof isProceduralRuntimeAsset === 'function' && isProceduralRuntimeAsset(name);
  }

  function loadImageSafe(name, src, targetKey, report) {
    return new Promise(resolve => {
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
      }, TIMEOUT_MS);

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
      img.src = src;
    });
  }

  function guardedLoadImages() {
    const manifestAssetNames = Object.keys(window.HavenfallAssets?.assets || {});
    const baseAssetNames = Array.isArray(window.assetNames) ? window.assetNames : (typeof assetNames !== 'undefined' ? assetNames : []);
    const runtimeAssetNames = [...new Set([...baseAssetNames, ...manifestAssetNames])].filter(name => !shouldSkipAsset(name));
    const report = {
      version: 'asset-load-guard-v1',
      startedAt: new Date().toISOString(),
      loaded: 0,
      missing: []
    };

    const spriteLoads = runtimeAssetNames.map(name => loadImageSafe(name, assetSource(name), name, report));
    const animationLoads = Object.entries(window.HavenfallAssets?.animations || {})
      .filter(([key, animation]) => !shouldSkipAsset(key) && !shouldSkipAsset(animation?.key))
      .map(([key, animation]) => loadImageSafe(key, animation.path, `vfx:${key}`, report));

    return Promise.all([...spriteLoads, ...animationLoads]).then(() => {
      report.finishedAt = new Date().toISOString();
      window.HavenfallAssetLoadReport = report;
      if (report.missing.length) console.warn(`[Assets] ${report.missing.length} asset(s) ausente(s). O jogo continuará com placeholders.`, report.missing.slice(0, 40));
      else console.info(`[Assets] ${report.loaded} asset(s) carregado(s).`);
      return report;
    });
  }

  if (typeof loadImages === 'function') {
    window.HavenfallContext.originalLoadImages = loadImages;
    loadImages = guardedLoadImages;
  }

  window.HavenfallAssetLoadGuard = Object.freeze({
    version: 'asset-load-guard-v1',
    guardedLoadImages
  });
})();
