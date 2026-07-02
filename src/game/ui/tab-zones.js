'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.tabViews = window.HavenfallUI.tabViews || {};

  let selectedPlotId = null;

  function zoneEntries() {
    const defs = { ...(typeof zoneDefs !== 'undefined' ? zoneDefs : {}), ...(window.HavenfallZones?.getAllZoneDefs?.() || {}) };
    if (!defs.growing && (window.cropDefs || window.HavenfallFarming)) {
      defs.growing = {
        label: 'Zona de cultivo',
        short: 'Cultivo',
        hint: 'Pinte a área do talhão agrícola.'
      };
    }
    return Object.entries(defs);
  }

  function cropOptions(selected) {
    return Object.entries(window.cropDefs || {}).map(([key, def]) => `<option value="${escapeHtml(key)}" ${selected === key ? 'selected' : ''}>${escapeHtml(def.label || key)}</option>`).join('');
  }

  function phaseLabel(phase) {
    const labels = {
      prepare: 'preparar solo',
      readyToSow: 'pronto para semear',
      sown: 'semeado',
      growing: 'crescendo',
      mature: 'maduro',
      harvested: 'colhido',
      needsReplant: 'replantar'
    };
    return labels[phase] || phase || 'vazio';
  }

  function rainLabel(value) {
    const labels = {
      benefits: 'beneficia com chuva moderada',
      neutral: 'responde de forma neutra',
      overwater_risk: 'pode sofrer com excesso de água',
      rot_risk: 'risco de apodrecer com muita chuva'
    };
    return labels[value] || value || 'neutra';
  }

  function selectedPlotInfo() {
    const farming = state?.farming;
    if (!selectedPlotId || !farming?.plots?.[selectedPlotId]) return null;
    const plot = farming.plots[selectedPlotId];
    const cells = Object.values(farming.cells || {}).filter(cell => cell.plotId === plot.id);
    const crop = window.cropDefs?.[plot.cropId] || null;
    const avg = prop => cells.length ? Math.round(cells.reduce((sum, cell) => sum + Number(cell[prop] || 0), 0) / cells.length) : 0;
    const mature = cells.filter(cell => cell.phase === 'mature').length;
    const sample = cells[0] || null;
    return { plot, cells, crop, avgGrowth: avg('growth'), avgWater: avg('water'), avgHealth: avg('health'), mature, sample };
  }

  function renderSelectedPlotPanel() {
    const info = selectedPlotInfo();
    if (!info) return '';
    const { plot, cells, crop, avgGrowth, avgWater, avgHealth, mature, sample } = info;
    return `<section class="dock-context-card farming-plot-card" data-plot-id="${escapeHtml(plot.id)}">
      <div class="dock-tab-head"><div><h3>${escapeHtml(plot.name || 'Talhão')}</h3><small>${cells.length} célula${cells.length === 1 ? '' : 's'} · ${escapeHtml(plot.status || phaseLabel(sample?.phase))}</small></div></div>
      <label class="dock-field"><small>Cultivo do talhão</small><select data-plot-crop="${escapeHtml(plot.id)}">${cropOptions(plot.cropId)}</select></label>
      <div class="dock-card-grid compact">
        <div class="dock-card"><strong>${avgGrowth}%</strong><small>crescimento médio</small></div>
        <div class="dock-card"><strong>${avgWater}%</strong><small>umidade</small></div>
        <div class="dock-card"><strong>${avgHealth}%</strong><small>saúde</small></div>
        <div class="dock-card"><strong>${mature}</strong><small>célula${mature === 1 ? '' : 's'} madura${mature === 1 ? '' : 's'}</small></div>
      </div>
      ${crop ? `<small>Cresce em ${escapeHtml(String(crop.growHours))}h · Estraga em ${escapeHtml(String(crop.perishHours))}h · ${crop.needsCooling ? 'precisa refrigeração' : 'não exige frio'}.</small>
      <small>Melhor uso: ${escapeHtml(crop.bestUse || 'consumo básico')} · Chuva: ${escapeHtml(rainLabel(crop.rainResponse))}.</small>` : '<small>Escolha um cultivo para ativar este talhão.</small>'}
    </section>`;
  }

  function renderZoneButton(key, def) {
    return `<button type="button" class="dock-card zone-card ${currentZoneTool === key ? 'is-active' : ''}" data-zone-tool="${escapeHtml(key)}">
      <strong>${escapeHtml(def.short || def.label)}</strong>
      <small>${escapeHtml(def.hint || '')}</small>
    </button>`;
  }

  function render() {
    if (!state) return '<div class="dock-empty">Inicie uma partida para marcar zonas.</div>';
    return `<div class="zones-panel" data-zones-panel>
      <div class="dock-tab-head"><div><h3>Zonas</h3></div></div>
      <div class="dock-card-grid">
        ${zoneEntries().map(([key, def]) => renderZoneButton(key, def)).join('')}
        <button type="button" class="dock-card zone-card ${currentZoneTool === 'none' ? 'is-active' : ''}" data-zone-tool="none"><strong>Apagar</strong><small>Remove zonas pintadas.</small></button>
      </div>
      ${renderSelectedPlotPanel()}
    </div>`;
  }

  function onOpen() {
    document.body.classList.toggle('zone-brush-active', !!currentZoneTool);
  }

  function stopEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  function activateZoneTool(tool) {
    if (window.HavenfallZoneInput?.setTool?.(tool)) return true;
    if (typeof setZoneTool === 'function') {
      setZoneTool(tool);
      return true;
    }
    return false;
  }

  function handleZoneToolClick(event) {
    const button = event.target.closest?.('#anchored-ui-panel[data-active-dock-tab="zones"] [data-zone-tool]');
    if (!button) return;
    stopEvent(event);
    selectedPlotId = null;
    activateZoneTool(button.dataset.zoneTool);
  }

  function handleChange(event) {
    const select = event.target.closest?.('[data-plot-crop]');
    if (!select) return;
    event.preventDefault();
    const plotId = select.dataset.plotCrop;
    selectedPlotId = plotId;
    window.HavenfallFarming?.setPlotCrop?.(plotId, select.value);
    window.HavenfallUI.refreshDockPanel?.('zones');
  }

  function canvasTileFromClick(event) {
    if (typeof canvas === 'undefined' || event.target !== canvas) return null;
    if (typeof tileFromEvent === 'function') return tileFromEvent(event);
    return null;
  }

  function handleMapPlotClick(event) {
    if (currentZoneTool || !state || appScreen !== SCREEN.PLAYING) return;
    const tile = canvasTileFromClick(event);
    if (!tile) return;
    const info = window.HavenfallFarming?.inspectPlotAt?.(tile.x, tile.y);
    if (!info?.plot) return;
    selectedPlotId = info.plot.id;
    window.HavenfallUI.renderDockPanel?.('zones');
    stopEvent(event);
  }

  document.addEventListener('pointerdown', handleZoneToolClick, true);
  document.addEventListener('click', handleZoneToolClick, true);
  document.addEventListener('change', handleChange, true);
  document.addEventListener('click', handleMapPlotClick, true);
  window.HavenfallUI.tabViews.zones = { render, onOpen };
})();
