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

  const MARKER_COLORS = Object.freeze({
    safe: '#22c55e',
    favorable: '#86efac',
    moderate: '#38bdf8',
    hard: '#fb923c',
    extreme: '#ef4444'
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
        position: relative;
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
        position: absolute;
        inset: 0;
        z-index: 1;
        width: 100%;
        height: 100%;
        opacity: 1;
        filter: saturate(1.08) contrast(1.04);
        pointer-events: none;
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

      /* Marcadores clicáveis que acompanham zoom/pan */
      .globe-marker-container {
        position: absolute;
        inset: 0;
        z-index: 5;
        pointer-events: none;
        overflow: visible;
      }

      .globe-spawn-marker {
        position: absolute;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: 1px solid rgba(255,255,255,.82);
        background: radial-gradient(circle, #fff 0 15%, var(--c, #38bdf8) 28% 58%, rgba(56,189,248,.12) 70%);
        box-shadow: 0 0 20px var(--c, #38bdf8);
        cursor: pointer;
        pointer-events: all;
        transform: translate(-50%, -50%);
        transition: width .16s, height .16s, filter .16s;
        animation: globeMarkerPulse 2.6s ease-in-out infinite;
      }

      .globe-spawn-marker:hover {
        width: 25px;
        height: 25px;
        filter: brightness(1.25);
      }

      .globe-spawn-marker.selected {
        width: 32px;
        height: 32px;
        border-color: #fff7ed;
        background: radial-gradient(circle, #fff7ed 0 14%, #facc15 26% 54%, rgba(250,204,21,.16) 70%);
        box-shadow: 0 0 36px rgba(250,204,21,.95), 0 0 0 8px rgba(250,204,21,.08);
      }

      .globe-spawn-marker.selected::after {
        content: '';
        position: absolute;
        inset: -13px;
        border-radius: inherit;
        border: 2px solid rgba(250,204,21,.52);
        animation: globeMarkerRing 1.8s ease-out infinite;
      }

      .globe-spawn-label {
        position: absolute;
        color: rgba(226,232,240,.86);
        font-size: 10px;
        font-weight: 800;
        text-shadow: 0 2px 8px rgba(0,0,0,.85);
        white-space: nowrap;
        pointer-events: none;
        transform: translate(-50%, 12px);
        opacity: 0;
        transition: opacity .12s;
      }

      .globe-spawn-label.visible {
        opacity: 1;
      }

      .globe-tooltip {
        position: fixed;
        z-index: 99999;
        max-width: 280px;
        min-width: 220px;
        pointer-events: none;
        opacity: 0;
        transition: opacity .12s, transform .12s;
        transform: translateY(4px);
        border: 1px solid rgba(125,211,252,.28);
        background: linear-gradient(180deg, rgba(2,6,23,.96), rgba(15,23,42,.96));
        border-radius: 14px;
        padding: 12px;
        box-shadow: 0 18px 42px rgba(0,0,0,.48);
        color: #e5eefc;
      }

      .globe-tooltip.show {
        opacity: 1;
        transform: translateY(0);
      }

      .globe-tooltip b { display: block; color: #fff; margin-bottom: 3px; }
      .globe-tooltip small { display: block; color: rgba(203,213,225,.78); line-height: 1.45; }

      @keyframes globeMarkerPulse {
        50% { filter: brightness(1.18); transform: translate(-50%, -50%) scale(1.08); }
      }
      @keyframes globeMarkerRing {
        from { transform: scale(.86); opacity: .82; }
        to { transform: scale(1.24); opacity: 0; }
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

  function esc(v) {
    if (typeof escapeHtml === 'function') return escapeHtml(v);
    return String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&','<':'<','>':'>','"':'"',"'":'&#039;'}[ch]));
  }

  function siteTier(site) {
    return site?.difficulty?.tier || 'moderate';
  }

  function siteColor(site) {
    return MARKER_COLORS[siteTier(site)] || MARKER_COLORS.moderate;
  }

  function avgScore(obj) {
    const vals = Object.values(obj || {});
    return Math.round(vals.reduce((s, v) => s + Number(v || 0), 0) / Math.max(1, vals.length));
  }

  function ensureMarkerContainer(radar) {
    let container = radar.querySelector('.globe-marker-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'globe-marker-container';
      radar.appendChild(container);
    }
    return container;
  }

  function ensureTooltip() {
    let el = document.getElementById('globeMarkerTooltip');
    if (!el) {
      el = document.createElement('div');
      el.id = 'globeMarkerTooltip';
      el.className = 'globe-tooltip';
      document.body.appendChild(el);
    }
    return el;
  }

  function renderMarkers(sites, selectedId, scale) {
    const radar = document.querySelector('.scan-radar');
    if (!radar || !scale) return;

    const container = ensureMarkerContainer(radar);
    container.innerHTML = '';
    const renderer = window.HavenfallPlanetGlobeRenderer;
    if (!renderer?.pointForSite) return;

    const tooltip = ensureTooltip();
    const canvas = document.getElementById('scanPlanetCanvas');

    sites.forEach(site => {
      // Usa o MESMO pointForSite do renderer com o MESMO scale
      // Isso garante posição pixel-perfeita igual ao canvas
      const p = renderer.pointForSite(site, scale);
      const isSelected = site.id === selectedId;
      const c = siteColor(site);
      const tier = siteTier(site);

      // Cria o marcador (bolinha clicável)
      const marker = document.createElement('button');
      marker.type = 'button';
      marker.className = `globe-spawn-marker ${tier}${isSelected ? ' selected' : ''}`;
      marker.style.left = p.x + 'px';
      marker.style.top = p.y + 'px';
      marker.style.setProperty('--c', c);
      marker.dataset.siteId = site.id;
      marker.setAttribute('aria-label', `Selecionar ${site.name}`);

      // Cria o label
      const label = document.createElement('span');
      label.className = `globe-spawn-label${isSelected || sites.length <= 12 ? ' visible' : ''}`;
      label.style.left = p.x + 'px';
      label.style.top = p.y + 'px';
      label.textContent = site.name;

      // Evento de seleção
      const selectSite = ev => {
        ev.preventDefault();
        ev.stopPropagation();
        if (typeof window.selectLandingSite === 'function') {
          window.selectLandingSite(site.id);
        }
      };

      marker.addEventListener('pointerdown', selectSite);
      marker.addEventListener('click', selectSite);

      // Hover: tooltip + label
      marker.addEventListener('pointerenter', () => {
        if (!label.classList.contains('visible')) label.classList.add('visible');
        const score = Number(site.difficulty?.score || 0);
        tooltip.innerHTML = `<b>${esc(site.name)}</b><small>${esc(site.labels?.subtitle || '')}<br>Score ${score}/100 · Risco ${avgScore(site.risks)} · Recursos ${avgScore(site.resources)}</small>`;
      });

      marker.addEventListener('pointermove', ev => {
        tooltip.style.left = (ev.clientX + 16) + 'px';
        tooltip.style.top = (ev.clientY + 16) + 'px';
        tooltip.classList.add('show');
      });

      marker.addEventListener('pointerleave', () => {
        tooltip.classList.remove('show');
        if (!label.classList.contains('visible') && !isSelected) {
          label.classList.remove('visible');
        }
      });

      container.appendChild(marker);
      container.appendChild(label);
    });
  }

  function renderScanGlobe() {
    injectStyle();
    const canvas = document.getElementById('scanPlanetCanvas');
    const radar = document.querySelector('.scan-radar');
    const renderer = window.HavenfallPlanetGlobeRenderer;
    if (!canvas || !renderer?.drawGlobe || !renderer?.createScanPreview) return false;

    ensureGlobeControls(radar);
    installInteraction();

    // Remove marcadores HTML legados de outros sistemas
    if (radar) {
      radar.querySelectorAll('.landing-site-marker, .landing-site-label').forEach(el => el.remove());
    }

    const cfg = activeConfig();
    const preview = renderer.createScanPreview(cfg, cfg.planetScan || null);
    const selected = preview.landingSites?.[0] || null;

    clampPan(canvas);
    const width = Math.max(canvas.width || 1, 1);
    const height = Math.max(canvas.height || 1, 1);

    // drawGlobe RETORNA o scale! Usamos ele para posicionar os marcadores
    const scale = renderer.drawGlobe(canvas, preview, selected, {
      minWidth: 520,
      minHeight: 492,
      minRadius: 150,
      radiusWidthFactor: 0.42 * view.zoom,
      radiusHeightFactor: 0.44 * view.zoom,
      centerX: 0.5 + view.panX / width,
      centerY: 0.5 + view.panY / height,
      showRoutes: false,
      showLabels: false,
      showGlyphs: false,
      seed: cfg.seed || 'havenfall-scan'
    });

    // Renderiza marcadores HTML usando o MESMO scale do desenho
    const sites = preview.landingSites || [];
    const selectedId = selected?.id || null;
    renderMarkers(sites, selectedId, scale);

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
      if (event.target.closest?.('.globe-spawn-marker')) return;
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
      if (event.target.closest?.('.globe-spawn-marker')) return;
      const button = event.target.closest?.('[data-scan-zoom]');
      if (!button) return;
      const action = button.dataset.scanZoom;
      if (action === 'in') zoomBy(0.18);
      else if (action === 'out') zoomBy(-0.18);
      else resetView();
    });
  }

  function patchRefresh() {
    const original = window.refreshPlanetScan;
    if (typeof original !== 'function') return;
    if (original.__havenfallGlobePatched) return;

    function patchedRefreshPlanetScan(config = null) {
      const isRefresh = config === undefined || config === null;
      const result = original(config);

      const radar = document.querySelector('.scan-radar');
      if (radar) {
        radar.querySelectorAll('.landing-site-marker, .landing-site-label').forEach(el => el.remove());
      }

      if (isRefresh) {
        view.zoom = 1;
        view.panX = 0;
        view.panY = 0;
      }

      renameCopy();
      renderScanGlobe();
      return result;
    }
    patchedRefreshPlanetScan.__havenfallGlobePatched = true;
    window.refreshPlanetScan = patchedRefreshPlanetScan;
  }

  function ensureLastPatch() {
    const current = window.refreshPlanetScan;
    if (current && !current.__havenfallGlobePatched) {
      patchRefresh();
    }
  }

  function silenceLegacySystems() {
    // Bloqueia drawPlanet do sistema legado (landing-site-scan-polish)
    if (typeof window.drawPlanet === 'function' && !window.drawPlanet.__havenfallSilenced) {
      const original = window.drawPlanet;
      window.drawPlanet = function(...args) {
        const canvas = document.getElementById('scanPlanetCanvas');
        if (canvas && canvas.parentElement?.classList.contains('scan-radar')) {
          return;
        }
        return original(...args);
      };
      window.drawPlanet.__havenfallSilenced = true;
    }

    // Bloqueia ensureCanvas do sistema legado que força 520x520
    // e também adiciona scan-atmosphere e scan-orbit-ring que poluem o radar
    if (typeof window.ensureCanvas === 'function' && !window.ensureCanvas.__havenfallSilenced) {
      const original = window.ensureCanvas;
      window.ensureCanvas = function(...args) {
        const canvas = document.getElementById('scanPlanetCanvas');
        if (canvas && canvas.parentElement?.classList.contains('scan-radar')) {
          return canvas; // Retorna o canvas existente sem modificar
        }
        return original(...args);
      };
      window.ensureCanvas.__havenfallSilenced = true;
    }

    // Remove elementos atmosféricos e rings que o polish adiciona
    // e conflitam com o fundo do novo globo
    const radar = document.querySelector('.scan-radar');
    if (radar) {
      radar.querySelectorAll('.scan-atmosphere, .scan-orbit-ring').forEach(el => el.remove());
    }
  }

  function refreshNow() {
    refreshQueued = false;
    injectStyle();
    renameCopy();
    silenceLegacySystems();
    patchRefresh();
    renderScanGlobe();
  }

  function hardRefreshWithReset() {
    injectStyle();
    renameCopy();
    silenceLegacySystems();
    patchRefresh();
    view.zoom = 1;
    view.panX = 0;
    view.panY = 0;
    renderScanGlobe();
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(refreshNow);
  }

  function watchRefreshButton() {
    const btn = document.getElementById('scanRefreshBtn');
    if (btn && !btn.__havenfallWatched) {
      btn.__havenfallWatched = true;
      btn.addEventListener('click', () => {
        setTimeout(hardRefreshWithReset, 50);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    queueRefresh();
    watchRefreshButton();
  });
  window.addEventListener('resize', () => {
    if (document.getElementById('planetScanScreen')?.classList.contains('active')) queueRefresh();
  });

  if (document.documentElement) {
    const observer = new MutationObserver(() => {
      queueRefresh();
      ensureLastPatch();
      watchRefreshButton();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  queueRefresh();
  watchRefreshButton();
})();