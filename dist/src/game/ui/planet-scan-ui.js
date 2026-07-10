'use strict';

(() => {
  if (window.HavenfallContext?.planetScanUiInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.planetScanUiInstalled = true;

  const BIOME_LABELS = Object.freeze({
    forest: 'Floresta temperada',
    desert: 'Deserto seco',
    snow: 'Regiao fria',
    rock: 'Vale rochoso',
    water: 'Bacia hidrica'
  });

  const RESOURCE_LABELS = Object.freeze({
    wood: 'Madeira',
    food: 'Comida',
    stone: 'Pedra',
    metal: 'Metal',
    medicine: 'Remedios',
    water: 'Agua'
  });

  const RISK_LABELS = Object.freeze({
    fauna: 'Fauna',
    weather: 'Clima',
    disease: 'Doenca',
    raids: 'Ameacas',
    terrain: 'Terreno'
  });

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

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function activeConfig(config = null) {
    const base = config
      || (typeof newGameConfig !== 'undefined' && newGameConfig)
      || (typeof readNewGameConfigSafe === 'function' ? readNewGameConfigSafe() : defaultNewGameConfig);
    const ensured = typeof ensurePlanetScanOnConfig === 'function' ? ensurePlanetScanOnConfig(base) : base;
    if (typeof newGameConfig !== 'undefined') newGameConfig = ensured;
    return ensured;
  }

  function selectedSite(profile, config = null) {
    const selectedId = config?.selectedLandingSiteId || profile?.selectedLandingSiteId || null;
    if (!selectedId) return null;
    return profile?.landingSites?.find(site => site.id === selectedId) || profile?.selectedLandingSite || null;
  }

  function average(values = {}) {
    const nums = Object.values(values).map(value => Number(value) || 0);
    return nums.length ? Math.round(nums.reduce((sum, value) => sum + value, 0) / nums.length) : 0;
  }

  function topEntries(values = {}, labels = {}, count = 4) {
    return Object.entries(values)
      .map(([key, value]) => ({ key, label: labels[key] || key, value: clamp(value, 0, 100) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, count);
  }

  function sectionList(items = []) {
    if (!items.length) return '<li>Sem destaque adicional.</li>';
    return items.map(item => `<li>${esc(item)}</li>`).join('');
  }

  function meterRows(entries = [], tone = 'resource') {
    return entries.map(entry => `
      <div class="scan-bar-row">
        <span>${esc(entry.label)}</span>
        <div class="scan-bar-track ${tone}">
          <i style="width:${entry.value}%"></i>
        </div>
        <b>${entry.value}</b>
      </div>`).join('');
  }

  function sectorMeta(profile, site, config) {
    const chunks = [
      `Seed ${config.seed || 'SEM-SEED'}`,
      profile?.sectorId || 'Setor sem ID',
      `${(profile?.landingSites || []).length} pontos`
    ];
    if (site) chunks.push(`Pouso ${site.name}`);
    return chunks.join(' • ');
  }

  function renderTopBar(profile, site, config) {
    const title = document.getElementById('scanSectorTitle');
    const meta = document.getElementById('scanSectorMeta');
    if (title) title.textContent = 'Analise orbital de setor';
    if (meta) meta.textContent = sectorMeta(profile, site, config);
  }

  function renderSelectionHint(profile, site) {
    const hint = document.getElementById('scanSelectionHint');
    if (!hint) return;
    if (site) {
      hint.innerHTML = '';
      hint.classList.add('is-hidden');
      return;
    }

    hint.classList.remove('is-hidden');
    hint.innerHTML = `
      <div class="scan-hint-copy">
        <div class="kicker">Estado idle</div>
        <h2>Selecione um ponto de pouso</h2>
        <p>O globo mostra os locais candidatos. Clique em um marcador para abrir o dossie do setor e liberar o avancar.</p>
        <small>${(profile?.landingSites || []).length} pontos orbitais disponiveis neste setor.</small>
      </div>`;
  }

  function renderSelectedLandingPanel(site, profile) {
    const content = document.getElementById('scanDetailContent');
    if (!content) return;
    if (!site) {
      content.innerHTML = '';
      return;
    }

    const subtitle = site.labels?.subtitle || BIOME_LABELS[site.biomes?.primary] || 'Setor orbital';
    const chips = [
      { label: 'Bioma', value: BIOME_LABELS[site.biomes?.primary] || site.biomes?.primary || 'Misto' },
      { label: 'Espaco', value: `${clamp(site.buildSpace, 0, 100)}` },
      { label: 'Fertilidade', value: `${clamp(site.fertility, 0, 100)}` },
      { label: 'Assinaturas', value: `${(site.signatures || []).length}` }
    ];
    const resourceRows = meterRows(topEntries(site.resources, RESOURCE_LABELS, 4), 'resource');
    const riskRows = meterRows(topEntries(site.risks, RISK_LABELS, 4), 'risk');
    const score = clamp(site.difficulty?.score, 0, 100);
    const riskAvg = average(site.risks);
    const resourceAvg = average(site.resources);

    content.innerHTML = `
      <div class="scan-panel-head">
        <div class="scan-panel-copy">
          <h2>${esc(site.name)}</h2>
          <p>${esc(subtitle)}</p>
        </div>
        <div class="scan-score-badge">
          <small>Score</small>
          <b>${score}</b>
          <span>${esc(site.difficulty?.label || 'Moderado')}</span>
        </div>
      </div>
      <div class="scan-chip-row">
        ${chips.map(chip => `<span class="scan-chip"><small>${esc(chip.label)}</small><b>${esc(chip.value)}</b></span>`).join('')}
      </div>
      <div class="scan-detail-grid">
        <section class="scan-detail-section">
          <div class="kicker">Recursos</div>
          <div class="scan-bar-list">${resourceRows}</div>
          <small>Media de recursos: ${resourceAvg}</small>
        </section>
        <section class="scan-detail-section">
          <div class="kicker">Riscos</div>
          <div class="scan-bar-list">${riskRows}</div>
          <small>Media de risco: ${riskAvg}</small>
        </section>
        <section class="scan-detail-section">
          <div class="kicker">Vantagens</div>
          <ul class="scan-bullet-list">${sectionList(site.positives)}</ul>
        </section>
        <section class="scan-detail-section">
          <div class="kicker">Problemas</div>
          <ul class="scan-bullet-list">${sectionList(site.negatives)}</ul>
        </section>
      </div>`;
  }

  function syncProceedButton(site) {
    const button = dom?.buttons?.scanProceed || document.getElementById('scanProceedBtn');
    if (!button) return;
    button.disabled = !site;
    button.textContent = site ? 'Continuar com este pouso' : 'Selecione um ponto valido';
  }

  function clearPlanetScanSelection(config = null) {
    const base = activeConfig(config);
    const cleared = typeof clearLandingSiteSelectionInConfig === 'function'
      ? clearLandingSiteSelectionInConfig(base)
      : {
          ...base,
          selectedLandingSiteId: null,
          selectedLandingSite: null,
          landingSiteId: null,
          planetScan: {
            ...(base.planetScan || {}),
            selectedLandingSiteId: null,
            selectedLandingSite: null
          }
        };
    if (typeof newGameConfig !== 'undefined') newGameConfig = cleared;
    if (typeof updateSetupSummary === 'function') updateSetupSummary();
    refreshPlanetScan(cleared);
    return cleared;
  }

  function selectLandingSite(siteId) {
    const base = activeConfig();
    const next = typeof selectLandingSiteInConfig === 'function'
      ? selectLandingSiteInConfig(base, siteId)
      : { ...base, selectedLandingSiteId: siteId, landingSiteId: siteId };
    if (typeof newGameConfig !== 'undefined') newGameConfig = next;
    if (typeof updateSetupSummary === 'function') updateSetupSummary();
    refreshPlanetScan(next);
  }

  function refreshPlanetScan(config = null) {
    const ensured = activeConfig(config);
    const profile = ensured.planetScan || null;
    const site = selectedSite(profile, ensured);

    renderTopBar(profile, site, ensured);
    renderSelectionHint(profile, site);
    renderSelectedLandingPanel(site, profile);
    syncProceedButton(site);

    window.HavenfallPlanetScanDebug = {
      config: ensured,
      planetScan: profile,
      selectedLandingSite: site,
      landingSites: profile?.landingSites || []
    };

    window.HavenfallPlanetScanGlobeUI?.render?.(ensured, profile, site);
    return ensured;
  }

  window.HavenfallPlanetScanUI = Object.freeze({
    refreshPlanetScan,
    selectLandingSite,
    clearPlanetScanSelection,
    renderSelectionHint,
    renderSelectedLandingPanel,
    renderTopBar,
    activeConfig,
    selectedSite
  });

  window.refreshPlanetScan = refreshPlanetScan;
  window.selectLandingSite = selectLandingSite;
  window.clearPlanetScanSelection = clearPlanetScanSelection;
})();
