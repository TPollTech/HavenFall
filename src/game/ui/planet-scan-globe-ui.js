'use strict';

(() => {
  if (window.HavenfallContext?.planetScanGlobeUiInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.planetScanGlobeUiInstalled = true;

  const TIER_COLORS = Object.freeze({
    favorable: '#86efac',
    safe: '#22c55e',
    moderate: '#38bdf8',
    hard: '#fb923c',
    extreme: '#ef4444'
  });

  let layoutBound = false;
  let renderQueued = false;

  function esc(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[char]);
  }

  function refs() {
    const screen = document.getElementById('planetScanScreen');
    if (!screen) return null;
    ensureLayout(screen);
    return {
      screen,
      stage: screen.querySelector('.scan-stage'),
      globe: document.getElementById('scanGlobeStage'),
      label: document.getElementById('scanRadarLabel'),
      topBar: document.getElementById('scanTopBar'),
      detailPanel: document.getElementById('scanDetailPanel'),
      detailClose: document.getElementById('scanDetailCloseBtn')
    };
  }

  function ensureLayout(screen) {
    if (screen.dataset.stageRebuilt === 'true') return;

    const oldShell = screen.querySelector('.planet-scan-shell');
    const backButton = document.getElementById('scanBackBtn');
    const refreshButton = document.getElementById('scanRefreshBtn');
    const proceedButton = document.getElementById('scanProceedBtn');

    backButton?.remove();
    refreshButton?.remove();
    proceedButton?.remove();
    oldShell?.remove();

    const stage = document.createElement('div');
    stage.className = 'scan-stage';
    stage.innerHTML = `
      <div id="scanGlobeStage" class="scan-stage-globe" aria-label="Globo orbital interativo">
        <div id="scanRadarLabel" class="scan-sector-label"><span>SETOR</span><b>HV-00000</b></div>
      </div>
      <div class="scan-stage-overlay">
        <header id="scanTopBar" class="scan-top-bar">
          <div class="scan-top-copy">
            <div class="kicker">Analise orbital</div>
            <h1 id="scanSectorTitle">Analise de Setor</h1>
            <p id="scanSectorMeta">Selecione um ponto para abrir os detalhes do pouso.</p>
          </div>
          <div class="scan-top-actions"></div>
        </header>
        <div id="scanSelectionHint" class="scan-selection-hint" aria-live="polite"></div>
      </div>
      <div id="scanDetailHost" class="scan-detail-host">
        <aside id="scanDetailPanel" class="scan-detail-drawer" aria-live="polite">
          <div class="scan-detail-shell">
            <div class="scan-detail-toolbar">
              <div class="kicker">Ponto selecionado</div>
              <button id="scanDetailCloseBtn" type="button" class="secondary">Fechar</button>
            </div>
            <div id="scanDetailContent" class="scan-detail-content"></div>
            <div class="scan-detail-actions"></div>
          </div>
        </aside>
      </div>`;

    screen.replaceChildren(stage);
    const topActions = stage.querySelector('.scan-top-actions');
    const detailActions = stage.querySelector('.scan-detail-actions');
    if (topActions && backButton) topActions.append(backButton);
    if (topActions && refreshButton) topActions.append(refreshButton);
    if (detailActions && proceedButton) detailActions.append(proceedButton);
    screen.dataset.stageRebuilt = 'true';
  }

  function ensureCanvas(globe) {
    if (!globe) return null;
    let canvas = document.getElementById('scanPlanetCanvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'scanPlanetCanvas';
      canvas.className = 'scan-planet-canvas';
      globe.prepend(canvas);
    }
    return canvas;
  }

  function ensureMarkerLayer(globe) {
    let layer = globe.querySelector('.scan-marker-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'scan-marker-layer';
      globe.appendChild(layer);
    }
    return layer;
  }

  function markerColor(site) {
    return TIER_COLORS[site?.difficulty?.tier] || TIER_COLORS.moderate;
  }

  function worldMap(profile, site) {
    return {
      planetSeed: profile?.seed || 'havenfall-scan',
      currentSiteId: site?.id || null,
      landingSites: profile?.landingSites || [],
      routes: []
    };
  }

  function renderMarkerLayer(globe, scale, profile, selectedSite) {
    const layer = ensureMarkerLayer(globe);
    const renderer = window.HavenfallPlanetGlobeRenderer;
    if (!layer || !renderer?.pointForSite) return;

    const sites = profile?.landingSites || [];
    const selectedId = selectedSite?.id || null;
    layer.replaceChildren();

    for (const site of sites) {
      const point = renderer.pointForSite(site, scale);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `scan-globe-marker${site.id === selectedId ? ' selected' : ''}`;
      button.style.left = `${point.x}px`;
      button.style.top = `${point.y}px`;
      button.style.setProperty('--marker-color', markerColor(site));
      button.dataset.siteId = site.id;
      button.title = `${site.name} • ${site.difficulty?.label || 'Moderado'} • score ${Number(site.difficulty?.score || 0)}`;
      button.setAttribute('aria-label', `Selecionar ${site.name}`);
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        window.selectLandingSite?.(site.id);
      });

      const label = document.createElement('span');
      label.className = `scan-globe-marker-label${site.id === selectedId ? ' visible' : ''}`;
      label.style.left = `${point.x}px`;
      label.style.top = `${point.y}px`;
      label.textContent = site.name;

      button.addEventListener('pointerenter', () => label.classList.add('visible'));
      button.addEventListener('pointerleave', () => {
        if (site.id !== selectedId) label.classList.remove('visible');
      });

      layer.append(button, label);
    }
  }

  function renderRadarLabel(label, profile, site) {
    if (!label) return;
    const sector = profile?.sectorId || 'HV-00000';
    const status = site ? site.name : 'Sem pouso travado';
    label.innerHTML = `<span>${esc(sector)}</span><b>${esc(status)}</b>`;
  }

  function bindLayoutEvents() {
    if (layoutBound) return;
    layoutBound = true;

    document.addEventListener('click', event => {
      const screen = document.getElementById('planetScanScreen');
      if (!screen?.classList.contains('active')) return;
      const panel = document.getElementById('scanDetailPanel');
      if (!panel?.classList.contains('is-open')) return;
      if (event.target.closest('#scanDetailPanel, #scanTopBar, .scan-globe-marker')) return;
      window.clearPlanetScanSelection?.();
    });

    document.addEventListener('click', event => {
      const closeButton = event.target.closest?.('#scanDetailCloseBtn');
      if (!closeButton) return;
      event.preventDefault();
      window.clearPlanetScanSelection?.();
    });

    window.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const screen = document.getElementById('planetScanScreen');
      if (!screen?.classList.contains('active')) return;
      const panel = document.getElementById('scanDetailPanel');
      if (!panel?.classList.contains('is-open')) return;
      window.clearPlanetScanSelection?.();
    });

    window.addEventListener('resize', () => {
      if (document.getElementById('planetScanScreen')?.classList.contains('active')) {
        queueRender();
      }
    });
  }

  function render(config, profile, site) {
    const ui = refs();
    const renderer = window.HavenfallPlanetGlobeRenderer;
    if (!ui || !renderer?.drawGlobe) return;

    bindLayoutEvents();
    window.HavenfallPlanetScanUI?.renderTopBar?.(profile, site, config);
    window.HavenfallPlanetScanUI?.renderSelectionHint?.(profile, site);
    window.HavenfallPlanetScanUI?.renderSelectedLandingPanel?.(site, profile);

    const canvas = ensureCanvas(ui.globe);
    if (!canvas) return;

    const scale = renderer.drawGlobe(canvas, worldMap(profile, site), site || null, {
      minWidth: 320,
      minHeight: 320,
      minRadius: 140,
      radiusWidthFactor: 0.36,
      radiusHeightFactor: 0.42,
      centerX: 0.5,
      centerY: 0.54,
      showRoutes: false,
      showLabels: false,
      showGlyphs: false,
      seed: config?.seed || profile?.seed || 'havenfall-scan'
    });

    renderMarkerLayer(ui.globe, scale, profile, site);
    renderRadarLabel(ui.label, profile, site);
    ui.detailPanel?.classList.toggle('is-open', !!site);
    ui.screen?.classList.toggle('scan-has-selection', !!site);
  }

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      const config = window.HavenfallPlanetScanUI?.activeConfig?.();
      const profile = config?.planetScan || null;
      const site = window.HavenfallPlanetScanUI?.selectedSite?.(profile, config) || null;
      render(config, profile, site);
    });
  }

  window.HavenfallPlanetScanGlobeUI = Object.freeze({
    ensureLayout,
    render,
    queueRender
  });

  queueRender();
})();
