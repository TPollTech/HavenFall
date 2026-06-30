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

  const VIEW_LIMITS = Object.freeze({
    minZoom: 0.82,
    maxZoom: 2.45,
    maxPanFactor: 0.34
  });

  const view = {
    zoom: 1,
    panX: 0,
    panY: 0,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragOriginX: 0,
    dragOriginY: 0
  };

  let refreshQueued = false;
  let interactionInstalled = false;

  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
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

  function injectStyle() {
    if (document.getElementById('planet-scan-globe-polish-style')) return;
    const style = document.createElement('style');
    style.id = 'planet-scan-globe-polish-style';
    style.textContent = `
      .planet-scan-screen .scan-hologram-panel {
        min-height: 560px;
        display: grid;
        grid-template-rows: 1fr auto;
        place-items: stretch;
        padding: 16px;
      }

      .planet-scan-screen .scan-hologram-panel::after {
        z-index: 8;
        opacity: .28;
        mix-blend-mode: screen;
        pointer-events: none;
      }

      .planet-scan-screen .scan-radar {
        width: 100%;
        height: min(620px, calc(100vh - 118px));
        min-height: 492px;
        aspect-ratio: auto;
        border-radius: 18px;
        cursor: grab;
        background:
          radial-gradient(circle at 50% 45%, rgba(59,130,246,.16), transparent 42%),
          linear-gradient(180deg, rgba(2,6,23,.95), rgba(7,10,24,.98));
        box-shadow: inset 0 0 0 1px rgba(148,163,184,.14);
        overflow: hidden;
      }

      .planet-scan-screen .scan-radar.dragging {
        cursor: grabbing;
      }

      .planet-scan-screen .scan-radar::before,
      .planet-scan-screen .scan-radar::after {
        content: none;
        display: none;
      }

      .planet-scan-screen .scan-planet-canvas {
        inset: 0;
        z-index: 1;
        width: 100%;
        height: 100%;
        opacity: 1;
        filter: saturate(1.08) contrast(1.04);
      }

      .planet-scan-screen .scan-sector-label {
        z-index: 6;
        left: 24px;
        bottom: 138px;
        padding: 6px 8px;
        border-radius: 10px;
        background: rgba(2,6,23,.42);
        backdrop-filter: blur(8px);
      }

      .planet-scan-screen .scan-biome-legend {
        left: 24px;
        right: 24px;
        bottom: 24px;
        z-index: 7;
        grid-template-columns: minmax(0, 1fr);
        justify-items: center;
        pointer-events: none;
      }

      .planet-scan-screen .scan-biome-chip {
        width: min(170px, 100%);
        justify-content: flex-start;
        background: rgba(2,6,23,.58);
        box-shadow: inset 0 0 0 1px rgba(125,211,252,.08);
      }

      .scan-globe-controls {
        position: absolute;
        z-index: 9;
        right: 18px;
        bottom: 18px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        border: 1px solid rgba(125,211,252,.20);
        border-radius: 999px;
        background: rgba(2,6,23,.68);
        backdrop-filter: blur(10px);
        box-shadow: 0 14px 34px rgba(0,0,0,.32);
      }

      .scan-globe-controls button {
        min-width: 34px;
        height: 32px;
        padding: 0 10px;
        border-radius: 999px;
        border: 1px solid rgba(125,211,252,.20);
        background: rgba(15,23,42,.82);
        color: #e5eefc;
        font-weight: 900;
        cursor: pointer;
      }

      .scan-globe-controls button:hover {
        border-color: rgba(250,204,21,.48);
        color: #fef3c7;
      }

      .scan-globe-zoom-label {
        min-width: 48px;
        color: rgba(226,232,240,.86);
        font-size: 11px;
        font-weight: 900;
        text-align: center;
      }

      .scan-globe-help {
        position: absolute;
        z-index: 9;
        left: 18px;
        top: 18px;
        border: 1px solid rgba(125,211,252,.15);
        border-radius: 999px;
        background: rgba(2,6,23,.54);
        color: rgba(226,232,240,.76);
        padding: 7px 10px;
        font-size: 11px;
        pointer-events: none;
        backdrop-filter: blur(8px);
      }

      @media (max-width: 900px) {
        .planet-scan-screen .scan-hologram-panel { min-height: 410px; }
        .planet-scan-screen .scan-radar { min-height: 360px; height: 420px; }
        .planet-scan-screen .scan-sector-label { bottom: 96px; }
        .scan-globe-help { display: none; }
      }
    `;
    document.head.appendChild(style);
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

  function clampPan(canvas) {
    if (!canvas) return;
    const maxPan = Math.max(0, Math.min(canvas.width, canvas.height) * VIEW_LIMITS.maxPanFactor * (view.zoom - 1));
    view.panX = clamp(view.panX, -maxPan, maxPan);
    view.panY = clamp(view.panY, -maxPan, maxPan);
  }

  function zoomBy(delta, anchor = null) {
    const canvas = document.getElementById('scanPlanetCanvas');
    const oldZoom = view.zoom;
    view.zoom = clamp(view.zoom + delta, VIEW_LIMITS.minZoom, VIEW_LIMITS.maxZoom);
    const ratio = oldZoom > 0 ? view.zoom / oldZoom : 1;

    if (anchor && canvas) {
      const rect = canvas.getBoundingClientRect();
      const ax = anchor.clientX - rect.left - rect.width / 2;
      const ay = anchor.clientY - rect.top - rect.height / 2;
      view.panX = (view.panX - ax) * ratio + ax;
      view.panY = (view.panY - ay) * ratio + ay;
    }

    clampPan(canvas);
    renderScanGlobe();
  }

  function resetView() {
    view.zoom = 1;
    view.panX = 0;
    view.panY = 0;
    renderScanGlobe();
  }

  function ensureGlobeControls(radar) {
    if (!radar || radar.querySelector('.scan-globe-controls')) return;

    const help = document.createElement('div');
    help.className = 'scan-globe-help';
    help.textContent = 'Scroll: zoom · arraste: mover';
    radar.appendChild(help);

    const controls = document.createElement('div');
    controls.className = 'scan-globe-controls';
    controls.innerHTML = `
      <button type="button" data-scan-zoom="out" aria-label="Diminuir zoom do globo">−</button>
      <span class="scan-globe-zoom-label" data-scan-zoom-label>100%</span>
      <button type="button" data-scan-zoom="in" aria-label="Aumentar zoom do globo">+</button>
      <button type="button" data-scan-zoom="reset" aria-label="Resetar zoom do globo">Reset</button>
    `;
    radar.appendChild(controls);
  }

  function updateZoomLabel() {
    const label = document.querySelector('[data-scan-zoom-label]');
    if (label) label.textContent = `${Math.round(view.zoom * 100)}%`;
  }

  function renderScanGlobe() {
    injectStyle();
    const canvas = document.getElementById('scanPlanetCanvas');
    const radar = document.querySelector('.scan-radar');
    const renderer = window.HavenfallPlanetGlobeRenderer;
    if (!canvas || !renderer?.drawGlobe || !renderer?.createScanPreview) return false;

    ensureGlobeControls(radar);
    installInteraction();

    const cfg = activeConfig();
    const preview = renderer.createScanPreview(cfg, cfg.planetScan || null);
    const selected = preview.landingSites?.[0] || null;

    clampPan(canvas);
    const width = Math.max(canvas.width || 1, 1);
    const height = Math.max(canvas.height || 1, 1);
    const detailZoom = view.zoom >= 1.18;

    renderer.drawGlobe(canvas, preview, selected, {
      minWidth: 520,
      minHeight: 492,
      minRadius: 150,
      radiusWidthFactor: 0.42 * view.zoom,
      radiusHeightFactor: 0.44 * view.zoom,
      centerX: 0.5 + view.panX / width,
      centerY: 0.5 + view.panY / height,
      showRoutes: false,
      showLabels: detailZoom,
      showGlyphs: true,
      seed: cfg.seed || 'havenfall-scan'
    });

    updateZoomLabel();
    return true;
  }

  function installInteraction() {
    if (interactionInstalled) return;
    const radar = document.querySelector('.scan-radar');
    if (!radar) return;
    interactionInstalled = true;

    radar.addEventListener('wheel', event => {
      event.preventDefault();
      const direction = event.deltaY > 0 ? -0.11 : 0.11;
      zoomBy(direction, event);
    }, { passive: false });

    radar.addEventListener('pointerdown', event => {
      if (event.target.closest?.('.scan-globe-controls')) return;
      view.dragging = true;
      view.dragStartX = event.clientX;
      view.dragStartY = event.clientY;
      view.dragOriginX = view.panX;
      view.dragOriginY = view.panY;
      radar.classList.add('dragging');
      radar.setPointerCapture?.(event.pointerId);
    });

    radar.addEventListener('pointermove', event => {
      if (!view.dragging) return;
      view.panX = view.dragOriginX + event.clientX - view.dragStartX;
      view.panY = view.dragOriginY + event.clientY - view.dragStartY;
      clampPan(document.getElementById('scanPlanetCanvas'));
      renderScanGlobe();
    });

    const stopDragging = event => {
      if (!view.dragging) return;
      view.dragging = false;
      radar.classList.remove('dragging');
      radar.releasePointerCapture?.(event.pointerId);
    };
    radar.addEventListener('pointerup', stopDragging);
    radar.addEventListener('pointercancel', stopDragging);
    radar.addEventListener('lostpointercapture', () => {
      view.dragging = false;
      radar.classList.remove('dragging');
    });

    radar.addEventListener('click', event => {
      const button = event.target.closest?.('[data-scan-zoom]');
      if (!button) return;
      const action = button.dataset.scanZoom;
      if (action === 'in') zoomBy(0.18);
      else if (action === 'out') zoomBy(-0.18);
      else resetView();
    });
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
    injectStyle();
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
