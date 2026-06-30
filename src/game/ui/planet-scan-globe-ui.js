'use strict';

(() => {
  if (window.HavenfallContext?.planetScanGlobeUiInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.planetScanGlobeUiInstalled = true;

  const COPY = Object.freeze({
    label: 'Reconhecimento Orbital',
    title: 'Análise Orbital de Setor',
    description: 'Leitura orbital do setor que será usado pela geração do mapa, clima, recursos e pontos de interesse.',
    next: 'Reconhecimento orbital',
    button: 'Abrir Reconhecimento Orbital',
    refresh: 'Gerar outro setor',
    status: 'Leitura pronta'
  });

  let refreshQueued = false;

  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  function activeConfig() {
    const base = (typeof newGameConfig !== 'undefined' && newGameConfig)
      || (typeof readNewGameConfigSafe === 'function' ? readNewGameConfigSafe() : null)
      || (typeof defaultNewGameConfig !== 'undefined' ? defaultNewGameConfig : {});
    if (typeof ensurePlanetScanOnConfig === 'function') {
      const next = ensurePlanetScanOnConfig(base);
      if (typeof newGameConfig !== 'undefined') newGameConfig = next;
      return next;
    }
    return base;
  }

  function renameCopy() {
    setText(document.querySelector('.setup-next-step b'), COPY.next);
    setText(document.getElementById('setupNextBtn'), COPY.button);

    const scanTitleRow = document.querySelector('#planetScanScreen .scan-title-row');
    setText(scanTitleRow?.querySelector('.kicker'), COPY.label);
    setText(scanTitleRow?.querySelector('h1'), COPY.title);
    setText(scanTitleRow?.querySelector('p'), COPY.description);
    setText(document.querySelector('#planetScanScreen .scan-status-pill'), COPY.status);
    setText(document.getElementById('scanRefreshBtn'), COPY.refresh);
    setText(document.querySelector('#scanCustomizationPanel h3'), 'Parâmetros orbitais');
    setText(document.querySelector('#scanWorldPreviewCard h3'), 'Prévia técnica do terreno');
  }

  function renderScanGlobe() {
    const canvas = document.getElementById('scanPlanetCanvas');
    const renderer = window.HavenfallPlanetGlobeRenderer;
    if (!canvas || !renderer?.drawGlobe || !renderer?.createScanPreview) return false;

    const cfg = activeConfig();
    const preview = renderer.createScanPreview(cfg, cfg.planetScan || null);
    const selected = preview.landingSites?.[0] || null;

    renderer.drawGlobe(canvas, preview, selected, {
      minWidth: 420,
      minHeight: 420,
      minRadius: 130,
      radiusWidthFactor: 0.43,
      radiusHeightFactor: 0.43,
      showRoutes: false,
      showLabels: false,
      showGlyphs: true,
      seed: cfg.seed || 'havenfall-scan'
    });
    return true;
  }

  function patchRefresh() {
    if (typeof window.refreshPlanetScan !== 'function' || window.refreshPlanetScan.__havenfallGlobePatched) return;
    const original = window.refreshPlanetScan;
    function patchedRefreshPlanetScan(config = null) {
      const result = original(config);
      renameCopy();
      renderScanGlobe();
      return result;
    }
    patchedRefreshPlanetScan.__havenfallGlobePatched = true;
    window.refreshPlanetScan = patchedRefreshPlanetScan;
  }

  function refreshNow() {
    refreshQueued = false;
    renameCopy();
    patchRefresh();
    renderScanGlobe();
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(refreshNow);
  }

  document.addEventListener('DOMContentLoaded', queueRefresh);
  window.addEventListener('resize', () => {
    if (document.getElementById('planetScanScreen')?.classList.contains('active')) queueRefresh();
  });

  if (document.documentElement) {
    const observer = new MutationObserver(queueRefresh);
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  queueRefresh();
})();
